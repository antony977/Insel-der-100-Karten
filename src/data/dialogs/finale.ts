import { registerDialogs, type DialogCtx, type DialogDef } from '../../systems/Dialog';
import { Game } from '../../systems/GameState';
import { worldHost } from '../../systems/WorldModules';
import { SAMMELKARTEN } from '../cards';
import type { ChoiceData } from '../../scenes/ChoiceScene';
import { Sound } from '../../audio/AudioEngine';

/**
 * Das Finale: Sobald alle 100 Sammelseiten gefüllt sind, leuchtet das Erste Tor.
 * Spielleiter Nullpunkt lässt einen drei Karten auswählen, die mit in die echte Welt
 * kommen – danach Abspann und New Game+.
 */
Game.events.on('book-changed', () => {
  if (Game.flags.has('nullpunkt-bereit') || Game.book.collectedCount() < 100) return;
  Game.flags.add('nullpunkt-bereit');
  Sound.play('fanfare');
  worldHost()?.toast('Alle 100 Karten! Ein Lichtstrahl schiesst aus dem Ersten Tor in Taufeld in den Himmel …');
});

function chooseCards(c: DialogCtx, picked: string[]): void {
  const n = picked.length + 1;
  const data: ChoiceData = {
    title: `Wähle Karte ${n} von 3 für die echte Welt`,
    options: SAMMELKARTEN.map((k) => ({ label: `${k.id} ${k.name} (${k.rank})`, value: k.id, disabled: picked.includes(k.id) })),
    onPick: (id) => {
      const list = [...picked, id];
      if (list.length < 3) {
        chooseCards(c, list);
        return;
      }
      for (const f of [...Game.flags]) if (f.startsWith('souvenir:')) Game.flags.delete(f);
      for (const k of list) Game.flags.add(`souvenir:${k}`);
      Game.flags.add('spiel-beendet');
      c.w.openScene('Credits', { cards: list });
    },
    onCancel: () => c.w.toast('Nullpunkt wartet geduldig am Ersten Tor.'),
  };
  c.w.openScene('Choice', data);
}

const nullpunkt: DialogDef = {
  id: 'nullpunkt',
  start: () => 'a',
  nodes: {
    a: {
      say: (c) => [
        'Das Portal öffnet sich, und eine Gestalt aus weissem Licht tritt heraus. „Ich bin Nullpunkt, der Spielleiter dieser Insel."',
        `„${c.g.player.name}. Hundert Karten, hundert Geschichten – du hast sie alle gefunden. Das ist noch niemandem gelungen."`,
        '„Die Lumenbox hat dich hierher geholt. Nun bringt sie dich zurück. Drei Karten darfst du mitnehmen – als echte Dinge, in deine Welt."',
      ],
      choices: [
        { text: 'Ich bin bereit.', do: (c) => c.w.after(() => chooseCards(c, [])) },
        { text: 'Noch nicht – ich will noch bleiben.', goto: 'bleiben' },
      ],
    },
    bleiben: { say: ['„Nimm dir Zeit. Das Tor bleibt offen, solange du willst."'] },
  },
};

registerDialogs([nullpunkt]);
