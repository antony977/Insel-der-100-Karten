import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Settings } from '../systems/Settings';
import { wrapText } from '../gfx/font/PixelFont';
import { charFrame } from '../gfx/generators/characters';
import { Game } from '../systems/GameState';
import { getDialog, type Choice, type DialogCtx, type DialogDef, type DialogNode, type Line, type WorldApi } from '../systems/Dialog';
import { NPC_BY_ID } from '../data/npcs';

export interface TalkData {
  dialog: string;
  npc?: string;
  api: WorldApi;
}

const BOX_W = 448;
const BOX_H = 74;
const TEXT_W = 352;

/**
 * Dialogfenster mit Portrait, Tippeffekt und Entscheidungen. Läuft über der pausierten Welt.
 */
export class TalkScene extends BaseScene {
  private def!: DialogDef;
  private ctx!: DialogCtx;
  private node!: DialogNode;
  private lines: Line[] = [];
  private lineIdx = 0;
  private full = '';
  private shown = 0;
  private openedAt = 0;
  private name!: Phaser.GameObjects.BitmapText;
  private role!: Phaser.GameObjects.BitmapText;
  private text!: Phaser.GameObjects.BitmapText;
  private more!: Phaser.GameObjects.BitmapText;
  private portrait!: Phaser.GameObjects.Sprite;
  private portraitBg!: Phaser.GameObjects.NineSlice;
  private choiceBox!: Phaser.GameObjects.Container;
  private choices: Choice[] = [];
  private choiceTexts: Phaser.GameObjects.BitmapText[] = [];
  private choiceSel = 0;
  private voice = 1;
  private choiceHL!: Phaser.GameObjects.NineSlice;
  private afterFns: (() => void)[] = [];
  private tapped = false;
  private ended = false;
  private npcName = '';
  private npcRole = '';
  private npcKey = '';

  constructor() {
    super('Talk');
  }

  create(data: TalkData): void {
    this.setupCamera();
    Input.setContext('menu');
    this.ended = false;
    this.afterFns = [];
    const def = getDialog(data.dialog);
    const npc = data.npc ? NPC_BY_ID[data.npc] : undefined;
    this.npcName = npc?.name ?? '';
    this.npcRole = npc?.role ?? '';
    this.npcKey = npc ? `npc-${npc.id}` : '';
    // jede Figur „spricht" in eigener Tonhöhe
    let h = 7;
    for (const ch of npc?.id ?? 'x') h = (h * 31 + ch.charCodeAt(0)) % 997;
    this.voice = 0.8 + (h % 50) / 100;
    Sound.duck('talk', true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Sound.duck('talk', false));
    const api: WorldApi = {
      ...data.api,
      after: (fn) => this.afterFns.push(fn),
    };
    this.ctx = { g: Game, w: api, npc };

    const x = (GAME_W - BOX_W) / 2;
    const y = GAME_H - BOX_H - 6;
    const box = this.add.container(x, y);
    box.add(addPanel(this, 0, 0, BOX_W, BOX_H));
    this.portraitBg = addPanel(this, 6, 6, 62, 62, 'ui-frame-gold');
    box.add(this.portraitBg);
    this.portrait = this.add.sprite(37, 3, this.npcKey || 'player', charFrame('down', 'idle0')).setOrigin(0.5, 0).setScale(2.5);
    this.portrait.setCrop(2, 3, 20, 18);
    box.add(this.portrait);
    this.name = addText(this, 78, 6, '', { font: 'px-s', color: PAL.gold });
    this.role = addText(this, 78, 6, '', { font: 'px', color: PAL.mist });
    this.text = addText(this, 78, 20, '', { font: 'px-s', color: PAL.white });
    this.more = addText(this, BOX_W - 14, BOX_H - 14, '▼', { font: 'px-s', color: PAL.gold });
    box.add([this.name, this.role, this.text, this.more]);
    box.setY(y + 30).setAlpha(0);
    this.tweens.add({ targets: box, y, alpha: 1, duration: 140, ease: 'Quad.Out' });

    this.choiceBox = this.add.container(0, 0).setVisible(false);
    this.choiceHL = addPanel(this, 0, 0, 10, 14, 'ui-frame-select');
    this.input.on('pointerdown', () => {
      this.tapped = true;
    });

    if (!def) {
      this.lines = [`(${data.dialog} fehlt)`];
      this.node = {};
      this.lineIdx = 0;
      this.showLine();
      return;
    }
    this.def = def;
    this.goto(def.start(this.ctx));
  }

  private goto(id: string): void {
    const n = this.def.nodes[id];
    if (!n) {
      this.end();
      return;
    }
    this.node = n;
    const say = typeof n.say === 'function' ? n.say(this.ctx) : n.say ?? [];
    this.lines = say;
    this.lineIdx = 0;
    this.showLine();
  }

  private fmt(s: string): string {
    return s.replace(/\{name\}/g, Game.player.name).replace(/\{tech\}/g, Game.prog.techName);
  }

