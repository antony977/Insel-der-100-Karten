import Phaser from 'phaser';
import { charFrame, DIRS, type Dir, type PoseName } from '../gfx/generators/characters';
import type { InputManager } from '../input/InputManager';
import type { WorldMap } from '../world/WorldMap';
import type { FxPool } from '../systems/FxPool';
import { Display } from '../systems/Display';
import { DEPTH } from '../world/TileRenderer';
import { PAL } from '../gfx/palette';
import { Game } from '../systems/GameState';
import { AFFINITY_BY_ID, TECH_BY_ID, type TechniqueId } from '../data/aura';
import { incomingDamage, meleeDamage, specialDamage, stossDamage, type MeleeKind } from '../systems/combat/Damage';
import type { CombatPlayer, CombatWorld } from '../systems/combat/CombatWorld';
import type { EnemyManager } from '../systems/combat/EnemyManager';

export type PlayerState = 'move' | 'attack' | 'charge' | 'roll' | 'hurt' | 'aura' | 'cast' | 'special' | 'down';

const WALK_SPEED = 84;
const ROLL_SPEED = 210;
const ROLL_TIME = 0.34;
const ROLL_IFRAMES = 0.26;
const COMBO_TIMES = [0.24, 0.24, 0.34];
const CHARGE_TIME = 0.45;
const BOX_W = 10;
const BOX_H = 6;
const HIT_IFRAMES = 0.7;

