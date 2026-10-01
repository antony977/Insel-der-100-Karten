import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Game } from '../systems/GameState';
import { PACK_WEIGHTS, SELL_PRICE, SHOPS, type ShopDef } from '../data/shops';
import { card, cardIndex, cardLabel, ZAUBERKARTEN } from '../data/cards';
import type { CardDef, Rank } from '../data/cardTypes';
import { wrapText } from '../gfx/font/PixelFont';
import { charFrame } from '../gfx/generators/characters';
import { NPC_BY_ID } from '../data/npcs';
import { SaveSystem } from '../systems/SaveSystem';

interface Row {
  kind: 'buy' | 'pack' | 'sell';
  card?: CardDef;
  uid?: number;
  price: number;
  label: string;
}

const PX = 16;
const PY = 14;
const PW = GAME_W - 32;
const PH = GAME_H - 28;
const LIST_W = 228;
const ROW_H = 18;
const ROWS = 9;

/** Laden: Karten kaufen (landen in der Hand), Karten verkaufen, Siegelpacks öffnen. */
export class ShopScene extends BaseScene {
  private shop!: ShopDef;
  private mode: 'buy' | 'sell' = 'buy';
  private rows: Row[] = [];
  private sel = 0;
  private scroll = 0;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private moneyText!: Phaser.GameObjects.BitmapText;
  private busy = false;
  private msg!: Phaser.GameObjects.BitmapText;
  private msgT = 0;

  constructor() {
    super('Shop');
  }

