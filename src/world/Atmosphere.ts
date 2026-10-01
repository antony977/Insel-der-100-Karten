import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import type { Weather } from '../systems/Weather';
import { Sound } from '../audio/AudioEngine';
import { Display } from '../systems/Display';

/** Lichtquelle in Weltkoordinaten */
export interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha?: number;
}

const DEPTH_WEATHER = 148600;
const DEPTH_LIGHT = 149000;

function lerpColor(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const r = Math.round(ar + (((b >> 16) & 255) - ar) * k);
  const g = Math.round(ag + (((b >> 8) & 255) - ag) * k);
  const bb = Math.round(ab + ((b & 255) - ab) * k);
  return (r << 16) | (g << 8) | bb;
}

function mulColor(a: number, b: number): number {
  const r = Math.round((((a >> 16) & 255) * ((b >> 16) & 255)) / 255);
  const g = Math.round((((a >> 8) & 255) * ((b >> 8) & 255)) / 255);
  const bb = Math.round(((a & 255) * (b & 255)) / 255);
  return (r << 16) | (g << 8) | bb;
}

const DAY = 0xffffff;
const DUSK = 0xffb98c;
const NIGHT = 0x3c4482;
const MOON = 0x5864a8;
const DAWN = 0xffc8b8;
const CAVE = 0x2e2840;

/** Umgebungsfarbe (Multiplikation) für Uhrzeit, Mond und Höhlen. 0xffffff = keine Abdunklung. */
export function ambientFor(clock: number, fullMoon: boolean, dark: boolean): number {
  if (dark) return CAVE;
  const h = clock / 60;
  const night = fullMoon ? MOON : NIGHT;
  if (h >= 6.5 && h < 18) return DAY;
  if (h >= 18 && h < 19.2) return lerpColor(DAY, DUSK, (h - 18) / 1.2);
  if (h >= 19.2 && h < 20.5) return lerpColor(DUSK, night, (h - 19.2) / 1.3);
  if (h >= 20.5 || h < 4.5) return night;
  if (h < 5.5) return lerpColor(night, DAWN, h - 4.5);
  return lerpColor(DAWN, DAY, (h - 5.5) / 1);
}

