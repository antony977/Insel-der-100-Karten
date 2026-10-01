import Phaser from 'phaser';
import { generateMissing, queueOverrides } from '../gfx/AssetLoader';
import { registerFonts } from '../gfx/font/registerFonts';

/** Lädt optionale PNG-Ersetzungen und erzeugt alle Grafiken per Code. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    queueOverrides(this);
  }

  create(): void {
    registerFonts(this);
    generateMissing(this);
    const start = new URLSearchParams(window.location.search).get('start');
    this.scene.start(start === 'world' ? 'World' : 'Title');
  }
}
