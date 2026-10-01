import { card } from '../../data/cards';

/** Wer eine Karte gerade besitzt: 'spieler', 'boden', 'rivale:<id>', … */
export type Owner = string;

export interface CardInstance {
  uid: number;
  id: string;
  owner: Owner;
}

export interface RegistrySave {
  next: number;
  list: [number, string, Owner][];
}

/**
 * Globales Kartenregister: Jedes existierende Exemplar einer Karte ist hier eingetragen –
 * egal ob im Buch der Spielfigur, am Boden oder bei einer KI-Figur. Das Limit einer Karte
 * gilt für die ganze Insel. Verwandelte oder zerstörte Karten werden ausgetragen und
 * geben ihren Platz im Limit wieder frei.
 */
export class CardRegistry {
  private readonly instances = new Map<number, CardInstance>();
  private readonly counts = new Map<string, number>();
  private nextUid = 1;

  /** Anzahl existierender Exemplare */
  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  /** Noch freie Exemplare bis zum Limit */
  remaining(id: string): number {
    return Math.max(0, card(id).limit - this.count(id));
  }

  canCreate(id: string): boolean {
    return this.remaining(id) > 0;
  }

  /** Erzeugt ein neues Exemplar – oder null, wenn das Limit erreicht ist. */
  create(id: string, owner: Owner): CardInstance | null {
    if (!this.canCreate(id)) return null;
    const inst: CardInstance = { uid: this.nextUid++, id, owner };
    this.instances.set(inst.uid, inst);
    this.counts.set(id, this.count(id) + 1);
    return inst;
  }

  get(uid: number): CardInstance | undefined {
    return this.instances.get(uid);
  }

  idOf(uid: number): string {
    const inst = this.instances.get(uid);
    if (!inst) throw new Error(`Unbekanntes Kartenexemplar ${uid}`);
    return inst.id;
  }

  /** Karte existiert nicht mehr (verwandelt, zerstört). */
  destroy(uid: number): void {
    const inst = this.instances.get(uid);
    if (!inst) return;
    this.instances.delete(uid);
    this.counts.set(inst.id, Math.max(0, this.count(inst.id) - 1));
  }

  transfer(uid: number, owner: Owner): void {
    const inst = this.instances.get(uid);
    if (inst) inst.owner = owner;
  }

  /** Alle Besitzer einer Karte (für Informationszauber) */
  owners(id: string): Owner[] {
    const out = new Set<Owner>();
    for (const i of this.instances.values()) if (i.id === id) out.add(i.owner);
    return [...out];
  }

  ownedBy(owner: Owner): CardInstance[] {
    return [...this.instances.values()].filter((i) => i.owner === owner);
  }

  serialize(): RegistrySave {
    return { next: this.nextUid, list: [...this.instances.values()].map((i) => [i.uid, i.id, i.owner]) };
  }

  static deserialize(s: RegistrySave): CardRegistry {
    const r = new CardRegistry();
    r.nextUid = s.next;
    for (const [uid, id, owner] of s.list) {
      r.instances.set(uid, { uid, id, owner });
      r.counts.set(id, r.count(id) + 1);
    }
    return r;
  }
}
