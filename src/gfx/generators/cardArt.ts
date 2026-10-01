import { PAL, RAMPS, type Ramp, type RampName } from '../palette';
import { Raster } from '../Raster';
import { LabelCanvas, type MaterialMap } from '../SpriteComposer';
import { renderTextRaster } from '../font/PixelFont';
import { ITEM_ICONS, MONSTER_ICONS, SPELL_GLYPHS } from './cardIcons';
import { RANK_STYLE, type CardDef, type Rank } from '../../data/cardTypes';
import { ALL_CARDS, SAMMELKARTEN } from '../../data/cards';

/**
 * Karten-Artwork: Symbol (16×16), Mini-Karte 30×40 (im Buch 1×, in der Detailansicht 2×),
 * Silhouetten für noch nicht gefundene Karten, Kartenrückseite und das Pixel-Buch.
 */

export const CARD_W = 30;
export const CARD_H = 40;

function parseTemplate(t: string): string[] {
  const rows = t.split('\n').filter((r) => r.trim().length > 0);
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.'));
}

function ramp(name: RampName | undefined, fallback: Ramp): Ramp {
  return name ? RAMPS[name] : fallback;
}

function iconMaterials(c1: Ramp, c2: Ramp, c3: Ramp): MaterialMap {
  return {
    a: { ramp: c1 },
    b: { ramp: c2 },
    c: { ramp: c3 },
    h: { ramp: c1, tone: 3, group: 'a' },
    d: { ramp: c1, tone: 1, group: 'a' },
    w: { flat: PAL.white },
    k: { flat: PAL.ink },
    y: { flat: PAL.pink },
    o: { ramp: RAMPS.wood },
    i: { ramp: RAMPS.ice, rim: false },
    p: { ramp: RAMPS.paper },
    g: { ramp: RAMPS.gold },
    r: { ramp: RAMPS.red },
    l: { ramp: RAMPS.green },
    m: { ramp: RAMPS.silver },
  };
}

/** Symbol einer Karte (16×16, mit Umriss). */
export function renderIcon(c: CardDef): Raster {
  const lc = new LabelCanvas(16, 16);
  const key = c.art.icon;
  let tpl: string | undefined;
  if (key.startsWith('m-')) tpl = MONSTER_ICONS[key.slice(2)];
  else if (key.startsWith('g-')) tpl = SPELL_GLYPHS[key.slice(2)];
  else tpl = ITEM_ICONS[key];
  if (!tpl) tpl = ITEM_ICONS.pebble;
  const rows = parseTemplate(tpl);
  const ox = Math.floor((16 - rows[0].length) / 2);
  const oy = Math.floor((16 - rows.length) / 2);
  if (key.startsWith('g-')) {
    // Zauber-Glyphe: hell und flach
    lc.stamp({ x: ox, y: oy, rows: rows.map((r) => r.replace(/a/g, 'w')) });
    return lc.render({ w: { flat: PAL.white } }, PAL.ink);
  }
  lc.stamp({ x: ox, y: oy, rows });
  const c1 = ramp(c.art.c1, RAMPS.grey);
  const c2 = ramp(c.art.c2, c1);
  const c3 = ramp(c.art.c3, c1);
  return lc.render(iconMaterials(c1, c2, c3), PAL.ink);
}

// Winzige Schrift (4×5) für Rangbuchstaben im unteren Kartenrand
const TINY: Record<string, string[]> = {
  S: ['.###', '#...', '.##.', '...#', '###.'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
};

// Rang-Symbole (5×5) – zusätzlich zur Farbe, für Farbenblinde
const SYMBOLS: Record<string, string[]> = {
  doppelraute: ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  raute: ['..#..', '.###.', '#####', '.###.', '..#..'],
  stern: ['..#..', '#####', '.###.', '.#.#.', '#...#'],
  mond: ['.###.', '##...', '#....', '##...', '.###.'],
  tropfen: ['..#..', '.###.', '#####', '#####', '.###.'],
  blatt: ['...##', '.####', '#####', '####.', '#....'],
  welle: ['.....', '.#..#', '#.##.', '.....', '.....'],
  kreis: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  quadrat: ['#####', '#...#', '#...#', '#...#', '#####'],
  punkt: ['.....', '.###.', '.###.', '.###.', '.....'],
};

function drawPattern(r: Raster, x: number, y: number, rows: string[], color: number): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') r.set(x + i, y + j, color);
  });
}

