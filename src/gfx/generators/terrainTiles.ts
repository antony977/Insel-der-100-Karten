import { abgr, PAL } from '../palette';
import { Raster, rng } from '../Raster';
import type { TerrainDef, TerrainPattern } from '../../world/terrain';

export const TILE_SIZE = 16;
export const TERRAIN_VARIANTS = 4;

/** Periodisches Value-Noise (16×16, nahtlos kachelbar), Werte 0…1. */
export function periodicNoise(seed: number, cells = 4): Float32Array {
  const r = rng(seed);
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(TILE_SIZE * TILE_SIZE);
  const step = TILE_SIZE / cells;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const gx = x / step;
      const gy = y / step;
      const x0 = Math.floor(gx) % cells;
      const y0 = Math.floor(gy) % cells;
      const x1 = (x0 + 1) % cells;
      const y1 = (y0 + 1) % cells;
      const fx = smooth(gx - Math.floor(gx));
      const fy = smooth(gy - Math.floor(gy));
      const a = grid[y0 * cells + x0];
      const b = grid[y0 * cells + x1];
      const c = grid[y1 * cells + x0];
      const d = grid[y1 * cells + x1];
      out[y * TILE_SIZE + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
  }
  return out;
}

/** Erzeugt ein nahtloses 16×16-Bodenmuster. */
export function terrainPattern(p: TerrainPattern, seed: number, variant: number): Raster {
  const r = new Raster(TILE_SIZE, TILE_SIZE);
  r.fillRect(0, 0, TILE_SIZE, TILE_SIZE, p.base);
  const rand = rng(seed * 31 + variant * 977 + 7);
  const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  switch (p.style) {
    case 'grass': {
      const n = p.density + (variant === 0 ? -2 : variant);
      for (let i = 0; i < n; i++) {
        const x = ri(1, 12);
        const y = ri(2, 14);
        r.set(x, y - 1, p.dark);
        r.set(x + 2, y - 1, p.dark);
        r.set(x + 1, y, p.dark);
        if (rand() < 0.3) r.set(x + 1, y - 2, p.light);
      }
      for (let i = 0; i < 1 + (variant >> 1); i++) r.set(ri(0, 15), ri(0, 15), p.light);
      break;
    }
    case 'dots': {
      for (let i = 0; i < p.density + variant * 2; i++) r.set(ri(0, 15), ri(0, 15), p.dark);
      for (let i = 0; i < 3 + variant; i++) r.set(ri(0, 15), ri(0, 15), p.light);
      break;
    }
    case 'pebbles': {
      for (let i = 0; i < p.density + variant; i++) {
        const x = ri(1, 13);
        const y = ri(1, 13);
        r.set(x, y, p.dark);
        r.set(x + 1, y, p.dark);
        r.set(x, y - 1, p.light);
      }
      for (let i = 0; i < 4; i++) r.set(ri(0, 15), ri(0, 15), p.dark);
      break;
    }
    case 'cobble': {
      // Pflastersteine 8×4, versetzte Reihen
      for (let row = 0; row < 4; row++) {
        const off = row % 2 === 0 ? 0 : 4;
        const y0 = row * 4;
        for (let b = -1; b < 3; b++) {
          const x0 = b * 8 + off;
          const shade = rand() < 0.25 ? PAL.silver : p.base;
          for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 8; x++) {
              const px = (((x0 + x) % 16) + 16) % 16;
              const py = y0 + y;
              let c = shade;
              if (y === 3 || x === 7) c = p.dark;
              else if (y === 0 || x === 0) c = p.light;
              r.set(px, py, c);
            }
          }
        }
      }
      break;
    }
    case 'rows': {
      // Getreidefeld: Ähren-Reihen
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const row = y % 4;
          if (row === 3) r.set(x, y, p.dark);
          else if (row === 0 && (x + variant) % 3 === 0) r.set(x, y, p.light);
          else if ((x * 5 + y * 3 + variant) % 7 === 0) r.set(x, y, PAL.rust);
        }
      }
      break;
    }
    case 'ripple': {
      // Dünenrippel
      for (let y = 2; y < 16; y += 5) {
        for (let x = 0; x < 16; x++) {
          const yy = y + Math.round(Math.sin((x + variant * 3) / 2.5));
          r.set(x, ((yy % 16) + 16) % 16, p.dark);
          r.set(x, ((yy - 1 + 16) % 16), p.light);
        }
      }
      for (let i = 0; i < 2 + variant; i++) r.set(ri(0, 15), ri(0, 15), p.dark);
      break;
    }
    case 'cracks': {
      // Papierfasern / Linien
      for (let i = 0; i < p.density + variant; i++) {
        const x = ri(0, 12);
        const y = ri(0, 15);
        for (let k = 0; k < 4; k++) r.set(x + k, y, p.dark);
      }
      for (let i = 0; i < 3; i++) r.set(ri(0, 15), ri(0, 15), p.light);
      break;
    }
    case 'rock': {
      // Felsstruktur: kantige Brocken
      for (let i = 0; i < p.density + variant; i++) {
        const x = ri(0, 12);
        const y = ri(1, 13);
        const w = ri(2, 4);
        for (let k = 0; k < w; k++) {
          r.set(x + k, y, p.light);
          r.set(x + k, y + 2, p.dark);
        }
        r.set(x, y + 1, p.light);
        r.set(x + w, y + 1, p.dark);
      }
      break;
    }
    case 'flat':
      break;
  }
  return r;
}

