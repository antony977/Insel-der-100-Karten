import { describe, expect, it } from 'vitest';
import { Progress } from '../src/systems/Progress';
import { meleeDamage, incomingDamage, stossDamage, afterDefense } from '../src/systems/combat/Damage';
import { BASE_STATS } from '../src/systems/cards/Inventory';
import { emptyMods, TALENT_TREES, AFFINITIES, TECHNIQUES } from '../src/data/aura';
import { MONSTERS, xpToNext } from '../src/data/monsters';
import { SPECIES } from '../src/gfx/generators/creatures';
import { card } from '../src/data/cards';
import { GameStateStore } from '../src/systems/GameState';

const fixed = (v: number) => () => v;

describe('Monster-Daten', () => {
  it('jedes Monster hat Grafik und eine passende Monsterkarte', () => {
    for (const m of MONSTERS) {
      expect(SPECIES[m.sprite], m.id).toBeDefined();
      const c = card(m.card);
      expect(c.type, m.id).toBe('Monster');
    }
  });
  it('alle 35 Monsterkarten sind durch Monster erreichbar', () => {
    const cards = new Set(MONSTERS.map((m) => m.card));
    expect(cards.size).toBe(35);
  });
  it('Erfahrungskurve steigt', () => {
    for (let l = 1; l < 40; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });
});

describe('Schaden', () => {
  it('Combo-Finisher und Aufladeschlag treffen härter', () => {
    const m = emptyMods();
    const a = meleeDamage(BASE_STATS, m, 0, false, false, fixed(0.5)).dmg;
    const c = meleeDamage(BASE_STATS, m, 2, false, false, fixed(0.5)).dmg;
    const ch = meleeDamage(BASE_STATS, m, 'charge', false, false, fixed(0.5)).dmg;
    expect(c).toBeGreaterThan(a);
    expect(ch).toBeGreaterThan(c);
  });
  it('Fokus verdoppelt den Schaden', () => {
    const m = emptyMods();
    const a = meleeDamage(BASE_STATS, m, 0, false, false, fixed(0.5)).dmg;
    const f = meleeDamage(BASE_STATS, m, 0, true, false, fixed(0.5)).dmg;
    expect(f).toBeGreaterThanOrEqual(a * 2 - 1);
  });
  it('kritische Treffer bei niedrigem Würfelwurf', () => {
    const h = meleeDamage(BASE_STATS, emptyMods(), 0, false, false, fixed(0.01));
    expect(h.crit).toBe(true);
  });
  it('Aura-Schild senkt erlittenen Schaden stark, Fokus erhöht ihn', () => {
    const m = emptyMods();
    const base = incomingDamage(40, BASE_STATS, m, false, false, fixed(0.5));
    expect(incomingDamage(40, BASE_STATS, m, true, false, fixed(0.5))).toBeLessThan(base * 0.4);
    expect(incomingDamage(40, BASE_STATS, m, false, true, fixed(0.5))).toBeGreaterThan(base);
  });
  it('Aura-Stoss skaliert mit Aura-Kontrolle', () => {
    const m = emptyMods();
    const a = stossDamage(BASE_STATS, m, 0, false, fixed(0.5)).dmg;
    const b = stossDamage({ ...BASE_STATS, ctrl: 10 }, m, 0, false, fixed(0.5)).dmg;
    expect(b).toBeGreaterThan(a);
  });
  it('Verteidigung des Monsters, mindestens 1 Schaden', () => {
    expect(afterDefense(10, 4)).toBe(8);
    expect(afterDefense(1, 50)).toBe(1);
  });
});

describe('Fortschritt', () => {
  it('Level-Up mit ausstehender Kartenwahl', () => {
    const p = new Progress();
    const ups = p.addXp(xpToNext(1) + xpToNext(2));
    expect(ups).toBe(2);
    expect(p.level).toBe(3);
    expect(p.pending).toBe(2);
  });
  it('Angebot: drei Karten mit verschiedenen Farben', () => {
    const p = new Progress();
    for (let i = 0; i < 20; i++) {
      const o = p.offer();
      expect(o.length).toBe(3);
      expect(new Set(o.map((c) => c.color)).size).toBe(3);
    }
  });
  it('Talente werden stufenweise freigeschaltet und wirken', () => {
    const p = new Progress();
    p.setAffinity('echo');
    const t0 = p.offer(fixed(0)).find((c) => c.color === 'gold')!;
    expect(t0.talent?.tier).toBe(0);
    p.pick(t0);
    expect(p.nextTier(t0.talent!.branch)).toBe(1);
    expect(p.mods.stossDmg + p.mods.stossCost + p.mods.shield).toBeGreaterThan(0);
  });
  it('Talentbäume sind vollständig (5 × 3 × 4)', () => {
    for (const a of AFFINITIES) {
      expect(TALENT_TREES[a.id].length).toBe(3);
      for (const b of TALENT_TREES[a.id]) expect(b.tiers.length).toBe(4);
    }
    expect(TECHNIQUES.length).toBe(5);
  });
  it('Stufenwerte fliessen in die Werte ein und werden gespeichert', () => {
    const g = new GameStateStore();
    g.newGame();
    const lp0 = g.inv.stats().lp;
    g.gainXp(xpToNext(1));
    expect(g.inv.stats().lp).toBeGreaterThan(lp0);
    const save = JSON.parse(JSON.stringify(g.serialize()));
    const h = new GameStateStore();
    h.load(save);
    expect(h.prog.level).toBe(2);
    expect(h.inv.stats().lp).toBe(g.inv.stats().lp);
  });
  it('Tod: Geld und freie Slots weg, Sammelseiten bleiben', () => {
    const g = new GameStateStore();
    g.newGame();
    const a = g.giveCard('095')!;
    g.book.file(a);
    const b = g.giveCard('Z13')!;
    g.book.file(b);
    g.inv.money = 300;
    const loss = g.die();
    expect(loss.money).toBe(300);
    expect(loss.cards).toContain('Z13');
    expect(g.book.collectedCount()).toBe(1);
    expect(g.inv.money).toBe(0);
  });
});
