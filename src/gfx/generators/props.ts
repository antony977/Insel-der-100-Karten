import { PAL, RAMPS, type Ramp } from '../palette';
import { Raster, rng } from '../Raster';
import { hline, shadedBlobs, shadedRect, stencil, strip, vline, type Circle } from '../draw';

/**
 * Weitere Weltobjekte für die ganze Insel: Gebäude aller Städte, Natur je Region,
 * Ruinen, Wegsperren. Stil wie objects.ts: 1-px-Umriss, Licht von oben links.
 */

function shadowed(body: Raster, sx: number, sy: number, rx: number, ry: number, outline = true): Raster {
  if (outline) body.outline(PAL.ink);
  const out = new Raster(body.w, body.h);
  out.ellipse(sx, sy, rx, ry, PAL.ink, 80);
  out.blit(body, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Gebäude
// ---------------------------------------------------------------------------

export type SignIcon = 'potion' | 'book' | 'boot' | 'cup' | 'anchor' | 'bread' | 'coin' | 'dice' | 'sword' | 'star' | 'rose' | 'shell' | 'card' | 'bed' | 'scroll';

const SIGN_ICONS: Record<SignIcon, string[]> = {
  potion: ['..kk..', '..ww..', '.kRRk.', 'kRRRRk', 'kRrRRk', '.kkkk.'],
  book: ['kkkkkk', 'kVVVVk', 'kVwwVk', 'kVVVVk', 'kVVVVk', 'kkkkkk'],
  boot: ['.kkk..', '.kWk..', '.kWk..', '.kWWkk', 'kWWWWk', 'kkkkkk'],
  cup: ['..w.w.', '.w.w..', 'kkkkk.', 'kWWWkk', 'kWWWk.', '.kkk..'],
  anchor: ['..k...', '.kWk..', '..W...', 'W.W.W.', '.WWW..', '..W...'],
  bread: ['......', '.kkkk.', 'kYwYYk', 'kYYwYk', '.kkkk.', '......'],
  coin: ['.kkkk.', 'kYYYYk', 'kYwYYk', 'kYYYYk', 'kYYYYk', '.kkkk.'],
  dice: ['kkkkkk', 'kWWWRk', 'kWWWWk', 'kWRWWk', 'kRWWWk', 'kkkkkk'],
  sword: ['....kW', '...kWk', 'k.kWk.', '.kWk..', 'kYk...', 'k.k...'],
  star: ['..Y...', '.YYY..', 'YYYYY.', '.YYY..', '.Y.Y..', '......'],
  rose: ['.RRR..', 'RRrRR.', '.RRR..', '..G...', '.GG...', '..G...'],
  shell: ['..W...', '.WWW..', 'WWWWW.', 'W.W.W.', '.WWW..', '......'],
  card: ['kkkkk.', 'kWWWk.', 'kWRWk.', 'kWWWk.', 'kkkkk.', '......'],
  bed: ['......', 'k.....', 'kWWkkk', 'kRRRRk', 'k....k', '......'],
  scroll: ['.kkkk.', 'kWWWWk', '.kWWk.', '.kWWk.', 'kWWWWk', '.kkkk.'],
};

const SIGN_COLORS: Record<string, number> = { k: PAL.ink, w: PAL.white, W: PAL.white, R: PAL.red, r: PAL.crimson, V: PAL.violet, Y: PAL.gold, G: PAL.leaf };

export interface BuildingOpts {
  w: number;
  wallH: number;
  roofH: number;
  roof: Ramp;
  wall: Ramp;
  /** Fachwerk */
  timber?: boolean;
  sign?: SignIcon;
  chimney?: boolean;
  /** Schnee auf dem Dach */
  snow?: boolean;
  /** Flachdach (Wüste) */
  flat?: boolean;
  windows?: number;
  seed?: number;
}

/** Allgemeines Gebäude: Wand, Fenster, Tür, Ziegeldach, optional Schild. Fusspunkt (w/2, h−2). */
export function building(o: BuildingOpts): Raster {
  const W = o.w;
  const H = o.roofH + o.wallH + 2;
  const b = new Raster(W, H);
  const wallTop = o.roofH;
  const wallBottom = H - 3;
  const x0 = 4;
  const x1 = W - 5;
  for (let y = wallTop; y <= wallBottom; y++) {
    for (let x = x0; x <= x1; x++) {
      let c: number = o.wall[2];
      if (x === x1 || y === wallBottom) c = o.wall[1];
      else if (x === x0) c = o.wall[3];
      else if (o.flat && (x + y * 3) % 11 === 0) c = o.wall[1];
      b.set(x, y, c);
    }
  }
  if (o.timber) {
    const posts = [x0, x0 + 1, Math.round((x0 + x1) / 2), Math.round((x0 + x1) / 2) + 1, x1 - 1, x1];
    for (const x of posts) vline(b, x, wallTop, wallBottom, x % 2 ? PAL.wood : PAL.bark);
    hline(b, x0, x1, wallTop, PAL.wood);
    hline(b, x0, x1, wallTop + 1, PAL.bark);
  }
  // Sockel
  for (let y = wallBottom - 3; y <= wallBottom; y++) {
    for (let x = x0; x <= x1; x++) {
      const brick = (Math.floor((x + (y % 2) * 3) / 5) + y) % 2;
      b.set(x, y, y === wallBottom ? PAL.stone : brick ? PAL.mist : PAL.silver);
    }
  }
  // Tür
  const doorW = 12;
  const doorX = Math.round(W / 2 - doorW / 2);
  const doorY = wallBottom - 16;
  shadedRect(b, doorX, doorY, doorW, 17, [PAL.bark, PAL.wood, PAL.tan, PAL.skinShade]);
  for (let y = doorY + 1; y < wallBottom; y++) for (let x = doorX + 1; x < doorX + doorW - 1; x++) b.set(x, y, (x - doorX - 1) % 3 === 2 ? PAL.wood : PAL.tan);
  b.ellipse(W / 2, doorY + 1, 6, 2, PAL.bark);
  b.set(doorX + doorW - 3, doorY + 9, PAL.gold);
  // Fenster
  const nWin = o.windows ?? 2;
  const winY = wallTop + Math.max(5, Math.round((o.wallH - 22) / 2) + 2);
  const slots: number[] = [];
  const left = x0 + 6;
  const right = x1 - 15;
  if (nWin >= 1) slots.push(left);
  if (nWin >= 2) slots.push(right);
  if (nWin >= 3 && W > 90) slots.push(left + 18, right - 18);
  for (const wx of slots) {
    if (wx + 10 > doorX - 1 && wx < doorX + doorW + 1) continue;
    shadedRect(b, wx, winY, 10, 10, RAMPS.wood);
    for (let y = winY + 1; y < winY + 9; y++) for (let x = wx + 1; x < wx + 9; x++) b.set(x, y, y < winY + 4 ? PAL.cream : PAL.gold);
    vline(b, wx + 5, winY + 1, winY + 8, PAL.wood);
    hline(b, wx + 1, wx + 8, winY + 4, PAL.wood);
    b.set(wx + 2, winY + 2, PAL.white);
    shadedRect(b, wx - 1, winY + 10, 12, 2, RAMPS.wood);
    for (let i = 0; i < 4; i++) b.set(wx + 2 + i * 2, winY + 9, i % 2 ? PAL.red : PAL.pink);
  }
  // Dach
  if (o.flat) {
    for (let y = wallTop - 4; y < wallTop + 1; y++) for (let x = x0 - 2; x <= x1 + 2; x++) b.set(x, y, y === wallTop - 4 ? o.roof[3] : y === wallTop ? o.roof[0] : o.roof[2]);
    for (let x = x0; x <= x1; x += 6) b.set(x, wallTop - 5, o.roof[1]);
  } else {
    const roofTop = 3;
    for (let y = roofTop; y < wallTop + 2; y++) {
      const inset = Math.max(0, Math.round((wallTop - y) * (W > 70 ? 0.32 : 0.25)));
      for (let x = 1 + inset; x <= W - 2 - inset; x++) {
        const row = Math.floor((y - roofTop) / 4);
        const off = row % 2 ? 3 : 0;
        const inTile = (x + off) % 6;
        let tone = 2;
        if ((y - roofTop) % 4 === 3) tone = 1;
        else if (inTile === 0) tone = 1;
        else if ((y - roofTop) % 4 === 0 && inTile < 4) tone = 3;
        if (x - inset < 4) tone = Math.min(3, tone + 1);
        if (x > W - 6 - inset) tone = Math.max(0, tone - 1);
        if (y >= wallTop) tone = 0;
        let c: number = o.roof[tone];
        if (o.snow && (y - roofTop < 3 || (y - roofTop) % 4 === 0) && (x * 7 + y) % 5 !== 0) c = y - roofTop < 2 ? PAL.white : PAL.silver;
        b.set(x, y, c);
      }
    }
    hline(b, 9, W - 10, roofTop, o.roof[0]);
  }
  if (o.chimney && !o.flat) {
    const cx = Math.round(W * 0.7);
    shadedRect(b, cx, 0, 7, 9, RAMPS.grey);
    hline(b, cx - 1, cx + 7, 0, PAL.stone);
  }
  // Schild
  if (o.sign) {
    const sx = doorX + doorW + 2;
    const sy = doorY - 2;
    hline(b, sx, sx + 9, sy, PAL.bark);
    vline(b, sx + 1, sy, sy + 2, PAL.bark);
    vline(b, sx + 8, sy, sy + 2, PAL.bark);
    shadedRect(b, sx, sy + 2, 10, 10, RAMPS.paper);
    stencil(b, sx + 2, sy + 4, SIGN_ICONS[o.sign], SIGN_COLORS);
  }
  return shadowed(b, W / 2 + 0.5, H - 2, W / 2 - 4, 2);
}

/** Gildenturm (Runenhall) 48×112 */
export function tower(): Raster {
  const W = 48;
  const H = 112;
  const b = new Raster(W, H);
  const stone: Ramp = [PAL.night, PAL.shadow, PAL.stone, PAL.mist];
  for (let y = 36; y < H - 2; y++) {
    const half = 15 + (y > H - 20 ? 3 : 0);
    for (let x = 24 - half; x < 24 + half; x++) {
      const rel = (x - (24 - half)) / (half * 2);
      let tone = rel < 0.2 ? 3 : rel > 0.75 ? 1 : 2;
      const brick = (Math.floor((x + (Math.floor(y / 4) % 2) * 3) / 6) + Math.floor(y / 4)) % 2;
      if (y % 4 === 0) tone = Math.max(0, tone - 1);
      else if (brick && tone === 2 && (x + y) % 7 === 0) tone = 1;
      b.set(x, y, stone[tone]);
    }
  }
  // Fenster mit Leuchten
  for (const wy of [48, 66]) {
    b.ellipse(24, wy, 4, 6, PAL.ink);
    b.ellipse(24, wy + 1, 3, 5, PAL.violet);
    b.set(23, wy - 2, PAL.pink);
    b.set(23, wy - 1, PAL.pink);
  }
  // Rune
  for (let i = -3; i <= 3; i++) {
    b.set(24 + i, 82 + i, PAL.cyan);
    b.set(24 - i, 82 + i, PAL.cyan);
  }
  // Tür
  shadedRect(b, 18, H - 20, 12, 18, [PAL.plum, PAL.purple, PAL.violet, PAL.pink]);
  b.ellipse(24, H - 20, 6, 3, PAL.plum);
  b.set(27, H - 11, PAL.gold);
  // Zinnenkranz + Spitzdach
  for (let x = 6; x < 42; x++) for (let y = 32; y < 38; y++) b.set(x, y, y === 32 || (x % 6 < 3 && y < 34) ? PAL.mist : PAL.stone);
  for (let y = 2; y < 33; y++) {
    const half = Math.round(((y - 2) / 31) * 17);
    for (let x = 24 - half; x <= 24 + half; x++) {
      const rel = (x - (24 - half)) / Math.max(1, half * 2);
      const tone = rel < 0.25 ? 3 : rel > 0.7 ? 1 : 2;
      b.set(x, y, [PAL.plum, PAL.purple, PAL.violet, PAL.pink][tone]);
    }
  }
  b.set(24, 0, PAL.gold);
  b.set(24, 1, PAL.gold);
  return shadowed(b, 24.5, H - 2, 18, 3);
}

/** Leuchtturm 32×100 */
export function lighthouse(): Raster {
  const W = 32;
  const H = 100;
  const b = new Raster(W, H);
  for (let y = 26; y < H - 2; y++) {
    const half = Math.round(8 + ((y - 26) / (H - 28)) * 5);
    const band = Math.floor((y - 26) / 12) % 2;
    for (let x = 16 - half; x < 16 + half; x++) {
      const rel = (x - (16 - half)) / (half * 2);
      const tone = rel < 0.25 ? 3 : rel > 0.72 ? 1 : 2;
      b.set(x, y, (band ? RAMPS.red : RAMPS.white)[tone]);
    }
  }
  shadedRect(b, 6, 22, 20, 5, RAMPS.grey);
  for (let y = 8; y < 22; y++) for (let x = 9; x < 23; x++) b.set(x, y, x === 9 || x === 22 || y === 8 ? PAL.shadow : x < 13 ? PAL.cream : PAL.gold);
  for (let y = 0; y < 9; y++) {
    const half = Math.round((y / 8) * 9);
    for (let x = 16 - half; x <= 16 + half; x++) b.set(x, y, x < 16 ? PAL.coral : PAL.red);
  }
  shadedRect(b, 12, H - 16, 8, 14, RAMPS.wood);
  return shadowed(b, 16.5, H - 2, 13, 3);
}

/** Windmühle 56×84, 4 Frames (Flügel drehen sich) */
export function windmill(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 4; f++) {
    const W = 56;
    const H = 84;
    const b = new Raster(W, H);
    for (let y = 30; y < H - 2; y++) {
      const half = Math.round(9 + ((y - 30) / (H - 32)) * 6);
      for (let x = 28 - half; x < 28 + half; x++) {
        const rel = (x - (28 - half)) / (half * 2);
        const tone = rel < 0.22 ? 3 : rel > 0.74 ? 1 : 2;
        b.set(x, y, [PAL.bark, PAL.tan, PAL.sand, PAL.sandLight][tone]);
      }
    }
    for (let y = 18; y < 31; y++) {
      const half = Math.round(((y - 18) / 12) * 12);
      for (let x = 28 - half; x <= 28 + half; x++) b.set(x, y, x < 28 ? PAL.coral : PAL.red);
    }
    shadedRect(b, 23, H - 16, 10, 14, RAMPS.wood);
    shadedRect(b, 24, 44, 8, 8, RAMPS.wood);
    for (let y = 45; y < 51; y++) for (let x = 25; x < 31; x++) b.set(x, y, PAL.gold);
    // Flügel
    const cx = 28;
    const cy = 26;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + (f * Math.PI) / 8;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let t = 2; t < 25; t++) {
        for (let wv = -3; wv <= 3; wv++) {
          const x = Math.round(cx + ca * t - sa * wv * (t > 6 ? 1 : 0.3));
          const y = Math.round(cy + sa * t + ca * wv * (t > 6 ? 1 : 0.3));
          const lattice = t > 6 && (t % 4 === 0 || Math.abs(wv) === 3);
          b.set(x, y, lattice ? PAL.wood : wv === 0 ? PAL.bark : PAL.white);
        }
      }
    }
    b.ellipse(cx, cy, 2.5, 2.5, PAL.bark);
    frames.push(shadowed(b, 28.5, H - 2, 15, 3));
  }
  return strip(frames);
}

