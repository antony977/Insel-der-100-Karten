import { PAL, RAMPS, type Ramp } from '../palette';
import { LabelCanvas, type MaterialMap } from '../SpriteComposer';
import { Raster } from '../Raster';
import { strip } from '../draw';

/**
 * Generator für Monster-Sprites. Jede Art wird aus einfachen Formen (Ellipsen, Dreiecke,
 * Linien) auf eine Material-Schablone gezeichnet – Cel-Shading und Umriss entstehen
 * automatisch, damit alle Monster zum Stil der Figuren passen.
 *
 * Spritesheet-Layout (für spätere PNG-Ersetzung): quadratische Frames, Blick nach LINKS,
 * 7 Spalten: 0 idle0, 1 idle1, 2 lauf0, 3 lauf1, 4 Angriff, 5 Treffer, 6 Spezial (Tarnung,
 * eingegraben, erschöpft …). Fusspunkt: Mitte unten (x = S/2, y = S − 1).
 */

export const CREATURE_FRAMES = 7;

export interface Pose {
  i: number;
  bob: number;
  step: number;
  atk: boolean;
  hurt: boolean;
  special: boolean;
}

const POSES: Pose[] = [
  { i: 0, bob: 0, step: 0, atk: false, hurt: false, special: false },
  { i: 1, bob: 1, step: 0, atk: false, hurt: false, special: false },
  { i: 2, bob: 0, step: 1, atk: false, hurt: false, special: false },
  { i: 3, bob: -1, step: -1, atk: false, hurt: false, special: false },
  { i: 4, bob: 0, step: 0, atk: true, hurt: false, special: false },
  { i: 5, bob: 0, step: 0, atk: false, hurt: true, special: false },
  { i: 6, bob: 0, step: 0, atk: false, hurt: false, special: true },
];

/** Zeichenfläche mit Formen-Primitiven auf Basis der Material-Schablone. */
export class Shape {
  readonly lc: LabelCanvas;
  readonly w: number;
  readonly h: number;
  constructor(w: number, h = w) {
    this.lc = new LabelCanvas(w, h);
    this.w = w;
    this.h = h;
  }
  part(): number {
    return this.lc.newPart();
  }
  px(x: number, y: number, ch: string, p: number, dim = false): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.lc.labels[i] = ch.charCodeAt(0);
    this.lc.parts[i] = p;
    this.lc.dim[i] = dim ? 1 : 0;
  }
  ell(cx: number, cy: number, rx: number, ry: number, ch: string, p: number, dim = false, clip?: (x: number, y: number) => boolean): void {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / Math.max(0.5, rx);
        const dy = (y + 0.5 - cy) / Math.max(0.5, ry);
        if (dx * dx + dy * dy <= 1 && (!clip || clip(x, y))) this.px(x, y, ch, p, dim);
      }
    }
  }
  rect(x: number, y: number, w: number, h: number, ch: string, p: number, dim = false): void {
    for (let j = Math.round(y); j < Math.round(y + h); j++) for (let i = Math.round(x); i < Math.round(x + w); i++) this.px(i, j, ch, p, dim);
  }
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, ch: string, p: number, dim = false): void {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 0.01) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
        const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) this.px(x, y, ch, p, dim);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, ch: string, p: number, t = 1, dim = false): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      if (t <= 1) this.px(Math.floor(x), Math.floor(y), ch, p, dim);
      else this.ell(x, y, t / 2, t / 2, ch, p, dim);
    }
  }
  /** Auge (Blick nach links). groß = 2×2 mit Glanzpunkt. */
  eye(x: number, y: number, P: Pose, p: number, big = false, ch = 'k'): void {
    if (P.hurt) {
      this.px(x, y, ch, p);
      this.px(x + 1, y + 1, ch, p);
      if (big) this.px(x, y + 2, ch, p);
      return;
    }
    if (big) {
      this.rect(x, y, 2, 2, ch, p);
      this.px(x, y, 'w', p);
    } else this.px(x, y, ch, p);
  }
  render(m: MaterialMap): Raster {
    return this.lc.render(m);
  }
}

function mats(a: Ramp, b: Ramp = a, c: Ramp = RAMPS.gold, glow: number = PAL.gold): MaterialMap {
  return {
    a: { ramp: a },
    b: { ramp: b },
    c: { ramp: c },
    d: { ramp: RAMPS.dark },
    k: { flat: PAL.ink, group: 'a' },
    K: { flat: PAL.ink, group: 'b' },
    w: { flat: PAL.white, group: 'a' },
    W: { flat: PAL.white, group: 'b' },
    t: { flat: PAL.white },
    r: { flat: PAL.crimson },
    R: { flat: PAL.red },
    g: { flat: glow, group: 'a' },
    G: { flat: glow },
    y: { flat: PAL.gold },
    i: { flat: PAL.white, group: 'c' },
  };
}

type DrawFn = (s: Shape, P: Pose) => void;

export interface SpeciesGfx {
  size: number;
  draw: DrawFn;
  m: MaterialMap;
}

// ---------------------------------------------------------------------------
// Vierbeiner (Hase, Katze, Luchs, Fuchs, Wolf, Ziege, Widder, Ratte)
// ---------------------------------------------------------------------------

interface QuadOpts {
  size: number;
  body: [number, number];
  head: number;
  ears: 'long' | 'pointy' | 'tuft' | 'round' | 'none';
  tail: 'puff' | 'curl' | 'bushy' | 'down' | 'thin' | 'stub';
  horns?: 'back' | 'curl';
  snout?: number;
  mane?: boolean;
  belly?: boolean;
  legH?: number;
  glowEyes?: boolean;
  beard?: boolean;
  item?: 'chip';
}

