# Insel der 100 Karten

Ein 2D-Open-World-RPG im Pixel-Art-Stil (Phaser 3 + TypeScript + Vite, PWA).
Auf einer geheimnisvollen Insel ist alles eine Karte – Ziel ist es, alle 100 Sammelkarten
ins eigene Kartenbuch zu bekommen. Alle Grafiken, Schriften, Sounds und die Musik werden per Code
erzeugt. Das Spieldesign steht in [DESIGN.md](DESIGN.md).

**Stand:** Version 1.0 (Meilenstein 8) – das Spiel ist von Anfang bis Ende spielbar: alle 100 Sammelkarten sind
erhältlich (Monster, Läden, Truhen, Fundstellen, über 40 Quests, 6 Minispiele, 9 Bossmonster),
KI-Rivalen sammeln mit, die Geschichte um die Aschenhand, das Finale mit Spielleiter Nullpunkt,
Abspann und New Game+. Dazu Tag/Nacht mit Lichtern, Wetter je Region, Sound und Musik (M5),
die ganze Insel mit 7 Städten (M4), Kampf und Aura (M3) und das Kartenbuch mit allen Regeln (M2).

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
npm run dev
```

Dann im Browser <http://localhost:5173> öffnen.

### Auf Handy oder iPad im selben WLAN

`npm run dev` zeigt neben der lokalen Adresse auch eine Netzwerk-Adresse, z. B.
`Network: http://192.168.1.23:5173/`. Diese Adresse auf dem Handy/iPad öffnen
(Laptop und Handy im selben WLAN). Gerät quer halten.

Hinweis: Installation als App und Offline-Modus brauchen HTTPS – das funktioniert über die
GitHub-Pages-Version (siehe unten) oder lokal mit `npm run build && npm run preview` auf
`localhost`.

### Veröffentlichen mit GitHub Pages

Der Workflow `.github/workflows/deploy.yml` baut das Spiel und veröffentlicht es.

1. Auf GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions"**.
2. Änderungen in den Branch `main` bringen (Merge). Jeder Push auf `main` veröffentlicht automatisch;
   alternativ unter **Actions → „Deploy auf GitHub Pages" → Run workflow**.
3. Das Spiel ist danach erreichbar unter
   `https://antony977.github.io/Insel-der-100-Karten/` – auf Handy/iPad über „Zum Home-Bildschirm"
   als App installierbar und offline spielbar.

## Steuerung

| Aktion | Tastatur | Gamepad | Touch |
|---|---|---|---|
| Bewegen | WASD / Pfeiltasten | linker Stick / Steuerkreuz | Joystick links (erscheint unter dem Daumen) |
| Angriff / Interagieren | Leertaste / E, Linksklick | A | A |
| Ausweichen (Rolle) | Shift, Rechtsklick | B | B |
| Aura | Q | X | Aura-Knopf |
| Kartenbuch | B | Y | Buch-Knopf |
| Schnellzauber 1–3 | 1 / 2 / 3 | LB / RB / RT | Karten-Slots |
| Weltkarte | M | Select | Karten-Knopf |
| Pause | Esc | Start | Pause-Knopf |

- **Aufladeangriff:** Angriff gedrückt halten und loslassen (goldener Schlag).
- **Combo:** Angriff dreimal im Rhythmus drücken – der dritte Schlag trifft am härtesten.
- **Ausweichrolle:** kurz unverwundbar – ideal, um hinter gepanzerte Gegner zu kommen.
- **Zielen mit der Maus:** Mausbewegung schaltet auf Zielen um (Fadenkreuz).
- Die Eingabe wechselt automatisch und live zwischen Tastatur, Maus, Touch und Gamepad.
- Tastenbelegung, Touch-Grösse/-Deckkraft, Linkshänder-Modus usw. unter **Einstellungen**.

## Kampf und Aura

- **Aura-Taste kurz drücken:** gewählte Technik auslösen bzw. ein-/ausschalten.
- **Aura-Taste halten:** das **Aura-Rad** öffnet sich (die Zeit läuft langsamer). Richtung wählen
  (Tastatur/Stick; auf dem Handy auf dem Aura-Knopf in die Richtung wischen) und loslassen.
