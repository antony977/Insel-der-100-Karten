import { registerDialogs, type DialogDef } from '../../systems/Dialog';
import { registerQuests } from '../../systems/Quests';
import { has, mini, reward, setStage, stage } from './util';

registerQuests([
  {
    id: 'q-falschspieler',
    name: 'Der Falschspieler',
    where: 'Würfelheim · Croupière Fortuna',
    steps: ['Fortuna vermutet einen Falschspieler am Würfeltisch. Hör dir die drei Verdächtigen an und entlarve den Schummler.', 'Du hast den Falschspieler entlarvt. Fortuna hat dir seinen Gezinkten Würfel überlassen.'],
  },
  {
    id: 'q-kasimir',
    name: 'Kasimirs Schulden',
    where: 'Würfelheim · Kasimir Glanz',
    steps: ['Kasimir Glanz schuldet dem Casino 500 Chips. Hilf ihm aus der Klemme.', 'Du hast Kasimirs Schulden beglichen. Zum Dank hat er dir seine Silberne Spielmarke geschenkt.'],
  },
  {
    id: 'q-jackpot',
    name: 'Der Grosse Jackpot',
    where: 'Würfelheim · Casino',
    steps: ['Am Sternenautomaten im Casino wartet der Grosse Jackpot. Je öfter du drehst, desto heller glüht die Jackpot-Anzeige.', 'Du hast den Grossen Jackpot geknackt!'],
  },
]);

const fortuna: DialogDef = {
  id: 'fortuna',
  start: (c) => (c.g.flags.has('casino-besucht') ? 'a' : 'erst'),
  nodes: {
    erst: {
      say: ['Willkommen in der „Goldenen Sieben"! Ich bin Fortuna. Hier zählt nur eins: Chips. Münzen tauschst du an meinem Tresen eins zu eins.'],
      do: (c) => {
        c.g.flags.add('casino-besucht');
        if (stage(c, 'q-jackpot') === 0) setStage(c, 'q-jackpot', 1);
      },
      goto: 'a',
    },
    a: {
      say: (c) => [stage(c, 'q-falschspieler') === 1 ? 'Und? Hast du den Schummler gefunden?' : 'Was darf es sein? Würfel, Karten oder der Sternenautomat?'],
      choices: [
        {
          text: 'Spielen',
          do: (c) =>
            mini(c, 'Casino', {
              onDone: () => {
                if (c.g.flags.has('jackpot-karte')) setStage(c, 'q-jackpot', 2);
              },
            }),
        },
        { text: 'Gibt es Ärger?', if: (c) => stage(c, 'q-falschspieler') === 0, goto: 'aerger' },
        { text: 'Die Verdächtigen befragen', if: (c) => stage(c, 'q-falschspieler') === 1, goto: 'verdacht' },
        { text: 'Was ist hinter der goldenen Tür?', goto: 'tresor' },
        { text: 'Auf Wiedersehen.' },
      ],
    },
    aerger: {
      say: [
        'Ärger? Pssst. Seit Tagen gewinnt am Würfeltisch jemand ein bisschen zu oft. Drei Stammgäste kommen infrage: Baron von Klimper, Tante Trude und Matrose Kuno.',
        'Hör ihnen zu und sag mir, wer schummelt. Aber Vorsicht – eine falsche Anschuldigung ist schlecht fürs Geschäft.',
      ],
      do: (c) => setStage(c, 'q-falschspieler', 1),
      goto: 'verdacht',
    },
    verdacht: {
      say: ['Wen willst du befragen?'],
      choices: [
        { text: 'Baron von Klimper', goto: 'baron' },
        { text: 'Tante Trude', goto: 'trude' },
        { text: 'Matrose Kuno', goto: 'kuno' },
        { text: 'Ich weiss, wer es ist!', goto: 'anklage' },
        { text: 'Später.' },
      ],
    },
    baron: {
      say: [{ who: 'Baron von Klimper', text: 'Dreimal hintereinander eine Sieben! Tja, Glück ist eben eine Frage der Klasse. Ich trage übrigens Handschuhe beim Würfeln – aus Prinzip.' }],
      goto: 'verdacht',
    },
    trude: {
      say: [{ who: 'Tante Trude', text: 'Ich spiele nur Hoch oder Tief. Heute zweimal Tief, einmal Hoch – und trotzdem verloren. Ich sag ja, der Tisch ist verflucht.' }],
      goto: 'verdacht',
    },
    kuno: {
      say: [{ who: 'Matrose Kuno', text: 'Ich? Ich würfle immer mit meinem eigenen Glückswürfel, den hat mir … äh. Nein! Ich meine: mit den Würfeln vom Casino. Wie alle. Ganz bestimmt.' }],
      goto: 'verdacht',
    },
    anklage: {
      say: ['Also – wer ist der Falschspieler?'],
      choices: [
        { text: 'Baron von Klimper', goto: 'falsch' },
        { text: 'Tante Trude', goto: 'falsch' },
        {
          text: 'Matrose Kuno',
          do: (c) => {
            setStage(c, 'q-falschspieler', 2);
            reward(c, '029');
          },
          goto: 'richtig',
        },
      ],
    },
    falsch: { say: ['Hmm. Das glaube ich nicht – und die Person ist jetzt ziemlich beleidigt. Hör noch einmal genau hin, was jeder sagt.'], goto: 'verdacht' },
    richtig: {
      say: ['Kuno hat sich verplappert – „mein eigener Glückswürfel"! Und tatsächlich: In seiner Tasche klappert ein gezinkter Würfel. Der gehört jetzt dir. Gut gemacht, Detektiv!'],
    },
    tresor: {
      say: ['Das ist der Tresorraum des Hausbankiers. Niemand geht dort hinein … und wer es doch tut, kommt meist ohne Chips wieder heraus.'],
      goto: 'a',
    },
  },
};

