import type { Rank } from './cardTypes';

/** Inhalt von Schatztruhen (Schlüssel = Truhen-Tag aus der Karte). */
export const TREASURES: Record<string, { cards: string[]; money?: number }> = {
  'testwiese:truhe-wald': { cards: ['091'] },
  'testwiese:truhe-see': { cards: ['084', '082'] },
  'testwiese:truhe-garten': { cards: ['026', 'Z13'], money: 150 },
  'testwiese:truhe-haus': { cards: ['014', '064'] },
  // Insel
  'truhe:seeinsel': { cards: ['Z37', 'Z19'], money: 300 },
  // Dungeons
  'truhe:glimmerhoehle': { cards: ['Z36', '071'], money: 200 },
  'truhe:grotte:1': { cards: ['Z16'], money: 250 },
  'truhe:grotte:2': { cards: ['Z28', '064'], money: 200 },
  'truhe:grotte:3': { cards: ['Z22'], money: 400 },
  'truhe:oase': { cards: ['Z30', 'Z14'], money: 400 },
  'truhe:nebelherz': { cards: ['Z17', 'Z33'], money: 300 },
  'truhe:adlerhorst': { cards: ['Z29', '092'], money: 250 },
  'truhe:labyrinth:1': { cards: ['Z04'], money: 500 },
  'truhe:labyrinth:2': { cards: ['Z16', '064'], money: 500 },
  'truhe:labyrinth:3': { cards: ['Z22'], money: 600 },
};

/** Wunschbrunnen: Münze einwerfen → zufällige Karte (gewichtete Ränge). */
export const WISHING_WELL = {
  cost: 10,
  weights: { H: 46, G: 28, F: 14, E: 7, D: 3, C: 2 } as Partial<Record<Rank, number>>,
  /** Anteil Zauberkarten */
  spellChance: 0.15,
};

/** Startgeschenk von Lumi */
export const STARTER_CARDS = ['095', 'Z25', '093'];
