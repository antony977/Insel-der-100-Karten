import type { ObjectTypeId } from '../worldObjects';

/**
 * Grundriss der Insel (datengetrieben). Ein Zeichen = 8×8 Kacheln.
 *   ~ Meer   L Silbersee   T Taufeld   W Windhalmfelder   G Runenhall-Land   H Möwenhafen-Küste
 *   K Möwenklippen   C Würfelheim-Land   M Hohenkamm   D Sandspiegel   F Nebelhain   R Rosenweil
 *   A Ruinen von Alt-Kartheim
 */
export const ISLAND_ASCII = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~MMMMMMMM~~~~~~~~~~~~~~~~KKKK~~~~',
  '~~~~~~MMMMMMMMMMMM~~~GGGGGG~~~~KKKKKK~~~',
  '~~~~~MMMMMMMMMMMMMMGGGGGGGGGG~~KKKKKKK~~',
  '~~~~MMMMMMMMMMMMMMGGGGGGGGGGGG~~KKKKKK~~',
  '~~~FFMMMMMMMMMMMMGGGGGGGGGGGGGG~~KKKK~~~',
  '~~FFFFFMMMMMMMMGGGGGGGGGGGGGGGGHH~~~~~~~',
  '~~FFFFFFFMMMMMGGGGGGGGGGGGGGGGHHHHH~~~~~',
  '~FFFFFFFFFFFGGGGGGGGGGGGGGGGGHHHHHHH~~~~',
  '~FFFFFFFFFFFGGGGGGLLLLGGGGGWWHHHHHHH~~~~',
  '~FFFFFFFFFFAAAAGGLLLLLLGGWWWWWWHHHHH~~~~',
  '~FFFFFFFFFAAAAAAGLLLLLLWWWWWWWWWHHHH~~~~',
  '~~FFFFFFFFAAAAAATLLLLLTWWWWWWWWWWHH~~~~~',
  '~~RRRFFFFFAAAAAATTTTTTTTWWWWWWWWWWC~~~~~',
  '~RRRRRRFFFFAAAATTTTTTTTTTWWWWWWWCCCC~~~~',
  '~RRRRRRRRTTTTTTTTTTTTTTTTTWWWWWCCCCCC~~~',
  '~RRRRRRRRTTTTTTTTTTTTTTTTTTWWWCCCCCCCC~~',
  '~RRRRRRRRRTTTTTTTTTTTTTTTTTTWCCCCCCCCC~~',
  '~~RRRRRRRRTTTTTTTTTTTTTTTTTTTCCCCCCCCC~~',
  '~~RRRRRRRDDTTTTTTTTTTTTTTTTTTCCCCCCCC~~~',
  '~~~RRRRDDDDDTTTTTTTTTTTTTTTTTCCCCCCC~~~~',
  '~~~~DDDDDDDDDDTTTTTTTTTTTTTTTCCCCC~~~~~~',
  '~~~DDDDDDDDDDDDTTTTTTTTTTTTTT~~~~~~~~~~~',
  '~~~DDDDDDDDDDDDDDTTTTTTTTTTT~~~~~~~~~~~~',
  '~~~~DDDDDDDDDDDDDDTTTTTTTT~~~~~~~~~~~~~~',
  '~~~~~DDDDDDDDDDDDDD~~TTTT~~~~~~~~~~~~~~~',
  '~~~~~~DDDDDDDDDDDD~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~DDDDDDDD~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

export const CELL = 8;
export const ISLAND_W = ISLAND_ASCII[0].length * CELL;
export const ISLAND_H = ISLAND_ASCII.length * CELL;

export type RegionId =
  | 'meer'
  | 'silbersee'
  | 'taufeld'
  | 'windhalm'
  | 'runenhall'
  | 'moewenhafen'
  | 'klippen'
  | 'wuerfelheim'
  | 'hohenkamm'
  | 'sandspiegel'
  | 'nebelhain'
  | 'rosenweil'
  | 'ruinen';

