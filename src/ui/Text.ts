import Phaser from 'phaser';
import { PAL } from '../gfx/palette';

export type FontKey = 'px' | 'px-o' | 'px-s';

export interface TextOptions {
  font?: FontKey;
  color?: number;
  /** Ursprung (0–1) */
  ox?: number;
  oy?: number;
  /** Vergrösserung (ganzzahlig: 1 oder 2) */
  scale?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  depth?: number;
  lineSpacing?: number;
}

/** Pixel-Text mit der eigenen Inselschrift. */
export function addText(scene: Phaser.Scene, x: number, y: number, text: string, o: TextOptions = {}): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(x, y, o.font ?? 'px-s', text, 12 * (o.scale ?? 1));
  t.setOrigin(o.ox ?? 0, o.oy ?? 0);
  t.setTint(o.color ?? PAL.white);
  if (o.maxWidth) t.setMaxWidth(o.maxWidth);
  if (o.align) t.setCenterAlign();
  if (o.align === 'right') t.setRightAlign();
  if (o.align === 'left') t.setLeftAlign();
  if (o.lineSpacing !== undefined) t.setLineSpacing(o.lineSpacing);
  if (o.depth !== undefined) t.setDepth(o.depth);
  return t;
}

/** Abgerundeter Pixelrahmen (NineSlice). */
export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  key: 'ui-frame' | 'ui-frame-gold' | 'ui-frame-paper' | 'ui-frame-select' = 'ui-frame',
): Phaser.GameObjects.NineSlice {
  const p = scene.add.nineslice(x, y, key, undefined, w, h, 8, 8, 8, 8);
  p.setOrigin(0, 0);
  return p;
}
