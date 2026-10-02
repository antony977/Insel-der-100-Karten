import { card } from '../data/cards';
import type { CardDef } from '../data/cardTypes';
import { Book, OUTSIDE_SECONDS, type BookSave, MOVE_MESSAGES } from './cards/Book';
import { CardRegistry, type RegistrySave } from './cards/CardRegistry';
import { Inventory, type InventorySave, type UseAction } from './cards/Inventory';
import { Progress, type ProgressSave } from './Progress';
import { onQuestChange, QuestLog } from './Quests';
import { RivalStore, type RivalSave } from './Rivals';

export const SAVE_VERSION = 1;

/** Karte oder Gegenstand, der in der Welt am Boden liegt */
export interface GroundEntry {
  key: number;
  kind: 'card' | 'item';
  id: string;
  /** nur bei Karten: Exemplar im Register */
  uid?: number;
  /** nur bei Karten: Sekunden bis zur Verwandlung */
  timeLeft?: number;
  map: string;
  x: number;
  y: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  playTime: number;
  player: { map: string; x: number; y: number; name: string };
  registry: RegistrySave;
  book: BookSave;
  inv: InventorySave;
  flags: string[];
  discovered: string[];
  ground: GroundEntry[];
  groundKey: number;
  prog?: ProgressSave;
  clock?: number;
  day?: number;
  quests?: [string, number][];
  visited?: string[];
  quick?: (number | null)[];
  lastWell?: { map: string; x: number; y: number; town: string } | null;
  protectedCards?: number[];
  lost?: string[];
  vars?: [string, number][];
  explored?: string[];
  rivals?: RivalSave[];
  castLog?: { who: string; spell: string; t: number }[];
}

/** Namen der Rivalen (für das Laden) */
export const RIVAL_NAMES: Record<string, string> = {};

type Handler = (...args: never[]) => void;

/** Ereignisse für Oberfläche und Welt */
export interface GameEvents {
  'card-received': (def: CardDef, uid: number) => void;
  'card-limit': (def: CardDef) => void;
  'card-transformed': (def: CardDef, message: string) => void;
  'card-unleashed': (def: CardDef, message: string) => void;
  'ground-changed': () => void;
  'book-changed': () => void;
  'vitals-changed': () => void;
  'level-up': (level: number) => void;
  'xp-gained': (xp: number) => void;
  'item-action': (a: UseAction) => void;
  /** Aura-Technik erfolgreich eingesetzt */
  'technique-used': (id: string) => void;
  /** Nahkampfschlag der Spielfigur (für Kristalle u. Ä.) */
  'player-strike': (x: number, y: number, r: number, kind: string) => void;
  message: (text: string) => void;
  /** Queststufe hat sich geändert */
  'quest-changed': (id: string, from: number, to: number) => void;
}

class Emitter {
  private map = new Map<string, Set<Handler>>();
  on<K extends keyof GameEvents>(ev: K, fn: GameEvents[K]): () => void {
    const set = this.map.get(ev) ?? new Set();
    set.add(fn as Handler);
    this.map.set(ev, set);
    return () => set.delete(fn as Handler);
  }
  emit<K extends keyof GameEvents>(ev: K, ...args: Parameters<GameEvents[K]>): void {
    const set = this.map.get(ev);
    if (!set) return;
    for (const fn of set) (fn as (...a: unknown[]) => void)(...args);
  }
}

/**
 * Zentraler Spielstand: Kartenregister, Buch, Inventar, Flags, Bodenobjekte und Spielzeit.
 * Wird von allen Szenen geteilt und vom Speichersystem serialisiert.
 */
