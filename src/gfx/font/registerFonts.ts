import Phaser from 'phaser';
import { buildFontAtlas, FONT_KEYS, type FontVariant } from './PixelFont';

/** Registriert die generierte Pixel-Schrift in drei Varianten als Phaser-BitmapFont. */
export function registerFonts(scene: Phaser.Scene): void {
  const variants: FontVariant[] = ['plain', 'outline', 'shadow'];
  for (const variant of variants) {
    const key = FONT_KEYS[variant];
    if (scene.cache.bitmapFont.exists(key)) continue;
    const atlas = buildFontAtlas(variant);
    const canvas = atlas.raster.toCanvas();
    scene.textures.addCanvas(key, canvas);
    const tw = canvas.width;
    const th = canvas.height;
    // Phasers Typdefinition kennt xAdvance nicht, die Laufzeit benötigt es aber
    const chars: Record<number, Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number }> = {};
    for (const g of atlas.glyphs.values()) {
      chars[g.code] = {
        x: g.x,
        y: g.y,
        width: g.w,
        height: g.h,
        centerX: Math.floor(g.w / 2),
        centerY: Math.floor(g.h / 2),
        xOffset: g.xOffset,
        yOffset: g.yOffset,
        xAdvance: g.xAdvance,
        data: {},
        kerning: {},
        u0: g.x / tw,
        v0: g.y / th,
        u1: (g.x + g.w) / tw,
        v1: (g.y + g.h) / th,
      };
    }
    const data: Phaser.Types.GameObjects.BitmapText.BitmapFontData = {
      font: key,
      size: atlas.lineHeight,
      lineHeight: atlas.lineHeight,
      retroFont: false,
      chars,
    };
    scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
  }
}
