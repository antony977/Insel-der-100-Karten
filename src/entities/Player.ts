import Phaser from 'phaser';
import { charFrame, DIRS, type Dir, type PoseName } from '../gfx/generators/characters';
import type { InputManager } from '../input/InputManager';
import type { WorldMap } from '../world/WorldMap';
import type { FxPool } from '../systems/FxPool';
import { Display } from '../systems/Display';
import { DEPTH } from '../world/TileRenderer';
import { PAL } from '../gfx/palette';

export type PlayerState = 'move' | 'attack' | 'charge' | 'roll' | 'hurt' | 'aura' | 'cast';

const WALK_SPEED = 84;
const ROLL_SPEED = 210;
const ROLL_TIME = 0.34;
const ROLL_IFRAMES = 0.26;
const COMBO_TIMES = [0.24, 0.24, 0.34];
const CHARGE_TIME = 0.45;
const BOX_W = 10;
const BOX_H = 6;

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
}

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly aura: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  facing: Dir = 'down';
  state: PlayerState = 'move';
  /** Unverwundbarkeit (Ausweichrolle) */
  invulnerable = false;
  auraOn = false;
  auraColor: number = PAL.cyan;
  noclip = false;
  moving = false;

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
    this.sync();
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

  update(dt: number, input: InputManager): void {
    this.t += dt;
    const mx = input.moveX;
    const my = input.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));

    if (input.isDown('attack')) this.holdTime += dt;
    else this.holdTime = 0;

    // Zauber-Slots (Platzhalter bis Meilenstein 4)
    for (let i = 0; i < 3; i++) {
      if (input.justPressed((['spell1', 'spell2', 'spell3'] as const)[i]) && (this.state === 'move' || this.state === 'aura')) {
        this.setState('cast');
        this.hooks.spell(i + 1);
        for (let k = 0; k < 6; k++) {
          this.fx.spawn('sparkle', this.x + (Math.random() - 0.5) * 20, this.y - 20 + (Math.random() - 0.5) * 16, {
            tint: PAL.gold,
            vy: -20,
            depth: this.y + 2,
          });
        }
      }
    }

    switch (this.state) {
      case 'move': {
        this.moving = mag > 0.05;
        if (this.moving) {
          this.faceFrom(mx, my);
          const sp = WALK_SPEED * mag;
          this.moveBy(mx * sp * dt, my * sp * dt);
          this.dustT -= dt * mag;
          if (this.dustT <= 0 && mag > 0.6) {
            this.dustT = 0.28;
            this.fx.spawn('dust', this.x - mx * 4, this.y - 1, { depth: this.y - 1, alpha: 0.6 });
          }
        }
        if (input.justPressed('dodge')) this.startRoll(mx, my);
        else if (input.justPressed('attack')) {
          const [fx, fy] = DIR_VEC[this.facing];
          if (!this.hooks.interact(this.x + fx * 12, this.y - 4 + fy * 12)) this.startAttack(0);
        } else if (input.justPressed('aura')) this.toggleAura();
        break;
      }
      case 'attack': {
        const dur = COMBO_TIMES[this.combo];
        const strikeAt = 0.05;
        if (!this.slashDone && this.t >= strikeAt) {
          this.slashDone = true;
          this.spawnSlash(this.combo === 2 ? 1.25 : 1, this.combo);
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
        const sp = ROLL_SPEED * (0.45 + 0.55 * k);
        this.moveBy(this.rollDX * sp * dt, this.rollDY * sp * dt);
        this.invulnerable = this.t < ROLL_IFRAMES;
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
        if (this.t >= 0.35) this.setState('move');
        break;
      }
      case 'aura':
      case 'cast': {
        if (this.t >= (this.state === 'aura' ? 0.42 : 0.4)) this.setState('move');
        break;
      }
    }

    // Squash & Stretch zurückfedern
    const back = 1 - Math.exp(-dt * 14);
    this.scaleX += (1 - this.scaleX) * back;
    this.scaleY += (1 - this.scaleY) * back;
    this.sync();
  }

  private startAttack(step: number): void {
    this.combo = step;
    this.queued = false;
    this.slashDone = false;
    if (this.hooks.aimWorld()) this.faceAim();
    this.setState('attack');
    this.scaleX = 0.92;
    this.scaleY = 1.06;
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
    for (let i = 0; i < 3; i++) {
      this.fx.spawn('dust', this.x - dx * (4 + i * 4) + (Math.random() - 0.5) * 6, this.y - 1, { depth: this.y - 1 });
    }
  }

  toggleAura(): void {
    this.auraOn = !this.auraOn;
    this.aura.setVisible(this.auraOn);
    if (this.auraOn) {
      this.aura.play('fx-aura-loop');
      this.setState('aura');
      this.hooks.shake(1, 120);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.fx.spawn('sparkle', this.x + Math.cos(a) * 8, this.y - 12 + Math.sin(a) * 8, {
          tint: this.auraColor,
          vx: Math.cos(a) * 50,
          vy: Math.sin(a) * 50 - 10,
          depth: this.y + 2,
        });
      }
    } else this.aura.stop();
  }

  /** Testtreffer (Debug), Rückstoss weg von (fromX, fromY). */
  hurt(fromX: number, fromY: number): void {
    if (this.invulnerable) return;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.hurtDX = dx / d;
    this.hurtDY = dy / d;
    this.setState('hurt');
    this.hooks.shake(2.5, 160);
    this.hooks.hitStop(70);
  }

  private spawnSlash(scale: number, step: number): void {
    const [fx, fy] = DIR_VEC[this.facing];
    const dist = 10 + scale * 4;
    const flip = step === 1;
    this.fx.spawn('slash', this.x + fx * dist, this.y - 12 + fy * dist, {
      angle: DIR_ANGLE[this.facing],
      tint: step >= 3 ? PAL.gold : this.auraOn ? this.auraColor : PAL.white,
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
        return 'hurt';
      case 'aura':
        return 'aura';
      case 'cast':
        return 'cast';
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
    if (this.auraOn) {
      this.aura.setPosition(sx, sy + 4);
      this.aura.setDepth(this.y - 0.5);
      this.aura.setTint(this.auraColor);
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
    if (this.state === 'roll' && this.invulnerable) this.sprite.setAlpha(0.75);
    else this.sprite.setAlpha(1);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.aura.destroy();
  }
}

