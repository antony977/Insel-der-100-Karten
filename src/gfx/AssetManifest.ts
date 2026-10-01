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
  {
    key: 'npc-lumi',
    frame: { w: CHAR_FRAME_W, h: CHAR_FRAME_H },
    generate: () =>
      generateCharacterSheet({
        ...PLAYER_LOOK,
        hairStyle: 'bun',
        hair: RAMPS.hairSilver,
        cloth: RAMPS.violet,
        shirt: RAMPS.gold,
        accent: undefined,
        belt: RAMPS.gold,
        pants: RAMPS.violet,
        iris: PAL.violet,
      }),
    layout: 'wie player',
  },
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
  { key: 'ui-frame', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-frame-gold', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame-gold']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-frame-paper', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame-paper']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-frame-select', generate: () => ui.frame(ui.FRAME_STYLES['ui-frame-select']), layout: 'NineSlice 24×24, Ecken 8' },
  { key: 'ui-cursor', frame: { w: 9, h: 9 }, generate: () => ui.menuCursor(), layout: '2 Frames 9×9' },
  { key: 'ui-icons', frame: { w: 9, h: 9 }, generate: () => ui.hudIcons(), layout: 'Herz, Aura, Münze, Karte, Buch, Stern (je 9×9)' },
  { key: 'ui-crosshair', generate: () => ui.crosshair(), layout: '11×11' },
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
  { key: 'title-island', generate: () => title.titleIsland(), layout: '220×70 Insel-Silhouette' },
  { key: 'mini-cards', frame: { w: 14, h: 19 }, generate: () => title.miniCards(), layout: '5 Frames 14×19' },
];
