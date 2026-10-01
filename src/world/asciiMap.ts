import { TILE } from '../config';
import { hash2 } from '../gfx/Raster';
import { WorldMap } from './WorldMap';
import type { ObjectTypeId } from '../data/worldObjects';

/**
 * Kleine Karten (Höhlen, Arenen, Tempel) aus ASCII-Vorlagen: Ein Zeichen = eine Kachel.
 * So bleiben Dungeons datengetrieben und leicht zu ändern.
 */
export interface AsciiObject {
  type: ObjectTypeId;
  /** Tag; „#" wird durch eine laufende Nummer ersetzt */
  tag?: string;
  text?: string;
  /** Gelände unter dem Objekt (Standard: `floor`) */
  under?: number;
}

export interface AsciiMapDef {
  name: string;
  rows: string[];
  /** Zeichen → Gelände */
  terrain: Record<string, number>;
  /** Zeichen → Objekt */
  objects?: Record<string, AsciiObject>;
  /** Gelände unter Objekten und unbekannten Zeichen */
  floor: number;
  /** Startpunkt (Kachel); sonst das Zeichen „@" */
  start?: [number, number];
  spawns?: { monster: string; x: number; y: number; r?: number; count: number; respawn?: number }[];
  /** zufällige Deko auf Bodenkacheln */
  scatter?: { type: ObjectTypeId; on: number; chance: number }[];
  seed?: number;
}

export function buildAsciiMap(def: AsciiMapDef): WorldMap {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const m = new WorldMap(w, h);
  m.name = def.name;
  const counters = new Map<string, number>();
  const occ = new Uint8Array(w * h);
  let start = def.start;
  const placed: { x: number; y: number; o: AsciiObject }[] = [];
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? ' ';
      const t = def.terrain[ch];
      if (t !== undefined) {
        m.setTerrain(x, y, t);
        continue;
      }
      if (ch === '@') {
        start = [x, y];
        m.setTerrain(x, y, def.floor);
        continue;
      }
      const o = def.objects?.[ch];
      m.setTerrain(x, y, o?.under ?? def.floor);
      if (o) placed.push({ x, y, o });
    }
  }
  for (const { x, y, o } of placed) {
    let tag = o.tag;
    if (tag?.includes('#')) {
      const n = (counters.get(tag) ?? 0) + 1;
      counters.set(tag, n);
      tag = tag.replace('#', String(n));
    }
    m.addObject(o.type, x * TILE + 8, y * TILE + 14, o.text, tag);
    occ[y * w + x] = 1;
  }
  // Deko verstreuen (deterministisch)
  const seed = def.seed ?? 3;
  for (const s of def.scatter ?? []) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (occ[y * w + x] || m.getTerrain(x, y) !== s.on) continue;
        if (start && Math.abs(x - start[0]) < 3 && Math.abs(y - start[1]) < 3) continue;
        if ((hash2(x, y, seed + s.type.length) % 1000) / 1000 >= s.chance) continue;
        // nicht direkt neben andere Objekte
        let free = true;
        for (let dy = -1; dy <= 1 && free; dy++) for (let dx = -1; dx <= 1 && free; dx++) if (occ[(y + dy) * w + x + dx]) free = false;
        if (!free) continue;
        m.addObject(s.type, x * TILE + 8, y * TILE + 14);
        occ[y * w + x] = 1;
      }
    }
  }
  for (const s of def.spawns ?? []) {
    m.spawns.push({ monster: s.monster, x: s.x * TILE + 8, y: s.y * TILE + 8, r: s.r ?? 40, count: s.count, respawn: s.respawn ?? 50 });
  }
  const [sx, sy] = start ?? [Math.floor(w / 2), Math.floor(h / 2)];
  m.spawnX = sx * TILE + 8;
  m.spawnY = sy * TILE + 12;
  m.computeSolid();
  return m;
}
