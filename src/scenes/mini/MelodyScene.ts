import Phaser from 'phaser';
import { MiniScene } from './MiniBase';
import { addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_W } from '../../config';
import { Sound } from '../../audio/AudioEngine';

const COLORS = [PAL.red, PAL.orange, PAL.gold, PAL.lime, PAL.cyan];
const ROUNDS = [3, 5, 7];

/**
 * Das Ständchen: Die Gartenglocken spielen eine Melodie vor – spiel sie nach.
 * Drei Runden mit 3, 5 und 7 Tönen. Tasten 1–5, Pfeile + Bestätigen oder Antippen.
 */
export class MelodyScene extends MiniScene {
  private seq: number[] = [];
  private round = 0;
  private pos = 0;
  private listening = false;
  private bells: Phaser.GameObjects.Arc[] = [];
  private status!: Phaser.GameObjects.BitmapText;
  private cursor = 2;
  private cursorMark!: Phaser.GameObjects.Triangle;

  constructor() {
    super('Melody');
  }

  create(): void {
    const { x, y, w, h } = this.setupMini('Das Ständchen – spiel die Melodie nach', 380, 200);
    this.seq = Array.from({ length: 7 }, () => Math.floor(Math.random() * 5));
    this.round = 0;
    this.bells = [];
    for (let i = 0; i < 5; i++) {
      const bx = x + 60 + i * ((w - 120) / 4);
      const by = y + 92;
      this.add.rectangle(bx, y + 52, 2, 22, PAL.wood);
      const b = this.add.circle(bx, by, 16, COLORS[i]).setStrokeStyle(2, PAL.ink).setAlpha(0.55);
      this.add.circle(bx - 5, by - 6, 4, PAL.white, 0.4);
      addText(this, bx, by + 22, String(i + 1), { font: 'px-o', ox: 0.5, color: PAL.cream });
      b.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.press(i));
      this.bells.push(b);
    }
    this.cursorMark = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 6, PAL.gold).setVisible(Input.source !== 'touch');
    this.status = addText(this, GAME_W / 2, y + h - 40, '', { font: 'px-s', ox: 0.5, color: PAL.cream });
    addText(this, GAME_W / 2, y + h - 18, 'Tasten 1–5 · Pfeile + Bestätigen · Antippen', { font: 'px', ox: 0.5, color: PAL.mist });
    this.time.delayedCall(700, () => this.playRound());
  }

  private ring(i: number): void {
    Sound.play(`bell${i + 1}`);
    const b = this.bells[i];
    b.setAlpha(1).setScale(1.15);
    this.tweens.add({ targets: b, scale: 1, alpha: 0.55, duration: 320 });
  }

  private playRound(): void {
    this.listening = false;
    this.pos = 0;
    const n = ROUNDS[this.round];
    this.status.setText(`Runde ${this.round + 1}/3 – hör gut zu …`).setTint(PAL.cream);
    for (let k = 0; k < n; k++) this.time.delayedCall(k * 560, () => this.ring(this.seq[k]));
    this.time.delayedCall(n * 560 + 200, () => {
      this.listening = true;
      this.status.setText('Jetzt du!');
    });
  }

  private press(i: number): void {
    if (!this.listening || this.done) return;
    this.ring(i);
    if (i !== this.seq[this.pos]) {
      this.listening = false;
      Sound.play('error');
      this.status.setText('Ein schiefer Ton … nochmal von vorn!').setTint(PAL.coral);
      this.time.delayedCall(1200, () => this.playRound());
      return;
    }
    this.pos++;
    if (this.pos >= ROUNDS[this.round]) {
      this.listening = false;
      this.round++;
      if (this.round >= ROUNDS.length) {
        this.status.setText('Wunderschön! Die Melodie ist vollständig.').setTint(PAL.gold);
        this.finish(true, 3);
        return;
      }
      Sound.play('ding');
      this.status.setText('Richtig!').setTint(PAL.lime);
      this.time.delayedCall(900, () => this.playRound());
    }
  }

  override update(): void {
    if (this.done) return;
    if (this.escPressed()) {
      this.finish(false, this.round, true);
      return;
    }
    for (let i = 0; i < 5; i++) if (Input.keyPressed(`Digit${i + 1}`) || Input.keyPressed(`Numpad${i + 1}`)) this.press(i);
    if (Input.nav('left')) this.cursor = (this.cursor + 4) % 5;
    if (Input.nav('right')) this.cursor = (this.cursor + 1) % 5;
    if (Input.confirm() && this.time.now - this.openedAt > 200) this.press(this.cursor);
    const b = this.bells[this.cursor];
    this.cursorMark.setPosition(b.x - 4, b.y - 30).setVisible(Input.source !== 'touch');
  }
}
