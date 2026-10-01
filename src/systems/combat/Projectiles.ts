import Phaser from 'phaser';
import { PROJ_FRAMES } from '../../gfx/generators/effects';
import type { WorldMap } from '../../world/WorldMap';
import { TILE } from '../../config';

export type Team = 'player' | 'enemy';
export type ProjKind = (typeof PROJ_FRAMES)[number];

export interface Projectile {
  sprite: Phaser.GameObjects.Image;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  crit: boolean;
  team: Team;
  radius: number;
  bounces: number;
  /** Verstärkung pro Abprall */
  growth: number;
  slow: boolean;
  pierce: boolean;
  /** schwebt über Hindernisse (Flieger) */
  ghost: boolean;
  /** getroffene Gegner (bei Durchschlag) */
  hits: Set<number>;
  kind: ProjKind;
  scale: number;
  tint: number | null;
  spin: number;
}

export interface ProjSpawn {
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  team: Team;
  crit?: boolean;
  life?: number;
  radius?: number;
  bounces?: number;
  growth?: number;
  slow?: boolean;
  pierce?: boolean;
  ghost?: boolean;
  scale?: number;
  tint?: number;
}

/** Objekt-Pool für Geschosse (Aura-Stoss, Schlamm, Stacheln …). */
export class Projectiles {
  readonly list: Projectile[] = [];
  private readonly scene: Phaser.Scene;
  private readonly map: WorldMap;
  /** Callback, wenn ein Geschoss an einer Wand zerplatzt */
  onBurst?: (p: Projectile) => void;

  constructor(scene: Phaser.Scene, map: WorldMap, prewarm = 24) {
    this.scene = scene;
    this.map = map;
    for (let i = 0; i < prewarm; i++) this.list.push(this.make());
  }

  private make(): Projectile {
    const sprite = this.scene.add.image(0, 0, 'proj', 0).setVisible(false);
    return {
      sprite,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      dmg: 0,
      crit: false,
      team: 'enemy',
      radius: 4,
      bounces: 0,
      growth: 1,
      slow: false,
      pierce: false,
      ghost: false,
      hits: new Set(),
      kind: 'aura',
      scale: 1,
      tint: null,
      spin: 0,
    };
  }

  spawn(s: ProjSpawn): Projectile {
    let p = this.list.find((q) => !q.active);
    if (!p) {
      p = this.make();
      this.list.push(p);
    }
    p.active = true;
    p.x = s.x;
    p.y = s.y;
    p.vx = s.vx;
    p.vy = s.vy;
    p.life = s.life ?? 1.6;
    p.dmg = s.dmg;
    p.crit = !!s.crit;
    p.team = s.team;
    p.radius = s.radius ?? 4;
    p.bounces = s.bounces ?? 0;
    p.growth = s.growth ?? 1;
    p.slow = !!s.slow;
    p.pierce = !!s.pierce;
    p.ghost = !!s.ghost;
    p.hits.clear();
    p.kind = s.kind;
    p.scale = s.scale ?? 1;
    p.tint = s.tint ?? null;
    p.spin = s.kind === 'spike' || s.kind === 'feather' || s.kind === 'leaf' || s.kind === 'page' ? 0 : 1;
    const frame = PROJ_FRAMES.indexOf(s.kind);
    p.sprite.setFrame(frame).setVisible(true).setScale(p.scale);
    p.sprite.setBlendMode(s.kind === 'aura' || s.kind === 'spark' || s.kind === 'orb' || s.kind === 'rune' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (p.tint !== null) p.sprite.setTint(p.tint);
    else p.sprite.clearTint();
    p.sprite.setRotation(Math.atan2(s.vy, s.vx));
    this.sync(p);
    return p;
  }

  kill(p: Projectile): void {
    p.active = false;
    p.sprite.setVisible(false);
  }

  private sync(p: Projectile): void {
    p.sprite.setPosition(Math.round(p.x), Math.round(p.y - 8));
    p.sprite.setDepth(p.y + 4);
  }

  private wall(x: number, y: number): boolean {
    return this.map.isSolidCell(Math.floor(x / TILE), Math.floor(y / TILE)) && !this.isWater(x, y);
  }

  /** Wasser blockiert Geschosse nicht (sie fliegen darüber). */
  private isWater(x: number, y: number): boolean {
    return this.map.getTerrain(Math.floor(x / TILE), Math.floor(y / TILE)) === 0;
  }

  update(dt: number, time: number): void {
    for (const p of this.list) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.kill(p);
        continue;
      }
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (!p.ghost && this.wall(nx, ny)) {
        if (p.bounces > 0) {
          p.bounces--;
          const hitX = this.wall(nx, p.y);
          const hitY = this.wall(p.x, ny);
          if (hitX || !hitY) p.vx = -p.vx;
          if (hitY || !hitX) p.vy = -p.vy;
          p.dmg = Math.round(p.dmg * p.growth);
          p.scale = Math.min(2.4, p.scale * (p.growth > 1 ? 1.15 : 1));
          p.sprite.setScale(p.scale);
          p.sprite.setRotation(Math.atan2(p.vy, p.vx));
          p.hits.clear();
          this.onBurst?.(p);
          continue;
        }
        this.onBurst?.(p);
        this.kill(p);
        continue;
      }
      p.x = nx;
      p.y = ny;
      if (p.spin) {
        const pulse = 1 + Math.sin(time / 60) * 0.12;
        p.sprite.setScale(p.scale * pulse);
      }
      this.sync(p);
    }
  }

  clear(): void {
    for (const p of this.list) this.kill(p);
  }
}
