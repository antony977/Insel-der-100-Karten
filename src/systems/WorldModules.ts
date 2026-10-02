import type Phaser from 'phaser';
import type { WorldMap, WorldObject } from '../world/WorldMap';
import type { MonsterDef } from '../data/monsters';
import type { Enemy } from '../entities/Enemy';
import type { EnemyManager } from './combat/EnemyManager';
import type { FxPool } from './FxPool';
import type { Projectiles } from './combat/Projectiles';

/**
 * Schnittstelle der Welt für Quest-Module, Minispiele und Dialoge. So bleiben Inhalte
 * (Regionen, Quests) getrennt von der Szenen-Technik.
 */
export interface WorldHost {
  readonly scene: Phaser.Scene;
  readonly mapId: string;
  readonly map: WorldMap;
  readonly player: { x: number; y: number; readonly sense: boolean; readonly lightOn: boolean; frozen: boolean };
  readonly region: string;
  readonly enemies: EnemyManager;
  readonly fx: FxPool;
  toast(text: string): void;
  message(name: string, text: string): void;
  talk(dialog: string, npc?: string): void;
  openScene(key: string, data?: object): void;
  giveCard(id: string): boolean;
  /** Monster an Pixelposition erscheinen lassen */
  spawnMonster(id: string, x: number, y: number, tag?: string): Enemy | null;
  /** Objekt ausblenden (optional dauerhaft per Flag) */
  hideObject(idx: number, flag?: string): void;
  showObject(idx: number): void;
  refreshObject(idx: number): void;
  sparkle(x: number, y: number, color: number, n?: number): void;
  shake(intensity: number, ms: number): void;
  flash(color: number, ms: number): void;
  changeMap(target: string, x?: number, y?: number): void;
  teleport(x: number, y: number, text?: string): void;
  /** Musik mit Vorrang (null = normale Musik) */
  setMusic(id: string | null): void;
  /** Zeitanzeige im HUD (null = aus) */
  setTimer(label: string | null, seconds?: number): void;
  /** Wegweiser-Pfeil im HUD auf eine Pixelposition (null = aus) */
  setTarget(x: number | null, y?: number): void;
  after(ms: number, fn: () => void): void;
  /** Figuren neu prüfen (showIf/hideIf) */
  syncNpcs(): void;
  /** zusätzliche Lichter (von Modulen jedes Bild neu gefüllt) */
  readonly extraLights: { x: number; y: number; radius: number; color: number; alpha?: number }[];
  readonly projectiles: Projectiles;
  /** Spielfigur treffen (berücksichtigt Ausweichen, Schild usw.) */
  hurtPlayer(atk: number, fromX: number, fromY: number): number;
}

export interface WorldModule {
  id: string;
  /** nur auf diesen Karten aktiv (Standard: alle) */
  maps?: string[];
  load?(h: WorldHost): void;
  update?(h: WorldHost, dt: number): void;
  /** Interaktion mit einem Objekt; true = erledigt */
  interact?(h: WorldHost, o: WorldObject, idx: number): boolean;
  kill?(h: WorldHost, def: MonsterDef, e: Enemy): void;
  /** Kartenwechsel prüfen: Text = gesperrt */
  warpCheck?(h: WorldHost, target: string): string | null | undefined;
  /** Spielfigur ist zusammengebrochen */
  died?(h: WorldHost): void;
}

const MODULES: WorldModule[] = [];

export function registerModule(m: WorldModule): void {
  const i = MODULES.findIndex((x) => x.id === m.id);
  if (i >= 0) MODULES[i] = m;
  else MODULES.push(m);
}

export function modulesFor(map: string): WorldModule[] {
  return MODULES.filter((m) => !m.maps || m.maps.includes(map));
}

/** Aktive Welt (für Dialoge, die mehr als die WorldApi brauchen) */
let current: WorldHost | null = null;

export function setWorldHost(h: WorldHost | null): void {
  current = h;
}

export function worldHost(): WorldHost | null {
  return current;
}
