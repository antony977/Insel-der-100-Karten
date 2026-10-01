import { registerDialogs, type DialogCtx, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { has, mini, reward, setStage, stage } from './util';

registerQuests([
  {
    id: 'q-herz',
    name: 'Rosenweils Herzensgeschichte',
    where: 'Rosenweil · Gärtnerin Rosa',
    steps: [
      'Bring Rosas Rose zu Bäcker Florian – ohne zu verraten, von wem sie ist.',
      'Erzähl Rosa, wie Florian reagiert hat.',
      'Florian ist zu schüchtern zum Reden. Besorge ihm schöne Worte – vielleicht hilft der Poet Aurelian (Brief des Poeten, Nr. 020).',
      'Gib Florian den Brief des Poeten.',
      'Komm abends (18–23 Uhr) zum Brunnen von Rosenweil, wenn Rosa und Florian sich treffen.',
      'Rosenweils Herzensgeschichte ist erzählt.',
    ],
  },
  {
    id: 'q-poet',
    name: 'Der Brief des Poeten',
    where: 'Rosenweil · Poet Aurelian',
    steps: ['Hilf Aurelian, die fehlenden Reime seines Gedichts zu finden.', 'Das Gedicht ist vollendet. Aurelian hat dir den Brief des Poeten geschenkt.'],
  },
  {
    id: 'q-tanz',
    name: 'Das Rosenfest',
    where: 'Rosenweil · Festwirtin Lilia',
    steps: ['Abends (18–23 Uhr) wird auf der Rosenfest-Bühne getanzt. Zeig, was du kannst!', 'Du hast beim Rosenfest getanzt und Tanzschuhe gewonnen.'],
  },
  {
    id: 'q-staendchen',
    name: 'Das Ständchen',
    where: 'Rosenweil · Opa Wendelin',
    steps: ['Opa Wendelin möchte sein altes Lied noch einmal hören. Spiel es auf den Gartenglocken nach.', 'Das Lied erklang – Wendelin hat dir die Spieluhr der Erinnerung geschenkt.'],
  },
]);

const abends = (c: DialogCtx) => c.g.clock >= 18 * 60 && c.g.clock < 23 * 60;

const rosa: DialogDef = {
  id: 'rosa',
  start: (c) => {
    const s = stage(c, 'q-herz');
    if (s === 0) return 'hallo';
    if (s === 1) return 'warten1';
    if (s === 2) return 'bericht';
    if (s === 3 || s === 4) return 'warten3';
    if (s === 5) return abends(c) ? 'treffen' : 'warten5';
    return 'ende';
  },
  nodes: {
    hallo: {
      say: [
        'Oh, hallo! Ich bin Rosa, ich pflege die Gärten von Rosenweil. Darf ich dich um etwas bitten? Es ist … etwas peinlich.',
        'Bring diese Rose zu Florian, dem Bäcker. Aber bitte, bitte verrat nicht, dass sie von mir ist!',
      ],
      choices: [
        { text: 'Mach ich!', do: (c) => setStage(c, 'q-herz', 1) },
        { text: 'Lieber nicht.' },
      ],
    },
    warten1: { say: ['Florian steht meistens vor dem Gasthof. Und denk dran: kein Wort, von wem die Rose ist!'] },
    bericht: {
      say: (c) =>
        c.g.flags.has('herz-ehrlich')
          ? ['Du hast es ihm gesagt?! … Oh. Und er hat gelächelt? Wirklich?', 'Dann … dann muss ich wohl mutig sein. Aber Florian redet kaum ein Wort, wenn er nervös ist. Ihm fehlen einfach die richtigen Worte.']
          : c.g.flags.has('herz-luege')
            ? ['Er glaubt, die Rose sei von Lilia?! Oh nein … Na ja, vielleicht ist es meine eigene Schuld, weil ich so schüchtern bin.', 'Trotzdem – Florian ist ein Lieber, der nur nie die richtigen Worte findet.']
            : ['Du hast nichts verraten? Danke. Er hat sich gefreut? Ach … wenn er nur nicht so schüchtern wäre. Ihm fehlen immer die richtigen Worte.'],
      do: (c) => setStage(c, 'q-herz', 3),
      goto: 'worte',
    },
    worte: { say: ['Der Poet Aurelian schreibt die schönsten Briefe der Insel. Vielleicht kann er Florian helfen?'] },
    warten3: { say: ['Hat Aurelian schon geholfen? Ich bin so aufgeregt!'] },
    warten5: { say: ['Florian und ich treffen uns heute Abend am Brunnen. Kommst du auch? Zwischen sechs und elf Uhr!'] },
    treffen: {
      say: (c) => {
        const wahr = c.g.flags.has('herz-ehrlich') && c.g.flags.has('tanz-gewonnen');
        return wahr
          ? [
              'Am Brunnen funkeln Laternen. Florian liest stockend Aurelians Brief vor – und Rosa lacht und weint zugleich.',
              'Dann bittet Florian sie zum Tanz, so wie du es auf dem Fest vorgemacht hast. Ganz Rosenweil applaudiert!',
              'Rosa: „Ohne deine Ehrlichkeit hätten wir uns nie getraut. Nimm dies – den Tau der Allheilung aus dem ältesten Rosenkelch. Und meinen Rosenquarz-Anhänger."',
            ]
          : [
              'Am Brunnen funkeln Laternen. Florian liest stockend Aurelians Brief vor, und Rosa wird ganz rot.',
              'Die beiden stehen etwas verlegen nebeneinander – aber sie halten sich an der Hand.',
              'Rosa: „Danke für alles. Nimm meinen Rosenquarz-Anhänger als Erinnerung an diesen Abend."',
            ];
      },
      do: (c) => {
        const wahr = c.g.flags.has('herz-ehrlich') && c.g.flags.has('tanz-gewonnen');
        setStage(c, 'q-herz', 6);
        reward(c, '044');
        if (wahr) {
          c.g.flags.add('herz-wahres-ende');
          reward(c, '004');
        }
      },
    },
    ende: {
      say: (c) => [c.g.flags.has('herz-wahres-ende') ? 'Florian backt mir jetzt jeden Morgen ein Rosenbrötchen. Ist das nicht wunderbar?' : 'Florian und ich gehen jeden Abend am Brunnen spazieren. Langsam, aber immerhin!'],
    },
  },
};

const florian: DialogDef = {
  id: 'florian',
  start: (c) => {
    const s = stage(c, 'q-herz');
    if (s === 1) return 'rose';
    if (s === 3 && (has(c, '020') || c.g.inv.bag.has('020'))) return 'brief';
    if (s === 4) return 'brief';
    if (s >= 5 && s < 6) return 'nervoes';
    return 'a';
  },
  nodes: {
    a: {
      say: ['Florian, Bäcker. Frische Brötchen gibt es beim Krämer Benno. Ich … äh … rede nicht so gern.'],
    },
    rose: {
      say: ['Eine Rose? Für mich? Von … wem? Ist sie von Lilia? Die lächelt mich manchmal so an.'],
      choices: [
        {
          text: 'Sie ist von Rosa.',
          do: (c) => {
            c.g.flags.add('herz-ehrlich');
            setStage(c, 'q-herz', 2);
          },
          goto: 'ehrlich',
        },
        {
          text: 'Das darf ich nicht sagen.',
          do: (c) => setStage(c, 'q-herz', 2),
          goto: 'geheim',
        },
        {
          text: 'Ja, von Lilia.',
          do: (c) => {
            c.g.flags.add('herz-luege');
            setStage(c, 'q-herz', 2);
          },
          goto: 'luege',
        },
      ],
    },
    ehrlich: { say: ['Von … Rosa? *wird knallrot* Ich … ich mag Rosa schon so lange. Aber ich weiss nie, was ich sagen soll.'] },
    geheim: { say: ['Ein Geheimnis also. *riecht an der Rose* Hm. Sie duftet wie Rosas Garten …'] },
    luege: { say: ['Von Lilia? Oh. Na ja. Das ist … nett. *schaut traurig zu Rosas Garten hinüber*'] },
    brief: {
      say: ['Ein Brief? Von Aurelian? „Die Rose blüht im Morgentau …" Das ist wunderschön! Damit … damit trau ich mich vielleicht.'],
      do: (c) => {
        setStage(c, 'q-herz', 5);
      },
      goto: 'einladung',
    },
    einladung: { say: ['Ich frag Rosa, ob wir uns heute Abend am Brunnen treffen. Kommst du auch? Zwischen sechs und elf Uhr!'] },
    nervoes: { say: ['Ich übe den Brief schon den ganzen Tag. „Die Rose blüht im Morgentau …"'] },
  },
};

function verse(n: number, line: string, right: string, wrong: [string, string], order: number): DialogDef['nodes'][string] {
  const opts = [
    { text: right, goto: n === 3 ? 'fertig' : `v${n + 1}` },
    { text: wrong[0], goto: 'schief' },
    { text: wrong[1], goto: 'schief' },
  ];
  const perm = [[1, 0, 2], [2, 0, 1], [0, 2, 1]][order];
  return { say: [line], choices: perm.map((i) => opts[i]) };
}

const aurelian: DialogDef = {
  id: 'aurelian',
  start: (c) => (c.g.quests.done('q-poet') ? 'danach' : 'a'),
  nodes: {
    a: {
      say: ['Ah, eine Muse! Ich bin Aurelian. Mein neues Liebesgedicht ist fast fertig – nur die Reime am Zeilenende fehlen mir. Hilfst du mir?'],
      choices: [
        { text: 'Gern!', do: (c) => setStage(c, 'q-poet', 1), goto: 'v1' },
        { text: 'Keine Zeit.' },
      ],
    },
    v1: verse(1, '„Die Rose blüht im Morgentau, / ihr Duft so süss, der Himmel …"', 'blau', ['grün', 'weit'], 0),
    v2: verse(2, '„Ich sah dich lachen, hell und klar, / wie Sonnenlicht im …"', 'goldnen Haar', ['tiefen Wald', 'kalten Glas'], 1),
    v3: verse(3, '„Und schlägt mein Herz auch noch so sacht, / es denkt an dich bei Tag und …"', 'Nacht', ['Mittag', 'Abendbrot'], 2),
    schief: { say: ['*schaudert* Nein, nein, das reimt sich ja wie ein Elefant auf Ballett! Versuchen wir es noch einmal.'], goto: 'v1' },
    fertig: {
      say: ['Vollendet! Ein Meisterwerk! Nimm diesen Brief – vielleicht braucht ja jemand in Rosenweil schöne Worte …'],
      do: (c) => {
        setStage(c, 'q-poet', 2);
        reward(c, '020');
      },
    },
    danach: { say: ['Ich schreibe gerade eine Ode an den Silbersee. Bisher reimt sich nur „See" auf „Tee". Hmm.'] },
  },
};

const lilia: DialogDef = {
  id: 'lilia',
  start: (c) => (abends(c) ? 'fest' : 'tag'),
  nodes: {
    tag: { say: ['Ich bin Lilia und organisiere das Rosenfest! Jeden Abend ab sechs Uhr wird auf der Bühne getanzt. Komm vorbei!'] },
    fest: {
      say: (c) => [c.g.quests.done('q-tanz') ? 'Unser Tanzstar! Noch eine Runde?' : 'Das Rosenfest! Tanz im Takt der Musik – wer gut tanzt, gewinnt ein Paar Tanzschuhe!'],
      choices: [
        {
          text: 'Tanzen!',
          do: (c) => {
            if (stage(c, 'q-tanz') === 0) setStage(c, 'q-tanz', 1);
            mini(c, 'Dance', {
              onDone: (won) => {
                if (!won) {
                  c.w.toast('Lilia: „Fast! Morgen Abend klappt es bestimmt."');
                  return;
                }
                c.g.flags.add('tanz-gewonnen');
                if (!c.g.quests.done('q-tanz')) {
                  setStage(c, 'q-tanz', 2);
                  c.w.toast('Applaus! Lilia überreicht dir ein Paar Tanzschuhe.');
                  reward(c, '062');
                } else c.w.toast('Das Publikum jubelt!');
              },
            });
          },
        },
        { text: 'Nur zuschauen.' },
      ],
    },
  },
};

const wendelin: DialogDef = {
  id: 'wendelin',
  start: (c) => (c.g.quests.done('q-staendchen') ? 'danach' : 'a'),
  nodes: {
    a: {
      say: [
        'Ach, junger Mensch … Als ich jung war, spielte meine Liebste ein Lied auf den Gartenglocken. Ich höre es noch manchmal im Wind.',
        'Die Glocken spielen die Melodie vor, wenn man sie anstösst. Würdest du sie mir nachspielen?',
      ],
      choices: [
        {
          text: 'Ich versuche es.',
          do: (c) => {
            setStage(c, 'q-staendchen', 1);
            mini(c, 'Melody', {
              onDone: (won) => {
                if (!won) return;
                setStage(c, 'q-staendchen', 2);
                c.w.toast('Wendelin wischt sich eine Träne weg: „Genau so klang es." Er schenkt dir seine Spieluhr.');
                reward(c, '031');
              },
            });
          },
        },
        { text: 'Ein andermal.' },
      ],
    },
    danach: { say: ['Die Spieluhr spielt mein Lied für immer. Danke dir.'] },
  },
};

const benno: DialogDef = {
  id: 'benno',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Netze für Falter, Brot für Verliebte. Was darf es sein?'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('rosenweil:kraemer')) },
        { text: 'Falter?', goto: 'falter' },
        { text: 'Tschüss!' },
      ],
    },
    falter: { say: ['Herzfalter! Sie flattern in den Rosengärten. Mit blossen Händen erwischt man sie nie – nur mit einem Fangnetz, das im Beutel liegt.'], goto: 'a' },
  },
};

const rosenwirt: DialogDef = {
  id: 'rosenwirt',
  start: () => 'a',
  nodes: {
    a: {
      say: [
        { who: 'Wirtin Margarete', text: 'Willkommen in der Rosenlaube! Ein Zimmer gefällig? Ruh dich aus – das heilt Leib und Seele.' },
      ],
      choices: [
        {
          text: 'Ausruhen (heilt und speichert)',
          do: (c) => {
            c.w.heal();
            c.w.setRest();
            c.w.save();
            return 'erholt';
          },
        },
        { text: 'Gibt es Neuigkeiten?', goto: 'news' },
        { text: 'Danke.' },
      ],
    },
    erholt: { say: [{ who: 'Wirtin Margarete', text: 'Gut geschlafen? Hier wachst du auf, falls dir draussen etwas zustösst.' }] },
    news: {
      say: [{ who: 'Wirtin Margarete', text: 'In den wilden Rosenhecken westlich der Stadt soll ein Dornenbaron hausen. Wer ihm zu nahe kommt, bleibt in den Ranken hängen.' }],
    },
  },
};

registerDialogs([rosa, florian, aurelian, lilia, wendelin, benno, rosenwirt]);
