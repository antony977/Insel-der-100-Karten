import { registerDialogs, type DialogCtx, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { STARTER_CARDS } from '../treasures';
import { registerModule } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';
import { NPC_BY_ID } from '../npcs';
import { TOWNS } from '../world/layout';
import { TILE } from '../../config';

registerQuests([
  {
    id: 'q-start',
    name: 'Willkommen auf der Insel',
    where: 'Taufeld · Lumi',
    steps: [
      'Lege Lumis Startkarten in dein Kartenbuch und sprich danach noch einmal mit Lumi.',
      'Werde rund um Taufeld stärker: Besiege Wesen und sammle Karten, bis du Stufe 3 erreichst. Oma Hilde und Bauer Korbinian haben auch Aufgaben für dich.',
      'Reise nach Runenhall im Norden und schau dir den Zauberladen an. Der Pfeil zeigt dir die Richtung.',
      'Du hast Runenhall erreicht. Viel Glück beim Sammeln!',
    ],
  },
  {
    id: 'q-wolle',
    name: 'Wolle für Oma Hilde',
    where: 'Taufeld · Oma Hilde',
    steps: ['Bring Oma Hilde drei Wollknäuel-Karten (Nr. 093).', 'Oma Hilde hat dir eine Warme Wolldecke gestrickt.'],
  },
  {
    id: 'q-glocke',
    name: 'Die verlorene Glocke',
    where: 'Taufeld · Bauer Korbinian',
    steps: [
      'Korbinians Glocke liegt irgendwo im hohen Gras östlich des Dorfs. Aura-Sinn hilft beim Suchen.',
      'Du hast die Glocke gefunden. Bring sie Korbinian zurück.',
      'Korbinian hat dir die Weidenglocke geschenkt.',
    ],
  },
]);

const has = (c: DialogCtx, id: string, n = 1) => c.g.countCard(id) >= n;

const TOWN_NAMES: Record<string, string> = {
  taufeld: 'Taufeld',
  runenhall: 'Runenhall',
  moewenhafen: 'Möwenhafen',
  wuerfelheim: 'Würfelheim',
  hohenkamm: 'Hohenkamm',
  sandspiegel: 'Sandspiegel',
  rosenweil: 'Rosenweil',
};

const BOSS_HINTS: [string, string][] = [
  ['boss:moosbart', 'Im Südosten des Taufelds schläft Moosbart, der Grasriese, im Wiesenkessel. Ab etwa Stufe 8 hast du gute Chancen.'],
  ['boss:tintenkoloss', 'Als Mitglied des Ordens darfst du in Runenhall den Gildenturm hinaufsteigen – dort wartet der Tintenkoloss.'],
  ['boss:hausbankier', 'Mit einer Silbernen Spielmarke öffnet Fortuna dir in Würfelheim den Tresorraum des Hausbankiers.'],
  ['boss:tiefenmaul', 'Hafenmeisterin Marlene in Möwenhafen sucht jemanden, der die Hafenkrake vertreibt.'],
  ['boss:dornenbaron', 'Westlich von Rosenweil führt eine Rankenpforte in einen verwilderten Rosengarten. Dort haust der Dornenbaron.'],
  ['boss:kragor', 'Mit Moosbarts Herzsamen wächst auf dem Bergpfad nördlich von Hohenkamm eine Rankenbrücke zum Gipfel – zu Sturmgreif Kragor.'],
  ['boss:nebelmutter', 'Ein Irrlicht im Glas führt dich durch die Nebelwand im Westen des Nebelhains. Hinter der Wurzelpforte wohnt die Nebelmutter.'],
  ['boss:leser', 'Mit der Ewigen Laterne kannst du die Treppe in den Ruinen hinabsteigen: das Labyrinth der Leeren Seiten.'],
];

/** Lumis Rat: das nächste sinnvolle Ziel */
function nextGoal(c: DialogCtx): string {
  const g = c.g;
  if (!g.quests.done('q-start')) return g.quests.text('q-start');
  const n = g.book.collectedCount();
  if (n < 8) return 'Sammle erst einmal Karten! Besiege Monster rund um Taufeld, hilf Oma Hilde und Bauer Korbinian, und schau dich in Runenhall um. Leg neue Karten immer gleich ins Buch!';
  if (!g.quests.done('q-gilde')) return 'In Runenhall nimmt der Orden der Siegel neue Mitglieder auf. Sprich mit Seraphine im Turm – das Gildensiegel lohnt sich.';
  const unseen = Object.keys(TOWN_NAMES).filter((t) => !g.visited.has(t));
  if (unseen.length) return `Du kennst noch nicht alle Städte. Besuch ${unseen.map((t) => TOWN_NAMES[t]).join(', ')} – überall warten Figuren mit Aufgaben und Karten.`;
  if (g.quests.active('q-aschenhand')) return `Die Aschenhand ist gefährlich. ${g.quests.text('q-aschenhand')}`;
  const boss = BOSS_HINTS.find(([f]) => !g.flags.has(f));
  if (boss && g.prog.level >= 6) return boss[1];
  if (n < 100) return `Du hast ${n} von 100 Karten. Schau ins Buch: Bei jeder fehlenden Karte steht, wo man sie findet. Und frag die anderen Sammler – sie kennen viele Verstecke.`;
  return 'Alle 100 Karten! Geh zum Ersten Tor – es wartet jemand auf dich.';
}

const lumi: DialogDef = {
  id: 'lumi',
  start: (c) => {
    if (!c.g.flags.has('lumi-start')) return 'intro';
    if (c.g.quests.stage('q-start') === 1) {
      const handHasStarter = c.g.book.hand.some((h) => STARTER_CARDS.includes(c.g.registry.idOf(h.uid)));
      if (handHasStarter) return 'remind';
      return 'next';
    }
    return 'tips';
  },
  nodes: {
    intro: {
      say: [
        'Da bist du ja! Willkommen auf der Insel der 100 Karten, {name}. Ich bin Lumi, die Hüterin des Ersten Tors.',
        'Hier ist alles eine Karte: Heiltränke, Werkzeuge, Schlüssel – sogar die Monster. Wer alle 100 Sammelkarten in seinem Buch vereint, ruft den Spielleiter herbei.',
        'Und dann darf man die Insel verlassen – mit drei Karten als Andenken in die echte Welt. So erzählt man es sich jedenfalls.',
        'Nimm diese drei Karten als Startgeschenk.',
      ],
      do: (c) => {
        c.g.flags.add('lumi-start');
        c.g.quests.set('q-start', 1);
        for (const id of STARTER_CARDS) c.w.giveCard(id);
      },
      goto: 'book',
    },
    book: {
      say: [
        'Öffne jetzt dein Kartenbuch – Taste B oder der Buch-Knopf – und lege die Karten hinein.',
        'Aber beeil dich: Eine Karte, die länger als 60 Sekunden ausserhalb des Buchs ist, verwandelt sich für immer in ihren Gegenstand!',
      ],
    },
    remind: {
      say: ['Du hast noch Karten in der Hand! Schnipp dein Buch auf und leg sie hinein, bevor die 60 Sekunden um sind.'],
    },
    next: {
      say: [
        'Sehr gut! Im Buch sind deine Karten sicher.',
        'Rund um Taufeld leben harmlose Wesen. Wenn du sie besiegst, verwandeln sie sich manchmal in ihre Karte. Werde erst ein bisschen stärker – Stufe 3 sollte reichen.',
        'Dann reise nach Runenhall im Norden. Dort gibt es Zauberkarten im Laden „Zum blätternden Buch", und der Orden der Siegel sucht neue Mitglieder. Die Wälder dorthin sind aber nichts für Anfänger!',
        'Und wenn du müde bist: An jedem Rastfeuer kannst du dich ausruhen und speichern.',
      ],
      do: (c) => {
        c.g.quests.set('q-start', 2);
      },
    },
    tips: {
      say: ['Brauchst du einen Rat, {name}?'],
      choices: [
        { text: 'Was soll ich als Nächstes tun?', goto: 'ziel' },
        { text: 'Erzähl mir von der Aura.', goto: 'aura' },
        { text: 'Was bedeuten die Limits?', goto: 'limit' },
        { text: 'Was passiert, wenn ich umfalle?', goto: 'death' },
        { text: 'Was ist das Erste Tor?', goto: 'gate' },
        { text: 'Danke, Lumi!' },
      ],
    },
    ziel: { say: (c) => [nextGoal(c)], goto: 'tips' },
    aura: {
      say: [
        'Aura ist die Kraft, die in dir fliesst. Drück die Aura-Taste für deine gewählte Technik – oder halte sie, dann öffnet sich das Aura-Rad.',
        'Mit Aura-Sinn siehst du Verborgenes, mit dem Aura-Stoss triffst du aus der Ferne. Schild und Fokus lernst du, wenn du stärker wirst.',
        'Und irgendwann entdeckst du deine ganz eigene Technik: {tech}.',
      ],
      goto: 'tips',
    },
    limit: {
      say: [
        'Jede Karte gibt es nur begrenzt oft auf der ganzen Insel – das ist ihr Limit. Auch die anderen Sammler zählen mit.',
        'Ist das Limit erreicht, bekommst du die Karte nur noch durch Tausch … oder weniger freundliche Wege.',
      ],
      goto: 'tips',
    },
    death: {
      say: [
        'Dann wachst du am letzten Rastfeuer wieder auf. Aber dein Geld und alle Karten in den freien Slots sind verloren.',
        'Die Sammelseiten bleiben sicher. Darum: Wertvolles gehört in die Sammelseiten!',
        'Und falls dir doch einmal eine seltene Karte verloren geht: Die sagenhafte Phönixtinte soll verlorene Karten wiederherstellen können.',
      ],
      goto: 'tips',
    },
    gate: {
      say: ['Durch dieses Tor kommen alle Neuankömmlinge auf die Insel. Wohin es führt, wenn man hindurchgeht? Zurück … aber erst, wenn das Buch voll ist.'],
      goto: 'tips',
    },
  },
};

const wilma: DialogDef = {
  id: 'wilma',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Na, Neuankömmling? Bei mir gibt es alles, was man für die ersten Schritte braucht.'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('taufeld:kraemerin')) },
        { text: 'Was gibt es Neues?', goto: 'news' },
        { text: 'Tschüss!' },
      ],
    },
    news: {
      say: (c) => [
        c.g.hasThing('082') ? 'Mit der Schaufel kannst du an glitzernden Stellen graben. Man weiss nie, was da liegt!' : 'Eine Schaufel ist Gold wert – an glitzernden Stellen liegen oft Schätze vergraben.',
        'Und nachts ohne Laterne durch den Wald? Lieber nicht.',
      ],
      goto: 'a',
    },
  },
};

