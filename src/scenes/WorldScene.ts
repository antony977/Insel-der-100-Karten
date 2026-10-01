import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { buildTestMap } from '../data/maps/testMap';
import { buildGround } from '../world/groundBuilder';
import { TileRenderer } from '../world/TileRenderer';
import { ObjectStreamer } from '../world/ObjectStreamer';
import { GroundItems } from '../world/GroundItems';
import type { WorldMap, WorldObject } from '../world/WorldMap';
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
import { Game } from '../systems/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { ALL_CARDS, cardIndex, cardLabel, SAMMELKARTEN, ZAUBERKARTEN } from '../data/cards';
import type { CardDef, Rank } from '../data/cardTypes';
import { STARTER_CARDS, TREASURES, WISHING_WELL } from '../data/treasures';

interface Npc {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  name: string;
  lines: string[];
  line: number;
  onTalk?: () => boolean;
}

const INTERACT_TEXT: Record<string, HudMessage> = {
  campfire: { name: 'Rastfeuer', text: 'Ein gemütliches Rastfeuer knistert. Hier wirst du später speichern und dich ausruhen können.' },
  house: { name: 'Haus', text: 'Die Tür ist verschlossen. Drinnen brennt kein Licht.' },
};

const AUTOSAVE_SECONDS = 30;

/** Spielwelt (Testwiese) mit Kartenbuch-Anbindung. */
export class WorldScene extends BaseScene {
  private map!: WorldMap;
  private tiles!: TileRenderer;
  private objects!: ObjectStreamer;
  private ground!: GroundItems;
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
  private continueGame = false;
  private autosaveT = 0;
  private pendingCards: CardDef[] = [];

  constructor() {
    super('World');
  }

  init(data: { continue?: boolean }): void {
    this.continueGame = !!data?.continue;
  }

  create(): void {
    this.setupCamera(true);
    Input.setContext('gameplay');
    this.npcs = [];
    this.autosaveT = 0;
    this.pendingCards = [];

    this.map = buildTestMap();
    if (!this.continueGame) {
      Game.newGame();
      Game.player.map = 'testwiese';
      Game.player.x = this.map.spawnX;
      Game.player.y = this.map.spawnY;
    }
    // geöffnete Truhen
    this.map.objects.forEach((o) => {
      if (o.tag && Game.flags.has(`offen:${o.tag}`)) o.frame = 1;
    });
    const composer = buildGround(this.map);
    this.tiles = new TileRenderer(this, this.map, composer);
    this.objects = new ObjectStreamer(this, this.map);
    this.fx = new FxPool(this);
    this.ground = new GroundItems(this, Game.player.map);

    const start = this.validStart();
    this.player = new Player(this, 'player', start.x, start.y, this.map, this.fx, {
      shake: (i, d) => this.shake(i, d),
      hitStop: (ms) => this.hitStop(ms),
      interact: (x, y) => this.tryInteract(x, y),
      spell: (slot) => this.toast(`Schnellzauber ${slot}: Zauber wirken folgt in Meilenstein 4.`),
      aimWorld: () => this.aimWorld(),
    });

    this.addNpc('npc-lumi', this.map.spawnX + 40, this.map.spawnY - 26, 'Lumi', [
      'Ruf jederzeit dein Buch mit B (oder dem Buch-Knopf). Neue Karten liegen zuerst in deiner Hand.',
      'Eine Karte, die länger als 60 Sekunden ausserhalb des Buchs ist, verwandelt sich für immer in ihren Gegenstand.',
      'Mit „Entfessle!" verwandelst du eine Karte absichtlich – etwa einen Heiltrank, wenn du ihn brauchst.',
      'Jede Karte gibt es nur begrenzt oft auf der Insel. Ist das Limit erreicht, bekommst du sie nur noch von anderen.',
      'Am Brunnen auf dem Platz kannst du für 10 Münzen dein Glück versuchen. Und halte Ausschau nach Truhen!',
    ], () => this.lumiStart());

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

    // Spielereignisse
    const offs = [
      Game.events.on('card-received', (def, uid) => this.onCardReceived(def, uid)),
      Game.events.on('card-limit', (def) =>
        this.toast(`Alle ${def.limit} Exemplare von „${def.name}" sind bereits im Umlauf – jetzt nur noch von anderen Spielern zu bekommen.`),
      ),
      Game.events.on('card-transformed', (def, msg) => this.toast(`Zu spät! ${cardLabel(def)} ${def.name} hat sich verwandelt. ${msg}`)),
      Game.events.on('message', (t) => this.toast(t)),
    ];

    this.registry.set('worldMap', this.map);
    this.registry.set('worldActive', true);
    this.scene.launch('Hud');
    this.events.on(Phaser.Scenes.Events.RESUME, () => Input.setContext('gameplay'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((o) => o());
      this.tiles.destroy();
      this.objects.destroy();
      this.ground.destroy();
      this.registry.set('worldActive', false);
      this.scene.stop('Hud');
    });
    this.cameras.main.fadeIn(350, 13, 10, 20);
    if (!this.continueGame) {
      this.time.delayedCall(600, () => this.toast('Willkommen auf der Insel! Sprich mit Lumi – sie steht gleich neben dir.'));
    } else {
      this.time.delayedCall(400, () => this.toast('Spielstand geladen.'));
    }
  }

