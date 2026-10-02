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
