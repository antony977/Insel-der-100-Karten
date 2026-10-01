import { PAL, RAMPS, type Ramp } from '../palette';
import { Raster, rng } from '../Raster';
import { hline, shadedBlobs, shadedRect, stencil, strip, vline, type Circle } from '../draw';

/**
 * Generatoren für Weltobjekte (y-sortierte Sprites): Bäume, Felsen, Häuser, Brunnen …
 * Alle Objekte: 1 px dunkler Umriss, Licht von oben links, Bodenschatten separat gemalt.
 */

function withShadow(body: Raster, sx: number, sy: number, rx: number, ry: number, outline = true): Raster {
  if (outline) body.outline(PAL.ink);
  const out = new Raster(body.w, body.h);
  out.ellipse(sx, sy, rx, ry, PAL.ink, 80);
  out.blit(body, 0, 0);
  return out;
}

const FOLIAGE: Ramp = [PAL.forest, PAL.pine, PAL.leaf, PAL.grass];
const FOLIAGE_LIGHT: Ramp = [PAL.pine, PAL.leaf, PAL.grass, PAL.lime];
const PINE: Ramp = [PAL.deepTeal, PAL.forest, PAL.pine, PAL.leaf];

/** Laubbaum 32×44, Fusspunkt (16, 41). variant: 0 normal, 1 Obstbaum, 2 hell */
export function tree(variant = 0): Raster {
  const b = new Raster(32, 44);
  // Stamm
  shadedRect(b, 13, 27, 6, 14, RAMPS.wood);
  b.set(12, 40, PAL.wood);
  b.set(19, 40, PAL.bark);
  vline(b, 16, 30, 38, PAL.bark);
  b.set(14, 33, PAL.bark);
  const circles: Circle[] = [
    { x: 16, y: 17, r: 12 },
    { x: 7.5, y: 20, r: 6.5 },
    { x: 24.5, y: 20, r: 6.5 },
    { x: 10, y: 10, r: 7 },
    { x: 22, y: 10, r: 7 },
    { x: 16, y: 6.5, r: 6 },
    { x: 16, y: 24, r: 6 },
  ];
  shadedBlobs(b, circles, variant === 2 ? FOLIAGE_LIGHT : FOLIAGE, { leafy: 0.35, seed: 11 + variant, highlight: PAL.lime });
  if (variant === 1) {
    const r = rng(5);
    for (let i = 0; i < 7; i++) {
      const x = 6 + Math.floor(r() * 20);
      const y = 6 + Math.floor(r() * 18);
      if (!b.isEmpty(x, y) && !b.isEmpty(x + 1, y + 1)) {
        b.set(x, y, PAL.red);
        b.set(x + 1, y, PAL.crimson);
        b.set(x, y - 1, PAL.coral);
      }
    }
  }
  return withShadow(b, 16.5, 41, 11, 3.5);
}

/** Nadelbaum 24×44, Fusspunkt (12, 41) */
export function pine(): Raster {
  const b = new Raster(24, 44);
  shadedRect(b, 10, 33, 4, 8, RAMPS.wood);
  const tiers = [
    { top: 2, bottom: 16, half: 6 },
    { top: 9, bottom: 25, half: 9 },
    { top: 17, bottom: 35, half: 11 },
  ];
  const r = rng(3);
  for (const t of tiers) {
    for (let y = t.top; y <= t.bottom; y++) {
      const f = (y - t.top) / (t.bottom - t.top);
      const half = Math.round(1 + f * t.half);
      for (let x = 12 - half; x < 12 + half; x++) {
        const rel = (x - 12) / half;
        let tone = 2;
        if (rel > 0.35 || y >= t.bottom - 1) tone = 1;
        if (rel < -0.45 && f < 0.85) tone = 3;
        if (y === t.bottom && (x + y) % 3 === 0) continue;
        if (r() < 0.06) tone = Math.max(0, tone - 1);
        b.set(x, y, PINE[tone]);
      }
    }
  }
  return withShadow(b, 12.5, 41, 9, 3);
}

