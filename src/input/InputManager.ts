import { ACTIONS, RESERVED_KEYS, type Action } from './Actions';
import { Settings } from '../systems/Settings';

export type InputSource = 'keyboard' | 'mouse' | 'touch' | 'gamepad';
export type InputContext = 'gameplay' | 'menu';
export type NavDir = 'up' | 'down' | 'left' | 'right';

const N = ACTIONS.length;
const IDX = new Map<Action, number>(ACTIONS.map((a, i) => [a, i]));
const NAV_DIRS: NavDir[] = ['up', 'down', 'left', 'right'];
const NAV_DELAY = 340;
const NAV_REPEAT = 105;
const STICK_DEADZONE = 0.22;

/**
 * Zentrale Eingabeverwaltung. Tastatur, Maus, Touch (DOM-Overlay) und Gamepad schreiben
 * in denselben Aktionszustand. Das Spiel fragt nur Aktionen ab – nie Geräte.
 * Keine Allokationen pro Frame (feste Arrays).
 */
export class InputManager {
  source: InputSource = 'keyboard';
  context: InputContext = 'menu';

  /** analoge Bewegungsrichtung, Länge ≤ 1 */
  moveX = 0;
  moveY = 0;

  /** Zeiger in logischen Spielkoordinaten (0–480 / 0–270) */
  pointerX = 240;
  pointerY = 135;
  /** Zeitpunkt der letzten Mausbewegung (für Zielen mit der Maus) */
  pointerMovedAt = -1e9;

  private readonly kb = new Uint8Array(N);
  private readonly touch = new Uint8Array(N);
  private readonly pad = new Uint8Array(N);
  private readonly mouse = new Uint8Array(N);
  private readonly latch = new Uint8Array(N);
  private readonly cur = new Uint8Array(N);
  private readonly prev = new Uint8Array(N);
  private readonly jp = new Uint8Array(N);
  private readonly jr = new Uint8Array(N);

  private readonly keysDown = new Set<string>();
  private readonly rawLatch = new Set<string>();
  private readonly rawPressed = new Set<string>();
  private codeToActions = new Map<string, number[]>();

  private touchStickX = 0;
  private touchStickY = 0;
  private padStickX = 0;
  private padStickY = 0;
  private padPrevButtons: boolean[] = [];

  private readonly navHeld = [false, false, false, false];
  private readonly navNext = [0, 0, 0, 0];
  private readonly navFire = [false, false, false, false];

  private now = 0;
  private sourceListeners = new Set<(s: InputSource) => void>();
  private captureCb: ((code: string | null) => void) | null = null;

  constructor() {
    this.rebuildBindings();
    Settings.onChange((_s, changed) => {
      if (changed.includes('bindings')) this.rebuildBindings();
    });
  }

