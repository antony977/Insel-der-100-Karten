import type Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { addPanel, addText } from '../ui/Text';
import { Menu, type MenuItem } from '../ui/Menu';
import { Input } from '../input/InputManager';
import { PAL } from '../gfx/palette';
import { GAME_H, GAME_W } from '../config';
import { formatDate, formatPlayTime, MANUAL_SLOTS, SaveSystem, type SlotId } from '../systems/SaveSystem';
import { openDialog } from './DialogScene';

export interface SlotsData {
  mode: 'save' | 'load';
  from: string;
}

const SLOT_NAMES: Record<SlotId, string> = { auto: 'Autosave', '1': 'Platz 1', '2': 'Platz 2', '3': 'Platz 3' };

/** Speicherstände: Speichern (3 Plätze, Export) bzw. Laden (Autosave, 3 Plätze, Import). */
export class SlotsScene extends BaseScene {
  private menu!: Menu;
  private mode: 'save' | 'load' = 'load';
  private from = 'Title';
  private skip = true;
  private info!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Slots');
  }

  init(d: SlotsData): void {
    this.mode = d.mode;
    this.from = d.from;
  }

  create(): void {
    this.setupCamera();
    Input.setContext('menu');
    this.skip = true;
    this.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.7).setOrigin(0, 0);
    const w = 320;
    const h = 150;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    addPanel(this, x, y, w, h);
    addText(this, GAME_W / 2, y + 8, this.mode === 'save' ? 'Speichern' : 'Laden', { font: 'px-o', ox: 0.5, color: PAL.gold, scale: 2 });
    this.info = addText(this, GAME_W / 2, y + h - 4, '', { font: 'px-o', ox: 0.5, oy: 1, color: PAL.mist });
    this.buildMenu(x, y, w);
    this.events.on('resume', () => {
      Input.setContext('menu');
      this.skip = true;
      this.menu.refresh();
    });
  }

  private label(slot: SlotId): string {
    const i = SaveSystem.info(slot);
    if (!i) return `${SLOT_NAMES[slot]}: leer`;
    return `${SLOT_NAMES[slot]}: ${i.collected}/100 · ${formatPlayTime(i.playTime)} · ${formatDate(i.savedAt)}`;
  }

  private buildMenu(x: number, y: number, w: number): void {
    const items: MenuItem[] = [];
    if (this.mode === 'load') {
      for (const s of ['auto', ...MANUAL_SLOTS] as SlotId[]) {
        items.push({ label: () => this.label(s), onSelect: () => this.loadSlot(s), disabled: () => !SaveSystem.info(s) });
      }
      items.push({ label: 'Aus Datei importieren …', onSelect: () => this.importFile() });
    } else {
      for (const s of MANUAL_SLOTS) items.push({ label: () => this.label(s), onSelect: () => this.saveSlot(s) });
      items.push({ label: 'Als Datei exportieren', onSelect: () => this.exportFile() });
    }
    items.push({ label: 'Zurück', onSelect: () => this.close() });
    this.menu = new Menu(this, x + 16, y + 34, w - 32, items, { onCancel: () => this.close() });
  }

  private saveSlot(s: SlotId): void {
    const doSave = () => {
      const ok = SaveSystem.save(s);
      this.info.setText(ok ? `Gespeichert in ${SLOT_NAMES[s]}.` : 'Speichern fehlgeschlagen (Speicher voll?).');
      this.menu.refresh();
    };
    if (SaveSystem.info(s)) {
      openDialog(this, {
        text: `${SLOT_NAMES[s]} überschreiben?`,
        options: [{ label: 'Ja, überschreiben', action: doSave }, { label: 'Abbrechen' }],
      });
    } else doSave();
  }

  private loadSlot(s: SlotId): void {
    if (!SaveSystem.load(s)) {
      this.info.setText('Dieser Spielstand kann nicht geladen werden.');
      return;
    }
    this.startWorld();
  }

  private startWorld(): void {
    for (const k of ['Pause', 'Hud', 'World', 'Title', 'Book']) if (this.scene.isActive(k) || this.scene.isPaused(k)) this.scene.stop(k);
    this.scene.start('World', { continue: true });
  }

  private exportFile(): void {
    SaveSystem.exportFile();
    this.info.setText('Spielstand als Datei heruntergeladen.');
  }

  private async importFile(): Promise<void> {
    const ok = await SaveSystem.importFile();
    if (ok) this.startWorld();
    else this.info.setText('Die Datei ist kein gültiger Spielstand.');
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.from);
  }

  override update(_t: number, delta: number): void {
    if (this.skip) {
      this.skip = false;
      return;
    }
    this.menu.update(Input, delta / 1000);
  }
}
