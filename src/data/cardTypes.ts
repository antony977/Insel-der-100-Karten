import type { RampName } from '../gfx/palette';

/** Kartenränge von selten (SS) bis häufig (H). */
export const RANKS = ['SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type Rank = (typeof RANKS)[number];

export type CardKind = 'sammel' | 'zauber';
export type SpellCategory = 'angriff' | 'abwehr' | 'bewegung' | 'info';
export type SpellRange = 'selbst' | '20m' | 'fern' | 'insel';

/** Werte der Spielfigur (Ausrüstung addiert sich). */
export interface Stats {
  lp: number;
  aura: number;
  str: number;
  spd: number;
  ctrl: number;
  def: number;
  luck: number;
  regen: number;
  dodge: number;
}

export type EquipSlot = 'kopf' | 'koerper' | 'fuesse' | 'schmuck';

/** Was aus einer Karte wird, wenn sie entfesselt wird (oder sich nach 60 s verwandelt). */
export type ItemEffect =
  | { kind: 'heal'; lp: number }
  | { kind: 'aura'; aura: number }
  | { kind: 'restore' }
  | { kind: 'perma'; stats: Partial<Stats> }
  | { kind: 'equip'; slot: EquipSlot; stats: Partial<Stats> }
  | { kind: 'tool'; tool: string }
  | { kind: 'key'; key: string }
  | { kind: 'money'; amount: number }
  | { kind: 'chips'; amount: number }
  | { kind: 'buff'; buff: string; seconds: number }
  | { kind: 'companion'; monster: string }
  | { kind: 'wonder'; wonder: string }
  | { kind: 'throw'; item: string }
  | { kind: 'trade'; value: number }
  | { kind: 'spell' };

/** Parameter für das per Code erzeugte Karten-Artwork. */
export interface CardArt {
  /** Symbol-Schablone (siehe gfx/generators/cardIcons.ts) */
  icon: string;
  c1: RampName;
  c2?: RampName;
  c3?: RampName;
}

export interface CardDef {
  /** '000'–'099' für Sammelkarten, 'Z01'–'Z40' für Zauber */
  id: string;
  no: number;
  kind: CardKind;
  name: string;
  rank: Rank;
  /** maximale Anzahl Exemplare auf der ganzen Insel */
  limit: number;
  type: string;
  /** Beschreibung (Flair) */
  text: string;
  /** Wirkung als Text */
  effect: string;
  /** Hinweis, wie man die Karte bekommt */
  hint: string;
  art: CardArt;
  unleash: ItemEffect;
  spell?: { category: SpellCategory; range: SpellRange; questOnly?: boolean };
}

/** Rangfarben + Symbol (Farbe wird nie allein zur Unterscheidung genutzt). */
export const RANK_STYLE: Record<Rank, { ramp: RampName; symbol: string; label: string }> = {
  SS: { ramp: 'white', symbol: 'doppelraute', label: 'SS' },
  S: { ramp: 'gold', symbol: 'raute', label: 'S' },
  A: { ramp: 'red', symbol: 'stern', label: 'A' },
  B: { ramp: 'violet', symbol: 'mond', label: 'B' },
  C: { ramp: 'blue', symbol: 'tropfen', label: 'C' },
  D: { ramp: 'green', symbol: 'blatt', label: 'D' },
  E: { ramp: 'teal', symbol: 'welle', label: 'E' },
  F: { ramp: 'orange', symbol: 'kreis', label: 'F' },
  G: { ramp: 'wood', symbol: 'quadrat', label: 'G' },
  H: { ramp: 'grey', symbol: 'punkt', label: 'H' },
};

export const SPELL_CATEGORY_STYLE: Record<SpellCategory, { name: string; ramp: RampName }> = {
  angriff: { name: 'Angriffszauber', ramp: 'red' },
  abwehr: { name: 'Abwehrzauber', ramp: 'teal' },
  bewegung: { name: 'Bewegungszauber', ramp: 'gold' },
  info: { name: 'Informationszauber', ramp: 'violet' },
};

export const RANGE_LABEL: Record<SpellRange, string> = {
  selbst: 'Selbst',
  '20m': '20 m',
  fern: 'Fern (begegnet)',
  insel: 'Ganze Insel',
};
