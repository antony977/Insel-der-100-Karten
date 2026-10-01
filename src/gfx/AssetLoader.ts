import Phaser from 'phaser';
import { ASSETS, type AssetDef } from './AssetManifest';

const OVERRIDES_KEY = 'asset-overrides';

/**
 * Lädt optionale PNG-Ersetzungen und erzeugt alle übrigen Grafiken per Code.
 * Aufruf: `queueOverrides(scene)` in `preload()`, `generateMissing(scene)` in `create()`.
 */
export function queueOverrides(scene: Phaser.Scene): void {
  scene.load.json(OVERRIDES_KEY, 'gfx/overrides.json');
  scene.load.once(`filecomplete-json-${OVERRIDES_KEY}`, (_key: string, _type: string, data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const map = data as Record<string, string>;
    for (const def of ASSETS) {
      const file = map[def.key];
      if (!file) continue;
      const url = `gfx/${file}`;
      if (def.frame) scene.load.spritesheet(def.key, url, { frameWidth: def.frame.w, frameHeight: def.frame.h });
      else scene.load.image(def.key, url);
    }
  });
  // Fehlende overrides.json ist kein Fehler
  scene.load.on('loaderror', () => undefined);
}

export function addGenerated(scene: Phaser.Scene, def: AssetDef): void {
  if (scene.textures.exists(def.key)) return;
  const canvas = def.generate().toCanvas();
  if (def.frame) {
    scene.textures.addSpriteSheet(def.key, canvas as unknown as HTMLImageElement, {
      frameWidth: def.frame.w,
      frameHeight: def.frame.h,
    });
  } else {
    scene.textures.addCanvas(def.key, canvas);
  }
}

export function generateMissing(scene: Phaser.Scene): void {
  for (const def of ASSETS) addGenerated(scene, def);
}

/** Debug: Öffnet alle Texturen als PNG in einem neuen Fenster (Vorlage für Grafiker:innen). */
export function exportTextures(scene: Phaser.Scene): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.title = 'Grafiken – Insel der 100 Karten';
  win.document.body.style.cssText = 'background:#231c2e;color:#fbf7ef;font-family:monospace;';
  for (const def of ASSETS) {
    const tex = scene.textures.get(def.key);
    const src = tex.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    const box = win.document.createElement('div');
    box.style.margin = '12px';
    box.innerHTML = `<div>${def.key}.png – ${def.layout}</div>`;
    const img = win.document.createElement('img');
    img.src = c.toDataURL('image/png');
    img.style.cssText = `image-rendering:pixelated;width:${src.width * 3}px;background:#645a7a`;
    box.appendChild(img);
    win.document.body.appendChild(box);
  }
}
