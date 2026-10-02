import { registerModule, type WorldHost } from '../systems/WorldModules';
import { BossFight, type BossDef } from '../systems/combat/BossFight';
import { Game } from '../systems/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { PAL } from '../gfx/palette';

/**
 * Die Bosse der Insel: Angriffsmuster je Phase, Arena und Belohnung.
 * Die Karte (Beute) steht beim Monster in data/monsters.ts.
 */
export interface BossEntry {
  def: BossDef;
  map: string;
  /** Flag nach dem Sieg */
  flag: string;
  intro: string;
  win: string;
  /** erst starten, wenn man so nah am Startpunkt ist (Pixel) */
  trigger?: number;
}

export const BOSSES: BossEntry[] = [
  {
    map: 'wiesenkessel',
    flag: 'boss:moosbart',
    trigger: 150,
    intro: 'Der Boden bebt – ein Grashügel erhebt sich: Moosbart, der Grasriese!',
    win: 'Moosbart sinkt zu einem friedlichen Hügel zusammen. Zurück bleibt ein leuchtender Samen.',
    def: {
      id: 'moosbart',
      title: 'Der Grasriese',
      color: PAL.lime,
      phases: [
        [{ kind: 'slam' }, { kind: 'quake' }, { kind: 'summon', minions: ['huepfpilz', 'huepfpilz'] }],
        [{ kind: 'slam' }, { kind: 'quake' }, { kind: 'rain' }, { kind: 'charge' }, { kind: 'summon', minions: ['blattschnapper', 'huepfpilz', 'huepfpilz'] }],
      ],
    },
  },
  {
    map: 'gildenturm',
    flag: 'boss:tintenkoloss',
    trigger: 150,
    intro: 'Die Tintenfässer kippen um, und aus der schwarzen Pfütze wächst der Tintenkoloss empor!',
    win: 'Der Koloss zerfliesst zu harmloser Tinte. Darin glänzt eine Krone aus getrockneter Schrift.',
    def: {
      id: 'tintenkoloss',
      title: 'Hüter der verbotenen Seiten',
      color: PAL.violet,
      phases: [
        [{ kind: 'volley', proj: 'ink', n: 5 }, { kind: 'slam' }, { kind: 'teleport' }],
        [{ kind: 'spiral', proj: 'ink' }, { kind: 'rain' }, { kind: 'volley', proj: 'ink', n: 7 }, { kind: 'summon', minions: ['papierflatterer', 'papierflatterer', 'papierflatterer'] }],
      ],
    },
  },
  {
    map: 'hafenbecken',
    flag: 'boss:tiefenmaul',
    trigger: 200,
    intro: 'Das Wasser brodelt – Tiefenmaul, die Hafenkrake, reckt ihre Fangarme empor!',
    win: 'Tiefenmaul taucht gurgelnd ab. Auf dem Steg liegt eine schimmernde Perle.',
    def: {
      id: 'tiefenmaul',
      title: 'Die Hafenkrake',
      color: PAL.cyan,
      stationary: true,
      phases: [
        [{ kind: 'rain' }, { kind: 'volley', proj: 'orb', n: 5 }, { kind: 'rain', n: 4 }],
        [{ kind: 'rain', n: 8 }, { kind: 'spiral', proj: 'orb' }, { kind: 'volley', proj: 'orb', n: 7 }, { kind: 'summon', minions: ['quallenlicht', 'quallenlicht'] }],
      ],
    },
  },
  {
    map: 'tresor',
    flag: 'boss:hausbankier',
    trigger: 150,
    intro: 'Rasselnd erwachen die Walzen: Der Hausbankier will seinen Tresor nicht teilen!',
    win: 'Der Hausbankier spuckt einen Schwall Münzen aus – und ganz oben glänzt eine besondere.',
    def: {
      id: 'hausbankier',
      title: 'Der lebende Glücksautomat',
      color: PAL.gold,
      phases: [
        [{ kind: 'charge' }, { kind: 'volley', proj: 'spark', n: 5 }, { kind: 'summon', minions: ['jetonratte', 'jetonratte'] }],
        [{ kind: 'spiral', proj: 'spark' }, { kind: 'charge' }, { kind: 'rain' }, { kind: 'summon', minions: ['wuerfelmimik', 'jetonratte', 'jetonratte'] }],
      ],
    },
  },
  {
    map: 'gipfel',
    flag: 'boss:kragor',
    trigger: 160,
    intro: 'Ein Schrei zerreisst den Wind: Sturmgreif Kragor stürzt aus den Wolken herab!',
    win: 'Kragor schwingt sich davon. Eine einzelne Feder, knisternd vor Sturm, segelt zu dir herab.',
    def: {
      id: 'kragor',
      title: 'Herr der Gipfelstürme',
      color: PAL.sky,
      phases: [
        [{ kind: 'charge' }, { kind: 'volley', proj: 'feather', n: 5 }, { kind: 'rain' }],
        [{ kind: 'charge' }, { kind: 'spiral', proj: 'feather' }, { kind: 'rain', n: 8 }, { kind: 'summon', minions: ['gipfeladler', 'gipfeladler'] }],
      ],
    },
  },
  {
    map: 'nebelherz',
    flag: 'boss:nebelmutter',
    trigger: 110,
    intro: 'Der Nebel verdichtet sich zu einer Gestalt mit Laternenaugen: die Nebelmutter!',
    win: 'Die Nebelmutter löst sich in sanften Morgendunst auf. Zurück bleibt eine Laterne, deren Licht nie erlischt.',
    def: {
      id: 'nebelmutter',
      title: 'Seele des Nebelhains',
      color: PAL.ice,
      phases: [
        [{ kind: 'teleport' }, { kind: 'volley', proj: 'orb', n: 5 }, { kind: 'summon', minions: ['nebelwolf', 'nebelwolf'] }],
        [{ kind: 'teleport' }, { kind: 'spiral', proj: 'orb' }, { kind: 'rain' }, { kind: 'quake' }, { kind: 'summon', minions: ['irrlicht', 'irrlicht'] }],
      ],
    },
  },
  {
    map: 'rosengarten',
    flag: 'boss:dornenbaron',
    trigger: 150,
    intro: 'Die Rosenhecken teilen sich, und der Dornenbaron zieht sein Dornenschwert!',
    win: 'Der Dornenbaron zerfällt zu Blütenblättern. Zwischen ihnen liegt ein Ring aus lebenden Dornen.',
    def: {
      id: 'dornenbaron',
      title: 'Ritter der wilden Rosen',
      color: PAL.red,
      phases: [
        [{ kind: 'charge' }, { kind: 'slam' }, { kind: 'rain' }],
        [{ kind: 'charge' }, { kind: 'spiral', proj: 'spike' }, { kind: 'rain', n: 7 }, { kind: 'summon', minions: ['dornenranke', 'dornenranke'] }],
      ],
    },
  },
  {
    map: 'labyrinth',
    flag: 'boss:leser',
    trigger: 120,
    intro: 'Eine Gestalt ohne Gesicht blättert in einem riesigen Buch. „Noch eine Geschichte …", flüstert der Leere Leser.',
    win: 'Der Leere Leser schlägt sein Buch zu und verschwindet zwischen den Zeilen. Auf dem Boden pocht ein Herz aus Licht.',
    def: {
      id: 'leser',
      title: 'Der die Geschichten frisst',
      color: PAL.violet,
      phases: [
        [{ kind: 'teleport' }, { kind: 'volley', proj: 'page', n: 7 }, { kind: 'rain' }, { kind: 'summon', minions: ['kartensoldat', 'kartensoldat'] }],
        [{ kind: 'spiral', proj: 'page' }, { kind: 'rain', n: 8 }, { kind: 'quake' }, { kind: 'teleport' }, { kind: 'summon', minions: ['seitenfresser', 'tintenschatten'] }],
      ],
    },
  },
  {
    map: 'aschenhalle',
    flag: 'boss:varga',
    trigger: 140,
    intro: 'Varga Aschenherz wendet sich um. „Du hast mir lange genug im Weg gestanden." Asche wirbelt auf!',
    win: 'Varga sinkt auf die Knie. „Die Bücher … sind frei." Sie lässt ihr Aschensiegel fallen.',
    def: {
      id: 'varga',
      title: 'Anführerin der Aschenhand',
      color: PAL.orange,
      phases: [
        [{ kind: 'charge' }, { kind: 'volley', proj: 'spark', n: 5 }, { kind: 'teleport' }, { kind: 'rain' }],
        [{ kind: 'spiral', proj: 'spark' }, { kind: 'charge' }, { kind: 'rain', n: 8 }, { kind: 'summon', minions: ['trugbild', 'trugbild'] }],
      ],
    },
  },
];

