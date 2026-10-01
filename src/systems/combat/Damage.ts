import type { Mods } from '../../data/aura';
import type { Stats } from '../../data/cardTypes';

export type MeleeKind = 0 | 1 | 2 | 'charge';

export interface Hit {
  dmg: number;
  crit: boolean;
}

/** Schaden eines Nahkampfschlags der Spielfigur */
export function meleeDamage(st: Stats, mods: Mods, kind: MeleeKind, focus: boolean, counter: boolean, rand = Math.random): Hit {
  let d = 6 + st.str * 1.4;
  if (kind === 1) d *= 1.1 + mods.combo * 0.5;
  else if (kind === 2) d *= 1.5 + mods.combo;
  else if (kind === 'charge') d *= 2.4 + mods.charge;
  d *= 1 + mods.dmg;
  if (focus) d *= 2;
  if (counter) d *= 1 + mods.counter;
  return roll(d, st, mods, rand);
}

/** Schaden eines Aura-Stosses */
export function stossDamage(st: Stats, mods: Mods, charge: number, focus: boolean, rand = Math.random): Hit {
  let d = (7 + st.ctrl * 2.2) * (1 + mods.stossDmg) * (1 + charge);
  if (focus) d *= 1.5;
  return roll(d, st, mods, rand);
}

/** Schaden der Spezialtechnik (Faktor je Affinität) */
export function specialDamage(st: Stats, mods: Mods, factor: number, rand = Math.random): Hit {
  const d = (8 + st.str * 0.8 + st.ctrl * 1.6) * factor * (1 + mods.specialPower);
  return roll(d, st, mods, rand);
}

function roll(d: number, st: Stats, mods: Mods, rand: () => number): Hit {
  const critChance = Math.min(0.6, 0.05 + st.luck * 0.02 + mods.crit);
  const crit = rand() < critChance;
  if (crit) d *= 1.8 + mods.critDmg;
  d *= 0.9 + rand() * 0.2;
  return { dmg: Math.max(1, Math.round(d)), crit };
}

/** Schaden, den die Spielfigur erleidet */
export function incomingDamage(atk: number, st: Stats, mods: Mods, shield: boolean, focus: boolean, rand = Math.random): number {
  let d = atk * (0.9 + rand() * 0.2);
  d *= 100 / (100 + st.def * 8);
  if (shield) d *= Math.max(0.1, 0.3 - mods.shield);
  if (focus) d *= 1.5;
  return Math.max(1, Math.round(d));
}

/** Schaden gegen ein Monster nach dessen Verteidigung */
export function afterDefense(dmg: number, def: number): number {
  return Math.max(1, Math.round(dmg - def * 0.5));
}
