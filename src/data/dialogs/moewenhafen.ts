import { registerDialogs, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { registerModule, type WorldHost } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';
import { TILE } from '../../config';
import { TOWNS } from '../world/layout';
import { has, mini, nextStormDay, reward, setStage, stage } from './util';
import { isStormNight } from '../../systems/Weather';
import { PAL } from '../../gfx/palette';

registerQuests([
  {
    id: 'q-seetor',
    name: 'Der Wächter am Seetor',
    where: 'Möwenhafen · Wächter Bertram',
    steps: [
      'Wächter Bertram lässt niemanden ohne Hafenpass aufs Boot. Frag Hafenmeisterin Marlene.',
      'Zangenkrabben haben Marlenes Hafenstempel an den Strand südöstlich der Stadt geschleppt. Besiege den Krabbenkönig!',
      'Du hast den Hafenstempel zurückerobert. Bring ihn Marlene.',
      'Marlene hat dir den Hafenpass ausgestellt. Das Boot am Steg bringt dich zu den Möwenklippen.',
    ],
  },
  {
    id: 'q-logbuch',
    name: 'Das verlorene Logbuch',
    where: 'Möwenhafen · Hafenmeisterin Marlene',
    steps: [
      'Marlenes altes Logbuch ging auf den Möwenklippen verloren. Das Boot am Steg bringt dich hinüber.',
      'Du hast das Logbuch gefunden. Bring es Marlene zurück.',
      'Marlene hat dir das Wolkenfloss geschenkt – damit erreichst du die Insel im Silbersee.',
    ],
  },
  {
    id: 'q-angeln',
    name: 'Jorns Angelwette',
    where: 'Möwenhafen · Fischer Jorn',
    steps: ['Fischer Jorn wettet, dass du keine drei Fische in einer Minute fängst. Du brauchst eine Bambusangel (Nr. 083).', 'Wette gewonnen! Jorn hat dir einen Silberfisch geschenkt.'],
  },
  {
    id: 'q-leuchtfeuer',
    name: 'Das Leuchtfeuer',
    where: 'Möwenhafen · Leuchtturmwärterin Tilda',
    steps: [
      'In Sturmnächten erlischt das Leuchtfeuer. Komm in einer Sturmnacht zu Tilda an den Leuchtturm (jede dritte Nacht zieht ein Sturm auf).',
      'Halte die Quallenlichter eine Minute lang vom Leuchtturm fern, während Tilda das Feuer entzündet!',
      'Das Leuchtfeuer brennt wieder. Tilda hat dir die Leuchtturmlinse geschenkt.',
    ],
  },
]);

const town = TOWNS.find((t) => t.id === 'moewenhafen')!;
const BEACH = { x: (town.x + 12) * TILE, y: (town.y + 17) * TILE };

const marlene: DialogDef = {
  id: 'marlene',
  start: (c) => {
    const s = stage(c, 'q-seetor');
    if (s <= 1) return s === 1 ? 'auftrag' : 'hallo';
    if (s === 2) return 'warten';
    if (s === 3) return 'stempel';
    const l = stage(c, 'q-logbuch');
    if (l === 0) return 'logbuchFrage';
    if (l === 1) return c.g.flags.has('logbuch-gefunden') ? 'logbuchDa' : 'logbuchWarten';
    return 'fertig';
  },
  nodes: {
    hallo: {
      say: ['Hafenmeisterin Marlene, angenehm. Hier im Hafen läuft nichts ohne meinen Stempel – nicht einmal die Möwen.'],
      choices: [
        { text: 'Ich hätte gern einen Hafenpass.', do: (c) => setStage(c, 'q-seetor', 1), goto: 'auftrag' },
        { text: 'Nur mal umsehen.' },
      ],
    },
    auftrag: {
      say: [
        'Einen Hafenpass? Gern – wenn ich meinen Stempel hätte! Heute Morgen haben ihn Zangenkrabben vom Tisch gezwickt und an den Strand südöstlich der Stadt geschleppt.',
        'Ihr Anführer, ein besonders dicker Krabbenkönig, hütet ihn wie einen Schatz. Pass auf: Von vorn ist sein Panzer hart – greif ihn von hinten oder von der Seite an!',
      ],
      do: (c) => setStage(c, 'q-seetor', 2),
    },
    warten: { say: ['Der Krabbenkönig sitzt am Strand südöstlich der Stadt. Von hinten angreifen – vorne ist er gepanzert!'] },
    stempel: {
      say: ['Mein Stempel! Ein bisschen sandig, aber er tut es noch. *Klonk* – bitte sehr, dein Hafenpass. Bertram wird dich nun durchlassen.'],
      do: (c) => {
        reward(c, '015');
        setStage(c, 'q-seetor', 4);
      },
    },
    logbuchFrage: {
      say: [
        'Ach, wo du schon einen Pass hast … Mein altes Logbuch liegt irgendwo auf den Möwenklippen. Letzten Herbst hat mir eine Möwe die Tasche geklaut, und das Buch fiel heraus.',
        'Darin stehen dreissig Jahre Wind und Wetter. Bringst du es mir zurück? Ich hätte da etwas Besonderes als Dank.',
      ],
      choices: [
        { text: 'Ich suche es!', do: (c) => setStage(c, 'q-logbuch', c.g.flags.has('logbuch-gefunden') ? 1 : 1) },
        { text: 'Später vielleicht.' },
      ],
    },
    logbuchWarten: { say: ['Das Logbuch muss irgendwo auf den Klippen liegen, zwischen den Möwennestern. Das Boot am Steg bringt dich hin.'] },
    logbuchDa: {
      say: [
        'Mein Logbuch! Und die Seite mit dem Sturm von damals ist noch da … Danke!',
        'Hier, nimm dieses Wolkenfloss. Ich hab es einem fahrenden Händler abgekauft und nie benutzt. Auf dem Silbersee bringt es dich zur kleinen Insel – angeblich steht dort ein alter Schrein.',
      ],
      do: (c) => {
        reward(c, '006');
        setStage(c, 'q-logbuch', 3);
      },
    },
    fertig: { say: ['Wind aus Westen, leichte Dünung. Gute Zeiten zum Segeln – und zum Kartensammeln.'] },
  },
};

const bertram: DialogDef = {
  id: 'bertram',
  start: (c) => (has(c, '015') || c.g.hasThing('015') ? 'pass' : 'halt'),
  nodes: {
    halt: {
      say: ['Halt! Hinter mir liegt das Seetor. Ohne Hafenpass setzt niemand einen Fuss auf das Boot – Befehl der Hafenmeisterin.'],
      do: (c) => {
        if (stage(c, 'q-seetor') === 0) setStage(c, 'q-seetor', 1);
      },
      goto: 'tipp',
    },
    tipp: { say: ['Marlene wohnt im blaugrünen Haus südwestlich vom Brunnen. Vielleicht stellt sie dir einen Pass aus.'] },
    pass: { say: ['Ah, ein gültiger Hafenpass. Das Boot am Ende des Stegs bringt dich zu den Möwenklippen. Gute Fahrt – und Vorsicht vor den Möwen, die stehlen alles!'] },
  },
};

const greta: DialogDef = {
  id: 'greta',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Ahoi! Taue, Haken, Angeln – alles, was ein Seebär braucht.'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('moewenhafen:hafenladen')) },
        { text: 'Wozu brauche ich eine Angel?', goto: 'angel' },
        { text: 'Tschüss!' },
      ],
    },
    angel: { say: ['Zum Angeln natürlich! Fischer Jorn am Fischstand wettet mit jedem, der eine hat. Und wer gewinnt, bekommt einen Silberfisch – den lieben die Katzen in Würfelheim.'], goto: 'a' },
  },
};

