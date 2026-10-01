import type { Rank } from './cardTypes';

export interface ShopItem {
  card: string;
  price: number;
}

export interface ShopDef {
  id: string;
  name: string;
  /** Figur für Portrait und Begrüssung */
  keeper: string;
  greeting: string;
  items: ShopItem[];
  /** Siegelpack (3 zufällige Zauber) */
  pack?: number;
  /** kauft Karten an */
  buys?: boolean;
  /** Währung */
  currency?: 'muenzen' | 'chips';
  /** Rabatt mit dieser Karte im Besitz (z. B. Gildensiegel) */
  discount?: { card: string; percent: number };
}

export const SHOPS: Record<string, ShopDef> = {
  'taufeld:kraemerin': {
    id: 'taufeld:kraemerin',
    name: 'Wilmas Krämerladen',
    keeper: 'wilma',
    greeting: 'Hereinspaziert! Für Abenteuer braucht man das Richtige im Gepäck.',
    items: [
      { card: '095', price: 30 },
      { card: '096', price: 20 },
      { card: '085', price: 80 },
      { card: '082', price: 250 },
      { card: '084', price: 300 },
    ],
    buys: true,
  },
  'taufeld:gasthof': {
    id: 'taufeld:gasthof',
    name: 'Gasthof „Zum Ersten Tor"',
    keeper: 'bodo',
    greeting: 'Frisch aus dem Ofen! Und das Zimmer oben ist auch frei.',
    items: [
      { card: '096', price: 20 },
      { card: '095', price: 32 },
    ],
  },
  'runenhall:kraeuter': {
    id: 'runenhall:kraeuter',
    name: 'Salbeias Kräuterladen',
    keeper: 'salbeia',
    greeting: 'Jedes Kraut hat seine Zeit. Was suchst du?',
    items: [
      { card: '095', price: 30 },
      { card: '064', price: 120 },
      { card: '085', price: 80 },
    ],
  },
  'runenhall:teestube': {
    id: 'runenhall:teestube',
    name: 'Teestube „Zum stillen Kessel"',
    keeper: 'tobias',
    greeting: 'Ein Auratee wärmt Herz und Aura. Setz dich!',
    items: [
      { card: '074', price: 90 },
      { card: '096', price: 20 },
    ],
  },
  'runenhall:zauberladen': {
    id: 'runenhall:zauberladen',
    name: 'Zauberladen „Zum blätternden Buch"',
    keeper: 'mirabell',
    greeting: 'Siegelpacks! Drei versiegelte Zauber – welche, weiss nur das Siegel selbst.',
    items: [],
    pack: 150,
    discount: { card: '016', percent: 30 },
  },
  'runenhall:tauschboerse': {
    id: 'runenhall:tauschboerse',
    name: 'Tauschbörse',
    keeper: 'ottokar',
    greeting: 'Ich kaufe Karten aus deinen freien Slots – zu fairen Preisen. Meistens.',
    items: [],
    buys: true,
  },
  'moewenhafen:hafenladen': {
    id: 'moewenhafen:hafenladen',
    name: 'Hafenladen',
    keeper: 'hafenhaendlerin',
    greeting: 'Taue, Haken, Angeln – alles, was ein Seebär braucht.',
    items: [
      { card: '095', price: 30 },
      { card: '085', price: 80 },
      { card: '083', price: 350 },
      { card: '092', price: 400 },
      { card: '075', price: 650 },
    ],
    buys: true,
  },
  'moewenhafen:fisch': {
    id: 'moewenhafen:fisch',
    name: 'Fischstand',
    keeper: 'fischer',
    greeting: 'Frischer Fang! Na ja – gestern frisch.',
    items: [{ card: '096', price: 22 }],
  },
  'wuerfelheim:schwarzhaendler': {
    id: 'wuerfelheim:schwarzhaendler',
    name: 'Hinterhof-Handel',
    keeper: 'schwarzhaendler',
    greeting: 'Psst. Nicht so laut. Was darf es sein?',
    items: [
      { card: '063', price: 900 },
      { card: '085', price: 70 },
    ],
    buys: true,
  },
  'wuerfelheim:preisladen': {
    id: 'wuerfelheim:preisladen',
    name: 'Preisladen (Chips)',
    keeper: 'preisdame',
    greeting: 'Gewinne in Chips? Hier werden sie zu Schätzen!',
    items: [
      { card: '036', price: 5000 },
      { card: '074', price: 300 },
      { card: '064', price: 400 },
    ],
    currency: 'chips',
  },
  'hohenkamm:huette': {
    id: 'hohenkamm:huette',
    name: 'Berghütte',
    keeper: 'huettenwirt',
    greeting: 'Komm rein, hier ist es warm. Suppe? Seil? Beides?',
    items: [
      { card: '096', price: 25 },
      { card: '092', price: 380 },
      { card: '064', price: 130 },
    ],
  },
  'sandspiegel:basar': {
    id: 'sandspiegel:basar',
    name: 'Basar von Sandspiegel',
    keeper: 'basarhaendler',
    greeting: 'Willkommen, Wanderer! Wasser ist teuer, Rätsel sind gratis.',
    items: [
      { card: '095', price: 35 },
      { card: '064', price: 125 },
      { card: '085', price: 85 },
    ],
    buys: true,
  },
  'rosenweil:kraemer': {
    id: 'rosenweil:kraemer',
    name: 'Rosenweiler Krämer',
    keeper: 'rosenkraemer',
    greeting: 'Netze für Falter, Brot für Verliebte. Was darf es sein?',
    items: [
      { card: '095', price: 30 },
      { card: '096', price: 20 },
      { card: '073', price: 500 },
    ],
  },
};

/** Ankaufspreis nach Rang */
export const SELL_PRICE: Record<Rank, number> = { SS: 3000, S: 1500, A: 800, B: 400, C: 200, D: 100, E: 60, F: 40, G: 25, H: 10 };

/** Ziehwahrscheinlichkeiten im Siegelpack */
export const PACK_WEIGHTS: Partial<Record<Rank, number>> = { F: 28, E: 30, D: 22, C: 12, B: 6, A: 1.6, S: 0.4 };
