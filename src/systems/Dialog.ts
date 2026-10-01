import type { GameStateStore } from './GameState';
import type { NpcDef } from '../data/npcs';

/** Aktionen, die Dialoge in der Welt auslösen können */
export interface WorldApi {
  toast(text: string): void;
  openShop(id: string): void;
  /** Karte geben (landet in der Hand) */
  giveCard(id: string): boolean;
  heal(): void;
  save(): void;
  setRest(): void;
  spawnMonster(id: string, tx: number, ty: number, tag?: string): void;
  warp(target: string): void;
  /** nach Dialogende eine weitere Szene öffnen */
  after(fn: () => void): void;
  openScene(key: string, data?: object): void;
  /** Wunschbrunnen benutzen */
  wish(): void;
}

export interface DialogCtx {
  g: GameStateStore;
  w: WorldApi;
  npc?: NpcDef;
}

export type Line = string | { who?: string; text: string; portrait?: string };

export interface Choice {
  text: string;
  if?: (c: DialogCtx) => boolean;
  /** Aktion; kann eine Knoten-ID zurückgeben */
  do?: (c: DialogCtx) => string | void;
  goto?: string;
}

export interface DialogNode {
  say?: Line[] | ((c: DialogCtx) => Line[]);
  choices?: Choice[];
  /** Aktion nach dem Text; kann eine Knoten-ID zurückgeben */
  do?: (c: DialogCtx) => string | void;
  goto?: string;
}

export interface DialogDef {
  id: string;
  /** Startknoten abhängig vom Spielstand */
  start: (c: DialogCtx) => string;
  nodes: Record<string, DialogNode>;
}

const REGISTRY = new Map<string, DialogDef>();

export function registerDialogs(list: DialogDef[]): void {
  for (const d of list) REGISTRY.set(d.id, d);
}

export function getDialog(id: string): DialogDef | undefined {
  return REGISTRY.get(id);
}

/** Einfacher Dialog aus wenigen Zeilen */
export function simpleDialog(id: string, lines: string[]): DialogDef {
  return { id, start: () => 'a', nodes: { a: { say: lines } } };
}
