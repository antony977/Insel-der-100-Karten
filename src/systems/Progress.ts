import {
  ABILITY_CARDS,
  AFFINITY_BY_ID,
  emptyMods,
  LEVEL_GROWTH,
  talentCard,
  TALENT_TREES,
  TECH_BY_ID,
  type AbilityCard,
  type AffinityId,
  type CardColor,
  type Mods,
  type TechniqueId,
} from '../data/aura';
import type { Stats } from '../data/cardTypes';
import { xpToNext } from '../data/monsters';

export interface ProgressSave {
  level: number;
  xp: number;
  affinity: AffinityId;
  techName: string;
  technique: TechniqueId;
  picks: string[];
  kills: [string, number][];
  deaths: number;
  rest: { map: string; x: number; y: number } | null;
  pending: number;
}

/** Stufe, Erfahrung, Aura-Affinität, gewählte Fähigkeitskarten und Talente. */
export class Progress {
  level = 1;
  xp = 0;
  affinity: AffinityId = 'wurzel';
  techName = AFFINITY_BY_ID.wurzel.defaultName;
  technique: TechniqueId = 'sinn';
  picks: string[] = [];
  kills = new Map<string, number>();
  deaths = 0;
  rest: { map: string; x: number; y: number } | null = null;
  /** noch nicht ausgewählte Level-Ups */
  pending = 0;
  private modsCache: Mods | null = null;
  private statsCache: Partial<Stats> | null = null;

  get xpNext(): number {
    return xpToNext(this.level);
  }

  /** Erfahrung gutschreiben; liefert die Anzahl neuer Stufen. */
  addXp(n: number): number {
    this.xp += n;
    let ups = 0;
    while (this.xp >= this.xpNext && this.level < 60) {
      this.xp -= this.xpNext;
      this.level++;
      ups++;
    }
    if (ups) {
      this.pending += ups;
      this.statsCache = null;
    }
    return ups;
  }

  static card(id: string): AbilityCard | null {
    const c = ABILITY_CARDS.find((a) => a.id === id);
    if (c) return c;
    const m = /^t-(\w+)-(\d)-(\d)$/.exec(id);
    if (!m) return null;
    const aff = m[1] as AffinityId;
    if (!TALENT_TREES[aff]) return null;
    return talentCard(aff, Number(m[2]), Number(m[3]));
  }

  /** nächste offene Talentstufe in einem Zweig (−1 = voll) */
  nextTier(branch: number): number {
    for (let t = 0; t < 4; t++) if (!this.picks.includes(`t-${this.affinity}-${branch}-${t}`)) return t;
    return -1;
  }

  /** Drei farbcodierte Karten zur Auswahl (je Farbe höchstens eine). */
  offer(rand: () => number = Math.random): AbilityCard[] {
    const colors: CardColor[] = ['rot', 'gruen', 'blau'];
    const talents: AbilityCard[] = [];
    for (let b = 0; b < 3; b++) {
      const t = this.nextTier(b);
      if (t >= 0) talents.push(talentCard(this.affinity, b, t));
    }
    // Gold (Talent) erscheint häufig, solange Talente offen sind
    let pool: CardColor[] = [...colors];
    if (talents.length) {
      if (rand() < 0.7) pool = ['gold', ...shuffle(colors, rand).slice(0, 2)];
    }
    pool = pool.slice(0, 3);
    return pool.map((col) => {
      if (col === 'gold') return talents[Math.floor(rand() * talents.length)];
      const opts = ABILITY_CARDS.filter((a) => a.color === col);
      return opts[Math.floor(rand() * opts.length)];
    });
  }

  pick(card: AbilityCard): void {
    this.picks.push(card.id);
    if (this.pending > 0) this.pending--;
    this.modsCache = null;
    this.statsCache = null;
  }

  setAffinity(a: AffinityId, techName?: string): void {
    this.affinity = a;
    this.techName = techName?.trim() || AFFINITY_BY_ID[a].defaultName;
    this.modsCache = null;
    this.statsCache = null;
  }

  get mods(): Mods {
    if (this.modsCache) return this.modsCache;
    const m = emptyMods();
    for (const id of this.picks) {
      const c = Progress.card(id);
      if (!c?.mods) continue;
      for (const k of Object.keys(c.mods) as (keyof Mods)[]) m[k] += c.mods[k] ?? 0;
    }
    this.modsCache = m;
    return m;
  }

  /** Zusatzwerte aus Stufe und Fähigkeitskarten */
  bonusStats(): Partial<Stats> {
    if (this.statsCache) return this.statsCache;
    const s: Partial<Stats> = {};
    const add = (p: Partial<Stats>, f = 1) => {
      for (const k of Object.keys(p) as (keyof Stats)[]) s[k] = (s[k] ?? 0) + (p[k] ?? 0) * f;
    };
    add(LEVEL_GROWTH, this.level - 1);
    for (const id of this.picks) {
      const c = Progress.card(id);
      if (c?.stats) add(c.stats);
    }
    this.statsCache = s;
    return s;
  }

  unlocked(t: TechniqueId): boolean {
    return this.level >= TECH_BY_ID[t].unlock;
  }

  addKill(id: string): void {
    this.kills.set(id, (this.kills.get(id) ?? 0) + 1);
  }

  serialize(): ProgressSave {
    return {
      level: this.level,
      xp: this.xp,
      affinity: this.affinity,
      techName: this.techName,
      technique: this.technique,
      picks: [...this.picks],
      kills: [...this.kills],
      deaths: this.deaths,
      rest: this.rest ? { ...this.rest } : null,
      pending: this.pending,
    };
  }

  load(s: ProgressSave | undefined): void {
    const d = s ?? new Progress().serialize();
    this.level = d.level;
    this.xp = d.xp;
    this.affinity = d.affinity;
    this.techName = d.techName;
    this.technique = d.technique;
    this.picks = [...d.picks];
    this.kills = new Map(d.kills);
    this.deaths = d.deaths;
    this.rest = d.rest ? { ...d.rest } : null;
    this.pending = d.pending ?? 0;
    this.modsCache = null;
    this.statsCache = null;
  }
}

function shuffle<T>(a: T[], rand: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
