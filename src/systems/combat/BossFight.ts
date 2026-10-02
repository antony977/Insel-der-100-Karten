import Phaser from 'phaser';
import type { WorldHost } from '../WorldModules';
import type { Enemy } from '../../entities/Enemy';
import type { ProjKind } from './Projectiles';
import { DEPTH } from '../../world/TileRenderer';
import { Sound } from '../../audio/AudioEngine';
import { PAL } from '../../gfx/palette';

export type AttackKind = 'slam' | 'quake' | 'charge' | 'volley' | 'rain' | 'summon' | 'spiral' | 'teleport';

export interface BossAttack {
  kind: AttackKind;
  proj?: ProjKind;
  n?: number;
  minions?: string[];
}

export interface BossDef {
  /** Monster-ID (MonsterDef mit special.boss) */
  id: string;
  title: string;
  /** Angriffe je Phase (Phase 2 ab 50 % LP) */
  phases: BossAttack[][];
  /** bewegt sich nicht (z. B. Krake im Wasser) */
  stationary?: boolean;
  /** Farbe der Angriffsankündigung */
  color?: number;
}

type State = 'intro' | 'move' | 'windup' | 'strike' | 'recover' | 'gone';

/**
 * Bosskampf: Der Boss ist ein normaler Gegner im Gegner-Manager (Treffer, Lebenspunkte,
 * Beute), Bewegung und Angriffe steuert diese Klasse. Jeder Angriff wird am Boden
 * angekündigt (rote Fläche), damit man ausweichen kann.
 */
export class BossFight {
  readonly e: Enemy;
  private readonly h: WorldHost;
  private readonly def: BossDef;
  private readonly g: Phaser.GameObjects.Graphics;
  private state: State = 'intro';
  private t = 0;
  private phase = 0;
  private atk: BossAttack | null = null;
  private target = { x: 0, y: 0 };
  private targets: { x: number; y: number }[] = [];
  private dir = { x: 0, y: 0 };
  private touchCd = 0;
  private spiralA = 0;
  private spiralT = 0;
  private lastKind: AttackKind | null = null;
  private readonly startX: number;
  private readonly startY: number;
  done = false;
  onDefeat?: () => void;

  constructor(h: WorldHost, def: BossDef, x: number, y: number) {
    this.h = h;
    this.def = def;
    this.startX = x;
    this.startY = y;
    const e = h.spawnMonster(def.id, x, y, 'boss');
    if (!e) throw new Error(`Boss ${def.id} konnte nicht erscheinen`);
    this.e = e;
    e.alerted = true;
    e.state = 'wander';
    this.g = h.scene.add.graphics().setDepth(DEPTH.shadows + 10);
    h.setMusic('boss');
    Sound.play('alert');
    h.shake(3, 400);
  }

  private get speedMul(): number {
    return this.phase === 1 ? 1.3 : 1;
  }

  private get player(): { x: number; y: number } {
    return this.h.player;
  }

  private dist(x: number, y: number): number {
    return Math.hypot(this.player.x - x, this.player.y - y);
  }

  private hitPlayer(mult = 1): void {
    this.h.hurtPlayer(Math.round(this.e.atk * mult), this.e.x, this.e.y);
  }

  private moveBoss(dx: number, dy: number): void {
    const e = this.e;
    const r = e.def.radius;
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (!this.h.map.boxBlocked(nx - r, e.y - 6, r * 2, 6)) e.x = nx;
    if (!this.h.map.boxBlocked(e.x - r, ny - 6, r * 2, 6)) e.y = ny;
    if (Math.abs(dx) > 0.01) e.faceLeft = dx < 0;
  }

  update(dt: number): void {
    const e = this.e;
    if (this.done) return;
    if (!e.active || e.state === 'dead' || e.hp <= 0) {
      this.finish(true);
      return;
    }
    this.t += dt;
    this.touchCd -= dt;
    this.h.scene.registry.set('bossBar', { name: e.def.name, title: this.def.title, hp: e.hp, max: e.maxHp });
    // Phase 2
    if (this.phase === 0 && e.hp < e.maxHp * 0.5) {
      this.phase = 1;
      this.h.toast(`${e.def.name} wird wütend!`);
      this.h.flash(PAL.red, 200);
      this.h.shake(4, 400);
      Sound.play('special', { rate: 0.7 });
      this.summon(this.def.phases[1].find((a) => a.kind === 'summon')?.minions ?? []);
    }
    // Berührung schadet
    if (this.touchCd <= 0 && this.dist(e.x, e.y - 6) < e.def.radius + 8 && this.state !== 'intro') {
      this.touchCd = 1;
      this.hitPlayer(0.6);
    }
    const frameT = Math.floor(this.t * 3) % 2;
    switch (this.state) {
      case 'intro':
        e.setFrame(frameT);
        if (this.t > 1.8) this.to('move');
        break;
      case 'move': {
        if (!this.def.stationary) {
          const dx = this.player.x - e.x;
          const dy = this.player.y - e.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          const want = 64;
          const sp = e.def.speed * this.speedMul;
          if (d > want) this.moveBoss((dx / d) * sp * dt, (dy / d) * sp * dt);
          else if (d < want - 20) this.moveBoss((-dx / d) * sp * 0.5 * dt, (-dy / d) * sp * 0.5 * dt);
          e.faceLeft = dx < 0;
          e.setFrame(2 + frameT);
        } else e.setFrame(frameT);
        if (this.t > (this.phase === 1 ? 0.9 : 1.6)) this.chooseAttack();
        break;
      }
      case 'windup':
        e.setFrame(Math.floor(this.t * 8) % 2 ? 4 : 6);
        this.drawTelegraph();
        if (this.t > this.windupTime()) this.strike();
        break;
      case 'strike':
        this.updateStrike(dt);
        break;
      case 'recover':
        this.g.clear();
        e.setFrame(5);
        e.state = 'stunned';
        if (this.t > (this.phase === 1 ? 0.6 : 0.9)) this.to('move');
        break;
      default:
        break;
    }
  }