/** Busch 20×16, Fusspunkt (10, 14) */
export function bush(berries = false): Raster {
  const b = new Raster(20, 16);
  shadedBlobs(
    b,
    [
      { x: 6, y: 9, r: 5 },
      { x: 14, y: 9, r: 5 },
      { x: 10, y: 6.5, r: 5.5 },
      { x: 10, y: 10, r: 5 },
    ],
    FOLIAGE,
    { leafy: 0.3, seed: berries ? 3 : 9, highlight: PAL.lime },
  );
  if (berries) {
    for (const [x, y] of [[5, 8], [12, 5], [14, 10], [8, 11], [10, 8]]) {
      b.set(x, y, PAL.red);
      b.set(x, y - 1, PAL.coral);
    }
  }
  return withShadow(b, 10.5, 14, 8, 2.5);
}

/** Felsen 16×14 bzw. Felsbrocken 26×20 */
export function rock(big = false): Raster {
  const w = big ? 26 : 16;
  const h = big ? 20 : 14;
  const b = new Raster(w, h);
  const circles: Circle[] = big
    ? [
        { x: 10, y: 11, r: 8 },
        { x: 17, y: 12, r: 7 },
        { x: 13, y: 8, r: 7 },
      ]
    : [
        { x: 7, y: 8, r: 5 },
        { x: 10, y: 9, r: 4.5 },
      ];
  shadedBlobs(b, circles, RAMPS.grey, { seed: 4, bands: [-0.55, -0.1, 0.4], highlight: PAL.silver });
  // Riss
  if (big) {
    b.set(15, 9, PAL.shadow);
    b.set(16, 10, PAL.shadow);
    b.set(16, 11, PAL.shadow);
  } else {
    b.set(9, 7, PAL.shadow);
    b.set(10, 8, PAL.shadow);
  }
  return withShadow(b, w / 2 + 0.5, h - 2, w / 2 - 2, 2.5);
}

/** Baumstumpf 16×12 */
export function stump(): Raster {
  const b = new Raster(16, 12);
  shadedRect(b, 4, 4, 8, 6, RAMPS.wood);
  b.ellipse(8, 4, 4, 2, PAL.tan);
  b.set(8, 4, PAL.wood);
  b.set(7, 4, PAL.skinShade);
  b.set(3, 9, PAL.wood);
  b.set(12, 9, PAL.bark);
  return withShadow(b, 8.5, 10, 6, 2);
}

/** Holzschild 16×18, Fusspunkt (8, 16) */
export function sign(): Raster {
  const b = new Raster(16, 18);
  shadedRect(b, 7, 9, 2, 8, RAMPS.wood);
  shadedRect(b, 2, 2, 12, 8, [PAL.bark, PAL.wood, PAL.tan, PAL.skinShade]);
  hline(b, 4, 11, 4, PAL.wood);
  hline(b, 4, 9, 6, PAL.wood);
  return withShadow(b, 8.5, 16, 4, 1.5);
}

/** Zaunstück horizontal 16×16 (Fusspunkt unten) */
export function fence(): Raster {
  const b = new Raster(16, 16);
  shadedRect(b, 0, 6, 16, 2, RAMPS.wood);
  shadedRect(b, 0, 10, 16, 2, RAMPS.wood);
  shadedRect(b, 1, 4, 3, 11, RAMPS.wood);
  shadedRect(b, 12, 4, 3, 11, RAMPS.wood);
  b.set(2, 4, PAL.skinShade);
  b.set(13, 4, PAL.skinShade);
  return withShadow(b, 8, 14.5, 7, 1.5);
}

/** Laterne 12×32, Fusspunkt (6, 30) */
export function lamp(): Raster {
  const b = new Raster(12, 32);
  shadedRect(b, 5, 10, 2, 20, RAMPS.dark);
  shadedRect(b, 3, 28, 6, 2, RAMPS.dark);
  // Gehäuse
  shadedRect(b, 2, 2, 8, 2, RAMPS.dark);
  shadedRect(b, 3, 4, 6, 6, [PAL.orange, PAL.gold, PAL.cream, PAL.white]);
  vline(b, 3, 4, 9, PAL.night);
  vline(b, 8, 4, 9, PAL.night);
  b.set(5, 1, PAL.night);
  b.set(6, 1, PAL.night);
  return withShadow(b, 6.5, 30, 4, 1.5);
}

