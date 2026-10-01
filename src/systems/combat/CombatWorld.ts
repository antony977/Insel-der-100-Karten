import type Phaser from 'phaser';
import type { WorldMap } from '../../world/WorldMap';
import type { FxPool } from '../FxPool';
import type { DamageNumbers } from './DamageNumbers';
import type { Projectiles } from './Projectiles';

/** Was Monster über die Spielfigur wissen müssen */
export interface CombatPlayer {
  x: number;
  y: number;
  readonly senseActive: boolean;
  readonly lightOn: boolean;
  readonly dead: boolean;
  /** Treffer einstecken; liefert den tatsächlich erlittenen Schaden (0 = ausgewichen/geblockt) */
  takeHit(atk: number, fromX: number, fromY: number, opts?: { slow?: boolean; source?: string }): number;
}

/** Ziel, das Monster statt der Spielfigur angreifen (z. B. Spiegelbild) */
export interface Decoy {
  x: number;
  y: number;
  active: boolean;
  hit(dmg: number): void;
}

/** Dienste der Welt-Szene, die das Kampfsystem nutzt */
export interface CombatWorld {
  scene: Phaser.Scene;
  map: WorldMap;
  fx: FxPool;
  numbers: DamageNumbers;
  projectiles: Projectiles;
  player: CombatPlayer;
  decoy: Decoy | null;
  shake(intensity: number, ms: number): void;
  hitStop(ms: number): void;
  toast(text: string): void;
}
