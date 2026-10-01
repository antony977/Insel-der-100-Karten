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
  style: 'grass' | 'dots' | 'cobble' | 'pebbles' | 'flat' | 'rows' | 'ripple' | 'cracks' | 'rock';
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
  /** Farbe auf Mini- und Weltkarte */
  mini: number;
}

export const T = {
  WATER: 0,
  SAND: 1,
  DIRT: 2,
  GRASS: 3,
  FOREST: 4,
  STONE: 5,
  SNOW: 6,
  MOSS: 7,
  ROCK: 8,
  DUNE: 9,
  FIELD: 10,
  DARKSTONE: 11,
  ROSE: 12,
  PAPER: 13,
  INKWALL: 14,
  CAVE: 15,
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
    mini: PAL.blue,
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
    mini: PAL.sand,
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
    mini: PAL.tan,
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
    mini: PAL.grass,
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
    mini: PAL.leaf,
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
    mini: PAL.silver,
  },
  {
    id: T.SNOW,
    key: 'snow',
    name: 'Schnee',
    priority: 9,
    solid: false,
    pattern: { base: PAL.white, dark: PAL.silver, light: PAL.white, style: 'dots', density: 5 },
    edge: PAL.silver,
    roughness: 0.22,
    castsShadow: true,
    mini: PAL.white,
  },
  {
    id: T.MOSS,
    key: 'moss',
    name: 'Moosboden',
    priority: 7,
    solid: false,
    pattern: { base: PAL.teal, dark: PAL.deepTeal, light: PAL.leaf, style: 'grass', density: 7 },
    edge: PAL.deepTeal,
    roughness: 0.26,
    castsShadow: true,
    mini: PAL.teal,
  },
  {
    id: T.ROCK,
    key: 'rock',
    name: 'Fels',
    priority: 14,
    solid: true,
    pattern: { base: PAL.stone, dark: PAL.shadow, light: PAL.mist, style: 'rock', density: 6 },
    edge: PAL.night,
    roughness: 0.2,
    castsShadow: true,
    mini: PAL.shadow,
  },
  {
    id: T.DUNE,
    key: 'dune',
    name: 'Düne',
    priority: 2,
    solid: false,
    pattern: { base: PAL.sand, dark: PAL.sandShade, light: PAL.sandLight, style: 'ripple', density: 4 },
    edge: PAL.sandShade,
    roughness: 0.18,
    castsShadow: false,
    mini: PAL.sandShade,
  },
  {
    id: T.FIELD,
    key: 'field',
    name: 'Feld',
    priority: 4,
    solid: false,
    pattern: { base: PAL.gold, dark: PAL.orange, light: PAL.cream, style: 'rows', density: 0 },
    edge: PAL.rust,
    roughness: 0.06,
    castsShadow: false,
    mini: PAL.gold,
  },
  {
    id: T.DARKSTONE,
    key: 'darkstone',
    name: 'Runenpflaster',
    priority: 11,
    solid: false,
    pattern: { base: PAL.stone, dark: PAL.shadow, light: PAL.mist, style: 'cobble', density: 0 },
    edge: PAL.shadow,
    roughness: 0.04,
    castsShadow: true,
    mini: PAL.stone,
  },
  {
    id: T.ROSE,
    key: 'rose',
    name: 'Rosenwiese',
    priority: 6,
    solid: false,
    pattern: { base: PAL.grass, dark: PAL.leaf, light: PAL.pink, style: 'grass', density: 6 },
    edge: PAL.leaf,
    roughness: 0.24,
    castsShadow: true,
    mini: PAL.pink,
  },
  {
    id: T.PAPER,
    key: 'paper',
    name: 'Papierboden',
    priority: 12,
    solid: false,
    pattern: { base: PAL.sandLight, dark: PAL.sand, light: PAL.white, style: 'cracks', density: 3 },
    edge: PAL.sandShade,
    roughness: 0.02,
    castsShadow: true,
    mini: PAL.sandLight,
  },
  {
    id: T.INKWALL,
    key: 'inkwall',
    name: 'Tintenwand',
    priority: 15,
    solid: true,
    pattern: { base: PAL.plum, dark: PAL.ink, light: PAL.purple, style: 'rock', density: 4 },
    edge: PAL.ink,
    roughness: 0.1,
    castsShadow: true,
    mini: PAL.plum,
  },
  {
    id: T.CAVE,
    key: 'cave',
    name: 'Höhlenboden',
    priority: 13,
    solid: false,
    pattern: { base: PAL.shadow, dark: PAL.night, light: PAL.stone, style: 'pebbles', density: 5 },
    edge: PAL.night,
    roughness: 0.12,
    castsShadow: true,
    mini: PAL.night,
  },
];

export const TERRAIN_BY_ID: TerrainDef[] = [];
for (const t of TERRAINS) TERRAIN_BY_ID[t.id] = t;