const jorn: DialogDef = {
  id: 'jorn',
  start: (c) => (c.g.quests.done('q-angeln') ? 'danach' : 'a'),
  nodes: {
    a: {
      say: ['Ich bin Jorn, bester Angler der Insel! Wetten, dass du keine drei Fische in einer Minute fängst? Gewinnst du, kriegst du einen Silberfisch.'],
      choices: [
        {
          text: 'Wette angenommen!',
          if: (c) => has(c, '083') || c.g.hasThing('083'),
          do: (c) => {
            setStage(c, 'q-angeln', 1);
            mini(c, 'Fishing', {
              mode: 'wette',
              onDone: (won) => {
                if (won) {
                  setStage(c, 'q-angeln', 2);
                  c.w.toast('Jorn staunt: „Drei Stück! Na gut, Wette ist Wette."');
                  reward(c, '067');
                } else c.w.toast('Jorn grinst: „Hab ich doch gesagt! Komm wieder, wenn du geübt hast."');
              },
            });
          },
        },
        {
          text: 'Ich habe keine Angel.',
          if: (c) => !has(c, '083') && !c.g.hasThing('083'),
          do: (c) => setStage(c, 'q-angeln', 1),
          goto: 'keineAngel',
        },
        { text: 'Fisch kaufen', do: (c) => c.w.after(() => c.w.openShop('moewenhafen:fisch')) },
        { text: 'Nein danke.' },
      ],
    },
    keineAngel: { say: ['Ohne Bambusangel wird das nichts. Greta im Hafenladen hat welche. Und vergiss nicht: Karten aus der Hand muss man erst ins Buch legen!'] },
    danach: {
      say: ['Na, du Meisterangler? Willst du noch ein bisschen angeln? Ich kaufe dir jeden Fisch ab.'],
      choices: [
        {
          text: 'Angeln gehen',
          if: (c) => has(c, '083') || c.g.hasThing('083'),
          do: (c) =>
            mini(c, 'Fishing', {
              mode: 'frei',
              onDone: (_won, score) => {
                if (score >= 3 && Math.random() < 0.5 && Game.registry.canCreate('067')) {
                  c.w.toast('Jorn: „Für so einen Fang gibt es einen Silberfisch extra!"');
                  c.w.giveCard('067');
                }
              },
            }),
        },
        { text: 'Fisch kaufen', do: (c) => c.w.after(() => c.w.openShop('moewenhafen:fisch')) },
        { text: 'Bis bald!' },
      ],
    },
  },
};

