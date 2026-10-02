import Phaser from 'phaser';
import { MiniScene } from './MiniBase';
import { addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_H, GAME_W } from '../../config';
import { Sound } from '../../audio/AudioEngine';
import { KLIPPENBALL_TEAMS } from '../../data/minigames';

interface Athlete {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: 0 | 1;
  human: boolean;
  homeX: number;
  homeY: number;
  role: 'sturm' | 'abwehr';
  kickCd: number;
  dir: number;
}


const FIELD = { x: 40, y: 50, w: 400, h: 190 };
const GOAL_H = 56;
const WIN_GOALS = 3;

/**
 * Klippenball: 2 gegen 2 auf dem Bergplatz. Laufen mit Stick/Pfeilen, schiessen mit
 * Angriff, kurzer Sprint mit Ausweichen. Drei Tore gewinnen.
 */
export class KlippenballScene extends MiniScene {
  private ball = { x: 0, y: 0, vx: 0, vy: 0 };
  private ballImg!: Phaser.GameObjects.Arc;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private ath: Athlete[] = [];
  private score: [number, number] = [0, 0];
  private scoreText!: Phaser.GameObjects.BitmapText;
  private pauseT = 0;
  private skill = 0.6;
  private t = 0;
  private timeLeft = 180;
  private sprintT = 0;

  constructor() {
    super('Klippenball');
  }

  create(): void {
    const lvl = Phaser.Math.Clamp(this.data0.level ?? 1, 1, 3);
    this.skill = [0.55, 0.75, 0.95][lvl - 1];
    this.setupCamera();
    Input.setContext('gameplay');
    this.scene.setVisible(false, 'Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.setVisible(true, 'Hud'));
    this.done = false;
    this.openedAt = this.time.now;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.85).setOrigin(0, 0);
    // Spielfeld
    const g = this.add.graphics();
    const { x, y, w, h } = FIELD;
    for (let i = 0; i < 10; i++) g.fillStyle(i % 2 ? PAL.leaf : PAL.grass).fillRect(x + (i * w) / 10, y, w / 10, h);
    g.lineStyle(1, PAL.white, 0.9).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.lineBetween(x + w / 2, y, x + w / 2, y + h);
    g.strokeCircle(x + w / 2, y + h / 2, 24);
    g.fillStyle(PAL.silver).fillRect(x - 8, y + h / 2 - GOAL_H / 2, 8, GOAL_H);
    g.fillStyle(PAL.silver).fillRect(x + w, y + h / 2 - GOAL_H / 2, 8, GOAL_H);
    g.lineStyle(1, PAL.white, 0.4);
    for (let k = 0; k < GOAL_H; k += 6) {
      g.lineBetween(x - 8, y + h / 2 - GOAL_H / 2 + k, x, y + h / 2 - GOAL_H / 2 + k);
      g.lineBetween(x + w, y + h / 2 - GOAL_H / 2 + k, x + w + 8, y + h / 2 - GOAL_H / 2 + k);
    }
    addText(this, GAME_W / 2, 8, `Klippenball – Runde ${lvl}: gegen ${KLIPPENBALL_TEAMS[lvl - 1]}`, { font: 'px-o', ox: 0.5, color: PAL.gold });
    this.scoreText = addText(this, GAME_W / 2, 24, '', { font: 'px-o', ox: 0.5, color: PAL.cream, scale: 1 });
    addText(this, GAME_W / 2, GAME_H - 18, 'Laufen · Angriff = Schuss · Ausweichen = Sprint · Esc = Aufgeben', { font: 'px', ox: 0.5, color: PAL.mist });
    // Spieler
    const mk = (key: string, team: 0 | 1, human: boolean, role: 'sturm' | 'abwehr', tint?: number): Athlete => {
      const homeX = team === 0 ? (role === 'abwehr' ? x + 60 : x + w / 2 - 50) : role === 'abwehr' ? x + w - 60 : x + w / 2 + 50;
      const homeY = y + h / 2 + (role === 'abwehr' ? 30 : -30) * (team === 0 ? 1 : -1);
      const sprite = this.add.sprite(homeX, homeY, key, 0).setOrigin(0.5, 30 / 32);
      if (tint) sprite.setTint(tint);
      return { sprite, x: homeX, y: homeY, vx: 0, vy: 0, team, human, homeX, homeY, role, kickCd: 0, dir: team === 0 ? 2 : 1 };
    };
    this.ath = [
      mk('player', 0, true, 'sturm'),
      mk('npc-pit', 0, false, 'abwehr'),
      mk('npc-isgard', 1, false, 'sturm', lvl === 3 ? 0xffd0d0 : undefined),
      mk('npc-horst', 1, false, 'abwehr', lvl === 3 ? 0xffd0d0 : undefined),
    ];
    this.ballShadow = this.add.ellipse(0, 0, 8, 3, PAL.ink, 0.4);
    this.ballImg = this.add.circle(0, 0, 4, PAL.white).setStrokeStyle(1, PAL.ink);
    this.score = [0, 0];
    this.timeLeft = 180;
    this.kickoff();
  }

