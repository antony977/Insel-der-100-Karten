import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/systems/Display';
import { GLYPHS } from '../src/gfx/font/glyphs';
import { measureText, validateGlyphs, wrapText } from '../src/gfx/font/PixelFont';
import { ACTIONS, DEFAULT_BINDINGS, keyLabel } from '../src/input/Actions';
import { PALETTE_LIST } from '../src/gfx/palette';
import { TileComposer } from '../src/gfx/generators/terrainTiles';
import { TERRAINS, T } from '../src/world/terrain';
import { buildTestMap } from '../src/data/maps/testMap';
import { generateCharacterSheet, PLAYER_LOOK, CHAR_FRAME_W, CHAR_COLS, CHAR_ROWS, CHAR_FRAME_H } from '../src/gfx/generators/characters';

describe('Anzeige / Integer-Scaling', () => {
  it('skaliert 1920×1080 bei DPR 1 exakt 4-fach', () => {
    const l = computeLayout({ width: 1920, height: 1080, dpr: 1, mode: 'integer', quality: 'smooth' });
    expect(l.k).toBe(4);
    expect(l.r).toBe(4);
    expect(l.cssWidth).toBe(1920);
  });

  it('nutzt Gerätepixel (iPhone im Querformat, DPR 3)', () => {
    const l = computeLayout({ width: 750, height: 369, dpr: 3, mode: 'integer', quality: 'smooth' });
    expect(l.k).toBe(4);
    expect(l.cssWidth).toBeCloseTo(640);
    expect(l.cssHeight).toBeCloseTo(360);
    // Render-Faktor muss k teilen, damit die CSS-Skalierung ganzzahlig bleibt
    expect(l.k % l.r).toBe(0);
  });

  it('Retro-Modus rendert immer in 480×270', () => {
    const l = computeLayout({ width: 2560, height: 1440, dpr: 1, mode: 'integer', quality: 'retro' });
    expect(l.r).toBe(1);
    expect(l.k).toBe(5);
  });

  it('bleibt bei sehr kleinen Fenstern sichtbar', () => {
    const l = computeLayout({ width: 300, height: 200, dpr: 1, mode: 'integer', quality: 'smooth' });
    expect(l.k).toBeGreaterThan(0);
    expect(l.cssWidth).toBeLessThanOrEqual(300);
  });

  it('Füllen-Modus nutzt die volle Höhe', () => {
    const l = computeLayout({ width: 1000, height: 400, dpr: 1, mode: 'fit', quality: 'smooth' });
    expect(l.cssHeight).toBeCloseTo(400);
  });
});

describe('Pixel-Schrift', () => {
  it('hat gültige Glyphen', () => {
    expect(validateGlyphs()).toEqual([]);
  });

  it('enthält alle deutschen Zeichen', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜabcdefghijklmnopqrstuvwxyzäöüß0123456789.,:;!?-+/()«»„“%') {
      expect(GLYPHS[ch], ch).toBeDefined();
    }
  });

  it('misst und bricht Text um', () => {
    expect(measureText('A')).toBe(5);
    const lines = wrapText('Willkommen auf der Insel der hundert Karten', 80);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measureText(l)).toBeLessThanOrEqual(80);
  });
});

describe('Eingabe', () => {
  it('jede Aktion hat eine Standardtaste und keine Taste ist doppelt belegt', () => {
    const seen = new Set<string>();
    for (const a of ACTIONS) {
      expect(DEFAULT_BINDINGS[a].length).toBeGreaterThan(0);
      for (const k of DEFAULT_BINDINGS[a]) {
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
      }
    }
  });

  it('beschriftet Tasten für deutsche Tastaturen', () => {
    expect(keyLabel('Space')).toBe('Leertaste');
    expect(keyLabel('KeyY')).toBe('Z');
    expect(keyLabel('ArrowUp')).toBe('↑');
  });
});

describe('Grafik', () => {
  it('Palette bleibt im Rahmen von 32–48 Farben', () => {
    expect(PALETTE_LIST.length).toBeGreaterThanOrEqual(32);
    expect(PALETTE_LIST.length).toBeLessThanOrEqual(48);
  });

  it('Figuren-Sheet hat das dokumentierte Layout und nur Palettenfarben', () => {
    const sheet = generateCharacterSheet(PLAYER_LOOK);
    expect(sheet.w).toBe(CHAR_FRAME_W * CHAR_COLS);
    expect(sheet.h).toBe(CHAR_FRAME_H * CHAR_ROWS);
    const allowed = new Set(PALETTE_LIST.map((c) => ((c >> 16) & 255) | (c & 0xff00) | ((c & 255) << 16)));
    for (const v of sheet.data) {
      if (v >>> 24 === 0) continue;
      expect(allowed.has(v & 0xffffff)).toBe(true);
    }
  });

  it('Terrain-Kacheln werden zwischengespeichert', () => {
    const c = new TileComposer(TERRAINS, 1);
    const a = c.index(T.GRASS, T.GRASS, T.DIRT, T.DIRT);
    const b = c.index(T.GRASS, T.GRASS, T.DIRT, T.DIRT);
    expect(a).toBe(b);
    expect(c.index(T.GRASS, T.WATER, T.DIRT, T.DIRT)).not.toBe(a);
  });
});

describe('Testkarte', () => {
  const map = buildTestMap();

  it('ist deterministisch', () => {
    const again = buildTestMap();
    expect(Array.from(again.terrain)).toEqual(Array.from(map.terrain));
    expect(again.objects.length).toBe(map.objects.length);
  });

  it('Startpunkt ist frei begehbar', () => {
    expect(map.boxBlocked(map.spawnX - 5, map.spawnY - 6, 10, 6)).toBe(false);
  });

  it('Rand ist gesperrt, Brücke ist begehbar', () => {
    expect(map.isSolidCell(0, 10)).toBe(true);
    let bridge = false;
    for (let i = 0; i < map.w * map.h; i++) {
      if (map.terrain[i] === T.WATER && map.solid[i] === 0) bridge = true;
    }
    expect(bridge).toBe(true);
  });
});
