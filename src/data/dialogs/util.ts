import type { DialogCtx } from '../../systems/Dialog';
import { card } from '../cards';
import { worldHost } from '../../systems/WorldModules';
import type { MiniData } from '../../scenes/mini/MiniBase';

/** Hilfsfunktionen für Dialoge und Quests */
export const has = (c: DialogCtx, id: string, n = 1): boolean => c.g.countCard(id) >= n;

/** Karte geben, falls noch Exemplare existieren (sonst Trostpreis in Münzen) */
export function reward(c: DialogCtx, id: string): boolean {
  if (c.w.giveCard(id)) return true;
  const coins = 150;
  c.g.inv.money += coins;
  c.g.events.emit('vitals-changed');
  c.w.toast(`Alle Exemplare von „${card(id).name}" sind schon im Umlauf. Du erhältst ${coins} Münzen als Dank.`);
  return false;
}

/** Minispiel nach dem Gespräch starten */
export function mini(c: DialogCtx, key: string, data: MiniData = {}): void {
  c.w.after(() => c.w.openScene(key, data));
}

export const stage = (c: DialogCtx, q: string): number => c.g.quests.stage(q);
export const setStage = (c: DialogCtx, q: string, s: number): void => c.g.quests.set(q, s);

/** Nächster Tag mit Sturmnacht (jede dritte Nacht) */
export function nextStormDay(day: number): number {
  let d = day;
  while (d % 3 !== 2) d++;
  return d;
}

export { worldHost };
