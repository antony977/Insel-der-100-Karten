import { card } from '../../data/cards';
import type { CardDef, EquipSlot, Stats } from '../../data/cardTypes';

export const BASE_STATS: Stats = { lp: 100, aura: 100, str: 5, spd: 5, ctrl: 5, def: 0, luck: 0, regen: 0, dodge: 0 };

export const STAT_LABELS: Record<keyof Stats, string> = {
  lp: 'LP',
  aura: 'Aura',
  str: 'Stärke',
  spd: 'Tempo',
  ctrl: 'Aura-Kontrolle',
  def: 'Verteidigung',
  luck: 'Glück',
  regen: 'Regeneration',
  dodge: 'Ausweichen',
};

export const SLOT_LABELS: Record<EquipSlot, string> = {
  kopf: 'Kopf',
  koerper: 'Körper',
  fuesse: 'Füsse',
  schmuck: 'Schmuck',
};

export interface InventorySave {
  bag: [string, number][];
  equip: Partial<Record<EquipSlot, string>>;
  tools: string[];
  keys: string[];
  buffs: [string, number][];
  money: number;
  chips: number;
  perma: Partial<Stats>;
  lp: number;
  aura: number;
  companions: string[];
  wonders: string[];
}

export type UseResult = { ok: boolean; message: string };

/**
 * Echte Gegenstände (aus entfesselten Karten): Beutel, Ausrüstung, Werkzeuge, Schlüssel,
 * zeitlich begrenzte Effekte sowie Geld und Lebenspunkte.
 */
export class Inventory {
  /** Gegenstand (Karten-ID) → Anzahl */
  readonly bag = new Map<string, number>();
  readonly equip: Partial<Record<EquipSlot, string>> = {};
  readonly tools = new Set<string>();
  readonly keys = new Set<string>();
  /** Effekt → verbleibende Sekunden */
  readonly buffs = new Map<string, number>();
  readonly companions: string[] = [];
  readonly wonders: string[] = [];
  perma: Partial<Stats> = {};
  money = 200;
  chips = 0;
  lp = BASE_STATS.lp;
  aura = BASE_STATS.aura;

  stats(): Stats {
    const s: Stats = { ...BASE_STATS };
    const add = (p: Partial<Stats>) => {
      for (const k of Object.keys(p) as (keyof Stats)[]) s[k] += p[k] ?? 0;
    };
    add(this.perma);
    for (const id of Object.values(this.equip)) {
      if (!id) continue;
      const u = card(id).unleash;
      if (u.kind === 'equip') add(u.stats);
    }
    return s;
  }

  addItem(id: string, n = 1): void {
    this.bag.set(id, (this.bag.get(id) ?? 0) + n);
  }

  removeItem(id: string, n = 1): boolean {
    const have = this.bag.get(id) ?? 0;
    if (have < n) return false;
    if (have === n) this.bag.delete(id);
    else this.bag.set(id, have - n);
    return true;
  }

  /**
   * Eine Karte wird zum echten Gegenstand (Entfessle! oder 60-Sekunden-Regel).
   * Liefert eine Meldung für die Anzeige.
   */
  materialize(c: CardDef): string {
    const u = c.unleash;
    switch (u.kind) {
      case 'money':
        this.money += u.amount;
        return `${u.amount} Münzen erhalten.`;
      case 'chips':
        this.chips += u.amount;
        return `${u.amount} Casino-Chips erhalten.`;
      case 'perma':
        this.perma = { ...this.perma };
        for (const k of Object.keys(u.stats) as (keyof Stats)[]) this.perma[k] = (this.perma[k] ?? 0) + (u.stats[k] ?? 0);
        this.lp = this.stats().lp;
        this.aura = this.stats().aura;
        return 'Eine warme Kraft durchströmt dich. Deine Werte steigen dauerhaft!';
      case 'tool':
        this.tools.add(u.tool);
        return `${c.name} ist jetzt ein echtes Werkzeug in deinem Besitz.`;
      case 'key':
        this.keys.add(u.key);
        return `${c.name} gehört jetzt dir.`;
      case 'spell':
        return `${c.name} wurde gewirkt.`;
      default:
        this.addItem(c.id);
        return `${c.name} liegt jetzt als echter Gegenstand in deinem Beutel.`;
    }
  }

