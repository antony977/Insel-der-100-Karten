import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Menu, type MenuItem } from '../ui/Menu';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Settings, type SettingsData } from '../systems/Settings';

const onOff = (b: boolean) => (b ? 'An' : 'Aus');
const pct = (v: number) => `${Math.round(v * 100)} %`;
const TEXT_SPEEDS = ['Langsam', 'Normal', 'Schnell', 'Sofort'];

type NumKey = 'musicVolume' | 'sfxVolume' | 'touchSize' | 'touchOpacity';
type BoolKey = 'muted' | 'screenShake' | 'vibration' | 'leftHanded' | 'colorblind' | 'showFps';

export class SettingsScene extends BaseScene {
  private menu!: Menu;
  private from = 'Title';
  private skipFrame = true;

  constructor() {
    super('Settings');
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? 'Title';
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.skipFrame = true;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.7).setOrigin(0, 0);
    const w = 300;
    const h = 244;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    addPanel(this, x, y, w, h);
    addText(this, GAME_W / 2, y + 7, 'Einstellungen', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });

    const num = (label: string, key: NumKey, min: number, max: number, step: number): MenuItem => ({
      label,
      value: () => pct(Settings.get()[key]),
      onLeft: () => this.setNum(key, Math.max(min, +(Settings.get()[key] - step).toFixed(2))),
      onRight: () => this.setNum(key, Math.min(max, +(Settings.get()[key] + step).toFixed(2))),
      onSelect: () => {
        const v = Settings.get()[key] + step;
        this.setNum(key, v > max + 0.001 ? min : +v.toFixed(2));
      },
    });
    const bool = (label: string, key: BoolKey): MenuItem => ({
      label,
      value: () => onOff(Settings.get()[key]),
      onLeft: () => this.setBool(key, !Settings.get()[key]),
      onRight: () => this.setBool(key, !Settings.get()[key]),
      onSelect: () => this.setBool(key, !Settings.get()[key]),
    });
    const cycleText = (d: number) => Settings.set({ textSpeed: (Settings.get().textSpeed + d + 4) % 4 });
    const toggleScale = () => Settings.set({ scaleMode: Settings.get().scaleMode === 'integer' ? 'fit' : 'integer' });
    const toggleQuality = () => Settings.set({ renderQuality: Settings.get().renderQuality === 'smooth' ? 'retro' : 'smooth' });

    const items: MenuItem[] = [
      num('Musik', 'musicVolume', 0, 1, 0.1),
      num('Effekte', 'sfxVolume', 0, 1, 0.1),
      bool('Stumm', 'muted'),
      bool('Bildschirm-Wackeln', 'screenShake'),
      {
        label: 'Textgeschwindigkeit',
        value: () => TEXT_SPEEDS[Settings.get().textSpeed],
        onLeft: () => cycleText(-1),
        onRight: () => cycleText(1),
        onSelect: () => cycleText(1),
      },
      {
        label: 'Skalierung',
        value: () => (Settings.get().scaleMode === 'integer' ? 'Pixelgenau' : 'Füllen'),
        onLeft: toggleScale,
        onRight: toggleScale,
        onSelect: toggleScale,
      },
      {
        label: 'Bewegung',
        value: () => (Settings.get().renderQuality === 'smooth' ? 'Weich' : 'Retro'),
        onLeft: toggleQuality,
        onRight: toggleQuality,
        onSelect: toggleQuality,
      },
      num('Touch-Grösse', 'touchSize', 0.75, 1.5, 0.05),
      num('Touch-Deckkraft', 'touchOpacity', 0.2, 1, 0.1),
      bool('Vibration', 'vibration'),
      bool('Linkshänder', 'leftHanded'),
      bool('Farbenblind-Hilfen', 'colorblind'),
      bool('FPS anzeigen', 'showFps'),
      { label: 'Tastenbelegung …', onSelect: () => this.openKeys() },
      { label: 'Zurück', onSelect: () => this.close() },
    ];
    this.menu = new Menu(this, x + 20, y + 36, w - 40, items, { rowH: 15, visibleRows: 12, onCancel: () => this.close() });
    addText(this, GAME_W / 2, y + h - 2, '◀ ▶ ändern · Bestätigen/Abbrechen', { font: 'px-o', ox: 0.5, oy: 1, color: PAL.mist });
    this.events.on('resume', () => {
      Input.setContext('menu');
      this.skipFrame = true;
      this.menu.refresh();
    });
  }

  private setNum(key: NumKey, v: number): void {
    Settings.set({ [key]: v } as Partial<SettingsData>);
  }

  private setBool(key: BoolKey, v: boolean): void {
    Settings.set({ [key]: v } as Partial<SettingsData>);
  }

  private openKeys(): void {
    this.scene.pause();
    this.scene.launch('Keys');
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.from);
  }

  override update(_t: number, delta: number): void {
    if (this.skipFrame) {
      this.skipFrame = false;
      return;
    }
    this.menu.update(Input, delta / 1000);
  }
}
