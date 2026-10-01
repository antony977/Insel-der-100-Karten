import { registerDialogs, type Choice, type DialogCtx, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';

registerQuests([
  {
    id: 'q-gilde',
    name: 'Die Prüfung des Ordens',
    where: 'Runenhall · Seraphine',
    steps: ['Besiege vier Glyphenwächter rund um Runenhall.', 'Beantworte Seraphines drei Fragen im Gildenturm.', 'Du bist Mitglied im Orden der Siegel und hast das Gildensiegel erhalten.'],
  },
  {
    id: 'q-buch',
    name: 'Die Rätsel des Bibliothekars',
    where: 'Runenhall · Ambrosius',
    steps: ['Löse die drei Rätsel von Ambrosius in der Bibliothek.', 'Ambrosius hat dir das Flüsternde Buch geschenkt.'],
  },
  {
    id: 'q-sohlen',
    name: 'Löchrige Sohlen',
    where: 'Runenhall · Schuster Ferdinand',
    steps: ['Bring Schuster Ferdinand zwei Blattschnapper-Karten (Nr. 076).', 'Ferdinand hat dir Wanderstiefel gemacht.'],
  },
  {
    id: 'q-kobold',
    name: 'Der Tintenkobold-Dieb',
    where: 'Runenhall · Wachtmeisterin Gerda',
    steps: ['Stell den Tintenkobold, der das Tintenfass der Wahrheit gestohlen hat. Er treibt sich südwestlich der Stadt herum.', 'Das Tintenfass der Wahrheit ist wieder da – und gehört jetzt dir.'],
  },
]);

const GLYPH_NEEDED = 4;

function quiz(n: number, q: string, right: string, wrong: string[]): { say: string[]; choices: Choice[] } {
  const opts: Choice[] = [
    { text: right, goto: n === 3 ? 'pass' : `q${n + 1}` },
    ...wrong.map((w) => ({ text: w, goto: 'fail' })),
  ];
  // feste, aber gemischte Reihenfolge
  const order = n === 1 ? [1, 0, 2] : n === 2 ? [2, 1, 0] : [0, 2, 1];
  return { say: [q], choices: order.map((i) => opts[i]) };
}

const seraphine: DialogDef = {
  id: 'seraphine',
  start: (c) => {
    const s = c.g.quests.stage('q-gilde');
    if (s === 0) return 'intro';
    if (s === 1) return c.g.kills('glyphenwaechter') - (c.g.vars.get('gilde-base') ?? 0) >= GLYPH_NEEDED ? 'ready' : 'wait';
    if (s === 2) return 'quizStart';
    return 'member';
  },
  nodes: {
    intro: {
      say: [
        'Willkommen im Turm des Ordens der Siegel. Wir hüten das Wissen über Karten, Zauber und ihre Regeln.',
        'Wer uns beitritt, erhält das Gildensiegel – und damit Zugang zum Archiv und Rabatt im Zauberladen. Doch zuerst kommt die Prüfung.',
      ],
      choices: [
        {
          text: 'Ich will die Prüfung ablegen!',
          do: (c) => {
            c.g.quests.set('q-gilde', 1);
            c.g.vars.set('gilde-base', c.g.kills('glyphenwaechter'));
          },
          goto: 'task',
        },
        { text: 'Ein andermal.' },
      ],
    },
    task: { say: [`Erste Aufgabe: Besiege ${GLYPH_NEEDED} Glyphenwächter. Die steinernen Hüter stehen rund um Runenhall. Komm wieder, wenn es geschafft ist.`] },
    wait: {
      say: (c: DialogCtx) => {
        const n = c.g.kills('glyphenwaechter') - (c.g.vars.get('gilde-base') ?? 0);
        return [`Du hast ${Math.max(0, n)} von ${GLYPH_NEEDED} Glyphenwächtern besiegt. Ihr Rune-Strahl ist gefährlich – weiche zur Seite aus!`];
      },
    },
    ready: {
      say: ['Die Glyphenwächter sind besiegt. Beeindruckend! Nun prüfe ich deinen Kopf.'],
      do: (c) => {
        c.g.quests.set('q-gilde', 2);
      },
      goto: 'q1',
    },
    quizStart: { say: ['Bereit für meine Fragen?'], goto: 'q1' },
    q1: quiz(1, 'Erste Frage: Was geschieht mit einer Karte, die länger als 60 Sekunden ausserhalb des Buchs bleibt?', 'Sie verwandelt sich für immer in ihren Gegenstand.', ['Sie fliegt von selbst zurück ins Buch.', 'Sie zerfällt zu Staub.']),
    q2: quiz(2, 'Zweite Frage: In welche Slots passen Zauberkarten?', 'Nur in die freien Slots.', ['Nur in die Sammelseiten.', 'In jeden Slot.']),
    q3: quiz(3, 'Dritte Frage: Was bedeutet das Limit einer Karte?', 'Wie viele Exemplare es auf der ganzen Insel gibt.', ['Wie oft man sie benutzen darf.', 'Wie viel sie im Laden kostet.']),
    fail: { say: ['Leider falsch. Denk in Ruhe nach und komm wieder, wenn du bereit bist.'] },
    pass: {
      say: ['Alles richtig! Hiermit nehme ich dich in den Orden der Siegel auf. Trage das Gildensiegel mit Stolz.'],
      do: (c) => {
        c.w.giveCard('016');
        c.g.quests.set('q-gilde', 3);
      },
    },
    member: {
      say: ['Willkommen, Siegelträger. Im Zauberladen bekommst du nun Rabatt. Und denk daran: Schutzzauber sind die besten Freunde eines Sammlers.'],
    },
  },
};

const ambrosius: DialogDef = {
  id: 'ambrosius',
  start: (c) => (c.g.quests.done('q-buch') ? 'done' : 'intro'),
  nodes: {
    intro: {
      say: ['Pssst – hier wird gelesen. Ah, ein neues Gesicht! Magst du Rätsel? Löse drei, und ich schenke dir etwas Besonderes.'],
      choices: [
        { text: 'Her mit den Rätseln!', do: (c) => c.g.quests.set('q-buch', 1), goto: 'r1' },
        { text: 'Lieber nicht.' },
      ],
    },
    r1: {
      say: ['Ich habe Seiten, aber kein Haus. Einen Rücken, aber keine Knochen. Ich erzähle, aber ich habe keinen Mund. Was bin ich?'],
      choices: [
        { text: 'Ein Baum', goto: 'no' },
        { text: 'Ein Buch', goto: 'r2' },
        { text: 'Ein Brief', goto: 'no' },
      ],
    },
    r2: {
      say: ['Richtig! Zweites Rätsel: Je mehr du davon machst, desto mehr lässt du hinter dir. Was ist es?'],
      choices: [
        { text: 'Schritte', goto: 'r3' },
        { text: 'Münzen', goto: 'no' },
        { text: 'Karten', goto: 'no' },
      ],
    },
    r3: {
      say: ['Sehr gut! Letztes Rätsel: Was wird umso nasser, je mehr es trocknet?'],
      choices: [
        { text: 'Tinte', goto: 'no' },
        { text: 'Der Silbersee', goto: 'no' },
        { text: 'Ein Handtuch', goto: 'win' },
      ],
    },
    no: { say: ['Hmm, nein. Lies nach, denk nach – und versuch es noch einmal.'] },
    win: {
      say: ['Bravo! Nimm dieses Flüsternde Buch. Es kennt die Verstecke vieler Karten … wenn man ihm zuhört.'],
      do: (c) => {
        c.w.giveCard('028');
        c.g.quests.set('q-buch', 2);
      },
    },
    done: { say: ['Ah, mein kluger Rätselfreund. Das Flüsternde Buch verrät dir einmal am Tag einen Fundort.'] },
  },
};

const mirabell: DialogDef = {
  id: 'mirabell',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Willkommen im „Blätternden Buch"! Bei mir gibt es Siegelpacks – drei versiegelte Zauber pro Pack.'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('runenhall:zauberladen')) },
        { text: 'Wie wirke ich Zauber?', goto: 'how' },
        { text: 'Tschüss!' },
      ],
    },
    how: {
      say: [
        'Zauber liegen in deinen freien Slots. Wähle sie im Buch aus und drück „Wirken" – oder leg sie auf die Schnelltasten 1, 2 und 3.',
        'Angriffszauber wirken auf andere Sammler: Manche rauben, andere zerstören Karten. Schutzzauber halten dich sicher. Und Bewegungszauber bringen dich blitzschnell über die Insel.',
        'Ein Zauber verbraucht sich beim Wirken. Also: klug einsetzen!',
      ],
      goto: 'a',
    },
  },
};