/** Erstes Tor (Startpunkt) 88×76 – Steinbogen mit leuchtendem Kartenportal */
export function firstGate(): Raster {
  const W = 88;
  const H = 76;
  const b = new Raster(W, H);
  const st: Ramp = [PAL.shadow, PAL.stone, PAL.mist, PAL.silver];
  // Säulen
  for (const px of [8, 66]) {
    for (let y = 18; y < H - 2; y++) for (let x = px; x < px + 14; x++) {
      const tone = x === px ? 3 : x >= px + 11 ? 1 : (y + x) % 9 === 0 ? 1 : 2;
      b.set(x, y, st[tone]);
    }
    for (let y = 18; y < H - 2; y += 9) hline(b, px, px + 13, y, PAL.stone);
  }
  // Bogen
  for (let y = 4; y < 26; y++) {
    for (let x = 4; x < W - 4; x++) {
      const dx = (x + 0.5 - W / 2) / 40;
      const dy = (y + 0.5 - 28) / 24;
      const d = dx * dx + dy * dy;
      if (d <= 1 && d >= 0.5) {
        const tone = d > 0.9 ? 1 : y < 9 ? 3 : 2;
        b.set(x, y, st[tone]);
      }
    }
  }
  // Schlussstein mit Kartensymbol
  shadedRect(b, 38, 2, 12, 14, RAMPS.gold);
  stencil(b, 40, 5, SIGN_ICONS.card, SIGN_COLORS);
  // Portal-Schimmer
  for (let y = 22; y < H - 3; y++) {
    for (let x = 22; x < 66; x++) {
      const dx = (x + 0.5 - W / 2) / 22;
      const dy = (y + 0.5 - 30) / 16;
      if (y > 30 || dx * dx + dy * dy <= 1) {
        if ((x + y) % 3 === 0) b.set(x, y, PAL.ice, 110);
        else if ((x * 3 + y) % 7 === 0) b.set(x, y, PAL.white, 160);
      }
    }
  }
  return shadowed(b, W / 2, H - 2, 38, 3);
}

