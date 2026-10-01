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
import { TERRAIN_BY_ID } from '../world/terrain';
import { abgr } from '../gfx/palette';

const TERRAINS_MINI: number[] = TERRAIN_BY_ID.map((t) => abgr(t.mini));
import { Game } from '../systems/GameState';
import { cardIndex } from '../data/cards';
import { OUTSIDE_SECONDS } from '../systems/cards/Book';
import { TECHNIQUES, TECH_BY_ID, AFFINITY_BY_ID, type TechniqueId } from '../data/aura';

const TECH_ICON: Record<TechniqueId, number> = { sinn: 9, stoss: 14, schild: 1, fokus: 0, spezial: 13 };

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
const HAND_SHOWN = 6;
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
  private msgQueue: HudMessage[] = [];
  private handIcons: { icon: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.BitmapText }[] = [];
  private handMore!: Phaser.GameObjects.BitmapText;
  private handPanel!: Phaser.GameObjects.NineSlice;
  private handLabel!: Phaser.GameObjects.BitmapText;
  private msgMore!: Phaser.GameObjects.BitmapText;
  private showDebug = false;
  private pointerTapped = false;
  private hintT = 0;
  private fpsAcc = 0;
  private xpFill!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.BitmapText;
  private techIcon!: Phaser.GameObjects.Image;
  private techText!: Phaser.GameObjects.BitmapText;
  private techFrame!: Phaser.GameObjects.NineSlice;
  private wheel!: Phaser.GameObjects.Container;
  private wheelItems: { id: TechniqueId; bg: Phaser.GameObjects.NineSlice; icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }[] = [];
  private wheelCenter!: Phaser.GameObjects.BitmapText;
  private vignette!: Phaser.GameObjects.Graphics;
  private activeIcons: Phaser.GameObjects.Image[] = [];
  private slotIcons: { icon: Phaser.GameObjects.Image; num: Phaser.GameObjects.BitmapText; key: Phaser.GameObjects.BitmapText }[] = [];
  private quickKey = '';
  private banner!: Phaser.GameObjects.BitmapText;
  private bannerT = 0;
  private arrow!: Phaser.GameObjects.Triangle;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.setupCamera();
    this.toasts = [];
    this.slots = [];
    this.slotIcons = [];
    this.quickKey = '';

    // --- Werte oben links ---
    addPanel(this, 4, 4, 112, 52);
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
    // Stufe + Erfahrung
    this.levelText = addText(this, 108, 30, '', { font: 'px', ox: 1, color: PAL.ice });
    this.add.rectangle(10, 44, 98, 5, PAL.ink).setOrigin(0, 0);
    this.xpFill = this.add.rectangle(11, 45, 96, 3, PAL.violet).setOrigin(0, 0);
    this.add.rectangle(11, 45, 96, 1, PAL.pink).setOrigin(0, 0).setAlpha(0.5);
    // gewählte Aura-Technik
    this.techFrame = addPanel(this, 120, 4, 26, 26, 'ui-frame');
    this.techIcon = this.add.image(133, 17, 'ability-icons', 9);
    this.techText = addText(this, 133, 31, '', { font: 'px-o', ox: 0.5, color: PAL.silver });
    this.techFrame.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const w = this.scene.get('World') as unknown as { player?: { useTechnique(id: TechniqueId): string | null } };
      const m = w.player?.useTechnique(Game.prog.technique);
      if (m) this.toast(m);
    });
    this.activeIcons = [0, 1, 2].map((i) => this.add.image(152 + i * 12, 10, 'ability-icons', 9).setOrigin(0, 0).setScale(0.625).setVisible(false));
    this.buildWheel();
    this.vignette = this.add.graphics().setDepth(-1);
    this.banner = addText(this, GAME_W / 2, 58, '', { font: 'px-o', ox: 0.5, color: PAL.cream, scale: 2 }).setAlpha(0).setDepth(30);
    this.arrow = this.add.triangle(0, 0, 0, -6, 5, 4, -5, 4, PAL.gold).setStrokeStyle(1, PAL.ink).setVisible(false).setDepth(20);

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
      const icon = this.add.image(11, 15, 'card-icons', 0).setVisible(false);
      const key = addText(this, 3, 1, String(i + 1), { font: 'px', color: PAL.ice }).setVisible(false);
      c.add([frame, num, icon, key]);
      this.slots.push(c);
      this.slotIcons.push({ icon, num, key });
    }

    // --- Karten in der Hand (unten Mitte) ---
    this.handIcons = [];
    this.msgQueue = [];
    this.handPanel = addPanel(this, 0, GAME_H - 42, 10, 38, 'ui-frame-gold').setVisible(false);
    this.handLabel = addText(this, 0, GAME_H - 39, 'Hand', { font: 'px-o', color: PAL.gold }).setVisible(false);
    for (let i = 0; i < HAND_SHOWN; i++) {
      const bg = this.add.rectangle(0, GAME_H - 28, 18, 3, PAL.ink).setOrigin(0, 0).setVisible(false);
      const icon = this.add.image(0, GAME_H - 30, 'card-icons', 0).setOrigin(0, 1).setVisible(false);
      const bar = this.add.rectangle(0, GAME_H - 27, 16, 1, PAL.lime).setOrigin(0, 0).setVisible(false);
      const text = addText(this, 0, GAME_H - 24, '', { font: 'px-o', ox: 0.5, color: PAL.white }).setVisible(false);
      this.handIcons.push({ icon, bar, bg, text });
    }
    this.handMore = addText(this, 0, GAME_H - 36, '', { font: 'px-o', color: PAL.gold }).setVisible(false);
    this.handPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const w = this.scene.get('World') as unknown as { openBook?: (tab?: string) => void };
      w.openBook?.('hand');
    });

    // --- Hinweise / FPS / Debug ---
    this.hint = addText(this, 6, GAME_H - 14, '', { font: 'px-o', color: PAL.silver });
    this.fps = addText(this, 6, 59, '', { font: 'px-o', color: PAL.lime });
    this.debugText = addText(this, 6, 72, '', { font: 'px-o', color: PAL.white }).setVisible(false);

    // --- Meldungsfenster ---
    this.buildMessageBox();

    const onBanner = (t: string) => {
      this.banner.setText(t).setAlpha(0).setY(64);
      this.bannerT = 2.6;
    };
    this.game.events.on('hud-banner', onBanner);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('hud-banner', onBanner));
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

  /** Aura-Rad: halten der Aura-Taste + Richtung wählt eine Technik */
  private buildWheel(): void {
    this.wheel = this.add.container(GAME_W / 2, GAME_H / 2 - 8).setDepth(40).setVisible(false);
    const disc = this.add.circle(0, 0, 62, PAL.ink, 0.55);
    this.wheel.add(disc);
    this.wheelItems = [];
    for (const t of TECHNIQUES) {
      const a = (t.angle * Math.PI) / 180;
      const x = Math.cos(a) * 44;
      const y = -Math.sin(a) * 40;
      const bg = addPanel(this, x - 14, y - 14, 28, 28, 'ui-frame');
      const icon = this.add.image(x, y - 1, 'ability-icons', TECH_ICON[t.id]);
      const label = addText(this, x, y + 15, t.short, { font: 'px-o', ox: 0.5, color: PAL.white });
      this.wheel.add([bg, icon, label]);
      this.wheelItems.push({ id: t.id, bg, icon, label });
    }
    this.wheelCenter = addText(this, 0, -4, '', { font: 'px-o', ox: 0.5, color: PAL.gold, align: 'center' });
    this.wheel.add(this.wheelCenter);
  }

  private updateWheel(): void {
    const st = this.registry.get('auraWheel') as TechniqueId | 'none' | null;
    const open = st !== null && st !== undefined;
    this.wheel.setVisible(open);
    if (!open) return;
    for (const it of this.wheelItems) {
      const unlocked = Game.prog.unlocked(it.id);
      const sel = st === it.id;
      it.bg.setTexture(sel ? 'ui-frame-select' : 'ui-frame');
      it.icon.setTint(unlocked ? (sel ? AFFINITY_BY_ID[Game.prog.affinity].color : PAL.white) : PAL.stone);
      it.label.setText(unlocked ? (it.id === 'spezial' ? Game.prog.techName : TECH_BY_ID[it.id].short) : `Stufe ${TECH_BY_ID[it.id].unlock}`);
      it.label.setTint(unlocked ? (sel ? PAL.gold : PAL.white) : PAL.mist);
    }
    const t = st && st !== 'none' ? TECH_BY_ID[st] : null;
    this.wheelCenter.setText(t ? (t.cost ? `${t.cost} Aura` : `${t.drain}/s`) : 'Richtung\nwählen');
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
    const img = ctx.createImageData(map.w, map.h);
    const px = new Uint32Array(img.data.buffer);
    const colors = TERRAINS_MINI;
    for (let i = 0; i < map.w * map.h; i++) px[i] = colors[map.terrain[i]] ?? 0xff000000;
    ctx.putImageData(img, 0, 0);
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
    if (this.msgBox.visible) {
      this.msgQueue.push(m);
      return;
    }
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
    const next = this.msgQueue.shift();
    if (next) {
      this.msgBox.setVisible(false);
      this.showMessage(next);
      return;
    }
    this.msgBox.setVisible(false);
    this.registry.set('messageOpen', false);
    // Phaser aktualisiert obere Szenen zuerst: denselben Tastendruck nicht an die Welt weitergeben
    this.registry.set('messageClosedFrame', this.game.loop.frame);
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
        `${k('up')}${k('left')}${k('down')}${k('right')} Laufen · ${k('attack')} Angriff · ${k('dodge')} Rolle · ${k('aura')} Aura (halten: Aura-Rad) · ${k('book')} Buch · ${k('pause')} Pause`,
      );
    } else if (s === 'gamepad') {
      this.hint.setText('Stick Laufen · A Angriff · B Rolle · X Aura (halten: Rad) · Y Buch · Start Pause');
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
    this.hint.setAlpha(this.msgBox.visible || Game.book.hand.length > 0 ? 0 : hintAlpha);

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
            'F2 Kollision · F3 Noclip · F4 Aura-Farbe · F6 Treffer',
            'F7 Karte · F8 10 Karten · F9 Grafiken · T Teleport',
            'U Unverwundbar · L Stufe · K Gegner besiegen · J Monster',
          ].join('\n'),
        );
      }
    }
    if (DEBUG && Input.keyPressed('F1')) {
      this.showDebug = !this.showDebug;
      this.debugText.setVisible(this.showDebug);
    }
    this.updateStats();
    this.updateHand(time);
    this.updateWheel();
    this.updateVignette(time);
    this.updateQuick();
    this.updateBanner(dt);
    this.updateArrow(time);
  }

  private updateBanner(dt: number): void {
    if (this.bannerT <= 0) return;
    this.bannerT -= dt;
    const t = 2.6 - this.bannerT;
    const a = t < 0.3 ? t / 0.3 : this.bannerT < 0.5 ? this.bannerT / 0.5 : 1;
    this.banner.setAlpha(Math.max(0, a)).setY(64 - Math.min(1, t / 0.3) * 6);
  }

  /** Leuchtspur: Pfeil zur nächsten herumliegenden Karte */
  private updateArrow(time: number): void {
    const on = Game.inv.buffs.has('leuchtspur');
    const pos = this.registry.get('playerPos') as [number, number] | undefined;
    if (!on || !pos) {
      this.arrow.setVisible(false);
      return;
    }
    let best: { x: number; y: number } | null = null;
    let bd = 1e9;
    for (const g of Game.ground) {
      if (g.kind !== 'card' || g.map !== Game.player.map) continue;
      const d = Math.hypot(g.x - pos[0], g.y - pos[1]);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    if (!best) {
      this.arrow.setVisible(false);
      return;
    }
    const a = Math.atan2(best.y - pos[1], best.x - pos[0]);
    const r = 40 + Math.sin(time / 150) * 3;
    this.arrow.setVisible(true).setPosition(GAME_W / 2 + Math.cos(a) * r, GAME_H / 2 - 12 + Math.sin(a) * r).setRotation(a + Math.PI / 2);
  }

  /** Zauber auf den Schnelltasten anzeigen (HUD und Touch-Knöpfe) */
  private updateQuick(): void {
    const ids = Game.quick.map((u) => (u !== null && Game.book.locate(u) ? Game.registry.idOf(u) : ''));
    const key = ids.join(',');
    if (key === this.quickKey) return;
    this.quickKey = key;
    ids.forEach((id, i) => {
      const s = this.slotIcons[i];
      if (!s) return;
      s.icon.setVisible(!!id);
      s.num.setVisible(!id);
      s.key.setVisible(!!id);
      if (id) s.icon.setFrame(cardIndex(id));
      const url = id ? this.iconUrl(id) : null;
      window.dispatchEvent(new CustomEvent('quick-spell', { detail: { slot: i, url } }));
    });
  }

  private iconCache = new Map<string, string>();

  private iconUrl(id: string): string {
    const c = this.iconCache.get(id);
    if (c) return c;
    const tex = this.textures.get('card-icons');
    const fr = tex.get(cardIndex(id));
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(tex.getSourceImage() as CanvasImageSource, fr.cutX, fr.cutY, 16, 16, 0, 0, 16, 16);
    const url = canvas.toDataURL();
    this.iconCache.set(id, url);
    return url;
  }

  private updateVignette(time: number): void {
    const inv = Game.inv;
    const low = inv.lp > 0 && inv.lp < inv.stats().lp * 0.25;
    this.vignette.clear();
    if (!low) return;
    const a = 0.18 + Math.sin(time / 180) * 0.08;
    this.vignette.fillStyle(PAL.crimson, a);
    this.vignette.fillRect(0, 0, GAME_W, 6);
    this.vignette.fillRect(0, GAME_H - 6, GAME_W, 6);
    this.vignette.fillRect(0, 0, 6, GAME_H);
    this.vignette.fillRect(GAME_W - 6, 0, 6, GAME_H);
    this.vignette.fillStyle(PAL.crimson, a * 0.5);
    this.vignette.fillRect(6, 6, GAME_W - 12, 4);
    this.vignette.fillRect(6, GAME_H - 10, GAME_W - 12, 4);
    this.vignette.fillRect(6, 10, 4, GAME_H - 20);
    this.vignette.fillRect(GAME_W - 10, 10, 4, GAME_H - 20);
  }

  private updateStats(): void {
    const inv = Game.inv;
    const st = inv.stats();
    this.lpFill.width = Math.max(0, Math.round((84 * inv.lp) / st.lp));
    this.auraFill.width = Math.max(0, Math.round((84 * inv.aura) / st.aura));
    const money = String(inv.money);
    if (this.money.text !== money) this.money.setText(money);
    const prog = `${Game.book.collectedCount()}/100`;
    if (this.progress.text !== prog) this.progress.setText(prog);
    const p = Game.prog;
    this.xpFill.width = Math.max(0, Math.round((96 * p.xp) / p.xpNext));
    const lv = `St. ${p.level}`;
    if (this.levelText.text !== lv) this.levelText.setText(lv);
    const tech = p.technique;
    this.techIcon.setFrame(TECH_ICON[tech]);
    const w = this.scene.get('World') as unknown as { player?: { sense: boolean; shieldOn: boolean; focusT: number } };
    const pl = w.player;
    const col = AFFINITY_BY_ID[p.affinity].color;
    this.techIcon.setTint(p.unlocked(tech) ? col : PAL.stone);
    const label = tech === 'spezial' ? 'Spezial' : TECH_BY_ID[tech].short;
    if (this.techText.text !== label) this.techText.setText(label);
    // aktive Dauertechniken
    const act: TechniqueId[] = [];
    if (pl?.sense) act.push('sinn');
    if (pl?.shieldOn) act.push('schild');
    if (pl && pl.focusT > 0) act.push('fokus');
    this.activeIcons.forEach((ic, i) => {
      ic.setVisible(i < act.length);
      if (i < act.length) ic.setFrame(TECH_ICON[act[i]]).setTint(act[i] === 'fokus' ? PAL.red : col);
    });
  }

  /** Handkarten mit Countdown – erinnern daran, Karten ins Buch zu legen. */
  private updateHand(time: number): void {
    const hand = Game.book.hand;
    const n = Math.min(HAND_SHOWN, hand.length);
    const show = n > 0 && !this.msgBox.visible;
    const slotW = 22;
    const w = 36 + n * slotW + (hand.length > HAND_SHOWN ? 16 : 0);
    const x0 = Math.round(GAME_W / 2 - w / 2);
    this.handPanel.setVisible(show);
    this.handLabel.setVisible(show);
    if (show) {
      this.handPanel.setSize(w, 38).setX(x0);
      this.handLabel.setX(x0 + 6);
    }
    for (let i = 0; i < HAND_SHOWN; i++) {
      const h = this.handIcons[i];
      const vis = show && i < n;
      h.icon.setVisible(vis);
      h.bar.setVisible(vis);
      h.bg.setVisible(vis);
      h.text.setVisible(vis);
      if (!vis) continue;
      const c = hand[i];
      const x = x0 + 34 + i * slotW;
      const id = Game.registry.idOf(c.uid);
      h.icon.setTexture('card-icons', cardIndex(id)).setPosition(x, GAME_H - 26);
      const frac = Math.max(0, c.timeLeft / OUTSIDE_SECONDS);
      h.bg.setPosition(x, GAME_H - 25);
      h.bar.setPosition(x + 1, GAME_H - 24);
      h.bar.width = Math.max(1, Math.round(16 * frac));
      h.bar.fillColor = c.timeLeft < 10 ? PAL.red : c.timeLeft < 25 ? PAL.orange : PAL.lime;
      h.text.setPosition(x + 9, GAME_H - 20).setText(String(Math.ceil(c.timeLeft)));
      const urgent = c.timeLeft < 10 && Math.floor(time / 180) % 2 === 0;
      h.icon.setAlpha(urgent ? 0.4 : 1);
      h.text.setTint(c.timeLeft < 10 ? PAL.coral : PAL.white);
    }
    this.handMore.setVisible(show && hand.length > HAND_SHOWN);
    if (hand.length > HAND_SHOWN) this.handMore.setText(`+${hand.length - HAND_SHOWN}`).setPosition(x0 + 34 + n * slotW, GAME_H - 30);
  }
}
