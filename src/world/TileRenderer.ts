import Phaser from 'phaser';
import { GAME_H, GAME_W, TILE } from '../config';
import type { WorldMap } from './WorldMap';
import type { TileComposer } from '../gfx/generators/terrainTiles';
import { Display } from '../systems/Display';

const WIN_W = Math.ceil(GAME_W / TILE) + 3;
const WIN_H = Math.ceil(GAME_H / TILE) + 3;
const DECOR_GID = 4096;

export const DEPTH = {
  water: -3000,
  ground: -2900,
  decor: -2800,
  shadows: -2000,
  overlay: 100000,
} as const;

/**
 * Fenster-Tilemap: Es existieren nur Kacheln für den sichtbaren Ausschnitt (+1 Rand).
 * Überschreitet die Kamera eine Kachelgrenze, wird das Fenster verschoben und neu befüllt.
 * Speicherbedarf und Renderkosten sind dadurch unabhängig von der Weltgrösse.
 */
export class TileRenderer {
  private readonly map: WorldMap;
  private readonly tilemap: Phaser.Tilemaps.Tilemap;
  private readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly decorLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly water: Phaser.GameObjects.TileSprite;
  private gx = -9999;
  private gy = -9999;
  private dx = -9999;
  private dy = -9999;
  private waterFrame = 0;
  private waterTime = 0;

  constructor(scene: Phaser.Scene, map: WorldMap, composer: TileComposer) {
    this.map = map;
    // Boden-Atlas als Textur anlegen (pro Karte neu)
    if (scene.textures.exists('ground')) scene.textures.remove('ground');
    scene.textures.addCanvas('ground', composer.buildAtlas().toCanvas());

    this.tilemap = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: WIN_W, height: WIN_H });
    const groundTs = this.tilemap.addTilesetImage('ground', 'ground', TILE, TILE, 0, 0, 0)!;
    const decorTs = this.tilemap.addTilesetImage('decor', 'decor', TILE, TILE, 0, 0, DECOR_GID)!;
    this.groundLayer = this.tilemap.createBlankLayer('ground', groundTs, 0, 0, WIN_W, WIN_H)!;
    this.decorLayer = this.tilemap.createBlankLayer('decor', decorTs, 0, 0, WIN_W, WIN_H)!;
    this.groundLayer.setDepth(DEPTH.ground);
    this.decorLayer.setDepth(DEPTH.decor);

    this.water = scene.add.tileSprite(0, 0, GAME_W + 64, GAME_H + 64, 'water0').setOrigin(0, 0).setDepth(DEPTH.water);
  }

  update(view: Phaser.Geom.Rectangle, dt: number): void {
    // Wasser: folgt der Kamera, Muster bleibt an der Welt verankert
    const wx = Math.floor(view.x / 32) * 32 - 32;
    const wy = Math.floor(view.y / 32) * 32 - 32;
    this.water.setPosition(wx, wy);
    this.water.setTilePosition(0, 0);
    this.waterTime += dt;
    if (this.waterTime > 0.22) {
      this.waterTime = 0;
      this.waterFrame = (this.waterFrame + 1) % 4;
      this.water.setTexture(`water${this.waterFrame}`);
    }

    // Boden (Dual-Grid, um eine halbe Kachel versetzt)
    const gx = Math.floor((view.x + TILE / 2) / TILE) - 1;
    const gy = Math.floor((view.y + TILE / 2) / TILE) - 1;
    if (gx !== this.gx || gy !== this.gy) {
      this.gx = gx;
      this.gy = gy;
      this.fillGround();
    }
    const dx = Math.floor(view.x / TILE) - 1;
    const dy = Math.floor(view.y / TILE) - 1;
    if (dx !== this.dx || dy !== this.dy) {
      this.dx = dx;
      this.dy = dy;
      this.fillDecor();
    }
  }

  private fillGround(): void {
    const m = this.map;
    const GW = m.w + 1;
    const data = this.groundLayer.layer.data;
    for (let v = 0; v < WIN_H; v++) {
      const j = this.gy + v;
      const row = data[v];
      for (let u = 0; u < WIN_W; u++) {
        const i = this.gx + u;
        const tile = row[u];
        tile.index = i < 0 || j < 0 || i > m.w || j > m.h ? -1 : m.ground[j * GW + i];
      }
    }
    this.groundLayer.setPosition(Display.snap(this.gx * TILE - TILE / 2), Display.snap(this.gy * TILE - TILE / 2));
  }

  private fillDecor(): void {
    const m = this.map;
    const data = this.decorLayer.layer.data;
    for (let v = 0; v < WIN_H; v++) {
      const j = this.dy + v;
      const row = data[v];
      for (let u = 0; u < WIN_W; u++) {
        const i = this.dx + u;
        const tile = row[u];
        if (i < 0 || j < 0 || i >= m.w || j >= m.h) {
          tile.index = -1;
          continue;
        }
        const d = m.decor[j * m.w + i];
        tile.index = d ? DECOR_GID + d - 1 : -1;
      }
    }
    this.decorLayer.setPosition(this.dx * TILE, this.dy * TILE);
  }

  destroy(): void {
    this.tilemap.destroy();
    this.water.destroy();
  }
}