/** Brunnen 28×30, Fusspunkt (14, 28) */
export function well(): Raster {
  const b = new Raster(28, 30);
  // Pfosten
  shadedRect(b, 4, 6, 3, 16, RAMPS.wood);
  shadedRect(b, 21, 6, 3, 16, RAMPS.wood);
  // Dach
  for (let y = 0; y < 7; y++) {
    const half = 6 + y * 1.4;
    for (let x = Math.round(14 - half); x < Math.round(14 + half); x++) {
      const tone = y === 6 ? 1 : (x + y) % 4 === 0 ? 1 : x < 14 - half / 2 ? 3 : 2;
      b.set(x, y, RAMPS.red[tone]);
    }
  }
  // Steinring
  for (let y = 16; y < 28; y++) {
    for (let x = 3; x < 25; x++) {
      const brick = ((Math.floor((x + (Math.floor((y - 16) / 3) % 2) * 3) / 6) + Math.floor((y - 16) / 3)) % 3);
      let c: number = brick === 0 ? PAL.silver : PAL.mist;
      if ((y - 16) % 3 === 2) c = PAL.stone;
      if (x === 24 || y === 27) c = PAL.stone;
      b.set(x, y, c);
    }
  }
  b.ellipse(14, 17, 11, 3, PAL.stone);
  b.ellipse(14, 17, 9, 2, PAL.navy);
  hline(b, 9, 13, 16, PAL.blue);
  // Seil + Eimer
  vline(b, 14, 6, 12, PAL.tan);
  shadedRect(b, 12, 12, 5, 4, RAMPS.wood);
  return withShadow(b, 14.5, 27.5, 12, 2.5);
}

/** Lagerfeuer 16×18, Fusspunkt (8, 15), 4 Frames */
export function campfire(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 4; f++) {
    const b = new Raster(16, 18);
    // Steine
    for (const [x, y] of [[2, 14], [5, 15], [9, 15], [12, 14], [3, 12], [12, 12]]) {
      b.set(x, y, PAL.mist);
      b.set(x + 1, y, PAL.stone);
      b.set(x, y - 1, PAL.silver);
    }
    // Holzscheite
    shadedRect(b, 4, 12, 8, 2, RAMPS.wood);
    shadedRect(b, 6, 11, 4, 2, [PAL.bark, PAL.wood, PAL.rust, PAL.orange]);
    // Flammen
    const r = rng(100 + f);
    const heights = [5, 8, 10, 8, 5].map((h) => h + Math.floor(r() * 3) - 1);
    heights.forEach((h, i) => {
      const x = 5 + i;
      for (let y = 0; y < h; y++) {
        const py = 11 - y;
        const t = y / h;
        const c = t < 0.35 ? PAL.cream : t < 0.6 ? PAL.gold : t < 0.85 ? PAL.orange : PAL.red;
        b.set(x + (y > h * 0.7 && f % 2 ? 1 : 0), py, c);
      }
    });
    // Funken
    b.set(4 + ((f * 3) % 8), 1 + (f % 2), PAL.gold);
    b.outline(PAL.ink);
    frames.push(b);
  }
  return strip(frames);
}

/** Fass 12×16 */
export function barrel(): Raster {
  const b = new Raster(12, 16);
  for (let y = 2; y < 15; y++) {
    const bulge = y > 4 && y < 12 ? 0 : 1;
    for (let x = 1 + bulge; x < 11 - bulge; x++) {
      let tone = x < 4 ? 3 : x > 8 ? 1 : 2;
      if (y === 5 || y === 11) tone = 0;
      b.set(x, y, RAMPS.wood[tone]);
    }
  }
  b.ellipse(6, 3, 4, 1.5, PAL.tan);
  return withShadow(b, 6.5, 14.5, 5, 1.5);
}

/** Kiste 14×14 */
export function crate(): Raster {
  const b = new Raster(14, 14);
  shadedRect(b, 1, 2, 12, 11, RAMPS.wood);
  hline(b, 2, 11, 7, PAL.wood);
  vline(b, 6, 3, 11, PAL.wood);
  b.set(2, 3, PAL.skinShade);
  return withShadow(b, 7.5, 13, 6, 1.5);
}

