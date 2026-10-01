import { registerDialogs, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { registerModule } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';
import { TILE } from '../../config';
import { TOWNS } from '../world/layout';
import { has, mini, reward, setStage, stage } from './util';
import { KLIPPENBALL_TEAMS } from '../../scenes/mini/KlippenballScene';
import { PAL } from '../../gfx/palette';

registerQuests([
  {
    id: 'q-training',
    name: 'Brakkas Prüfungen',
    where: 'Hohenkamm · Meisterin Brakka',
    steps: [
      'Erste Prüfung: Zerschlage sechs Strohpuppen innerhalb von 30 Sekunden. Sprich mit Brakka, wenn du bereit bist.',
      'Zweite Prüfung: Besiege fünf Felsböcke auf den Pfaden um Hohenkamm.',
      'Dritte Prüfung: Zeig Brakka deine Spezialtechnik (ab Stufe 5) – setz sie in ihrer Nähe ein.',
      'Du hast alle Prüfungen bestanden. Brakka hat dir ihr Trainingsgewicht geschenkt.',
    ],
  },
  {
    id: 'q-turnier',
    name: 'Das Turnier im Felsenkessel',
    where: 'Hohenkamm · Arenameister Horst',
    steps: ['Besiege im Felsenkessel fünf Gegnerwellen hintereinander. Horst lässt dich ab Stufe 5 antreten.', 'Du hast das Turnier gewonnen und den Arenagürtel erhalten!'],
  },
  {
    id: 'q-frostblume',
    name: 'Der frierende Eiswächter',
    where: 'Hohenkamm · Eiswächter Isgard',
    steps: ['Isgard friert bitterlich. Bring ihm eine Warme Wolldecke (Nr. 090) – Oma Hilde in Taufeld strickt welche.', 'Isgard ist warm eingepackt und hat dir eine Frostblume geschenkt.'],
  },
  {
    id: 'q-klippenball',
    name: 'Die Klippenball-Meisterschaft',
    where: 'Hohenkamm · Kapitänin Föhn',
    steps: ['Gewinne drei Klippenball-Spiele: gegen die Bergziegen, die Lawinen und im Finale gegen die Gipfelstürmer.', 'Du bist Klippenball-Meister! Der Taschenozean gehört dir.'],
  },
]);

const town = TOWNS.find((t) => t.id === 'hohenkamm')!;
const DUMMY_SPOTS: [number, number][] = [[-15, 4], [-12, 6], [-9, 4], [-14, 8], [-6, 6], [-10, 8]];

const brakka: DialogDef = {
  id: 'brakka',
  start: (c) => {
    const s = stage(c, 'q-training');
    if (s === 0) return 'hallo';
    if (s === 1) return 'p1';
    if (s === 2) return c.g.kills('felsbock') - (c.g.vars.get('training-base') ?? 0) >= 5 ? 'p2fertig' : 'p2';
    if (s === 3) return 'p3';
    return 'fertig';
  },
  nodes: {
    hallo: {
      say: ['Ich bin Brakka. Wer stark werden will, kommt zu mir. Drei Prüfungen: Schlagkraft, Ausdauer, Aura. Wer alle besteht, bekommt mein altes Trainingsgewicht.'],
      choices: [
        { text: 'Ich bin bereit!', do: (c) => setStage(c, 'q-training', 1), goto: 'p1' },
        { text: 'Später.' },
      ],
    },
    p1: {
      say: ['Erste Prüfung: Schlagkraft. Sechs Strohpuppen, dreissig Sekunden. Los, wenn du so weit bist!'],
      choices: [
        { text: 'Puppen aufstellen!', do: (c) => c.w.after(() => startDummies()) },
        { text: 'Noch nicht.' },
      ],
    },
    p2: {
      say: (c) => {
        const n = Math.max(0, c.g.kills('felsbock') - (c.g.vars.get('training-base') ?? 0));
        return [`Zweite Prüfung: Ausdauer. ${n} von 5 Felsböcken besiegt. Sie lauern auf den Pfaden um das Dorf – und stossen kräftig zu!`];
      },
    },
    p2fertig: {
      say: ['Fünf Felsböcke! Nicht schlecht. Dritte Prüfung: Aura. Zeig mir deine Spezialtechnik – hier, vor meinen Augen. (Ab Stufe 5.)'],
      do: (c) => setStage(c, 'q-training', 3),
    },
    p3: { say: ['Ich warte auf deine Spezialtechnik! Das Aura-Rad (Aura-Taste halten) hilft dir beim Wählen.'] },
    fertig: { say: ['Du hast Muskeln in den Armen und Feuer in der Aura. Komm jederzeit wieder trainieren!'] },
  },
};

const horst: DialogDef = {
  id: 'horst',
  start: (c) => (c.g.quests.done('q-turnier') ? 'champion' : 'a'),
  nodes: {
    a: {
      say: ['Horst Felsfaust, Arenameister! Im Felsenkessel kämpfen die Mutigsten der Insel gegen fünf Wellen wilder Monster. Wer gewinnt, trägt den Arenagürtel.'],
      choices: [
        {
          text: 'Ich trete an!',
          if: (c) => c.g.prog.level >= 5,
          do: (c) => {
            setStage(c, 'q-turnier', 1);
            c.g.vars.set('arena-aktiv', 1);
            c.w.warp('felsenkessel');
          },
        },
        { text: 'Ich trete an!', if: (c) => c.g.prog.level < 5, goto: 'zuschwach' },
        { text: 'Lieber zuschauen.' },
      ],
    },
    zuschwach: { say: ['Ha! Erst ab Stufe 5, Kleines. Trainier bei Brakka und komm wieder.'] },
    champion: {
      say: ['Unser Champion! Willst du zur Übung noch einmal antreten? Für den Sieg gibt es 300 Münzen.'],
      choices: [
        {
          text: 'Auf in den Kessel!',
          do: (c) => {
            c.g.vars.set('arena-aktiv', 1);
            c.w.warp('felsenkessel');
          },
        },
        { text: 'Heute nicht.' },
      ],
    },
  },
};

const horstArena: DialogDef = {
  id: 'horst-arena',
  start: (c) => (c.g.vars.get('arena-aktiv') ? 'laeuft' : 'a'),
  nodes: {
    laeuft: { say: ['Konzentrier dich auf die Monster!'] },
    a: {
      say: ['Noch eine Runde? Oder zurück ins Dorf? Die Treppe hinter mir führt hinaus.'],
      choices: [
        {
          text: 'Noch eine Runde!',
          do: (c) => {
            c.g.vars.set('arena-aktiv', 1);
            c.w.after(() => arenaStart());
          },
        },
        { text: 'Erst mal Pause.' },
      ],
    },
  },
};

const isgard: DialogDef = {
  id: 'isgard',
  start: (c) => (c.g.quests.done('q-frostblume') ? 'warm' : 'a'),
  nodes: {
    a: {
      say: (c) => [
        'B-b-brrr. Ich bin Isgard, der Eiswächter. Ich bewache den Gletscher – aber mir ist so k-k-kalt.',
        has(c, '090') || c.g.inv.bag.has('090') ? 'Ist das … eine Warme Wolldecke? Würdest du sie mir geben?' : 'Eine warme Wolldecke wäre ein Traum. Angeblich strickt eine Oma in Taufeld die besten.',
      ],
      do: (c) => {
        if (stage(c, 'q-frostblume') === 0) setStage(c, 'q-frostblume', 1);
      },
      choices: [
        {
          text: 'Wolldecke geben',
          if: (c) => has(c, '090') || c.g.inv.bag.has('090'),
          do: (c) => {
            if (!c.g.takeCards('090', 1)) c.g.inv.removeItem('090');
            setStage(c, 'q-frostblume', 2);
            reward(c, '041');
          },
          goto: 'danke',
        },
        { text: 'Halt durch!' },
      ],
    },
    danke: { say: ['Aaah … wohlig warm! Hier, eine Frostblume. Sie blüht nur im ewigen Eis – und schmilzt nie.'] },
    warm: { say: ['Mit der Decke ist der Gletscher richtig gemütlich. Danke noch mal!'] },
  },
};

const huettenwirt: DialogDef = {
  id: 'huettenwirt',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Servus in der Berghütte! Suppe wärmt, Seil sichert. Was darf es sein?'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('hohenkamm:huette')) },
        { text: 'Was gibt es am Gipfel?', goto: 'gipfel' },
        { text: 'Pfiat di!' },
      ],
    },
    gipfel: {
      say: [
        'Auf dem Gipfel nistet Sturmgreif Kragor. Aber der Weg dorthin führt über eine tiefe Schlucht – die Brücke ist vor Jahren eingestürzt.',
        'Man sagt, ein besonderer Samen könne eine Rankenbrücke wachsen lassen. Und an der Felswand im Westen klettern Mutige mit einer Kletterranke zum Adlerhorst.',
      ],
      goto: 'a',
    },
  },
};

