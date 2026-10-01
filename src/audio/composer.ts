import { mtof, RATE, renderTone, resetNoise, softClip, type Wave } from './synth';

/**
 * Chiptune-Komponist: Aus einer kurzen Beschreibung (Tonart, Tempo, Taktart, Akkordfolge,
 * Stil) entsteht deterministisch ein Musikstück mit vier Stimmen – Melodie, Begleitung
 * (Arpeggio/Akkorde), Bass und Schlagzeug. Gleiche Saat → gleiches Stück.
 */

export type Meter = 'four' | 'three' | 'six8';

export interface SongSpec {
  id: string;
  bpm: number;
  meter: Meter;
  /** Grundton (MIDI) */
  root: number;
  /** Tonleiter-Intervalle */
  scale: number[];
  /** Akkord-Stufen je Takt (0 = Tonika) */
  prog: number[];
  /** Wiederholungen der Akkordfolge */
  repeats?: number;
  lead: { wave: Wave; duty?: number; octave: number; density: number; vol: number; vibrato?: boolean };
  harmony: { style: 'arp' | 'arp8' | 'chord' | 'none'; wave?: Wave; duty?: number; vol: number; octave: number };
  bass: { style: 'root' | 'octave' | 'walk' | 'waltz' | 'pulse' | 'long'; vol: number };
  drums: { style: 'none' | 'soft' | 'rock' | 'march' | 'waltz' | 'swing' | 'six8' | 'boss' | 'shaker'; vol: number };
  /** Swing-Anteil (0–0.5) */
  swing?: number;
  seed: number;
  /** feste Melodie: je Takt Liste von [Stufe relativ zum Grundton, Länge in 16teln]; Stufe null = Pause */
  motif?: (number | null)[][][];
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygianDom: [0, 1, 4, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 2, 4, 7, 9, 12, 14],
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barLength(m: Meter): number {
  return m === 'four' ? 16 : 12;
}

/** Stufe (beliebig, auch negativ/über 7) → MIDI */
function degreeToMidi(spec: SongSpec, deg: number, octave: number): number {
  const s = spec.scale;
  const len = s.length;
  const o = Math.floor(deg / len);
  const i = ((deg % len) + len) % len;
  return spec.root + 12 * (octave + o) + s[i];
}

// Rhythmus-Muster für die Melodie (16tel-Raster, 1 = Notenbeginn) je Taktart
const RHYTHMS: Record<Meter, number[][]> = {
  four: [
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  three: [
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
  ],
  six8: [
    [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
  ],
};

interface Note {
  deg: number | null;
  start: number;
  len: number;
}

/** Melodie eines Taktes erzeugen */
function melodyBar(spec: SongSpec, chord: number, r: () => number, prevDeg: { v: number }, cadence: boolean): Note[] {
  const pats = RHYTHMS[spec.meter];
  const bl = barLength(spec.meter);
  const dens = spec.lead.density;
  // dichteabhängige Musterauswahl
  const idx = Math.min(pats.length - 1, Math.floor(r() * pats.length * 0.6 + dens * pats.length * 0.5));
  const pat = cadence ? pats[pats.length - 1] : pats[Math.max(0, idx)];
  const starts: number[] = [];
  for (let i = 0; i < bl; i++) if (pat[i]) starts.push(i);
  const notes: Note[] = [];
  const chordTones = [chord, chord + 2, chord + 4];
  starts.forEach((s, k) => {
    const len = (k + 1 < starts.length ? starts[k + 1] : bl) - s;
    const strong = s % (spec.meter === 'four' ? 8 : 6) === 0;
    let deg: number;
    if (cadence && k === starts.length - 1) deg = chord;
    else if (strong) {
      // nächster Akkordton zur vorigen Note
      let best = chordTones[0];
      let bd = 99;
      for (const ct of chordTones) {
        for (const oct of [-7, 0, 7]) {
          const d = Math.abs(ct + oct - prevDeg.v);
          if (d < bd || (d === bd && r() < 0.5)) {
            bd = d;
            best = ct + oct;
          }
        }
      }
      deg = best;
    } else {
      const step = r() < 0.7 ? (r() < 0.5 ? -1 : 1) : r() < 0.5 ? -2 : 2;
      deg = prevDeg.v + step;
    }
    // Bereich begrenzen
    if (deg > 9) deg -= 7;
    if (deg < -3) deg += 7;
    // gelegentliche Pausen
    if (!strong && r() < 0.08 && !cadence) {
      notes.push({ deg: null, start: s, len });
      return;
    }
    prevDeg.v = deg;
    notes.push({ deg, start: s, len });
  });
  return notes;
}

/** Komplettes Stück als Abtastwerte */
export function renderSong(spec: SongSpec): Float32Array {
  const bl = barLength(spec.meter);
  const reps = spec.repeats ?? 2;
  const bars = spec.prog.length * reps;
  const sec16 = 60 / spec.bpm / 4;
  const total = bars * bl * sec16;
  const loopLen = Math.ceil(total * RATE);
  // etwas länger rendern: Ausklang wird für nahtlose Schleifen an den Anfang gefaltet
  const out = new Float32Array(loopLen + RATE);
  const r = rng(spec.seed);
  resetNoise(spec.seed);
  const swing = spec.swing ?? 0;
  const t16 = (i: number) => {
    // Swing: jede zweite Achtel verspätet
    const eighth = Math.floor(i / 2);
    const off = i % 2 === 0 && eighth % 2 === 1 ? swing * sec16 * 2 : 0;
    return i * sec16 + off;
  };

  // --- Melodie (Phrasen à 4 Takte, mit Wiederholung und Variation)
  const phraseCache = new Map<string, Note[]>();
  const prevDeg = { v: spec.prog[0] + 7 };
  for (let b = 0; b < bars; b++) {
    const chord = spec.prog[b % spec.prog.length];
    const inPhrase = b % 4;
    const cadence = inPhrase === 3 && (b % 8 === 7 || b === bars - 1);
    let notes: Note[];
    const motif = spec.motif?.[b % (spec.motif?.length ?? 1)];
    if (motif) {
      let pos = 0;
      notes = motif.map(([d, len]) => {
        const n: Note = { deg: d === null ? null : (d as number), start: pos, len: (len as number) ?? 4 };
        pos += (len as number) ?? 4;
        return n;
      });
    } else {
      // Takt 1–2 einer Phrase werden in der nächsten Phrase wiederholt (A A')
      const key = `${b % 8 < 4 ? 'A' : 'B'}${inPhrase}`;
      const reuse = b >= 8 && inPhrase < 2 ? phraseCache.get(key) : undefined;
      notes = reuse ?? melodyBar(spec, chord, r, prevDeg, cadence);
      if (!reuse) phraseCache.set(key, notes);
    }
    for (const n of notes) {
      if (n.deg === null) continue;
      const midi = degreeToMidi(spec, n.deg, spec.lead.octave);
      const start = t16(b * bl + n.start);
      const dur = Math.max(sec16 * 0.9, (t16(b * bl + n.start + n.len) - start) * 0.92);
      renderTone(out, {
        wave: spec.lead.wave,
        duty: spec.lead.duty,
        freq: mtof(midi),
        dur,
        vol: spec.lead.vol,
        attack: 0.006,
        decay: 0.08,
        sustain: 0.6,
        release: 0.05,
        vibrato: spec.lead.vibrato && dur > 0.25 ? { rate: 5.5, depth: 0.012, delay: 0.12 } : undefined,
        at: start,
      });
    }
  }

  // --- Begleitung
  const h = spec.harmony;
  if (h.style !== 'none') {
    for (let b = 0; b < bars; b++) {
      const chord = spec.prog[b % spec.prog.length];
      const tones = [chord, chord + 2, chord + 4, chord + 7];
      if (h.style === 'chord') {
        // Akkord-Flächen auf jeder Zählzeit (gedämpft)
        const beat = spec.meter === 'four' ? 4 : spec.meter === 'three' ? 4 : 6;
        for (let s = 0; s < bl; s += beat) {
          if (spec.meter === 'three' && s === 0) continue;
          for (const d of tones.slice(0, 3)) {
            renderTone(out, { wave: h.wave ?? 'square', duty: h.duty ?? 0.125, freq: mtof(degreeToMidi(spec, d, h.octave)), dur: sec16 * beat * 0.6, vol: h.vol * 0.6, at: t16(b * bl + s), decay: 0.1, sustain: 0.4 });
          }
        }
      } else {
        const stepLen = h.style === 'arp' ? 1 : 2;
        const order = [0, 1, 2, 3, 2, 1];
        for (let s = 0, k = 0; s < bl; s += stepLen, k++) {
          const d = tones[order[k % order.length]];
          renderTone(out, { wave: h.wave ?? 'square', duty: h.duty ?? 0.25, freq: mtof(degreeToMidi(spec, d, h.octave)), dur: sec16 * stepLen * 0.8, vol: h.vol, at: t16(b * bl + s), decay: 0.06, sustain: 0.35, release: 0.03 });
        }
      }
    }
  }

  // --- Bass
  const bs = spec.bass;
  for (let b = 0; b < bars; b++) {
    const chord = spec.prog[b % spec.prog.length];
    const next = spec.prog[(b + 1) % spec.prog.length];
    const root = degreeToMidi(spec, chord, -2);
    const add = (midi: number, s: number, len: number, vol = bs.vol) =>
      renderTone(out, { wave: 'triangle', freq: mtof(midi), dur: sec16 * len * 0.9, vol, at: t16(b * bl + s), attack: 0.004, decay: 0.05, sustain: 0.8, release: 0.03 });
    switch (bs.style) {
      case 'root':
        for (let s = 0; s < bl; s += 8) add(root, s, 6);
        break;
      case 'long':
        add(root, 0, bl);
        break;
      case 'octave':
        for (let s = 0; s < bl; s += 2) add(s % 4 === 0 ? root : root + 12, s, 2);
        break;
      case 'pulse':
        for (let s = 0; s < bl; s += 2) add(root, s, 1.6);
        break;
      case 'waltz':
        add(root, 0, 4);
        if (spec.meter === 'six8') add(degreeToMidi(spec, chord + 4, -2), 6, 4);
        break;
      case 'walk': {
        const target = degreeToMidi(spec, next, -2);
        const steps = [root, degreeToMidi(spec, chord + 2, -2), degreeToMidi(spec, chord + 4, -2), target + (target > root ? -1 : 1)];
        for (let k = 0; k < 4; k++) add(steps[k], k * 4, 3.4);
        break;
      }
    }
  }

  // --- Schlagzeug
  const dr = spec.drums;
  const kick = (s: number, v = 1) => {
    renderTone(out, { wave: 'sine', freq: 140, freqEnd: 45, dur: 0.1, vol: 0.5 * dr.vol * v, at: t16(s), attack: 0.001, decay: 0.08, sustain: 0.2 });
  };
  const snare = (s: number, v = 1) => {
    renderTone(out, { wave: 'noise', freq: 5000, dur: 0.09, vol: 0.22 * dr.vol * v, at: t16(s), attack: 0.001, decay: 0.06, sustain: 0.2, lowpass: 0.6 });
    renderTone(out, { wave: 'triangle', freq: 220, freqEnd: 160, dur: 0.05, vol: 0.15 * dr.vol * v, at: t16(s) });
  };
  const hat = (s: number, v = 1) => {
    renderTone(out, { wave: 'noise', freq: 11000, dur: 0.025, vol: 0.08 * dr.vol * v, at: t16(s), attack: 0.001, decay: 0.02, sustain: 0.1, lowpass: 1 });
  };
  for (let b = 0; b < bars; b++) {
    const o = b * bl;
    switch (dr.style) {
      case 'soft':
        kick(o, 0.7);
        for (let s = 0; s < bl; s += 4) hat(o + s, 0.6);
        break;
      case 'shaker':
        for (let s = 0; s < bl; s += 2) hat(o + s, s % 4 === 0 ? 0.5 : 0.3);
        break;
      case 'rock':
        kick(o);
        kick(o + 8);
        snare(o + 4);
        snare(o + 12);
        for (let s = 0; s < bl; s += 2) hat(o + s);
        if (b % 4 === 3) kick(o + 10, 0.8);
        break;
      case 'march':
        kick(o);
        kick(o + 8);
        snare(o + 4);
        snare(o + 12);
        snare(o + 14, 0.6);
        snare(o + 15, 0.6);
        for (let s = 0; s < bl; s += 2) hat(o + s, 0.7);
        break;
      case 'waltz':
        kick(o);
        hat(o + 4);
        hat(o + 8);
        break;
      case 'six8':
        kick(o);
        snare(o + 6, 0.7);
        for (let s = 0; s < bl; s += 2) hat(o + s, 0.6);
        break;
      case 'swing':
        kick(o, 0.8);
        kick(o + 8, 0.6);
        snare(o + 4, 0.5);
        snare(o + 12, 0.5);
        for (let s = 0; s < bl; s += 4) {
          hat(o + s, 0.8);
          hat(o + s + 3, 0.5);
        }
        break;
      case 'boss':
        for (let s = 0; s < bl; s += 2) kick(o + s, s % 4 === 0 ? 1 : 0.6);
        snare(o + 4);
        snare(o + 12);
        for (let s = 0; s < bl; s++) hat(o + s, 0.4);
        break;
      default:
        break;
    }
  }
  for (let i = loopLen; i < out.length; i++) out[i - loopLen] += out[i];
  const loop = out.subarray(0, loopLen);
  softClip(loop, 1.1);
  return loop.slice();
}