for (const b of BOSSES) {
  let fight: BossFight | null = null;
  let spot: { x: number; y: number } | null = null;
  registerModule({
    id: `boss-${b.def.id}`,
    maps: [b.map],
    load(h: WorldHost) {
      fight = null;
      spot = null;
      const i = h.map.findByTag(`boss:${b.def.id}`);
      if (i < 0) return;
      const o = h.map.objects[i];
      spot = { x: o.x, y: o.y };
      h.map.removeObject(i);
      h.refreshObject(i);
    },
    update(h, dt) {
      if (fight) {
        fight.update(dt);
        if (fight.done) fight = null;
        return;
      }
      if (!spot || Game.flags.has(b.flag)) return;
      if (Math.hypot(h.player.x - spot.x, h.player.y - spot.y) > (b.trigger ?? 140)) return;
      const f = new BossFight(h, b.def, spot.x, spot.y);
      f.onDefeat = () => {
        Game.flags.add(b.flag);
        h.toast(b.win);
        h.flash(PAL.gold, 300);
        SaveSystem.autosave();
      };
      fight = f;
      h.toast(b.intro);
    },
    died() {
      fight?.finish(false);
      fight = null;
    },
  });
}

/** Wie viele Bosse besiegt sind */
export function bossesDefeated(): number {
  return BOSSES.filter((b) => Game.flags.has(b.flag)).length;
}
