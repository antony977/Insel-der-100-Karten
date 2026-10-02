import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Sound } from '../audio/AudioEngine';
import { Game } from '../systems/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { card, cardIndex } from '../data/cards';
import { NPCS } from '../data/npcs';
import { MONSTERS } from '../data/monsters';
import { Menu } from '../ui/Menu';

export interface CreditsData {
  cards: string[];
}

/**
 * Abspann nach dem Finale: die drei mitgenommenen Karten, ein langsam scrollender
 * Abspann mit allen Figuren und Monstern, danach New Game+ oder zurück zum Titel.
 */
export class CreditsScene extends BaseScene {
  private text!: Phaser.GameObjects.BitmapText;
  private speed = 14;
  private ended = false;
  private menu: Menu | null = null;

  constructor() {
    super('Credits');
  }

  create(data: CreditsData): void {
    this.setupCamera();
    Input.setContext('menu');
    this.ended = false;
    this.menu = null;
    Sound.music('ende', 2);
    this.scene.setVisible(false, 'Hud');
    const bg = this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0).setOrigin(0, 0);
    this.tweens.add({ targets: bg, fillAlpha: 1, duration: 1500 });
    // Sternenhimmel
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 70; i++) {
      const s = this.add.rectangle(Math.floor(rnd() * GAME_W), Math.floor(rnd() * GAME_H), 1, 1, i % 5 ? PAL.silver : PAL.gold).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 0.4 + (i % 3) * 0.2, delay: 800 + i * 20, duration: 800, yoyo: i % 4 === 0, repeat: i % 4 === 0 ? -1 : 0 });
    }
    // Die drei Erinnerungen
    const cards = (data?.cards ?? []).slice(0, 3);
    cards.forEach((id, i) => {
      const img = this.add.image(GAME_W - 70, 50 + i * 80, 'cards', cardIndex(id)).setScale(1.2).setAlpha(0).setDepth(5);
      this.tweens.add({ targets: img, alpha: 1, delay: 1500 + i * 400, duration: 600 });
      this.tweens.add({ targets: img, y: img.y - 4, duration: 1600 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });
    const names = cards.map((id) => card(id).name);
    const people = NPCS.filter((n) => n.map !== 'none' || ['fortuna', 'sphinx', 'nullpunkt', 'kneipenwirt', 'huettenwirt'].includes(n.id))
      .map((n) => n.name)
      .filter((n, i, a) => a.indexOf(n) === i);
    const beasts = MONSTERS.filter((m) => m.card || m.special?.boss).map((m) => m.name);
    const lines = [
      'INSEL DER 100 KARTEN',
      '',
      '',
      `${Game.player.name} hat alle 100 Karten gesammelt`,
      'und kehrt mit drei Erinnerungen',
      'in die eigene Welt zurück:',
      '',
      ...names.map((n) => `· ${n} ·`),
      '',
      '',
      '– Die Menschen der Insel –',
      '',
      ...chunk(people, 3).map((r) => r.join('   ')),
      '',
      '',
      '– Die Wesen der Insel –',
      '',
      ...chunk(beasts, 3).map((r) => r.join('   ')),
      '',
      '',
      '– Gemacht aus Code –',
      '',
      'Jede Figur, jedes Monster, jede Kachel,',
      'jede Karte, jeder Klang und jedes Lied',
      'wurde von einem Programm erzeugt.',
      'Keine Bilddatei, keine Tonaufnahme.',
      '',
      '',
      '– Danke –',
      '',
      'an alle, die sammeln, tauschen,',
      'Rätsel lösen und Geschichten teilen.',
      '',
      '',
      '',
      `Spielzeit: ${Math.floor(Game.playTime / 3600)} Std. ${Math.floor((Game.playTime % 3600) / 60)} Min.`,
      `Stufe ${Game.prog.level} · Besiegte Monster: ${[...Game.prog.kills.values()].reduce((a, b) => a + b, 0)}`,
      '',
      '',
      'Bis bald auf der Insel.',
    ];
    this.text = addText(this, GAME_W / 2 - 40, GAME_H + 10, lines.join('\n'), { font: 'px-s', ox: 0.5, color: PAL.cream, align: 'center', lineSpacing: 2 });
    this.speed = 14;
    addText(this, 6, GAME_H - 13, 'Bestätigen: schneller', { font: 'px', color: PAL.stone });
  }

  private showMenu(): void {
    this.ended = true;
    addText(this, GAME_W / 2 - 40, 70, 'Ende', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });
    const ng = Game.ngLevel;
    this.menu = new Menu(
      this,
      GAME_W / 2 - 120,
      130,
      160,
      [
        { label: ng >= 3 ? 'New Game+ (höchste Stufe)' : `New Game+ beginnen (Stufe ${ng + 1})`, onSelect: () => this.newGamePlus() },
        { label: 'Zum Titelbild', onSelect: () => this.toTitle() },
      ],
      { depth: 20 },
    );
  }

  private newGamePlus(): void {
    Game.newGamePlus();
    SaveSystem.autosave();
    this.cameras.main.fadeOut(600, 13, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.stop('World');
      this.scene.start('World', { continue: true });
    });
  }

  private toTitle(): void {
    SaveSystem.autosave();
    this.cameras.main.fadeOut(600, 13, 10, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Hud');
      this.scene.stop('World');
      this.scene.start('Title');
    });
  }

  override update(_t: number, delta: number): void {
    const dt = delta / 1000;
    if (this.menu) {
      this.menu.update(Input, dt);
      return;
    }
    if (this.ended) return;
    const fast = Input.isDown('attack') || Input.confirm() || this.input.activePointer.isDown;
    this.text.y -= (fast ? this.speed * 6 : this.speed) * dt;
    if (this.text.y + this.text.height < 40) this.showMenu();
  }
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
