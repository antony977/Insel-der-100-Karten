import { registerDialogs, type DialogCtx, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { registerModule, type WorldHost } from '../../systems/WorldModules';
import { Game } from '../../systems/GameState';
import { RIVAL_BY_ID, ensureRivals, tickRivals, placeRivals } from '../../systems/RivalAI';
import { SAMMELKARTEN, card } from '../cards';
import { attackEffect, playerSide, rivalSide } from '../../systems/Spells';
import type { ChoiceData } from '../../scenes/ChoiceScene';
import type { RivalState } from '../../systems/Rivals';
import { TOWNS } from '../world/layout';
import { TILE } from '../../config';
import { Sound } from '../../audio/AudioEngine';
import { PAL } from '../../gfx/palette';

registerQuests([
  {
    id: 'q-aschenhand',
    name: 'Die Aschenhand',
    where: 'Überall auf der Insel',
    steps: [
      'Eine Bande versiegelt die Bücher anderer Sammler: die Aschenhand. Frag Mila Sturmfeder – sie zieht zwischen Möwenhafen, Taufeld und Runenhall umher.',
      'Stelle die drei Handlanger der Aschenhand: Grell (östlich von Hohenkamm), Vesper (südöstlich von Würfelheim) und Nox (nördlich von Rosenweil am Nebelrand).',
      'Die Handlanger verraten ihre Anführerin: Varga Aschenherz. Gewinne zwei Verbündete unter den freundlichen Sammlern.',
      'Deine Verbündeten haben Vargas Versteck gefunden: die Aschenhalle unter den Ruinen von Alt-Kartheim. Stelle Varga!',
      'Varga ist besiegt. Die versiegelten Bücher sind wieder frei – und das Aschensiegel gehört dir.',
    ],
  },
]);

const HENCHMEN: { id: string; town: string; dx: number; dy: number; spell: string; intro: string; confess: string }[] = [
  {
    id: 'grell',
    town: 'hohenkamm',
    dx: 14,
    dy: 10,
    spell: 'Z05',
    intro: 'Grell knackt mit den Fingern: „Noch ein Sammler? Deine Karten brennen bestimmt gut!"',
    confess: 'Grell keucht: „Varga … Varga Aschenherz gibt die Befehle. Sie will alle hundert Karten – für sich allein."',
  },
  {
    id: 'vesper',
    town: 'wuerfelheim',
    dx: 16,
    dy: 10,
    spell: 'Z11',
    intro: 'Vesper lächelt kühl: „Ich weiss genau, welche Karten du hast. Und gleich ist dein Buch versiegelt."',
    confess: 'Vesper lässt ihre Notizen fallen: Listen mit Namen von Sammlern – und unterschrieben mit einem Aschenherz.',
  },
  {
    id: 'nox',
    town: 'rosenweil',
    dx: 0,
    dy: -20,
    spell: 'Z01',
    intro: 'Nox taucht aus dem Nebel auf: „Danke für die Karten – die nehme ich mit!"',
    confess: 'Nox gibt auf: „Die gestohlenen Karten bringen wir in die Ruinen. Varga sammelt sie in einer Halle unter der Erde."',
  },
];

const rivalOf = (c: DialogCtx): RivalState | undefined => Game.rivals.get((c.npc?.id ?? '').replace('rivale-', ''));

const INTRO: Record<string, string> = {
  mila: 'Hallo! Ich bin Mila Sturmfeder – Sammlerin und Händlerin. Ich tausche gern fair, und gemeinsam sammelt es sich leichter!',
  bruno: 'Bruno Kessel! Ich sammle Karten, wenn ich nicht gerade im Felsenkessel kämpfe. Wenn du Muskeln brauchst – ruf mich!',
  frida: 'Frida Funkel, Rätselforscherin. Jede Karte ist ein Rätsel – und ich liebe Rätsel. Soll ich dir einen Hinweis verraten?',
  juna: 'Ich bin Juna, und das da ist mein Bruder Lio. Wir sammeln zusammen – zu zweit findet man doppelt so viel!',
  lio: 'Lio Tannwald. Juna redet immer für uns beide. Aber ich finde die besseren Verstecke!',
  tjark: 'Tjark Wellenbrecher. Ich bin zur See gefahren und weiss Dinge, die andere nicht wissen. Für ein paar Münzen erzähle ich sie dir.',
};

/** Fehlende Sammelkarte mit Hinweis */
function missingHint(): string {
  const missing = SAMMELKARTEN.filter((k) => Game.book.sammel[k.no] === null);
  if (!missing.length) return 'Du hast ja schon alle Karten! Unglaublich.';
  const k = missing[Math.floor(Math.random() * missing.length)];
  return `Über „${k.name}" (${k.id}) habe ich gehört: ${k.hint}`;
}

/** Tauschangebot: eine Karte, die dem Spieler fehlt */
function offerOf(r: RivalState): number | null {
  const lacks = (uid: number) => {
    const id = Game.registry.idOf(uid);
    const c = card(id);
    return c.kind === 'sammel' ? Game.book.sammel[c.no] === null : true;
  };
  return r.book.frei.find(lacks) ?? null;
}

function tradeChoice(c: DialogCtx, r: RivalState, offer: number): void {
  const mine: number[] = [...Game.book.hand.map((h) => h.uid), ...Game.book.frei.filter((u): u is number => u !== null)];
  if (!mine.length) {
    c.w.toast('Du hast keine Karten in der Hand oder in den freien Slots zum Tauschen.');
    return;
  }
  const want = card(Game.registry.idOf(offer));
  const order = ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
  const minRank = Math.max(0, order.indexOf(want.rank) - 1);
  const data: ChoiceData = {
    title: `Für „${want.name}" (${want.rank}) – welche Karte gibst du?`,
    options: mine.map((u) => {
      const k = card(Game.registry.idOf(u));
      return { label: `${k.id} ${k.name} (${k.rank})`, value: String(u), disabled: order.indexOf(k.rank) < minRank };
    }),
    onPick: (v) => {
      const give = Number(v);
      if (!Game.book.locate(give) || !r.book.frei.includes(offer)) return;
      Game.book.remove(give);
      Game.quick = Game.quick.map((q) => (q === give ? null : q));
      Game.rivals.receive(r, give, Game.registry);
      Game.rivals.remove(r, offer);
      playerSide().receive(offer);
      Sound.play('cardGet');
      c.w.toast(`Getauscht! ${r.name} freut sich über die Karte.`);
    },
  };
  c.w.openScene('Choice', data);
}

const rivale: DialogDef = {
  id: 'rivale',
  start: (c) => {
    const r = rivalOf(c);
    if (!r) return 'leer';
    if (r.id === 'mila' && Game.quests.stage('q-aschenhand') === 1) return 'milaHilfe';
    if (!r.met) return 'hallo';
    return 'a';
  },
  nodes: {
    leer: { say: ['…'] },
    hallo: {
      say: (c) => [INTRO[rivalOf(c)?.id ?? ''] ?? 'Hallo!'],
      do: (c) => {
        const r = rivalOf(c);
        if (r) r.met = true;
      },
      goto: 'a',
    },
    a: {
      say: (c) => {
        const r = rivalOf(c)!;
        const gebannt = r.buffs.has('gebannt');
        return [
          gebannt
            ? `${r.name} seufzt: „Mein Buch ist versiegelt. Ich kann nicht einmal hineinschauen …"`
            : `${r.name} hat ${r.book.sammel.size} Karten in den Sammelseiten.${r.ally ? ' (Verbündet)' : ''}`,
        ];
      },
      choices: [
        { text: 'Plaudern', goto: 'tipp' },
        {
          text: 'Tauschen',
          if: (c) => RIVAL_BY_ID[rivalOf(c)?.id ?? '']?.attitude !== 'gefaehrlich' && !rivalOf(c)?.buffs.has('gebannt'),
          goto: 'tausch',
        },
        {
          text: 'Wissen kaufen (100 Münzen)',
          if: (c) => rivalOf(c)?.id === 'tjark' && c.g.inv.money >= 100,
          do: (c) => {
            c.g.inv.money -= 100;
            c.g.events.emit('vitals-changed');
          },
          goto: 'wissen',
        },
        {
          text: 'Lass uns Verbündete sein!',
          if: (c) => RIVAL_BY_ID[rivalOf(c)?.id ?? '']?.attitude === 'freundlich' && !rivalOf(c)?.ally,
          goto: 'allianz',
        },
        { text: 'Bis bald!' },
      ],
    },
    tipp: { say: () => [missingHint()], goto: 'a' },
    wissen: { say: () => ['Tjark beugt sich vor und senkt die Stimme.', missingHint()], goto: 'a' },
    tausch: {
      say: (c) => {
        const r = rivalOf(c)!;
        const o = offerOf(r);
        if (o === null) return ['Im Moment habe ich nichts, was dir fehlt. Frag mich später wieder!'];
        const k = card(Game.registry.idOf(o));
        return [`Ich hätte „${k.name}" (${k.id}, Rang ${k.rank}). Gibst du mir dafür eine Karte von mindestens ähnlichem Rang?`];
      },
      choices: [
        {
          text: 'Karte zum Tausch wählen',
          if: (c) => offerOf(rivalOf(c)!) !== null,
          do: (c) => {
            const r = rivalOf(c)!;
            const o = offerOf(r)!;
            c.w.after(() => tradeChoice(c, r, o));
          },
        },
        { text: 'Zurück', goto: 'a' },
      ],
    },
    allianz: {
      say: (c) => {
        const r = rivalOf(c)!;
        if (c.g.book.collectedCount() < 10) return [`${r.name} lacht: „Sammel erst ein paar Karten mehr – dann reden wir über eine Allianz!" (ab 10 Karten)`];
        return [`${r.name} schlägt ein: „Abgemacht! Wir halten zusammen. Hier – ein kleines Geschenk zum Anfang."`];
      },
      do: (c) => {
        const r = rivalOf(c)!;
        if (c.g.book.collectedCount() < 10) return;
        r.ally = true;
        r.met = true;
        const gift = ['Z13', 'Z18', 'Z19', 'Z21'].find((z) => c.g.registry.canCreate(z));
        if (gift) c.w.giveCard(gift);
      },
    },
    milaHilfe: {
      say: [
        'Mila sitzt blass auf dem Brunnenrand. „Du kommst wie gerufen. Gestern hat mich ein grober Kerl namens Grell überfallen …"',
        '„Er hat meine besten Karten genommen und mein Buch mit einem Bannzauber versiegelt. Er gehört zur Aschenhand – drei Handlanger und eine Anführerin, die niemand kennt."',
        '„Grell treibt sich östlich von Hohenkamm herum, Vesper südöstlich von Würfelheim und Nox nördlich von Rosenweil am Nebelrand. Bitte – halte sie auf!"',
        '„Und pass auf: Sie zaubern im Kampf! Schutzzauber wie Laubschild oder Bannkreis helfen."',
      ],
      do: (c) => {
        const r = rivalOf(c);
        if (r) r.met = true;
        c.g.quests.set('q-aschenhand', 2);
      },
    },
  },
};

const varga: DialogDef = {
  id: 'varga',
  start: (c) => (c.g.quests.stage('q-aschenhand') >= 3 ? 'enttarnt' : 'a'),
  nodes: {
    a: {
      say: [
        'Eine Frau mit aschgrauem Haar mustert dich kühl. „Du sammelst also auch. Wie viele hast du? Zwanzig? Dreissig?"',
        '„Hundert Karten gibt es. Und am Ende wird nur eine Person sie alle besitzen. Ich an deiner Stelle würde aufpassen, wem ich vertraue."',
      ],
      do: (c) => {
        const r = Game.rivals.get('varga');
        if (r) r.met = true;
        void c;
      },
    },
    enttarnt: {
      say: ['Varga lächelt dünn. „Du hast meine Leute besiegt. Beeindruckend. Komm doch zu mir in die Ruinen – wenn du dich traust." Sie zerfällt zu Asche und ist verschwunden.'],
      do: (c) => {
        c.g.flags.add('varga-gesehen');
      },
    },
  },
};

registerDialogs([rivale, varga]);

// ---------------------------------------------------------------- Welt-Logik

let castT = 12;

function spotOf(hm: (typeof HENCHMEN)[number]): { x: number; y: number } {
  const t = TOWNS.find((x) => x.id === hm.town)!;
  return { x: (t.x + hm.dx) * TILE + 8, y: (t.y + hm.dy) * TILE + 8 };
}

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
  id: 'rivalen',
  maps: ['insel'],
  load() {
    ensureRivals();
    placeRivals();
  },
  update(h, dt) {
    tickRivals();
    const stage = Game.quests.stage('q-aschenhand');
    // Beginn der Geschichte
    if (stage === 0 && (Game.book.collectedCount() >= 12 || Game.day >= 4)) {
      Game.quests.set('q-aschenhand', 1);
      Game.rivals.get('mila')?.buffs.set('gebannt', 1e9);
      h.toast('Gerüchte machen die Runde: Eine Bande namens Aschenhand versiegelt die Bücher anderer Sammler! Mila Sturmfeder soll ein Opfer sein.');
    }
    // Handlanger stellen sich
    if (stage === 2) {
      for (const hm of HENCHMEN) {
        if (Game.flags.has(`besiegt:${hm.id}`)) continue;
        const sp = spotOf(hm);
        const alive = h.enemies.list.find((e) => e.active && e.tag === `aschenhand:${hm.id}`);
        if (!alive && Math.hypot(h.player.x - sp.x, h.player.y - sp.y) < 200) {
          const p = freeSpot(h, sp.x, sp.y);
          const e = h.spawnMonster(hm.id, p.x, p.y, `aschenhand:${hm.id}`);
          if (e) {
            e.alerted = true;
            const r = Game.rivals.get(hm.id);
            if (r) r.met = true;
            h.toast(hm.intro);
            h.setMusic('kampf');
            castT = 8;
          }
        }
      }
      // Zauber-Duell: Handlanger zaubern im Kampf
      const foe = h.enemies.list.find((e) => e.active && e.tag?.startsWith('aschenhand:'));
      if (foe) {
        castT -= dt;
        if (castT <= 0 && Math.hypot(h.player.x - foe.x, h.player.y - foe.y) < 200) {
          castT = 14;
          const id = foe.tag.split(':')[1];
          const hm = HENCHMEN.find((x) => x.id === id)!;
          const r = Game.rivals.get(id);
          if (r) {
            const msg = attackEffect(hm.spell, rivalSide(r), playerSide());
            Sound.play('spell', { rate: 0.8 });
            h.flash(PAL.violet, 150);
            h.toast(`${r.name} wirkt „${card(hm.spell).name}": ${msg}`);
          }
        }
      }
    }
    if (stage === 3) {
      const allies = Game.rivals.list.filter((r) => r.ally).length;
      if (allies >= 2) {
        Game.quests.set('q-aschenhand', 4);
        Game.flags.add('aschenhand-finale');
        const names = Game.rivals.list.filter((r) => r.ally).map((r) => r.name.split(' ')[0]);
        h.toast(`${names.slice(0, 2).join(' und ')} haben Varga verfolgt: Ihr Versteck liegt unter den Ruinen von Alt-Kartheim – die Aschenhalle!`);
      }
    }
    if (stage === 4 && Game.flags.has('boss:varga')) {
      Game.quests.set('q-aschenhand', 5);
      for (const r of Game.rivals.list) r.buffs.delete('gebannt');
      const v = Game.rivals.get('varga');
      if (v) v.hostile = false;
      Game.inv.money += 1000;
      Game.events.emit('vitals-changed');
      h.toast('Die Aschenhand ist zerschlagen! Alle versiegelten Bücher sind frei. Die Sammler schenken dir 1000 Münzen als Dank.');
    }
  },
  kill(h, _def, e) {
    if (!e.tag?.startsWith('aschenhand:')) return;
    const id = e.tag.split(':')[1];
    Game.flags.add(`besiegt:${id}`);
    const hm = HENCHMEN.find((x) => x.id === id);
    if (hm) h.toast(hm.confess);
    h.setMusic(null);
    // gestohlene Karten des Handlangers zurück (bis zu zwei aus seinen freien Slots)
    const r = Game.rivals.get(id);
    if (r) {
      for (const uid of r.book.frei.slice(0, 2)) {
        Game.rivals.remove(r, uid);
        playerSide().receive(uid);
      }
    }
    if (HENCHMEN.every((x) => Game.flags.has(`besiegt:${x.id}`)) && Game.quests.stage('q-aschenhand') === 2) {
      Game.quests.set('q-aschenhand', 3);
      h.after(2500, () => h.toast('Alle drei Handlanger sind besiegt. Ihre Anführerin heisst Varga Aschenherz! Gewinne Verbündete unter den Sammlern.'));
    }
  },
  died(h) {
    h.setMusic(null);
  },
});

/** Für den Abspann/Tests: Anzahl Verbündete */
export function allyCount(): number {
  return Game.rivals.list.filter((r) => r.ally).length;
}
