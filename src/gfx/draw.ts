import type { Ramp } from './palette';
import { Raster, rng } from './Raster';

/** Kreis für zusammengesetzte Formen */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/**
 * Zeichnet eine Vereinigung von Kreisen mit Volumen-Schattierung (Licht von oben links).
 * Ideal für Baumkronen, Büsche, Felsen. `leafy` streut Blatt-Struktur ein.
 */
export function shadedBlobs(
  out: Raster,
  circles: Circle[],
  ramp: Ramp,
  opts: { leafy?: number; seed?: number; highlight?: number; bands?: [number, number, number] } = {},
): void {
  const rand = rng(opts.seed ?? 1);
  const bands = opts.bands ?? [-0.35, 0.05, 0.5];
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      let best = -1;
      let bestC: Circle | null = null;
      for (const c of circles) {
        const dx = x + 0.5 - c.x;
        const dy = y + 0.5 - c.y;
        const d = Math.sqrt(dx * dx + dy * dy) / c.r;
        if (d <= 1) {
          // der „vorderste" Kreis (weiter unten) gewinnt
          const score = c.y + (1 - d) * 2;
          if (score > best) {
            best = score;
            bestC = c;
          }
        }
      }
      if (!bestC) continue;
      const dx = (x + 0.5 - bestC.x) / bestC.r;
      const dy = (y + 0.5 - bestC.y) / bestC.r;
      // Licht von oben links
      let l = -(dx * 0.7 + dy * 0.9);
      if (opts.leafy) l += (rand() - 0.5) * opts.leafy;
      let tone = 0;
      if (l > bands[0]) tone = 1;
      if (l > bands[1]) tone = 2;
      if (l > bands[2]) tone = 3;
      out.set(x, y, ramp[tone]);
    }
  }
  if (opts.highlight !== undefined) {
    // kleine Glanzpunkte oben links in jedem Kreis
    for (const c of circles) {
      if (c.r < 4) continue;
      const hx = Math.round(c.x - c.r * 0.45);
      const hy = Math.round(c.y - c.r * 0.5);
      if (!out.isEmpty(hx, hy)) out.set(hx, hy, opts.highlight);
      if (!out.isEmpty(hx + 1, hy)) out.set(hx + 1, hy, opts.highlight);
    }
  }
}

/** Rechteck mit Cel-Shading: Lichtkante oben/links, Schatten unten/rechts. */
export function shadedRect(out: Raster, x: number, y: number, w: number, h: number, ramp: Ramp): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let tone = 2;
      if (i === w - 1 || j === h - 1) tone = 1;
      else if (i === 0 || j === 0) tone = 3;
      out.set(x + i, y + j, ramp[tone]);
    }
  }
}

/** Horizontale Linie */
export function hline(out: Raster, x0: number, x1: number, y: number, color: number, alpha = 255): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.set(x, y, color, alpha);
}

/** Vertikale Linie */
export function vline(out: Raster, x: number, y0: number, y1: number, color: number, alpha = 255): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) out.set(x, y, color, alpha);
}

/** Linie (Bresenham) */
export function line(out: Raster, x0: number, y0: number, x1: number, y1: number, color: number, alpha = 255): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.set(x, y, color, alpha);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Schablone mit Zeichen→Farbe-Zuordnung zeichnen ('.' = transparent). */
export function stencil(out: Raster, x: number, y: number, rows: readonly string[], colors: Record<string, number>): void {
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ') continue;
      const c = colors[ch];
      if (c !== undefined) out.set(x + i, y + j, c);
    }
  }
}

/** Kopiert `src` gedreht um 90° im Uhrzeigersinn. */
export function rotate90(src: Raster): Raster {
  const out = new Raster(src.h, src.w);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      out.setRaw(src.h - 1 - y, x, src.getRaw(x, y));
    }
  }
  return out;
}

/** Fügt mehrere gleich grosse Frames zu einem horizontalen Streifen zusammen. */
export function strip(frames: Raster[]): Raster {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const out = new Raster(fw * frames.length, fh);
  frames.forEach((f, i) => out.blit(f, i * fw, 0));
  return out;
}
