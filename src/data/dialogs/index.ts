import { registerDialogs, type DialogDef } from '../../systems/Dialog';
import './taufeld';
import './runenhall';

const rastfeuer: DialogDef = {
  id: 'rastfeuer',
  start: () => 'a',
  nodes: {
    a: {
      say: [{ who: 'Rastfeuer', text: 'Das Feuer knistert gemütlich und wärmt dir die Hände. Hier kannst du ausruhen.' }],
      choices: [
        {
          text: 'Ausruhen (heilt und speichert)',
          do: (c) => {
            c.w.heal();
            c.w.setRest();
            c.w.save();
            return 'rested';
          },
        },
        {
          text: 'Bis zum Morgen schlafen',
          do: (c) => {
            c.w.heal();
            if (c.g.clock > 6 * 60) c.g.day++;
            c.g.clock = 6 * 60;
            c.w.setRest();
            c.w.save();
            return 'slept';
          },
        },
        { text: 'Weitergehen' },
      ],
    },
    rested: { say: [{ who: 'Rastfeuer', text: 'Du fühlst dich erholt. Dein Fortschritt ist gespeichert – und hier wachst du auf, falls dir etwas zustösst.' }] },
    slept: { say: [{ who: 'Rastfeuer', text: 'Die Sterne verblassen, die Vögel singen. Ein neuer Tag auf der Insel beginnt!' }] },
  },
};

const wunschbrunnen: DialogDef = {
  id: 'wunschbrunnen',
  start: () => 'a',
  nodes: {
    a: {
      say: [{ who: 'Wunschbrunnen', text: 'Ein alter Brunnen voller Münzen. Man sagt, für 10 Münzen erfüllt er kleine Kartenwünsche. Ausserdem wachst du hier auf, falls dir etwas zustösst.' }],
      choices: [
        { text: 'Münze werfen (10)', if: (c) => c.g.inv.money >= 10, do: (c) => c.w.wish() },
        { text: 'Lieber nicht' },
      ],
    },
  },
};

const rangliste: DialogDef = {
  id: 'rangliste',
  start: () => 'a',
  nodes: {
    a: {
      say: (c) => {
        const rows = [{ name: c.g.player.name, n: c.g.book.collectedCount() }, ...c.g.rivals.met().map((r) => ({ name: r.name, n: r.book.sammel.size }))].sort((a, b) => b.n - a.n);
        const top = rows.slice(0, 6).map((r, i) => `${i + 1}. ${r.name} – ${r.n}/100`);
        return [
          { who: 'Rangliste der Sammler', text: top.join('   ') },
          { who: 'Rangliste der Sammler', text: rows.length > 1 ? 'Nur Sammler, denen du schon begegnet bist, erscheinen auf deiner Tafel.' : 'Andere Sammler kennst du noch nicht. Begegnest du ihnen, erscheinen sie hier.' },
        ];
      },
    },
  },
};

registerDialogs([rastfeuer, wunschbrunnen, rangliste]);
