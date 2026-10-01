import { abgr } from './palette';

/**
 * Einfacher Pixelpuffer (32 Bit pro Pixel, ABGR wie ImageData auf Little-Endian).
 * Alle Generatoren malen in einen Raster und wandeln ihn erst am Ende in ein Canvas um.
 */
export class Raster {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Farbe als 0xRRGGBB setzen. */
  set(x: number, y: number, color: number, alpha = 255): void {
    if (!this.inside(x, y)) return;
    this.data[y * this.w + x] = abgr(color, alpha);
  }

  setRaw(x: number, y: number, value: number): void {
    if (!this.inside(x, y)) return;
    this.data[y * this.w + x] = value;
  }

  getRaw(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.data[y * this.w + x];
  }

  alphaAt(x: number, y: number): number {
    return this.getRaw(x, y) >>> 24;
  }

  isEmpty(x: number, y: number): boolean {
    return this.alphaAt(x, y) === 0;
  }

  clear(x: number, y: number): void {
    if (!this.inside(x, y)) return;
    this.data[y * this.w + x] = 0;
  }

  fillRect(x: number, y: number, w: number, h: number, color: number, alpha = 255): void {
    const v = abgr(color, alpha);
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
        this.data[j * this.w + i] = v;
      }
    }
  }

  /** Gefüllte Ellipse mit Mittelpunkt (cx, cy) – pixelgenau, ohne Kantenglättung. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: number, alpha = 255): void {
    const v = abgr(color, alpha);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && this.inside(x, y)) this.data[y * this.w + x] = v;
      }
    }
  }

  /** Kopiert einen anderen Raster hinein (nur nicht-transparente Pixel). */
  blit(src: Raster, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (v >>> 24 === 0) continue;
        this.setRaw(dx + x, dy + y, v);
      }
    }
  }

  /** Kopiert einen Ausschnitt (sx, sy, w, h) eines anderen Rasters hinein (inkl. Transparenz). */
  copyRegion(src: Raster, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        this.setRaw(dx + x, dy + y, src.getRaw(sx + x, sy + y));
      }
    }
  }

  /** Setzt einen 1-px-Umriss um alle nicht-transparenten Pixel (4er-Nachbarschaft). */
  outline(color: number, eightWay = false): void {
    const ink = abgr(color);
    const w = this.w;
    const h = this.h;
    const src = this.data.slice();
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 !== 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] >>> 24 !== 0) continue;
        let n = filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1);
        if (!n && eightWay) {
          n = filled(x - 1, y - 1) || filled(x + 1, y - 1) || filled(x - 1, y + 1) || filled(x + 1, y + 1);
        }
        if (n) this.data[y * w + x] = ink;
      }
    }
  }

  clone(): Raster {
    const r = new Raster(this.w, this.h);
    r.data.set(this.data);
    return r;
  }

  toCanvas(scale = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    if (scale === 1) return canvas;
    const big = document.createElement('canvas');
    big.width = this.w * scale;
    big.height = this.h * scale;
    const bctx = big.getContext('2d')!;
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(canvas, 0, 0, big.width, big.height);
    return big;
  }

  toDataURL(scale = 1): string {
    return this.toCanvas(scale).toDataURL('image/png');
  }
}

/** Deterministischer Zufallsgenerator (Mulberry32) – gleiche Saat, gleiche Grafik. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ganzzahl-Hash für Koordinaten (für Varianten-Auswahl). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
