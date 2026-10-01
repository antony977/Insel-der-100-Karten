import { PAL, RAMPS, type Ramp } from '../palette';
import { LabelCanvas, part, type MaterialMap, type Part } from '../SpriteComposer';
import { Raster } from '../Raster';

/**
 * Generator für Chibi-Figuren (Spieler, NPCs, Rivalen) im 24×32-Frame.
 *
 * Spritesheet-Layout (für spätere PNG-Ersetzung):
 *   Spalten (je 24 px): 0 idle0, 1 idle1, 2 walkA, 3 walkB, 4 atk1 (Ausholen), 5 atk2 (Schlag),
 *                       6 atk3 (Nachschwung), 7 hurt, 8 roll1, 9 roll2, 10 aura, 11 cast
 *   Zeilen  (je 32 px): 0 unten, 1 links, 2 rechts, 3 oben
 *   Fusspunkt: x = 12, y = 30
 */

export const CHAR_FRAME_W = 24;
export const CHAR_FRAME_H = 32;
export const CHAR_COLS = 12;
export const CHAR_ROWS = 4;

export const POSES = ['idle0', 'idle1', 'walkA', 'walkB', 'atk1', 'atk2', 'atk3', 'hurt', 'roll1', 'roll2', 'aura', 'cast'] as const;
export type PoseName = (typeof POSES)[number];
export const DIRS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRS)[number];

export type HairStyle = 'short' | 'long' | 'spiky' | 'bun' | 'bob';

export interface CharacterLook {
  skin: Ramp;
  hair: Ramp;
  hairStyle: HairStyle;
  cloth: Ramp;
  shirt: Ramp;
  pants: Ramp;
  boots: Ramp;
  belt: Ramp;
  /** Schal/Akzent – ohne Angabe kein Schal */
  accent?: Ramp;
  eye: number;
  iris: number;
}

export const PLAYER_LOOK: CharacterLook = {
  skin: RAMPS.skin,
  hair: [PAL.ink, PAL.bark, PAL.wood, PAL.tan],
  hairStyle: 'short',
  cloth: RAMPS.teal,
  shirt: RAMPS.white,
  pants: RAMPS.navy,
  boots: RAMPS.leather,
  belt: RAMPS.gold,
  accent: RAMPS.red,
  eye: PAL.navy,
  iris: PAL.sky,
};

// ---------------------------------------------------------------------------
// Schablonen. Materialien: S Haut, E Auge, W Glanz, e Iris, M Mund, R Wange,
// H Haar, X Haarglanz, C Kleidung, D Hemd, V Ärmel, F Hand, G Gürtel,
// P Hose, B Stiefel, A Schal, Y Karte (weiss)
// ---------------------------------------------------------------------------

const HEAD_FRONT = [
  '....SSSSSSSS....',
  '..SSSSSSSSSSSS..',
  '.SSSSSSSSSSSSSS.',
  '.SSSSSSSSSSSSSS.',
  'SSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSSSS',
  'SSSWESSSSSSWESSS',
  'SSSEESSSSSSEESSS',
  'SSSeeSSSSSSeeSSS',
  'SSRSSSSMMSSSSRSS',
  '.SSSSSSSSSSSSSS.',
  '...SSSSSSSSSS...',
];

const HEAD_BACK = HEAD_FRONT.map((r) => r.replace(/[EWeMR]/g, 'S'));

const HEAD_SIDE = [
  '...SSSSSSSS...',
  '.SSSSSSSSSSSS.',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
  'SWESSSSSSSSSSS',
  'SEESSSSSSSSSSS',
  'SeeSSSSSSSSSSS',
  'SSSRSSSSSSSSSS',
  '.MSSSSSSSSSSSS',
  '..SSSSSSSSSSS.',
];

type FaceMood = 'normal' | 'blink' | 'hurt' | 'focus';

