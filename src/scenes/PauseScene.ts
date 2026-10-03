import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Menu } from '../ui/Menu';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { SaveSystem } from '../systems/SaveSystem';

export class PauseScene extends BaseScene {
  private menu!: Menu;
  private justOpened = true;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.justOpened = true;
    Sound.duck('pause', true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Sound.duck('pause', false));
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.6).setOrigin(0, 0);
    const w = 180;
    const h = 156;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    addPanel(this, x, y, w, h, 'ui-frame');
    addText(this, GAME_W / 2, y + 8, 'Pause', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });
    this.menu = new Menu(
      this,
      x + 22,
      y + 38,
      w - 44,
      [
        { label: 'Weiterspielen', onSelect: () => this.resume() },
        { label: 'Speichern', onSelect: () => this.slots('save') },
        { label: 'Laden', onSelect: () => this.slots('load') },
        { label: 'Anleitung', onSelect: () => this.guide() },
        { label: 'Einstellungen', onSelect: () => this.settings() },
        { label: 'Zum Titelbild', onSelect: () => this.toTitle() },
      ],
      { onCancel: () => this.resume() },
    );
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      Input.setContext('menu');
      this.justOpened = true;
    });
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume('Hud');
    this.scene.resume('World');
  }

  private slots(mode: 'save' | 'load'): void {
    this.scene.pause();
    this.scene.launch('Slots', { mode, from: 'Pause' });
  }

  private guide(): void {
    this.scene.pause();
    this.scene.launch('Guide', { from: 'Pause' });
  }

  private settings(): void {
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Pause' });
  }

  private toTitle(): void {
    SaveSystem.autosave();
    this.scene.stop('Hud');
    this.scene.stop('World');
    this.scene.stop();
    this.scene.start('Title');
  }

  override update(_t: number, delta: number): void {
    // Die Pause-Taste, die das Menü geöffnet hat, darf es nicht sofort wieder schliessen
    if (this.justOpened) {
      this.justOpened = false;
      return;
    }
    this.menu.update(Input, delta / 1000);
  }
}
