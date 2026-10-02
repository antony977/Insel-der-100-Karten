import { describe, expect, it } from 'vitest';
import '../src/data/dialogs';
import { getDialog, type DialogCtx, type WorldApi } from '../src/systems/Dialog';
import { Game } from '../src/systems/GameState';
import { NPCS } from '../src/data/npcs';
import { DOORS } from '../src/data/doors';
import { allQuests } from '../src/systems/Quests';
import { ensureRivals } from '../src/systems/RivalAI';

/** Alle Dialoge einmal „durchsprechen": Startknoten, Texte und Bedingungen dürfen nicht abstürzen. */
const api: WorldApi = {
  toast: () => undefined,
  openShop: () => undefined,
  giveCard: (id) => Game.giveCard(id) !== null,
  heal: () => undefined,
  save: () => undefined,
  setRest: () => undefined,
  spawnMonster: () => undefined,
  warp: () => undefined,
  after: () => undefined,
  openScene: () => undefined,
  wish: () => undefined,
};

function dialogIds(): string[] {
  const ids = new Set<string>(['rastfeuer', 'wunschbrunnen', 'rangliste', 'nullpunkt', 'seitentuer', 'sphinx']);
  for (const n of NPCS) ids.add(n.dialog);
  for (const d of Object.values(DOORS)) if (d.dialog) ids.add(d.dialog);
  return [...ids];
}

describe('Dialoge', () => {
  it('jede Figur und Tür verweist auf einen vorhandenen Dialog', () => {
    const missing = dialogIds().filter((id) => !getDialog(id));
    expect(missing).toEqual([]);
  });

  it('alle Knoten lassen sich in verschiedenen Spielständen anzeigen', () => {
    for (const phase of [0, 1, 2]) {
      Game.newGame();
      ensureRivals();
      if (phase >= 1) {
        for (const q of allQuests()) Game.quests.set(q.id, 1);
        Game.day = 5;
      }
      if (phase === 2) {
        for (const q of allQuests()) Game.quests.set(q.id, q.steps.length);
        Game.clock = 20 * 60;
      }
      for (const id of dialogIds()) {
        const d = getDialog(id)!;
        const npc = NPCS.find((n) => n.dialog === id);
        const c: DialogCtx = { g: Game, w: api, npc };
        const start = d.start(c);
        expect(d.nodes[start], `${id}: Startknoten ${start}`).toBeDefined();
        for (const [key, node] of Object.entries(d.nodes)) {
          const lines = typeof node.say === 'function' ? node.say(c) : node.say;
          expect(Array.isArray(lines ?? []), `${id}.${key}`).toBe(true);
          for (const ch of node.choices ?? []) {
            ch.if?.(c);
            if (ch.goto) expect(d.nodes[ch.goto], `${id}.${key} → ${ch.goto}`).toBeDefined();
          }
          if (node.goto) expect(d.nodes[node.goto], `${id}.${key} → ${node.goto}`).toBeDefined();
        }
      }
    }
  });
});
