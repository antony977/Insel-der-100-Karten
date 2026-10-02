/**
 * Monster der Insel (datengetrieben). Jedes Monster kann sich beim Besiegen in seine
 * Sammelkarte verwandeln – sofern das globale Limit der Karte noch nicht erreicht ist.
 */

export type Behavior =
  /** greift nie an */
  | 'passive'
  /** läuft im Revier umher */
  | 'wander'
  /** bewegt sich in Sprüngen */
  | 'hop'
  /** verfolgt und greift im Nahkampf an */
  | 'melee'
  /** hält Abstand und schiesst */
  | 'ranged'
  /** Anlauf und Sturmangriff in gerader Linie */
  | 'charge'
  /** flieht vor der Spielfigur */
  | 'flee'
  /** wartet getarnt, bis man nah ist */
  | 'camo'
  /** fliegt (ignoriert Hindernisse am Boden) */
  | 'flyer'
  /** Sturzflug aus der Luft */
  | 'dive'
  /** Rudel: alarmiert Artgenossen, flankiert */
  | 'pack'
  /** gräbt sich ein und taucht beim Angriff auf */
  | 'burrow'
  /** teleportiert sich */
  | 'teleport'
  /** stiehlt Münzen und flieht */
  | 'thief';

export type ProjectileKind = 'mud' | 'spike' | 'feather' | 'rune' | 'spark' | 'ink' | 'leaf' | 'page' | 'orb';

export interface MonsterDef {
  id: string;
  name: string;
  /** Sammelkarte, in die sich das Monster verwandelt */
  card: string;
  /** Grafik (siehe gfx/generators/creatures.ts) */
  sprite: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  /** Laufgeschwindigkeit in px/s */
  speed: number;
  xp: number;
  money: [number, number];
  behavior: Behavior[];
  /** Entdeckungsradius in px */
  aggro: number;
  /** Nahkampf-Reichweite in px */
  reach: number;
  /** Radius der Trefferzone */
  radius: number;
  /** Basis-Chance, dass das Monster zur Karte wird */
  drop: number;
  ranged?: { proj: ProjectileKind; speed: number; cooldown: number; count?: number; spread?: number; range: number; slow?: boolean };
  special?: {
    /** nur von hinten verwundbar */
    backOnly?: boolean;
    /** nur mit aktivem Aura-Sinn sichtbar und treffbar */
    senseOnly?: boolean;
    /** nur ohne eigene Lichtquelle verwundbar */
    darkOnly?: boolean;
    /** nur mit Fangnetz zu fangen */
    netOnly?: boolean;
    /** erscheint nur, wenn ein Silberfisch im Beutel ist */
    baitOnly?: boolean;
    /** nur in Vollmondnächten */
    fullMoon?: boolean;
    /** nur nachts */
    nightOnly?: boolean;
    /** Trick-Monster: nur verwundbar, wenn in die Enge getrieben */
    cornerOnly?: boolean;
    /** frisst bei Treffer eine Karte aus den freien Slots */
    eatsCards?: boolean;
    /** stiehlt Casino-Chips statt Münzen */
    stealChips?: boolean;
    /** Mini-Boss */
    mini?: boolean;
    /** Boss: Bewegung und Angriffe steuert das Boss-System */
    boss?: boolean;
  };
  /** Flavour für das Bestiarium */
  text: string;
}

const m = (d: MonsterDef): MonsterDef => d;