function applyFace(rows: readonly string[], mood: FaceMood, side: boolean): string[] {
  const out = rows.map((r) => r.split(''));
  const eyes = side ? [1] : [3, 11];
  for (const ex of eyes) {
    const set = (dx: number, dy: number, ch: string) => {
      out[7 + dy][ex + dx] = ch;
    };
    if (mood === 'blink') {
      set(0, 0, 'S'); set(1, 0, 'S'); set(0, 1, 'S'); set(1, 1, 'S'); set(0, 2, 'E'); set(1, 2, 'E');
    } else if (mood === 'hurt') {
      // zusammengekniffene Augen > <
      const left = side || ex < 8;
      set(0, 0, left ? 'E' : 'S'); set(1, 0, left ? 'S' : 'E');
      set(0, 1, left ? 'S' : 'E'); set(1, 1, left ? 'E' : 'S');
      set(0, 2, left ? 'E' : 'S'); set(1, 2, left ? 'S' : 'E');
    } else if (mood === 'focus') {
      set(0, 0, 'E'); set(1, 0, 'E'); set(0, 1, 'W'); set(1, 1, 'E'); set(0, 2, 'e'); set(1, 2, 'e');
    }
  }
  if (mood === 'hurt' && !side) {
    out[10][7] = 'M'; out[10][8] = 'M'; out[11][7] = 'M'; out[11][8] = 'M';
  }
  return out.map((r) => r.join(''));
}

// Frisuren: jeweils [vorne, Seite (Blick nach links), hinten], Position relativ zum Frame
interface HairSet {
  front: Part;
  side: Part;
  back: Part;
}

