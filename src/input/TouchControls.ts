import type { Action } from './Actions';
import { Input } from './InputManager';
import { Settings } from '../systems/Settings';
import { Display } from '../systems/Display';
import { joystickBase, joystickKnob, touchButtons } from '../gfx/generators/ui';

interface ButtonDef {
  id: string;
  action: Action;
  /** Grösse in CSS-px bei Skalierung 1 (nie unter 56 px) */
  size: number;
  /** Polarkoordinaten um den A-Knopf: Ring (0 = Mitte, 1 = innen, 2 = aussen) und Winkel in Grad */
  ring: number;
  angle: number;
  /** obere Leiste (Position von rechts) */
  top?: number;
  label: string;
}

const BUTTONS: ButtonDef[] = [
  { id: 'a', action: 'attack', size: 78, ring: 0, angle: 0, label: 'A – Angriff / Interagieren' },
  { id: 'b', action: 'dodge', size: 62, ring: 1, angle: 192, label: 'B – Ausweichen' },
  { id: 'aura', action: 'aura', size: 58, ring: 1, angle: 141, label: 'Aura' },
  { id: 'spell1', action: 'spell1', size: 56, ring: 1, angle: 92, label: 'Zauber 1' },
  { id: 'spell2', action: 'spell2', size: 56, ring: 2, angle: 124, label: 'Zauber 2' },
  { id: 'spell3', action: 'spell3', size: 56, ring: 2, angle: 157, label: 'Zauber 3' },
  { id: 'book', action: 'book', size: 58, ring: -1, angle: 0, top: 0, label: 'Buch' },
  { id: 'map', action: 'map', size: 48, ring: -1, angle: 0, top: 1, label: 'Karte' },
  { id: 'pause', action: 'pause', size: 48, ring: -1, angle: 0, top: 2, label: 'Pause' },
];

/**
 * Touch-Steuerung als DOM-Overlay: dynamischer Analog-Joystick links (erscheint unter dem
 * Daumen), Aktionsknöpfe rechts. Multitouch über Pointer-Events mit Pointer-Capture.
 * Das Overlay darf in die Letterbox-Ränder ragen und respektiert die Safe-Area.
 */
