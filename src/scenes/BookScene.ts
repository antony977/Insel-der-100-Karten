import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { Game } from '../systems/GameState';
import { card, cardIndex, cardLabel, SAMMELKARTEN } from '../data/cards';
import { RANK_STYLE, RANGE_LABEL, SPELL_CATEGORY_STYLE, type CardDef } from '../data/cardTypes';
import { COLLECTION_SLOTS, FREE_SLOTS, HAND_MAX, MOVE_MESSAGES, type Slot } from '../systems/cards/Book';
import { SLOT_LABELS, STAT_LABELS } from '../systems/cards/Inventory';
import { BOOK_H, BOOK_W, CARD_H, CARD_W } from '../gfx/generators/cardArt';
import { measureText, wrapText } from '../gfx/font/PixelFont';
import { formatPlayTime, SaveSystem } from '../systems/SaveSystem';
import type { EquipSlot, Stats } from '../data/cardTypes';
import { AFFINITY_BY_ID } from '../data/aura';
import { allQuests, questDef } from '../systems/Quests';
import { castSpell } from '../systems/Spells';
import type { WorldScene } from './WorldScene';

type Tab = 'sammel' | 'frei' | 'hand' | 'beutel' | 'status' | 'quests';

const TABS: { id: Tab; label: string; frame: number }[] = [
  { id: 'sammel', label: 'Sammlung', frame: 0 },
  { id: 'frei', label: 'Frei', frame: 1 },
  { id: 'hand', label: 'Hand', frame: 3 },
  { id: 'beutel', label: 'Beutel', frame: 2 },
  { id: 'status', label: 'Status', frame: 4 },
  { id: 'quests', label: 'Quests', frame: 5 },
];

const BUFF_NAMES: Record<string, string> = {
  laubschild: 'Laubschild',
  spiegelblatt: 'Spiegelblatt',
  tresor: 'Tresorsiegel',
  dornen: 'Dornenhülle',
  nebelmantel: 'Nebelmantel',
  bannkreis: 'Bannkreis',
  gegenlicht: 'Gegenlicht',
  anker: 'Ankerstein',
  gebannt: 'Buch versiegelt!',
  leuchtspur: 'Leuchtspur',
  zeitstopp: 'Zeitstopp',
  muenzglueck: 'Münzglück',
  klimaschutz: 'Klimaschutz',
  'aura-doppelt': 'Doppelte Aura-Regeneration',
};

const BX = Math.round((GAME_W - BOOK_W) / 2);
const BY = GAME_H - BOOK_H - 4;
const LEFT_X = BX + 10;
const RIGHT_X = BX + BOOK_W / 2 + 2;
const PAGE_W = BOOK_W / 2 - 12;
const PAGE_Y = BY + 8;
const SPINE_X = BX + BOOK_W / 2;
const GRID_COLS = 5;
const GRID_ROWS = 4;
const GAP_X = 9;
const GAP_Y = 5;
const GRID_X = LEFT_X + Math.round((PAGE_W - (GRID_COLS * CARD_W + (GRID_COLS - 1) * GAP_X)) / 2);
const GRID_Y = PAGE_Y + 18;
const PER_PAGE = GRID_COLS * GRID_ROWS;
const HAND_ROW_H = 64;
const LIST_ROWS = 10;
const LIST_ROW_H = 16;

const INK = PAL.bark;
const HEAD = PAL.crimson;

interface Button {
  label: string;
  run: () => void;
  enabled: boolean;
}

/**
 * Das Kartenbuch: Sammelseiten (100 Slots), freie Slots (45), Hand (Karten ausserhalb des
 * Buchs mit 60-s-Timer), Beutel (echte Gegenstände) und Status. Bedienung per Tastatur,
 * Gamepad, Maus (Drag & Drop) und Touch.
 */
export class BookScene extends BaseScene {
  private tab: Tab = 'sammel';
  private pages: Record<Tab, number> = { sammel: 0, frei: 0, hand: 0, beutel: 0, status: 0, quests: 0 };
  private sel = 0;
  private focus: 'grid' | 'buttons' = 'grid';
  private btnSel = 0;
  private moving: number | null = null;
  private busy = true;
  private closing = false;

  private root!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private tabSprites: Phaser.GameObjects.Image[] = [];
  private tabTexts: Phaser.GameObjects.BitmapText[] = [];
  private slotImgs: Phaser.GameObjects.Image[] = [];
  private selFrame!: Phaser.GameObjects.Image;
  private dropFrame!: Phaser.GameObjects.Image;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private buttonObjs: { panel: Phaser.GameObjects.NineSlice; text: Phaser.GameObjects.BitmapText; x: number; y: number; w: number }[] = [];
  private toast!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.BitmapText;
  private toastT = 0;
  private hint!: Phaser.GameObjects.BitmapText;
  private timerTexts: Phaser.GameObjects.BitmapText[] = [];
  private timerBars: Phaser.GameObjects.Rectangle[] = [];

  // Drag & Drop
  private press: { x: number; y: number; slot: number; uid: number } | null = null;
  private dragging: number | null = null;
  private ghost!: Phaser.GameObjects.Image;
  private hoverFlipT = 0;

  constructor() {
    super('Book');
  }