const salbeia: DialogDef = {
  id: 'salbeia',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Tritt ein. Gegen Wunden hilft Elixier, gegen Kummer hilft Tee – den gibt es nebenan.'],
      choices: [{ text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('runenhall:kraeuter')) }, { text: 'Tschüss!' }],
    },
  },
};

const tobias: DialogDef = {
  id: 'tobias',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Ein Auratee gefällig? Er füllt deine Aura auf. Und man hört hier so einiges …'],
      choices: [
        { text: 'Laden ansehen', do: (c) => c.w.after(() => c.w.openShop('runenhall:teestube')) },
        { text: 'Was hört man denn?', goto: 'rumor' },
        { text: 'Tschüss!' },
      ],
    },
    rumor: {
      say: [
        'Man munkelt von einer Bande namens „Aschenhand". Sie sollen Bücher anderer Sammler versiegeln und nur gegen seltene Karten wieder freigeben.',
        'Ihre Anführerin heisst Varga Aschenherz. Wenn du einer Frau mit grauem Mantel begegnest – sei vorsichtig.',
      ],
      goto: 'a',
    },
  },
};

const ferdinand: DialogDef = {
  id: 'ferdinand',
  start: (c) => {
    const s = c.g.quests.stage('q-sohlen');
    if (s === 0) return 'ask';
    if (s === 1) return c.g.countCard('076') >= 2 ? 'give' : 'wait';
    return 'done';
  },
  nodes: {
    ask: {
      say: [
        'Schau dir das an! Meine Sohlen sind löchrig wie ein Sieb. Ich bräuchte neues Material.',
        'Das Laub der Blattschnapper ist zäh wie Leder. Bring mir zwei Blattschnapper-Karten, und ich mache dir ein Paar Wanderstiefel.',
      ],
      choices: [
        { text: 'Abgemacht!', do: (c) => c.g.quests.set('q-sohlen', 1) },
        { text: 'Mal sehen.' },
      ],
    },
    wait: { say: (c) => [`Zwei Blattschnapper-Karten (Nr. 076) – du hast ${c.g.countCard('076')}. Die Biester tarnen sich als Büsche, also Augen auf!`] },
    give: {
      say: ['Zwei Blattschnapper! Wunderbar.'],
      choices: [
        {
          text: 'Bitte schön.',
          do: (c) => {
            c.g.takeCards('076', 2);
            c.w.giveCard('026');
            c.g.quests.set('q-sohlen', 2);
          },
          goto: 'gift',
        },
        { text: 'Doch nicht.' },
      ],
    },
    gift: { say: ['Hier, frisch besohlt: Wanderstiefel! Damit läufst du schneller und rollst weiter.'] },
    done: { say: ['Laufen sie sich gut ein? Gute Stiefel sind die halbe Reise.'] },
  },
};