  /** Registriert die DOM-Listener (einmal beim Start). */
  attach(): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e), { passive: false });
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') this.setSource('touch');
      else if (e.pointerType === 'mouse' && (e.type === 'pointerdown' || Math.abs(e.movementX) + Math.abs(e.movementY) > 0)) {
        this.setSource('mouse');
      }
    };
    window.addEventListener('pointerdown', onPointer, { capture: true });
    window.addEventListener('pointermove', onPointer, { capture: true });
    window.addEventListener('touchstart', () => this.setSource('touch'), { capture: true, passive: true });
    window.addEventListener('gamepadconnected', () => undefined);
    // Startwert: Touch-Gerät?
    if (window.matchMedia?.('(pointer: coarse)').matches) this.source = 'touch';
    window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', (ev) => {
      this.setSource(ev.matches ? 'touch' : 'mouse');
    });
  }

  onSourceChange(cb: (s: InputSource) => void): () => void {
    this.sourceListeners.add(cb);
    return () => this.sourceListeners.delete(cb);
  }

  setSource(s: InputSource): void {
    if (this.source === s) return;
    this.source = s;
    for (const cb of this.sourceListeners) cb(s);
  }

  setContext(c: InputContext): void {
    if (this.context === c) return;
    this.context = c;
    for (const cb of this.sourceListeners) cb(this.source);
  }

  private rebuildBindings(): void {
    const map = new Map<string, number[]>();
    const b = Settings.get().bindings;
    ACTIONS.forEach((a, i) => {
      for (const code of b[a]) {
        const list = map.get(code) ?? [];
        list.push(i);
        map.set(code, list);
      }
    });
    this.codeToActions = map;
    this.recomputeKeyboard();
  }

  private recomputeKeyboard(): void {
    this.kb.fill(0);
    for (const code of this.keysDown) {
      const acts = this.codeToActions.get(code);
      if (acts) for (const i of acts) this.kb[i] = 1;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.captureCb) {
      e.preventDefault();
      const cb = this.captureCb;
      this.captureCb = null;
      if (e.code === 'Escape') cb(null);
      else if (!RESERVED_KEYS.has(e.code)) cb(e.code);
      else cb(null);
      return;
    }
    const acts = this.codeToActions.get(e.code);
    const nav = e.code === 'Enter' || e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Tab';
    if ((acts || nav) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    this.setSource('keyboard');
    if (e.repeat) return;
    this.keysDown.add(e.code);
    this.rawLatch.add(e.code);
    if (acts) {
      for (const i of acts) {
        this.kb[i] = 1;
        this.latch[i] = 1;
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
    this.recomputeKeyboard();
  }

  private releaseAll(): void {
    this.keysDown.clear();
    this.kb.fill(0);
    this.touch.fill(0);
    this.mouse.fill(0);
    this.touchStickX = this.touchStickY = 0;
  }

  /** Nächsten Tastendruck abfangen (Tastenbelegung ändern). Esc bricht ab → null. */
  captureNextKey(cb: (code: string | null) => void): void {
    this.captureCb = cb;
  }

  get capturing(): boolean {
    return this.captureCb !== null;
  }

  // --- Touch / Maus (werden von TouchControls und Szenen gesetzt) ---

  press(action: Action, src: 'touch' | 'mouse' = 'touch'): void {
    const i = IDX.get(action)!;
    (src === 'touch' ? this.touch : this.mouse)[i] = 1;
    this.latch[i] = 1;
  }

  release(action: Action, src: 'touch' | 'mouse' = 'touch'): void {
    const i = IDX.get(action)!;
    (src === 'touch' ? this.touch : this.mouse)[i] = 0;
  }

  setTouchStick(x: number, y: number): void {
    this.touchStickX = x;
    this.touchStickY = y;
  }

  /** Wischrichtung auf dem Aura-Knopf (für das Aura-Rad), −1…1 */
  auraDragX = 0;
  auraDragY = 0;

  setAuraDrag(x: number, y: number): void {
    this.auraDragX = x;
    this.auraDragY = y;
  }

  setPointer(x: number, y: number, now: number): void {
    if (x !== this.pointerX || y !== this.pointerY) this.pointerMovedAt = now;
    this.pointerX = x;
    this.pointerY = y;
  }

  /** Maus wurde in den letzten 2 s bewegt und ist aktive Eingabe → Zielen mit der Maus */
  get mouseAiming(): boolean {
    return (this.source === 'mouse' || this.source === 'keyboard') && this.now - this.pointerMovedAt < 2500;
  }

  // --- Abfragen ---

  isDown(a: Action): boolean {
    return this.cur[IDX.get(a)!] === 1;
  }

  justPressed(a: Action): boolean {
    return this.jp[IDX.get(a)!] === 1;
  }

  justReleased(a: Action): boolean {
    return this.jr[IDX.get(a)!] === 1;
  }

  /** Rohe Taste in diesem Frame gedrückt (z. B. Enter in Menüs) */
  keyPressed(code: string): boolean {
    return this.rawPressed.has(code);
  }

  /** Menü-Navigation mit Tastenwiederholung */
  nav(dir: NavDir): boolean {
    return this.navFire[NAV_DIRS.indexOf(dir)];
  }

  confirm(): boolean {
    return this.justPressed('attack') || this.keyPressed('Enter');
  }

  cancel(): boolean {
    return this.justPressed('dodge') || this.justPressed('pause') || this.keyPressed('Backspace') || this.keyPressed('Escape');
  }

  /** Einmal pro Frame vor der Spiellogik aufrufen. */
  update(time: number): void {
    this.now = time;
    this.pollGamepad();
    for (let i = 0; i < N; i++) {
      const down = this.kb[i] | this.touch[i] | this.pad[i] | this.mouse[i] | this.latch[i];
      this.cur[i] = down ? 1 : 0;
      this.jp[i] = this.cur[i] && !this.prev[i] ? 1 : 0;
      this.jr[i] = !this.cur[i] && this.prev[i] ? 1 : 0;
      this.prev[i] = this.cur[i];
      this.latch[i] = 0;
    }
    this.rawPressed.clear();
    for (const c of this.rawLatch) this.rawPressed.add(c);
    this.rawLatch.clear();

    // Bewegung: Tastatur (digital) / Touch / Gamepad – stärkste Eingabe gewinnt
    let kx = this.cur[3] - this.cur[2];
    let ky = this.cur[1] - this.cur[0];
    if (kx !== 0 && ky !== 0) {
      kx *= Math.SQRT1_2;
      ky *= Math.SQRT1_2;
    }
    let mx = kx;
    let my = ky;
    let best = kx * kx + ky * ky;
    const t2 = this.touchStickX * this.touchStickX + this.touchStickY * this.touchStickY;
    if (t2 > best) {
      mx = this.touchStickX;
      my = this.touchStickY;
      best = t2;
    }
    const p2 = this.padStickX * this.padStickX + this.padStickY * this.padStickY;
    if (p2 > best) {
      mx = this.padStickX;
      my = this.padStickY;
    }
    this.moveX = mx;
    this.moveY = my;

    // Menü-Navigation (digital + analog)
    const held0 = this.cur[0] === 1 || this.padStickY < -0.55;
    const held1 = this.cur[1] === 1 || this.padStickY > 0.55;
    const held2 = this.cur[2] === 1 || this.padStickX < -0.55;
    const held3 = this.cur[3] === 1 || this.padStickX > 0.55;
    this.updateNav(0, held0, time);
    this.updateNav(1, held1, time);
    this.updateNav(2, held2, time);
    this.updateNav(3, held3, time);
  }

  private updateNav(i: number, held: boolean, time: number): void {
    this.navFire[i] = false;
    if (held && !this.navHeld[i]) {
      this.navFire[i] = true;
      this.navNext[i] = time + NAV_DELAY;
    } else if (held && time >= this.navNext[i]) {
      this.navFire[i] = true;
      this.navNext[i] = time + NAV_REPEAT;
    }
    this.navHeld[i] = held;
  }

  private pollGamepad(): void {
    this.pad.fill(0);
    this.padStickX = this.padStickY = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let gp: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        gp = p;
        break;
      }
    }
    if (!gp) return;
    const b = (i: number) => !!gp!.buttons[i]?.pressed;
    let ax = gp.axes[0] ?? 0;
    let ay = gp.axes[1] ?? 0;
    const mag = Math.hypot(ax, ay);
    if (mag < STICK_DEADZONE) {
      ax = ay = 0;
    } else {
      const scaled = Math.min(1, (mag - STICK_DEADZONE) / (1 - STICK_DEADZONE));
      ax = (ax / mag) * scaled;
      ay = (ay / mag) * scaled;
    }
    // Steuerkreuz
    if (b(12)) ay = -1;
    if (b(13)) ay = 1;
    if (b(14)) ax = -1;
    if (b(15)) ax = 1;
    this.padStickX = ax;
    this.padStickY = ay;
    const map: [number, number][] = [
      [0, 4], // A → Angriff
      [1, 5], // B → Ausweichen
      [2, 6], // X → Aura
      [3, 7], // Y → Buch
      [4, 8], // LB → Zauber 1
      [5, 9], // RB → Zauber 2
      [7, 10], // RT → Zauber 3
      [6, 10], // LT → Zauber 3
      [8, 11], // Select → Karte
      [9, 12], // Start → Pause
      [12, 0],
      [13, 1],
      [14, 2],
      [15, 3],
    ];
    let any = Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5;
    for (const [btn, act] of map) {
      if (b(btn)) {
        this.pad[act] = 1;
        any = true;
      }
    }
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = !!gp.buttons[i]?.pressed;
      if (pressed && !this.padPrevButtons[i]) any = true;
      this.padPrevButtons[i] = pressed;
    }
    if (any) this.setSource('gamepad');
  }
}

export const Input = new InputManager();
