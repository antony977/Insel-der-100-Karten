/**
 * Die Spielpalette (42 Farben). Alle generierten Grafiken verwenden ausschliesslich diese Farben.
 * Die Farben sind in Rampen (dunkel → hell) organisiert, damit Cel-Shading mit 2–3 Stufen
 * pro Fläche automatisch funktioniert.
 */
export const PAL = {
  // Neutrale Rampe
  ink: 0x0d0a14, // Umrissfarbe
  night: 0x231c2e,
  shadow: 0x3d3450,
  stone: 0x645a7a,
  mist: 0x968daa,
  silver: 0xcdc6d9,
  white: 0xfbf7ef,
  // Rot
  wine: 0x4a1424,
  crimson: 0x8f1f2f,
  red: 0xd63c3c,
  coral: 0xff7a6b,
  // Orange / Gold
  rust: 0xb4501e,
  orange: 0xf08a24,
  gold: 0xffc93c,
  cream: 0xfff3a0,
  // Holz / Haut
  bark: 0x3a2219,
  wood: 0x6e3f26,
  tan: 0xa8693d,
  skinShade: 0xc47a52,
  skin: 0xe8a878,
  skinLight: 0xffd6a8,
  // Grün
  forest: 0x14301f,
  pine: 0x1f5a32,
  leaf: 0x2f8a3e,
  grass: 0x6cc24a,
  lime: 0xc2ec6a,
  // Türkis / Cyan
  deepTeal: 0x0f3a44,
  teal: 0x1a7a7a,
  cyan: 0x2fc4d6,
  ice: 0xa6f4f0,
  // Blau
  navy: 0x141e4a,
  blue: 0x2546a8,
  sky: 0x3d7ef0,
  skyLight: 0x8ec2ff,
  // Violett / Pink
  plum: 0x2c1450,
  purple: 0x5a2a9c,
  violet: 0x9b4ae8,
  berry: 0x8a2468,
  magenta: 0xe04ac8,
  pink: 0xff9ee6,
  // Sand
  sandShade: 0xc99a5b,
  sand: 0xe8c47e,
  sandLight: 0xf8e2a8,
} as const;

export type PalName = keyof typeof PAL;

/** Rampe: [tief, Schatten, Grundton, Licht] */
export type Ramp = readonly [number, number, number, number];

export const RAMPS = {
  skin: [PAL.tan, PAL.skinShade, PAL.skin, PAL.skinLight],
  skinDark: [PAL.bark, PAL.wood, PAL.tan, PAL.skinShade],
  hairBrown: [PAL.bark, PAL.wood, PAL.tan, PAL.skinShade],
  hairAuburn: [PAL.wine, PAL.rust, PAL.orange, PAL.gold],
  hairBlond: [PAL.rust, PAL.orange, PAL.gold, PAL.cream],
  hairBlack: [PAL.ink, PAL.night, PAL.shadow, PAL.stone],
  hairSilver: [PAL.stone, PAL.mist, PAL.silver, PAL.white],
  hairBlue: [PAL.navy, PAL.blue, PAL.sky, PAL.skyLight],
  hairPink: [PAL.berry, PAL.magenta, PAL.pink, PAL.white],
  hairGreen: [PAL.forest, PAL.pine, PAL.leaf, PAL.grass],
  hairViolet: [PAL.plum, PAL.purple, PAL.violet, PAL.pink],
  red: [PAL.wine, PAL.crimson, PAL.red, PAL.coral],
  gold: [PAL.rust, PAL.orange, PAL.gold, PAL.cream],
  teal: [PAL.deepTeal, PAL.teal, PAL.cyan, PAL.ice],
  blue: [PAL.navy, PAL.blue, PAL.sky, PAL.skyLight],
  navy: [PAL.ink, PAL.navy, PAL.blue, PAL.sky],
  green: [PAL.forest, PAL.pine, PAL.leaf, PAL.grass],
  lime: [PAL.pine, PAL.leaf, PAL.grass, PAL.lime],
  violet: [PAL.plum, PAL.purple, PAL.violet, PAL.pink],
  pink: [PAL.berry, PAL.magenta, PAL.pink, PAL.white],
  wood: [PAL.bark, PAL.wood, PAL.tan, PAL.skinShade],
  leather: [PAL.ink, PAL.bark, PAL.wood, PAL.tan],
  grey: [PAL.night, PAL.shadow, PAL.stone, PAL.mist],
  silver: [PAL.stone, PAL.mist, PAL.silver, PAL.white],
  white: [PAL.mist, PAL.silver, PAL.white, PAL.white],
  sand: [PAL.tan, PAL.sandShade, PAL.sand, PAL.sandLight],
  dark: [PAL.ink, PAL.ink, PAL.night, PAL.shadow],
  orange: [PAL.wine, PAL.rust, PAL.orange, PAL.gold],
  paper: [PAL.sandShade, PAL.sand, PAL.sandLight, PAL.white],
  ice: [PAL.teal, PAL.cyan, PAL.ice, PAL.white],
  sky: [PAL.blue, PAL.sky, PAL.skyLight, PAL.white],
  ink: [PAL.ink, PAL.night, PAL.plum, PAL.purple],
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof RAMPS;

/** Alle Palettenfarben als Liste (für Tests und Debug-Ansicht). */
export const PALETTE_LIST: readonly number[] = Object.values(PAL);

/** 0xRRGGBB → CSS-Farbstring */
export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** 0xRRGGBB + Alpha → 32-Bit-Wert im Little-Endian-ABGR-Format für ImageData (Uint32Array). */
export function abgr(color: number, alpha = 255): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
