import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { abgr, PAL } from '../gfx/palette';
import { GAME_H, GAME_W, TILE } from '../config';
import { Game } from '../systems/GameState';
import type { WorldMap } from '../world/WorldMap';
import { TERRAIN_BY_ID } from '../world/terrain';
import { TOWNS } from '../data/world/layout';

/**
 * Weltkarte mit Erkundungsnebel: Nur erkundete Gebiete sind sichtbar. Städte werden
 * beschriftet, sobald man sie besucht hat. Mit der Kartografenfeder ist alles aufgedeckt.
 */
export class MapScene extends BaseScene {
  private dot!: Phaser.GameObjects.Rectangle;
  private t = 0;

  constructor() {
    super('Map');
  }

  create(data: { x: number; y: number }): void {
    this.setupCamera();
    Input.setContext('menu');
    const map = this.registry.get('worldMap') as WorldMap;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.85).setOrigin(0, 0);
    const scale = Math.min((GAME_W - 40) / map.w, (GAME_H - 46) / map.h);
    const s = scale >= 1 ? Math.floor(scale) : scale;
    const w = Math.round(map.w * s);
    const h = Math.round(map.h * s);
    const x0 = Math.round((GAME_W - w) / 2);
    const y0 = Math.round((GAME_H - h) / 2) + 8;
    addPanel(this, x0 - 8, y0 - 8, w + 16, h + 16, 'ui-frame-paper');
    const key = `worldmap-${Game.player.map}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = document.createElement('canvas');
    canvas.width = map.w;
    canvas.height = map.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(map.w, map.h);
    const px = new Uint32Array(img.data.buffer);
    const all = Game.hasThing('021');
    const fog = abgr(PAL.sandShade);
    const fogDark = abgr(PAL.tan);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        const seen = all || Game.explored.has(`${Game.player.map}:${Math.floor(x / 8)},${Math.floor(y / 8)}`);
        if (seen) {
          px[i] = abgr(TERRAIN_BY_ID[map.terrain[i]].mini);
          const d = map.decor[i];
          if (d === 8 || d === 9) px[i] = abgr(PAL.wood);
        } else px[i] = (x + y) % 2 ? fog : fogDark;
      }
    }
    // Gebäude als Punkte
    for (const o of map.objects) {
      const tx = Math.floor(o.x / TILE);
      const ty = Math.floor(o.y / TILE);
      if (!all && !Game.explored.has(`${Game.player.map}:${Math.floor(tx / 8)},${Math.floor(ty / 8)}`)) continue;
      if (/house|shop|inn|tower|hall|casino|arena|gate|lighthouse|windmill|tent|stall/.test(o.def.texture)) px[ty * map.w + tx] = abgr(PAL.red);
      if (o.def.texture === 'campfire') px[ty * map.w + tx] = abgr(PAL.orange);
    }
    ctx.putImageData(img, 0, 0);
    this.textures.addCanvas(key, canvas);
    this.add.image(x0, y0, key).setOrigin(0, 0).setScale(s);
    addText(this, GAME_W / 2, 4, Game.player.map === 'insel' ? 'Insel der 100 Karten' : 'Karte', { font: 'px-o', ox: 0.5, color: PAL.gold });
    if (Game.player.map === 'insel') {
      for (const t of TOWNS) {
        if (!Game.visited.has(t.id) && !all) continue;
        const tx = x0 + t.x * s;
        const ty = y0 + t.y * s;
        this.add.rectangle(tx, ty, 3, 3, PAL.gold).setStrokeStyle(1, PAL.ink);
        addText(this, tx, ty - 12, t.name, { font: 'px-o', ox: 0.5, color: PAL.white });
      }
      // verfolgte Rivalen (Suchfalke)
      for (const r of Game.rivals.list) {
        if (r.trackedUntil > Game.playTime && r.map === 'insel') {
          this.add.rectangle(x0 + (r.x / TILE) * s, y0 + (r.y / TILE) * s, 3, 3, PAL.magenta);
          addText(this, x0 + (r.x / TILE) * s, y0 + (r.y / TILE) * s + 4, r.name, { font: 'px', ox: 0.5, color: PAL.pink });
        }
      }
    }
    this.dot = this.add.rectangle(x0 + (data.x / TILE) * s, y0 + (data.y / TILE) * s, 4, 4, PAL.white).setStrokeStyle(1, PAL.red);
    addText(this, GAME_W / 2, GAME_H - 12, all ? 'Kartografenfeder: ganze Insel aufgedeckt · M/Esc schliessen' : 'Erkunde die Insel, um die Karte aufzudecken · M/Esc schliessen', {
      font: 'px',
      ox: 0.5,
      color: PAL.mist,
    });
    this.input.on('pointerdown', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.setVisible(true, 'Hud');
    this.scene.resume('Hud');
    this.scene.resume('World');
  }

  override update(_t: number, delta: number): void {
    this.t += delta;
    this.dot.setVisible(Math.floor(this.t / 300) % 2 === 0);
    if (this.t < 150) return;
    if (Input.justPressed('map') || Input.cancel() || Input.justPressed('pause')) this.close();
  }
}