const foehn: DialogDef = {
  id: 'foehn',
  start: (c) => (c.g.quests.done('q-klippenball') ? 'meister' : 'a'),
  nodes: {
    a: {
      say: (c) => {
        const r = c.g.vars.get('klippenball-runde') ?? 0;
        return [
          'Kapitänin Föhn, Klippenball-Liga! Zwei gegen zwei, drei Tore gewinnen. Mein Mitspieler Pit spielt mit dir.',
          `Dein nächster Gegner: ${KLIPPENBALL_TEAMS[Math.min(2, r)]}. ${r === 2 ? 'Das Finale! Die Gipfelstürmer sind schnell und treffsicher.' : ''}`,
        ];
      },
      choices: [
        {
          text: 'Anpfiff!',
          do: (c) => {
            if (stage(c, 'q-klippenball') === 0) setStage(c, 'q-klippenball', 1);
            const r = c.g.vars.get('klippenball-runde') ?? 0;
            mini(c, 'Klippenball', {
              level: r + 1,
              onDone: (won) => {
                if (!won) {
                  c.w.toast('Föhn: „Kopf hoch! Revanche jederzeit."');
                  return;
                }
                const next = r + 1;
                c.g.vars.set('klippenball-runde', next);
                if (next >= 3) {
                  setStage(c, 'q-klippenball', 2);
                  c.w.toast('Ihr habt die Gipfelstürmer geschlagen – ihr seid Klippenball-Meister!');
                  reward(c, '001');
                } else c.w.toast(`Sieg gegen ${KLIPPENBALL_TEAMS[r]}! Als Nächstes: ${KLIPPENBALL_TEAMS[next]}.`);
              },
            });
          },
        },
        { text: 'Wie geht das?', goto: 'regeln' },
        { text: 'Später.' },
      ],
    },
    regeln: { say: ['Laufen, und mit Angriff schiessen – in Laufrichtung oder Richtung Tor. Ausweichen ist ein kurzer Sprint. Lauf hinter den Ball, dann schiesst es sich leichter!'], goto: 'a' },
    meister: {
      say: ['Unsere Meister! Lust auf ein Freundschaftsspiel?'],
      choices: [
        { text: 'Klar!', do: (c) => mini(c, 'Klippenball', { level: 3 }) },
        { text: 'Ein andermal.' },
      ],
    },
  },
};

