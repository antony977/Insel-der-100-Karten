import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Game } from '../systems/GameState';
import { CARD_COLOR_STYLE, type AbilityCard, type CardColor } from '../data/aura';
import { ABILITY_H, ABILITY_W } from '../gfx/generators/ui';
import { wrapText } from '../gfx/font/PixelFont';

const COLOR_FRAME: Record<CardColor, number> = { rot: 0, gruen: 1, blau: 2, gold: 3 };

/**
 * Stufenaufstieg: Das Spiel pausiert, man wählt 1 von 3 farbcodierten Fähigkeitskarten
 * (Rot = Stärke, Grün = Tempo, Blau = Aura, Gold = Affinitäts-Talent).
 */
export class LevelUpScene extends BaseScene {
  private offer: AbilityCard[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private sel = 1;
  private busy = true;
  private title!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('LevelUp');
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    Sound.play('fanfare');
    this.cards = [];
    const bg = this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0).setOrigin(0, 0);
    this.tweens.add({ targets: bg, fillAlpha: 0.72, duration: 200 });
    // Lichtstrahlen
    for (let i = 0; i < 12; i++) {
      const ray = this.add.rectangle(GAME_W / 2, 40, 3, 300, PAL.gold, 0.08).setOrigin(0.5, 0).setAngle(i * 30).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ray, angle: ray.angle + 30, duration: 6000, repeat: -1 });
    }
    this.title = addText(this, GAME_W / 2, 10, '', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });
    addText(this, GAME_W / 2, 36, 'Wähle eine Fähigkeitskarte', { font: 'px-o', ox: 0.5, color: PAL.cream });
    this.showOffer();
  }

  private showOffer(): void {
    for (const c of this.cards) c.destroy();
    this.cards = [];
    this.offer = Game.prog.offer();
    this.sel = 1;
    this.busy = true;
    const lvl = Game.prog.level - Game.prog.pending + 1;
    this.title.setText(`Stufe ${lvl}!`);
    this.title.setScale(0.2);
    this.tweens.add({ targets: this.title, scale: 1, duration: 260, ease: 'Back.Out' });
    const gap = 14;
    const total = ABILITY_W * 3 + gap * 2;
    const x0 = (GAME_W - total) / 2;
    const y = 54;
    this.offer.forEach((c, i) => {
      const x = x0 + i * (ABILITY_W + gap);
      const cont = this.add.container(x + ABILITY_W / 2, y + ABILITY_H / 2);
      const img = this.add.image(0, 0, 'ability-cards', COLOR_FRAME[c.color]);
      const style = CARD_COLOR_STYLE[c.color];
      const head = addText(this, 0, -ABILITY_H / 2 + 7, style.name.toUpperCase(), { font: 'px-o', ox: 0.5, color: PAL.white });
      const icon = this.add.image(0, -ABILITY_H / 2 + 26, 'ability-icons', c.icon).setTint(style.color === PAL.gold ? PAL.cream : PAL.white);
      const nameLines = wrapText(c.name, ABILITY_W - 12);
      const name = addText(this, 0, -ABILITY_H / 2 + 40, nameLines.join('\n'), { font: 'px-s', ox: 0.5, color: PAL.wine, align: 'center' });
      const body = addText(this, 0, -ABILITY_H / 2 + 44 + nameLines.length * 12, wrapText(c.text, ABILITY_W - 14).join('\n'), {
        font: 'px',
        ox: 0.5,
        color: PAL.night,
        align: 'center',
      });
      cont.add([img, head, icon, name, body]);
      cont.setSize(ABILITY_W, ABILITY_H);
      cont.setInteractive({ useHandCursor: true });
      cont.on('pointerover', () => {
        if (!this.busy) this.select(i);
      });
      cont.on('pointerdown', () => {
        if (this.busy) return;
        this.select(i);
        this.choose();
      });
      // Karten fliegen herein
      cont.setScale(0.1).setAlpha(0);
      cont.y += 40;
      this.tweens.add({
        targets: cont,
        scale: 1,
        alpha: 1,
        y: y + ABILITY_H / 2,
        delay: 120 + i * 110,
        duration: 260,
        ease: 'Back.Out',
        onComplete: () => {
          if (i === 2) {
            this.busy = false;
            this.select(this.sel);
          }
        },
      });
      this.cards.push(cont);
    });
    addText(this, GAME_W / 2, GAME_H - 14, 'Pfeile/Stick wählen · Bestätigen nimmt die Karte · Antippen geht auch', { font: 'px-o', ox: 0.5, color: PAL.mist }).setName('hint');
  }

  private select(i: number): void {
    if (i !== this.sel) Sound.play('move');
    this.sel = i;
    this.cards.forEach((c, k) => {
      this.tweens.killTweensOf(c);
      const on = k === i;
      c.setScale(on ? 1.08 : 0.94);
      c.setAlpha(on ? 1 : 0.8);
      c.y = 54 + ABILITY_H / 2 - (on ? 6 : 0);
    });
  }

  private choose(): void {
    if (this.busy) return;
    this.busy = true;
    const c = this.offer[this.sel];
    Sound.play('cardRare');
    Game.prog.pick(c);
    Game.syncBonus();
    const st = Game.inv.stats();
    Game.inv.lp = st.lp;
    Game.inv.aura = st.aura;
    Game.events.emit('vitals-changed');
    const chosen = this.cards[this.sel];
    this.cards.forEach((k, i) => {
      if (i !== this.sel) this.tweens.add({ targets: k, alpha: 0, y: k.y + 30, duration: 200 });
    });
    this.tweens.add({ targets: chosen, scale: 1.3, duration: 180, yoyo: true });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sp = this.add.image(chosen.x, chosen.y, 'fx-sparkle', 2).setTint(CARD_COLOR_STYLE[c.color].color).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: sp, x: chosen.x + Math.cos(a) * 80, y: chosen.y + Math.sin(a) * 60, alpha: 0, duration: 500, onComplete: () => sp.destroy() });
    }
    this.time.delayedCall(560, () => {
      if (Game.prog.pending > 0) {
        this.children.getByName('hint')?.destroy();
        this.showOffer();
      } else this.close();
    });
  }

  private close(): void {
    this.scene.stop();
    this.scene.setVisible(true, 'Hud');
    this.scene.resume('Hud');
    this.scene.resume('World');
  }

  override update(): void {
    if (this.busy) return;
    if (Input.nav('left')) this.select((this.sel + 2) % 3);
    if (Input.nav('right')) this.select((this.sel + 1) % 3);
    if (Input.confirm()) this.choose();
  }
}
