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

class DisplayManager {
  renderScale = 1;
  private game: Phaser.Game | null = null;
  private listeners = new Set<ScaleListener>();
  private probe: HTMLDivElement | null = null;
  private rotateEl: HTMLElement | null = null;
  private pausedByRotate = false;
  private scheduled = false;

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
    Settings.onChange((_s, changed) => {
      if (changed.includes('scaleMode') || changed.includes('renderQuality')) this.schedule();
    });
    this.apply();
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

  safeInsets(): { top: number; right: number; bottom: number; left: number } {
    if (!this.probe) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(this.probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  apply(): void {
    const game = this.game;
    if (!game) return;
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    const ins = this.safeInsets();
    const s = Settings.get();
    const layout = computeLayout({
      width: Math.max(1, vw - ins.left - ins.right),
      height: Math.max(1, vh - ins.top - ins.bottom),
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
    if (b.width > 0 && b.height > 0) {
      game.scale.displayScale.set(game.scale.baseSize.width / b.width, game.scale.baseSize.height / b.height);
    }
    if (r !== this.renderScale) {
      this.renderScale = r;
      for (const l of this.listeners) l(r);
    }
    this.updateRotateHint(vw, vh);
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

  private updateRotateHint(vw: number, vh: number): void {
    const el = this.rotateEl;
    if (!el || !this.game) return;
    const portrait = vh > vw * 1.05;
    const show = portrait && this.isTouchDevice();
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
