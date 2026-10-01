import { Sound } from './AudioEngine';
import { Game } from '../systems/GameState';

/**
 * Klänge für Spielereignisse, die nicht an eine bestimmte Szene gebunden sind
 * (Karte erhalten, Stufenaufstieg, Verwandlung …).
 */
export function registerSoundHooks(): void {
  Game.events.on('card-received', (def) => {
    const rare = def.rank === 'SS' || def.rank === 'S' || def.rank === 'A';
    Sound.play(rare ? 'cardRare' : 'cardGet');
  });
  Game.events.on('card-transformed', () => Sound.play('transform'));
  Game.events.on('card-unleashed', () => Sound.play('unleash'));
  Game.events.on('card-limit', () => Sound.play('error'));
  Game.events.on('level-up', () => Sound.play('levelUp'));
}
