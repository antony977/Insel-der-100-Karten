import { mtof, type Tone } from './synth';

/**
 * Alle Soundeffekte als Synthesizer-Parameter (datengetrieben). Eigene Klänge – keine
 * Samples aus bestehenden Werken.
 */
const n = mtof;

export const SFX: Record<string, Tone[]> = {
  // ----------------------------------------------------------- Kampf
  swing: [{ wave: 'noise', freq: 4000, freqEnd: 1500, dur: 0.09, vol: 0.18, attack: 0.002, decay: 0.05, sustain: 0.3, lowpass: 0.5 }],
  swingHeavy: [
    { wave: 'noise', freq: 2600, freqEnd: 700, dur: 0.16, vol: 0.24, attack: 0.002, decay: 0.08, sustain: 0.4, lowpass: 0.4 },
    { wave: 'square', freq: 220, freqEnd: 110, dur: 0.12, vol: 0.06, duty: 0.25 },
  ],
  hit: [
    { wave: 'noise', freq: 6000, freqEnd: 2000, dur: 0.06, vol: 0.28, attack: 0.001, decay: 0.03, sustain: 0.4, lowpass: 0.7 },
    { wave: 'square', freq: 180, freqEnd: 90, dur: 0.07, vol: 0.14, duty: 0.5 },
  ],
  crit: [
    { wave: 'noise', freq: 7000, freqEnd: 1500, dur: 0.1, vol: 0.3, attack: 0.001, decay: 0.05, sustain: 0.3, lowpass: 0.8 },
    { wave: 'square', freq: n(84), freqEnd: n(96), dur: 0.08, vol: 0.12, duty: 0.25, at: 0.02 },
    { wave: 'square', freq: 150, freqEnd: 60, dur: 0.12, vol: 0.14 },
  ],
  clank: [
    { wave: 'square', freq: 1400, freqEnd: 1300, dur: 0.05, vol: 0.12, duty: 0.3 },
    { wave: 'square', freq: 2100, freqEnd: 2000, dur: 0.07, vol: 0.08, duty: 0.3, at: 0.01 },
  ],
  hurt: [
    { wave: 'square', freq: 520, freqEnd: 160, dur: 0.16, vol: 0.18, duty: 0.4 },
    { wave: 'noise', freq: 3000, freqEnd: 800, dur: 0.1, vol: 0.12, lowpass: 0.5 },
  ],
  enemyDie: [
    { wave: 'square', freq: 600, freqEnd: 80, dur: 0.22, vol: 0.14, duty: 0.25 },
    { wave: 'noise', freq: 2000, freqEnd: 300, dur: 0.25, vol: 0.14, lowpass: 0.3, at: 0.04 },
  ],
  roll: [{ wave: 'noise', freq: 1800, freqEnd: 600, dur: 0.14, vol: 0.12, attack: 0.02, lowpass: 0.25 }],
  shoot: [
    { wave: 'square', freq: n(76), freqEnd: n(88), dur: 0.08, vol: 0.12, duty: 0.25 },
    { wave: 'noise', freq: 5000, freqEnd: 2000, dur: 0.05, vol: 0.06, lowpass: 0.6 },
  ],
  stoss: [
    { wave: 'square', freq: n(64), freqEnd: n(84), dur: 0.12, vol: 0.13, duty: 0.125 },
    { wave: 'triangle', freq: n(52), freqEnd: n(64), dur: 0.14, vol: 0.2 },
  ],
  burst: [{ wave: 'noise', freq: 3500, freqEnd: 500, dur: 0.15, vol: 0.18, lowpass: 0.4 }],
  stomp: [
    { wave: 'triangle', freq: 120, freqEnd: 40, dur: 0.3, vol: 0.45, attack: 0.002 },
    { wave: 'noise', freq: 900, freqEnd: 200, dur: 0.35, vol: 0.22, lowpass: 0.2 },
  ],
  alert: [{ wave: 'square', freq: n(81), dur: 0.05, vol: 0.08, duty: 0.25 }, { wave: 'square', freq: n(86), dur: 0.07, vol: 0.08, duty: 0.25, at: 0.06 }],
  // ----------------------------------------------------------- Aura
  auraOn: [
    { wave: 'triangle', freq: n(55), freqEnd: n(67), dur: 0.25, vol: 0.22, attack: 0.03 },
    { wave: 'square', freq: n(79), freqEnd: n(91), dur: 0.2, vol: 0.05, duty: 0.125, at: 0.05, vibrato: { rate: 14, depth: 0.02 } },
  ],
  auraOff: [{ wave: 'triangle', freq: n(67), freqEnd: n(50), dur: 0.18, vol: 0.18 }],
  shield: [
    { wave: 'sine', freq: n(72), freqEnd: n(79), dur: 0.3, vol: 0.18, attack: 0.02, vibrato: { rate: 9, depth: 0.03 } },
    { wave: 'triangle', freq: n(60), dur: 0.3, vol: 0.12 },
  ],
  special: [
    { wave: 'square', freq: n(60), freqEnd: n(84), dur: 0.3, vol: 0.12, duty: 0.25 },
    { wave: 'square', freq: n(67), freqEnd: n(91), dur: 0.3, vol: 0.08, duty: 0.125, at: 0.05 },
    { wave: 'noise', freq: 4000, freqEnd: 800, dur: 0.4, vol: 0.12, lowpass: 0.35, at: 0.1 },
  ],
  levelUp: [
    { wave: 'square', freq: n(72), dur: 0.09, vol: 0.13, duty: 0.25 },
    { wave: 'square', freq: n(76), dur: 0.09, vol: 0.13, duty: 0.25, at: 0.09 },
    { wave: 'square', freq: n(79), dur: 0.09, vol: 0.13, duty: 0.25, at: 0.18 },
    { wave: 'square', freq: n(84), dur: 0.35, vol: 0.14, duty: 0.25, at: 0.27, vibrato: { rate: 7, depth: 0.012, delay: 0.1 } },
    { wave: 'triangle', freq: n(48), dur: 0.62, vol: 0.2 },
  ],
  // ----------------------------------------------------------- Karten und Buch
  cardGet: [
    { wave: 'square', freq: n(83), dur: 0.06, vol: 0.1, duty: 0.25 },
    { wave: 'square', freq: n(88), dur: 0.16, vol: 0.11, duty: 0.25, at: 0.06 },
  ],
  cardRare: [
    { wave: 'square', freq: n(79), dur: 0.07, vol: 0.1, duty: 0.25 },
    { wave: 'square', freq: n(83), dur: 0.07, vol: 0.1, duty: 0.25, at: 0.07 },
    { wave: 'square', freq: n(86), dur: 0.07, vol: 0.1, duty: 0.25, at: 0.14 },
    { wave: 'square', freq: n(91), dur: 0.3, vol: 0.12, duty: 0.125, at: 0.21, vibrato: { rate: 8, depth: 0.015 } },
  ],
  transform: [
    { wave: 'triangle', freq: n(84), freqEnd: n(60), dur: 0.35, vol: 0.2 },
    { wave: 'noise', freq: 6000, freqEnd: 2000, dur: 0.3, vol: 0.06, lowpass: 0.5 },
  ],
  unleash: [
    { wave: 'square', freq: n(60), freqEnd: n(72), dur: 0.15, vol: 0.1, duty: 0.25 },
    { wave: 'square', freq: n(72), freqEnd: n(84), dur: 0.2, vol: 0.1, duty: 0.25, at: 0.12 },
    { wave: 'noise', freq: 8000, freqEnd: 3000, dur: 0.3, vol: 0.08, lowpass: 0.6, at: 0.2 },
  ],
  bookOpen: [
    { wave: 'noise', freq: 1500, freqEnd: 3500, dur: 0.12, vol: 0.12, attack: 0.02, lowpass: 0.3 },
    { wave: 'square', freq: n(76), dur: 0.05, vol: 0.06, duty: 0.25, at: 0.1 },
    { wave: 'square', freq: n(81), dur: 0.08, vol: 0.06, duty: 0.25, at: 0.15 },
  ],
  bookClose: [{ wave: 'noise', freq: 3000, freqEnd: 800, dur: 0.1, vol: 0.14, lowpass: 0.3 }, { wave: 'triangle', freq: 140, freqEnd: 90, dur: 0.06, vol: 0.2, at: 0.07 }],
  page: [{ wave: 'noise', freq: 2500, freqEnd: 5000, dur: 0.08, vol: 0.09, attack: 0.01, lowpass: 0.35 }],
  place: [{ wave: 'square', freq: n(72), dur: 0.04, vol: 0.08, duty: 0.25 }, { wave: 'triangle', freq: 200, freqEnd: 120, dur: 0.05, vol: 0.12 }],
  // ----------------------------------------------------------- Menü und Welt
  move: [{ wave: 'square', freq: n(84), dur: 0.025, vol: 0.05, duty: 0.25 }],
  select: [
    { wave: 'square', freq: n(79), dur: 0.04, vol: 0.08, duty: 0.25 },
    { wave: 'square', freq: n(86), dur: 0.06, vol: 0.08, duty: 0.25, at: 0.04 },
  ],
  back: [{ wave: 'square', freq: n(79), freqEnd: n(72), dur: 0.07, vol: 0.07, duty: 0.25 }],
  error: [{ wave: 'square', freq: 180, dur: 0.08, vol: 0.1, duty: 0.5 }, { wave: 'square', freq: 140, dur: 0.12, vol: 0.1, duty: 0.5, at: 0.09 }],
  talk: [{ wave: 'square', freq: n(76), dur: 0.018, vol: 0.035, duty: 0.25 }],
  coin: [
    { wave: 'square', freq: n(88), dur: 0.04, vol: 0.08, duty: 0.5 },
    { wave: 'square', freq: n(95), dur: 0.12, vol: 0.08, duty: 0.5, at: 0.04 },
  ],
  buy: [
    { wave: 'square', freq: n(84), dur: 0.05, vol: 0.08, duty: 0.25 },
    { wave: 'square', freq: n(91), dur: 0.05, vol: 0.08, duty: 0.25, at: 0.05 },
    { wave: 'square', freq: n(96), dur: 0.12, vol: 0.08, duty: 0.25, at: 0.1 },
  ],
  chest: [
    { wave: 'triangle', freq: 160, freqEnd: 220, dur: 0.12, vol: 0.2 },
    { wave: 'square', freq: n(76), dur: 0.08, vol: 0.08, duty: 0.25, at: 0.12 },
    { wave: 'square', freq: n(80), dur: 0.08, vol: 0.08, duty: 0.25, at: 0.2 },
    { wave: 'square', freq: n(83), dur: 0.08, vol: 0.08, duty: 0.25, at: 0.28 },
    { wave: 'square', freq: n(88), dur: 0.25, vol: 0.09, duty: 0.25, at: 0.36 },
  ],
  heal: [
    { wave: 'sine', freq: n(72), freqEnd: n(84), dur: 0.25, vol: 0.18, attack: 0.02 },
    { wave: 'square', freq: n(88), dur: 0.2, vol: 0.05, duty: 0.125, at: 0.1, vibrato: { rate: 10, depth: 0.02 } },
  ],
  spell: [
    { wave: 'square', freq: n(72), freqEnd: n(96), dur: 0.22, vol: 0.09, duty: 0.125, vibrato: { rate: 18, depth: 0.03 } },
    { wave: 'noise', freq: 7000, freqEnd: 3000, dur: 0.3, vol: 0.06, lowpass: 0.6, at: 0.05 },
  ],
  teleport: [
    { wave: 'square', freq: n(60), freqEnd: n(96), dur: 0.35, vol: 0.09, duty: 0.25, vibrato: { rate: 22, depth: 0.04 } },
    { wave: 'triangle', freq: n(48), freqEnd: n(72), dur: 0.35, vol: 0.14 },
  ],
  death: [
    { wave: 'square', freq: n(67), dur: 0.2, vol: 0.12, duty: 0.5 },
    { wave: 'square', freq: n(63), dur: 0.2, vol: 0.12, duty: 0.5, at: 0.2 },
    { wave: 'square', freq: n(60), dur: 0.2, vol: 0.12, duty: 0.5, at: 0.4 },
    { wave: 'square', freq: n(55), freqEnd: n(43), dur: 0.6, vol: 0.12, duty: 0.5, at: 0.6 },
  ],
  well: [{ wave: 'sine', freq: n(84), freqEnd: n(79), dur: 0.15, vol: 0.12 }, { wave: 'sine', freq: n(91), freqEnd: n(84), dur: 0.2, vol: 0.08, at: 0.1 }],
  door: [{ wave: 'triangle', freq: 150, freqEnd: 110, dur: 0.1, vol: 0.18 }, { wave: 'noise', freq: 1200, dur: 0.06, vol: 0.06, lowpass: 0.2, at: 0.02 }],
  dig: [{ wave: 'noise', freq: 1200, freqEnd: 400, dur: 0.12, vol: 0.18, lowpass: 0.25 }, { wave: 'noise', freq: 1500, freqEnd: 400, dur: 0.12, vol: 0.16, lowpass: 0.25, at: 0.18 }],
  fanfare: [
    { wave: 'square', freq: n(67), dur: 0.12, vol: 0.12, duty: 0.25 },
    { wave: 'square', freq: n(67), dur: 0.12, vol: 0.12, duty: 0.25, at: 0.14 },
    { wave: 'square', freq: n(67), dur: 0.12, vol: 0.12, duty: 0.25, at: 0.28 },
    { wave: 'square', freq: n(72), dur: 0.5, vol: 0.13, duty: 0.25, at: 0.42, vibrato: { rate: 6, depth: 0.012, delay: 0.15 } },
    { wave: 'triangle', freq: n(48), dur: 0.9, vol: 0.2 },
  ],
  // ----------------------------------------------------------- Wetter (Schleifen ohne Hüllkurve)
  rainLoop: [
    { wave: 'noise', freq: 9000, dur: 2, vol: 0.07, attack: 0, decay: 0, sustain: 1, release: 0, lowpass: 0.35 },
    { wave: 'noise', freq: 3000, dur: 2, vol: 0.04, attack: 0, decay: 0, sustain: 1, release: 0, lowpass: 0.12 },
  ],
  windLoop: [{ wave: 'noise', freq: 900, dur: 2, vol: 0.12, attack: 0, decay: 0, sustain: 1, release: 0, lowpass: 0.05 }],
  thunder: [
    { wave: 'noise', freq: 700, freqEnd: 120, dur: 1.6, vol: 0.5, attack: 0.01, decay: 0.5, sustain: 0.35, release: 0.6, lowpass: 0.08 },
    { wave: 'noise', freq: 2400, freqEnd: 300, dur: 0.25, vol: 0.18, attack: 0.002, lowpass: 0.3 },
  ],
};
