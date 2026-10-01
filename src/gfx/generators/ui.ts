import { PAL, RAMPS, type Ramp } from '../palette';
import { Raster } from '../Raster';
import { renderTextRaster } from '../font/PixelFont';
import { stencil } from '../draw';

/** Abgerundetes Rechteck: liegt (x, y) innerhalb, mit Einzug `inset` und Eckradius `rad`? */
function inRoundRect(x: number, y: number, w: number, h: number, inset: number, rad: number): boolean {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - 1 - inset;
  const y1 = h - 1 - inset;
  if (x < x0 || y < y0 || x > x1 || y > y1) return false;
  const r = Math.max(0, rad - inset);
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r + r * 0.8;
}

export interface FrameStyle {
  light: number;
  mid: number;
  dark: number;
  fill: number;
  fillAlpha: number;
  inner: number;
}

export const FRAME_STYLES: Record<string, FrameStyle> = {
  'ui-frame': { light: PAL.white, mid: PAL.silver, dark: PAL.mist, fill: PAL.night, fillAlpha: 250, inner: PAL.ink },
  'ui-frame-gold': { light: PAL.cream, mid: PAL.gold, dark: PAL.orange, fill: PAL.plum, fillAlpha: 245, inner: PAL.wine },
  'ui-frame-paper': { light: PAL.tan, mid: PAL.wood, dark: PAL.bark, fill: PAL.sandLight, fillAlpha: 255, inner: PAL.sandShade },
  'ui-frame-select': { light: PAL.cream, mid: PAL.gold, dark: PAL.orange, fill: PAL.purple, fillAlpha: 200, inner: PAL.plum },
};

/** Dicker, abgerundeter Pixelrahmen 24×24 (NineSlice mit 8-px-Ecken). */
export function frame(style: FrameStyle): Raster {
  const S = 24;
  const R = 6;
  const r = new Raster(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inRoundRect(x, y, S, S, 0, R)) continue;
      if (!inRoundRect(x, y, S, S, 1, R)) {
        r.set(x, y, PAL.ink);
      } else if (!inRoundRect(x, y, S, S, 3, R)) {
        // 2 px Rand: oben/links hell, unten/rechts dunkel
        const tl = x + y < S;
        r.set(x, y, tl ? (x < 3 || y < 3 ? style.light : style.mid) : style.dark);
      } else if (!inRoundRect(x, y, S, S, 4, R)) {
        r.set(x, y, style.inner);
      } else {
        r.set(x, y, style.fill, style.fillAlpha);
      }
    }
  }
  return r;
}

/** Menü-Zeiger ▶ 9×9, 2 Frames */
export function menuCursor(): Raster {
  const out = new Raster(18, 9);
  const rows = ['#.....', '##....', '#o#...', '#oo#..', '#ooo#.', '#oo#..', '#o#...', '##....', '#.....'];
  for (let f = 0; f < 2; f++) {
    stencil(out, f * 9 + 1 + f, 0, rows, { '#': PAL.ink, o: PAL.gold });
    out.set(f * 9 + 2 + f, 2, PAL.cream);
  }
  return out;
}

/** HUD-Symbole 9×9: 0 Herz, 1 Aura, 2 Münze, 3 Karte, 4 Buch, 5 Stern */
export function hudIcons(): Raster {
  const icons: [string[], Record<string, number>][] = [
    [
      ['.##.##...', '#rr#rr#..', '#rRrrr#..', '#rrrrr#..', '.#rrr#...', '..#r#....', '...#.....', '.........', '.........'],
      { '#': PAL.ink, r: PAL.red, R: PAL.coral },
    ],
    [
      ['...#.....', '..#c#....', '.#cCc#...', '#ccCcc#..', '#cciCc#..', '#ccccc#..', '.#ccc#...', '..###....', '.........'],
      { '#': PAL.ink, c: PAL.cyan, C: PAL.ice, i: PAL.white },
    ],
    [
      ['..###....', '.#ggg#...', '#gGyyg#..', '#gyggg#..', '#gyggo#..', '#ggggo#..', '.#ooo#...', '..###....', '.........'],
      { '#': PAL.ink, g: PAL.gold, G: PAL.cream, y: PAL.cream, o: PAL.orange },
    ],
    [
      ['#####....', '#wwW#....', '#wgw#....', '#ggg#....', '#wgw#....', '#www#....', '#####....', '.........', '.........'],
      { '#': PAL.ink, w: PAL.white, W: PAL.white, g: PAL.gold },
    ],
    [
      ['.#######.', '#bbbbbbb#', '#bwwwbbb#', '#bbbbbbb#', '#bwwbbbb#', '#bbbbbbb#', '#bbbbbbb#', '#ccccccc#', '.#######.'],
      { '#': PAL.ink, b: PAL.wood, w: PAL.gold, c: PAL.white },
    ],
    [
      ['....#....', '...#y#...', '#.#yyy#.#', '#yyyYyyy#', '.#yyyyy#.', '..#yyy#..', '.#yy#yy#.', '#y#...#y#', '#.......#'],
      { '#': PAL.ink, y: PAL.gold, Y: PAL.cream },
    ],
  ];
  const out = new Raster(9 * icons.length, 9);
  icons.forEach(([rows, colors], i) => stencil(out, i * 9, 0, rows, colors));
  return out;
}