const hilde: DialogDef = {
  id: 'hilde',
  start: (c) => {
    const s = c.g.quests.stage('q-wolle');
    if (s === 0) return 'ask';
    if (s === 1) return has(c, '093', 3) ? 'give' : 'wait';
    return 'done';
  },
  nodes: {
    ask: {
      say: [
        'Ach, Kindchen, gut, dass du kommst. Mir ist die Wolle ausgegangen, mitten in einer Decke!',
        'Die flauschigen Wollknäuel auf den Wiesen werden manchmal zu Karten, wenn man sie fängt. Bringst du mir drei davon?',
      ],
      choices: [
        { text: 'Klar, mach ich!', do: (c) => c.g.quests.set('q-wolle', 1), goto: 'thanks' },
        { text: 'Vielleicht später.' },
      ],
    },
    thanks: { say: ['Du bist ein Schatz. Drei Wollknäuel-Karten – Nummer 093. Ich warte hier.'] },
    wait: { say: (c) => [`Drei Wollknäuel-Karten, Kindchen. Du hast ${c.g.countCard('093')}. Die Wollknäuel rollen rund ums Dorf herum.`] },
    give: {
      say: ['Oh! Du hast drei Wollknäuel dabei!'],
      choices: [
        {
          text: 'Hier, bitte.',
          do: (c) => {
            c.g.takeCards('093', 3);
            c.w.giveCard('090');
            c.g.quests.set('q-wolle', 2);
          },
          goto: 'gift',
        },
        { text: 'Die behalte ich lieber noch.' },
      ],
    },
    gift: { say: ['Klick-klack, fertig! Hier ist eine Warme Wolldecke. Oben in Hohenkamm wirst du sie brauchen – dort friert sogar der Wind.'] },
    done: { say: ['Halt dich warm, Kindchen. Und iss genug!'] },
  },
};