/** Casino (Würfelheim) 104×80, 2 Frames (Lichterkette blinkt) */
export function casino(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 2; f++) {
    const base = building({ w: 104, wallH: 44, roofH: 30, roof: RAMPS.red, wall: [PAL.wine, PAL.crimson, PAL.red, PAL.coral], sign: 'dice', windows: 3, seed: 3 });
    const b = new Raster(104, base.h);
    b.blit(base, 0, 0);
    // Leuchtschild
    shadedRect(b, 28, 8, 48, 14, [PAL.plum, PAL.berry, PAL.magenta, PAL.pink]);
    for (let x = 30; x < 74; x += 3) b.set(x, 10 + ((x / 3 + f) % 2) * 9, (x / 3 + f) % 2 ? PAL.gold : PAL.cream);
    stencil(b, 46, 12, SIGN_ICONS.dice, SIGN_COLORS);
    stencil(b, 54, 12, SIGN_ICONS.star, SIGN_COLORS);
    // Glühbirnen an der Traufe
    for (let x = 6; x < 98; x += 4) b.set(x, 31, (x / 4 + f) % 2 ? PAL.gold : PAL.pink);
    frames.push(b);
  }
  return strip(frames);
}

/** Arena Felsenkessel 128×72 */
export function arena(): Raster {
  const W = 128;
  const H = 72;
  const b = new Raster(W, H);
  const st: Ramp = [PAL.shadow, PAL.stone, PAL.mist, PAL.silver];
  for (let y = 14; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const tone = x < 6 ? 3 : x > W - 7 ? 1 : y > H - 6 ? 1 : (Math.floor(x / 8) + Math.floor(y / 6)) % 2 ? 2 : 3;
      b.set(x, y, st[tone]);
    }
  }
  for (let x = 2; x < W - 2; x++) for (let y = 8; y < 14; y++) if (x % 10 < 6) b.set(x, y, y === 8 ? PAL.silver : PAL.mist);
  // Tor
  b.ellipse(W / 2, 40, 16, 14, PAL.ink);
  for (let y = 40; y < H - 2; y++) for (let x = W / 2 - 16; x < W / 2 + 16; x++) b.set(x, y, PAL.ink);
  for (let x = W / 2 - 14; x < W / 2 + 14; x += 4) vline(b, x, 30, H - 3, PAL.stone);
  // Banner
  for (const bx of [24, 98]) {
    for (let y = 18; y < 40; y++) for (let x = bx; x < bx + 8; x++) b.set(x, y, y > 36 && (x - bx) % 4 < 2 ? 0 : x === bx ? PAL.coral : PAL.red);
    stencil(b, bx + 1, 22, SIGN_ICONS.sword, SIGN_COLORS);
  }
  return shadowed(b, W / 2, H - 2, W / 2 - 4, 3);
}

