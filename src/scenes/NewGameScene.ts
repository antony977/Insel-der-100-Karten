import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Game } from '../systems/GameState';
import { AFFINITIES, type AffinityDef } from '../data/aura';
import { wrapText } from '../gfx/font/PixelFont';
import { ABILITY_H, ABILITY_W } from '../gfx/generators/ui';
import { SaveSystem } from '../systems/SaveSystem';

type Step = 'intro' | 'name' | 'affinity' | 'tech';

const INTRO: string[] = [
  'Es ist Samstag. Auf dem Flohmarkt am Stadtrand riecht es nach Zuckerwatte und alten Büchern.',
  'Zwischen Kisten voller Kabel liegt eine graue Spielkonsole ohne Namen. Nur ein Wort ist eingeritzt: LUMENBOX.',
  '„Die nimmt niemand", sagt der Händler und lächelt seltsam. „Nimm sie mit."',
  'Zuhause drückst du den Knopf. Der Bildschirm flackert … und zerfällt in tausend leuchtende Pixel.',
];

const ROWS = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', 'ÄÖÜäöü-  '];

/**
 * Neues Spiel: Kurzes Intro, Name, Wahl der Aura-Affinität und Name der Spezialtechnik.
 */
export class NewGameScene extends BaseScene {
  private step: Step = 'intro';
  private introIdx = 0;
  private shown = 0;
  private full = '';
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private text!: Phaser.GameObjects.BitmapText;
  private name = 'Kai';
  private tech = '';
  private aff = 0;
  private kx = 0;
  private ky = 0;
  private entry!: Phaser.GameObjects.BitmapText;
  private keyObjs: Phaser.GameObjects.BitmapText[][] = [];
  private keyHL!: Phaser.GameObjects.NineSlice;
  private busy = false;
  private console!: Phaser.GameObjects.Container;
  private openedAt = 0;

  constructor() {
    super('NewGame');
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.step = 'intro';
    this.introIdx = 0;
    this.name = Game.player.name || 'Kai';
    this.busy = false;
    this.cameras.main.setBackgroundColor(PAL.ink);
    // Lumenbox
    this.console = this.add.container(GAME_W / 2, 92);
    const body = this.add.rectangle(0, 0, 120, 70, PAL.stone).setStrokeStyle(2, PAL.ink);
    const screen = this.add.rectangle(-14, -4, 72, 46, PAL.night).setStrokeStyle(1, PAL.shadow);
    const glow = this.add.rectangle(-14, -4, 66, 40, PAL.teal, 0.25);
    const b1 = this.add.circle(36, -8, 6, PAL.red).setStrokeStyle(1, PAL.ink);
    const b2 = this.add.circle(46, 6, 5, PAL.gold).setStrokeStyle(1, PAL.ink);
    const label = addText(this, -14, 26, 'LUMENBOX', { font: 'px', ox: 0.5, color: PAL.silver });
    this.console.add([body, screen, glow, b1, b2, label]);
    this.tweens.add({ targets: glow, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
    this.text = addText(this, GAME_W / 2, 160, '', { font: 'px-s', ox: 0.5, color: PAL.white, align: 'center' });
    addText(this, GAME_W / 2, GAME_H - 14, 'Bestätigen/Tippen: weiter · Esc: Intro überspringen', { font: 'px', ox: 0.5, color: PAL.stone }).setName('skip');
    this.input.on('pointerdown', () => {
      if (this.step === 'intro' && !this.busy) this.advanceIntro();
    });
    window.addEventListener('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', this.onKey));
    this.showIntro();
    this.cameras.main.fadeIn(400, 13, 10, 20);
  }

  private clear(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.keyObjs = [];
  }

  // ------------------------------------------------------------ Intro

  private showIntro(): void {
    this.full = wrapText(INTRO[this.introIdx], 380).join('\n');
    this.shown = 0;
    this.openedAt = this.time.now;
  }

  private advanceIntro(): void {
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.setText(this.full);
      return;
    }
    this.introIdx++;
    if (this.introIdx < INTRO.length) {
      this.showIntro();
      if (this.introIdx === INTRO.length - 1) this.tweens.add({ targets: this.console, scale: 1.15, duration: 1400, ease: 'Sine.InOut' });
      return;
    }
    this.dissolve();
  }

