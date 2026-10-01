import Phaser from 'phaser';
import { charFrame, type Dir } from '../gfx/generators/characters';
import { createCharacterAnims } from './Player';
import type { WorldMap } from '../world/WorldMap';
import { DEPTH } from '../world/TileRenderer';

export interface NpcSpawn {
  id: string;
  key: string;
  name: string;
  x: number;
  y: number;
  facing: Dir;
  wander: number;
  dialog: string;
}

/** Eine Figur in der Welt, mit der man reden kann. Läuft gemütlich in ihrem Bereich umher. */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly def: NpcSpawn;
  x: number;
  y: number;
  private homeX: number;
  private homeY: number;
  private tx: number;
  private ty: number;
  private waitT = 1 + Math.random() * 3;
  private facing: Dir;
  private moving = false;
  private talkT = 0;
  private readonly map: WorldMap;
  /** Kollisionsbox in der Welt (damit die Spielfigur nicht hindurchläuft) */
  private readonly box: { x: number; y: number; w: number; h: number; obj: number };

  constructor(scene: Phaser.Scene, map: WorldMap, def: NpcSpawn) {
    this.def = def;
    this.map = map;
    this.x = this.homeX = this.tx = def.x;
    this.y = this.homeY = this.ty = def.y;
    this.facing = def.facing;
    createCharacterAnims(scene, def.key);
    this.shadow = scene.add.image(def.x, def.y, 'shadow').setDepth(DEPTH.shadows);
    this.sprite = scene.add.sprite(def.x, def.y, def.key, charFrame(def.facing, 'idle0')).setOrigin(0.5, 30 / 32);
    this.sprite.play(`${def.key}-idle-${def.facing}`);
    this.box = { x: def.x - 5, y: def.y - 6, w: 10, h: 6, obj: -2 };
    const ck = map.chunkIndexAt(def.x, def.y);
    if (ck >= 0) map.chunkBoxes[ck].push(this.box);
  }

  /** Spielfigur ansehen */
  faceTo(px: number, py: number): void {
    const dx = px - this.x;
    const dy = py - this.y;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.moving = false;
    this.talkT = 4;
    this.sprite.play(`${this.def.key}-idle-${this.facing}`, true);
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (this.talkT > 0) {
      this.talkT -= dt;
    } else if (this.def.wander > 0) {
      if (this.moving) {
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const d = Math.hypot(dx, dy);
        const near = Math.hypot(playerX - this.x, playerY - this.y) < 18;
        if (d < 1 || near) {
          this.moving = false;
          this.waitT = 1.5 + Math.random() * 3;
          this.sprite.play(`${this.def.key}-idle-${this.facing}`, true);
        } else {
          const sp = 26 * dt;
          const nx = this.x + (dx / d) * Math.min(sp, d);
          const ny = this.y + (dy / d) * Math.min(sp, d);
          // eigene Box kurz ignorieren
          this.box.w = 0;
          const blocked = this.map.boxBlocked(nx - 5, ny - 6, 10, 6);
          this.box.w = 10;
          if (blocked) {
            this.moving = false;
            this.waitT = 1;
            this.sprite.play(`${this.def.key}-idle-${this.facing}`, true);
          } else {
            this.x = nx;
            this.y = ny;
            const f: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
            if (f !== this.facing || !this.sprite.anims.currentAnim?.key.includes('walk')) {
              this.facing = f;
              this.sprite.play(`${this.def.key}-walk-${f}`, true);
            }
          }
        }
      } else {
        this.waitT -= dt;
        if (this.waitT <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * this.def.wander * 16;
          this.tx = this.homeX + Math.cos(a) * r;
          this.ty = this.homeY + Math.sin(a) * r;
          this.moving = true;
        }
      }
    }
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y)).setDepth(this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y) + 1);
    this.box.x = this.x - 5;
    this.box.y = this.y - 6;
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