function quad(o: QuadOpts): DrawFn {
  return (s, P) => {
    const S = o.size;
    const k = S / 24;
    const ground = S - 2;
    const legH = (o.legH ?? 5) * k;
    let bx = S * 0.56;
    let by = ground - legH - o.body[1] + 1 + P.bob * 0.5;
    let hx = bx - o.body[0] - o.head * 0.15;
    let hy = by - o.head * 0.85;
    if (P.atk) {
      bx -= 2 * k;
      hx -= 3 * k;
      hy += 1;
    }
    if (P.special) {
      // erschöpft / geduckt
      by += 2 * k;
      hy += 3 * k;
    }
    const legs = s.part();
    const back = s.part();
    // hintere Beine (dunkler)
    const st = P.step * 2 * k;
    const legW = Math.max(2, 2.5 * k);
    if (!P.special) {
      s.rect(bx - o.body[0] * 0.55 - st, by + o.body[1] * 0.4, legW, legH + 1, 'a', back, true);
      s.rect(bx + o.body[0] * 0.55 + st - legW, by + o.body[1] * 0.4, legW, legH + 1, 'a', back, true);
    }
    // Schwanz
    const tail = s.part();
    const tx = bx + o.body[0] - 1;
    const ty = by - o.body[1] * 0.3;
    switch (o.tail) {
      case 'puff':
        s.ell(tx + 1, ty, 1.8 * k + 0.6, 1.8 * k + 0.6, 'b', tail);
        break;
      case 'curl':
        s.line(tx, ty, tx + 3 * k, ty - 4 * k + P.bob, 'a', tail, Math.max(1.5, 2 * k));
        s.line(tx + 3 * k, ty - 4 * k + P.bob, tx + 2 * k, ty - 7 * k, 'a', tail, Math.max(1.5, 2 * k));
        break;
      case 'bushy':
        s.ell(tx + 3 * k, ty + 1 - P.step, 4 * k, 2.6 * k, 'a', tail);
        s.ell(tx + 6 * k, ty - P.step, 1.8 * k, 1.8 * k, 'b', tail);
        break;
      case 'down':
        s.line(tx, ty, tx + 4 * k, ty + 4 * k - P.step, 'a', tail, Math.max(2, 2.5 * k));
        break;
      case 'thin':
        s.line(tx, ty + 1, tx + 5 * k, ty + 2 * k, 'b', tail, 1);
        s.line(tx + 5 * k, ty + 2 * k, tx + 7 * k, ty - 1 * k + P.step, 'b', tail, 1);
        break;
      case 'stub':
        s.ell(tx, ty, 1.5 * k + 0.5, 1.2 * k + 0.5, 'a', tail);
        break;
    }
    // Körper
    const body = s.part();
    s.ell(bx, by, o.body[0], o.body[1], 'a', body);
    if (o.belly) s.ell(bx - 1, by + o.body[1] * 0.45, o.body[0] * 0.65, o.body[1] * 0.45, 'b', body);
    if (o.mane) {
      for (let i = 0; i < 3; i++) s.ell(bx - o.body[0] * 0.6 + i * 2 * k, by - o.body[1] + 1, 2.2 * k, 2.2 * k, 'a', body);
    }
    // vordere Beine
    if (!P.special) {
      s.rect(bx - o.body[0] * 0.55 + st - 1, by + o.body[1] * 0.45, legW, legH, 'a', legs);
      s.rect(bx + o.body[0] * 0.5 - st - legW + 1, by + o.body[1] * 0.45, legW, legH, 'a', legs);
    } else {
      s.rect(bx - o.body[0] * 0.7, by + o.body[1] * 0.6, o.body[0] * 1.4, 2, 'a', legs);
    }
    // Kopf
    const head = s.part();
    s.ell(hx, hy, o.head, o.head * 0.9, 'a', head);
    if (o.snout) s.ell(hx - o.head * 0.9, hy + o.head * 0.35, o.snout * 1.2 * k, o.snout * 0.65 * k, 'a', head);
    if (o.belly) s.ell(hx - o.head * 0.4, hy + o.head * 0.45, o.head * 0.55, o.head * 0.35, 'b', head);
    // Ohren
    const ear = s.part();
    const ex = hx + o.head * 0.15;
    const ey = hy - o.head * 0.6;
    const droop = P.special || P.hurt;
    switch (o.ears) {
      case 'long':
        if (droop) {
          s.line(ex, ey, ex + 6 * k, ey + 2 * k, 'a', ear, 2);
        } else {
          s.line(ex - 1, ey, ex - 1, ey - 7 * k, 'a', ear, 2);
          s.line(ex + 2 * k, ey, ex + 3 * k, ey - 6 * k, 'a', ear, 2);
          s.px(ex - 1, ey - 5 * k, 'b', ear);
        }
        break;
      case 'pointy':
      case 'tuft':
        s.tri(ex - 3 * k, ey + 1, ex, ey - 4 * k - (droop ? -2 : 0), ex + 1 * k, ey + 1, 'a', ear);
        s.tri(ex, ey + 1, ex + 3 * k, ey - 4 * k - (droop ? -2 : 0), ex + 4 * k, ey + 1, 'a', ear, true);
        if (o.ears === 'tuft') {
          s.px(ex, ey - 5 * k, 'k', ear);
          s.px(ex + 3 * k, ey - 5 * k, 'k', ear);
        }
        break;
      case 'round':
        s.ell(ex - 1, ey - 1, 2.4 * k + 0.6, 2.4 * k + 0.6, 'a', ear);
        s.ell(ex - 1, ey - 1, 1.2 * k, 1.2 * k, 'b', ear);
        break;
      default:
        break;
    }
    // Hörner
    if (o.horns) {
      const hp = s.part();
      if (o.horns === 'back') {
        s.line(ex - 1, ey + 1, ex + 4 * k, ey - 5 * k, 'c', hp, Math.max(2, 2.4 * k));
        s.line(ex + 4 * k, ey - 5 * k, ex + 7 * k, ey - 4 * k, 'c', hp, 2);
      } else {
        s.ell(ex + 1 * k, ey + 1 * k, 3.4 * k, 3.4 * k, 'c', hp);
        s.ell(ex + 1 * k, ey + 1 * k, 1.4 * k, 1.4 * k, 'd', hp);
      }
    }
    if (o.beard) s.tri(hx - o.head * 0.3, hy + o.head * 0.6, hx + 1, hy + o.head * 0.6, hx - o.head * 0.1, hy + o.head * 1.5, 'b', head);
    // Gesicht
    const eyeX = Math.round(hx - o.head * 0.45);
    const eyeY = Math.round(hy - o.head * 0.15);
    s.eye(eyeX, eyeY, P, head, S >= 24, o.glowEyes ? 'g' : 'k');
    if (P.special && !P.hurt) {
      // Schwindel-Augen
      s.px(eyeX, eyeY, 'w', head);
      s.px(eyeX + 1, eyeY + 1, 'k', head);
    }
    if (o.snout) s.px(hx - o.head * 0.9 - o.snout * 1.2 * k + 1, hy + o.head * 0.2, 'k', head);
    if (P.atk) {
      const mx = hx - o.head * 0.9 - (o.snout ?? 0) * k * 0.6;
      const my = hy + o.head * 0.55;
      s.rect(mx, my, Math.max(2, 3 * k), Math.max(1, 1.5 * k), 'r', head);
      s.px(mx, my, 't', head);
    }
    if (o.item === 'chip') {
      const ip = s.part();
      s.ell(hx - o.head - 1, hy + o.head * 0.9, 2.2, 2.2, 'R', ip);
      s.px(hx - o.head - 1, hy + o.head * 0.9, 't', ip);
    }
  };
}

// ---------------------------------------------------------------------------
// Vögel und Flieger
// ---------------------------------------------------------------------------

function bird(size: number, opts: { crest?: boolean; whiteHead?: boolean; spikes?: boolean } = {}): DrawFn {
  return (s, P) => {
    const S = size;
    const k = S / 16;
    const cy = S * 0.5 + (P.i === 2 ? -1 : P.i === 3 ? 1 : 0) + P.bob * 0.5;
    const cx = S * 0.52;
    const dive = P.atk;
    const tail = s.part();
    s.tri(cx + 3 * k, cy - 1 * k, cx + 7.5 * k, cy - (dive ? 3 : 1) * k, cx + 7 * k, cy + 2 * k, 'a', tail, true);
    // Flügel hinten
    const wingUp = P.i === 0 || P.i === 2 || dive;
    const wingB = s.part();
    if (!dive) {
      if (wingUp) s.tri(cx - 1 * k, cy - 1 * k, cx + 4 * k, cy - 7 * k, cx + 4 * k, cy, 'a', wingB, true);
      else s.tri(cx - 1 * k, cy, cx + 5 * k, cy + 5 * k, cx + 4 * k, cy - 1, 'a', wingB, true);
    }
    const body = s.part();
    s.ell(cx, cy, 4.2 * k, 3 * k, 'a', body);
    s.ell(cx - 0.6 * k, cy + 1.2 * k, 3 * k, 1.6 * k, 'b', body);
    const head = s.part();
    const hx = cx - 4 * k + (dive ? -1 : 0);
    const hy = cy - 2.4 * k + (dive ? 2 : 0);
    s.ell(hx, hy, 2.6 * k, 2.4 * k, opts.whiteHead ? 'b' : 'a', head);
    if (opts.crest) s.tri(hx + 1, hy - 2 * k, hx + 4 * k, hy - 4 * k, hx + 2 * k, hy - 0.5 * k, 'a', head);
    const beak = s.part();
    s.tri(hx - 2 * k, hy - 0.5 * k, hx - 5 * k, hy + 0.6 * k, hx - 2 * k, hy + 1.2 * k, 'c', beak);
    s.eye(Math.round(hx - 1 * k), Math.round(hy - 0.8 * k), P, head, S >= 24, opts.whiteHead ? 'K' : 'k');
    // Flügel vorne
    const wingF = s.part();
    if (dive) s.tri(cx - 2 * k, cy - 1 * k, cx + 6 * k, cy - 3 * k, cx + 4 * k, cy + 1 * k, 'a', wingF);
    else if (wingUp) s.tri(cx - 2 * k, cy, cx + 2 * k, cy - 8 * k, cx + 3.5 * k, cy, 'a', wingF);
    else s.tri(cx - 2 * k, cy, cx + 3 * k, cy + 6 * k, cx + 3.5 * k, cy, 'a', wingF);
    if (opts.spikes) {
      for (let i = 0; i < 3; i++) s.px(cx + 1 + i * 1.5 * k, cy - 3 * k - (i % 2), 'i', body);
    }
  };
}

// ---------------------------------------------------------------------------
// Einzelne Arten
// ---------------------------------------------------------------------------

