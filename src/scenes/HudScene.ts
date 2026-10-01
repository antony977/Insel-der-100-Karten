import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input, type InputSource } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { DEBUG, GAME_H, GAME_W } from '../config';
import { Settings } from '../systems/Settings';
import { Display } from '../systems/Display';
import { keyLabel } from '../input/Actions';
import { charFrame } from '../gfx/generators/characters';
import { wrapText } from '../gfx/font/PixelFont';
import type { WorldMap } from '../world/WorldMap';

export const HUD_EVENTS = {
  toast: 'hud-toast',
  message: 'hud-message',
} as const;

export interface HudMessage {
  name: string;
  text: string;
  /** Textur-Schlüssel einer Figur für das Portrait */
  portrait?: string;
}

interface Toast {
  panel: Phaser.GameObjects.NineSlice;
  text: Phaser.GameObjects.BitmapText;
  t: number;
}

const MINIMAP_W = 64;
const MINIMAP_H = 44;

/**
 * HUD: LP, Aura, Geld, Sammelfortschritt, Schnellzauber, Minimap, Hinweise, Meldungen.
 * Läuft als eigene Szene über der Welt (eigene Kamera, logische Koordinaten).
 */
export class HudScene extends BaseScene {
  private lpFill!: Phaser.GameObjects.Rectangle;
  private auraFill!: Phaser.GameObjects.Rectangle;
  private money!: Phaser.GameObjects.BitmapText;
  private progress!: Phaser.GameObjects.BitmapText;
  private slots: Phaser.GameObjects.Container[] = [];
  private hint!: Phaser.GameObjects.BitmapText;
  private fps!: Phaser.GameObjects.BitmapText;
  private debugText!: Phaser.GameObjects.BitmapText;
  private toasts: Toast[] = [];
  private minimap!: Phaser.GameObjects.Image;
  private minimapFrame!: Phaser.GameObjects.NineSlice;
  private minimapDot!: Phaser.GameObjects.Rectangle;
  private msgBox!: Phaser.GameObjects.Container;
  private msgText!: Phaser.GameObjects.BitmapText;
  private msgName!: Phaser.GameObjects.BitmapText;
  private msgPortrait!: Phaser.GameObjects.Sprite;
  private msgFull = '';
  private msgShown = 0;
  private msgOpenedAt = 0;
  private msgMore!: Phaser.GameObjects.BitmapText;
  private showDebug = false;
  private pointerTapped = false;
  private hintT = 0;
  private fpsAcc = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.setupCamera();
    this.toasts = [];
    this.slots = [];

    // --- Werte oben links ---
    addPanel(this, 4, 4, 112, 40);
    this.add.image(10, 10, 'ui-icons', 0).setOrigin(0, 0);
    this.add.rectangle(22, 11, 86, 7, PAL.ink).setOrigin(0, 0);
    this.lpFill = this.add.rectangle(23, 12, 84, 5, PAL.red).setOrigin(0, 0);
    this.add.rectangle(23, 12, 84, 1, PAL.coral).setOrigin(0, 0);
    this.add.image(10, 21, 'ui-icons', 1).setOrigin(0, 0);
    this.add.rectangle(22, 22, 86, 7, PAL.ink).setOrigin(0, 0);
    this.auraFill = this.add.rectangle(23, 23, 84, 5, PAL.cyan).setOrigin(0, 0);
    this.add.rectangle(23, 23, 84, 1, PAL.ice).setOrigin(0, 0);
    this.add.image(10, 31, 'ui-icons', 2).setOrigin(0, 0);
    this.money = addText(this, 22, 29, '0', { font: 'px-s', color: PAL.gold });

    // --- Sammelfortschritt (oben Mitte) ---
    addPanel(this, GAME_W / 2 - 34, 4, 68, 18);
    this.add.image(GAME_W / 2 - 26, 8, 'ui-icons', 3).setOrigin(0, 0);
    this.progress = addText(this, GAME_W / 2 + 6, 7, '0/100', { font: 'px-s', ox: 0.5, color: PAL.cream });

    // --- Minimap (oben rechts) ---
    this.buildMinimapTexture();
    this.minimapFrame = addPanel(this, GAME_W - MINIMAP_W - 12, 4, MINIMAP_W + 8, MINIMAP_H + 8);
    this.minimap = this.add.image(GAME_W - MINIMAP_W - 8, 8, 'minimap').setOrigin(0, 0);
    this.minimapDot = this.add.rectangle(0, 0, 2, 2, PAL.white).setOrigin(0.5, 0.5);

    // --- Schnellzauber (unten rechts, nur ohne Touch) ---
    for (let i = 0; i < 3; i++) {
      const x = GAME_W - 82 + i * 26;
      const c = this.add.container(x, GAME_H - 34);
      const frame = addPanel(this, 0, 0, 22, 28, 'ui-frame');
      const num = addText(this, 11, 8, String(i + 1), { font: 'px-o', ox: 0.5, color: PAL.ice });
      c.add([frame, num]);
      this.slots.push(c);
    }