export const REGION_CHAR: Record<string, RegionId> = {
  '~': 'meer',
  L: 'silbersee',
  T: 'taufeld',
  W: 'windhalm',
  G: 'runenhall',
  H: 'moewenhafen',
  K: 'klippen',
  C: 'wuerfelheim',
  M: 'hohenkamm',
  D: 'sandspiegel',
  F: 'nebelhain',
  R: 'rosenweil',
  A: 'ruinen',
};

export const REGION_IDS: RegionId[] = ['meer', 'silbersee', 'taufeld', 'windhalm', 'runenhall', 'moewenhafen', 'klippen', 'wuerfelheim', 'hohenkamm', 'sandspiegel', 'nebelhain', 'rosenweil', 'ruinen'];

export interface RegionDef {
  id: RegionId;
  name: string;
  /** Monster mit Gewicht */
  monsters: [string, number][];
  /** Anzahl Monster-Gebiete */
  zones: number;
  /** Musikstück */
  music: string;
  /** Bäume/Büsche mit Dichte (Versuche pro 100 Kacheln) */
  flora: [ObjectTypeId, number][];
}

export const REGIONS: Record<RegionId, RegionDef> = {
  meer: { id: 'meer', name: 'Meer', monsters: [], zones: 0, music: 'taufeld', flora: [] },
  silbersee: { id: 'silbersee', name: 'Silbersee', monsters: [], zones: 0, music: 'taufeld', flora: [] },
  taufeld: {
    id: 'taufeld',
    name: 'Taufeld',
    monsters: [['wollknaeuel', 4], ['huepfpilz', 4], ['blattschnapper', 2], ['wiesenflitzer', 1]],
    zones: 22,
    music: 'taufeld',
    flora: [['tree', 1.2], ['treeLight', 0.4], ['treeFruit', 0.2], ['bush', 0.9], ['bushBerry', 0.3], ['rock', 0.3], ['boulder', 0.1]],
  },
  windhalm: {
    id: 'windhalm',
    name: 'Windhalmfelder',
    monsters: [['stachelschwalbe', 3], ['kieselkrebs', 2], ['schlammkroete', 2], ['huepfpilz', 1]],
    zones: 14,
    music: 'windhalm',
    flora: [['treeAutumn', 0.5], ['tree', 0.3], ['bush', 0.5], ['rock', 0.2]],
  },
  runenhall: {
    id: 'runenhall',
    name: 'Runenhall',
    monsters: [['papierflatterer', 3], ['glyphenwaechter', 2], ['tintenkobold', 1], ['blattschnapper', 1]],
    zones: 18,
    music: 'runenhall',
    flora: [['pine', 1.2], ['tree', 0.6], ['treeMoss', 0.2], ['bush', 0.5], ['rock', 0.4]],
  },
  moewenhafen: {
    id: 'moewenhafen',
    name: 'Möwenhafen',
    monsters: [['zangenkrabbe', 3], ['quallenlicht', 2], ['kieselkrebs', 1]],
    zones: 12,
    music: 'moewenhafen',
    flora: [['palm', 0.6], ['tree', 0.4], ['bush', 0.6], ['rock', 0.3]],
  },
  klippen: {
    id: 'klippen',
    name: 'Möwenklippen',
    monsters: [['klippenmoewe', 4], ['zangenkrabbe', 1]],
    zones: 6,
    music: 'moewenhafen',
    flora: [['pine', 0.6], ['rock', 0.8], ['boulder', 0.3], ['bush', 0.3]],
  },
  wuerfelheim: {
    id: 'wuerfelheim',
    name: 'Würfelheim',
    monsters: [['wuerfelmimik', 2], ['jetonratte', 3], ['glueckskatze', 1]],
    zones: 12,
    music: 'wuerfelheim',
    flora: [['treeAutumn', 0.6], ['tree', 0.5], ['bush', 0.6], ['rock', 0.2]],
  },
  hohenkamm: {
    id: 'hohenkamm',
    name: 'Hohenkamm',
    monsters: [['felsbock', 3], ['frostfuchs', 3], ['donnerwidder', 2], ['gipfeladler', 1]],
    zones: 16,
    music: 'hohenkamm',
    flora: [['pineSnow', 1.4], ['boulder', 0.4], ['rock', 0.5]],
  },
  sandspiegel: {
    id: 'sandspiegel',
    name: 'Sandspiegel',
    monsters: [['duenenwuehler', 3], ['goldkaefer', 2], ['trugbild', 2], ['kaktuskrieger', 3]],
    zones: 16,
    music: 'sandspiegel',
    flora: [['cactusPlant', 0.7], ['palm', 0.2], ['rock', 0.4], ['boulder', 0.2]],
  },
  nebelhain: {
    id: 'nebelhain',
    name: 'Nebelhain',
    monsters: [['nebelwolf', 4], ['moosgolem', 2], ['irrlicht', 2], ['schattenluchs', 2], ['nebelwolf-alpha', 1]],
    zones: 18,
    music: 'nebelhain',
    flora: [['treeMoss', 2.2], ['treeDead', 0.6], ['glowshroom', 0.5], ['pine', 0.6], ['rock', 0.3]],
  },
  rosenweil: {
    id: 'rosenweil',
    name: 'Rosenweil',
    monsters: [['dornenranke', 3], ['herzfalter', 2]],
    zones: 12,
    music: 'rosenweil',
    flora: [['treeBlossom', 0.8], ['rosebush', 1], ['tree', 0.3], ['flowerpot', 0.05]],
  },
  ruinen: {
    id: 'ruinen',
    name: 'Ruinen von Alt-Kartheim',
    monsters: [['glyphenwaechter', 2], ['moosgolem', 1], ['tintenkobold', 1]],
    zones: 8,
    music: 'ruinen',
    flora: [['ruinPillar', 0.5], ['ruinBroken', 0.6], ['treeDead', 0.4], ['tree', 0.4], ['rock', 0.5]],
  },
};