  /** Gegenstand aus dem Beutel benutzen / ausrüsten. */
  use(id: string): UseResult {
    const c = card(id);
    const u = c.unleash;
    const st = this.stats();
    if (!this.bag.has(id) && !Object.values(this.equip).includes(id)) return { ok: false, message: 'Nicht im Beutel.' };
    switch (u.kind) {
      case 'heal': {
        if (this.lp >= st.lp) return { ok: false, message: 'Deine LP sind schon voll.' };
        this.removeItem(id);
        const before = this.lp;
        this.lp = Math.min(st.lp, this.lp + u.lp);
        return { ok: true, message: `+${this.lp - before} LP` };
      }
      case 'aura': {
        if (this.aura >= st.aura) return { ok: false, message: 'Deine Aura ist schon voll.' };
        this.removeItem(id);
        const before = this.aura;
        this.aura = Math.min(st.aura, this.aura + u.aura);
        return { ok: true, message: `+${this.aura - before} Aura` };
      }
      case 'restore':
        this.removeItem(id);
        this.lp = st.lp;
        this.aura = st.aura;
        return { ok: true, message: 'Vollständig geheilt!' };
      case 'buff':
        this.removeItem(id);
        this.buffs.set(u.buff, u.seconds);
        return { ok: true, message: `${c.name} wirkt ${u.seconds >= 60 ? `${Math.round(u.seconds / 60)} Minuten` : `${u.seconds} Sekunden`}.` };
      case 'equip': {
        if (this.equip[u.slot] === id) {
          delete this.equip[u.slot];
          this.addItem(id);
          this.clampVitals();
          return { ok: true, message: `${c.name} abgelegt.` };
        }
        const prev = this.equip[u.slot];
        if (prev) this.addItem(prev);
        this.removeItem(id);
        this.equip[u.slot] = id;
        this.clampVitals();
        return { ok: true, message: `${c.name} ausgerüstet.` };
      }
      case 'companion':
        return { ok: false, message: 'Begleiter können ab Meilenstein 3 gerufen werden.' };
      case 'wonder':
        return { ok: false, message: 'Dieses Wunder braucht einen besonderen Ort (folgt mit den Regionen).' };
      case 'throw':
        return { ok: false, message: 'Werfen geht im Kampf (folgt in Meilenstein 3).' };
      case 'trade':
        return { ok: false, message: `Händler zahlen dafür ${u.value} Münzen.` };
      default:
        return { ok: false, message: 'Kann nicht benutzt werden.' };
    }
  }

  isEquipped(id: string): boolean {
    return Object.values(this.equip).includes(id);
  }

  private clampVitals(): void {
    const s = this.stats();
    this.lp = Math.min(this.lp, s.lp);
    this.aura = Math.min(this.aura, s.aura);
  }

  tick(dt: number): void {
    for (const [k, v] of this.buffs) {
      if (v - dt <= 0) this.buffs.delete(k);
      else this.buffs.set(k, v - dt);
    }
  }

  serialize(): InventorySave {
    return {
      bag: [...this.bag],
      equip: { ...this.equip },
      tools: [...this.tools],
      keys: [...this.keys],
      buffs: [...this.buffs],
      money: this.money,
      chips: this.chips,
      perma: { ...this.perma },
      lp: this.lp,
      aura: this.aura,
      companions: [...this.companions],
      wonders: [...this.wonders],
    };
  }

  load(s: InventorySave): void {
    this.bag.clear();
    for (const [k, v] of s.bag) this.bag.set(k, v);
    for (const k of Object.keys(this.equip) as EquipSlot[]) delete this.equip[k];
    Object.assign(this.equip, s.equip);
    this.tools.clear();
    s.tools.forEach((t) => this.tools.add(t));
    this.keys.clear();
    s.keys.forEach((t) => this.keys.add(t));
    this.buffs.clear();
    for (const [k, v] of s.buffs) this.buffs.set(k, v);
    this.money = s.money;
    this.chips = s.chips;
    this.perma = { ...s.perma };
    this.lp = s.lp;
    this.aura = s.aura;
    this.companions.length = 0;
    this.companions.push(...(s.companions ?? []));
    this.wonders.length = 0;
    this.wonders.push(...(s.wonders ?? []));
  }
}
