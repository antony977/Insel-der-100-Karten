import { describe, expect, it } from 'vitest';
import { buildIsland } from '../src/world/islandBuilder';
import { TOWNS } from '../src/data/world/layout';
import { TILE } from '../src/config';
import type { WorldMap } from '../src/world/WorldMap';

/** Erreichbarkeit per Breitensuche über begehbare Zellen (Objekt-Kollision inklusive) */
function reachable(m: WorldMap, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(m.w * m.h);
  const q: number[] = [];
  const start = Math.floor(sy / TILE) * m.w + Math.floor(sx / TILE);
  seen[start] = 1;
  q.push(start);
  const free = (x: number, y: number) => !m.boxBlocked(x * TILE + 3, y * TILE + 9, 10, 6);
  while (q.length) {
    const i = q.pop()!;
    const x = i % m.w;
    const y = (i - x) / m.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const j = ny * m.w + nx;
      if (seen[j] || !free(nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

describe('Insel', () => {
  const { map, meta } = buildIsland();

  it('ist deterministisch', () => {
    const b = buildIsland();
    expect(b.map.objects.length).toBe(map.objects.length);
    expect(b.map.terrain.every((t, i) => t === map.terrain[i])).toBe(true);
  });

  it('alle Städte sind zu Fuss vom Startpunkt erreichbar', () => {
    const seen = reachable(map, map.spawnX, map.spawnY);
    for (const t of TOWNS) {
      // irgendeine Kachel nahe dem Zentrum erreichbar
      let ok = false;
      for (let dy = -3; dy <= 3 && !ok; dy++) for (let dx = -3; dx <= 3 && !ok; dx++) if (seen[(t.y + dy) * map.w + t.x + dx]) ok = true;
      expect(ok, t.name).toBe(true);
    }
  });

  it('Spawn-Zonen liegen auf begehbarem Land', () => {
    expect(map.spawns.length).toBeGreaterThan(80);
    for (const z of map.spawns) expect(map.isSolidCell(Math.floor(z.x / TILE), Math.floor(z.y / TILE))).toBe(false);
  });

  it('Städte haben ihre Gebäude mit Türen', () => {
    const doors = map.objects.filter((o) => o.def.interact === 'door' && o.tag);
    expect(doors.length).toBeGreaterThan(30);
    expect(Object.keys(meta.towns).length).toBe(TOWNS.length);
  });
});
