import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { wrapText } from '../gfx/font/PixelFont';

export interface ChoiceOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface ChoiceData {
  title: string;
  options: ChoiceOption[];
  onPick: (value: string) => void;
  onCancel?: () => void;
}

const ROWS = 11;
const ROW_H = 15;
const W = 280;

/** Auswahlliste (Zauberziel, Kartennummer, Stadt …) – mit Bildlauf, Maus, Touch, Tastatur. */
export class ChoiceScene extends BaseScene {
  private data0!: ChoiceData;
  private sel = 0;
  private scroll = 0;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private openedAt = 0;
  private typed = '';
  private typedT = 0;

  constructor() {
    super('Choice');
  }

  create(data: ChoiceData): void {
    this.setupCamera();
    Input.setContext('menu');
    this.data0 = data;
    this.sel = 0;
    this.scroll = 0;
    this.dyn = [];
    this.openedAt = this.time.now;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.6).setOrigin(0, 0);
    const h = ROWS * ROW_H + 52;
    const x = (GAME_W - W) / 2;
    const y = (GAME_H - h) / 2;
    addPanel(this, x, y, W, h, 'ui-frame');
    addText(this, GAME_W / 2, y + 7, wrapText(data.title, W - 20)[0], { font: 'px-o', ox: 0.5, color: PAL.gold });
    addText(this, GAME_W / 2, y + h - 15, data.options.length > 30 ? 'Pfeile · Ziffern tippen springt · Esc abbrechen' : 'Pfeile wählen · Bestätigen · Esc abbrechen', { font: 'px', ox: 0.5, color: PAL.mist });
    const cancel = addPanel(this, x + W - 26, y + 4, 20, 16, 'ui-frame');
    addText(this, x + W - 16, y + 6, '×', { font: 'px-s', ox: 0.5 });
    cancel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cancel());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.move(dy > 0 ? 3 : -3));
    this.input.keyboard?.on('keydown', () => undefined);
    window.addEventListener('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', this.onKey));
    this.render();
  }

  /** Zifferneingabe springt zur Kartennummer */
  private onKey = (e: KeyboardEvent) => {
    if (!/^[0-9zZ]$/.test(e.key)) return;
    this.typed = (this.typedT > 0 ? this.typed : '') + e.key.toUpperCase();
    this.typedT = 1.2;
    const i = this.data0.options.findIndex((o) => o.label.startsWith(this.typed) || o.value.startsWith(this.typed.padStart(3, '0')));
    if (i >= 0) {
      this.sel = i;
      this.render();
    }
  };

  private render(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const opts = this.data0.options;
    const h = ROWS * ROW_H + 52;
    const x = (GAME_W - W) / 2;
    const y = (GAME_H - h) / 2 + 24;
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + ROWS) this.scroll = this.sel - ROWS + 1;
    for (let i = 0; i < ROWS; i++) {
      const k = this.scroll + i;
      const o = opts[k];
      if (!o) break;
      const ry = y + i * ROW_H;
      if (k === this.sel) this.dyn.push(addPanel(this, x + 6, ry - 2, W - 12, ROW_H, 'ui-frame-select'));
      this.dyn.push(addText(this, x + 14, ry + 1, o.label, { font: 'px-s', color: o.disabled ? PAL.stone : k === this.sel ? PAL.gold : PAL.white }));
      const z = this.add.zone(x + 6, ry - 2, W - 12, ROW_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        if (this.sel === k) this.pick();
        else {
          this.sel = k;
          this.render();
        }
      });
      this.dyn.push(z);
    }
    if (opts.length > ROWS) {
      const up = addText(this, x + W - 16, y - 2, '▲', { font: 'px-s', color: this.scroll > 0 ? PAL.gold : PAL.stone });
      const dn = addText(this, x + W - 16, y + (ROWS - 1) * ROW_H, '▼', { font: 'px-s', color: this.scroll + ROWS < opts.length ? PAL.gold : PAL.stone });
      up.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.move(-ROWS));
      dn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.move(ROWS));
      this.dyn.push(up, dn);
    }
  }

  private move(d: number): void {
    const n = this.data0.options.length;
    if (!n) return;
    const next = Math.max(0, Math.min(n - 1, this.sel + d));
    if (next !== this.sel) Sound.play('move');
    this.sel = next;
    this.render();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Hud');
    this.scene.resume('World');
  }

  private pick(): void {
    const o = this.data0.options[this.sel];
    if (!o || o.disabled) {
      Sound.play('error');
      return;
    }
    Sound.play('select');
    this.close();
    const world = this.scene.get('World');
    world.time.delayedCall(20, () => this.data0.onPick(o.value));
  }

  private cancel(): void {
    Sound.play('back');
    this.close();
    this.data0.onCancel?.();
  }

  override update(_t: number, delta: number): void {
    if (this.typedT > 0) this.typedT -= delta / 1000;
    if (this.time.now - this.openedAt < 150) return;
    if (Input.nav('up')) this.move(-1);
    if (Input.nav('down')) this.move(1);
    if (Input.nav('left')) this.move(-ROWS);
    if (Input.nav('right')) this.move(ROWS);
    if (Input.confirm()) this.pick();
    if (Input.cancel()) this.cancel();
  }
}
