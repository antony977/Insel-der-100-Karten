import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { buildTestMap } from '../data/maps/testMap';
import { buildGround } from '../world/groundBuilder';
import { TileRenderer } from '../world/TileRenderer';
import { ObjectStreamer } from '../world/ObjectStreamer';
import type { WorldMap } from '../world/WorldMap';
import { FxPool } from '../systems/FxPool';
import { Player, createCharacterAnims } from '../entities/Player';
import { Input } from '../input/InputManager';
import { Display } from '../systems/Display';
import { Settings } from '../systems/Settings';
import { DEBUG, GAME_H, GAME_W, TILE } from '../config';
import { charFrame } from '../gfx/generators/characters';
import { exportTextures } from '../gfx/AssetLoader';
import { PAL } from '../gfx/palette';
import { HUD_EVENTS, type HudMessage } from './HudScene';

interface Npc {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  name: string;
  lines: string[];
  line: number;
}

const INTERACT_TEXT: Record<string, HudMessage> = {
  campfire: { name: 'Rastfeuer', text: 'Ein gemütliches Rastfeuer knistert. Hier wirst du später speichern und dich ausruhen können.' },
  well: { name: 'Brunnen', text: 'Ein alter Brunnen. Nach einer Niederlage erwachst du am zuletzt berührten Stadtbrunnen.' },
  house: { name: 'Haus', text: 'Die Tür ist verschlossen. Drinnen brennt kein Licht.' },
};

