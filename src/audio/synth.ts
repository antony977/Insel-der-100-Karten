/**
 * Kleiner Software-Synthesizer: erzeugt Klänge direkt als Abtastwerte (Float32).
 * Wellenformen: Rechteck (mit Pulsbreite), Dreieck, Sägezahn, Sinus, Rauschen.
 * Alles wird einmal berechnet und danach als AudioBuffer abgespielt – kostet zur Laufzeit
 * praktisch keine Rechenzeit.
 */

export const RATE = 22050;

export type Wave = 'square' | 'triangle' | 'saw' | 'sine' | 'noise';

export interface Tone {
  wave: Wave;
  /** Startfrequenz (Hz) */
  freq: number;
  /** Endfrequenz (Hz) – linearer Verlauf */
  freqEnd?: number;
  /** Dauer (s) */
  dur: number;
  vol?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  /** Pulsbreite bei Rechteck (0–1) */
  duty?: number;
  vibrato?: { rate: number; depth: number; delay?: number };
  /** Zeitversatz (s) innerhalb des Klangs */
  at?: number;
  /** Tiefpass (0–1, kleiner = dumpfer) für Rauschen */
  lowpass?: number;
}

let noiseSeed = 12345;
/** Rauschgenerator zurücksetzen (gleiche Saat → gleicher Klang) */
export function resetNoise(seed = 12345): void {
  noiseSeed = seed;
}
function noise(): number {
  noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
  return (noiseSeed / 0x7fffffff) * 2 - 1;
}

/** Ton in einen Puffer mischen */
export function renderTone(out: Float32Array, t: Tone, offset = 0): void {
  const start = Math.floor(((t.at ?? 0) + offset) * RATE);
  const n = Math.floor(t.dur * RATE);
  const atk = (t.attack ?? 0.004) * RATE;
  const dec = (t.decay ?? 0.05) * RATE;
  const sus = t.sustain ?? 0.7;
  const rel = (t.release ?? 0.04) * RATE;
  const vol = t.vol ?? 0.3;
  const duty = t.duty ?? 0.5;
  let phase = 0;
  let lp = 0;
  const lpk = t.lowpass ?? 1;
  let held = 0;
  let holdT = 0;
  for (let i = 0; i < n + rel; i++) {
    const idx = start + i;
    if (idx < 0) continue;
    if (idx >= out.length) break;
    const k = Math.min(1, i / n);
    let f = t.freq + ((t.freqEnd ?? t.freq) - t.freq) * k;
    if (t.vibrato) {
      const tt = i / RATE;
      if (tt > (t.vibrato.delay ?? 0)) f *= 1 + Math.sin(tt * Math.PI * 2 * t.vibrato.rate) * t.vibrato.depth;
    }
    phase += f / RATE;
    phase -= Math.floor(phase);
    let s = 0;
    switch (t.wave) {
      case 'square':
        s = phase < duty ? 1 : -1;
        break;
      case 'triangle':
        s = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
        break;
      case 'saw':
        s = phase * 2 - 1;
        break;
      case 'sine':
        s = Math.sin(phase * Math.PI * 2);
        break;
      case 'noise': {
        // Rauschen mit „Tonhöhe": Wert halten je nach Frequenz
        holdT += f / RATE;
        if (holdT >= 1) {
          holdT -= Math.floor(holdT);
          held = noise();
        }
        lp += (held - lp) * lpk;
        s = lp;
        break;
      }
    }
    let env: number;
    if (i < atk) env = i / Math.max(1, atk);
    else if (i < atk + dec) env = 1 - (1 - sus) * ((i - atk) / Math.max(1, dec));
    else if (i < n) env = sus;
    else env = sus * Math.max(0, 1 - (i - n) / Math.max(1, rel));
    out[idx] += s * env * vol;
  }
}

/** Länge, die ein Satz Töne braucht */
export function lengthOf(tones: Tone[]): number {
  return Math.max(...tones.map((t) => (t.at ?? 0) + t.dur + (t.release ?? 0.04))) + 0.02;
}

/** MIDI-Notennummer → Frequenz */
export function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Sanfte Begrenzung gegen Übersteuern */
export function softClip(buf: Float32Array, drive = 1): void {
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] * drive;
    buf[i] = x / (1 + Math.abs(x));
  }
}
