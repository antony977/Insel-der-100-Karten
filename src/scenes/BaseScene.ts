import Phaser from 'phaser';
import { Display, fitCamera } from '../systems/Display';

/**
 * Basisklasse: Kameras passen sich automatisch an den Render-Faktor an.
 * UI-Szenen arbeiten in logischen Koordinaten (480×270).
 */
export abstract class BaseScene extends Phaser.Scene {
  protected setupCamera(world = false): void {
    fitCamera(this.cameras.main, Display.renderScale, world);
    const off = Display.onScale((r) => {
      fitCamera(this.cameras.main, r, world);
      this.onRenderScale(r);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.events.once(Phaser.Scenes.Events.DESTROY, off);
  }

  /** Wird aufgerufen, wenn sich der Render-Faktor ändert. */
  protected onRenderScale(_r: number): void {
    /* optional */
  }
}