function mixRaw(raw: number, color: number, t: number): number {
  const a = raw >>> 24;
  if (a === 0) return raw;
  const r0 = raw & 255;
  const g0 = (raw >> 8) & 255;
  const b0 = (raw >> 16) & 255;
  const r1 = (color >> 16) & 255;
  const g1 = (color >> 8) & 255;
  const b1 = color & 255;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * Setzt Bodenkacheln im „Dual-Grid"-Verfahren zusammen: Jede gerenderte Kachel liegt
 * zwischen vier Terrain-Zellen (Ecken). Für jede vorkommende Ecken-Kombination wird einmal
 * eine Kachel mit weichen, unregelmässigen Übergängen erzeugt und in einem Atlas abgelegt.
 */
export class TileComposer {
  private readonly defs: TerrainDef[];
  private readonly patterns = new Map<number, Raster[]>();
  private readonly noise = new Map<number, Float32Array>();
  private readonly cache = new Map<number, number>();
  readonly tiles: Raster[] = [];

  constructor(defs: TerrainDef[], seed = 1) {
    this.defs = [];
    for (const d of defs) {
      this.defs[d.id] = d;
      const variants: Raster[] = [];
      for (let v = 0; v < TERRAIN_VARIANTS; v++) variants.push(terrainPattern(d.pattern, seed + d.id * 101, v));
      this.patterns.set(d.id, variants);
      this.noise.set(d.id, periodicNoise(seed * 13 + d.id * 7919));
    }
  }

  /** Index der Kachel für die vier Ecken (oben links, oben rechts, unten links, unten rechts). */
  index(tl: number, tr: number, bl: number, br: number, variant = 0): number {
    const pure = tl === tr && tl === bl && tl === br;
    const v = pure ? variant % TERRAIN_VARIANTS : 0;
    const key = tl | (tr << 4) | (bl << 8) | (br << 12) | (v << 16);
    let idx = this.cache.get(key);
    if (idx === undefined) {
      idx = this.tiles.length;
      this.tiles.push(this.compose(tl, tr, bl, br, v));
      this.cache.set(key, idx);
    }
    return idx;
  }

  get count(): number {
    return this.tiles.length;
  }

  private maskValue(t: number, corners: number[], x: number, y: number): boolean {
    const fx = Math.min(1, Math.max(0, (x + 0.5) / TILE_SIZE));
    const fy = Math.min(1, Math.max(0, (y + 0.5) / TILE_SIZE));
    const a = corners[0] === t ? 1 : 0;
    const b = corners[1] === t ? 1 : 0;
    const c = corners[2] === t ? 1 : 0;
    const d = corners[3] === t ? 1 : 0;
    const v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    const n = this.noise.get(t)!;
    const nx = ((x % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
    const ny = ((y % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
    const rough = this.defs[t].roughness;
    // kleiner Bias, damit diagonale Sattelpunkte eindeutig sind
    return v + (n[ny * TILE_SIZE + nx] - 0.5) * 2 * rough > 0.5 - 0.001 * t;
  }

  private compose(tl: number, tr: number, bl: number, br: number, variant: number): Raster {
    const corners = [tl, tr, bl, br];
    const present = [...new Set(corners)].sort((p, q) => this.defs[p].priority - this.defs[q].priority);
    const out = new Raster(TILE_SIZE, TILE_SIZE);
    const base = this.defs[present[0]];
    if (!base.clear) out.copyRegion(this.patterns.get(base.id)![variant], 0, 0, TILE_SIZE, TILE_SIZE, 0, 0);

    // Masken aller höheren Terrains (mit 1 px Rand für Kantenberechnung)
    const S = TILE_SIZE + 2;
    const landMask = new Uint8Array(S * S);
    for (let k = 1; k < present.length; k++) {
      const t = present[k];
      const def = this.defs[t];
      const mask = new Uint8Array(S * S);
      for (let y = -1; y <= TILE_SIZE; y++) {
        for (let x = -1; x <= TILE_SIZE; x++) {
          if (this.maskValue(t, corners, x, y)) mask[(y + 1) * S + (x + 1)] = 1;
        }
      }
      const pat = this.patterns.get(t)![0];
      const inM = (x: number, y: number) => mask[(y + 1) * S + (x + 1)] === 1;
      // Schatten nach unten auf tieferes Terrain
      if (def.castsShadow) {
        for (let y = 0; y < TILE_SIZE; y++) {
          for (let x = 0; x < TILE_SIZE; x++) {
            if (!inM(x, y) && inM(x, y - 1)) {
              const i = y * TILE_SIZE + x;
              out.data[i] = mixRaw(out.data[i], PAL.ink, 0.28);
            }
          }
        }
      }
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          if (!inM(x, y)) continue;
          const edge = !inM(x - 1, y) || !inM(x + 1, y) || !inM(x, y - 1) || !inM(x, y + 1);
          if (edge) out.set(x, y, def.edge);
          else out.setRaw(x, y, pat.getRaw(x, y));
        }
      }
      for (let i = 0; i < mask.length; i++) if (mask[i]) landMask[i] = 1;
    }

    // Gischt am Ufer, wenn das tiefste Terrain transparent (Wasser) ist
    if (base.clear && present.length > 1) {
      const land = (x: number, y: number) =>
        x >= -1 && y >= -1 && x <= TILE_SIZE && y <= TILE_SIZE && landMask[(y + 1) * S + (x + 1)] === 1;
      const foam = abgr(PAL.white, 210);
      const foam2 = abgr(PAL.skyLight, 110);
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          if (land(x, y)) continue;
          if (land(x - 1, y) || land(x + 1, y) || land(x, y - 1) || land(x, y + 1)) {
            out.setRaw(x, y, foam);
          } else if (land(x - 2, y) || land(x + 2, y) || land(x, y - 2) || land(x, y + 2)) {
            out.setRaw(x, y, foam2);
          }
        }
      }
    }
    return out;
  }

  /** Packt alle Kacheln in einen Atlas (für Phaser-Tileset). */
  buildAtlas(cols = 32): Raster {
    const rows = Math.max(1, Math.ceil(this.tiles.length / cols));
    const atlas = new Raster(cols * TILE_SIZE, rows * TILE_SIZE);
    this.tiles.forEach((t, i) => atlas.blit(t, (i % cols) * TILE_SIZE, Math.floor(i / cols) * TILE_SIZE));
    return atlas;
  }
}

/** Animierte Wasseroberfläche (32×32, nahtlos), `frame` 0–3. */
export function generateWater(frame: number): Raster {
  const W = 32;
  const r = new Raster(W, W);
  r.fillRect(0, 0, W, W, PAL.blue);
  const rand = rng(4242);
  // dunklere Tiefenflecken
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * W);
    for (let k = 0; k < 4; k++) r.set((x + k) % W, y, PAL.navy, 255);
  }
  // Wellenlinien, die sich pro Frame verschieben
  const waves: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) waves.push([Math.floor(rand() * W), Math.floor(rand() * W), 3 + Math.floor(rand() * 3)]);
  for (const [wx, wy, len] of waves) {
    const shift = frame % 4;
    const x0 = wx + shift;
    for (let k = 0; k < len; k++) {
      const yy = wy + (k === 0 || k === len - 1 ? 1 : 0);
      r.set((x0 + k) % W, yy % W, PAL.sky);
    }
  }
  // Glitzer (blinkt je Frame)
  const sparkle = rng(77 + frame);
  for (let i = 0; i < 4; i++) r.set(Math.floor(sparkle() * W), Math.floor(sparkle() * W), PAL.skyLight);
  return r;
}
