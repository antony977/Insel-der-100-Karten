import { PAL, RAMPS, type Ramp } from '../gfx/palette';
import { PLAYER_LOOK, type CharacterLook, type Dir, type HairStyle } from '../gfx/generators/characters';

/**
 * Figuren der Insel (datengetrieben). Position: Stadt + Kachel-Versatz oder freie
 * Kachelkoordinaten. Aussehen wird per Code erzeugt (Textur „npc-<id>").
 */
export interface NpcDef {
  id: string;
  name: string;
  /** Rolle für das Portrait-Untertitel */
  role?: string;
  look: CharacterLook;
  map: string;
  town?: string;
  /** Kachel-Versatz zur Stadt bzw. absolute Kachel */
  x: number;
  y: number;
  facing?: Dir;
  /** Umherlaufen im Radius (Kacheln) */
  wander?: number;
  dialog: string;
  /** nur sichtbar, wenn die Bedingung (Flag) gesetzt bzw. nicht gesetzt ist */
  showIf?: string;
  hideIf?: string;
}

const skins: Ramp[] = [RAMPS.skin, RAMPS.skinDark, [PAL.skinShade, PAL.skin, PAL.skinLight, PAL.white]];

function look(o: {
  hair: Ramp;
  style: HairStyle;
  cloth: Ramp;
  shirt?: Ramp;
  pants?: Ramp;
  accent?: Ramp;
  skin?: number;
  iris?: number;
  boots?: Ramp;
}): CharacterLook {
  return {
    ...PLAYER_LOOK,
    skin: skins[o.skin ?? 0],
    hair: o.hair,
    hairStyle: o.style,
    cloth: o.cloth,
    shirt: o.shirt ?? RAMPS.white,
    pants: o.pants ?? RAMPS.navy,
    boots: o.boots ?? RAMPS.leather,
    belt: RAMPS.gold,
    accent: o.accent,
    iris: o.iris ?? PAL.sky,
  };
}

