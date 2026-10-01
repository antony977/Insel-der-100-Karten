import Phaser from 'phaser';
import { Sound } from '../../audio/AudioEngine';
import { Enemy } from '../../entities/Enemy';
import { MONSTER_BY_ID, type MonsterDef } from '../../data/monsters';
import type { SpawnZone } from '../../world/WorldMap';
import type { CombatWorld } from './CombatWorld';
import { afterDefense, type Hit } from './Damage';
import { Game } from '../GameState';
import { PAL } from '../../gfx/palette';
import { cardIndex, card as cardDef } from '../../data/cards';
import type { Projectile, ProjKind } from './Projectiles';

const ACTIVATE = 430;
const DEACTIVATE = 640;
const POOL = 36;

interface ZoneState {
  zone: SpawnZone;
  def: MonsterDef;
  alive: number;
  timer: number;
  active: boolean;
}

export type HitSource = 'melee' | 'stoss' | 'special' | 'ally' | 'thorns' | 'decoy';

export interface HitOpts {
  fromX: number;
  fromY: number;
  kb: number;
  src: HitSource;
  root?: number;
  slow?: number;
}

/**
 * Verwaltet alle Monster: Spawn-Zonen (nur in Kameranähe aktiv), Verhalten, Treffer,
 * Belohnungen und die Verwandlung besiegter Monster in Karten.
 */
export class EnemyManager {
  readonly list: Enemy[] = [];
  private readonly zones: ZoneState[] = [];
  private readonly w: CombatWorld;
  private time = 0;
  /** Spielfigur besitzt Fangnetz (für Herzfalter) */
  hasNet = () => Game.inv.tools.has('fangnetz');
  /** Meldet einen Kill (z. B. für Quests) */
  onKill?: (def: MonsterDef, e: Enemy) => void;

  constructor(world: CombatWorld) {
    this.w = world;
    for (let i = 0; i < POOL; i++) this.list.push(new Enemy(world.scene));
    for (const z of world.map.spawns) {
      const def = MONSTER_BY_ID[z.monster];
      if (!def) continue;
      this.zones.push({ zone: z, def, alive: 0, timer: 0, active: false });
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const e of this.list) if (e.active) n++;
    return n;
  }

  private free(): Enemy | null {
    for (const e of this.list) if (!e.active) return e;
    if (this.list.length < POOL * 2) {
      const e = new Enemy(this.w.scene);
      this.list.push(e);
      return e;
    }
    return null;
  }

  /** NG+: Monster werden stärker */
  private mult(): number {
    return 1 + 0.6 * (Number(Game.flags.has('ng1')) + Number(Game.flags.has('ng2')) + Number(Game.flags.has('ng3')));
  }

  spawn(def: MonsterDef, x: number, y: number, zone = -1): Enemy | null {
    const e = this.free();
    if (!e) return null;
    const m = this.mult();
    e.spawn(def, x, y, 'enemy', m, m);
    e.zone = zone;
    return e;
  }

  /** Entfesselte Monsterkarte: Begleiter für eine Weile */
  summonAlly(monsterId: string, x: number, y: number): Enemy | null {
    const def = MONSTER_BY_ID[monsterId];
    if (!def) return null;
    const e = this.free();
    if (!e) return null;
    const lvl = Game.prog.level;
    e.spawn(def, x, y, 'ally', 1, 1);
    e.atk = Math.max(6 + lvl * 1.5, def.atk);
    e.life = 75;
    e.state = 'wander';
    e.z = 0;
    for (let i = 0; i < 8; i++) this.w.fx.spawn('sparkle', x + (Math.random() - 0.5) * 18, y - 8 - Math.random() * 12, { tint: PAL.pink, vy: -30 });
    this.w.fx.spawn('poof', x, y - 6);
    return e;
  }

  private zoneCondition(def: MonsterDef): boolean {
    const s = def.special;
    if (!s) return true;
    if (s.nightOnly && !Game.isNight()) return false;
    if (s.fullMoon && !Game.isFullMoon()) return false;
    if (s.baitOnly && !Game.inv.bag.has('067')) return false;
    return true;
  }

