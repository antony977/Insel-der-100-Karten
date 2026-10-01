/**
 * Logik des Lichträtsels (ohne Grafik, damit sie testbar ist).
 * S = Lichtquelle (strahlt nach rechts), Z = Kristall, # = Säule, m = drehbarer Spiegel.
 */
export const MIRROR_LEVELS: string[][] = [
  ['S..m....', '........', '........', '...m...Z', '........'],
  ['..m..m..', '...#....', 'S.m..#..', '........', '..m....Z'],
  ['S...m...', '#.......', '.m..m.m#', '....#...', '.m.....Z'],
];

/** Strahlverlauf; `mirror` liefert true für „\" und false für „/" */
export function traceBeam(grid: string[][], mirror: (x: number, y: number) => boolean): { pts: [number, number][]; hit: boolean } {
  let sx = 0;
  let sy = 0;
  grid.forEach((row, y) => row.forEach((c, x) => c === 'S' && ((sx = x), (sy = y))));
  let x = sx;
  let y = sy;
  let dx = 1;
  let dy = 0;
  const pts: [number, number][] = [[x, y]];
  for (let step = 0; step < 80; step++) {
    x += dx;
    y += dy;
    const c = grid[y]?.[x];
    if (c === undefined || c === '#') {
      pts.push([x - dx * 0.5, y - dy * 0.5]);
      return { pts, hit: false };
    }
    if (c === 'Z') {
      pts.push([x, y]);
      return { pts, hit: true };
    }
    if (c === 'm') {
      pts.push([x, y]);
      if (mirror(x, y)) [dx, dy] = [dy, dx];
      else [dx, dy] = [-dy, -dx];
    }
  }
  return { pts, hit: false };
}

/** Startstellung (absichtlich nicht gelöst) */
export function startMirror(level: number, x: number, y: number): boolean {
  return (x + y + level) % 2 === 0;
}