  private kickoff(): void {
    this.ball = { x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2, vx: 0, vy: 0 };
    for (const a of this.ath) {
      a.x = a.homeX;
      a.y = a.homeY;
      a.vx = a.vy = 0;
    }
    this.pauseT = 1.2;
    Sound.play('whistle');
    this.scoreText.setText(`${this.score[0]} : ${this.score[1]}`);
  }

  private kick(a: Athlete, tx: number, ty: number, power: number): void {
    const dx = tx - this.ball.x;
    const dy = ty - this.ball.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.ball.vx = (dx / d) * power;
    this.ball.vy = (dy / d) * power;
    a.kickCd = 0.35;
    Sound.play('kick', { vary: 0.08 });
  }

  override update(_time: number, delta: number): void {
    if (this.done) return;
    const dt = Math.min(0.05, delta / 1000);
    if (this.escPressed() || Input.justPressed('pause')) {
      this.finish(false, this.score[0], true);
      return;
    }
    this.t += dt;
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      this.render();
      return;
    }
    this.timeLeft -= dt;
    const goalY0 = FIELD.y + FIELD.h / 2 - GOAL_H / 2;
    const goalY1 = goalY0 + GOAL_H;
    // --- Spieler steuern
    for (const a of this.ath) {
      a.kickCd -= dt;
      let ax = 0;
      let ay = 0;
      let speed = 92;
      const enemyGoalX = a.team === 0 ? FIELD.x + FIELD.w + 4 : FIELD.x - 4;
      if (a.human) {
        ax = Input.moveX;
        ay = Input.moveY;
        if (Input.justPressed('dodge') && this.sprintT <= -0.6) this.sprintT = 0.35;
        this.sprintT -= dt;
        if (this.sprintT > 0) speed = 170;
        const near = Math.hypot(this.ball.x - a.x, this.ball.y - (a.y - 4)) < 16;
        if (Input.justPressed('attack') && near && a.kickCd <= 0) {
          const m = Math.hypot(ax, ay);
          if (m > 0.3) this.kick(a, this.ball.x + ax * 50, this.ball.y + ay * 50, 270);
          else this.kick(a, enemyGoalX, FIELD.y + FIELD.h / 2, 270);
        }
      } else {
        const mates = this.ath.filter((o) => o.team === a.team);
        const dist = (o: Athlete) => Math.hypot(this.ball.x - o.x, this.ball.y - o.y);
        const chaser = mates.reduce((b, o) => (dist(o) < dist(b) ? o : b));
        const sk = a.team === 1 ? this.skill : 0.7;
        speed *= 0.72 + sk * 0.3;
        let tx: number;
        let ty: number;
        if (chaser === a || (a.team === 1 && a.role === 'sturm' && dist(a) < 70)) {
          // hinter den Ball laufen (Richtung gegnerisches Tor)
          const gx = enemyGoalX - this.ball.x;
          const gy = FIELD.y + FIELD.h / 2 - this.ball.y;
          const gl = Math.max(1, Math.hypot(gx, gy));
          tx = this.ball.x - (gx / gl) * 8;
          ty = this.ball.y - (gy / gl) * 8 + 4;
          if (dist(a) < 14 && a.kickCd <= 0 && Math.random() < dt * (3 + sk * 6)) {
            const err = (1 - sk) * 70;
            const aimY = FIELD.y + FIELD.h / 2 + (Math.random() - 0.5) * (GOAL_H * 0.7 + err);
            this.kick(a, enemyGoalX, aimY, 200 + sk * 80);
          }
        } else {
          // Position halten, Richtung Ball verschoben
          tx = a.homeX + (this.ball.x - (FIELD.x + FIELD.w / 2)) * 0.35;
          ty = a.homeY + (this.ball.y - (FIELD.y + FIELD.h / 2)) * 0.5;
        }
        const dx = tx - a.x;
        const dy = ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 3) {
          ax = dx / d;
          ay = dy / d;
        }
      }
      const m = Math.hypot(ax, ay);
      if (m > 1) {
        ax /= m;
        ay /= m;
      }
      a.vx = ax * speed;
      a.vy = ay * speed;
      a.x = Phaser.Math.Clamp(a.x + a.vx * dt, FIELD.x + 4, FIELD.x + FIELD.w - 4);
      a.y = Phaser.Math.Clamp(a.y + a.vy * dt, FIELD.y + 8, FIELD.y + FIELD.h - 2);
      if (m > 0.2) a.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 2) : ay < 0 ? 3 : 0;
      // Dribbeln: Ball wird mitgeschoben
      const bx = this.ball.x - a.x;
      const by = this.ball.y - (a.y - 4);
      const bd = Math.hypot(bx, by);
      if (bd < 9 && bd > 0.01) {
        this.ball.x = a.x + (bx / bd) * 9;
        this.ball.y = a.y - 4 + (by / bd) * 9;
        this.ball.vx += (a.vx - this.ball.vx) * 0.5;
        this.ball.vy += (a.vy - this.ball.vy) * 0.5;
      }
    }
    // --- Ball
    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const fr = Math.pow(0.35, dt);
    b.vx *= fr;
    b.vy *= fr;
    if (b.y < FIELD.y + 4) {
      b.y = FIELD.y + 4;
      b.vy = Math.abs(b.vy) * 0.8;
    }
    if (b.y > FIELD.y + FIELD.h - 4) {
      b.y = FIELD.y + FIELD.h - 4;
      b.vy = -Math.abs(b.vy) * 0.8;
    }
    const inGoalMouth = b.y > goalY0 && b.y < goalY1;
    if (b.x < FIELD.x + 4) {
      if (inGoalMouth && b.x < FIELD.x - 2) return this.goal(1);
      if (!inGoalMouth) {
        b.x = FIELD.x + 4;
        b.vx = Math.abs(b.vx) * 0.8;
      }
    }
    if (b.x > FIELD.x + FIELD.w - 4) {
      if (inGoalMouth && b.x > FIELD.x + FIELD.w + 2) return this.goal(0);
      if (!inGoalMouth) {
        b.x = FIELD.x + FIELD.w - 4;
        b.vx = -Math.abs(b.vx) * 0.8;
      }
    }
    if (this.timeLeft <= 0) {
      const won = this.score[0] > this.score[1];
      this.banner(won ? 'Sieg!' : this.score[0] === this.score[1] ? 'Unentschieden' : 'Niederlage', won ? PAL.gold : PAL.coral);
      this.finish(won, this.score[0]);
      return;
    }
    this.render();
  }

  private goal(team: 0 | 1): void {
    this.score[team]++;
    Sound.play('goal');
    this.banner(team === 0 ? 'TOR!' : 'Gegentor …', team === 0 ? PAL.gold : PAL.coral);
    this.scoreText.setText(`${this.score[0]} : ${this.score[1]}`);
    if (this.score[team] >= WIN_GOALS) {
      this.finish(team === 0, this.score[0]);
      return;
    }
    this.pauseT = 99;
    this.time.delayedCall(1300, () => this.kickoff());
  }

  private render(): void {
    for (const a of this.ath) {
      const moving = Math.hypot(a.vx, a.vy) > 10;
      const col = moving ? 2 + (Math.floor(this.t * 8) % 2) : 0;
      a.sprite.setPosition(Math.round(a.x), Math.round(a.y)).setFrame(a.dir * 12 + col).setDepth(a.y);
    }
    this.ballShadow.setPosition(Math.round(this.ball.x), Math.round(this.ball.y + 3)).setDepth(this.ball.y - 1);
    this.ballImg.setPosition(Math.round(this.ball.x), Math.round(this.ball.y)).setDepth(this.ball.y + 1);
    const m = Math.max(0, Math.floor(this.timeLeft / 60));
    const s = Math.max(0, Math.floor(this.timeLeft % 60));
    this.scoreText.setText(`Du ${this.score[0]} : ${this.score[1]} Gegner   ${m}:${String(s).padStart(2, '0')}`);
  }
}