  create(data: { shop: string }): void {
    this.setupCamera();
    Input.setContext('menu');
    this.shop = SHOPS[data.shop];
    this.mode = this.shop.items.length || this.shop.pack ? 'buy' : 'sell';
    this.sel = 0;
    this.scroll = 0;
    this.busy = false;
    this.dyn = [];
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.7).setOrigin(0, 0);
    addPanel(this, PX, PY, PW, PH, 'ui-frame');
    // Kopf: Portrait + Name
    const keeper = NPC_BY_ID[this.shop.keeper];
    const key = keeper ? `npc-${keeper.id}` : '';
    if (key && this.textures.exists(key)) {
      addPanel(this, PX + 6, PY + 6, 34, 34, 'ui-frame-gold');
      this.add.sprite(PX + 23, PY + 4, key, charFrame('down', 'idle0')).setOrigin(0.5, 0).setScale(1.5).setCrop(2, 3, 20, 18);
    }
    addText(this, PX + 46, PY + 7, this.shop.name, { font: 'px-o', color: PAL.gold });
    addText(this, PX + 46, PY + 21, wrapText(this.shop.greeting, PW - 140).slice(0, 2).join('\n'), { font: 'px', color: PAL.silver });
    this.moneyText = addText(this, PX + PW - 10, PY + 8, '', { font: 'px-o', ox: 1, color: PAL.gold });
    this.msg = addText(this, GAME_W / 2, PY + PH - 14, '', { font: 'px-o', ox: 0.5, color: PAL.cream });
    this.buildRows();
    this.render();
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.move(dy > 0 ? 1 : -1));
  }

  private get currency(): 'muenzen' | 'chips' {
    return this.shop.currency ?? 'muenzen';
  }

  private get funds(): number {
    return this.currency === 'chips' ? Game.inv.chips : Game.inv.money;
  }

  private pay(n: number): void {
    if (this.currency === 'chips') Game.inv.chips -= n;
    else Game.inv.money -= n;
    Game.events.emit('vitals-changed');
  }

  private price(base: number): number {
    const d = this.shop.discount;
    if (d && (Game.countCard(d.card) > 0 || Game.inv.keys.has('gildenarchiv'))) return Math.round(base * (1 - d.percent / 100));
    return base;
  }

  private buildRows(): void {
    this.rows = [];
    if (this.mode === 'buy') {
      if (this.shop.pack) this.rows.push({ kind: 'pack', price: this.price(this.shop.pack), label: 'Siegelpack (3 Zauber)' });
      for (const it of this.shop.items) this.rows.push({ kind: 'buy', card: card(it.card), price: this.price(it.price), label: card(it.card).name });
    } else {
      const add = (uid: number) => {
        const c = card(Game.registry.idOf(uid));
        this.rows.push({ kind: 'sell', card: c, uid, price: SELL_PRICE[c.rank], label: c.name });
      };
      for (const u of Game.book.frei) if (u !== null) add(u);
      for (const h of Game.book.hand) add(h.uid);
    }
    this.sel = Math.min(this.sel, Math.max(0, this.rows.length - 1));
  }

  private clearDyn(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
  }

  private t(x: number, y: number, s: string, color: number, font: 'px' | 'px-s' | 'px-o' = 'px-s', o: { ox?: number; maxWidth?: number } = {}): Phaser.GameObjects.BitmapText {
    const t = addText(this, x, y, s, { font, color, ox: o.ox });
    if (o.maxWidth) t.setText(wrapText(s, o.maxWidth).join('\n'));
    this.dyn.push(t);
    return t;
  }

  private render(): void {
    this.clearDyn();
    const cur = this.currency === 'chips' ? 'Chips' : 'Münzen';
    this.moneyText.setText(`${this.funds} ${cur}`);
    const top = PY + 46;
    // Reiter
    const tabs: ('buy' | 'sell')[] = [];
    if (this.shop.items.length || this.shop.pack) tabs.push('buy');
    if (this.shop.buys) tabs.push('sell');
    tabs.forEach((m, i) => {
      const x = PX + 10 + i * 74;
      const p = addPanel(this, x, top - 2, 70, 16, m === this.mode ? 'ui-frame-select' : 'ui-frame');
      p.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setMode(m));
      this.dyn.push(p);
      this.t(x + 35, top + 1, m === 'buy' ? 'Kaufen' : 'Verkaufen', m === this.mode ? PAL.gold : PAL.white, 'px-s', { ox: 0.5 });
    });
    // Liste
    const ly = top + 18;
    if (!this.rows.length) {
      this.t(PX + 14, ly + 6, this.mode === 'sell' ? 'Keine Karten in freien Slots oder in der Hand.' : 'Nichts im Angebot.', PAL.mist, 'px-s', { maxWidth: LIST_W - 20 });
    }
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + ROWS) this.scroll = this.sel - ROWS + 1;
    for (let i = 0; i < ROWS; i++) {
      const ri = this.scroll + i;
      const r = this.rows[ri];
      if (!r) break;
      const y = ly + i * ROW_H;
      const on = ri === this.sel;
      if (on) this.dyn.push(addPanel(this, PX + 8, y - 1, LIST_W, ROW_H, 'ui-frame-select'));
      const icon = r.kind === 'pack' ? this.add.image(PX + 14, y + 1, 'card-extras', 1).setOrigin(0, 0).setScale(0.4) : this.add.image(PX + 14, y, 'card-icons', cardIndex(r.card!.id)).setOrigin(0, 0);
      this.dyn.push(icon);
      const soldOut = r.kind === 'buy' && !Game.registry.canCreate(r.card!.id);
      this.t(PX + 34, y + 3, r.label, soldOut ? PAL.stone : on ? PAL.gold : PAL.white);
      this.t(PX + LIST_W, y + 3, soldOut ? 'vergriffen' : `${r.price}`, soldOut ? PAL.stone : r.price > this.funds && r.kind !== 'sell' ? PAL.coral : PAL.gold, 'px-s', { ox: 1 });
      const zone = this.add.zone(PX + 8, y - 1, LIST_W, ROW_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.busy) return;
        if (this.sel === ri) this.act();
        else {
          this.sel = ri;
          this.render();
        }
      });
      this.dyn.push(zone);
    }
    if (this.rows.length > ROWS) this.t(PX + LIST_W / 2, ly + ROWS * ROW_H + 2, `${this.scroll + 1}–${Math.min(this.rows.length, this.scroll + ROWS)} von ${this.rows.length}`, PAL.mist, 'px', { ox: 0.5 });
    // Details
    const dx = PX + LIST_W + 22;
    const dw = PW - LIST_W - 34;
    const r = this.rows[this.sel];
    if (r) {
      if (r.kind === 'pack') {
        for (let i = 0; i < 3; i++) this.dyn.push(this.add.image(dx + 20 + i * 22, top + 34, 'card-extras', 1).setScale(1.2).setAngle(-12 + i * 12));
        this.t(dx, top + 64, 'Siegelpack', PAL.gold, 'px-o');
        this.t(dx, top + 78, 'Drei versiegelte Zauberkarten. Seltene Zauber sind selten! Zauber passen nur in freie Slots.', PAL.silver, 'px', { maxWidth: dw });
      } else if (r.card) {
        const c = r.card;
        this.dyn.push(this.add.image(dx + 22, top + 32, 'cards', cardIndex(c.id)).setScale(1.5));
        this.t(dx + 50, top + 4, c.name, PAL.gold, 'px-o', { maxWidth: dw - 54 });
        this.t(dx + 50, top + 30, `${cardLabel(c)} · Rang ${c.rank}`, PAL.silver, 'px');
        this.t(dx + 50, top + 42, `Limit ${c.limit} · im Umlauf ${Game.registry.count(c.id)}`, PAL.silver, 'px');
        this.t(dx, top + 70, c.effect, PAL.white, 'px', { maxWidth: dw });
        this.t(dx, top + 112, `Du besitzt: ${Game.countCard(c.id)}`, PAL.mist, 'px');
      }
    }
    // Knöpfe
    const by = PY + PH - 32;
    const btn = (x: number, label: string, fn: () => void, enabled = true) => {
      const p = addPanel(this, x, by, 84, 18, enabled ? 'ui-frame-gold' : 'ui-frame');
      p.setInteractive({ useHandCursor: enabled }).on('pointerdown', () => enabled && !this.busy && fn());
      this.dyn.push(p);
      this.t(x + 42, by + 3, label, enabled ? PAL.white : PAL.stone, 'px-s', { ox: 0.5 });
    };
    btn(dx, this.mode === 'sell' ? 'Verkaufen' : 'Kaufen', () => this.act(), !!r);
    btn(dx + 92, 'Zurück', () => this.close());
  }

  private setMode(m: 'buy' | 'sell'): void {
    if (this.mode === m) return;
    if (m === 'sell' && !this.shop.buys) return;
    if (m === 'buy' && !this.shop.items.length && !this.shop.pack) return;
    this.mode = m;
    this.sel = 0;
    this.scroll = 0;
    this.buildRows();
    this.render();
  }

  private flash(s: string): void {
    this.msg.setText(s);
    this.msgT = 2.5;
  }

  private act(): void {
    const r = this.rows[this.sel];
    if (!r || this.busy) return;
    if (r.kind === 'sell') {
      const uid = r.uid!;
      if (!Game.book.locate(uid)) return;
      Game.book.remove(uid);
      Game.registry.destroy(uid);
      Game.quick = Game.quick.map((q) => (q === uid ? null : q));
      Game.inv.money += r.price;
      Game.events.emit('book-changed');
      Game.events.emit('vitals-changed');
      this.flash(`${r.label} verkauft: +${r.price} Münzen`);
      this.buildRows();
      this.render();
      return;
    }
    if (r.price > this.funds) {
      this.flash(this.currency === 'chips' ? 'Nicht genug Chips.' : 'Nicht genug Münzen.');
      return;
    }
    if (r.kind === 'pack') {
      this.openPack(r.price);
      return;
    }
    const c = r.card!;
    if (!Game.registry.canCreate(c.id)) {
      this.flash(`Alle ${c.limit} Exemplare von „${c.name}" sind vergriffen.`);
      return;
    }
    this.pay(r.price);
    Game.giveCard(c.id);
    this.flash(`${c.name} gekauft – liegt in deiner Hand!`);
    SaveSystem.autosave();
    this.render();
  }

  /** Siegelpack mit Aufdeck-Animation */
  private openPack(price: number): void {
    const pool = ZAUBERKARTEN.filter((z) => !z.spell?.questOnly);
    const picks: CardDef[] = [];
    for (let i = 0; i < 3; i++) {
      const weights = PACK_WEIGHTS;
      const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
      let roll = Math.random() * total;
      let rank: Rank = 'E';
      for (const [rk, w] of Object.entries(weights) as [Rank, number][]) {
        roll -= w;
        if (roll <= 0) {
          rank = rk;
          break;
        }
      }
      let cand = pool.filter((c) => c.rank === rank && Game.registry.canCreate(c.id));
      if (!cand.length) cand = pool.filter((c) => Game.registry.canCreate(c.id));
      if (!cand.length) break;
      picks.push(cand[Math.floor(Math.random() * cand.length)]);
    }
    if (!picks.length) {
      this.flash('Die Siegel sind leer – alle Zauber sind vergriffen.');
      return;
    }
    this.pay(price);
    this.busy = true;
    const layer = this.add.container(0, 0).setDepth(100);
    layer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.8).setOrigin(0, 0));
    const title = addText(this, GAME_W / 2, 30, 'Das Siegel bricht…', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });
    layer.add(title);
    picks.forEach((c, i) => {
      const x = GAME_W / 2 + (i - 1) * 90;
      const y = GAME_H / 2 + 6;
      const back = this.add.image(x, y + 80, 'card-extras', 1).setScale(2).setAlpha(0);
      layer.add(back);
      this.tweens.add({ targets: back, y, alpha: 1, duration: 260, delay: i * 140, ease: 'Back.Out' });
      this.tweens.add({
        targets: back,
        scaleX: 0,
        duration: 140,
        delay: 700 + i * 380,
        onComplete: () => {
          back.setTexture('cards', cardIndex(c.id));
          this.tweens.add({ targets: back, scaleX: 2, duration: 140 });
          const rare = ['S', 'A', 'B'].includes(c.rank);
          for (let k = 0; k < (rare ? 16 : 8); k++) {
            const a = (k / (rare ? 16 : 8)) * Math.PI * 2;
            const sp = this.add.image(x, y, 'fx-sparkle', 2).setTint(rare ? PAL.gold : PAL.ice).setBlendMode(Phaser.BlendModes.ADD).setDepth(101);
            this.tweens.add({ targets: sp, x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, alpha: 0, duration: 600, onComplete: () => sp.destroy() });
          }
          const name = addText(this, x, y + 46, c.name, { font: 'px-o', ox: 0.5, color: rare ? PAL.gold : PAL.white });
          layer.add(name);
          Game.giveCard(c.id);
        },
      });
    });
    this.time.delayedCall(900 + picks.length * 380 + 900, () => {
      const hint = addText(this, GAME_W / 2, GAME_H - 30, 'Die Zauber liegen in deiner Hand – leg sie ins Buch! (Tippen/Bestätigen)', { font: 'px-o', ox: 0.5, color: PAL.cream });
      layer.add(hint);
      const done = () => {
        layer.destroy();
        this.busy = false;
        SaveSystem.autosave();
        this.render();
      };
      this.input.once('pointerdown', done);
      this.packDone = done;
    });
  }

  private packDone: (() => void) | null = null;

  private move(d: number): void {
    if (!this.rows.length) return;
    this.sel = (this.sel + d + this.rows.length) % this.rows.length;
    this.render();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Hud');
    this.scene.resume('World');
  }

  override update(_t: number, delta: number): void {
    if (this.msgT > 0) {
      this.msgT -= delta / 1000;
      if (this.msgT <= 0) this.msg.setText('');
    }
    if (this.busy) {
      if (this.packDone && (Input.confirm() || Input.cancel())) {
        const f = this.packDone;
        this.packDone = null;
        this.input.removeAllListeners('pointerdown');
        f();
      }
      return;
    }
    if (Input.nav('up')) this.move(-1);
    if (Input.nav('down')) this.move(1);
    if (Input.nav('left')) this.setMode('buy');
    if (Input.nav('right')) this.setMode('sell');
    if (Input.confirm()) this.act();
    if (Input.cancel() || Input.justPressed('book')) this.close();
  }
}