/** Runder Touch-Button (Pixel-Art), Kreis mit Umriss und Beschriftung/Symbol. */
export function roundButton(size: number, ramp: Ramp, label?: string, icon?: string[], iconColors?: Record<string, number>): Raster {
  const r = new Raster(size, size);
  const c = size / 2;
  const rad = size / 2 - 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > rad) continue;
      if (d > rad - 1.2) {
        r.set(x, y, PAL.ink);
        continue;
      }
      const l = -(dx + dy) / size;
      let tone = 2;
      if (d > rad - 2.5) tone = l > 0 ? 3 : 1;
      else if (l > 0.25) tone = 3;
      else if (l < -0.28) tone = 1;
      r.set(x, y, ramp[tone]);
    }
  }
  if (label) {
    const t = renderTextRaster(label, PAL.white, 'outline');
    r.blit(t, Math.round(c - t.w / 2), Math.round(c - t.h / 2) + 1);
  }
  if (icon && iconColors) {
    const iw = icon[0].length;
    const ih = icon.length;
    stencil(r, Math.round(c - iw / 2), Math.round(c - ih / 2), icon, iconColors);
  }
  return r;
}

/** Karten-förmiger Schnellzauber-Slot mit Nummer */
export function spellSlotButton(n: number): Raster {
  const W = 22;
  const H = 26;
  const r = new Raster(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inRoundRect(x, y, W, H, 0, 4)) continue;
      if (!inRoundRect(x, y, W, H, 1, 4)) r.set(x, y, PAL.ink);
      else if (!inRoundRect(x, y, W, H, 2, 4)) r.set(x, y, x + y < W ? PAL.ice : PAL.teal);
      else r.set(x, y, PAL.deepTeal, 230);
    }
  }
  const t = renderTextRaster(String(n), PAL.ice, 'outline');
  r.blit(t, Math.round(W / 2 - t.w / 2), Math.round(H / 2 - t.h / 2) + 1);
  return r;
}

export const ICON_FLAME = [
  '...#...',
  '..#w#..',
  '.#wcw#.',
  '#wcccw#',
  '#cciCc#',
  '#ccCcc#',
  '.#ccc#.',
  '..###..',
];
export const ICON_BOOK = [
  '.########.',
  '#rrrrrrrr#',
  '#rrggggrr#',
  '#rrgwwgrr#',
  '#rrgwwgrr#',
  '#rrggggrr#',
  '#rrrrrrrr#',
  '#cccccccc#',
  '.########.',
];
export const ICON_PAUSE = ['##.##', '##.##', '##.##', '##.##', '##.##'];
export const ICON_MAP = [
  '#########',
  '#cgggbbc#',
  '#cggbbbc#',
  '#cgbbrbc#',
  '#cbbrrrc#',
  '#cbbbrbc#',
  '#########',
];

