import Phaser from 'phaser';
import { PAL } from '../../gfx/palette';

interface Num {
  t: Phaser.GameObjects.BitmapText;
  x: number;
  y: number;
  vy: number;
  vx: number;
  age: number;
  life: number;
  big: boolean;
}

/**
 * Schadenszahlen: dicke Pixelziffern mit Umriss, die mit einem Hüpfer aus dem Treffer
 * springen. Kritische Treffer sind grösser und gelb-orange. Objekt-Pool ohne Neuerzeugung.
 */
export class DamageNumbers {
  private readonly pool: Phaser.GameObjects.BitmapText[] = [];
  private readonly live: Num[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, prewarm = 24) {
    this.scene = scene;
    for (let i = 0; i < prewarm; i++) this.pool.push(this.make());
  }

  private make(): Phaser.GameObjects.BitmapText {
    return this.scene.add.bitmapText(0, 0, 'px-o', '', 8).setOrigin(0.5, 1).setVisible(false).setDepth(160000);
  }

  /** Zahl oder kurzer Text (z. B. „Klonk!") */
  spawn(x: number, y: number, text: string, opts: { color?: number; crit?: boolean; heal?: boolean; small?: boolean } = {}): void {
    const t = this.pool.pop() ?? this.make();
    const big = !!opts.crit;
    t.setText(text);
    t.setScale(big ? 2 : 1);
    t.setTint(opts.color ?? (opts.heal ? PAL.lime : big ? PAL.gold : PAL.white));
    t.setVisible(true).setAlpha(1);
    const n: Num = {
      t,
      x,
      y,
      vy: big ? -95 : -75,
      vx: (Math.random() - 0.5) * 30,
      age: 0,
      life: big ? 0.95 : opts.small ? 0.6 : 0.75,
      big,
    };
    this.live.push(n);
    t.setPosition(Math.round(x), Math.round(y));
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const n = this.live[i];
      n.age += dt;
      n.vy += 260 * dt;
      if (n.vy > 40) n.vy = 40;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      // Pop: kurz grösser, dann zurück
      const pop = n.age < 0.08 ? 1 + n.age * 4 : 1;
      n.t.setScale((n.big ? 2 : 1) * pop);
      n.t.setPosition(Math.round(n.x), Math.round(n.y));
      const fade = n.life - 0.25;
      if (n.age > fade) n.t.setAlpha(Math.max(0, 1 - (n.age - fade) / 0.25));
      if (n.age >= n.life) {
        n.t.setVisible(false);
        this.pool.push(n.t);
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
      }
    }
  }
}