/** Bibliothek / Spiegelsaal: grosses Säulengebäude 96×76 */
export function hall(variant: 'library' | 'mirror' | 'guild'): Raster {
  const W = 96;
  const H = 76;
  const b = new Raster(W, H);
  const wall: Ramp = variant === 'mirror' ? RAMPS.sand : variant === 'guild' ? [PAL.plum, PAL.purple, PAL.mist, PAL.silver] : [PAL.stone, PAL.mist, PAL.silver, PAL.white];
  for (let y = 30; y < H - 2; y++) for (let x = 6; x < W - 6; x++) b.set(x, y, x === 6 ? wall[3] : x === W - 7 ? wall[1] : wall[2]);
  // Säulen
  for (let i = 0; i < 6; i++) {
    const px = 10 + i * 15;
    for (let y = 32; y < H - 4; y++) for (let x = px; x < px + 6; x++) b.set(x, y, x === px ? PAL.white : x === px + 5 ? wall[1] : wall[3]);
  }
  // Stufen
  for (let s = 0; s < 3; s++) hline(b, 4 - s + 4, W - 8 + s - 4, H - 4 + s - 1, s % 2 ? wall[1] : wall[2]);
  // Giebel
  for (let y = 8; y < 31; y++) {
    const half = Math.round(((y - 8) / 22) * (W / 2 - 2));
    for (let x = W / 2 - half; x <= W / 2 + half; x++) {
      const tone = y === 30 ? 0 : x < W / 2 - half + 3 ? 3 : x > W / 2 + half - 3 ? 1 : 2;
      b.set(x, y, wall[tone]);
    }
  }
  if (variant === 'mirror') {
    b.ellipse(W / 2, 18, 9, 7, PAL.ice);
    b.ellipse(W / 2 - 2, 16, 4, 3, PAL.white);
  } else if (variant === 'library') {
    stencil(b, W / 2 - 3, 16, SIGN_ICONS.book, SIGN_COLORS);
  } else stencil(b, W / 2 - 3, 16, SIGN_ICONS.star, SIGN_COLORS);
  // Tür
  shadedRect(b, W / 2 - 7, H - 24, 14, 20, RAMPS.wood);
  b.ellipse(W / 2, H - 24, 7, 3, PAL.bark);
  return shadowed(b, W / 2, H - 2, W / 2 - 4, 3);
}