const HAIR: Record<HairStyle, HairSet> = {
  short: {
    front: part(3, 3, [
      '........HH........',
      '......HHHH.HH.....',
      '....HHHHHHHHHHH...',
      '...HHHHHHHhHHHHH..',
      '..HHHXXHHHhHHHHHH.',
      '.HHHXHHHHhHHHhHHH.',
      '.HHHHHHHhHHHHhHHH.',
      'HHHHhHHhHHHHHHhHHH',
      'HHHhHHHHHHHHHHhHHH',
      'HHH.HHHH.HHHH.HHHH',
      'HH......HH......HH',
      'HH..............HH',
      '.H..............H.',
    ]),
    side: part(4, 3, [
      '.......HH.......',
      '.....HHHHHH.....',
      '...HHHHHHHHHH...',
      '..HHHHHHhHHHHH..',
      '.HHXXHHHhHHHHHH.',
      '.HXHHHHhHHHhHHHH',
      'HHHHHHhHHHhHHHHH',
      'HHHHHhHHHhHHHHHH',
      'HHHHHHHHhHHHhHHH',
      'H.HH.HHHHHHHhHHH',
      'H........HHHHHHH',
      '.........HHHHHHH',
      '.........HHHHHHH',
      '..........HHHHH.',
      '...........HHH..',
    ]),
    back: part(3, 3, [
      '........HH........',
      '......HHHHHH......',
      '....HHHHHHHHHH....',
      '...HHHHHHhHHHHH...',
      '..HHHXXHHhHHHHHH..',
      '.HHHXHHHHhHHHhHHH.',
      '.HHHHHhHHhHHHhHHH.',
      'HHHHHHhHHHhHHhHHHH',
      'HHHHHHhHHHhHHHhHHH',
      'HHHhHHHhHHhHHHhHHH',
      'HHHhHHHhHHHhHHhHHH',
      'HHHhHHHhHHHhHHHHHH',
      '.HHHHHHhHHHHhHHHH.',
      '.HHHHHHHHHHHhHHHH.',
      '..HHH.HHHHHH.HHH..',
      '...H...HHHH...H...',
    ]),
  },
  spiky: {
    front: part(2, 1, [
      '...H.....HH.....H...',
      '...HH...HHH....HH...',
      '....HH.HHHHH..HH....',
      '....HHHHHHHHHHHH....',
      '.HHHHHHHHHHHHHHHHHH.',
      '..HHHHXXHHHHHHHHHH..',
      '..HHHXHHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHHHHHH.',
      'HHHHHHHHHHHHHHHHHHHH',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHH.HHH.HHH.HHHHH.',
      '.HHH...H...H....HHH.',
      '..HH............HH..',
      '..H..............H..',
    ]),
    side: part(3, 1, [
      '.......H....H.....',
      '......HH...HH...H.',
      '.....HHHH.HHH..HH.',
      '....HHHHHHHHHHHH..',
      '..HHHHHHHHHHHHHHHH',
      '.HHXXHHHHHHHHHHHH.',
      '.HXHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHH.',
      'HHHHHHHHHHHHHHHHHH',
      '.HHHHHHHHHHHHHHHH.',
      '.H.HH.HHHHHHHHHHHH',
      '.H........HHHHHHH.',
      '..........HHHHHHHH',
      '..........HHHHHH..',
      '...........HHHH...',
    ]),
    back: part(2, 1, [
      '...H.....HH.....H...',
      '...HH...HHH....HH...',
      '....HH.HHHHH..HH....',
      '....HHHHHHHHHHHH....',
      '.HHHHHHHHHHHHHHHHHH.',
      '..HHHHXXHHHHHHHHHH..',
      '..HHHXHHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHHHHHH.',
      'HHHHHHHHHHHHHHHHHHHH',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '..HHHHHHHHHHHHHHHH..',
      '..HHHHHHHHHHHHHHHH..',
      '...HH.HHHHHHHH.HH...',
      '...H...HH..HH...H...',
    ]),
  },
  long: {
    front: part(2, 3, [
      '.........HH.........',
      '.......HHHHHH.......',
      '.....HHHHHHHHHH.....',
      '....HHHHHHHHHHHH....',
      '...HHHXXHHHHHHHHH...',
      '..HHHXHHHHHHHHHHHH..',
      '..HHHHHHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHH.HHHHHHHH.HHHH.',
      '.HHH....HHHH....HHH.',
      '.HHH............HHH.',
      '.HHH............HHH.',
      '.HHH............HHH.',
      '.HHHH..........HHHH.',
      '.HHHH..........HHHH.',
      '..HHH..........HHH..',
      '..HH............HH..',
    ]),
    side: part(4, 3, [
      '.......HH.......',
      '.....HHHHHH.....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '.HHXXHHHHHHHHHH.',
      '.HXHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'H.HH.HHHHHHHHHHH',
      'H.......HHHHHHHH',
      '........HHHHHHHH',
      '........HHHHHHHH',
      '........HHHHHHHH',
      '.........HHHHHHH',
      '.........HHHHHHH',
      '..........HHHHH.',
      '...........HHH..',
    ]),
    back: part(2, 3, [
      '.........HH.........',
      '.......HHHHHH.......',
      '.....HHHHHHHHHH.....',
      '....HHHHHHHHHHHH....',
      '...HHHXXHHHHHHHHH...',
      '..HHHXHHHHHHHHHHHH..',
      '..HHHHHHHHHHHHHHHH..',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '..HHHHHHHHHHHHHHHH..',
      '..HHHHHHHHHHHHHHHH..',
      '...HHH.HHHHHH.HHH...',
    ]),
  },
  bun: {
    front: part(3, 0, [
      '.......HHHH.......',
      '......HHXHHH......',
      '......HHHHHH......',
      '.......HHHH.......',
      '....HHHHHHHHHH....',
      '...HHHHHHHHHHHH...',
      '..HHHXXHHHHHHHHH..',
      '.HHHXHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHH.',
      'HHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHH',
      'HH.HHHHHHHHHHHH.HH',
      'HH..............HH',
      'HH..............HH',
      '.H..............H.',
    ]),
    side: part(4, 0, [
      '..........HHHH..',
      '.........HHXHHH.',
      '.........HHHHHH.',
      '..........HHHH..',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '.HHXXHHHHHHHHHH.',
      '.HXHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'H.HHHHHHHHHHHHHH',
      '.........HHHHHHH',
      '.........HHHHHHH',
      '..........HHHHH.',
    ]),
    back: part(3, 0, [
      '.......HHHH.......',
      '......HHXHHH......',
      '......HHHHHH......',
      '.......HHHH.......',
      '....HHHHHHHHHH....',
      '...HHHHHHHHHHHH...',
      '..HHHXXHHHHHHHHH..',
      '.HHHXHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHH.',
      'HHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHH',
      '.HHHHHHHHHHHHHHHH.',
      '..HHHHHHHHHHHHHH..',
      '....HHHHHHHHHH....',
    ]),
  },
  bob: {
    front: part(2, 3, [
      '.........HH.........',
      '......HHHHHHHH......',
      '....HHHHHHHHHHHH....',
      '...HHHHHHHHHHHHHH...',
      '..HHHXXHHHHHHHHHHH..',
      '.HHHXHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHH............HHH.',
      '.HHH............HHH.',
      '.HHH............HHH.',
      '..HHH..........HHH..',
    ]),
    side: part(4, 3, [
      '.......HH.......',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '.HHXXHHHHHHHHHH.',
      '.HXHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHH',
      'H.......HHHHHHHH',
      '........HHHHHHHH',
      '........HHHHHHHH',
      '.........HHHHHH.',
    ]),
    back: part(2, 3, [
      '.........HH.........',
      '......HHHHHHHH......',
      '....HHHHHHHHHHHH....',
      '...HHHHHHHHHHHHHH...',
      '..HHHXXHHHHHHHHHHH..',
      '.HHHXHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '.HHHHHHHHHHHHHHHHHH.',
      '..HHHHHHHHHHHHHHHH..',
    ]),
  },
};

