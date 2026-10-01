import { PAL } from '../palette';
import { Raster } from '../Raster';
import {
  FALLBACK_GLYPH,
  FONT_ASCENT,
  FONT_CELL_HEIGHT,
  FONT_LETTER_SPACING,
  FONT_SPACE_ADVANCE,
  GLYPHS,
  type GlyphDef,
} from './glyphs';

export type FontVariant = 'plain' | 'outline' | 'shadow';

export interface GlyphInfo {
  code: number;
  x: number;
  y: number;
  w: number;
  h: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
}

export interface FontAtlas {
  variant: FontVariant;
  raster: Raster;
  glyphs: Map<number, GlyphInfo>;
  lineHeight: number;
}

/** Schriftschlüssel in Phaser */
export const FONT_KEYS: Record<FontVariant, string> = {
  plain: 'px',
  outline: 'px-o',
  shadow: 'px-s',
};

function glyphRows(def: GlyphDef): { top: number; rows: string[]; width: number } {
  const [top, ...rows] = def;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return { top, rows, width };
}

/** Prüft, ob alle Zeilen eines Glyphen gleich breit sind (für Tests). */
export function validateGlyphs(): string[] {
  const errors: string[] = [];
  for (const [ch, def] of Object.entries(GLYPHS)) {
    const { rows, width, top } = glyphRows(def);
    if (rows.some((r) => r.length !== width)) errors.push(`${ch}: ungleiche Zeilenbreite`);
    if (top + rows.length > FONT_CELL_HEIGHT - FONT_ASCENT) errors.push(`${ch}: zu hoch`);
    if (top < -FONT_ASCENT) errors.push(`${ch}: zu weit oben`);
  }
  return errors;
}

function drawGlyph(r: Raster, ox: number, oy: number, rows: string[], variant: FontVariant): void {
  const pad = variant === 'outline' ? 1 : 0;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== '#') continue;
      if (variant === 'shadow') r.set(ox + x + 1, oy + y + 1, PAL.ink);
    }
  }
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === '#') r.set(ox + x + pad, oy + y + pad, PAL.white);
    }
  }
}

/** Baut einen Atlas aller Glyphen in der gewünschten Variante. */
export function buildFontAtlas(variant: FontVariant): FontAtlas {
  const entries = Object.entries(GLYPHS);
  const extraW = variant === 'outline' ? 2 : variant === 'shadow' ? 1 : 0;
  const extraH = extraW;
  const atlasW = 256;
  // Platz grob abschätzen
  let x = 0;
  let y = 0;
  let rowH = 0;
  const placed: { ch: string; top: number; rows: string[]; w: number; px: number; py: number }[] = [];
  for (const [ch, def] of entries) {
    const g = glyphRows(def);
    const gw = g.width + extraW;
    const gh = g.rows.length + extraH;
    if (x + gw + 1 > atlasW) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    placed.push({ ch, top: g.top, rows: g.rows, w: g.width, px: x, py: y });
    x += gw + 1;
    rowH = Math.max(rowH, gh);
  }
  const atlasH = y + rowH + 1;
  const raster = new Raster(atlasW, atlasH);
  const glyphs = new Map<number, GlyphInfo>();
  for (const p of placed) {
    // Kantenpixel für Outline-Variante: erst Glyph zeichnen, dann lokal umranden
    if (variant === 'outline') {
      const local = new Raster(p.w + 2, p.rows.length + 2);
      drawGlyph(local, 0, 0, p.rows, 'outline');
      local.outline(PAL.ink, true);
      raster.blit(local, p.px, p.py);
    } else {
      drawGlyph(raster, p.px, p.py, p.rows, variant);
    }
    const pad = variant === 'outline' ? 1 : 0;
    glyphs.set(p.ch.codePointAt(0)!, {
      code: p.ch.codePointAt(0)!,
      x: p.px,
      y: p.py,
      w: p.w + extraW,
      h: p.rows.length + extraH,
      xOffset: -pad,
      yOffset: p.top + FONT_ASCENT - pad,
      xAdvance: p.w + FONT_LETTER_SPACING,
    });
  }
  // Leerzeichen
  glyphs.set(32, { code: 32, x: 0, y: 0, w: 0, h: 0, xOffset: 0, yOffset: 0, xAdvance: FONT_SPACE_ADVANCE });
  // Geschütztes Leerzeichen
  glyphs.set(160, { code: 160, x: 0, y: 0, w: 0, h: 0, xOffset: 0, yOffset: 0, xAdvance: FONT_SPACE_ADVANCE });
  return { variant, raster, glyphs, lineHeight: FONT_CELL_HEIGHT };
}

function glyphAdvance(ch: string): number {
  if (ch === ' ' || ch === ' ') return FONT_SPACE_ADVANCE;
  const def = GLYPHS[ch] ?? FALLBACK_GLYPH;
  return glyphRows(def).width + FONT_LETTER_SPACING;
}

/** Breite eines einzeiligen Textes in Pixeln (ohne Umriss). */
export function measureText(text: string): number {
  let w = 0;
  for (const ch of text) w += glyphAdvance(ch);
  return Math.max(0, w - FONT_LETTER_SPACING);
}

/** Zeichnet Text in einen Raster (für DOM-Elemente wie den Dreh-Hinweis oder Button-Beschriftungen). */
export function renderTextRaster(text: string, color: number = PAL.white, variant: FontVariant = 'outline'): Raster {
  const pad = variant === 'outline' ? 1 : 0;
  const w = measureText(text) + pad * 2 + (variant === 'shadow' ? 1 : 0);
  const r = new Raster(Math.max(1, w), FONT_CELL_HEIGHT + pad * 2 + (variant === 'shadow' ? 1 : 0));
  let x = pad;
  for (const ch of text) {
    if (ch === ' ' || ch === ' ') {
      x += FONT_SPACE_ADVANCE;
      continue;
    }
    const g = glyphRows(GLYPHS[ch] ?? FALLBACK_GLYPH);
    for (let gy = 0; gy < g.rows.length; gy++) {
      for (let gx = 0; gx < g.width; gx++) {
        if (g.rows[gy][gx] !== '#') continue;
        const px = x + gx;
        const py = pad + FONT_ASCENT + g.top + gy;
        if (variant === 'shadow') r.set(px + 1, py + 1, PAL.ink);
        r.set(px, py, color);
      }
    }
    x += g.width + FONT_LETTER_SPACING;
  }
  if (variant === 'outline') {
    // Umriss nur um die Schrift (ohne die Farbe zu überschreiben)
    r.outline(PAL.ink, true);
  }
  return r;
}

/** Bricht Text an Wortgrenzen um, sodass jede Zeile höchstens maxWidth Pixel breit ist. */
export function wrapText(text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate) <= maxWidth || !line) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}