function rankRamp(rank: Rank): Ramp {
  return RAMPS[RANK_STYLE[rank].ramp];
}

/** Rahmen + Hintergrund einer Mini-Karte. */
function cardBase(border: Ramp, inner: number, rankForSS = false): Raster {
  const r = new Raster(CARD_W, CARD_H);
  for (let y = 0; y < CARD_H; y++) {
    for (let x = 0; x < CARD_W; x++) {
      const corner = (x === 0 || x === CARD_W - 1) && (y === 0 || y === CARD_H - 1);
      if (corner) continue;
      const edge = x === 0 || y === 0 || x === CARD_W - 1 || y === CARD_H - 1;
      if (edge) {
        r.set(x, y, PAL.ink);
        continue;
      }
      const inBorder = x <= 2 || y <= 2 || x >= CARD_W - 3 || y >= CARD_H - 3;
      if (inBorder) {
        // Licht oben links, Schatten unten rechts
        let tone = 2;
        if (x === 1 || y === 1) tone = 3;
        if (x === CARD_W - 2 || y === CARD_H - 2) tone = 1;
        if (rankForSS && (x + y) % 4 === 0) tone = 3;
        r.set(x, y, border[tone]);
      } else r.set(x, y, inner);
    }
  }
  // Innenkante
  for (let x = 3; x < CARD_W - 3; x++) r.set(x, 3, PAL.sandShade);
  return r;
}

/** Mini-Karte 30×40 */
export function renderMiniCard(c: CardDef): Raster {
  const border = rankRamp(c.rank);
  const isSpell = c.kind === 'zauber';
  const inner = isSpell ? PAL.night : PAL.sandLight;
  const r = cardBase(border, inner, c.rank === 'SS');
  if (isSpell) for (let x = 3; x < CARD_W - 3; x++) r.set(x, 3, PAL.shadow);
  // Nummer oben
  const num = renderTextRaster(c.id, isSpell ? PAL.cream : PAL.ink, 'plain');
  r.blit(num, Math.round((CARD_W - num.w) / 2), 2 - 1);
  // Bildfeld
  const bx = 4;
  const by = 12;
  const bw = CARD_W - 8;
  const bh = 18;
  const catRamp = isSpell ? RAMPS[c.art.c1] : null;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      const edge = x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1;
      if (catRamp) {
        // Zauberkreis-Hintergrund
        const dx = x + 0.5 - (bx + bw / 2);
        const dy = y + 0.5 - (by + bh / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        let col: number = catRamp[0];
        if (d < 8.5 && d > 7.4) col = catRamp[2];
        else if (d <= 7.4) col = catRamp[1];
        r.set(x, y, edge ? PAL.ink : col);
      } else {
        r.set(x, y, edge ? PAL.sandShade : y < by + bh / 2 ? PAL.white : PAL.sandLight);
      }
    }
  }
  const icon = renderIcon(c);
  r.blit(icon, bx + Math.floor((bw - 16) / 2), by + 1);
  // Rang unten: Symbol links, Buchstabe rechts
  const style = RANK_STYLE[c.rank];
  const symColor = isSpell ? border[3] : border[1] === PAL.mist ? PAL.stone : border[1];
  drawPattern(r, 5, 31, SYMBOLS[style.symbol], c.rank === 'SS' ? PAL.orange : symColor);
  const letters = style.label.split('');
  let lx = CARD_W - 5 - letters.length * 5 + 1;
  for (const ch of letters) {
    drawPattern(r, lx, 31, TINY[ch], isSpell ? PAL.cream : PAL.ink);
    lx += 5;
  }
  return r;
}

