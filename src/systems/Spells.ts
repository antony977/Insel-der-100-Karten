import { Game } from './GameState';
import { ALL_CARDS, card, SAMMELKARTEN } from '../data/cards';
import type { CardDef } from '../data/cardTypes';
import { PAL } from '../gfx/palette';
import { TILE } from '../config';
import { TOWNS, REGIONS, REGION_IDS } from '../data/world/layout';
import type { IslandMeta } from '../world/islandBuilder';
import type { WorldMap } from '../world/WorldMap';
import type { RivalState } from './Rivals';
import type { ChoiceOption } from '../scenes/ChoiceScene';

/** 20 m auf der Karte */
export const RANGE_20M = 120;

/** Was das Zaubersystem von der Welt braucht */
export interface SpellHost {
  x: number;
  y: number;
  map: string;
  meta: IslandMeta | null;
  worldMap: WorldMap;
  teleport(x: number, y: number, text?: string): void;
  changeMap(map: string, x: number, y: number): void;
  toast(text: string): void;
  message(name: string, text: string): void;
  fx(color: number): void;
  openScene(key: string, data?: object): void;
}

const CAT_COLOR = { angriff: PAL.red, abwehr: PAL.cyan, bewegung: PAL.gold, info: PAL.violet } as const;

/** Dauer der Schutzzauber (Sekunden; „bis zum nächsten Angriff" = sehr lang) */
const UNTIL_USED = 1e7;

// ----------------------------------------------------------------------------
// Seiten (Spielfigur oder Rivale) – damit Zauber in beide Richtungen gleich wirken
// ----------------------------------------------------------------------------

export interface Side {
  id: string;
  name: string;
  buffs: Map<string, number>;
  sammel(): number[];
  frei(): number[];
  isProtected(uid: number): boolean;
  receive(uid: number): void;
  lose(uid: number): void;
}

export function playerSide(): Side {
  return {
    id: 'spieler',
    name: Game.player.name,
    buffs: Game.inv.buffs,
    sammel: () => Game.book.sammel.filter((u): u is number => u !== null),
    frei: () => Game.book.frei.filter((u): u is number => u !== null),
    isProtected: (uid) => Game.protectedCards.has(uid),
    receive: (uid) => {
      Game.registry.transfer(uid, 'spieler');
      const r = Game.book.receive(uid);
      if (r !== 'ok') {
        // Hand voll: Karte fällt zu Boden
        Game.registry.transfer(uid, 'boden');
        Game.dropToGround({ kind: 'card', id: Game.registry.idOf(uid), uid, timeLeft: 60, map: Game.player.map, x: Game.player.x, y: Game.player.y + 6 });
      } else {
        Game.discovered.add(Game.registry.idOf(uid));
        Game.events.emit('card-received', card(Game.registry.idOf(uid)), uid);
      }
      Game.events.emit('book-changed');
    },
    lose: (uid) => {
      Game.markLost(Game.registry.idOf(uid));
      Game.book.remove(uid);
      Game.quick = Game.quick.map((q) => (q === uid ? null : q));
      Game.events.emit('book-changed');
    },
  };
}

export function rivalSide(r: RivalState): Side {
  return {
    id: r.id,
    name: r.name,
    buffs: r.buffs,
    sammel: () => [...r.book.sammel.values()],
    frei: () => [...r.book.frei],
    isProtected: () => false,
    receive: (uid) => Game.rivals.receive(r, uid, Game.registry),
    lose: (uid) => Game.rivals.remove(r, uid),
  };
}

const PROTECTIVE = ['laubschild', 'spiegelblatt', 'tresor', 'dornen', 'nebelmantel', 'gegenlicht', 'anker', 'bannkreis'];

type Defense = 'ok' | 'blocked' | 'reflected';

