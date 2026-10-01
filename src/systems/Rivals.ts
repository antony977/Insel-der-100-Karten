import type { CardRegistry } from './cards/CardRegistry';

/**
 * Datenmodell der anderen Sammler (KI-Rivalen). Ihre Karten liegen wie die der
 * Spielfigur im globalen Register – Limits gelten für alle.
 */
export interface RivalBook {
  /** Sammelseiten: Kartennummer → UID */
  sammel: Map<number, number>;
  /** freie Slots (UIDs, max. 45) */
  frei: number[];
}

export interface RivalState {
  id: string;
  name: string;
  /** schon begegnet (Ziel für Fern-Zauber) */
  met: boolean;
  /** Verbündet */
  ally: boolean;
  hostile: boolean;
  map: string;
  x: number;
  y: number;
  book: RivalBook;
  buffs: Map<string, number>;
  /** sichtbar auf der Karte bis (Spielzeit) */
  trackedUntil: number;
  money: number;
}

export interface RivalSave {
  id: string;
  met: boolean;
  ally: boolean;
  hostile: boolean;
  map: string;
  x: number;
  y: number;
  sammel: [number, number][];
  frei: number[];
  buffs: [string, number][];
  money: number;
}

export class RivalStore {
  readonly list: RivalState[] = [];

  get(id: string): RivalState | undefined {
    return this.list.find((r) => r.id === id);
  }

  met(): RivalState[] {
    return this.list.filter((r) => r.met);
  }

  /** Rivalen im Umkreis (gleiche Karte) */
  near(map: string, x: number, y: number, r: number): RivalState[] {
    return this.list.filter((v) => v.map === map && Math.hypot(v.x - x, v.y - y) <= r);
  }

  collected(r: RivalState): number {
    return r.book.sammel.size;
  }

  /** Karte in das Buch eines Rivalen legen (Sammelseite, sonst frei) */
  receive(r: RivalState, uid: number, reg: CardRegistry): boolean {
    const id = reg.idOf(uid);
    const no = Number(id);
    reg.transfer(uid, r.id);
    if (!id.startsWith('Z') && !r.book.sammel.has(no)) {
      r.book.sammel.set(no, uid);
      return true;
    }
    if (r.book.frei.length < 45) {
      r.book.frei.push(uid);
      return true;
    }
    reg.destroy(uid);
    return false;
  }

  /** UID aus dem Buch entfernen */
  remove(r: RivalState, uid: number): void {
    for (const [no, u] of r.book.sammel) if (u === uid) r.book.sammel.delete(no);
    const i = r.book.frei.indexOf(uid);
    if (i >= 0) r.book.frei.splice(i, 1);
  }

  tick(dt: number): void {
    for (const r of this.list) {
      for (const [k, v] of r.buffs) {
        if (v - dt <= 0) r.buffs.delete(k);
        else r.buffs.set(k, v - dt);
      }
    }
  }

  serialize(): RivalSave[] {
    return this.list.map((r) => ({
      id: r.id,
      met: r.met,
      ally: r.ally,
      hostile: r.hostile,
      map: r.map,
      x: r.x,
      y: r.y,
      sammel: [...r.book.sammel],
      frei: [...r.book.frei],
      buffs: [...r.buffs],
      money: r.money,
    }));
  }

  load(list: RivalSave[] | undefined, names: Record<string, string>): void {
    this.list.length = 0;
    for (const s of list ?? []) {
      this.list.push({
        id: s.id,
        name: names[s.id] ?? s.id,
        met: s.met,
        ally: s.ally,
        hostile: s.hostile,
        map: s.map,
        x: s.x,
        y: s.y,
        book: { sammel: new Map(s.sammel), frei: [...s.frei] },
        buffs: new Map(s.buffs),
        trackedUntil: 0,
        money: s.money,
      });
    }
  }
}
