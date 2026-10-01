import Phaser from 'phaser';
import { registerDialogs, type DialogCtx, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { registerModule, type WorldHost } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';
import { TILE } from '../../config';
import { TOWNS } from '../world/layout';
import { mini, reward, setStage, stage } from './util';
import { card } from '../cards';
import { PAL } from '../../gfx/palette';
import { charFrame } from '../../gfx/generators/characters';

registerQuests([
  {
    id: 'q-wasserdiebe',
    name: 'Die Wasserdiebe',
    where: 'Sandspiegel · Samira',
    steps: [
      'Samiras Zisterne verliert jede Nacht Wasser. Such mit Aura-Sinn nach drei Spuren rund um Sandspiegel.',
      'Die Spuren deuten auf Trugbilder! Warte nachts am Stadtbrunnen und stell die Diebe – nur mit Aura-Sinn kannst du sie sehen und treffen.',
      'Du hast die Wasserdiebe vertrieben. Samira hat dir Wüstentau-Moos geschenkt.',
    ],
  },
  {
    id: 'q-karawane',
    name: 'Die Handelskarawane',
    where: 'Rastfeuer südwestlich von Taufeld · Kasim',
    steps: ['Begleite Kasims Karawane vom Rastfeuer nach Sandspiegel. Bleib in der Nähe und halte die Wüstenmonster fern!', 'Die Karawane ist sicher angekommen. Kasim hat dir einen Karawanenkompass geschenkt.'],
  },
  {
    id: 'q-henne',
    name: 'Ein seltener Tausch',
    where: 'Sandspiegel · Karawanenzelt',
    steps: ['Kasim tauscht seine Diamanthenne gegen drei B-Karten aus deiner Hand oder deinen freien Slots.', 'Getauscht! Die Diamanthenne gehört dir.'],
  },
  {
    id: 'q-spiegel',
    name: 'Das Lichträtsel',
    where: 'Sandspiegel · Spiegelmeisterin Ilka',
    steps: ['Löse die drei Lichträtsel im Spiegelsaal.', 'Gelöst! Ilka hat dir den Spiegelschild überreicht.'],
  },
  {
    id: 'q-oase',
    name: 'Die verschüttete Oase',
    where: 'Sandspiegel · Händler Yusuf',
    steps: ['Irgendwo in der Wüste liegt der Oasenschlüssel begraben. Grab mit einer Schaufel an glitzernden Stellen.', 'Du hast den Oasenschlüssel gefunden! Das Felsentor im Südosten der Wüste öffnet sich damit.'],
  },
  {
    id: 'q-sphinx',
    name: 'Die Rätsel der Sphinx',
    where: 'Verborgene Oase · Sphinx der Stunden',
    steps: ['Beantworte die drei Rätsel der Sphinx der Stunden.', 'Die Sphinx hat dir den Sternenkompass überlassen.'],
  },
]);

const town = TOWNS.find((t) => t.id === 'sandspiegel')!;
const WELL = { x: town.x * TILE + 8, y: (town.y + 2) * TILE };

/** B-Karten in Hand und freien Slots */
function bCards(c: DialogCtx): number[] {
  const uids: number[] = [];
  for (const h of c.g.book.hand) if (card(c.g.registry.idOf(h.uid)).rank === 'B' && card(c.g.registry.idOf(h.uid)).kind === 'sammel') uids.push(h.uid);
  for (const u of c.g.book.frei) if (u !== null && card(c.g.registry.idOf(u)).rank === 'B' && card(c.g.registry.idOf(u)).kind === 'sammel') uids.push(u);
  return uids;
}

const samira: DialogDef = {
  id: 'samira',
  start: (c) => {
    const s = stage(c, 'q-wasserdiebe');
    if (s === 0) return 'hallo';
    if (s === 1) return 'spuren';
    if (s === 2) return 'nacht';
    return 'fertig';
  },
  nodes: {
    hallo: {
      say: [
        'Ich bin Samira und hüte die Zisterne. Jede Nacht fehlt Wasser – dabei schliesse ich sorgfältig ab!',
        'Kannst du dich umsehen? Vielleicht findest du Spuren. Man sagt, mit Aura-Sinn sieht man Dinge, die den Augen verborgen bleiben.',
      ],
      do: (c) => setStage(c, 'q-wasserdiebe', 1),
    },
    spuren: {
      say: (c) => {
        const n = [1, 2, 3].filter((i) => c.g.flags.has(`spur:${i}`)).length;
        return [`Du hast ${n} von 3 Spuren gefunden. Sie müssen rund um die Stadt liegen – schalte deinen Aura-Sinn ein!`];
      },
    },
    nacht: { say: ['Trugbilder?! Natürlich – nur mit Aura-Sinn zu sehen. Warte nachts am Brunnen in der Stadtmitte, dann erwischst du sie.'] },
    fertig: { say: ['Seit du die Trugbilder verjagt hast, bleibt die Zisterne voll. Das Wüstentau-Moos speichert übrigens Wasser wie ein Schwamm.'] },
  },
};

const kasim: DialogDef = {
  id: 'kasim',
  start: (c) => {
    if (!c.g.flags.has('karawane-angekommen')) return stage(c, 'q-karawane') === 1 ? 'unterwegs' : 'start';
    return c.g.quests.done('q-henne') ? 'danach' : 'tausch';
  },
  nodes: {
    start: {
      say: [
        'Salam, Reisende! Ich bin Kasim. Meine Karawane will nach Sandspiegel, aber in den Dünen lauern Kaktuskrieger und Dünenwühler.',
        'Begleitest du uns? Bleib in der Nähe – ohne Schutz gehen wir keinen Schritt. Als Lohn bekommst du einen Karawanenkompass.',
      ],
      choices: [
        {
          text: 'Ich begleite euch!',
          do: (c) => {
            setStage(c, 'q-karawane', 1);
            c.w.after(() => startCaravan());
          },
        },
        { text: 'Noch nicht.' },
      ],
    },
    unterwegs: {
      say: ['Bleib bei uns! Wenn Monster kommen, halten wir an.'],
      do: () => startCaravan(),
    },
    tausch: {
      say: (c) => [
        'Danke noch einmal für den Schutz! Übrigens: Ich habe eine Diamanthenne. Sie legt Eier, die wie Edelsteine glänzen.',
        `Ich tausche sie gegen drei B-Karten aus deiner Hand oder deinen freien Slots. (Du hast ${bCards(c).length} passende.)`,
      ],
      do: (c) => {
        if (stage(c, 'q-henne') === 0) setStage(c, 'q-henne', 1);
      },
      choices: [
        {
          text: 'Drei B-Karten tauschen',
          if: (c) => bCards(c).length >= 3,
          do: (c) => {
            for (const uid of bCards(c).slice(0, 3)) {
              c.g.book.remove(uid);
              c.g.registry.destroy(uid);
              c.g.quick = c.g.quick.map((q) => (q === uid ? null : q));
            }
            c.g.events.emit('book-changed');
            setStage(c, 'q-henne', 2);
            reward(c, '010');
          },
          goto: 'getauscht',
        },
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('sandspiegel:basar')) },
        { text: 'Später.' },
      ],
    },
    getauscht: { say: ['Ein fairer Handel! Pass gut auf sie auf – sie mag Sonnenblumenkerne.'] },
    danach: { say: ['Die Karawane zieht bald weiter. Möge dein Kompass dich immer heimführen!'] },
  },
};

