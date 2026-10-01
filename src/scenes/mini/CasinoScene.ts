import Phaser from 'phaser';
import { MiniScene } from './MiniBase';
import { addPanel, addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_W } from '../../config';
import { Game } from '../../systems/GameState';
import { Sound } from '../../audio/AudioEngine';
import { SaveSystem } from '../../systems/SaveSystem';

type Mode = 'menu' | 'kaufen' | 'hochtief' | 'hoeher' | 'automat';

const SYMBOLS = ['kirsche', 'glocke', 'klee', 'herz', 'sieben', 'stern'];
/** Gewinn bei drei gleichen Symbolen (Einsatz 10) */
const PAYOUT: Record<string, number> = { kirsche: 40, glocke: 70, klee: 90, herz: 120, sieben: 300 };

/**
 * Casino „Goldene Sieben": Chips kaufen, Würfeln „Hoch oder Tief", Kartenreihe
 * „Höher oder Tiefer" und der Sternenautomat mit dem Grossen Jackpot.
 */
export class CasinoScene extends MiniScene {
  private mode: Mode = 'menu';
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private funds!: Phaser.GameObjects.BitmapText;
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private busy = false;
  private keys: { label: string; fn: () => void }[] = [];
  private sel = 0;
  private bet = 10;
  // Höher/Tiefer
  private card = 0;
  private pot = 0;
  private streak = 0;

  constructor() {
    super('Casino');
  }

  create(): void {
    this.box = this.setupMini('Casino „Goldene Sieben"', 420, 236);
    this.funds = addText(this, this.box.x + 12, this.box.y + 22, '', { font: 'px-s', color: PAL.cream });
    this.mode = 'menu';
    this.busy = false;
    this.render();
  }

  private clear(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.keys = [];
  }

  private t(x: number, y: number, s: string, color: number = PAL.white, font: 'px' | 'px-s' | 'px-o' = 'px-s', ox = 0): Phaser.GameObjects.BitmapText {
    const t = addText(this, x, y, s, { font, color, ox, maxWidth: this.box.w - 40 });
    this.dyn.push(t);
    return t;
  }

  /** Knopf, auch per Tastatur (Pfeile + Bestätigen) wählbar */
  private key(x: number, y: number, w: number, label: string, fn: () => void): void {
    const idx = this.keys.length;
    const b = this.button(x, y, w, label, () => {
      if (this.busy) return;
      fn();
    });
    this.dyn.push(b.panel, b.text);
    this.keys.push({ label, fn });
    b.panel.setData('idx', idx);
  }

  private updateFunds(): void {
    this.funds.setText(`Münzen: ${Game.inv.money}    Chips: ${Game.inv.chips}`);
  }

  private render(): void {
    this.clear();
    this.updateFunds();
    const { x, y, w } = this.box;
    const cx = x + w / 2;
    if (this.mode === 'menu') {
      this.t(cx, y + 40, 'Was möchtest du spielen?', PAL.white, 'px-s', 0.5);
      const bw = 180;
      this.key(cx - bw / 2, y + 60, bw, 'Chips kaufen', () => this.go('kaufen'));
      this.key(cx - bw / 2, y + 82, bw, 'Hoch oder Tief (Würfel)', () => this.go('hochtief'));
      this.key(cx - bw / 2, y + 104, bw, 'Höher oder Tiefer (Karten)', () => this.go('hoeher'));
      this.key(cx - bw / 2, y + 126, bw, 'Sternenautomat', () => this.go('automat'));
      this.key(cx - bw / 2, y + 156, bw, 'Casino verlassen', () => this.quit());
      this.t(cx, y + 188, 'Chips gibt es nur hier. Im Preisladen werden sie zu Schätzen.', PAL.mist, 'px', 0.5);
    } else if (this.mode === 'kaufen') {
      this.t(cx, y + 44, 'Ein Chip kostet eine Münze.', PAL.white, 'px-s', 0.5);
      for (const [i, n] of [100, 500, 1000].entries()) {
        this.key(cx - 90, y + 66 + i * 22, 180, `${n} Chips kaufen`, () => {
          if (Game.inv.money < n) {
            Sound.play('error');
            this.flash('Nicht genug Münzen.');
            return;
          }
          Game.inv.money -= n;
          Game.inv.chips += n;
          Sound.play('coin');
          Game.events.emit('vitals-changed');
          this.updateFunds();
        });
      }
      this.key(cx - 90, y + 150, 180, 'Zurück', () => this.go('menu'));
    } else if (this.mode === 'hochtief') this.renderHochTief();
    else if (this.mode === 'hoeher') this.renderHoeher();
    else this.renderAutomat();
    this.sel = Math.min(this.sel, Math.max(0, this.keys.length - 1));
    this.highlight();
  }