/** Zelt 40×32 */
export function tent(ramp: Ramp = RAMPS.orange): Raster {
  const b = new Raster(40, 32);
  for (let y = 4; y < 30; y++) {
    const half = Math.round(((y - 4) / 25) * 18);
    for (let x = 20 - half; x <= 20 + half; x++) {
      const stripe = Math.floor((x - (20 - half)) / 4) % 2;
      const tone = x < 20 - half + 2 ? 3 : x > 20 + half - 3 ? 1 : stripe ? 2 : 3;
      b.set(x, y, ramp[tone]);
    }
  }
  for (let y = 18; y < 30; y++) {
    const half = Math.round(((y - 18) / 11) * 5);
    for (let x = 20 - half; x <= 20 + half; x++) b.set(x, y, PAL.bark);
  }
  vline(b, 20, 0, 4, PAL.wood);
  b.set(21, 0, PAL.red);
  b.set(22, 1, PAL.red);
  return shadowed(b, 20, 30, 18, 2);
}

/** Marktstand 40×36 */
export function stall(ramp: Ramp = RAMPS.teal): Raster {
  const b = new Raster(40, 36);
  shadedRect(b, 4, 20, 32, 12, RAMPS.wood);
  for (const x of [5, 33]) vline(b, x, 8, 32, PAL.bark);
  for (let y = 4; y < 12; y++) for (let x = 2; x < 38; x++) b.set(x, y, Math.floor(x / 4) % 2 ? ramp[2] : PAL.white);
  for (let x = 2; x < 38; x += 4) b.ellipse(x + 2, 12, 2, 1.5, Math.floor(x / 4) % 2 ? ramp[2] : PAL.white);
  // Waren
  const goods = [PAL.red, PAL.gold, PAL.lime, PAL.orange, PAL.pink, PAL.sky];
  for (let i = 0; i < 6; i++) b.ellipse(9 + i * 4.5, 19, 2, 1.8, goods[i]);
  return shadowed(b, 20, 33, 17, 2);
}

// ---------------------------------------------------------------------------
// Natur
// ---------------------------------------------------------------------------

/** Laubbaum mit eigener Rampe 32×44 */
export function treeColored(ramp: Ramp, trunk: Ramp = RAMPS.wood, seed = 1, extra?: number): Raster {
  const b = new Raster(32, 44);
  shadedRect(b, 13, 27, 6, 14, trunk);
  vline(b, 16, 30, 38, trunk[0]);
  const circles: Circle[] = [
    { x: 16, y: 17, r: 12 },
    { x: 7.5, y: 20, r: 6.5 },
    { x: 24.5, y: 20, r: 6.5 },
    { x: 10, y: 10, r: 7 },
    { x: 22, y: 10, r: 7 },
    { x: 16, y: 6.5, r: 6 },
    { x: 16, y: 24, r: 6 },
  ];
  shadedBlobs(b, circles, ramp, { leafy: 0.35, seed: 20 + seed, highlight: ramp[3] });
  if (extra !== undefined) {
    const r = rng(seed * 7);
    for (let i = 0; i < 8; i++) {
      const x = 6 + Math.floor(r() * 20);
      const y = 5 + Math.floor(r() * 20);
      if (!b.isEmpty(x, y)) b.set(x, y, extra);
    }
  }
  return shadowed(b, 16.5, 41, 11, 3.5);
}

/** Toter Baum 28×40 (Nebelhain) */
export function deadTree(): Raster {
  const b = new Raster(28, 40);
  const bark: Ramp = [PAL.night, PAL.shadow, PAL.stone, PAL.mist];
  const branch = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      const w = t * (1 - k / n) + 0.6;
      for (let dx = -w; dx <= w; dx += 0.5) b.set(Math.round(x + dx), Math.round(y), dx < -w / 2 ? bark[3] : dx > w / 2 ? bark[1] : bark[2]);
    }
  };
  branch(14, 38, 13, 14, 3);
  branch(13, 22, 5, 10, 1.5);
  branch(13, 18, 22, 6, 1.6);
  branch(8, 13, 4, 4, 0.8);
  branch(19, 10, 25, 9, 0.8);
  branch(13, 15, 14, 3, 1);
  return shadowed(b, 14, 38, 8, 2.5);
}

/** Verschneiter Nadelbaum 24×44 */
export function snowPine(): Raster {
  const b = new Raster(24, 44);
  shadedRect(b, 10, 33, 4, 8, RAMPS.wood);
  const tiers = [
    { top: 2, bottom: 16, half: 6 },
    { top: 9, bottom: 25, half: 9 },
    { top: 17, bottom: 35, half: 11 },
  ];
  const ramp: Ramp = [PAL.deepTeal, PAL.forest, PAL.pine, PAL.leaf];
  for (const t of tiers) {
    for (let y = t.top; y <= t.bottom; y++) {
      const f = (y - t.top) / (t.bottom - t.top);
      const half = Math.round(1 + f * t.half);
      for (let x = 12 - half; x < 12 + half; x++) {
        const rel = (x - 12) / half;
        let c: number = ramp[rel > 0.35 ? 1 : rel < -0.45 ? 3 : 2];
        if (f < 0.35 || (y === t.bottom - 1 && (x + y) % 2 === 0)) c = rel > 0.3 ? PAL.silver : PAL.white;
        b.set(x, y, c);
      }
    }
  }
  return shadowed(b, 12.5, 41, 9, 3);
}

/** Palme 32×46 */
export function palm(): Raster {
  const b = new Raster(32, 46);
  for (let y = 14; y < 44; y++) {
    const x = Math.round(16 + Math.sin((y - 14) / 10) * 3);
    for (let dx = -2; dx <= 1; dx++) b.set(x + dx, y, dx === -2 ? PAL.skinShade : y % 4 === 0 ? PAL.wood : dx === 1 ? PAL.wood : PAL.tan);
  }
  const fronds = [
    [-14, 4],
    [14, 4],
    [-10, -6],
    [10, -6],
    [0, -9],
    [-15, 10],
    [15, 10],
  ];
  for (const [fx, fy] of fronds) {
    for (let t = 0; t <= 1; t += 0.04) {
      const x = 17 + fx * t;
      const y = 13 + fy * t + Math.sin(t * Math.PI) * -3 + t * t * 6;
      for (let w = -1.5; w <= 1.5; w += 0.5) b.set(Math.round(x), Math.round(y + w * (1 - t)), w < 0 ? PAL.grass : PAL.leaf);
    }
  }
  b.ellipse(16, 14, 3, 2.5, PAL.wood);
  b.set(15, 13, PAL.tan);
  return shadowed(b, 17, 44, 9, 2.5);
}

