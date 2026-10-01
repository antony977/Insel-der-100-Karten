import { PAL } from '../gfx/palette';

/**
 * Terrain-Definitionen (datengetrieben). Neue Bodenarten (z. B. für Regionen mit eigenem
 * Farbschema) werden hier ergänzt; der TileComposer erzeugt daraus automatisch alle
 * Übergangskacheln.
 */
export interface TerrainPattern {
  base: number;
  /** dunkle Details (Grasbüschel, Kiesel …) */
  dark: number;
  /** helle Details */
  light: number;
  style: 'grass' | 'dots' | 'cobble' | 'pebbles' | 'flat';
  density: number;
}

export interface TerrainDef {
  id: number;
  key: string;
  name: string;
  /** höhere Priorität wird über niedrigere gezeichnet */
  priority: number;
  solid: boolean;
  /** transparent (Wasser – darunter liegt die animierte Wasserebene) */
  clear?: boolean;
  pattern: TerrainPattern;
  /** Farbe der Kante zur tieferen Bodenart */
  edge: number;
  /** Stärke der Kanten-Unregelmässigkeit */
  roughness: number;
  /** wirft einen 1-px-Schatten nach unten auf tiefere Bodenarten */
  castsShadow: boolean;
}

export const T = {
  WATER: 0,
  SAND: 1,
  DIRT: 2,
  GRASS: 3,
  FOREST: 4,
  STONE: 5,
} as const;

export const TERRAINS: TerrainDef[] = [
  {
    id: T.WATER,
    key: 'water',
    name: 'Wasser',
    priority: 0,
    solid: true,
    clear: true,
    pattern: { base: PAL.blue, dark: PAL.navy, light: PAL.sky, style: 'flat', density: 0 },
    edge: PAL.white,
    roughness: 0,
    castsShadow: false,
  },
  {
    id: T.SAND,
    key: 'sand',
    name: 'Sand',
    priority: 1,
    solid: false,
    pattern: { base: PAL.sand, dark: PAL.sandShade, light: PAL.sandLight, style: 'dots', density: 7 },
    edge: PAL.sandShade,
    roughness: 0.16,
    castsShadow: false,
  },
  {
    id: T.DIRT,
    key: 'dirt',
    name: 'Erdweg',
    priority: 2,
    solid: false,
    pattern: { base: PAL.sandShade, dark: PAL.tan, light: PAL.sand, style: 'pebbles', density: 5 },
    edge: PAL.tan,
    roughness: 0.1,
    castsShadow: false,
  },
  {
    id: T.GRASS,
    key: 'grass',
    name: 'Wiese',
    priority: 3,
    solid: false,
    pattern: { base: PAL.grass, dark: PAL.leaf, light: PAL.lime, style: 'grass', density: 6 },
    edge: PAL.leaf,
    roughness: 0.24,
    castsShadow: true,
  },
  {
    id: T.FOREST,
    key: 'forest',
    name: 'Waldboden',
    priority: 4,
    solid: false,
    pattern: { base: PAL.leaf, dark: PAL.pine, light: PAL.grass, style: 'grass', density: 7 },
    edge: PAL.pine,
    roughness: 0.26,
    castsShadow: true,
  },
  {
    id: T.STONE,
    key: 'stone',
    name: 'Pflaster',
    priority: 5,
    solid: false,
    pattern: { base: PAL.mist, dark: PAL.stone, light: PAL.silver, style: 'cobble', density: 0 },
    edge: PAL.stone,
    roughness: 0.04,
    castsShadow: true,
  },
];

export const TERRAIN_BY_ID: TerrainDef[] = [];
for (const t of TERRAINS) TERRAIN_BY_ID[t.id] = t;