  private go(m: Mode): void {
    this.mode = m;
    this.sel = 0;
    if (m === 'hoeher') {
      this.card = 1 + Math.floor(Math.random() * 13);
      this.pot = 0;
      this.streak = 0;
    }
    this.render();
  }

  private flash(s: string, color: number = PAL.coral): void {
    const t = addText(this, GAME_W / 2, this.box.y + this.box.h - 30, s, { font: 'px-s', ox: 0.5, color });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 300, onComplete: () => t.destroy() });
  }

  private highlight(): void {
    for (const o of this.dyn) {
      if (o instanceof Phaser.GameObjects.NineSlice && o.getData('idx') !== undefined) {
        o.setTint(o.getData('idx') === this.sel && Input.source !== 'touch' ? 0xffe9a0 : 0xffffff);
      }
    }
  }

  private pay(n: number): boolean {
    if (Game.inv.chips < n) {
      Sound.play('error');
      this.flash('Nicht genug Chips – kauf welche!');
      return false;
    }
    Game.inv.chips -= n;
    this.updateFunds();
    return true;
  }

  private betKeys(y: number): void {
    const { x, w } = this.box;
    const cx = x + w / 2;
    this.t(cx - 150, y + 4, 'Einsatz:', PAL.mist);
    [10, 50, 100].forEach((b, i) => {
      this.key(cx - 96 + i * 56, y, 50, b === this.bet ? `[${b}]` : String(b), () => {
        this.bet = b;
        this.render();
      });
    });
  }

  // ---------------------------------------------------------------- Hoch oder Tief

  private renderHochTief(): void {
    const { x, y, w } = this.box;
    const cx = x + w / 2;
    this.t(cx, y + 40, 'Zwei Würfel. Hoch = 8–12 (×2) · Tief = 2–6 (×2) · Sieben (×5)', PAL.white, 'px', 0.5);
    this.betKeys(y + 56);
    this.key(cx - 150, y + 150, 90, 'Tief', () => this.roll('tief'));
    this.key(cx - 45, y + 150, 90, 'Sieben', () => this.roll('sieben'));
    this.key(cx + 60, y + 150, 90, 'Hoch', () => this.roll('hoch'));
    this.key(cx - 45, y + 182, 90, 'Zurück', () => this.go('menu'));
    this.drawDice(cx, y + 110, 3, 4);
  }

  private drawDice(cx: number, cy: number, a: number, b: number): void {
    const g = this.add.graphics();
    this.dyn.push(g);
    const pips: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };
    [a, b].forEach((v, i) => {
      const dx = cx - 30 + i * 36;
      g.fillStyle(PAL.ink).fillRect(dx - 1, cy - 15, 26, 26);
      g.fillStyle(PAL.white).fillRect(dx, cy - 14, 24, 24);
      g.fillStyle(PAL.silver).fillRect(dx, cy + 7, 24, 3);
      g.fillStyle(PAL.red);
      for (const [px, py] of pips[v]) g.fillRect(dx + 11 + px * 7 - 2, cy - 3 + py * 7 - 2, 4, 4);
    });
  }

  private roll(guess: 'hoch' | 'tief' | 'sieben'): void {
    if (!this.pay(this.bet)) return;
    this.busy = true;
    Sound.play('dice');
    const { x, y, w } = this.box;
    const cx = x + w / 2;
    let n = 0;
    const timer = this.time.addEvent({
      delay: 70,
      repeat: 7,
      callback: () => {
        n++;
        this.render();
        this.drawDice(cx, y + 110, 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6));
        if (n < 8) return;
        timer.remove();
        const a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        const sum = a + b;
        this.render();
        this.drawDice(cx, y + 110, a, b);
        const won = (guess === 'hoch' && sum >= 8) || (guess === 'tief' && sum <= 6) || (guess === 'sieben' && sum === 7);
        const mult = guess === 'sieben' ? 5 : 2;
        if (won) {
          Game.inv.chips += this.bet * mult;
          Sound.play('coin');
          this.flash(`${sum}! Gewonnen: ${this.bet * mult} Chips`, PAL.lime);
        } else {
          Sound.play('lose');
          this.flash(`${sum} – leider verloren.`);
        }
        this.updateFunds();
        this.busy = false;
      },
    });
  }

  // ---------------------------------------------------------------- Höher oder Tiefer

  private renderHoeher(): void {
    const { x, y, w } = this.box;
    const cx = x + w / 2;
    this.t(cx, y + 40, 'Errate, ob die nächste Karte höher oder tiefer ist. Jeder Treffer: Topf ×1,8.', PAL.white, 'px', 0.5);
    this.drawCard(cx, y + 96, this.card);
    if (this.pot === 0) {
      this.t(cx, y + 136, 'Einsatz: 20 Chips', PAL.mist, 'px-s', 0.5);
      this.key(cx - 95, y + 156, 90, 'Tiefer', () => this.guess(-1));
      this.key(cx + 5, y + 156, 90, 'Höher', () => this.guess(1));
    } else {
      this.t(cx, y + 136, `Topf: ${this.pot} Chips · Serie: ${this.streak}`, PAL.gold, 'px-s', 0.5);
      this.key(cx - 145, y + 156, 90, 'Tiefer', () => this.guess(-1));
      this.key(cx - 45, y + 156, 90, 'Einstreichen', () => {
        Game.inv.chips += this.pot;
        Sound.play('coin');
        this.flash(`${this.pot} Chips eingestrichen!`, PAL.lime);
        this.pot = 0;
        this.streak = 0;
        this.render();
      });
      this.key(cx + 55, y + 156, 90, 'Höher', () => this.guess(1));
    }
    this.key(cx - 45, y + 186, 90, 'Zurück', () => {
      if (this.pot > 0) Game.inv.chips += this.pot;
      this.go('menu');
    });
  }

  private drawCard(cx: number, cy: number, v: number): void {
    const g = this.add.graphics();
    this.dyn.push(g);
    g.fillStyle(PAL.ink).fillRect(cx - 17, cy - 24, 34, 46);
    g.fillStyle(PAL.cream).fillRect(cx - 16, cy - 23, 32, 44);
    g.fillStyle(PAL.gold).fillRect(cx - 14, cy - 21, 28, 2);
    g.fillStyle(PAL.gold).fillRect(cx - 14, cy + 17, 28, 2);
    this.t(cx, cy - 8, String(v), PAL.red, 'px-o', 0.5).setScale(2);
  }

  private guess(dir: number): void {
    if (this.pot === 0) {
      if (!this.pay(20)) return;
      this.pot = 20;
    }
    let next = this.card;
    while (next === this.card) next = 1 + Math.floor(Math.random() * 13);
    Sound.play('page');
    const right = dir > 0 ? next > this.card : next < this.card;
    this.card = next;
    if (right) {
      this.streak++;
      this.pot = Math.floor(this.pot * 1.8);
      Sound.play('ding');
    } else {
      Sound.play('lose');
      this.flash(`Eine ${next} – der Topf ist weg.`);
      this.pot = 0;
      this.streak = 0;
    }
    this.render();
  }

  // ---------------------------------------------------------------- Sternenautomat

  private reels: Phaser.GameObjects.Image[] = [];

  private renderAutomat(): void {
    const { x, y, w } = this.box;
    const cx = x + w / 2;
    this.t(cx, y + 38, 'Ein Dreh: 10 Chips. Drei gleiche gewinnen – drei Sterne knacken den Grossen Jackpot!', PAL.white, 'px', 0.5);
    const frame = addPanel(this, cx - 66, y + 62, 132, 52, 'ui-frame-gold');
    this.dyn.push(frame);
    this.reels = [0, 1, 2].map((i) => {
      const img = this.add.image(cx - 38 + i * 38, y + 88, 'slot-symbols', (this.registry.get('slots') as number[] | undefined)?.[i] ?? i).setScale(2);
      this.dyn.push(img);
      return img;
    });
    const glow = Math.min(1, (Game.vars.get('jackpot-dreh') ?? 0) / Math.max(1, Game.vars.get('jackpot-ziel') ?? 60));
    this.t(cx, y + 122, `Jackpot-Anzeige: [${'='.repeat(Math.round(glow * 10)).padEnd(10, '-')}]`, PAL.gold, 'px', 0.5);
    this.t(cx, y + 134, 'Kirsche 40 · Glocke 70 · Klee 90 · Herz 120 · Sieben 300', PAL.mist, 'px', 0.5);
    this.key(cx - 95, y + 154, 90, 'Drehen', () => this.spin());
    this.key(cx + 5, y + 154, 90, 'Zurück', () => this.go('menu'));
  }

  private spin(): void {
    if (!this.pay(10)) return;
    this.busy = true;
    const spins = (Game.vars.get('jackpot-dreh') ?? 0) + 1;
    Game.vars.set('jackpot-dreh', spins);
    if (!Game.vars.has('jackpot-ziel')) {
      const luck = Game.inv.stats().luck;
      Game.vars.set('jackpot-ziel', Math.max(25, 60 + Math.floor(Math.random() * 30) - luck * 4));
    }
    const target = Game.vars.get('jackpot-ziel') ?? 60;
    let result: number[];
    if (spins >= target) {
      result = [5, 5, 5];
    } else {
      const r = Math.random();
      if (r < 0.05) {
        const s = Math.floor(Math.random() * 5);
        result = [s, s, s];
      } else {
        result = [0, 1, 2].map(() => Math.floor(Math.random() * 6));
        // ohne Jackpot keine drei Sterne
        if (result[0] === 5 && result[1] === 5 && result[2] === 5) result[2] = 4;
      }
    }
    let t = 0;
    const stopAt = [10, 16, 22];
    const ev = this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        t++;
        Sound.play('reelTick');
        this.reels.forEach((r, i) => {
          if (t < stopAt[i]) r.setFrame(Math.floor(Math.random() * 6));
          else if (t === stopAt[i]) {
            r.setFrame(result[i]);
            Sound.play('reelStop');
          }
        });
        if (t < stopAt[2]) return;
        ev.remove();
        this.registry.set('slots', result);
        this.resolveSpin(result);
      },
    });
  }

  private resolveSpin(r: number[]): void {
    this.busy = false;
    if (r[0] === 5 && r[1] === 5 && r[2] === 5) {
      Game.vars.set('jackpot-dreh', 0);
      Game.vars.set('jackpot-ziel', 180 + Math.floor(Math.random() * 120));
      Game.inv.chips += 1000;
      Sound.play('fanfare');
      this.banner('GROSSER JACKPOT!');
      if (!Game.flags.has('jackpot-karte') && Game.registry.canCreate('002')) {
        Game.flags.add('jackpot-karte');
        Game.giveCard('002');
        this.flash('1000 Chips – und aus dem Automaten rollt eine goldene Karte!', PAL.gold);
      } else this.flash('1000 Chips!', PAL.gold);
      SaveSystem.autosave();
    } else if (r[0] === r[1] && r[1] === r[2]) {
      const win = PAYOUT[SYMBOLS[r[0]]] ?? 0;
      Game.inv.chips += win;
      Sound.play('coin');
      this.flash(`Drei gleiche! +${win} Chips`, PAL.lime);
    } else if (r[0] === 0) {
      Game.inv.chips += 10;
      this.flash('Kirsche vorne: Einsatz zurück.', PAL.cream);
    }
    this.render();
  }

  override update(): void {
    if (this.done) return;
    if (this.escPressed()) {
      if (this.mode === 'menu') this.quit();
      else {
        Sound.play('back');
        if (this.mode === 'hoeher' && this.pot > 0) Game.inv.chips += this.pot;
        this.go('menu');
      }
      return;
    }
    if (this.busy || !this.keys.length) return;
    if (Input.nav('down') || Input.nav('right')) {
      this.sel = (this.sel + 1) % this.keys.length;
      Sound.play('move');
      this.highlight();
    }
    if (Input.nav('up') || Input.nav('left')) {
      this.sel = (this.sel + this.keys.length - 1) % this.keys.length;
      Sound.play('move');
      this.highlight();
    }
    if (Input.confirm() && this.time.now - this.openedAt > 200) {
      Sound.play('select');
      this.keys[this.sel]?.fn();
    }
  }
}
