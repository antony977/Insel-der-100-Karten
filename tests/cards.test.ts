import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS, SAMMELKARTEN, ZAUBERKARTEN, card } from '../src/data/cards';
import { RANKS } from '../src/data/cardTypes';
import { CardRegistry } from '../src/systems/cards/CardRegistry';
import { Book, FREE_SLOTS, OUTSIDE_SECONDS } from '../src/systems/cards/Book';
import { GameStateStore } from '../src/systems/GameState';
import { ITEM_ICONS, MONSTER_ICONS, SPELL_GLYPHS } from '../src/gfx/generators/cardIcons';

describe('Kartendaten', () => {
  it('100 Sammelkarten mit den Nummern 000–099 und 40 Zauber', () => {
    expect(SAMMELKARTEN.length).toBe(100);
    expect(ZAUBERKARTEN.length).toBe(40);
    SAMMELKARTEN.forEach((c, i) => {
      expect(c.no).toBe(i);
      expect(c.id).toBe(String(i).padStart(3, '0'));
    });
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(140);
  });

  it('jede Karte hat Rang, Limit, Texte und ein vorhandenes Symbol', () => {
    for (const c of ALL_CARDS) {
      expect(RANKS).toContain(c.rank);
      expect(c.limit).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThan(5);
      expect(c.effect.length).toBeGreaterThan(5);
      expect(c.hint.length).toBeGreaterThan(5);
      const key = c.art.icon;
      const exists = key.startsWith('m-') ? MONSTER_ICONS[key.slice(2)] : key.startsWith('g-') ? SPELL_GLYPHS[key.slice(2)] : ITEM_ICONS[key];
      expect(exists, `${c.id} ${key}`).toBeDefined();
    }
  });

  it('seltene Karten gibt es nur 1–3 Mal', () => {
    for (const c of SAMMELKARTEN.filter((x) => x.rank === 'SS')) expect(c.limit).toBeLessThanOrEqual(3);
  });
});

describe('Kartenregister (globale Limits)', () => {
  it('erzeugt nur bis zum Limit und gibt Plätze beim Verwandeln frei', () => {
    const r = new CardRegistry();
    const herz = card('000'); // Limit 1
    const a = r.create(herz.id, 'spieler');
    expect(a).not.toBeNull();
    expect(r.create(herz.id, 'rivale:mila')).toBeNull();
    expect(r.remaining(herz.id)).toBe(0);
    r.destroy(a!.uid);
    expect(r.remaining(herz.id)).toBe(1);
    expect(r.create(herz.id, 'rivale:mila')).not.toBeNull();
    expect(r.owners(herz.id)).toEqual(['rivale:mila']);
  });

  it('lässt sich speichern und laden', () => {
    const r = new CardRegistry();
    r.create('095', 'spieler');
    r.create('095', 'boden');
    const r2 = CardRegistry.deserialize(r.serialize());
    expect(r2.count('095')).toBe(2);
    expect(r2.create('095', 'x')!.uid).toBe(3);
  });
});

