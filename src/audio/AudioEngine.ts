import { lengthOf, RATE, renderTone } from './synth';
import { SFX } from './sfxDefs';
import { SONGS } from './songs';
import { renderSong } from './composer';
import { Settings, type SettingsData } from '../systems/Settings';
import { readGamepads } from '../input/InputManager';

/**
 * Sound-System auf Basis der Web-Audio-API.
 *
 * - Alle Effekte werden beim ersten Antippen/Tastendruck einmalig berechnet (wenige ms).
 * - Musik wird bei Bedarf in einem Web Worker gerendert und als Schleife abgespielt,
 *   Wechsel mit Überblendung. Höchstens vier Stücke bleiben im Speicher.
 * - Lautstärken folgen den Einstellungen (Musik, Effekte, Stumm).
 * - Eigene Dateien ersetzen generierte Klänge: `public/audio/overrides.json`, z. B.
 *   `{ "sfx": { "hit": "hit.ogg" }, "music": { "taufeld": "taufeld.mp3" } }`.
 */

export type SfxName = keyof typeof SFX;

interface PlayOpts {
  /** Lautstärke-Faktor */
  vol?: number;
  /** Tonhöhe/Tempo (1 = normal) */
  rate?: number;
  /** zufällige Tonhöhen-Streuung (z. B. 0.06) */
  vary?: number;
  /** Stereo (-1 links … 1 rechts) */
  pan?: number;
}