  /** Bildschirm zerfällt in Pixel */
  private dissolve(): void {
    this.busy = true;
    this.text.setText('');
    const g = this.add.graphics().setDepth(100);
    const cells: [number, number][] = [];
    for (let y = 0; y < GAME_H; y += 10) for (let x = 0; x < GAME_W; x += 10) cells.push([x, y]);
    Phaser.Utils.Array.Shuffle(cells);
    const colors = [PAL.cyan, PAL.ice, PAL.white, PAL.violet, PAL.gold, PAL.pink];
    let i = 0;
    const timer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        for (let k = 0; k < 40 && i < cells.length; k++, i++) {
          const [x, y] = cells[i];
          g.fillStyle(colors[i % colors.length], 1);
          g.fillRect(x, y, 10, 10);
        }
        if (i >= cells.length) {
          timer.remove();
          this.cameras.main.flash(500, 255, 255, 255);
          this.time.delayedCall(450, () => {
            g.destroy();
            this.console.setVisible(false);
            this.children.getByName('skip')?.destroy();
            this.busy = false;
            this.showName();
          });
        }
      },
    });
  }

  // ------------------------------------------------------------ Eingabe (Name / Technik)

  private onKey = (e: KeyboardEvent) => {
    if (this.step !== 'name' && this.step !== 'tech') {
      if (e.key === 'Escape' && this.step === 'intro' && !this.busy) {
        this.introIdx = INTRO.length;
        this.dissolve();
      }
      return;
    }
    if (e.key === 'Backspace') {
      this.edit((s) => s.slice(0, -1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      this.confirmEntry();
      e.preventDefault();
    } else if (e.key.length === 1 && /[A-Za-zÄÖÜäöü \-]/.test(e.key)) {
      this.edit((s) => (s.length < 14 ? s + e.key : s));
      e.preventDefault();
    }
  };

  private edit(fn: (s: string) => string): void {
    if (this.step === 'name') this.name = fn(this.name);
    else this.tech = fn(this.tech);
    this.entry.setText(`${this.step === 'name' ? this.name : this.tech}_`);
  }

  private showKeyboard(title: string, sub: string, value: string): void {
    this.clear();
    this.text.setText('');
    this.dyn.push(addText(this, GAME_W / 2, 14, title, { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 }));
    this.dyn.push(addText(this, GAME_W / 2, 42, wrapText(sub, 420).join('\n'), { font: 'px-s', ox: 0.5, color: PAL.silver, align: 'center' }));
    this.dyn.push(addPanel(this, GAME_W / 2 - 110, 72, 220, 24, 'ui-frame-gold'));
    this.entry = addText(this, GAME_W / 2, 78, `${value}_`, { font: 'px-o', ox: 0.5, color: PAL.white });
    this.dyn.push(this.entry);
    const kw = 22;
    const kh = 18;
    const x0 = GAME_W / 2 - (13 * kw) / 2;
    const y0 = 108;
    this.dyn.push(addPanel(this, x0 - 8, y0 - 6, 13 * kw + 16, ROWS.length * kh + 40, 'ui-frame'));
    this.keyHL = addPanel(this, 0, 0, kw, kh, 'ui-frame-select');
    this.dyn.push(this.keyHL);
    ROWS.forEach((row, ry) => {
      const line: Phaser.GameObjects.BitmapText[] = [];
      for (let rx = 0; rx < 13; rx++) {
        const ch = row[rx] ?? ' ';
        const t = addText(this, x0 + rx * kw + kw / 2, y0 + ry * kh + 3, ch === ' ' ? '' : ch, { font: 'px-s', ox: 0.5, color: PAL.white });
        const z = this.add.zone(x0 + rx * kw, y0 + ry * kh, kw, kh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => {
          this.kx = rx;
          this.ky = ry;
          this.pressKey();
        });
        this.dyn.push(t, z);
        line.push(t);
      }
      this.keyObjs.push(line);
    });
    // Sondertasten
    const sy = y0 + ROWS.length * kh + 6;
    const special: [string, () => void, number][] = [
      ['Leer', () => this.edit((s) => (s.length < 14 ? `${s} ` : s)), x0],
      ['← Löschen', () => this.edit((s) => s.slice(0, -1)), x0 + 70],
      ['Fertig', () => this.confirmEntry(), x0 + 180],
    ];
    special.forEach(([label, fn, x], i) => {
      const p = addPanel(this, x, sy, i === 2 ? 106 : 64, 20, i === 2 ? 'ui-frame-gold' : 'ui-frame');
      p.setInteractive({ useHandCursor: true }).on('pointerdown', fn);
      this.dyn.push(p, addText(this, x + (i === 2 ? 53 : 32), sy + 4, label, { font: 'px-s', ox: 0.5 }));
    });
    this.kx = 0;
    this.ky = 0;
    this.moveKey(0, 0);
  }

  private moveKey(dx: number, dy: number): void {
    this.ky = (this.ky + dy + ROWS.length) % ROWS.length;
    this.kx = (this.kx + dx + 13) % 13;
    const t = this.keyObjs[this.ky]?.[this.kx];
    if (t) this.keyHL.setPosition(t.x - 11, t.y - 3);
  }

  private pressKey(): void {
    const ch = ROWS[this.ky][this.kx] ?? ' ';
    if (ch === ' ') return;
    this.edit((s) => (s.length < 14 ? s + ch : s));
    this.moveKey(0, 0);
  }

  private confirmEntry(): void {
    if (this.step === 'name') {
      this.name = this.name.trim() || 'Kai';
      this.showAffinity();
    } else if (this.step === 'tech') {
      this.tech = this.tech.trim() || AFFINITIES[this.aff].defaultName;
      this.finish();
    }
  }

  private showName(): void {
    this.step = 'name';
    this.showKeyboard('Wie heisst du?', 'Tippe deinen Namen (Tastatur geht auch) und bestätige mit „Fertig".', this.name);
  }

  // ------------------------------------------------------------ Affinität

  private showAffinity(): void {
    this.step = 'affinity';
    this.clear();
    this.dyn.push(addText(this, GAME_W / 2, 8, 'Deine Aura erwacht …', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 }));
    this.dyn.push(addText(this, GAME_W / 2, 34, 'Welche Affinität spürst du? Sie bestimmt deine Spezialtechnik und deine Talente.', { font: 'px', ox: 0.5, color: PAL.silver }));
    this.aff = 0;
    this.renderAffinity();
    this.openedAt = this.time.now;
  }

  private affCards: Phaser.GameObjects.Container[] = [];

  private renderAffinity(): void {
    for (const c of this.affCards) c.destroy();
    this.affCards = [];
    const w = 86;
    const gap = 6;
    const x0 = (GAME_W - (w * 5 + gap * 4)) / 2;
    AFFINITIES.forEach((a, i) => {
      const sel = i === this.aff;
      const c = this.add.container(x0 + i * (w + gap) + w / 2, 52 + ABILITY_H / 2 + (sel ? -4 : 0));
      const img = this.add.image(0, 0, 'affinity-cards', i).setScale(w / ABILITY_W, 1);
      const nm = addText(this, 0, -ABILITY_H / 2 + 7, a.name.toUpperCase(), { font: 'px-o', ox: 0.5, color: PAL.white });
      const orb = this.add.circle(0, -ABILITY_H / 2 + 26, 9, a.color).setStrokeStyle(1, PAL.ink);
      const glow = this.add.circle(0, -ABILITY_H / 2 + 26, 13, a.color, 0.3);
      const style = addText(this, 0, -ABILITY_H / 2 + 40, wrapText(a.style, w - 10).join('\n'), { font: 'px', ox: 0.5, color: PAL.wine, align: 'center' });
      const sp = addText(this, 0, -ABILITY_H / 2 + 94, wrapText(a.special, w - 10).join('\n'), { font: 'px-s', ox: 0.5, color: PAL.night, align: 'center' });
      c.add([img, glow, orb, nm, style, sp]);
      c.setSize(w, ABILITY_H).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        if (this.aff === i) this.pickAffinity();
        else {
          this.aff = i;
          this.renderAffinity();
        }
      });
      c.setAlpha(sel ? 1 : 0.75).setScale(sel ? 1.04 : 0.96);
      this.affCards.push(c);
    });
    const a: AffinityDef = AFFINITIES[this.aff];
    this.text.setY(186).setText(wrapText(`${a.special}: ${a.specialText}`, 440).join('\n')).setTint(PAL.cream);
    const hint = this.children.getByName('affhint') as Phaser.GameObjects.BitmapText | null;
    if (!hint) {
      const h = addText(this, GAME_W / 2, GAME_H - 14, '← → wählen · Bestätigen oder zweimal tippen', { font: 'px', ox: 0.5, color: PAL.mist }).setName('affhint');
      this.dyn.push(h);
    }
  }

  private pickAffinity(): void {
    for (const c of this.affCards) c.destroy();
    this.affCards = [];
    this.text.setText('').setTint(PAL.white).setY(160);
    this.step = 'tech';
    this.tech = AFFINITIES[this.aff].defaultName;
    this.showKeyboard('Deine Spezialtechnik', `Jede Aura ist einzigartig. Gib deiner Technik (${AFFINITIES[this.aff].special}) einen eigenen Namen!`, this.tech);
  }

  // ------------------------------------------------------------ Start

  private finish(): void {
    this.busy = true;
    Game.newGame();
    Game.player.name = this.name;
    Game.prog.setAffinity(AFFINITIES[this.aff].id, this.tech);
    Game.flags.add('frisch');
    SaveSystem.autosave();
    this.clear();
    this.text.setY(120).setText(`Willkommen, ${this.name}.\nDie Insel der 100 Karten erwartet dich.`).setTint(PAL.gold);
    this.time.delayedCall(1400, () => {
      this.cameras.main.fadeOut(500, 13, 10, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('World', { continue: true }));
    });
  }

  override update(_t: number, delta: number): void {
    if (this.busy) return;
    if (this.step === 'intro') {
      const speed = 55;
      if (this.shown < this.full.length) {
        this.shown = Math.min(this.full.length, this.shown + speed * (delta / 1000));
        this.text.setText(this.full.slice(0, Math.floor(this.shown)));
      }
      if ((Input.confirm() || Input.justPressed('attack')) && this.time.now - this.openedAt > 150) this.advanceIntro();
      return;
    }
    if (this.step === 'affinity') {
      if (Input.nav('left')) {
        this.aff = (this.aff + 4) % 5;
        this.renderAffinity();
      }
      if (Input.nav('right')) {
        this.aff = (this.aff + 1) % 5;
        this.renderAffinity();
      }
      if (Input.confirm() && this.time.now - this.openedAt > 200) this.pickAffinity();
      return;
    }
    // Bildschirmtastatur per Pfeiltasten/Gamepad (physische Buchstaben tippen direkt)
    if (Input.source === 'gamepad' || Input.source === 'touch') {
      if (Input.nav('left')) this.moveKey(-1, 0);
      if (Input.nav('right')) this.moveKey(1, 0);
      if (Input.nav('up')) this.moveKey(0, -1);
      if (Input.nav('down')) this.moveKey(0, 1);
      if (Input.confirm()) this.pressKey();
      if (Input.cancel()) this.edit((s) => s.slice(0, -1));
      if (Input.justPressed('pause')) this.confirmEntry();
    }
  }
}