const fluff: DrawFn = (s, P) => {
  const p = s.part();
  const sq = P.atk ? 1.2 : P.bob ? 0.5 : 0;
  const cx = 8 - (P.atk ? 1 : 0);
  const cy = 9.5 + P.bob * 0.5 + sq * 0.5;
  if (P.special) {
    s.ell(8, 9.5, 6, 6, 'a', p);
    s.line(5, 7, 10, 12, 'b', p);
    s.line(4, 10, 8, 13, 'b', p);
    return;
  }
  const feet = s.part();
  s.rect(4 + P.step, 13.5, 3, 2, 'b', feet);
  s.rect(9 - P.step, 13.5, 3, 2, 'b', feet);
  s.ell(cx, cy, 6.5 + sq, 5.6 - sq, 'a', p);
  s.ell(cx - 3, cy - 4.5, 2.2, 2, 'a', p);
  s.ell(cx + 0.5, cy - 5.3, 2.5, 2, 'a', p);
  s.ell(cx + 4, cy - 4.2, 2, 1.8, 'a', p);
  s.eye(cx - 4, cy - 1, P, p);
  s.eye(cx - 0.5, cy - 1, P, p);
  s.px(cx - 5, cy + 1, 'b', p);
  s.px(cx + 1, cy + 1, 'b', p);
  if (P.atk) s.px(cx - 2.5, cy + 1.5, 'r', p);
};

const shroom: DrawFn = (s, P) => {
  const hop = P.i === 2 ? -3 : P.i === 3 ? 0 : 0;
  const squash = P.i === 3 || P.atk ? 1 : 0;
  const y0 = hop + P.bob * 0.5;
  const feet = s.part();
  if (hop === 0) {
    s.rect(5, 14.5, 2, 1.5, 'd', feet);
    s.rect(9, 14.5, 2, 1.5, 'd', feet);
  }
  const stem = s.part();
  s.ell(8, 11.5 + y0 + squash * 0.5, 4 + squash * 0.6, 3.6 - squash * 0.4, 'b', stem);
  s.eye(5, 11 + y0, P, stem, false, 'K');
  s.eye(8, 11 + y0, P, stem, false, 'K');
  if (P.atk) s.px(6.5, 13 + y0, 'r', stem);
  const cap = s.part();
  const capY = 7 + y0 + squash;
  s.ell(8, capY, 7 + squash * 0.6, 4.6 - squash * 0.5, 'a', cap, false, (_x, y) => y <= capY + 1.5);
  s.px(5, capY - 2, 'w', cap);
  s.px(6, capY - 2, 'w', cap);
  s.px(10, capY - 3, 'w', cap);
  s.px(11, capY - 1, 'w', cap);
  s.px(3, capY, 'w', cap);
  if (P.special) {
    // geduckt: nur Hut sichtbar
  }
};

const leafBush = (s: Shape, P: Pose, open: boolean): void => {
  const base = s.part();
  const y = P.bob * 0.5;
  s.ell(12, 16 + y, 9.5, 6.5, 'a', base);
  const l1 = s.part();
  s.ell(6.5, 12 + y, 5, 4.6, 'a', l1);
  const l2 = s.part();
  s.ell(17.5, 12 + y, 5, 4.6, 'a', l2);
  const l3 = s.part();
  s.ell(12, 8.5 + y, 5.5, 4.5, 'a', l3);
  if (!open) {
    s.px(9, 14 + y, 'b', base);
    s.px(16, 17 + y, 'b', base);
    s.px(12, 7 + y, 'b', l3);
  }
};

const plantSnapper: DrawFn = (s, P) => {
  if (P.special) {
    leafBush(s, P, false);
    return;
  }
  const roots = s.part();
  s.rect(7 + P.step, 21, 2, 2, 'c', roots);
  s.rect(15 - P.step, 21, 2, 2, 'c', roots);
  leafBush(s, P, true);
  const face = s.part();
  const lx = P.atk ? -2 : 0;
  s.eye(8 + lx, 10, P, face, true, 'g');
  s.eye(14 + lx, 10, P, face, true, 'g');
  if (P.atk) {
    s.ell(9 + lx, 16, 6, 4, 'r', face);
    for (let i = 0; i < 4; i++) {
      s.tri(4.5 + lx + i * 3, 12.5, 6 + lx + i * 3, 12.5, 5.2 + lx + i * 3, 14.5, 't', face);
      s.tri(4.5 + lx + i * 3, 19.5, 6 + lx + i * 3, 19.5, 5.2 + lx + i * 3, 17.5, 't', face);
    }
  } else {
    s.line(7, 16, 15, 16, 'r', face);
    s.px(8, 15, 't', face);
    s.px(13, 15, 't', face);
  }
};

function crab(size: number): DrawFn {
  return (s, P) => {
    const k = size / 16;
    const cx = size / 2;
    const cy = size * 0.62 + P.bob * 0.5;
    const legs = s.part();
    const nLegs = size >= 24 ? 3 : 2;
    for (let i = 0; i < nLegs; i++) {
      const off = (i % 2 === 0 ? P.step : -P.step) * 0.8;
      const lx = 2 * k + i * 1.2 * k;
      s.line(cx - lx, cy + 1, cx - lx - 2.5 * k, cy + 3.4 * k + off, 'a', legs, 1, true);
      s.line(cx + lx, cy + 1, cx + lx + 2.5 * k, cy + 3.4 * k - off, 'a', legs, 1, true);
    }
    const claws = s.part();
    const up = P.atk ? -3.5 * k : 0;
    const cxo = 5 * k;
    const cr = 2.1 * k;
    s.ell(cx - cxo, cy - 2.2 * k + up, cr, cr * 0.9, 'a', claws);
    s.ell(cx + cxo, cy - 2.2 * k + up, cr, cr * 0.9, 'a', claws);
    s.px(cx - cxo, cy - 2.2 * k - cr + up + (P.atk ? 0 : 1), 'd', claws);
    s.px(cx + cxo, cy - 2.2 * k - cr + up + (P.atk ? 0 : 1), 'd', claws);
    const body = s.part();
    s.ell(cx, cy, 4.4 * k, 3 * k, 'a', body);
    s.ell(cx, cy + 1.1 * k, 3 * k, 1.3 * k, 'b', body);
    const stalks = s.part();
    s.line(cx - 1.4 * k, cy - 2 * k, cx - 1.6 * k, cy - 4.2 * k, 'd', stalks);
    s.line(cx + 1.4 * k, cy - 2 * k, cx + 1.6 * k, cy - 4.2 * k, 'd', stalks);
    s.eye(Math.round(cx - 2 * k), Math.round(cy - 5 * k), P, stalks, size >= 24);
    s.eye(Math.round(cx + 1.2 * k), Math.round(cy - 5 * k), P, stalks, size >= 24);
    if (P.special) s.px(cx, cy - 1, 'w', body);
  };
}

const frog: DrawFn = (s, P) => {
  const cy = 11 + P.bob * 0.4;
  const puff = P.atk ? 1 : 0;
  const legs = s.part();
  s.ell(12.5, 13.5, 2.6, 2, 'a', legs, true);
  s.rect(2.5 + P.step, 13.5, 3, 2, 'a', legs);
  const body = s.part();
  s.ell(8.5, cy, 6 + puff, 4 + puff * 0.5, 'a', body);
  s.ell(7.5, cy + 1.6, 4.2 + puff, 2.4, 'b', body);
  s.ell(4.5, cy - 4, 2.1, 2, 'a', body);
  s.ell(9, cy - 4.3, 2.1, 2, 'a', body);
  s.eye(4, cy - 4.5, P, body);
  s.eye(8.5, cy - 4.8, P, body);
  if (P.atk) {
    s.ell(4, cy, 2.4, 1.6, 'r', body);
  } else s.line(2.5, cy - 0.5, 8, cy - 0.5, 'k', body);
};

const imp: DrawFn = (s, P) => {
  const y = P.bob * 0.5;
  const sack = s.part();
  if (!P.special) {
    s.ell(12, 10 + y, 3, 3.2, 'c', sack);
    s.px(12, 7 + y, 'd', sack);
  } else {
    s.ell(12, 10 + y, 3.5, 3.5, 'c', sack);
    s.px(11, 9 + y, 'y', sack);
    s.px(13, 11 + y, 'y', sack);
  }
  const feet = s.part();
  s.rect(5 + P.step, 14.5, 2, 1.5, 'd', feet);
  s.rect(9 - P.step, 14.5, 2, 1.5, 'd', feet);
  const body = s.part();
  s.ell(8, 12 + y, 3.2, 2.8, 'a', body);
  const head = s.part();
  s.ell(7, 7 + y, 5, 4.4, 'a', head);
  s.tri(1, 3 + y, 4, 5 + y, 3.5, 7.5 + y, 'a', head);
  s.tri(13, 3 + y, 10, 5 + y, 10.5, 7.5 + y, 'a', head);
  s.eye(4, 6 + y, P, head, false, 'g');
  s.eye(8, 6 + y, P, head, false, 'g');
  s.line(4, 9 + y, 8, 9 + y, P.atk ? 'r' : 'w', head);
};