export const NPCS: NpcDef[] = [
  // ------------------------------------------------------------------ Taufeld
  {
    id: 'lumi',
    name: 'Lumi',
    role: 'Hüterin des Ersten Tors',
    look: look({ hair: RAMPS.hairSilver, style: 'bun', cloth: RAMPS.violet, shirt: RAMPS.gold, pants: RAMPS.violet, iris: PAL.violet }),
    map: 'insel',
    town: 'taufeld',
    x: 3,
    y: -8,
    facing: 'down',
    dialog: 'lumi',
  },
  {
    id: 'wilma',
    name: 'Wilma',
    role: 'Krämerin',
    look: look({ hair: RAMPS.hairAuburn, style: 'bob', cloth: RAMPS.red, shirt: RAMPS.white, pants: RAMPS.wood, skin: 0 }),
    map: 'insel',
    town: 'taufeld',
    x: -9,
    y: -1,
    facing: 'down',
    dialog: 'wilma',
  },
  {
    id: 'hilde',
    name: 'Oma Hilde',
    role: 'Strickt für ganz Taufeld',
    look: look({ hair: RAMPS.hairSilver, style: 'bun', cloth: RAMPS.pink, shirt: RAMPS.white, pants: RAMPS.violet, skin: 2 }),
    map: 'insel',
    town: 'taufeld',
    x: 12,
    y: -1,
    facing: 'left',
    wander: 2,
    dialog: 'hilde',
  },
  {
    id: 'korbinian',
    name: 'Bauer Korbinian',
    look: look({ hair: RAMPS.hairBrown, style: 'short', cloth: RAMPS.green, shirt: RAMPS.sand, pants: RAMPS.wood, skin: 1 }),
    map: 'insel',
    town: 'taufeld',
    x: -13,
    y: 5,
    facing: 'right',
    wander: 3,
    dialog: 'korbinian',
  },
  {
    id: 'pia',
    name: 'Pia',
    role: 'Kind aus Taufeld',
    look: look({ hair: RAMPS.hairBlond, style: 'long', cloth: RAMPS.sky, shirt: RAMPS.white, pants: RAMPS.blue, skin: 2 }),
    map: 'insel',
    town: 'taufeld',
    x: 3,
    y: 5,
    wander: 4,
    dialog: 'pia',
  },
  {
    id: 'bodo',
    name: 'Bodo',
    role: 'Wirt des Gasthofs',
    look: look({ hair: RAMPS.hairBlack, style: 'short', cloth: RAMPS.orange, shirt: RAMPS.white, pants: RAMPS.leather, skin: 1 }),
    map: 'insel',
    town: 'taufeld',
    x: 3,
    y: 14,
    facing: 'down',
    dialog: 'bodo',
  },
  // ------------------------------------------------------------------ Runenhall
  {
    id: 'seraphine',
    name: 'Seraphine',
    role: 'Meisterin des Ordens der Siegel',
    look: look({ hair: RAMPS.hairViolet, style: 'long', cloth: RAMPS.navy, shirt: RAMPS.violet, pants: RAMPS.navy, iris: PAL.cyan, skin: 2 }),
    map: 'insel',
    town: 'runenhall',
    x: 3,
    y: -9,
    facing: 'down',
    dialog: 'seraphine',
  },
  {
    id: 'ambrosius',
    name: 'Ambrosius',
    role: 'Bibliothekar',
    look: look({ hair: RAMPS.hairSilver, style: 'short', cloth: RAMPS.wood, shirt: RAMPS.paper, pants: RAMPS.leather, skin: 0 }),
    map: 'insel',
    town: 'runenhall',
    x: -10,
    y: -5,
    facing: 'down',
    dialog: 'ambrosius',
  },
  {
    id: 'mirabell',
    name: 'Mirabell',
    role: 'Zauberladen „Zum blätternden Buch"',
    look: look({ hair: RAMPS.hairPink, style: 'bun', cloth: RAMPS.violet, shirt: RAMPS.gold, pants: RAMPS.violet, iris: PAL.magenta, skin: 0 }),
    map: 'insel',
    town: 'runenhall',
    x: 15,
    y: -4,
    facing: 'down',
    dialog: 'mirabell',
  },
  {
    id: 'salbeia',
    name: 'Salbeia',
    role: 'Kräuterladen',
    look: look({ hair: RAMPS.hairGreen, style: 'long', cloth: RAMPS.green, shirt: RAMPS.white, pants: RAMPS.wood, skin: 1 }),
    map: 'insel',
    town: 'runenhall',
    x: -15,
    y: 6,
    facing: 'down',
    dialog: 'salbeia',
  },
  {
    id: 'tobias',
    name: 'Tobias',
    role: 'Teestube',
    look: look({ hair: RAMPS.hairAuburn, style: 'spiky', cloth: RAMPS.teal, shirt: RAMPS.white, pants: RAMPS.navy, skin: 0 }),
    map: 'insel',
    town: 'runenhall',
    x: 14,
    y: 7,
    facing: 'down',
    dialog: 'tobias',
  },
  {
    id: 'ferdinand',
    name: 'Schuster Ferdinand',
    look: look({ hair: RAMPS.hairBrown, style: 'short', cloth: RAMPS.leather, shirt: RAMPS.sand, pants: RAMPS.wood, skin: 2 }),
    map: 'insel',
    town: 'runenhall',
    x: -1,
    y: 13,
    facing: 'down',
    dialog: 'ferdinand',
  },
  {
    id: 'ottokar',
    name: 'Ottokar',
    role: 'Tauschbörse',
    look: look({ hair: RAMPS.hairBlack, style: 'short', cloth: RAMPS.gold, shirt: RAMPS.white, pants: RAMPS.navy, skin: 1 }),
    map: 'insel',
    town: 'runenhall',
    x: 9,
    y: 14,
    facing: 'down',
    dialog: 'ottokar',
  },
  {
    id: 'gerda',
    name: 'Wachtmeisterin Gerda',
    look: look({ hair: RAMPS.hairAuburn, style: 'bun', cloth: RAMPS.blue, shirt: RAMPS.white, pants: RAMPS.navy, accent: RAMPS.gold, skin: 0 }),
    map: 'insel',
    town: 'runenhall',
    x: -5,
    y: 3,
    wander: 3,
    dialog: 'gerda',
  },
  {
    id: 'ludo',
    name: 'Ludo',
    role: 'Lehrling der Gilde',
    look: look({ hair: RAMPS.hairBlue, style: 'spiky', cloth: RAMPS.violet, shirt: RAMPS.white, pants: RAMPS.navy, skin: 2 }),
    map: 'insel',
    town: 'runenhall',
    x: 5,
    y: 4,
    wander: 4,
    dialog: 'ludo',
  },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/** Weitere Figuren (aus späteren Meilensteinen) registrieren */
export function registerNpcs(list: NpcDef[]): void {
  for (const n of list) {
    if (NPC_BY_ID[n.id]) continue;
    NPCS.push(n);
    NPC_BY_ID[n.id] = n;
  }
}
