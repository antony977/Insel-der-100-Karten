import { TILE } from '../config';
import { hash2, rng } from '../gfx/Raster';
import { T } from './terrain';
import { WorldMap } from './WorldMap';
import { OBJECT_TYPES, type ObjectTypeId } from '../data/worldObjects';
import { MONSTER_BY_ID } from '../data/monsters';
import type { DecorName } from '../gfx/generators/objects';
import {
  CELL,
  ISLAND_ASCII,
  ISLAND_H,
  ISLAND_W,
  POIS,
  REGION_CHAR,
  REGION_IDS,
  REGIONS,
  RIVERS,
  ROADS,
  TOWNS,
  type RegionId,
} from '../data/world/layout';

export const R = Object.fromEntries(REGION_IDS.map((id, i) => [id, i])) as Record<RegionId, number>;

/** Glattes Wertrauschen 0…1 */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const h = (i: number, j: number) => (hash2(i, j, seed) % 10000) / 10000;
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  const u = s(xf);
  const v = s(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, y: number, seed: number): number {
  return valueNoise(x, y, seed) * 0.6 + valueNoise(x * 2.1, y * 2.1, seed + 17) * 0.3 + valueNoise(x * 4.3, y * 4.3, seed + 31) * 0.1;
}

/** Catmull-Rom-Kurve durch Wegpunkte, liefert dichte Punkte */
function spline(pts: [number, number][], step = 0.25): [number, number][] {
  const out: [number, number][] = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export interface IslandMeta {
  region: Uint8Array;
  /** Stadt-Kennung → Zentrum in Pixeln */
  towns: Record<string, { x: number; y: number; name: string }>;
}

/**
 * Erzeugt die ganze Insel deterministisch aus dem Grundriss (data/world/layout.ts).
 * Gleiche Saat → gleiche Insel; dauert nur Sekundenbruchteile.
 */
export function buildIsland(seed = 4711): { map: WorldMap; meta: IslandMeta } {
  const W = ISLAND_W;
  const H = ISLAND_H;
  const m = new WorldMap(W, H);
  m.name = 'insel';
  const rand = rng(seed);
  const region = new Uint8Array(W * H);
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  // 1) Regionen mit verzerrten Grenzen
  const rows = ISLAND_ASCII.length;
  const cols = ISLAND_ASCII[0].length;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wx = x + (fbm(x * 0.05, y * 0.05, seed + 1) - 0.5) * 16;
      const wy = y + (fbm(x * 0.05, y * 0.05, seed + 2) - 0.5) * 16;
      const cx = Math.max(0, Math.min(cols - 1, Math.floor(wx / CELL)));
      const cy = Math.max(0, Math.min(rows - 1, Math.floor(wy / CELL)));
      region[idx(x, y)] = R[REGION_CHAR[ISLAND_ASCII[cy][cx]] ?? 'meer'];
    }
  }
  // Rand immer Meer
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) region[idx(x, y)] = R.meer;

  // 1b) Möwenklippen vom Festland trennen (nur per Boot erreichbar)
  const landNotKlippen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) landNotKlippen[i] = region[i] !== R.meer && region[i] !== R.klippen && region[i] !== R.silbersee ? 1 : 0;
  const distNK = distanceField(landNotKlippen, W, H, 7);
  for (let i = 0; i < W * H; i++) if (region[i] === R.klippen && distNK[i] <= 6) region[i] = R.meer;

  // 2) Grundterrain je Region
  const terr = m.terrain;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = REGION_IDS[region[idx(x, y)]];
      const n = fbm(x * 0.08, y * 0.08, seed + 5);
      const n2 = fbm(x * 0.15, y * 0.15, seed + 9);
      let t: number = T.GRASS;
      switch (r) {
        case 'meer':
        case 'silbersee':
          t = T.WATER;
          break;
        case 'taufeld':
          t = n > 0.66 ? T.FOREST : T.GRASS;
          break;
        case 'windhalm':
          t = T.GRASS;
          break;
        case 'runenhall':
          t = n > 0.6 ? T.FOREST : T.GRASS;
          break;
        case 'moewenhafen':
          t = n2 > 0.7 ? T.SAND : T.GRASS;
          break;
        case 'klippen':
          t = n > 0.58 ? T.ROCK : T.GRASS;
          break;
        case 'wuerfelheim':
          t = n2 > 0.72 ? T.DIRT : T.GRASS;
          break;
        case 'hohenkamm':
          t = n > 0.57 ? T.ROCK : n2 > 0.66 ? T.STONE : T.SNOW;
          break;
        case 'sandspiegel':
          t = n2 > 0.64 ? T.SAND : T.DUNE;
          break;
        case 'nebelhain':
          t = n > 0.5 ? T.FOREST : T.MOSS;
          break;
        case 'rosenweil':
          t = n2 > 0.7 ? T.GRASS : T.ROSE;
          break;
        case 'ruinen':
          t = n2 > 0.6 ? T.STONE : n > 0.64 ? T.FOREST : T.GRASS;
          break;
      }
      terr[idx(x, y)] = t;
    }
  }
  // Silbersee-Insel (Wolkenfloss)
  for (let y = 88; y <= 104; y++) for (let x = 150; x <= 168; x++) if (Math.hypot((x - 159) / 1.3, y - 96) < 4.6) terr[idx(x, y)] = T.GRASS;

  // 3) Küsten und Ufer
  const water = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) water[i] = terr[i] === T.WATER ? 1 : 0;
  const dWater = distanceField(water, W, H, 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (water[i]) continue;
      const r = REGION_IDS[region[i]];
      const d = dWater[i];
      const beach = r === 'moewenhafen' || r === 'sandspiegel' ? 3 : r === 'hohenkamm' || r === 'klippen' || r === 'nebelhain' ? 1 : 2;
      const jitter = valueNoise(x * 0.3, y * 0.3, seed + 44) > 0.5 ? 1 : 0;
      if (d <= beach + jitter - 1 && terr[i] !== T.ROCK) terr[i] = T.SAND;
      if (r === 'hohenkamm' && d <= 1) terr[i] = T.ROCK;
    }
  }

  // 4) Flüsse
  for (const rv of RIVERS) {
    const pts = spline(rv.pts.map(([x, y]) => [x, y]));
    for (const [px, py] of pts) {
      const wob = (valueNoise(px * 0.2, py * 0.2, seed + 70) - 0.5) * 1.2;
      const rad = rv.w / 2 + wob * 0.4;
      for (let y = Math.floor(py - rad - 2); y <= Math.ceil(py + rad + 2); y++) {
        for (let x = Math.floor(px - rad - 2); x <= Math.ceil(px + rad + 2); x++) {
          if (!inb(x, y)) continue;
          const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
          const i = idx(x, y);
          if (d <= rad) terr[i] = T.WATER;
          else if (d <= rad + 1.3 && terr[i] !== T.WATER && terr[i] !== T.ROCK && REGION_IDS[region[i]] !== 'hohenkamm') terr[i] = T.SAND;
        }
      }
    }
  }

  // Belegung (keine Vegetation)
  const occ = new Uint8Array(W * H);
  const markRect = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) occ[idx(x, y)] = 1;
  };

  // 5) Städte: Plätze
  const meta: IslandMeta = { region, towns: {} };
  for (const t of TOWNS) {
    meta.towns[t.id] = { x: t.x * TILE + 8, y: t.y * TILE + 8, name: t.name };
    const pt = t.plaza === 'darkstone' ? T.DARKSTONE : t.plaza === 'sand' ? T.SAND : t.plaza === 'dirt' ? T.DIRT : T.STONE;
    for (let y = t.y - 22; y <= t.y + 22; y++) {
      for (let x = t.x - 26; x <= t.x + 26; x++) {
        if (!inb(x, y)) continue;
        const i = idx(x, y);
        const d = Math.hypot((x - t.x) / 1.2, y - t.y);
        if (d <= t.plazaR) terr[i] = pt;
        // Stadtgebiet frei von Bäumen
        if (Math.hypot((x - t.x) / 1.3, y - t.y) < 19) occ[i] = 1;
        // kein Fels/Wasser mitten in der Stadt
        if (Math.hypot((x - t.x) / 1.3, y - t.y) < 18 && (terr[i] === T.ROCK || (terr[i] === T.WATER && REGION_IDS[region[i]] !== 'meer'))) {
          terr[i] = t.region === 'hohenkamm' ? T.SNOW : t.region === 'sandspiegel' ? T.DUNE : T.GRASS;
        }
      }
    }
    // Gassen zu den Türen
    for (const b of t.buildings) {
      const doorX = t.x + b.dx;
      const doorY = t.y + b.dy + 1;
      carvePath(doorX, doorY, t.x, t.y, pt);
    }
  }

  function carvePath(x0: number, y0: number, x1: number, y1: number, t: number): void {
    let x = x0;
    let y = y0;
    let guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 200) {
      for (let k = 0; k <= 1; k++) {
        if (inb(x + k, y) && terr[idx(x + k, y)] !== T.WATER) terr[idx(x + k, y)] = t;
      }
      const d = Math.hypot((x - x1) / 1.2, y - y1);
      if (d < 4) break;
      if (y !== y1 && (guard % 3 !== 0 || x === x1)) y += Math.sign(y1 - y);
      else x += Math.sign(x1 - x);
    }
  }

  // 6) Straßen (mit Brücken über Wasser)
  const road = new Uint8Array(W * H);
  for (const r of ROADS) {
    const pts = spline(r);
    for (let k = 0; k < pts.length; k++) {
      const [px, py] = pts[k];
      const [nx, ny] = pts[Math.min(pts.length - 1, k + 1)];
      const horiz = Math.abs(nx - px) >= Math.abs(ny - py);
      const rad = 1.15;
      for (let y = Math.floor(py - 2); y <= Math.ceil(py + 2); y++) {
        for (let x = Math.floor(px - 2); x <= Math.ceil(px + 2); x++) {
          if (!inb(x, y)) continue;
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > rad) continue;
          const i = idx(x, y);
          if (terr[i] === T.WATER) {
            if (REGION_IDS[region[i]] === 'meer') continue;
            m.decor[i] = 0;
            m.setDecor(x, y, horiz ? 'bridgeH' : 'bridgeV');
          } else if (terr[i] !== T.STONE && terr[i] !== T.DARKSTONE) terr[i] = T.DIRT;
          road[i] = 1;
          occ[i] = 1;
        }
      }
    }
  }
  // Brücken verbreitern: Ufer an Brückenenden begehbar machen
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const d = m.getDecor(x, y);
      if (d !== 'bridgeH' && d !== 'bridgeV') continue;
      occ[idx(x, y)] = 1;
    }
  }

  // Hafen: Steg vom Möwenhafen ins Meer
  const harbor = TOWNS.find((t) => t.id === 'moewenhafen')!;
  {
    let x = harbor.x + 6;
    const y = harbor.y + 2;
    while (x < W - 4 && terr[idx(x, y)] !== T.WATER) {
      terr[idx(x, y)] = T.STONE;
      terr[idx(x, y + 1)] = T.STONE;
      occ[idx(x, y)] = occ[idx(x, y + 1)] = 1;
      x++;
    }
    for (let k = 0; k < 6 && x < W - 4; k++, x++) {
      m.setDecor(x, y, 'bridgeH');
      m.setDecor(x, y + 1, 'bridgeH');
    }
  }

  // 7) Objekte
  const place = (type: ObjectTypeId, tx: number, ty: number, text?: string, tag?: string): number => {
    const i = m.addObject(type, tx * TILE + TILE / 2, ty * TILE + TILE - 2, text, tag);
    const def = OBJECT_TYPES[type] as { box?: number[]; boxes?: number[][] };
    const boxes = def.boxes ? def.boxes : def.box ? [def.box] : [[-8, -8, 16, 8]];
    for (const b of boxes) {
      const x0 = Math.floor((tx * TILE + 8 + b[0]) / TILE) - 1;
      const y0 = Math.floor((ty * TILE + 14 + b[1]) / TILE) - 1;
      markRect(x0, y0, Math.ceil(b[2] / TILE) + 2, Math.ceil(b[3] / TILE) + 2);
    }
    return i;
  };

  const walkable = (x: number, y: number) => inb(x, y) && terr[idx(x, y)] !== T.WATER && terr[idx(x, y)] !== T.ROCK;
  /** nächste freie, begehbare Kachel (Spirale) */
  const nearestFree = (x: number, y: number, needRegion?: number): [number, number] => {
    for (let r = 0; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (!walkable(xx, yy) || occ[idx(xx, yy)]) continue;
          if (needRegion !== undefined && region[idx(xx, yy)] !== needRegion) continue;
          return [xx, yy];
        }
      }
    }
    return [x, y];
  };

  for (const t of TOWNS) {
    // Brunnen
    place(t.well, t.x, t.y + (t.well === 'fountain' ? 1 : 1), undefined, `brunnen:${t.id}`);
    for (const b of t.buildings) place(b.type, t.x + b.dx, t.y + b.dy, undefined, b.door);
    for (const [lx, ly] of t.lamps) place('lampWarm', t.x + lx, t.y + ly);
    for (const d of t.deco ?? []) place(d.type, t.x + d.dx, t.y + d.dy, d.text, d.tag);
  }
  // Stege: Boot am Ende des Hafenstegs
  for (const p of POIS) {
    if (p.tag === 'warp:klippen') {
      let x = harbor.x + 6;
      while (x < W - 4 && m.getDecor(x, harbor.y + 2) !== 'bridgeH') x++;
      while (x < W - 4 && m.getDecor(x + 1, harbor.y + 2) === 'bridgeH') x++;
      m.addObject('boat', (x + 2) * TILE, (harbor.y + 3) * TILE + 6, undefined, p.tag);
      continue;
    }
    if (p.type === 'boat') {
      // Rückfahrt von den Klippen: Küste der Klippen suchen
      const [bx, by] = nearestFree(p.x, p.y, R.klippen);
      place('boat', bx, by + 1, undefined, p.tag);
      m.spawnPoints[p.tag ?? ''] = { x: bx * TILE + 8, y: (by - 1) * TILE + 12 };
      continue;
    }
    const [x, y] = p.type === 'statue' ? [p.x, p.y] : nearestFree(p.x, p.y);
    if (p.type === 'statue') {
      for (let yy = y - 1; yy <= y; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (inb(xx, yy)) terr[idx(xx, yy)] = T.STONE;
    }
    place(p.type, x, y, p.text, p.tag);
  }

  // Quest-Fundstellen
  {
    const t = TOWNS[0];
    const [kx, ky] = nearestFree(t.x - 4, t.y + 21);
    place('spot', kx, ky, undefined, 'geheim:klee');
    const [gx, gy] = nearestFree(t.x + 27, t.y + 3);
    place('spot', gx, gy, undefined, 'geheim:glocke');
    // Pusteblumen auf den Wiesen von Taufeld
    let n = 0;
    for (let k = 0; k < 400 && n < 16; k++) {
      const x = t.x - 40 + Math.floor(rand() * 80);
      const y = t.y - 30 + Math.floor(rand() * 60);
      if (!inb(x, y) || region[idx(x, y)] !== R.taufeld || terr[idx(x, y)] !== T.GRASS || occ[idx(x, y)]) continue;
      if (Math.hypot(x - t.x, y - t.y) < 20) continue;
      place('dandelion', x, y, undefined, `pickup:pusteblume:${n++}`);
    }
    // Kiesel am Silberlauf
    const river = spline(RIVERS[0].pts.map(([x, y]) => [x, y]));
    for (let k = 0; k < 10; k++) {
      const [px, py] = river[Math.floor(((k + 0.5) / 10) * (river.length - 1))];
      const [x, y] = nearestFree(Math.round(px), Math.round(py) + 3);
      place('spot', x, y, undefined, `pickup:kiesel:${k}`);
    }
  }

  // 8) Vegetation
  const tryFlora = (type: ObjectTypeId, x: number, y: number, spacing: number) => {
    for (let dy = -spacing; dy <= spacing; dy++) for (let dx = -spacing; dx <= spacing; dx++) if (!inb(x + dx, y + dy) || occ[idx(x + dx, y + dy)]) return;
    place(type, x, y);
  };
  for (let y = 4; y < H - 4; y++) {
    for (let x = 4; x < W - 4; x++) {
      const i = idx(x, y);
      if (occ[i]) continue;
      const t = terr[i];
      if (t === T.WATER || t === T.ROCK || t === T.STONE || t === T.DARKSTONE || t === T.DIRT) continue;
      const reg = REGIONS[REGION_IDS[region[i]]];
      if (!reg.flora.length) continue;
      const forest = t === T.FOREST || (t === T.MOSS && reg.id === 'nebelhain');
      const dense = forest ? 5 : 1;
      for (const [type, density] of reg.flora) {
        const isTree = /tree|pine|palm/i.test(type);
        const p = (density / 100) * 2.6 * (isTree ? dense : 1) * (t === T.SAND && !/palm|rock/.test(type) ? 0.2 : 1);
        if (rand() < p) {
          tryFlora(type, x, y, forest ? 0 : 1);
          break;
        }
      }
    }
  }
  // Rosenweil: Hecken-Gärten
  {
    const t = TOWNS.find((tt) => tt.id === 'rosenweil')!;
    for (let k = 0; k < 6; k++) {
      const gx = t.x - 20 + (k % 3) * 18;
      const gy = t.y + 22 + Math.floor(k / 3) * 12;
      for (let x = gx; x < gx + 10; x++) {
        if (walkable(x, gy) && !occ[idx(x, gy)] && x !== gx + 5) place('hedge', x, gy);
        if (walkable(x, gy + 7) && !occ[idx(x, gy + 7)] && x !== gx + 4) place('hedge', x, gy + 7);
      }
    }
  }
  // Windhalmfelder: Getreidefelder
  for (let k = 0; k < 26; k++) {
    const x0 = 196 + Math.floor(rand() * 60);
    const y0 = 86 + Math.floor(rand() * 50);
    if (REGION_IDS[region[idx(x0, y0)]] !== 'windhalm') continue;
    const w = 5 + Math.floor(rand() * 5);
    const h = 3 + Math.floor(rand() * 3);
    let ok = true;
    for (let y = y0; y < y0 + h && ok; y++) for (let x = x0; x < x0 + w && ok; x++) if (!inb(x, y) || terr[idx(x, y)] !== T.GRASS) ok = false;
    if (!ok) continue;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      terr[idx(x, y)] = T.FIELD;
      occ[idx(x, y)] = 1;
    }
  }

  // Bodendekor
  const decorFor: Partial<Record<RegionId, [DecorName, number][]>> = {
    taufeld: [['flowersRed', 0.025], ['flowersYellow', 0.025], ['flowersWhite', 0.015], ['flowersBlue', 0.012], ['tuft', 0.07], ['clover', 0.02]],
    windhalm: [['tuft', 0.08], ['flowersYellow', 0.02], ['pebbles', 0.01]],
    runenhall: [['tuft', 0.06], ['flowersBlue', 0.02], ['mushrooms', 0.012]],
    moewenhafen: [['tuft', 0.04], ['flowersWhite', 0.015]],
    wuerfelheim: [['tuft', 0.05], ['flowersRed', 0.02]],
    nebelhain: [['mushrooms', 0.04], ['tuft', 0.06]],
    rosenweil: [['flowersRed', 0.05], ['flowersWhite', 0.03], ['tuft', 0.03]],
    ruinen: [['tuft', 0.05], ['pebbles', 0.02]],
    klippen: [['tuft', 0.05]],
  };
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (m.decor[i]) continue;
      const t = terr[i];
      const r = (hash2(x, y, seed + 99) % 10000) / 10000;
      if (t === T.SAND || t === T.DUNE) {
        if (r < 0.02) m.setDecor(x, y, 'slab');
        else if (r < 0.04) m.setDecor(x, y, 'pebbles');
        continue;
      }
      if (t === T.DIRT) {
        if (r < 0.06) m.setDecor(x, y, 'pebbles');
        continue;
      }
      if (t === T.WATER) {
        if (REGION_IDS[region[i]] === 'silbersee' && dWater[i] === 0 && r < 0.03) {
          let shore = false;
          for (let dy = -2; dy <= 2 && !shore; dy++) for (let dx = -2; dx <= 2 && !shore; dx++) if (inb(x + dx, y + dy) && terr[idx(x + dx, y + dy)] !== T.WATER) shore = true;
          if (!shore) m.setDecor(x, y, 'lily');
        }
        continue;
      }
      if (t !== T.GRASS && t !== T.FOREST && t !== T.MOSS && t !== T.ROSE) continue;
      const list = decorFor[REGION_IDS[region[i]]];
      if (!list) continue;
      let acc = 0;
      for (const [name, p] of list) {
        acc += p;
        if (r < acc) {
          m.setDecor(x, y, name);
          break;
        }
      }
    }
  }

  // 9) Monster-Gebiete
  const startTown = TOWNS[0];
  for (const rid of REGION_IDS) {
    const reg = REGIONS[rid];
    if (!reg.zones) continue;
    const ri = R[rid];
    const chosen: [number, number][] = [];
    let tries = 0;
    while (chosen.length < reg.zones && tries++ < reg.zones * 80) {
      const x = 4 + Math.floor(rand() * (W - 8));
      const y = 4 + Math.floor(rand() * (H - 8));
      const i = idx(x, y);
      if (region[i] !== ri || !walkable(x, y) || road[i]) continue;
      if (TOWNS.some((t) => Math.hypot(t.x - x, t.y - y) < 22)) continue;
      if (chosen.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 16)) continue;
      chosen.push([x, y]);
      // Nähe zum Start: nur harmlose Monster
      const nearStart = Math.hypot(startTown.x - x, startTown.y - y) < 46;
      const gentle = reg.monsters.filter(([id]) => id === 'wollknaeuel' || id === 'huepfpilz');
      if (nearStart && !gentle.length) continue;
      const pool = nearStart ? gentle : reg.monsters;
      const total = pool.reduce((a, [, w]) => a + w, 0);
      let roll = rand() * total;
      let pick = pool[0][0];
      for (const [id, w] of pool) {
        roll -= w;
        if (roll <= 0) {
          pick = id;
          break;
        }
      }
      const def = MONSTER_BY_ID[pick];
      const mini = def?.special?.mini;
      const count = mini ? 1 : def?.behavior.includes('pack') ? 3 : 2 + Math.floor(rand() * 2);
      m.spawns.push({ monster: pick, x: x * TILE + 8, y: y * TILE + 8, r: mini ? 24 : 40 + rand() * 24, count, respawn: mini ? 600 : 45 });
    }
  }

  // 10) Start und Begrenzung
  m.spawnX = startTown.x * TILE + 8;
  m.spawnY = (startTown.y - 7) * TILE + 12;
  for (let x = 0; x < W; x++) {
    m.blocked[x] = 1;
    m.blocked[(H - 1) * W + x] = 1;
  }
  for (let y = 0; y < H; y++) {
    m.blocked[y * W] = 1;
    m.blocked[y * W + W - 1] = 1;
  }
  m.computeSolid();
  return { map: m, meta };
}

/** Mehrquellen-Distanzfeld (Manhattan, 4er-Nachbarschaft) bis `max` */
export function distanceField(src: Uint8Array, W: number, H: number, max: number): Uint8Array {
  const d = new Uint8Array(W * H).fill(255);
  const q = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < W * H; i++) {
    if (src[i]) {
      d[i] = 0;
      q[tail++] = i;
    }
  }
  while (head < tail) {
    const i = q[head++];
    const dv = d[i];
    if (dv >= max) continue;
    const x = i % W;
    const y = (i - x) / W;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j >= 0 && d[j] > dv + 1) {
        d[j] = dv + 1;
        q[tail++] = j;
      }
    }
  }
  return d;
}
