import { PAL } from '../palette';
import { Raster, rng } from '../Raster';
import { strip } from '../draw';

/**
 * Effekt-Grafiken. Alle Effekte sind weiss/hell gezeichnet und werden zur Laufzeit
 * eingefärbt (Tint) – so bekommt jede Aura-Affinität und Zauberkategorie ihre Farbe.
 */

/** Schlag-Bogen 40×40, 3 Frames, Ausrichtung nach rechts (wird zur Laufzeit gedreht). */
export function slash(): Raster {
  const frames: Raster[] = [];
  const S = 40;
  const spans: [number, number][] = [
    [-1.5, -0.2],
    [-1.3, 1.2],
    [0.4, 1.5],
  ];
  spans.forEach(([a0, a1], f) => {
    const r = new Raster(S, S);
    const cx = 12;
    const cy = 20;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const a = Math.atan2(dy, dx);
        if (a < a0 || a > a1) continue;
        // Sichelform: dicker in der Mitte des Bogens
        const t = (a - a0) / (a1 - a0);
        const thick = 3 + Math.sin(t * Math.PI) * (f === 1 ? 8 : 5);
        const outer = 19;
        if (d > outer || d < outer - thick) continue;
        const edge = outer - d;
        let c: number = PAL.white;
        let alpha = f === 2 ? 170 : 255;
        if (edge > thick - 2) {
          c = PAL.ice;
          alpha = Math.round(alpha * 0.7);
        }
        r.set(x, y, c, alpha);
      }
    }
    frames.push(r);
  });
  return strip(frames);
}

/** Staubwolke 12×12, 4 Frames */
export function dust(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 4; f++) {
    const r = new Raster(12, 12);
    const rad = 2.5 + f * 1.1;
    const alpha = 230 - f * 50;
    r.ellipse(6, 7, rad, rad * 0.8, PAL.silver, alpha);
    r.ellipse(5.3, 6.2, rad * 0.6, rad * 0.5, PAL.white, alpha);
    frames.push(r);
  }
  return strip(frames);
}

/** Funkeln 7×7, 4 Frames */
export function sparkle(): Raster {
  const frames: Raster[] = [];
  const shapes = [
    ['.......', '.......', '...#...', '..###..', '...#...', '.......', '.......'],
    ['.......', '...#...', '...#...', '.##o##.', '...#...', '...#...', '.......'],
    ['...#...', '...#...', '..#o#..', '##ooo##', '..#o#..', '...#...', '...#...'],
    ['.......', '...#...', '.......', '.#.o.#.', '.......', '...#...', '.......'],
  ];
  for (const s of shapes) {
    const r = new Raster(7, 7);
    s.forEach((row, y) => {
      for (let x = 0; x < 7; x++) {
        if (row[x] === '#') r.set(x, y, PAL.white);
        if (row[x] === 'o') r.set(x, y, PAL.cream);
      }
    });
    frames.push(r);
  }
  return strip(frames);
}

/** Aura-Flammen 36×44, 4 Frames – wird hinter der Figur additiv gezeichnet und eingefärbt. */
export function auraFlame(): Raster {
  const frames: Raster[] = [];
  const W = 36;
  const H = 44;
  const cx = W / 2;
  const bottom = 40;
  for (let f = 0; f < 4; f++) {
    const r = new Raster(W, H);
    const rand = rng(900 + f);
    // Höhe der Flamme pro Spalte: Körperform + flackernde Zungen
    const heights: number[] = [];
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - cx) / 15;
      if (dx >= 1) {
        heights.push(0);
        continue;
      }
      const body = Math.sqrt(1 - dx * dx) * 30;
      const tongue = Math.max(0, Math.sin(x * 1.05 + f * 1.6)) * 7 + Math.max(0, Math.sin(x * 0.45 - f * 2.1)) * 5;
      heights.push(Math.round(body + tongue * (1 - dx * 0.5)));
    }
    for (let x = 0; x < W; x++) {
      const h = heights[x];
      if (h <= 0) continue;
      const top = bottom - h;
      for (let y = Math.max(0, top); y <= bottom; y++) {
        const edgeTop = y - top;
        const side = Math.min(
          x > 0 && heights[x - 1] < bottom - y ? 0 : 9,
          x < W - 1 && heights[x + 1] < bottom - y ? 0 : 9,
        );
        if (edgeTop < 2 || side === 0) r.set(x, y, PAL.white, 235);
        else if (edgeTop < 4) r.set(x, y, PAL.ice, 150);
        else if ((x + y + f) % 3 === 0) r.set(x, y, PAL.ice, 55);
      }
    }
    // aufsteigende Funken
    for (let i = 0; i < 6; i++) {
      const x = 4 + Math.floor(rand() * 28);
      const y = ((Math.floor(rand() * 30) - f * 6) % 30 + 30) % 30;
      r.set(x, y, PAL.white, 255);
      r.set(x, y + 1, PAL.ice, 160);
    }
    frames.push(r);
  }
  return strip(frames);
}