/** Kaktus 16×26 */
export function cactusPlant(): Raster {
  const b = new Raster(16, 26);
  const g: Ramp = RAMPS.green;
  for (let y = 3; y < 24; y++) for (let x = 6; x < 11; x++) b.set(x, y, x === 6 ? g[3] : x === 10 ? g[1] : g[2]);
  for (let y = 9; y < 15; y++) for (let x = 1; x < 4; x++) b.set(x, y, x === 1 ? g[3] : g[2]);
  for (let x = 1; x < 7; x++) for (let y = 14; y < 17; y++) b.set(x, y, g[2]);
  for (let y = 6; y < 12; y++) for (let x = 12; x < 15; x++) b.set(x, y, x === 14 ? g[1] : g[2]);
  for (let x = 10; x < 15; x++) for (let y = 11; y < 14; y++) b.set(x, y, g[1]);
  b.ellipse(8.5, 3, 2.5, 2.5, g[2]);
  for (const [x, y] of [[7, 6], [9, 10], [7, 15], [9, 19], [2, 11], [13, 8]]) b.set(x, y, PAL.lime);
  b.set(8, 1, PAL.pink);
  b.set(9, 1, PAL.magenta);
  return shadowed(b, 8.5, 24, 5, 1.5);
}

/** Rosenbusch 20×18 */
export function rosebush(): Raster {
  const b = new Raster(20, 18);
  shadedBlobs(
    b,
    [
      { x: 6, y: 11, r: 5 },
      { x: 14, y: 11, r: 5 },
      { x: 10, y: 8, r: 5.5 },
    ],
    [PAL.forest, PAL.pine, PAL.leaf, PAL.grass],
    { leafy: 0.3, seed: 31, highlight: PAL.lime },
  );
  for (const [x, y, c] of [[5, 9, PAL.red], [12, 6, PAL.pink], [15, 11, PAL.red], [9, 12, PAL.pink], [10, 8, PAL.red]] as [number, number, number][]) {
    b.ellipse(x, y, 1.6, 1.6, c);
    b.set(x, y, PAL.white);
  }
  return shadowed(b, 10, 16, 8, 2);
}

/** Hecke (Rosenweil) 16×22 – nahtlos aneinanderreihbar */
export function hedge(): Raster {
  const b = new Raster(16, 22);
  for (let y = 2; y < 20; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (x * 7 + y * 13) % 5;
      const tone = y < 4 ? 3 : y > 17 ? 0 : n === 0 ? 1 : n === 1 ? 3 : 2;
      b.set(x, y, [PAL.forest, PAL.pine, PAL.leaf, PAL.grass][tone]);
    }
  }
  b.set(4, 8, PAL.pink);
  b.set(11, 13, PAL.red);
  b.set(7, 16, PAL.pink);
  const out = new Raster(16, 22);
  out.fillRect(0, 19, 16, 2, PAL.ink, 60);
  out.blit(b, 0, 0);
  for (let x = 0; x < 16; x++) {
    out.set(x, 1, PAL.ink);
    out.set(x, 20, PAL.ink);
  }
  return out;
}

/** Leuchtpilz (Nebelhain) 20×24 */
export function glowShroom(): Raster {
  const b = new Raster(20, 24);
  for (let y = 12; y < 23; y++) for (let x = 8; x < 12; x++) b.set(x, y, x === 8 ? PAL.white : x === 11 ? PAL.mist : PAL.silver);
  for (let y = 2; y < 13; y++) {
    const half = Math.round(Math.sqrt(1 - ((y - 12) / 10) ** 2) * 9);
    for (let x = 10 - half; x <= 10 + half; x++) b.set(x, y, y > 10 ? PAL.teal : x < 10 - half + 3 ? PAL.ice : PAL.cyan);
  }
  for (const [x, y] of [[6, 6], [12, 4], [14, 8], [9, 9]]) b.set(x, y, PAL.white);
  return shadowed(b, 10, 22, 6, 1.5);
}

/** Kristall (Glimmerhöhle) 16×22 */
export function crystal(ramp: Ramp = RAMPS.ice): Raster {
  const b = new Raster(16, 22);
  const shard = (cx: number, top: number, w: number) => {
    for (let y = top; y < 20; y++) {
      const half = Math.min(w, Math.round(((y - top) / 4) * w));
      for (let x = cx - half; x <= cx + half; x++) b.set(x, y, x < cx ? ramp[3] : x === cx ? ramp[2] : ramp[1]);
    }
  };
  shard(5, 8, 2);
  shard(11, 6, 2);
  shard(8, 1, 3);
  return shadowed(b, 8, 20, 6, 1.5);
}

/** Ruinensäule 16×36 (variant 1: abgebrochen) */
export function ruinPillar(broken = false): Raster {
  const b = new Raster(16, 36);
  const top = broken ? 16 : 4;
  for (let y = top; y < 34; y++) for (let x = 3; x < 13; x++) b.set(x, y, x === 3 ? PAL.silver : x > 10 ? PAL.stone : (x - 3) % 3 === 0 ? PAL.mist : PAL.silver);
  shadedRect(b, 1, top - 3, 14, 4, RAMPS.silver);
  shadedRect(b, 1, 31, 14, 4, RAMPS.grey);
  if (broken) {
    b.set(4, top - 4, PAL.silver);
    b.set(9, top - 5, PAL.mist);
  }
  // Moos
  for (const [x, y] of [[4, top + 6], [10, top + 12], [5, 28]]) {
    b.set(x, y, PAL.leaf);
    b.set(x + 1, y, PAL.grass);
  }
  return shadowed(b, 8, 34, 7, 2);
}