/** Schutzzauber des Ziels prüfen. Liefert Ergebnis und Meldung. */
export function defend(caster: Side, target: Side, spell: CardDef): { r: Defense; msg?: string } {
  const cat = spell.spell?.category;
  if (target.buffs.has('bannkreis') || caster.buffs.has('bannkreis')) return { r: 'blocked', msg: 'Ein Bannkreis lässt den Zauber verpuffen.' };
  if (cat === 'angriff') {
    if (target.buffs.has('spiegelblatt')) {
      target.buffs.delete('spiegelblatt');
      return { r: 'reflected', msg: `${target.name}s Spiegelblatt wirft den Zauber zurück!` };
    }
    if (target.buffs.has('dornen')) {
      target.buffs.delete('dornen');
      // eine Zauberkarte des Angreifers zerstören
      const spells = caster.frei().filter((u) => Game.registry.idOf(u).startsWith('Z'));
      if (spells.length) {
        const u = spells[Math.floor(Math.random() * spells.length)];
        caster.lose(u);
        Game.registry.destroy(u);
      }
      return { r: 'blocked', msg: `${target.name}s Dornenhülle blockt den Zauber und zerstört eine Zauberkarte von ${caster.name}!` };
    }
    if (target.buffs.has('laubschild')) {
      target.buffs.delete('laubschild');
      return { r: 'blocked', msg: `${target.name}s Laubschild fängt den Zauber ab.` };
    }
  }
  if (cat === 'info') {
    if (target.buffs.has('nebelmantel')) return { r: 'blocked', msg: `${target.name} ist in einen Nebelmantel gehüllt – nichts zu erkennen.` };
    if (target.buffs.has('gegenlicht')) {
      target.buffs.delete('gegenlicht');
      return { r: 'blocked', msg: `Gegenlicht! ${target.name} blockt den Zauber und erkennt ${caster.name} als Wirker.` };
    }
  }
  if (cat === 'bewegung' && target.buffs.has('anker')) return { r: 'blocked', msg: `${target.name} ist durch einen Ankerstein gesichert.` };
  return { r: 'ok' };
}

function pickRandom<T>(a: T[]): T | undefined {
  return a.length ? a[Math.floor(Math.random() * a.length)] : undefined;
}

/** Angriffswirkung (Raub/Zerstörung/Bann) von caster auf target – inkl. Schutzprüfung. */
export function attackEffect(spellId: string, caster: Side, target: Side, chosen?: string): string {
  const spell = card(spellId);
  const d = defend(caster, target, spell);
  if (d.r === 'blocked') return d.msg ?? 'Geblockt.';
  if (d.r === 'reflected') return `${d.msg} ${attackEffect(spellId, target, caster, chosen)}`;
  if (target.id === 'spieler' || caster.id === 'spieler') {
    Game.castLog.push({ who: caster.name, spell: spell.name, t: Game.playTime });
    if (Game.castLog.length > 10) Game.castLog.shift();
  }
  const freeUnprot = () => target.frei().filter((u) => !target.isProtected(u));
  switch (spellId) {
    case 'Z01':
    case 'Z02':
    case 'Z10': {
      const u = pickRandom(freeUnprot());
      if (u === undefined) return `${target.name} hat keine Karte in den freien Slots.`;
      target.lose(u);
      caster.receive(u);
      return `${caster.name} raubt „${card(Game.registry.idOf(u)).name}" von ${target.name}!`;
    }
    case 'Z03':
    case 'Z04': {
      if (target.buffs.has('tresor')) return `Ein Tresorsiegel schützt die Sammelseiten von ${target.name}.`;
      const u = target.sammel().find((x) => Game.registry.idOf(x) === chosen);
      if (u === undefined) return `${target.name} besitzt die Karte ${chosen} nicht in den Sammelseiten.`;
      if (target.isProtected(u)) return `Ein Siegelband schützt diese Karte.`;
      target.lose(u);
      caster.receive(u);
      return `${caster.name} stiehlt „${card(chosen ?? '').name}" aus den Sammelseiten von ${target.name}!`;
    }
    case 'Z05':
    case 'Z06': {
      const u = pickRandom(freeUnprot());
      if (u === undefined) return `${target.name} hat keine Karte in den freien Slots.`;
      const name = card(Game.registry.idOf(u)).name;
      target.lose(u);
      Game.registry.destroy(u);
      return `„${name}" von ${target.name} geht in Flammen auf!`;
    }
    case 'Z07': {
      if (target.buffs.has('tresor')) return `Ein Tresorsiegel schützt die Sammelseiten von ${target.name}.`;
      const u = target.sammel().find((x) => Game.registry.idOf(x) === chosen);
      if (u === undefined) return `${target.name} besitzt die Karte ${chosen} nicht.`;
      if (target.isProtected(u)) return `Ein Siegelband schützt diese Karte.`;
      target.lose(u);
      Game.registry.destroy(u);
      return `Tintenfluch! „${card(chosen ?? '').name}" von ${target.name} ist zerstört.`;
    }
    case 'Z11':
      target.buffs.set('gebannt', 60);
      return `Das Buch von ${target.name} ist 60 Sekunden versiegelt!`;
    case 'Z12': {
      let n = 0;
      for (const b of PROTECTIVE) if (target.buffs.delete(b)) n++;
      return n ? `${n} Schutzzauber von ${target.name} zerspringen!` : `${target.name} hatte keine Schutzzauber.`;
    }
    default:
      return '…';
  }
}

