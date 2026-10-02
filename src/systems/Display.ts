import type Phaser from 'phaser';
import { GAME_H, GAME_W, MAX_RENDER_SCALE } from '../config';
import { Settings, type RenderQuality, type ScaleMode } from './Settings';
import { renderTextRaster } from '../gfx/font/PixelFont';
import { phoneIcon } from '../gfx/generators/ui';
import { PAL } from '../gfx/palette';

/**
 * Anzeige-System: pixelgenaues Integer-Scaling in Gerätepixeln.
 *
 * Logische Auflösung ist immer 480×270. Gerendert wird mit einem ganzzahligen Faktor r
 * (Kamera-Zoom), das Canvas wird dann per CSS um einen weiteren ganzzahligen Faktor
 * vergrössert. r × CSS-Faktor = k (Gerätepixel pro Spielpixel). So bleiben alle Pixel exakt
 * quadratisch, Bewegungen können aber in feineren Schritten (1/r Spielpixel) laufen.
 */
export interface LayoutInput {
  /** verfügbare Fläche in CSS-Pixeln (nach Abzug der Safe-Area) */
  width: number;
  height: number;
  dpr: number;
  mode: ScaleMode;
  quality: RenderQuality;
}

export interface LayoutResult {
  /** Gerätepixel pro Spielpixel */
  k: number;
  /** Render-Faktor (Canvas = 480r × 270r) */
  r: number;
  cssWidth: number;
  cssHeight: number;
}

export function computeLayout(i: LayoutInput): LayoutResult {
  const devW = i.width * i.dpr;
  const devH = i.height * i.dpr;
  const fit = Math.min(devW / GAME_W, devH / GAME_H);
  let k: number;
  if (i.mode === 'integer' && fit >= 1) k = Math.floor(fit);
  else k = Math.max(0.25, fit);
  let r = 1;
  if (i.quality !== 'retro') {
    const kInt = Math.max(1, Math.floor(k));
    if (i.mode === 'integer' && Number.isInteger(k)) {
      // grösster Teiler von k, der das Limit nicht überschreitet → CSS-Faktor bleibt ganzzahlig
      for (let d = Math.min(kInt, MAX_RENDER_SCALE); d >= 1; d--) {
        if (kInt % d === 0) {
          r = d;
          break;
        }
      }
    } else {
      r = Math.min(kInt, MAX_RENDER_SCALE - 1);
    }
  }
  return { k, r, cssWidth: (GAME_W * k) / i.dpr, cssHeight: (GAME_H * k) / i.dpr };
}

type ScaleListener = (r: number) => void;

/** Drehung des Spielbilds in Grad (im Uhrzeigersinn), wenn die Seite selbst nicht mitdreht */
export type ViewRotation = 0 | 90 | -90;

class DisplayManager {
  renderScale = 1;
  /**
   * Manche Apps (z. B. eingebettete Ansichten) drehen sich nicht mit dem Gerät. Hält man das
   * Gerät trotzdem quer, bleibt die Seite hochkant – dann dreht das Spiel sein Bild selbst.
   */
  rotation: ViewRotation = 0;
  private game: Phaser.Game | null = null;
  private listeners = new Set<ScaleListener>();
  private layoutListeners = new Set<() => void>();
  private probe: HTMLDivElement | null = null;
  private rotateEl: HTMLElement | null = null;
  private pausedByRotate = false;
  private scheduled = false;
  /** sichtbare Fläche in CSS-Pixeln (Bildschirm, ungedreht) */
  private vw = 0;
  private vh = 0;
  /** Lage laut Bewegungssensor (null = keine Sensordaten) */
  private sensed: 'portrait' | ViewRotation | null = null;
  private sensorAsked = false;