/** Statue 20×38, 4 Frames (Blickrichtung unten/links/oben/rechts) – für das Statuenrätsel */
export function statue(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 4; f++) {
    const b = new Raster(20, 38);
    shadedRect(b, 2, 28, 16, 8, RAMPS.grey);
    const st: Ramp = [PAL.shadow, PAL.stone, PAL.mist, PAL.silver];
    b.ellipse(10, 20, 5, 8, st[2]);
    b.ellipse(10, 9, 4.5, 4.5, st[2]);
    b.ellipse(9, 8, 2, 2, st[3]);
    // Arm zeigt in Blickrichtung
    const dirs: [number, number][] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    const [dx, dy] = dirs[f];
    for (let t = 0; t < 7; t++) b.set(Math.round(10 + dx * t), Math.round(17 + dy * t), st[1]);
    if (f === 0) b.set(8, 9, PAL.ink), b.set(11, 9, PAL.ink);
    if (f === 1) b.set(7, 9, PAL.ink);
    if (f === 3) b.set(12, 9, PAL.ink);
    frames.push(shadowed(b, 10, 36, 8, 2));
  }
  return strip(frames);
}

/** Nebelwand (braucht Laterne) 32×40, 3 Frames */
export function fogWall(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 3; f++) {
    const b = new Raster(32, 40);
    const r = rng(40 + f);
    for (let i = 0; i < 9; i++) {
      const x = 4 + r() * 24;
      const y = 8 + r() * 26;
      b.ellipse(x, y, 6 + r() * 4, 5 + r() * 3, PAL.silver, 120);
      b.ellipse(x - 1, y - 1, 3, 2.5, PAL.white, 140);
    }
    frames.push(b);
  }
  return strip(frames);
}

/** Rankenwand (Kletterranke) 16×40 */
export function vineWall(): Raster {
  const b = new Raster(16, 40);
  for (let y = 0; y < 38; y++) for (let x = 0; x < 16; x++) b.set(x, y, (x + y * 3) % 7 === 0 ? PAL.shadow : (x * 3 + y) % 5 === 0 ? PAL.mist : PAL.stone);
  for (let y = 2; y < 38; y++) {
    const x = Math.round(8 + Math.sin(y / 4) * 4);
    b.set(x, y, PAL.leaf);
    b.set(x + 1, y, PAL.pine);
    if (y % 5 === 0) {
      b.set(x - 1, y - 1, PAL.grass);
      b.set(x + 2, y + 1, PAL.grass);
    }
  }
  return shadowed(b, 8, 38, 7, 2);
}

/** Höhleneingang 40×32 */
export function caveEntrance(): Raster {
  const b = new Raster(40, 32);
  const st: Ramp = [PAL.shadow, PAL.stone, PAL.mist, PAL.silver];
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 40; x++) {
      const dx = (x + 0.5 - 20) / 20;
      const dy = (y + 0.5 - 30) / 30;
      if (dx * dx + dy * dy > 1) continue;
      const hole = ((x + 0.5 - 20) / 11) ** 2 + ((y + 0.5 - 30) / 18) ** 2 < 1;
      b.set(x, y, hole ? (y > 26 ? PAL.night : PAL.ink) : st[(x + y) % 6 === 0 ? 1 : x < 12 ? 3 : 2]);
    }
  }
  return shadowed(b, 20, 30, 18, 2);
}

/** Treppe nach unten (Labyrinth) 32×24 */
export function stairsDown(): Raster {
  const b = new Raster(32, 24);
  for (let s = 0; s < 5; s++) {
    for (let y = 4 + s * 4; y < 8 + s * 4; y++) for (let x = 2 + s * 2; x < 30 - s * 2; x++) b.set(x, y, y === 4 + s * 4 ? PAL.silver : s > 2 ? PAL.night : PAL.stone);
  }
  shadedRect(b, 0, 0, 32, 4, RAMPS.grey);
  b.outline(PAL.ink);
  return b;
}

/** Infotafel / Rangliste 30×30 */
export function board(): Raster {
  const b = new Raster(30, 30);
  for (const x of [4, 24]) vline(b, x, 6, 28, PAL.bark), vline(b, x + 1, 6, 28, PAL.wood);
  shadedRect(b, 1, 3, 28, 18, RAMPS.wood);
  for (let y = 5; y < 19; y++) for (let x = 3; x < 27; x++) b.set(x, y, PAL.sandLight);
  for (const [x, y] of [[5, 7], [16, 6], [7, 12], [17, 12]]) {
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 8; xx++) b.set(x + xx, y + yy, yy === 0 ? PAL.coral : PAL.white);
    b.set(x + 3, y, PAL.red);
  }
  return shadowed(b, 15, 28, 12, 2);
}

/** Boot 48×24 */
export function boat(): Raster {
  const b = new Raster(48, 24);
  for (let y = 12; y < 22; y++) {
    const inset = Math.round(((y - 12) / 10) * 8);
    for (let x = 2 + inset; x < 46 - inset; x++) b.set(x, y, y === 12 ? PAL.tan : y % 3 === 0 ? PAL.wood : PAL.skinShade);
  }
  vline(b, 24, 0, 12, PAL.bark);
  for (let y = 1; y < 11; y++) for (let x = 25; x < 25 + Math.round((y / 10) * 14); x++) b.set(x, y, PAL.white);
  b.outline(PAL.ink);
  return b;
}