- Techniken: **Aura-Sinn** (zeigt Getarntes und Unsichtbares), **Aura-Stoss** (Fernangriff),
  **Aura-Schild** (ab Stufe 2, Schaden stark verringert, hoher Verbrauch), **Fokus** (ab Stufe 3,
  doppelter Schaden, aber verwundbarer), **Spezialtechnik** (ab Stufe 5, je nach Affinität:
  Bodenstampfer, Blitzkette, Widerhall, Aura-Netz oder Spiegelbild).
- **Level-Up:** Das Spiel pausiert, du wählst 1 von 3 Fähigkeitskarten – Rot (Stärke), Grün (Tempo),
  Blau (Aura) oder Gold (Talent deiner Affinität, 3 Zweige × 4 Stufen).
- **Monster werden zu Karten:** Besiegte Monster verwandeln sich mit etwas Glück in ihre
  Sammelkarte (nur solange das Limit nicht erreicht ist). Manche Monster brauchen einen Trick:
  Wiesenflitzer in die Enge treiben, Zangenkrabben von hinten treffen, Trugbilder mit Aura-Sinn …
- **Entfesselte Monsterkarten** rufen das Monster als Begleiter herbei.
- **Ohnmacht:** Bei 0 LP wachst du am Rastplatz auf – Geld und die Karten der freien Slots sind weg,
  die Sammelseiten bleiben.

### Im Kartenbuch

| Aktion | Tastatur / Gamepad | Maus / Touch |
|---|---|---|
| Reiter wechseln (Sammlung, Frei, Hand, Beutel, Status) | 1 / 2, Tab, Q | Reiter antippen |
| Karte wählen | Pfeiltasten / Steuerkreuz | antippen |
| Aktion (Einordnen, Entfessle!, Verschieben …) | Bestätigen → Knopf wählen | Knopf antippen |
| Karte verschieben | „Verschieben", dann Ziel-Slot | ziehen und loslassen (auch auf einen Reiter) |
| Umblättern | links/rechts am Seitenrand | Pfeile, Mausrad, Karte an den Rand ziehen |
| Schliessen | B, Esc | × oder Buch-Knopf |

## Kartenbuch-Regeln (Kurzfassung)

- **Sammelseiten 000–099:** Jeder Slot nimmt nur seine eigene Karte. Unbekannte Karten zeigen Nummer,
  Silhouette und einen Hinweis, wo man sie findet. Nur Karten hier zählen für den Fortschritt (x/100).
- **Freie Slots (45):** Zauber, Doppelte und alles, was man mitnehmen will.
- **Hand (max. 10):** Neue Karten landen zuerst in der Hand. Das HUD zeigt den 60-Sekunden-Zähler –
  läuft er ab, verwandelt sich die Karte **dauerhaft** in ihren Gegenstand. Auf den Boden gefallene
  Karten blinken in den letzten 10 Sekunden.
- **Limit:** Jede Karte gibt es auf der Insel nur begrenzt oft. Ist das Limit erreicht, gibt es keine neue.
- **Verlorene Karten** (verwandelt, verfallen, beim Zusammenbruch verloren oder geraubt) merkt sich
  das Buch. Der seltene Zauber **Phönixtinte** stellt eine davon wieder her – bevorzugt eine, die im
  Sammelbuch noch fehlt. So bleiben auch Einzelkarten von Bossen und Quests erreichbar.
- **„Entfessle!":** verwandelt eine Karte in den echten Gegenstand (Trank, Ausrüstung, Werkzeug …).
  Gegenstände liegen im **Beutel**; Ausrüstung verändert die Werte im **Status**.
- **Zauberkarten** passen nur in freie Slots und werden im Buch über „Wirken" eingesetzt (oder per Schnelltaste).
- Solange das Buch offen ist, pausiert die Welt.

## Die Insel

- **Neues Spiel:** kurzes Intro, Name, Wahl der Aura-Affinität (Wurzel, Strömung, Echo, Faden,
  Spiegel) und ein eigener Name für die Spezialtechnik.