/** Haus 64×62, Fusspunkt (32, 60). Fachwerk mit rotem Ziegeldach. */
export function house(roof: Ramp = RAMPS.red, wall: Ramp = [PAL.mist, PAL.silver, PAL.white, PAL.white]): Raster {
  const b = new Raster(64, 62);
  const wallTop = 32;
  const wallBottom = 59;
  // Wand
  for (let y = wallTop; y <= wallBottom; y++) {
    for (let x = 5; x <= 58; x++) {
      let c: number = wall[2];
      if (x === 58 || y === wallBottom) c = wall[1];
      if (x === 5) c = wall[3];
      b.set(x, y, c);
    }
  }
  // Fachwerkbalken
  for (const x of [5, 6, 31, 32, 57, 58]) vline(b, x, wallTop, wallBottom, x % 2 ? PAL.wood : PAL.bark);
  hline(b, 5, 58, wallTop, PAL.wood);
  hline(b, 5, 58, wallTop + 1, PAL.bark);
  // Sockel
  for (let y = 55; y <= wallBottom; y++) {
    for (let x = 5; x <= 58; x++) {
      const brick = (Math.floor((x + (y % 2) * 3) / 5) + y) % 2;
      b.set(x, y, y === wallBottom ? PAL.stone : brick ? PAL.mist : PAL.silver);
    }
  }
  // Fenster
  for (const wx of [11, 43]) {
    shadedRect(b, wx, 38, 10, 10, RAMPS.wood);
    for (let y = 39; y < 47; y++) for (let x = wx + 1; x < wx + 9; x++) b.set(x, y, y < 42 ? PAL.skyLight : PAL.sky);
    vline(b, wx + 5, 39, 46, PAL.wood);
    hline(b, wx + 1, wx + 8, 42, PAL.wood);
    b.set(wx + 2, 40, PAL.white);
    shadedRect(b, wx - 1, 48, 12, 2, RAMPS.wood);
    // Blumenkasten
    for (let i = 0; i < 4; i++) b.set(wx + 1 + i * 2 + 1, 47, i % 2 ? PAL.red : PAL.gold);
  }
  // Tür
  shadedRect(b, 26, 42, 12, 18, [PAL.bark, PAL.wood, PAL.tan, PAL.skinShade]);
  for (let y = 43; y < 59; y++) for (let x = 27; x < 37; x++) b.set(x, y, (x - 27) % 3 === 2 ? PAL.wood : PAL.tan);
  b.ellipse(32, 43, 6, 2, PAL.bark);
  b.set(35, 51, PAL.gold);
  b.set(35, 50, PAL.cream);
  // Dach (Ziegel in versetzten Reihen)
  for (let y = 4; y < wallTop + 2; y++) {
    const inset = Math.max(0, Math.round((wallTop - y) * 0.25));
    for (let x = 1 + inset; x <= 62 - inset; x++) {
      const row = Math.floor((y - 4) / 4);
      const off = row % 2 ? 3 : 0;
      const inTile = (x + off) % 6;
      let tone = 2;
      if ((y - 4) % 4 === 3) tone = 1;
      else if (inTile === 0) tone = 1;
      else if ((y - 4) % 4 === 0 && inTile < 4) tone = 3;
      if (x - inset < 4) tone = Math.min(3, tone + 1);
      if (x > 58 - inset) tone = Math.max(0, tone - 1);
      if (y >= wallTop) tone = 0;
      b.set(x, y, roof[tone]);
    }
  }
  // Dachfirst
  hline(b, 9, 54, 4, roof[0]);
  hline(b, 9, 54, 5, roof[1]);
  // Schornstein
  shadedRect(b, 44, 0, 7, 9, RAMPS.grey);
  hline(b, 43, 51, 0, PAL.stone);
  return withShadow(b, 32, 60, 28, 2);
}

/** Dekor-Kacheln (16×16), flach unter Figuren. Reihenfolge = Index im Tileset. */
export const DECOR_NAMES = [
  'flowersRed',
  'flowersYellow',
  'flowersWhite',
  'flowersBlue',
  'tuft',
  'pebbles',
  'mushrooms',
  'bridgeH',
  'bridgeV',
  'lily',
  'clover',
  'slab',
] as const;
export type DecorName = (typeof DECOR_NAMES)[number];