  init(data: { tab?: Tab }): void {
    if (data?.tab) this.tab = data.tab;
    else if (Game.book.hand.length > 0) this.tab = 'hand';
    this.sel = 0;
    this.focus = 'grid';
    this.moving = null;
    this.dragging = null;
    this.press = null;
    this.closing = false;
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.busy = true;
    this.slotImgs = [];
    this.tabSprites = [];
    this.tabTexts = [];
    this.dynamic = [];
    this.buttonObjs = [];
    this.timerTexts = [];
    this.timerBars = [];

    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.62).setOrigin(0, 0);
    this.root = this.add.container(0, 0);
    // Reiter (hinter dem Buch)
    TABS.forEach((t, i) => {
      const x = BX + 26 + i * 58;
      const img = this.add.image(x, BY - 16, 'book-tabs', t.frame).setOrigin(0, 0);
      const txt = addText(this, x + 26, BY - 14, t.label, { font: 'px-s', ox: 0.5, color: PAL.white });
      img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.switchTab(t.id));
      this.tabSprites.push(img);
      this.tabTexts.push(txt);
      this.root.add([img, txt]);
    });
    const book = this.add.image(BX, BY, 'book-open').setOrigin(0, 0);
    this.root.add(book);
    this.content = this.add.container(0, 0);
    this.root.add(this.content);

    // Slots (wiederverwendet)
    for (let i = 0; i < PER_PAGE; i++) {
      const img = this.add.image(0, 0, 'cards', 0).setOrigin(0, 0).setVisible(false);
      this.slotImgs.push(img);
      this.content.add(img);
      const bar = this.add.rectangle(0, 0, 26, 3, PAL.lime).setOrigin(0, 0).setVisible(false);
      const txt = addText(this, 0, 0, '', { font: 'px', ox: 0.5, color: INK }).setVisible(false);
      this.timerBars.push(bar);
      this.timerTexts.push(txt);
      this.content.add([bar, txt]);
    }
    this.selFrame = this.add.image(0, 0, 'card-extras', 2).setOrigin(0, 0);
    this.dropFrame = this.add.image(0, 0, 'card-extras', 3).setOrigin(0, 0).setVisible(false);
    this.content.add([this.selFrame, this.dropFrame]);

    // Schliessen-Knopf
    const closeBtn = addPanel(this, BX + BOOK_W - 24, BY - 18, 22, 18, 'ui-frame');
    const closeX = addText(this, BX + BOOK_W - 13, BY - 14, '×', { font: 'px-s', ox: 0.5 });
    closeBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    this.root.add([closeBtn, closeX]);

    this.hint = addText(this, GAME_W / 2, GAME_H - 1, '', { font: 'px-o', ox: 0.5, oy: 1, color: PAL.silver });
    this.toastText = addText(this, 0, 0, '', { font: 'px-s', ox: 0.5, oy: 0.5 });
    const toastPanel = addPanel(this, -100, -9, 200, 18, 'ui-frame');
    this.toast = this.add.container(RIGHT_X + PAGE_W / 2, PAGE_Y + 150, [toastPanel, this.toastText]).setVisible(false).setDepth(50);

    this.ghost = this.add.image(0, 0, 'cards', 0).setOrigin(0.5, 0.5).setVisible(false).setDepth(60).setAlpha(0.92);

    if (!this.anims.exists('fx-sparkle-book')) {
      this.anims.create({ key: 'fx-sparkle-book', frames: this.anims.generateFrameNumbers('fx-sparkle', { start: 0, end: 3 }), frameRate: 14, repeat: 0 });
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.flip(dy > 0 ? 1 : -1));

    const offs = [Game.events.on('book-changed', () => this.render())];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((o) => o()));

    this.render();
    this.playOpen();
  }

  // ------------------------------------------------------------ Animation

  private playOpen(): void {
    Sound.play('bookOpen');
    Sound.duck('book', true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Sound.duck('book', false));
    this.root.setVisible(false);
    const closed = this.add.image(GAME_W / 2, GAME_H / 2, 'book-closed').setScale(0.3).setDepth(40);
    const shout = addText(this, GAME_W / 2, GAME_H / 2 - 52, 'Aufgeschlagen!', { font: 'px-o', ox: 0.5, oy: 0.5, color: PAL.gold, scale: 2 })
      .setDepth(41)
      .setAlpha(0);
    this.tweens.add({ targets: shout, alpha: 1, y: shout.y - 6, duration: 160 });
    this.tweens.add({
      targets: closed,
      scale: 1,
      duration: 170,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: closed,
          scaleX: 0,
          duration: 90,
          delay: 60,
          onComplete: () => {
            closed.destroy();
            this.tweens.add({ targets: shout, alpha: 0, duration: 200, onComplete: () => shout.destroy() });
            this.root.setVisible(true);
            this.root.setScale(0.02, 1).setPosition(GAME_W / 2 * (1 - 0.02), 0);
            this.tweens.add({
              targets: this.root,
              scaleX: 1,
              x: 0,
              duration: 130,
              ease: 'Quad.Out',
              onComplete: () => {
                this.busy = false;
              },
            });
          },
        });
      },
    });
  }

  private close(after?: () => void): void {
    if (this.closing) return;
    this.closing = true;
    this.busy = true;
    Sound.play('bookClose');
    Sound.duck('book', false);
    this.tweens.add({
      targets: this.root,
      scaleX: 0.02,
      x: GAME_W / 2 * (1 - 0.02),
      duration: 110,
      ease: 'Quad.In',
      onComplete: () => {
        SaveSystem.autosave();
        this.scene.stop();
        this.scene.setVisible(true, 'Hud');
        this.scene.resume('Hud');
        this.scene.resume('World');
        if (after) this.scene.get('World').time.delayedCall(40, after);
      },
    });
  }

  /** Seitenumblättern mit Animation */
  private flip(dir: number): void {
    const max = this.pageCount() - 1;
    const next = Phaser.Math.Clamp(this.pages[this.tab] + dir, 0, max);
    if (next === this.pages[this.tab] || this.busy) return;
    this.busy = true;
    Sound.play('page', { vary: 0.08 });
    const page = this.add.image(SPINE_X, PAGE_Y, 'book-page').setOrigin(dir > 0 ? 0 : 1, 0).setDepth(30);
    this.tweens.add({
      targets: page,
      scaleX: 0,
      duration: 90,
      ease: 'Quad.In',
      onComplete: () => {
        this.pages[this.tab] = next;
        this.render();
        page.setOrigin(dir > 0 ? 1 : 0, 0).setScale(0, 1);
        this.tweens.add({
          targets: page,
          scaleX: 1,
          duration: 90,
          ease: 'Quad.Out',
          onComplete: () => {
            page.destroy();
            this.busy = false;
          },
        });
      },
    });
  }

  private switchTab(t: Tab): void {
    if (this.busy || this.tab === t) return;
    Sound.play('page', { rate: 1.25 });
    this.tab = t;
    this.sel = 0;
    this.focus = 'grid';
    this.render();
  }

  // ------------------------------------------------------------ Daten

  private pageCount(): number {
    switch (this.tab) {
      case 'sammel':
        return Math.ceil(COLLECTION_SLOTS / PER_PAGE);
      case 'frei':
        return Math.ceil(FREE_SLOTS / PER_PAGE);
      case 'beutel':
        return Math.max(1, Math.ceil(this.bagEntries().length / LIST_ROWS));
      case 'quests':
        return Math.max(1, Math.ceil(this.questList().length / LIST_ROWS));
      default:
        return 1;
    }
  }

  private questList(): string[] {
    const all = allQuests().filter((q) => Game.quests.stage(q.id) > 0);
    const active = all.filter((q) => !Game.quests.done(q.id)).map((q) => q.id);
    const done = all.filter((q) => Game.quests.done(q.id)).map((q) => q.id);
    return [...active, ...done];
  }

  /** Anzahl auswählbarer Einträge auf der aktuellen Seite */
  private itemCount(): number {
    const p = this.pages[this.tab];
    switch (this.tab) {
      case 'sammel':
        return Math.min(PER_PAGE, COLLECTION_SLOTS - p * PER_PAGE);
      case 'frei':
        return Math.min(PER_PAGE, FREE_SLOTS - p * PER_PAGE);
      case 'hand':
        return Math.max(1, Game.book.hand.length);
      case 'beutel':
        return Math.max(1, Math.min(LIST_ROWS, this.bagEntries().length - p * LIST_ROWS));
      case 'quests':
        return Math.max(1, Math.min(LIST_ROWS, this.questList().length - p * LIST_ROWS));
      default:
        return 1;
    }
  }

  private slotFor(i: number): Slot | null {
    const p = this.pages[this.tab];
    if (this.tab === 'sammel') return { area: 'sammel', index: p * PER_PAGE + i };
    if (this.tab === 'frei') return { area: 'frei', index: p * PER_PAGE + i };
    if (this.tab === 'hand') return { area: 'hand', index: i };
    return null;
  }

  private uidAt(i: number): number | null {
    const s = this.slotFor(i);
    return s ? Game.book.at(s) : null;
  }

  private bagEntries(): { id: string; count: number; equipped: boolean }[] {
    const inv = Game.inv;
    const list: { id: string; count: number; equipped: boolean }[] = [];
    for (const id of Object.values(inv.equip)) if (id) list.push({ id, count: 1, equipped: true });
    for (const [id, count] of inv.bag) list.push({ id, count, equipped: false });
    return list;
  }

  private cellPos(i: number): { x: number; y: number } {
    if (this.tab === 'hand') {
      return { x: GRID_X + (i % GRID_COLS) * (CARD_W + GAP_X), y: GRID_Y + Math.floor(i / GRID_COLS) * HAND_ROW_H };
    }
    return { x: GRID_X + (i % GRID_COLS) * (CARD_W + GAP_X), y: GRID_Y + Math.floor(i / GRID_COLS) * (CARD_H + GAP_Y) };
  }

  // ------------------------------------------------------------ Darstellung

  private clearDynamic(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    for (const b of this.buttonObjs) {
      b.panel.destroy();
      b.text.destroy();
    }
    this.buttonObjs = [];
  }

  private text(x: number, y: number, s: string, color: number = INK, o: { ox?: number; maxWidth?: number; font?: 'px' | 'px-s' | 'px-o' } = {}): Phaser.GameObjects.BitmapText {
    const t = addText(this, x, y, o.maxWidth ? wrapText(s, o.maxWidth).join('\n') : s, { font: o.font ?? 'px', color, ox: o.ox ?? 0 });
    t.setLineSpacing(-1);
    this.content.add(t);
    this.dynamic.push(t);
    return t;
  }

  private render(): void {
    if (!this.content) return;
    this.clearDynamic();
    // Reiter hervorheben
    TABS.forEach((t, i) => {
      const active = t.id === this.tab;
      this.tabSprites[i].setY(active ? BY - 18 : BY - 15).setAlpha(active ? 1 : 0.85);
      this.tabTexts[i].setY(active ? BY - 16 : BY - 13);
      this.tabTexts[i].setText(t.id === 'hand' && Game.book.hand.length ? `Hand ${Game.book.hand.length}` : t.label);
    });
    this.sel = Phaser.Math.Clamp(this.sel, 0, this.itemCount() - 1);
    for (let i = 0; i < PER_PAGE; i++) {
      this.slotImgs[i].setVisible(false);
      this.timerBars[i].setVisible(false);
      this.timerTexts[i].setVisible(false);
    }
    this.selFrame.setVisible(false);
    if (this.tab === 'sammel' || this.tab === 'frei' || this.tab === 'hand') this.renderGrid();
    else if (this.tab === 'beutel') this.renderBag();
    else if (this.tab === 'quests') this.renderQuests();
    else this.renderStatus();
    this.renderButtons();
    this.updateHint();
  }

  private renderGrid(): void {
    const p = this.pages[this.tab];
    const book = Game.book;
    // Kopfzeile
    if (this.tab === 'sammel') {
      const from = p * PER_PAGE;
      this.text(LEFT_X + 8, PAGE_Y + 4, `Sammelseiten ${String(from).padStart(3, '0')}–${String(from + PER_PAGE - 1).padStart(3, '0')}`, HEAD);
      this.text(LEFT_X + PAGE_W - 8, PAGE_Y + 4, `${book.collectedCount()}/100`, INK, { ox: 1 });
    } else if (this.tab === 'frei') {
      const from = p * PER_PAGE + 1;
      this.text(LEFT_X + 8, PAGE_Y + 4, `Freie Slots ${from}–${Math.min(FREE_SLOTS, from + PER_PAGE - 1)}`, HEAD);
      this.text(LEFT_X + PAGE_W - 8, PAGE_Y + 4, `${book.freeUsed()}/${FREE_SLOTS}`, INK, { ox: 1 });
    } else {
      this.text(LEFT_X + 8, PAGE_Y + 4, 'Hand – ausserhalb des Buchs', HEAD);
      this.text(LEFT_X + PAGE_W - 8, PAGE_Y + 4, `${book.hand.length}/${HAND_MAX}`, INK, { ox: 1 });
    }
    const count = this.tab === 'hand' ? book.hand.length : this.itemCount();
    for (let i = 0; i < count; i++) {
      const slot = this.slotFor(i)!;
      const uid = book.at(slot);
      const pos = this.cellPos(i);
      const img = this.slotImgs[i];
      img.setPosition(pos.x, pos.y).setVisible(true).setAlpha(1).clearTint();
      if (uid !== null && uid !== this.dragging && uid !== this.moving) {
        img.setTexture('cards', cardIndex(book.def(uid).id));
      } else if (slot.area === 'sammel') {
        img.setTexture('cards-sil', slot.index);
        if (uid !== null) img.setAlpha(0.4);
      } else {
        img.setTexture('card-extras', 0);
      }
      if (this.tab === 'hand') {
        const h = book.hand[i];
        const frac = Math.max(0, h.timeLeft / 60);
        const bar = this.timerBars[i];
        bar.setPosition(pos.x + 2, pos.y + CARD_H + 2).setVisible(true);
        bar.width = Math.max(1, Math.round(26 * frac));
        bar.fillColor = h.timeLeft < 10 ? PAL.red : h.timeLeft < 25 ? PAL.orange : PAL.leaf;
        const t = this.timerTexts[i];
        t.setPosition(pos.x + CARD_W / 2, pos.y + CARD_H + 6).setText(`${Math.ceil(h.timeLeft)} s`).setVisible(true);
      }
    }
    if (this.tab === 'hand' && book.hand.length === 0) {
      this.text(LEFT_X + 12, GRID_Y + 10, 'Keine Karten in der Hand.\n\nNeue Karten landen zuerst hier\nund müssen innerhalb von 60 Sekunden\nins Buch gelegt werden – sonst\nverwandeln sie sich dauerhaft in\nihren Gegenstand.', INK);
    } else if (this.tab === 'hand') {
      this.text(LEFT_X + 8, GRID_Y + HAND_ROW_H * 2 + 6, 'Lege Karten ins Buch, bevor\nihre Zeit abläuft!', HEAD);
    }
    // Auswahl
    if (count > 0) {
      const pos = this.cellPos(this.sel);
      this.selFrame.setPosition(pos.x, pos.y).setVisible(true);
    }
    // Seitenfuss
    if (this.pageCount() > 1) this.renderPager();
    this.renderDetails(count > 0 ? this.slotFor(this.sel) : null);
  }

  private renderPager(): void {
    const p = this.pages[this.tab];
    const y = PAGE_Y + 206;
    const left = this.text(LEFT_X + 8, y, '◀', p > 0 ? HEAD : PAL.sand);
    const right = this.text(LEFT_X + PAGE_W - 8, y, '▶', p < this.pageCount() - 1 ? HEAD : PAL.sand, { ox: 1 });
    this.text(LEFT_X + PAGE_W / 2, y, `Seite ${p + 1}/${this.pageCount()}`, INK, { ox: 0.5 });
    left.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.flip(-1));
    right.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.flip(1));
  }

  private renderDetails(slot: Slot | null): void {
    const x = RIGHT_X + 8;
    const y = PAGE_Y + 6;
    if (!slot) {
      this.buttons = [];
      return;
    }
    const uid = Game.book.at(slot);
    let c: CardDef | null = uid !== null ? Game.book.def(uid) : null;
    const known = c !== null;
    if (!c && slot.area === 'sammel') c = SAMMELKARTEN[slot.index];
    if (!c) {
      this.text(x, y + 4, 'Freier Slot', HEAD);
      this.text(x, y + 20, 'Hier passt jede Karte hinein:\nZauber, Doppelte und\nGegenstandskarten.', INK);
      this.buttons = [];
      return;
    }
    const seen = known || Game.discovered.has(c.id);
    const big = this.add.image(x, y, known ? 'cards' : 'cards-sil', known ? cardIndex(c.id) : c.no).setOrigin(0, 0).setScale(2);
    this.content.add(big);
    this.dynamic.push(big);
    const tx = x + CARD_W * 2 + 8;
    const tw = PAGE_W - CARD_W * 2 - 22;
    const name = this.text(tx, y + 2, seen ? c.name : '???', HEAD, { maxWidth: tw });
    let ly = y + 2 + name.height + 4;
    const rs = RANK_STYLE[c.rank];
    const lines = [`${cardLabel(c)} · Rang ${rs.label}`, `Typ: ${c.type}`, `Limit: ${c.limit} · im Umlauf: ${Game.registry.count(c.id)}`];
    if (c.spell) lines.push(SPELL_CATEGORY_STYLE[c.spell.category].name, `Reichweite: ${RANGE_LABEL[c.spell.range]}`);
    for (const l of lines) {
      const t = this.text(tx, ly, l, INK, { maxWidth: tw });
      ly += t.height + 1;
    }
    if (Game.registry.remaining(c.id) === 0 && !known) this.text(tx, ly + 2, 'Limit erreicht!', PAL.red);
    // Aktionen
    this.buttons = [];
    const book = Game.book;
    const isSpell = c.kind === 'zauber';
    if (uid !== null) {
      if (slot.area === 'hand') {
        this.buttons.push({ label: 'Einordnen', run: () => this.doFile(uid), enabled: true });
        this.buttons.push({ label: 'Alle', run: () => this.doFileAll(), enabled: book.hand.length > 1 });
      } else if (slot.area === 'frei' && c.kind === 'sammel' && book.sammel[c.no] === null) {
        this.buttons.push({ label: 'Einordnen', run: () => this.doFile(uid), enabled: true });
      }
      if (isSpell) {
        const q = Game.quick.indexOf(uid);
        this.buttons.push({ label: 'Wirken', run: () => this.castNow(uid), enabled: slot.area === 'frei' });
        if (slot.area === 'frei') this.buttons.push({ label: q >= 0 ? `Taste ${q + 1}` : 'Auf Taste', run: () => this.cycleQuick(uid), enabled: true });
      } else this.buttons.push({ label: 'Entfessle!', run: () => this.doUnleash(uid), enabled: true });
      if (slot.area === 'hand') {
        this.buttons.push({ label: 'Ablegen', run: () => this.doDrop(uid), enabled: true });
      } else {
        this.buttons.push({ label: 'Verschieben', run: () => this.startMove(uid), enabled: true });
        this.buttons.push({ label: 'Heraus', run: () => this.doTakeOut(uid), enabled: true });
      }
    }
    // Textblock
    let by = y + CARD_H * 2 + 6;
    const maxY = PAGE_Y + 196 - this.buttonRowCount() * 21;
    const block = (label: string, body: string, color: number) => {
      if (by > maxY - 12) return;
      const lt = this.text(x, by, label, HEAD);
      by += lt.height - 1;
      const wrapped = wrapText(body, PAGE_W - 16);
      const room = Math.max(1, Math.floor((maxY - by) / 11));
      const shown = wrapped.slice(0, room);
      if (wrapped.length > room) shown[room - 1] = `${shown[room - 1].replace(/.{0,2}$/, '')}…`;
      const t = this.text(x, by, shown.join('\n'), color);
      by += t.height + 2;
    };
    if (seen) {
      block('Wirkung', c.effect, INK);
      block('So bekommst du sie', c.hint, PAL.wood);
    } else {
      block('Noch nicht gefunden', c.hint, PAL.wood);
    }
  }

  private renderBag(): void {
    const entries = this.bagEntries();
    const p = this.pages.beutel;
    this.text(LEFT_X + 8, PAGE_Y + 4, 'Beutel', HEAD);
    this.text(LEFT_X + PAGE_W - 8, PAGE_Y + 4, `${Game.inv.money} Münzen`, INK, { ox: 1 });
    const shown = entries.slice(p * LIST_ROWS, p * LIST_ROWS + LIST_ROWS);
    if (shown.length === 0) {
      this.text(LEFT_X + 12, GRID_Y + 10, 'Der Beutel ist leer.\n\nEntfessle Karten, um sie in\nechte Gegenstände zu verwandeln.', INK);
      this.buttons = [];
    }
    shown.forEach((e, i) => {
      const y = GRID_Y + i * LIST_ROW_H;
      if (i === this.sel) {
        const hl = this.add.rectangle(LEFT_X + 6, y - 1, PAGE_W - 12, LIST_ROW_H, PAL.sand).setOrigin(0, 0);
        this.content.add(hl);
        this.dynamic.push(hl);
      }
      const ic = this.add.image(LEFT_X + 10, y - 1, 'card-icons', cardIndex(e.id)).setOrigin(0, 0);
      this.content.add(ic);
      this.dynamic.push(ic);
      this.text(LEFT_X + 30, y + 3, card(e.id).name, INK);
      this.text(LEFT_X + PAGE_W - 10, y + 3, e.equipped ? 'angelegt' : `×${e.count}`, e.equipped ? PAL.leaf : INK, { ox: 1 });
      const zone = this.add.zone(LEFT_X + 6, y - 1, PAGE_W - 12, LIST_ROW_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.sel = i;
        this.focus = 'grid';
        this.render();
      });
      this.content.add(zone);
      this.dynamic.push(zone);
    });
    if (this.pageCount() > 1) this.renderPager();
    // Details rechts
    const e = shown[this.sel];
    this.buttons = [];
    if (!e) return;
    const c = card(e.id);
    const x = RIGHT_X + 8;
    const y = PAGE_Y + 6;
    const ic = this.add.image(x, y, 'card-icons', cardIndex(c.id)).setOrigin(0, 0).setScale(3);
    this.content.add(ic);
    this.dynamic.push(ic);
    const name = this.text(x + 56, y + 4, c.name, HEAD, { maxWidth: PAGE_W - 72 });
    this.text(x + 56, y + 8 + name.height, `Gegenstand aus ${cardLabel(c)}`, INK);
    this.text(x, y + 56, 'Wirkung', HEAD);
    this.text(x, y + 68, c.effect, INK, { maxWidth: PAGE_W - 16 });
    const u = c.unleash;
    if (u.kind === 'equip') {
      this.text(x, y + 120, `Platz: ${SLOT_LABELS[u.slot]}`, INK);
      this.buttons.push({ label: e.equipped ? 'Ablegen' : 'Ausrüsten', run: () => this.doUse(c.id), enabled: true });
    } else {
      const usable = ['heal', 'aura', 'restore', 'buff', 'companion', 'throw'].includes(u.kind);
      this.buttons.push({ label: 'Benutzen', run: () => this.doUse(c.id), enabled: usable });
    }
  }

  private renderStatus(): void {
    const inv = Game.inv;
    const st = inv.stats();
    const x = LEFT_X + 10;
    let y = PAGE_Y + 4;
    const pr = Game.prog;
    const aff = AFFINITY_BY_ID[pr.affinity];
    this.text(x - 2, y, `${Game.player.name} · Stufe ${pr.level}`, HEAD);
    y += 12;
    this.text(x - 2, y, `${aff.name}-Aura · Technik: ${pr.techName}`, PAL.wood, { maxWidth: PAGE_W - 16 });
    y += 13;
    this.text(x - 2, y, `Erfahrung ${pr.xp} / ${pr.xpNext}`, INK);
    y += 13;
    const rows: [string, string][] = [
      ['LP', `${Math.round(inv.lp)} / ${st.lp}`],
      ['Aura', `${Math.round(inv.aura)} / ${st.aura}`],
    ];
    for (const k of ['str', 'spd', 'ctrl', 'def', 'luck', 'regen', 'dodge'] as (keyof Stats)[]) {
      const v = Math.round(st[k] * 10) / 10;
      rows.push([STAT_LABELS[k], k === 'dodge' ? `+${v} %` : String(Number.isInteger(v) ? v : v.toFixed(1))]);
    }
    rows.push(['Münzen', String(inv.money)], ['Casino-Chips', String(inv.chips)]);
    rows.push(['Sammelkarten', `${Game.book.collectedCount()} / 100`], ['Spielzeit', formatPlayTime(Game.playTime)]);
    for (const [k, v] of rows) {
      this.text(x, y, k, INK);
      this.text(LEFT_X + PAGE_W - 12, y, v, HEAD, { ox: 1 });
      y += 13;
    }
    // Rechte Seite: Ausrüstung, Werkzeuge, Effekte
    const rx = RIGHT_X + 8;
    let ry = PAGE_Y + 4;
    this.text(rx, ry, 'Ausrüstung', HEAD);
    ry += 14;
    for (const slot of ['kopf', 'koerper', 'fuesse', 'schmuck'] as EquipSlot[]) {
      const id = inv.equip[slot];
      this.text(rx, ry, `${SLOT_LABELS[slot]}:`, INK);
      this.text(rx + 56, ry, id ? card(id).name : '–', id ? PAL.leaf : PAL.sandShade);
      ry += 12;
    }
    ry += 6;
    this.text(rx, ry, 'Werkzeuge & Schlüssel', HEAD);
    ry += 14;
    const owned = [...inv.tools, ...inv.keys];
    const names = owned.map((t) => toolName(t));
    const list = names.length ? names.join(', ') : 'Noch nichts – entfessle Werkzeug- und Schlüsselkarten.';
    const t = this.text(rx, ry, list, INK, { maxWidth: PAGE_W - 16 });
    ry += t.height + 8;
    if (inv.buffs.size) {
      this.text(rx, ry, 'Aktive Effekte', HEAD);
      ry += 14;
      for (const [b, s] of inv.buffs) {
        this.text(rx, ry, s > 1e6 ? `${BUFF_NAMES[b] ?? b} (aktiv)` : `${BUFF_NAMES[b] ?? b}: ${Math.ceil(s)} s`, INK);
        ry += 12;
      }
      ry += 4;
    }
    const qs = Game.quick.map((u, i) => `${i + 1}: ${u !== null && Game.book.locate(u) ? card(Game.registry.idOf(u)).name : '–'}`);
    if (ry < PAGE_Y + 160) {
      this.text(rx, ry, 'Schnellzauber', HEAD);
      ry += 13;
      this.text(rx, ry, qs.join('\n'), INK);
    }
    this.buttons = [
      { label: 'Speichern', run: () => this.flash(SaveSystem.autosave() ? 'Automatisch gespeichert.' : 'Speichern fehlgeschlagen.'), enabled: true },
    ];
  }

  private buttonRowCount(): number {
    if (!this.buttons.length) return 0;
    const maxW = PAGE_W - 12;
    let rows = 1;
    let rowW = 0;
    for (const b of this.buttons) {
      const w = measureText(b.label) + 12;
      if (rowW && rowW + 3 + w > maxW) {
        rows++;
        rowW = 0;
      }
      rowW += (rowW ? 3 : 0) + w;
    }
    return rows;
  }

  private renderButtons(): void {
    const n = this.buttons.length;
    if (n === 0) {
      this.focus = 'grid';
      return;
    }
    this.btnSel = Phaser.Math.Clamp(this.btnSel, 0, n - 1);
    const gap = 3;
    const maxW = PAGE_W - 12;
    const widths = this.buttons.map((b) => measureText(b.label) + 12);
    // Reihen bilden (von unten nach oben)
    const rows: number[][] = [[]];
    let rowW = 0;
    widths.forEach((w, i) => {
      if (rows[rows.length - 1].length && rowW + gap + w > maxW) {
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push(i);
      rowW += (rowW ? gap : 0) + w;
    });
    rows.forEach((row, ri) => {
      const y = PAGE_Y + 200 - (rows.length - 1 - ri) * 21;
      const used = row.reduce((a, i) => a + widths[i], 0) + gap * (row.length - 1);
      // Restbreite gleichmässig verteilen
      const extra = Math.floor((maxW - used) / row.length);
      let x = RIGHT_X + 6;
      for (const i of row) {
        const b = this.buttons[i];
        const w = widths[i] + extra;
        const focused = this.focus === 'buttons' && i === this.btnSel;
        const panel = addPanel(this, x, y, w, 18, focused ? 'ui-frame-gold' : 'ui-frame');
        const text = addText(this, x + w / 2, y + 3, b.label, { font: 'px-s', ox: 0.5, color: b.enabled ? (focused ? PAL.cream : PAL.white) : PAL.stone });
        panel.setInteractive({ useHandCursor: b.enabled }).on('pointerdown', () => {
          if (!b.enabled || this.busy) return;
          Sound.play('select');
          b.run();
        });
        this.content.add([panel, text]);
        this.buttonObjs.push({ panel, text, x, y, w });
        x += w + gap;
      }
    });
  }

  private updateHint(): void {
    if (this.moving !== null) {
      this.hint.setText('Ziel wählen und bestätigen · Abbrechen: zurück');
      return;
    }
    const touch = Input.source === 'touch';
    if (touch) this.hint.setText('Antippen: auswählen · Ziehen: Karte verschieben');
    else if (Input.source === 'gamepad') this.hint.setText('LB/RB Register · A Auswählen · B Schliessen');
    else this.hint.setText('1/2 Register · Pfeile Auswahl · Leertaste Aktion · Esc/B Schliessen · Ziehen mit der Maus');
  }

  // ------------------------------------------------------------ Aktionen

  private flash(msg: string): void {
    if (!msg) return;
    const lines = wrapText(msg, PAGE_W - 24);
    this.toastText.setText(lines.join('\n')).setCenterAlign();
    const w = Math.min(PAGE_W, this.toastText.width + 20);
    const h = lines.length * 12 + 8;
    (this.toast.list[0] as Phaser.GameObjects.NineSlice).setSize(w, h).setPosition(-w / 2, -h / 2);
    this.toast.setVisible(true).setAlpha(1);
    this.toastT = 2.2;
  }

  private doFile(uid: number): void {
    const r = Game.book.file(uid);
    if (r !== 'ok') this.flash(MOVE_MESSAGES[r]);
    else this.flash(`${Game.book.def(uid).name} eingeordnet.`);
    Game.events.emit('book-changed');
  }

  private doFileAll(): void {
    const n = Game.book.fileAll();
    this.flash(n > 0 ? `${n} Karte${n === 1 ? '' : 'n'} eingeordnet.` : MOVE_MESSAGES.voll);
    Game.events.emit('book-changed');
  }

  private doTakeOut(uid: number): void {
    const r = Game.book.takeOut(uid);
    this.flash(r === 'ok' ? 'In der Hand – 60 Sekunden bis zur Verwandlung!' : MOVE_MESSAGES[r]);
    Game.events.emit('book-changed');
  }

  private castNow(uid: number): void {
    this.close(() => {
      const w = this.scene.get('World') as unknown as WorldScene;
      const r = castSpell(uid, w.spellHost());
      if (r) w.toast(r);
    });
  }

  private cycleQuick(uid: number): void {
    const cur = Game.quick.indexOf(uid);
    if (cur >= 0) Game.quick[cur] = null;
    const next = cur + 1;
    if (next <= 2) {
      Game.quick[next] = uid;
      this.flash(`Auf Schnelltaste ${next + 1} gelegt.`);
    } else this.flash('Von den Schnelltasten entfernt.');
    Game.events.emit('book-changed');
    this.render();
  }

  private renderQuests(): void {
    const list = this.questList();
    const p = this.pages.quests;
    this.text(LEFT_X + 8, PAGE_Y + 4, 'Quest-Log', HEAD);
    const shown = list.slice(p * LIST_ROWS, p * LIST_ROWS + LIST_ROWS);
    if (!shown.length) {
      this.text(LEFT_X + 8, PAGE_Y + 24, 'Noch keine Aufträge. Sprich mit den Leuten auf der Insel!', INK, { maxWidth: PAGE_W - 16 });
      this.buttons = [];
      return;
    }
    shown.forEach((id, i) => {
      const q = questDef(id)!;
      const y = PAGE_Y + 22 + i * LIST_ROW_H;
      const done = Game.quests.done(id);
      if (i === this.sel) {
        const hl = this.add.rectangle(LEFT_X + 4, y - 2, PAGE_W - 8, LIST_ROW_H, PAL.gold, 0.35).setOrigin(0, 0);
        this.content.add(hl);
        this.dynamic.push(hl);
      }
      this.text(LEFT_X + 8, y + 1, `${done ? '✓ ' : ''}${q.name}`, done ? PAL.sandShade : INK);
      const z = this.add.zone(LEFT_X + 4, y - 2, PAGE_W - 8, LIST_ROW_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        this.sel = i;
        this.render();
      });
      this.content.add(z);
      this.dynamic.push(z);
    });
    const id = shown[Math.min(this.sel, shown.length - 1)];
    const q = questDef(id)!;
    const rx = RIGHT_X + 8;
    let ry = PAGE_Y + 6;
    const t1 = this.text(rx, ry, q.name, HEAD, { maxWidth: PAGE_W - 16 });
    ry += t1.height + 4;
    this.text(rx, ry, q.where, PAL.wood);
    ry += 16;
    const stage = Game.quests.stage(id);
    // lange Quests: ältere Schritte zusammenfassen, damit die Seite nicht überläuft
    const first = Math.max(0, Math.min(stage, q.steps.length) - 3);
    if (first > 0) {
      this.text(rx, ry, `✓ … ${first} ${first === 1 ? 'früherer Schritt' : 'frühere Schritte'}`, PAL.sandShade);
      ry += 14;
    }
    q.steps.forEach((step, i) => {
      if (i >= stage || i < first) return;
      const cur = i === stage - 1 && !Game.quests.done(id);
      const t = this.text(rx, ry, `${cur ? '▶ ' : '✓ '}${step}`, cur ? INK : PAL.sandShade, { maxWidth: PAGE_W - 16 });
      ry += t.height + 5;
    });
    if (Game.quests.done(id)) this.text(rx, ry + 4, 'Abgeschlossen!', PAL.leaf);
    this.buttons = [];
  }

  private doDrop(uid: number): void {
    Game.dropCard(uid, Game.player.x, Game.player.y + 8);
    this.flash('Karte auf den Boden gelegt.');
  }

  private doUse(id: string): void {
    const r = Game.inv.use(id);
    this.flash(r.message);
    if (r.action) Game.events.emit('item-action', r.action);
    Game.events.emit('vitals-changed');
    this.render();
  }

  private startMove(uid: number): void {
    Sound.play('select');
    this.moving = uid;
    this.focus = 'grid';
    this.render();
  }

  private finishMove(i: number): void {
    const uid = this.moving;
    this.moving = null;
    const slot = this.slotFor(i);
    if (uid === null || !slot) return this.render();
    const r = Game.book.move(uid, slot);
    Sound.play(r === 'ok' ? 'place' : 'error');
    if (r !== 'ok') this.flash(MOVE_MESSAGES[r]);
    Game.events.emit('book-changed');
    this.render();
  }

  private doUnleash(uid: number): void {
    const c = Game.book.def(uid);
    const big = this.add.image(RIGHT_X + 8 + CARD_W, PAGE_Y + 6 + CARD_H, 'cards', cardIndex(c.id)).setScale(2).setDepth(45);
    Sound.play('special');
    const shout = addText(this, RIGHT_X + PAGE_W / 2, PAGE_Y + 40, 'Entfessle!', { font: 'px-o', ox: 0.5, oy: 0.5, color: PAL.gold, scale: 2 }).setDepth(46);
    shout.setScale(0.5);
    this.busy = true;
    this.tweens.add({ targets: shout, scale: 1, duration: 160, ease: 'Back.Out' });
    big.setTintFill(PAL.white);
    this.tweens.add({
      targets: big,
      scale: 2.4,
      duration: 180,
      yoyo: true,
      onComplete: () => {
        // in Funken zerfallen
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const s = this.add.sprite(big.x, big.y, 'fx-sparkle', 0).setDepth(47).setTint(k % 2 ? PAL.gold : PAL.cream);
          s.play('fx-sparkle-book');
          this.tweens.add({ targets: s, x: big.x + Math.cos(a) * 40, y: big.y + Math.sin(a) * 34, alpha: 0, duration: 420, onComplete: () => s.destroy() });
        }
        big.destroy();
        const msg = Game.unleash(uid);
        this.tweens.add({ targets: shout, alpha: 0, duration: 300, delay: 300, onComplete: () => shout.destroy() });
        this.flash(msg ?? '');
        this.busy = false;
        this.render();
      },
    });
  }

  // ------------------------------------------------------------ Zeiger / Drag & Drop

  private worldPoint(p: Phaser.Input.Pointer): { x: number; y: number } {
    const v = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: v.x, y: v.y };
  }

  /** Index der Kartenzelle unter dem Punkt (aktuelle Seite) */
  private cellAt(x: number, y: number): number {
    if (this.tab === 'beutel' || this.tab === 'status') return -1;
    const n = this.tab === 'hand' ? HAND_MAX : this.itemCount();
    for (let i = 0; i < n; i++) {
      const pos = this.cellPos(i);
      if (x >= pos.x && x < pos.x + CARD_W && y >= pos.y && y < pos.y + CARD_H) return i;
    }
    return -1;
  }

  private tabAt(x: number, y: number): Tab | null {
    if (y < BY - 19 || y > BY + 1) return null;
    for (let i = 0; i < TABS.length; i++) {
      const tx = BX + 26 + i * 58;
      if (x >= tx && x < tx + 52) return TABS[i].id;
    }
    return null;
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.busy) return;
    const { x, y } = this.worldPoint(p);
    const i = this.cellAt(x, y);
    if (i < 0) return;
    if (this.moving !== null) {
      this.finishMove(i);
      return;
    }
    if (this.tab === 'hand' && i >= Game.book.hand.length) return;
    this.sel = i;
    this.focus = 'grid';
    const uid = this.uidAt(i);
    this.press = uid !== null ? { x, y, slot: i, uid } : null;
    this.render();
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!p.isDown) return;
    const { x, y } = this.worldPoint(p);
    if (this.press && this.dragging === null && Math.hypot(x - this.press.x, y - this.press.y) > 4) {
      this.dragging = this.press.uid;
      this.ghost.setTexture('cards', cardIndex(Game.book.def(this.dragging).id)).setVisible(true);
      this.render();
    }
    if (this.dragging !== null) {
      this.ghost.setPosition(Math.round(x), Math.round(y));
      const i = this.cellAt(x, y);
      if (i >= 0) {
        const pos = this.cellPos(i);
        const slot = this.slotFor(i)!;
        const ok = Game.book.accepts(slot, this.dragging);
        this.dropFrame.setPosition(pos.x, pos.y).setVisible(true).setTint(ok ? 0xffffff : PAL.red);
      } else this.dropFrame.setVisible(false);
      // Über dem Seitenrand verweilen → umblättern
      const nearLeft = x < LEFT_X + 6;
      const nearRight = x > RIGHT_X + PAGE_W - 6;
      if (nearLeft || nearRight) {
        this.hoverFlipT += this.game.loop.delta / 1000;
        if (this.hoverFlipT > 0.5) {
          this.hoverFlipT = 0;
          this.flip(nearLeft ? -1 : 1);
        }
      } else this.hoverFlipT = 0;
      // Reiter wechseln beim Darüberziehen
      const t = this.tabAt(x, y);
      if (t && t !== this.tab && (t === 'sammel' || t === 'frei' || t === 'hand')) this.switchTab(t);
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    const { x, y } = this.worldPoint(p);
    if (this.dragging !== null) {
      const uid = this.dragging;
      this.dragging = null;
      this.ghost.setVisible(false);
      this.dropFrame.setVisible(false);
      const i = this.cellAt(x, y);
      const t = this.tabAt(x, y);
      let r: string = 'ok';
      if (i >= 0) r = Game.book.move(uid, this.slotFor(i)!);
      else if (t === 'hand') r = Game.book.takeOut(uid);
      else if (t === 'sammel' || t === 'frei') r = Game.book.file(uid);
      Sound.play(r === 'ok' ? 'place' : 'error');
      if (r !== 'ok') this.flash(MOVE_MESSAGES[r as keyof typeof MOVE_MESSAGES]);
      Game.events.emit('book-changed');
      this.render();
    }
    this.press = null;
  }

  // ------------------------------------------------------------ Tastatur / Gamepad

  override update(_t: number, delta: number): void {
    const dt = delta / 1000;
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT < 0.4) this.toast.setAlpha(Math.max(0, this.toastT / 0.4));
      if (this.toastT <= 0) this.toast.setVisible(false);
    }
    // Hand-Timer laufen im Buch nicht weiter (Welt pausiert) – Anzeige trotzdem aktuell halten
    if (this.busy || this.closing) return;
    if (Input.justPressed('book') || (Input.cancel() && this.focus === 'grid' && this.moving === null)) {
      this.close();
      return;
    }
    if (Input.justPressed('spell1') || Input.justPressed('aura')) this.cycleTab(-1);
    if (Input.justPressed('spell2') || Input.keyPressed('Tab')) this.cycleTab(1);

    if (this.focus === 'buttons') {
      if (Input.nav('left')) this.btnSel = Math.max(0, this.btnSel - 1);
      if (Input.nav('right')) this.btnSel = Math.min(this.buttons.length - 1, this.btnSel + 1);
      if (Input.nav('left') || Input.nav('right')) {
        Sound.play('move');
        this.render();
      }
      if (Input.cancel() || Input.nav('up')) {
        this.focus = 'grid';
        this.render();
      } else if (Input.confirm()) {
        const b = this.buttons[this.btnSel];
        if (b?.enabled) {
          this.focus = 'grid';
          Sound.play('select');
          b.run();
          this.render();
        }
      }
      return;
    }
    if (this.moving !== null && Input.cancel()) {
      this.moving = null;
      this.render();
      return;
    }
    const isList = this.tab === 'beutel';
    const cols = isList ? 1 : GRID_COLS;
    const n = this.itemCount();
    let moved = false;
    if (Input.nav('left')) {
      if (isList || this.sel % cols === 0) this.flipKeyboard(-1);
      else this.sel--;
      moved = true;
    }
    if (Input.nav('right')) {
      if (isList || this.sel % cols === cols - 1 || this.sel === n - 1) this.flipKeyboard(1);
      else this.sel++;
      moved = true;
    }
    if (Input.nav('up')) {
      if (this.sel - cols >= 0) this.sel -= cols;
      moved = true;
    }
    if (Input.nav('down')) {
      if (this.sel + cols < n) this.sel += cols;
      else if (this.buttons.length && this.moving === null) {
        this.focus = 'buttons';
        this.btnSel = 0;
      }
      moved = true;
    }
    if (moved) {
      Sound.play('move');
      this.render();
    }
    if (Input.confirm()) {
      if (this.moving !== null) this.finishMove(this.sel);
      else if (this.buttons.some((b) => b.enabled)) {
        this.focus = 'buttons';
        this.btnSel = Math.max(0, this.buttons.findIndex((b) => b.enabled));
        this.render();
      }
    }
    // Hand-Timer-Anzeige aktualisieren (Werte ändern sich nur, wenn Zeit läuft)
  }

  private flipKeyboard(dir: number): void {
    const before = this.pages[this.tab];
    this.flip(dir);
    if (this.pages[this.tab] !== before || this.busy) {
      // Auswahl an der gegenüberliegenden Kante
      const cols = this.tab === 'beutel' ? 1 : GRID_COLS;
      const row = Math.floor(this.sel / cols);
      this.sel = dir > 0 ? row * cols : row * cols + cols - 1;
    }
  }

  private cycleTab(dir: number): void {
    const i = TABS.findIndex((t) => t.id === this.tab);
    this.switchTab(TABS[(i + dir + TABS.length) % TABS.length].id);
  }
}