export const MONSTERS: MonsterDef[] = [
  // ------------------------------------------------------------ Taufeld
  m({ id: 'wollknaeuel', name: 'Wollknäuel', card: '093', sprite: 'wollknaeuel', level: 1, hp: 14, atk: 0, def: 0, speed: 30, xp: 3, money: [1, 3], behavior: ['passive', 'wander'], aggro: 0, reach: 0, radius: 6, drop: 0.55, text: 'Friedlich und flauschig. Rollt bei Gefahr davon.' }),
  m({ id: 'huepfpilz', name: 'Hüpfpilz', card: '086', sprite: 'huepfpilz', level: 1, hp: 20, atk: 6, def: 0, speed: 52, xp: 5, money: [2, 5], behavior: ['hop', 'melee', 'wander'], aggro: 70, reach: 12, radius: 6, drop: 0.4, text: 'Hüpft fröhlich – und manchmal auf deinen Kopf.' }),
  m({ id: 'blattschnapper', name: 'Blattschnapper', card: '076', sprite: 'blattschnapper', level: 2, hp: 38, atk: 10, def: 1, speed: 40, xp: 9, money: [3, 8], behavior: ['camo', 'melee'], aggro: 34, reach: 16, radius: 9, drop: 0.35, text: 'Sieht aus wie ein Busch. Bis er zuschnappt.' }),
  m({ id: 'wiesenflitzer', name: 'Wiesenflitzer', card: '066', sprite: 'wiesenflitzer', level: 3, hp: 16, atk: 0, def: 0, speed: 118, xp: 14, money: [4, 9], behavior: ['flee', 'wander'], aggro: 80, reach: 0, radius: 6, drop: 1, special: { cornerOnly: true }, text: 'Zu flink für jeden Schlag. Nur wer ihn in eine Ecke treibt, erwischt ihn.' }),
  // ------------------------------------------------------------ Silberlauf / Windhalmfelder
  m({ id: 'kieselkrebs', name: 'Kieselkrebs', card: '089', sprite: 'kieselkrebs', level: 3, hp: 26, atk: 7, def: 2, speed: 46, xp: 7, money: [3, 6], behavior: ['pack', 'melee', 'wander'], aggro: 64, reach: 12, radius: 6, drop: 0.35, text: 'Tritt nie allein auf. Seitwärts im Rudel.' }),
  m({ id: 'schlammkroete', name: 'Schlammkröte', card: '079', sprite: 'schlammkroete', level: 4, hp: 34, atk: 8, def: 1, speed: 34, xp: 10, money: [4, 9], behavior: ['ranged', 'wander'], aggro: 110, reach: 0, radius: 7, drop: 0.3, ranged: { proj: 'mud', speed: 110, cooldown: 2.2, range: 120, slow: true }, text: 'Ihr Schlamm macht dich träge.' }),
  m({ id: 'stachelschwalbe', name: 'Stachelschwalbe', card: '070', sprite: 'stachelschwalbe', level: 5, hp: 30, atk: 11, def: 1, speed: 92, xp: 13, money: [4, 10], behavior: ['flyer', 'dive', 'wander'], aggro: 120, reach: 12, radius: 7, drop: 0.3, text: 'Kreist hoch oben – und stürzt dann pfeilschnell herab.' }),
  // ------------------------------------------------------------ Runenhall
  m({ id: 'tintenkobold', name: 'Tintenkobold', card: '077', sprite: 'tintenkobold', level: 5, hp: 28, atk: 5, def: 1, speed: 96, xp: 12, money: [5, 12], behavior: ['thief', 'flee', 'wander'], aggro: 90, reach: 12, radius: 6, drop: 0.35, text: 'Flinke Finger, klebrige Tinte. Holt sich deine Münzen.' }),
  m({ id: 'papierflatterer', name: 'Papierflatterer', card: '087', sprite: 'papierflatterer', level: 5, hp: 22, atk: 7, def: 0, speed: 70, xp: 8, money: [3, 7], behavior: ['flyer', 'pack', 'ranged', 'wander'], aggro: 110, reach: 0, radius: 6, drop: 0.35, ranged: { proj: 'page', speed: 120, cooldown: 2.6, range: 110 }, text: 'Ein Schwarm schneidender Blätter.' }),
  m({ id: 'glyphenwaechter', name: 'Glyphenwächter', card: '052', sprite: 'glyphenwaechter', level: 6, hp: 70, atk: 13, def: 4, speed: 30, xp: 20, money: [8, 16], behavior: ['ranged', 'melee', 'wander'], aggro: 120, reach: 16, radius: 9, drop: 0.25, ranged: { proj: 'rune', speed: 150, cooldown: 2.8, range: 140 }, text: 'Steinerner Hüter. Seine Rune feuert Strahlen.' }),
  // ------------------------------------------------------------ Möwenhafen / Möwenklippen
  m({ id: 'klippenmoewe', name: 'Klippenmöwe', card: '094', sprite: 'klippenmoewe', level: 6, hp: 26, atk: 9, def: 1, speed: 90, xp: 10, money: [3, 8], behavior: ['flyer', 'dive', 'pack', 'wander'], aggro: 120, reach: 12, radius: 7, drop: 0.45, text: 'Frech, gefrässig und nie allein.' }),
  m({ id: 'zangenkrabbe', name: 'Zangenkrabbe', card: '078', sprite: 'zangenkrabbe', level: 7, hp: 60, atk: 14, def: 3, speed: 44, xp: 18, money: [6, 14], behavior: ['melee', 'wander'], aggro: 80, reach: 15, radius: 9, drop: 0.3, special: { backOnly: true }, text: 'Vorne gepanzert. Wer klug ist, rollt sich hinter sie.' }),
  m({ id: 'quallenlicht', name: 'Quallenlicht', card: '053', sprite: 'quallenlicht', level: 8, hp: 44, atk: 12, def: 2, speed: 36, xp: 18, money: [6, 12], behavior: ['flyer', 'ranged', 'wander'], aggro: 120, reach: 0, radius: 7, drop: 0.3, ranged: { proj: 'spark', speed: 90, cooldown: 2.4, count: 3, spread: 0.5, range: 120 }, special: { nightOnly: true }, text: 'Leuchtet nur in der Nacht. Elektrische Kugeln!' }),
  // ------------------------------------------------------------ Würfelheim
  m({ id: 'wuerfelmimik', name: 'Würfelmimik', card: '054', sprite: 'wuerfelmimik', level: 9, hp: 70, atk: 16, def: 4, speed: 64, xp: 24, money: [12, 30], behavior: ['camo', 'hop', 'melee'], aggro: 30, reach: 14, radius: 7, drop: 0.3, text: 'Eine Kiste voller Zähne. Nicht jede Truhe ist eine Truhe.' }),
  m({ id: 'jetonratte', name: 'Jetonratte', card: '088', sprite: 'jetonratte', level: 8, hp: 34, atk: 8, def: 1, speed: 100, xp: 12, money: [5, 12], behavior: ['thief', 'pack', 'flee', 'wander'], aggro: 90, reach: 11, radius: 6, drop: 0.4, special: { stealChips: true }, text: 'Klaut Chips und verschwindet in der Gosse.' }),
  m({ id: 'glueckskatze', name: 'Glückskatze', card: '023', sprite: 'glueckskatze', level: 10, hp: 30, atk: 0, def: 0, speed: 140, xp: 60, money: [20, 60], behavior: ['flee', 'wander'], aggro: 110, reach: 0, radius: 6, drop: 1, special: { baitOnly: true }, text: 'Die flinkste Katze der Insel – nur ein Silberfisch lockt sie an.' }),
  // ------------------------------------------------------------ Hohenkamm
  m({ id: 'felsbock', name: 'Felsbock', card: '068', sprite: 'felsbock', level: 11, hp: 80, atk: 18, def: 5, speed: 46, xp: 26, money: [8, 18], behavior: ['charge', 'wander'], aggro: 110, reach: 14, radius: 9, drop: 0.3, text: 'Senkt den Kopf – und stösst alles um.' }),
  m({ id: 'frostfuchs', name: 'Frostfuchs', card: '055', sprite: 'frostfuchs', level: 12, hp: 64, atk: 16, def: 3, speed: 96, xp: 26, money: [8, 18], behavior: ['pack', 'melee', 'wander'], aggro: 110, reach: 13, radius: 8, drop: 0.3, text: 'Rudeljäger im Schnee. Allein flieht er.' }),
  m({ id: 'donnerwidder', name: 'Donnerwidder', card: '047', sprite: 'donnerwidder', level: 13, hp: 110, atk: 22, def: 6, speed: 50, xp: 36, money: [12, 24], behavior: ['charge', 'wander'], aggro: 120, reach: 15, radius: 10, drop: 0.25, text: 'Seine Hörner knistern vor Blitzen.' }),
  m({ id: 'gipfeladler', name: 'Gipfeladler', card: '048', sprite: 'gipfeladler', level: 14, hp: 96, atk: 20, def: 4, speed: 100, xp: 40, money: [12, 26], behavior: ['flyer', 'dive', 'ranged', 'wander'], aggro: 150, reach: 16, radius: 11, drop: 0.25, ranged: { proj: 'feather', speed: 150, cooldown: 3, count: 5, spread: 0.9, range: 150 }, text: 'König der Lüfte. Lässt Federn regnen.' }),
  // ------------------------------------------------------------ Sandspiegel
  m({ id: 'duenenwuehler', name: 'Dünenwühler', card: '069', sprite: 'duenenwuehler', level: 14, hp: 90, atk: 22, def: 5, speed: 60, xp: 34, money: [10, 22], behavior: ['burrow', 'melee'], aggro: 110, reach: 16, radius: 9, drop: 0.3, text: 'Lauert unter dem Sand. Achte auf wandernde Hügel.' }),
  m({ id: 'goldkaefer', name: 'Goldkäfer', card: '045', sprite: 'goldkaefer', level: 15, hp: 120, atk: 20, def: 8, speed: 42, xp: 40, money: [20, 40], behavior: ['melee', 'charge', 'wander'], aggro: 100, reach: 15, radius: 10, drop: 0.25, special: { backOnly: true }, text: 'Gepanzert und schwer. Nur von hinten verwundbar.' }),
  m({ id: 'trugbild', name: 'Trugbild', card: '033', sprite: 'trugbild', level: 16, hp: 70, atk: 20, def: 2, speed: 60, xp: 44, money: [14, 30], behavior: ['flyer', 'melee', 'teleport', 'wander'], aggro: 120, reach: 14, radius: 9, drop: 0.35, special: { senseOnly: true }, text: 'Ein flirrender Wüstengeist – nur mit Aura-Sinn zu erkennen.' }),
  m({ id: 'kaktuskrieger', name: 'Kaktuskrieger', card: '056', sprite: 'kaktuskrieger', level: 15, hp: 100, atk: 18, def: 5, speed: 34, xp: 36, money: [12, 26], behavior: ['ranged', 'wander'], aggro: 140, reach: 0, radius: 9, drop: 0.25, ranged: { proj: 'spike', speed: 160, cooldown: 2.6, count: 6, spread: 6.28, range: 140 }, text: 'Stachelsalven in alle Richtungen.' }),
  // ------------------------------------------------------------ Nebelhain
  m({ id: 'nebelwolf', name: 'Nebelwolf', card: '057', sprite: 'nebelwolf', level: 17, hp: 110, atk: 24, def: 5, speed: 100, xp: 44, money: [12, 26], behavior: ['pack', 'melee', 'wander'], aggro: 130, reach: 14, radius: 9, drop: 0.25, text: 'Grauer Jäger. Umkreist dich mit dem Rudel.' }),
  m({ id: 'nebelwolf-alpha', name: 'Nebelwolf-Alpha', card: '019', sprite: 'nebelwolf-alpha', level: 20, hp: 320, atk: 32, def: 8, speed: 104, xp: 160, money: [60, 120], behavior: ['pack', 'melee', 'charge'], aggro: 160, reach: 18, radius: 12, drop: 0.8, special: { fullMoon: true, mini: true }, text: 'Rudelführer. Zeigt sich nur bei Vollmond.' }),
  m({ id: 'moosgolem', name: 'Moosgolem', card: '046', sprite: 'moosgolem', level: 18, hp: 200, atk: 28, def: 9, speed: 30, xp: 56, money: [16, 34], behavior: ['camo', 'melee'], aggro: 40, reach: 18, radius: 12, drop: 0.25, text: 'Ein Felsen mit Moos. Meistens.' }),
  m({ id: 'irrlicht', name: 'Irrlicht', card: '034', sprite: 'irrlicht', level: 18, hp: 60, atk: 18, def: 2, speed: 70, xp: 48, money: [14, 30], behavior: ['flyer', 'ranged', 'teleport', 'wander'], aggro: 140, reach: 0, radius: 7, drop: 0.35, ranged: { proj: 'orb', speed: 110, cooldown: 2.2, range: 140 }, special: { darkOnly: true }, text: 'Tanzt im Nebel. Nur verwundbar, wenn dein Licht aus ist.' }),
  m({ id: 'schattenluchs', name: 'Schattenluchs', card: '035', sprite: 'schattenluchs', level: 19, hp: 120, atk: 30, def: 5, speed: 110, xp: 52, money: [16, 32], behavior: ['camo', 'charge', 'melee'], aggro: 90, reach: 14, radius: 9, drop: 0.3, special: { senseOnly: true }, text: 'Unsichtbarer Lauerer. Aura-Sinn verrät ihn.' }),
  m({ id: 'wurzelhydra', name: 'Wurzelhydra', card: '024', sprite: 'wurzelhydra', level: 21, hp: 600, atk: 30, def: 10, speed: 20, xp: 260, money: [80, 160], behavior: ['ranged', 'melee'], aggro: 150, reach: 22, radius: 16, drop: 1, ranged: { proj: 'leaf', speed: 120, cooldown: 1.8, count: 3, spread: 0.6, range: 160 }, special: { mini: true }, text: 'Dreiköpfige Wurzelbestie hinter der Wurzelpforte.' }),
  // ------------------------------------------------------------ Rosenweil
  m({ id: 'dornenranke', name: 'Dornenranke', card: '058', sprite: 'dornenranke', level: 19, hp: 110, atk: 26, def: 5, speed: 0, xp: 46, money: [14, 28], behavior: ['camo', 'melee'], aggro: 36, reach: 22, radius: 9, drop: 0.3, text: 'Lauert in Rosenhecken.' }),
  m({ id: 'herzfalter', name: 'Herzfalter', card: '080', sprite: 'herzfalter', level: 18, hp: 20, atk: 0, def: 0, speed: 60, xp: 30, money: [6, 14], behavior: ['flyer', 'flee', 'wander'], aggro: 60, reach: 0, radius: 6, drop: 1, special: { netOnly: true }, text: 'Falter mit Herzflügeln. Nur mit einem Fangnetz zu erwischen.' }),
  // ------------------------------------------------------------ Labyrinth
  m({ id: 'seitenfresser', name: 'Seitenfresser', card: '049', sprite: 'seitenfresser', level: 24, hp: 160, atk: 30, def: 7, speed: 56, xp: 70, money: [20, 40], behavior: ['melee', 'wander'], aggro: 110, reach: 15, radius: 9, drop: 0.25, special: { eatsCards: true }, text: 'Frisst Karten aus freien Slots, wenn er dich erwischt!' }),
  m({ id: 'tintenschatten', name: 'Tintenschatten', card: '050', sprite: 'tintenschatten', level: 25, hp: 130, atk: 32, def: 5, speed: 60, xp: 72, money: [20, 40], behavior: ['flyer', 'ranged', 'teleport'], aggro: 140, reach: 0, radius: 9, drop: 0.25, ranged: { proj: 'ink', speed: 130, cooldown: 2, count: 3, spread: 0.5, range: 150 }, text: 'Schatten aus verlaufener Tinte. Taucht hier und dort auf.' }),
  m({ id: 'kartensoldat', name: 'Kartensoldat', card: '059', sprite: 'kartensoldat', level: 24, hp: 150, atk: 30, def: 8, speed: 48, xp: 64, money: [18, 36], behavior: ['pack', 'melee', 'charge'], aggro: 120, reach: 18, radius: 9, drop: 0.3, text: 'Marschiert in Formation. Die Lanze sticht weit.' }),
  // ------------------------------------------------------------ Bosse (Steuerung: systems/combat/BossFight.ts)
  m({ id: 'moosbart', name: 'Moosbart', card: '022', sprite: 'moosbart', level: 8, hp: 700, atk: 18, def: 4, speed: 34, xp: 400, money: [200, 260], behavior: [], aggro: 999, reach: 26, radius: 20, drop: 1, special: { boss: true }, text: 'Der Grasriese des Taufelds.' }),
  m({ id: 'tintenkoloss', name: 'Tintenkoloss', card: '009', sprite: 'tintenkoloss', level: 14, hp: 1150, atk: 24, def: 6, speed: 30, xp: 800, money: [300, 400], behavior: [], aggro: 999, reach: 26, radius: 20, drop: 1, special: { boss: true }, text: 'Ein Riese aus Tinte und Seiten.' }),
  m({ id: 'tiefenmaul', name: 'Tiefenmaul', card: '011', sprite: 'tiefenmaul', level: 16, hp: 1250, atk: 26, def: 6, speed: 0, xp: 900, money: [300, 420], behavior: [], aggro: 999, reach: 30, radius: 24, drop: 1, special: { boss: true }, text: 'Die Krake im Hafenbecken.' }),
  m({ id: 'hausbankier', name: 'Hausbankier', card: '013', sprite: 'hausbankier', level: 15, hp: 1200, atk: 25, def: 8, speed: 44, xp: 850, money: [500, 700], behavior: [], aggro: 999, reach: 22, radius: 18, drop: 1, special: { boss: true }, text: 'Der lebende Glücksautomat im Tresorraum.' }),
  m({ id: 'kragor', name: 'Sturmgreif Kragor', card: '007', sprite: 'kragor', level: 20, hp: 1650, atk: 32, def: 8, speed: 70, xp: 1200, money: [400, 600], behavior: [], aggro: 999, reach: 26, radius: 22, drop: 1, special: { boss: true }, text: 'Herr der Gipfelstürme.' }),
  m({ id: 'nebelmutter', name: 'Nebelmutter', card: '003', sprite: 'nebelmutter', level: 22, hp: 1800, atk: 34, def: 8, speed: 40, xp: 1400, money: [400, 600], behavior: [], aggro: 999, reach: 24, radius: 20, drop: 1, special: { boss: true }, text: 'Die Seele des Nebelhains.' }),
  m({ id: 'dornenbaron', name: 'Dornenbaron', card: '012', sprite: 'dornenbaron', level: 21, hp: 1700, atk: 33, def: 10, speed: 54, xp: 1300, money: [400, 600], behavior: [], aggro: 999, reach: 22, radius: 16, drop: 1, special: { boss: true }, text: 'Ritter der wilden Rosenhecken.' }),
  m({ id: 'leser', name: 'Der Leere Leser', card: '000', sprite: 'leser', level: 28, hp: 2600, atk: 40, def: 10, speed: 40, xp: 2500, money: [800, 1000], behavior: [], aggro: 999, reach: 24, radius: 20, drop: 1, special: { boss: true }, text: 'Er liest alle Geschichten – und lässt nur leere Seiten zurück.' }),
  m({ id: 'varga', name: 'Varga Aschenherz', card: '025', sprite: 'varga', level: 26, hp: 2200, atk: 38, def: 9, speed: 60, xp: 2000, money: [600, 800], behavior: [], aggro: 999, reach: 20, radius: 12, drop: 1, special: { boss: true }, text: 'Anführerin der Aschenhand.' }),
  // ------------------------------------------------------------ Aschenhand (Rivalen-Duelle, keine Karte)
  m({ id: 'grell', name: 'Grell', card: '', sprite: 'grell', level: 14, hp: 600, atk: 26, def: 6, speed: 70, xp: 300, money: [100, 160], behavior: ['melee', 'charge'], aggro: 200, reach: 16, radius: 9, drop: 0, special: { mini: true }, text: 'Schläger der Aschenhand.' }),
  m({ id: 'vesper', name: 'Vesper', card: '', sprite: 'vesper', level: 16, hp: 520, atk: 24, def: 5, speed: 64, xp: 320, money: [100, 160], behavior: ['ranged', 'teleport'], aggro: 200, reach: 0, radius: 9, drop: 0, ranged: { proj: 'orb', speed: 140, cooldown: 1.6, count: 3, spread: 0.5, range: 170 }, special: { mini: true }, text: 'Spionin der Aschenhand.' }),
  m({ id: 'nox', name: 'Nox', card: '', sprite: 'nox', level: 18, hp: 560, atk: 22, def: 5, speed: 96, xp: 340, money: [100, 160], behavior: ['thief', 'melee', 'flee'], aggro: 200, reach: 14, radius: 9, drop: 0, special: { mini: true, eatsCards: true }, text: 'Dieb der Aschenhand.' }),
  // ------------------------------------------------------------ Training (keine Karte)
  m({ id: 'strohpuppe', name: 'Strohpuppe', card: '', sprite: 'strohpuppe', level: 1, hp: 30, atk: 0, def: 0, speed: 0, xp: 2, money: [0, 0], behavior: ['passive'], aggro: 0, reach: 0, radius: 8, drop: 0, text: 'Trainingspuppe aus Stroh.' }),
];

export const MONSTER_BY_ID: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((d) => [d.id, d]));

/** Erfahrung bis zur nächsten Stufe */
export function xpToNext(level: number): number {
  return Math.round(24 * Math.pow(level, 1.55));
}
