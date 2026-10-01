import { PAL } from '../gfx/palette';
import type { Stats } from './cardTypes';

/**
 * Aura-System: Techniken, Affinitäten, Fähigkeitskarten (Level-Up) und Talentbäume.
 * Alles datengetrieben – Werte für das Balancing stehen hier.
 */

export type TechniqueId = 'sinn' | 'stoss' | 'schild' | 'fokus' | 'spezial';
export type AffinityId = 'wurzel' | 'stroemung' | 'echo' | 'faden' | 'spiegel';

export interface TechniqueDef {
  id: TechniqueId;
  name: string;
  short: string;
  text: string;
  /** einmalige Kosten */
  cost: number;
  /** Verbrauch pro Sekunde (Dauertechniken) */
  drain: number;
  unlock: number;
  /** Position im Aura-Rad (Grad, 0 = rechts, gegen den Uhrzeigersinn) */
  angle: number;
  icon: number;
}

export const TECHNIQUES: TechniqueDef[] = [
  { id: 'sinn', name: 'Aura-Sinn', short: 'Sinn', text: 'Macht Verborgenes sichtbar: getarnte Monster, versteckte Karten, Fallen.', cost: 0, drain: 2.5, unlock: 1, angle: 90, icon: 0 },
  { id: 'stoss', name: 'Aura-Stoss', short: 'Stoss', text: 'Fernangriff aus reiner Aura. Gedrückt halten lädt ihn auf.', cost: 12, drain: 0, unlock: 1, angle: 18, icon: 1 },
  { id: 'spezial', name: 'Spezialtechnik', short: 'Spezial', text: 'Deine eigene Technik – sie hängt von deiner Affinität ab.', cost: 40, drain: 0, unlock: 5, angle: -54, icon: 4 },
  { id: 'schild', name: 'Aura-Schild', short: 'Schild', text: 'Hüllt dich in Aura: Schaden stark verringert, hoher Dauerverbrauch.', cost: 0, drain: 13, unlock: 2, angle: -126, icon: 2 },
  { id: 'fokus', name: 'Fokus', short: 'Fokus', text: 'Bündelt Aura in den Fäusten: doppelter Schaden – aber du bist ungeschützt.', cost: 25, drain: 0, unlock: 3, angle: 162, icon: 3 },
];

export const TECH_BY_ID = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<TechniqueId, TechniqueDef>;

export interface AffinityDef {
  id: AffinityId;
  name: string;
  color: number;
  style: string;
  special: string;
  specialText: string;
  /** Namensvorschlag für die Spezialtechnik */
  defaultName: string;
}

export const AFFINITIES: AffinityDef[] = [
  { id: 'wurzel', name: 'Wurzel', color: PAL.grass, style: 'Standfest, schwere Schläge, Verteidigung', special: 'Bodenstampfer', specialText: 'Ein Stampfer lässt Wurzeln aus dem Boden schiessen: Gegner im Umkreis werden festgehalten und verletzt.', defaultName: 'Wurzelgriff' },
  { id: 'stroemung', name: 'Strömung', color: PAL.cyan, style: 'Tempo, Combos, Ausweichen', special: 'Blitzkette', specialText: 'Du springst blitzschnell von Gegner zu Gegner – bis zu fünf Treffer in einer Kette.', defaultName: 'Wellensprung' },
  { id: 'echo', name: 'Echo', color: PAL.violet, style: 'Fernkampf mit dem Aura-Stoss', special: 'Widerhall', specialText: 'Ein Stoss, der an Wänden abprallt und mit jedem Abprall stärker wird.', defaultName: 'Hallschuss' },
  { id: 'faden', name: 'Faden', color: PAL.gold, style: 'Kontrolle und Fallen', special: 'Aura-Netz', specialText: 'Ein Netz aus Aura: Gegner darin werden langsam, herumliegende Karten fliegen zu dir.', defaultName: 'Goldgespinst' },
  { id: 'spiegel', name: 'Spiegel', color: PAL.pink, style: 'List, Täuschung, Konter', special: 'Spiegelbild', specialText: 'Ein Spiegelbild zieht Angriffe auf sich und explodiert, wenn es zerspringt.', defaultName: 'Glasdoppel' },
];

export const AFFINITY_BY_ID = Object.fromEntries(AFFINITIES.map((a) => [a.id, a])) as Record<AffinityId, AffinityDef>;