const tilda: DialogDef = {
  id: 'tilda',
  start: (c) => {
    const s = stage(c, 'q-leuchtfeuer');
    if (s >= 3) return 'fertig';
    if (s === 2) return 'kampf';
    const forced = c.g.vars.get('wetter-art') === 2 && (c.g.vars.get('wetter-bis') ?? 0) > c.g.day * 1440 + c.g.clock && c.g.isNight();
    if (isStormNight(c.g.day, c.g.clock) || forced) return 'sturm';
    return s === 0 ? 'hallo' : 'warten';
  },
  nodes: {
    hallo: {
      say: [
        'Willkommen am Leuchtturm! Ich bin Tilda. Bei klarem Wetter ist hier alles ruhig – aber in Sturmnächten …',
        '… flackert das Leuchtfeuer und geht aus. Dann kommen die Quallenlichter aus dem Meer und umschwirren den Turm, damit ich das Feuer nicht wieder anzünden kann.',
        'Hilfst du mir in der nächsten Sturmnacht? Es stürmt jede dritte Nacht.',
      ],
      do: (c) => setStage(c, 'q-leuchtfeuer', 1),
      goto: 'warten',
    },
    warten: {
      say: (c) => {
        const d = nextStormDay(c.g.day);
        const when = d === c.g.day ? 'heute Nacht' : d === c.g.day + 1 ? 'morgen Nacht' : `in ${d - c.g.day} Tagen`;
        return [`Der nächste Sturm kommt ${when}. Am Rastfeuer kannst du bis zum Abend warten. Komm dann zu mir!`];
      },
    },
    sturm: {
      say: ['Da bist du ja! Hörst du den Wind? Das Feuer ist aus, und die Quallenlichter kommen schon. Halte sie mir eine Minute lang vom Leib!'],
      choices: [
        {
          text: 'Los geht\'s!',
          do: (c) => {
            setStage(c, 'q-leuchtfeuer', 2);
            c.w.after(() => startDefense());
          },
        },
        { text: 'Moment noch …' },
      ],
    },
    kampf: { say: ['Weiter so! Lass keine Qualle an die Flamme!'] },
    fertig: { say: ['Das Feuer brennt hell. Dank dir finden die Schiffe den Weg. Die Linse? Die bündelt jedes Licht – damit siehst du Dinge, die sich verstecken.'] },
  },
};

const kneipenwirt: DialogDef = {
  id: 'kneipenwirt',
  start: () => 'a',
  nodes: {
    a: {
      say: [
        'Willkommen in der „Nassen Möwe"! Hier erzählen sich Seeleute die besten Geschichten.',
        'Man sagt, im Hafenbecken haust eine riesige Krake. Und in der Muschelgrotte im Osten soll ein Schatz liegen – aber hinein kommt nur, wer unter Wasser atmen kann.',
      ],
      choices: [
        { text: 'Erzähl mehr!', goto: 'mehr' },
        { text: 'Danke.' },
      ],
    },
    mehr: {
      say: ['Der alte Kapitän Möwenbart meinte, eine Perle aus der Tiefe lasse einen unter Wasser atmen. Wer die findet … Prost!'],
    },
  },
};

const pit: DialogDef = {
  id: 'pit',
  start: () => 'a',
  nodes: {
    a: {
      say: (c) => [
        c.g.isNight() ? 'Nachts leuchten über dem Hafen Quallen! Die sind hübsch, aber sie zappeln mit Blitzen.' : 'Ich bin Pit, Schiffsjunge! Eines Tages fahre ich durchs Seetor bis ans Ende der Welt!',
        'Wusstest du, dass Zangenkrabben nur von hinten verwundbar sind? Vorne haben sie ihre dicken Scheren.',
      ],
    },
  },
};

