import Phaser from 'phaser';
import type { MonsterDef } from '../data/monsters';
import { PAL } from '../gfx/palette';
import { DEPTH } from '../world/TileRenderer';

export type EnemyState =
  | 'wander'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'flee'
  | 'stunned'
  | 'hidden'
  | 'reveal'
  | 'burrowed'
  | 'vanish'
  | 'hurt'
  | 'dead';

export type EnemyTeam = 'enemy' | 'ally';

let nextId = 1;

/**
 * Ein Monster in der Welt. Reiner Datenträger mit Sprite – das Verhalten steckt im
 * EnemyManager. Objekte werden wiederverwendet (Pooling).
 */
export class Enemy {
  id = 0;
  def!: MonsterDef;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly barBg: Phaser.GameObjects.Rectangle;
  readonly barFill: Phaser.GameObjects.Rectangle;
  readonly alert: Phaser.GameObjects.Image;
  active = false;
  team: EnemyTeam = 'enemy';
  zone = -1;
  x = 0;
  y = 0;
  homeX = 0;
  homeY = 0;
  /** Höhe über dem Boden (Sprünge, Flug) */
  z = 0;
  hp = 1;
  maxHp = 1;
  atk = 1;
  defense = 0;
  state: EnemyState = 'wander';
  t = 0;
  faceLeft = true;
  kbx = 0;
  kby = 0;
  flashT = 0;
  barT = 0;
  slowT = 0;
  rootT = 0;
  cd = 0;
  cd2 = 0;
  tx = 0;
  ty = 0;
  dx = 0;
  dy = 0;
  alerted = false;
  hasHit = false;
  loot = 0;
  lootChips = false;
  packIdx = 0;
  life = 0;
  cornerT = 0;
  escapeT = 0;
  moveT = 0;
  frame = -1;
  key = '';
  size = 16;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(DEPTH.shadows).setVisible(false);
    this.sprite = scene.add.sprite(0, 0, 'mon-wollknaeuel', 0).setOrigin(0.5, 1).setVisible(false);
    this.barBg = scene.add.rectangle(0, 0, 18, 3, PAL.ink).setOrigin(0.5, 0.5).setVisible(false).setDepth(150000);
    this.barFill = scene.add.rectangle(0, 0, 16, 1, PAL.red).setOrigin(0, 0.5).setVisible(false).setDepth(150001);
    this.alert = scene.add.image(0, 0, 'fx-alert').setOrigin(0.5, 1).setVisible(false).setDepth(150002);
  }

  spawn(def: MonsterDef, x: number, y: number, team: EnemyTeam, hpMul = 1, atkMul = 1): void {
    this.id = nextId++;
    this.def = def;
    this.team = team;
    this.active = true;
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.z = 0;
    this.maxHp = this.hp = Math.round(def.hp * hpMul);
    this.atk = Math.round(def.atk * atkMul);
    this.defense = def.def;
    this.t = 0;
    this.kbx = this.kby = 0;
    this.flashT = this.barT = this.slowT = this.rootT = 0;
    this.cd = 0.6 + Math.random() * 1.2;
    this.cd2 = 2 + Math.random() * 2;
    this.alerted = false;
    this.hasHit = false;
    this.loot = 0;
    this.lootChips = false;
    this.cornerT = this.escapeT = this.moveT = 0;
    this.life = 0;
    this.faceLeft = Math.random() < 0.5;
    this.key = `mon-${def.sprite}`;
    this.size = (this.sprite.scene.textures.get(this.key).get(0)?.width as number) || 16;
    this.sprite.setTexture(this.key, 0).setVisible(true).setAlpha(1).clearTint();
    this.frame = -1;
    this.shadow.setVisible(true).setScale(Math.max(0.6, def.radius / 7), 1);
    const b = def.behavior;
    this.state = b.includes('camo') ? 'hidden' : b.includes('burrow') ? 'burrowed' : 'wander';
    this.tx = x;
    this.ty = y;
  }

  setFrame(f: number): void {
    if (f !== this.frame) {
      this.frame = f;
      this.sprite.setFrame(f);
    }
  }

  hide(): void {
    this.active = false;
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.barBg.setVisible(false);
    this.barFill.setVisible(false);
    this.alert.setVisible(false);
  }

  /** Sprite-Position, Tiefe, Spiegelung, Lebensbalken */
  sync(time: number, revealSense: boolean): void {
    const sx = Math.round(this.x);
    const sy = Math.round(this.y);
    const zz = Math.round(this.z);
    this.sprite.setPosition(sx, sy + 1 - zz);
    this.sprite.setDepth(this.y + (this.def.behavior.includes('flyer') ? 20 : 0));
    this.sprite.setFlipX(!this.faceLeft);
    this.shadow.setPosition(sx, sy);
    const hiddenLook = this.state === 'hidden' || this.state === 'burrowed';
    this.shadow.setVisible(!hiddenLook || this.def.behavior.includes('burrow') === false);
    // Treffer-Blitz
    if (this.flashT > 0) this.sprite.setTintFill(PAL.white);
    else if (this.team === 'ally') this.sprite.setTint(0xfff0ff);
    else if (this.slowT > 0) this.sprite.setTint(PAL.cream);
    else if (this.rootT > 0) this.sprite.setTint(PAL.lime);
    else if (this.state === 'windup' && Math.floor(time / 70) % 2 === 0) this.sprite.setTint(PAL.coral);
    else if (revealSense && hiddenLook) this.sprite.setTint(Math.floor(time / 200) % 2 ? PAL.violet : PAL.pink);
    else this.sprite.clearTint();
    // Lebensbalken nach Treffern
    const showBar = this.barT > 0 && this.hp > 0;
    this.barBg.setVisible(showBar);
    this.barFill.setVisible(showBar);
    if (showBar) {
      const top = sy - this.size - zz - 2;
      const w = this.def.special?.mini ? 30 : 18;
      this.barBg.setPosition(sx, top).setSize(w, 3);
      this.barFill.setPosition(sx - w / 2 + 1, top);
      this.barFill.width = Math.max(1, Math.round(((w - 2) * this.hp) / this.maxHp));
      this.barFill.fillColor = this.team === 'ally' ? PAL.lime : this.hp / this.maxHp < 0.3 ? PAL.orange : PAL.red;
    }
    // nur mit Aura-Sinn sichtbar: sonst nur ein schwaches Flimmern
    if (this.def.special?.senseOnly && this.team === 'enemy') {
      this.sprite.setAlpha(revealSense ? 1 : 0.08 + Math.abs(Math.sin(time / 260 + this.id)) * 0.1);
      this.shadow.setVisible(revealSense);
    }
    const showAlert = this.state === 'windup' && (this.def.behavior.includes('charge') || this.def.behavior.includes('dive') || this.def.special?.mini);
    this.alert.setVisible(!!showAlert);
    if (showAlert) this.alert.setPosition(sx, sy - this.size - zz - 4);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.barBg.destroy();
    this.barFill.destroy();
    this.alert.destroy();
  }
}
