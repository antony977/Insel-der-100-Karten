import { Game, RIVAL_NAMES } from './GameState';
import { NPC_BY_ID } from '../data/npcs';
import { TOWNS } from '../data/world/layout';
import { SAMMELKARTEN, ZAUBERKARTEN } from '../data/cards';
import type { Rank } from '../data/cardTypes';
import { registerNpcRule } from './npcRules';
import type { RivalState } from './Rivals';
import { TILE } from '../config';

/**
 * Die KI-Rivalen: Sie sammeln im Lauf der Spieltage selbst Karten (die globalen Limits
 * gelten auch für sie), ziehen zwischen Städten umher und lassen sich ansprechen.
 * Damit niemand blockiert wird, nimmt ein Rivale nie das letzte freie Exemplar einer Karte.
 */
export type Attitude = 'freundlich' | 'neutral' | 'gefaehrlich';

export interface RivalDef {
  id: string;
  name: string;
  attitude: Attitude;
  /** Karten pro Spieltag */
  rate: number;
  /** höchstens so viele Sammelseiten */
  cap: number;
  /** Aufenthaltsorte (Stadt + Kachelversatz), wechseln alle 6 Spielstunden */
  hangouts: { town: string; x: number; y: number }[];
  /** NPC in der Welt (sonst unsichtbar, z. B. Handlanger) */
  npc?: string;
}

export const RIVALS: RivalDef[] = [
  { id: 'mila', name: 'Mila Sturmfeder', attitude: 'freundlich', rate: 2, cap: 62, npc: 'rivale-mila', hangouts: [{ town: 'moewenhafen', x: 3, y: -2 }, { town: 'taufeld', x: -4, y: 4 }, { town: 'runenhall', x: -8, y: 2 }] },
  { id: 'bruno', name: 'Bruno Kessel', attitude: 'freundlich', rate: 1.8, cap: 58, npc: 'rivale-bruno', hangouts: [{ town: 'hohenkamm', x: 2, y: 4 }, { town: 'wuerfelheim', x: -4, y: 4 }, { town: 'taufeld', x: 4, y: -5 }] },
  { id: 'frida', name: 'Frida Funkel', attitude: 'freundlich', rate: 1.6, cap: 60, npc: 'rivale-frida', hangouts: [{ town: 'sandspiegel', x: -3, y: 3 }, { town: 'runenhall', x: 4, y: 8 }, { town: 'rosenweil', x: -3, y: -3 }] },
  { id: 'juna', name: 'Juna Tannwald', attitude: 'freundlich', rate: 1.4, cap: 50, npc: 'rivale-juna', hangouts: [{ town: 'rosenweil', x: 4, y: 2 }, { town: 'taufeld', x: 5, y: 2 }, { town: 'moewenhafen', x: -2, y: 5 }] },
  { id: 'lio', name: 'Lio Tannwald', attitude: 'freundlich', rate: 1.4, cap: 50, npc: 'rivale-lio', hangouts: [{ town: 'rosenweil', x: 6, y: 2 }, { town: 'taufeld', x: 6, y: 3 }, { town: 'moewenhafen', x: -1, y: 6 }] },
  { id: 'tjark', name: 'Tjark Wellenbrecher', attitude: 'neutral', rate: 1.5, cap: 55, npc: 'rivale-tjark', hangouts: [{ town: 'moewenhafen', x: 6, y: 3 }, { town: 'wuerfelheim', x: 5, y: 5 }] },
  { id: 'kasimir', name: 'Kasimir Glanz', attitude: 'neutral', rate: 1.2, cap: 45, hangouts: [{ town: 'wuerfelheim', x: 4, y: -2 }] },
  { id: 'varga', name: 'Varga Aschenherz', attitude: 'gefaehrlich', rate: 3, cap: 85, npc: 'rivale-varga', hangouts: [{ town: 'runenhall', x: 2, y: 3 }] },
  { id: 'nox', name: 'Nox', attitude: 'gefaehrlich', rate: 2.4, cap: 70, hangouts: [{ town: 'rosenweil', x: 0, y: -20 }] },
  { id: 'vesper', name: 'Vesper', attitude: 'gefaehrlich', rate: 2.2, cap: 70, hangouts: [{ town: 'wuerfelheim', x: 16, y: 10 }] },
  { id: 'grell', name: 'Grell', attitude: 'gefaehrlich', rate: 2, cap: 70, hangouts: [{ town: 'hohenkamm', x: 14, y: 10 }] },
];

export const RIVAL_BY_ID: Record<string, RivalDef> = Object.fromEntries(RIVALS.map((r) => [r.id, r]));
for (const r of RIVALS) RIVAL_NAMES[r.id] = r.name;