/** Buch einer Seite als Text (für Informationszauber) */
function describe(side: Side, what: 'sammel' | 'all' | 'zauber'): string {
  const names = (uids: number[]) => uids.map((u) => card(Game.registry.idOf(u)));
  if (what === 'zauber') {
    const sp = names(side.frei()).filter((c) => c.kind === 'zauber');
    return sp.length ? `${side.name} hat ${sp.length} Zauber: ${sp.map((c) => c.name).slice(0, 8).join(', ')}${sp.length > 8 ? ' …' : ''}.` : `${side.name} hat keine Zauberkarten.`;
  }
  const sam = names(side.sammel()).sort((a, b) => a.no - b.no);
  const rare = sam.filter((c) => ['SS', 'S', 'A', 'B'].includes(c.rank));
  let s = `${side.name}: ${sam.length}/100 Sammelkarten. Seltene: ${rare.length ? rare.map((c) => `${c.id} ${c.name}`).slice(0, 6).join(', ') : 'keine'}${rare.length > 6 ? ' …' : ''}.`;
  if (what === 'all') {
    const fr = names(side.frei());
    s += ` Freie Slots: ${fr.length ? fr.map((c) => c.name).slice(0, 6).join(', ') : 'leer'}${fr.length > 6 ? ' …' : ''}.`;
  }
  return s;
}

// ----------------------------------------------------------------------------
// Zauber der Spielfigur
// ----------------------------------------------------------------------------

function consume(uid: number): void {
  Game.book.remove(uid);
  Game.registry.destroy(uid);
  Game.quick = Game.quick.map((q) => (q === uid ? null : q));
  Game.events.emit('book-changed');
}