/** Bank 24×14 */
export function bench(): Raster {
  const b = new Raster(24, 14);
  shadedRect(b, 1, 2, 22, 3, RAMPS.wood);
  shadedRect(b, 1, 7, 22, 3, RAMPS.wood);
  for (const x of [3, 19]) vline(b, x, 5, 13, PAL.bark);
  return shadowed(b, 12, 13, 10, 1.5);
}

/** Brunnen mit Wasserspiel (Runenhall) 40×36, 3 Frames */
export function fountain(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 3; f++) {
    const b = new Raster(40, 36);
    b.ellipse(20, 26, 18, 8, PAL.stone);
    b.ellipse(20, 25, 16, 6.5, PAL.mist);
    b.ellipse(20, 25, 14, 5, PAL.blue);
    b.ellipse(18, 24, 8, 2.5, PAL.sky);
    shadedRect(b, 17, 10, 6, 15, RAMPS.silver);
    b.ellipse(20, 10, 6, 2.5, PAL.mist);
    // Wasserstrahl
    for (let i = 0; i < 6; i++) {
      const y = 2 + i * 1.5 + ((f + i) % 3);
      b.set(20 + ((i + f) % 2 ? -1 : 1) * Math.floor(i / 2), Math.round(y), PAL.skyLight);
      b.set(20, Math.round(y), PAL.white);
    }
    for (const [x, y] of [[10, 25], [29, 26], [20, 28]]) b.set(x + ((f * 3) % 4) - 2, y, PAL.white);
    frames.push(shadowed(b, 20, 33, 18, 2));
  }
  return strip(frames);
}

/** Blumenkübel 12×14 */
export function flowerpot(): Raster {
  const b = new Raster(12, 14);
  shadedRect(b, 2, 7, 8, 6, RAMPS.orange);
  b.ellipse(6, 5, 4.5, 3.5, PAL.leaf);
  b.set(4, 4, PAL.pink);
  b.set(7, 3, PAL.red);
  b.set(8, 5, PAL.gold);
  return shadowed(b, 6, 13, 5, 1.5);
}

/** Pusteblume (sammelbar) 10×14 */
export function dandelion(): Raster {
  const b = new Raster(10, 14);
  vline(b, 5, 6, 13, PAL.leaf);
  b.ellipse(5, 4, 3.5, 3.5, PAL.white);
  b.set(5, 4, PAL.silver);
  b.set(3, 11, PAL.grass);
  b.set(7, 10, PAL.grass);
  return shadowed(b, 5, 13, 3, 1);
}

/** Glänzende Stelle (versteckte Karte / Grabstelle) 12×8, 2 Frames */
export function sparkleSpot(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 2; f++) {
    const b = new Raster(12, 8);
    b.ellipse(6, 5, 5, 2.5, PAL.tan, 160);
    b.set(4 + f * 3, 3, PAL.white);
    b.set(8 - f * 3, 5, PAL.cream);
    frames.push(b);
  }
  return strip(frames);
}

// ---------------------------------------------------------------------------
// Meilenstein 6: Quest-Objekte
// ---------------------------------------------------------------------------

/** Liegende Sphinx aus Sandstein 56×44, Fusspunkt (28, 42) */
export function sphinx(): Raster {
  const b = new Raster(56, 44);
  const st: Ramp = [PAL.tan, PAL.sandShade, PAL.sand, PAL.sandLight];
  // Sockel
  shadedRect(b, 2, 34, 52, 8, st);
  hline(b, 2, 54, 34, st[3]);
  // Körper (liegend)
  b.ellipse(32, 28, 18, 7, st[2]);
  b.ellipse(30, 25, 14, 4, st[3]);
  // Vorderpfoten
  b.fillRect(6, 29, 14, 4, st[2]);
  hline(b, 6, 20, 29, st[3]);
  b.fillRect(6, 32, 14, 2, st[1]);
  // Kopf mit Kopftuch
  b.ellipse(16, 14, 8, 9, st[2]);
  b.fillRect(8, 12, 3, 12, PAL.teal);
  b.fillRect(21, 12, 3, 12, PAL.teal);
  for (let y = 12; y < 24; y += 3) {
    hline(b, 8, 10, y, PAL.gold);
    hline(b, 21, 23, y, PAL.gold);
  }
  b.fillRect(10, 5, 12, 4, PAL.teal);
  hline(b, 10, 21, 6, PAL.gold);
  // Gesicht
  b.ellipse(16, 15, 5, 6, st[3]);
  b.set(14, 14, PAL.ink);
  b.set(18, 14, PAL.ink);
  b.set(14, 13, PAL.cyan);
  b.set(18, 13, PAL.cyan);
  hline(b, 15, 17, 19, st[0]);
  // Schwanz
  for (let t = 0; t < 8; t++) b.set(49 + Math.round(Math.sin(t / 2) * 1.5), 30 - t, st[1]);
  // Hieroglyphen-Muster auf dem Sockel
  for (let x = 6; x < 52; x += 6) {
    b.set(x, 37, st[0]);
    b.set(x + 1, 38, st[0]);
    b.set(x + 2, 37, st[0]);
  }
  return shadowed(b, 28, 42, 26, 3);
}

/** Kontrollfahne für das Zeitrennen 2 Frames 14×26, Fusspunkt (4, 25) */
export function checkpoint(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 2; f++) {
    const b = new Raster(14, 26);
    vline(b, 3, 2, 24, PAL.wood);
    vline(b, 4, 2, 24, PAL.bark);
    b.set(3, 1, PAL.gold);
    b.set(4, 1, PAL.gold);
    for (let y = 3; y < 11; y++) {
      const len = 9 - Math.abs(y - 7) + (f === 1 && y % 2 ? -1 : 0);
      hline(b, 5, 4 + len, y, y < 7 ? PAL.cyan : PAL.blue);
    }
    b.set(7, 6, PAL.white);
    b.set(8, 7, PAL.white);
    b.outline(PAL.ink);
    frames.push(b);
  }
  return strip(frames);
}
