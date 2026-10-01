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
