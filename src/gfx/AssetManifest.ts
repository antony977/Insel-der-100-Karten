import type { Raster } from './Raster';
import { CHAR_FRAME_H, CHAR_FRAME_W, generateCharacterSheet, generateShadow, PLAYER_LOOK } from './generators/characters';
import * as obj from './generators/objects';
import * as fx from './generators/effects';
import * as ui from './generators/ui';
import { generateWater } from './generators/terrainTiles';
import { RAMPS, PAL } from './palette';
import * as title from './generators/title';
import * as cards from './generators/cardArt';
import { RANKS } from '../data/cardTypes';
import { creatureSheet, SPECIES } from './generators/creatures';
import * as props from './generators/props';
import { BUILDINGS } from '../data/buildings';
import { NPCS } from '../data/npcs';

/**
 * Verzeichnis aller Grafiken. Jede Grafik wird per Code erzeugt – kann aber jederzeit durch
 * eine echte PNG ersetzt werden: Datei nach `public/gfx/` legen und in
 * `public/gfx/overrides.json` eintragen, z. B. `{ "player": "player.png" }`.
 * Die PNG muss dasselbe Layout (Frame-Grösse, Reihenfolge) haben wie hier beschrieben.
 */
export interface AssetDef {
  key: string;
  /** Frame-Grösse bei Spritesheets (sonst Einzelbild) */
  frame?: { w: number; h: number };
  generate: () => Raster;
  /** Layout-Beschreibung für Grafiker:innen */
  layout: string;
}

