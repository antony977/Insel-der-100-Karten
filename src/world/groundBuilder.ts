import { hash2 } from '../gfx/Raster';
import { TileComposer } from '../gfx/generators/terrainTiles';
import { TERRAINS } from './terrain';
import type { WorldMap } from './WorldMap';

/**
 * Berechnet für jede Dual-Grid-Kachel den Atlas-Index und füllt `map.ground`.
 * Gibt den Composer zurück (enthält die erzeugten Kacheln für die Textur).
 */
export function buildGround(map: WorldMap, seed = 1): TileComposer {
  const composer = new TileComposer(TERRAINS, seed);
  const W = map.w + 1;
  const ground = new Uint16Array(W * (map.h + 1));
  for (let j = 0; j <= map.h; j++) {
    for (let i = 0; i <= map.w; i++) {
      const tl = map.getTerrain(i - 1, j - 1);
      const tr = map.getTerrain(i, j - 1);
      const bl = map.getTerrain(i - 1, j);
      const br = map.getTerrain(i, j);
      const h = hash2(i, j, 99) % 100;
      // Variante 0 am häufigsten, damit die Fläche ruhig wirkt
      const variant = h < 55 ? 0 : h < 72 ? 1 : h < 88 ? 2 : 3;
      ground[j * W + i] = composer.index(tl, tr, bl, br, variant);
    }
  }
  map.ground = ground;
  return composer;
}
