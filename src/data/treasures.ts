import type { Rank } from './cardTypes';

/** Inhalt von Schatztruhen (Schlüssel = Truhen-Tag aus der Karte). */
export const TREASURES: Record<string, { cards: string[]; money?: number }> = {
  'testwiese:truhe-wald': { cards: ['091'] },
  'testwiese:truhe-see': { cards: ['084', '082'] },
  'testwiese:truhe-garten': { cards: ['026', 'Z13'], money: 150 },
  'testwiese:truhe-haus': { cards: ['014', '064'] },
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