export class GameStateStore {
  registry = new CardRegistry();
  book = new Book(this.registry);
  inv = new Inventory();
  flags = new Set<string>();
  /** Karten, die man schon einmal besessen hat (Name im Buch sichtbar) */
  discovered = new Set<string>();
  ground: GroundEntry[] = [];
  playTime = 0;
  player = { map: 'insel', x: 0, y: 0, name: 'Kai' };
  prog = new Progress();
  /** Uhrzeit in Spielminuten (0–1439); 1 echte Sekunde = 2 Spielminuten */
  clock = 8 * 60;
  day = 1;
  quests = new QuestLog();
  /** besuchte Städte (für Stadtsprung) */
  visited = new Set<string>();
  /** Schnellzauber-Tasten 1–3 (Karten-UIDs) */
  quick: (number | null)[] = [null, null, null];
  /** zuletzt berührter Stadtbrunnen */
  lastWell: { map: string; x: number; y: number; town: string } | null = null;
  /** dauerhaft geschützte Karten (Siegelband) */
  protectedCards = new Set<number>();
  /** zuletzt verlorene Karten (für Phönixtinte) */
  lost: string[] = [];
  /** Zahlenwerte für Quests (z. B. Zählerstände) */
  vars = new Map<string, number>();
  /** erkundete 8×8-Blöcke je Karte (Weltkarte) */
  explored = new Set<string>();
  rivals = new RivalStore();
  /** wer zuletzt Zauber auf die Spielfigur gewirkt hat (Wirkerspur) */
  castLog: { who: string; spell: string; t: number }[] = [];
  readonly events = new Emitter();
  private groundKey = 1;
  private regenAcc = 0;

  newGame(): void {
    this.registry = new CardRegistry();
    this.book = new Book(this.registry);
    this.inv = new Inventory();
    this.flags = new Set();
    this.discovered = new Set();
    this.ground = [];
    this.groundKey = 1;
    this.playTime = 0;
    this.player = { map: 'insel', x: 0, y: 0, name: this.player?.name ?? 'Kai' };
    this.prog = new Progress();
    this.clock = 8 * 60;
    this.day = 1;
    this.quests = new QuestLog();
    this.visited = new Set(['taufeld']);
    this.quick = [null, null, null];
    this.lastWell = null;
    this.protectedCards = new Set();
    this.lost = [];
    this.vars = new Map();
    this.explored = new Set();
    this.rivals = new RivalStore();
    this.castLog = [];
    this.player.map = 'insel';
    this.syncBonus();
    this.events.emit('book-changed');
    this.events.emit('vitals-changed');
    this.events.emit('ground-changed');
  }

  /** Aktuelle New-Game-Plus-Stufe (0 = erster Durchgang) */
  get ngLevel(): number {
    return this.flags.has('ng3') ? 3 : this.flags.has('ng2') ? 2 : this.flags.has('ng1') ? 1 : 0;
  }

  /**
   * New Game+: Stufe, Affinität und Talente bleiben, Karten, Quests und Welt beginnen neu.
   * Monster werden stärker (bis zu drei Mal).
   */
  newGamePlus(): void {
    const prog = this.prog;
    const name = this.player.name;
    const next = Math.min(3, this.ngLevel + 1);
    const souvenirs = [...this.flags].filter((f) => f.startsWith('souvenir:'));
    this.newGame();
    this.prog = prog;
    this.player.name = name;
    for (let i = 1; i <= next; i++) this.flags.add(`ng${i}`);
    for (const f of souvenirs) this.flags.add(f);
    this.flags.add('frisch');
    this.inv.money = 500;
    this.syncBonus();
    const st = this.inv.stats();
    this.inv.lp = st.lp;
    this.inv.aura = st.aura;
    this.events.emit('vitals-changed');
  }

  /** Neue Karte erhalten (Truhe, Quest, Beute …). Landet in der Hand. */
  giveCard(id: string): number | null {
    const def = card(id);
    const inst = this.registry.create(id, 'spieler');
    if (!inst) {
      this.events.emit('card-limit', def);
      return null;
    }
    const r = this.book.receive(inst.uid);
    if (r !== 'ok') {
      // Hand voll → Karte fällt zu Boden
      this.registry.transfer(inst.uid, 'boden');
      this.dropToGround({ kind: 'card', id, uid: inst.uid, timeLeft: OUTSIDE_SECONDS, map: this.player.map, x: this.player.x, y: this.player.y + 6 });
      this.events.emit('message', MOVE_MESSAGES[r]);
      return inst.uid;
    }
    this.discovered.add(id);
    this.events.emit('card-received', def, inst.uid);
    this.events.emit('book-changed');
    return inst.uid;
  }

