import { registerDialogs, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { registerModule, worldHost, type WorldHost } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';
import { reward, setStage, stage } from './util';
import { PAL } from '../../gfx/palette';
import { Sound } from '../../audio/AudioEngine';
import type { WorldObject } from '../../world/WorldMap';

registerQuests([
  {
    id: 'q-aussicht',
    name: 'Sieben Aussichten',
    where: 'Überall auf der Insel',
    steps: ['Setz dich auf alle sieben Aussichtsbänke der Insel. Sie stehen an Orten mit weitem Blick.', 'Alle Aussichtspunkte besucht! Die Kartografenfeder zeichnet nun die ganze Insel.'],
  },
  {
    id: 'q-muehlen',
    name: 'Die stillen Mühlen',
    where: 'Windhalmfelder · Müller Anton',
    steps: [
      'Repariere die drei Windmühlen der Windhalmfelder. Mit einem Kletterseil (Nr. 092) kommst du an die Flügel.',
      'Alle Mühlen drehen sich wieder! Anton hat dir die Wetterfahne geschenkt. Jede Mühle schenkt dir einmal am Tag einen Mehlsack.',
    ],
  },
  {
    id: 'q-statuen',
    name: 'Die Statuen von Alt-Kartheim',
    where: 'Ruinen von Alt-Kartheim',
    steps: ['Richte die vier Statuen nach dem Rätsel auf der Tafel aus (Statue antippen = drehen).', 'Die Statuen blicken in die richtigen Richtungen – der Kartheimer Siegelstein gehört dir.'],
  },
  {
    id: 'q-rennen',
    name: 'Das Zeitrennen',
    where: 'Ruinen von Alt-Kartheim · Chronistin Ilse',
    steps: ['Lauf in 75 Sekunden zu allen acht Kontrollfahnen in den Ruinen. Sprich mit Ilse, um zu starten.', 'Rekord! Ilse hat dir die Sanduhr des Stillstands geschenkt.'],
  },
  {
    id: 'q-irrlicht',
    name: 'Das Irrlicht-Rätsel',
    where: 'Nebelhain · Kräuterhexe Mara',
    steps: ['Entzünde die vier Laternen auf der Lichtung im Nebelhain in der richtigen Reihenfolge. Die Inschrift im Moos verrät sie.', 'Die Laternen leuchten – ein Irrlicht ist in dein Glas geschlüpft!'],
  },
  {
    id: 'q-forscher',
    name: 'Der verirrte Forscher',
    where: 'Nebelhain',
    steps: ['Forscher Edmund irrt im Nordwesten des Nebelhains umher. Mit einer Lichtquelle findet ihr gemeinsam hinaus.', 'Edmund ist sicher zurück in Runenhall und hat dir sein Forscherfernglas geschenkt.'],
  },
]);

// ---------------------------------------------------------------- Dialoge

const anton: DialogDef = {
  id: 'anton',
  start: (c) => {
    const s = stage(c, 'q-muehlen');
    if (s === 0) return 'hallo';
    if (s === 1) return 'warten';
    return 'fertig';
  },
  nodes: {
    hallo: {
      say: [
        'Grüss dich! Ich bin Anton, Müller der Windhalmfelder. Seit dem letzten Sturm stehen alle drei Mühlen still – die Flügel haben sich verhakt.',
        'Ich bin zu alt, um da hinaufzuklettern. Mit einem Kletterseil kämst du an die Flügel. Hilfst du mir?',
      ],
      choices: [
        { text: 'Klar!', do: (c) => setStage(c, 'q-muehlen', 1) },
        { text: 'Später.' },
      ],
    },
    warten: {
      say: (c) => {
        const n = [1, 2, 3].filter((i) => c.g.flags.has(`muehle:${i}`)).length;
        return [`${n} von 3 Mühlen drehen sich wieder. ${c.g.hasThing('092') ? 'Geh einfach an eine stillstehende Mühle heran.' : 'Ohne Kletterseil wird das nichts – es gibt welche in Möwenhafen und Hohenkamm.'}`];
      },
    },
    fertig: { say: ['Hörst du das? Das Klappern der Mühlen ist die schönste Musik! Hol dir ruhig jeden Tag einen Mehlsack ab.'] },
  },
};

const ilse: DialogDef = {
  id: 'ilse',
  start: (c) => (c.g.quests.done('q-rennen') ? 'danach' : 'a'),
  nodes: {
    a: {
      say: [
        'Chronistin Ilse, ich erforsche Alt-Kartheim. Die alten Kartheimer liefen jedes Jahr ein Rennen durch die Ruinen – acht Fahnen in 75 Sekunden!',
        'Ich habe die Fahnen wieder aufgestellt. Traust du dich? Wer es schafft, bekommt die Sanduhr des Stillstands aus meiner Sammlung.',
      ],
      choices: [
        {
          text: 'Auf die Plätze!',
          do: (c) => {
            setStage(c, 'q-rennen', 1);
            c.w.after(() => startRace());
          },
        },
        { text: 'Was weisst du über die Statuen?', goto: 'statuen' },
        { text: 'Später.' },
      ],
    },
    statuen: {
      say: ['Die vier Statuen nördlich von hier sollen auf die vier Himmelsrichtungen zeigen. Die Tafel daneben verrät, wohin welche blicken muss. Antippen dreht sie.'],
      goto: 'a',
    },
    danach: {
      say: ['Du warst schneller als jeder Kartheimer! Willst du zum Spass noch einmal laufen?'],
      choices: [
        { text: 'Los!', do: (c) => c.w.after(() => startRace()) },
        { text: 'Nein danke.' },
      ],
    },
  },
};

const mara: DialogDef = {
  id: 'mara',
  start: (c) => (c.g.quests.done('q-irrlicht') ? 'danach' : 'a'),
  nodes: {
    a: {
      say: [
        'Hihi, Besuch am Nebelrand! Ich bin Mara und sammle Kräuter, die nur im Nebel wachsen.',
        'Siehst du die Lichtung im Südwesten mit den vier alten Laternen? Wer sie in der richtigen Reihenfolge entzündet, lockt ein Irrlicht an, das sich zähmen lässt.',
      ],
      do: (c) => {
        if (stage(c, 'q-irrlicht') === 0) setStage(c, 'q-irrlicht', 1);
      },
      choices: [
        { text: 'Wozu ein Irrlicht?', goto: 'wozu' },
        { text: 'Danke!' },
      ],
    },
    wozu: {
      say: ['Ein gezähmtes Irrlicht kennt jeden Weg durch den Nebel. Tief im Westen versperrt eine Nebelwand das Herz des Waldes – mit einem Irrlicht im Glas kommst du hindurch.'],
    },
    danach: { say: ['Dein Irrlicht summt so zufrieden! Pass auf im Herzen des Nebelhains – dort wohnt die Nebelmutter.'] },
  },
};

const forscher: DialogDef = {
  id: 'forscher',
  start: (c) => {
    if (c.g.flags.has('forscher-gerettet')) return 'zuhause';
    return worldHost()?.player.lightOn ? 'licht' : 'dunkel';
  },
  nodes: {
    dunkel: {
      say: ['Hallo? Ist da jemand? Ich bin Edmund, Forscher. Ich wollte die Glimmerhöhle kartieren und hab mich im Nebel verlaufen.', 'Ohne Licht sehe ich nicht einmal meine Stiefel. Hast du eine Laterne? Dann finden wir zusammen hinaus.'],
      do: (c) => {
        if (stage(c, 'q-forscher') === 0) setStage(c, 'q-forscher', 1);
      },
    },
    licht: {
      say: ['Ein Licht! Endlich! Ich folge dir einfach … Ah, da ist der Weg nach Runenhall. Danke, danke!', 'Nimm mein Fernglas. Damit siehst du Monster und herumliegende Karten schon von Weitem.'],
      do: (c) => {
        c.g.flags.add('forscher-gerettet');
        setStage(c, 'q-forscher', 2);
        reward(c, '042');
      },
    },
    zuhause: { say: ['Ich bleibe jetzt erst mal in Runenhall und schreibe meine Notizen ins Reine. Der Nebelhain kann warten!'] },
  },
};

const seitentuer: DialogDef = {
  id: 'seitentuer',
  start: () => 'a',
  nodes: {
    a: {
      say: [{ who: 'Tür ohne Schloss', text: 'Die Tinte auf der Tür bewegt sich und formt Worte: „Ich bin voller Worte und habe doch keine Stimme. Ich bin geschlossen und öffne Welten. Sprich, was ich bin."' }],
      choices: [
        { text: '„Eine Tür."', goto: 'nein' },
        {
          text: '„Ein Buch."',
          do: (c) => {
            const h = worldHost();
            const i = h ? h.map.findByTag('tor:seitentuer') : -1;
            if (h && i >= 0) h.hideObject(i, 'genommen:tor:seitentuer');
            reward(c, '032');
          },
          goto: 'ja',
        },
        { text: '„Ein Mund."', goto: 'nein' },
      ],
    },
    nein: { say: [{ who: 'Tür ohne Schloss', text: 'Die Tinte verläuft zu einem Kopfschütteln. Die Tür bleibt verschlossen.' }] },
    ja: { say: [{ who: 'Tür ohne Schloss', text: 'Die Tür seufzt und zerfällt zu losen Seiten. Eine davon ist ein Schlüssel aus Papier: der Seitenschlüssel.' }] },
  },
};

registerDialogs([anton, ilse, mara, forscher, seitentuer]);

// ---------------------------------------------------------------- Welt-Logik

const STATUE_SOLUTION = [3, 2, 0, 1];
const IRRLICHT_ORDER = [1, 2, 3, 4];

let host: WorldHost | null = null;
let views: { x: number; y: number; n: number }[] = [];
let checkT = 0;
let race: { t: number; left: Set<number> } | null = null;
let raceStart = false;
let lit: number[] = [];

function startRace(): void {
  raceStart = true;
}

function objIdx(h: WorldHost, tag: string): number {
  return h.map.findByTag(tag);
}

function setRaceFlags(h: WorldHost, show: boolean): void {
  for (let i = 1; i <= 8; i++) {
    const idx = objIdx(h, `rennen:${i}`);
    if (idx < 0) continue;
    if (show) h.showObject(idx);
    else {
      h.map.removeObject(idx);
      h.refreshObject(idx);
    }
  }
}

function lampPos(h: WorldHost, n: number): WorldObject | null {
  const i = objIdx(h, `irrlampe:${n}`);
  return i >= 0 ? h.map.objects[i] : null;
}

registerModule({
  id: 'wildnis',
  maps: ['insel'],
  load(h) {
    host = h;
    // Aussichtsbänke
    views = [];
    h.map.objects.forEach((o) => {
      if (o.tag?.startsWith('aussicht:')) views.push({ x: o.x, y: o.y, n: Number(o.tag.slice(9)) });
    });
    // Mühlen: kaputt oder drehend
    for (let i = 1; i <= 3; i++) {
      const fixed = Game.flags.has(`muehle:${i}`);
      const broken = objIdx(h, `muehle-kaputt:${i}`);
      const working = objIdx(h, `muehle:${i}`);
      const hide = fixed ? broken : working;
      if (hide >= 0) h.map.removeObject(hide);
    }
    // Rennfahnen nur während des Rennens
    race = null;
    raceStart = false;
    setRaceFlags(h, false);
    lit = Game.quests.done('q-irrlicht') ? [...IRRLICHT_ORDER] : [];
  },
  update(h, dt) {
    // Aussichtspunkte: Hinsetzen genügt
    checkT -= dt;
    if (checkT <= 0) {
      checkT = 0.3;
      for (const v of views) {
        if (Game.flags.has(`aussicht:${v.n}`)) continue;
        if (Math.hypot(h.player.x - v.x, h.player.y - v.y) < 22) {
          Game.flags.add(`aussicht:${v.n}`);
          if (Game.quests.stage('q-aussicht') === 0) Game.quests.set('q-aussicht', 1);
          const n = [1, 2, 3, 4, 5, 6, 7].filter((i) => Game.flags.has(`aussicht:${i}`)).length;
          Sound.play('ding');
          h.sparkle(v.x, v.y - 10, PAL.sky, 8);
          if (n >= 7) {
            Game.quests.set('q-aussicht', 2);
            h.toast('Was für ein Blick! Du hast alle sieben Aussichtspunkte gesehen. In deiner Tasche raschelt eine Feder …');
            h.giveCard('021');
          } else h.toast(`Was für eine Aussicht! (${n}/7 Aussichtspunkte)`);
        }
      }
      // Statuen-Rätsel
      if (!Game.flags.has('statuen-geloest')) {
        const frames = [1, 2, 3, 4].map((i) => Game.vars.get(`statue:${i}`) ?? 0);
        if (frames.some((f) => f !== 0) && Game.quests.stage('q-statuen') === 0) Game.quests.set('q-statuen', 1);
        if (frames.every((f, i) => f === STATUE_SOLUTION[i])) {
          Game.flags.add('statuen-geloest');
          Game.quests.set('q-statuen', 2);
          const s = h.map.objects[objIdx(h, 'statue:1')];
          if (s) h.sparkle(s.x + 4, s.y - 10, PAL.gold, 16);
          h.shake(3, 300);
          Sound.play('unleash');
          h.toast('Ein Grollen geht durch die Ruinen. Zwischen den Statuen hebt sich ein Stein: der Kartheimer Siegelstein!');
          h.giveCard('051');
        }
      }
    }
    // Zeitrennen
    if (raceStart) {
      raceStart = false;
      race = { t: 75, left: new Set([1, 2, 3, 4, 5, 6, 7, 8]) };
      setRaceFlags(h, true);
      Sound.play('whistle');
      h.toast('Los! Lauf zu allen acht Fahnen!');
    }
    if (race) {
      race.t -= dt;
      h.setTimer(`Fahnen ${8 - race.left.size}/8`, race.t);
      let nearest: WorldObject | null = null;
      let nd = 1e9;
      for (const n of race.left) {
        const idx = objIdx(h, `rennen:${n}`);
        const o = h.map.objects[idx];
        if (!o) continue;
        const d = Math.hypot(h.player.x - o.x, h.player.y - o.y);
        if (d < 18) {
          race.left.delete(n);
          h.map.removeObject(idx);
          h.refreshObject(idx);
          h.sparkle(o.x, o.y - 12, PAL.cyan, 8);
          Sound.play('ding', { rate: 1 + (8 - race.left.size) * 0.06 });
        } else if (d < nd) {
          nd = d;
          nearest = o;
        }
      }
      if (nearest) h.setTarget(nearest.x, nearest.y);
      if (race.left.size === 0) {
        race = null;
        h.setTimer(null);
        h.setTarget(null);
        Sound.play('fanfare');
        if (!Game.quests.done('q-rennen')) {
          Game.quests.set('q-rennen', 2);
          h.toast('Geschafft! Ilse ist begeistert und schenkt dir die Sanduhr des Stillstands.');
          h.giveCard('008');
        } else h.toast('Wieder unter der Zeit – Ilse applaudiert!');
      } else if (race.t <= 0) {
        race = null;
        h.setTimer(null);
        h.setTarget(null);
        setRaceFlags(h, false);
        Sound.play('lose');
        h.toast('Die Zeit ist um! Sprich mit Ilse für einen neuen Versuch.');
      }
    }
    // entzündete Irrlicht-Laternen leuchten
    h.extraLights.length = 0;
    for (const n of lit) {
      const o = lampPos(h, n);
      if (o) h.extraLights.push({ x: o.x, y: o.y - 24, radius: 52, color: 0x9fe8ff });
    }
  },
  interact(h, o, idx) {
    const tag = o.tag ?? '';
    // Mühlen
    if (tag.startsWith('muehle-kaputt:')) {
      const n = tag.slice(14);
      if (Game.quests.stage('q-muehlen') === 0) {
        h.message('Windmühle', 'Die Flügel stehen still und sind ineinander verhakt. Vielleicht weiss der Müller in der Nähe Rat.');
        return true;
      }
      if (!Game.hasThing('092')) {
        h.message('Windmühle', 'Die Flügel hängen zu hoch. Mit einem Kletterseil kämst du hinauf.');
        return true;
      }
      Game.flags.add(`muehle:${n}`);
      h.map.removeObject(idx);
      h.refreshObject(idx);
      const w = objIdx(h, `muehle:${n}`);
      if (w >= 0) h.showObject(w);
      Sound.play('dig');
      h.shake(2, 200);
      const done = [1, 2, 3].filter((i) => Game.flags.has(`muehle:${i}`)).length;
      if (done >= 3) {
        Game.quests.set('q-muehlen', 2);
        h.toast('Alle drei Mühlen drehen sich wieder! Müller Anton schenkt dir seine Wetterfahne.');
        h.giveCard('037');
      } else h.toast(`Du kletterst hinauf und löst die verhakten Flügel. Die Mühle dreht sich! (${done}/3)`);
      return true;
    }
    if (tag.startsWith('muehle:')) {
      const n = tag.slice(7);
      if (Game.vars.get(`mehl:${n}`) === Game.day) {
        h.message('Windmühle', 'Die Mühle klappert fleissig. Morgen gibt es wieder frisches Mehl.');
        return true;
      }
      Game.vars.set(`mehl:${n}`, Game.day);
      h.toast('Der Müller hat dir einen Sack Mehl bereitgestellt.');
      h.giveCard('099');
      return true;
    }
    // Irrlicht-Laternen
    if (tag.startsWith('irrlampe:')) {
      const n = Number(tag.slice(9));
      if (Game.quests.done('q-irrlicht')) {
        h.message('Laterne', 'Ein kaltes, blaues Licht flackert darin.');
        return true;
      }
      if (lit.includes(n)) return true;
      lit.push(n);
      Sound.play('auraOn', { rate: 1 + lit.length * 0.1 });
      if (IRRLICHT_ORDER[lit.length - 1] !== n) {
        h.toast('Die Laternen flackern – und erlöschen alle zugleich. Falsche Reihenfolge!');
        Sound.play('auraOff');
        lit = [];
        return true;
      }
      if (lit.length === 4) {
        Game.quests.set('q-irrlicht', 2);
        const c = lampPos(h, 2);
        if (c) h.sparkle(c.x, c.y + 20, PAL.ice, 16);
        h.toast('Alle vier Laternen leuchten blau. Ein Irrlicht schwebt herbei und schlüpft zutraulich in ein Glas!');
        h.giveCard('043');
      }
      return true;
    }
    return false;
  },
  kill() {
    /* nichts */
  },
  died(h) {
    if (race) {
      race = null;
      h.setTimer(null);
      h.setTarget(null);
    }
  },
});

// Kristalle in der Glimmerhöhle mit einem Aufladeschlag abbauen
Game.events.on('player-strike', (x, y, r, kind) => {
  const h = host && Game.player.map === 'glimmerhoehle' ? worldHost() : null;
  if (!h || (kind !== 'charge' && kind !== '2')) return;
  h.map.objects.forEach((o, i) => {
    if (!o.tag?.startsWith('kristall:') || o.hidden) return;
    if (Math.hypot(o.x - x, o.y - 8 - y) > r + 10) return;
    if (kind !== 'charge') {
      h.toast('Der Kristall vibriert. Ein kräftiger Aufladeschlag (Angriff halten) würde ihn lösen.');
      return;
    }
    h.hideObject(i, `genommen:${o.tag}`);
    Sound.play('crit');
    h.toast('Der Kristall bricht ab – ein Aurakristall!');
    h.giveCard('027');
  });
});

registerModule({
  id: 'glimmerhoehle',
  maps: ['glimmerhoehle'],
  load(h) {
    host = h;
  },
});

// Wurzelpforte im Herzen des Nebelhains
registerModule({
  id: 'nebelherz',
  maps: ['nebelherz'],
  interact(h, o, idx) {
    if (o.tag !== 'tor:wurzelpforte') return false;
    if (Game.hasThing('012')) {
      h.hideObject(idx, 'genommen:tor:wurzelpforte');
      h.toast('Die Ranken zucken vor dem Dornenring zurück und geben den Weg frei.');
      return true;
    }
    h.message('Wurzelpforte', 'Dicke, dornige Wurzeln versperren den Weg. Sie scheinen nur vor etwas noch Dornigerem zurückzuweichen …');
    return true;
  },
});

// Tür ohne Schloss im Labyrinth
registerModule({
  id: 'labyrinth',
  maps: ['labyrinth'],
  interact(h, o) {
    if (o.tag !== 'tor:seitentuer') return false;
    h.talk('seitentuer');
    return true;
  },
});

// Wege, die Karten öffnen
const GATES: Record<string, { need: string[]; text: string }> = {
  oase: { need: ['030'], text: 'Ein Felsentor mit einer grünen Steintür. In der Mitte ist eine Mulde – wie für einen Schlüssel geformt.' },
  nebelherz: { need: ['043', '003'], text: 'Der Nebel ist so dicht, dass du die Hand vor Augen nicht siehst. Ein Licht, das den Weg kennt, könnte dich führen …' },
  adlerhorst: { need: ['017'], text: 'Eine steile, glatte Felswand. Mit einer Kletterranke käme man hinauf.' },
  gipfel: { need: ['022'], text: 'Eine tiefe Schlucht trennt dich vom Gipfelpfad. Die alte Brücke ist eingestürzt – eine Rankenbrücke müsste her.' },
  labyrinth: { need: ['003'], text: 'Schwarzer Tintennebel quillt die Treppe herauf. Ohne ein Licht, das niemals erlischt, wagst du dich nicht hinab.' },
  muschelgrotte: { need: ['011'], text: 'Der Eingang der Grotte liegt unter Wasser. Wer hier hinein will, muss unter Wasser atmen können.' },
};

registerModule({
  id: 'tore',
  warpCheck(_h, target) {
    const g = GATES[target];
    if (!g) return null;
    return g.need.some((id) => Game.hasThing(id)) ? null : g.text;
  },
});