/** Ränge, die ein Rivale je nach Spieltag findet */
function rankWeights(day: number): Partial<Record<Rank, number>> {
  if (day < 3) return { H: 40, G: 30, F: 20, E: 10 };
  if (day < 6) return { H: 15, G: 20, F: 22, E: 20, D: 15, C: 8 };
  if (day < 10) return { G: 10, F: 15, E: 18, D: 22, C: 18, B: 12, A: 5 };
  return { F: 8, E: 12, D: 18, C: 22, B: 20, A: 14, S: 5, SS: 1 };
}

function pickRank(day: number, rnd: () => number): Rank {
  const w = rankWeights(day);
  const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
  let r = rnd() * total;
  for (const [k, v] of Object.entries(w) as [Rank, number][]) {
    r -= v;
    if (r <= 0) return k;
  }
  return 'H';
}

/** Rivale nimmt eine Karte – nie das letzte freie Exemplar */
function acquire(r: RivalState, def: RivalDef, rnd: () => number): boolean {
  if (r.book.sammel.size >= def.cap) return false;
  const rank = pickRank(Game.day, rnd);
  // gelegentlich ein Zauber
  const pool = rnd() < 0.18 ? ZAUBERKARTEN.filter((z) => !z.spell?.questOnly) : SAMMELKARTEN.filter((c) => c.rank === rank);
  const options = pool.filter((c) => Game.registry.remaining(c.id) >= 2 && !(c.kind === 'sammel' && r.book.sammel.has(c.no)));
  if (!options.length) return false;
  const c = options[Math.floor(rnd() * options.length)];
  const inst = Game.registry.create(c.id, r.id);
  if (!inst) return false;
  Game.rivals.receive(r, inst.uid, Game.registry);
  return true;
}

/** Rivalen anlegen (neues Spiel oder alter Spielstand ohne Rivalen) */
export function ensureRivals(): void {
  for (const def of RIVALS) {
    if (Game.rivals.get(def.id)) continue;
    const h = def.hangouts[0];
    const town = TOWNS.find((t) => t.id === h.town);
    const st: RivalState = {
      id: def.id,
      name: def.name,
      met: false,
      ally: false,
      hostile: def.attitude === 'gefaehrlich',
      map: 'insel',
      x: ((town?.x ?? 0) + h.x) * TILE + 8,
      y: ((town?.y ?? 0) + h.y) * TILE + 12,
      book: { sammel: new Map(), frei: [] },
      buffs: new Map(),
      trackedUntil: 0,
      money: 300,
    };
    Game.rivals.list.push(st);
    let seed = def.id.length * 977 + Game.day;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const start = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < start; i++) acquire(st, def, rnd);
  }
  placeRivals();
}

/** Aufenthaltsort nach Tageszeit */
export function hangoutOf(def: RivalDef): { town: string; x: number; y: number } {
  const slot = Math.floor((Game.day * 24 + Game.clock / 60) / 6);
  const n = def.hangouts.length;
  return def.hangouts[(slot + def.id.length) % n];
}

/** Positionen der Rivalen und ihrer Figuren aktualisieren */
export function placeRivals(): void {
  for (const def of RIVALS) {
    const r = Game.rivals.get(def.id);
    if (!r) continue;
    const h = hangoutOf(def);
    const town = TOWNS.find((t) => t.id === h.town);
    r.map = 'insel';
    r.x = ((town?.x ?? 0) + h.x) * TILE + 8;
    r.y = ((town?.y ?? 0) + h.y) * TILE + 12;
    const npc = def.npc ? NPC_BY_ID[def.npc] : undefined;
    if (npc) {
      npc.town = h.town;
      npc.x = h.x;
      npc.y = h.y;
    }
  }
}

let lastHour = -1;

/** Jede Spielstunde: Rivalen sammeln und ziehen weiter */
export function tickRivals(): void {
  const hour = Game.day * 24 + Math.floor(Game.clock / 60);
  if (hour === lastHour) return;
  const steps = lastHour < 0 ? 0 : Math.min(48, hour - lastHour);
  lastHour = hour;
  if (steps <= 0) {
    placeRivals();
    return;
  }
  for (let s = 0; s < steps; s++) {
    for (const def of RIVALS) {
      const r = Game.rivals.get(def.id);
      if (!r) continue;
      // „Versiegelte" Rivalen (Opfer der Aschenhand) sammeln nicht
      if (r.buffs.has('gebannt')) continue;
      if (Math.random() < def.rate / 24) acquire(r, def, Math.random);
    }
  }
  placeRivals();
}

// Sichtbarkeit der Rivalen-Figuren
for (const def of RIVALS) {
  if (!def.npc) continue;
  registerNpcRule(`rivale:${def.id}`, () => {
    if (def.id === 'varga') {
      const s = Game.quests.stage('q-aschenhand');
      return s >= 2 && s < 4 && !Game.flags.has('boss:varga');
    }
    return true;
  });
}