export function touchButtons(): Record<string, Raster> {
  return {
    a: roundButton(26, RAMPS.red, 'A'),
    b: roundButton(22, RAMPS.gold, 'B'),
    aura: roundButton(20, RAMPS.violet, undefined, ICON_FLAME, { '#': PAL.ink, w: PAL.white, c: PAL.ice, C: PAL.cyan, i: PAL.white }),
    book: roundButton(20, RAMPS.wood, undefined, ICON_BOOK, { '#': PAL.ink, r: PAL.crimson, g: PAL.gold, w: PAL.cream, c: PAL.white }),
    pause: roundButton(16, RAMPS.grey, undefined, ICON_PAUSE, { '#': PAL.white }),
    map: roundButton(16, RAMPS.grey, undefined, ICON_MAP, { '#': PAL.ink, g: PAL.grass, b: PAL.sky, r: PAL.red, c: PAL.sandLight }),
    spell1: spellSlotButton(1),
    spell2: spellSlotButton(2),
    spell3: spellSlotButton(3),
  };
}

/** Joystick-Basis (Ring) und Knauf */
export function joystickBase(): Raster {
  const S = 40;
  const r = new Raster(S, S);
  const c = S / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > 19.5) continue;
      if (d > 18.3) r.set(x, y, PAL.ink, 220);
      else if (d > 16.5) r.set(x, y, PAL.silver, 200);
      else if (d > 15.5) r.set(x, y, PAL.ink, 120);
      else r.set(x, y, PAL.night, 90);
    }
  }
  return r;
}

export function joystickKnob(): Raster {
  return roundButton(18, RAMPS.silver);
}

/** Mauszeiger (Pfeil) 12×14 */
export function mouseCursor(): Raster {
  const rows = [
    '#...........',
    '##..........',
    '#w#.........',
    '#ww#........',
    '#www#.......',
    '#wwww#......',
    '#wwwww#.....',
    '#wwwwww#....',
    '#wwwwwww#...',
    '#wwww####...',
    '#ww#w#......',
    '#w#.#w#.....',
    '##..#w#.....',
    '.....##.....',
  ];
  const r = new Raster(12, 14);
  stencil(r, 0, 0, rows, { '#': PAL.ink, w: PAL.white });
  r.set(1, 2, PAL.gold);
  r.set(1, 3, PAL.gold);
  return r;
}

/** Fadenkreuz für das Zielen im Spiel 11×11 */
export function crosshair(): Raster {
  const rows = [
    '....###....',
    '....#w#....',
    '....#w#....',
    '....###....',
    '###.....###',
    '#ww..#..ww#',
    '###.....###',
    '....###....',
    '....#w#....',
    '....#w#....',
    '....###....',
  ];
  const r = new Raster(11, 11);
  stencil(r, 0, 0, rows, { '#': PAL.ink, w: PAL.white });
  return r;
}

/** Telefon-Symbol für den Dreh-Hinweis 20×32 */
export function phoneIcon(): Raster {
  const r = new Raster(20, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 20; x++) {
      if (!inRoundRect(x, y, 20, 32, 0, 4)) continue;
      if (!inRoundRect(x, y, 20, 32, 1, 4)) r.set(x, y, PAL.silver);
      else if (!inRoundRect(x, y, 20, 32, 2, 4)) r.set(x, y, PAL.mist);
      else if (y > 4 && y < 26 && x > 2 && x < 17) r.set(x, y, y < 12 ? PAL.sky : y < 18 ? PAL.grass : PAL.leaf);
      else r.set(x, y, PAL.night);
    }
  }
  r.set(9, 28, PAL.silver);
  r.set(10, 28, PAL.silver);
  return r;
}

/** Fähigkeitskarte (Level-Up) 92×124, 4 Frames: rot, grün, blau, gold */
export const ABILITY_W = 92;
export const ABILITY_H = 124;

export function abilityCards(ramps: Ramp[] = [RAMPS.red, RAMPS.green, RAMPS.blue, RAMPS.gold]): Raster {
  const out = new Raster(ABILITY_W * ramps.length, ABILITY_H);
  ramps.forEach((rp, f) => {
    const r = new Raster(ABILITY_W, ABILITY_H);
    const W = ABILITY_W;
    const H = ABILITY_H;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inRoundRect(x, y, W, H, 0, 7)) continue;
        let c: number = rp[2];
        if (!inRoundRect(x, y, W, H, 1, 7)) c = PAL.ink;
        else if (!inRoundRect(x, y, W, H, 2, 6)) c = x + y < 40 ? rp[3] : rp[1];
        else if (!inRoundRect(x, y, W, H, 5, 5)) c = rp[2];
        else if (!inRoundRect(x, y, W, H, 6, 4)) c = rp[0];
        else c = y < 34 ? rp[1] : PAL.sandLight;
        r.set(x, y, c);
      }
    }
    // Kopfband-Kante
    for (let x = 6; x < W - 6; x++) r.set(x, 34, rp[0]);
    // Rauten in den Ecken
    const gem = (gx: number, gy: number) => {
      r.set(gx, gy - 1, rp[3]);
      r.set(gx - 1, gy, rp[3]);
      r.set(gx, gy, PAL.white);
      r.set(gx + 1, gy, rp[2]);
      r.set(gx, gy + 1, rp[1]);
    };
    gem(10, H - 10);
    gem(W - 11, H - 10);
    out.blit(r, f * ABILITY_W, 0);
  });
  return out;
}