/** Kampf-Modifikatoren aus Talenten und Fähigkeitskarten */
export interface Mods {
  dmg: number;
  crit: number;
  critDmg: number;
  charge: number;
  combo: number;
  knockback: number;
  stossDmg: number;
  stossCost: number;
  bounce: number;
  shield: number;
  shieldCost: number;
  sense: number;
  specialPower: number;
  specialCost: number;
  rollDist: number;
  iframes: number;
  thorns: number;
  lifesteal: number;
  speed: number;
  auraRegen: number;
  chain: number;
  root: number;
  decoy: number;
  counter: number;
  specialHeal: number;
  rollAura: number;
  magnet: number;
}

export function emptyMods(): Mods {
  return {
    dmg: 0, crit: 0, critDmg: 0, charge: 0, combo: 0, knockback: 0, stossDmg: 0, stossCost: 0, bounce: 0, shield: 0, shieldCost: 0, sense: 0,
    specialPower: 0, specialCost: 0, rollDist: 0, iframes: 0, thorns: 0, lifesteal: 0, speed: 0, auraRegen: 0, chain: 0, root: 0, decoy: 0,
    counter: 0, specialHeal: 0, rollAura: 0, magnet: 0,
  };
}

export type CardColor = 'rot' | 'gruen' | 'blau' | 'gold';

export const CARD_COLOR_STYLE: Record<CardColor, { name: string; color: number; ramp: 'red' | 'green' | 'blue' | 'gold' }> = {
  rot: { name: 'Stärke', color: PAL.red, ramp: 'red' },
  gruen: { name: 'Tempo', color: PAL.grass, ramp: 'green' },
  blau: { name: 'Aura', color: PAL.sky, ramp: 'blue' },
  gold: { name: 'Talent', color: PAL.gold, ramp: 'gold' },
};

export interface AbilityCard {
  id: string;
  color: CardColor;
  name: string;
  text: string;
  stats?: Partial<Stats>;
  mods?: Partial<Mods>;
  /** Talent: Affinität, Zweig, Stufe */
  talent?: { affinity: AffinityId; branch: number; tier: number };
  /** Symbol (siehe ui.abilityIcons) */
  icon: number;
}

export const ABILITY_CARDS: AbilityCard[] = [
  { id: 'r-kraft', color: 'rot', name: 'Kraftprobe', text: 'Stärke +1', stats: { str: 1 }, icon: 0 },
  { id: 'r-haut', color: 'rot', name: 'Eisenhaut', text: 'Verteidigung +1', stats: { def: 1 }, icon: 1 },
  { id: 'r-leben', color: 'rot', name: 'Lebenskraft', text: 'Max. LP +15', stats: { lp: 15 }, icon: 2 },
  { id: 'r-wucht', color: 'rot', name: 'Wucht', text: 'Rückstoss +30 %, Aufladeschlag +15 %', mods: { knockback: 0.3, charge: 0.15 }, icon: 3 },
  { id: 'r-combo', color: 'rot', name: 'Schlagfolge', text: 'Combo-Treffer +15 % Schaden', mods: { combo: 0.15 }, icon: 3 },
  { id: 'g-tempo', color: 'gruen', name: 'Flinke Füsse', text: 'Tempo +1', stats: { spd: 1 }, icon: 4 },
  { id: 'g-rolle', color: 'gruen', name: 'Weite Rolle', text: 'Ausweichrolle 15 % weiter', mods: { rollDist: 0.15 }, icon: 5 },
  { id: 'g-glueck', color: 'gruen', name: 'Glückspilz', text: 'Glück +1 (kritische Treffer, Karten)', stats: { luck: 1 }, icon: 6 },
  { id: 'g-reflex', color: 'gruen', name: 'Reflexe', text: 'Längere Unverwundbarkeit beim Ausweichen', mods: { iframes: 0.06 }, icon: 5 },
  { id: 'b-brunnen', color: 'blau', name: 'Aura-Brunnen', text: 'Max. Aura +15', stats: { aura: 15 }, icon: 7 },
  { id: 'b-kontrolle', color: 'blau', name: 'Kontrolle', text: 'Aura-Kontrolle +1 (Regeneration, Aura-Schaden)', stats: { ctrl: 1 }, icon: 8 },
  { id: 'b-ruhe', color: 'blau', name: 'Ruhige Hand', text: 'Aura-Stoss kostet 15 % weniger', mods: { stossCost: 0.15 }, icon: 9 },
  { id: 'b-sinne', color: 'blau', name: 'Scharfe Sinne', text: 'Aura-Sinn reicht weiter, verbraucht weniger', mods: { sense: 30 }, icon: 9 },
];