/** Gebäude einer Stadt (Kachel-Versatz zum Stadtzentrum, Fusspunkt) */
export interface TownBuilding {
  type: ObjectTypeId;
  dx: number;
  dy: number;
  /** Tür-Kennung (siehe data/doors.ts) */
  door?: string;
}

export interface TownDef {
  id: string;
  name: string;
  region: RegionId;
  /** Zentrum in Kacheln */
  x: number;
  y: number;
  plaza: 'stone' | 'darkstone' | 'sand' | 'dirt';
  plazaR: number;
  buildings: TownBuilding[];
  /** Brunnen/Brunnenspiel im Zentrum */
  well: 'well' | 'fountain';
  lamps: [number, number][];
  deco?: { type: ObjectTypeId; dx: number; dy: number; text?: string; tag?: string }[];
}

export const TOWNS: TownDef[] = [
  {
    id: 'taufeld',
    name: 'Taufeld',
    region: 'taufeld',
    x: 156,
    y: 150,
    plaza: 'stone',
    plazaR: 5,
    well: 'well',
    buildings: [
      { type: 'shopCoin', dx: -9, dy: -3, door: 'taufeld:kraemerin' },
      { type: 'houseGreen', dx: 9, dy: -3, door: 'taufeld:hilde' },
      { type: 'houseRed', dx: -8, dy: 8, door: 'taufeld:haus1' },
      { type: 'houseOrange', dx: 8, dy: 8, door: 'taufeld:haus2' },
      { type: 'inn', dx: 0, dy: 13, door: 'taufeld:gasthof' },
    ],
    lamps: [[-5, -4], [5, -4], [-5, 5], [5, 5]],
    deco: [
      { type: 'firstGate', dx: 0, dy: -11, tag: 'erstes-tor' },
      { type: 'campfire', dx: 5, dy: -8 },
      { type: 'stump', dx: 3, dy: -8 },
      { type: 'stump', dx: 7, dy: -9 },
      { type: 'sign', dx: -3, dy: -7, text: 'Willkommen in Taufeld! ↑ Erstes Tor · Norden: Runenhall · Osten: Würfelheim · Westen: Rosenweil · Südwesten: Sandspiegel' },
      { type: 'bench', dx: -3, dy: 3 },
      { type: 'flowerpot', dx: 3, dy: 3 },
    ],
  },
  {
    id: 'runenhall',
    name: 'Runenhall',
    region: 'runenhall',
    x: 180,
    y: 46,
    plaza: 'darkstone',
    plazaR: 7,
    well: 'fountain',
    buildings: [
      { type: 'tower', dx: 0, dy: -11, door: 'runenhall:gilde' },
      { type: 'hallLibrary', dx: -13, dy: -7, door: 'runenhall:bibliothek' },
      { type: 'shopBook', dx: 12, dy: -6, door: 'runenhall:zauberladen' },
      { type: 'shopPotion', dx: -12, dy: 4, door: 'runenhall:kraeuter' },
      { type: 'shopCup', dx: 11, dy: 5, door: 'runenhall:teestube' },
      { type: 'shopBoot', dx: -4, dy: 11, door: 'runenhall:schuster' },
      { type: 'shopCard', dx: 6, dy: 12, door: 'runenhall:tauschboerse' },
      { type: 'houseViolet', dx: -20, dy: 6, door: 'runenhall:haus1' },
      { type: 'houseNavy', dx: 19, dy: -1, door: 'runenhall:haus2' },
    ],
    lamps: [[-6, -4], [6, -4], [-6, 6], [6, 6], [-2, 9], [2, 9]],
    deco: [
      { type: 'board', dx: 4, dy: -3, tag: 'rangliste' },
      { type: 'campfire', dx: -16, dy: 12 },
      { type: 'sign', dx: -3, dy: 16, text: 'Runenhall – Stadt der Siegel. ↓ Taufeld · → Möwenhafen · ← Nebelhain · ↖ Hohenkamm' },
    ],
  },
  {
    id: 'moewenhafen',
    name: 'Möwenhafen',
    region: 'moewenhafen',
    x: 266,
    y: 82,
    plaza: 'stone',
    plazaR: 5,
    well: 'well',
    buildings: [
      { type: 'shopAnchor', dx: -9, dy: -4, door: 'moewenhafen:hafenladen' },
      { type: 'inn', dx: 9, dy: -5, door: 'moewenhafen:kneipe' },
      { type: 'houseTeal', dx: -10, dy: 7, door: 'moewenhafen:hafenmeister' },
      { type: 'shopShell', dx: 8, dy: 7, door: 'moewenhafen:fisch' },
      { type: 'houseRedB', dx: -18, dy: 1, door: 'moewenhafen:haus1' },
    ],
    lamps: [[-5, -3], [5, -3], [-5, 4], [5, 4]],
    deco: [
      { type: 'campfire', dx: -4, dy: 12 },
      { type: 'sign', dx: 3, dy: 11, text: 'Möwenhafen. Das Seetor im Osten ist bewacht – nur mit Hafenpass.' },
    ],
  },
  {
    id: 'wuerfelheim',
    name: 'Würfelheim',
    region: 'wuerfelheim',
    x: 268,
    y: 150,
    plaza: 'stone',
    plazaR: 6,
    well: 'well',
    buildings: [
      { type: 'casino', dx: 0, dy: -9, door: 'wuerfelheim:casino' },
      { type: 'shopDice', dx: -12, dy: 2, door: 'wuerfelheim:schwarzhaendler' },
      { type: 'stallRed', dx: 11, dy: 1, door: 'wuerfelheim:preisladen' },
      { type: 'houseOrange', dx: -9, dy: 10, door: 'wuerfelheim:haus1' },
      { type: 'houseRed', dx: 9, dy: 10, door: 'wuerfelheim:haus2' },
    ],
    lamps: [[-6, -3], [6, -3], [-6, 5], [6, 5], [0, 7]],
    deco: [
      { type: 'campfire', dx: -16, dy: -4 },
      { type: 'sign', dx: -3, dy: 7, text: 'Würfelheim – hier rollt das Glück. Casino im Norden.' },
    ],
  },
  {
    id: 'hohenkamm',
    name: 'Hohenkamm',
    region: 'hohenkamm',
    x: 92,
    y: 46,
    plaza: 'stone',
    plazaR: 5,
    well: 'well',
    buildings: [
      { type: 'arena', dx: 0, dy: -12, door: 'hohenkamm:arena' },
      { type: 'shopSword', dx: -10, dy: -1, door: 'hohenkamm:training' },
      { type: 'houseSnow', dx: 10, dy: -1, door: 'hohenkamm:haus1' },
      { type: 'houseSnow', dx: -8, dy: 9, door: 'hohenkamm:eiswaechter' },
      { type: 'inn', dx: 9, dy: 9, door: 'hohenkamm:huette' },
    ],
    lamps: [[-5, -4], [5, -4], [-5, 5], [5, 5]],
    deco: [
      { type: 'campfire', dx: 0, dy: 15 },
      { type: 'sign', dx: 3, dy: 15, text: 'Hohenkamm – Heimat des Felsenkessels und des Klippenballs.' },
    ],
  },
  {
    id: 'sandspiegel',
    name: 'Sandspiegel',
    region: 'sandspiegel',
    x: 78,
    y: 196,
    plaza: 'sand',
    plazaR: 6,
    well: 'well',
    buildings: [
      { type: 'hallMirror', dx: 0, dy: -10, door: 'sandspiegel:spiegelsaal' },
      { type: 'houseSand', dx: -11, dy: -2, door: 'sandspiegel:haus1' },
      { type: 'shopSand', dx: 11, dy: -2, door: 'sandspiegel:basar' },
      { type: 'houseSand', dx: -10, dy: 8, door: 'sandspiegel:wasser' },
      { type: 'tent', dx: 9, dy: 8, door: 'sandspiegel:karawane' },
      { type: 'tentBlue', dx: 15, dy: 9, door: 'sandspiegel:karawane2' },
    ],
    lamps: [[-5, -4], [5, -4], [-5, 5], [5, 5]],
    deco: [
      { type: 'campfire', dx: 0, dy: 13 },
      { type: 'palm', dx: -4, dy: 2 },
      { type: 'palm', dx: 4, dy: 2 },
      { type: 'sign', dx: -3, dy: 13, text: 'Sandspiegel – Stadt der Rätsel. Hüte dich vor wandernden Hügeln.' },
    ],
  },
  {
    id: 'rosenweil',
    name: 'Rosenweil',
    region: 'rosenweil',
    x: 36,
    y: 140,
    plaza: 'stone',
    plazaR: 6,
    well: 'fountain',
    buildings: [
      { type: 'housePink', dx: -10, dy: -5, door: 'rosenweil:poet' },
      { type: 'shopRose', dx: 10, dy: -5, door: 'rosenweil:kraemer' },
      { type: 'housePink', dx: -9, dy: 8, door: 'rosenweil:haus1' },
      { type: 'inn', dx: 9, dy: 8, door: 'rosenweil:gasthof' },
      { type: 'stall', dx: 0, dy: -9, door: 'rosenweil:fest' },
    ],
    lamps: [[-5, -3], [5, -3], [-5, 5], [5, 5]],
    deco: [
      { type: 'campfire', dx: 14, dy: 14 },
      { type: 'sign', dx: 3, dy: 13, text: 'Rosenweil – wo jede Rose eine Geschichte erzählt.' },
    ],
  },
];

