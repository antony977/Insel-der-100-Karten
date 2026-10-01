import { TILE } from '../config';
import { OBJECT_TYPES, type ObjectType, type ObjectTypeId } from '../data/worldObjects';
import { TERRAIN_BY_ID } from './terrain';
import { DECOR_NAMES, type DecorName } from '../gfx/generators/objects';

export interface WorldObject {
  type: ObjectTypeId;
  def: ObjectType;
  /** Fusspunkt in Weltpixeln */
  x: number;
  y: number;
  /** optionaler Text (z. B. Schild) */
  text?: string;
  /** Anzeige-Frame (z. B. offene Truhe) */
  frame?: number;
  /** eindeutiger Schlüssel für Spielstand-Flags (z. B. Truhen) */
  tag?: string;
  /** entfernt (aufgehoben, Sperre geöffnet) */
  hidden?: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  obj: number;
}

/** Gebiet, in dem Monster einer Art auftauchen */
export interface SpawnZone {
  monster: string;
  x: number;
  y: number;
  r: number;
  count: number;
  /** Sekunden bis zum Nachwachsen */
  respawn?: number;
}

/** Grösse der Streaming-Chunks in Pixeln */
export const CHUNK_PX = 256;

/**
 * Datenmodell der Welt: kompakte Arrays statt tausender Objekte – so bleibt der Speicher
 * auch bei einer grossen Insel klein. Gerendert wird nur der sichtbare Ausschnitt.
 */