const korbinian: DialogDef = {
  id: 'korbinian',
  start: (c) => {
    const s = c.g.quests.stage('q-glocke');
    if (s === 0) return 'ask';
    if (s === 1) return c.g.flags.has('glocke-gefunden') ? 'found' : 'wait';
    if (s === 2) return 'found';
    return 'done';
  },
  nodes: {
    ask: {
      say: [
        'Grüss dich! Sag mal, hast du eine Glocke gesehen? Meine gute Weidenglocke ist mir im hohen Gras östlich vom Dorf heruntergefallen.',
        'Mit ihr rufe ich meine Tiere heim. Man sagt, wer seine Aura schärft – Aura-Sinn –, sieht verlorene Dinge glitzern.',
      ],
      choices: [
        { text: 'Ich halte die Augen offen.', do: (c) => c.g.quests.set('q-glocke', 1) },
        { text: 'Leider nein.' },
      ],
    },
    wait: { say: ['Östlich vom Dorf, im Gras. Mit Aura-Sinn sollte sie glitzern. Ich wäre dir so dankbar!'] },
    found: {
      say: ['Das ist sie! Meine Glocke! Weisst du was – behalte sie. Als Karte. Sie soll dir Glück bringen.'],
      do: (c) => {
        c.w.giveCard('081');
        c.g.quests.set('q-glocke', 3);
      },
    },
    done: { say: ['Seit du mir geholfen hast, finden meine Tiere immer heim. Danke!'] },
  },
};

