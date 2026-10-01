import type { RegionId } from '../data/world/layout';

/**
 * Wetter der Insel: deterministisch aus Tag und Uhrzeit (gleiches Spiel → gleiches Wetter),
 * je Region anders dargestellt. Jede dritte Nacht zieht ein Sturm auf (wichtig für das
 * Leuchtfeuer von Möwenhafen). Die Wetterfahne kann das Wetter für eine Weile umstellen.
 */
export type BaseWeather = 'klar' | 'regen' | 'sturm';
export type Weather = 'klar' | 'regen' | 'sturm' | 'schnee' | 'nebel' | 'sand';

export const WEATHER_NAMES: Record<Weather, string> = {
  klar: 'Klar',
  regen: 'Regen',
  sturm: 'Sturm',
  schnee: 'Schnee',
  nebel: 'Nebel',
  sand: 'Sandsturm',
};

function hash(n: number): number {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

/** Ist gerade eine der regelmässigen Sturmnächte? */
export function isStormNight(day: number, clock: number): boolean {
  return (day % 3 === 2 && clock >= 20 * 60) || (day % 3 === 0 && clock < 4 * 60);
}

export function baseWeather(day: number, clock: number, override?: { kind: BaseWeather; until: number }): BaseWeather {
  const total = day * 1440 + clock;
  if (override && total < override.until) return override.kind;
  if (isStormNight(day, clock)) return 'sturm';
  if (day <= 1) return 'klar';
  const block = Math.floor(clock / 240);
  const v = hash(day * 7 + block) % 100;
  if (v < 64) return 'klar';
  if (v < 90) return 'regen';
  return 'sturm';
}

/** Wie sich das Wetter in einer Region zeigt */
export function regionWeather(region: RegionId | string, base: BaseWeather, fogCleared: boolean): Weather {
  switch (region) {
    case 'hohenkamm':
      return base === 'klar' ? 'klar' : 'schnee';
    case 'sandspiegel':
      return base === 'sturm' ? 'sand' : 'klar';
    case 'nebelhain':
      if (base !== 'klar') return base;
      return fogCleared ? 'klar' : 'nebel';
    default:
      return base;
  }
}