const TOOL_NAMES: Record<string, string> = {
  'ewige-laterne': 'Ewige Laterne',
  sternenkompass: 'Sternenkompass',
  wolkenfloss: 'Wolkenfloss',
  tiefenperle: 'Tiefenperle',
  kletterranke: 'Kletterranke',
  kartografenfeder: 'Kartografenfeder',
  rankenbruecke: 'Rankenbrücke',
  bannschutz: 'Bannschutz',
  fluesterbuch: 'Flüsterndes Buch',
  'gezinkter-wuerfel': 'Gezinkter Würfel',
  spieluhr: 'Spieluhr',
  wetterfahne: 'Wetterfahne',
  wahrheitstinte: 'Wahrheitstinte',
  linse: 'Leuchtturmlinse',
  fernglas: 'Fernglas',
  'irrlicht-glas': 'Irrlicht im Glas',
  dietrich: 'Dietrich',
  karawanenkompass: 'Karawanenkompass',
  fangnetz: 'Fangnetz',
  enterhaken: 'Enterhaken',
  weidenglocke: 'Weidenglocke',
  schaufel: 'Schaufel',
  angel: 'Angel',
  laterne: 'Laterne',
  kletterseil: 'Kletterseil',
  seetor: 'Hafenpass',
  gildenarchiv: 'Gildensiegel',
  poetenbrief: 'Brief des Poeten',
  oase: 'Oasenschlüssel',
  'leere-tuer': 'Seitenschlüssel',
  kartheim: 'Siegelstein',
};

function toolName(id: string): string {
  return TOOL_NAMES[id] ?? id;
}
