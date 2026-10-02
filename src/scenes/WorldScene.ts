import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { TileRenderer } from '../world/TileRenderer';
import { ObjectStreamer } from '../world/ObjectStreamer';
import { GroundItems } from '../world/GroundItems';
import type { WorldMap, WorldObject } from '../world/WorldMap';
import { FxPool } from '../systems/FxPool';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { Input } from '../input/InputManager';
import { Display } from '../systems/Display';
import { Settings } from '../systems/Settings';
import { DEBUG, GAME_H, GAME_W, TILE } from '../config';
import { exportTextures } from '../gfx/AssetLoader';
import { PAL } from '../gfx/palette';
import { HUD_EVENTS, type HudMessage } from './HudScene';
import { Game } from '../systems/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { ALL_CARDS, cardIndex, cardLabel, SAMMELKARTEN, ZAUBERKARTEN } from '../data/cards';
import type { CardDef, Rank } from '../data/cardTypes';
import { TREASURES, WISHING_WELL } from '../data/treasures';
import { DamageNumbers } from '../systems/combat/DamageNumbers';
import { Projectiles } from '../systems/combat/Projectiles';
import { EnemyManager } from '../systems/combat/EnemyManager';
import type { CombatWorld, Decoy } from '../systems/combat/CombatWorld';
import { specialDamage } from '../systems/combat/Damage';
import { TECHNIQUES, type TechniqueId } from '../data/aura';
import { MONSTER_BY_ID, type MonsterDef } from '../data/monsters';
import type { UseAction } from '../systems/cards/Inventory';
import { loadMap, hasMap, type LoadedMap } from '../world/maps';
import { NPCS } from '../data/npcs';
import { TOWNS, REGIONS, REGION_IDS, type RegionId } from '../data/world/layout';
import { DOORS, PICKUPS, SPOTS } from '../data/doors';
import type { WorldApi } from '../systems/Dialog';
import type { Enemy } from '../entities/Enemy';
import { castSpell, type SpellHost } from '../systems/Spells';
import '../data/dialogs';
import '../data/maps/dungeons';
import '../data/bosses';
import { Atmosphere, ambientFor, type Light } from '../world/Atmosphere';
import { baseWeather, regionWeather, type BaseWeather } from '../systems/Weather';
import { modulesFor, setWorldHost, type WorldHost, type WorldModule } from '../systems/WorldModules';
import { npcRule } from '../systems/npcRules';

/** Spiegelbild (Spiegel-Affinität): zieht Angriffe auf sich und explodiert */
class MirrorDecoy implements Decoy {
  x = 0;
  y = 0;
  active = false;
  hp = 0;
  t = 0;
  power = 1;
  readonly sprite: Phaser.GameObjects.Sprite;
  onBreak?: (d: MirrorDecoy) => void;
  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.sprite(0, 0, 'player', 0).setOrigin(12 / 24, 30 / 32).setVisible(false).setAlpha(0.7);
  }
  spawn(x: number, y: number, seconds: number, power: number, frame: number): void {
    this.x = x;
    this.y = y;
    this.t = seconds;
    this.hp = 3;
    this.power = power;
    this.active = true;
    this.sprite.setPosition(x, y).setFrame(frame).setVisible(true).setTint(PAL.pink).setDepth(y);
  }
  hit(_dmg: number): void {
    if (!this.active) return;
    this.hp--;
    this.sprite.setTintFill(PAL.white);
    this.sprite.scene.time.delayedCall(60, () => this.sprite.setTint(PAL.pink));
    if (this.hp <= 0) this.shatter();
  }
  update(dt: number, time: number): void {
    if (!this.active) return;
    this.t -= dt;
    this.sprite.setAlpha(0.55 + Math.sin(time / 90) * 0.15);
    if (this.t <= 0) this.shatter();
  }
  shatter(): void {
    if (!this.active) return;
    this.active = false;
    this.sprite.setVisible(false);
    this.onBreak?.(this);
  }
}

const AUTOSAVE_SECONDS = 30;

export interface WorldInit {
  continue?: boolean;
  /** Kartenwechsel: Zielkarte und Ankunftspunkt */
  warp?: { map: string; x: number; y: number };
}

/** Die Spielwelt: Insel (und weitere Karten), Figuren, Monster, Interaktionen. */
export class WorldScene extends BaseScene {
  loaded!: LoadedMap;
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
  private init0: WorldInit = {};
  private autosaveT = 0;
  private pendingCards: CardDef[] = [];
  private numbers!: DamageNumbers;
  private projectiles!: Projectiles;
  enemies!: EnemyManager;
  private combat!: CombatWorld & { enemies: EnemyManager };
  private decoy!: MirrorDecoy;
  private auraHeld = false;
  private auraHold = 0;
  private wheelOpen = false;
  private wheelSel: TechniqueId | null = null;
  private dying = false;
  private levelUpPending = false;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private region: RegionId | '' = '';
  private campfires: WorldObject[] = [];
  private atCampfire = false;
  /** Musik mit Vorrang (Bosskampf, Arena …) */
  musicOverride: string | null = null;
  private regionCheckT = 0;
  private hiddenSpots: number[] = [];
  private api!: WorldApi;
  private warping = false;
  private atmo!: Atmosphere;
  private mods: WorldModule[] = [];
  host!: WorldHost;
  private hudTimer: { label: string; left: number } | null = null;
  private questTarget: [number, number] | null = null;
  private lightList: Light[] = [];
  private readonly extraLights: Light[] = [];

  constructor() {
    super('World');
  }

  init(data: WorldInit): void {
    this.init0 = data ?? {};
  }

