import { describe, expect, it } from 'vitest';
import { Game } from '../src/systems/GameState';
import { OUTSIDE_SECONDS } from '../src/systems/cards/Book';

describe('Verlorene Karten', () => {
  it('eine verwandelte Karte wird für die Phönixtinte vorgemerkt und ist wieder erhältlich', () => {
    Game.newGame();
    expect(Game.giveCard('029')).not.toBeNull();
    expect(Game.book.hand.length).toBe(1);
    Game.tick(OUTSIDE_SECONDS + 1);
    expect(Game.book.hand.length).toBe(0);
    expect(Game.lost).toContain('029');
    expect(Game.registry.canCreate('029')).toBe(true);
  });

  it('Handkarten gehen beim Zusammenbruch auf die Liste', () => {
    Game.newGame();
    Game.giveCard('076');
    Game.die();
    expect(Game.lost).toContain('076');
  });
});

describe('Abgaben an Figuren', () => {
  it('Oma Hilde strickt eine neue Decke, wenn die alte weg ist', async () => {
    await import('../src/data/dialogs');
    const { getDialog } = await import('../src/systems/Dialog');
    Game.newGame();
    Game.quests.set('q-wolle', 2);
    const d = getDialog('hilde')!;
    const ctx = { g: Game, w: { giveCard: (id: string) => Game.giveCard(id) !== null } } as never;
    expect(d.start(ctx)).toBe('againWait');
    for (let i = 0; i < 3; i++) Game.giveCard('093');
    expect(d.start(ctx)).toBe('again');
    d.nodes.again.choices![0].do!(ctx);
    expect(Game.countCard('090')).toBe(1);
    expect(d.start(ctx)).toBe('done');
  });
});
