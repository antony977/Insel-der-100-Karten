import { describe, expect, it } from 'vitest';
import { SAMMELKARTEN } from '../src/data/cards';
import { MONSTERS } from '../src/data/monsters';
import { SHOPS } from '../src/data/shops';
import { TREASURES } from '../src/data/treasures';
import { PICKUPS, SPOTS } from '../src/data/doors';
import { POIS } from '../src/data/world/layout';
import { DUNGEONS } from '../src/data/maps/dungeons';

/**
 * Jede der 100 Sammelkarten muss im Spiel erhältlich sein: als Monsterbeute, im Laden,
 * in einer Truhe, an einer Fundstelle oder als Quest-/Minispiel-Belohnung.
 */
describe('Kartenquellen', () => {
  it('jede Sammelkarte hat mindestens eine Quelle', () => {
    const src = new Map<string, string[]>();
    const add = (id: string, s: string) => src.set(id, [...(src.get(id) ?? []), s]);
    for (const m of MONSTERS) if (m.card) add(m.card, `Monster ${m.id}`);
    for (const sh of Object.values(SHOPS)) for (const it of sh.items) add(it.card, `Laden ${sh.id}`);
    // Truhen nur zählen, wenn sie auch in einer Karte stehen
    const chestTags = new Set<string>();
    for (const d of Object.values(DUNGEONS)) for (const o of Object.values(d.objects ?? {})) if (o.tag) chestTags.add(o.tag.replace('#', ''));
    chestTags.add('truhe:seeinsel');
    for (const [k, t] of Object.entries(TREASURES)) {
      if (k.startsWith('testwiese:')) continue;
      const base = k.replace(/\d+$/, '');
      if (chestTags.has(k) || chestTags.has(base)) for (const c of t.cards) add(c, `Truhe ${k}`);
    }
    const poiTags = new Set(POIS.map((p) => p.tag));
    for (const [k, s] of Object.entries(SPOTS)) if (s.card && (poiTags.has(k) || k === 'geheim:klee')) add(s.card, `Fundstelle ${k}`);
    for (const [k, p] of Object.entries(PICKUPS)) add(p.card, `Sammelobjekt ${k}`);
    // Belohnungen in Dialogen, Modulen und Minispielen
    const sources = import.meta.glob(['../src/data/dialogs/*.ts', '../src/scenes/*.ts', '../src/scenes/mini/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [f, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/(?:giveCard|reward)\((?:c, )?'(\d{3})'\)/g)) add(m[1], `Code ${f}`);
    }
    const missing = SAMMELKARTEN.filter((c) => !src.has(c.id)).map((c) => `${c.id} ${c.name}`);
    expect(missing).toEqual([]);
  });
});