- **Anleitung „Erste Schritte“:** Beim ersten Betreten der Insel erklären neun bebilderte Seiten
  Ziel, Spielablauf (woher Karten kommen), Steuerung (passend zu Tastatur, Touch oder Gamepad), die
  60-Sekunden-Regel, das Kartenbuch, Kampf und Aura, Rasten und Speichern und mit einer kleinen
  Inselkarte, wohin man am Anfang geht (erledigte Schritte werden abgehakt). Später jederzeit im
  Pausenmenü unter „Anleitung“.
- **Start am Ersten Tor in Taufeld.** Lumi erklärt alles und schenkt dir die ersten Karten.
  Danach führt dich die Startquest: Karten einordnen → noch einmal mit Lumi sprechen → rund um
  Taufeld Stufe 3 erreichen → einem blauen Pfeil nach Runenhall folgen. Neue und erfüllte
  Aufgaben werden oben eingeblendet.
- **Sieben Städte**, jede mit eigenen Figuren, Läden und Quests:
  - **Taufeld** – Krämerin, Gasthof, Oma Hilde (Wolle), Bauer Korbinian (Glocke), Wunschbrunnen.
  - **Runenhall** – Orden der Siegel (Prüfung, Gildenturm), Bibliothek (Rätsel), Zauberladen
    (Siegelpacks), Kräuterladen, Teestube, Schuster, Tauschbörse, Tintenkobold-Dieb.
  - **Möwenhafen** – Hafenmeisterin (Seetor-Quest, Logbuch), Angelwette, Leuchtfeuer in der
    Sturmnacht, Boot zu den Möwenklippen, Hafenkrake.
  - **Würfelheim** – Casino „Goldene Sieben" (Hoch oder Tief, Höher oder Tiefer, Sternenautomat
    mit Jackpot), Falschspieler entlarven, Kasimirs Schulden, Preisladen (Chips), Tresorraum.
  - **Hohenkamm** – Brakkas Prüfungen, Turnier im Felsenkessel (5 Wellen), Klippenball-Liga
    (2 gegen 2), frierender Eiswächter, Adlerhorst, Gipfel.
  - **Sandspiegel** – Wasserdiebe (Aura-Sinn!), Karawanen-Eskorte, Diamanthenne, Spiegelsaal
    (Lichträtsel), verschüttete Oase mit der Sphinx der Stunden.
  - **Rosenweil** – Herzensgeschichte mit zwei Enden (Ehrlichkeit lohnt sich!), Poet,
    Rosenfest-Tanz (abends), Ständchen auf den Gartenglocken, verwilderter Rosengarten.
- **Wildnis:** sieben Aussichtspunkte, Windmühlen (Mehl), Statuen-Rätsel und Zeitrennen in den
  Ruinen, Irrlicht-Laternen und ein verirrter Forscher im Nebelhain, Grabstellen (Schaufel),
  eine Insel im Silbersee (Wolkenfloss), Glimmerhöhle (Kristalle mit Aufladeschlag abbauen).
- **Wege, die Karten öffnen:** Hafenpass (Boot), Kletterranke (Adlerhorst), Moosbarts Herzsamen
  (Rankenbrücke zum Gipfel), Irrlicht im Glas (Nebelwand), Dornenring (Wurzelpforte),
  Oasenschlüssel, Tiefenperle (Muschelgrotte), Ewige Laterne (Labyrinth der Leeren Seiten).
- **Bosse** mit Phasen und angekündigten Angriffen (rote Flächen = ausweichen!): Moosbart,
  Tintenkoloss, Tiefenmaul, Hausbankier, Sturmgreif Kragor, Nebelmutter, Dornenbaron,
  der Leere Leser und Varga Aschenherz.
- **Rivalen:** Mila, Bruno, Frida, Juna, Lio, Tjark, Kasimir und die Aschenhand sammeln selbst
  Karten (die Limits gelten für alle). Ansprechen zum Plaudern (Hinweise), Tauschen und Verbünden.
  Die Handlanger der Aschenhand zaubern im Kampf – Schutzzauber helfen!
