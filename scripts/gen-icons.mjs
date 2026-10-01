// Erzeugt die PWA-Icons (Pixel-Art: Sammelkarte mit Insel) als PNG – ohne externe Abhängigkeiten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePNG } from './png.mjs';

const C = {
  bg: [0x23, 0x1c, 0x2e],
  ink: [0x0d, 0x0a, 0x14],
  gold: [0xff, 0xc9, 0x3c],
  goldDark: [0xf0, 0x8a, 0x24],
  cream: [0xff, 0xf3, 0xa0],
  sky: [0x8e, 0xc2, 0xff],
  water: [0x3d, 0x7e, 0xf0],
  waterDark: [0x25, 0x46, 0xa8],
  sand: [0xe8, 0xc4, 0x7e],
  grass: [0x6c, 0xc2, 0x4a],
  leaf: [0x2f, 0x8a, 0x3e],
  wood: [0x6e, 0x3f, 0x26],
  sun: [0xff, 0xf3, 0xa0],
  white: [0xfb, 0xf7, 0xef],
};

/** Zeichnet das 32×32-Motiv: Karte (goldener Rahmen) mit Insel, Sonne und Meer. */
function art() {
  const N = 32;
  const px = new Array(N * N).fill(null);
  const set = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = c;
  };
  // Karte x 7..24, y 3..28
  for (let y = 3; y <= 28; y++) {
    for (let x = 7; x <= 24; x++) {
      const frame = x <= 8 || x >= 23 || y <= 4 || y >= 27;
      set(x, y, frame ? (x + y < 32 ? C.gold : C.goldDark) : C.sky);
    }
  }
  // Inneres: Himmel, Sonne, Meer, Insel
  for (let y = 5; y <= 26; y++) {
    for (let x = 9; x <= 22; x++) {
      if (y >= 18) set(x, y, y >= 23 ? C.waterDark : C.water);
    }
  }
  for (let y = 6; y <= 10; y++) for (let x = 17; x <= 21; x++) if ((x - 19) ** 2 + (y - 8) ** 2 <= 5) set(x, y, C.sun);
  for (let x = 10; x <= 21; x++) {
    const h = Math.round(4 - Math.abs(x - 15.5) * 0.7);
    for (let y = 18 - Math.max(0, h); y <= 18; y++) set(x, y, y === 18 ? C.sand : C.grass);
  }
  // Baum
  for (let y = 11; y <= 16; y++) set(14, y, C.wood);
  for (let y = 9; y <= 12; y++) for (let x = 12; x <= 16; x++) if ((x - 14) ** 2 + (y - 10.5) ** 2 <= 5) set(x, y, C.leaf);
  set(13, 9, C.grass);
  // Wellen
  for (const [x, y] of [[11, 21], [12, 21], [18, 20], [19, 20], [15, 24], [16, 24]]) set(x, y, C.white);
  // Glanz
  set(9, 5, C.cream);
  set(10, 5, C.cream);
  // Umriss
  const out = px.slice();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (px[y * N + x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < N && ny < N && px[ny * N + nx];
      });
      if (n) out[y * N + x] = C.ink;
    }
  }
  // abgerundete Ecken
  for (const [x, y] of [[6, 3], [25, 3], [6, 28], [25, 28], [7, 2], [24, 2], [7, 29], [24, 29]]) out[y * N + x] = null;
  return out;
}

function render(size, artScale, bg) {
  const motif = art();
  const N = 32;
  const rgba = new Uint8Array(size * size * 4);
  const off = Math.floor((size - N * artScale) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const ax = Math.floor((x - off) / artScale);
      const ay = Math.floor((y - off) / artScale);
      let c = ax >= 0 && ay >= 0 && ax < N && ay < N ? motif[ay * N + ax] : null;
      if (!c && bg) c = bg;
      if (c) {
        rgba[i] = c[0];
        rgba[i + 1] = c[1];
        rgba[i + 2] = c[2];
        rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

mkdirSync('public/icons', { recursive: true });
const out = [
  ['icon-192.png', 192, 6, C.bg],
  ['icon-512.png', 512, 16, C.bg],
  ['icon-maskable-512.png', 512, 10, C.bg],
  ['apple-touch-icon.png', 180, 5, C.bg],
  ['favicon-32.png', 32, 1, null],
];
for (const [name, size, scale, bg] of out) {
  writeFileSync(`public/icons/${name}`, encodePNG(size, size, render(size, scale, bg)));
}
console.log('Icons erzeugt:', out.map((o) => o[0]).join(', '));
