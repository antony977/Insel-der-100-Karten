import Phaser from 'phaser';
import { MiniScene } from './MiniBase';
import { addPanel, addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_W } from '../../config';
import { Sound } from '../../audio/AudioEngine';
import type { Action } from '../../input/Actions';

interface Note {
  lane: number;
  time: number;
  hit: boolean;
  missed: boolean;
  obj: Phaser.GameObjects.BitmapText;
}

const LANES: { dir: Action; glyph: string; color: number }[] = [
  { dir: 'left', glyph: '←', color: PAL.pink },
  { dir: 'down', glyph: '↓', color: PAL.cyan },
  { dir: 'up', glyph: '↑', color: PAL.lime },
  { dir: 'right', glyph: '→', color: PAL.gold },
];

const BPM = 112;
const BEAT = 60 / BPM;
const SPEED = 120;

/**
 * Tanz beim Rosenfest: Pfeile laufen auf die Trefferlinie zu – im richtigen Moment die
 * passende Richtung drücken (oder antippen). 60 % der Punkte reichen zum Sieg.
 */
export class DanceScene extends MiniScene {
  private notes: Note[] = [];
  private t = -2;
  private score = 0;
  private max = 0;
  private combo = 0;
  private hitX = 0;
  private laneY: number[] = [];
  private judge!: Phaser.GameObjects.BitmapText;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private lastBeat = -1;
  private touchPress: number | null = null;
  private dancer!: Phaser.GameObjects.Sprite;
  private end = 0;

  constructor() {
    super('Dance');
  }

  create(): void {
    const { x, y, w, h } = this.setupMini('Rosenfest – Tanz im Takt!', 420, 232);
    Sound.music(null, 0.6);
    this.hitX = x + 70;
    this.laneY = [0, 1, 2, 3].map((i) => y + 44 + i * 30);
    const g = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      g.fillStyle(PAL.ink, 0.6).fillRect(x + 12, this.laneY[i] - 11, w - 24, 22);
      g.fillStyle(LANES[i].color, 0.25).fillRect(this.hitX - 12, this.laneY[i] - 11, 24, 22);
      addText(this, this.hitX, this.laneY[i] - 6, LANES[i].glyph, { font: 'px-o', ox: 0.5, color: PAL.mist });
    }
    g.lineStyle(1, PAL.white, 0.8).lineBetween(this.hitX, y + 30, this.hitX, this.laneY[3] + 12);
    this.judge = addText(this, GAME_W / 2 + 40, y + 24, '', { font: 'px-o', ox: 0.5, color: PAL.gold });
    this.scoreText = addText(this, x + w - 14, y + 24, '', { font: 'px-s', ox: 1, color: PAL.cream });
    this.dancer = this.add.sprite(x + 36, y + h - 34, 'player', 0).setOrigin(0.5, 1);
    // Touch-Knöpfe
    LANES.forEach((l, i) => {
      const bx = x + 110 + i * 62;
      const p = addPanel(this, bx, y + h - 46, 54, 26, 'ui-frame');
      addText(this, bx + 27, y + h - 40, l.glyph, { font: 'px-o', ox: 0.5, color: l.color });
      p.setInteractive().on('pointerdown', () => {
        this.touchPress = i;
      });
    });
    // Choreografie (fest, wird gegen Ende dichter)
    const rnd = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    let beat = 0;
    const steps: [number, number][] = [];
    for (let bar = 0; bar < 12; bar++) {
      for (let b = 0; b < 4; b++) {
        const r = Math.abs(rnd(bar * 4 + b + 1));
        if (bar < 2 && b % 2 === 1) continue;
        steps.push([beat + b, Math.floor(r * 4)]);
        if (bar >= 6 && b === 3 && r > 0.5) steps.push([beat + b + 0.5, Math.floor(Math.abs(rnd(bar + 99)) * 4)]);
      }
      beat += 4;
    }
    this.notes = steps.map(([bt, lane]) => ({
      lane,
      time: bt * BEAT,
      hit: false,
      missed: false,
      obj: addText(this, -100, this.laneY[lane] - 6, LANES[lane].glyph, { font: 'px-o', ox: 0.5, color: LANES[lane].color }),
    }));
    this.max = this.notes.length * 2;
    this.end = (beat + 2) * BEAT;
    this.t = -2;
    this.score = 0;
    this.combo = 0;
    addText(this, GAME_W / 2, y + h - 16, 'Pfeiltasten oder Knöpfe – im Moment, in dem der Pfeil die Linie erreicht.', { font: 'px', ox: 0.5, color: PAL.mist });
  }

  private pressedLane(): number | null {
    if (this.touchPress !== null) {
      const l = this.touchPress;
      this.touchPress = null;
      return l;
    }
    for (let i = 0; i < 4; i++) if (Input.justPressed(LANES[i].dir)) return i;
    return null;
  }

  private show(text: string, color: number): void {
    this.judge.setText(text).setTint(color).setScale(1.2);
    this.tweens.add({ targets: this.judge, scale: 1, duration: 120 });
  }

  override update(_time: number, delta: number): void {
    if (this.done) return;
    if (this.escPressed()) {
      this.finish(false, 0, true);
      return;
    }
    const dt = delta / 1000;
    this.t += dt;
    // Metronom
    const beat = Math.floor(this.t / BEAT);
    if (beat !== this.lastBeat && this.t >= 0 && this.t < this.end) {
      this.lastBeat = beat;
      Sound.play(beat % 4 === 0 ? 'beat' : 'reelTick', { vol: beat % 4 === 0 ? 1 : 0.7 });
      this.dancer.setFrame((beat % 4) * 12 + (beat % 2 ? 10 : 0));
    }
    for (const n of this.notes) {
      if (n.hit || n.missed) continue;
      const x = this.hitX + (n.time - this.t) * SPEED;
      n.obj.setX(x);
      if (this.t - n.time > 0.2) {
        n.missed = true;
        n.obj.setTint(PAL.stone).setAlpha(0.4);
        this.combo = 0;
        this.show('Verpasst', PAL.stone);
      }
    }
    const lane = this.pressedLane();
    if (lane !== null) {
      let best: Note | null = null;
      let bd = 1;
      for (const n of this.notes) {
        if (n.hit || n.missed || n.lane !== lane) continue;
        const d = Math.abs(n.time - this.t);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best && bd < 0.2) {
        best.hit = true;
        const perfect = bd < 0.09;
        this.score += perfect ? 2 : 1;
        this.combo++;
        Sound.play(`bell${lane + 1}`, { vol: 0.6 });
        this.show(perfect ? `Perfekt! ×${this.combo}` : `Gut ×${this.combo}`, perfect ? PAL.gold : PAL.lime);
        this.tweens.add({ targets: best.obj, scale: 2, alpha: 0, duration: 200 });
      } else {
        this.combo = 0;
        Sound.play('error', { vol: 0.5 });
      }
    }
    this.scoreText.setText(`Punkte: ${this.score}/${this.max}`);
    if (this.t > this.end) {
      const won = this.score >= this.max * 0.6;
      this.show(won ? 'Wunderbar getanzt!' : 'Noch etwas üben …', won ? PAL.gold : PAL.coral);
      this.finish(won, this.score);
    }
  }
}