  /** Gespeicherte Position nur verwenden, wenn sie frei ist. */
  private validStart(): { x: number; y: number } {
    const { x, y } = Game.player;
    if (x > 0 && y > 0 && !this.map.boxBlocked(x - 5, y - 6, 10, 6)) return { x, y };
    return { x: this.map.spawnX, y: this.map.spawnY };
  }

  protected override onRenderScale(): void {
    this.updateCamera(0);
  }

  private addNpc(key: string, x: number, y: number, name: string, lines: string[], onTalk?: () => boolean): void {
    createCharacterAnims(this, key);
    const shadow = this.add.image(x, y, 'shadow').setDepth(-2000);
    const sprite = this.add.sprite(x, y, key, charFrame('down', 'idle0')).setOrigin(0.5, 30 / 32).setDepth(y);
    sprite.play(`${key}-idle-down`);
    this.map.chunkBoxes[this.map.chunkIndexAt(x, y)]?.push({ x: x - 5, y: y - 6, w: 10, h: 6, obj: -1 });
    this.npcs.push({ sprite, shadow, x, y, name, lines, line: 0, onTalk });
  }

  private messageOpen(): boolean {
    return this.registry.get('messageOpen') === true || this.registry.get('messageClosedFrame') === this.game.loop.frame;
  }

  private message(m: HudMessage): void {
    this.game.events.emit(HUD_EVENTS.message, m);
  }

  toast(text: string): void {
    this.game.events.emit(HUD_EVENTS.toast, text);
  }

  // ------------------------------------------------------------ Karten in der Welt

