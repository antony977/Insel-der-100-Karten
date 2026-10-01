/**
 * Quest-Verwaltung: Jede Quest hat Stufen (0 = nicht begonnen). Die letzte Stufe bedeutet
 * „abgeschlossen". Die Texte erscheinen im Quest-Log des Kartenbuchs.
 */
export interface QuestDef {
  id: string;
  name: string;
  /** Ort/Auftraggeber */
  where: string;
  /** Beschreibung je Stufe (Index 1 … n); die letzte ist der Abschluss */
  steps: string[];
}

const QUESTS = new Map<string, QuestDef>();

export function registerQuests(list: QuestDef[]): void {
  for (const q of list) QUESTS.set(q.id, q);
}

export function questDef(id: string): QuestDef | undefined {
  return QUESTS.get(id);
}

export function allQuests(): QuestDef[] {
  return [...QUESTS.values()];
}

export class QuestLog {
  readonly stages = new Map<string, number>();

  stage(id: string): number {
    return this.stages.get(id) ?? 0;
  }

  set(id: string, stage: number): void {
    this.stages.set(id, stage);
  }

  done(id: string): boolean {
    const q = QUESTS.get(id);
    return !!q && this.stage(id) >= q.steps.length;
  }

  active(id: string): boolean {
    return this.stage(id) > 0 && !this.done(id);
  }

  /** Aktuelle Beschreibung */
  text(id: string): string {
    const q = QUESTS.get(id);
    if (!q) return '';
    const s = this.stage(id);
    return q.steps[Math.min(q.steps.length, Math.max(1, s)) - 1];
  }

  serialize(): [string, number][] {
    return [...this.stages];
  }

  load(d: [string, number][] | undefined): void {
    this.stages.clear();
    for (const [k, v] of d ?? []) this.stages.set(k, v);
  }
}
