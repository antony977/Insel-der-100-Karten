/**
 * Weltobjekt-Typen (datengetrieben). Neue Objekte: Grafik in AssetManifest ergänzen und
 * hier Fusspunkt, Kollisionsbox und optional Animation/Licht eintragen.
 */
export interface ObjectType {
  texture: string;
  /** Fusspunkt in Pixeln innerhalb der Grafik */
  footX: number;
  footY: number;
  /** Kollisionsbox relativ zum Fusspunkt: [x, y, Breite, Höhe] */
  box?: [number, number, number, number];
  /** Animation: Anzahl Frames und Bilder pro Sekunde */
  anim?: { frames: number; fps: number };
  /** Lichtquelle für die Nacht (Meilenstein 4) */
  light?: { radius: number; color: number; y: number };
  /** Text beim Interagieren (Schilder) */
  interact?: string;
}

export const OBJECT_TYPES = {
  tree: { texture: 'tree', footX: 16, footY: 41, box: [-5, -6, 10, 6] },
  treeFruit: { texture: 'tree-fruit', footX: 16, footY: 41, box: [-5, -6, 10, 6] },
  treeLight: { texture: 'tree-light', footX: 16, footY: 41, box: [-5, -6, 10, 6] },
  pine: { texture: 'pine', footX: 12, footY: 41, box: [-4, -6, 8, 6] },
  bush: { texture: 'bush', footX: 10, footY: 14, box: [-7, -7, 14, 7] },
  bushBerry: { texture: 'bush-berry', footX: 10, footY: 14, box: [-7, -7, 14, 7] },
  rock: { texture: 'rock', footX: 8, footY: 12, box: [-6, -6, 12, 6] },
  boulder: { texture: 'boulder', footX: 13, footY: 18, box: [-11, -10, 22, 10] },
  stump: { texture: 'stump', footX: 8, footY: 10, box: [-5, -5, 10, 5] },
  sign: { texture: 'sign', footX: 8, footY: 16, box: [-6, -4, 12, 4], interact: 'sign' },
  fence: { texture: 'fence', footX: 8, footY: 15, box: [-8, -5, 16, 5] },
  lamp: { texture: 'lamp', footX: 6, footY: 30, box: [-3, -3, 6, 3], light: { radius: 48, color: 0xffc93c, y: -24 } },
  well: { texture: 'well', footX: 14, footY: 28, box: [-11, -10, 22, 10], interact: 'well' },
  campfire: {
    texture: 'campfire',
    footX: 8,
    footY: 15,
    box: [-6, -5, 12, 5],
    anim: { frames: 4, fps: 8 },
    light: { radius: 64, color: 0xf08a24, y: -6 },
    interact: 'campfire',
  },
  barrel: { texture: 'barrel', footX: 6, footY: 15, box: [-5, -5, 10, 5] },
  crate: { texture: 'crate', footX: 7, footY: 13, box: [-6, -6, 12, 6] },
  house: { texture: 'house', footX: 32, footY: 60, box: [-27, -28, 54, 28], interact: 'house' },
  houseBlue: { texture: 'house-blue', footX: 32, footY: 60, box: [-27, -28, 54, 28], interact: 'house' },
} satisfies Record<string, ObjectType>;

export type ObjectTypeId = keyof typeof OBJECT_TYPES;