function nearestRival(h: SpellHost): RivalState | null {
  const list = Game.rivals.near(h.map, h.x, h.y, RANGE_20M);
  let best: RivalState | null = null;
  let bd = 1e9;
  for (const r of list) {
    const d = Math.hypot(r.x - h.x, r.y - h.y);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  if (best) best.met = true;
  return best;
}

function cardOptions(list: CardDef[]): ChoiceOption[] {
  return list.map((c) => ({ label: `${c.id} ${Game.discovered.has(c.id) || c.kind === 'zauber' ? c.name : '???'}`, value: c.id }));
}

function choose(h: SpellHost, title: string, options: ChoiceOption[], onPick: (v: string) => void): void {
  h.openScene('Choice', { title, options, onPick });
}

function rivalOptions(list: RivalState[]): ChoiceOption[] {
  return list.map((r) => ({ label: `${r.name} (${r.book.sammel.size}/100)`, value: r.id }));
}

/** zufällige begehbare Stelle auf der Insel */
function randomLand(h: SpellHost): { x: number; y: number } | null {
  const m = h.worldMap;
  for (let i = 0; i < 400; i++) {
    const x = 6 + Math.floor(Math.random() * (m.w - 12));
    const y = 6 + Math.floor(Math.random() * (m.h - 12));
    if (m.isSolidCell(x, y)) continue;
    if (h.meta) {
      const rid = REGION_IDS[h.meta.region[y * m.w + x]];
      if (rid === 'klippen' || rid === 'meer') continue;
    }
    return { x: x * TILE + 8, y: y * TILE + 12 };
  }
  return null;
}

/**
 * Zauberkarte wirken. Liefert eine Meldung, wenn der Zauber nicht gewirkt werden kann
 * (dann bleibt die Karte erhalten). Bei Auswahl öffnet sich zuerst ein Auswahlfenster.
 */
export function castSpell(uid: number, h: SpellHost): string | null {
  if (!Game.book.locate(uid)) return 'Diese Karte ist nicht mehr in deinem Buch.';
  const c = card(Game.registry.idOf(uid));
  if (c.kind !== 'zauber' || !c.spell) return 'Das ist keine Zauberkarte.';
  if (Game.inv.buffs.has('gebannt')) return 'Dein Buch ist versiegelt! Du kannst gerade nicht zaubern.';
  const loc = Game.book.locate(uid);
  if (loc?.area === 'hand') return 'Leg den Zauber zuerst in einen freien Slot.';
  const me = playerSide();
  const color = CAT_COLOR[c.spell.category];
  const done = (msg: string, title = c.name) => {
    consume(uid);
    h.fx(color);
    h.message(title, msg);
  };
  const met = Game.rivals.met();
  switch (c.id) {
    // -------------------------------------------------- Angriff (Nähe)
    case 'Z01':
    case 'Z05':
    case 'Z08':
    case 'Z11':
    case 'Z12':
    case 'Z38': {
      const r = nearestRival(h);
      if (!r) return 'Kein anderer Sammler im Umkreis von 20 Metern.';
      const t = rivalSide(r);
      if (c.id === 'Z08' || c.id === 'Z38') {
        const d = defend(me, t, c);
        done(d.r === 'ok' ? describe(t, c.id === 'Z08' ? 'sammel' : 'zauber') : d.msg ?? 'Geblockt.');
      } else done(attackEffect(c.id, me, t));
      return null;
    }
    case 'Z06':
    case 'Z10': {
      const list = Game.rivals.near(h.map, h.x, h.y, RANGE_20M);
      if (!list.length) return 'Kein anderer Sammler im Umkreis von 20 Metern.';
      const msgs = list.map((r) => {
        r.met = true;
        return attackEffect(c.id, me, rivalSide(r));
      });
      done(msgs.join(' '));
      return null;
    }
    case 'Z03': {
      const r = nearestRival(h);
      if (!r) return 'Kein anderer Sammler im Umkreis von 20 Metern.';
      choose(h, `${c.name}: Welche Kartennummer stehlen?`, cardOptions(SAMMELKARTEN), (id) => done(attackEffect(c.id, me, rivalSide(r), id)));
      return null;
    }
    // -------------------------------------------------- Angriff (Fern)
    case 'Z02':
    case 'Z09': {
      if (!met.length) return 'Du bist noch keinem anderen Sammler begegnet.';
      choose(h, `${c.name}: Ziel wählen`, rivalOptions(met), (id) => {
        const t = rivalSide(Game.rivals.get(id)!);
        if (c.id === 'Z09') {
          const d = defend(me, t, c);
          done(d.r === 'ok' ? describe(t, 'all') : d.msg ?? 'Geblockt.');
        } else done(attackEffect(c.id, me, t));
      });
      return null;
    }
    case 'Z04':
    case 'Z07': {
      if (!met.length) return 'Du bist noch keinem anderen Sammler begegnet.';
      choose(h, `${c.name}: Ziel wählen`, rivalOptions(met), (rid) => {
        const t = rivalSide(Game.rivals.get(rid)!);
        h.openScene('Choice', {
          title: `${c.name}: Welche Kartennummer?`,
          options: cardOptions(SAMMELKARTEN),
          onPick: (id: string) => done(attackEffect(c.id, me, t, id)),
        });
      });
      return null;
    }
    // -------------------------------------------------- Abwehr
    case 'Z13':
      Game.inv.buffs.set('laubschild', UNTIL_USED);
      done('Ein Schild aus Laub umgibt dich. Der nächste Angriffszauber prallt ab.');
      return null;
    case 'Z14':
      Game.inv.buffs.set('spiegelblatt', UNTIL_USED);
      done('Ein schimmerndes Spiegelblatt schwebt um dich. Der nächste Angriffszauber fliegt zurück.');
      return null;
    case 'Z15': {
      const own = [...me.sammel(), ...me.frei()].filter((u) => u !== uid && !Game.protectedCards.has(u));
      if (!own.length) return 'Keine Karte zum Schützen im Buch.';
      choose(
        h,
        'Siegelband: Welche Karte schützen?',
        own.map((u) => ({ label: `${Game.registry.idOf(u)} ${card(Game.registry.idOf(u)).name}`, value: String(u) })),
        (v) => {
          Game.protectedCards.add(Number(v));
          done(`„${card(Game.registry.idOf(Number(v))).name}" ist jetzt dauerhaft vor Raub und Zerstörung geschützt.`);
        },
      );
      return null;
    }
    case 'Z16':
      Game.inv.buffs.set('tresor', 600);
      done('Ein Tresorsiegel legt sich 10 Minuten lang über deine Sammelseiten.');
      return null;
    case 'Z17':
      Game.inv.buffs.set('dornen', UNTIL_USED);
      done('Eine Hülle aus Dornen wächst um dich. Wer dich verzaubert, bezahlt dafür.');
      return null;
    case 'Z18':
      Game.inv.buffs.set('nebelmantel', 600);
      done('Ein Nebelmantel verhüllt dich 10 Minuten lang vor neugierigen Blicken.');
      return null;
    case 'Z19':
      Game.inv.buffs.set('bannkreis', 30);
      done('Ein Bannkreis breitet sich aus: 30 Sekunden lang scheitern alle Zauber.');
      return null;
    case 'Z20':
      Game.inv.buffs.set('gegenlicht', UNTIL_USED);
      done('Gegenlicht! Der nächste Informationszauber gegen dich scheitert – und verrät seinen Wirker.');
      return null;
    case 'Z21':
      Game.inv.buffs.set('anker', 600);
      done('Ein Ankerstein hält dich 10 Minuten lang fest an deinem Platz.');
      return null;
    case 'Z22': {
      if (!Game.lost.length) return 'Du hast in letzter Zeit keine Karte verloren.';
      // bevorzugt die jüngste verlorene Karte, die im Sammelbuch noch fehlt
      const missing = (id: string) => {
        const d = card(id);
        return d.kind === 'sammel' && Game.book.sammel[d.no] === null;
      };
      let i = -1;
      for (let k = Game.lost.length - 1; k >= 0 && i < 0; k--) if (missing(Game.lost[k]) && Game.registry.canCreate(Game.lost[k])) i = k;
      for (let k = Game.lost.length - 1; k >= 0 && i < 0; k--) if (Game.registry.canCreate(Game.lost[k])) i = k;
      if (i < 0) return `„${card(Game.lost[Game.lost.length - 1]).name}" kann nicht wiederhergestellt werden – das Limit ist erreicht.`;
      const id = Game.lost.splice(i, 1)[0];
      consume(uid);
      h.fx(color);
      Game.giveCard(id);
      h.message(c.name, `Aus goldener Tinte ersteht „${card(id).name}" neu!`);
      return null;
    }
    // -------------------------------------------------- Bewegung
    case 'Z23':
    case 'Z30': {
      const towns = TOWNS.filter((t) => Game.visited.has(t.id));
      if (!towns.length) return 'Du hast noch keine Stadt besucht.';
      choose(
        h,
        `${c.name}: Wohin?`,
        towns.map((t) => ({ label: t.name, value: t.id })),
        (id) => {
          const t = TOWNS.find((tt) => tt.id === id)!;
          consume(uid);
          h.fx(color);
          const x = t.x * TILE + 8;
          const y = (t.y + 3) * TILE + 12;
          if (h.map !== 'insel') h.changeMap('insel', x, y);
          else h.teleport(x, y, `${c.name}: Willkommen in ${t.name}!`);
        },
      );
      return null;
    }
    case 'Z25': {
      const t = TOWNS[0];
      consume(uid);
      h.fx(color);
      const x = t.x * TILE + 8;
      const y = (t.y - 7) * TILE + 12;
      if (h.map !== 'insel') h.changeMap('insel', x, y);
      else h.teleport(x, y, 'Heimweh: Du bist zurück am Ersten Tor.');
      return null;
    }
    case 'Z26': {
      const w = Game.lastWell;
      if (!w) return 'Du hast noch keinen Stadtbrunnen berührt.';
      consume(uid);
      h.fx(color);
      if (h.map !== w.map) h.changeMap(w.map, w.x, w.y);
      else h.teleport(w.x, w.y, 'Brunnensprung!');
      return null;
    }
    case 'Z27': {
      if (h.map !== 'insel') return 'Windwurf wirkt nur unter freiem Himmel auf der Insel.';
      const p = randomLand(h);
      if (!p) return 'Der Wind findet keinen Landeplatz.';
      consume(uid);
      h.fx(color);
      h.teleport(p.x, p.y, 'Ein Windstoss wirbelt dich über die Insel!');
      return null;
    }
    case 'Z31': {
      const a = Math.random() * Math.PI * 2;
      consume(uid);
      h.fx(color);
      h.teleport(h.x + Math.cos(a) * 300, h.y + Math.sin(a) * 300, 'Fluchtfunke! Du bist in Sicherheit.');
      return null;
    }
    case 'Z24':
    case 'Z28': {
      if (!met.length) return 'Du bist noch keinem anderen Sammler begegnet.';
      choose(h, `${c.name}: Wen?`, rivalOptions(met), (id) => {
        const r = Game.rivals.get(id)!;
        const d = defend(me, rivalSide(r), c);
        if (d.r !== 'ok') {
          done(d.msg ?? 'Geblockt.');
          return;
        }
        if (c.id === 'Z24') {
          consume(uid);
          h.fx(color);
          if (r.map !== h.map) h.changeMap(r.map, r.x + 20, r.y);
          else h.teleport(r.x + 20, r.y, `Fährtenflug: Du landest bei ${r.name}.`);
        } else {
          r.map = h.map;
          r.x = h.x + 24;
          r.y = h.y;
          done(`Ein goldener Faden zieht ${r.name} zu dir!`);
        }
      });
      return null;
    }
    case 'Z29': {
      const list = Game.rivals.near(h.map, h.x, h.y, RANGE_20M);
      if (!list.length) return 'Kein anderer Sammler im Umkreis von 20 Metern.';
      const msgs: string[] = [];
      for (const r of list) {
        const d = defend(me, rivalSide(r), c);
        if (d.r !== 'ok') {
          msgs.push(d.msg ?? '');
          continue;
        }
        const p = randomLand(h);
        if (p) {
          r.x = p.x;
          r.y = p.y;
        }
        msgs.push(`${r.name} wird davongeschleudert!`);
      }
      done(msgs.join(' '));
      return null;
    }
    // -------------------------------------------------- Information
    case 'Z32':
      choose(h, 'Fingerzeig: Welche Karte?', cardOptions(ALL_CARDS), (id) => {
        const owners = Game.registry.owners(id);
        const names = owners.map((o) => (o === 'spieler' ? 'du' : o === 'boden' ? 'am Boden liegend' : Game.rivals.get(o)?.name ?? o));
        const uniq = [...new Set(names)];
        done(uniq.length ? `„${card(id).name}" besitzen: ${uniq.join(', ')}.` : `Niemand besitzt „${card(id).name}".`);
      });
      return null;
    case 'Z33': {
      if (!met.length) return 'Du bist noch keinem anderen Sammler begegnet.';
      choose(h, 'Suchfalke: Wen suchen?', rivalOptions(met), (id) => {
        const r = Game.rivals.get(id)!;
        const d = defend(me, rivalSide(r), c);
        if (d.r !== 'ok') {
          done(d.msg ?? 'Geblockt.');
          return;
        }
        r.trackedUntil = Game.playTime + 60;
        let where = 'an einem unbekannten Ort';
        if (r.map === 'insel' && h.meta) {
          const tx = Math.floor(r.x / TILE);
          const ty = Math.floor(r.y / TILE);
          where = `in ${REGIONS[REGION_IDS[h.meta.region[ty * h.worldMap.w + tx]]]?.name ?? 'der Wildnis'}`;
        }
        done(`Der Suchfalke kreist über ${r.name} – ${where}. 60 Sekunden lang siehst du die Position auf der Karte.`);
      });
      return null;
    }
    case 'Z34':
      choose(h, 'Zählwerk: Welche Karte?', cardOptions(ALL_CARDS), (id) => {
        const k = card(id);
        const n = Game.registry.count(id);
        done(`Von „${k.name}" existieren ${n} von ${k.limit} Exemplaren. Noch ${Math.max(0, k.limit - n)} zu haben.`);
      });
      return null;
    case 'Z35': {
      const lines = [`Du: ${Game.book.collectedCount()}/100`, ...met.map((r) => `${r.name}: ${r.book.sammel.size}/100`)];
      done(met.length ? lines.join(' · ') : `${lines[0]}. Du bist noch keinem anderen Sammler begegnet.`);
      return null;
    }
    case 'Z36':
      choose(h, 'Fundflüstern: Welche Karte?', cardOptions(SAMMELKARTEN), (id) => done(`„${card(id).name}": ${card(id).hint}`));
      return null;
    case 'Z37':
      Game.inv.buffs.set('leuchtspur', 180);
      done('Ein leuchtender Pfeil weist dir 3 Minuten lang den Weg zur nächsten herumliegenden Karte.');
      return null;
    case 'Z39': {
      if (!met.length) return 'Du bist noch keinem anderen Sammler begegnet.';
      choose(h, 'Echoruf: An wen?', rivalOptions(met), (id) => {
        consume(uid);
        h.fx(color);
        h.openScene('Talk', { dialog: `rivale-${id}`, npc: `rivale-${id}` });
      });
      return null;
    }
    case 'Z40': {
      const last = Game.castLog.slice(-3).reverse();
      done(last.length ? `Zuletzt auf dich gewirkt: ${last.map((l) => `${l.spell} von ${l.who}`).join(' · ')}.` : 'Niemand hat in letzter Zeit Zauber auf dich gewirkt.');
      return null;
    }
  }
  return 'Dieser Zauber zeigt hier keine Wirkung.';
}
