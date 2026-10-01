import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Menu, type MenuItem } from '../ui/Menu';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Settings } from '../systems/Settings';
import { ACTION_LABELS, ACTIONS, keyLabel, type Action } from '../input/Actions';

/** Tastenbelegung ändern: Aktion wählen → neue Taste drücken (Esc bricht ab). */
export class KeysScene extends BaseScene {
  private menu!: Menu;
  private info!: Phaser.GameObjects.BitmapText;
  private skipFrame = true;
  private waiting: Action | null = null;

  constructor() {
    super('Keys');
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.skipFrame = true;
    this.waiting = null;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.75).setOrigin(0, 0);
    const w = 320;
    const h = 250;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    addPanel(this, x, y, w, h);
    addText(this, GAME_W / 2, y + 7, 'Tastenbelegung', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });
    const items: MenuItem[] = ACTIONS.map((a) => ({
      label: ACTION_LABELS[a],
      value: () => (this.waiting === a ? '…' : Settings.get().bindings[a].map(keyLabel).join(' / ') || '–'),
      onSelect: () => this.capture(a),
    }));
    items.push({ label: 'Standard wiederherstellen', onSelect: () => Settings.resetBindings() });
    items.push({ label: 'Zurück', onSelect: () => this.close() });
    this.menu = new Menu(this, x + 18, y + 36, w - 36, items, { rowH: 14, visibleRows: 12, onCancel: () => this.close() });
    this.info = addText(this, GAME_W / 2, y + h - 3, 'Aktion wählen und neue Taste drücken', {
      font: 'px-o',
      ox: 0.5,
      oy: 1,
      color: PAL.mist,
    });
  }

  private capture(a: Action): void {
    this.waiting = a;
    this.menu.enabled = false;
    this.menu.refresh();
    this.info.setText(`Neue Taste für „${ACTION_LABELS[a]}" drücken (Esc = Abbrechen)`);
    Input.captureNextKey((code) => {
      if (code) {
        const current = Settings.get().bindings[a];
        // neue Taste wird Haupttaste, eine Zweittaste bleibt erhalten
        const second = current.find((k) => k !== code && k.startsWith('Arrow'));
        Settings.setBinding(a, second ? [code, second] : [code]);
      }
      this.waiting = null;
      this.info.setText('Aktion wählen und neue Taste drücken');
      this.time.delayedCall(80, () => {
        this.menu.enabled = true;
        this.menu.refresh();
      });
    });
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Settings');
  }

  override update(_t: number, delta: number): void {
    if (this.skipFrame) {
      this.skipFrame = false;
      return;
    }
    this.menu.update(Input, delta / 1000);
  }
}
