import { Game, SAVE_VERSION, type SaveData } from './GameState';
import { Storage } from './Storage';

export type SlotId = 'auto' | '1' | '2' | '3';
export const MANUAL_SLOTS: SlotId[] = ['1', '2', '3'];

export interface SlotInfo {
  slot: SlotId;
  savedAt: number;
  playTime: number;
  collected: number;
  money: number;
}

function key(slot: SlotId): string {
  return `save:${slot}`;
}

function collectedIn(d: SaveData): number {
  return d.book.sammel.filter((u) => u !== null).length;
}

export function formatPlayTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Speichersystem: automatischer Speicherstand + 3 manuelle Plätze (localStorage),
 * Export/Import als JSON-Datei.
 */
export const SaveSystem = {
  save(slot: SlotId): boolean {
    return Storage.set(key(slot), Game.serialize());
  },

  autosave(): boolean {
    return this.save('auto');
  },

  read(slot: SlotId): SaveData | null {
    const d = Storage.get<SaveData | null>(key(slot), null);
    if (!d || d.version !== SAVE_VERSION) return null;
    return d;
  },

  load(slot: SlotId): boolean {
    const d = this.read(slot);
    if (!d) return false;
    Game.load(d);
    return true;
  },

  info(slot: SlotId): SlotInfo | null {
    const d = this.read(slot);
    if (!d) return null;
    return { slot, savedAt: d.savedAt, playTime: d.playTime, collected: collectedIn(d), money: d.inv.money };
  },

  hasAny(): boolean {
    return (['auto', ...MANUAL_SLOTS] as SlotId[]).some((s) => this.read(s) !== null);
  },

  remove(slot: SlotId): void {
    Storage.remove(key(slot));
  },

  /** Lädt den aktuellen Spielstand als Datei herunter. */
  exportFile(): void {
    const data = JSON.stringify(Game.serialize(), null, 1);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insel-der-100-karten-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /** Öffnet einen Datei-Dialog und lädt einen exportierten Spielstand. */
  importFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return resolve(false);
        try {
          const d = JSON.parse(await file.text()) as SaveData;
          if (d.version !== SAVE_VERSION || !d.book || !d.registry) return resolve(false);
          Game.load(d);
          this.autosave();
          resolve(true);
        } catch {
          resolve(false);
        }
      });
      document.body.appendChild(input);
      input.click();
    });
  },
};
