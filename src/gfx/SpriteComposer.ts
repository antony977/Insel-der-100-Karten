import { PAL, type Ramp } from './palette';
import { Raster } from './Raster';

/**
 * Sprite-Komponist: Figuren werden aus flachen „Material-Schablonen" (ein Zeichen pro Pixel)
 * zusammengesetzt. Schattierung (Cel-Shading mit Licht von oben links) und der dunkle
 * 1-px-Umriss werden automatisch berechnet. So bleiben alle Figuren stilistisch einheitlich.
 */

export interface MaterialDef {
  /** Farbrampe [tief, Schatten, Grundton, Licht] */
  ramp?: Ramp;
  /** Feste Farbe ohne Schattierung */
  flat?: number;
  /** Gruppe für die Kantenerkennung (z. B. gehören Augen zur Haut-Gruppe) */
  group?: string;
  /** Feste Tonstufe 0–3 (für Glanzlichter) */
  tone?: number;
  /** Lichtkante oben links an Aussenkanten (Standard: ja) */
  rim?: boolean;
  /** Schattenkante unten/rechts (Standard: ja) */
  shade?: boolean;
  /** Schattenkante breiter (für grosse Flächen) */
  shadeWidth?: number;
}

export type MaterialMap = Record<string, MaterialDef>;

export interface Part {
  x: number;
  y: number;
  rows: readonly string[];
}

export class LabelCanvas {
  readonly w: number;
  readonly h: number;
  /** Materialzeichen (0 = leer) */
  readonly labels: Uint16Array;
  /** Teil-ID – unterschiedliche Teile werden an ihrer Grenze schattiert */
  readonly parts: Uint8Array;
  /** abgedunkelte (hintere) Teile */
  readonly dim: Uint8Array;
  private nextPart = 1;

  /** Neue Teil-ID (für prozedural gezeichnete Formen) */
  newPart(): number {
    return this.nextPart++;
  }

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.labels = new Uint16Array(w * h);
    this.parts = new Uint8Array(w * h);
    this.dim = new Uint8Array(w * h);
  }

  /** Stempelt eine Schablone. '.' und ' ' sind transparent. */
  stamp(part: Part, dx = 0, dy = 0, opts: { dim?: boolean; flipX?: boolean; samePartAs?: number } = {}): number {
    const id = opts.samePartAs ?? this.nextPart++;
    const rows = part.rows;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[opts.flipX ? row.length - 1 - x : x];
        if (ch === '.' || ch === ' ') continue;
        const px = part.x + dx + x;
        const py = part.y + dy + y;
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
        const i = py * this.w + px;
        this.labels[i] = ch.charCodeAt(0);
        this.parts[i] = id;
        this.dim[i] = opts.dim ? 1 : 0;
      }
    }
    return id;
  }

  /** Setzt ein einzelnes Pixel (z. B. für Details). */
  plot(x: number, y: number, ch: string, partId = 250): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.labels[i] = ch.charCodeAt(0);
    this.parts[i] = partId;
  }

  /** Spiegelt die gesamte Schablone horizontal (vor der Schattierung → Licht bleibt oben links). */
  flipX(): void {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w >> 1; x++) {
        const a = y * w + x;
        const b = y * w + (w - 1 - x);
        const l = this.labels[a];
        this.labels[a] = this.labels[b];
        this.labels[b] = l;
        const p = this.parts[a];
        this.parts[a] = this.parts[b];
        this.parts[b] = p;
        const d = this.dim[a];
        this.dim[a] = this.dim[b];
        this.dim[b] = d;
      }
    }
  }

  /** Rendert mit automatischem Cel-Shading und Umriss. */
  render(materials: MaterialMap, outline: number | null = PAL.ink): Raster {
    const { w, h, labels, parts, dim } = this;
    const out = new Raster(w, h);
    const groupOf = (code: number): string => {
      if (code === 0) return '';
      const ch = String.fromCharCode(code);
      return materials[ch]?.group ?? ch;
    };
    // Gruppen vorberechnen
    const groups: string[] = new Array(w * h);
    for (let i = 0; i < w * h; i++) groups[i] = groupOf(labels[i]);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const code = labels[i];
        if (code === 0) continue;
        const ch = String.fromCharCode(code);
        const m = materials[ch];
        if (!m) {
          out.set(x, y, PAL.magenta);
          continue;
        }
        if (m.flat !== undefined) {
          out.set(x, y, m.flat);
          continue;
        }
        if (!m.ramp) continue;
        const g = groups[i];
        const part = parts[i];
        const same = (dx: number, dy: number): boolean => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
          const j = ny * w + nx;
          return groups[j] === g && parts[j] === part;
        };
        const empty = (dx: number, dy: number): boolean => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true;
          return labels[ny * w + nx] === 0;
        };
        let tone = 2;
        if (m.tone !== undefined) {
          tone = m.tone;
        } else {
          const sw = m.shadeWidth ?? 1;
          let shaded = false;
          if (m.shade !== false) {
            for (let s = 1; s <= sw && !shaded; s++) {
              if (!same(s, 0) || !same(0, s)) shaded = true;
            }
          }
          if (shaded) tone = 1;
          else if (m.rim !== false && (empty(-1, 0) || empty(0, -1))) tone = 3;
        }
        if (dim[i]) tone = Math.max(0, tone - 1);
        out.set(x, y, m.ramp[tone]);
      }
    }
    if (outline !== null) out.outline(outline);
    return out;
  }
}

/** Hilfsfunktion: Schablone aus Zeilen mit Position. */
export function part(x: number, y: number, rows: readonly string[]): Part {
  return { x, y, rows };
}
