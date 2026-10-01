import { ACTIONS, DEFAULT_BINDINGS, type Action, type KeyBindings } from '../input/Actions';
import { Storage } from './Storage';

export type ScaleMode = 'integer' | 'fit';
export type RenderQuality = 'smooth' | 'retro';

export interface SettingsData {
  version: 1;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  screenShake: boolean;
  /** 0 langsam, 1 normal, 2 schnell, 3 sofort */
  textSpeed: number;
  scaleMode: ScaleMode;
  renderQuality: RenderQuality;
  touchSize: number;
  touchOpacity: number;
  vibration: boolean;
  leftHanded: boolean;
  colorblind: boolean;
  showFps: boolean;
  bindings: KeyBindings;
}

export const DEFAULT_SETTINGS: SettingsData = {
  version: 1,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  muted: false,
  screenShake: true,
  textSpeed: 1,
  scaleMode: 'integer',
  renderQuality: 'smooth',
  touchSize: 1,
  touchOpacity: 0.6,
  vibration: true,
  leftHanded: false,
  colorblind: false,
  showFps: false,
  bindings: DEFAULT_BINDINGS,
};

type Listener = (s: SettingsData, changed: (keyof SettingsData)[]) => void;

function cloneBindings(b: KeyBindings): KeyBindings {
  const out = {} as KeyBindings;
  for (const a of ACTIONS) out[a] = [...(b[a] ?? DEFAULT_BINDINGS[a])];
  return out;
}

class SettingsStore {
  private data: SettingsData;
  private listeners = new Set<Listener>();

  constructor() {
    const stored = Storage.get<Partial<SettingsData> | null>('settings', null);
    this.data = {
      ...DEFAULT_SETTINGS,
      ...(stored ?? {}),
      bindings: cloneBindings({ ...DEFAULT_BINDINGS, ...(stored?.bindings ?? {}) }),
      version: 1,
    };
  }

  get(): Readonly<SettingsData> {
    return this.data;
  }

  set(patch: Partial<SettingsData>): void {
    const changed = Object.keys(patch) as (keyof SettingsData)[];
    this.data = { ...this.data, ...patch };
    if (patch.bindings) this.data.bindings = cloneBindings(patch.bindings);
    Storage.set('settings', this.data);
    for (const l of this.listeners) l(this.data, changed);
  }

  setBinding(action: Action, keys: string[]): void {
    const bindings = cloneBindings(this.data.bindings);
    // Taste aus anderen Aktionen entfernen, damit sie eindeutig bleibt
    for (const a of ACTIONS) {
      if (a !== action) bindings[a] = bindings[a].filter((k) => !keys.includes(k));
    }
    bindings[action] = keys;
    this.set({ bindings });
  }

  resetBindings(): void {
    this.set({ bindings: cloneBindings(DEFAULT_BINDINGS) });
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const Settings = new SettingsStore();