  private showLine(): void {
    if (this.lineIdx >= this.lines.length) {
      this.afterLines();
      return;
    }
    const l = this.lines[this.lineIdx];
    const line = typeof l === 'string' ? { text: l } : l;
    const who = line.who ?? this.npcName;
    const isPlayer = who === '{name}' || line.portrait === 'player';
    const key = line.portrait ?? (isPlayer ? 'player' : this.npcKey);
    this.name.setText(this.fmt(who));
    this.role.setText(isPlayer || line.who ? '' : this.npcRole).setX(78 + this.name.width + 8);
    this.role.setY(8);
    if (key && this.textures.exists(key)) {
      this.portrait.setTexture(key, charFrame('down', 'idle0')).setVisible(true);
      this.portraitBg.setVisible(true);
    } else {
      this.portrait.setVisible(false);
      this.portraitBg.setVisible(false);
    }
    this.full = wrapText(this.fmt(line.text), TEXT_W).slice(0, 4).join('\n');
    this.shown = 0;
    this.text.setText('');
    this.openedAt = this.time.now;
  }

  private afterLines(): void {
    const n = this.node;
    const ch = (n.choices ?? []).filter((c) => !c.if || c.if(this.ctx));
    if (ch.length) {
      this.showChoices(ch);
      return;
    }
    const r = n.do?.(this.ctx);
    const next = (typeof r === 'string' && r) || n.goto;
    if (next) this.goto(next);
    else this.end();
  }

  private showChoices(ch: Choice[]): void {
    this.choices = ch;
    this.choiceSel = 0;
    this.choiceBox.removeAll(true);
    this.choiceTexts = [];
    const w = Math.min(260, Math.max(120, ...ch.map((c) => this.measure(this.fmt(c.text)) + 28)));
    const h = ch.length * 14 + 10;
    const x = GAME_W - w - 16;
    const y = GAME_H - BOX_H - 10 - h;
    const panel = addPanel(this, 0, 0, w, h, 'ui-frame');
    this.choiceHL = addPanel(this, 4, 5, w - 8, 14, 'ui-frame-select');
    this.choiceBox.add([panel, this.choiceHL]);
    ch.forEach((c, i) => {
      const t = addText(this, 12, 6 + i * 14, this.fmt(c.text), { font: 'px-s', color: PAL.white });
      const zone = this.add.zone(4, 5 + i * 14, w - 8, 14).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.selectChoice(i));
      zone.on('pointerdown', () => {
        this.selectChoice(i);
        this.choose();
      });
      this.choiceBox.add([t, zone]);
      this.choiceTexts.push(t);
    });
    this.choiceBox.setPosition(x, y).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.choiceBox, alpha: 1, duration: 100 });
    this.selectChoice(0);
    this.openedAt = this.time.now;
  }

  private measure(s: string): number {
    const t = addText(this, 0, 0, s, { font: 'px-s' });
    const w = t.width;
    t.destroy();
    return w;
  }

  private selectChoice(i: number): void {
    if (i !== this.choiceSel) Sound.play('move');
    this.choiceSel = i;
    this.choiceHL.setY(5 + i * 14);
    this.choiceTexts.forEach((t, k) => t.setTint(k === i ? PAL.gold : PAL.white));
  }

  private choose(): void {
    const c = this.choices[this.choiceSel];
    Sound.play('select');
    this.choiceBox.setVisible(false);
    this.choices = [];
    const r = c.do?.(this.ctx);
    const next = (typeof r === 'string' && r) || c.goto;
    if (next) this.goto(next);
    else this.end();
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.scene.stop();
    this.scene.resume('Hud');
    this.scene.resume('World');
    const fns = this.afterFns;
    this.afterFns = [];
    // Folge-Aktionen erst nach dem Schliessen (z. B. Laden öffnen)
    const world = this.scene.get('World');
    world.time.delayedCall(30, () => fns.forEach((f) => f()));
  }

  override update(_t: number, delta: number): void {
    const dt = delta / 1000;
    const tapped = this.tapped;
    this.tapped = false;
    if (this.ended) return;
    if (this.choices.length) {
      if (Input.nav('up')) this.selectChoice((this.choiceSel + this.choices.length - 1) % this.choices.length);
      if (Input.nav('down')) this.selectChoice((this.choiceSel + 1) % this.choices.length);
      if (Input.confirm() && this.time.now - this.openedAt > 120) this.choose();
      return;
    }
    const speed = [30, 60, 120, 9999][Settings.get().textSpeed] ?? 60;
    if (this.shown < this.full.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.full.length, this.shown + speed * dt);
      const now = Math.floor(this.shown);
      this.text.setText(this.full.slice(0, now));
      if (Math.floor(now / 3) > Math.floor(before / 3) && /[^\s.,!?…]/.test(this.full[now - 1] ?? '')) Sound.play('talk', { rate: this.voice, vary: 0.05 });
    }
    this.more.setVisible(this.shown >= this.full.length && Math.floor(this.time.now / 300) % 2 === 0);
    const pressed = Input.confirm() || Input.cancel() || tapped;
    if (pressed && this.time.now - this.openedAt > 140) {
      if (this.shown < this.full.length) {
        this.shown = this.full.length;
        this.text.setText(this.full);
      } else {
        this.lineIdx++;
        this.showLine();
      }
    }
  }
}