  private randomSpot(z: SpawnZone, flyer: boolean): { x: number; y: number } | null {
    const p = this.w.player;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * z.r;
      const x = z.x + Math.cos(a) * r;
      const y = z.y + Math.sin(a) * r;
      if (Math.hypot(x - p.x, y - p.y) < 110) continue;
      if (!flyer && this.w.map.boxBlocked(x - 6, y - 5, 12, 5)) continue;
      if (flyer && (x < 8 || y < 8 || x > this.w.map.pixelWidth - 8 || y > this.w.map.pixelHeight - 8)) continue;
      return { x, y };
    }
    return null;
  }

  private updateZones(dt: number, cx: number, cy: number): void {
    this.zones.forEach((zs, zi) => {
      const d = Math.hypot(zs.zone.x - cx, zs.zone.y - cy);
      zs.timer -= dt;
      if (d < ACTIVATE + zs.zone.r) {
        zs.active = true;
        const ok = this.zoneCondition(zs.def);
        if (!ok) {
          // Bedingung entfällt (z. B. Tagesanbruch) → verschwinden
          for (const e of this.list) {
            if (e.active && e.zone === zi && e.team === 'enemy' && !e.alerted) this.vanish(e);
          }
          return;
        }
        if (zs.alive < zs.zone.count && zs.timer <= 0) {
          const spot = this.randomSpot(zs.zone, zs.def.behavior.includes('flyer'));
          if (spot) {
            const e = this.spawn(zs.def, spot.x, spot.y, zi);
            if (e) {
              zs.alive++;
              e.packIdx = zs.alive;
            }
          }
          zs.timer = 0.35;
        }
      } else if (zs.active && d > DEACTIVATE + zs.zone.r) {
        zs.active = false;
        for (const e of this.list) {
          if (e.active && e.zone === zi && e.team === 'enemy') {
            e.hide();
            zs.alive = Math.max(0, zs.alive - 1);
          }
        }
      }
    });
  }

  private vanish(e: Enemy): void {
    this.w.fx.spawn('poof', e.x, e.y - 6);
    if (e.zone >= 0) this.zones[e.zone].alive = Math.max(0, this.zones[e.zone].alive - 1);
    e.hide();
  }

  // ------------------------------------------------------------------ Bewegung

  private flyer(e: Enemy): boolean {
    return e.def.behavior.includes('flyer');
  }

  /** Bewegt mit Kollision; liefert Anteil der tatsächlich zurückgelegten Strecke. */
  private move(e: Enemy, dx: number, dy: number): number {
    if (dx === 0 && dy === 0) return 1;
    if (Math.abs(dx) > 0.05) e.faceLeft = dx < 0;
    const want = Math.hypot(dx, dy);
    const ox = e.x;
    const oy = e.y;
    if (this.flyer(e)) {
      e.x = Phaser.Math.Clamp(e.x + dx, 8, this.w.map.pixelWidth - 8);
      e.y = Phaser.Math.Clamp(e.y + dy, 8, this.w.map.pixelHeight - 8);
    } else {
      const bw = Math.max(6, e.def.radius * 1.2);
      const blocked = (x: number, y: number) => this.w.map.boxBlocked(x - bw / 2, y - 5, bw, 5);
      if (!blocked(e.x + dx, e.y)) e.x += dx;
      if (!blocked(e.x, e.y + dy)) e.y += dy;
    }
    return Math.hypot(e.x - ox, e.y - oy) / want;
  }

  private moveToward(e: Enemy, tx: number, ty: number, speed: number, dt: number): number {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return 1;
    const s = Math.min(d, speed * dt);
    return this.move(e, (dx / d) * s, (dy / d) * s);
  }

  // ------------------------------------------------------------------ Ziele

  private target(e: Enemy): { x: number; y: number; kind: 'player' | 'decoy' | 'enemy'; enemy?: Enemy } | null {
    if (e.team === 'ally') {
      let best: Enemy | null = null;
      let bd = 150;
      for (const o of this.list) {
        if (!o.active || o.team !== 'enemy' || o.state === 'dead' || o.state === 'hidden' || o.state === 'burrowed') continue;
        if (o.def.special?.senseOnly && !this.w.player.senseActive) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      return best ? { x: best.x, y: best.y, kind: 'enemy', enemy: best } : null;
    }
    const dc = this.w.decoy;
    if (dc?.active && Math.hypot(dc.x - e.x, dc.y - e.y) < e.def.aggro * 1.6 + 20) return { x: dc.x, y: dc.y, kind: 'decoy' };
    if (this.w.player.dead) return null;
    return { x: this.w.player.x, y: this.w.player.y, kind: 'player' };
  }

  private alertPack(e: Enemy): void {
    if (!e.def.behavior.includes('pack')) return;
    for (const o of this.list) {
      if (o !== e && o.active && o.def === e.def && o.team === e.team && !o.alerted && Math.hypot(o.x - e.x, o.y - e.y) < 120) {
        o.alerted = true;
        if (o.state === 'wander') this.setState(o, 'chase');
      }
    }
  }

  private setState(e: Enemy, s: Enemy['state']): void {
    e.state = s;
    e.t = 0;
    e.hasHit = false;
  }

  // ------------------------------------------------------------------ Update

  update(dt: number, time: number, view: Phaser.Geom.Rectangle): void {
    this.time = time;
    this.updateZones(dt, view.centerX, view.centerY);
    for (const e of this.list) {
      if (!e.active) continue;
      this.think(e, dt);
    }
    this.separate();
    this.projectileHits();
    const sense = this.w.player.senseActive;
    for (const e of this.list) if (e.active) e.sync(time, sense);
  }

  private think(e: Enemy, dt: number): void {
    const d = e.def;
    const b = d.behavior;
    e.t += dt;
    e.flashT -= dt;
    e.barT -= dt;
    e.cd -= dt;
    e.cd2 -= dt;
    if (e.slowT > 0) e.slowT -= dt;
    const speedMul = e.slowT > 0 ? 0.5 : 1;

    // Begleiter: Lebenszeit
    if (e.team === 'ally') {
      e.life -= dt;
      if (e.life <= 0) {
        this.w.fx.spawn('poof', e.x, e.y - 6);
        for (let i = 0; i < 5; i++) this.w.fx.spawn('sparkle', e.x, e.y - 8, { tint: PAL.pink, vx: (Math.random() - 0.5) * 60, vy: -40 });
        e.hide();
        return;
      }
    }

    // Rückstoss
    if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) {
      this.move(e, e.kbx * dt, e.kby * dt);
      const f = Math.exp(-dt * 10);
      e.kbx *= f;
      e.kby *= f;
    }

    // Festgehalten (Wurzeln/Netz)
    if (e.rootT > 0) {
      e.rootT -= dt;
      e.setFrame(5);
      return;
    }

    const tgt = this.target(e);
    const dist = tgt ? Math.hypot(tgt.x - e.x, tgt.y - e.y) : 9999;
    const flying = this.flyer(e);
    if (flying && e.state !== 'attack' && e.state !== 'windup') e.z += (8 + Math.sin(this.time / 300 + e.id) * 2 - e.z) * Math.min(1, dt * 4);

    switch (e.state) {
      case 'hidden': {
        e.setFrame(6);
        if (e.team === 'ally') {
          this.setState(e, 'wander');
          break;
        }
        if (tgt && dist < d.aggro) {
          this.setState(e, 'reveal');
          e.alerted = true;
        }
        break;
      }
      case 'reveal': {
        e.setFrame(4);
        e.z = Math.sin(Math.min(1, e.t / 0.3) * Math.PI) * 8;
        if (e.t > 0.3) {
          e.z = 0;
          this.setState(e, 'chase');
        }
        break;
      }
      case 'burrowed': {
        e.setFrame(6);
        if (tgt && dist < d.aggro) {
          e.alerted = true;
          this.moveToward(e, tgt.x, tgt.y, d.speed * 0.8 * speedMul, dt);
          if (Math.random() < dt * 8) this.w.fx.spawn('dust', e.x + (Math.random() - 0.5) * 8, e.y - 1, { alpha: 0.7 });
          if (dist < 16) {
            this.setState(e, 'attack');
            this.w.shake(1.5, 100);
          }
        }
        break;
      }
      case 'wander': {
        this.wander(e, dt, speedMul);
        if (!tgt) break;
        if (e.team === 'ally') {
          if (tgt.kind === 'enemy') this.setState(e, 'chase');
          break;
        }
        if (b.includes('passive')) break;
        if (dist < d.aggro || (e.alerted && dist < d.aggro * 1.6)) {
          if (b.includes('flee') && !b.includes('thief')) {
            this.setState(e, 'flee');
          } else {
            if (!e.alerted) this.sfx('alert', e.x, 0.6, 0.1);
            e.alerted = true;
            this.alertPack(e);
            this.setState(e, 'chase');
          }
        }
        break;
      }
      case 'chase': {
        if (!tgt) {
          this.setState(e, 'wander');
          break;
        }
        if (e.team === 'enemy' && dist > d.aggro * 2.2 + 40) {
          e.alerted = false;
          this.setState(e, b.includes('burrow') ? 'burrowed' : 'wander');
          break;
        }
        this.chase(e, tgt.x, tgt.y, dist, dt, speedMul);
        break;
      }
      case 'windup': {
        e.setFrame(4);
        const wt = b.includes('charge') ? 0.55 : b.includes('dive') ? 0.45 : b.includes('ranged') && !b.includes('melee') ? 0.35 : 0.28;
        if (b.includes('dive')) e.z += (18 - e.z) * Math.min(1, dt * 6);
        if (tgt && e.t < wt * 0.7) {
          e.faceLeft = tgt.x < e.x;
          const dd = Math.max(1, dist);
          e.dx = (tgt.x - e.x) / dd;
          e.dy = (tgt.y - e.y) / dd;
        }
        if (e.t >= wt) {
          if (b.includes('ranged') && (!b.includes('melee') || dist > d.reach + 14) && d.ranged && !b.includes('dive')) {
            this.fire(e, tgt);
            e.cd = d.ranged.cooldown * (0.85 + Math.random() * 0.3);
            this.setState(e, 'recover');
          } else this.setState(e, 'attack');
        }
        break;
      }
      case 'attack': {
        this.attack(e, tgt, dist, dt, speedMul);
        break;
      }
      case 'recover': {
        e.setFrame(e.t < 0.15 ? 4 : 0);
        if (b.includes('burrow')) {
          e.setFrame(e.t < 1.2 ? (Math.floor(e.t * 6) % 2 ? 0 : 1) : 6);
          if (e.t > 1.5) this.setState(e, 'burrowed');
          break;
        }
        if (e.t > (b.includes('charge') ? 0.7 : 0.4)) this.setState(e, 'chase');
        break;
      }
      case 'flee': {
        this.flee(e, tgt, dist, dt, speedMul);
        break;
      }
      case 'stunned': {
        e.setFrame(6);
        if (e.t > 2.4) {
          this.setState(e, e.def.behavior.includes('flee') ? 'flee' : 'chase');
          e.cornerT = 0;
        }
        break;
      }
      case 'vanish': {
        e.sprite.setAlpha(Math.max(0, 1 - e.t / 0.25));
        if (e.t > 0.3 && tgt) {
          const a = Math.random() * Math.PI * 2;
          const r = 46 + Math.random() * 26;
          e.x = Phaser.Math.Clamp(tgt.x + Math.cos(a) * r, 16, this.w.map.pixelWidth - 16);
          e.y = Phaser.Math.Clamp(tgt.y + Math.sin(a) * r, 16, this.w.map.pixelHeight - 16);
          e.sprite.setAlpha(1);
          this.w.fx.spawn('poof', e.x, e.y - 8, { tint: PAL.violet });
          e.cd = Math.min(e.cd, 0.4);
          this.setState(e, 'chase');
        }
        break;
      }
      case 'hurt': {
        e.setFrame(5);
        if (e.t > 0.18) this.setState(e, b.includes('flee') || b.includes('passive') ? 'flee' : 'chase');
        break;
      }
      default:
        break;
    }
  }

  private wander(e: Enemy, dt: number, speedMul: number): void {
    const d = e.def;
    if (e.team === 'ally') {
      // Begleiter folgt der Spielfigur
      const p = this.w.player;
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      if (dist > 34) {
        this.moveToward(e, p.x + (e.faceLeft ? 14 : -14), p.y + 6, Math.max(d.speed, 70) * 1.2, dt);
        this.walkFrame(e, dt);
      } else this.idleFrame(e);
      if (dist > 300) {
        e.x = p.x + 10;
        e.y = p.y + 8;
      }
      return;
    }
    e.moveT -= dt;
    if (e.moveT <= 0) {
      e.moveT = 1.5 + Math.random() * 2.5;
      if (Math.random() < 0.35) {
        e.tx = e.x;
        e.ty = e.y;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = 10 + Math.random() * 46;
        e.tx = e.homeX + Math.cos(a) * r;
        e.ty = e.homeY + Math.sin(a) * r;
      }
    }
    if (d.speed <= 0) {
      this.idleFrame(e);
      return;
    }
    const dd = Math.hypot(e.tx - e.x, e.ty - e.y);
    if (dd > 2) {
      if (d.behavior.includes('hop')) this.hopMove(e, e.tx, e.ty, d.speed * 0.6 * speedMul, dt);
      else {
        const moved = this.moveToward(e, e.tx, e.ty, d.speed * 0.4 * speedMul, dt);
        if (moved < 0.2) e.moveT = 0;
        this.walkFrame(e, dt);
      }
    } else this.idleFrame(e);
  }

  private idleFrame(e: Enemy): void {
    e.setFrame(Math.floor((this.time / 1000 + e.id * 0.37) * 2.2) % 2);
  }

  private walkFrame(e: Enemy, _dt: number): void {
    e.setFrame(2 + (Math.floor((this.time / 1000 + e.id * 0.21) * 8) % 2));
  }

  /** Hüpfende Fortbewegung: nur in der Luft wird Strecke gemacht */
  private hopMove(e: Enemy, tx: number, ty: number, speed: number, dt: number): void {
    const cycle = 0.72;
    const ph = ((this.time / 1000 + e.id * 0.13) % cycle) / cycle;
    if (ph < 0.5) {
      e.z = Math.sin((ph / 0.5) * Math.PI) * 6;
      this.moveToward(e, tx, ty, speed * 2, dt);
      e.setFrame(2);
    } else {
      e.z = 0;
      e.setFrame(ph < 0.65 ? 3 : 0);
    }
  }

  private chase(e: Enemy, tx: number, ty: number, dist: number, dt: number, speedMul: number): void {
    const d = e.def;
    const b = d.behavior;
    // Teleport
    if (b.includes('teleport') && e.cd2 <= 0 && dist > 30) {
      e.cd2 = 3.2 + Math.random() * 1.6;
      this.w.fx.spawn('poof', e.x, e.y - 8, { tint: PAL.violet });
      this.setState(e, 'vanish');
      return;
    }
    // Dieb mit Beute flieht
    if (b.includes('thief') && e.loot > 0) {
      this.setState(e, 'flee');
      return;
    }
    // Flanken im Rudel
    let gx = tx;
    let gy = ty;
    if (b.includes('pack') && dist > 34) {
      const a = (e.packIdx * 2.1) % (Math.PI * 2);
      gx += Math.cos(a) * 26;
      gy += Math.sin(a) * 18;
    }
    const ranged = b.includes('ranged') && d.ranged;
    if (ranged && !(b.includes('melee') && dist < d.reach + 18)) {
      const r = d.ranged!;
      const want = r.range * 0.65;
      if (dist < want * 0.6) {
        this.moveToward(e, e.x - (tx - e.x), e.y - (ty - e.y), d.speed * speedMul, dt);
        this.walkFrame(e, dt);
      } else if (dist > r.range * 0.9) {
        this.moveToward(e, gx, gy, d.speed * speedMul, dt);
        this.walkFrame(e, dt);
      } else {
        // seitlich ausweichen
        const px = -(ty - e.y) / Math.max(1, dist);
        const py = (tx - e.x) / Math.max(1, dist);
        const dir = e.id % 2 ? 1 : -1;
        this.move(e, px * dir * d.speed * 0.35 * speedMul * dt, py * dir * d.speed * 0.35 * speedMul * dt);
        e.faceLeft = tx < e.x;
        this.idleFrame(e);
      }
      if (e.cd <= 0 && dist < r.range) this.setState(e, 'windup');
      return;
    }
    if (b.includes('charge') && e.cd <= 0 && dist < 130 && dist > 26) {
      this.setState(e, 'windup');
      return;
    }
    if (b.includes('dive') && e.cd <= 0 && dist < 100) {
      this.setState(e, 'windup');
      return;
    }
    if ((b.includes('melee') || b.includes('thief')) && dist < d.reach + 8 && e.cd <= 0) {
      this.setState(e, 'windup');
      return;
    }
    if (d.speed <= 0) {
      this.idleFrame(e);
      return;
    }
    if (dist > d.reach * 0.6) {
      if (b.includes('hop')) this.hopMove(e, gx, gy, d.speed * speedMul, dt);
      else {
        this.moveToward(e, gx, gy, d.speed * speedMul, dt);
        this.walkFrame(e, dt);
      }
    } else {
      e.faceLeft = tx < e.x;
      this.idleFrame(e);
    }
  }

  private attack(e: Enemy, tgt: ReturnType<EnemyManager['target']>, dist: number, dt: number, speedMul: number): void {
    const d = e.def;
    const b = d.behavior;
    e.setFrame(4);
    if (b.includes('burrow') && e.t < 0.02) {
      // Auftauchen mit Flächenschaden
      this.w.fx.spawn('ring', e.x, e.y - 4, { tint: PAL.sand, scale: 0.6 });
      for (let i = 0; i < 4; i++) this.w.fx.spawn('dust', e.x + (Math.random() - 0.5) * 20, e.y - 2);
      if (tgt && dist < 22) this.hitTarget(e, tgt);
      this.setState(e, 'recover');
      return;
    }
    let dur = 0.2;
    let sp = d.speed * 2.6;
    if (b.includes('charge')) {
      dur = 0.6;
      sp = Math.max(170, d.speed * 3.6);
    } else if (b.includes('dive')) {
      dur = 0.42;
      sp = Math.max(160, d.speed * 2.8);
      e.z = Math.max(1, e.z - dt * 60);
    } else if (b.includes('hop')) {
      e.z = Math.sin(Math.min(1, e.t / dur) * Math.PI) * 7;
      sp = d.speed * 2.4;
    }
    const moved = this.move(e, e.dx * sp * speedMul * dt, e.dy * sp * speedMul * dt);
    if (tgt && !e.hasHit) {
      const reach = b.includes('charge') ? d.radius + 6 : d.reach * 0.7 + 4;
      if (Math.hypot(tgt.x - e.x, tgt.y - e.y) < reach) this.hitTarget(e, tgt);
    }
    if (b.includes('charge') && moved < 0.3 && e.t > 0.08) {
      // gegen die Wand gerannt
      this.w.shake(1.5, 100);
      this.w.fx.spawn('impact', e.x + e.dx * 8, e.y - 8, { scale: 0.7 });
      this.setState(e, 'stunned');
      e.t = 1.4;
      e.cd = 2.2;
      return;
    }
    if (e.t >= dur) {
      e.z = 0;
      e.cd = b.includes('charge') ? 2.6 : b.includes('dive') ? 2.2 : 0.7 + Math.random() * 0.5;
      this.setState(e, 'recover');
    }
  }

  private hitTarget(e: Enemy, tgt: NonNullable<ReturnType<EnemyManager['target']>>): void {
    e.hasHit = true;
    if (tgt.kind === 'enemy' && tgt.enemy) {
      this.damage(tgt.enemy, { dmg: Math.round(e.atk), crit: false }, { fromX: e.x, fromY: e.y, kb: 90, src: 'ally' });
      return;
    }
    if (tgt.kind === 'decoy') {
      this.w.decoy?.hit(e.atk);
      return;
    }
    const d = e.def;
    if (d.behavior.includes('thief')) {
      if (d.special?.stealChips) {
        const n = Math.min(Game.inv.chips, 20 + Math.floor(Math.random() * 40));
        if (n > 0) {
          Game.inv.chips -= n;
          e.loot = n;
          e.lootChips = true;
          this.w.numbers.spawn(e.x, e.y - 20, `-${n} Chips`, { color: PAL.coral, small: true });
        }
      } else {
        const n = Math.min(Game.inv.money, Math.max(3, Math.floor(Game.inv.money * 0.12)), 120);
        if (n > 0) {
          Game.inv.money -= n;
          e.loot = n;
          this.w.numbers.spawn(e.x, e.y - 20, `-${n}`, { color: PAL.coral, small: true });
          Game.events.emit('vitals-changed');
        }
      }
      if (e.loot > 0) {
        this.setState(e, 'flee');
        return;
      }
    }
    if (e.atk <= 0) return;
    const dmg = this.w.player.takeHit(e.atk, e.x, e.y, { source: d.id });
    if (dmg > 0 && d.special?.eatsCards) this.eatCard(e);
    // Dornen: Rückschaden
    const thorns = Game.prog.mods.thorns;
    if (dmg > 0 && thorns > 0) {
      this.damage(e, { dmg: Math.max(1, Math.round(dmg * thorns * 2)), crit: false }, { fromX: this.w.player.x, fromY: this.w.player.y, kb: 60, src: 'thorns' });
    }
  }

  private eatCard(e: Enemy): void {
    const frei = Game.book.frei.map((u, i) => [u, i] as const).filter(([u]) => u !== null);
    if (!frei.length) return;
    const [uid] = frei[Math.floor(Math.random() * frei.length)];
    if (uid === null) return;
    const id = Game.registry.idOf(uid);
    Game.book.remove(uid);
    Game.registry.destroy(uid);
    Game.events.emit('book-changed');
    this.w.toast(`Der ${e.def.name} hat deine Karte „${cardDef(id).name}" gefressen!`);
  }

  private flee(e: Enemy, tgt: ReturnType<EnemyManager['target']>, dist: number, dt: number, speedMul: number): void {
    const d = e.def;
    const p = this.w.player;
    if (!tgt || (dist > d.aggro * 1.7 && e.loot === 0)) {
      this.setState(e, 'wander');
      return;
    }
    const ax = e.x - p.x;
    const ay = e.y - p.y;
    const al = Math.max(1, Math.hypot(ax, ay));
    const jitter = Math.sin(this.time / 300 + e.id) * 0.5;
    const fx = ax / al + -ay / al * jitter;
    const fy = ay / al + ax / al * jitter;
    const fl = Math.max(0.01, Math.hypot(fx, fy));
    const sp = d.speed * speedMul * (e.def.behavior.includes('passive') ? 1.4 : 1);
    const moved = this.move(e, (fx / fl) * sp * dt, (fy / fl) * sp * dt);
    this.walkFrame(e, dt);
    // Trick-Monster: in die Enge getrieben → erschöpft
    if (d.special?.cornerOnly) {
      if (moved < 0.35 && dist < 50) e.cornerT += dt;
      else e.cornerT = Math.max(0, e.cornerT - dt * 0.5);
      if (e.cornerT > 0.45) {
        this.setState(e, 'stunned');
        this.w.numbers.spawn(e.x, e.y - 18, 'Erschöpft!', { color: PAL.cream, small: true });
      }
    }
    if (e.loot > 0) {
      if (dist > 230) e.escapeT += dt;
      else e.escapeT = 0;
      if (e.escapeT > 3) {
        this.w.toast(`${d.name} ist mit deinen ${e.lootChips ? 'Chips' : 'Münzen'} entkommen!`);
        this.vanish(e);
      }
    }
    if (e.def.behavior.includes('passive') && e.t > 2.2) this.setState(e, 'wander');
  }

  private fire(e: Enemy, tgt: ReturnType<EnemyManager['target']>): void {
    const r = e.def.ranged;
    if (!r || !tgt) return;
    const base = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    const n = r.count ?? 1;
    const spread = r.spread ?? 0;
    this.sfx('shoot', e.x, 0.55, 0.12);
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : spread >= 6 ? (i / n) * Math.PI * 2 : base - spread / 2 + (spread * i) / (n - 1);
      this.w.projectiles.spawn({
        kind: r.proj as ProjKind,
        x: e.x + Math.cos(a) * 6,
        y: e.y + Math.sin(a) * 4 - e.z,
        vx: Math.cos(a) * r.speed,
        vy: Math.sin(a) * r.speed,
        dmg: e.atk,
        team: 'enemy',
        life: r.range / r.speed + 0.3,
        radius: 4,
        slow: r.slow,
        ghost: this.flyer(e),
      });
    }
  }

  // ------------------------------------------------------------------ Treffer

  /** Gegner im Kreis treffen. `make` erzeugt pro Treffer den Schaden (für Kritische). */
  hitArea(x: number, y: number, r: number, make: () => Hit, o: HitOpts): number {
    let n = 0;
    for (const e of this.list) {
      if (!e.active || e.team !== 'enemy' || e.state === 'dead') continue;
      const ey = e.y - e.size * 0.35 - e.z;
      if (Math.hypot(e.x - x, ey - y) <= r + e.def.radius) {
        if (this.damage(e, make(), o)) n++;
      }
    }
    return n;
  }

  /** nächster verwundbarer Gegner (für Ketten-Techniken) */
  nearest(x: number, y: number, maxD: number, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD;
    for (const e of this.list) {
      if (!e.active || e.team !== 'enemy' || e.state === 'dead' || e.state === 'burrowed') continue;
      if (exclude?.has(e.id)) continue;
      if (e.def.special?.senseOnly && !this.w.player.senseActive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Effekt mit Stereo-Position relativ zum Spieler */
  private sfx(name: string, x: number, vol = 1, vary = 0.06): void {
    Sound.play(name, { vol, vary, pan: (x - this.w.player.x) / 220 });
  }

  /** Schaden anwenden – mit allen Sonderregeln (nur von hinten, Aura-Sinn, Netz …) */
  damage(e: Enemy, hit: Hit, o: HitOpts): boolean {
    if (!e.active || e.state === 'dead' || e.team !== 'enemy') return false;
    const d = e.def;
    const s = d.special ?? {};
    const tx = e.x;
    const ty = e.y - e.size * 0.6;
    if (s.senseOnly && !this.w.player.senseActive) {
      this.w.numbers.spawn(tx, ty, '?', { color: PAL.mist, small: true });
      this.sfx('swing', tx, 0.5);
      return false;
    }
    if (e.state === 'burrowed') {
      this.w.numbers.spawn(tx, ty, '?', { color: PAL.mist, small: true });
      return false;
    }
    if (s.netOnly) {
      if (this.hasNet() && (o.src === 'melee' || o.src === 'special')) {
        this.w.numbers.spawn(tx, ty, 'Gefangen!', { color: PAL.gold, small: true });
        e.hp = 0;
        this.kill(e, true);
        return true;
      }
      this.w.numbers.spawn(tx, ty, 'Entwischt!', { color: PAL.cream, small: true });
      this.sfx('roll', tx, 0.7);
      this.setState(e, 'flee');
      return false;
    }
    if (s.cornerOnly && e.state !== 'stunned') {
      this.w.numbers.spawn(tx, ty, 'Zu flink!', { color: PAL.cream, small: true });
      if (e.state !== 'flee') this.setState(e, 'flee');
      return false;
    }
    if (s.darkOnly && this.w.player.lightOn) {
      this.w.numbers.spawn(tx, ty, 'Geblendet!', { color: PAL.ice, small: true });
      return false;
    }
    if (s.backOnly && e.state !== 'stunned' && e.rootT <= 0) {
      const fromLeft = o.fromX < e.x;
      const front = e.faceLeft ? fromLeft : !fromLeft;
      if (front) {
        this.w.numbers.spawn(tx, ty, 'Klonk!', { color: PAL.silver, small: true });
        this.sfx('clank', tx);
        this.w.fx.spawn('impact', (e.x + o.fromX) / 2, ty, { scale: 0.5, tint: PAL.silver });
        const dx = e.x - o.fromX;
        const dl = Math.max(1, Math.abs(dx));
        e.kbx += (dx / dl) * 30;
        return false;
      }
    }
    if (e.state === 'hidden') this.setState(e, 'reveal');
    const dmg = afterDefense(hit.dmg, e.defense);
    e.hp -= dmg;
    e.flashT = 0.08;
    e.barT = 4;
    e.alerted = true;
    this.alertPack(e);
    this.w.numbers.spawn(tx, ty, String(dmg), { crit: hit.crit, color: o.src === 'ally' ? PAL.pink : undefined });
    this.sfx(hit.crit ? 'crit' : 'hit', tx, o.src === 'ally' ? 0.6 : 1);
    if (hit.crit) this.w.fx.spawn('crit', tx, ty, { depth: 150500 });
    this.w.fx.spawn('impact', tx + (Math.random() - 0.5) * 6, ty + 4, { scale: hit.crit ? 0.9 : 0.6, tint: hit.crit ? PAL.gold : undefined });
    // Rückstoss (schwere Monster weniger)
    const weight = d.special?.mini ? 0.15 : Math.max(0.35, 1.2 - d.radius / 14);
    const dx = e.x - o.fromX;
    const dy = e.y - o.fromY;
    const dl = Math.max(1, Math.hypot(dx, dy));
    e.kbx += (dx / dl) * o.kb * weight;
    e.kby += (dy / dl) * o.kb * weight;
    if (o.root) e.rootT = Math.max(e.rootT, o.root * (d.special?.mini ? 0.4 : 1));
    if (o.slow) e.slowT = Math.max(e.slowT, o.slow);
    if (e.hp <= 0) {
      this.kill(e, false);
      return true;
    }
    const b = d.behavior;
    if (!d.special?.mini && e.state !== 'attack' && e.state !== 'stunned' && e.rootT <= 0) {
      if (b.includes('passive')) this.setState(e, 'flee');
      else if (e.state !== 'windup' || hit.crit) this.setState(e, 'hurt');
    }
    return true;
  }

  private kill(e: Enemy, captured: boolean): void {
    const d = e.def;
    e.state = 'dead';
    const x = e.x;
    const y = e.y;
    this.w.fx.spawn('poof', x, y - e.size * 0.4, { scale: e.size / 16 });
    this.sfx('enemyDie', x, 1, 0.1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.w.fx.spawn('sparkle', x, y - e.size * 0.4, { vx: Math.cos(a) * 50, vy: Math.sin(a) * 40 - 20, tint: PAL.cream });
    }
    if (e.zone >= 0) {
      const zs = this.zones[e.zone];
      zs.alive = Math.max(0, zs.alive - 1);
      zs.timer = Math.max(zs.timer, zs.zone.respawn ?? 40);
    }
    e.hide();
    if (e.team !== 'enemy') return;
    // Beute zurück
    if (e.loot > 0) {
      if (e.lootChips) Game.inv.chips += e.loot;
      else Game.inv.money += e.loot;
      this.w.numbers.spawn(x, y - 26, `+${e.loot} zurück`, { color: PAL.gold, small: true });
    }
    // Erfahrung und Münzen
    const luck = Game.inv.stats().luck;
    const money = Math.round(d.money[0] + Math.random() * (d.money[1] - d.money[0]));
    Game.inv.money += money;
    for (let i = 0; i < Math.min(4, 1 + Math.floor(money / 6)); i++) {
      this.w.fx.spawn('coin', x + (Math.random() - 0.5) * 10, y - 8, { vx: (Math.random() - 0.5) * 50, vy: -50 - Math.random() * 30 });
    }
    this.w.numbers.spawn(x + 8, y - 4, `+${money}`, { color: PAL.gold, small: true });
    if (money > 0) this.w.scene.time.delayedCall(160, () => this.sfx('coin', x, 0.6, 0.04));
    Game.prog.addKill(d.id);
    Game.gainXp(d.xp);
    Game.events.emit('vitals-changed');
    // Verwandlung in die Karte
    const chance = Math.min(1, d.drop * (1 + luck * 0.06));
    if (captured || Math.random() < chance) {
      if (Game.registry.canCreate(d.card)) this.dropCard(d.card, x, y);
      else if (!Game.flags.has(`limit-msg:${d.card}`)) {
        Game.flags.add(`limit-msg:${d.card}`);
        this.w.toast(`${d.name} zerfällt zu Staub – alle Exemplare dieser Karte sind schon im Umlauf.`);
      }
    }
    this.onKill?.(d, e);
  }

  /** Animation: Das Monster wird zur Karte, die zu Boden segelt. */
  private dropCard(id: string, x: number, y: number): void {
    const sc = this.w.scene;
    const img = sc.add.image(x, y - 14, 'cards', cardIndex(id)).setDepth(150000).setScale(0.2);
    sc.tweens.add({ targets: img, scale: 0.7, y: y - 26, duration: 220, ease: 'Back.Out' });
    sc.tweens.add({ targets: img, scaleX: { from: 0.7, to: -0.7 }, duration: 160, yoyo: true, repeat: 1, delay: 220 });
    sc.tweens.add({
      targets: img,
      y: y - 2,
      scale: 0.35,
      alpha: 0,
      delay: 840,
      duration: 260,
      onComplete: () => {
        img.destroy();
        Game.monsterCard(id, x, y);
      },
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.w.fx.spawn('sparkle', x, y - 20, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, tint: PAL.gold, depth: 150001 });
    }
  }

  // ------------------------------------------------------------------ Geschosse

  private projectileHits(): void {
    const p = this.w.player;
    for (const pr of this.w.projectiles.list) {
      if (!pr.active) continue;
      if (pr.team === 'enemy') {
        const dc = this.w.decoy;
        if (dc?.active && Math.hypot(dc.x - pr.x, dc.y - 6 - pr.y) < 9) {
          dc.hit(pr.dmg);
          this.w.projectiles.kill(pr);
          continue;
        }
        if (!p.dead && Math.hypot(p.x - pr.x, p.y - 8 - pr.y) < 7 + pr.radius) {
          p.takeHit(pr.dmg, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05, { slow: pr.slow, source: pr.kind });
          this.burst(pr);
          this.w.projectiles.kill(pr);
        }
        continue;
      }
      for (const e of this.list) {
        if (!e.active || e.team !== 'enemy' || e.state === 'dead' || pr.hits.has(e.id)) continue;
        const ey = e.y - e.size * 0.4 - e.z;
        if (Math.hypot(e.x - pr.x, ey - (pr.y - 8)) <= e.def.radius + pr.radius) {
          pr.hits.add(e.id);
          this.damage(e, { dmg: pr.dmg, crit: pr.crit }, { fromX: pr.x - pr.vx, fromY: pr.y - pr.vy, kb: 70, src: 'stoss' });
          if (!pr.pierce) {
            this.burst(pr);
            this.w.projectiles.kill(pr);
            break;
          }
        }
      }
    }
  }

  burst(pr: Projectile): void {
    this.w.fx.spawn('impact', pr.x, pr.y - 8, { scale: 0.5 * pr.scale, tint: pr.tint ?? undefined });
  }

  // ------------------------------------------------------------------ Trennung

  private separate(): void {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.active || this.flyer(a) || a.state === 'hidden' || a.state === 'burrowed') continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.active || this.flyer(b) || b.state === 'hidden' || b.state === 'burrowed') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.def.radius + b.def.radius) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          this.move(a, (-dx / d) * push, (-dy / d) * push);
          this.move(b, (dx / d) * push, (dy / d) * push);
        }
      }
    }
  }

  /** Alles entfernen (Kartenwechsel, Tod) */
  clear(): void {
    for (const e of this.list) e.hide();
    for (const z of this.zones) {
      z.alive = 0;
      z.timer = 0;
      z.active = false;
    }
  }

  destroy(): void {
    for (const e of this.list) e.destroy();
  }
}