function flowers(petal: number, petalShade: number, seed: number): Raster {
  const t = new Raster(16, 16);
  const r = rng(seed);
  const spots: [number, number][] = [];
  for (let i = 0; i < 3; i++) spots.push([2 + Math.floor(r() * 10), 3 + Math.floor(r() * 9)]);
  for (const [x, y] of spots) {
    // Stiel
    t.set(x + 1, y + 3, PAL.leaf);
    t.set(x + 2, y + 3, PAL.pine);
    // Blüte
    t.set(x + 1, y, petal);
    t.set(x, y + 1, petal);
    t.set(x + 2, y + 1, petalShade);
    t.set(x + 1, y + 2, petalShade);
    t.set(x + 1, y + 1, PAL.gold);
  }
  t.outline(PAL.pine);
  return t;
}

export function decorTile(name: DecorName): Raster {
  const t = new Raster(16, 16);
  switch (name) {
    case 'flowersRed':
      return flowers(PAL.red, PAL.crimson, 1);
    case 'flowersYellow':
      return flowers(PAL.gold, PAL.orange, 2);
    case 'flowersWhite':
      return flowers(PAL.white, PAL.silver, 3);
    case 'flowersBlue':
      return flowers(PAL.skyLight, PAL.sky, 4);
    case 'tuft': {
      stencil(t, 3, 6, ['.#..#..#..', '.#.##.##.#', '##.#.##.##', '#.##.#..#.', '..........'], { '#': PAL.leaf });
      stencil(t, 3, 6, ['.l..l..l..'], { l: PAL.lime });
      t.outline(PAL.pine);
      return t;
    }
    case 'pebbles':
      for (const [x, y] of [[3, 4], [10, 7], [6, 11], [12, 12]]) {
        t.set(x, y, PAL.silver);
        t.set(x + 1, y, PAL.mist);
        t.set(x, y + 1, PAL.mist);
        t.set(x + 1, y + 1, PAL.stone);
      }
      t.outline(PAL.shadow);
      return t;
    case 'mushrooms':
      for (const [x, y] of [[4, 6], [9, 9]]) {
        stencil(t, x, y, ['.rrr.', 'rwrrr', '..s..', '..s..'], { r: PAL.red, w: PAL.white, s: PAL.sandLight });
      }
      t.outline(PAL.ink);
      return t;
    case 'bridgeH':
      for (let x = 0; x < 16; x++) {
        for (let y = 1; y < 15; y++) {
          const plank = x % 4;
          let c: number = plank === 3 ? PAL.wood : plank === 0 ? PAL.skinShade : PAL.tan;
          if (y === 1 || y === 14) c = PAL.bark;
          if (y === 2) c = PAL.wood;
          t.set(x, y, c);
        }
      }
      return t;
    case 'bridgeV':
      for (let y = 0; y < 16; y++) {
        for (let x = 1; x < 15; x++) {
          const plank = y % 4;
          let c: number = plank === 3 ? PAL.wood : plank === 0 ? PAL.skinShade : PAL.tan;
          if (x === 1 || x === 14) c = PAL.bark;
          if (x === 2) c = PAL.wood;
          t.set(x, y, c);
        }
      }
      return t;
    case 'lily':
      t.ellipse(8, 8, 5, 3.5, PAL.leaf);
      t.ellipse(7, 7, 3, 2, PAL.grass);
      t.set(8, 8, PAL.forest);
      t.set(9, 8, PAL.forest);
      t.set(10, 6, PAL.pink);
      t.set(11, 6, PAL.magenta);
      t.outline(PAL.pine);
      return t;
    case 'clover':
      for (const [x, y] of [[4, 5], [10, 10], [11, 4]]) {
        stencil(t, x, y, ['.g.', 'gGg', '.g.'], { g: PAL.leaf, G: PAL.lime });
      }
      return t;
    case 'slab':
      t.ellipse(8, 8, 6, 4.5, PAL.mist);
      t.ellipse(7, 7, 4, 3, PAL.silver);
      t.outline(PAL.stone);
      return t;
  }
}

export function decorTileset(): Raster {
  const cols = 8;
  const rows = Math.ceil(DECOR_NAMES.length / cols);
  const out = new Raster(cols * 16, rows * 16);
  DECOR_NAMES.forEach((n, i) => out.blit(decorTile(n), (i % cols) * 16, Math.floor(i / cols) * 16));
  return out;
}