  /** Karte aus Buch/Hand auf den Boden legen. */
  dropCard(uid: number, x: number, y: number): void {
    const loc = this.book.locate(uid);
    if (!loc) return;
    const timeLeft = loc.area === 'hand' ? this.book.hand[loc.index].timeLeft : OUTSIDE_SECONDS;
    this.book.remove(uid);
    this.registry.transfer(uid, 'boden');
    this.dropToGround({ kind: 'card', id: this.registry.idOf(uid), uid, timeLeft, map: this.player.map, x, y });
    this.events.emit('book-changed');
  }

  dropToGround(e: Omit<GroundEntry, 'key'>): GroundEntry {
    const entry = { ...e, key: this.groundKey++ };
    this.ground.push(entry);
    this.events.emit('ground-changed');
    return entry;
  }

  /** Bodenobjekt aufheben. */
  pickUp(key: number): boolean {
    const i = this.ground.findIndex((g) => g.key === key);
    if (i < 0) return false;
    const g = this.ground[i];
    if (g.kind === 'card' && g.uid !== undefined) {
      const r = this.book.receive(g.uid);
      if (r !== 'ok') {
        this.events.emit('message', MOVE_MESSAGES[r]);
        return false;
      }
      // Der Timer läuft in der Hand weiter
      const h = this.book.hand[this.book.hand.length - 1];
      h.timeLeft = g.timeLeft ?? OUTSIDE_SECONDS;
      this.registry.transfer(g.uid, 'spieler');
      this.ground.splice(i, 1);
      this.events.emit('card-received', card(g.id), g.uid);
      this.events.emit('book-changed');
    } else {
      this.ground.splice(i, 1);
      const msg = this.inv.materialize(card(g.id));
      this.events.emit('message', msg);
      this.events.emit('vitals-changed');
    }
    this.events.emit('ground-changed');
    return true;
  }

  /** „Entfessle!": Karte wird dauerhaft zum Gegenstand. */
  unleash(uid: number): string | null {
    if (!this.book.locate(uid)) return null;
    const def = this.book.def(uid);
    if (def.kind === 'zauber') return null;
    if (this.book.locate(uid)?.area === 'sammel') this.markLost(def.id);
    this.book.remove(uid);
    this.registry.destroy(uid);
    const msg = this.inv.materialize(def);
    this.events.emit('card-unleashed', def, msg);
    this.events.emit('book-changed');
    this.events.emit('vitals-changed');
    return msg;
  }

  /** Spielzeit läuft (nur wenn die Welt aktiv ist). */
  tick(dt: number): void {
    this.playTime += dt;
    this.clock += dt * 2;
    if (this.clock >= 1440) {
      this.clock -= 1440;
      this.day++;
    }
    // 60-Sekunden-Regel für Karten in der Hand
    const expired = this.book.tick(dt);
    for (const uid of expired) {
      const def = card(this.registry.idOf(uid));
      this.markLost(def.id);
      this.registry.destroy(uid);
      const msg = def.kind === 'zauber' ? `${def.name} ist zu Staub zerfallen.` : this.inv.materialize(def);
      this.events.emit('card-transformed', def, msg);
    }
    if (expired.length) {
      this.events.emit('book-changed');
      this.events.emit('vitals-changed');
    }
    // Karten am Boden verwandeln sich ebenfalls
    let groundChanged = false;
    for (const g of this.ground) {
      if (g.kind !== 'card' || g.timeLeft === undefined) continue;
      g.timeLeft -= dt;
      if (g.timeLeft <= 0) {
        if (g.uid !== undefined) {
          this.markLost(g.id);
          this.registry.destroy(g.uid);
        }
        const def = card(g.id);
        if (def.kind === 'zauber') {
          g.id = '';
        } else {
          g.kind = 'item';
          g.uid = undefined;
          g.timeLeft = undefined;
        }
        groundChanged = true;
      }
    }
    if (groundChanged) {
      this.ground = this.ground.filter((g) => g.id !== '');
      this.events.emit('ground-changed');
    }
    this.inv.tick(dt);
    this.rivals.tick(dt);
    // Regeneration (Rosenquarz)
    const regen = this.inv.stats().regen;
    if (regen > 0) {
      this.regenAcc += dt;
      if (this.regenAcc >= 3) {
        this.regenAcc = 0;
        const max = this.inv.stats().lp;
        if (this.inv.lp < max) {
          this.inv.lp = Math.min(max, this.inv.lp + regen);
          this.events.emit('vitals-changed');
        }
      }
    }
  }