- **Tag und Nacht:** Ein Tag dauert 12 Minuten. Nachts leuchten Laternen und Lagerfeuer, manche
  Monster zeigen sich nur nachts oder bei Vollmond. Jede dritte Nacht zieht ein Sturm auf.
  Am Rastfeuer kann man bis zum Morgen oder bis zur Nacht warten.
- **Wetter:** Regen, Sturm mit Blitzen, Schnee in Hohenkamm, Nebel im Nebelhain, Sandsturm in
  Sandspiegel. Die Wetterfahne ändert das Wetter (am Rastfeuer).
- **Finale:** Sind alle 100 Sammelseiten gefüllt, leuchtet das Erste Tor. Spielleiter Nullpunkt
  lässt dich drei Karten für die echte Welt wählen – danach Abspann und **New Game+**
  (Stufe und Talente bleiben, Monster werden stärker).
- **Eingänge:** Höhlen und Treppen betrittst du einfach durch Hineinlaufen (oder mit der Aktionstaste).
- **Rastfeuer:** ausruhen (heilt, speichert, Wiederaufwach-Punkt). **Stadtbrunnen:** Ziel für
  Brunnensprung; der Brunnen in Taufeld ist ein Wunschbrunnen.
- **Weltkarte (M):** zeigt nur, was du schon erkundet hast (die Kartografenfeder deckt alles auf).
- **Quest-Log:** Reiter „Quests" im Kartenbuch. Ein blauer Pfeil zeigt bei manchen Quests den Weg.
- Versteckte Dinge siehst du nur mit **Aura-Sinn** (oder der Leuchtturmlinse).

### Zum Ausprobieren

`?map=testwiese` in der Adresse (nur `npm run dev`) lädt wieder die alte Testwiese.

### Auf der Testwiese

- **Lumi** (neben dem Startpunkt) ansprechen → 3 Startkarten.
- **4 Truhen** sind versteckt (beim Haus, im Garten, im Wald, am See).
- **Monster:** Wollknäuel und Hüpfpilze südlich des Wegs, Blattschnapper (getarnt als Busch),
  ein Wiesenflitzer im Südosten, Kieselkrebse am Fluss, Schlammkröten und eine Zangenkrabbe am See,
  Stachelschwalben im Osten und ein Tintenkobold beim Platz (klaut Münzen!).
- **Wunschbrunnen:** 10 Münzen einwerfen → zufällige Karte (seltene Ränge sind selten).

## Sound und Musik

Alle Klänge entstehen im Code – es gibt keine Audiodateien:

- **Soundeffekte** (`src/audio/sfxDefs.ts`): über 40 Effekte als Synthesizer-Parameter (Rechteck,
  Dreieck, Sinus, Rauschen, Hüllkurven, Tonhöhenverläufe). Sie werden beim ersten Antippen bzw.
  Tastendruck einmalig berechnet (Browser erlauben Ton erst nach einer Nutzer-Geste).
- **Musik** (`src/audio/songs.ts` + `composer.ts`): ein kleiner Chiptune-Komponist erzeugt aus
  Tonart, Tempo, Taktart, Akkordfolge und Stil vierstimmige Stücke (Melodie, Begleitung, Bass,
  Schlagzeug). Jede Region hat ihr eigenes Stück – dazu Titelmusik, ein ruhiges
  **Lagerfeuer-Thema** (spielt automatisch, sobald du an einem Rastfeuer stehst), Kampf-, Boss- und
  Abspannmusik. Die Stücke werden im Hintergrund (Web Worker) berechnet und nahtlos geloopt;
  Wechsel werden übergeblendet.
- In Dialogen, im Kartenbuch und im Pausenmenü wird die Musik leiser.
- **Einstellungen → Musik / Effekte / Stumm** regeln die Lautstärke (wird gespeichert).
- Auf dem iPhone ist der Ton aus, wenn der Stumm-Schalter am Gerät aktiv ist.

### Eigene Sounds oder Musik einsetzen

Dateien (`.ogg`, `.mp3`, `.m4a`, `.wav`) nach `public/audio/` legen und in
`public/audio/overrides.json` eintragen:

```json
{ "sfx": { "hit": "mein-treffer.ogg" }, "music": { "taufeld": "taufeld.mp3" } }
```

Die Namen der Effekte stehen in `src/audio/sfxDefs.ts`, die der Musikstücke in `src/audio/songs.ts`.

## Speichern

- **Autosave** alle 30 Sekunden, beim Schliessen des Buchs und beim Verlassen/Wechseln der App.
- **3 Speicherplätze** über Pause → Speichern / Laden (und im Titelbild „Laden").
- **Export/Import** als JSON-Datei im Lade-/Speichermenü (Sicherung oder Umzug auf ein anderes Gerät).

## Debug-Modus (nur `npm run dev`)

| Taste | Funktion |
|---|---|
| F1 | Debug-Infos (Position, Eingabe, Render-Faktor, aktive Objekte) |
| F2 | Kollisionsboxen anzeigen |
| F3 | Noclip |
| F4 | Aura-Farbe wechseln |
| F6 | Testtreffer (Rückstoss, Hit-Stop) |
| F7 | Zufällige Karte in die Hand |
| F8 | 10 zufällige Sammelkarten direkt ins Buch |
| U | Unverwundbar an/aus |
| L | Sofort eine Stufe aufsteigen |
| K | Alle Monster in der Nähe besiegen |
| J | Nächste Monsterart neben dir erscheinen lassen |
| F9 | Alle generierten Grafiken als PNG-Vorlage öffnen |
| T | Zum Mauszeiger teleportieren |

`?start=world` in der Adresse startet direkt auf der Insel (neues Spiel ohne Intro).
In der Browser-Konsole ist der Spielzustand als `__state` erreichbar (z. B. `__state.giveCard('042')`).

## Tests

```bash
npm test          # Unit-Tests (Vitest)
npm run typecheck # TypeScript
npm run build     # Produktions-Build inkl. Service Worker
```

## Projektstruktur

```
src/
  scenes/       Boot, Titel, Neues Spiel, Welt, HUD, Kartenbuch, Gespräche, Läden, Auswahl,
                Weltkarte, Stufenaufstieg, Pause, Einstellungen, Speicherplätze, Abspann
  scenes/mini/  Minispiele: Casino, Angeln, Tanz, Ständchen, Spiegelsaal, Klippenball
  systems/      Anzeige, Einstellungen, Spielzustand, Speichern, Dialoge, Quests, Zauber,
                Wetter, Welt-Module (Quest-Logik), Rivalen-KI
  systems/cards/  Karten-Register (Limits), Buch (Slots, Hand, 60-s-Regel), Inventar
  systems/combat/ Schaden, Monster-KI, Bosskämpfe, Geschosse, Schadenszahlen
  entities/     Spielfigur, Monster, Figuren
  input/        Aktionen, Eingabe-Manager (Tastatur/Maus/Gamepad), Touch-Overlay
  world/        Insel-Generator, Dungeon-Baukasten (ASCII), Tag/Nacht/Wetter, Tile-Streaming
  data/         datengetriebene Inhalte: 100 Sammelkarten, 40 Zauber, Monster und Bosse,
                Figuren, Läden, Türen, Truhen, Inselplan, Dungeons
  data/dialogs/ Gespräche und Quests je Stadt, Wildnis, Rivalen, Finale
  gfx/          Palette, Pixel-Schrift, Grafik-Generatoren, Asset-Loader
  audio/        Synthesizer, Soundeffekte, Chiptune-Komponist, Musikstücke, Audio-Engine
  ui/           Text, Rahmen, Menüs
scripts/        Icon-Generator, PNG-Encoder
tests/          Unit-Tests (Karten, Kampf, Insel-Erreichbarkeit, Dungeons, Kartenquellen, Audio …)
```

### Grafiken ersetzen

Jede generierte Grafik kann durch eine PNG ersetzt werden: Datei nach `public/gfx/` legen und in
`public/gfx/overrides.json` eintragen, z. B. `{ "player": "player.png" }`. Das erwartete Layout
jeder Grafik steht in `src/gfx/AssetManifest.ts` (F9 im Debug-Modus zeigt alle Grafiken als Vorlage).