describe('Kartenbuch-Regeln', () => {
  let reg: CardRegistry;
  let book: Book;
  const give = (id: string) => {
    const inst = reg.create(id, 'spieler')!;
    book.receive(inst.uid);
    return inst.uid;
  };

  beforeEach(() => {
    reg = new CardRegistry();
    book = new Book(reg);
  });

  it('Sammel-Slot nimmt nur die passende Nummer', () => {
    const u = give('042');
    expect(book.move(u, { area: 'sammel', index: 41 })).toBe('falsche-nummer');
    expect(book.move(u, { area: 'sammel', index: 42 })).toBe('ok');
    expect(book.collectedCount()).toBe(1);
  });

  it('Zauber passen nie in Sammelseiten, aber in freie Slots', () => {
    const z = give('Z01');
    expect(book.move(z, { area: 'sammel', index: 1 })).toBe('falsche-nummer');
    expect(book.file(z)).toBe('ok');
    expect(book.locate(z)!.area).toBe('frei');
  });

  it('Doppelte landen in freien Slots', () => {
    const a = give('095');
    const b = give('095');
    book.fileAll();
    expect(book.locate(a)).toEqual({ area: 'sammel', index: 95 });
    expect(book.locate(b)!.area).toBe('frei');
    expect(book.collectedCount()).toBe(1);
  });

  it('Tausch zwischen freiem Slot und Sammelseite', () => {
    const a = give('095');
    const b = give('095');
    book.fileAll();
    expect(book.move(b, { area: 'sammel', index: 95 })).toBe('ok');
    expect(book.locate(b)!.area).toBe('sammel');
    expect(book.locate(a)!.area).toBe('frei');
  });

  it('nur 45 freie Slots', () => {
    for (let i = 0; i < FREE_SLOTS; i++) {
      give('Z25');
      book.fileAll();
    }
    const extra = give('Z25');
    expect(book.file(extra)).toBe('voll');
    expect(book.freeUsed()).toBe(45);
  });

  it('Karten ausserhalb des Buchs verwandeln sich nach 60 Sekunden', () => {
    const u = give('093');
    expect(book.tick(OUTSIDE_SECONDS - 1)).toEqual([]);
    expect(book.tick(1.5)).toEqual([u]);
    expect(book.hand.length).toBe(0);
  });

  it('Karten im Buch verwandeln sich nie; Herausnehmen startet den Timer neu', () => {
    const u = give('093');
    book.file(u);
    expect(book.tick(500)).toEqual([]);
    book.takeOut(u);
    expect(book.hand[0].timeLeft).toBe(OUTSIDE_SECONDS);
  });

  it('nur Karten in den Sammelseiten zählen', () => {
    give('001');
    expect(book.collectedCount()).toBe(0);
    book.fileAll();
    expect(book.collectedCount()).toBe(1);
  });
});

describe('Spielstand', () => {
  it('Entfessle! macht aus einer Karte einen Gegenstand und gibt das Limit frei', () => {
    const g = new GameStateStore();
    g.newGame();
    const uid = g.giveCard('095')!;
    g.book.fileAll();
    expect(g.registry.count('095')).toBe(1);
    g.unleash(uid);
    expect(g.registry.count('095')).toBe(0);
    expect(g.inv.bag.get('095')).toBe(1);
    g.inv.lp = 50;
    expect(g.inv.use('095').ok).toBe(true);
    expect(g.inv.lp).toBe(80);
  });

  it('Limit erreicht → keine neue Karte', () => {
    const g = new GameStateStore();
    g.newGame();
    let limitHit = false;
    g.events.on('card-limit', () => (limitHit = true));
    expect(g.giveCard('000')).not.toBeNull();
    expect(g.giveCard('000')).toBeNull();
    expect(limitHit).toBe(true);
  });

  it('60-Sekunden-Regel verwandelt Handkarten in Gegenstände', () => {
    const g = new GameStateStore();
    g.newGame();
    g.giveCard('082'); // Schaufel
    g.tick(61);
    expect(g.book.hand.length).toBe(0);
    expect(g.inv.tools.has('schaufel')).toBe(true);
  });

  it('Ausrüstung verändert die Werte', () => {
    const g = new GameStateStore();
    g.newGame();
    const uid = g.giveCard('014')!; // Arenagürtel
    g.unleash(uid);
    const before = g.inv.stats().str;
    g.inv.use('014');
    expect(g.inv.stats().str).toBe(before + 3);
    g.inv.use('014');
    expect(g.inv.stats().str).toBe(before);
  });

  it('Karten am Boden werden nach 60 s zu Gegenständen', () => {
    const g = new GameStateStore();
    g.newGame();
    const uid = g.giveCard('084')!;
    g.dropCard(uid, 10, 10);
    expect(g.ground.length).toBe(1);
    g.tick(61);
    expect(g.ground[0].kind).toBe('item');
    expect(g.registry.count('084')).toBe(0);
    g.pickUp(g.ground[0].key);
    expect(g.inv.tools.has('laterne')).toBe(true);
  });

  it('Speichern und Laden ergibt denselben Zustand', () => {
    const g = new GameStateStore();
    g.newGame();
    g.giveCard('042');
    g.giveCard('Z12');
    g.book.fileAll();
    g.giveCard('093');
    g.inv.money = 1234;
    g.flags.add('lumi-begruesst');
    const data = JSON.parse(JSON.stringify(g.serialize()));
    const h = new GameStateStore();
    h.load(data);
    expect(h.book.collectedCount()).toBe(1);
    expect(h.book.freeUsed()).toBe(1);
    expect(h.book.hand.length).toBe(1);
    expect(h.inv.money).toBe(1234);
    expect(h.flags.has('lumi-begruesst')).toBe(true);
    expect(h.registry.count('042')).toBe(1);
  });
});
