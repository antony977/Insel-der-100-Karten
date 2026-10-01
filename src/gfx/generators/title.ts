import { PAL } from '../palette';
import { Raster, rng } from '../Raster';
import { shadedBlobs } from '../draw';

/** Himmel mit Farbverlauf (gedithert), Meer und Sternen – 480×270. */
export function titleBackground(): Raster {
  const W = 480;
  const H = 270;
  const r = new Raster(W, H);
  const bands = [PAL.navy, PAL.plum, PAL.purple, PAL.berry, PAL.magenta, PAL.coral, PAL.orange, PAL.gold];
  const horizon = 176;
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  for (let y = 0; y < horizon; y++) {
    const t = Math.pow(y / horizon, 1.6) * (bands.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    for (let x = 0; x < W; x++) {
      const threshold = (bayer[y & 3][x & 3] + 0.5) / 16;
      r.set(x, y, f > threshold ? bands[Math.min(bands.length - 1, i + 1)] : bands[i]);
    }
  }
  // Sterne
  const rand = rng(21);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * 90);
    r.set(x, y, rand() < 0.3 ? PAL.cream : PAL.silver);
  }
  // Meer
  for (let y = horizon; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = (y - horizon) / (H - horizon);
      r.set(x, y, d < 0.15 ? PAL.sky : d < 0.45 ? PAL.blue : PAL.navy);
    }
  }
  // Sonnenreflexion auf dem Wasser
  for (let y = horizon + 2; y < H; y += 3) {
    const half = Math.max(2, 26 - (y - horizon) * 0.35);
    const off = Math.floor(rand() * 8) - 4;
    for (let x = Math.round(240 - half + off); x < 240 + half + off; x += 2) r.set(x, y, (x + y) % 4 ? PAL.gold : PAL.cream);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rand() * W);
    const y = horizon + 4 + Math.floor(rand() * (H - horizon - 4));
    r.set(x, y, PAL.skyLight);
    r.set(x + 1, y, PAL.skyLight);
  }
  return r;
}

/** Insel-Silhouette mit Bäumen und Tor, 220×70 */
export function titleIsland(): Raster {
  const r = new Raster(220, 70);
  // Hügel
  shadedBlobs(
    r,
    [
      { x: 110, y: 80, r: 62 },
      { x: 60, y: 72, r: 34 },
      { x: 160, y: 74, r: 36 },
    ],
    [PAL.forest, PAL.pine, PAL.leaf, PAL.grass],
    { leafy: 0.25, seed: 5 },
  );
  // Bäume
  const trees = [30, 48, 70, 150, 170, 188, 92, 128];
  trees.forEach((tx, i) => {
    const base = 54 - Math.round(Math.sin((tx / 220) * Math.PI) * 30) + (i % 2) * 3;
    shadedBlobs(r, [{ x: tx, y: base - 6, r: 7 }, { x: tx + 3, y: base - 11, r: 5 }], [PAL.forest, PAL.pine, PAL.leaf, PAL.grass], {
      leafy: 0.3,
      seed: i,
    });
  });
  // Tor auf dem Gipfel
  for (let y = 4; y < 20; y++) {
    r.set(104, y, PAL.mist);
    r.set(105, y, PAL.silver);
    r.set(115, y, PAL.mist);
    r.set(116, y, PAL.stone);
  }
  for (let x = 102; x < 119; x++) {
    r.set(x, 3, PAL.silver);
    r.set(x, 4, PAL.mist);
  }
  for (let y = 5; y < 20; y++) for (let x = 106; x < 115; x++) r.set(x, y, (x + y) % 2 ? PAL.cyan : PAL.ice, 200);
  // Sandstrand
  for (let x = 0; x < 220; x++) {
    for (let y = 64; y < 70; y++) if (!r.isEmpty(x, y - 2)) r.set(x, y, y < 67 ? PAL.sand : PAL.sandShade);
  }
  r.outline(PAL.ink);
  return r;
}

/** Kleine Sammelkarte 14×19 (fliegt im Titelbild) */
export function miniCard(rank: number): Raster {
  const r = new Raster(14, 19);
  const border = [PAL.gold, PAL.red, PAL.violet, PAL.sky, PAL.grass][rank % 5];
  for (let y = 1; y < 18; y++) {
    for (let x = 1; x < 13; x++) {
      const edge = x < 3 || x > 10 || y < 3 || y > 15;
      r.set(x, y, edge ? border : PAL.white);
    }
  }
  // Symbol
  for (const [x, y] of [[6, 7], [7, 7], [5, 8], [6, 8], [7, 8], [8, 8], [6, 9], [7, 9], [6, 10], [7, 10], [5, 9], [8, 9]]) {
    r.set(x, y, border);
  }
  r.set(4, 4, PAL.white);
  r.outline(PAL.ink);
  // Ecken abrunden
  r.clear(0, 0);
  r.clear(13, 0);
  r.clear(0, 18);
  r.clear(13, 18);
  return r;
}

export function miniCards(): Raster {
  const out = new Raster(14 * 5, 19);
  for (let i = 0; i < 5; i++) out.blit(miniCard(i), i * 14, 0);
  return out;
}