  private to(s: State): void {
    this.state = s;
    this.t = 0;
    this.e.state = s === 'windup' ? 'windup' : s === 'recover' ? 'stunned' : 'wander';
  }

  private windupTime(): number {
    const base: Record<AttackKind, number> = { slam: 0.9, quake: 1.2, charge: 0.8, volley: 0.55, rain: 1.0, summon: 0.6, spiral: 0.7, teleport: 0.35 };
    return base[this.atk?.kind ?? 'slam'] / (this.phase === 1 ? 1.15 : 1);
  }

  private chooseAttack(): void {
    const list = this.def.phases[this.phase] ?? this.def.phases[0];
    let pick = list[Math.floor(Math.random() * list.length)];
    // nicht zweimal hintereinander dasselbe
    if (pick.kind === this.lastKind && list.length > 1) pick = list[(list.indexOf(pick) + 1) % list.length];
    // Beschwören nur, wenn nicht schon viele Helfer da sind
    if (pick.kind === 'summon' && this.h.enemies.list.filter((x) => x.active && x.tag === 'boss-minion').length >= 3) pick = list.find((a) => a.kind !== 'summon') ?? pick;
    this.atk = pick;
    this.lastKind = pick.kind;
    const p = this.player;
    this.target = { x: p.x, y: p.y };
    this.targets = [];
    if (pick.kind === 'rain') {
      const n = pick.n ?? (this.phase === 1 ? 7 : 5);
      this.targets.push({ x: p.x, y: p.y });
      for (let i = 1; i < n; i++) this.targets.push({ x: p.x + (Math.random() - 0.5) * 150, y: p.y + (Math.random() - 0.5) * 100 });
    }
    if (pick.kind === 'charge') {
      const dx = p.x - this.e.x;
      const dy = p.y - this.e.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      this.dir = { x: dx / d, y: dy / d };
    }
    this.to('windup');
  }

  private drawTelegraph(): void {
    const g = this.g;
    const k = Math.min(1, this.t / this.windupTime());
    const col = this.def.color ?? PAL.red;
    g.clear();
    const circle = (x: number, y: number, r: number) => {
      g.fillStyle(col, 0.12 + k * 0.3).fillEllipse(x, y, r * 2, r * 1.4);
      g.lineStyle(1, col, 0.9).strokeEllipse(x, y, r * 2, r * 1.4);
      g.fillStyle(col, 0.25).fillEllipse(x, y, r * 2 * k, r * 1.4 * k);
    };
    switch (this.atk?.kind) {
      case 'slam':
        circle(this.target.x, this.target.y, 36);
        break;
      case 'quake':
        circle(this.e.x, this.e.y, 92);
        break;
      case 'rain':
        for (const t of this.targets) circle(t.x, t.y, 22);
        break;
      case 'charge': {
        const len = 230;
        const w = 30;
        const { x: dx, y: dy } = this.dir;
        const px = -dy * (w / 2);
        const py = dx * (w / 2);
        const ex = this.e.x + dx * len;
        const ey = this.e.y + dy * len;
        g.fillStyle(col, 0.12 + k * 0.3);
        g.fillPoints([new Phaser.Math.Vector2(this.e.x + px, this.e.y + py), new Phaser.Math.Vector2(ex + px, ey + py), new Phaser.Math.Vector2(ex - px, ey - py), new Phaser.Math.Vector2(this.e.x - px, this.e.y - py)], true);
        break;
      }
      default:
        break;
    }
  }