const paperBat: DrawFn = (s, P) => {
  const flap = P.i % 2 === 0 || P.atk;
  const y = 8 + P.bob * 0.5 + (flap ? -1 : 1);
  const wings = s.part();
  if (flap) {
    s.tri(7, y - 1, 1, y - 6, 3, y + 2, 'a', wings, true);
    s.tri(9, y - 1, 15, y - 6, 13, y + 2, 'a', wings);
  } else {
    s.tri(7, y, 1, y + 4, 4, y + 3, 'a', wings, true);
    s.tri(9, y, 15, y + 4, 12, y + 3, 'a', wings);
  }
  const body = s.part();
  s.rect(5, y - 3, 6, 7, 'a', body);
  s.tri(9, y - 3, 11, y - 3, 11, y - 1, 'b', body);
  s.line(6, y + 2, 9, y + 2, 'K', body);
  s.eye(6, y - 1, P, body, false, 'k');
  s.eye(8, y - 1, P, body, false, 'k');
  if (P.atk) s.line(6, y + 2, 9, y + 3, 'r', body);
};

function golem(size: number, moss: boolean): DrawFn {
  return (s, P) => {
    const k = size / 24;
    const g = size - 1;
    if (P.special && moss) {
      const rock = s.part();
      s.ell(size / 2, g - 6 * k, 10 * k, 7 * k, 'a', rock);
      const m = s.part();
      s.ell(size / 2 - 2 * k, g - 11 * k, 6 * k, 2.5 * k, 'b', m);
      return;
    }
    const y = P.bob * 0.5;
    const legs = s.part();
    s.rect(size / 2 - 6 * k + P.step, g - 6 * k, 4.5 * k, 6 * k, 'a', legs, true);
    s.rect(size / 2 + 1.5 * k - P.step, g - 6 * k, 4.5 * k, 6 * k, 'a', legs);
    const body = s.part();
    s.rect(size / 2 - 7 * k, g - 17 * k + y, 14 * k, 12 * k, 'a', body);
    const head = s.part();
    s.rect(size / 2 - 4.5 * k, g - 23 * k + y + (P.atk ? 1 : 0), 9 * k, 7 * k, 'a', head);
    s.eye(Math.round(size / 2 - 3 * k), Math.round(g - 20 * k + y), P, head, size >= 32, 'g');
    s.eye(Math.round(size / 2 + 1 * k), Math.round(g - 20 * k + y), P, head, size >= 32, 'g');
    const arms = s.part();
    const ay = P.atk ? -9 * k : 0;
    s.rect(size / 2 - 11 * k, g - 16 * k + y + ay, 4.5 * k, 10 * k, 'a', arms);
    s.rect(size / 2 + 6.5 * k, g - 16 * k + y + ay, 4.5 * k, 10 * k, 'a', arms, true);
    // Rune
    const cx = size / 2;
    const cy = g - 11 * k + y;
    s.line(cx - 2 * k, cy - 2 * k, cx + 2 * k, cy + 2 * k, 'g', body);
    s.line(cx + 2 * k, cy - 2 * k, cx - 2 * k, cy + 2 * k, 'g', body);
    if (moss) {
      const m = s.part();
      s.ell(cx - 2 * k, g - 17 * k + y, 6 * k, 2 * k, 'b', m);
      s.ell(cx + 3 * k, g - 23 * k + y, 3 * k, 1.6 * k, 'b', m);
    }
  };
}

const cactus: DrawFn = (s, P) => {
  const y = P.bob * 0.5;
  const feet = s.part();
  s.rect(8 + P.step, 21, 3, 2, 'd', feet);
  s.rect(13 - P.step, 21, 3, 2, 'd', feet);
  const arms = s.part();
  const raise = P.atk ? -3 : 0;
  s.rect(4, 11 + y + raise, 3, 6, 'a', arms);
  s.rect(4, 16 + y, 5, 3, 'a', arms);
  s.rect(17, 9 + y + raise, 3, 6, 'a', arms, true);
  s.rect(15, 14 + y, 5, 3, 'a', arms, true);
  const body = s.part();
  s.ell(12, 13 + y, 5, 9, 'a', body);
  const ridge = s.part();
  s.line(12, 6 + y, 12, 20 + y, 'a', ridge);
  const spikes = P.atk ? 9 : 6;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    s.px(12 + Math.cos(a) * (P.atk ? 6.5 : 5.2), 13 + y + Math.sin(a) * 8.5, 'w', body);
  }
  const fl = s.part();
  s.ell(12, 4 + y, 2.6, 1.8, 'b', fl);
  s.px(12, 4 + y, 'y', fl);
  s.eye(9, 11 + y, P, body);
  s.eye(13, 11 + y, P, body);
  s.line(9, 9 + y, 11, 10 + y, 'k', body);
  s.line(13, 10 + y, 15, 9 + y, 'k', body);
};

const cardSoldier: DrawFn = (s, P) => {
  const y = P.bob * 0.5;
  const legs = s.part();
  s.line(10, 18 + y, 9 - P.step, 22, 'd', legs, 1.6);
  s.line(14, 18 + y, 15 + P.step, 22, 'd', legs, 1.6);
  const spear = s.part();
  const sx = P.atk ? 1 : 4;
  s.line(sx, 3 + y, sx + 2, 21 + y, 'c', spear, 1.5);
  s.tri(sx - 1.5, 4 + y, sx + 1.5, 4 + y, sx - 0.5, -0.5 + y, 'i', spear);
  const body = s.part();
  s.rect(7, 4 + y, 11, 15, 'a', body);
  s.rect(8, 5 + y, 9, 13, 'b', body);
  // Herz-Symbol
  s.ell(11.5, 9 + y, 1.5, 1.5, 'R', body);
  s.ell(13.5, 9 + y, 1.5, 1.5, 'R', body);
  s.tri(10, 9.5 + y, 15, 9.5 + y, 12.5, 13 + y, 'R', body);
  s.eye(9, 15 + y, P, body, false, 'K');
  s.eye(12, 15 + y, P, body, false, 'K');
  const arm = s.part();
  s.line(7, 10 + y, sx + 1, 12 + y, 'b', arm, 1.5);
};

const jelly: DrawFn = (s, P) => {
  const y = 6 + P.bob * 0.6 + (P.i === 2 ? -1 : 0);
  const ten = s.part();
  for (let i = 0; i < 4; i++) {
    const x = 4.5 + i * 2.4;
    const wob = ((P.i + i) % 2 === 0 ? 1 : -1) * 0.8;
    s.line(x, y + 3, x + wob, y + 6, 'b', ten, 1, true);
    s.line(x + wob, y + 6, x - wob, y + 9, 'b', ten, 1, true);
  }
  const dome = s.part();
  s.ell(8, y + 2, 6, 5, 'a', dome, false, (_x, yy) => yy <= y + 4);
  s.ell(8, y + 1, 3, 2.4, 'g', dome);
  s.eye(5, y + 2, P, dome);
  s.eye(9, y + 2, P, dome);
  if (P.atk) {
    s.px(2, y - 2, 'y', dome);
    s.px(14, y - 1, 'y', dome);
    s.px(8, y - 5, 'y', dome);
  }
};

const wisp: DrawFn = (s, P) => {
  const y = 8 + P.bob * 0.8;
  const p = s.part();
  const fl = P.i % 2;
  s.ell(8, y + 2, 4.5, 4.2, 'a', p);
  s.tri(4, y + 1, 12, y + 1, 8 + (fl ? 1.5 : -1.5), y - 7, 'a', p);
  s.tri(6, y, 10, y, 6 + (fl ? -1 : 1), y - 4, 'a', p);
  s.ell(8, y + 2.5, 2.4, 2.2, 'w', p);
  s.eye(6, y + 1, P, p);
  s.eye(9, y + 1, P, p);
  if (P.atk) s.ell(8, y + 2, 5.5, 5, 'a', p);
};

