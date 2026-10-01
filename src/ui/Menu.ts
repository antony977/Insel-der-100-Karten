import Phaser from 'phaser';
import { addPanel, addText } from './Text';
import { PAL } from '../gfx/palette';
import type { InputManager } from '../input/InputManager';

export interface MenuItem {
  label: string | (() => string);
  /** Wert rechts (z. B. „80 %") */
  value?: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  disabled?: boolean | (() => boolean);
}

export interface MenuOptions {
  rowH?: number;
  visibleRows?: number;
  onCancel?: () => void;
  depth?: number;
  /** Farbe für Werte */
  valueColor?: number;
}

interface Row {
  label: Phaser.GameObjects.BitmapText;
  value: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
  arrowL: Phaser.GameObjects.BitmapText;
  arrowR: Phaser.GameObjects.BitmapText;
}

/**
 * Vertikales Menü: Tastatur/Gamepad (Hoch/Runter, Links/Rechts für Werte, Bestätigen,
 * Abbrechen), Maus (Hover, Klick, Mausrad) und Touch (Antippen).
 */
export class Menu {
  readonly container: Phaser.GameObjects.Container;
  selected = 0;
  private readonly items: MenuItem[];
  private readonly rows: Row[] = [];
  private readonly cursor: Phaser.GameObjects.Sprite;
  private readonly highlight: Phaser.GameObjects.NineSlice;
  private readonly upInd: Phaser.GameObjects.BitmapText;
  private readonly downInd: Phaser.GameObjects.BitmapText;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly rowH: number;
  private readonly visible: number;
  private readonly opts: MenuOptions;
  private offset = 0;
  private cursorT = 0;
  enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, items: MenuItem[], opts: MenuOptions = {}) {
    this.items = items;
    this.x = x;
    this.y = y;
    this.w = w;
    this.opts = opts;
    this.rowH = opts.rowH ?? 16;
    this.visible = Math.min(items.length, opts.visibleRows ?? items.length);
    this.container = scene.add.container(0, 0).setDepth(opts.depth ?? 10);
    this.highlight = addPanel(scene, x - 4, y, w + 8, this.rowH, 'ui-frame-select');
    this.container.add(this.highlight);
    for (let i = 0; i < this.visible; i++) {
      const ry = y + i * this.rowH;
      const label = addText(scene, x + 12, ry + 2, '', { font: 'px-s' });
      const value = addText(scene, x + w - 12, ry + 2, '', { font: 'px-s', ox: 1, color: opts.valueColor ?? PAL.gold });
      const arrowL = addText(scene, 0, ry + 2, '◀', { font: 'px-s', ox: 1, color: PAL.cream });
      const arrowR = addText(scene, x + w - 4, ry + 2, '▶', { font: 'px-s', ox: 1, color: PAL.cream });
      const zone = scene.add.zone(x - 4, ry, w + 8, this.rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const rowIndex = i;
      zone.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch || !this.enabled) return;
        this.select(this.offset + rowIndex);
      });
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.enabled) return;
        const idx = this.offset + rowIndex;
        this.select(idx);
        const item = this.items[idx];
        const localX = p.worldX - (x - 4);
        if (item.onLeft && item.onRight) {
          if (localX > (w + 8) * 0.55) item.onRight();
          else if (localX > (w + 8) * 0.3) item.onLeft();
          else item.onSelect?.();
          this.refresh();
          return;
        }
        this.activate();
      });
      this.container.add([label, value, arrowL, arrowR, zone]);
      this.rows.push({ label, value, zone, arrowL, arrowR });
    }
    this.cursor = scene.add.sprite(x - 1, y + this.rowH / 2, 'ui-cursor', 0).setOrigin(0, 0.5);
    this.upInd = addText(scene, x + w / 2, y - 9, '▲', { font: 'px-o', ox: 0.5, color: PAL.gold });
    this.downInd = addText(scene, x + w / 2, y + this.visible * this.rowH, '▼', { font: 'px-o', ox: 0.5, color: PAL.gold });
    this.container.add([this.cursor, this.upInd, this.downInd]);
    scene.input.on('wheel', this.onWheel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('wheel', this.onWheel, this));
    this.select(0);
  }

  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    if (!this.enabled) return;
    this.move(dy > 0 ? 1 : -1);
  }

  private isDisabled(i: number): boolean {
    const d = this.items[i]?.disabled;
    return typeof d === 'function' ? d() : !!d;
  }

  select(i: number): void {
    this.selected = Phaser.Math.Clamp(i, 0, this.items.length - 1);
    if (this.selected < this.offset) this.offset = this.selected;
    if (this.selected >= this.offset + this.visible) this.offset = this.selected - this.visible + 1;
    this.refresh();
  }

  private move(d: number): void {
    let i = this.selected;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + d + this.items.length) % this.items.length;
      if (!this.isDisabled(i)) break;
    }
    this.select(i);
  }

  private activate(): void {
    const item = this.items[this.selected];
    if (!item || this.isDisabled(this.selected)) return;
    item.onSelect?.();
    this.refresh();
  }

  refresh(): void {
    for (let r = 0; r < this.visible; r++) {
      const idx = this.offset + r;
      const item = this.items[idx];
      const row = this.rows[r];
      if (!item) {
        row.label.setText('');
        row.value.setText('');
        row.arrowL.setVisible(false);
        row.arrowR.setVisible(false);
        continue;
      }
      const label = typeof item.label === 'function' ? item.label() : item.label;
      row.label.setText(label);
      const dis = this.isDisabled(idx);
      const sel = idx === this.selected;
      row.label.setTint(dis ? PAL.stone : sel ? PAL.cream : PAL.white);
      const val = item.value ? item.value() : '';
      const hasArrows = !!(item.onLeft && item.onRight);
      row.value.setText(val);
      row.value.setX(this.x + this.w - (hasArrows ? 14 : 4));
      row.arrowR.setVisible(hasArrows && sel);
      row.arrowL.setVisible(hasArrows && sel);
      if (hasArrows) row.arrowL.setX(row.value.x - row.value.width - 4);
    }
    const vr = this.selected - this.offset;
    this.highlight.setY(this.y + vr * this.rowH);
    this.cursor.setY(this.y + vr * this.rowH + this.rowH / 2);
    this.upInd.setVisible(this.offset > 0);
    this.downInd.setVisible(this.offset + this.visible < this.items.length);
  }

  update(input: InputManager, dt: number): void {
    this.cursorT += dt;
    this.cursor.setFrame(Math.floor(this.cursorT * 3) % 2);
    this.cursor.setX(this.x - 1 + (Math.floor(this.cursorT * 3) % 2));
    if (!this.enabled) return;
    if (input.nav('up')) this.move(-1);
    if (input.nav('down')) this.move(1);
    const item = this.items[this.selected];
    if (item?.onLeft && input.nav('left')) {
      item.onLeft();
      this.refresh();
    }
    if (item?.onRight && input.nav('right')) {
      item.onRight();
      this.refresh();
    }
    if (input.confirm()) this.activate();
    else if (input.cancel()) this.opts.onCancel?.();
  }

  destroy(): void {
    this.container.destroy();
  }
}