registerDialogs([brakka, horst, horstArena, isgard, huettenwirt, foehn]);

// ---------------------------------------------------------------- Welt-Logik

let dummies: { t: number } | null = null;
let arena: { wave: number; pause: number } | null = null;
let spezialSeen = false;

Game.events.on('technique-used', (id) => {
  if (id === 'spezial') spezialSeen = true;
});

function startDummies(): void {
  dummies = { t: 30 };
  spawnDummiesFlag = true;
}
let spawnDummiesFlag = false;

const WAVES: string[][] = [
  ['felsbock', 'felsbock', 'felsbock'],
  ['frostfuchs', 'frostfuchs', 'frostfuchs', 'frostfuchs'],
  ['donnerwidder', 'donnerwidder', 'kaktuskrieger', 'kaktuskrieger'],
  ['nebelwolf', 'nebelwolf', 'nebelwolf', 'nebelwolf'],
  ['gipfeladler', 'moosgolem', 'donnerwidder', 'gipfeladler'],
];

function arenaStart(): void {
  arena = { wave: 0, pause: 2.5 };
}

registerModule({
  id: 'hohenkamm',
  maps: ['insel'],
  load() {
    dummies = null;
    spawnDummiesFlag = false;
  },
  update(h, dt) {
    // Prüfung 1: Strohpuppen
    if (dummies) {
      if (spawnDummiesFlag) {
        spawnDummiesFlag = false;
        for (const [dx, dy] of DUMMY_SPOTS) h.spawnMonster('strohpuppe', (town.x + dx) * TILE + 8, (town.y + dy) * TILE + 8, 'puppe');
        h.toast('Los! Zerschlage alle sechs Strohpuppen!');
      }
      dummies.t -= dt;
      h.setTimer('Strohpuppen', dummies.t);
      const left = h.enemies.list.filter((e) => e.active && e.tag === 'puppe').length;
      if (left === 0) {
        dummies = null;
        h.setTimer(null);
        Game.quests.set('q-training', 2);
        Game.vars.set('training-base', Game.kills('felsbock'));
        h.toast('Alle Puppen zerschlagen! Brakka nickt anerkennend. Zweite Prüfung: fünf Felsböcke.');
      } else if (dummies.t <= 0) {
        dummies = null;
        h.setTimer(null);
        for (const e of h.enemies.list) if (e.active && e.tag === 'puppe') e.hide();
        h.toast('Zu langsam! Brakka stellt neue Puppen auf, wenn du es nochmal versuchen willst.');
      }
    }
    // Prüfung 3: Spezialtechnik vor Brakka
    if (spezialSeen) {
      spezialSeen = false;
      const b = { x: (town.x - 10) * TILE + 8, y: (town.y + 1) * TILE + 12 };
      if (Game.quests.stage('q-training') === 3 && Math.hypot(h.player.x - b.x, h.player.y - b.y) < 140) {
        Game.quests.set('q-training', 4);
        h.toast('Brakka: „DAS nenne ich Aura! Du hast alle Prüfungen bestanden. Nimm mein Trainingsgewicht!"');
        h.giveCard('061');
      }
    }
  },
});

