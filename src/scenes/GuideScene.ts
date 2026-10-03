import Phaser from 'phaser';
import { Sound } from '../audio/AudioEngine';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Input } from '../input/InputManager';
import { keyLabel } from '../input/Actions';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { wrapText } from '../gfx/font/PixelFont';
import { charFrame } from '../gfx/generators/characters';
import { cardIndex } from '../data/cards';
import { AFFINITY_BY_ID } from '../data/aura';
import { Settings } from '../systems/Settings';
import { Game } from '../systems/GameState';
import { HUD_EVENTS } from './HudScene';
import { SaveSystem } from '../systems/SaveSystem';

/**
 * Anleitung „Erste Schritte": erscheint beim ersten Betreten der Insel und ist danach
 * jederzeit im Pausenmenü aufrufbar. Jede Seite hat ein Bild links und kurze Absätze rechts.
 */
export interface GuideData {
  from?: 'World' | 'Pause';
}

type Art = (s: GuideScene, x: number, y: number) => void;
interface Page {
  title: string;
  art: Art;
  /** Absätze – oder Tabelle „Taste → Aktion" für die Steuerung */
  text: () => string[];
  rows?: () => [string, string][];
}

const PX = 20;
const PY = 10;
const PW = GAME_W - 40;
const PH = GAME_H - 20;
const ART_X = PX + 82;
const ART_Y = PY + 116;
const TEXT_X = PX + 168;
const TEXT_W = PW - 168 - 14;

/** Tastenbezeichnungen je nach Eingabegerät */
function controlRows(): [string, string][] {
  const src = Input.source;
  if (src === 'touch') {
    return [
      ['Linke Hälfte', 'Joystick: laufen'],
      ['A', 'Angreifen, sprechen, öffnen'],
      ['B', 'Ausweichrolle'],
      ['Aura', 'Aura (halten und wischen: Aura-Rad)'],
      ['Buch', 'Kartenbuch (oben rechts)'],
      ['Karte', 'Weltkarte'],
      ['1 2 3', 'Schnellzauber'],
      ['II', 'Pause und Speichern'],
    ];
  }
  if (src === 'gamepad') {
    return [
      ['Stick', 'Laufen'],
      ['A', 'Angreifen, sprechen, öffnen'],
      ['B', 'Ausweichrolle'],
      ['X', 'Aura (halten: Aura-Rad)'],
      ['Y', 'Kartenbuch'],
      ['Select', 'Weltkarte'],
      ['LB RB RT', 'Schnellzauber'],
      ['Start', 'Pause und Speichern'],
    ];
  }
  const b = Settings.get().bindings;
  const k = (a: keyof typeof b) => keyLabel(b[a][0] ?? '?');
  return [
    [`${k('up')}${k('left')}${k('down')}${k('right')}`, 'Laufen'],
    [k('attack'), 'Angreifen, sprechen, öffnen'],
    [k('dodge'), 'Ausweichrolle'],
    [k('aura'), 'Aura (halten: Aura-Rad)'],
    [k('book'), 'Kartenbuch'],
    [k('map'), 'Weltkarte'],
    [`${k('spell1')} ${k('spell2')} ${k('spell3')}`, 'Schnellzauber'],
    [k('pause'), 'Pause und Speichern'],
  ];
}

function bookKey(): string {
  if (Input.source === 'touch') return 'mit dem Buch-Knopf oben rechts';
  if (Input.source === 'gamepad') return 'mit Y';
  return `mit der Taste ${keyLabel(Settings.get().bindings.book[0] ?? 'KeyB')}`;
}