const yusuf: DialogDef = {
  id: 'yusuf',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Willkommen, Wanderer! Wasser ist teuer, Rätsel sind gratis.'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('sandspiegel:basar')) },
        { text: 'Ein Rätsel, bitte!', goto: 'oase' },
        { text: 'Leb wohl!' },
      ],
    },
    oase: {
      say: [
        'Ha! Hier ist eines, das wahr ist: Einst lag im Südosten eine Oase hinter einem Felsentor. Der Schlüssel wurde im Sand begraben, an einem von fünf alten Brunnenplätzen.',
        'Glitzernde Stellen verraten sie. Mit einer Schaufel findest du ihn vielleicht – und hinter dem Tor wartet die Sphinx der Stunden.',
      ],
      do: (c) => {
        if (stage(c, 'q-oase') === 0) setStage(c, 'q-oase', c.g.flags.has('oasenschluessel') ? 2 : 1);
      },
      goto: 'a',
    },
  },
};

const ilka: DialogDef = {
  id: 'ilka',
  start: (c) => (c.g.quests.done('q-spiegel') ? 'fertig' : 'a'),
  nodes: {
    a: {
      say: ['Im Spiegelsaal wandert das Licht, wohin die Spiegel es lenken. Löse drei Rätsel, und der Spiegelschild gehört dir.'],
      choices: [
        {
          text: 'Rätsel lösen',
          do: (c) => {
            setStage(c, 'q-spiegel', 1);
            mini(c, 'Mirror', {
              onDone: (won) => {
                if (!won) return;
                setStage(c, 'q-spiegel', 2);
                c.w.toast('Ilka: „Das Licht gehorcht dir! Nimm den Spiegelschild."');
                reward(c, '018');
              },
            });
          },
        },
        { text: 'Später.' },
      ],
    },
    fertig: { say: ['Der Spiegelschild wirft Zauber zurück, wenn man ihn trägt. Möge er dich schützen.'] },
  },
};