/** Straßen als Kachel-Wegpunkte */
export const ROADS: [number, number][][] = [
  // Taufeld → Runenhall (östlich am Silbersee vorbei)
  [[156, 144], [160, 128], [174, 116], [190, 100], [190, 80], [184, 62], [180, 56]],
  // Runenhall → Möwenhafen
  [[188, 46], [214, 52], [240, 66], [258, 80]],
  // Taufeld → Würfelheim
  [[162, 150], [196, 154], [232, 150], [260, 150]],
  // Würfelheim → Möwenhafen
  [[268, 142], [262, 122], [264, 102], [266, 88]],
  // Taufeld → Rosenweil
  [[150, 150], [118, 148], [84, 146], [56, 142], [42, 140]],
  // Taufeld → Sandspiegel
  [[152, 156], [128, 174], [100, 188], [86, 196]],
  // Runenhall → Hohenkamm
  [[174, 44], [148, 50], [120, 48], [98, 46]],
  // Runenhall → Nebelhain
  [[172, 54], [140, 70], [100, 74], [64, 80], [38, 86]],
  // Taufeld → Ruinen (über die Schlucht)
  [[148, 146], [130, 132], [118, 118], [104, 102]],
  // Rosenweil → Nebelhain
  [[36, 134], [42, 112], [38, 90]],
  // Sandspiegel → Rosenweil
  [[72, 192], [56, 170], [40, 148]],
];