interface Track {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const MAX_VOICES = 18;
const MAX_SONGS = 4;
const MIN_GAP = 0.035;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private duckBus!: GainNode;
  private sfxBus!: GainNode;
  private sfx = new Map<string, AudioBuffer>();
  private songs = new Map<string, AudioBuffer>();
  private pending = new Set<string>();
  private lastPlayed = new Map<string, number>();
  private voices = 0;
  private track: Track | null = null;
  private wanted: string | null = null;
  private worker: Worker | null = null;
  private workerFailed = false;
  private overrides: { sfx: Record<string, string>; music: Record<string, string> } = { sfx: {}, music: {} };
  private ducked = new Set<string>();
  private unlocked = false;
  private amb: { name: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ambWanted: string | null = null;

  /** Einmal beim Start aufrufen: wartet auf die erste Nutzer-Geste (Browser-Vorgabe). */
  init(): void {
    const unlock = () => {
      this.unlock();
      if (this.unlocked) {
        for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) window.removeEventListener(ev, unlock, true);
      }
    };
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) window.addEventListener(ev, unlock, true);
    // Gamepad: Phaser-unabhängig prüfen
    const padCheck = () => {
      if (this.unlocked) return;
      const pads = readGamepads();
      for (const p of pads) if (p && p.buttons.some((b) => b.pressed)) unlock();
      requestAnimationFrame(padCheck);
    };
    requestAnimationFrame(padCheck);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    Settings.onChange((s, changed) => {
      if (changed.some((k) => k === 'musicVolume' || k === 'sfxVolume' || k === 'muted')) this.applyVolumes(s);
    });
  }

  private unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        this.unlocked = true;
        return;
      }
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        this.ctx = new AC();
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.musicBus = c.createGain();
      this.duckBus = c.createGain();
      this.sfxBus = c.createGain();
      // sanfter Begrenzer gegen Übersteuern bei vielen gleichzeitigen Effekten
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      this.musicBus.connect(this.duckBus).connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(comp).connect(c.destination);
      this.applyVolumes(Settings.get());
      this.duckBus.gain.value = this.ducked.size > 0 ? 0.45 : 1;
      this.renderSfx();
      void this.loadOverrides();
      if (this.wanted) this.startWanted();
      if (this.ambWanted) this.ambient(this.ambWanted);
    }
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().then(() => {
        this.unlocked = this.ctx?.state === 'running';
      });
      // iOS: stummen Puffer abspielen, um die Ausgabe freizuschalten
      const b = this.ctx.createBuffer(1, 1, RATE);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start(0);
    } else this.unlocked = true;
  }

  private applyVolumes(s: Readonly<SettingsData>): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // hörbare Kurve: Quadrat des Reglers
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1.6, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * s.musicVolume, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume * s.sfxVolume, t, 0.03);
  }

  private renderSfx(): void {
    if (!this.ctx) return;
    for (const [name, tones] of Object.entries(SFX)) {
      const len = Math.ceil(lengthOf(tones) * RATE);
      const buf = this.ctx.createBuffer(1, len, RATE);
      const data = new Float32Array(len);
      for (const t of tones) renderTone(data, t);
      buf.copyToChannel(data, 0);
      this.sfx.set(name, buf);
    }
  }

  private async loadOverrides(): Promise<void> {
    try {
      const res = await fetch('audio/overrides.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const json = (await res.json()) as Partial<typeof this.overrides>;
      this.overrides = { sfx: json.sfx ?? {}, music: json.music ?? {} };
    } catch {
      return;
    }
    for (const [name, file] of Object.entries(this.overrides.sfx)) {
      const buf = await this.decode(file);
      if (buf) this.sfx.set(name, buf);
    }
  }

  private async decode(file: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const res = await fetch(`audio/${file}`);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      return await new Promise<AudioBuffer>((resolve, reject) => this.ctx!.decodeAudioData(data, resolve, reject));
    } catch {
      return null;
    }
  }

  /** Soundeffekt abspielen */
  play(name: SfxName | string, opts: PlayOpts = {}): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const buf = this.sfx.get(name);
    if (!buf) return;
    const now = c.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < MIN_GAP) return;
    if (this.voices >= MAX_VOICES) return;
    this.lastPlayed.set(name, now);
    const src = c.createBufferSource();
    src.buffer = buf;
    let rate = opts.rate ?? 1;
    if (opts.vary) rate *= 1 + (Math.random() * 2 - 1) * opts.vary;
    src.playbackRate.value = rate;
    let node: AudioNode = src;
    if (opts.vol !== undefined && opts.vol !== 1) {
      const g = c.createGain();
      g.gain.value = opts.vol;
      node = node.connect(g);
    }
    if (opts.pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      node = node.connect(p);
    }
    node.connect(this.sfxBus);
    this.voices++;
    src.onended = () => {
      this.voices--;
      src.disconnect();
    };
    src.start(now);
  }

  /** Musik wechseln (null = Stille). Gleiche ID → nichts passiert. */
  music(id: string | null, fade = 1.2): void {
    if (id === this.wanted) return;
    this.wanted = id;
    if (!this.ctx) return;
    if (!id) {
      this.fadeOut(fade);
      return;
    }
    this.startWanted(fade);
  }

  get currentMusic(): string | null {
    return this.wanted;
  }

  /** Stück im Voraus berechnen (z. B. Nachbarregion) */
  prefetch(id: string): void {
    if (!this.ctx || this.songs.has(id) || this.pending.has(id) || !SONGS[id] || this.overrides.music[id]) return;
    this.requestSong(id);
  }

  private startWanted(fade = 1.2): void {
    const id = this.wanted;
    if (!id || !this.ctx) return;
    const buf = this.songs.get(id);
    if (buf) {
      // ans Ende der LRU-Liste
      this.songs.delete(id);
      this.songs.set(id, buf);
      this.crossfade(id, buf, fade);
      return;
    }
    // altes Stück schon ausblenden, während das neue entsteht
    if (this.track && this.track.id !== id) this.fadeOut(fade);
    const file = this.overrides.music[id];
    if (file) {
      this.pending.add(id);
      void this.decode(file).then((b) => {
        this.pending.delete(id);
        if (b) this.storeSong(id, b);
        else {
          delete this.overrides.music[id];
          this.requestSong(id);
        }
      });
      return;
    }
    this.requestSong(id);
  }

  private requestSong(id: string): void {
    if (this.pending.has(id) || !SONGS[id]) return;
    this.pending.add(id);
    const w = this.getWorker();
    if (w) {
      w.postMessage(id);
      return;
    }
    // Ausweichlösung ohne Worker: kurz verzögert im Hauptthread
    setTimeout(() => this.receive(id, renderSong(SONGS[id])), 30);
  }

  private getWorker(): Worker | null {
    if (this.worker || this.workerFailed) return this.worker;
    try {
      this.worker = new Worker(new URL('./musicWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: string; buf: Float32Array }>) => this.receive(e.data.id, e.data.buf);
      this.worker.onerror = () => {
        this.workerFailed = true;
        this.worker?.terminate();
        this.worker = null;
        const ids = [...this.pending];
        this.pending.clear();
        for (const id of ids) this.requestSong(id);
      };
    } catch {
      this.workerFailed = true;
      this.worker = null;
    }
    return this.worker;
  }

  private receive(id: string, data: Float32Array): void {
    this.pending.delete(id);
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, data.length, RATE);
    buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    this.storeSong(id, buf);
  }

  private storeSong(id: string, buf: AudioBuffer): void {
    this.songs.set(id, buf);
    while (this.songs.size > MAX_SONGS) {
      const oldest = [...this.songs.keys()].find((k) => k !== this.wanted && k !== this.track?.id);
      if (!oldest) break;
      this.songs.delete(oldest);
    }
    if (this.wanted === id && this.track?.id !== id) this.crossfade(id, buf, 1.2);
  }

  private crossfade(id: string, buf: AudioBuffer, fade: number): void {
    const c = this.ctx!;
    if (this.track?.id === id) return;
    this.fadeOut(fade);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = c.createGain();
    const t = c.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fade));
    src.connect(gain).connect(this.musicBus);
    src.start(t + 0.02);
    this.track = { id, src, gain };
  }

  private fadeOut(fade: number): void {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    this.track = null;
    const t = this.ctx.currentTime;
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
    tr.gain.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.05, fade));
    tr.src.stop(t + Math.max(0.05, fade) + 0.05);
    tr.src.onended = () => {
      tr.src.disconnect();
      tr.gain.disconnect();
    };
  }

  /** Hintergrundgeräusch als Schleife (Regen, Wind); null = aus */
  ambient(name: string | null, vol = 1): void {
    this.ambWanted = name;
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    if (this.amb && this.amb.name === name) {
      this.amb.gain.gain.setTargetAtTime(vol, t, 0.5);
      return;
    }
    if (this.amb) {
      const old = this.amb;
      this.amb = null;
      old.gain.gain.setTargetAtTime(0, t, 0.4);
      old.src.stop(t + 2);
    }
    if (!name) return;
    const buf = this.sfx.get(name);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.setTargetAtTime(vol, t, 0.6);
    src.connect(gain).connect(this.sfxBus);
    src.start(t);
    this.amb = { name, src, gain };
  }

  /** Musik leiser stellen (Dialoge, Buch); `key` = Verursacher, damit nichts hängen bleibt. */
  duck(key: string, on: boolean): void {
    if (on) this.ducked.add(key);
    else this.ducked.delete(key);
    if (!this.ctx) return;
    this.duckBus.gain.setTargetAtTime(this.ducked.size > 0 ? 0.45 : 1, this.ctx.currentTime, 0.15);
  }

  /** Für Tests */
  get state(): { ctx: string; music: string | null; playing: string | null; cached: string[]; voices: number } {
    return { ctx: this.ctx?.state ?? 'none', music: this.wanted, playing: this.track?.id ?? null, cached: [...this.songs.keys()], voices: this.voices };
  }
}

export const Sound = new AudioEngine();
