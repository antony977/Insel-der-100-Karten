import { card } from '../../data/cards';
import type { CardDef } from '../../data/cardTypes';
import type { CardRegistry } from './CardRegistry';

export const COLLECTION_SLOTS = 100;
export const FREE_SLOTS = 45;
export const HAND_MAX = 10;
/** Sekunden, bis eine Karte ausserhalb des Buchs zu ihrem Gegenstand wird */
export const OUTSIDE_SECONDS = 60;

export type Area = 'sammel' | 'frei' | 'hand';

export interface Slot {
  area: Area;
  index: number;
}

export interface HandCard {
  uid: number;
  /** verbleibende Sekunden bis zur Verwandlung */
  timeLeft: number;
}

export interface BookSave {
  sammel: (number | null)[];
  frei: (number | null)[];
  hand: [number, number][];
}

export type MoveResult = 'ok' | 'falsche-nummer' | 'belegt' | 'voll' | 'unbekannt' | 'hand-voll';

/**
 * Das Kartenbuch mit allen Regeln:
 * - Sammelseiten: Slot N nimmt nur Sammelkarte N auf (je eine).
 * - Freie Slots: 45 Plätze für alles (Zauber, Doppelte, Gegenstandskarten).
 * - Hand: Karten ausserhalb des Buchs. Nach 60 s verwandeln sie sich dauerhaft.
 * - Nur Karten in den Sammelseiten zählen für den Fortschritt.
 */
export class Book {
  readonly sammel: (number | null)[] = new Array(COLLECTION_SLOTS).fill(null);
  readonly frei: (number | null)[] = new Array(FREE_SLOTS).fill(null);
  readonly hand: HandCard[] = [];
  private readonly registry: CardRegistry;

  constructor(registry: CardRegistry) {
    this.registry = registry;
  }

  def(uid: number): CardDef {
    return card(this.registry.idOf(uid));
  }

  /** Anzahl Karten in den Sammelseiten (Spielfortschritt) */
  collectedCount(): number {
    let n = 0;
    for (const u of this.sammel) if (u !== null) n++;
    return n;
  }

  freeUsed(): number {
    let n = 0;
    for (const u of this.frei) if (u !== null) n++;
    return n;
  }

  /** Wo liegt ein Exemplar? */
  locate(uid: number): Slot | null {
    let i = this.sammel.indexOf(uid);
    if (i >= 0) return { area: 'sammel', index: i };
    i = this.frei.indexOf(uid);
    if (i >= 0) return { area: 'frei', index: i };
    i = this.hand.findIndex((h) => h.uid === uid);
    if (i >= 0) return { area: 'hand', index: i };
    return null;
  }

  at(slot: Slot): number | null {
    if (slot.area === 'sammel') return this.sammel[slot.index] ?? null;
    if (slot.area === 'frei') return this.frei[slot.index] ?? null;
    return this.hand[slot.index]?.uid ?? null;
  }

  /** Darf diese Karte in diesen Slot (ohne Rücksicht auf Belegung)? */
  accepts(slot: Slot, uid: number): boolean {
    if (slot.area === 'sammel') {
      const d = this.def(uid);
      return d.kind === 'sammel' && d.no === slot.index;
    }
    return true;
  }

  /** Neue Karte erhalten → landet in der Hand (Timer läuft). */
  receive(uid: number): MoveResult {
    if (this.hand.length >= HAND_MAX) return 'hand-voll';
    this.hand.push({ uid, timeLeft: OUTSIDE_SECONDS });
    return 'ok';
  }

  private removeFrom(slot: Slot): void {
    if (slot.area === 'sammel') this.sammel[slot.index] = null;
    else if (slot.area === 'frei') this.frei[slot.index] = null;
    else this.hand.splice(slot.index, 1);
  }

  private putInto(slot: Slot, uid: number, timeLeft = OUTSIDE_SECONDS): void {
    if (slot.area === 'sammel') this.sammel[slot.index] = uid;
    else if (slot.area === 'frei') this.frei[slot.index] = uid;
    else this.hand.push({ uid, timeLeft });
  }

  /** Bester Platz im Buch: passender Sammel-Slot, sonst erster freier Slot. */
  bestSlotFor(uid: number): Slot | null {
    const d = this.def(uid);
    if (d.kind === 'sammel' && this.sammel[d.no] === null) return { area: 'sammel', index: d.no };
    const f = this.frei.indexOf(null);
    return f >= 0 ? { area: 'frei', index: f } : null;
  }