interface Drop {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Licht und Wetter: Tag-Nacht-Farbe per Multiplikations-Ebene (niedrige Auflösung =
 * Pixel-Optik), additive Lichtkegel für Laternen, Lagerfeuer und die Spielfigur;
 * dazu Regen, Schnee, Sand, Nebelschwaden und Blitze.
 */
export class Atmosphere {
  private readonly scene: Phaser.Scene;
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly drops: Drop[] = [];
  private readonly fogs: Phaser.GameObjects.Image[] = [];
  private readonly flash: Phaser.GameObjects.Rectangle;
  /** bildschirmfeste Ebene (Regen, Nebel, Blitz) */
  private readonly layer: Phaser.GameObjects.Container;
  private weather: Weather = 'klar';
  /** sanfter Übergang 0–1 */
  private amount = 0;
  private fogAmount = 0;
  private boltT = 8;
  private time = 0;
  heavyFog = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rt = scene.add
      .renderTexture(0, 0, GAME_W, GAME_H)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_LIGHT)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(false);
    this.layer = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH_WEATHER);
    for (let i = 0; i < 130; i++) {
      const img = scene.add.image(0, 0, 'fx-rain').setVisible(false);
      this.layer.add(img);
      this.drops.push({ img, vx: 0, vy: 0, life: 0 });
    }
    for (let i = 0; i < 7; i++) {
      const f = scene.add
        .image(Math.random() * GAME_W, 20 + i * 38, 'fx-fog')
        .setScale(2 + (i % 3) * 0.5, 2)
        .setAlpha(0)
        .setVisible(false);
      this.fogs.push(f);
    }
    // Nebel liegt unter dem Niederschlag
    this.layer.addAt(this.fogs, 0);
    this.flash = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH_LIGHT + 1);
  }

  setWeather(w: Weather): void {
    if (w === this.weather) return;
    this.weather = w;
    // Partikel neu mischen
    for (const d of this.drops) d.life = 0;
  }

  get current(): Weather {
    return this.weather;
  }

  /** Wolken dunkeln den Tag ab */
  private weatherTint(): number {
    switch (this.weather) {
      case 'regen':
        return 0xc8cce0;
      case 'sturm':
        return 0x9aa0c0;
      case 'schnee':
        return 0xdde4f4;
      case 'nebel':
        return 0xd8e0e0;
      case 'sand':
        return 0xf0d4a8;
      default:
        return 0xffffff;
    }
  }

  /**
   * Bildschirmfeste Objekte werden von der Kamera um ihre Mitte gezoomt – daher um
   * (Faktor − 1) / 2 Bildschirme versetzen, damit sie genau das Bild abdecken.
   */
  private layout(): void {
    const r = Display.renderScale;
    const ox = (GAME_W * (r - 1)) / 2;
    const oy = (GAME_H * (r - 1)) / 2;
    this.rt.setPosition(ox, oy);
    this.layer.setPosition(ox, oy);
    this.flash.setPosition(ox, oy);
  }

  update(dt: number, view: Phaser.Geom.Rectangle, ambient: number, lights: Light[]): void {
    this.time += dt;
    this.layout();
    const active = this.weather !== 'klar' && this.weather !== 'nebel';
    this.amount = Phaser.Math.Clamp(this.amount + (active ? dt : -dt) * 0.5, 0, 1);
    const wantFog = this.weather === 'nebel' ? (this.heavyFog ? 1 : 0.55) : this.weather === 'regen' || this.weather === 'sturm' ? 0.15 : 0;
    this.fogAmount += (wantFog - this.fogAmount) * Math.min(1, dt * 0.6);

    // --- Licht
    const tint = lerpColor(0xffffff, this.weatherTint(), Math.max(this.amount, this.weather === 'nebel' ? this.fogAmount : 0));
    const color = mulColor(ambient, tint);
    const dark = color !== 0xffffff;
    this.rt.setVisible(dark);
    if (dark) {
      this.rt.clear();
      this.rt.fill(color, 1);
      // Lichter nur, wenn es wirklich dunkel ist
      const lum = (((color >> 16) & 255) + ((color >> 8) & 255) + (color & 255)) / 765;
      if (lum < 0.85) {
        const strength = Math.min(1, (0.85 - lum) / 0.45);
        for (const l of lights) {
          const sx = l.x - view.x;
          const sy = l.y - view.y;
          if (sx < -l.radius || sy < -l.radius || sx > GAME_W + l.radius || sy > GAME_H + l.radius) continue;
          const flicker = 1 + Math.sin(this.time * 9 + l.x * 0.13) * 0.025;
          this.rt.stamp('light-soft', undefined, Math.round(sx), Math.round(sy), {
            scale: ((l.radius * 2) / 64) * flicker,
            tint: l.color,
            alpha: (l.alpha ?? 0.9) * strength,
            blendMode: Phaser.BlendModes.ADD,
          });
        }
      }
    }

    // --- Nebel
    for (let i = 0; i < this.fogs.length; i++) {
      const f = this.fogs[i];
      const show = this.fogAmount > 0.02;
      f.setVisible(show);
      if (!show) continue;
      f.x -= dt * (6 + (i % 3) * 4);
      if (f.x < -f.displayWidth / 2) f.x = GAME_W + f.displayWidth / 2;
      f.y = 18 + i * 38 + Math.sin(this.time * 0.3 + i) * 6;
      f.setAlpha(this.fogAmount * (0.45 + (i % 2) * 0.2));
    }

    // --- Niederschlag
    const w = this.weather;
    const want = !active ? 0 : w === 'sturm' ? 130 : w === 'regen' ? 75 : w === 'schnee' ? 70 : w === 'sand' ? 90 : 0;
    const count = Math.round(want * this.amount);
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (i >= count) {
        d.img.setVisible(false);
        continue;
      }
      d.life -= dt;
      if (d.life <= 0 || d.img.y > GAME_H + 8 || d.img.x < -10 || d.img.x > GAME_W + 10) this.respawn(d);
      d.img.x += d.vx * dt;
      d.img.y += d.vy * dt;
      if (w === 'schnee') d.img.x += Math.sin(this.time * 2 + i) * 12 * dt;
    }

    // --- Blitze
    if (w === 'sturm' && this.amount > 0.6) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 7 + Math.random() * 12;
        this.flash.setAlpha(0.7);
        this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 260, ease: 'Quad.Out' });
        this.scene.time.delayedCall(250 + Math.random() * 700, () => Sound.play('thunder', { vary: 0.15 }));
      }
    }
    // Geräuschkulisse
    if (w === 'regen' || w === 'sturm') Sound.ambient('rainLoop', (w === 'sturm' ? 1 : 0.6) * this.amount);
    else if (w === 'sand' || (w === 'schnee' && this.amount > 0.2)) Sound.ambient('windLoop', 0.7 * this.amount);
    else Sound.ambient(null);
  }

  private respawn(d: Drop): void {
    const w = this.weather;
    const img = d.img;
    img.setVisible(true);
    if (w === 'schnee') {
      img.setTexture('fx-snow', Math.floor(Math.random() * 3)).setAlpha(0.9).setAngle(0);
      img.setPosition(Math.random() * (GAME_W + 40) - 20, -6 - Math.random() * GAME_H * 0.5);
      d.vx = -8 - Math.random() * 10;
      d.vy = 22 + Math.random() * 18;
      d.life = 20;
    } else if (w === 'sand') {
      img.setTexture('fx-sand').setAlpha(0.85).setAngle(0);
      img.setPosition(GAME_W + Math.random() * 40, Math.random() * GAME_H);
      d.vx = -220 - Math.random() * 120;
      d.vy = 10 + Math.random() * 25;
      d.life = 4;
    } else {
      img.setTexture('fx-rain').setAlpha(w === 'sturm' ? 0.8 : 0.6).setAngle(0);
      img.setPosition(Math.random() * (GAME_W + 80) - 20, -10 - Math.random() * GAME_H);
      const storm = w === 'sturm';
      d.vx = storm ? -90 : -35;
      d.vy = (storm ? 330 : 260) + Math.random() * 60;
      d.life = 3;
    }
  }

  destroy(): void {
    Sound.ambient(null);
  }
}
