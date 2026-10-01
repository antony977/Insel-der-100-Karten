import type Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Menu } from '../ui/Menu';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { wrapText } from '../gfx/font/PixelFont';

export interface DialogOption {
  label: string;
  action?: () => void;
}

export interface DialogData {
  title?: string;
  text: string;
  options: DialogOption[];
  /** Szene, die nach dem Schliessen fortgesetzt wird */
  from: string;
}

/** Einfacher Bestätigungs-/Hinweisdialog über einer pausierten Szene. */
export class DialogScene extends BaseScene {
  private menu!: Menu;
  private dlg!: DialogData;
  private skip = true;

  constructor() {
    super('Dialog');
  }

  init(d: DialogData): void {
    this.dlg = d;
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.skip = true;
    const d = this.dlg;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.55).setOrigin(0, 0);
    const lines = wrapText(d.text, 260);
    const w = 290;
    const h = 30 + lines.length * 12 + d.options.length * 16 + (d.title ? 16 : 0);
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    addPanel(this, x, y, w, h);
    let ty = y + 10;
    if (d.title) {
      addText(this, GAME_W / 2, ty, d.title, { font: 'px-o', ox: 0.5, color: PAL.gold });
      ty += 16;
    }
    addText(this, GAME_W / 2, ty, lines.join('\n'), { font: 'px-s', ox: 0.5, align: 'center' });
    ty += lines.length * 12 + 8;
    this.menu = new Menu(
      this,
      x + 40,
      ty,
      w - 80,
      d.options.map((o) => ({ label: o.label, onSelect: () => this.choose(o) })),
      { onCancel: () => this.choose(d.options[d.options.length - 1]) },
    );
  }

  private choose(o: DialogOption): void {
    this.scene.stop();
    this.scene.resume(this.dlg.from);
    o.action?.();
  }

  override update(_t: number, delta: number): void {
    if (this.skip) {
      this.skip = false;
      return;
    }
    this.menu.update(Input, delta / 1000);
  }
}

/** Hilfsfunktion: Dialog über der aktuellen Szene öffnen. */
export function openDialog(scene: Phaser.Scene, d: Omit<DialogData, 'from'>): void {
  scene.scene.pause();
  scene.scene.launch('Dialog', { ...d, from: scene.scene.key });
}