function ghost(size: number, ink: boolean): DrawFn {
  return (s, P) => {
    const k = size / 24;
    const y = 2 + P.bob * 0.8 + (P.i === 2 ? -1 : 0);
    const body = s.part();
    s.ell(12 * k, 9 * k + y, 7 * k, 6.5 * k, 'a', body);
    s.rect(5 * k, 9 * k + y, 14 * k, 7 * k, 'a', body);
    for (let i = 0; i < 4; i++) {
      const wx = 5.5 * k + i * 3.6 * k;
      const wob = (P.i + i) % 2 ? 1 : 0;
      s.tri(wx, 15 * k + y, wx + 3.6 * k, 15 * k + y, wx + 1.8 * k + wob, 20 * k + y + (ink ? 2 : 0), 'a', body);
    }
    const arm = s.part();
    if (P.atk) {
      s.line(6 * k, 11 * k + y, 1 * k, 7 * k + y, 'a', arm, 2.4 * k);
    } else s.ell(5 * k, 12 * k + y, 2 * k, 1.6 * k, 'a', arm);
    s.ell(8.5 * k, 8 * k + y, 1.4 * k, 2.2 * k, 'k', body);
    s.ell(13 * k, 8 * k + y, 1.4 * k, 2.2 * k, 'k', body);
    if (!P.hurt) {
      s.px(8.5 * k, 7 * k + y, 'g', body);
      s.px(13 * k, 7 * k + y, 'g', body);
    }
    if (P.atk) s.ell(10.5 * k, 12.5 * k + y, 2 * k, 1.5 * k, 'k', body);
    if (ink) {
      const d = s.part();
      s.ell(15 * k, 21 * k + (P.i % 3), 1 * k, 1.4 * k, 'a', d);
    }
  };
}

const mimic: DrawFn = (s, P) => {
  const open = P.atk || P.i === 2 || P.i === 4;
  const hop = P.i === 2 ? -2 : 0;
  const base = s.part();
  s.rect(2, 8 + hop, 12, 7, 'a', base);
  s.rect(2, 11 + hop, 12, 1, 'c', base);
  s.rect(7, 10 + hop, 2, 3, 'c', base);
  const lid = s.part();
  if (open && !P.special) {
    s.rect(2, 1 + hop, 12, 4, 'a', lid);
    s.rect(2, 3 + hop, 12, 1, 'c', lid);
    const m = s.part();
    s.rect(3, 5 + hop, 10, 3, 'r', m);
    for (let i = 0; i < 4; i++) {
      s.px(3.5 + i * 2.6, 5 + hop, 't', m);
      s.px(4.5 + i * 2.6, 7 + hop, 't', m);
    }
    s.eye(5, 5 + hop, P, m, false, 'G');
    s.eye(10, 5 + hop, P, m, false, 'G');
  } else {
    s.rect(2, 4 + hop, 12, 4, 'a', lid);
    s.rect(2, 6 + hop, 12, 1, 'c', lid);
    if (!P.special) {
      s.px(5, 7 + hop, 'G', lid);
      s.px(10, 7 + hop, 'G', lid);
    }
  }
};

const butterfly: DrawFn = (s, P) => {
  const flap = P.i % 2 === 0;
  const y = 7 + P.bob * 0.6 + (flap ? 0 : 1);
  const w = flap ? 1 : 0.55;
  const wl = s.part();
  s.ell(8 - 3.5 * w, y - 1, 3.4 * w + 0.5, 3, 'a', wl, true);
  s.ell(8 - 2.6 * w, y + 3, 2.4 * w + 0.5, 2.2, 'a', wl, true);
  const wr = s.part();
  s.ell(8 + 3.5 * w, y - 1, 3.4 * w + 0.5, 3, 'a', wr);
  s.ell(8 + 2.6 * w, y + 3, 2.4 * w + 0.5, 2.2, 'a', wr);
  s.px(8 - 3 * w, y - 1, 'b', wl);
  s.px(8 + 3 * w, y - 1, 'b', wr);
  const body = s.part();
  s.rect(7.5, y - 3, 1.6, 8, 'd', body);
  s.line(7.5, y - 3, 6, y - 6, 'd', body);
  s.line(8.5, y - 3, 10, y - 6, 'd', body);
};

const vine: DrawFn = (s, P) => {
  if (P.special) {
    const b = s.part();
    s.ell(12, 19, 7, 4, 'a', b);
    s.px(9, 17, 'R', b);
    s.px(14, 18, 'R', b);
    return;
  }
  const base = s.part();
  s.ell(12, 21, 6, 2.4, 'a', base, true);
  const stem = s.part();
  const sway = P.i % 2 ? 1 : -1;
  const lean = P.atk ? -5 : 0;
  s.line(12, 21, 12 + sway, 15, 'a', stem, 3);
  s.line(12 + sway, 15, 10 + lean, 9, 'a', stem, 3);
  for (let i = 0; i < 4; i++) s.px(13 + sway + (i % 2 ? -3 : 0), 19 - i * 3, 'R', stem);
  const head = s.part();
  const hx = 9 + lean;
  const hy = 6 + (P.atk ? 2 : 0);
  s.ell(hx, hy, 4.2, 3.6, 'b', head);
  s.tri(hx - 4, hy - 2, hx - 1, hy - 7, hx + 1, hy - 2, 'b', head);
  s.tri(hx, hy - 2, hx + 4, hy - 6, hx + 4, hy, 'b', head);
  s.eye(hx - 2, hy - 1, P, head, false, 'K');
  if (P.atk) s.ell(hx - 2, hy + 1.6, 2.4, 1.6, 'r', head);
};

const worm: DrawFn = (s, P) => {
  const mound = s.part();
  s.ell(12, 21, 9, 2.6, 'b', mound);
  if (P.special) {
    s.ell(12, 20, 6, 3, 'b', mound);
    s.px(9, 18, 'd', mound);
    s.px(15, 19, 'd', mound);
    return;
  }
  const rise = P.atk ? 3 : P.i === 2 ? 1 : 0;
  const sw = P.i % 2 ? 1 : 0;
  for (let i = 0; i < 4; i++) {
    const seg = s.part();
    s.ell(12 + sw - i * 1.2, 18 - i * 4 - rise, 4.2 - i * 0.2, 2.8, 'a', seg);
  }
  const head = s.part();
  const hx = 8 + sw - (P.atk ? 2 : 0);
  const hy = 3 - rise + 2;
  s.ell(hx, hy, 4.4, 3.8, 'a', head);
  s.eye(hx - 2, hy - 2, P, head);
  s.eye(hx + 1, hy - 2, P, head);
  s.ell(hx - 2, hy + 1, 2.2, 1.6, P.atk ? 'r' : 'k', head);
  s.px(hx - 3, hy + 1, 't', head);
};

const beetle: DrawFn = (s, P) => {
  const y = P.bob * 0.4;
  const legs = s.part();
  for (let i = 0; i < 3; i++) {
    const off = (i % 2 ? P.step : -P.step) * 0.8;
    s.line(8 + i * 4, 16 + y, 7 + i * 4 + off, 21, 'd', legs, 1.2);
  }
  const head = s.part();
  const hx = P.atk ? 3.5 : 5;
  s.ell(hx, 15 + y, 3.4, 3, 'b', head);
  s.tri(hx - 2, 13 + y, hx - 5, 9 + y, hx - 0.5, 12 + y, 'c', head);
  s.eye(hx - 2, 14 + y, P, head, false, 'K');
  const shell = s.part();
  s.ell(13, 13 + y, 8, 5.6, 'a', shell);
  s.line(9, 9 + y, 20, 13 + y, 'k', shell);
  s.px(12, 10 + y, 'w', shell);
  s.px(13, 10 + y, 'w', shell);
};

const bookEater: DrawFn = (s, P) => {
  const y = P.bob * 0.5 + (P.i === 2 ? -1 : 0);
  const open = P.atk ? 7 : P.i % 2 ? 3 : 4;
  const feet = s.part();
  s.rect(8 + P.step, 21, 2, 2, 'd', feet);
  s.rect(14 - P.step, 21, 2, 2, 'd', feet);
  const lower = s.part();
  s.rect(4, 14 + y, 16, 6, 'a', lower);
  s.rect(5, 14 + y, 14, 2, 'b', lower);
  const upper = s.part();
  s.rect(4, 14 - open - 6 + y, 16, 6, 'a', upper);
  s.rect(5, 14 - open - 2 + y, 14, 2, 'b', upper);
  const mouth = s.part();
  s.rect(5, 14 - open + y, 14, open, 'r', mouth);
  for (let i = 0; i < 5; i++) {
    s.tri(5 + i * 3, 14 - open + y, 8 + i * 3, 14 - open + y, 6.5 + i * 3, 16 - open + y, 't', mouth);
    s.tri(5 + i * 3, 14 + y, 8 + i * 3, 14 + y, 6.5 + i * 3, 12 + y, 't', mouth);
  }
  s.eye(7, 14 - open - 5 + y, P, upper, true, 'g');
  s.eye(14, 14 - open - 5 + y, P, upper, true, 'g');
};