    // --- Hinweise / FPS / Debug ---
    this.hint = addText(this, 6, GAME_H - 14, '', { font: 'px-o', color: PAL.silver });
    this.fps = addText(this, 6, 47, '', { font: 'px-o', color: PAL.lime });
    this.debugText = addText(this, 6, 60, '', { font: 'px-o', color: PAL.white }).setVisible(false);

    // --- Meldungsfenster ---
    this.buildMessageBox();

    const onToast = (t: string) => this.toast(t);
    const onMsg = (m: HudMessage) => this.showMessage(m);
    this.game.events.on(HUD_EVENTS.toast, onToast);
    this.game.events.on(HUD_EVENTS.message, onMsg);
    const offSrc = Input.onSourceChange((s) => this.applySource(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(HUD_EVENTS.toast, onToast);
      this.game.events.off(HUD_EVENTS.message, onMsg);
      offSrc();
      this.registry.set('messageOpen', false);
    });
    this.applySource(Input.source);
    this.registry.set('messageOpen', false);
    this.input.on('pointerdown', () => {
      if (this.msgBox.visible) this.pointerTapped = true;
    });
  }

  private buildMinimapTexture(): void {
    // Minimap aus den Terrainfarben (1 px pro Zelle)
    const map = this.registry.get('worldMap') as WorldMap | undefined;
    if (!map) return;
    if (this.textures.exists('minimap')) this.textures.remove('minimap');
    const canvas = document.createElement('canvas');
    canvas.width = map.w;
    canvas.height = map.h;
    const ctx = canvas.getContext('2d')!;
    const colors = ['#2546a8', '#e8c47e', '#c99a5b', '#6cc24a', '#2f8a3e', '#968daa'];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        ctx.fillStyle = colors[map.terrain[y * map.w + x]] ?? '#000';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    this.textures.addCanvas('minimap', canvas);
  }

  private buildMessageBox(): void {
    const w = 440;
    const h = 62;
    const x = (GAME_W - w) / 2;
    const y = GAME_H - h - 8;
    const panel = addPanel(this, 0, 0, w, h);
    const portraitBg = addPanel(this, 6, 6, 50, 50, 'ui-frame-gold');
    this.msgPortrait = this.add.sprite(31, 2, 'player', charFrame('down', 'idle0')).setOrigin(0.5, 0).setScale(2);
    // Portrait: nur Kopf zeigen
    this.msgPortrait.setCrop(2, 3, 20, 18);
    this.msgName = addText(this, 64, 6, '', { font: 'px-s', color: PAL.gold });
    this.msgText = addText(this, 64, 19, '', { font: 'px-s', color: PAL.white });
    this.msgMore = addText(this, w - 12, h - 14, '▼', { font: 'px-s', color: PAL.gold });
    this.msgBox = this.add.container(x, y, [panel, portraitBg, this.msgPortrait, this.msgName, this.msgText, this.msgMore]);
    this.msgBox.setDepth(50).setVisible(false);
  }

  private showMessage(m: HudMessage): void {
    this.msgFull = wrapText(m.text, 360).join('\n');
    this.msgShown = 0;
    this.msgName.setText(m.name);
    this.msgText.setText('');
    if (m.portrait) {
      this.msgPortrait.setTexture(m.portrait, charFrame('down', 'idle0')).setVisible(true);
    } else this.msgPortrait.setVisible(false);
    this.msgBox.setVisible(true);
    this.msgOpenedAt = this.time.now;
    this.registry.set('messageOpen', true);
    Input.setContext('menu');
  }

  private closeMessage(): void {
    this.msgBox.setVisible(false);
    this.registry.set('messageOpen', false);
    Input.setContext('gameplay');
  }

  toast(text: string): void {
    const lines = wrapText(text, 300);
    const h = lines.length * 12 + 10;
    const panel = addPanel(this, 0, 0, 316, h, 'ui-frame');
    panel.setPosition(GAME_W / 2 - 158, 28);
    const t = addText(this, GAME_W / 2, 33, lines.join('\n'), { font: 'px-s', ox: 0.5, color: PAL.white, align: 'center' });
    for (const old of this.toasts) {
      old.panel.y += h + 2;
      old.text.y += h + 2;
    }
    this.toasts.push({ panel, text: t, t: 0 });
    if (this.toasts.length > 3) {
      const o = this.toasts.shift()!;
      o.panel.destroy();
      o.text.destroy();
    }
  }

  private applySource(s: InputSource): void {
    const touch = s === 'touch';
    for (const c of this.slots) c.setVisible(!touch);
    const b = Settings.get().bindings;
    const k = (a: keyof typeof b) => keyLabel(b[a][0] ?? '?');
    if (s === 'keyboard' || s === 'mouse') {
      this.hint.setText(
        `${k('up')}${k('left')}${k('down')}${k('right')} Laufen · ${k('attack')} Angriff · ${k('dodge')} Rolle · ${k('aura')} Aura · ${k('book')} Buch · ${k('pause')} Pause`,
      );
    } else if (s === 'gamepad') {
      this.hint.setText('Stick Laufen · A Angriff · B Rolle · X Aura · Y Buch · Start Pause');
    } else {
      this.hint.setText('');
    }
    this.layoutForTouch(touch);
    this.hintT = 0;
  }

  /** Auf Touch-Geräten liegen oben rechts Buttons → Minimap darunter verschieben. */
  private layoutForTouch(touch: boolean): void {
    let y = 4;
    if (touch) {
      const rect = this.game.canvas.getBoundingClientRect();
      const ins = Display.safeInsets();
      const scale = rect.height / GAME_H;
      const buttonsBottomCss = ins.top + 10 + Math.max(48, 58 * Math.min(1, Math.max(0.8, window.innerHeight / 400)) * Settings.get().touchSize) + 6;
      y = Math.max(4, Math.ceil((buttonsBottomCss - rect.top) / scale));
    }
    this.minimapFrame.setY(y);
    this.minimap.setY(y + 4);
  }

  override update(time: number, delta: number): void {
    const dt = delta / 1000;
    // Toasts ausblenden
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.t += dt;
      const a = t.t > 4 ? Math.max(0, 1 - (t.t - 4) / 0.5) : 1;
      t.panel.setAlpha(a);
      t.text.setAlpha(a);
      if (a <= 0) {
        t.panel.destroy();
        t.text.destroy();
        this.toasts.splice(i, 1);
      }
    }

    // Steuerungshinweis nach einigen Sekunden ausblenden
    this.hintT += dt;
    const hintAlpha = this.hintT < 10 ? 1 : Math.max(0, 1 - (this.hintT - 10));
    this.hint.setAlpha(this.msgBox.visible ? 0 : hintAlpha);

    // Meldung mit Tippeffekt
    if (this.msgBox.visible) {
      const speed = [30, 60, 120, 9999][Settings.get().textSpeed] ?? 60;
      if (this.msgShown < this.msgFull.length) {
        this.msgShown = Math.min(this.msgFull.length, this.msgShown + speed * dt);
        this.msgText.setText(this.msgFull.slice(0, Math.floor(this.msgShown)));
      }
      this.msgMore.setVisible(this.msgShown >= this.msgFull.length && Math.floor(time / 300) % 2 === 0);
      const pressed = Input.confirm() || Input.cancel() || this.pointerTapped;
      this.pointerTapped = false;
      if (pressed && time - this.msgOpenedAt > 120) {
        if (this.msgShown < this.msgFull.length) {
          this.msgShown = this.msgFull.length;
          this.msgText.setText(this.msgFull);
        } else this.closeMessage();
      }
    }

    // Minimap-Ausschnitt um die Spielfigur
    const pos = this.registry.get('playerCell') as [number, number] | undefined;
    if (pos && this.textures.exists('minimap')) {
      const tex = this.textures.get('minimap').getSourceImage();
      const cx = Phaser.Math.Clamp(pos[0] - MINIMAP_W / 2, 0, Math.max(0, tex.width - MINIMAP_W));
      const cy = Phaser.Math.Clamp(pos[1] - MINIMAP_H / 2, 0, Math.max(0, tex.height - MINIMAP_H));
      this.minimap.setCrop(cx, cy, MINIMAP_W, MINIMAP_H);
      this.minimap.setPosition(GAME_W - MINIMAP_W - 8 - cx, this.minimapFrame.y + 4 - cy);
      this.minimapDot.setPosition(this.minimap.x + pos[0] + 0.5, this.minimap.y + pos[1] + 0.5);
      this.minimapDot.setVisible(Math.floor(time / 250) % 2 === 0);
    }

    // FPS / Debug
    this.fpsAcc += dt;
    if (this.fpsAcc > 0.25) {
      this.fpsAcc = 0;
      const show = Settings.get().showFps || DEBUG;
      this.fps.setVisible(show);
      if (show) this.fps.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
      if (this.showDebug) {
        const p = this.registry.get('playerPos') as [number, number] | undefined;
        this.debugText.setText(
          [
            'DEBUG (F1)',
            `Pos ${p ? `${p[0].toFixed(1)}, ${p[1].toFixed(1)}` : '-'}`,
            `Zelle ${pos ? pos.join(', ') : '-'}`,
            `Eingabe ${Input.source} · Render ×${Display.renderScale}`,
            `Objekte aktiv ${this.registry.get('activeObjects') ?? 0}`,
            'F2 Kollision · F3 Noclip · F4 Aura-Farbe',
            'F6 Treffer · F9 Grafiken · T Teleport (Maus)',
          ].join('\n'),
        );
      }
    }
    if (DEBUG && Input.keyPressed('F1')) {
      this.showDebug = !this.showDebug;
      this.debugText.setVisible(this.showDebug);
    }
    this.lpFill.width = 84;
    this.auraFill.width = 84;
    this.money.setText('0');
    this.progress.setText('0/100');
  }
}