/** Flüsse als Kachel-Wegpunkte (Breite in Kacheln) */
export const RIVERS: { pts: [number, number][]; w: number }[] = [
  // Silberlauf: vom Silbersee nach Osten ins Meer
  { pts: [[178, 94], [200, 100], [226, 106], [250, 114], [276, 118], [300, 120], [312, 120]], w: 3 },
  // Bergbach: aus Hohenkamm in den Silbersee
  { pts: [[118, 34], [124, 52], [132, 70], [142, 84], [146, 90]], w: 2 },
];

/** Besondere Orte (Kachelkoordinaten) */
export interface Poi {
  type: ObjectTypeId;
  x: number;
  y: number;
  text?: string;
  tag?: string;
}

export const POIS: Poi[] = [
  // Rastfeuer in der Wildnis
  { type: 'campfire', x: 130, y: 120 },
  { type: 'campfire', x: 214, y: 128 },
  { type: 'campfire', x: 60, y: 96 },
  { type: 'campfire', x: 120, y: 34 },
  { type: 'campfire', x: 104, y: 176 },
  { type: 'campfire', x: 236, y: 60 },
  // Aussichtspunkte (Kartografenfeder-Quest)
  { type: 'bench', x: 150, y: 28, tag: 'aussicht:1' },
  { type: 'bench', x: 70, y: 22, tag: 'aussicht:2' },
  { type: 'bench', x: 290, y: 70, tag: 'aussicht:3' },
  { type: 'bench', x: 230, y: 176, tag: 'aussicht:4' },
  { type: 'bench', x: 50, y: 216, tag: 'aussicht:5' },
  { type: 'bench', x: 14, y: 120, tag: 'aussicht:6' },
  { type: 'bench', x: 160, y: 200, tag: 'aussicht:7' },
  // Windmühlen
  { type: 'windmill', x: 222, y: 92, tag: 'muehle:1' },
  { type: 'windmill', x: 238, y: 124, tag: 'muehle:2' },
  { type: 'windmill', x: 206, y: 118, tag: 'muehle:3' },
  // Leuchtturm
  { type: 'lighthouse', x: 286, y: 64, tag: 'leuchtturm' },
  // Höhlen und Treppen
  { type: 'cave', x: 50, y: 66, tag: 'warp:glimmerhoehle' },
  { type: 'cave', x: 292, y: 100, tag: 'warp:muschelgrotte' },
  { type: 'stairs', x: 96, y: 92, tag: 'warp:labyrinth' },
  // Boot am Seetor
  { type: 'boat', x: 286, y: 90, tag: 'warp:klippen' },
  { type: 'boat', x: 270, y: 26, tag: 'warp:hafen' },
  // Statuen von Alt-Kartheim
  { type: 'statue', x: 100, y: 108, tag: 'statue:1' },
  { type: 'statue', x: 108, y: 108, tag: 'statue:2' },
  { type: 'statue', x: 100, y: 116, tag: 'statue:3' },
  { type: 'statue', x: 108, y: 116, tag: 'statue:4' },
  { type: 'sign', x: 104, y: 103, tag: 'tafel:statuen', text: 'Eine verwitterte Tafel: „Der Erste sucht den Sonnenaufgang. Der Zweite grüsst die Berge. Der Dritte hütet die Wüste. Der Vierte sehnt sich nach dem Abend."' },
  // Möwenklippen
  { type: 'spot', x: 290, y: 34, tag: 'geheim:logbuch' },
  { type: 'spot', x: 270, y: 44, tag: 'geheim:ranke' },
  // Wüste: Grabstellen und Oasentor
  { type: 'spot', x: 50, y: 180, tag: 'graben:wueste:1' },
  { type: 'spot', x: 110, y: 204, tag: 'graben:wueste:2' },
  { type: 'spot', x: 64, y: 222, tag: 'graben:wueste:3' },
  { type: 'spot', x: 100, y: 184, tag: 'graben:wueste:4' },
  { type: 'spot', x: 36, y: 200, tag: 'graben:wueste:5' },
  { type: 'cave', x: 120, y: 212, tag: 'warp:oase' },
  { type: 'spot', x: 70, y: 207, tag: 'spur:1' },
  { type: 'spot', x: 90, y: 210, tag: 'spur:2' },
  { type: 'spot', x: 60, y: 189, tag: 'spur:3' },
  // Ruinen: Grabstellen und Kontrollfahnen für das Zeitrennen
  { type: 'spot', x: 86, y: 100, tag: 'graben:ruine:1' },
  { type: 'spot', x: 118, y: 98, tag: 'graben:ruine:2' },
  { type: 'spot', x: 92, y: 121, tag: 'graben:ruine:3' },
  { type: 'spot', x: 123, y: 118, tag: 'graben:ruine:4' },
  { type: 'spot', x: 84, y: 112, tag: 'graben:ruine:5' },
  { type: 'spot', x: 112, y: 125, tag: 'graben:ruine:6' },
  { type: 'checkpoint', x: 92, y: 96, tag: 'rennen:1' },
  { type: 'checkpoint', x: 106, y: 90, tag: 'rennen:2' },
  { type: 'checkpoint', x: 121, y: 102, tag: 'rennen:3' },
  { type: 'checkpoint', x: 125, y: 114, tag: 'rennen:4' },
  { type: 'checkpoint', x: 115, y: 127, tag: 'rennen:5' },
  { type: 'checkpoint', x: 97, y: 127, tag: 'rennen:6' },
  { type: 'checkpoint', x: 82, y: 118, tag: 'rennen:7' },
  { type: 'checkpoint', x: 98, y: 104, tag: 'rennen:8' },
  // Nebelhain: Irrlicht-Laternen, Weg ins Nebelherz
  { type: 'lampPost', x: 24, y: 102, tag: 'irrlampe:1' },
  { type: 'lampPost', x: 31, y: 97, tag: 'irrlampe:2' },
  { type: 'lampPost', x: 38, y: 102, tag: 'irrlampe:3' },
  { type: 'lampPost', x: 31, y: 108, tag: 'irrlampe:4' },
  { type: 'sign', x: 31, y: 103, tag: 'tafel:irrlicht', text: 'In Moos geritzt: „Erst wo die Sonne schläft, dann wo der Nordwind wohnt, dann wo der Morgen erwacht – zuletzt, wo die Wärme thront."' },
  { type: 'fogGate', x: 20, y: 84, tag: 'warp:nebelherz' },
  // Hohenkamm: Kletterwand und Bergpfad zum Gipfel
  { type: 'vineGate', x: 60, y: 30, tag: 'warp:adlerhorst' },
  { type: 'stairs', x: 98, y: 22, tag: 'warp:gipfel' },
  // Boss-Arenen
  { type: 'cave', x: 196, y: 180, tag: 'warp:wiesenkessel' },
  { type: 'sign', x: 193, y: 182, text: '„Achtung! Hinter diesem Hügel schläft der Grasriese. Nicht wecken!" – Die Taufelder' },
  { type: 'vineGate', x: 14, y: 150, tag: 'warp:rosengarten' },
  { type: 'stairs', x: 122, y: 106, tag: 'warp:aschenhalle' },
];