const PAGES: Page[] = [
  {
    title: 'Willkommen auf der Insel',
    art: (s, x, y) => {
      s.img(x, y - 6, 'first-gate').setScale(1);
      [-14, 0, 14].forEach((a, i) => s.img(x - 24 + i * 24, y + 40, 'card-extras', 1).setAngle(a).setScale(1));
    },
    text: () => [
      'Auf dieser Insel ist alles eine Karte: Heiltränke, Werkzeuge, Schlüssel – sogar die Monster.',
      'Dein Ziel: Sammle alle 100 Sammelkarten in deinem Kartenbuch. Dann öffnet sich das Erste Tor, und du darfst drei Karten mit in die echte Welt nehmen.',
      'Du bist nicht allein: Andere Sammler suchen dieselben Karten.',
    ],
  },
  {
    title: 'So steuerst du',
    art: (s, x, y) => {
      s.img(x, y + 26, 'shadow').setScale(3).setAlpha(0.6);
      s.img(x, y, 'player', charFrame('down', 'idle0')).setScale(3);
    },
    text: () => [],
    rows: controlRows,
  },
  {
    title: 'Neue Karten: 60 Sekunden',
    art: (s, x, y) => {
      s.img(x - 34, y - 8, 'cards', cardIndex('095')).setScale(1.5);
      s.label(x - 34, y + 30, '60 s', PAL.gold);
      s.label(x + 2, y - 14, '→', PAL.cream);
      s.img(x + 36, y - 8, 'book-closed').setScale(1);
    },
    text: () => [
      'Neue Karten landen zuerst in deiner Hand. Unten im Bild läuft für jede ein Zähler.',
      `Lege sie innerhalb von 60 Sekunden ins Kartenbuch. Sonst verwandelt sich die Karte für immer in ihren Gegenstand.`,
      `Das Buch öffnest du ${bookKey()}. Am schnellsten geht es dort mit „Alle".`,
    ],
  },
  {
    title: 'Das Kartenbuch',
    art: (s, x, y) => {
      const ids = ['093', '095', '', '', '', ''];
      ids.forEach((id, i) => {
        const cx = x - 36 + (i % 3) * 36;
        const cy = y - 24 + Math.floor(i / 3) * 46;
        if (id) s.img(cx, cy, 'cards', cardIndex(id));
        else s.img(cx, cy, 'cards-sil', 10 + i);
      });
      s.label(x, y + 50, 'Sammelseiten', PAL.mist);
    },
    text: () => [
      'Sammelseiten 000–099: Jede Karte hat dort ihren festen Platz. Nur diese Seiten zählen für dein Ziel.',
      'Freie Slots: für Zauber, Doppelte und Vorräte. Bei fehlenden Karten steht, wo du sie findest.',
      '„Entfessle!" verwandelt eine Karte in den echten Gegenstand, etwa einen Trank. Jede Karte gibt es nur begrenzt oft.',
    ],
  },
  {
    title: 'Kampf und Aura',
    art: (s, x, y) => {
      const color = AFFINITY_BY_ID[Game.prog.affinity]?.color ?? PAL.gold;
      const flame = s.add.sprite(x - 30, y - 6, 'fx-aura', 0).setScale(1.5).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
      flame.play(s.loopAnim('fx-aura-loop', 'fx-aura', 4, 10));
      s.track(flame);
      s.img(x - 30, y, 'player', charFrame('right', 'idle0')).setScale(2);
      s.img(x + 30, y + 4, 'mon-huepfpilz', 0).setScale(2);
      s.img(x + 30, y - 40, 'cards', cardIndex('086')).setScale(1);
    },
    text: () => [
      'Besiegte Wesen verwandeln sich manchmal in ihre Karte.',
      'Aura ist deine innere Kraft: Aura-Sinn zeigt Verborgenes, der Aura-Stoss trifft aus der Ferne. Halte die Aura-Taste, um im Aura-Rad zu wählen.',
      'Mit jeder Stufe wählst du eine neue Fähigkeit. Rote Flächen am Boden kündigen starke Angriffe an – rechtzeitig wegrollen!',
    ],
  },
  {
    title: 'Rasten und Speichern',
    art: (s, x, y) => {
      const fire = s.add.sprite(x, y + 6, 'campfire', 0).setScale(3);
      fire.play(s.loopAnim('obj-campfire', 'campfire', 4, 8));
      s.track(fire);
      s.img(x - 40, y - 34, 'ui-icons', 0).setScale(2);
      s.img(x + 40, y - 34, 'ui-icons', 4).setScale(2);
    },
    text: () => [
      'Am Rastfeuer heilst du dich und speicherst. Das Spiel speichert ausserdem regelmässig von selbst.',
      'Gehen dir die Lebenspunkte aus, wachst du am letzten Rastfeuer auf. Dein Geld und die Karten in den freien Slots sind dann verloren – die Sammelseiten bleiben sicher.',
      'Nachts wird es dunkel, und andere Wesen sind unterwegs.',
    ],
  },
  {
    title: "Los geht's!",
    art: (s, x, y) => {
      s.img(x, y + 26, 'shadow').setScale(3).setAlpha(0.6);
      s.img(x, y, s.textures.exists('npc-lumi') ? 'npc-lumi' : 'player', charFrame('down', 'idle0')).setScale(3);
      s.track(s.add.triangle(x + 38, y - 30, 0, -6, 5, 4, -5, 4, PAL.cyan).setStrokeStyle(1, PAL.ink).setScale(2).setAngle(200));
    },
    text: () =>
      Game.quests.stage('q-start') === 0
        ? [
            'Lumi wartet gleich neben dir am Ersten Tor. Sprich mit ihr – sie schenkt dir deine ersten Karten.',
            'Der blaue Pfeil zeigt dir den Weg zur nächsten Aufgabe. Alle Aufgaben stehen im Buch unter „Quests".',
            'Diese Anleitung findest du jederzeit im Pausenmenü.',
          ]
        : [
            'Weisst du nicht weiter? Lumi am Ersten Tor gibt dir jederzeit einen Rat.',
            'Der blaue Pfeil zeigt dir den Weg zur nächsten Aufgabe. Alle Aufgaben stehen im Buch unter „Quests".',
          ],
  },
];