function riddle(q: string, right: string, wrong: [string, string], next: string, order: number): DialogDef['nodes'][string] {
  const opts = [
    { text: right, goto: next },
    { text: wrong[0], goto: 'falsch' },
    { text: wrong[1], goto: 'falsch' },
  ];
  const perm = [[0, 1, 2], [1, 0, 2], [2, 1, 0]][order];
  return { say: [q], choices: perm.map((i) => opts[i]) };
}

const sphinx: DialogDef = {
  id: 'sphinx',
  start: (c) => (c.g.quests.done('q-sphinx') ? 'fertig' : 'a'),
  nodes: {
    a: {
      say: ['Sterbliche. Ich bin die Sphinx der Stunden. Drei Rätsel. Löse sie, und ich gebe dir, was dich immer zum Verlorenen führt.'],
      do: (c) => setStage(c, 'q-sphinx', 1),
      choices: [
        { text: 'Ich bin bereit.', goto: 'r1' },
        { text: 'Ein andermal.' },
      ],
    },
    r1: riddle('Ich habe Zeiger, doch ich zeige auf nichts. Ich habe ein Gesicht, doch keine Augen. Was bin ich?', 'Eine Uhr', ['Ein Kompass', 'Ein Spiegel'], 'r2', 1),
    r2: riddle('Ich laufe ohne Beine, ich fliehe ohne Flügel, und wer mich verliert, findet mich nie wieder. Was bin ich?', 'Die Zeit', ['Der Wind', 'Ein Fluss'], 'r3', 2),
    r3: riddle('Am Morgen lang, am Mittag kurz, am Abend wieder lang – und nachts verschwunden. Was bin ich?', 'Ein Schatten', ['Eine Kerze', 'Der Mond'], 'sieg', 0),
    falsch: { say: ['Die Sphinx gähnt, und Sand rieselt von ihren Pranken. „Falsch. Komm wieder, wenn die Sonne gewandert ist."'] },
    sieg: {
      say: ['Die Sphinx neigt den Kopf. „Drei Rätsel, drei Wahrheiten. Nimm den Sternenkompass. Seine Nadel sucht stets das, was dir noch fehlt."'],
      do: (c) => {
        setStage(c, 'q-sphinx', 2);
        reward(c, '005');
      },
    },
    fertig: { say: ['Die Stunden vergehen, Sterbliche. Nutze sie gut.'] },
  },
};

