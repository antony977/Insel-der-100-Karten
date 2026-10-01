/** Alle Spielaktionen – unabhängig vom Eingabegerät. */
export const ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'attack',
  'dodge',
  'aura',
  'book',
  'spell1',
  'spell2',
  'spell3',
  'map',
  'pause',
] as const;

export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Hoch',
  down: 'Runter',
  left: 'Links',
  right: 'Rechts',
  attack: 'Angriff / Interagieren',
  dodge: 'Ausweichen / Abbrechen',
  aura: 'Aura',
  book: 'Buch',
  spell1: 'Schnellzauber 1',
  spell2: 'Schnellzauber 2',
  spell3: 'Schnellzauber 3',
  map: 'Karte',
  pause: 'Pause',
};

export type KeyBindings = Record<Action, string[]>;

/** Standardbelegung (KeyboardEvent.code – unabhängig vom Tastaturlayout, z. B. QWERTZ). */
export const DEFAULT_BINDINGS: KeyBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Space', 'KeyE'],
  dodge: ['ShiftLeft', 'ShiftRight'],
  aura: ['KeyQ'],
  book: ['KeyB'],
  spell1: ['Digit1'],
  spell2: ['Digit2'],
  spell3: ['Digit3'],
  map: ['KeyM'],
  pause: ['Escape'],
};

const SPECIAL_LABELS: Record<string, string> = {
  Space: 'Leertaste',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift R',
  ControlLeft: 'Strg',
  ControlRight: 'Strg R',
  AltLeft: 'Alt',
  AltRight: 'AltGr',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: 'Rück',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  CapsLock: 'Feststell',
  Minus: 'ß',
  Equal: '´',
  BracketLeft: 'Ü',
  BracketRight: '+',
  Semicolon: 'Ö',
  Quote: 'Ä',
  Backslash: '#',
  Comma: ',',
  Period: '.',
  Slash: '-',
  Backquote: '^',
  IntlBackslash: '<',
};

/** Lesbarer Name einer Taste (für Einstellungen und Hinweise). Deutsche Tastatur als Annahme. */
export function keyLabel(code: string): string {
  if (SPECIAL_LABELS[code]) return SPECIAL_LABELS[code];
  if (code.startsWith('Key')) {
    const ch = code.slice(3);
    // QWERTZ: Y und Z sind vertauscht
    if (ch === 'Y') return 'Z';
    if (ch === 'Z') return 'Y';
    return ch;
  }
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (/^F\d+$/.test(code)) return code;
  return code;
}

/** Tasten, die nie neu belegt werden dürfen (Browser-/Systemfunktionen). */
export const RESERVED_KEYS = new Set(['F5', 'F11', 'F12', 'MetaLeft', 'MetaRight']);