const hydra: DrawFn = (s, P) => {
  const S = 40;
  const g = S - 2;
  const body = s.part();
  s.ell(22, g - 7, 14, 8, 'a', body);
  const leaves = s.part();
  s.ell(30, g - 13, 5, 3, 'b', leaves);
  s.ell(14, g - 14, 4, 2.6, 'b', leaves);
  const roots = s.part();
  s.line(10, g - 3, 5 - P.step, g, 'a', roots, 2.4);
  s.line(34, g - 3, 38 + P.step, g, 'a', roots, 2.4);
  const heads: [number, number][] = [
    [7, 11],
    [17, 5],
    [28, 9],
  ];
  heads.forEach(([hx, hy], i) => {
    const sway = ((P.i + i) % 2 ? 1 : -1) * (P.atk && i === 1 ? 0 : 1);
    const ax = P.atk ? -3 : 0;
    const neck = s.part();
    s.line(18 + i * 4, g - 10, hx + sway + ax, hy + 4, 'a', neck, 3.2);
    const head = s.part();
    s.ell(hx + sway + ax, hy + P.bob * 0.5, 4, 3.4, 'a', head);
    s.tri(hx + sway + ax - 3, hy - 2, hx + sway + ax - 6, hy - 5, hx + sway + ax, hy - 3, 'b', head);
    s.eye(Math.round(hx + sway + ax - 2), Math.round(hy - 1), P, head, false, 'g');
    if (P.atk) s.ell(hx + sway + ax - 2.5, hy + 1.5, 2, 1.3, 'r', head);
  });
};

// ---------------------------------------------------------------------------
// Verzeichnis
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bosse (Meilenstein 7) – deutlich grösser als die Spielfigur
// ---------------------------------------------------------------------------

/** Moosbart, der Grasriese: wandelnder Grashügel mit Moosbart und Blütenkrone */
const moosbart: DrawFn = (s, P) => {
  const S = 56;
  const g = S - 2;
  const y = P.bob;
  const feet = s.part();
  s.ell(18 + P.step * 2, g - 2, 7, 3, 'd', feet);
  s.ell(38 - P.step * 2, g - 2, 7, 3, 'd', feet);
  const arms = s.part();
  const lift = P.atk ? -12 : 0;
  s.line(12, 30 + y, 3, 38 + y + lift, 'b', arms, 5);
  s.line(44, 30 + y, 53, 38 + y + lift, 'b', arms, 5, true);
  s.ell(3, 40 + y + lift, 4, 4, 'a', arms);
  s.ell(53, 40 + y + lift, 4, 4, 'a', arms, true);
  const body = s.part();
  s.ell(28, 32 + y, 20, 19, 'a', body);
  const beard = s.part();
  s.tri(16, 30 + y, 40, 30 + y, 28, 50 + y, 'b', beard);
  s.ell(28, 34 + y, 10, 7, 'b', beard);
  const face = s.part();
  s.eye(21, 23 + y, P, face, true);
  s.eye(33, 23 + y, P, face, true);
  s.line(18, 19 + y, 24, 21 + y, 'k', face);
  s.line(32, 21 + y, 38, 19 + y, 'k', face);
  if (P.atk) s.ell(27, 29 + y, 4, 2.5, 'r', face);
  const crown = s.part();
  for (let i = 0; i < 5; i++) {
    const fx = 14 + i * 7;
    s.line(fx, 16 + y, fx + (i % 2 ? 1 : -1), 9 + y, 'b', crown);
    s.ell(fx + (i % 2 ? 1 : -1), 8 + y, 2.4, 2, 'c', crown);
    s.px(fx + (i % 2 ? 1 : -1), 8 + y, 'y', crown);
  }
  if (P.special) for (let i = 0; i < 6; i++) s.px(8 + i * 8, 52 - (i % 3) * 3, 'g', body);
};

/** Der Tintenkoloss: Riese aus Tintenklecksen und Buchseiten */
const tintenkoloss: DrawFn = (s, P) => {
  const S = 56;
  const g = S - 2;
  const y = P.bob;
  const legs = s.part();
  s.rect(17 + P.step, g - 12, 8, 12, 'a', legs);
  s.rect(31 - P.step, g - 12, 8, 12, 'a', legs);
  const arms = s.part();
  const lift = P.atk ? -10 : 0;
  s.ell(8, 30 + y + lift, 7, 11, 'a', arms);
  s.ell(48, 30 + y + lift, 7, 11, 'a', arms, true);
  const body = s.part();
  s.ell(28, 28 + y, 16, 16, 'a', body);
  s.ell(28, 12 + y, 10, 9, 'a', body);
  const pages = s.part();
  s.rect(19, 24 + y, 8, 10, 'b', pages);
  s.rect(29, 22 + y, 8, 11, 'b', pages);
  for (let i = 0; i < 4; i++) {
    s.line(20, 26 + y + i * 2, 25, 26 + y + i * 2, 'k', pages);
    s.line(30, 24 + y + i * 2, 35, 24 + y + i * 2, 'k', pages);
  }
  const face = s.part();
  s.ell(23, 11 + y, 2.4, 2, 'g', face);
  s.ell(33, 11 + y, 2.4, 2, 'g', face);
  if (P.atk || P.special) s.line(22, 17 + y, 34, 17 + y, 'g', face, 1.5);
  // Tropfen
  for (let i = 0; i < 4; i++) s.ell(12 + i * 11, 46 + ((P.i + i) % 3), 1.5, 2.2, 'a', body);
};

/** Tiefenmaul, die Hafenkrake: Kopf aus dem Wasser, Tentakel ringsum */
const tiefenmaul: DrawFn = (s, P) => {
  const S = 64;
  const g = S - 4;
  const y = P.bob;
  const water = s.part();
  s.ell(32, g - 2, 30, 5, 'c', water);
  const arms = s.part();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.08 + (i / 5) * 0.84);
    const reach = P.atk ? 30 : 24;
    const bx = 32 + Math.cos(a) * 14;
    const tx = 32 + Math.cos(a) * reach;
    const ty = g - 4 - Math.sin(a) * (reach * 0.9) + ((P.i + i) % 2) * 2;
    s.line(bx, g - 6, tx, ty, 'b', arms, 3.4);
    s.ell(tx, ty, 2.4, 2.4, 'b', arms);
  }
  const head = s.part();
  s.ell(32, 26 + y, 17, 20, 'a', head);
  s.ell(26, 16 + y, 5, 4, 'b', head);
  const face = s.part();
  s.eye(24, 30 + y, P, face, true);
  s.eye(40, 30 + y, P, face, true);
  s.ell(32, 40 + y, P.atk ? 6 : 4, P.atk ? 4 : 2, 'r', face);
  for (let i = 0; i < 5; i++) s.px(22 + i * 5, 46 + y, 'b', face);
};

/** Der Hausbankier: lebender Glücksautomat mit Zylinder und Hebelarm */
const hausbankier: DrawFn = (s, P) => {
  const S = 48;
  const g = S - 2;
  const y = P.bob;
  const legs = s.part();
  s.rect(14 + P.step, g - 7, 5, 7, 'd', legs);
  s.rect(29 - P.step, g - 7, 5, 7, 'd', legs);
  const lever = s.part();
  const pull = P.atk ? 8 : 0;
  s.line(40, 22 + y, 45, 10 + y + pull, 'c', lever, 2);
  s.ell(45, 9 + y + pull, 3, 3, 'r', lever);
  const body = s.part();
  s.rect(6, 12 + y, 34, 28, 'a', body);
  s.rect(8, 36 + y, 30, 4, 'b', body);
  const reels = s.part();
  for (let i = 0; i < 3; i++) {
    s.rect(9 + i * 10, 18 + y, 8, 10, 'w', reels);
    const sym = (P.i + i) % 3;
    if (sym === 0) s.ell(13 + i * 10, 23 + y, 2, 2, 'r', reels);
    else if (sym === 1) s.tri(13 + i * 10, 20 + y, 10 + i * 10, 26 + y, 16 + i * 10, 26 + y, 'y', reels);
    else s.rect(11 + i * 10, 21 + y, 4, 4, 'g', reels);
  }
  const hat = s.part();
  s.rect(12, 2 + y, 22, 9, 'd', hat);
  s.rect(9, 10 + y, 28, 2, 'd', hat);
  s.rect(12, 7 + y, 22, 2, 'r', hat);
  const face = s.part();
  s.eye(16, 32 + y, P, face);
  s.eye(30, 32 + y, P, face);
  if (P.atk) s.rect(19, 34 + y, 8, 2, 'k', face);
};