  private onCardReceived(def: CardDef, _uid: number): void {
    const img = this.add.image(this.player.x, this.player.y - 30, 'cards', cardIndex(def.id)).setDepth(150000).setScale(0.5);
    this.tweens.add({ targets: img, scale: 1, y: img.y - 14, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: img, alpha: 0, y: img.y - 26, delay: 700, duration: 300, onComplete: () => img.destroy() });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.fx.spawn('sparkle', this.player.x + Math.cos(a) * 10, this.player.y - 36 + Math.sin(a) * 10, {
        tint: PAL.gold,
        vx: Math.cos(a) * 40,
        vy: Math.sin(a) * 40,
        depth: 150001,
      });
    }
    // Mehrere gleichzeitig erhaltene Karten in einer Meldung zusammenfassen
    this.pendingCards.push(def);
    if (this.pendingCards.length === 1) {
      this.time.delayedCall(60, () => {
        const list = this.pendingCards;
        this.pendingCards = [];
        if (list.length === 1) {
          const d = list[0];
          this.toast(`Karte erhalten: ${cardLabel(d)} ${d.name} (${d.rank}) – leg sie innerhalb von 60 s ins Buch!`);
        } else {
          this.toast(`${list.length} Karten erhalten: ${list.map((d) => d.name).join(', ')} – leg sie innerhalb von 60 s ins Buch!`);
        }
      });
    }
  }

  private lumiStart(): boolean {
    if (Game.flags.has('lumi-start')) return false;
    Game.flags.add('lumi-start');
    this.message({
      name: 'Lumi',
      portrait: 'npc-lumi',
      text: 'Willkommen auf der Insel der 100 Karten! Ich bin Lumi, die Hüterin des Ersten Tors. Hier ist alles eine Karte – auch dieses kleine Geschenk.',
    });
    for (const id of STARTER_CARDS) Game.giveCard(id);
    this.message({
      name: 'Lumi',
      portrait: 'npc-lumi',
      text: 'Schnipp jetzt dein Kartenbuch auf (Taste B oder Buch-Knopf) und lege die Karten hinein – in 60 Sekunden verwandeln sie sich sonst!',
    });
    return true;
  }

  private openChest(o: WorldObject, index: number): void {
    const tag = o.tag ?? '';
    if (Game.flags.has(`offen:${tag}`)) {
      this.message({ name: 'Truhe', text: 'Die Truhe ist leer.' });
      return;
    }
    Game.flags.add(`offen:${tag}`);
    o.frame = 1;
    this.objects.refresh(index);
    const loot = TREASURES[tag] ?? { cards: [] };
    for (let i = 0; i < 10; i++) {
      this.fx.spawn('sparkle', o.x + (Math.random() - 0.5) * 16, o.y - 10, { tint: PAL.gold, vy: -40 - Math.random() * 30, depth: o.y + 1 });
    }
    if (loot.money) {
      Game.inv.money += loot.money;
      Game.events.emit('vitals-changed');
      this.toast(`${loot.money} Münzen gefunden!`);
    }
    for (const id of loot.cards) Game.giveCard(id);
    SaveSystem.autosave();
  }

  /** Wunschbrunnen: zufällige Karte nach gewichteten Rängen */
  private wishingWell(): void {
    if (Game.inv.money < WISHING_WELL.cost) {
      this.message({ name: 'Wunschbrunnen', text: `Für einen Wunsch brauchst du ${WISHING_WELL.cost} Münzen.` });
      return;
    }
    Game.inv.money -= WISHING_WELL.cost;
    Game.events.emit('vitals-changed');
    const pool = Math.random() < WISHING_WELL.spellChance ? ZAUBERKARTEN : SAMMELKARTEN;
    const weights = WISHING_WELL.weights;
    const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    let roll = Math.random() * total;
    let rank: Rank = 'H';
    for (const [r, w] of Object.entries(weights) as [Rank, number][]) {
      roll -= w;
      if (roll <= 0) {
        rank = r;
        break;
      }
    }
    // passende Karten mit freiem Limit; sonst nächstseltenere Stufe abwärts
    let candidates = pool.filter((c) => c.rank === rank && Game.registry.canCreate(c.id));
    if (!candidates.length) candidates = pool.filter((c) => ['F', 'G', 'H', 'E'].includes(c.rank) && Game.registry.canCreate(c.id));
    if (!candidates.length) {
      this.toast('Der Brunnen bleibt still. Alle Karten scheinen vergriffen zu sein…');
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.toast(`Du wirfst ${WISHING_WELL.cost} Münzen in den Brunnen… eine Karte schwebt heraus!`);
    Game.giveCard(pick.id);
  }

  private tryInteract(px: number, py: number): boolean {
    for (const n of this.npcs) {
      const near = Math.hypot(n.x - px, n.y - 6 - py) < 22 || Math.hypot(n.x - this.player.x, n.y - this.player.y) < 26;
      if (near) {
        const dx = this.player.x - n.x;
        const dy = this.player.y - n.y;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        n.sprite.play(`${n.sprite.texture.key}-idle-${dir}`);
        if (n.onTalk?.()) return true;
        this.message({ name: n.name, text: n.lines[n.line], portrait: n.sprite.texture.key });
        n.line = (n.line + 1) % n.lines.length;
        return true;
      }
    }
    const o = this.map.findInteractable(px, py, 20);
    if (!o) return false;
    const idx = this.map.objects.indexOf(o);
    switch (o.def.interact) {
      case 'sign':
        this.message({ name: 'Schild', text: o.text ?? '…' });
        break;
      case 'chest':
        this.openChest(o, idx);
        break;
      case 'well':
        this.wishingWell();
        break;
      default:
        this.message(INTERACT_TEXT[o.def.interact ?? ''] ?? { name: '', text: '…' });
    }
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
      if (Input.justPressed('book')) {
        this.openBook();
        return;
      }
      if (Input.justPressed('map')) this.toast('Die Weltkarte mit Fog-of-War folgt mit den Regionen.');
      this.player.update(dt, Input);
      // Spielzeit, 60-Sekunden-Regel, Effekte
      Game.tick(dt);
      this.autosaveT += dt;
      if (this.autosaveT > AUTOSAVE_SECONDS) {
        this.autosaveT = 0;
        SaveSystem.autosave();
      }
    }
    if (DEBUG) this.debugKeys();

    Game.player.x = this.player.x;
    Game.player.y = this.player.y;
    this.ground.update(dt, this.player.x, this.player.y);

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

  openBook(tab?: string): void {
    if (!this.scene.isActive()) return;
    Input.setContext('menu');
    this.scene.pause();
    this.scene.pause('Hud');
    // HUD ausblenden, damit nichts hinter den Buch-Reitern hervorschaut
    this.scene.setVisible(false, 'Hud');
    this.scene.launch('Book', { tab });
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
    if (Input.keyPressed('F7')) {
      // Debug: zufällige Karte in die Hand
      const free = ALL_CARDS.filter((c) => Game.registry.canCreate(c.id));
      if (free.length) Game.giveCard(free[Math.floor(Math.random() * free.length)].id);
    }
    if (Input.keyPressed('F8')) {
      // Debug: 10 zufällige Sammelkarten direkt ins Buch
      for (let i = 0; i < 10; i++) {
        const free = SAMMELKARTEN.filter((c) => Game.registry.canCreate(c.id) && Game.book.sammel[c.no] === null);
        if (!free.length) break;
        const uid = Game.giveCard(free[Math.floor(Math.random() * free.length)].id);
        if (uid !== null) Game.book.file(uid);
      }
      Game.events.emit('book-changed');
    }
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
