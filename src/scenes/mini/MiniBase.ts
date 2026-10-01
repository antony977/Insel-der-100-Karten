import Phaser from 'phaser';
import { BaseScene } from '../BaseScene';
import { addPanel, addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_H, GAME_W } from '../../config';
import { Sound } from '../../audio/AudioEngine';

export interface MiniData {
  /** Schwierigkeit/Runde */
  level?: number;
  mode?: string;
  /** wird nach dem Schliessen in der Welt aufgerufen */
  onDone?: (won: boolean, score: number) => void;
}

/**
 * Grundgerüst für Minispiele als Overlay über der pausierten Welt: Rahmen, Titel,
 * Knöpfe (Maus/Touch), Abschlussmeldung und sauberes Zurückkehren.
 */
export abstract class MiniScene extends BaseScene {
  protected data0: MiniData = {};
  protected done = false;
  protected openedAt = 0;

  init(d: MiniData): void {
    this.data0 = d ?? {};
  }

  protected setupMini(title: string, w = 420, h = 230, context: 'menu' | 'gameplay' = 'menu'): { x: number; y: number; w: number; h: number } {
    this.setupCamera();
    Input.setContext(context);
    this.done = false;
    this.openedAt = this.time.now;
    Sound.duck('mini', true);
    this.scene.setVisible(false, 'Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Sound.duck('mini', false);
      this.scene.setVisible(true, 'Hud');
    });
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.72).setOrigin(0, 0);
    const x = Math.round((GAME_W - w) / 2);
    const y = Math.round((GAME_H - h) / 2);
    addPanel(this, x, y, w, h, 'ui-frame');
    addText(this, GAME_W / 2, y + 7, title, { font: 'px-o', ox: 0.5, color: PAL.gold });
    const close = addPanel(this, x + w - 26, y + 4, 20, 16, 'ui-frame');
    addText(this, x + w - 16, y + 6, '×', { font: 'px-s', ox: 0.5 });
    close.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.quit());
    return { x, y, w, h };
  }

  /** Knopf mit Text; liefert den Rahmen */
  protected button(x: number, y: number, w: number, label: string, cb: () => void, h = 18): { panel: Phaser.GameObjects.NineSlice; text: Phaser.GameObjects.BitmapText } {
    const panel = addPanel(this, x, y, w, h, 'ui-frame');
    const text = addText(this, x + w / 2, y + Math.round((h - 12) / 2) + 1, label, { font: 'px-s', ox: 0.5 });
    panel.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.done) return;
      Sound.play('select');
      cb();
    });
    return { panel, text };
  }

  /** Abbrechen (gilt als nicht gewonnen) */
  protected quit(): void {
    this.finish(false, 0, true);
  }

  protected finish(won: boolean, score: number, silent = false): void {
    if (this.done) return;
    this.done = true;
    if (!silent) Sound.play(won ? 'win' : 'lose');
    const cb = this.data0.onDone;
    this.time.delayedCall(silent ? 0 : 900, () => {
      this.scene.stop();
      this.scene.resume('Hud');
      this.scene.resume('World');
      const world = this.scene.get('World');
      if (cb) world.time.delayedCall(30, () => cb(won, score));
    });
  }

  /** grosse Meldung in der Mitte */
  protected banner(text: string, color: number = PAL.gold): void {
    const t = addText(this, GAME_W / 2, GAME_H / 2 - 12, text, { font: 'px-o', ox: 0.5, oy: 0.5, color, scale: 2 }).setDepth(50);
    t.setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 300, onComplete: () => t.destroy() });
  }

  protected escPressed(): boolean {
    return Input.cancel() && this.time.now - this.openedAt > 200;
  }
}
