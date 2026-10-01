import './styles.css';
import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { SettingsScene } from './scenes/SettingsScene';
import { KeysScene } from './scenes/KeysScene';
import { BookScene } from './scenes/BookScene';
import { DialogScene } from './scenes/DialogScene';
import { SlotsScene } from './scenes/SlotsScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { SaveSystem } from './systems/SaveSystem';
import { Game } from './systems/GameState';
import { Display } from './systems/Display';
import { Input } from './input/InputManager';
import { TouchControls } from './input/TouchControls';
import { mouseCursor } from './gfx/generators/ui';
import { registerSW } from 'virtual:pwa-register';

// iOS: Zoom-Gesten und Scrollen unterbinden
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

const cursorCss = `url(${mouseCursor().toDataURL(2)}) 2 2, auto`;
document.body.style.cursor = cursorCss;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0d0a14',
  pixelArt: true,
  antialias: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    autoRound: false,
  },
  input: {
    activePointers: 4,
    keyboard: false,
    gamepad: false,
  },
  disableContextMenu: true,
  banner: false,
  fps: { target: 60, smoothStep: true },
  render: {
    powerPreference: 'high-performance',
    antialiasGL: false,
    pixelArt: true,
  },
  scene: [BootScene, TitleScene, WorldScene, HudScene, BookScene, PauseScene, SettingsScene, KeysScene, SlotsScene, DialogScene, LevelUpScene],
  callbacks: {
    postBoot: (g) => {
      g.registry.set('cursorCss', cursorCss);
      g.canvas.style.cursor = cursorCss;
      Display.init(g);
      new TouchControls(document.getElementById('touch-ui')!);
    },
  },
});

Input.attach();

// Beim Verlassen der Seite (App-Wechsel, Tab schliessen) automatisch speichern
const saveIfPlaying = () => {
  if (game.registry.get('worldActive')) SaveSystem.autosave();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveIfPlaying();
});
window.addEventListener('pagehide', saveIfPlaying);
game.events.on(Phaser.Core.Events.PRE_STEP, (time: number) => Input.update(time));

// Service Worker (offline spielbar) – nur im Produktions-Build
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

// Für Tests und Debugging
(window as unknown as { __game: Phaser.Game }).__game = game;
(window as unknown as { __state: typeof Game }).__state = Game;