const DIR_VEC: Record<Dir, [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};
const DIR_ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** Erzeugt die Lauf-/Idle-Animationen für ein Figuren-Spritesheet. */
export function createCharacterAnims(scene: Phaser.Scene, key: string): void {
  for (const dir of DIRS) {
    const f = (p: PoseName) => charFrame(dir, p);
    if (!scene.anims.exists(`${key}-idle-${dir}`)) {
      scene.anims.create({
        key: `${key}-idle-${dir}`,
        frames: [{ key, frame: f('idle0'), duration: 520 }, { key, frame: f('idle1'), duration: 380 }],
        repeat: -1,
      });
    }
    if (!scene.anims.exists(`${key}-walk-${dir}`)) {
      scene.anims.create({
        key: `${key}-walk-${dir}`,
        frames: [f('walkA'), f('idle0'), f('walkB'), f('idle0')].map((frame) => ({ key, frame })),
        frameRate: 9,
        repeat: -1,
      });
    }
  }
  if (!scene.anims.exists('fx-aura-loop')) {
    scene.anims.create({
      key: 'fx-aura-loop',
      frames: scene.anims.generateFrameNumbers('fx-aura', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1,
    });
  }
}

/** Callback-Schnittstelle zur Szene (Kamera-Effekte, Meldungen, Interaktion). */
export interface PlayerHooks {
  shake(intensity: number, duration: number): void;
  hitStop(ms: number): void;
  interact(px: number, py: number): boolean;
  spell(slot: number): void;
  aimWorld(): { x: number; y: number } | null;
  /** LP auf 0 gefallen */
  died?(): void;
  /** Spiegelbild erzeugen (Spiegel-Affinität) */
  decoy?(x: number, y: number, seconds: number, power: number): void;
  /** Aura-Netz (Faden-Affinität): zieht Karten heran */
  pullCards?(x: number, y: number, radius: number): void;
  flash?(color: number, ms: number): void;
  toast?(text: string): void;
}

export type CombatHost = CombatWorld & { enemies: EnemyManager };

export class Player implements CombatPlayer {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly aura: Phaser.GameObjects.Sprite;
  readonly shield: Phaser.GameObjects.Image;
  x: number;
  y: number;
  facing: Dir = 'down';
  state: PlayerState = 'move';
  /** Unverwundbarkeit (Ausweichrolle) */
  invulnerable = false;
  auraColor: number = PAL.cyan;
  noclip = false;
  moving = false;
  godMode = false;
  /** Kampfwelt (wird von der Szene gesetzt) */
  world: CombatHost | null = null;
  /** aktive Aura-Techniken */
  sense = false;
  shieldOn = false;
  focusT = 0;
  /** Bewegung gesperrt (Aura-Rad offen, Dialog …) */
  frozen = false;

  private readonly key: string;
  private readonly map: WorldMap;
  private readonly fx: FxPool;
  private readonly hooks: PlayerHooks;
  private t = 0;
  private combo = 0;
  private queued = false;
  private slashDone = false;
  private holdTime = 0;
  private chargeSparkT = 0;
  private rollDX = 0;
  private rollDY = 1;
  private hurtDX = 0;
  private hurtDY = 0;
  private dustT = 0;
  private scaleX = 1;
  private scaleY = 1;
  private lastAnim = '';
  private iframeT = 0;
  private slowT = 0;
  private counterReady = false;
  private chainHit = new Set<number>();
  private chainT = 0;
  private auraLowWarned = false;
  private sparkT = 0;

  constructor(scene: Phaser.Scene, key: string, x: number, y: number, map: WorldMap, fx: FxPool, hooks: PlayerHooks) {
    this.key = key;
    this.map = map;
    this.fx = fx;
    this.hooks = hooks;
    this.x = x;
    this.y = y;
    createCharacterAnims(scene, key);
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadows);
    this.aura = scene.add
      .sprite(x, y, 'fx-aura', 0)
      .setOrigin(0.5, 0.82)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false)
      .setAlpha(0.85);
    this.sprite = scene.add.sprite(x, y, key, charFrame('down', 'idle0')).setOrigin(12 / 24, 30 / 32);
    this.shield = scene.add.image(x, y, 'fx-shield').setOrigin(0.5, 0.86).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setAlpha(0.75);
    this.auraColor = AFFINITY_BY_ID[Game.prog.affinity].color;
    this.sync();
  }

  // ------------------------------------------------------------------ Status

  get senseActive(): boolean {
    return this.sense;
  }

  get lightOn(): boolean {
    const t = Game.inv.tools;
    return (t.has('laterne') || t.has('ewige-laterne') || Game.inv.bag.has('043')) && !Game.flags.has('licht-aus');
  }

  get dead(): boolean {
    return this.state === 'down';
  }

  get auraActive(): boolean {
    return this.sense || this.shieldOn || this.focusT > 0;
  }

  private blocked(px: number, py: number): boolean {
    if (this.noclip) return false;
    return this.map.boxBlocked(px - BOX_W / 2, py - BOX_H, BOX_W, BOX_H);
  }

  /** Bewegt mit Kollision, gleitet um Ecken. */
  private moveBy(dx: number, dy: number): void {
    if (dx !== 0) {
      const steps = Math.ceil(Math.abs(dx));
      const sx = dx / steps;
      for (let i = 0; i < steps; i++) {
        if (!this.blocked(this.x + sx, this.y)) {
          this.x += sx;
        } else {
          if (Math.abs(dy) < 0.01) this.nudge(sx, 0);
          break;
        }
      }
    }
    if (dy !== 0) {
      const steps = Math.ceil(Math.abs(dy));
      const sy = dy / steps;
      for (let i = 0; i < steps; i++) {
        if (!this.blocked(this.x, this.y + sy)) {
          this.y += sy;
        } else {
          if (Math.abs(dx) < 0.01) this.nudge(0, sy);
          break;
        }
      }
    }
  }

  /** Ecken-Korrektur: steht man knapp an einer Kante, wird man seitlich vorbeigeschoben. */
  private nudge(sx: number, sy: number): void {
    for (let n = 1; n <= 6; n++) {
      if (sx !== 0) {
        if (!this.blocked(this.x + sx, this.y - n) && !this.blocked(this.x, this.y - 1)) {
          this.y -= 1;
          return;
        }
        if (!this.blocked(this.x + sx, this.y + n) && !this.blocked(this.x, this.y + 1)) {
          this.y += 1;
          return;
        }
      } else {
        if (!this.blocked(this.x - n, this.y + sy) && !this.blocked(this.x - 1, this.y)) {
          this.x -= 1;
          return;
        }
        if (!this.blocked(this.x + n, this.y + sy) && !this.blocked(this.x + 1, this.y)) {
          this.x += 1;
          return;
        }
      }
    }
  }

  private faceFrom(dx: number, dy: number): void {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    // leichte Hysterese, damit die Richtung bei Diagonalen nicht flackert
    const horizontal = this.facing === 'left' || this.facing === 'right';
    const bias = horizontal ? 1.15 : 0.87;
    if (Math.abs(dx) * bias > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
    else this.facing = dy < 0 ? 'up' : 'down';
  }

  private faceAim(): void {
    const aim = this.hooks.aimWorld();
    if (aim) this.faceFrom(aim.x - this.x, aim.y - (this.y - 12));
  }

  private setState(s: PlayerState): void {
    this.state = s;
    this.t = 0;
  }

  private walkSpeed(): number {
    const st = Game.inv.stats();
    let sp = WALK_SPEED * (1 + (st.spd - 5) * 0.05) * (1 + Game.prog.mods.speed);
    if (this.slowT > 0) sp *= 0.6;
    if (this.shieldOn) sp *= 0.75;
    return sp;
  }

  // ------------------------------------------------------------------ Update

  update(dt: number, input: InputManager): void {
    this.t += dt;
    const frozen = this.frozen;
    const mx = frozen ? 0 : input.moveX;
    const my = frozen ? 0 : input.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    const inv = Game.inv;
    const st = inv.stats();
    const mods = Game.prog.mods;

    if (input.isDown('attack') && !frozen) this.holdTime += dt;
    else this.holdTime = 0;
    if (this.iframeT > 0) this.iframeT -= dt;
    if (this.slowT > 0) this.slowT -= dt;

    // --- Aura: Verbrauch und Regeneration
    if (this.state !== 'down') {
      let drain = 0;
      if (this.sense) drain += TECH_BY_ID.sinn.drain * Math.max(0.4, 1 - mods.sense / 120);
      if (this.shieldOn) drain += TECH_BY_ID.schild.drain * (1 - mods.shieldCost);
      if (drain > 0) {
        inv.aura = Math.max(0, inv.aura - drain * dt);
        if (inv.aura <= 0) {
          if (this.sense || this.shieldOn) this.hooks.toast?.('Deine Aura ist erschöpft.');
          this.sense = false;
          this.shieldOn = false;
        }
      } else if (inv.aura < st.aura) {
        const regen = (3 + st.ctrl * 0.5) * (1 + mods.auraRegen) * (inv.buffs.has('aura-doppelt') ? 2 : 1);
        inv.aura = Math.min(st.aura, inv.aura + regen * dt);
      }
      if (this.focusT > 0) {
        this.focusT -= dt;
        this.sparkT -= dt;
        if (this.sparkT <= 0) {
          this.sparkT = 0.08;
          this.fx.spawn('sparkle', this.x + (Math.random() - 0.5) * 14, this.y - 10 - Math.random() * 10, { tint: PAL.red, vy: -30, depth: this.y + 2 });
        }
      }
    }

    // Zauber-Slots
    for (let i = 0; i < 3; i++) {
      if (!frozen && input.justPressed((['spell1', 'spell2', 'spell3'] as const)[i]) && (this.state === 'move' || this.state === 'aura')) {
        this.setState('cast');
        this.hooks.spell(i + 1);
      }
    }

    switch (this.state) {
      case 'move': {
        this.moving = mag > 0.05;
        if (this.moving) {
          this.faceFrom(mx, my);
          const sp = this.walkSpeed() * mag;
          this.moveBy(mx * sp * dt, my * sp * dt);
          this.dustT -= dt * mag;
          if (this.dustT <= 0 && mag > 0.6) {
            this.dustT = 0.28;
            this.fx.spawn('dust', this.x - mx * 4, this.y - 1, { depth: this.y - 1, alpha: 0.6 });
          }
        }
        if (frozen) break;
        if (input.justPressed('dodge')) this.startRoll(mx, my);
        else if (input.justPressed('attack')) {
          const [fx, fy] = DIR_VEC[this.facing];
          if (!this.hooks.interact(this.x + fx * 12, this.y - 4 + fy * 12)) this.startAttack(0);
        }
        break;
      }
      case 'attack': {
        const dur = COMBO_TIMES[this.combo];
        const strikeAt = 0.05;
        if (!this.slashDone && this.t >= strikeAt) {
          this.slashDone = true;
          this.spawnSlash(this.combo === 2 ? 1.25 : 1, this.combo);
          this.strike(this.combo as MeleeKind);
          this.scaleX = 1.12;
          this.scaleY = 0.9;
          if (this.combo === 2) this.hooks.shake(1.5, 90);
        }
        if (this.t > strikeAt && this.t < strikeAt + 0.1) {
          const [fx, fy] = DIR_VEC[this.facing];
          const lunge = this.combo === 2 ? 70 : 45;
          this.moveBy(fx * lunge * dt, fy * lunge * dt);
        }
        if (input.justPressed('attack') && this.t > 0.07 && this.combo < 2) this.queued = true;
        if (input.justPressed('dodge') && this.t > 0.12) {
          this.startRoll(mx, my);
          break;
        }
        if (this.t >= dur) {
          if (this.queued) this.startAttack(this.combo + 1);
          else if (this.holdTime > CHARGE_TIME * 0.6) this.setState('charge');
          else this.setState('move');
        }
        break;
      }
      case 'charge': {
        this.chargeSparkT -= dt;
        const charged = this.holdTime >= CHARGE_TIME + 0.25;
        if (this.chargeSparkT <= 0) {
          this.chargeSparkT = charged ? 0.05 : 0.12;
          const a = Math.random() * Math.PI * 2;
          this.fx.spawn('sparkle', this.x + Math.cos(a) * 14, this.y - 14 + Math.sin(a) * 12, {
            tint: charged ? PAL.gold : this.auraColor,
            vx: -Math.cos(a) * 30,
            vy: -Math.sin(a) * 30,
            depth: this.y + 2,
          });
        }
        if (mag > 0.2) this.faceFrom(mx, my);
        if (input.mouseAiming) this.faceAim();
        if (!input.isDown('attack')) {
          if (charged) {
            this.combo = 2;
            this.setState('attack');
            this.slashDone = true;
            this.spawnSlash(1.6, 3);
            this.strike('charge');
            this.hooks.shake(3, 140);
            this.hooks.hitStop(60);
            this.scaleX = 1.2;
            this.scaleY = 0.85;
            this.t = 0.05;
          } else this.setState('move');
        }
        if (input.justPressed('dodge')) this.startRoll(mx, my);
        break;
      }
      case 'roll': {
        const k = 1 - this.t / ROLL_TIME;
        const dist = 1 + mods.rollDist + st.dodge * 0.08;
        const sp = ROLL_SPEED * dist * (0.45 + 0.55 * k);
        this.moveBy(this.rollDX * sp * dt, this.rollDY * sp * dt);
        this.invulnerable = this.t < ROLL_IFRAMES + mods.iframes;
        if (this.t >= ROLL_TIME) {
          this.invulnerable = false;
          this.scaleX = 0.9;
          this.scaleY = 1.1;
          this.setState('move');
        }
        break;
      }
      case 'hurt': {
        const k = Math.max(0, 1 - this.t / 0.3);
        this.moveBy(this.hurtDX * 160 * k * dt, this.hurtDY * 160 * k * dt);
        this.sprite.setTintFill(this.t < 0.08 ? PAL.white : PAL.red);
        if (this.t > 0.16) this.sprite.clearTint();
        if (this.t >= 0.3) this.setState('move');
        break;
      }
      case 'aura':
      case 'cast': {
        if (this.t >= (this.state === 'aura' ? 0.3 : 0.4)) this.setState('move');
        break;
      }
      case 'special': {
        this.updateChain(dt);
        break;
      }
      case 'down': {
        break;
      }
    }

    // Squash & Stretch zurückfedern
    const back = 1 - Math.exp(-dt * 14);
    this.scaleX += (1 - this.scaleX) * back;
    this.scaleY += (1 - this.scaleY) * back;
    this.sync();
  }

  // ------------------------------------------------------------------ Angriff

  private startAttack(step: number): void {
    this.combo = step;
    this.queued = false;
    this.slashDone = false;
    if (this.hooks.aimWorld()) this.faceAim();
    this.setState('attack');
    this.scaleX = 0.92;
    this.scaleY = 1.06;
  }

  /** Trefferprüfung des Nahkampfschlags */
  private strike(kind: MeleeKind): void {
    const w = this.world;
    if (!w) return;
    const [fx, fy] = DIR_VEC[this.facing];
    const reach = kind === 'charge' ? 18 : kind === 2 ? 15 : 13;
    const cx = this.x + fx * (reach - 2);
    const cy = this.y - 10 + fy * (reach - 4);
    const st = Game.inv.stats();
    const mods = Game.prog.mods;
    const focus = this.focusT > 0;
    const counter = this.counterReady && mods.counter > 0;
    let dealt = 0;
    const kb = (kind === 'charge' ? 220 : kind === 2 ? 160 : 100) * (1 + mods.knockback);
    const n = w.enemies.hitArea(
      cx,
      cy,
      kind === 'charge' ? 20 : 15,
      () => {
        const h = meleeDamage(st, mods, kind, focus, counter);
        dealt += h.dmg;
        return h;
      },
      { fromX: this.x, fromY: this.y - 6, kb, src: 'melee' },
    );
    if (n > 0) {
      this.counterReady = false;
      this.hooks.hitStop(kind === 'charge' ? 80 : kind === 2 ? 55 : 35);
      if (kind === 'charge' || kind === 2) this.hooks.shake(kind === 'charge' ? 3 : 2, 110);
      if (mods.lifesteal > 0) this.heal(Math.round(dealt * mods.lifesteal));
    }
  }

  private heal(n: number): void {
    if (n <= 0) return;
    const st = Game.inv.stats();
    const before = Game.inv.lp;
    Game.inv.lp = Math.min(st.lp, Game.inv.lp + n);
    if (Game.inv.lp > before) this.world?.numbers.spawn(this.x, this.y - 26, `+${Game.inv.lp - before}`, { heal: true, small: true });
  }

  private startRoll(mx: number, my: number): void {
    let dx = mx;
    let dy = my;
    const m = Math.hypot(dx, dy);
    if (m < 0.2) {
      [dx, dy] = DIR_VEC[this.facing];
    } else {
      dx /= m;
      dy /= m;
      this.faceFrom(dx, dy);
    }
    this.rollDX = dx;
    this.rollDY = dy;
    this.setState('roll');
    this.scaleX = 1.15;
    this.scaleY = 0.85;
    const mods = Game.prog.mods;
    if (mods.counter > 0) this.counterReady = true;
    if (mods.rollAura > 0) {
      const st = Game.inv.stats();
      Game.inv.aura = Math.min(st.aura, Game.inv.aura + mods.rollAura);
    }
    for (let i = 0; i < 3; i++) {
      this.fx.spawn('dust', this.x - dx * (4 + i * 4) + (Math.random() - 0.5) * 6, this.y - 1, { depth: this.y - 1 });
    }
  }

  // ------------------------------------------------------------------ Aura-Techniken

  /** Technik auslösen bzw. umschalten. Liefert eine Meldung bei Misserfolg. */
  useTechnique(id: TechniqueId): string | null {
    if (this.state === 'down' || this.state === 'special') return null;
    if (!Game.prog.unlocked(id)) return `${TECH_BY_ID[id].name} lernst du ab Stufe ${TECH_BY_ID[id].unlock}.`;
    const inv = Game.inv;
    const mods = Game.prog.mods;
    const def = TECH_BY_ID[id];
    switch (id) {
      case 'sinn':
        this.sense = !this.sense;
        if (this.sense && inv.aura < 1) {
          this.sense = false;
          return 'Zu wenig Aura.';
        }
        this.auraBurst(this.sense);
        return null;
      case 'schild':
        this.shieldOn = !this.shieldOn;
        if (this.shieldOn && inv.aura < 5) {
          this.shieldOn = false;
          return 'Zu wenig Aura.';
        }
        this.auraBurst(this.shieldOn);
        return null;
      case 'fokus': {
        if (this.focusT > 0) return null;
        const cost = def.cost;
        if (inv.aura < cost) return `Fokus braucht ${cost} Aura.`;
        inv.aura -= cost;
        this.focusT = 8;
        this.auraBurst(true);
        this.hooks.flash?.(PAL.red, 120);
        return null;
      }
      case 'stoss': {
        const cost = Math.round(def.cost * (1 - mods.stossCost));
        if (inv.aura < cost) return `Aura-Stoss braucht ${cost} Aura.`;
        if (this.state !== 'move' && this.state !== 'aura') return null;
        inv.aura -= cost;
        this.fireStoss(0, Game.prog.mods.bounce);
        return null;
      }
      case 'spezial': {
        const cost = Math.round(def.cost * (1 - mods.specialCost));
        if (inv.aura < cost) return `${Game.prog.techName} braucht ${cost} Aura.`;
        if (this.state !== 'move' && this.state !== 'aura' && this.state !== 'charge') return null;
        inv.aura -= cost;
        this.special();
        return null;
      }
    }
  }

  private auraBurst(on: boolean): void {
    this.setState('aura');
    if (!on) return;
    this.hooks.shake(1, 100);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.fx.spawn('sparkle', this.x + Math.cos(a) * 8, this.y - 12 + Math.sin(a) * 8, {
        tint: this.auraColor,
        vx: Math.cos(a) * 50,
        vy: Math.sin(a) * 50 - 10,
        depth: this.y + 2,
      });
    }
  }

  private aimDir(): [number, number] {
    const aim = this.hooks.aimWorld();
    if (aim) {
      const dx = aim.x - this.x;
      const dy = aim.y - (this.y - 8);
      const d = Math.max(1, Math.hypot(dx, dy));
      this.faceFrom(dx, dy);
      return [dx / d, dy / d];
    }
    // automatisches Zielen auf den nächsten Gegner in Blickrichtung
    const w = this.world;
    const [fx, fy] = DIR_VEC[this.facing];
    if (w) {
      const e = w.enemies.nearest(this.x + fx * 50, this.y + fy * 50, 90);
      if (e) {
        const dx = e.x - this.x;
        const dy = e.y - e.size * 0.4 - (this.y - 8);
        const d = Math.max(1, Math.hypot(dx, dy));
        if ((dx * fx + dy * fy) / d > 0.2) return [dx / d, dy / d];
      }
    }
    return [fx, fy];
  }

  private fireStoss(charge: number, bounces: number, scale = 1, growth = 1): void {
    const w = this.world;
    if (!w) return;
    const [dx, dy] = this.aimDir();
    const h = stossDamage(Game.inv.stats(), Game.prog.mods, charge, this.focusT > 0);
    w.projectiles.spawn({
      kind: 'aura',
      x: this.x + dx * 8,
      y: this.y + dy * 6,
      vx: dx * 230,
      vy: dy * 230,
      dmg: h.dmg,
      crit: h.crit,
      team: 'player',
      life: 0.9 + bounces * 0.35,
      radius: 5 * scale,
      bounces,
      growth,
      scale,
      tint: this.auraColor,
      pierce: scale > 1.2,
    });
    this.setState('cast');
    this.scaleX = 1.1;
    this.scaleY = 0.92;
    this.fx.spawn('ring', this.x + dx * 6, this.y - 10 + dy * 6, { tint: this.auraColor, scale: 0.35 });
  }

  /** Spezialtechnik je nach Affinität */
  private special(): void {
    const w = this.world;
    if (!w) return;
    const st = Game.inv.stats();
    const mods = Game.prog.mods;
    const color = this.auraColor;
    w.numbers.spawn(this.x, this.y - 34, Game.prog.techName, { color, small: true });
    this.hooks.flash?.(color, 90);
    switch (Game.prog.affinity) {
      case 'wurzel': {
        const r = 56 * (1 + mods.specialPower * 0.5);
        this.setState('aura');
        this.hooks.shake(4, 220);
        this.hooks.hitStop(70);
        this.fx.spawn('ring', this.x, this.y - 4, { tint: PAL.lime, scale: r / 24 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.fx.spawn('roots', this.x + Math.cos(a) * r * 0.6, this.y + Math.sin(a) * r * 0.45, { depth: this.y + Math.sin(a) * r * 0.45 });
        }
        w.enemies.hitArea(this.x, this.y - 6, r, () => specialDamage(st, mods, 1.4), { fromX: this.x, fromY: this.y, kb: 60, src: 'special', root: 2.5 + mods.root });
        if (mods.specialHeal > 0) this.heal(mods.specialHeal);
        break;
      }
      case 'stroemung': {
        this.chainHit.clear();
        this.chainT = 0;
        this.setState('special');
        this.invulnerable = true;
        break;
      }
      case 'echo': {
        this.fireStoss(0.6, 3 + mods.bounce, 1.5, 1.35);
        this.hooks.shake(2, 120);
        break;
      }
      case 'faden': {
        const r = 70 * (1 + mods.specialPower * 0.4);
        this.setState('aura');
        const net = w.scene.add.image(this.x, this.y - 6, 'fx-net').setDepth(this.y - 1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
        w.scene.tweens.add({ targets: net, scale: r / 30, duration: 220, ease: 'Back.Out' });
        w.scene.tweens.add({ targets: net, alpha: 0, delay: 900, duration: 400, onComplete: () => net.destroy() });
        w.enemies.hitArea(this.x, this.y - 6, r, () => specialDamage(st, mods, 0.6), { fromX: this.x, fromY: this.y, kb: -80, src: 'special', slow: 6 + mods.root });
        this.hooks.pullCards?.(this.x, this.y, 120 + mods.magnet);
        break;
      }
      case 'spiegel': {
        this.setState('aura');
        this.hooks.decoy?.(this.x + (this.facing === 'left' ? -18 : 18), this.y + 2, 6 + mods.decoy, 1 + mods.specialPower);
        // kurzer Sprung zur Seite – Täuschung
        this.startRoll(this.facing === 'left' ? 1 : -1, 0);
        break;
      }
    }
  }

  /** Strömung: Blitzkette von Gegner zu Gegner */
  private updateChain(dt: number): void {
    const w = this.world;
    this.chainT -= dt;
    if (!w) {
      this.setState('move');
      return;
    }
    if (this.chainT > 0) return;
    const max = 5 + Game.prog.mods.chain;
    const next = this.chainHit.size < max ? w.enemies.nearest(this.x, this.y, 130, this.chainHit) : null;
    if (!next) {
      this.invulnerable = false;
      this.setState('move');
      return;
    }
    this.chainHit.add(next.id);
    // Nachbild
    const ghost = w.scene.add.image(this.sprite.x, this.sprite.y, this.key, this.sprite.frame.name).setOrigin(12 / 24, 30 / 32).setTint(this.auraColor).setAlpha(0.6).setDepth(this.y - 1);
    w.scene.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const tx = next.x - (dx / d) * 10;
    const ty = next.y - (dy / d) * 6;
    if (!this.blocked(tx, ty) || this.noclip) {
      this.x = tx;
      this.y = ty;
    }
    this.faceFrom(dx, dy);
    this.spawnSlash(1.2, 1);
    const st = Game.inv.stats();
    const mods = Game.prog.mods;
    w.enemies.damage(next, specialDamage(st, mods, 1.1), { fromX: this.x, fromY: this.y, kb: 90, src: 'special' });
    this.fx.spawn('sparkle', this.x, this.y - 12, { tint: this.auraColor, depth: this.y + 3 });
    this.hooks.hitStop(30);
    this.chainT = 0.11;
  }

  // ------------------------------------------------------------------ Schaden

  takeHit(atk: number, fromX: number, fromY: number, opts: { slow?: boolean; source?: string } = {}): number {
    if (this.state === 'down' || this.invulnerable || this.iframeT > 0 || this.state === 'special') return 0;
    const st = Game.inv.stats();
    const dmg = incomingDamage(atk, st, Game.prog.mods, this.shieldOn, this.focusT > 0);
    if (opts.slow) this.slowT = 2.2;
    this.world?.numbers.spawn(this.x, this.y - 28, String(dmg), { color: this.shieldOn ? PAL.ice : PAL.coral });
    if (this.godMode) {
      this.iframeT = 0.3;
      return dmg;
    }
    Game.inv.lp = Math.max(0, Game.inv.lp - dmg);
    Game.events.emit('vitals-changed');
    this.iframeT = HIT_IFRAMES;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.hurtDX = dx / d;
    this.hurtDY = dy / d;
    if (Game.inv.lp <= 0) {
      this.down();
      return dmg;
    }
    if (!this.shieldOn) this.setState('hurt');
    else this.fx.spawn('ring', this.x, this.y - 12, { tint: PAL.ice, scale: 0.5 });
    this.hooks.shake(this.shieldOn ? 1 : 2.5, 160);
    this.hooks.hitStop(this.shieldOn ? 30 : 70);
    if (Game.inv.lp < Game.inv.stats().lp * 0.25 && !this.auraLowWarned) {
      this.auraLowWarned = true;
      this.hooks.toast?.('Deine LP sind niedrig! Ein Heiltrank aus dem Buch hilft.');
    }
    return dmg;
  }

  /** Bewusstlos */
  private down(): void {
    this.sense = false;
    this.shieldOn = false;
    this.focusT = 0;
    this.setState('down');
    this.hooks.shake(4, 300);
    this.hooks.hitStop(140);
    this.hooks.died?.();
  }

  /** Nach dem Wiedererwachen */
  revive(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.iframeT = 2;
    this.slowT = 0;
    this.sprite.setAngle(0).clearTint();
    this.facing = 'down';
    this.setState('move');
    this.auraLowWarned = false;
    this.lastAnim = '';
    this.sync();
  }

  /** Testtreffer (Debug), Rückstoss weg von (fromX, fromY). */
  hurt(fromX: number, fromY: number): void {
    this.takeHit(10, fromX, fromY);
  }

  private spawnSlash(scale: number, step: number): void {
    const [fx, fy] = DIR_VEC[this.facing];
    const dist = 10 + scale * 4;
    const flip = step === 1;
    this.fx.spawn('slash', this.x + fx * dist, this.y - 12 + fy * dist, {
      angle: DIR_ANGLE[this.facing],
      tint: step >= 3 ? PAL.gold : this.focusT > 0 ? PAL.coral : this.auraActive ? this.auraColor : PAL.white,
      scale,
      flipX: false,
      depth: this.y + (fy < 0 ? -1 : 2),
      alpha: 1,
    });
    if (flip) this.fx.spawn('sparkle', this.x + fx * (dist + 6), this.y - 12 + fy * (dist + 6), { depth: this.y + 3 });
  }

  private pose(): PoseName {
    switch (this.state) {
      case 'attack': {
        if (this.t < 0.05) return 'atk1';
        if (this.t < 0.15) return 'atk2';
        return 'atk3';
      }
      case 'charge':
        return 'atk1';
      case 'roll':
        return this.t < 0.07 || this.t > ROLL_TIME - 0.07 ? 'roll1' : 'roll2';
      case 'hurt':
      case 'down':
        return 'hurt';
      case 'aura':
        return 'aura';
      case 'cast':
        return 'cast';
      case 'special':
        return 'atk2';
      default:
        return 'idle0';
    }
  }

  private sync(): void {
    const sx = Display.snap(this.x);
    const sy = Display.snap(this.y);
    this.sprite.setPosition(sx, sy);
    this.sprite.setDepth(this.y);
    this.sprite.setScale(this.scaleX, this.scaleY);
    this.shadow.setPosition(sx, sy + 1);
    this.shadow.setScale(this.state === 'roll' ? 1.2 : 1, 1);
    const auraVis = this.auraActive && this.state !== 'down';
    if (this.aura.visible !== auraVis) {
      this.aura.setVisible(auraVis);
      if (auraVis) this.aura.play('fx-aura-loop');
      else this.aura.stop();
    }
    if (auraVis) {
      this.aura.setPosition(sx, sy + 4);
      this.aura.setDepth(this.y - 0.5);
      this.aura.setTint(this.focusT > 0 ? PAL.red : this.auraColor);
      this.aura.setAlpha(this.sense && !this.shieldOn && this.focusT <= 0 ? 0.5 : 0.85);
    }
    this.shield.setVisible(this.shieldOn);
    if (this.shieldOn) {
      this.shield.setPosition(sx, sy + 2).setDepth(this.y + 1).setTint(this.auraColor);
      this.shield.setAlpha(0.55 + Math.sin(this.t * 8) * 0.15);
    }
    if (this.state === 'move') {
      const anim = `${this.key}-${this.moving ? 'walk' : 'idle'}-${this.facing}`;
      if (anim !== this.lastAnim) {
        this.sprite.play(anim, true);
        this.lastAnim = anim;
      }
    } else {
      if (this.lastAnim) {
        this.sprite.stop();
        this.lastAnim = '';
      }
      this.sprite.setFrame(charFrame(this.facing, this.pose()));
    }
    if (this.state === 'down') {
      this.sprite.setAngle(Math.min(90, this.t * 400) * (this.facing === 'left' ? -1 : 1));
      this.sprite.setAlpha(1);
    } else if (this.state === 'roll' && this.invulnerable) this.sprite.setAlpha(0.75);
    else if (this.iframeT > 0) this.sprite.setAlpha(Math.floor(this.iframeT * 14) % 2 ? 0.35 : 1);
    else this.sprite.setAlpha(1);
    if (this.slowT > 0 && this.state === 'move') this.sprite.setTint(PAL.tan);
    else if (this.state === 'move' && this.slowT <= 0 && this.sprite.isTinted) this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.aura.destroy();
    this.shield.destroy();
  }
}