registerDialogs([samira, kasim, yusuf, ilka, sphinx]);

// ---------------------------------------------------------------- Karawane

const ROUTE: [number, number][] = [
  [106, 180],
  [100, 188],
  [93, 193],
  [86, 197],
  [86, 204],
];
const AMBUSH = [
  { at: 1, monsters: ['kaktuskrieger', 'duenenwuehler'] },
  { at: 2, monsters: ['duenenwuehler', 'duenenwuehler', 'kaktuskrieger'] },
  { at: 3, monsters: ['kaktuskrieger', 'kaktuskrieger', 'trugbild'] },
];

interface Caravan {
  sprite: Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  seg: number;
  hp: number;
  ambush: Set<number>;
  waitMsg: number;
}

let caravan: Caravan | null = null;
let startPending = false;

function startCaravan(): void {
  startPending = true;
}

function endCaravan(): void {
  if (!caravan) return;
  caravan.sprite.destroy();
  caravan.bar.destroy();
  caravan = null;
}

function spawnCaravan(h: WorldHost): void {
  endCaravan();
  const [sx, sy] = ROUTE[0];
  const x = sx * TILE + 8;
  const y = sy * TILE + 12;
  const sprite = h.scene.add.sprite(x, y, 'npc-kasim', charFrame('down', 'idle0')).setOrigin(0.5, 30 / 32).setTint(0xffe0b0);
  const bar = h.scene.add.graphics().setDepth(150000);
  caravan = { sprite, bar, x, y, seg: 1, hp: 100, ambush: new Set(), waitMsg: 0 };
  Game.flags.add('karawane-unterwegs');
  h.syncNpcs();
  h.toast('Die Karawane setzt sich in Bewegung. Bleib in ihrer Nähe!');
  h.setMusic('kampf');
}