/** Sturmgreif Kragor: Adlerkopf, Löwenleib, ausgebreitete Schwingen */
const kragor: DrawFn = (s, P) => {
  const S = 64;
  const g = S - 2;
  const y = P.bob * 1.5;
  const flap = P.i % 2 ? 6 : -4;
  const wings = s.part();
  s.tri(30, 26 + y, 4, 6 + y + flap, 18, 34 + y, 'c', wings);
  s.tri(36, 26 + y, 62, 4 + y + flap, 48, 34 + y, 'c', wings, true);
  for (let i = 0; i < 4; i++) {
    s.line(8 + i * 4, 10 + i * 4 + y + flap, 24, 30 + y, 'b', wings);
    s.line(58 - i * 4, 8 + i * 4 + y + flap, 42, 30 + y, 'b', wings, 1, true);
  }
  const legs = s.part();
  s.rect(22 + P.step, 44 + y, 5, g - 44 - y, 'a', legs);
  s.rect(38 - P.step, 44 + y, 5, g - 44 - y, 'a', legs);
  s.rect(21 + P.step, g - 2, 7, 2, 'y', legs);
  s.rect(37 - P.step, g - 2, 7, 2, 'y', legs);
  const body = s.part();
  s.ell(33, 40 + y, 15, 11, 'a', body);
  s.line(48, 40 + y, 58, 46 + y, 'a', body, 2);
  s.ell(59, 47 + y, 2.5, 2.5, 'b', body);
  const head = s.part();
  s.ell(24, 22 + y, 8, 8, 'b', head);
  s.tri(16, 20 + y, 9, 25 + y, 17, 26 + y, 'y', head);
  s.eye(21, 20 + y, P, head);
  if (P.special) for (let i = 0; i < 4; i++) s.line(40 + i * 5, 10, 38 + i * 5, 18, 'g', wings);
};

/** Die Nebelmutter: Geistergestalt aus Nebelschleiern mit Laternenaugen */
const nebelmutter: DrawFn = (s, P) => {
  const y = P.bob * 1.5 - 2;
  const robe = s.part();
  s.tri(28, 12 + y, 6, 52, 50, 52, 'a', robe);
  for (let i = 0; i < 5; i++) s.ell(9 + i * 9.5, 50 + ((P.i + i) % 2), 5, 3, 'a', robe);
  const hair = s.part();
  s.ell(28, 14 + y, 11, 12, 'b', hair);
  s.tri(17, 14 + y, 8, 40 + y, 20, 30 + y, 'b', hair);
  s.tri(39, 14 + y, 48, 40 + y, 36, 30 + y, 'b', hair, true);
  const face = s.part();
  s.ell(28, 16 + y, 6, 7, 'w', face);
  s.ell(25.5, 15 + y, 1.6, 1.8, 'g', face);
  s.ell(30.5, 15 + y, 1.6, 1.8, 'g', face);
  const arms = s.part();
  const reach = P.atk ? 8 : 0;
  s.line(18, 26 + y, 6 - reach, 34 + y, 'a', arms, 2.4);
  s.line(38, 26 + y, 50 + reach, 34 + y, 'a', arms, 2.4, true);
  const lantern = s.part();
  s.ell(5 - reach, 37 + y, 3, 4, 'g', lantern);
};

/** Der Dornenbaron: Ritter aus Dornenranken mit Rosenwappen */
const dornenbaron: DrawFn = (s, P) => {
  const S = 48;
  const g = S - 2;
  const y = P.bob;
  const legs = s.part();
  s.rect(17 + P.step, g - 10, 5, 10, 'b', legs);
  s.rect(27 - P.step, g - 10, 5, 10, 'b', legs);
  const sword = s.part();
  const sw = P.atk ? -10 : 0;
  s.line(36, 30 + y, 46, 14 + y + sw, 'a', sword, 2.4);
  for (let i = 0; i < 4; i++) s.px(38 + i * 2, 26 + y - i * 3 + sw * (i / 4), 'w', sword);
  const body = s.part();
  s.ell(24, 28 + y, 11, 12, 'a', body);
  s.rect(15, 26 + y, 18, 4, 'b', body);
  const rose = s.part();
  s.ell(24, 28 + y, 4, 4, 'c', rose);
  s.px(24, 28 + y, 'R', rose);
  const head = s.part();
  s.ell(24, 13 + y, 7, 7, 'b', head);
  s.rect(19, 12 + y, 10, 2, 'k', head);
  s.px(21, 12 + y, 'g', head);
  s.px(27, 12 + y, 'g', head);
  for (let i = 0; i < 5; i++) s.tri(18 + i * 3, 7 + y, 19 + i * 3, 2 + y, 20 + i * 3, 7 + y, 'a', head);
  // Dornen rundum
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s.px(24 + Math.cos(a) * 12, 28 + y + Math.sin(a) * 13, 'w', body);
  }
};

/** Der Leere Leser: gesichtslose Gestalt mit riesigem, offenem Buch */
const leser: DrawFn = (s, P) => {
  const y = P.bob * 1.5 - 1;
  const robe = s.part();
  s.tri(28, 10 + y, 8, 54, 48, 54, 'a', robe);
  const hood = s.part();
  s.ell(28, 13 + y, 10, 11, 'a', hood);
  const face = s.part();
  s.ell(28, 15 + y, 6, 7, 'w', face);
  if (P.atk || P.special) {
    s.line(24, 15 + y, 26, 15 + y, 'g', face);
    s.line(30, 15 + y, 32, 15 + y, 'g', face);
  }
  const book = s.part();
  const open = P.atk ? 3 : 0;
  s.tri(28, 30 + y, 12 - open, 26 + y, 14 - open, 40 + y, 'b', book);
  s.tri(28, 30 + y, 44 + open, 26 + y, 42 + open, 40 + y, 'b', book, true);
  s.rect(27, 28 + y, 2, 12, 'c', book);
  for (let i = 0; i < 3; i++) {
    s.line(16, 30 + y + i * 3, 25, 32 + y + i * 3, 'k', book);
    s.line(31, 32 + y + i * 3, 40, 30 + y + i * 3, 'k', book);
  }
  const pages = s.part();
  for (let i = 0; i < 3; i++) {
    const px = 10 + ((P.i * 7 + i * 17) % 36);
    const py = 6 + ((P.i * 5 + i * 11) % 14);
    s.rect(px, py, 4, 5, 'b', pages);
  }
};

/** Varga Aschenherz: Anführerin der Aschenhand, Mantel aus Asche */
const varga: DrawFn = (s, P) => {
  const S = 40;
  const g = S - 2;
  const y = P.bob;
  const cape = s.part();
  s.tri(20, 12 + y, 6, g - 2, 34, g - 2, 'b', cape);
  const legs = s.part();
  s.rect(15 + P.step, g - 8, 4, 8, 'd', legs);
  s.rect(22 - P.step, g - 8, 4, 8, 'd', legs);
  const body = s.part();
  s.rect(13, 16 + y, 14, 14, 'a', body);
  s.rect(13, 25 + y, 14, 2, 'c', body);
  const arm = s.part();
  const cast = P.atk || P.special ? -8 : 0;
  s.line(26, 18 + y, 33, 24 + y + cast, 'a', arm, 2.4);
  if (P.atk || P.special) s.ell(34, 22 + y + cast, 3, 3, 'g', arm);
  s.line(14, 18 + y, 9, 26 + y, 'a', arm, 2.4);
  const head = s.part();
  s.ell(20, 10 + y, 6, 6, 'w', head);
  const hair = s.part();
  s.ell(20, 7 + y, 7, 4, 'c', hair);
  s.tri(13, 7 + y, 10, 20 + y, 16, 12 + y, 'c', hair);
  s.tri(27, 7 + y, 30, 20 + y, 24, 12 + y, 'c', hair);
  const face = s.part();
  s.px(18, 10 + y, 'r', face);
  s.px(22, 10 + y, 'r', face);
};

/** Handlanger der Aschenhand (Grell, Vesper, Nox) */
const henchman: DrawFn = (s, P) => {
  const g = 26;
  const y = P.bob;
  const legs = s.part();
  s.rect(9 + P.step, g - 6, 3, 6, 'd', legs);
  s.rect(14 - P.step, g - 6, 3, 6, 'd', legs);
  const body = s.part();
  s.rect(8, 11 + y, 10, 10, 'a', body);
  s.rect(8, 17 + y, 10, 2, 'c', body);
  const arm = s.part();
  const hit = P.atk ? -5 : 0;
  s.line(17, 13 + y, 22, 17 + y + hit, 'a', arm, 2);
  s.line(9, 13 + y, 5, 18 + y, 'a', arm, 2);
  const head = s.part();
  s.ell(13, 7 + y, 4.5, 4.5, 'w', head);
  const mask = s.part();
  s.rect(9, 6 + y, 9, 2, 'b', mask);
  s.px(11, 7 + y, 'g', mask);
  s.px(15, 7 + y, 'g', mask);
  const hood = s.part();
  s.ell(13, 4 + y, 5, 3, 'b', hood);
};