// Körper – Vorderansicht
const TORSO_FRONT = part(7, 19, ['.CCCDDCCC.', 'CCCCDDCCCC', 'CCCCDDCCCC', 'CCCCDDCCCC', 'CCCCCCCCCC', 'GGGGGGGGGG']);
const TORSO_BACK = part(7, 19, ['.CCCCCCCC.', 'CCCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCCC', 'GGGGGGGGGG']);
const TORSO_SIDE = part(8, 19, ['.CCCCCC.', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'GGGGGGGG']);

const SCARF_FRONT = [
  part(6, 19, ['AAAAAAAAAAAA', '.AAAAAAAAAA.', '.......AA...', '.......AA...', '........A...']),
  part(6, 19, ['AAAAAAAAAAAA', '.AAAAAAAAAA.', '.......AA...', '........AA..', '........A...']),
  part(6, 19, ['AAAAAAAAAAAA', '.AAAAAAAAAA.', '.......AA...', '......AA....', '.......A....']),
];
const SCARF_BACK = [
  part(6, 19, ['AAAAAAAAAAAA', '.AAAAAAAAAA.', '....AAAA....', '.....AA.....', '.....A.A....']),
  part(6, 19, ['AAAAAAAAAAAA', '.AAAAAAAAAA.', '....AAAA....', '......AA....', '......A.A...']),
  part(6, 19, ['AAAAAAAAAAAA', '.AAAAAAAAAA.', '....AAAA....', '....AA......', '....A.A.....']),
];
const SCARF_SIDE = [
  part(7, 19, ['AAAAAAAAA..', '.AAAAAAAAAA', '.......AAAA', '.........AA']),
  part(7, 19, ['AAAAAAAAA..', '.AAAAAAAAAA', '.......AAA.', '........AA.']),
  part(7, 19, ['AAAAAAAAA..', '.AAAAAAAAAA', '........AAA', '..........A']),
];

type ArmPose = 'down' | 'up' | 'forward' | 'out' | 'across' | 'tuck';

// Arme: [linker Arm, rechter Arm] in Vorder-/Rückansicht, Position relativ zum Frame
const ARM_FRONT: Record<ArmPose, [Part | null, Part | null]> = {
  down: [part(5, 19, ['VV', 'VV', 'VV', 'VV', 'FF', 'FF']), part(17, 19, ['VV', 'VV', 'VV', 'VV', 'FF', 'FF'])],
  up: [part(5, 13, ['FF', 'FF', 'VV', 'VV', 'VV', 'VV', 'VV']), part(17, 13, ['FF', 'FF', 'VV', 'VV', 'VV', 'VV', 'VV'])],
  forward: [part(7, 21, ['VV', 'VV', 'VV', 'VV', 'FF', 'FF']), part(15, 21, ['VV', 'VV', 'VV', 'VV', 'FF', 'FF'])],
  out: [part(2, 19, ['FFVVV', 'FFVVV']), part(17, 19, ['VVVFF', 'VVVFF'])],
  across: [part(7, 21, ['VVVVVVVFF', 'VVVVVVVFF']), part(8, 21, ['FFVVVVVVV', 'FFVVVVVVV'])],
  tuck: [null, null],
};
const ARM_SIDE: Record<ArmPose, Part | null> = {
  down: part(11, 20, ['VV', 'VV', 'VV', 'FF', 'FF']),
  up: part(9, 12, ['FF', 'FF', 'VV', 'VV', 'VV', 'VV', 'VV', 'VV']),
  forward: part(3, 21, ['FFVVVVVVV', 'FFVVVVVVV']),
  out: part(12, 21, ['VVVVFF', 'VVVVFF']),
  across: part(13, 22, ['VVVVFF', 'VVVVFF']),
  tuck: null,
};

// Beine (Vorderansicht): links / rechts
const LEG_L = part(8, 25, ['PPPP', 'PPP.', 'PPP.', 'BBB.', 'BBB.']);
const LEG_R = part(12, 25, ['PPPP', '.PPP', '.PPP', '.BBB', '.BBB']);
// Seitenansicht
const HIPS_SIDE = part(9, 25, ['PPPPPP']);
const LEG_SIDE = part(9, 26, ['.PPP', '.PPP', '.BBB', 'BBBB']);

// Karte in der Hand (weiss mit Rand)
const CARD = ['YYY', 'YYY', 'YYY', 'YYY'];