/** Silhouette (noch nicht gefundene Sammelkarte): grauer Rahmen, Schattenriss, Nummer. */
export function renderSilhouette(c: CardDef): Raster {
  const r = cardBase(RAMPS.grey, PAL.shadow);
  for (let x = 3; x < CARD_W - 3; x++) r.set(x, 3, PAL.night);
  const num = renderTextRaster(c.id, PAL.mist, 'plain');
  r.blit(num, Math.round((CARD_W - num.w) / 2), 1);
  const icon = renderIcon(c);
  const bx = 4;
  const by = 12;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (icon.alphaAt(x, y) > 0) r.set(bx + 3 + x, by + 1 + y, PAL.night);
    }
  }
  drawPattern(r, 5, 31, SYMBOLS[RANK_STYLE[c.rank].symbol], PAL.stone);
  return r;
}

/** Leerer freier Slot (gestrichelt) */
export function renderEmptySlot(): Raster {
  const r = new Raster(CARD_W, CARD_H);
  for (let y = 1; y < CARD_H - 1; y++) {
    for (let x = 1; x < CARD_W - 1; x++) {
      const edge = x === 1 || y === 1 || x === CARD_W - 2 || y === CARD_H - 2;
      if (edge) {
        if ((x + y) % 4 < 2) r.set(x, y, PAL.sandShade);
      } else r.set(x, y, PAL.sand, 90);
    }
  }
  return r;
}

/** Kartenrückseite */
export function renderCardBack(): Raster {
  const r = cardBase(RAMPS.violet, PAL.purple);
  for (let y = 4; y < CARD_H - 4; y++) {
    for (let x = 4; x < CARD_W - 4; x++) {
      if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) r.set(x, y, PAL.plum);
    }
  }
  drawPattern(r, 10, 15, ['..#..#..#..', '.#########.', '..#######..', '.#########.', '..#..#..#..'].map((s) => s.slice(0, 10)), PAL.gold);
  return r;
}

/** Atlas aller Karten (Reihenfolge = ALL_CARDS) */
export function cardsAtlas(): Raster {
  const cols = 16;
  const rows = Math.ceil(ALL_CARDS.length / cols);
  const out = new Raster(cols * CARD_W, rows * CARD_H);
  ALL_CARDS.forEach((c, i) => out.blit(renderMiniCard(c), (i % cols) * CARD_W, Math.floor(i / cols) * CARD_H));
  return out;
}

/** Atlas der Silhouetten (Reihenfolge = SAMMELKARTEN) */
export function silhouetteAtlas(): Raster {
  const cols = 10;
  const out = new Raster(cols * CARD_W, 10 * CARD_H);
  SAMMELKARTEN.forEach((c, i) => out.blit(renderSilhouette(c), (i % cols) * CARD_W, Math.floor(i / cols) * CARD_H));
  return out;
}