  init(game: Phaser.Game): void {
    this.game = game;
    this.probe = document.createElement('div');
    this.probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(this.probe);
    this.rotateEl = document.getElementById('rotate-hint');
    this.buildRotateHint();
    const schedule = () => this.schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    screen.orientation?.addEventListener?.('change', schedule);
    Settings.onChange((_s, changed) => {
      if (changed.includes('scaleMode') || changed.includes('renderQuality')) this.schedule();
    });
    this.watchSensor();
    this.patchPointer(game);
    this.apply();
  }

  /** Nach jeder Neuberechnung der Anzeige (z. B. für die Touch-Steuerung) */
  onLayout(l: () => void): () => void {
    this.layoutListeners.add(l);
    return () => this.layoutListeners.delete(l);
  }

  onScale(l: ScaleListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Snap auf das Render-Raster (1/r Spielpixel) – verhindert unscharfe Zwischenpositionen. */
  snap(v: number): number {
    const r = this.renderScale;
    return Math.round(v * r) / r;
  }

  isTouchDevice(): boolean {
    return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.apply();
      // iOS liefert die finale Grösse manchmal erst etwas später
      setTimeout(() => this.apply(), 250);
    });
  }

  // ------------------------------------------------------------ Koordinaten (gedreht/ungedreht)

  /** Grösse der Spielfläche in ihren eigenen (ggf. gedrehten) Koordinaten */
  viewSize(): { w: number; h: number } {
    const w = this.vw || window.innerWidth;
    const h = this.vh || window.innerHeight;
    return this.rotation === 0 ? { w, h } : { w: h, h: w };
  }

  /** Bildschirmpunkt (clientX/Y) in Koordinaten der (ggf. gedrehten) Spielfläche */
  toLocal(x: number, y: number): { x: number; y: number } {
    if (this.rotation === 90) return { x: y, y: (this.vw || window.innerWidth) - x };
    if (this.rotation === -90) return { x: (this.vh || window.innerHeight) - y, y: x };
    return { x, y };
  }

  /** Bewegung auf dem Bildschirm in Richtung der Spielfläche */
  toLocalDelta(dx: number, dy: number): { x: number; y: number } {
    if (this.rotation === 90) return { x: dy, y: -dx };
    if (this.rotation === -90) return { x: -dy, y: dx };
    return { x: dx, y: dy };
  }

  /** Lage des Canvas in Koordinaten der Spielfläche */
  canvasRect(): { left: number; top: number; width: number; height: number } {
    const c = this.game?.canvas;
    if (!c) return { left: 0, top: 0, width: 1, height: 1 };
    if (this.rotation === 0) {
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    // offset* ignoriert CSS-Drehungen und misst relativ zu #app (= Spielfläche)
    return { left: c.offsetLeft, top: c.offsetTop, width: c.offsetWidth, height: c.offsetHeight };
  }

  /** Abstand zu Notch/Rundungen in Koordinaten der Spielfläche */
  safeInsets(): { top: number; right: number; bottom: number; left: number } {
    if (!this.probe) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(this.probe);
    const i = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    if (this.rotation === 90) return { top: i.right, right: i.bottom, bottom: i.left, left: i.top };
    if (this.rotation === -90) return { top: i.left, right: i.top, bottom: i.right, left: i.bottom };
    return i;
  }

  /** Phaser rechnet Zeiger ohne CSS-Drehung um – bei gedrehtem Bild selbst umrechnen */
  private patchPointer(game: Phaser.Game): void {
    type PointerLike = { position: { x: number; y: number }; prevPosition: { x: number; y: number } };
    const im = game.input as unknown as { transformPointer: (p: PointerLike, x: number, y: number, move: boolean) => void };
    const original = im.transformPointer.bind(im);
    im.transformPointer = (pointer, pageX, pageY, wasMove) => {
      if (this.rotation === 0) {
        original(pointer, pageX, pageY, wasMove);
        return;
      }
      const l = this.toLocal(pageX, pageY);
      const r = this.canvasRect();
      const base = game.scale.baseSize;
      pointer.prevPosition.x = pointer.position.x;
      pointer.prevPosition.y = pointer.position.y;
      pointer.position.x = ((l.x - r.left) * base.width) / Math.max(1, r.width);
      pointer.position.y = ((l.y - r.top) * base.height) / Math.max(1, r.height);
    };
  }

  // ------------------------------------------------------------ Lage des Geräts

  /** Bewegungssensor: erkennt, ob das Gerät quer gehalten wird, auch wenn die Seite hochkant bleibt */
  private watchSensor(): void {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    window.addEventListener('devicemotion', (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null) return;
      // iOS meldet die Achsen mit umgekehrtem Vorzeichen
      const gx = ios ? -(g.x ?? 0) : g.x ?? 0;
      const gy = ios ? -(g.y ?? 0) : g.y ?? 0;
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      if (Math.max(ax, ay) < 4) return; // flach auf dem Tisch: Lage beibehalten
      let next = this.sensed;
      // Hysterese, damit es beim Kippen nicht flackert
      if (ax > ay * 1.4) next = gx > 0 ? 90 : -90;
      else if (ay > ax * 1.4) next = 'portrait';
      if (next !== this.sensed) {
        this.sensed = next;
        this.schedule();
      }
    });
    // iOS gibt Sensordaten erst nach einer Erlaubnis frei (nur nach einer Berührung möglich)
    const ask = () => {
      if (this.sensorAsked || this.sensed !== null || !this.pageStaysPortrait()) return;
      const req = (window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission;
      if (!req) return;
      this.sensorAsked = true;
      req().catch(() => undefined);
    };
    window.addEventListener('pointerup', ask, true);
  }

  /** Seite hochkant, obwohl die Oberfläche nicht im Querformat ist (also kein Split-Screen o. Ä.) */
  private pageStaysPortrait(): boolean {
    if (!this.isTouchDevice()) return false;
    const vw = this.vw || window.innerWidth;
    const vh = this.vh || window.innerHeight;
    if (vh <= vw * 1.05) return false;
    return !this.interfaceLandscape();
  }

  /** Dreht sich die Oberfläche (Browser/App) gerade im Querformat? */
  private interfaceLandscape(): boolean {
    const t = screen.orientation?.type;
    if (t) return t.startsWith('landscape');
    const o = (window as unknown as { orientation?: number }).orientation;
    return o === 90 || o === -90;
  }

  /**
   * Bleibt die Seite hochkant, obwohl man das Gerät quer hält? Dann wird das Spielbild gedreht.
   * Ohne Sensor wird angenommen, dass man quer hält – ein gedrehtes Bild zeigt sonst von selbst,
   * dass man drehen soll.
   */
  private decideRotation(): ViewRotation {
    if (!this.pageStaysPortrait()) return 0;
    if (this.sensed === 'portrait') return 0;
    if (this.sensed === 90 || this.sensed === -90) return this.sensed;
    return 90;
  }

  apply(): void {
    const game = this.game;
    if (!game) return;
    const vv = window.visualViewport;
    this.vw = vv ? vv.width : window.innerWidth;
    this.vh = vv ? vv.height : window.innerHeight;
    const rot = this.decideRotation();
    if (rot !== this.rotation) this.rotation = rot;
    this.applyRotationCss();
    const { w, h } = this.viewSize();
    const ins = this.safeInsets();
    const s = Settings.get();
    const layout = computeLayout({
      width: Math.max(1, w - ins.left - ins.right),
      height: Math.max(1, h - ins.top - ins.bottom),
      dpr: window.devicePixelRatio || 1,
      mode: s.scaleMode,
      quality: s.renderQuality,
    });
    const canvas = game.canvas;
    const r = layout.r;
    if (game.scale.width !== GAME_W * r || game.scale.height !== GAME_H * r) {
      game.scale.resize(GAME_W * r, GAME_H * r);
    }
    canvas.style.width = `${layout.cssWidth}px`;
    canvas.style.height = `${layout.cssHeight}px`;
    game.scale.updateBounds();
    // Phaser aktualisiert displayScale nur in refresh() – nach eigener CSS-Grösse selbst setzen,
    // sonst stimmen Zeiger-Koordinaten nicht, wenn Canvas-Pixel ≠ CSS-Pixel (z. B. iPhone, dpr 3).
    const b = game.scale.canvasBounds;
    if (b.width > 0 && b.height > 0 && this.rotation === 0) {
      game.scale.displayScale.set(game.scale.baseSize.width / b.width, game.scale.baseSize.height / b.height);
    }
    if (r !== this.renderScale) {
      this.renderScale = r;
      for (const l of this.listeners) l(r);
    }
    this.updateRotateHint();
    for (const l of this.layoutListeners) l();
  }

  /** Spielfläche und Touch-Ebene per CSS drehen (oder Drehung aufheben) */
  private applyRotationCss(): void {
    const els = [document.getElementById('app'), document.getElementById('touch-ui')];
    const ins = this.safeInsets();
    for (const el of els) {
      if (!el) continue;
      if (this.rotation === 0) {
        el.style.removeProperty('width');
        el.style.removeProperty('height');
        el.style.removeProperty('right');
        el.style.removeProperty('bottom');
        el.style.removeProperty('transform');
        el.style.removeProperty('transform-origin');
        if (el.id === 'app') el.style.removeProperty('padding');
        continue;
      }
      el.style.width = `${this.vh}px`;
      el.style.height = `${this.vw}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.transformOrigin = '0 0';
      el.style.transform = this.rotation === 90 ? 'rotate(90deg) translateY(-100%)' : 'rotate(-90deg) translateX(-100%)';
      if (el.id === 'app') el.style.padding = `${ins.top}px ${ins.right}px ${ins.bottom}px ${ins.left}px`;
    }
    document.body.classList.toggle('view-rotated', this.rotation !== 0);
  }

  private buildRotateHint(): void {
    const el = this.rotateEl;
    if (!el) return;
    el.innerHTML = '';
    const phone = document.createElement('img');
    phone.className = 'phone';
    phone.src = phoneIcon().toDataURL(4);
    phone.width = 80;
    phone.height = 128;
    phone.alt = '';
    const text = document.createElement('img');
    const t = renderTextRaster('Bitte Gerät drehen', PAL.white, 'outline');
    text.src = t.toDataURL(3);
    text.width = t.w * 3;
    text.height = t.h * 3;
    text.alt = 'Bitte Gerät drehen';
    el.append(phone, text);
  }

  /**
   * Hinweis nur, wenn das Gerät sicher hochkant gehalten wird: Die Seite ist hochkant und der
   * Bewegungssensor meldet „hochkant“. Hält man das Gerät quer, kommt kein Hinweis.
   */
  private updateRotateHint(): void {
    const el = this.rotateEl;
    if (!el || !this.game) return;
    const show = this.pageStaysPortrait() && this.sensed === 'portrait';
    el.classList.toggle('visible', show);
    if (show && !this.pausedByRotate) {
      this.pausedByRotate = true;
      this.game.loop.sleep();
    } else if (!show && this.pausedByRotate) {
      this.pausedByRotate = false;
      this.game.loop.wake();
    }
  }
}

export const Display = new DisplayManager();

/** Setzt Zoom und Grösse einer Kamera passend zum aktuellen Render-Faktor. */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera, r = Display.renderScale, followWorld = false): void {
  cam.setSize(GAME_W * r, GAME_H * r);
  cam.setZoom(r);
  // UI-Kameras runden auf Canvas-Pixel; die Weltkamera scrollt weich (Snap erfolgt manuell)
  cam.setRoundPixels(!followWorld);
  if (!followWorld) cam.centerOn(GAME_W / 2, GAME_H / 2);
}
