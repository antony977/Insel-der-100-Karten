import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Menu } from '../ui/Menu';
import { Input, type InputSource } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W, VERSION } from '../config';
import { SaveSystem } from '../systems/SaveSystem';
import { openDialog } from './DialogScene';

interface FloatCard {
  s: Phaser.GameObjects.Image;
  vy: number;
  phase: number;
  baseX: number;
}

const SOURCE_LABEL: Record<InputSource, string> = {
  keyboard: 'Tastatur',
  mouse: 'Maus',
  touch: 'Touch',
  gamepad: 'Gamepad',
};

export class TitleScene extends BaseScene {
  private menu!: Menu;
  private cards: FloatCard[] = [];
  private logo!: Phaser.GameObjects.Container;
  private t = 0;
  private sourceText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Title');
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    Sound.music('title', 0.8);
    this.cards = [];
    this.t = 0;
    this.add.image(0, 0, 'title-bg').setOrigin(0, 0).setDepth(-10);
    this.add.image(GAME_W / 2, 178, 'title-island').setOrigin(0.5, 1);

    // schwebende Karten
    for (let i = 0; i < 14; i++) {
      const x = 20 + ((i * 37) % 440);
      const s = this.add.image(x, 40 + ((i * 53) % 220), 'mini-cards', i % 5).setAlpha(0.9).setDepth(-5);
      this.cards.push({ s, vy: 6 + (i % 4) * 3, phase: i * 1.7, baseX: x });
    }

    // Logo
    const small = addText(this, 0, -22, 'Insel der', { font: 'px-o', ox: 0.5, color: PAL.cream, scale: 2 });
    const big = addText(this, 0, 0, '100 KARTEN', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 3 }).setLetterSpacing(1);
    this.logo = this.add.container(GAME_W / 2, 52, [small, big]);

    // Menü
    addPanel(this, GAME_W / 2 - 74, 176, 148, 80);
    const items = [
      { label: 'Fortsetzen', onSelect: () => this.continueGame(), disabled: () => !SaveSystem.info('auto') },
      { label: 'Neues Spiel', onSelect: () => this.newGame() },
      { label: 'Laden', onSelect: () => this.openSlots(), disabled: () => !SaveSystem.hasAny() },
      { label: 'Einstellungen', onSelect: () => this.openSettings() },
      {
        label: () => (this.scale.isFullscreen ? 'Vollbild beenden' : 'Vollbild'),
        onSelect: () => this.toggleFullscreen(),
        disabled: () => !this.scale.fullscreen.available,
      },
    ];
    this.menu = new Menu(this, GAME_W / 2 - 62, 181, 124, items, { rowH: 14 });
    if (!SaveSystem.info('auto')) this.menu.select(1);

    addText(this, 4, GAME_H - 13, `v${VERSION} · Meilenstein 5`, { font: 'px-o', color: PAL.silver });
    this.sourceText = addText(this, GAME_W - 4, GAME_H - 13, '', { font: 'px-o', ox: 1, color: PAL.silver });
    const updateSource = (s: InputSource) => this.sourceText.setText(`Eingabe: ${SOURCE_LABEL[s]}`);
    updateSource(Input.source);
    const off = Input.onSourceChange(updateSource);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      Input.setContext('menu');
      this.menu.refresh();
    });

    this.cameras.main.fadeIn(300, 13, 10, 20);
  }

  private startGame(cont: boolean): void {
    this.menu.enabled = false;
    this.cameras.main.fadeOut(260, 13, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => (cont ? this.scene.start('World', { continue: true }) : this.scene.start('NewGame')));
  }

  private continueGame(): void {
    if (SaveSystem.load('auto')) this.startGame(true);
  }

  private newGame(): void {
    if (!SaveSystem.info('auto')) {
      this.startGame(false);
      return;
    }
    openDialog(this, {
      title: 'Neues Spiel',
      text: 'Ein neues Spiel überschreibt den automatischen Spielstand. Manuelle Speicherplätze bleiben erhalten.',
      options: [{ label: 'Neues Spiel beginnen', action: () => this.startGame(false) }, { label: 'Abbrechen' }],
    });
  }

  private openSlots(): void {
    this.scene.pause();
    this.scene.launch('Slots', { mode: 'load', from: 'Title' });
  }

  private openSettings(): void {
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Title' });
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else {
      this.scale.startFullscreen();
      // Querformat sperren, wo erlaubt (Android)
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      o?.lock?.('landscape').catch(() => undefined);
    }
    this.time.delayedCall(200, () => this.menu.refresh());
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.t += dt;
    for (const c of this.cards) {
      c.s.y -= c.vy * dt;
      if (c.s.y < -20) c.s.y = GAME_H + 20;
      c.s.x = Math.round(c.baseX + Math.sin(this.t * 0.8 + c.phase) * 6);
    }
    this.logo.y = 52 + Math.round(Math.sin(this.t * 1.6) * 2);
    this.menu.update(Input, dt);
  }
}