/** Rahmen-Extras: 0 leerer Slot, 1 Rückseite, 2 Auswahlrahmen, 3 Ablageziel */
export function cardExtras(): Raster {
  const out = new Raster(CARD_W * 4, CARD_H);
  out.blit(renderEmptySlot(), 0, 0);
  out.blit(renderCardBack(), CARD_W, 0);
  // Auswahlrahmen (gold, 2 px aussen)
  for (const [ox, col] of [
    [2, PAL.gold],
    [3, PAL.lime],
  ] as const) {
    for (let y = 0; y < CARD_H; y++) {
      for (let x = 0; x < CARD_W; x++) {
        const edge = x <= 1 || y <= 1 || x >= CARD_W - 2 || y >= CARD_H - 2;
        const corner = (x <= 1 || x >= CARD_W - 2) && (y <= 1 || y >= CARD_H - 2);
        if (edge && !corner) out.set(ox * CARD_W + x, y, x <= 0 || y <= 0 || x >= CARD_W - 1 || y >= CARD_H - 1 ? PAL.ink : col);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Das Buch
// ---------------------------------------------------------------------------

export const BOOK_W = 452;
export const BOOK_H = 240;

/** Aufgeschlagenes Buch: Ledereinband, zwei Pergamentseiten, Buchrücken, Seitenstapel. */
export function bookOpen(): Raster {
  const r = new Raster(BOOK_W, BOOK_H);
  const leather: Ramp = [PAL.ink, PAL.wine, PAL.crimson, PAL.red];
  // Einband
  for (let y = 0; y < BOOK_H; y++) {
    for (let x = 0; x < BOOK_W; x++) {
      const corner = (x < 4 || x > BOOK_W - 5) && (y < 4 || y > BOOK_H - 5);
      if (corner && Math.hypot(x < 4 ? 4 - x : x - (BOOK_W - 5), y < 4 ? 4 - y : y - (BOOK_H - 5)) > 4) continue;
      let tone = 2;
      if (y < 3 || x < 3) tone = 3;
      if (y > BOOK_H - 4 || x > BOOK_W - 4) tone = 1;
      if ((x * 7 + y * 13) % 29 === 0) tone = Math.max(1, tone - 1);
      r.set(x, y, leather[tone]);
    }
  }
  // Goldene Ecken
  const cornerPat = ['######', '#ggg##', '#g####', '#g#...', '###...', '##....'];
  const putCorner = (cx: number, cy: number, fx: boolean, fy: boolean) => {
    cornerPat.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '.') continue;
        const px = fx ? cx - i : cx + i;
        const py = fy ? cy - j : cy + j;
        r.set(px, py, row[i] === 'g' ? PAL.cream : PAL.gold);
      }
    });
  };
  putCorner(2, 2, false, false);
  putCorner(BOOK_W - 3, 2, true, false);
  putCorner(2, BOOK_H - 3, false, true);
  putCorner(BOOK_W - 3, BOOK_H - 3, true, true);
  // Seitenstapel unten
  const px0 = 10;
  const py0 = 8;
  const pageW = BOOK_W / 2 - px0 - 2;
  const pageH = BOOK_H - py0 - 12;
  for (let k = 3; k >= 1; k--) {
    for (let x = px0 + k; x < BOOK_W - px0 - k; x++) {
      r.set(x, py0 + pageH + k * 1, k % 2 ? PAL.sandShade : PAL.sand);
    }
  }
  // Seiten (links + rechts)
  for (const side of [0, 1]) {
    const x0 = side === 0 ? px0 : BOOK_W / 2 + 2;
    for (let y = py0; y < py0 + pageH; y++) {
      for (let x = x0; x < x0 + pageW; x++) {
        // zur Mitte hin dunkler (Wölbung)
        const toSpine = side === 0 ? x0 + pageW - x : x - x0;
        let c: number = PAL.sandLight;
        if (toSpine < 3) c = PAL.sandShade;
        else if (toSpine < 9) c = (x + y) % 2 === 0 ? PAL.sand : PAL.sandLight;
        else if ((x * 3 + y * 5) % 97 === 0) c = PAL.sand;
        if (y === py0) c = PAL.white;
        r.set(x, y, c);
      }
    }
    // dezente Zierlinie
    for (let x = x0 + 8; x < x0 + pageW - 8; x++) {
      r.set(x, py0 + 5, PAL.sand);
      r.set(x, py0 + pageH - 6, PAL.sand);
    }
  }
  // Buchrücken
  for (let y = py0 - 2; y < py0 + pageH + 3; y++) {
    r.set(BOOK_W / 2 - 2, y, PAL.wood);
    r.set(BOOK_W / 2 - 1, y, PAL.bark);
    r.set(BOOK_W / 2, y, PAL.bark);
    r.set(BOOK_W / 2 + 1, y, PAL.wood);
  }
  r.outline(PAL.ink);
  return r;
}

/** Einzelne Seite für die Umblätter-Animation */
export function bookPage(): Raster {
  const w = BOOK_W / 2 - 12;
  const h = BOOK_H - 20;
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c: number = PAL.sandLight;
      if (x < 3) c = PAL.sand;
      if (y === 0) c = PAL.white;
      if (x === w - 1 || y === h - 1) c = PAL.sandShade;
      r.set(x, y, c);
    }
  }
  return r;
}

