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