  /** Besitzt man die Karte (im Buch/Hand) oder ihren entfesselten Gegenstand? */
  hasThing(id: string): boolean {
    if (this.countCard(id) > 0) return true;
    const u = card(id).unleash;
    if (u.kind === 'tool') return this.inv.tools.has(u.tool);
    if (u.kind === 'key') return this.inv.keys.has(u.key);
    if (u.kind === 'equip') return this.inv.isEquipped(id) || this.inv.bag.has(id);
    return this.inv.bag.has(id);
  }

  kills(monster: string): number {
    return this.prog.kills.get(monster) ?? 0;
  }

  /** Wie oft besitzt die Spielfigur diese Karte (Buch + Hand)? */
  countCard(id: string): number {
    let n = 0;
    for (const u of this.book.sammel) if (u !== null && this.registry.idOf(u) === id) n++;
    for (const u of this.book.frei) if (u !== null && this.registry.idOf(u) === id) n++;
    for (const h of this.book.hand) if (this.registry.idOf(h.uid) === id) n++;
    return n;
  }

  /** Karten abgeben (Quest): zuerst aus der Hand, dann freie Slots, zuletzt Sammelseiten. */
  takeCards(id: string, n: number): boolean {
    if (this.countCard(id) < n) return false;
    const uids: number[] = [];
    for (const h of this.book.hand) if (this.registry.idOf(h.uid) === id) uids.push(h.uid);
    for (const u of this.book.frei) if (u !== null && this.registry.idOf(u) === id) uids.push(u);
    for (const u of this.book.sammel) if (u !== null && this.registry.idOf(u) === id) uids.push(u);
    for (const uid of uids.slice(0, n)) {
      this.markLost(id);
      this.book.remove(uid);
      this.registry.destroy(uid);
      this.quick = this.quick.map((q) => (q === uid ? null : q));
    }
    this.events.emit('book-changed');
    return true;
  }

  /** Stufen-/Talentwerte ins Inventar übertragen */
  syncBonus(): void {
    this.inv.bonus = this.prog.bonusStats();
  }

  isNight(): boolean {
    return this.clock < 5 * 60 || this.clock >= 20 * 60;
  }

  isFullMoon(): boolean {
    return this.day % 8 === 4 && this.isNight();
  }

  /** Erfahrung gutschreiben (Level-Up heilt vollständig). */
  gainXp(n: number): number {
    const ups = this.prog.addXp(n);
    this.events.emit('xp-gained', n);
    if (ups) {
      this.syncBonus();
      const st = this.inv.stats();
      this.inv.lp = st.lp;
      this.inv.aura = st.aura;
      this.events.emit('level-up', this.prog.level);
      this.events.emit('vitals-changed');
    }
    return ups;
  }

  /** Ein besiegtes Monster wird zur Karte (falls das Limit es erlaubt). */
  monsterCard(id: string, x: number, y: number): GroundEntry | null {
    const inst = this.registry.create(id, 'boden');
    if (!inst) return null;
    return this.dropToGround({ kind: 'card', id, uid: inst.uid, timeLeft: OUTSIDE_SECONDS, map: this.player.map, x, y });
  }