const kasimir: DialogDef = {
  id: 'kasimir',
  start: (c) => (c.g.quests.done('q-kasimir') ? 'danke' : 'a'),
  nodes: {
    a: {
      say: [
        'Kasimir Glanz, Glücksspieler aus Leidenschaft. Leider im Moment … mit einer kleinen Pechsträhne.',
        'Ich schulde dem Casino 500 Chips. Wenn ich nicht zahle, darf ich nie wieder an den Sternenautomaten! Könntest du … mir aushelfen?',
      ],
      choices: [
        {
          text: '500 Chips geben',
          if: (c) => c.g.inv.chips >= 500,
          do: (c) => {
            c.g.inv.chips -= 500;
            setStage(c, 'q-kasimir', 2);
            reward(c, '040');
          },
          goto: 'bezahlt',
        },
        {
          text: '800 Münzen geben',
          if: (c) => c.g.inv.money >= 800,
          do: (c) => {
            c.g.inv.money -= 800;
            c.g.events.emit('vitals-changed');
            setStage(c, 'q-kasimir', 2);
            reward(c, '040');
          },
          goto: 'bezahlt',
        },
        { text: 'Ich überlege es mir.', do: (c) => setStage(c, 'q-kasimir', Math.max(1, stage(c, 'q-kasimir'))) },
      ],
    },
    bezahlt: {
      say: ['Du bist ein Engel! Hier – meine Silberne Spielmarke. Sie hat mir nie Glück gebracht, aber dir vielleicht. Ich schwöre: ab jetzt spiele ich nur noch mit Bedacht. … Na ja. Meistens.'],
    },
    danke: { say: ['Ah, mein Retter! Ich spiele jetzt nur noch eine Runde pro Tag. Oder zwei. Hast du eigentlich gehört, dass draussen eine Glückskatze herumstreunt?'] },
  },
};

const schwarzhaendler: DialogDef = {
  id: 'schwarzhaendler',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Psst. Nicht so laut. Ich habe Dinge, die es offiziell nicht gibt. Dietriche zum Beispiel.'],
      choices: [
        { text: 'Zeig her', do: (c) => c.w.after(() => c.w.openShop('wuerfelheim:schwarzhaendler')) },
        { text: 'Hast du Gerüchte?', goto: 'geruecht' },
        { text: 'Lieber nicht.' },
      ],
    },
    geruecht: {
      say: ['Man munkelt, eine Gruppe namens Aschenhand versiegle die Bücher anderer Sammler. Wer ihnen begegnet, sollte Schutzzauber dabeihaben. Mehr weiss ich nicht. Offiziell.'],
      goto: 'a',
    },
  },
};

const preisdame: DialogDef = {
  id: 'preisdame',
  start: () => 'a',
  nodes: {
    a: {
      say: ['Bonjour! Im Preisladen verwandeln sich Chips in Schätze. Der Pokal des Glücks ist mein ganzer Stolz.'],
      choices: [
        { text: 'Preise ansehen', do: (c) => c.w.after(() => c.w.openShop('wuerfelheim:preisladen')) },
        { text: 'Wie komme ich an Chips?', goto: 'chips' },
        { text: 'Au revoir!' },
      ],
    },
    chips: { say: ['Im Casino bei Fortuna: Münzen gegen Chips tauschen und dann – viel Glück! Die Würfel zahlen das Doppelte, der Sternenautomat noch mehr.'], goto: 'a' },
  },
};

const lotte: DialogDef = {
  id: 'lotte',
  start: () => 'a',
  nodes: {
    a: {
      say: (c) => [
        'Professorin Lotte, Glücksforschung. Mein Studienobjekt: die Glückskatze! Sie streunt durch die Gassen um Würfelheim.',
        has(c, '067') || c.g.hasThing('067')
          ? 'Du hast einen Silberfisch dabei? Dann entfessle ihn – mit dem Köder im Beutel zeigt sich die Katze, und du kannst sie fangen!'
          : 'Sie zeigt sich nur, wenn man einen Silberfisch als Köder im Beutel trägt. Fischer Jorn in Möwenhafen weiss, wie man an einen kommt.',
      ],
      goto: 'b',
    },
    b: {
      say: ['Noch eine Beobachtung: Der Sternenautomat ist launisch, aber nicht unfair. Je öfter man dreht, desto heller glüht seine Jackpot-Anzeige …'],
    },
  },
};

registerDialogs([fortuna, kasimir, schwarzhaendler, preisdame, lotte]);
