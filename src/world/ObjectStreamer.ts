import Phaser from 'phaser';
import { CHUNK_PX, type WorldMap } from './WorldMap';

/**
 * Zonen-Streaming für Weltobjekte: Sprites existieren nur für Chunks in Kameranähe und
 * werden aus einem Pool wiederverwendet. Tiefe = Fusspunkt-y (Y-Sortierung).
 */
export class ObjectStreamer {
  private readonly scene: Phaser.Scene;
  private readonly map: WorldMap;
  private readonly pool: Phaser.GameObjects.Sprite[] = [];
  private readonly active = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly activeChunks = new Set<number>();
  private kx0 = -1;
  private ky0 = -1;
  private kx1 = -1;
  private ky1 = -1;
  private readonly margin = 96;

  constructor(scene: Phaser.Scene, map: WorldMap) {
    this.scene = scene;
    this.map = map;
    // Animationen für animierte Objekte (z. B. Lagerfeuer)
    for (const o of map.objects) {
      const a = o.def.anim;
      const key = `obj-${o.def.texture}`;
      if (a && !scene.anims.exists(key)) {
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(o.def.texture, { start: 0, end: a.frames - 1 }),
          frameRate: a.fps,
          repeat: -1,
        });
      }
    }
  }

  get activeCount(): number {
    return this.active.size;
  }

  update(view: Phaser.Geom.Rectangle): void {
    const m = this.map;
    const kx0 = Math.max(0, Math.floor((view.x - this.margin) / CHUNK_PX));
    const ky0 = Math.max(0, Math.floor((view.y - this.margin) / CHUNK_PX));
    const kx1 = Math.min(m.chunksX - 1, Math.floor((view.right + this.margin) / CHUNK_PX));
    // Objekte unterhalb des Bildes ragen mit ihrer Höhe ins Bild → zusätzlicher Rand unten
    const ky1 = Math.min(m.chunksY - 1, Math.floor((view.bottom + this.margin + 64) / CHUNK_PX));
    if (kx0 === this.kx0 && ky0 === this.ky0 && kx1 === this.kx1 && ky1 === this.ky1) return;
    this.kx0 = kx0;
    this.ky0 = ky0;
    this.kx1 = kx1;
    this.ky1 = ky1;
    // Chunks entladen
    for (const k of this.activeChunks) {
      const kx = k % m.chunksX;
      const ky = Math.floor(k / m.chunksX);
      if (kx < kx0 || kx > kx1 || ky < ky0 || ky > ky1) {
        this.activeChunks.delete(k);
        for (const i of m.chunkObjects[k]) this.release(i);
      }
    }
    // Chunks laden
    for (let ky = ky0; ky <= ky1; ky++) {
      for (let kx = kx0; kx <= kx1; kx++) {
        const k = ky * m.chunksX + kx;
        if (this.activeChunks.has(k)) continue;
        this.activeChunks.add(k);
        for (const i of m.chunkObjects[k]) this.acquire(i);
      }
    }
  }

  private acquire(i: number): void {
    if (this.active.has(i)) return;
    const o = this.map.objects[i];
    let s = this.pool.pop();
    if (!s) s = this.scene.add.sprite(0, 0, o.def.texture);
    s.setTexture(o.def.texture, 0);
    s.setOrigin(o.def.footX / s.width, o.def.footY / s.height);
    s.setPosition(o.x, o.y);
    s.setDepth(o.y);
    s.setVisible(true).setActive(true);
    if (o.def.anim) s.play({ key: `obj-${o.def.texture}`, startFrame: i % o.def.anim.frames });
    this.active.set(i, s);
  }

  private release(i: number): void {
    const s = this.active.get(i);
    if (!s) return;
    s.stop();
    s.setVisible(false).setActive(false);
    this.active.delete(i);
    this.pool.push(s);
  }

  destroy(): void {
    for (const s of this.active.values()) s.destroy();
    for (const s of this.pool) s.destroy();
    this.active.clear();
    this.pool.length = 0;
  }
}