type TalentRow = [name: string, text: string, stats: Partial<Stats> | null, mods: Partial<Mods> | null];

/** Talentbäume: je Affinität 3 Zweige × 4 Stufen */
export const TALENT_TREES: Record<AffinityId, { branch: string; tiers: TalentRow[] }[]> = {
  wurzel: [
    { branch: 'Standfest', tiers: [
      ['Fester Stand', 'Verteidigung +1', { def: 1 }, null],
      ['Rindenhaut', 'Aura-Schild verbraucht 25 % weniger', null, { shieldCost: 0.25 }],
      ['Felsenherz', 'Verteidigung +2', { def: 2 }, null],
      ['Dornenborke', '30 % des Nahkampfschadens prallen zurück', null, { thorns: 0.3 }],
    ] },
    { branch: 'Erdhieb', tiers: [
      ['Schwere Hand', 'Schaden +10 %', null, { dmg: 0.1 }],
      ['Erdstoss', 'Rückstoss +40 %', null, { knockback: 0.4 }],
      ['Bergschlag', 'Aufladeschlag +40 %', null, { charge: 0.4 }],
      ['Tiefe Wurzeln', 'Spezialtechnik hält 1,5 s länger fest', null, { root: 1.5, specialPower: 0.2 }],
    ] },
    { branch: 'Lebensbaum', tiers: [
      ['Saftstrom', 'Max. LP +20', { lp: 20 }, null],
      ['Wurzelkraft', 'Regeneration +1', { regen: 1 }, null],
      ['Nährboden', 'Treffer heilen 5 % des Schadens', null, { lifesteal: 0.05 }],
      ['Frühlingsruf', 'Spezialtechnik heilt 25 LP', null, { specialHeal: 25 }],
    ] },
  ],
  stroemung: [
    { branch: 'Tempo', tiers: [
      ['Leichtfuss', 'Tempo +1', { spd: 1 }, null],
      ['Gleiten', 'Ausweichrolle 20 % weiter', null, { rollDist: 0.2 }],
      ['Sturzbach', 'Laufgeschwindigkeit +10 %', null, { speed: 0.1 }],
      ['Nebelschritt', 'Längere Unverwundbarkeit beim Ausweichen', null, { iframes: 0.1 }],
    ] },
    { branch: 'Kette', tiers: [
      ['Wellenschlag', 'Combo-Treffer +15 % Schaden', null, { combo: 0.15 }],
      ['Scharfe Strömung', 'Kritische Treffer +5 %', null, { crit: 0.05 }],
      ['Lange Kette', 'Blitzkette springt 1× öfter', null, { chain: 1 }],
      ['Sturzflut', 'Blitzkette springt 2× öfter, +20 % Schaden', null, { chain: 2, specialPower: 0.2 }],
    ] },
    { branch: 'Fluss', tiers: [
      ['Quelle', 'Aura-Regeneration +25 %', null, { auraRegen: 0.25 }],
      ['Strudel', 'Aura-Stoss kostet 20 % weniger', null, { stossCost: 0.2 }],
      ['Rückfluss', 'Jede Ausweichrolle gibt 5 Aura zurück', null, { rollAura: 5 }],
      ['Meeresruhe', 'Spezialtechnik kostet 25 % weniger', null, { specialCost: 0.25 }],
    ] },
  ],
  echo: [
    { branch: 'Resonanz', tiers: [
      ['Klangkörper', 'Aura-Stoss +20 % Schaden', null, { stossDmg: 0.2 }],
      ['Verstärker', 'Aura-Stoss +20 % Schaden', null, { stossDmg: 0.2 }],
      ['Abpraller', 'Aura-Stoss prallt 1× an Wänden ab', null, { bounce: 1 }],
      ['Donnerhall', 'Widerhall prallt 2× öfter ab', null, { bounce: 2, specialPower: 0.2 }],
    ] },
    { branch: 'Hall', tiers: [
      ['Leichter Ton', 'Aura-Stoss kostet 20 % weniger', null, { stossCost: 0.2 }],
      ['Treffsicher', 'Kritische Treffer +5 %', null, { crit: 0.05 }],
      ['Schrill', 'Kritischer Schaden +50 %', null, { critDmg: 0.5 }],
      ['Fernhall', 'Aura-Kontrolle +2', { ctrl: 2 }, null],
    ] },
    { branch: 'Klangschild', tiers: [
      ['Dämpfer', 'Aura-Schild schützt 10 % besser', null, { shield: 0.1 }],
      ['Lauscher', 'Aura-Sinn reicht 40 px weiter', null, { sense: 40 }],
      ['Nachklang', 'Aura-Regeneration +20 %', null, { auraRegen: 0.2 }],
      ['Grosses Echo', 'Spezialtechnik +30 % Schaden', null, { specialPower: 0.3 }],
    ] },
  ],
  faden: [
    { branch: 'Netz', tiers: [
      ['Feine Fäden', 'Spezialtechnik +25 % Wirkung', null, { specialPower: 0.25 }],
      ['Klebrig', 'Netz hält 1 s länger', null, { root: 1 }],
      ['Kartenfänger', 'Karten fliegen aus grösserer Entfernung zu dir', null, { magnet: 30 }],
      ['Goldenes Netz', 'Spezialtechnik kostet 25 % weniger', null, { specialCost: 0.25 }],
    ] },
    { branch: 'Falle', tiers: [
      ['Stolperdraht', 'Rückstoss +30 %', null, { knockback: 0.3 }],
      ['Stachelfaden', '15 % des Nahkampfschadens prallen zurück', null, { thorns: 0.15 }],
      ['Schlinge', 'Kritische Treffer +6 %', null, { crit: 0.06 }],
      ['Fadenschlag', 'Schaden +15 %', null, { dmg: 0.15 }],
    ] },
    { branch: 'Spinner', tiers: [
      ['Geduld', 'Aura-Regeneration +25 %', null, { auraRegen: 0.25 }],
      ['Glücksfaden', 'Glück +1', { luck: 1 }, null],
      ['Feinsinn', 'Aura-Kontrolle +1', { ctrl: 1 }, null],
      ['Schicksalsfaden', 'Glück +2', { luck: 2 }, null],
    ] },
  ],
  spiegel: [
    { branch: 'Trug', tiers: [
      ['Zerrbild', 'Spiegelbild hält 2 s länger', null, { decoy: 2 }],
      ['Splitter', 'Spiegelbild-Explosion +40 %', null, { specialPower: 0.4 }],
      ['Doppelgänger', 'Spiegelbild hält weitere 2 s', null, { decoy: 2 }],
      ['Scherbensturm', 'Spezialtechnik kostet 25 % weniger', null, { specialCost: 0.25 }],
    ] },
    { branch: 'Konter', tiers: [
      ['Ausweichkunst', 'Nach einer Rolle: nächster Treffer +60 %', null, { counter: 0.6 }],
      ['Scharfer Blick', 'Kritische Treffer +8 %', null, { crit: 0.08 }],
      ['Gegenschlag', 'Kritischer Schaden +50 %', null, { critDmg: 0.5 }],
      ['Spiegeltanz', 'Längere Unverwundbarkeit beim Ausweichen', null, { iframes: 0.1 }],
    ] },
    { branch: 'Glanz', tiers: [
      ['Funkeln', 'Glück +1', { luck: 1 }, null],
      ['Klarsicht', 'Aura-Sinn reicht 30 px weiter', null, { sense: 30 }],
      ['Glanzlicht', 'Aura-Regeneration +20 %', null, { auraRegen: 0.2 }],
      ['Prisma', 'Tempo +1, Aura-Kontrolle +1', { spd: 1, ctrl: 1 }, null],
    ] },
  ],
};

/** Talent als Fähigkeitskarte */
export function talentCard(affinity: AffinityId, branch: number, tier: number): AbilityCard {
  const row = TALENT_TREES[affinity][branch].tiers[tier];
  return {
    id: `t-${affinity}-${branch}-${tier}`,
    color: 'gold',
    name: row[0],
    text: `${TALENT_TREES[affinity][branch].branch} ${tier + 1}/4: ${row[1]}`,
    stats: row[2] ?? undefined,
    mods: row[3] ?? undefined,
    talent: { affinity, branch, tier },
    icon: 10 + branch,
  };
}

/** Werte, die automatisch mit jeder Stufe steigen */
export const LEVEL_GROWTH: Partial<Stats> = { lp: 6, aura: 4 };
