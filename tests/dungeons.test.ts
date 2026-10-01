import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../src/data/maps/dungeons';
import { buildAsciiMap } from '../src/world/asciiMap';
import { TILE } from '../src/config';

/** Hinter diesen Toren darf etwas unerreichbar sein */
const BEHIND_GATES = new Set(['boss:nebelmutter', 'boss:leser']);

describe('Dungeons', () => {
  for (const [id, def] of Object.entries(DUNGEONS)) {
    it(`${id}: Ausgang, Truhen und Fundstellen sind erreichbar`, () => {
      const m = buildAsciiMap(def);
      const W = m.w;
      const seen = new Uint8Array(W * m.h);
      const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < m.h && !m.boxBlocked(x * TILE + 3, y * TILE + 8, 10, 6);
      const sx = Math.floor(m.spawnX / TILE);
      const sy = Math.floor(m.spawnY / TILE);
      expect(free(sx, sy)).toBe(true);
      const q: number[] = [sy * W + sx];
      seen[sy * W + sx] = 1;
      while (q.length) {
        const c = q.pop()!;
        const x = c % W;
        const y = Math.floor(c / W);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (!free(nx, ny) || seen[ny * W + nx]) continue;
          seen[ny * W + nx] = 1;
          q.push(ny * W + nx);
        }
      }
      for (const o of m.objects) {
        if (o.tag && BEHIND_GATES.has(o.tag)) {
          // hinter dem Tor: ohne Öffnen nicht erreichbar
          expect(seen[Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE)], `${id}: ${o.tag} sollte gesperrt sein`).toBe(0);
          continue;
        }
        if (!o.tag) continue;
        const tx = Math.floor(o.x / TILE);
        const ty = Math.floor(o.y / TILE);
        let ok = false;
        for (let dy = -2; dy <= 2 && !ok; dy++) for (let dx = -2; dx <= 2 && !ok; dx++) if (seen[(ty + dy) * W + tx + dx]) ok = true;
        expect(ok, `${id}: ${o.tag} bei ${tx},${ty}`).toBe(true);
      }
    });
  }
});