const ICON16: Record<string, string[]> = {
  fist: ['................', '.....kkkkk......', '....kwwwwwk.....', '...kwwkwkwwk....', '...kwkwkwkwk....', '...kwwwwwwwkk...', '...kwwwwwwwwk...', '...kwwwwwwwwk...', '....kwwwwwwk....', '....kwwwwwk.....', '.....kwwwk......', '.....kwwwk......', '.....kkkkk......', '................', '................', '................'],
  shield: ['................', '...kkkkkkkkkk...', '..kwwwwwwwwwwk..', '..kwwwwkkwwwwk..', '..kwwwkwwkwwwk..', '..kwwwwwwwwwwk..', '..kwwwwwwwwwwk..', '...kwwwwwwwwk...', '...kwwwwwwwwk...', '....kwwwwwwk....', '.....kwwwwk.....', '......kwwk......', '.......kk.......', '................', '................', '................'],
  heart: ['................', '................', '..kkkk...kkkk...', '.kwwwwk.kwwwwk..', 'kwwwwwwkwwwwwwk.', 'kwwwwwwwwwwwwwk.', 'kwwwwwwwwwwwwwk.', '.kwwwwwwwwwwwk..', '..kwwwwwwwwwk...', '...kwwwwwwwk....', '....kwwwwwk.....', '.....kwwwk......', '......kwk.......', '.......k........', '................', '................'],
  burst: ['.......k........', '.......kk.......', '..k...kwk...k...', '...k..kwk..k....', '...kkkwwwkkk....', '....kwwwwwk.....', 'kkkkwwwwwwwkkkk.', '..kkwwwwwwwkk...', '....kwwwwwk.....', '...kkkwwwkkk....', '...k..kwk..k....', '..k...kwk...k...', '.......kk.......', '.......k........', '................', '................'],
  boot: ['................', '....kkkkk.......', '....kwwwk.......', '....kwwwk.......', '....kwwwk.......', '....kwwwk.......', '....kwwwk.......', '....kwwwwkkk....', '....kwwwwwwwk...', '...kwwwwwwwwwk..', '...kwwwwwwwwwk..', '...kkkkkkkkkkk..', '................', '................', '................', '................'],
  wind: ['................', '................', '.kkkkkkkkk......', 'kwwwwwwwwwk.....', '.kkkkkkkwwk.....', '.......kwk......', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '..kkkkkkkkkwwk..', '..........kwk...', '...kkkkkkkk.....', '..kwwwwwwwwk....', '...kkkkkkwwk....', '........kk......', '................', '................'],
  clover: ['................', '....kkk.kkk.....', '...kwwwkwwwk....', '...kwwwkwwwk....', '.kkkkwwwwwkkkk..', 'kwwwwkwwwkwwwwk.', 'kwwwwwwwwwwwwwk.', '.kkkkwwwwwkkkk..', '...kwwwkwwwk....', '...kwwwkwwwk....', '....kkkkkkk.....', '.......kk.......', '........kk......', '.........k......', '................', '................'],
  drop: ['.......k........', '......kwk.......', '......kwk.......', '.....kwwwk......', '.....kwwwk......', '....kwwwwwk.....', '...kwwwwwwwk....', '...kwkwwwwwk....', '...kwkwwwwwk....', '...kwwkwwwwk....', '....kwwwwwk.....', '.....kkkkk......', '................', '................', '................', '................'],
  swirl: ['................', '....kkkkkk......', '...kwwwwwwk.....', '..kwwkkkkwwk....', '..kwk....kwk....', '..kwk.kk.kwk....', '..kwk.kwkkwk....', '..kwwk.kwwk.....', '...kwwkkkk......', '....kwwwwwwk....', '.....kkkkkk.....', '................', '................', '................', '................', '................'],
  eye: ['................', '................', '................', '....kkkkkkk.....', '..kkwwwwwwwkk...', '.kwwwwkkkwwwwk..', 'kwwwwkwwwkwwwwk.', 'kwwwwkwkwkwwwwk.', '.kwwwwkkkwwwwk..', '..kkwwwwwwwkk...', '....kkkkkkk.....', '................', '................', '................', '................', '................'],
  branchA: ['................', '.......kk.......', '......kwwk......', '.....kwwwwk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '...kkkkwwkkkk...', '......kwwk......', '......kwwk......', '......kwwk......', '......kwwk......', '......kwwk......', '......kkkk......', '................', '................', '................'],
  branchB: ['................', '..k.........k...', '..kk.......kk...', '..kwk.....kwk...', '...kwk...kwk....', '....kwk.kwk.....', '.....kwkwk......', '......kwk.......', '.....kwkwk......', '....kwk.kwk.....', '...kwk...kwk....', '..kwk.....kwk...', '..kk.......kk...', '................', '................', '................'],
  branchC: ['................', '......kkk.......', '.....kwwwk......', '....kwwwwwk.....', '....kwwwwwk.....', '.....kwwwk......', '......kkk.......', '.......k........', '...kkk.k.kkk....', '..kwwwkkkwwwk...', '..kwwwwkwwwwk...', '...kkkk.kkkk....', '................', '................', '................', '................'],
  star: ['.......k........', '......kwk.......', '......kwk.......', '.kkkkkkwkkkkkk..', '.kwwwwwwwwwwwk..', '..kwwwwwwwwwk...', '...kwwwwwwwk....', '...kwwwkwwwk....', '..kwwwk.kwwwk...', '..kwwk...kwwk...', '..kkk.....kkk...', '................', '................', '................', '................', '................'],
  orb: ['................', '................', '.....kkkkk......', '....kwwwwwk.....', '...kwwwwwwwk....', '...kwkkwwwwk.k..', '...kwkwwwwwkkwk.', '...kwwwwwwwk.k..', '....kwwwwwk.....', '.....kkkkk......', '................', '................', '................', '................', '................', '................'],
};

/** Symbole für Fähigkeitskarten 16×16 (weiss mit Umriss, wird eingefärbt) */
export const ABILITY_ICON_ORDER = ['fist', 'shield', 'heart', 'burst', 'boot', 'wind', 'clover', 'drop', 'swirl', 'eye', 'branchA', 'branchB', 'branchC', 'star', 'orb'];

export function abilityIcons(): Raster {
  const out = new Raster(16 * ABILITY_ICON_ORDER.length, 16);
  ABILITY_ICON_ORDER.forEach((k, i) => stencil(out, i * 16, 0, ICON16[k], { k: PAL.ink, w: PAL.white }));
  return out;
}


/** Uhrzeit-/Wetter-Symbole 9×9: Sonne, Mond, Vollmond, Regen, Sturm, Schnee, Nebel, Sand */
export const TIME_ICON_ORDER = ['sonne', 'mond', 'vollmond', 'regen', 'sturm', 'schnee', 'nebel', 'sand'] as const;
export function timeIcons(): Raster {
  const icons: string[][] = [
    ['....y....', '.y..y..y.', '..yyyyy..', '..yYYYy..', 'yyyYYYyyy', '..yYYYy..', '..yyyyy..', '.y..y..y.', '....y....'],
    ['...ccc...', '..cc.....', '.cc......', '.cc......', '.cc......', '.cc......', '.ccc...c.', '..ccccc..', '....c....'],
    ['..ccccc..', '.cCCCCCc.', 'cCCcCCCCc', 'cCCCCCcCc', 'cCCCCCCCc', 'cCcCCCCCc', 'cCCCCcCCc', '.cCCCCCc.', '..ccccc..'],
    ['..sssss..', '.sSSSSSs.', 'sSSSSSSSs', '.sssssss.', '.b..b..b.', 'b..b..b..', '.b..b..b.', 'b..b..b..', '.........'],
    ['..sssss..', '.sSSSSSs.', 'sSSSSSSSs', '.sssyyss.', '....yy...', '...yy....', '....yy...', '...y.....', '.........'],
    ['....w....', '.w..w..w.', '..w.w.w..', '...www...', 'wwwwwwwww', '...www...', '..w.w.w..', '.w..w..w.', '....w....'],
    ['.........', '.sssss...', '.........', '...ssssss', '.........', 'sssss....', '.........', '..sssssss', '.........'],
    ['.........', 'ttt..t...', '...tt..tt', '.t....t..', 'tt.ttt..t', '...t...t.', 't.t..tt..', '.t..t...t', '.........'],
  ];
  const col: Record<string, number> = { y: PAL.gold, Y: PAL.cream, c: PAL.ice, C: PAL.white, s: PAL.silver, S: PAL.white, b: PAL.sky, w: PAL.white, t: PAL.sand };
  const out = new Raster(9 * icons.length, 9);
  icons.forEach((rows, i) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < 9; x++) {
        const c = col[row[x]];
        if (c !== undefined) out.set(i * 9 + x, y, c);
      }
    });
  });
  return out;
}