/** Spielwelt (Meilenstein 1: Testwiese). */
export class WorldScene extends BaseScene {
  private map!: WorldMap;
  private tiles!: TileRenderer;
  private objects!: ObjectStreamer;
  private fx!: FxPool;
  player!: Player;
  private npcs: Npc[] = [];
  private crosshair!: Phaser.GameObjects.Image;
  private camX = 0;
  private camY = 0;
  private shakeT = 0;
  private shakeDur = 1;
  private shakeAmp = 0;
  private hitStopUntil = 0;
  private debugGfx: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('World');
  }

  create(): void {
    this.setupCamera(true);
    Input.setContext('gameplay');
    this.npcs = [];

    this.map = buildTestMap();
    const composer = buildGround(this.map);
    this.tiles = new TileRenderer(this, this.map, composer);
    this.objects = new ObjectStreamer(this, this.map);
    this.fx = new FxPool(this);

    this.player = new Player(this, 'player', this.map.spawnX, this.map.spawnY, this.map, this.fx, {
      shake: (i, d) => this.shake(i, d),
      hitStop: (ms) => this.hitStop(ms),
      interact: (x, y) => this.tryInteract(x, y),
      spell: (slot) => this.toast(`Schnellzauber ${slot}: noch leer – Zauberkarten gibt es ab Meilenstein 4.`),
      aimWorld: () => this.aimWorld(),
    });

    this.addNpc('npc-lumi', this.map.spawnX + 40, this.map.spawnY - 26, 'Lumi', [
      'Willkommen auf der Insel der 100 Karten! Ich bin Lumi, die Hüterin des Ersten Tors.',
      'Hier ist alles eine Karte. Bald kannst du mit B dein Kartenbuch herbeirufen.',
      'Probier ruhig alles aus: Angriff (A/Leertaste), Ausweichen (B/Shift) und deine Aura (Q).',
    ]);

    this.crosshair = this.add.image(0, 0, 'ui-crosshair').setDepth(200000).setVisible(false);
    this.camX = this.player.x;
    this.camY = this.player.y - 12;
    this.updateCamera(0);
    this.tiles.update(this.cameras.main.worldView, 0);
    this.objects.update(this.cameras.main.worldView);

    // Maus: Linksklick = Angriff, Rechtsklick = Ausweichen
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || this.messageOpen()) return;
      if (p.rightButtonDown()) Input.press('dodge', 'mouse');
      else Input.press('attack', 'mouse');
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      Input.release('attack', 'mouse');
      Input.release('dodge', 'mouse');
    });

    this.registry.set('worldMap', this.map);
    this.scene.launch('Hud');
    this.events.on(Phaser.Scenes.Events.RESUME, () => Input.setContext('gameplay'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tiles.destroy();
      this.objects.destroy();
      this.scene.stop('Hud');
    });
    this.cameras.main.fadeIn(350, 13, 10, 20);
    this.time.delayedCall(600, () =>
      this.toast('Willkommen auf der Testwiese! Sprich mit Lumi (Angriff/Interagieren in ihrer Nähe).'),
    );
  }

  protected override onRenderScale(): void {
    this.updateCamera(0);
  }

  private addNpc(key: string, x: number, y: number, name: string, lines: string[]): void {
    createCharacterAnims(this, key);
    const shadow = this.add.image(x, y, 'shadow').setDepth(-2000);
    const sprite = this.add.sprite(x, y, key, charFrame('down', 'idle0')).setOrigin(0.5, 30 / 32).setDepth(y);
    sprite.play(`${key}-idle-down`);
    this.map.chunkBoxes[this.map.chunkIndexAt(x, y)]?.push({ x: x - 5, y: y - 6, w: 10, h: 6, obj: -1 });
    this.npcs.push({ sprite, shadow, x, y, name, lines, line: 0 });
  }

  private messageOpen(): boolean {
    return this.registry.get('messageOpen') === true;
  }

  private message(m: HudMessage): void {
    this.game.events.emit(HUD_EVENTS.message, m);
  }

  toast(text: string): void {
    this.game.events.emit(HUD_EVENTS.toast, text);
  }

  private tryInteract(px: number, py: number): boolean {
    for (const n of this.npcs) {
      if (Math.hypot(n.x - px, n.y - 6 - py) < 22) {
        // NPC schaut zur Spielfigur
        const dx = this.player.x - n.x;
        const dy = this.player.y - n.y;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        n.sprite.play(`${n.sprite.texture.key}-idle-${dir}`);
        this.message({ name: n.name, text: n.lines[n.line], portrait: n.sprite.texture.key });
        n.line = (n.line + 1) % n.lines.length;
        return true;
      }
    }
    const o = this.map.findInteractable(px, py, 20);
    if (!o) return false;
    if (o.def.interact === 'sign') this.message({ name: 'Schild', text: o.text ?? '…' });
    else this.message(INTERACT_TEXT[o.def.interact ?? ''] ?? { name: '', text: '…' });
    return true;
  }

  private aimWorld(): { x: number; y: number } | null {
    if (!Input.mouseAiming) return null;
    const p = this.input.activePointer;
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  shake(intensity: number, durationMs: number): void {
    if (!Settings.get().screenShake) return;
    if (intensity >= this.shakeAmp || this.shakeT <= 0) {
      this.shakeAmp = intensity;
      this.shakeDur = durationMs / 1000;
      this.shakeT = this.shakeDur;
    }
  }

  hitStop(ms: number): void {
    this.hitStopUntil = this.time.now + ms;
    this.anims.pauseAll();
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const tx = this.player.x;
    const ty = this.player.y - 12;
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt * 9);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    const hw = GAME_W / 2;
    const hh = GAME_H / 2;
    this.camX = Phaser.Math.Clamp(this.camX, hw, this.map.pixelWidth - hw);
    this.camY = Phaser.Math.Clamp(this.camY, hh, this.map.pixelHeight - hh);
    let ox = 0;
    let oy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / this.shakeDur);
      ox = Math.round((Math.random() * 2 - 1) * a);
      oy = Math.round((Math.random() * 2 - 1) * a);
    }
    cam.centerOn(Display.snap(this.camX) + ox, Display.snap(this.camY) + oy);
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const p = this.input.activePointer;
    const r = Display.renderScale;
    Input.setPointer(p.x / r, p.y / r, time);

    if (this.hitStopUntil > 0) {
      if (time < this.hitStopUntil) return;
      this.hitStopUntil = 0;
      this.anims.resumeAll();
    }

    if (!this.messageOpen()) {
      if (Input.justPressed('pause')) {
        this.openPause();
        return;
      }
      if (Input.justPressed('book')) this.toast('Das Kartenbuch erscheint in Meilenstein 2 – „Buch!"');
      if (Input.justPressed('map')) this.toast('Die Weltkarte mit Fog-of-War folgt mit den Regionen.');
      this.player.update(dt, Input);
    }
    if (DEBUG) this.debugKeys();

    this.updateCamera(dt);
    const view = this.cameras.main.worldView;
    this.tiles.update(view, dt);
    this.objects.update(view);
    this.fx.update(dt);

    for (const n of this.npcs) {
      n.sprite.setPosition(n.x, n.y);
      n.shadow.setPosition(n.x, n.y);
    }

    const aim = this.aimWorld();
    this.crosshair.setVisible(!!aim && !this.messageOpen());
    if (aim) this.crosshair.setPosition(Math.round(aim.x), Math.round(aim.y));
    this.input.setDefaultCursor(aim ? 'none' : (this.registry.get('cursorCss') as string) ?? 'default');

    this.registry.set('playerCell', [Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE)]);
    this.registry.set('playerPos', [this.player.x, this.player.y]);
    this.registry.set('activeObjects', this.objects.activeCount);
  }

  openPause(): void {
    Input.setContext('menu');
    this.scene.pause();
    this.scene.pause('Hud');
    this.scene.launch('Pause');
  }

  private debugKeys(): void {
    if (Input.keyPressed('F2')) {
      if (this.debugGfx) {
        this.debugGfx.destroy();
        this.debugGfx = null;
      } else {
        this.debugGfx = this.add.graphics().setDepth(150000);
      }
    }
    if (Input.keyPressed('F3')) {
      this.player.noclip = !this.player.noclip;
      this.toast(`Noclip ${this.player.noclip ? 'an' : 'aus'}`);
    }
    if (Input.keyPressed('F4')) {
      const colors: number[] = [PAL.cyan, PAL.grass, PAL.violet, PAL.gold, PAL.pink];
      this.player.auraColor = colors[(colors.indexOf(this.player.auraColor) + 1) % colors.length];
    }
    if (Input.keyPressed('F6')) this.player.hurt(this.player.x + 10, this.player.y);
    if (Input.keyPressed('F9')) exportTextures(this);
    if (Input.keyPressed('KeyT') && Input.mouseAiming) {
      const a = this.aimWorld();
      if (a) {
        this.player.x = a.x;
        this.player.y = a.y;
      }
    }
    if (this.debugGfx) {
      const g = this.debugGfx;
      g.clear();
      const v = this.cameras.main.worldView;
      g.lineStyle(1, 0xff3355, 0.9);
      for (let cy = Math.floor(v.y / TILE); cy <= Math.floor(v.bottom / TILE); cy++) {
        for (let cx = Math.floor(v.x / TILE); cx <= Math.floor(v.right / TILE); cx++) {
          if (this.map.isSolidCell(cx, cy)) g.strokeRect(cx * TILE + 0.5, cy * TILE + 0.5, TILE - 1, TILE - 1);
        }
      }
      g.lineStyle(1, 0x33ddff, 0.9);
      const ck = this.map.chunkIndexAt(this.player.x, this.player.y);
      for (const b of this.map.chunkBoxes[ck] ?? []) g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      g.lineStyle(1, 0xffee44, 1);
      g.strokeRect(this.player.x - 5 + 0.5, this.player.y - 6 + 0.5, 9, 5);
    }
  }
}