interface PoseSpec {
  head: [number, number];
  body: [number, number];
  armL: ArmPose;
  armR: ArmPose;
  armLOff?: [number, number];
  armROff?: [number, number];
  legL: [number, number];
  legR: [number, number];
  face: FaceMood;
  scarf: number;
  card?: 'R' | 'L';
  hideLegs?: boolean;
}

const BASE: PoseSpec = {
  head: [0, 0],
  body: [0, 0],
  armL: 'down',
  armR: 'down',
  legL: [0, 0],
  legR: [0, 0],
  face: 'normal',
  scarf: 0,
};

const POSE_SPECS: Record<PoseName, PoseSpec> = {
  idle0: BASE,
  idle1: { ...BASE, head: [0, 1], body: [0, 1] },
  walkA: { ...BASE, head: [0, -1], body: [0, -1], legL: [0, -1], armLOff: [0, 1], armROff: [0, -1], scarf: 1 },
  walkB: { ...BASE, head: [0, -1], body: [0, -1], legR: [0, -1], armLOff: [0, -1], armROff: [0, 1], scarf: 2 },
  atk1: { ...BASE, head: [0, 1], body: [0, 1], armR: 'up', legL: [-1, 0], legR: [1, 0], face: 'focus', card: 'R' },
  atk2: { ...BASE, head: [0, -1], body: [0, 0], armR: 'forward', legL: [-1, 0], legR: [1, 0], face: 'focus', scarf: 1, card: 'R' },
  atk3: { ...BASE, head: [-1, 0], body: [-1, 0], armR: 'across', legL: [-1, 0], legR: [1, 0], face: 'focus', scarf: 2 },
  hurt: { ...BASE, head: [0, -1], body: [0, 0], armL: 'out', armR: 'out', face: 'hurt', scarf: 2 },
  roll1: { ...BASE, head: [0, 4], body: [0, 3], armL: 'tuck', armR: 'tuck', legL: [0, -1], legR: [0, -1], face: 'blink', scarf: 1 },
  roll2: { ...BASE, head: [0, 7], body: [0, 4], armL: 'tuck', armR: 'tuck', face: 'blink', scarf: 2, hideLegs: true },
  aura: { ...BASE, armL: 'out', armR: 'out', legL: [-1, 0], legR: [1, 0], face: 'focus', scarf: 1 },
  cast: { ...BASE, head: [0, -1], armR: 'up', face: 'focus', card: 'R', scarf: 1 },
};

function materialsFor(look: CharacterLook): MaterialMap {
  return {
    S: { ramp: look.skin },
    E: { flat: look.eye, group: 'S' },
    W: { flat: PAL.white, group: 'S' },
    e: { flat: look.iris, group: 'S' },
    M: { flat: PAL.wine, group: 'S' },
    R: { flat: PAL.coral, group: 'S' },
    H: { ramp: look.hair },
    X: { ramp: look.hair, tone: 3, group: 'H' },
    h: { ramp: look.hair, tone: 1, group: 'H' },
    C: { ramp: look.cloth },
    D: { ramp: look.shirt, group: 'C', rim: false },
    V: { ramp: look.cloth },
    F: { ramp: look.skin },
    G: { ramp: look.belt, rim: false },
    P: { ramp: look.pants },
    B: { ramp: look.boots },
    A: { ramp: look.accent ?? look.cloth },
    Y: { flat: PAL.white },
  };
}

