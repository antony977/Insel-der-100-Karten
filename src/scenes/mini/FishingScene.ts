import Phaser from 'phaser';
import { MiniScene } from './MiniBase';
import { addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_W } from '../../config';
import { Sound } from '../../audio/AudioEngine';
import { Game } from '../../systems/GameState';

type Phase = 'warten' | 'biss' | 'drill' | 'pause';

const FISH = ['Silberling', 'Hafenbarsch', 'Flunderchen', 'Glanzmakrele', 'Stachelgrundel', 'Möwenschreck', 'Perlhecht'];

/**
 * Angeln am Steg: Warten, beim Anbiss rechtzeitig reagieren, dann den Fisch mit drei
 * gut getimten Zügen einholen. Wette: drei Fische in 60 Sekunden.
 */
export class FishingScene extends MiniScene {
  private phase: Phase = 'warten';
  private t = 0;
  private wait = 2;
  private needle = 0;
  private dir = 1;
  private zone = { a: 0.4, b: 0.6 };
  private hits = 0;
  private caught = 0;
  private timeLeft = 60;
  private bob!: Phaser.GameObjects.Arc;
  private line!: Phaser.GameObjects.Line;
  private status!: Phaser.GameObjects.BitmapText;
  private info!: Phaser.GameObjects.BitmapText;
  private bar!: Phaser.GameObjects.Graphics;
  private tapped = false;
  private wette = true;
  private box = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super('Fishing');
  }

  create(): void {
    this.wette = this.data0.mode !== 'frei';
    this.box = this.setupMini(this.wette ? 'Jorns Angelwette – fang 3 Fische in 60 Sekunden!' : 'Angeln am Steg', 400, 220);
    const { x, y, w, h } = this.box;
    // Wasser und Steg
    const water = this.add.graphics();
    water.fillStyle(PAL.blue).fillRect(x + 8, y + 22, w - 16, h - 64);
    water.fillStyle(PAL.sky, 0.5);
    for (let i = 0; i < 18; i++) water.fillRect(x + 20 + ((i * 53) % (w - 40)), y + 40 + ((i * 29) % (h - 90)), 8, 1);
    water.fillStyle(PAL.wood).fillRect(x + 8, y + h - 52, 110, 10);
    water.fillStyle(PAL.tan).fillRect(x + 8, y + h - 52, 110, 2);
    this.add.sprite(x + 96, y + h - 50, 'player', 2 * 12 + 11).setOrigin(0.5, 1);
    this.line = this.add.line(0, 0, x + 106, y + h - 74, x + 230, y + 90, PAL.white, 0.8).setOrigin(0, 0);
    this.bob = this.add.circle(x + 230, y + 90, 3, PAL.red).setStrokeStyle(1, PAL.white);
    this.bar = this.add.graphics();
    this.status = addText(this, GAME_W / 2, y + h - 36, '', { font: 'px-s', ox: 0.5, color: PAL.cream });
    this.info = addText(this, x + 12, y + 24, '', { font: 'px-s', color: PAL.white });
    addText(this, GAME_W / 2, y + h - 18, 'Bestätigen / Angriff / Antippen = Ziehen', { font: 'px', ox: 0.5, color: PAL.mist });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.worldY > this.box.y + 22) this.tapped = true;
    });
    this.phase = 'warten';
    this.wait = 1.5 + Math.random() * 2.5;
    this.caught = 0;
    this.timeLeft = 60;
    this.t = 0;
    this.updateInfo();
    this.status.setText('Warte auf einen Anbiss …');
  }

  private updateInfo(): void {
    this.info.setText(this.wette ? `Fische: ${this.caught}/3   Zeit: ${Math.ceil(this.timeLeft)} s` : `Gefangen: ${this.caught}`);
  }

  private action(): boolean {
    const a = Input.confirm() || Input.justPressed('attack') || this.tapped;
    this.tapped = false;
    return a;
  }

  override update(_time: number, delta: number): void {
    if (this.done) return;
    const dt = delta / 1000;
    if (this.escPressed()) {
      if (this.wette) this.finish(false, this.caught, true);
      else this.finish(this.caught > 0, this.caught, true);
      return;
    }
    if (this.wette) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.status.setText('Die Zeit ist um!');
        this.finish(this.caught >= 3, this.caught);
        return;
      }
    }
    this.t += dt;
    const act = this.action();
    const bx = this.box.x + 230;
    const by = this.box.y + 90;
    switch (this.phase) {
      case 'warten':
        this.bob.setPosition(bx, by + Math.sin(this.t * 3) * 1.5);
        if (act) this.status.setText('Zu früh! Warte, bis es zuckt …');
        if (this.t >= this.wait) {
          this.phase = 'biss';
          this.t = 0;
          Sound.play('bite');
          this.status.setText('! Es beisst – JETZT ziehen!');
          this.status.setTint(PAL.gold);
        }
        break;
      case 'biss':
        this.bob.setPosition(bx + (Math.random() - 0.5) * 3, by + 3 + Math.sin(this.t * 30) * 2);
        if (act) {
          Sound.play('splash');
          this.phase = 'drill';
          this.t = 0;
          this.hits = 0;
          this.needle = 0;
          this.newZone();
          this.status.setTint(PAL.cream).setText('Drück, wenn der Zeiger im grünen Feld ist! (0/3)');
        } else if (this.t > 0.75) {
          this.status.setTint(PAL.coral).setText('Zu langsam – der Fisch ist weg.');
          this.toPause();
        }
        break;
      case 'drill': {
        const speed = 1.1 + this.hits * 0.35;
        this.needle += this.dir * speed * dt;
        if (this.needle > 1) {
          this.needle = 1;
          this.dir = -1;
        } else if (this.needle < 0) {
          this.needle = 0;
          this.dir = 1;
        }
        this.bob.setPosition(bx - this.hits * 30 + Math.sin(this.t * 12) * 2, by + 8 + this.hits * 14);
        if (act) {
          if (this.needle >= this.zone.a && this.needle <= this.zone.b) {
            this.hits++;
            Sound.play('ding', { rate: 1 + this.hits * 0.15 });
            if (this.hits >= 3) {
              this.caught++;
              const fish = FISH[Math.floor(Math.random() * FISH.length)];
              Sound.play('coin');
              this.status.setTint(PAL.lime).setText(`Gefangen: ${fish}!`);
              if (!this.wette) {
                const m = 8 + Math.floor(Math.random() * 18);
                Game.inv.money += m;
                Game.events.emit('vitals-changed');
                this.status.setText(`Gefangen: ${fish}! Jorn kauft ihn dir für ${m} Münzen ab.`);
              }
              this.updateInfo();
              if (this.wette && this.caught >= 3) {
                this.drawBar(false);
                this.finish(true, this.caught);
                return;
              }
              this.toPause();
            } else {
              this.newZone();
              this.status.setText(`Gut so! (${this.hits}/3)`);
            }
          } else {
            Sound.play('error');
            this.status.setTint(PAL.coral).setText('Daneben – die Schnur reisst!');
            this.toPause();
          }
        }
        break;
      }
      case 'pause':
        this.bob.setPosition(bx, by);
        if (this.t > 1.2) {
          this.phase = 'warten';
          this.t = 0;
          this.wait = 1.2 + Math.random() * 2.8;
          this.status.setTint(PAL.cream).setText('Warte auf einen Anbiss …');
        }
        break;
    }
    this.line.setTo(this.box.x + 106, this.box.y + this.box.h - 74, this.bob.x, this.bob.y);
    this.drawBar(this.phase === 'drill');
    this.updateInfo();
  }

  private toPause(): void {
    this.phase = 'pause';
    this.t = 0;
  }

  private newZone(): void {
    const width = 0.24 - this.hits * 0.05;
    const a = 0.1 + Math.random() * (0.8 - width);
    this.zone = { a, b: a + width };
  }

  private drawBar(show: boolean): void {
    const g = this.bar;
    g.clear();
    if (!show) return;
    const x = this.box.x + 130;
    const y = this.box.y + this.box.h - 64;
    const w = 220;
    g.fillStyle(PAL.ink).fillRect(x - 1, y - 1, w + 2, 10);
    g.fillStyle(PAL.navy).fillRect(x, y, w, 8);
    g.fillStyle(PAL.leaf).fillRect(x + this.zone.a * w, y, (this.zone.b - this.zone.a) * w, 8);
    g.fillStyle(PAL.white).fillRect(x + this.needle * w - 1, y - 3, 2, 14);
  }
}