const ottokar: DialogDef = {
  id: 'ottokar',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Willkommen an der Tauschbörse! Ich kaufe Karten aus deinen freien Slots und aus der Hand. Sammelseiten fasse ich nicht an – Ehrensache.'],
      choices: [{ text: 'Karten verkaufen', do: (c) => c.w.after(() => c.w.openShop('runenhall:tauschboerse')) }, { text: 'Tschüss!' }],
    },
  },
};

const gerda: DialogDef = {
  id: 'gerda',
  start: (c) => {
    const s = c.g.quests.stage('q-kobold');
    if (s === 0) return 'ask';
    if (s === 1) return 'wait';
    return 'done';
  },
  nodes: {
    ask: {
      say: [
        'Halt! Ach, du bist es. Entschuldige, ich bin im Dienst. Ein Tintenkobold hat das Tintenfass der Wahrheit aus der Bibliothek gestohlen!',
        'Er versteckt sich südwestlich der Stadt. Die Biester sind flink und klauen Münzen – also sei auf der Hut.',
      ],
      choices: [
        {
          text: 'Ich schnappe ihn mir!',
          do: (c) => {
            c.g.quests.set('q-kobold', 1);
            c.w.spawnMonster('tintenkobold', 162, 64, 'kobold-dieb');
          },
        },
        { text: 'Viel Glück dabei.' },
      ],
    },
    wait: {
      say: ['Südwestlich der Stadt treibt er sich herum. Wenn er dir Münzen klaut: Bleib dran, beim Besiegen gibt er sie zurück!'],
      do: (c) => c.w.spawnMonster('tintenkobold', 162, 64, 'kobold-dieb'),
    },
    done: { say: ['Dank dir ist Runenhall ein Stück sicherer. Das Tintenfass gehört jetzt dir – Ambrosius war einverstanden.'] },
  },
};

const ludo: DialogDef = {
  id: 'ludo',
  start: () => 'a',
  nodes: {
    a: {
      say: (c) => {
        const tips = [
          'Ich bin Lehrling im Orden. Wusstest du, dass man mit jeder neuen Stufe eine Fähigkeitskarte wählen darf? Gold steht für dein Affinitäts-Talent!',
          'Kleiner Trick: Halte die Aura-Taste gedrückt, dann wird die Zeit langsamer und du kannst in Ruhe eine Technik wählen.',
          'Die Glyphenwächter schiessen nur geradeaus. Wenn du seitlich rollst, verfehlen sie dich.',
          'An der Tafel auf dem Platz steht die Rangliste der Sammler. Wer wohl ganz oben steht?',
        ];
        const i = (c.g.vars.get('ludo') ?? 0) % tips.length;
        c.g.vars.set('ludo', i + 1);
        return [tips[i]];
      },
    },
  },
};

registerDialogs([seraphine, ambrosius, mirabell, salbeia, tobias, ferdinand, ottokar, gerda, ludo]);
