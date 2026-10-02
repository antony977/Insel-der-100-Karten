import { registerModule } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';

/**
 * Einmalige Tipps, wenn etwas zum ersten Mal passiert (erste Nacht, erste Höhle …).
 * Jeder Tipp erscheint nur einmal pro Spielstand.
 */
const TIPS: { id: string; when: (map: string) => boolean; text: string }[] = [
  {
    id: 'nacht',
    when: () => Game.isNight(),
    text: 'Es wird Nacht. Jetzt sind andere Wesen unterwegs – und ohne Laterne siehst du wenig. Wilma in Taufeld verkauft welche.',
  },
  {
    id: 'sturm',
    when: (map) => map === 'insel' && Game.isNight() && (Game.day % 3 === 2),
    text: 'Ein Sturm zieht auf! In Sturmnächten braucht Tilda am Leuchtturm von Möwenhafen Hilfe.',
  },
  {
    id: 'hoehle',
    when: (map) => map !== 'insel' && map !== 'testwiese',
    text: 'Du betrittst einen besonderen Ort. Hier gelten eigene Regeln – über den Ausgang kommst du jederzeit zurück auf die Insel.',
  },
  {
    id: 'boss',
    when: () => bossSeen,
    text: 'Bosse kündigen ihre Angriffe mit roten Flächen am Boden an. Rolle rechtzeitig heraus – und schlag zu, wenn der Boss nach einem Angriff verschnauft!',
  },
  {
    id: 'stufe5',
    when: () => Game.prog.level >= 5,
    text: 'Stufe 5! Deine Spezialtechnik ist freigeschaltet. Halte die Aura-Taste gedrückt, um sie im Aura-Rad zu wählen.',
  },
  {
    id: 'volle-hand',
    when: () => Game.book.hand.length >= 8,
    text: 'Deine Hand ist fast voll! Leg Karten ins Buch, bevor sie sich nach 60 Sekunden verwandeln.',
  },
];

let t = 0;
let bossSeen = false;

registerModule({
  id: 'tipps',
  load() {
    t = 3;
  },
  update(h, dt) {
    t -= dt;
    if (t > 0) return;
    t = 1.5;
    if (h.scene.registry.get('bossBar')) bossSeen = true;
    for (const tip of TIPS) {
      if (Game.flags.has(`tipp:${tip.id}`)) continue;
      if (!tip.when(h.mapId)) continue;
      Game.flags.add(`tipp:${tip.id}`);
      h.toast(tip.text);
      t = 6;
      return;
    }
  },
});