export const ASSETS: AssetDef[] = [
  {
    key: 'player',
    frame: { w: CHAR_FRAME_W, h: CHAR_FRAME_H },
    generate: () => generateCharacterSheet(PLAYER_LOOK),
    layout:
      '24×32 je Frame. Spalten: idle0, idle1, walkA, walkB, atk1, atk2, atk3, hurt, roll1, roll2, aura, cast. Zeilen: unten, links, rechts, oben. Fusspunkt (12, 30).',
  },
  ...NPCS.map((n) => ({
    key: `npc-${n.id}`,
    frame: { w: CHAR_FRAME_W, h: CHAR_FRAME_H },
    generate: () => generateCharacterSheet(n.look),
    layout: 'wie player',
  })),
  { key: 'shadow', generate: () => generateShadow(16, 6), layout: 'Bodenschatten 16×6' },
  { key: 'tree', generate: () => obj.tree(0), layout: '32×44, Fusspunkt (16, 41)' },
  { key: 'tree-fruit', generate: () => obj.tree(1), layout: '32×44, Fusspunkt (16, 41)' },
  { key: 'tree-light', generate: () => obj.tree(2), layout: '32×44, Fusspunkt (16, 41)' },
  { key: 'pine', generate: () => obj.pine(), layout: '24×44, Fusspunkt (12, 41)' },
  { key: 'bush', generate: () => obj.bush(false), layout: '20×16, Fusspunkt (10, 14)' },
  { key: 'bush-berry', generate: () => obj.bush(true), layout: '20×16, Fusspunkt (10, 14)' },
  { key: 'rock', generate: () => obj.rock(false), layout: '16×14' },
  { key: 'boulder', generate: () => obj.rock(true), layout: '26×20' },
  { key: 'stump', generate: () => obj.stump(), layout: '16×12' },
  { key: 'sign', generate: () => obj.sign(), layout: '16×18, Fusspunkt (8, 16)' },
  { key: 'fence', generate: () => obj.fence(), layout: '16×16' },
  { key: 'lamp', generate: () => obj.lamp(), layout: '12×32, Fusspunkt (6, 30)' },
  { key: 'well', generate: () => obj.well(), layout: '28×30, Fusspunkt (14, 28)' },
  { key: 'campfire', frame: { w: 16, h: 18 }, generate: () => obj.campfire(), layout: '4 Frames 16×18' },
  { key: 'barrel', generate: () => obj.barrel(), layout: '12×16' },
  { key: 'crate', generate: () => obj.crate(), layout: '14×14' },
  { key: 'house', generate: () => obj.house(), layout: '64×62, Fusspunkt (32, 60)' },
  { key: 'house-blue', generate: () => obj.house(RAMPS.blue), layout: '64×62, Fusspunkt (32, 60)' },
  { key: 'decor', frame: { w: 16, h: 16 }, generate: () => obj.decorTileset(), layout: `16×16 Kacheln: ${obj.DECOR_NAMES.join(', ')}` },
  { key: 'water0', generate: () => generateWater(0), layout: '32×32 nahtlos' },
  { key: 'water1', generate: () => generateWater(1), layout: '32×32 nahtlos' },
  { key: 'water2', generate: () => generateWater(2), layout: '32×32 nahtlos' },
  { key: 'water3', generate: () => generateWater(3), layout: '32×32 nahtlos' },
  { key: 'fx-slash', frame: { w: 40, h: 40 }, generate: () => fx.slash(), layout: '3 Frames 40×40, Bogen nach rechts' },
  { key: 'fx-dust', frame: { w: 12, h: 12 }, generate: () => fx.dust(), layout: '4 Frames 12×12' },
  { key: 'fx-sparkle', frame: { w: 7, h: 7 }, generate: () => fx.sparkle(), layout: '4 Frames 7×7' },
  { key: 'fx-aura', frame: { w: 36, h: 44 }, generate: () => fx.auraFlame(), layout: '4 Frames 36×44 (weiss, wird eingefärbt)' },
  { key: 'fx-impact', frame: { w: 24, h: 24 }, generate: () => fx.impact(), layout: '3 Frames 24×24' },
  { key: 'proj', frame: { w: 12, h: 12 }, generate: () => fx.projectiles(), layout: `Projektile 12×12: ${fx.PROJ_FRAMES.join(', ')}` },
  { key: 'fx-ring', frame: { w: 48, h: 48 }, generate: () => fx.ring(), layout: 'Schockwelle 4 Frames 48×48 (weiss)' },
  { key: 'fx-roots', frame: { w: 16, h: 20 }, generate: () => fx.roots(), layout: 'Wurzeln 3 Frames 16×20' },
  { key: 'fx-poof', frame: { w: 16, h: 16 }, generate: () => fx.poof(), layout: 'Rauch 4 Frames 16×16' },
  { key: 'fx-crit', frame: { w: 15, h: 15 }, generate: () => fx.critStar(), layout: 'Kritisch-Stern 3 Frames 15×15' },
  { key: 'fx-coin', frame: { w: 7, h: 7 }, generate: () => fx.coin(), layout: 'Münze 4 Frames 7×7' },
  { key: 'fx-shield', generate: () => fx.shieldBubble(), layout: 'Aura-Schild 30×34 (weiss)' },
  { key: 'hud-time', frame: { w: 9, h: 9 }, generate: () => ui.timeIcons(), layout: `Symbole 9×9: ${ui.TIME_ICON_ORDER.join(', ')}` },
  { key: 'light-soft', generate: () => fx.lightSoft(), layout: 'Lichtkegel 64×64 (weiss, Stufen mit Dithering)' },
  { key: 'fx-rain', generate: () => fx.rainDrop(), layout: 'Regentropfen 3×7' },
  { key: 'fx-snow', frame: { w: 5, h: 5 }, generate: () => fx.snowFlake(), layout: 'Schneeflocken 3 Frames 5×5' },
  { key: 'fx-fog', generate: () => fx.fogCloud(), layout: 'Nebelschwade 96×40 (weiss)' },
  { key: 'fx-sand', generate: () => fx.sandGrain(), layout: 'Sandkorn 4×2' },
  { key: 'fx-net', generate: () => fx.auraNet(), layout: 'Aura-Netz 64×48' },
  { key: 'fx-alert', generate: () => fx.alertMark(), layout: 'Ausrufezeichen 7×11' },
  ...Object.keys(SPECIES).map((id) => ({
    key: `mon-${id}`,
    frame: { w: SPECIES[id].size, h: SPECIES[id].size },
    generate: () => creatureSheet(id),
    layout: `Monster ${SPECIES[id].size}×${SPECIES[id].size}, Blick nach links. Spalten: idle0, idle1, lauf0, lauf1, Angriff, Treffer, Spezial`,
  })),
  { key: 'ui-frame', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-frame-gold', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame-gold']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-frame-paper', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame-paper']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-frame-select', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame-select']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-cursor', frame: { w: 9, h: 9 }, generate: () => ui.menuCursor(), layout: '2 Frames 9×9' },
  { key: 'ui-icons', frame: { w: 9, h: 9 }, generate: () => ui.hudIcons(), layout: 'Herz, Aura, Münze, Karte, Buch, Stern (je 9×9)' },
  { key: 'ui-crosshair', generate: () => ui.crosshair(), layout: '11×11' },
  { key: 'ability-cards', frame: { w: ui.ABILITY_W, h: ui.ABILITY_H }, generate: () => ui.abilityCards(), layout: 'Fähigkeitskarten rot, grün, blau, gold' },
  { key: 'affinity-cards', frame: { w: ui.ABILITY_W, h: ui.ABILITY_H }, generate: () => ui.abilityCards([RAMPS.green, RAMPS.teal, RAMPS.violet, RAMPS.gold, RAMPS.pink]), layout: 'Affinitätskarten Wurzel, Strömung, Echo, Faden, Spiegel' },
  { key: 'ability-icons', frame: { w: 16, h: 16 }, generate: () => ui.abilityIcons(), layout: `Symbole 16×16: ${ui.ABILITY_ICON_ORDER.join(', ')}` },
  { key: 'title-bg', generate: () => title.titleBackground(), layout: '480×270 Titelhintergrund' },
  { key: 'cards', frame: { w: cards.CARD_W, h: cards.CARD_H }, generate: () => cards.cardsAtlas(), layout: 'Alle Karten 30×40 (Reihenfolge wie data/cards.ts)' },
  { key: 'cards-sil', frame: { w: cards.CARD_W, h: cards.CARD_H }, generate: () => cards.silhouetteAtlas(), layout: 'Silhouetten 000–099, 30×40' },
  { key: 'card-extras', frame: { w: cards.CARD_W, h: cards.CARD_H }, generate: () => cards.cardExtras(), layout: 'leer, Rückseite, Auswahl, Ablageziel (30×40)' },
  { key: 'card-icons', frame: { w: 16, h: 16 }, generate: () => cards.iconAtlas(), layout: 'Kartensymbole 16×16' },
  { key: 'ground-card', frame: { w: 12, h: 15 }, generate: () => cards.groundCards(RANKS), layout: 'Bodenkarte je Rang 12×15' },
  { key: 'book-open', generate: () => cards.bookOpen(), layout: `Aufgeschlagenes Buch ${cards.BOOK_W}×${cards.BOOK_H}` },
  { key: 'book-closed', generate: () => cards.bookClosed(), layout: 'Geschlossenes Buch 56×72' },
  { key: 'book-page', generate: () => cards.bookPage(), layout: 'Seite für Umblätter-Animation' },
  { key: 'book-tabs', frame: { w: 52, h: 16 }, generate: () => cards.bookTabs(), layout: 'Lesezeichen 52×16 (gold, türkis, holz, rot, violett)' },
  { key: 'chest', frame: { w: 16, h: 16 }, generate: () => obj.chest(), layout: 'Truhe zu/offen 16×16' },
  ...Object.entries(BUILDINGS).map(([key, b]) => ({ key, generate: () => props.building(b), layout: `Gebäude ${b.w} breit, Fusspunkt Mitte unten` })),
  { key: 'tower', generate: () => props.tower(), layout: 'Gildenturm 48×112' },
  { key: 'lighthouse', generate: () => props.lighthouse(), layout: 'Leuchtturm 32×100' },
  { key: 'windmill', frame: { w: 56, h: 84 }, generate: () => props.windmill(), layout: 'Windmühle 4 Frames 56×84' },
  { key: 'first-gate', generate: () => props.firstGate(), layout: 'Erstes Tor 88×76' },
  { key: 'casino', frame: { w: 104, h: 76 }, generate: () => props.casino(), layout: 'Casino 2 Frames 104×76' },
  { key: 'arena', generate: () => props.arena(), layout: 'Arena 128×72' },
  { key: 'hall-library', generate: () => props.hall('library'), layout: 'Bibliothek 96×76' },
  { key: 'hall-mirror', generate: () => props.hall('mirror'), layout: 'Spiegelsaal 96×76' },
  { key: 'hall-guild', generate: () => props.hall('guild'), layout: 'Gildenhalle 96×76' },
  { key: 'tent', generate: () => props.tent(), layout: 'Zelt 40×32' },
  { key: 'tent-blue', generate: () => props.tent(RAMPS.blue), layout: 'Zelt 40×32' },
  { key: 'stall', generate: () => props.stall(), layout: 'Marktstand 40×36' },
  { key: 'stall-red', generate: () => props.stall(RAMPS.red), layout: 'Marktstand 40×36' },
  { key: 'tree-moss', generate: () => props.treeColored([PAL.ink, PAL.deepTeal, PAL.teal, PAL.cyan], RAMPS.leather, 2), layout: '32×44' },
  { key: 'tree-autumn', generate: () => props.treeColored(RAMPS.orange, RAMPS.wood, 3), layout: '32×44' },
  { key: 'tree-blossom', generate: () => props.treeColored([PAL.berry, PAL.magenta, PAL.pink, PAL.white], RAMPS.wood, 4), layout: '32×44' },
  { key: 'tree-dead', generate: () => props.deadTree(), layout: '28×40' },
  { key: 'pine-snow', generate: () => props.snowPine(), layout: '24×44' },
  { key: 'palm', generate: () => props.palm(), layout: '32×46' },
  { key: 'cactus-plant', generate: () => props.cactusPlant(), layout: '16×26' },
  { key: 'rosebush', generate: () => props.rosebush(), layout: '20×18' },
  { key: 'hedge', generate: () => props.hedge(), layout: '16×22' },
  { key: 'glowshroom', generate: () => props.glowShroom(), layout: '20×24' },
  { key: 'crystal', generate: () => props.crystal(), layout: '16×22' },
  { key: 'crystal-violet', generate: () => props.crystal(RAMPS.violet), layout: '16×22' },
  { key: 'ruin-pillar', generate: () => props.ruinPillar(false), layout: '16×36' },
  { key: 'ruin-broken', generate: () => props.ruinPillar(true), layout: '16×36' },
  { key: 'statue', frame: { w: 20, h: 38 }, generate: () => props.statue(), layout: 'Statue 4 Richtungen 20×38' },
  { key: 'fog', frame: { w: 32, h: 40 }, generate: () => props.fogWall(), layout: 'Nebelwand 3 Frames 32×40' },
  { key: 'vines', generate: () => props.vineWall(), layout: 'Rankenwand 16×40' },
  { key: 'cave', generate: () => props.caveEntrance(), layout: 'Höhleneingang 40×32' },
  { key: 'stairs', generate: () => props.stairsDown(), layout: 'Treppe 32×24' },
  { key: 'board', generate: () => props.board(), layout: 'Tafel 30×30' },
  { key: 'boat', generate: () => props.boat(), layout: 'Boot 48×24' },
  { key: 'bench', generate: () => props.bench(), layout: 'Bank 24×14' },
  { key: 'fountain', frame: { w: 40, h: 36 }, generate: () => props.fountain(), layout: 'Brunnen 3 Frames 40×36' },
  { key: 'flowerpot', generate: () => props.flowerpot(), layout: '12×14' },
  { key: 'dandelion', generate: () => props.dandelion(), layout: 'Pusteblume 10×14' },
  { key: 'spot', frame: { w: 12, h: 8 }, generate: () => props.sparkleSpot(), layout: 'Glitzerstelle 2 Frames 12×8' },
  { key: 'title-island', generate: () => title.titleIsland(), layout: '220×70 Insel-Silhouette' },
  { key: 'mini-cards', frame: { w: 14, h: 19 }, generate: () => title.miniCards(), layout: '5 Frames 14×19' },
];