/** Aufprall-Blitz 24×24, 3 Frames (für Meilenstein 3 bereits vorbereitet) */
export function impact(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 3; f++) {
    const r = new Raster(24, 24);
    const spikes = 8;
    const inner = 3 + f * 2;
    const outer = 9 + f * 2;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const dx = x + 0.5 - 12;
        const dy = y + 0.5 - 12;
        const d = Math.sqrt(dx * dx + dy * dy);
        const a = Math.atan2(dy, dx);
        const spike = (Math.cos(a * spikes) + 1) / 2;
        const lim = inner + (outer - inner) * spike ** 3;
        if (d <= lim && (f < 2 || d > lim - 2.5)) r.set(x, y, d < inner ? PAL.white : PAL.cream);
      }
    }
    frames.push(r);
  }
  return strip(frames);
}

/**
 * Projektile 12×12, je ein Frame pro Art (Reihenfolge = PROJ_FRAMES):
 * Aura-Kugel, Schlamm, Stachel, Feder, Rune, Funke, Tinte, Blatt, Seite, Irrlicht-Kugel.
 * Ausrichtung nach rechts (wird zur Laufzeit gedreht).
 */
export const PROJ_FRAMES = ['aura', 'mud', 'spike', 'feather', 'rune', 'spark', 'ink', 'leaf', 'page', 'orb'] as const;

export function projectiles(): Raster {
  const S = 12;
  const frames: Raster[] = [];
  const disc = (r: Raster, cx: number, cy: number, rad: number, c: number, a = 255) => r.ellipse(cx, cy, rad, rad, c, a);
  for (const kind of PROJ_FRAMES) {
    const r = new Raster(S, S);
    switch (kind) {
      case 'aura':
        disc(r, 6, 6, 5, PAL.ice, 160);
        disc(r, 6, 6, 3.6, PAL.white);
        r.set(4, 4, PAL.cream);
        break;
      case 'mud':
        disc(r, 6, 6, 3.6, PAL.wood);
        disc(r, 5.4, 5.4, 2, PAL.tan);
        r.set(9, 7, PAL.bark);
        r.set(2, 8, PAL.wood);
        break;
      case 'spike':
        for (let x = 1; x < 11; x++) r.set(x, 6, x > 8 ? PAL.white : PAL.lime);
        for (let x = 2; x < 8; x++) r.set(x, 5, PAL.leaf);
        break;
      case 'feather':
        for (let x = 1; x < 11; x++) {
          r.set(x, 6, PAL.tan);
          if (x > 2 && x < 10) {
            r.set(x, 5, PAL.cream);
            r.set(x, 7, PAL.sand);
          }
        }
        break;
      case 'rune':
        disc(r, 6, 6, 4.5, PAL.cyan, 200);
        disc(r, 6, 6, 2.6, PAL.white);
        r.set(6, 3, PAL.ice);
        r.set(6, 9, PAL.ice);
        break;
      case 'spark':
        disc(r, 6, 6, 3.5, PAL.gold);
        disc(r, 6, 6, 2, PAL.white);
        r.set(1, 6, PAL.cream);
        r.set(11, 5, PAL.cream);
        r.set(6, 0, PAL.cream);
        break;
      case 'ink':
        disc(r, 6, 6, 4, PAL.plum);
        disc(r, 5, 5, 2, PAL.purple);
        r.set(4, 4, PAL.violet);
        break;
      case 'leaf':
        r.ellipse(6, 6, 5, 2.6, PAL.leaf);
        for (let x = 2; x < 10; x++) r.set(x, 6, PAL.lime);
        break;
      case 'page':
        r.fillRect(3, 3, 7, 6, PAL.sandLight);
        r.fillRect(3, 8, 7, 1, PAL.sandShade);
        r.set(4, 5, PAL.stone);
        r.set(6, 5, PAL.stone);
        r.set(5, 6, PAL.stone);
        break;
      case 'orb':
        disc(r, 6, 6, 5, PAL.teal, 140);
        disc(r, 6, 6, 3.4, PAL.ice);
        disc(r, 6, 6, 1.6, PAL.white);
        break;
    }
    r.outline(PAL.ink);
    frames.push(r);
  }
  return strip(frames);
}

/** Schockwellen-Ring 48×48, 4 Frames (weiss, wird eingefärbt) */
export function ring(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 4; f++) {
    const r = new Raster(48, 48);
    const outer = 8 + f * 5;
    const thick = 4 - f * 0.7;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const d = Math.hypot(x + 0.5 - 24, (y + 0.5 - 24) * 1.25);
        if (d <= outer && d >= outer - thick) r.set(x, y, d > outer - 1.2 ? PAL.white : PAL.ice, f === 3 ? 150 : 255);
      }
    }
    frames.push(r);
  }
  return strip(frames);
}

