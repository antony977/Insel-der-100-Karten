/**
 * Was passiert, wenn man an eine Tür geht. Läden öffnen den Laden (mit Gespräch),
 * Wohnhäuser zeigen einen kurzen Text.
 */
export interface DoorDef {
  name: string;
  /** Gespräch mit dieser Figur (Dialog-ID) */
  dialog?: string;
  npc?: string;
  /** direkt den Laden öffnen */
  shop?: string;
  text?: string;
}

export const DOORS: Record<string, DoorDef> = {
  // Taufeld
  'taufeld:kraemerin': { name: 'Wilmas Krämerladen', dialog: 'wilma', npc: 'wilma' },
  'taufeld:hilde': { name: 'Haus von Oma Hilde', text: 'Drinnen klappern Stricknadeln. Oma Hilde sitzt gerade im Garten.' },
  'taufeld:haus1': { name: 'Wohnhaus', text: 'Es duftet nach frischem Brot. Niemand öffnet.' },
  'taufeld:haus2': { name: 'Wohnhaus', text: 'An der Tür hängt ein Kranz aus Pusteblumen. Niemand zu Hause.' },
  'taufeld:gasthof': { name: 'Gasthof „Zum Ersten Tor"', dialog: 'bodo', npc: 'bodo' },
  // Runenhall
  'runenhall:gilde': { name: 'Turm des Ordens der Siegel', dialog: 'seraphine', npc: 'seraphine' },
  'runenhall:bibliothek': { name: 'Bibliothek von Runenhall', dialog: 'ambrosius', npc: 'ambrosius' },
  'runenhall:zauberladen': { name: 'Zum blätternden Buch', dialog: 'mirabell', npc: 'mirabell' },
  'runenhall:kraeuter': { name: 'Kräuterladen', dialog: 'salbeia', npc: 'salbeia' },
  'runenhall:teestube': { name: 'Teestube', dialog: 'tobias', npc: 'tobias' },
  'runenhall:schuster': { name: 'Schusterei', dialog: 'ferdinand', npc: 'ferdinand' },
  'runenhall:tauschboerse': { name: 'Tauschbörse', dialog: 'ottokar', npc: 'ottokar' },
  'runenhall:haus1': { name: 'Wohnhaus', text: 'Hinter der Tür murmelt jemand Zauberformeln. Besser nicht stören.' },
  'runenhall:haus2': { name: 'Wohnhaus', text: 'Ein Schild: „Bin in der Bibliothek."' },
};

/** Versteckte oder sammelbare Dinge in der Welt (Tag → Wirkung) */
export interface SpotDef {
  /** Karte, die man erhält */
  card?: string;
  /** Flag, das gesetzt wird */
  flag?: string;
  /** nur mit Aura-Sinn sichtbar */
  hidden?: boolean;
  /** braucht dieses Werkzeug (z. B. Schaufel) */
  needs?: string;
  text: string;
  /** wächst nach (Tage) */
  regrow?: number;
}

export const SPOTS: Record<string, SpotDef> = {
  'geheim:klee': { card: '091', flag: 'geheim:klee', hidden: true, text: 'Zwischen den Blumen leuchtet etwas: ein vierblättriger Klee!' },
  'geheim:glocke': { flag: 'glocke-gefunden', hidden: true, text: 'Im hohen Gras liegt eine kleine Messingglocke. Das muss Korbinians sein!' },
};

/** Sammelbare Objekte: Tag-Präfix → Karte */
export const PICKUPS: Record<string, { card: string; text: string }> = {
  pusteblume: { card: '098', text: 'Du pflückst eine Pusteblume.' },
  kiesel: { card: '097', text: 'Ein wunderbar glatter Kiesel.' },
};