  /** Karte aus der Hand ins Buch legen (automatisch an den besten Platz). */
  file(uid: number): MoveResult {
    const from = this.locate(uid);
    if (!from) return 'unbekannt';
    const to = this.bestSlotFor(uid);
    if (!to) return 'voll';
    if (from.area !== 'hand' && from.area === to.area && from.index === to.index) return 'ok';
    // Aus freien Slots nur verschieben, wenn ein Sammel-Slot frei ist
    if (from.area === 'frei' && to.area === 'frei') return 'ok';
    this.removeFrom(from);
    this.putInto(to, uid);
    return 'ok';
  }

  /** Alle Handkarten einordnen. Gibt die Anzahl eingeordneter Karten zurück. */
  fileAll(): number {
    let n = 0;
    for (const h of [...this.hand]) if (this.file(h.uid) === 'ok') n++;
    return n;
  }

  /**
   * Verschiebt eine Karte in einen Ziel-Slot. Ist das Ziel belegt, wird getauscht –
   * aber nur, wenn beide Karten an den jeweils neuen Platz dürfen.
   */
  move(uid: number, to: Slot): MoveResult {
    const from = this.locate(uid);
    if (!from) return 'unbekannt';
    if (to.area === 'hand') return this.takeOut(uid);
    if (!this.accepts(to, uid)) return 'falsche-nummer';
    if (from.area === to.area && from.index === to.index) return 'ok';
    const other = this.at(to);
    if (other === null) {
      const timeLeft = from.area === 'hand' ? this.hand[from.index].timeLeft : OUTSIDE_SECONDS;
      this.removeFrom(from);
      this.putInto(to, uid, timeLeft);
      return 'ok';
    }
    // Tausch
    if (from.area === 'hand') {
      // Karte aus der Hand verdrängt eine Buchkarte → die verdrängte geht in die Hand
      if (!this.accepts(to, uid)) return 'falsche-nummer';
      this.hand.splice(from.index, 1);
      this.putInto(to, uid);
      this.hand.push({ uid: other, timeLeft: OUTSIDE_SECONDS });
      return 'ok';
    }
    if (!this.accepts(from, other)) return 'belegt';
    this.putInto(to, uid);
    this.putInto(from, other);
    return 'ok';
  }

  /** Karte aus dem Buch nehmen → Hand, 60-Sekunden-Timer startet. */
  takeOut(uid: number): MoveResult {
    const from = this.locate(uid);
    if (!from) return 'unbekannt';
    if (from.area === 'hand') return 'ok';
    if (this.hand.length >= HAND_MAX) return 'hand-voll';
    this.removeFrom(from);
    this.hand.push({ uid, timeLeft: OUTSIDE_SECONDS });
    return 'ok';
  }

  /** Karte entfernen (entfesselt, gestohlen, zerstört, abgelegt). */
  remove(uid: number): boolean {
    const from = this.locate(uid);
    if (!from) return false;
    this.removeFrom(from);
    return true;
  }

  /**
   * Lässt die Zeit für Karten ausserhalb des Buchs laufen.
   * Gibt die UIDs der Karten zurück, deren 60 Sekunden abgelaufen sind (bereits entfernt).
   */
  tick(dt: number): number[] {
    let expired: number[] | null = null;
    for (let i = this.hand.length - 1; i >= 0; i--) {
      const h = this.hand[i];
      h.timeLeft -= dt;
      if (h.timeLeft <= 0) {
        (expired ??= []).push(h.uid);
        this.hand.splice(i, 1);
      }
    }
    return expired ?? EMPTY;
  }

  /** Alle Exemplare im Buch (ohne Hand) */
  allInBook(): number[] {
    return [...this.sammel, ...this.frei].filter((u): u is number => u !== null);
  }

  serialize(): BookSave {
    return { sammel: [...this.sammel], frei: [...this.frei], hand: this.hand.map((h) => [h.uid, h.timeLeft]) };
  }

  load(s: BookSave): void {
    for (let i = 0; i < COLLECTION_SLOTS; i++) this.sammel[i] = s.sammel[i] ?? null;
    for (let i = 0; i < FREE_SLOTS; i++) this.frei[i] = s.frei[i] ?? null;
    this.hand.length = 0;
    for (const [uid, t] of s.hand) this.hand.push({ uid, timeLeft: t });
  }
}

const EMPTY: number[] = [];

export const MOVE_MESSAGES: Record<MoveResult, string> = {
  ok: '',
  'falsche-nummer': 'Dieser Slot nimmt nur die Karte mit seiner Nummer auf.',
  belegt: 'Der Slot ist belegt.',
  voll: 'Kein freier Slot mehr im Buch!',
  unbekannt: 'Diese Karte gibt es nicht mehr.',
  'hand-voll': 'Du hältst schon zu viele Karten in der Hand.',
};
