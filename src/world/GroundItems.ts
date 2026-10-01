import Phaser from 'phaser';
import { Game, type GroundEntry } from '../systems/GameState';
import { card, cardIndex } from '../data/cards';
import { RANKS } from '../data/cardTypes';
import { DEPTH } from './TileRenderer';

interface Live {
  entry: GroundEntry;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  phase: number;
}

const PICKUP_RANGE = 11;

/**
 * Karten und Gegenstände, die am Boden liegen. Karten blinken, wenn ihre 60 Sekunden
 * fast abgelaufen sind, und werden beim Darüberlaufen automatisch aufgehoben.
 */
export class GroundItems {
  private readonly scene: Phaser.Scene;
  private readonly map: string;
  private readonly live = new Map<number, Live>();
  private readonly pool: { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }[] = [];
  /** frisch abgelegte Einträge erst nach Verlassen des Bereichs wieder aufheben */
  private readonly blocked = new Set<number>();
  private t = 0;
  private readonly off: () => void;
  private pullT = 0;
  private pullR = 0;

  /** Karten im Umkreis zur Spielfigur fliegen lassen (Aura-Netz) */
  pull(radius: number): void {
    this.pullT = 1.4;
    this.pullR = radius;
  }

  constructor(scene: Phaser.Scene, map: string) {
    this.scene = scene;
    this.map = map;
    this.off = Game.events.on('ground-changed', () => this.sync());
    this.sync(true);
  }

  /** Neue Einträge in der Nähe der Spielfigur nicht sofort wieder einsammeln */
  private sync(initial = false): void {
    const present = new Set<number>();
    for (const e of Game.ground) {
      if (e.map !== this.map) continue;
      present.add(e.key);
      let l = this.live.get(e.key);
      if (!l) {
        const p = this.pool.pop() ?? {
          sprite: this.scene.add.image(0, 0, 'ground-card', 0),
          shadow: this.scene.add.image(0, 0, 'shadow').setScale(0.7, 0.8).setDepth(DEPTH.shadows),
        };
        l = { entry: e, sprite: p.sprite.setVisible(true), shadow: p.shadow.setVisible(true), phase: Math.random() * 6 };
        this.live.set(e.key, l);
        if (!initial) this.blocked.add(e.key);
      }
      l.entry = e;
      if (e.kind === 'card') l.sprite.setTexture('ground-card', RANKS.indexOf(card(e.id).rank));
      else l.sprite.setTexture('card-icons', cardIndex(e.id));
      l.sprite.setOrigin(0.5, 1);
      l.shadow.setPosition(e.x, e.y + 1);
    }
    for (const [k, l] of this.live) {
      if (present.has(k)) continue;
      l.sprite.setVisible(false);
      l.shadow.setVisible(false);
      this.pool.push({ sprite: l.sprite, shadow: l.shadow });
      this.live.delete(k);
      this.blocked.delete(k);
    }
  }

  update(dt: number, px: number, py: number): void {
    this.t += dt;
    let pick: number | null = null;
    if (this.pullT > 0) this.pullT -= dt;
    for (const l of this.live.values()) {
      const e = l.entry;
      if (this.pullT > 0) {
        const dd = Math.hypot(px - e.x, py - e.y);
        if (dd < this.pullR && dd > 2) {
          const sp = Math.min(dd, 190 * dt);
          e.x += ((px - e.x) / dd) * sp;
          e.y += ((py - e.y) / dd) * sp;
          l.shadow.setPosition(e.x, e.y + 1);
          this.blocked.delete(e.key);
        }
      }
      const bob = Math.round(Math.sin(this.t * 3 + l.phase) * 1.5);
      l.sprite.setPosition(e.x, e.y - 1 - Math.max(0, bob));
      l.sprite.setDepth(e.y);
      // Karten blinken in den letzten 10 Sekunden immer schneller
      if (e.kind === 'card' && e.timeLeft !== undefined && e.timeLeft < 10) {
        const rate = e.timeLeft < 4 ? 12 : 6;
        l.sprite.setAlpha(Math.floor(this.t * rate) % 2 ? 0.35 : 1);
      } else l.sprite.setAlpha(1);
      const d = Math.hypot(e.x - px, e.y - py);
      if (this.blocked.has(e.key)) {
        if (d > PICKUP_RANGE * 2.2) this.blocked.delete(e.key);
        continue;
      }
      if (d < PICKUP_RANGE && pick === null) pick = e.key;
    }
    if (pick !== null) Game.pickUp(pick);
  }

  destroy(): void {
    this.off();
    for (const l of this.live.values()) {
      l.sprite.destroy();
      l.shadow.destroy();
    }
    for (const p of this.pool) {
      p.sprite.destroy();
      p.shadow.destroy();
    }
    this.live.clear();
  }
}