/** Geschlossenes Buch (Beschwörung) 56×72 */
export function bookClosed(): Raster {
  const W = 56;
  const H = 72;
  const r = new Raster(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x > W - 6 && y > 2 && y < H - 3) {
        r.set(x, y, (y % 2 === 0 ? PAL.sandLight : PAL.sand));
        continue;
      }
      let tone = 2;
      if (x < 2 || y < 2) tone = 3;
      if (x > W - 9 || y > H - 3) tone = 1;
      if (x === 5 || x === 6) tone = 1;
      r.set(x, y, [PAL.ink, PAL.wine, PAL.crimson, PAL.red][tone]);
    }
  }
  // Emblem: Karte mit Stern
  for (let y = 22; y < 50; y++) {
    for (let x = 16; x < 38; x++) {
      const edge = x === 16 || x === 37 || y === 22 || y === 49;
      r.set(x, y, edge ? PAL.orange : (x + y) % 2 ? PAL.gold : PAL.cream);
    }
  }
  drawPattern(r, 22, 29, ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '##.....##'], PAL.crimson);
  // Ecken
  for (const [cx, cy] of [[1, 1], [W - 9, 1], [1, H - 6], [W - 9, H - 6]]) {
    for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) if (i + j < 6) r.set(cx + i, cy + j, PAL.gold);
  }
  r.outline(PAL.ink);
  return r;
}

/** Lesezeichen-Reiter (4 Farben übereinander, je 52×16) */
export function bookTabs(): Raster {
  const colors: Ramp[] = [RAMPS.gold, RAMPS.teal, RAMPS.wood, RAMPS.red, RAMPS.violet];
  const W = 52;
  const H = 16;
  const out = new Raster(W, H * colors.length);
  colors.forEach((rp, i) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if ((x === 0 || x === W - 1) && y === 0) continue;
        let tone = 2;
        if (y < 2) tone = 3;
        if (x === W - 1 || x === W - 2) tone = 1;
        out.set(x, i * H + y, rp[tone]);
      }
    }
    // Umriss oben/seitlich
    for (let x = 1; x < W - 1; x++) out.set(x, i * H, PAL.ink);
    for (let y = 1; y < H; y++) {
      out.set(0, i * H + y, PAL.ink);
      out.set(W - 1, i * H + y, PAL.ink);
    }
  });
  return out;
}

/** Atlas der Kartensymbole 16×16 (Reihenfolge = ALL_CARDS) – für HUD und Beutel */
export function iconAtlas(): Raster {
  const cols = 16;
  const rows = Math.ceil(ALL_CARDS.length / cols);
  const out = new Raster(cols * 16, rows * 16);
  ALL_CARDS.forEach((c, i) => out.blit(renderIcon(c), (i % cols) * 16, Math.floor(i / cols) * 16));
  return out;
}

/** Karte, die am Boden liegt (12×15), ein Frame pro Rang (Reihenfolge RANKS) */
export function groundCards(ranks: readonly Rank[]): Raster {
  const W = 12;
  const H = 15;
  const out = new Raster(W * ranks.length, H);
  ranks.forEach((rank, i) => {
    const rp = rankRamp(rank);
    const r = new Raster(W, H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const border = x <= 2 || y <= 2 || x >= W - 3 || y >= H - 3;
        r.set(x, y, border ? rp[x + y < 8 ? 3 : 2] : y < H / 2 ? PAL.white : PAL.sandLight);
      }
    }
    r.set(5, 6, rp[1]);
    r.set(6, 6, rp[1]);
    r.set(5, 7, rp[1]);
    r.set(6, 7, rp[1]);
    r.set(5, 8, rp[1]);
    r.set(6, 8, rp[1]);
    r.outline(PAL.ink);
    out.blit(r, i * W, 0);
  });
  return out;
}