  create(): void {
    this.setupCamera(true);
    Input.setContext('gameplay');
    this.npcs = [];
    this.autosaveT = 0;
    this.pendingCards = [];
    this.region = '';
    this.warping = false;
    if (!this.init0.continue && !this.init0.warp) Game.newGame();
    if (this.init0.warp) {
      Game.player.map = this.init0.warp.map;
      Game.player.x = this.init0.warp.x;
      Game.player.y = this.init0.warp.y;
    }
    const urlMap = DEBUG ? new URLSearchParams(location.search).get('map') : null;
    if (urlMap && !this.init0.continue) Game.player.map = urlMap;
    this.loaded = loadMap(Game.player.map || 'insel');
    Game.player.map = this.loaded.id;
    this.map = this.loaded.map;
    this.applyWorldFlags();
    this.campfires = this.map.objects.filter((o) => o.def.interact === 'campfire');
    this.atCampfire = false;
    this.musicOverride = null;
    if (!this.loaded.meta) Sound.music(this.loaded.music);

    this.tiles = new TileRenderer(this, this.map, this.loaded.composer);
    this.objects = new ObjectStreamer(this, this.map);
    this.fx = new FxPool(this);
    this.ground = new GroundItems(this, Game.player.map);

    const start = this.validStart();
    this.player = new Player(this, 'player', start.x, start.y, this.map, this.fx, {
      shake: (i, d) => this.shake(i, d),
      hitStop: (ms) => this.hitStop(ms),
      interact: (x, y) => this.tryInteract(x, y),
      spell: (slot) => this.castQuick(slot),
      aimWorld: () => this.aimWorld(),
      died: () => this.onPlayerDied(),
      decoy: (x, y, sec, power) => this.decoy.spawn(x, y, sec, power, this.player.sprite.frame.name as unknown as number),
      pullCards: (_x, _y, r) => this.ground.pull(r),
      flash: (c, ms) => this.flash(c, ms),
      toast: (t) => this.toast(t),
    });

    // --- Kampf
    this.numbers = new DamageNumbers(this);
    this.projectiles = new Projectiles(this, this.map);
    this.decoy = new MirrorDecoy(this);
    this.decoy.onBreak = (d) => this.decoyExplode(d);
    this.combat = {
      scene: this,
      map: this.map,
      fx: this.fx,
      numbers: this.numbers,
      projectiles: this.projectiles,
      player: this.player,
      decoy: this.decoy,
      shake: (i, ms) => this.shake(i, ms),
      hitStop: (ms) => this.hitStop(ms),
      toast: (t) => this.toast(t),
      enemies: null as unknown as EnemyManager,
    };
    this.enemies = new EnemyManager(this.combat);
    this.enemies.onKill = (def, e) => this.onMonsterKilled(def, e);
    this.combat.enemies = this.enemies;
    this.player.world = this.combat;
    this.flashRect = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(300000).setBlendMode(Phaser.BlendModes.ADD);
    this.dying = false;
    this.levelUpPending = Game.prog.pending > 0;
    this.wheelOpen = false;
    this.auraHeld = false;

    // --- Figuren
    this.syncNpcs();

    this.api = this.makeApi();
    this.atmo = new Atmosphere(this);
    this.hudTimer = null;
    this.questTarget = null;
    this.extraLights.length = 0;
    this.registry.set('hudTimer', null);
    this.registry.set('questTarget', null);
    this.registry.set('bossBar', null);
    this.host = this.makeHost();
    setWorldHost(this.host);
    this.mods = modulesFor(this.loaded.id);
    for (const m of this.mods) m.load?.(this.host);
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

    const offs = [
      Game.events.on('card-received', (def, uid) => this.onCardReceived(def, uid)),
      Game.events.on('card-limit', (def) =>
        this.toast(`Alle ${def.limit} Exemplare von „${def.name}" sind bereits im Umlauf – jetzt nur noch von anderen Sammlern zu bekommen.`),
      ),
      Game.events.on('card-transformed', (def, msg) => this.toast(`Zu spät! ${cardLabel(def)} ${def.name} hat sich verwandelt. ${msg}`)),
      Game.events.on('message', (t) => t && this.toast(t)),
      Game.events.on('level-up', () => {
        this.levelUpPending = true;
      }),
      Game.events.on('item-action', (a) => this.onItemAction(a)),
    ];

    this.registry.set('worldMap', this.map);
    this.registry.set('worldMeta', this.loaded.meta ?? null);
    this.registry.set('worldActive', true);
    this.scene.launch('Hud');
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      Input.setContext('gameplay');
      this.syncNpcs();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((o) => o());
      setWorldHost(null);
      this.atmo.destroy();
      this.registry.set('hudTimer', null);
      this.registry.set('questTarget', null);
      this.tiles.destroy();
      this.objects.destroy();
      this.ground.destroy();
      this.enemies.destroy();
      for (const n of this.npcs) n.destroy();
      this.registry.set('worldActive', false);
      this.scene.stop('Hud');
    });
    this.cameras.main.fadeIn(350, 13, 10, 20);
    if (this.init0.warp) {
      // Ankunft nach einer Reise
    } else if (!this.init0.continue || Game.flags.has('frisch')) {
      Game.flags.delete('frisch');
      this.time.delayedCall(700, () => this.toast('Willkommen auf der Insel! Sprich mit Lumi – sie steht gleich beim Ersten Tor.'));
    } else {
      this.time.delayedCall(400, () => this.toast('Spielstand geladen.'));
    }
  }

  /** Geöffnete Truhen, aufgehobene Dinge, Statuen nach Spielstand */
  private applyWorldFlags(): void {
    this.hiddenSpots = [];
    this.map.objects.forEach((o, i) => {
      if (!o.tag) return;
      if (Game.flags.has(`offen:${o.tag}`)) o.frame = 1;
      if (Game.flags.has(`genommen:${o.tag}`)) this.map.removeObject(i);
      const spot = SPOTS[o.tag];
      if (spot?.flag && Game.flags.has(spot.flag)) this.map.removeObject(i);
      if (spot?.hidden && !o.hidden) this.hiddenSpots.push(i);
      if (o.tag.startsWith('statue:')) o.frame = Game.vars.get(o.tag) ?? 0;
    });
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

  private makeApi(): WorldApi {
    return {
      toast: (t) => this.toast(t),
      openShop: (id) => this.openShop(id),
      giveCard: (id) => Game.giveCard(id) !== null,
      heal: () => {
        Sound.play('heal');
        const st = Game.inv.stats();
        Game.inv.lp = st.lp;
        Game.inv.aura = st.aura;
        Game.events.emit('vitals-changed');
      },
      save: () => SaveSystem.autosave(),
      setRest: () => {
        Game.prog.rest = { map: Game.player.map, x: this.player.x, y: this.player.y };
      },
      spawnMonster: (id, tx, ty, tag) => {
        const def = MONSTER_BY_ID[id];
        if (!def) return;
        if (tag && this.enemies.list.some((e) => e.active && e.tag === tag)) return;
        let x = tx * TILE + 8;
        let y = ty * TILE + 8;
        for (let r = 0; r < 12 && this.map.boxBlocked(x - 6, y - 5, 12, 5); r++) {
          x += 16;
          y += r % 2 ? 16 : 0;
        }
        const e = this.enemies.spawn(def, x, y);
        if (e && tag) e.tag = tag;
      },
      warp: (target) => this.warpTo(target),
      after: (fn) => this.time.delayedCall(30, fn),
      openScene: (key, data) => this.openOverlay(key, data),
      wish: () => this.wishingWell(),
    };
  }

  /** Figuren nach Spielstand ein- und ausblenden */
  syncNpcs(): void {
    const want = new Set<string>();
    for (const n of NPCS) {
      if (n.map !== this.loaded.id) continue;
      if (n.showIf && !Game.flags.has(n.showIf)) continue;
      if (n.hideIf && Game.flags.has(n.hideIf)) continue;
      if (n.rule && !npcRule(n.rule)) continue;
      want.add(n.id);
    }
    // Figuren, deren Platz sich geändert hat (Rivalen ziehen weiter), neu aufstellen
    const placeOf = (n: (typeof NPCS)[number]) => {
      const town = n.town ? TOWNS.find((t) => t.id === n.town) : undefined;
      return { x: ((town ? town.x : 0) + n.x) * TILE + 8, y: ((town ? town.y : 0) + n.y) * TILE + 12 };
    };
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const def = NPCS.find((n) => n.id === this.npcs[i].def.id);
      const moved = def && (Math.abs(placeOf(def).x - this.npcs[i].def.x) > 1 || Math.abs(placeOf(def).y - this.npcs[i].def.y) > 1);
      if (!want.has(this.npcs[i].def.id) || moved) {
        this.npcs[i].destroy();
        this.npcs.splice(i, 1);
      }
    }
    for (const n of NPCS) {
      if (!want.has(n.id) || this.npcs.some((x) => x.def.id === n.id)) continue;
      const town = n.town ? TOWNS.find((t) => t.id === n.town) : undefined;
      const tx = (town ? town.x : 0) + n.x;
      const ty = (town ? town.y : 0) + n.y;
      this.npcs.push(
        new Npc(this, this.map, {
          id: n.id,
          key: `npc-${n.id}`,
          name: n.name,
          x: tx * TILE + 8,
          y: ty * TILE + 12,
          facing: n.facing ?? 'down',
          wander: n.wander ?? 0,
          dialog: n.dialog,
        }),
      );
    }
  }

  private makeHost(): WorldHost {
    const self = this;
    return {
      scene: this,
      get mapId() {
        return self.loaded.id;
      },
      get map() {
        return self.map;
      },
      get player() {
        return self.player;
      },
      get region() {
        return self.region;
      },
      get enemies() {
        return self.enemies;
      },
      get fx() {
        return self.fx;
      },
      toast: (t) => this.toast(t),
      message: (name, text) => this.message({ name, text }),
      talk: (d, npc) => this.openTalk(d, npc),
      openScene: (key, data) => this.openOverlay(key, data),
      giveCard: (id) => Game.giveCard(id) !== null,
      spawnMonster: (id, x, y, tag) => {
        const def = MONSTER_BY_ID[id];
        if (!def) return null;
        const e = this.enemies.spawn(def, x, y);
        if (e && tag) e.tag = tag;
        return e;
      },
      hideObject: (idx, flag) => this.removeWorldObject(idx, flag),
      showObject: (idx) => {
        this.map.restoreObject(idx);
        this.objects.refresh(idx);
      },
      refreshObject: (idx) => this.objects.refresh(idx),
      sparkle: (x, y, color, n = 10) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.fx.spawn('sparkle', x, y, { tint: color, vx: Math.cos(a) * 50, vy: Math.sin(a) * 40 - 20, depth: y + 2 });
        }
      },
      shake: (i, ms) => this.shake(i, ms),
      flash: (c, ms) => this.flash(c, ms),
      changeMap: (t, x, y) => this.changeMap(t, x, y),
      teleport: (x, y, text) => this.teleportTo(x, y, text),
      setMusic: (id) => {
        this.musicOverride = id;
        this.updateMusic();
      },
      setTimer: (label, seconds = 0) => {
        this.hudTimer = label ? { label, left: seconds } : null;
        this.registry.set('hudTimer', this.hudTimer);
      },
      setTarget: (x, y = 0) => {
        this.questTarget = x === null ? null : [x, y];
        this.registry.set('questTarget', this.questTarget);
      },
      after: (ms, fn) => this.time.delayedCall(ms, fn),
      syncNpcs: () => this.syncNpcs(),
      extraLights: this.extraLights,
      get projectiles() {
        return self.projectiles;
      },
      hurtPlayer: (atk, fx, fy) => this.player.takeHit(atk, fx, fy),
    };
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

  // ------------------------------------------------------------ Szenen-Overlays

  openOverlay(key: string, data?: object, hideHud = false): void {
    if (!this.scene.isActive()) return;
    Input.setContext('menu');
    this.scene.pause();
    this.scene.pause('Hud');
    if (hideHud) this.scene.setVisible(false, 'Hud');
    this.scene.launch(key, data);
  }

  openTalk(dialog: string, npc?: string): void {
    this.openOverlay('Talk', { dialog, npc, api: this.api });
  }

  openShop(id: string): void {
    this.openOverlay('Shop', { shop: id });
  }

  openPause(): void {
    this.openOverlay('Pause');
  }

  openLevelUp(): void {
    this.openOverlay('LevelUp', undefined, true);
  }

  openBook(tab?: string): void {
    this.openOverlay('Book', { tab }, true);
  }

  openMap(): void {
    this.openOverlay('Map', { x: this.player.x, y: this.player.y }, true);
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
    this.pendingCards.push(def);
    if (this.pendingCards.length === 1) {
      this.time.delayedCall(60, () => {
        const list = this.pendingCards;
        this.pendingCards = [];
        if (list.length === 1) {
          const d = list[0];
          this.toast(`Karte erhalten: ${cardLabel(d)} ${d.name} (${d.rank}) – leg sie innerhalb von 60 s ins Buch!`);
        } else if (list.length <= 4) {
          this.toast(`${list.length} Karten erhalten: ${list.map((d) => d.name).join(', ')} – leg sie innerhalb von 60 s ins Buch!`);
        } else {
          this.toast(`${list.length} Karten erhalten – leg sie innerhalb von 60 s ins Buch!`);
        }
      });
    }
  }

  private onMonsterKilled(_def: MonsterDef, e: Enemy): void {
    if (e.tag === 'kobold-dieb' && Game.quests.stage('q-kobold') === 1) {
      Game.quests.set('q-kobold', 2);
      Game.giveCard('038');
      this.toast('Der Kobold lässt das Tintenfass der Wahrheit fallen!');
    }
    for (const m of this.mods) m.kill?.(this.host, e.def, e);
    this.game.events.emit('monster-killed', e.def.id, e.tag);
  }

  private openChest(o: WorldObject, index: number): void {
    const tag = o.tag ?? '';
    if (Game.flags.has(`offen:${tag}`)) {
      this.message({ name: 'Truhe', text: 'Die Truhe ist leer.' });
      return;
    }
    Game.flags.add(`offen:${tag}`);
    Sound.play('chest');
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
    if (!loot.cards.length && !loot.money) this.toast('Nur Staub und ein paar Spinnweben.');
    SaveSystem.autosave();
  }

  /** Wunschbrunnen: zufällige Karte nach gewichteten Rängen */
  wishingWell(): void {
    if (Game.inv.money < WISHING_WELL.cost) {
      this.message({ name: 'Wunschbrunnen', text: `Für einen Wunsch brauchst du ${WISHING_WELL.cost} Münzen.` });
      return;
    }
    Game.inv.money -= WISHING_WELL.cost;
    Sound.play('coin');
    this.time.delayedCall(250, () => Sound.play('well'));
    Game.events.emit('vitals-changed');
    const pool = Math.random() < WISHING_WELL.spellChance ? ZAUBERKARTEN.filter((z) => !z.spell?.questOnly) : SAMMELKARTEN.filter((c) => c.type !== 'Monster' && !/Bezwinge|Besiege/i.test(c.hint));
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

  // ------------------------------------------------------------ Interaktion

  private tryInteract(px: number, py: number): boolean {
    for (const n of this.npcs) {
      const near = Math.hypot(n.x - px, n.y - 6 - py) < 22 || Math.hypot(n.x - this.player.x, n.y - this.player.y) < 24;
      if (near) {
        n.faceTo(this.player.x, this.player.y);
        this.openTalk(n.def.dialog, n.def.id);
        return true;
      }
    }
    const o = this.map.findInteractable(px, py, 22);
    if (!o) return false;
    const idx = this.map.objects.indexOf(o);
    for (const m of this.mods) if (m.interact?.(this.host, o, idx)) return true;
    switch (o.def.interact) {
      case 'sign':
        this.message({ name: 'Schild', text: o.text ?? '…' });
        break;
      case 'chest':
        this.openChest(o, idx);
        break;
      case 'well':
        this.useWell(o);
        break;
      case 'campfire':
        Game.prog.rest = { map: Game.player.map, x: this.player.x, y: this.player.y + 4 };
        this.openTalk('rastfeuer');
        break;
      case 'door':
        this.useDoor(o);
        break;
      case 'gate':
        this.useGate(o, idx);
        break;
      case 'warp':
        this.useWarp(o);
        break;
      case 'board':
        this.openTalk('rangliste');
        break;
      case 'statue':
        this.turnStatue(o, idx);
        break;
      case 'pickup':
      case 'spot':
        return this.useSpot(o, idx);
      case 'talk': {
        const id = o.tag?.startsWith('talk:') ? o.tag.slice(5) : '';
        if (id) this.openTalk(id, NPCS.some((n) => n.id === id) ? id : undefined);
        break;
      }
      case 'crystal':
        this.message({ name: 'Kristall', text: 'Ein leuchtender Kristall. Mit einem kräftigen Aufladeschlag liesse er sich vielleicht abbauen.' });
        break;
      default:
        this.message({ name: '', text: '…' });
    }
    return true;
  }

  private useWell(o: WorldObject): void {
    Sound.play('well');
    const town = o.tag?.startsWith('brunnen:') ? o.tag.slice(8) : '';
    if (town) {
      Game.lastWell = { map: Game.player.map, x: o.x, y: o.y + 18, town };
      Game.prog.rest = { map: Game.player.map, x: o.x, y: o.y + 18 };
      Game.visited.add(town);
    }
    if (town === 'taufeld') this.openTalk('wunschbrunnen');
    else this.message({ name: 'Stadtbrunnen', text: 'Du tauchst die Hand ins kühle Wasser. Hier wachst du auf, falls dir etwas zustösst – und Brunnensprung-Zauber führen dich hierher zurück.' });
  }

  private useDoor(o: WorldObject): void {
    Sound.play('door');
    const d = o.tag ? DOORS[o.tag] : undefined;
    if (!d) {
      this.message({ name: 'Tür', text: 'Die Tür ist verschlossen.' });
      return;
    }
    if (d.dialog) this.openTalk(d.dialog, d.npc);
    else if (d.shop) this.openShop(d.shop);
    else this.message({ name: d.name, text: d.text ?? 'Niemand öffnet.' });
  }

  private useGate(o: WorldObject, idx: number): void {
    if (o.tag === 'erstes-tor') {
      if (Game.flags.has('nullpunkt-bereit')) {
        this.openTalk('nullpunkt');
        return;
      }
      this.message({ name: 'Erstes Tor', text: 'Das Portal schimmert, aber es lässt dich nicht hindurch. „Erst wenn das Buch voll ist", flüstert es.' });
      return;
    }
    this.game.events.emit('world-gate', o, idx);
    if (!this.gateHandlers.some((h) => h(o, idx))) this.message({ name: 'Wegsperre', text: 'Hier kommst du noch nicht weiter.' });
  }

  /** Zusätzliche Wegsperren-Logik (Regionen-Erweiterungen) */
  gateHandlers: ((o: WorldObject, idx: number) => boolean)[] = [];

  /** Objekt dauerhaft entfernen (Sperre geöffnet) */
  removeWorldObject(idx: number, flag?: string): void {
    const o = this.map.objects[idx];
    if (flag) Game.flags.add(flag);
    else if (o.tag) Game.flags.add(`genommen:${o.tag}`);
    this.map.removeObject(idx);
    this.objects.refresh(idx);
    for (let i = 0; i < 10; i++) this.fx.spawn('sparkle', o.x + (Math.random() - 0.5) * 20, o.y - 12, { tint: PAL.gold, vy: -40 });
    this.fx.spawn('poof', o.x, o.y - 10, { scale: 2 });
  }

  private useWarp(o: WorldObject): void {
    const target = o.tag?.startsWith('warp:') ? o.tag.slice(5) : '';
    this.warpTo(target);
  }

  /** Reise zu einer anderen Karte oder einem Ankunftspunkt */
  warpTo(target: string): void {
    if (this.warping) return;
    if (target === 'klippen' || target === 'hafen') {
      // Bootsfahrt zwischen Möwenhafen und den Möwenklippen (braucht den Hafenpass)
      if (target === 'klippen' && !Game.hasThing('015')) {
        this.message({ name: 'Wache am Seetor', text: 'Halt! Ohne Hafenpass darf niemand durchs Seetor. Befehl des Hafenmeisters.' });
        return;
      }
      const sp = target === 'klippen' ? this.map.spawnPoints['warp:hafen'] : this.harborPoint();
      if (!sp) return;
      this.fadeTeleport(sp.x, sp.y, target === 'klippen' ? 'Das Boot gleitet über die Wellen zu den Möwenklippen …' : 'Zurück nach Möwenhafen …');
      return;
    }
    if (target === 'seeinsel' || target === 'seeufer') {
      // Wolkenfloss über den Silbersee
      if (target === 'seeinsel' && !Game.hasThing('006')) {
        this.message({ name: 'Silbersee', text: 'Ein alter Anleger. Die kleine Insel in der Seemitte ist zum Schwimmen zu weit – mit einem Floss wäre es ein Katzensprung.' });
        return;
      }
      const sp = this.map.spawnPoints[`warp:${target}`];
      if (sp) this.fadeTeleport(sp.x, sp.y, target === 'seeinsel' ? 'Das Wolkenfloss trägt dich lautlos über den See …' : 'Zurück ans Ufer.');
      return;
    }
    if (target === 'insel-zurueck') target = 'insel';
    if (!hasMap(target)) {
      this.message({ name: 'Versperrt', text: 'Ein kalter Luftzug weht dir entgegen. Dieser Weg öffnet sich später.' });
      return;
    }
    for (const m of this.mods) {
      const msg = m.warpCheck?.(this.host, target);
      if (msg) {
        this.message({ name: 'Versperrt', text: msg });
        return;
      }
    }
    const gateCheck = this.warpChecks[target];
    if (gateCheck) {
      const msg = gateCheck();
      if (msg) {
        this.message({ name: 'Versperrt', text: msg });
        return;
      }
    }
    this.changeMap(target);
  }

  /** Bedingungen für Kartenwechsel (z. B. Tiefenperle für die Muschelgrotte) */
  warpChecks: Record<string, () => string | null> = {};

  changeMap(target: string, x = 0, y = 0): void {
    this.warping = true;
    Sound.play('door', { rate: 0.8 });
    const from = Game.player.map;
    if (from === 'insel') {
      // Rückkehrpunkt merken (falls die Zielkarte keinen Eingang auf der Insel hat)
      Game.vars.set('rueck-x', Math.round(this.player.x));
      Game.vars.set('rueck-y', Math.round(this.player.y + 10));
    }
    SaveSystem.autosave();
    this.cameras.main.fadeOut(300, 13, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      let tx = x;
      let ty = y;
      if (!tx && target === 'insel') {
        // Rückkehr: am Eingang der verlassenen Karte erscheinen
        const lm = loadMap('insel');
        const i = lm.map.findByTag(`warp:${from}`);
        if (i >= 0) {
          tx = lm.map.objects[i].x;
          ty = lm.map.objects[i].y + 14;
        } else if (Game.vars.has('rueck-x')) {
          tx = Game.vars.get('rueck-x') ?? 0;
          ty = Game.vars.get('rueck-y') ?? 0;
        }
      }
      this.scene.restart({ continue: true, warp: { map: target, x: tx, y: ty } });
    });
  }

  private harborPoint(): { x: number; y: number } | null {
    const i = this.map.findByTag('warp:klippen');
    if (i < 0) return null;
    const o = this.map.objects[i];
    return { x: o.x - 40, y: o.y - 8 };
  }

  private fadeTeleport(x: number, y: number, text?: string): void {
    this.warping = true;
    Sound.play('teleport');
    this.cameras.main.fadeOut(400, 13, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.player.x = x;
      this.player.y = y;
      this.camX = x;
      this.camY = y - 12;
      this.enemies.clear();
      this.projectiles.clear();
      this.updateCamera(0);
      this.cameras.main.fadeIn(400, 13, 10, 20);
      this.warping = false;
      if (text) this.toast(text);
    });
  }

  /** Teleport innerhalb der Karte (Zauber) */
  teleportTo(x: number, y: number, text?: string): void {
    // freie Stelle suchen
    let tx = x;
    let ty = y;
    for (let r = 0; r < 30 && this.map.boxBlocked(tx - 5, ty - 6, 10, 6); r++) {
      const a = r * 2.4;
      tx = x + Math.cos(a) * r * 6;
      ty = y + Math.sin(a) * r * 6;
    }
    this.fadeTeleport(tx, ty, text);
  }

  private turnStatue(o: WorldObject, idx: number): void {
    o.frame = ((o.frame ?? 0) + 1) % 4;
    Sound.play('stomp', { rate: 1.4, vol: 0.7 });
    Game.vars.set(o.tag ?? '', o.frame);
    this.objects.refresh(idx);
    this.fx.spawn('dust', o.x, o.y - 2);
    this.shake(1, 80);
    this.game.events.emit('statue-turned', o.tag);
  }

  private useSpot(o: WorldObject, idx: number): boolean {
    const tag = o.tag ?? '';
    if (tag.startsWith('pickup:')) {
      const kind = tag.split(':')[1];
      const p = PICKUPS[kind];
      if (!p) return false;
      if (Game.giveCard(p.card) === null) return true;
      Game.flags.add(`genommen:${tag}`);
      this.map.removeObject(idx);
      this.objects.refresh(idx);
      this.toast(p.text);
      return true;
    }
    const s = SPOTS[tag];
    if (!s) return false;
    if (s.hidden && !this.player.sense && !Game.inv.tools.has('linse')) return false;
    if (s.needs && !Game.hasThing(s.needs)) {
      this.message({ name: 'Glitzernde Stelle', text: 'Hier liegt etwas vergraben. Mit einer Schaufel könntest du graben.' });
      return true;
    }
    if (s.flag) Game.flags.add(s.flag);
    Sound.play(s.needs ? 'dig' : 'select');
    Game.flags.add(`genommen:${tag}`);
    this.map.removeObject(idx);
    this.objects.refresh(idx);
    if (s.card) Game.giveCard(s.card);
    if (s.money) {
      Game.inv.money += s.money;
      Game.events.emit('vitals-changed');
      Sound.play('coin');
    }
    this.toast(s.text);
    for (let i = 0; i < 8; i++) this.fx.spawn('sparkle', o.x, o.y - 6, { tint: PAL.gold, vx: (Math.random() - 0.5) * 60, vy: -40 });
    if (tag === 'geheim:glocke' && Game.quests.stage('q-glocke') === 1) Game.quests.set('q-glocke', 2);
    this.game.events.emit('spot-used', tag);
    return true;
  }

  // ------------------------------------------------------------ Zauber

  private castQuick(slot: number): void {
    const uid = Game.quick[slot - 1];
    if (uid === null || uid === undefined || !Game.book.locate(uid)) {
      Game.quick[slot - 1] = null;
      this.toast(`Schnellzauber ${slot} ist leer. Leg im Buch einen Zauber auf diese Taste.`);
      return;
    }
    const r = castSpell(uid, this.spellHost());
    if (r) this.toast(r);
  }

  /** Schnittstelle für das Zaubersystem */
  spellHost(): SpellHost {
    return {
      x: this.player.x,
      y: this.player.y,
      map: Game.player.map,
      meta: this.loaded.meta ?? null,
      worldMap: this.map,
      teleport: (x, y, text) => this.teleportTo(x, y, text),
      changeMap: (map, x, y) => this.changeMap(map, x, y),
      toast: (t) => this.toast(t),
      message: (name, text) => this.message({ name, text }),
      fx: (color) => {
        Sound.play('spell');
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.fx.spawn('sparkle', this.player.x, this.player.y - 14, { tint: color, vx: Math.cos(a) * 70, vy: Math.sin(a) * 60, depth: this.player.y + 3 });
        }
        this.fx.spawn('ring', this.player.x, this.player.y - 8, { tint: color, scale: 1 });
        this.flash(color, 120);
      },
      openScene: (key, data) => this.openOverlay(key, data),
    };
  }

  // ------------------------------------------------------------ Kampf

  flash(color: number, ms: number): void {
    if (!Settings.get().screenShake) return;
    const r = Display.renderScale;
    this.flashRect.setPosition((GAME_W * (r - 1)) / 2, (GAME_H * (r - 1)) / 2);
    this.flashRect.setFillStyle(color, 0.28);
    this.tweens.killTweensOf(this.flashRect);
    this.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: ms });
  }

  private decoyExplode(d: MirrorDecoy): void {
    this.fx.spawn('ring', d.x, d.y - 8, { tint: PAL.pink, scale: 1.2 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.fx.spawn('sparkle', d.x, d.y - 10, { tint: PAL.pink, vx: Math.cos(a) * 90, vy: Math.sin(a) * 70 });
    }
    this.shake(2.5, 140);
    const st = Game.inv.stats();
    const mods = Game.prog.mods;
    this.enemies.hitArea(d.x, d.y - 6, 50, () => specialDamage(st, mods, 2 * d.power), { fromX: d.x, fromY: d.y, kb: 160, src: 'decoy' });
  }

  private onItemAction(a: UseAction): void {
    if (a.kind === 'summon') {
      const def = MONSTER_BY_ID[a.monster];
      const e = this.enemies.summonAlly(a.monster, this.player.x + 14, this.player.y + 4);
      if (e && def) this.toast(`${def.name} kämpft jetzt eine Weile an deiner Seite.`);
    } else if (a.kind === 'throw') {
      const [dx, dy] = this.player.facing === 'left' ? [-1, 0] : this.player.facing === 'right' ? [1, 0] : this.player.facing === 'up' ? [0, -1] : [0, 1];
      this.projectiles.spawn({ kind: 'mud', x: this.player.x, y: this.player.y, vx: dx * 200, vy: dy * 200, dmg: 8, team: 'player', life: 0.8 });
    } else if (a.kind === 'wonder') {
      this.game.events.emit('wonder', a.wonder);
    }
  }

  /** Aura-Taste: kurz = gewählte Technik, halten = Aura-Rad */
  private updateAuraInput(dt: number): void {
    if (Input.justPressed('aura')) {
      this.auraHeld = true;
      this.auraHold = 0;
    }
    if (!this.auraHeld) return;
    this.auraHold += dt;
    if (Input.isDown('aura')) {
      if (!this.wheelOpen && this.auraHold > 0.22) {
        this.wheelOpen = true;
        this.wheelSel = null;
      }
      if (this.wheelOpen) this.wheelSel = this.wheelSelection();
    } else {
      this.auraHeld = false;
      if (this.wheelOpen) {
        this.wheelOpen = false;
        if (this.wheelSel) {
          Game.prog.technique = this.wheelSel;
          this.useTechnique(this.wheelSel);
        }
      } else this.useTechnique(Game.prog.technique);
    }
    this.registry.set('auraWheel', this.wheelOpen ? this.wheelSel ?? 'none' : null);
  }

  private wheelSelection(): TechniqueId | null {
    const touch = Input.source === 'touch';
    const vx = touch ? Input.auraDragX : Input.moveX;
    const vy = touch ? Input.auraDragY : Input.moveY;
    if (Math.hypot(vx, vy) < 0.35) return null;
    const ang = (Math.atan2(-vy, vx) * 180) / Math.PI;
    let best: TechniqueId | null = null;
    let bd = 999;
    for (const t of TECHNIQUES) {
      let d = Math.abs(ang - t.angle) % 360;
      if (d > 180) d = 360 - d;
      if (d < bd) {
        bd = d;
        best = t.id;
      }
    }
    return best;
  }

  private useTechnique(id: TechniqueId): void {
    const msg = this.player.useTechnique(id);
    if (msg) this.toast(msg);
  }

  private onPlayerDied(): void {
    if (this.dying) return;
    this.dying = true;
    for (const m of this.mods) m.died?.(this.host);
    this.wheelOpen = false;
    this.registry.set('auraWheel', null);
    this.time.delayedCall(1300, () => {
      this.cameras.main.fadeOut(600, 13, 10, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        const loss = Game.die();
        const rest = Game.prog.rest && Game.prog.rest.map === Game.player.map ? Game.prog.rest : { x: this.map.spawnX, y: this.map.spawnY };
        this.enemies.clear();
        this.projectiles.clear();
        this.player.revive(rest.x, rest.y);
        this.camX = rest.x;
        this.camY = rest.y - 12;
        this.updateCamera(0);
        this.cameras.main.fadeIn(600, 13, 10, 20);
        this.dying = false;
        const parts: string[] = [];
        if (loss.money) parts.push(`${loss.money} Münzen`);
        if (loss.cards.length) parts.push(`${loss.cards.length} ${loss.cards.length === 1 ? 'Karte' : 'Karten'} aus den freien Slots`);
        this.message({
          name: 'Erwacht',
          text: `Du bist erschöpft zusammengebrochen und am Rastplatz wieder aufgewacht. ${parts.length ? `Verloren: ${parts.join(' und ')}.` : 'Zum Glück hattest du nichts zu verlieren.'} Deine Sammelseiten sind sicher.`,
        });
        SaveSystem.autosave();
      });
    });
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

  private aimWorld(): { x: number; y: number } | null {
    if (!Input.mouseAiming) return null;
    const p = this.input.activePointer;
    return this.cameras.main.getWorldPoint(p.x, p.y);
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
    this.camX = Phaser.Math.Clamp(this.camX, hw, Math.max(hw, this.map.pixelWidth - hw));
    this.camY = Phaser.Math.Clamp(this.camY, hh, Math.max(hh, this.map.pixelHeight - hh));
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

  // ------------------------------------------------------------ Regionen

  private updateRegion(dt: number): void {
    this.regionCheckT -= dt;
    if (this.regionCheckT > 0) return;
    this.regionCheckT = 0.5;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    // Erkundung für die Weltkarte (8×8-Kachelblöcke)
    const bx = Math.floor(tx / 8);
    const by = Math.floor(ty / 8);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) Game.explored.add(`${Game.player.map}:${bx + dx},${by + dy}`);
    const meta = this.loaded.meta;
    if (!meta) {
      this.updateMusic();
      return;
    }
    const rid = REGION_IDS[meta.region[ty * this.map.w + tx]];
    if (rid && rid !== 'meer' && rid !== this.region) {
      this.region = rid;
      this.game.events.emit('hud-banner', REGIONS[rid].name);
      this.registry.set('region', rid);
    }
    this.updateMusic();
    for (const t of TOWNS) {
      if (Math.hypot(t.x - tx, t.y - ty) < 16 && !Game.visited.has(t.id)) {
        Game.visited.add(t.id);
        this.toast(`Neue Stadt entdeckt: ${t.name}`);
      }
    }
  }

  private gadgetT = 0;
  private npcSyncT = 2;

  /** Fernglas (Minikarte zeigt Monster und Karten) und Sternenkompass (Pfeil zur fehlenden Karte) */
  private updateGadgets(dt: number): void {
    this.gadgetT -= dt;
    if (this.gadgetT > 0) return;
    this.gadgetT = 0.3;
    const tools = Game.inv.tools;
    if (tools.has('fernglas')) {
      const dots: [number, number, number][] = [];
      for (const e of this.enemies.list) if (e.active && e.team === 'enemy' && e.state !== 'hidden') dots.push([Math.floor(e.x / TILE), Math.floor(e.y / TILE), 0]);
      for (const g of Game.ground) if (g.map === Game.player.map) dots.push([Math.floor(g.x / TILE), Math.floor(g.y / TILE), 1]);
      this.registry.set('radar', dots);
    } else this.registry.set('radar', null);
    if (tools.has('sternenkompass')) {
      const missing = (id: string) => {
        const c = ALL_CARDS.find((x) => x.id === id);
        return !!c && c.kind === 'sammel' && Game.book.sammel[c.no] === null && Game.registry.canCreate(id);
      };
      let best: [number, number] | null = null;
      let bd = 1e12;
      this.map.objects.forEach((o) => {
        if (o.hidden || !o.tag) return;
        let wants = false;
        if (o.def.interact === 'chest' && !Game.flags.has(`offen:${o.tag}`)) wants = (TREASURES[o.tag]?.cards ?? []).some(missing);
        else if (o.tag.startsWith('pickup:')) wants = missing(PICKUPS[o.tag.split(':')[1]]?.card ?? '');
        else if (SPOTS[o.tag]?.card) wants = missing(SPOTS[o.tag].card!);
        if (!wants) return;
        const d = (o.x - this.player.x) ** 2 + (o.y - this.player.y) ** 2;
        if (d < bd) {
          bd = d;
          best = [o.x, o.y];
        }
      });
      this.registry.set('compassTarget', best);
    } else this.registry.set('compassTarget', null);
  }

  /** Wetter der aktuellen Region */
  weatherNow(): string {
    const ov = Game.vars.get('wetter-bis');
    const kinds: BaseWeather[] = ['klar', 'regen', 'sturm'];
    const override = ov ? { kind: kinds[Game.vars.get('wetter-art') ?? 0] ?? 'klar', until: ov } : undefined;
    const base = baseWeather(Game.day, Game.clock, override);
    if (!this.loaded.meta) return 'klar';
    return regionWeather(this.region || 'taufeld', base, Game.inv.tools.has('ewige-laterne'));
  }

  /** Tag/Nacht, Lichter und Wetter */
  private updateAtmosphere(dt: number, view: Phaser.Geom.Rectangle): void {
    const w = this.weatherNow() as ReturnType<typeof regionWeather>;
    this.atmo.setWeather(w);
    this.atmo.heavyFog = this.region === 'nebelhain' && !Game.inv.tools.has('ewige-laterne');
    this.registry.set('weather', w);
    const ambient = ambientFor(Game.clock, Game.isFullMoon(), !!this.loaded.dark);
    const L = this.lightList;
    L.length = 0;
    if (ambient !== 0xffffff || w !== 'klar') {
      this.objects.forEachActive((i) => {
        const o = this.map.objects[i];
        const l = o.def.light;
        if (l) L.push({ x: o.x, y: o.y + l.y, radius: l.radius, color: l.color });
      });
      const p = this.player;
      if (p.lightOn) L.push({ x: p.x, y: p.y - 10, radius: Game.inv.tools.has('ewige-laterne') ? 96 : 72, color: 0xffe2a0 });
      else L.push({ x: p.x, y: p.y - 10, radius: 30, color: 0x8a96c8, alpha: 0.6 });
      if (p.sense) L.push({ x: p.x, y: p.y - 10, radius: 40, color: p.auraColor, alpha: 0.5 });
      for (const l of this.extraLights) L.push(l);
      for (const e of this.enemies.list) {
        if (!e.active || e.state === 'dead') continue;
        const id = e.def.id;
        if (id === 'irrlicht' || id === 'quallenlicht') L.push({ x: e.x, y: e.y - 10 - e.z, radius: 34, color: id === 'irrlicht' ? 0x9fe8ff : 0xff9ff0, alpha: 0.8 });
      }
    }
    this.atmo.update(dt, view, ambient, L);
  }

  /** Passende Musik wählen: Vorrang > Lagerfeuer > Region bzw. Karte */
  private updateMusic(): void {
    const px = this.player.x;
    const py = this.player.y;
    const limit = this.atCampfire ? 96 : 56;
    this.atCampfire = this.campfires.some((c) => Math.abs(c.x - px) < limit && Math.abs(c.y - py) < limit && Math.hypot(c.x - px, c.y - py) < limit);
    let id = this.loaded.meta && this.region ? REGIONS[this.region].music : this.loaded.music;
    if (this.atCampfire) id = 'lagerfeuer';
    if (this.musicOverride) id = this.musicOverride;
    Sound.music(id, this.atCampfire ? 2 : 1.4);
  }

  // ------------------------------------------------------------ Update

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

    const simDt = this.wheelOpen ? dt * 0.25 : dt;
    const busy = this.messageOpen() || this.dying || this.warping;

    if (!busy && this.levelUpPending && Game.prog.pending > 0 && !this.wheelOpen) {
      this.levelUpPending = false;
      this.openLevelUp();
      return;
    }

    if (!busy) {
      this.updateAuraInput(dt);
      this.player.frozen = this.wheelOpen;
      if (Input.justPressed('pause')) {
        this.openPause();
        return;
      }
      if (Input.justPressed('book')) {
        this.openBook();
        return;
      }
      if (Input.justPressed('map')) {
        this.openMap();
        return;
      }
      this.player.update(simDt, Input);
      Game.tick(simDt);
      for (const m of this.mods) m.update?.(this.host, simDt);
      if (this.hudTimer) {
        this.hudTimer.left -= simDt;
        this.registry.set('hudTimer', this.hudTimer);
      }
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
    if (this.dying) this.player.update(dt, Input);
    this.updateCamera(dt);
    const view = this.cameras.main.worldView;
    this.tiles.update(view, dt);
    this.objects.update(view);
    if (!this.messageOpen()) {
      this.enemies.update(simDt, time, view);
      this.projectiles.update(simDt, time);
      this.decoy.update(simDt, time);
    }
    for (const n of this.npcs) n.update(simDt, this.player.x, this.player.y);
    this.numbers.update(dt);
    this.fx.update(dt);
    this.updateRegion(dt);
    this.updateAtmosphere(dt, view);
    this.npcSyncT -= dt;
    if (this.npcSyncT <= 0) {
      this.npcSyncT = 2;
      this.syncNpcs();
    }
    this.game.events.emit('world-update', dt, time);
    // versteckte Stellen nur mit Aura-Sinn sichtbar
    const reveal = this.player.sense || Game.inv.tools.has('linse');
    for (const i of this.hiddenSpots) {
      const s = this.objects.spriteOf(i);
      if (s) s.setAlpha(reveal ? 0.6 + Math.sin(time / 150) * 0.4 : 0);
    }
    this.updateGadgets(dt);

    const aim = this.aimWorld();
    this.crosshair.setVisible(!!aim && !this.messageOpen());
    if (aim) this.crosshair.setPosition(Math.round(aim.x), Math.round(aim.y));
    this.input.setDefaultCursor(aim ? 'none' : (this.registry.get('cursorCss') as string) ?? 'default');

    this.registry.set('playerCell', [Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE)]);
    this.registry.set('playerPos', [this.player.x, this.player.y]);
    this.registry.set('activeObjects', this.objects.activeCount);
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
      const free = ALL_CARDS.filter((c) => Game.registry.canCreate(c.id));
      if (free.length) Game.giveCard(free[Math.floor(Math.random() * free.length)].id);
    }
    if (Input.keyPressed('F8')) {
      for (let i = 0; i < 10; i++) {
        const free = SAMMELKARTEN.filter((c) => Game.registry.canCreate(c.id) && Game.book.sammel[c.no] === null);
        if (!free.length) break;
        const uid = Game.giveCard(free[Math.floor(Math.random() * free.length)].id);
        if (uid !== null) Game.book.file(uid);
      }
      Game.events.emit('book-changed');
    }
    if (Input.keyPressed('F9')) exportTextures(this);
    if (Input.keyPressed('KeyU')) {
      this.player.godMode = !this.player.godMode;
      this.toast(`Unverwundbar ${this.player.godMode ? 'an' : 'aus'}`);
    }
    if (Input.keyPressed('KeyL')) Game.gainXp(Game.prog.xpNext - Game.prog.xp);
    if (Input.keyPressed('KeyK')) {
      for (const e of this.enemies.list) if (e.active && e.team === 'enemy') this.enemies.damage(e, { dmg: 9999, crit: false }, { fromX: this.player.x, fromY: this.player.y, kb: 0, src: 'special' });
    }
    if (Input.keyPressed('KeyJ')) {
      const ids = Object.keys(MONSTER_BY_ID);
      const idx = ((this.registry.get('dbgMon') as number) ?? -1) + 1;
      this.registry.set('dbgMon', idx % ids.length);
      const def = MONSTER_BY_ID[ids[idx % ids.length]];
      this.enemies.spawn(def, this.player.x + 40, this.player.y);
      this.toast(`Debug: ${def.name}`);
    }
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
