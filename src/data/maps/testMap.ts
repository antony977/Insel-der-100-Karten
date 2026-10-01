import { TILE } from '../../config';
import { hash2, rng } from '../../gfx/Raster';
import { T } from '../../world/terrain';
import { WorldMap } from '../../world/WorldMap';
import type { ObjectTypeId } from '../worldObjects';

/**
 * Testwiese für Meilenstein 1: Wiese, Wald, See mit Sandufer, Fluss mit Brücke,
 * Erdweg, Pflasterplatz mit Haus und Brunnen, Garten mit Zaun, Rastfeuer.
 * Deterministisch erzeugt (gleiche Saat → gleiche Karte).
 */
export function buildTestMap(seed = 7): WorldMap {
  const W = 96;
  const H = 64;
  const m = new WorldMap(W, H);
  m.name = 'Testwiese';
  const rand = rng(seed);
  const noise = (x: number, y: number, s = 0) => (hash2(x, y, seed + s) % 1000) / 1000;

  // 1) Grundfläche
  m.terrain.fill(T.GRASS);

  // 2) Waldboden im Nordwesten
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = x / 27 + y / 23 + (noise(x >> 1, y >> 1, 1) - 0.5) * 0.25;
      if (d < 1) m.setTerrain(x, y, T.FOREST);
    }
  }

  // 3) See mit Sandufer
  const lake = { x: 67, y: 15, rx: 13, ry: 8 };
  const isLake = (x: number, y: number) => {
    const dx = (x - lake.x) / lake.rx;
    const dy = (y - lake.y) / lake.ry;
    return dx * dx + dy * dy + (noise(x, y, 2) - 0.5) * 0.35 < 1;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isLake(x, y)) m.setTerrain(x, y, T.WATER);

  // 4) Fluss nach Süden
  const riverX = (y: number) => 67 + Math.round(Math.sin(y * 0.17) * 4);
  for (let y = lake.y; y < H; y++) {
    const cx = riverX(y);
    for (let x = cx - 1; x <= cx + 1; x++) m.setTerrain(x, y, T.WATER);
  }
  // Sandufer um den See
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (m.getTerrain(x, y) === T.WATER || y > lake.y + lake.ry + 3) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (m.getTerrain(x + dx, y + dy) === T.WATER && isLake(x + dx, y + dy)) near = true;
      if (near) m.setTerrain(x, y, T.SAND);
    }
  }

  // 5) Hauptweg West → Ost (mit Brücke über den Fluss)
  const pathY = (x: number) => 40 + Math.round(Math.sin(x * 0.12) * 3);
  for (let x = 2; x < W - 2; x++) {
    const py = pathY(x);
    for (let y = py; y <= py + 1; y++) {
      if (m.getTerrain(x, y) === T.WATER) m.setDecor(x, y, 'bridgeH');
      else m.setTerrain(x, y, T.DIRT);
    }
    // Brücke etwas breiter als der Fluss: Geländer-Kacheln an den Ufern
  }
  // 6) Abzweig nach Norden zum Platz
  for (let y = 27; y < pathY(30); y++) {
    m.setTerrain(30, y, T.DIRT);
    m.setTerrain(31, y, T.DIRT);
  }
  // 7) Pflasterplatz
  for (let y = 21; y <= 27; y++) for (let x = 24; x <= 37; x++) m.setTerrain(x, y, T.STONE);

  // Belegungsraster für Objekte
  const occ = new Uint8Array(W * H);
  const free = (x: number, y: number) => m.inBounds(x, y) && !occ[y * W + x];
  const mark = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (m.inBounds(x, y)) occ[y * W + x] = 1;
  };
  const walkableGround = (x: number, y: number) => {
    const t = m.getTerrain(x, y);
    return t === T.GRASS || t === T.FOREST || t === T.SAND;
  };
  const place = (type: ObjectTypeId, cx: number, cy: number, w = 1, h = 1, text?: string, tag?: string) => {
    m.addObject(type, cx * TILE + TILE / 2, cy * TILE + TILE - 2, text, tag);
    mark(cx - Math.floor((w - 1) / 2), cy - h + 1, w, h);
  };
  // Wege und Wasser belegen
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!walkableGround(x, y)) occ[y * W + x] = 1;

  // Haus + Brunnen + Laternen
  place('house', 30, 20, 5, 4);
  mark(28, 20, 6, 1);
  place('well', 30, 25, 2, 2);
  place('lamp', 24, 22);
  place('lamp', 37, 22);
  place('lamp', 24, 27);
  place('lamp', 37, 27);
  place('barrel', 35, 20);
  place('crate', 36, 20);
  place('treeFruit', 21, 21, 2, 2);
  place('treeFruit', 40, 21, 2, 2);

  // Rastplatz am Start
  m.spawnX = 14 * TILE + 8;
  m.spawnY = pathY(14) * TILE + 12;
  place('campfire', 11, pathY(11) - 3);
  place('stump', 9, pathY(9) - 3);
  place('stump', 13, pathY(13) - 4);
  place('sign', 18, pathY(18) - 1, 1, 1, 'Testwiese – Meilenstein 1. Bewege dich mit WASD, Pfeiltasten, Joystick oder Gamepad.');
  mark(10, pathY(11) - 5, 5, 4);

  // Garten mit Zaun
  const gx0 = 44;
  const gy0 = 28;
  const gx1 = 54;
  const gy1 = 34;
  for (let x = gx0; x <= gx1; x++) {
    place('fence', x, gy0);
    if (x !== 49) place('fence', x, gy1);
  }
  for (let y = gy0 + 1; y < gy1; y++) {
    for (let x = gx0 + 1; x < gx1; x++) {
      if ((y - gy0) % 2 === 0) m.setDecor(x, y, (['flowersRed', 'flowersYellow', 'flowersWhite', 'flowersBlue'] as const)[(x + y) % 4]);
      occ[y * W + x] = 1;
    }
  }
  // Seitenzäune als Felsen/Büsche (einfacher)
  for (let y = gy0 + 1; y < gy1; y++) {
    place('bush', gx0, y);
    place('bush', gx1, y);
  }

  // Schatztruhen (Inhalt: data/treasures.ts)
  place('chest', 34, 20, 1, 1, undefined, 'testwiese:truhe-haus');
  place('chest', 49, 31, 1, 1, undefined, 'testwiese:truhe-garten');
  place('chest', 16, 14, 1, 1, undefined, 'testwiese:truhe-wald');
  mark(15, 13, 3, 3);
  place('chest', 55, 27, 1, 1, undefined, 'testwiese:truhe-see');
  mark(54, 26, 3, 3);

  // Randbäume (Insel-Begrenzung)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < 2 || y < 3 || x >= W - 2 || y >= H - 2;
      if (!edge) continue;
      m.blocked[y * W + x] = x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : 0;
      if ((x + y) % 2 === 0 && free(x, y) && walkableGround(x, y)) {
        place(m.getTerrain(x, y) === T.FOREST || rand() < 0.4 ? 'pine' : 'tree', x, y);
      }
    }
  }
  // Rand komplett sperren (auch Wasser am Rand)
  for (let x = 0; x < W; x++) {
    m.blocked[x] = 1;
    m.blocked[(H - 1) * W + x] = 1;
  }
  for (let y = 0; y < H; y++) {
    m.blocked[y * W] = 1;
    m.blocked[y * W + W - 1] = 1;
  }

  // Wald: dicht mit Bäumen
  const tryTree = (x: number, y: number, type: ObjectTypeId, spacing: number) => {
    for (let dy = -spacing; dy <= spacing; dy++) {
      for (let dx = -spacing; dx <= spacing; dx++) if (!free(x + dx, y + dy)) return;
    }
    place(type, x, y);
  };
  for (let i = 0; i < 700; i++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 3 + Math.floor(rand() * (H - 5));
    const t = m.getTerrain(x, y);
    if (t === T.FOREST) tryTree(x, y, rand() < 0.55 ? 'pine' : 'tree', 1);
  }
  // Wiese: lockere Bäume, Büsche, Felsen
  for (let i = 0; i < 260; i++) {
    const x = 3 + Math.floor(rand() * (W - 6));
    const y = 4 + Math.floor(rand() * (H - 7));
    if (m.getTerrain(x, y) !== T.GRASS) continue;
    if (Math.abs(y - pathY(x)) < 3) continue;
    const r = rand();
    if (r < 0.25) tryTree(x, y, rand() < 0.2 ? 'treeLight' : 'tree', 2);
    else if (r < 0.5) tryTree(x, y, rand() < 0.3 ? 'bushBerry' : 'bush', 1);
    else if (r < 0.62) tryTree(x, y, 'rock', 1);
    else if (r < 0.66) tryTree(x, y, 'boulder', 1);
  }
  // Felsen am Seeufer
  for (let i = 0; i < 40; i++) {
    const x = 50 + Math.floor(rand() * 34);
    const y = 4 + Math.floor(rand() * 22);
    if (m.getTerrain(x, y) === T.SAND) tryTree(x, y, rand() < 0.7 ? 'rock' : 'boulder', 1);
  }

  // Dekor
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (m.getDecor(x, y)) continue;
      const t = m.getTerrain(x, y);
      const r = noise(x, y, 9);
      if (t === T.GRASS) {
        if (r < 0.025) m.setDecor(x, y, 'flowersRed');
        else if (r < 0.05) m.setDecor(x, y, 'flowersYellow');
        else if (r < 0.065) m.setDecor(x, y, 'flowersWhite');
        else if (r < 0.08) m.setDecor(x, y, 'flowersBlue');
        else if (r < 0.15) m.setDecor(x, y, 'tuft');
        else if (r < 0.17) m.setDecor(x, y, 'clover');
      } else if (t === T.FOREST) {
        if (r < 0.04) m.setDecor(x, y, 'mushrooms');
        else if (r < 0.14) m.setDecor(x, y, 'tuft');
      } else if (t === T.DIRT) {
        if (r < 0.08) m.setDecor(x, y, 'pebbles');
      } else if (t === T.WATER && isLake(x, y)) {
        let shore = false;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (m.getTerrain(x + dx, y + dy) !== T.WATER) shore = true;
        if (!shore && r < 0.06) m.setDecor(x, y, 'lily');
      } else if (t === T.SAND && r < 0.04) m.setDecor(x, y, 'slab');
    }
  }
  // Monster-Gebiete (Kampftest)
  const zone = (monster: string, tx: number, ty: number, r: number, count: number, respawn = 30) =>
    m.spawns.push({ monster, x: tx * TILE + 8, y: ty * TILE + 8, r, count, respawn });
  zone('wollknaeuel', 24, 50, 56, 3);
  zone('huepfpilz', 40, 52, 64, 4);
  zone('blattschnapper', 58, 47, 50, 2);
  zone('wiesenflitzer', 82, 54, 60, 1, 60);
  zone('kieselkrebs', 63, 58, 40, 3);
  zone('schlammkroete', 76, 30, 44, 2);
  zone('stachelschwalbe', 86, 42, 60, 2);
  zone('tintenkobold', 42, 24, 40, 1, 60);
  zone('zangenkrabbe', 78, 22, 30, 1, 60);

  m.computeSolid();
  return m;
}