function composeFrame(look: CharacterLook, dir: Dir, pose: PoseName): Raster {
  const spec = POSE_SPECS[pose];
  const lc = new LabelCanvas(CHAR_FRAME_W, CHAR_FRAME_H);
  const side = dir === 'left' || dir === 'right';
  const back = dir === 'up';
  const hair = HAIR[look.hairStyle];
  const [bx, by] = spec.body;
  const [hx, hy] = spec.head;

  if (!side) {
    // Beine
    if (!spec.hideLegs) {
      lc.stamp(LEG_L, spec.legL[0], spec.legL[1]);
      lc.stamp(LEG_R, spec.legR[0], spec.legR[1]);
    }
    // Arme hinter dem Körper (nur beim Ausholen nach oben in Rückansicht)
    const [armL, armR] = [ARM_FRONT[spec.armL][0], ARM_FRONT[spec.armR][1]];
    const lOff = spec.armLOff ?? [0, 0];
    const rOff = spec.armROff ?? [0, 0];
    const armsBehind = back && (spec.armR === 'forward' || spec.armR === 'up');
    if (armsBehind && armR) lc.stamp(armR, bx + rOff[0], by + rOff[1] - (spec.armR === 'forward' ? 8 : 0));
    lc.stamp(back ? TORSO_BACK : TORSO_FRONT, bx, by);
    if (look.accent) {
      const scarf = (back ? SCARF_BACK : SCARF_FRONT)[spec.scarf];
      lc.stamp(scarf, bx, by);
    }
    // In der Rückansicht sind links/rechts vertauscht
    const leftArm = back ? ARM_FRONT[spec.armR][0] : armL;
    const rightArm = back ? ARM_FRONT[spec.armL][1] : armR;
    const leftOff = back ? rOff : lOff;
    const rightOff = back ? lOff : rOff;
    if (leftArm && !(armsBehind && back && spec.armR !== 'down')) lc.stamp(leftArm, bx + leftOff[0], by + leftOff[1]);
    if (rightArm && !(armsBehind && !back)) lc.stamp(rightArm, bx + rightOff[0], by + rightOff[1]);
    // Kopf + Haare
    const headRows = back ? HEAD_BACK : applyFace(HEAD_FRONT, spec.face, false);
    lc.stamp(part(4, 6, headRows), hx, hy);
    lc.stamp(back ? hair.back : hair.front, hx, hy);
    // Karte in der Hand
    if (spec.card && !back) {
      const arm = ARM_FRONT[spec.armR][1];
      if (arm) {
        const handX = arm.x + bx + rOff[0] + (spec.armR === 'forward' ? 1 : 1);
        const handY = arm.y + by + rOff[1] + (spec.armR === 'up' ? -3 : arm.rows.length - 1);
        lc.stamp(part(handX, handY, CARD), 0, 0);
      }
    }
  } else {
    // Seitenansicht (Blick nach links) – rechts wird am Ende gespiegelt
    if (!spec.hideLegs) {
      const walkFront = pose === 'walkA' ? -2 : pose === 'walkB' ? 2 : spec.legL[0];
      const walkBack = pose === 'walkA' ? 2 : pose === 'walkB' ? -2 : spec.legR[0];
      lc.stamp(LEG_SIDE, walkBack + 1, pose === 'walkA' ? -1 : spec.legR[1], { dim: true });
      lc.stamp(HIPS_SIDE, 0, 0);
      lc.stamp(LEG_SIDE, walkFront, pose === 'walkB' ? -1 : spec.legL[1]);
    }
    lc.stamp(TORSO_SIDE, bx, by);
    if (look.accent) lc.stamp(SCARF_SIDE[spec.scarf], bx, by);
    const headRows = applyFace(HEAD_SIDE, spec.face, true);
    lc.stamp(part(5, 6, headRows), hx, hy);
    lc.stamp(hair.side, hx, hy);
    const armPose = spec.armR === 'down' && spec.armL !== 'down' ? spec.armL : spec.armR;
    const arm = ARM_SIDE[armPose];
    if (arm) {
      const swing = pose === 'walkA' ? -1 : pose === 'walkB' ? 1 : 0;
      lc.stamp(arm, bx + swing, by);
      if (spec.card) {
        const handX = armPose === 'forward' ? arm.x + bx - 2 : arm.x + bx;
        const handY = armPose === 'up' ? arm.y + by - 3 : arm.y + by;
        lc.stamp(part(handX, handY, CARD), 0, 0);
      }
    }
    if (dir === 'right') lc.flipX();
  }
  return lc.render(materialsFor(look));
}

/** Erzeugt das komplette Spritesheet einer Figur (288×128). */
export function generateCharacterSheet(look: CharacterLook): Raster {
  const sheet = new Raster(CHAR_FRAME_W * CHAR_COLS, CHAR_FRAME_H * CHAR_ROWS);
  DIRS.forEach((dir, row) => {
    POSES.forEach((pose, col) => {
      const frame = composeFrame(look, dir, pose);
      sheet.blit(frame, col * CHAR_FRAME_W, row * CHAR_FRAME_H);
    });
  });
  return sheet;
}

/** Frame-Index im Spritesheet */
export function charFrame(dir: Dir, pose: PoseName): number {
  return DIRS.indexOf(dir) * CHAR_COLS + POSES.indexOf(pose);
}

/** Bodenschatten für Figuren (16×6, halbtransparent). */
export function generateShadow(w = 16, h = 6): Raster {
  const r = new Raster(w, h);
  r.ellipse(w / 2, h / 2, w / 2, h / 2, PAL.ink, 110);
  return r;
}
