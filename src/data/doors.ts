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
  // Möwenhafen
  'moewenhafen:hafenladen': { name: 'Hafenladen', dialog: 'greta', npc: 'greta' },
  'moewenhafen:kneipe': { name: 'Kneipe „Zur nassen Möwe"', dialog: 'kneipenwirt', npc: 'kneipenwirt' },
  'moewenhafen:hafenmeister': { name: 'Hafenmeisterei', dialog: 'marlene', npc: 'marlene' },
  'moewenhafen:fisch': { name: 'Fischstand', dialog: 'jorn', npc: 'jorn' },
  'moewenhafen:haus1': { name: 'Wohnhaus', text: 'Netze hängen zum Trocknen vor der Tür. Drinnen schnarcht jemand laut.' },
  // Würfelheim
  'wuerfelheim:casino': { name: 'Casino „Goldene Sieben"', dialog: 'fortuna', npc: 'fortuna' },
  'wuerfelheim:schwarzhaendler': { name: 'Hinterhof', dialog: 'schwarzhaendler', npc: 'schwarzhaendler' },
  'wuerfelheim:preisladen': { name: 'Preisladen', dialog: 'preisdame', npc: 'preisdame' },
  'wuerfelheim:haus1': { name: 'Wohnhaus', text: 'Hinter der Tür klappern Würfel. „Noch eine Runde!", ruft jemand.' },
  'wuerfelheim:haus2': { name: 'Wohnhaus', text: 'Ein Zettel an der Tür: „Bin im Casino. Komme reich zurück."' },
  // Hohenkamm
  'hohenkamm:arena': { name: 'Felsenkessel', dialog: 'horst', npc: 'horst' },
  'hohenkamm:training': { name: 'Trainingshalle', dialog: 'brakka', npc: 'brakka' },
  'hohenkamm:haus1': { name: 'Wohnhaus', text: 'Es riecht nach Kaminfeuer und Käsefondue. Niemand öffnet.' },
  'hohenkamm:eiswaechter': { name: 'Eiswächterhaus', dialog: 'isgard', npc: 'isgard' },
  'hohenkamm:huette': { name: 'Berghütte', dialog: 'huettenwirt', npc: 'huettenwirt' },
  // Sandspiegel
  'sandspiegel:spiegelsaal': { name: 'Spiegelsaal', dialog: 'ilka', npc: 'spiegelmeisterin' },
  'sandspiegel:haus1': { name: 'Wohnhaus', text: 'Kühle Luft weht aus dem Lehmhaus. Ein Windspiel klingelt leise.' },
  'sandspiegel:basar': { name: 'Basar', dialog: 'yusuf', npc: 'basarhaendler' },
  'sandspiegel:wasser': { name: 'Zisterne', dialog: 'samira', npc: 'samira' },
  'sandspiegel:karawane': { name: 'Karawanenzelt', dialog: 'kasim', npc: 'kasim-stadt' },
  'sandspiegel:karawane2': { name: 'Vorratszelt', text: 'Säcke voller Gewürze, Stoffballen und ein schlafendes Kamel – zumindest klingt es so.' },
  // Rosenweil
  'rosenweil:poet': { name: 'Haus des Poeten', dialog: 'aurelian', npc: 'aurelian' },
  'rosenweil:kraemer': { name: 'Rosenweiler Krämer', dialog: 'benno', npc: 'rosenkraemer' },
  'rosenweil:haus1': { name: 'Rosas Haus', text: 'Überall Blumentöpfe. Rosa ist bestimmt im Garten.' },
  'rosenweil:gasthof': { name: 'Gasthof „Zur Rosenlaube"', dialog: 'rosenwirt' },
  'rosenweil:fest': { name: 'Rosenfest-Bühne', dialog: 'lilia', npc: 'festwirtin' },
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
  /** gefundene Münzen */
  money?: number;
}

export const SPOTS: Record<string, SpotDef> = {
  'geheim:klee': { card: '091', flag: 'geheim:klee', hidden: true, text: 'Zwischen den Blumen leuchtet etwas: ein vierblättriger Klee!' },
  'geheim:glocke': { flag: 'glocke-gefunden', hidden: true, text: 'Im hohen Gras liegt eine kleine Messingglocke. Das muss Korbinians sein!' },
  // Möwenklippen
  'geheim:logbuch': { flag: 'logbuch-gefunden', text: 'Zwischen Möwenfedern klemmt ein ledernes Buch: das verlorene Logbuch! Bring es Hafenmeisterin Marlene.' },
  'geheim:ranke': { card: '017', flag: 'geheim:ranke', hidden: true, text: 'In einer Felsspalte keimt ein schimmernder Samen – eine Kletterranke!' },
  // Wüste: verschüttete Oase
  'graben:wueste:1': { needs: '082', money: 40, text: 'Du gräbst … und findest ein paar alte Münzen im Sand.' },
  'graben:wueste:2': { needs: '082', text: 'Nur Sand. Und noch mehr Sand.' },
  'graben:wueste:3': { needs: '082', card: '030', flag: 'oasenschluessel', text: 'Die Schaufel stösst auf Stein – eine verschüttete Brunnenkante! Darin liegt ein grüner Schlüssel: der Oasenschlüssel.' },
  'graben:wueste:4': { needs: '082', card: '097', text: 'Ein glatter Kiesel, poliert vom Wüstenwind.' },
  'graben:wueste:5': { needs: '082', money: 80, text: 'Ein Beutel mit Münzen! Wer den wohl vergraben hat?' },
  // Ruinen von Alt-Kartheim
  'graben:ruine:1': { needs: '082', card: '072', text: 'Unter Moos und Schutt glänzt eine uralte Münze.' },
  'graben:ruine:2': { needs: '082', card: '072', text: 'Eine Münze mit dem Wappen von Alt-Kartheim!' },
  'graben:ruine:3': { needs: '082', card: '072', text: 'Noch eine uralte Münze – die Ruinen sind voll davon.' },
  'graben:ruine:4': { needs: '082', card: '072', text: 'Grünspan und Gold: eine uralte Münze.' },
  'graben:ruine:5': { needs: '082', card: '072', text: 'Zwischen zwei Steinen steckt eine uralte Münze.' },
  'graben:ruine:6': { needs: '082', card: '072', text: 'Eine uralte Münze, halb im Lehm vergraben.' },
  // Sandspiegel: Spuren der Wasserdiebe
  'spur:1': { flag: 'spur:1', hidden: true, text: 'Fussspuren, die nach wenigen Schritten einfach … aufhören. Seltsam.' },
  'spur:2': { flag: 'spur:2', hidden: true, text: 'Ein feuchter Fleck im Sand – und ein Hauch von Aura, flimmernd wie Hitze.' },
  'spur:3': { flag: 'spur:3', hidden: true, text: 'Ein zerbrochener Wasserkrug. Daneben Abdrücke, die durchsichtig schimmern.' },
};

/** Sammelbare Objekte: Tag-Präfix → Karte */
export const PICKUPS: Record<string, { card: string; text: string }> = {
  pusteblume: { card: '098', text: 'Du pflückst eine Pusteblume.' },
  kiesel: { card: '097', text: 'Ein wunderbar glatter Kiesel.' },
  glimmerpilz: { card: '071', text: 'Du pflückst einen leuchtenden Glimmerpilz.' },
};