/** Wurzeln aus dem Boden 16×20, 3 Frames */
export function roots(): Raster {
  const frames: Raster[] = [];
  const heights = [6, 14, 10];
  heights.forEach((h) => {
    const r = new Raster(16, 20);
    const spikes = [3, 8, 12];
    spikes.forEach((x, i) => {
      const hh = h - (i === 1 ? 0 : 3);
      for (let y = 0; y < hh; y++) {
        const w = Math.max(1, Math.round(2.4 * (1 - y / hh)));
        for (let k = -w + 1; k < w; k++) r.set(x + k, 19 - y, k < 0 ? PAL.leaf : y > hh - 3 ? PAL.lime : PAL.pine);
      }
    });
    r.outline(PAL.ink);
    frames.push(r);
  });
  return strip(frames);
}

/** Rauchwolke 16×16, 4 Frames */
export function poof(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 4; f++) {
    const r = new Raster(16, 16);
    const rad = 3 + f * 1.4;
    const a = 255 - f * 55;
    const puffs: [number, number][] = [
      [8, 9],
      [5, 7],
      [11, 7],
      [8, 5],
    ];
    for (const [px, py] of puffs) {
      const ox = (px - 8) * (0.6 + f * 0.25);
      const oy = (py - 8) * (0.6 + f * 0.25);
      r.ellipse(8 + ox, 8 + oy, rad * 0.62, rad * 0.62, PAL.silver, a);
      r.ellipse(7.5 + ox, 7.5 + oy, rad * 0.4, rad * 0.4, PAL.white, a);
    }
    frames.push(r);
  }
  return strip(frames);
}

/** Kritischer-Treffer-Stern 15×15, 3 Frames */
export function critStar(): Raster {
  const frames: Raster[] = [];
  for (let f = 0; f < 3; f++) {
    const r = new Raster(15, 15);
    const len = 4 + f * 2.5;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const l = a % 2 === 0 ? len : len * 0.55;
      for (let t = 0; t <= l; t += 0.5) r.set(Math.round(7 + Math.cos(ang) * t), Math.round(7 + Math.sin(ang) * t), t < 2 ? PAL.white : PAL.gold);
    }
    frames.push(r);
  }
  return strip(frames);
}

/** Aura-Schild-Blase 30×34 (weiss, wird eingefärbt) */
export function shieldBubble(): Raster {
  const r = new Raster(30, 34);
  for (let y = 0; y < 34; y++) {
    for (let x = 0; x < 30; x++) {
      const dx = (x + 0.5 - 15) / 14;
      const dy = (y + 0.5 - 17) / 16;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      if (d > 0.86) r.set(x, y, PAL.white, 230);
      else if (d > 0.7) r.set(x, y, PAL.ice, 90);
      else if ((x + y) % 4 === 0) r.set(x, y, PAL.ice, 40);
    }
  }
  r.set(8, 7, PAL.white);
  r.set(9, 6, PAL.white);
  r.set(7, 9, PAL.white);
  return r;
}

/** Ausrufezeichen über Gegnern (Angriffsankündigung) 7×11 */
export function alertMark(): Raster {
  const r = new Raster(7, 11);
  r.fillRect(2, 0, 3, 7, PAL.gold);
  r.fillRect(2, 8, 3, 3, PAL.gold);
  r.fillRect(3, 0, 1, 6, PAL.cream);
  r.outline(PAL.ink);
  return r;
}

/** Aura-Netz 64×48 (goldene Fäden) */
export function auraNet(): Raster {
  const r = new Raster(64, 48);
  const cx = 32;
  const cy = 24;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    for (let t = 0; t < 30; t += 0.5) r.set(Math.round(cx + Math.cos(ang) * t), Math.round(cy + Math.sin(ang) * t * 0.75), PAL.gold, 220);
  }
  for (let ringR = 8; ringR <= 30; ringR += 7) {
    for (let a = 0; a < 360; a += 3) {
      const ang = (a * Math.PI) / 180;
      r.set(Math.round(cx + Math.cos(ang) * ringR), Math.round(cy + Math.sin(ang) * ringR * 0.75), PAL.cream, 200);
    }
  }
  return r;
}

/** Münze (Beute) 7×7, 4 Frames (drehend) */
export function coin(): Raster {
  const frames: Raster[] = [];
  const widths = [3, 2, 1, 2];
  for (const w of widths) {
    const r = new Raster(7, 7);
    r.ellipse(3.5, 3.5, w, 3, PAL.gold);
    if (w > 1) r.set(3, 2, PAL.cream);
    r.outline(PAL.ink);
    frames.push(r);
  }
  return strip(frames);
}
