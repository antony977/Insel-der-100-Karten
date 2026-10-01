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
  /** zusätzliche Kollisionsboxen (z. B. zwei Torpfeiler) */
  boxes?: [number, number, number, number][];
  /** Animation: Anzahl Frames und Bilder pro Sekunde */
  anim?: { frames: number; fps: number };
  /** Lichtquelle für die Nacht (Meilenstein 4) */
  light?: { radius: number; color: number; y: number };
  /** Text beim Interagieren (Schilder) */
  interact?: string;
}

import { BUILDINGS, buildingHeight } from './buildings';

/** Gebäude: Tür in der Mitte unten, Kollision über die Wandbreite */
function bld(texture: string): ObjectType {
  const w = BUILDINGS[texture].w;
  const h = buildingHeight(texture);
  return { texture, footX: w / 2, footY: h - 2, box: [-(w / 2 - 6), -18, w - 12, 18], interact: 'door' };
}

const LIGHT_WARM = { radius: 56, color: 0xffc93c, y: -20 };
const LIGHT_COLD = { radius: 40, color: 0x2fc4d6, y: -10 };

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
  chest: { texture: 'chest', footX: 8, footY: 14, box: [-6, -5, 12, 5], interact: 'chest' },
  barrel: { texture: 'barrel', footX: 6, footY: 15, box: [-5, -5, 10, 5] },
  crate: { texture: 'crate', footX: 7, footY: 13, box: [-6, -6, 12, 6] },
  house: { texture: 'house', footX: 32, footY: 60, box: [-27, -28, 54, 28], interact: 'house' },
  houseBlue: { texture: 'house-blue', footX: 32, footY: 60, box: [-27, -28, 54, 28], interact: 'house' },
  houseRed: { texture: 'house', footX: 32, footY: 60, box: [-27, -18, 54, 18], interact: 'door' },
  houseRedB: { texture: 'house-blue', footX: 32, footY: 60, box: [-27, -18, 54, 18], interact: 'door' },
  houseGreen: bld('house-green'),
  houseViolet: bld('house-violet'),
  houseOrange: bld('house-orange'),
  houseTeal: bld('house-teal'),
  housePink: bld('house-pink'),
  houseSnow: bld('house-snow'),
  houseSand: bld('house-sand'),
  houseNavy: bld('house-navy'),
  inn: bld('inn'),
  shopCoin: bld('shop-coin'),
  shopPotion: bld('shop-potion'),
  shopBook: bld('shop-book'),
  shopBoot: bld('shop-boot'),
  shopCup: bld('shop-cup'),
  shopAnchor: bld('shop-anchor'),
  shopBread: bld('shop-bread'),
  shopSword: bld('shop-sword'),
  shopRose: bld('shop-rose'),
  shopCard: bld('shop-card'),
  shopScroll: bld('shop-scroll'),
  shopShell: bld('shop-shell'),
  shopDice: bld('shop-dice'),
  shopSand: bld('shop-sand'),
  shopStar: bld('shop-star'),
  tower: { texture: 'tower', footX: 24, footY: 110, box: [-16, -14, 32, 14], interact: 'door' },
  lighthouse: { texture: 'lighthouse', footX: 16, footY: 98, box: [-12, -10, 24, 10], interact: 'door', light: { radius: 90, color: 0xffc93c, y: -84 } },
  windmill: { texture: 'windmill', footX: 28, footY: 82, box: [-14, -12, 28, 12], anim: { frames: 4, fps: 3 }, interact: 'door' },
  firstGate: { texture: 'first-gate', footX: 44, footY: 74, boxes: [[-36, -8, 14, 8], [22, -8, 14, 8]], interact: 'gate', light: { radius: 60, color: 0xa6f4f0, y: -30 } },
  casino: { texture: 'casino', footX: 52, footY: 74, box: [-46, -24, 92, 24], anim: { frames: 2, fps: 2 }, interact: 'door', light: { radius: 70, color: 0xe04ac8, y: -40 } },
  arena: { texture: 'arena', footX: 64, footY: 70, boxes: [[-62, -30, 44, 30], [18, -30, 44, 30]], interact: 'door' },
  hallLibrary: { texture: 'hall-library', footX: 48, footY: 74, box: [-42, -24, 84, 24], interact: 'door' },
  hallMirror: { texture: 'hall-mirror', footX: 48, footY: 74, box: [-42, -24, 84, 24], interact: 'door' },
  hallGuild: { texture: 'hall-guild', footX: 48, footY: 74, box: [-42, -24, 84, 24], interact: 'door' },
  tent: { texture: 'tent', footX: 20, footY: 30, box: [-16, -8, 32, 8], interact: 'door' },
  tentBlue: { texture: 'tent-blue', footX: 20, footY: 30, box: [-16, -8, 32, 8], interact: 'door' },
  stall: { texture: 'stall', footX: 20, footY: 33, box: [-17, -8, 34, 8], interact: 'door' },
  stallRed: { texture: 'stall-red', footX: 20, footY: 33, box: [-17, -8, 34, 8], interact: 'door' },
  treeMoss: { texture: 'tree-moss', footX: 16, footY: 41, box: [-5, -6, 10, 6] },
  treeAutumn: { texture: 'tree-autumn', footX: 16, footY: 41, box: [-5, -6, 10, 6] },
  treeBlossom: { texture: 'tree-blossom', footX: 16, footY: 41, box: [-5, -6, 10, 6] },
  treeDead: { texture: 'tree-dead', footX: 14, footY: 38, box: [-4, -5, 8, 5] },
  pineSnow: { texture: 'pine-snow', footX: 12, footY: 41, box: [-4, -6, 8, 6] },
  palm: { texture: 'palm', footX: 17, footY: 44, box: [-3, -4, 6, 4] },
  cactusPlant: { texture: 'cactus-plant', footX: 8, footY: 24, box: [-4, -4, 8, 4] },
  rosebush: { texture: 'rosebush', footX: 10, footY: 16, box: [-7, -6, 14, 6] },
  hedge: { texture: 'hedge', footX: 8, footY: 20, box: [-8, -8, 16, 8] },
  glowshroom: { texture: 'glowshroom', footX: 10, footY: 22, box: [-3, -3, 6, 3], light: LIGHT_COLD },
  crystal: { texture: 'crystal', footX: 8, footY: 20, box: [-6, -5, 12, 5], light: LIGHT_COLD, interact: 'crystal' },
  crystalViolet: { texture: 'crystal-violet', footX: 8, footY: 20, box: [-6, -5, 12, 5], light: { radius: 40, color: 0x9b4ae8, y: -10 } },
  ruinPillar: { texture: 'ruin-pillar', footX: 8, footY: 34, box: [-7, -6, 14, 6] },
  ruinBroken: { texture: 'ruin-broken', footX: 8, footY: 34, box: [-7, -6, 14, 6] },
  statue: { texture: 'statue', footX: 10, footY: 36, box: [-8, -7, 16, 7], interact: 'statue' },
  fog: { texture: 'fog', footX: 16, footY: 38, box: [-16, -14, 32, 14], anim: { frames: 3, fps: 3 }, interact: 'gate' },
  vines: { texture: 'vines', footX: 8, footY: 38, box: [-8, -10, 16, 10], interact: 'gate' },
  cave: { texture: 'cave', footX: 20, footY: 30, boxes: [[-20, -10, 9, 10], [11, -10, 9, 10]], interact: 'warp' },
  stairs: { texture: 'stairs', footX: 16, footY: 22, interact: 'warp' },
  board: { texture: 'board', footX: 15, footY: 28, box: [-12, -4, 24, 4], interact: 'board' },
  boat: { texture: 'boat', footX: 24, footY: 22, box: [-22, -6, 44, 6], interact: 'warp' },
  bench: { texture: 'bench', footX: 12, footY: 13, box: [-11, -5, 22, 5] },
  fountain: { texture: 'fountain', footX: 20, footY: 33, box: [-17, -9, 34, 9], anim: { frames: 3, fps: 6 }, interact: 'well' },
  flowerpot: { texture: 'flowerpot', footX: 6, footY: 13, box: [-5, -4, 10, 4] },
  dandelion: { texture: 'dandelion', footX: 5, footY: 13, interact: 'pickup' },
  spot: { texture: 'spot', footX: 6, footY: 6, anim: { frames: 2, fps: 2 }, interact: 'spot' },
  lampWarm: { texture: 'lamp', footX: 6, footY: 30, box: [-3, -3, 6, 3], light: LIGHT_WARM },
  // Meilenstein 6
  windmillBroken: { texture: 'windmill', footX: 28, footY: 82, box: [-14, -12, 28, 12], interact: 'door' },
  lampPost: { texture: 'lamp', footX: 6, footY: 30, box: [-3, -3, 6, 3], interact: 'switch' },
  fogGate: { texture: 'fog', footX: 16, footY: 38, box: [-16, -14, 32, 14], anim: { frames: 3, fps: 3 }, interact: 'warp' },
  vineGate: { texture: 'vines', footX: 8, footY: 38, box: [-8, -10, 16, 10], interact: 'warp' },
  sphinx: { texture: 'sphinx', footX: 28, footY: 42, box: [-26, -10, 52, 10], interact: 'talk' },
  checkpoint: { texture: 'checkpoint', footX: 4, footY: 25, anim: { frames: 2, fps: 4 }, interact: 'switch' },
  chestBig: { texture: 'chest', footX: 8, footY: 14, box: [-6, -5, 12, 5], interact: 'chest' },
} satisfies Record<string, ObjectType>;

export type ObjectTypeId = keyof typeof OBJECT_TYPES;
