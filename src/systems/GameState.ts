import { card } from '../data/cards';
import type { CardDef } from '../data/cardTypes';
import { Book, OUTSIDE_SECONDS, type BookSave, MOVE_MESSAGES } from './cards/Book';
import { CardRegistry, type RegistrySave } from './cards/CardRegistry';
import { Inventory, type InventorySave } from './cards/Inventory';

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
}

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
  message: (text: string) => void;
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
  player = { map: 'testwiese', x: 0, y: 0, name: 'Kai' };
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
    this.player = { map: 'testwiese', x: 0, y: 0, name: 'Kai' };
    this.events.emit('book-changed');
    this.events.emit('vitals-changed');
    this.events.emit('ground-changed');
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
    // 60-Sekunden-Regel für Karten in der Hand
    const expired = this.book.tick(dt);
    for (const uid of expired) {
      const def = card(this.registry.idOf(uid));
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
        if (g.uid !== undefined) this.registry.destroy(g.uid);
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
    this.events.emit('book-changed');
    this.events.emit('vitals-changed');
    this.events.emit('ground-changed');
  }
}

export const Game = new GameStateStore();
