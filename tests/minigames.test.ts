import { describe, expect, it } from 'vitest';
import { MIRROR_LEVELS, startMirror, traceBeam } from '../src/systems/mirrorPuzzle';

describe('Spiegelsaal', () => {
  MIRROR_LEVELS.forEach((rows, level) => {
    it(`Rätsel ${level + 1} ist lösbar und startet ungelöst`, () => {
      const grid = rows.map((r) => r.split(''));
      const mirrors: [number, number][] = [];
      grid.forEach((row, y) => row.forEach((c, x) => c === 'm' && mirrors.push([x, y])));
      const start = traceBeam(grid, (x, y) => startMirror(level, x, y));
      expect(start.hit).toBe(false);
      let solvable = false;
      for (let mask = 0; mask < 1 << mirrors.length && !solvable; mask++) {
        const state = new Map(mirrors.map(([x, y], i) => [`${x},${y}`, !!(mask & (1 << i))]));
        if (traceBeam(grid, (x, y) => !!state.get(`${x},${y}`)).hit) solvable = true;
      }
      expect(solvable).toBe(true);
    });
  });
});
