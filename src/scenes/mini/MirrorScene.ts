import Phaser from 'phaser';
import { MiniScene } from './MiniBase';
import { addText } from '../../ui/Text';
import { Input } from '../../input/InputManager';
import { PAL } from '../../gfx/palette';
import { GAME_W } from '../../config';
import { Sound } from '../../audio/AudioEngine';
import { MIRROR_LEVELS as LEVELS, startMirror, traceBeam } from '../../systems/mirrorPuzzle';

/** Lichträtsel im Spiegelsaal: Drehe die Spiegel, bis der Lichtstrahl den Kristall trifft. */
const CELL = 26;

export class MirrorScene extends MiniScene {
  private level = 0;
  private grid: string[][] = [];
  /** Spiegelstellung: true = „\", false = „/" */
  private mirror = new Map<string, boolean>();
  private gfx!: Phaser.GameObjects.Graphics;
  private ox = 0;
  private oy = 0;
  private cursor: [number, number] = [0, 0];
  private status!: Phaser.GameObjects.BitmapText;
  private solved = false;

  constructor() {
    super('Mirror');
  }

  create(): void {
    const { x, y, w, h } = this.setupMini('Spiegelsaal – lenke das Licht zum Kristall', 300, 210);
    this.ox = x + Math.round((w - 8 * CELL) / 2);
    this.oy = y + 28;
    this.gfx = this.add.graphics();
    this.status = addText(this, GAME_W / 2, y + h - 34, '', { font: 'px-s', ox: 0.5, color: PAL.cream });
    addText(this, GAME_W / 2, y + h - 18, 'Spiegel antippen oder wählen + Bestätigen zum Drehen', { font: 'px', ox: 0.5, color: PAL.mist });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const cx = Math.floor((p.worldX - this.ox) / CELL);
      const cy = Math.floor((p.worldY - this.oy) / CELL);
      if (this.grid[cy]?.[cx] === 'm') {
        this.cursor = [cx, cy];
        this.rotate();
      }
    });
    this.loadLevel(0);
  }

  private loadLevel(n: number): void {
    this.level = n;
    this.solved = false;
    this.grid = LEVELS[n].map((r) => r.split(''));
    this.mirror.clear();
    this.grid.forEach((row, y) =>
      row.forEach((c, x) => {
        // Startstellung absichtlich „falsch"
        if (c === 'm') this.mirror.set(`${x},${y}`, startMirror(n, x, y));
      }),
    );
    const first = [...this.mirror.keys()][0].split(',').map(Number);
    this.cursor = [first[0], first[1]];
    this.status.setText(`Rätsel ${n + 1}/3`).setTint(PAL.cream);
    this.draw();
  }

  private rotate(): void {
    if (this.solved || this.done) return;
    const k = `${this.cursor[0]},${this.cursor[1]}`;
    this.mirror.set(k, !this.mirror.get(k));
    Sound.play('place');
    this.draw();
  }

  private trace(): { pts: [number, number][]; hit: boolean } {
    return traceBeam(this.grid, (x, y) => !!this.mirror.get(`${x},${y}`));
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const cx = (x: number) => this.ox + x * CELL + CELL / 2;
    const cy = (y: number) => this.oy + y * CELL + CELL / 2;
    this.grid.forEach((row, y) =>
      row.forEach((c, x) => {
        const px = this.ox + x * CELL;
        const py = this.oy + y * CELL;
        g.fillStyle((x + y) % 2 ? PAL.sandShade : PAL.sand).fillRect(px, py, CELL, CELL);
        if (c === '#') {
          g.fillStyle(PAL.tan).fillRect(px + 4, py + 2, CELL - 8, CELL - 4);
          g.fillStyle(PAL.sandLight).fillRect(px + 4, py + 2, CELL - 8, 3);
        } else if (c === 'S') {
          g.fillStyle(PAL.gold).fillCircle(cx(x), cy(y), 8);
          g.fillStyle(PAL.white).fillCircle(cx(x) - 2, cy(y) - 2, 3);
        } else if (c === 'Z') {
          g.fillStyle(PAL.cyan).fillTriangle(cx(x), cy(y) - 10, cx(x) - 7, cy(y) + 6, cx(x) + 7, cy(y) + 6);
          g.fillStyle(PAL.white).fillTriangle(cx(x), cy(y) - 7, cx(x) - 3, cy(y) + 2, cx(x) + 1, cy(y) + 2);
        } else if (c === 'm') {
          const back = this.mirror.get(`${x},${y}`);
          g.lineStyle(4, PAL.silver);
          if (back) g.lineBetween(px + 4, py + 4, px + CELL - 4, py + CELL - 4);
          else g.lineBetween(px + CELL - 4, py + 4, px + 4, py + CELL - 4);
          g.lineStyle(1, PAL.white);
          if (back) g.lineBetween(px + 5, py + 4, px + CELL - 4, py + CELL - 5);
          else g.lineBetween(px + CELL - 5, py + 4, px + 4, py + CELL - 5);
        }
      }),
    );
    // Lichtstrahl
    const { pts, hit } = this.trace();
    g.lineStyle(3, PAL.gold, 0.9);
    for (let i = 1; i < pts.length; i++) g.lineBetween(cx(pts[i - 1][0]), cy(pts[i - 1][1]), cx(pts[i][0]), cy(pts[i][1]));
    g.lineStyle(1, PAL.white, 0.9);
    for (let i = 1; i < pts.length; i++) g.lineBetween(cx(pts[i - 1][0]), cy(pts[i - 1][1]), cx(pts[i][0]), cy(pts[i][1]));
    // Auswahlrahmen
    if (Input.source !== 'touch') {
      g.lineStyle(1, PAL.pink).strokeRect(this.ox + this.cursor[0] * CELL + 0.5, this.oy + this.cursor[1] * CELL + 0.5, CELL - 1, CELL - 1);
    }
    if (hit && !this.solved) {
      this.solved = true;
      Sound.play('cardRare');
      this.status.setText('Der Kristall erstrahlt!').setTint(PAL.gold);
      this.time.delayedCall(1100, () => {
        if (this.level + 1 < LEVELS.length) this.loadLevel(this.level + 1);
        else this.finish(true, 3);
      });
    }
  }

  /** nächster Spiegel in Pfeilrichtung */
  private moveCursor(dx: number, dy: number): void {
    const list = [...this.mirror.keys()].map((k) => k.split(',').map(Number) as [number, number]);
    let best: [number, number] | null = null;
    let bd = 1e9;
    for (const [x, y] of list) {
      const vx = x - this.cursor[0];
      const vy = y - this.cursor[1];
      if (vx * dx + vy * dy <= 0) continue;
      const d = Math.abs(vx) + Math.abs(vy) + Math.abs(dx ? vy : vx) * 2;
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
    if (best) {
      this.cursor = best;
      Sound.play('move');
      this.draw();
    }
  }

  override update(): void {
    if (this.done) return;
    if (this.escPressed()) {
      this.finish(false, this.level, true);
      return;
    }
    if (Input.nav('left')) this.moveCursor(-1, 0);
    if (Input.nav('right')) this.moveCursor(1, 0);
    if (Input.nav('up')) this.moveCursor(0, -1);
    if (Input.nav('down')) this.moveCursor(0, 1);
    if (Input.confirm() && this.time.now - this.openedAt > 200) this.rotate();
  }
}