const pia: DialogDef = {
  id: 'pia',
  start: () => 'a',
  nodes: {
    a: {
      say: (c) =>
        c.g.flags.has('geheim:klee')
          ? ['Du hast den Klee gefunden? Wahnsinn! Ich such mir jetzt einen fünfblättrigen.']
          : [
              'Psst! Weisst du was? Irgendwo in Taufeld wächst ein vierblättriger Klee. Aber man sieht ihn nur mit Aura-Sinn!',
              'Ich glaube, er ist südlich vom Dorf, wo die Blumen am dichtesten stehen.',
            ],
    },
  },
};

const bodo: DialogDef = {
  id: 'bodo',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Willkommen im Gasthof „Zum Ersten Tor"! Ein Bett kostet 20 Münzen – danach bist du wie neu.'],
      choices: [
        {
          text: 'Übernachten (20 Münzen)',
          if: (c) => c.g.inv.money >= 20,
          do: (c) => {
            c.g.inv.money -= 20;
            c.w.heal();
            c.g.clock = 7 * 60;
            c.g.day++;
            c.w.setRest();
            c.w.save();
            return 'slept';
          },
        },
        { text: 'Etwas essen', do: (c) => c.w.after(() => c.w.openShop('taufeld:gasthof')) },
        { text: 'Tschüss!' },
      ],
    },
    slept: { say: ['Gut geschlafen? Ein neuer Tag auf der Insel! Ich habe deinen Fortschritt im Gästebuch notiert.'] },
  },
};

const gasthof: DialogDef = { ...bodo, id: 'gasthof' };

registerDialogs([lumi, wilma, hilde, korbinian, pia, bodo, gasthof]);

/** Wegweiser für den Einstieg: nach dem Einordnen zurück zu Lumi, danach nach Runenhall */
function townPos(id: string, dx = 0, dy = 0): [number, number] {
  const t = TOWNS.find((x) => x.id === id);
  return [((t?.x ?? 0) + dx) * TILE + 8, ((t?.y ?? 0) + dy) * TILE + 8];
}

let guide: [number, number] | null = null;
registerModule({
  id: 'einstieg',
  maps: ['insel'],
  load() {
    guide = null;
  },
  update(h) {
    let stage = Game.quests.stage('q-start');
    const placed = Game.flags.has('lumi-start') && !Game.book.hand.some((c) => STARTER_CARDS.includes(Game.registry.idOf(c.uid)));
    if (stage >= 1 && stage <= 3 && placed && Game.visited.has('runenhall')) {
      Game.quests.set('q-start', 4);
      stage = 4;
    }
    if (stage === 2 && Game.prog.level >= 3) {
      Game.quests.set('q-start', 3);
      stage = 3;
      h.toast('Stufe 3 – jetzt bist du bereit für die Reise nach Runenhall im Norden. Folge dem Pfeil!');
    }
    let want: [number, number] | null = null;
    if (stage === 1 && placed) {
      if (!Game.flags.has('tipp:lumi-zurueck')) {
        Game.flags.add('tipp:lumi-zurueck');
        h.toast('Prima, die Karten sind im Buch! Sprich noch einmal mit Lumi – sie hat einen Rat für dich.');
      }
      const lumi = NPC_BY_ID.lumi;
      want = townPos(lumi.town ?? 'taufeld', lumi.x, lumi.y);
    } else if (stage === 3) want = townPos('runenhall');
    // den Pfeil anderer Aufgaben weder überschreiben noch löschen
    const cur = h.scene.registry.get('questTarget') as [number, number] | null | undefined;
    const same = (a: [number, number] | null | undefined, b: [number, number] | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
    const mine = !cur || same(cur, guide);
    if (want) {
      if (!mine || same(cur, want)) return;
      guide = want;
      h.setTarget(want[0], want[1]);
    } else if (guide) {
      if (cur && mine) h.setTarget(null);
      guide = null;
    }
  },
});