export class WorldMap {
  readonly w: number;
  readonly h: number;
  readonly terrain: Uint8Array;
  /** Dekor-Kachel pro Zelle (0 = keine, sonst Index+1) */
  readonly decor: Uint8Array;
  /** zusätzliche Sperren pro Zelle (Rand, Mauern) */
  readonly blocked: Uint8Array;
  /** berechnete Begehbarkeit pro Zelle (1 = blockiert) */
  readonly solid: Uint8Array;
  /** Bodenkacheln im Dual-Grid ((w+1)×(h+1)) */
  ground: Uint16Array;
  readonly objects: WorldObject[] = [];
  readonly spawns: SpawnZone[] = [];
  readonly chunksX: number;
  readonly chunksY: number;
  /** Objekt-Indizes pro Chunk */
  readonly chunkObjects: number[][];
  /** Kollisionsboxen pro Chunk */
  readonly chunkBoxes: Box[][];
  spawnX = 0;
  spawnY = 0;
  name = '';
  /** benannte Ankunftspunkte (z. B. nach einer Bootsfahrt) */
  spawnPoints: Record<string, { x: number; y: number }> = {};

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.terrain = new Uint8Array(w * h);
    this.decor = new Uint8Array(w * h);
    this.blocked = new Uint8Array(w * h);
    this.solid = new Uint8Array(w * h);
    this.ground = new Uint16Array((w + 1) * (h + 1));
    this.chunksX = Math.ceil((w * TILE) / CHUNK_PX);
    this.chunksY = Math.ceil((h * TILE) / CHUNK_PX);
    this.chunkObjects = Array.from({ length: this.chunksX * this.chunksY }, () => []);
    this.chunkBoxes = Array.from({ length: this.chunksX * this.chunksY }, () => []);
  }

  get pixelWidth(): number {
    return this.w * TILE;
  }

  get pixelHeight(): number {
    return this.h * TILE;
  }

  inBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h;
  }

  getTerrain(cx: number, cy: number): number {
    cx = cx < 0 ? 0 : cx >= this.w ? this.w - 1 : cx;
    cy = cy < 0 ? 0 : cy >= this.h ? this.h - 1 : cy;
    return this.terrain[cy * this.w + cx];
  }

  setTerrain(cx: number, cy: number, t: number): void {
    if (this.inBounds(cx, cy)) this.terrain[cy * this.w + cx] = t;
  }

  setDecor(cx: number, cy: number, name: DecorName | null): void {
    if (!this.inBounds(cx, cy)) return;
    this.decor[cy * this.w + cx] = name ? DECOR_NAMES.indexOf(name) + 1 : 0;
  }

  getDecor(cx: number, cy: number): DecorName | null {
    if (!this.inBounds(cx, cy)) return null;
    const d = this.decor[cy * this.w + cx];
    return d ? DECOR_NAMES[d - 1] : null;
  }

  addObject(type: ObjectTypeId, x: number, y: number, text?: string, tag?: string): number {
    const def = OBJECT_TYPES[type] as ObjectType;
    const idx = this.objects.length;
    this.objects.push({ type, def, x, y, text, tag });
    const ck = this.chunkIndexAt(x, y);
    if (ck >= 0) this.chunkObjects[ck].push(idx);
    const boxes = def.boxes ? [...def.boxes] : [];
    if (def.box) boxes.push(def.box);
    for (const [bx, by, bw, bh] of boxes) {
      const box: Box = { x: x + bx, y: y + by, w: bw, h: bh, obj: idx };
      // Box in alle berührten Chunks eintragen
      const c0x = Math.floor(box.x / CHUNK_PX);
      const c1x = Math.floor((box.x + box.w) / CHUNK_PX);
      const c0y = Math.floor(box.y / CHUNK_PX);
      const c1y = Math.floor((box.y + box.h) / CHUNK_PX);
      for (let cy = c0y; cy <= c1y; cy++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          if (cx >= 0 && cy >= 0 && cx < this.chunksX && cy < this.chunksY) this.chunkBoxes[cy * this.chunksX + cx].push(box);
        }
      }
    }
    return idx;
  }

  private readonly removed = new Map<number, [number, Box][]>();

  /** Objekt ausblenden und seine Kollision entfernen (z. B. geöffnete Wegsperre) */
  removeObject(idx: number): void {
    const o = this.objects[idx];
    if (!o || o.hidden) return;
    o.hidden = true;
    const keep: [number, Box][] = [];
    this.chunkBoxes.forEach((list, k) => {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].obj === idx) {
          keep.push([k, list[i]]);
          list.splice(i, 1);
        }
      }
    });
    this.removed.set(idx, keep);
  }

  /** Entferntes Objekt wiederherstellen */
  restoreObject(idx: number): void {
    const o = this.objects[idx];
    if (!o || !o.hidden) return;
    o.hidden = false;
    for (const [k, b] of this.removed.get(idx) ?? []) this.chunkBoxes[k].push(b);
    this.removed.delete(idx);
  }

  /** Dynamische Kollisionsboxen (z. B. Figuren) entfernen */
  clearDynamicBoxes(): void {
    for (const list of this.chunkBoxes) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].obj < 0) list.splice(i, 1);
    }
  }

  /** Objekte mit Tag finden */
  findByTag(tag: string): number {
    return this.objects.findIndex((o) => o.tag === tag);
  }

  chunkIndexAt(px: number, py: number): number {
    const cx = Math.floor(px / CHUNK_PX);
    const cy = Math.floor(py / CHUNK_PX);
    if (cx < 0 || cy < 0 || cx >= this.chunksX || cy >= this.chunksY) return -1;
    return cy * this.chunksX + cx;
  }

  /** Begehbarkeit aus Terrain, Brücken und Sperren berechnen. */
  computeSolid(): void {
    const bridgeH = DECOR_NAMES.indexOf('bridgeH') + 1;
    const bridgeV = DECOR_NAMES.indexOf('bridgeV') + 1;
    for (let i = 0; i < this.w * this.h; i++) {
      const t = TERRAIN_BY_ID[this.terrain[i]];
      const d = this.decor[i];
      const bridge = d === bridgeH || d === bridgeV;
      this.solid[i] = this.blocked[i] || (t.solid && !bridge) ? 1 : 0;
    }
  }

  isSolidCell(cx: number, cy: number): boolean {
    if (!this.inBounds(cx, cy)) return true;
    return this.solid[cy * this.w + cx] === 1;
  }

  /** Prüft, ob ein Rechteck (Weltpixel) mit Wänden oder Objekten kollidiert. */
  boxBlocked(x: number, y: number, w: number, h: number): boolean {
    const c0x = Math.floor(x / TILE);
    const c1x = Math.floor((x + w - 0.001) / TILE);
    const c0y = Math.floor(y / TILE);
    const c1y = Math.floor((y + h - 0.001) / TILE);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        if (this.isSolidCell(cx, cy)) return true;
      }
    }
    const k0x = Math.floor(x / CHUNK_PX);
    const k1x = Math.floor((x + w) / CHUNK_PX);
    const k0y = Math.floor(y / CHUNK_PX);
    const k1y = Math.floor((y + h) / CHUNK_PX);
    for (let ky = k0y; ky <= k1y; ky++) {
      for (let kx = k0x; kx <= k1x; kx++) {
        if (kx < 0 || ky < 0 || kx >= this.chunksX || ky >= this.chunksY) continue;
        const boxes = this.chunkBoxes[ky * this.chunksX + kx];
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
        }
      }
    }
    return false;
  }

  /** Nächstes interaktives Objekt in Reichweite eines Punktes. */
  findInteractable(px: number, py: number, range: number): WorldObject | null {
    let best: WorldObject | null = null;
    let bestD = range * range;
    const k0x = Math.floor((px - range) / CHUNK_PX);
    const k1x = Math.floor((px + range) / CHUNK_PX);
    const k0y = Math.floor((py - range) / CHUNK_PX);
    const k1y = Math.floor((py + range + 32) / CHUNK_PX);
    for (let ky = k0y; ky <= k1y; ky++) {
      for (let kx = k0x; kx <= k1x; kx++) {
        if (kx < 0 || ky < 0 || kx >= this.chunksX || ky >= this.chunksY) continue;
        for (const i of this.chunkObjects[ky * this.chunksX + kx]) {
          const o = this.objects[i];
          if (!o.def.interact || o.hidden) continue;
          const by = o.def.box ? o.y + o.def.box[1] / 2 : o.y;
          const dx = o.x - px;
          const dy = by - py;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
      }
    }
    return best;
  }
}