/** Walzensymbole des Sternenautomaten 16×16: Kirsche, Glocke, Klee, Herz, Sieben, Stern */
export const SLOT_SYMBOLS = ['kirsche', 'glocke', 'klee', 'herz', 'sieben', 'stern'] as const;
export function slotSymbols(): Raster {
  const icons: string[][] = [
    ['................', '..........gg....', '.........g......', '........g.......', '.......g.g......', '......g...g.....', '.....g.....g....', '...rrr.....rrr..', '..rRRrr...rRRrr.', '..rRrrr...rRrrr.', '..rrrrr...rrrrr.', '..rrrrr...rrrrr.', '...rrr.....rrr..', '................', '................', '................'],
    ['.......yy.......', '......yYYy......', '.....yYYYYy.....', '.....yYYYYy.....', '....yYYYYYYy....', '....yYYYYYYy....', '....yYYYYYYy....', '...yYYYYYYYYy...', '...yYYYYYYYYy...', '..yYYYYYYYYYYy..', '..yyyyyyyyyyyy..', '.......oo.......', '.......oo.......', '................', '................', '................'],
    ['................', '.....gg..gg.....', '....gGGggGGg....', '....gGGGGGGg....', '.....gGGGGg.....', '.gg...gGGg...gg.', 'gGGgg..gg..ggGGg', 'gGGGGgg..ggGGGGg', 'gGGgg..gg..ggGGg', '.gg...gGGg...gg.', '.....gGGGGg.....', '....gGGGGGGg....', '....gGGggGGg....', '.....gg.wgg.....', '........w.......', '.......w........'],
    ['................', '................', '...pp......pp...', '..pPPp....pPPp..', '.pPWPPp..pPPPPp.', '.pPPPPPppPPPPPp.', '.pPPPPPPPPPPPPp.', '.pPPPPPPPPPPPPp.', '..pPPPPPPPPPPp..', '...pPPPPPPPPp...', '....pPPPPPPp....', '.....pPPPPp.....', '......pPPp......', '.......pp.......', '................', '................'],
    ['................', '..rrrrrrrrrrrr..', '..rRRRRRRRRRRr..', '..rRrrrrrrrRRr..', '..rr......rRr...', '.........rRr....', '........rRr.....', '.......rRr......', '......rRr.......', '......rRr.......', '.....rRr........', '.....rRr........', '.....rRr........', '.....rrr........', '................', '................'],
    ['.......yy.......', '.......yy.......', '......yYYy......', '......yYYy......', 'yyyyyyYYYYyyyyyy', '.yYYYYYYYYYYYYy.', '..yYYYYWWYYYYy..', '...yYYYWWYYYy...', '...yYYYYYYYYy...', '..yYYYYyyYYYYy..', '..yYYYy..yYYYy..', '.yYYy......yYYy.', '.yyy........yyy.', '................', '................', '................'],
  ];
  const col: Record<string, number> = { r: PAL.red, R: PAL.coral, g: PAL.leaf, G: PAL.lime, y: PAL.orange, Y: PAL.gold, o: PAL.wood, p: PAL.red, P: PAL.pink, W: PAL.white, w: PAL.wood };
  const out = new Raster(16 * icons.length, 16);
  icons.forEach((rows, i) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const c = col[row[x]];
        if (c !== undefined) out.set(i * 16 + x, y, c);
      }
    });
  });
  return out;
}