registerDialogs([marlene, bertram, greta, jorn, tilda, kneipenwirt, pit]);

// ---------------------------------------------------------------- Welt-Logik

let defense: { t: number; wave: number; lx: number; ly: number } | null = null;

function startDefense(): void {
  const i = Game.player.map === 'insel' ? findLighthouse() : null;
  if (!i) return;
  defense = { t: 60, wave: 0, lx: i.x, ly: i.y };
}

let lighthouseCache: { x: number; y: number } | null = null;
let hostRef: WorldHost | null = null;

function findLighthouse(): { x: number; y: number } | null {
  if (lighthouseCache) return lighthouseCache;
  const h = hostRef;
  if (!h) return null;
  const idx = h.map.findByTag('leuchtturm');
  if (idx < 0) return null;
  const o = h.map.objects[idx];
  lighthouseCache = { x: o.x, y: o.y + 10 };
  return lighthouseCache;
}

/** freie Stelle in der Nähe suchen */
function freeSpot(h: WorldHost, x: number, y: number): { x: number; y: number } {
  for (let r = 0; r < 40; r++) {
    const a = r * 2.4;
    const px = x + Math.cos(a) * r * 6;
    const py = y + Math.sin(a) * r * 6;
    if (!h.map.boxBlocked(px - 6, py - 5, 12, 5)) return { x: px, y: py };
  }
  return { x, y };
}

registerModule({
  id: 'moewenhafen',
  maps: ['insel'],
  load(h) {
    hostRef = h;
    lighthouseCache = null;
    if (Game.quests.stage('q-leuchtfeuer') === 2) Game.quests.set('q-leuchtfeuer', 1);
    defense = null;
  },
  update(h, dt) {
    // Krabbenkönig erscheint, sobald man sich dem Strand nähert
    if (Game.quests.stage('q-seetor') === 2) {
      const near = Math.hypot(h.player.x - BEACH.x, h.player.y - BEACH.y) < 220;
      const alive = h.enemies.list.some((e) => e.active && e.tag === 'krabbenkoenig');
      if (near && !alive) {
        const p = freeSpot(h, BEACH.x, BEACH.y);
        const e = h.spawnMonster('zangenkrabbe', p.x, p.y, 'krabbenkoenig');
        if (e) {
          e.empower(5, 1.6, 1.6);
          h.toast('Ein riesiger Krabbenkönig klappert drohend mit den Scheren!');
        }
      }
      if (near) h.setTarget(BEACH.x, BEACH.y);
    }
    // Verteidigung des Leuchtturms
    if (defense) {
      const d = defense;
      const dist = Math.hypot(h.player.x - d.lx, h.player.y - d.ly);
      if (dist > 300) {
        h.toast('Du hast den Leuchtturm verlassen – das Feuer ist wieder aus.');
        Game.quests.set('q-leuchtfeuer', 1);
        h.setTimer(null);
        defense = null;
        return;
      }
      d.t -= dt;
      h.setTimer('Leuchtfeuer', d.t);
      const wave = Math.floor((60 - d.t) / 9);
      if (wave >= d.wave && d.t > 4) {
        d.wave = wave + 1;
        const n = 2 + Math.min(3, wave);
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2;
          const e = h.spawnMonster('quallenlicht', d.lx + Math.cos(a) * 120, d.ly + Math.sin(a) * 80, 'leucht');
          if (e) e.alerted = true;
        }
      }
      if (d.t <= 0) {
        defense = null;
        h.setTimer(null);
        for (const e of h.enemies.list) if (e.active && e.tag === 'leucht') h.enemies.damage(e, { dmg: 9999, crit: false }, { fromX: d.lx, fromY: d.ly, kb: 0, src: 'special' });
        Game.quests.set('q-leuchtfeuer', 3);
        h.flash(PAL.gold, 400);
        h.toast('Das Leuchtfeuer flammt auf und taucht das Meer in goldenes Licht! Tilda schenkt dir die Leuchtturmlinse.');
        h.giveCard('039');
      }
    }
  },
  kill(h, _def, e) {
    if (e.tag === 'krabbenkoenig' && Game.quests.stage('q-seetor') === 2) {
      Game.quests.set('q-seetor', 3);
      h.setTarget(null);
      h.toast('Der Krabbenkönig lässt den Hafenstempel fallen! Bring ihn Marlene.');
    }
  },
  died(h) {
    if (defense) {
      defense = null;
      h.setTimer(null);
      Game.quests.set('q-leuchtfeuer', 1);
    }
  },
});
