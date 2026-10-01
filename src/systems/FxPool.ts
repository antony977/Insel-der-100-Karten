import Phaser from 'phaser';

export interface FxDef {
  texture: string;
  frames: number;
  fps: number;
  blend?: Phaser.BlendModes;
}

export const FX = {
  slash: { texture: 'fx-slash', frames: 3, fps: 24, blend: Phaser.BlendModes.ADD },
  dust: { texture: 'fx-dust', frames: 4, fps: 14 },
  sparkle: { texture: 'fx-sparkle', frames: 4, fps: 16, blend: Phaser.BlendModes.ADD },
  impact: { texture: 'fx-impact', frames: 3, fps: 20, blend: Phaser.BlendModes.ADD },
} satisfies Record<string, FxDef>;

export type FxName = keyof typeof FX;

export interface FxOptions {
  tint?: number;
  angle?: number;
  depth?: number;
  flipX?: boolean;
  alpha?: number;
  scale?: number;
  vx?: number;
  vy?: number;
}

interface Live {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
}

/**
 * Objekt-Pool für kurze Effekt-Animationen (Schlagbögen, Staub, Funken).
 * Keine Neuerzeugung im Spielverlauf – Sprites werden wiederverwendet.
 */
export class FxPool {
  private readonly scene: Phaser.Scene;
  private readonly pool: Phaser.GameObjects.Sprite[] = [];
  private readonly live: Live[] = [];

  constructor(scene: Phaser.Scene, prewarm = 24) {
    this.scene = scene;
    for (const [name, def] of Object.entries(FX)) {
      const key = `fx-${name}`;
      if (!scene.anims.exists(key)) {
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(def.texture, { start: 0, end: def.frames - 1 }),
          frameRate: def.fps,
          repeat: 0,
        });
      }
    }
    for (let i = 0; i < prewarm; i++) this.pool.push(this.create());
  }

  private create(): Phaser.GameObjects.Sprite {
    const s = this.scene.add.sprite(0, 0, 'fx-dust').setVisible(false).setActive(false);
    s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.release(s));
    return s;
  }

  spawn(name: FxName, x: number, y: number, o: FxOptions = {}): Phaser.GameObjects.Sprite {
    const def = FX[name] as FxDef;
    const s = this.pool.pop() ?? this.create();
    s.setTexture(def.texture, 0);
    s.setPosition(x, y);
    s.setAngle(o.angle ?? 0);
    s.setFlipX(!!o.flipX);
    s.setAlpha(o.alpha ?? 1);
    s.setScale(o.scale ?? 1);
    s.setDepth(o.depth ?? y + 1);
    s.setBlendMode(def.blend ?? Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) s.setTint(o.tint);
    else s.clearTint();
    s.setVisible(true).setActive(true);
    s.play(`fx-${name}`);
    this.live.push({ sprite: s, vx: o.vx ?? 0, vy: o.vy ?? 0 });
    return s;
  }

  /** Bewegt Effekte mit Geschwindigkeit (z. B. aufsteigende Funken). */
  update(dt: number): void {
    for (let i = 0; i < this.live.length; i++) {
      const l = this.live[i];
      if (l.vx || l.vy) l.sprite.setPosition(l.sprite.x + l.vx * dt, l.sprite.y + l.vy * dt);
    }
  }

  private release(s: Phaser.GameObjects.Sprite): void {
    s.setVisible(false).setActive(false);
    const idx = this.live.findIndex((l) => l.sprite === s);
    if (idx >= 0) {
      this.live[idx] = this.live[this.live.length - 1];
      this.live.pop();
    }
    this.pool.push(s);
  }
}