export class GuideScene extends BaseScene {
  private page = 0;
  private from: 'World' | 'Pause' = 'World';
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private justOpened = true;

  constructor() {
    super('Guide');
  }

  create(data: GuideData): void {
    this.setupCamera();
    Input.setContext('menu');
    this.from = data?.from ?? 'World';
    this.page = 0;
    this.justOpened = true;
    Sound.duck('guide', true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Sound.duck('guide', false));
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.78).setOrigin(0, 0);
    addPanel(this, PX, PY, PW, PH, 'ui-frame');
    // Bildfeld links
    addPanel(this, PX + 10, PY + 36, 144, 166, 'ui-frame-paper').setAlpha(0.18);
    addText(this, PX + 12, PY + 7, 'Erste Schritte', { font: 'px', color: PAL.mist });
    this.render();
  }

  /** Bild ins Bildfeld setzen (wird beim Umblättern entfernt) */
  img(x: number, y: number, key: string, frame?: number): Phaser.GameObjects.Image {
    const i = this.add.image(Math.round(x), Math.round(y), key, frame);
    this.dyn.push(i);
    return i;
  }

  label(x: number, y: number, t: string, color: number): Phaser.GameObjects.BitmapText {
    const l = addText(this, Math.round(x), Math.round(y), t, { font: 'px-o', ox: 0.5, color });
    this.dyn.push(l);
    return l;
  }

  /** Schleifen-Animation (wird bei Bedarf angelegt, Schlüssel wie in der Welt) */
  loopAnim(key: string, texture: string, frames: number, fps: number): string {
    if (!this.anims.exists(key)) {
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(texture, { start: 0, end: frames - 1 }), frameRate: fps, repeat: -1 });
    }
    return key;
  }

  track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.dyn.push(o);
    return o;
  }

  private render(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const p = PAGES[this.page];
    const last = this.page === PAGES.length - 1;
    // Seitenzahl und Titel
    this.track(addText(this, PX + PW - 12, PY + 7, `${this.page + 1} / ${PAGES.length}`, { font: 'px', ox: 1, color: PAL.mist }));
    this.track(addText(this, GAME_W / 2, PY + 15, p.title, { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 }));
    // Bild
    p.art(this, ART_X, ART_Y);
    // Text oder Steuerungstabelle
    let y = PY + 42;
    if (p.rows) {
      for (const [key, action] of p.rows()) {
        const w = Math.max(22, Math.min(78, 10 + key.length * 6));
        this.track(addPanel(this, TEXT_X, y - 2, w, 15, 'ui-frame-gold'));
        this.track(addText(this, TEXT_X + w / 2, y + 1, key, { font: 'px', ox: 0.5, color: PAL.cream }));
        this.track(addText(this, TEXT_X + 84, y + 1, action, { font: 'px-s', color: PAL.white }));
        y += 19;
      }
    } else {
      for (const para of p.text()) {
        const lines = wrapText(para, TEXT_W);
        this.track(addText(this, TEXT_X, y, lines.join('\n'), { font: 'px-s', color: PAL.white }));
        y += lines.length * 12 + 7;
      }
    }
    // Knöpfe
    const by = PY + PH - 30;
    if (this.page > 0) this.button(PX + 12, by, 88, 'Zurück', () => this.go(-1), false);
    this.button(PX + PW - 12 - 112, by, 112, last ? "Los geht's!" : 'Weiter', () => this.go(1), true);
    if (!last) this.button(GAME_W / 2 - 44, by, 88, 'Überspringen', () => this.close(), false);
    // Punkte
    PAGES.forEach((_pg, i) => {
      this.track(this.add.rectangle(GAME_W / 2 - (PAGES.length * 8) / 2 + i * 8 + 4, by - 8, 4, 4, i === this.page ? PAL.gold : PAL.stone));
    });
    // Hinweis zur Bedienung
    const hint =
      Input.source === 'touch' ? 'Tippe auf „Weiter"' : Input.source === 'gamepad' ? '◀ ▶ blättern · B schliessen' : '← → blättern · Esc schliessen';
    this.track(addText(this, PX + 12, by - 12, hint, { font: 'px', color: PAL.stone }));
    // sanft einblenden
    for (const o of this.dyn) {
      const g = o as unknown as { alpha?: number; setAlpha?: (a: number) => void };
      if (g.setAlpha && g.alpha !== undefined) {
        const a = g.alpha;
        g.setAlpha(0);
        this.tweens.add({ targets: o, alpha: a, duration: 140 });
      }
    }
  }

  private button(x: number, y: number, w: number, label: string, fn: () => void, primary: boolean): void {
    const p = addPanel(this, x, y, w, 22, primary ? 'ui-frame-gold' : 'ui-frame');
    p.setInteractive({ useHandCursor: true }).on('pointerdown', fn);
    this.track(p);
    this.track(addText(this, x + w / 2, y + 5, label, { font: 'px-s', ox: 0.5, color: primary ? PAL.cream : PAL.white }));
  }

  private go(d: number): void {
    const n = this.page + d;
    if (n < 0) return;
    if (n >= PAGES.length) {
      this.close();
      return;
    }
    Sound.play('page');
    this.page = n;
    this.render();
  }

  private close(): void {
    Sound.play('bookClose');
    Game.flags.add('anleitung-gesehen');
    this.scene.stop();
    if (this.from === 'Pause') {
      this.scene.resume('Pause');
      return;
    }
    this.scene.resume('Hud');
    this.scene.resume('World');
    SaveSystem.autosave();
    if (Game.quests.stage('q-start') === 0) {
      this.game.events.emit(HUD_EVENTS.toast, 'Sprich mit Lumi – der blaue Pfeil zeigt dir den Weg.');
    }
  }

  override update(): void {
    // die Taste, die die Anleitung geöffnet hat, nicht gleich mitzählen
    if (this.justOpened) {
      this.justOpened = false;
      return;
    }
    if (Input.nav('right') || Input.confirm()) this.go(1);
    else if (Input.nav('left')) this.go(-1);
    else if (Input.cancel()) this.close();
  }
}