registerModule({
  id: 'sandspiegel',
  maps: ['insel'],
  load() {
    caravan = null;
    startPending = false;
    // abgebrochene Eskorte (z. B. Spiel neu geladen): Kasim wartet wieder am Rastfeuer
    if (!Game.flags.has('karawane-angekommen')) Game.flags.delete('karawane-unterwegs');
  },
  update(h, dt) {
    // Spuren der Wasserdiebe
    const wd = Game.quests.stage('q-wasserdiebe');
    if (wd === 1 && [1, 2, 3].every((i) => Game.flags.has(`spur:${i}`))) {
      Game.quests.set('q-wasserdiebe', 2);
      h.toast('Alle Spuren deuten auf Trugbilder, die nachts zur Zisterne kommen. Erzähl es Samira – oder warte nachts am Brunnen!');
    }
    if (wd === 2 && Game.isNight() && Game.vars.get('diebe-nacht') !== Game.day) {
      if (Math.hypot(h.player.x - WELL.x, h.player.y - WELL.y) < 130) {
        Game.vars.set('diebe-nacht', Game.day);
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          const e = h.spawnMonster('trugbild', WELL.x + Math.cos(a) * 60, WELL.y + Math.sin(a) * 40, 'diebe');
          if (e) e.alerted = true;
        }
        h.toast('Schemenhafte Gestalten flimmern am Brunnen – die Wasserdiebe! Aura-Sinn an!');
      }
    }
    // Karawane
    if (startPending) {
      startPending = false;
      spawnCaravan(h);
    }
    const c = caravan;
    if (!c) return;
    const ambushers = h.enemies.list.filter((e) => e.active && e.tag === 'ambush');
    const threatened = ambushers.some((e) => Math.hypot(e.x - c.x, e.y - c.y) < 70);
    if (threatened) c.hp -= dt * 4 * ambushers.filter((e) => Math.hypot(e.x - c.x, e.y - c.y) < 70).length;
    const pd = Math.hypot(h.player.x - c.x, h.player.y - c.y);
    const moving = !threatened && ambushers.length === 0 && pd < 110;
    if (!moving && pd >= 110 && ambushers.length === 0) {
      c.waitMsg -= dt;
      if (c.waitMsg <= 0) {
        c.waitMsg = 8;
        h.toast('Kasim ruft: „Warte auf uns! Ohne dich gehen wir nicht weiter."');
      }
    }
    if (moving) {
      const [tx, ty] = ROUTE[c.seg];
      const px = tx * TILE + 8;
      const py = ty * TILE + 12;
      const dx = px - c.x;
      const dy = py - c.y;
      const d = Math.hypot(dx, dy);
      const sp = 22;
      if (d < sp * dt + 1) {
        c.x = px;
        c.y = py;
        // Hinterhalt an bestimmten Wegpunkten
        const amb = AMBUSH.find((a) => a.at === c.seg);
        if (amb && !c.ambush.has(c.seg)) {
          c.ambush.add(c.seg);
          amb.monsters.forEach((id, k) => {
            const a = (k / amb.monsters.length) * Math.PI * 2 + 0.6;
            const e = h.spawnMonster(id, c.x + Math.cos(a) * 80, c.y + Math.sin(a) * 60, 'ambush');
            if (e) e.alerted = true;
          });
          h.toast('Hinterhalt! Beschütze die Karawane!');
        }
        c.seg++;
        if (c.seg >= ROUTE.length) {
          endCaravan();
          Game.flags.add('karawane-angekommen');
          Game.quests.set('q-karawane', 2);
          h.setMusic(null);
          h.setTarget(null);
          h.syncNpcs();
          h.toast('Geschafft! Die Karawane erreicht Sandspiegel. Kasim schenkt dir einen Karawanenkompass.');
          h.giveCard('065');
          return;
        }
      } else {
        c.x += (dx / d) * sp * dt;
        c.y += (dy / d) * sp * dt;
      }
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      c.sprite.setFrame(charFrame(dir, Math.floor(h.scene.time.now / 200) % 2 ? 'walkA' : 'walkB'));
    }
    c.sprite.setPosition(Math.round(c.x), Math.round(c.y)).setDepth(c.y);
    c.bar.clear();
    c.bar.fillStyle(PAL.ink).fillRect(c.x - 13, c.y - 38, 26, 4);
    c.bar.fillStyle(c.hp > 40 ? PAL.lime : PAL.orange).fillRect(c.x - 12, c.y - 37, Math.max(0, (24 * c.hp) / 100), 2);
    h.setTarget(c.x, c.y);
    if (c.hp <= 0) {
      endCaravan();
      Game.quests.set('q-karawane', 1);
      Game.flags.delete('karawane-unterwegs');
      h.syncNpcs();
      h.setMusic(null);
      h.setTarget(null);
      for (const e of h.enemies.list) if (e.active && e.tag === 'ambush') e.hide();
      h.toast('Die Karawane musste umkehren … Kasim wartet wieder am Rastfeuer.');
    }
  },
  kill(h, _def, e) {
    if (e.tag === 'diebe' && Game.quests.stage('q-wasserdiebe') === 2) {
      const left = h.enemies.list.filter((x) => x.active && x.tag === 'diebe').length;
      if (left === 0) {
        Game.quests.set('q-wasserdiebe', 3);
        h.toast('Die Trugbilder lösen sich in Luft auf. Samira schenkt dir Wüstentau-Moos!');
        h.giveCard('060');
      }
    }
  },
  died(h) {
    if (caravan) {
      endCaravan();
      Game.flags.delete('karawane-unterwegs');
      Game.quests.set('q-karawane', 1);
      h.setMusic(null);
      h.setTarget(null);
    }
  },
});

// Oasenschlüssel gefunden → Quest aktualisieren
registerModule({
  id: 'oase-quest',
  maps: ['insel'],
  update() {
    if (Game.flags.has('oasenschluessel') && Game.quests.stage('q-oase') < 2) Game.quests.set('q-oase', 2);
  },
});