/** Strohpuppe für das Training in Hohenkamm */
const strawman: DrawFn = (s, P) => {
  const wob = P.hurt ? 1 : 0;
  const post = s.part();
  s.rect(11, 14, 2, 9, 'b', post);
  const body = s.part();
  s.ell(12 + wob, 13, 5, 6, 'a', body);
  s.rect(4 + wob, 10, 16, 3, 'a', body);
  s.line(7 + wob, 15, 17 + wob, 15, 'b', body);
  const head = s.part();
  s.ell(12 + wob, 5, 4, 4, 'a', head);
  s.px(10 + wob, 5, 'k', head);
  s.px(14 + wob, 5, 'k', head);
  s.line(10 + wob, 7, 14 + wob, 7, 'k', head);
  s.rect(8 + wob, 1, 8, 2, 'c', head);
};

const R = RAMPS;

export const SPECIES: Record<string, SpeciesGfx> = {
  wollknaeuel: { size: 16, draw: fluff, m: mats(R.white, R.pink) },
  huepfpilz: { size: 16, draw: shroom, m: mats(R.red, R.paper) },
  blattschnapper: { size: 24, draw: plantSnapper, m: mats(R.green, R.pink, R.wood, PAL.cream) },
  wiesenflitzer: { size: 16, draw: quad({ size: 16, body: [4.6, 3.2], head: 3, ears: 'long', tail: 'puff', legH: 3.5, belly: false }), m: mats(R.sand, R.white) },
  kieselkrebs: { size: 16, draw: crab(16), m: mats(R.grey, R.sky) },
  zangenkrabbe: { size: 24, draw: crab(24), m: mats(R.red, R.orange) },
  schlammkroete: { size: 16, draw: frog, m: mats(R.leather, R.lime) },
  stachelschwalbe: { size: 16, draw: bird(16, { spikes: true }), m: mats(R.blue, R.white, R.gold) },
  klippenmoewe: { size: 16, draw: bird(16, { whiteHead: true }), m: mats(R.silver, R.white, R.gold) },
  gipfeladler: { size: 32, draw: bird(32, { whiteHead: true, crest: true }), m: mats(R.wood, R.white, R.gold) },
  tintenkobold: { size: 16, draw: imp, m: mats(R.blue, R.ink, R.sand, PAL.gold) },
  papierflatterer: { size: 16, draw: paperBat, m: mats(R.paper, R.ink) },
  glyphenwaechter: { size: 24, draw: golem(24, false), m: mats(R.grey, R.ice, R.gold, PAL.cyan) },
  moosgolem: { size: 32, draw: golem(32, true), m: mats(R.grey, R.green, R.gold, PAL.lime) },
  kaktuskrieger: { size: 24, draw: cactus, m: mats(R.green, R.pink) },
  strohpuppe: { size: 24, draw: strawman, m: mats(R.sand, R.wood, R.red) },
  moosbart: { size: 56, draw: moosbart, m: mats(R.green, R.lime, R.pink, PAL.lime) },
  tintenkoloss: { size: 56, draw: tintenkoloss, m: mats(R.ink, R.paper, R.violet, PAL.violet) },
  tiefenmaul: { size: 64, draw: tiefenmaul, m: mats(R.violet, R.pink, R.sky, PAL.cyan) },
  hausbankier: { size: 48, draw: hausbankier, m: mats(R.red, R.gold, R.silver, PAL.lime) },
  kragor: { size: 64, draw: kragor, m: mats(R.sand, R.white, R.sky, PAL.cyan) },
  nebelmutter: { size: 56, draw: nebelmutter, m: mats(R.ice, R.silver, R.teal, PAL.cyan) },
  dornenbaron: { size: 48, draw: dornenbaron, m: mats(R.green, R.dark, R.red, PAL.red) },
  leser: { size: 56, draw: leser, m: mats(R.ink, R.paper, R.violet, PAL.violet) },
  varga: { size: 40, draw: varga, m: mats(R.dark, R.red, R.silver, PAL.orange) },
  grell: { size: 28, draw: henchman, m: mats(R.leather, R.dark, R.red, PAL.orange) },
  vesper: { size: 28, draw: henchman, m: mats(R.violet, R.dark, R.silver, PAL.violet) },
  nox: { size: 28, draw: henchman, m: mats(R.navy, R.dark, R.grey, PAL.cyan) },
  kartensoldat: { size: 24, draw: cardSoldier, m: mats(R.red, R.white, R.wood) },
  quallenlicht: { size: 16, draw: jelly, m: mats(R.pink, R.ice, R.gold, PAL.cream) },
  irrlicht: { size: 16, draw: wisp, m: mats(R.ice, R.teal) },
  trugbild: { size: 24, draw: ghost(24, false), m: mats(R.sand, R.orange, R.gold, PAL.orange) },
  tintenschatten: { size: 24, draw: ghost(24, true), m: mats(R.ink, R.violet, R.gold, PAL.magenta) },
  wuerfelmimik: { size: 16, draw: mimic, m: mats(R.wood, R.wood, R.gold, PAL.gold) },
  jetonratte: { size: 16, draw: quad({ size: 16, body: [4.4, 3], head: 3, ears: 'round', tail: 'thin', snout: 2, legH: 3, item: 'chip' }), m: mats(R.grey, R.pink) },
  glueckskatze: { size: 16, draw: quad({ size: 16, body: [4.4, 3.2], head: 3.4, ears: 'pointy', tail: 'curl', legH: 3.5, belly: true }), m: mats(R.gold, R.white) },
  schattenluchs: { size: 24, draw: quad({ size: 24, body: [6.5, 4], head: 4.2, ears: 'tuft', tail: 'stub', legH: 5, glowEyes: true }), m: mats(R.ink, R.violet, R.gold, PAL.violet) },
  frostfuchs: { size: 24, draw: quad({ size: 24, body: [6, 3.6], head: 3.8, ears: 'pointy', tail: 'bushy', snout: 2.4, legH: 5, belly: true }), m: mats(R.ice, R.white) },
  nebelwolf: { size: 24, draw: quad({ size: 24, body: [6.8, 4.2], head: 4, ears: 'pointy', tail: 'down', snout: 2.6, legH: 5, mane: true }), m: mats(R.grey, R.silver) },
  'nebelwolf-alpha': { size: 32, draw: quad({ size: 32, body: [9.5, 5.8], head: 5.4, ears: 'pointy', tail: 'down', snout: 3.4, legH: 6, mane: true, glowEyes: true }), m: mats(R.silver, R.violet, R.gold, PAL.violet) },
  felsbock: { size: 24, draw: quad({ size: 24, body: [6.8, 4.4], head: 3.8, ears: 'none', tail: 'stub', horns: 'back', beard: true, legH: 5 }), m: mats(R.grey, R.white, R.wood) },
  donnerwidder: { size: 24, draw: quad({ size: 24, body: [7, 4.8], head: 3.8, ears: 'none', tail: 'stub', horns: 'curl', legH: 5, belly: true }), m: mats(R.white, R.silver, R.gold) },
  duenenwuehler: { size: 24, draw: worm, m: mats(R.orange, R.sand) },
  goldkaefer: { size: 24, draw: beetle, m: mats(R.gold, R.leather, R.gold) },
  herzfalter: { size: 16, draw: butterfly, m: mats(R.pink, R.violet) },
  dornenranke: { size: 24, draw: vine, m: mats(R.green, R.red) },
  seitenfresser: { size: 24, draw: bookEater, m: mats(R.leather, R.paper, R.gold, PAL.lime) },
  wurzelhydra: { size: 40, draw: hydra, m: mats(R.wood, R.green, R.gold, PAL.lime) },
};

/** Erzeugt das Spritesheet einer Art (7 Frames nebeneinander). */
export function creatureSheet(id: string): Raster {
  const sp = SPECIES[id];
  const frames = POSES.map((P) => {
    const s = new Shape(sp.size);
    sp.draw(s, P);
    return s.render(sp.m);
  });
  return strip(frames);
}