  /** Verlorene Karten merken (Phönixtinte kann sie wiederherstellen) */
  markLost(id: string): void {
    const i = this.lost.indexOf(id);
    if (i >= 0) this.lost.splice(i, 1);
    this.lost.push(id);
    if (this.lost.length > 20) this.lost.shift();
  }

  /** Erschöpft: Geld und alle Karten der freien Slots gehen verloren, Sammelseiten bleiben. */
  die(): { money: number; cards: string[] } {
    const money = this.inv.money;
    this.inv.money = 0;
    const cards: string[] = [];
    for (let i = 0; i < this.book.frei.length; i++) {
      const uid = this.book.frei[i];
      if (uid === null) continue;
      cards.push(this.registry.idOf(uid));
      this.markLost(this.registry.idOf(uid));
      this.book.remove(uid);
      this.registry.destroy(uid);
    }
    // Handkarten verwandeln sich nicht – sie gehen ebenfalls verloren
    for (const h of [...this.book.hand]) {
      cards.push(this.registry.idOf(h.uid));
      this.markLost(this.registry.idOf(h.uid));
      this.book.remove(h.uid);
      this.registry.destroy(h.uid);
    }
    this.prog.deaths++;
    this.quick = this.quick.map((q) => (q !== null && this.book.locate(q) ? q : null));
    const st = this.inv.stats();
    this.inv.lp = st.lp;
    this.inv.aura = st.aura;
    this.inv.buffs.clear();
    this.events.emit('book-changed');
    this.events.emit('vitals-changed');
    return { money, cards };
  }

  serialize(): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      playTime: this.playTime,
      player: { ...this.player },
      registry: this.registry.serialize(),
      book: this.book.serialize(),
      inv: this.inv.serialize(),
      flags: [...this.flags],
      discovered: [...this.discovered],
      ground: this.ground.map((g) => ({ ...g })),
      groundKey: this.groundKey,
      prog: this.prog.serialize(),
      clock: this.clock,
      day: this.day,
      quests: this.quests.serialize(),
      visited: [...this.visited],
      quick: [...this.quick],
      lastWell: this.lastWell ? { ...this.lastWell } : null,
      protectedCards: [...this.protectedCards],
      lost: [...this.lost],
      vars: [...this.vars],
      explored: [...this.explored],
      rivals: this.rivals.serialize(),
      castLog: this.castLog.map((c) => ({ ...c })),
    };
  }

  load(d: SaveData): void {
    if (d.version !== SAVE_VERSION) throw new Error('Unbekannte Speicherstand-Version');
    this.registry = CardRegistry.deserialize(d.registry);
    this.book = new Book(this.registry);
    this.book.load(d.book);
    this.inv = new Inventory();
    this.inv.load(d.inv);
    this.flags = new Set(d.flags);
    this.discovered = new Set(d.discovered ?? []);
    this.ground = d.ground.map((g) => ({ ...g }));
    this.groundKey = d.groundKey;
    this.playTime = d.playTime;
    this.player = { ...d.player };
    this.prog = new Progress();
    this.prog.load(d.prog);
    this.clock = d.clock ?? 8 * 60;
    this.day = d.day ?? 1;
    this.quests = new QuestLog();
    this.quests.load(d.quests);
    this.visited = new Set(d.visited ?? []);
    this.quick = d.quick ? [...d.quick] : [null, null, null];
    this.lastWell = d.lastWell ?? null;
    this.protectedCards = new Set(d.protectedCards ?? []);
    this.lost = [...(d.lost ?? [])];
    this.vars = new Map(d.vars ?? []);
    this.explored = new Set(d.explored ?? []);
    this.rivals = new RivalStore();
    this.rivals.load(d.rivals, RIVAL_NAMES);
    this.castLog = d.castLog ?? [];
    this.syncBonus();
    this.events.emit('book-changed');
    this.events.emit('vitals-changed');
    this.events.emit('ground-changed');
  }
}

export const Game = new GameStateStore();
onQuestChange((id, from, to) => Game.events.emit('quest-changed', id, from, to));
