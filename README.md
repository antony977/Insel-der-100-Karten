# Insel der 100 Karten

Ein 2D-Open-World-RPG im Pixel-Art-Stil (Phaser 3 + TypeScript + Vite, PWA).
Auf einer geheimnisvollen Insel ist alles eine Karte – Ziel ist es, alle 100 Sammelkarten
ins eigene Kartenbuch zu bekommen. Alle Grafiken, Schriften und (später) Sounds werden per Code
erzeugt. Das Spieldesign steht in [DESIGN.md](DESIGN.md).

**Stand:** Meilenstein 1 – Projekt-Setup, Skalierung, Eingabe-System, Spielfigur auf einer Testkarte.

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
- **Combo:** Angriff dreimal im Rhythmus drücken.
- **Zielen mit der Maus:** Mausbewegung schaltet auf Zielen um (Fadenkreuz).
- Die Eingabe wechselt automatisch und live zwischen Tastatur, Maus, Touch und Gamepad.
- Tastenbelegung, Touch-Grösse/-Deckkraft, Linkshänder-Modus usw. unter **Einstellungen**.

## Debug-Modus (nur `npm run dev`)

| Taste | Funktion |
|---|---|
| F1 | Debug-Infos (Position, Eingabe, Render-Faktor, aktive Objekte) |
| F2 | Kollisionsboxen anzeigen |
| F3 | Noclip |
| F4 | Aura-Farbe wechseln |
| F6 | Testtreffer (Rückstoss, Hit-Stop) |
| F9 | Alle generierten Grafiken als PNG-Vorlage öffnen |
| T | Zum Mauszeiger teleportieren |

`?start=world` in der Adresse startet direkt in der Testwelt.

## Tests

```bash
npm test          # Unit-Tests (Vitest)
npm run typecheck # TypeScript
npm run build     # Produktions-Build inkl. Service Worker
```

## Projektstruktur

```
src/
  scenes/     Boot, Titel, Welt, HUD, Pause, Einstellungen, Tastenbelegung
  systems/    Anzeige/Skalierung, Einstellungen, Speicher, Effekt-Pool
  entities/   Spielfigur (später Monster, NPCs, Rivalen)
  input/      Aktionen, Eingabe-Manager (Tastatur/Maus/Gamepad), Touch-Overlay
  world/      Kartendaten, Terrain, Tile-Streaming, Objekt-Streaming
  data/       datengetriebene Inhalte (Karten, Weltobjekte, später Karten/Monster/Quests)
  gfx/        Palette, Pixel-Schrift, Grafik-Generatoren, Asset-Loader
  ui/         Text, Rahmen, Menüs
  audio/      (Meilenstein 5)
scripts/      Icon-Generator, PNG-Encoder
tests/        Unit-Tests
```

### Grafiken ersetzen

Jede generierte Grafik kann durch eine PNG ersetzt werden: Datei nach `public/gfx/` legen und in
`public/gfx/overrides.json` eintragen, z. B. `{ "player": "player.png" }`. Das erwartete Layout
jeder Grafik steht in `src/gfx/AssetManifest.ts` (F9 im Debug-Modus zeigt alle Grafiken als Vorlage).
