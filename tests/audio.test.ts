import { describe, expect, it } from 'vitest';
import { renderSong } from '../src/audio/composer';
import { SONGS } from '../src/audio/songs';
import { SFX } from '../src/audio/sfxDefs';
import { lengthOf, RATE, renderTone } from '../src/audio/synth';
import { REGIONS } from '../src/data/world/layout';

describe('Audio', () => {
  it('alle Soundeffekte lassen sich berechnen, ohne zu übersteuern', () => {
    for (const [name, tones] of Object.entries(SFX)) {
      const out = new Float32Array(Math.ceil(lengthOf(tones) * RATE));
      for (const t of tones) renderTone(out, t);
      let peak = 0;
      let finite = true;
      for (const v of out) {
        if (!Number.isFinite(v)) finite = false;
        else if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      expect(finite, name).toBe(true);
      expect(peak, name).toBeGreaterThan(0.01);
      expect(peak, name).toBeLessThan(1);
    }
  });

  it('Musik ist deterministisch und schleifenfähig', () => {
    const spec = SONGS.taufeld;
    const a = renderSong(spec);
    const b = renderSong(spec);
    expect(a.length).toBe(b.length);
    expect(a[12345]).toBe(b[12345]);
    // Länge = Takte × Taktlänge
    const bars = spec.prog.length * (spec.repeats ?? 2);
    expect(a.length).toBe(Math.ceil(bars * 16 * (60 / spec.bpm / 4) * RATE));
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(1);
    expect(peak).toBeGreaterThan(0.1);
  });

  it('jede Region hat ein vorhandenes Musikstück', () => {
    for (const r of Object.values(REGIONS)) expect(SONGS[r.music], r.id).toBeDefined();
    for (const id of ['title', 'lagerfeuer', 'boss', 'kampf', 'ende', 'hoehle', 'labyrinth']) expect(SONGS[id], id).toBeDefined();
  });
});