registerModule({
  id: 'felsenkessel',
  maps: ['felsenkessel'],
  load(h) {
    arena = null;
    if (Game.vars.get('arena-aktiv')) {
      arenaStart();
      h.toast('Willkommen im Felsenkessel! Fünf Wellen – halte durch!');
    }
  },
  update(h, dt) {
    if (!arena) return;
    const alive = h.enemies.list.some((e) => e.active && e.tag === 'arena');
    if (alive) return;
    arena.pause -= dt;
    if (arena.pause > 0) return;
    if (arena.wave >= WAVES.length) {
      arena = null;
      Game.vars.delete('arena-aktiv');
      h.flash(PAL.gold, 300);
      if (!Game.quests.done('q-turnier')) {
        Game.quests.set('q-turnier', 2);
        h.toast('Die Menge tobt! Du hast das Turnier gewonnen – der Arenagürtel gehört dir!');
        h.giveCard('014');
      } else {
        Game.inv.money += 300;
        Game.events.emit('vitals-changed');
        h.toast('Sieg im Felsenkessel! +300 Münzen.');
      }
      return;
    }
    const list = WAVES[arena.wave];
    const cx = 18 * TILE;
    const cy = 10 * TILE;
    list.forEach((id, k) => {
      const a = (k / list.length) * Math.PI * 2;
      const e = h.spawnMonster(id, cx + Math.cos(a) * 90, cy + Math.sin(a) * 50, 'arena');
      if (e) {
        e.alerted = true;
        if (arena!.wave === WAVES.length - 1 && k === 0) e.empower(2, 1.3, 1.3);
      }
    });
    arena.wave++;
    arena.pause = 2.5;
    h.toast(arena.wave === WAVES.length ? 'Letzte Welle – der Champion betritt den Kessel!' : `Welle ${arena.wave} von ${WAVES.length}!`);
  },
  died() {
    arena = null;
    Game.vars.delete('arena-aktiv');
  },
});
