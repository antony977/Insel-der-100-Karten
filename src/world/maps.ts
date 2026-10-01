import { buildIsland, type IslandMeta } from './islandBuilder';
import { buildTestMap } from '../data/maps/testMap';
import { buildGround } from './groundBuilder';
import type { WorldMap } from './WorldMap';
import type { TileComposer } from '../gfx/generators/terrainTiles';

export interface LoadedMap {
  id: string;
  map: WorldMap;
  composer: TileComposer;
  meta?: IslandMeta;
  /** Musikstück */
  music: string;
  /** dunkel (Höhle) */
  dark?: boolean;
}

type Builder = () => Omit<LoadedMap, 'composer' | 'id'>;

const BUILDERS: Record<string, Builder> = {
  insel: () => {
    const { map, meta } = buildIsland();
    return { map, meta, music: 'taufeld' };
  },
  testwiese: () => ({ map: buildTestMap(), music: 'taufeld' }),
};

const CACHE = new Map<string, LoadedMap>();

/** Weitere Karten (Höhlen, Labyrinth …) registrieren */
export function registerMap(id: string, b: Builder): void {
  BUILDERS[id] = b;
}

export function hasMap(id: string): boolean {
  return !!BUILDERS[id];
}

/** Karte laden (einmal erzeugt, danach aus dem Zwischenspeicher). */
export function loadMap(id: string): LoadedMap {
  const c = CACHE.get(id);
  if (c) {
    // Zustand zurücksetzen: entfernte Objekte wiederherstellen, Figuren-Boxen löschen
    c.map.objects.forEach((o, i) => {
      if (o.hidden) c.map.restoreObject(i);
      o.frame = undefined;
    });
    c.map.clearDynamicBoxes();
    return c;
  }
  const b = BUILDERS[id] ?? BUILDERS.insel;
  const built = b();
  const composer = buildGround(built.map);
  const lm: LoadedMap = { id: BUILDERS[id] ? id : 'insel', composer, ...built };
  CACHE.set(lm.id, lm);
  return lm;
}