export class TouchControls {
  private root: HTMLElement;
  private zone!: HTMLDivElement;
  private base!: HTMLDivElement;
  private knob!: HTMLDivElement;
  private buttons = new Map<string, HTMLDivElement>();
  private joyId: number | null = null;
  private joyOX = 0;
  private joyOY = 0;
  private visible = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.build();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    Settings.onChange((_s, changed) => {
      if (changed.some((c) => c === 'touchSize' || c === 'touchOpacity' || c === 'leftHanded')) this.layout();
    });
    const refresh = () => this.setVisible(Input.source === 'touch' && Input.context === 'gameplay');
    Input.onSourceChange(refresh);
    refresh();
  }

  private build(): void {
    const imgs = touchButtons();
    this.zone = document.createElement('div');
    this.zone.className = 'zone';
    this.root.appendChild(this.zone);

    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.base.style.backgroundImage = `url(${joystickBase().toDataURL()})`;
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.knob.style.backgroundImage = `url(${joystickKnob().toDataURL()})`;
    this.root.append(this.base, this.knob);

    this.zone.addEventListener('pointerdown', (e) => this.joyDown(e));
    this.zone.addEventListener('pointermove', (e) => this.joyMove(e));
    const end = (e: PointerEvent) => this.joyUp(e);
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', end);
    this.zone.addEventListener('lostpointercapture', end);

    for (const def of BUTTONS) {
      const el = document.createElement('div');
      el.className = 'btn';
      el.setAttribute('aria-label', def.label);
      el.style.backgroundImage = `url(${imgs[def.id].toDataURL()})`;
      const pointers = new Set<number>();
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* synthetische Events */
        }
        pointers.add(e.pointerId);
        if (pointers.size === 1) {
          Input.press(def.action, 'touch');
          el.classList.add('pressed');
          if (Settings.get().vibration) navigator.vibrate?.(12);
        }
      });
      const up = (e: PointerEvent) => {
        if (!pointers.delete(e.pointerId)) return;
        if (pointers.size === 0) {
          Input.release(def.action, 'touch');
          el.classList.remove('pressed');
        }
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(el);
      this.buttons.set(def.id, el);
    }
  }

  private scale(): number {
    // Auf kleinen Bildschirmen etwas kleiner, aber nie unter 56 px (WCAG-Zielgrösse)
    const h = window.innerHeight;
    const auto = Math.min(1, Math.max(0.8, h / 400));
    return auto * Settings.get().touchSize;
  }

  layout(): void {
    const s = this.scale();
    const st = Settings.get();
    const left = st.leftHanded;
    this.root.style.opacity = String(st.touchOpacity);
    const ins = Display.safeInsets();
    const sr = ins.right;
    const sl = ins.left;
    const sb = ins.bottom;
    const stp = ins.top;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // A-Knopf: Mittelpunkt unten rechts (bzw. links im Linkshänder-Modus)
    const aSize = Math.max(64, 78 * s);
    const ax = left ? sl + 20 + aSize / 2 : W - sr - 20 - aSize / 2;
    const ay = H - sb - 22 - aSize / 2;
    const dir = left ? -1 : 1;
    // Ringradien wachsen mit der Knopfgrösse, damit sich nichts überlappt
    const btn = Math.max(56, 58 * s);
    const radii = [0, aSize / 2 + btn / 2 + 14, aSize / 2 + btn * 1.5 + 28];
    let topX = left ? sl + 12 : W - sr - 12;
    for (const def of BUTTONS) {
      const el = this.buttons.get(def.id)!;
      const size = Math.max(def.top !== undefined ? 48 : 56, def.size * s);
      const tall = def.id.startsWith('spell') ? 26 / 22 : 1;
      let cx: number;
      let cy: number;
      if (def.top !== undefined) {
        cx = topX - dir * (size / 2);
        topX -= dir * (size + 8);
        cy = stp + 10 + size / 2;
      } else {
        const rad = (def.angle * Math.PI) / 180;
        cx = ax + Math.cos(rad) * radii[def.ring] * dir;
        cy = ay - Math.sin(rad) * radii[def.ring];
      }
      el.style.width = `${size}px`;
      el.style.height = `${size * tall}px`;
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
    }
    // Joystick-Zone: andere Bildschirmhälfte, unterhalb der oberen Leiste
    const zoneW = W * 0.48;
    this.zone.style.left = left ? `${W - zoneW}px` : '0px';
    this.zone.style.width = `${zoneW}px`;
    this.zone.style.top = `${Math.round(H * 0.16)}px`;
    this.zone.style.height = `${H - Math.round(H * 0.16)}px`;
    const baseSize = 120 * s;
    this.base.style.width = this.base.style.height = `${baseSize}px`;
    this.knob.style.width = this.knob.style.height = `${baseSize * 0.46}px`;
  }

  private radius(): number {
    return 52 * this.scale();
  }

  private joyDown(e: PointerEvent): void {
    if (this.joyId !== null) return;
    e.preventDefault();
    try {
      this.zone.setPointerCapture(e.pointerId);
    } catch {
      /* synthetische Events */
    }
    this.joyId = e.pointerId;
    const r = this.radius();
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.joyOX = Math.min(Math.max(e.clientX, r + 8), W - r - 8);
    this.joyOY = Math.min(Math.max(e.clientY, r + 8), H - r - 8);
    this.base.style.left = `${this.joyOX}px`;
    this.base.style.top = `${this.joyOY}px`;
    this.base.classList.add('active');
    this.knob.classList.add('active');
    this.updateKnob(e.clientX, e.clientY);
  }

  private joyMove(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    this.updateKnob(e.clientX, e.clientY);
  }

  private updateKnob(x: number, y: number): void {
    const r = this.radius();
    let dx = x - this.joyOX;
    let dy = y - this.joyOY;
    const d = Math.hypot(dx, dy);
    if (d > r) {
      // Schwebender Joystick: Basis folgt dem Daumen
      const over = d - r;
      this.joyOX += (dx / d) * over;
      this.joyOY += (dy / d) * over;
      this.base.style.left = `${this.joyOX}px`;
      this.base.style.top = `${this.joyOY}px`;
      dx = x - this.joyOX;
      dy = y - this.joyOY;
    }
    this.knob.style.left = `${this.joyOX + dx}px`;
    this.knob.style.top = `${this.joyOY + dy}px`;
    const len = Math.min(1, Math.hypot(dx, dy) / r);
    const dead = 0.18;
    if (len < dead) {
      Input.setTouchStick(0, 0);
      return;
    }
    const k = (len - dead) / (1 - dead) / (Math.hypot(dx, dy) || 1);
    Input.setTouchStick(dx * k, dy * k);
  }

  private joyUp(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    this.joyId = null;
    this.base.classList.remove('active');
    this.knob.classList.remove('active');
    Input.setTouchStick(0, 0);
  }

  setVisible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    this.root.classList.toggle('visible', v);
    if (!v) {
      this.joyId = null;
      this.base.classList.remove('active');
      this.knob.classList.remove('active');
      Input.setTouchStick(0, 0);
      for (const def of BUTTONS) {
        Input.release(def.action, 'touch');
        this.buttons.get(def.id)!.classList.remove('pressed');
      }
    }
  }
}
