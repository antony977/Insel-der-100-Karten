import { PAL, RAMPS, type Ramp } from '../gfx/palette';
import type { BuildingOpts } from '../gfx/generators/props';

const WHITE: Ramp = [PAL.mist, PAL.silver, PAL.white, PAL.white];
const CREAM: Ramp = [PAL.sandShade, PAL.sand, PAL.sandLight, PAL.white];
const PINKWALL: Ramp = [PAL.skinShade, PAL.skin, PAL.skinLight, PAL.white];
const STONEWALL: Ramp = [PAL.shadow, PAL.stone, PAL.mist, PAL.silver];
const ADOBE: Ramp = [PAL.tan, PAL.sandShade, PAL.sand, PAL.sandLight];

const house = (roof: Ramp, wall: Ramp = WHITE, extra: Partial<BuildingOpts> = {}): BuildingOpts => ({ w: 64, wallH: 28, roofH: 30, roof, wall, timber: true, chimney: true, ...extra });
const shop = (roof: Ramp, sign: BuildingOpts['sign'], wall: Ramp = CREAM, extra: Partial<BuildingOpts> = {}): BuildingOpts => ({ w: 72, wallH: 30, roofH: 30, roof, wall, timber: true, sign, ...extra });

/** Gebäude-Grafiken (Schlüssel = Textur). Grösse: Breite w, Höhe roofH + wallH + 2. */
export const BUILDINGS: Record<string, BuildingOpts> = {
  'house-green': house(RAMPS.green),
  'house-violet': house(RAMPS.violet),
  'house-orange': house(RAMPS.orange, CREAM),
  'house-teal': house(RAMPS.teal),
  'house-pink': house(RAMPS.pink, PINKWALL),
  'house-snow': house(RAMPS.grey, STONEWALL, { snow: true }),
  'house-sand': house(RAMPS.sand, ADOBE, { flat: true, timber: false, chimney: false }),
  'house-navy': house(RAMPS.navy, WHITE),
  'inn': { w: 88, wallH: 34, roofH: 34, roof: RAMPS.red, wall: CREAM, timber: true, chimney: true, sign: 'bed', windows: 3 },
  'shop-coin': shop(RAMPS.red, 'coin'),
  'shop-potion': shop(RAMPS.green, 'potion'),
  'shop-book': shop(RAMPS.violet, 'book', STONEWALL),
  'shop-boot': shop(RAMPS.orange, 'boot'),
  'shop-cup': shop(RAMPS.teal, 'cup'),
  'shop-anchor': shop(RAMPS.blue, 'anchor', WHITE),
  'shop-bread': shop(RAMPS.orange, 'bread'),
  'shop-sword': shop(RAMPS.grey, 'sword', STONEWALL, { snow: true }),
  'shop-rose': shop(RAMPS.pink, 'rose', PINKWALL),
  'shop-card': shop(RAMPS.gold, 'card'),
  'shop-scroll': shop(RAMPS.navy, 'scroll', STONEWALL),
  'shop-shell': shop(RAMPS.sky, 'shell', WHITE),
  'shop-dice': shop(RAMPS.red, 'dice', [PAL.wine, PAL.crimson, PAL.red, PAL.coral]),
  'shop-sand': shop(RAMPS.orange, 'coin', ADOBE, { flat: true, timber: false }),
  'shop-star': shop(RAMPS.violet, 'star', STONEWALL),
};

/** Höhe einer Gebäudegrafik */
export function buildingHeight(key: string): number {
  const b = BUILDINGS[key];
  return b.roofH + b.wallH + 2;
}