  private strike(): void {
    const a = this.atk;
    if (!a) return this.to('move');
    this.g.clear();
    const e = this.e;
    switch (a.kind) {
      case 'slam': {
        // Sprung auf die markierte Stelle
        e.x = Phaser.Math.Clamp(this.target.x, 24, this.h.map.pixelWidth - 24);
        e.y = Phaser.Math.Clamp(this.target.y, 24, this.h.map.pixelHeight - 24);
        if (this.h.map.boxBlocked(e.x - 8, e.y - 6, 16, 6)) {
          e.x = this.startX;
          e.y = this.startY;
        }
        this.h.shake(4, 250);
        Sound.play('stomp');
        this.h.fx.spawn('ring', e.x, e.y - 4, { tint: this.def.color ?? PAL.cream, scale: 1.4 });
        if (this.dist(this.target.x, this.target.y) < 36) this.hitPlayer(1.2);
        this.to('recover');
        return;
      }
      case 'quake':
        this.h.shake(5, 400);
        Sound.play('stomp', { rate: 0.7 });
        this.h.fx.spawn('ring', e.x, e.y - 4, { tint: this.def.color ?? PAL.cream, scale: 3.6 });
        if (this.dist(e.x, e.y) < 92) this.hitPlayer(1);
        this.to('recover');
        return;
      case 'rain':
        Sound.play('burst');
        for (const t of this.targets) {
          this.h.fx.spawn('impact', t.x, t.y - 4, { scale: 1.2, tint: this.def.color ?? PAL.red });
          if (this.dist(t.x, t.y) < 22) {
            this.hitPlayer(0.9);
            break;
          }
        }
        this.h.shake(2, 150);
        this.to('recover');
        return;
      case 'volley': {
        const n = a.n ?? (this.phase === 1 ? 7 : 5);
        const base = Math.atan2(this.player.y - (e.y - 10), this.player.x - e.x);
        for (let i = 0; i < n; i++) {
          const ang = base - 0.5 + (i / Math.max(1, n - 1)) * 1.0;
          this.fire(ang, 150);
        }
        Sound.play('shoot');
        this.to('recover');
        return;
      }
      case 'summon':
        this.summon(a.minions ?? []);
        this.to('recover');
        return;
      case 'teleport': {
        this.h.fx.spawn('poof', e.x, e.y - 10, { scale: 2 });
        for (let k = 0; k < 12; k++) {
          const ang = Math.random() * Math.PI * 2;
          const nx = this.player.x + Math.cos(ang) * 90;
          const ny = this.player.y + Math.sin(ang) * 70;
          if (!this.h.map.boxBlocked(nx - 10, ny - 6, 20, 6)) {
            e.x = nx;
            e.y = ny;
            break;
          }
        }
        this.h.fx.spawn('poof', e.x, e.y - 10, { scale: 2 });
        Sound.play('teleport', { rate: 1.3 });
        this.to('move');
        this.t = 0.6;
        return;
      }
      case 'charge':
      case 'spiral':
        this.to('strike');
        this.spiralT = 0;
        return;
    }
  }

  private updateStrike(dt: number): void {
    const a = this.atk;
    const e = this.e;
    if (!a) return this.to('move');
    if (a.kind === 'charge') {
      e.setFrame(4);
      const sp = 300 * this.speedMul;
      this.moveBoss(this.dir.x * sp * dt, this.dir.y * sp * dt);
      if (this.touchCd <= 0 && this.dist(e.x, e.y - 6) < e.def.radius + 12) {
        this.touchCd = 0.8;
        this.hitPlayer(1.3);
      }
      if (this.t > 0.75) {
        this.h.shake(2, 120);
        this.to('recover');
      }
      return;
    }
    if (a.kind === 'spiral') {
      e.setFrame(6);
      this.spiralT += dt;
      const rate = this.phase === 1 ? 0.05 : 0.07;
      while (this.spiralT > rate) {
        this.spiralT -= rate;
        this.spiralA += 0.55;
        this.fire(this.spiralA, 110);
        this.fire(this.spiralA + Math.PI, 110);
      }
      if (this.t > 1.6) this.to('recover');
    }
  }

  private fire(angle: number, speed: number): void {
    const e = this.e;
    this.h.projectiles.spawn({
      kind: this.def.phases[this.phase].find((x) => x.proj)?.proj ?? 'orb',
      x: e.x + Math.cos(angle) * 12,
      y: e.y - 12 + Math.sin(angle) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      dmg: Math.round(e.atk * 0.7),
      team: 'enemy',
      life: 2.2,
      radius: 4,
      ghost: true,
    });
  }

  private summon(ids: string[]): void {
    const e = this.e;
    ids.forEach((id, i) => {
      const a = (i / Math.max(1, ids.length)) * Math.PI * 2;
      const m = this.h.spawnMonster(id, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30, 'boss-minion');
      if (m) m.alerted = true;
    });
    if (ids.length) Sound.play('spell', { rate: 0.8 });
  }

  /** Kampf beenden (Sieg oder Abbruch) */
  finish(won: boolean): void {
    if (this.done) return;
    this.done = true;
    this.state = 'gone';
    this.g.destroy();
    this.h.scene.registry.set('bossBar', null);
    this.h.setMusic(null);
    for (const m of this.h.enemies.list) if (m.active && m.tag === 'boss-minion') m.hide();
    if (!won && this.e.active) this.e.hide();
    if (won) this.onDefeat?.();
  }
}
