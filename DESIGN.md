# Insel der 100 Karten – Design-Dokument

> Kurzes, lebendes Design-Dokument. Alle Namen, Figuren, Orte, Karten, Zauber, Monster und
> Geschichten sind eigene Erfindungen für dieses Projekt. Schreibweise im Spiel: Schweizer
> Hochdeutsch (ss statt ß).

## 1. Kernidee

Eine geheimnisvolle Spielkonsole – die **Lumenbox** – zieht die Spielerin bzw. den Spieler in
eine Pixelwelt: die **Insel der 100 Karten**. Hier ist alles eine Karte. Mit einem Fingerschnippen
klappt das persönliche Kartenbuch auf („Aufgeschlagen!"). Wer alle 100 Sammelkarten (Nr. 000–099)
in den Sammelseiten vereint, ruft den **Spielleiter Nullpunkt** herbei, darf drei Karten in
die echte Welt mitnehmen – und danach mit New Game+ weiterspielen.

### Kartenbuch-Regeln

| Regel | Beschreibung |
|---|---|
| Sammelseiten | 100 Slots (000–099). Jeder Slot nimmt nur seine Karte auf und zeigt vorher nur Nummer + Silhouette. Nur Karten in den Sammelseiten zählen. |
| Freie Slots | 45 Plätze für Zauber, Gegenstände, Doppelte. |
| Ränge | SS, S, A, B, C, D, E, F, G, H |
| Limit | Maximale Anzahl Exemplare einer Karte auf der ganzen Insel (inkl. KI-Rivalen). Ist das Limit erreicht, gibt es die Karte nur noch durch Handel, Raub oder Tausch. Verwandelte (entfesselte) Karten existieren nicht mehr als Karte und geben ihr Limit frei. |
| „Entfessle!" | Verwandelt eine Karte in ihren echten Gegenstand (Heiltrank, Schlüssel, Ausrüstung …). |
| 60-Sekunden-Regel | Eine Karte ausserhalb des Buchs (fallengelassen, gerade erbeutet, in der Hand) verwandelt sich nach 60 s automatisch und dauerhaft in ihren Gegenstand. |
| Hand | Neue Karten landen zuerst in der Hand (max. 10, mit sichtbarem 60-s-Zähler im HUD). Ist die Hand voll, fällt die Karte auf den Boden. Herausnehmen aus dem Buch startet den Zähler neu. |
| Buch offen | Solange das Buch offen ist, pausiert die Welt (auch die Zähler) – Komfort für Touch-Bedienung. |
| Zauber | Zauberkarten passen nur in freie Slots; „Wirken" kommt mit dem Kampfsystem (Meilenstein 4). |
| Tod | Geld und alle Karten der freien Slots gehen verloren, Erwachen am letzten Stadtbrunnen. Sammelseiten bleiben. |

### Rang-Farben (immer zusätzlich mit Buchstaben und Form – farbenblind-freundlich)

| Rang | Farbe | Symbol am Rahmen | typisches Limit |
|---|---|---|---|
| SS | Weiss-Gold, schimmernd | Doppel-Raute | 1–3 |
| S | Gold | Raute | 3–4 |
| A | Rot | Stern | 3–5 |
| B | Violett | Mond | 5–10 |
| C | Blau | Tropfen | 10–15 |
| D | Grün | Blatt | 20–30 |
| E | Türkis | Welle | 30–40 |
| F | Orange | Kreis | 40–50 |
| G | Braun | Quadrat | 60–80 |
| H | Grau | Punkt | 99 |

## 2. Aura-System

Aura-Leiste mit Regeneration. Grundtechniken:

- **Aura-Schild** – Schaden stark reduziert, hoher Dauerverbrauch.
- **Aura-Stoss** – Fernangriff, aufladbar.
- **Aura-Sinn** – macht versteckte Gegner, Fallen und Karten sichtbar (Verbrauch über Zeit).
- **Fokus** – ein Körperteil macht doppelten Schaden, der Rest ist ungeschützt.

Werte: **LP, Aura, Stärke, Tempo, Aura-Kontrolle.** Beim Level-Up pausiert das Spiel, man
wählt **1 von 3 farbcodierten Fähigkeitskarten** (Rot = Stärke, Grün = Tempo, Blau = Aura,
Gold = Affinitäts-Talent).

### Die fünf Aura-Affinitäten (Wahl beim Spielstart)

Jede Affinität hat einen Talentbaum (3 Zweige × 4 Stufen) und eine Spezialtechnik, der man
**selbst einen Namen gibt**.

| Affinität | Farbe | Stil | Spezialtechnik (Wirkung) |
|---|---|---|---|
| **Wurzel** | Grün | Standfest, schwere Schläge, Verteidigung | Bodenstampfer: Gegner im Umkreis werden kurz festgewurzelt. |
| **Strömung** | Cyan | Tempo, Combos, Ausweichen | Kette aus bis zu 5 Blitzsprüngen zwischen Gegnern. |
| **Echo** | Violett | Fernkampf mit Aura-Stoss | Ein Stoss, der an Wänden abprallt und mit jedem Abprall stärker wird. |
| **Faden** | Gold | Kontrolle, Fallen | Aura-Netz, das Gegner verlangsamt und herumliegende Karten anzieht. |
| **Spiegel** | Rosa | List, Täuschung, Konter | Spiegelbild, das Angriffe auf sich zieht und beim Zerspringen explodiert. |

## 3. Orte (nahtlose Insel mit Zonen-Streaming)

| # | Ort | Rolle | Farbschema | Musik-Stimmung | Boss |
|---|---|---|---|---|---|
| 1 | **Taufeld & das Erste Tor** | Startwiese, Tutorial mit Torhüterin **Lumi** | Frühlingsgrün, Gelb, Rosa | fröhlich, Dur | Moosbart, der Grasriese |
| 2 | **Runenhall** | Magierstadt: Zauberladen „Zum blätternden Buch", Tauschbörse, Gilde „Orden der Siegel", Rangliste | Violett, Nachtblau, Silber | mystisch | Der Tintenkoloss |
| 3 | **Möwenhafen** | Hafenstadt mit dem bewachten **Seetor** – einziger Weg von der Insel | Meerblau, Weiss, Holzbraun | Seemannslied im 6/8 | Tiefenmaul, die Hafenkrake |
| 4 | **Würfelheim** | Casino-Stadt: Würfel „Hoch oder Tief", Karten „Höher/Tiefer", Slots „Sternenautomat" | Rot, Gold, Neon-Pink | Swing | Der Hausbankier |
| 5 | **Hohenkamm** | Bergdorf, Arena **Felsenkessel**, Sport **Klippenball** | Steingrau, Schneeweiss, Kaltblau | heroisch | Sturmgreif Kragor |
| 6 | **Sandspiegel** | Wüstenstadt: Rätsel, Handelskarawane, Spiegelsaal | Ocker, Orange, Türkis | geheimnisvoll | Die Sphinx der Stunden |
| 7 | **Nebelhain** | Nebelwald mit starken Monstern und versteckten Höhlen (Glimmerhöhle) | Dunkeltürkis, Moosgrün, Grau | langsam, Moll | Die Nebelmutter |
| 8 | **Rosenweil** | Romantik-Stadt: Beziehungs-Quest mit Entscheidungen, Rosenfest | Rosa, Pfirsich, Cremeweiss | Walzer | Der Dornenbaron |
| 9 | **Labyrinth der Leeren Seiten** | Geheimes Endgame-Dungeon | Tintenschwarz, Papierweiss, Violett | bedrohlich | Der Leere Leser |

**Zwischen den Städten:** Windhalmfelder (Windmühlen), Fluss Silberlauf, Silbersee,
Möwenklippen, Glimmerhöhle, Ruinen von Alt-Kartheim, sieben Aussichtspunkte,
Rastfeuer (Lagerfeuer zum Speichern und Ausruhen).

**Wege, die Karten öffnen:** Wolkenfloss (Silbersee), Kletterranke (Klippenpfade),
Moosbarts Herzsamen (Rankenbrücke über die Schlucht), Ewige Laterne (tiefer Nebel),
Tiefenperle (Muschelgrotte), Oasenschlüssel, Seitenschlüssel (Labyrinth), Hafenpass (Seetor).

**Weltkarte (M):** Fog-of-War, Schnellreise nur per Bewegungszauber.

## 4. Die 100 Sammelkarten

Typen: Schatz, Wunder, Ausrüstung, Werkzeug, Schlüssel, Heilmittel, Verbrauch, Monster,
Kuriosität, Talisman, Pflanze, Tier, Lichtquelle, Wertgegenstand, Dokument, Köder, Zutat.

| Nr. | Name | Rang | Limit | Typ | Wirkung (entfesselt) | Fundort / Hinweis |
|---|---|---|---|---|---|---|
| 000 | Herz der Insel | SS | 1 | Schatz | Volle Heilung, LP & Aura dauerhaft +20 % | Den Leeren Leser im Labyrinth besiegen |
| 001 | Taschenozean | SS | 2 | Wunder | Ein Meer in der Flasche: erschafft einen Teich mit Münzfischen, löscht Feuer | Klippenball-Meisterschaft gegen „Die Gipfelstürmer" gewinnen |
| 002 | Goldener Setzling | SS | 2 | Wunder | Ein Bäumchen, an dem jeden Morgen Münzen wachsen | Grosser Jackpot am Sternenautomaten (Würfelheim) |
| 003 | Ewige Laterne | SS | 3 | Ausrüstung | Leuchtet ewig, vertreibt Nebel, zeigt verborgene Wege | Die Nebelmutter besiegen |
| 004 | Tau der Allheilung | SS | 2 | Heilmittel | Heilt jede Wunde, jedes Gift und jeden Fluch | Rosenweils Herzensgeschichte mit dem wahren Ende abschliessen |
| 005 | Sternenkompass | SS | 3 | Werkzeug | Zeigt stets zur nächsten fehlenden Sammelkarte | Die drei Rätsel der Sphinx der Stunden lösen |
| 006 | Wolkenfloss | S | 3 | Fahrzeug | Schwebt über Wasser – Weg über den Silbersee | Quest „Das verlorene Logbuch" (Möwenhafen) |
| 007 | Sturmgreifenfeder | S | 3 | Ausrüstung | Gleiten von Klippen, Tempo +2 | Sturmgreif Kragor besiegen |
| 008 | Sanduhr des Stillstands | S | 4 | Artefakt | Hält 8 s lang alle Monster an | Zeitrennen in den Ruinen von Alt-Kartheim |
| 009 | Tintenkrone | S | 3 | Ausrüstung | Aura-Kontrolle +3, schnellere Aura-Regeneration | Den Tintenkoloss im Gildenturm besiegen |
| 010 | Diamanthenne | S | 4 | Tier | Legt jeden Morgen einen Edelstein (500 Münzen) | Bei der Karawane gegen drei B-Karten tauschen |
| 011 | Tiefenperle | S | 3 | Schatz | Atmen unter Wasser, öffnet die Muschelgrotte | Tiefenmaul, die Hafenkrake, besiegen |
| 012 | Dornenring | S | 3 | Ausrüstung | Wirft 30 % des Nahkampfschadens zurück | Den Dornenbaron besiegen |
| 013 | Glücksmünze | S | 3 | Talisman | Casino-Gewinne ×2, seltene Beute häufiger | Den Hausbankier besiegen |
| 014 | Arenagürtel | A | 3 | Ausrüstung | Stärke +3 | Turnier im Felsenkessel gewinnen |
| 015 | Hafenpass | A | 5 | Schlüssel | Öffnet das Seetor | Quest „Der Wächter am Seetor" |
| 016 | Gildensiegel | A | 4 | Dokument | 30 % Rabatt im Zauberladen, Gildenarchiv | Aufnahmeprüfung der Gilde (Runenhall) |
| 017 | Kletterranke | A | 5 | Werkzeug | Wächst an Klippen empor | Versteckt in den Möwenklippen (Aura-Sinn) |
| 018 | Spiegelschild | A | 4 | Ausrüstung | Wirft Fernangriffe zurück | Lichträtsel im Spiegelsaal (Sandspiegel) |
| 019 | Nebelwolf-Alpha | A | 3 | Monster | Rudelführer des Nebels | Nur in Vollmondnächten im Nebelhain |
| 020 | Brief des Poeten | A | 3 | Kuriosität | Beziehungswert +2 bei jeder Figur | Dem Poeten Aurelian in Rosenweil helfen |
| 021 | Kartografenfeder | A | 5 | Werkzeug | Deckt die ganze Weltkarte auf | Alle sieben Aussichtspunkte besuchen |
| 022 | Moosbarts Herzsamen | A | 4 | Pflanze | Lässt eine Rankenbrücke wachsen | Moosbart, den Grasriesen, besiegen |
| 023 | Glückskatze | A | 3 | Monster | Die flinkste Katze der Insel | Würfelheims Gassen – nur mit Köder „Silberfisch" |
| 024 | Wurzelhydra | A | 3 | Monster | Dreiköpfige Wurzelbestie | Tief im Nebelhain hinter der Wurzelpforte |
| 025 | Aschensiegel | A | 1 | Beweisstück | Schützt das Buch vor Bannzaubern | Varga Aschenherz im Endkampf besiegen |
| 026 | Wanderstiefel | B | 10 | Ausrüstung | Tempo +1, längere Ausweichrolle | Quest „Löchrige Sohlen" (Schuster, Runenhall) |
| 027 | Aurakristall | B | 10 | Verbrauch | Aura sofort voll, 30 s doppelte Regeneration | Kristalladern in der Glimmerhöhle sprengen |
| 028 | Flüsterndes Buch | B | 6 | Kuriosität | Verrät 1× täglich den Fundort einer Karte | Bücherrätsel in der Bibliothek von Runenhall |
| 029 | Gezinkter Würfel | B | 6 | Kuriosität | 1× täglich eine garantierte Sechs | Den Falschspieler in Würfelheim entlarven |
| 030 | Oasenschlüssel | B | 8 | Schlüssel | Öffnet die verschüttete Oase | Die verschüttete Oase freischaufeln |
| 031 | Spieluhr der Erinnerung | B | 6 | Kuriosität | Weckt oder schläfert Wesen ein | Quest „Das Ständchen" (Rosenweil) |
| 032 | Seitenschlüssel | B | 6 | Schlüssel | Öffnet die Tür ohne Schloss | Rätsel im Labyrinth der Leeren Seiten |
| 033 | Trugbild | B | 8 | Monster | Flirrender Wüstengeist | Dünen um Sandspiegel – nur mit Aura-Sinn treffbar |
| 034 | Irrlicht | B | 8 | Monster | Tanzendes Licht | Nebelhain – nur bei gelöschtem Licht angreifbar |
| 035 | Schattenluchs | B | 8 | Monster | Unsichtbarer Lauerer | Nebelhain – Aura-Sinn verrät ihn |
| 036 | Pokal des Glücks | B | 5 | Schatz | 10 min doppelte Münzfunde | Preisladen Würfelheim (5000 Chips) |
| 037 | Wetterfahne | B | 6 | Werkzeug | Ändert das Wetter der Region | Die Windmühlen der Windhalmfelder reparieren |
| 038 | Tintenfass der Wahrheit | C | 12 | Kuriosität | Schaltet geheime Dialoge frei | Den Tintenkobold-Dieb in Runenhall stellen |
| 039 | Leuchtturmlinse | C | 10 | Werkzeug | Lichtkegel, der Verborgenes enthüllt | Leuchtfeuer von Möwenhafen in einer Sturmnacht entzünden |
| 040 | Silberne Spielmarke | C | 12 | Wertgegenstand | 1000 Casino-Chips | Kasimir Glanz aus seinen Spielschulden helfen |
| 041 | Frostblume | C | 12 | Pflanze | 10 min Schutz vor Kälte und Hitze | Dem Eiswächter eine Warme Wolldecke bringen |
| 042 | Forscherfernglas | C | 12 | Werkzeug | Monster und Karten auf der Minikarte | Den verirrten Forscher im Nebelhain finden |
| 043 | Irrlicht im Glas | C | 12 | Lichtquelle | Folgt dir und erhellt Höhlen | Irrlicht-Rätsel im Nebelhain |
| 044 | Rosenquarz-Anhänger | C | 15 | Talisman | LP-Regeneration +1 | Rosenweils Herzensgeschichte (gewöhnliches Ende) |
| 045 | Goldkäfer | C | 15 | Monster | Gepanzerter Wüstenkäfer | Sandspiegel – nur von hinten verwundbar |
| 046 | Moosgolem | C | 15 | Monster | Wandelnder Moosfelsen | Nebelhain – tarnt sich als Felsen |
| 047 | Donnerwidder | C | 15 | Monster | Widder mit Blitzhörnern | Hänge von Hohenkamm |
| 048 | Gipfeladler | C | 15 | Monster | König der Lüfte | Gipfel von Hohenkamm |
| 049 | Seitenfresser | C | 12 | Monster | Frisst Karten aus freien Slots | Labyrinth der Leeren Seiten |
| 050 | Tintenschatten | C | 12 | Monster | Schatten aus verlaufener Tinte | Labyrinth der Leeren Seiten |
| 051 | Kartheimer Siegelstein | C | 10 | Schlüssel | Öffnet die Schatzkammer der Ruinen | Die Statuen von Alt-Kartheim ausrichten |
| 052 | Glyphenwächter | D | 20 | Monster | Steinwächter mit Runen | Rund um Runenhall |
| 053 | Quallenlicht | D | 20 | Monster | Leuchtqualle | Möwenhafen, nur nachts |
| 054 | Würfelmimik | D | 20 | Monster | Schatzkiste mit Zähnen | Umgebung von Würfelheim (Tarnung) |
| 055 | Frostfuchs | D | 20 | Monster | Rudeljäger im Schnee | Hohenkamm |
| 056 | Kaktuskrieger | D | 20 | Monster | Schiesst Stacheln | Wüste um Sandspiegel |
| 057 | Nebelwolf | D | 25 | Monster | Grauer Jäger | Nebelhain (Rudel) |
| 058 | Dornenranke | D | 25 | Monster | Lauernde Ranke | Rosengärten um Rosenweil |
| 059 | Kartensoldat | D | 20 | Monster | Marschierender Papierwächter | Labyrinth der Leeren Seiten |
| 060 | Wüstentau-Moos | D | 20 | Pflanze | Heilt 50 LP und kühlt | Die Wasserdiebe von Sandspiegel überführen |
| 061 | Trainingsgewicht | D | 20 | Ausrüstung | Stärke +1, Tempo −1 | Trainingsprüfungen bei Meisterin Brakka (Hohenkamm) |
| 062 | Tanzschuhe | D | 20 | Ausrüstung | Ausweichrolle 30 % weiter | Beim Rosenfest tanzen |
| 063 | Dietrich | D | 25 | Werkzeug | Öffnet einfache Schlösser | Schwarzhändler in Würfelheim |
| 064 | Quellwasser-Elixier | D | 30 | Heilmittel | Heilt 100 LP | Kräuterladen Runenhall |
| 065 | Karawanenkompass | D | 20 | Werkzeug | Zeigt zur nächsten Oase | Die Karawane sicher nach Sandspiegel geleiten |
| 066 | Wiesenflitzer | E | 30 | Monster | Flinkes Wiesentier | Taufeld – schneller sein und in die Enge treiben |
| 067 | Silberfisch | E | 30 | Köder | Unwiderstehlich für Katzen | Fischer Jorns Angelwette (Möwenhafen) |
| 068 | Felsbock | E | 30 | Monster | Stösst alles um | Pfade von Hohenkamm |
| 069 | Dünenwühler | E | 30 | Monster | Lauert unter dem Sand | Wüste um Sandspiegel |
| 070 | Stachelschwalbe | E | 30 | Monster | Sturzflug-Jägerin | Silberlauf und Windhalmfelder |
| 071 | Glimmerpilz | E | 30 | Lichtquelle | Leuchtet, beim Essen Aura +20 | Versteckte Höhlen im Nebelhain |
| 072 | Uralte Münze | E | 30 | Wertgegenstand | Sammler zahlen 300 Münzen | In den Ruinen ausgraben |
| 073 | Fangnetz | E | 40 | Werkzeug | Fängt flinke kleine Wesen | Krämer in Rosenweil |
| 074 | Auratee | E | 40 | Verbrauch | +50 Aura | Teestube in Runenhall |
| 075 | Enterhaken | E | 30 | Werkzeug | Zieht dich über kleine Abgründe | Hafenladen Möwenhafen |
| 076 | Blattschnapper | F | 40 | Monster | Tarnt sich als Busch | Taufeld |
| 077 | Tintenkobold | F | 40 | Monster | Stiehlt Münzen und flieht | Gassen von Runenhall |
| 078 | Zangenkrabbe | F | 40 | Monster | Nur von hinten verwundbar | Strände um Möwenhafen |
| 079 | Schlammkröte | F | 40 | Monster | Spuckt Schlamm | Ufer des Silberlaufs |
| 080 | Herzfalter | F | 40 | Monster | Falter mit Herzflügeln | Rosenweil – nur mit Fangnetz |
| 081 | Weidenglocke | F | 40 | Werkzeug | Ruft zahme Tiere herbei | Quest „Die verlorene Glocke" (Taufeld) |
| 082 | Schaufel | F | 50 | Werkzeug | Gräbt an markierten Stellen | Krämerin im Taufeld |
| 083 | Bambusangel | F | 50 | Werkzeug | Angeln an Gewässern | Hafenladen Möwenhafen |
| 084 | Laterne | F | 50 | Lichtquelle | Erhellt die Nacht | Krämerin im Taufeld |
| 085 | Rauchkugel | F | 50 | Verbrauch | Sofortige Flucht aus dem Kampf | Läden in allen Städten |
| 086 | Hüpfpilz | G | 60 | Monster | Hüpft fröhlich herum | Taufeld |
| 087 | Papierflatterer | G | 60 | Monster | Schwarm schneidender Blätter | Rund um Runenhall |
| 088 | Jetonratte | G | 60 | Monster | Klaut Chips | Würfelheim |
| 089 | Kieselkrebs | G | 60 | Monster | Ufertier im Rudel | Silberlauf |
| 090 | Warme Wolldecke | G | 60 | Ausrüstung | Schützt vor Kälte | Oma Hilde drei Wollknäuel bringen (Taufeld) |
| 091 | Vierblättriger Klee | G | 60 | Talisman | Glück +1 (bessere Beute) | Versteckt im Taufeld (Aura-Sinn) |
| 092 | Kletterseil | G | 80 | Werkzeug | Für kleine Klippen | Läden in Möwenhafen und Hohenkamm |
| 093 | Wollknäuel | H | 99 | Monster | Friedliches Wollwesen | Taufeld |
| 094 | Klippenmöwe | H | 99 | Monster | Frech und gefrässig | Möwenklippen |
| 095 | Tautropfen-Trank | H | 99 | Heilmittel | Heilt 30 LP | Tutorial bei Lumi, alle Läden |
| 096 | Knusperbrot | H | 99 | Verbrauch | Heilt 15 LP über Zeit | Bäckereien |
| 097 | Glatter Kiesel | H | 99 | Wurfgeschoss | Lenkt Monster ab | An allen Flussufern |
| 098 | Pusteblume | H | 99 | Pflanze | Ein Windstoss trägt dich ein Stück | Wiesen des Taufelds |
| 099 | Mehlsack | H | 99 | Zutat | Tauschware für Bäcker | Windmühlen der Windhalmfelder |

Verteilung: SS 6 · S 8 · A 12 · B 12 · C 14 · D 14 · E 10 · F 10 · G 7 · H 7 = **100**.

## 5. Die 40 Zauberkarten

Zauber liegen in den freien Slots und werden beim Wirken verbraucht. Kauf im Zauberladen von
Runenhall als **Siegelpack** (3 zufällige Zauber, Gacha-Animation), manche nur als
Quest-Belohnung (Q). „20 m" = Nahzauber mit Reichweitenkreis auf der Karte.
„Fern" = wirkt ohne Sichtkontakt, aber nur auf Spieler, denen man schon begegnet ist.

Effektfarben: **Angriff = Rot/Magenta · Abwehr = Cyan · Bewegung = Gelb · Information = Violett**.

| Nr. | Name | Kat. | Rang | Limit | Reichweite | Wirkung |
|---|---|---|---|---|---|---|
| Z01 | Langfinger | Angriff | D | 40 | 20 m | Raubt 1 zufällige Karte aus den freien Slots des Ziels |
| Z02 | Elsternflug | Angriff | B | 20 | Fern | Raubt 1 zufällige Karte aus den freien Slots |
| Z03 | Diebesfaden | Angriff | A | 8 | 20 m | Stiehlt eine gewählte Karte (Nummer) aus den Sammelseiten |
| Z04 | Nachtgriff (Q) | Angriff | S | 3 | Fern | Stiehlt eine gewählte Karte aus den Sammelseiten |
| Z05 | Funkenfrass | Angriff | D | 40 | 20 m | Zerstört 1 zufällige Karte in den freien Slots |
| Z06 | Aschenregen | Angriff | B | 15 | 20 m | Zerstört je 1 freie-Slot-Karte aller Spieler im Kreis |
| Z07 | Tintenfluch (Q) | Angriff | A | 6 | Fern | Zerstört eine gewählte Karte in den Sammelseiten |
| Z08 | Seitenblick | Angriff | E | 50 | 20 m | Zeigt die Sammelseiten des Ziels |
| Z09 | Buchspion | Angriff | C | 25 | Fern | Zeigt das komplette Buch des Ziels |
| Z10 | Wirbelgriff | Angriff | C | 20 | 20 m | Raubt je 1 freie-Slot-Karte von allen Spielern im Kreis |
| Z11 | Kartenbann | Angriff | B | 15 | 20 m | Versiegelt das Buch des Ziels 60 s (kein Zaubern, kein Entfesseln) |
| Z12 | Schlosssprenger | Angriff | C | 20 | 20 m | Hebt alle Schutzzauber des Ziels auf |
| Z13 | Laubschild | Abwehr | E | 60 | selbst | Blockt den nächsten Angriffszauber |
| Z14 | Spiegelblatt | Abwehr | C | 25 | selbst | Wirft den nächsten Angriffszauber auf den Wirker zurück |
| Z15 | Siegelband | Abwehr | C | 25 | selbst | Schützt eine gewählte Karte dauerhaft vor Raub und Zerstörung |
| Z16 | Tresorsiegel (Q) | Abwehr | A | 5 | selbst | Schützt 10 min alle Sammelseiten |
| Z17 | Dornenhülle | Abwehr | B | 15 | selbst | Blockt und zerstört 1 Zauberkarte des Angreifers |
| Z18 | Nebelmantel | Abwehr | D | 40 | selbst | 10 min unauffindbar für Informationszauber |
| Z19 | Bannkreis | Abwehr | B | 12 | 20 m | 30 s scheitern alle Zauber im Kreis |
| Z20 | Gegenlicht | Abwehr | D | 40 | selbst | Blockt den nächsten Informationszauber und verrät den Wirker |
| Z21 | Ankerstein | Abwehr | D | 40 | selbst | 10 min immun gegen fremde Bewegungszauber |
| Z22 | Phönixtinte (Q) | Abwehr | S | 3 | selbst | Stellt die zuletzt geraubte oder zerstörte Karte wieder her |
| Z23 | Stadtsprung | Bewegung | E | 60 | selbst | Teleport in eine besuchte Stadt |
| Z24 | Fährtenflug | Bewegung | D | 40 | Fern | Teleport zu einem begegneten Spieler |
| Z25 | Heimweh | Bewegung | F | 80 | selbst | Rückzug zum Ersten Tor |
| Z26 | Brunnensprung | Bewegung | F | 80 | selbst | Teleport zum zuletzt berührten Stadtbrunnen |
| Z27 | Windwurf | Bewegung | E | 50 | selbst | Teleport an einen zufälligen Ort |
| Z28 | Ruffaden | Bewegung | B | 10 | Fern | Holt einen begegneten Spieler zu dir |
| Z29 | Sturmschleuder | Bewegung | C | 20 | 20 m | Schleudert alle Spieler im Kreis an zufällige Orte |
| Z30 | Gruppensprung (Q) | Bewegung | B | 10 | 20 m | Stadtsprung für dich und alle Verbündeten im Kreis |
| Z31 | Fluchtfunke | Bewegung | D | 40 | selbst | Sicherer Fluchtsprung 50 m weg |
| Z32 | Fingerzeig | Info | E | 60 | – | Wer besitzt Karte X? |
| Z33 | Suchfalke | Info | D | 40 | Fern | Wo ist Spieler Y? (60 s auf der Karte) |
| Z34 | Zählwerk | Info | E | 60 | – | Wie viele Exemplare von Karte Z existieren noch? |
| Z35 | Glockenturm | Info | F | 80 | – | Sammelstand aller begegneten Spieler |
| Z36 | Fundflüstern | Info | C | 20 | – | Hinweis, wo Karte X zu finden ist |
| Z37 | Leuchtspur (Q) | Info | B | 12 | – | 3 min Pfeil zur nächsten herumliegenden Karte |
| Z38 | Zauberlupe | Info | D | 30 | 20 m | Zeigt die Zauberkarten des Ziels |
| Z39 | Echoruf | Info | F | 80 | Fern | Nachricht an einen begegneten Spieler (Handel/Allianz) |
| Z40 | Wirkerspur | Info | E | 50 | – | Zeigt, wer die letzten 3 Zauber auf dich gewirkt hat |

## 6. Monster (35 Typen + 9 Bosse)

Verhalten: **P**atrouille, **F**lucht, **R**udel, **T**arnung, **K** Fernkampf, **S**turmangriff,
**★** Trick-Monster (nicht mit Gewalt zu besiegen).

| Karte | Monster | Region | Verhalten | Besonderheit |
|---|---|---|---|---|
| 093 | Wollknäuel | Taufeld | P | friedlich, rollt bei Gefahr weg |
| 086 | Hüpfpilz | Taufeld | P | hüpft auf dich zu |
| 076 | Blattschnapper | Taufeld | T | wartet als Busch |
| 066 | Wiesenflitzer | Taufeld | F ★ | schneller sein, in eine Ecke treiben |
| 089 | Kieselkrebs | Silberlauf | R | seitwärts im Rudel |
| 079 | Schlammkröte | Silberlauf | K | Schlammspucke verlangsamt |
| 070 | Stachelschwalbe | Windhalmfelder | S | Sturzflug |
| 077 | Tintenkobold | Runenhall | F | klaut Münzen |
| 087 | Papierflatterer | Runenhall | R K | Blattschnitt-Schwarm |
| 052 | Glyphenwächter | Runenhall | P K | Runen-Strahl |
| 094 | Klippenmöwe | Möwenklippen | R S | Sturzflug im Schwarm |
| 078 | Zangenkrabbe | Möwenhafen | P | vorne gepanzert |
| 053 | Quallenlicht | Möwenhafen | K | nur nachts, Elektrokugeln |
| 054 | Würfelmimik | Würfelheim | T | tarnt sich als Kiste |
| 088 | Jetonratte | Würfelheim | R F | klaut Chips |
| 023 | Glückskatze | Würfelheim | F ★ | nur mit Silberfisch-Köder fangbar |
| 068 | Felsbock | Hohenkamm | S | stösst zurück |
| 055 | Frostfuchs | Hohenkamm | R F | flieht, wenn allein |
| 047 | Donnerwidder | Hohenkamm | S | Blitzangriff |
| 048 | Gipfeladler | Hohenkamm | K S | Federhagel |
| 069 | Dünenwühler | Sandspiegel | T | gräbt sich ein |
| 045 | Goldkäfer | Sandspiegel | P | nur von hinten verwundbar |
| 033 | Trugbild | Sandspiegel | T ★ | nur mit Aura-Sinn sichtbar und treffbar |
| 056 | Kaktuskrieger | Sandspiegel | K | Stachelsalven |
| 057 | Nebelwolf | Nebelhain | R | umkreist und flankiert |
| 019 | Nebelwolf-Alpha | Nebelhain | R | nur bei Vollmond |
| 046 | Moosgolem | Nebelhain | T | Felsen-Tarnung |
| 034 | Irrlicht | Nebelhain | K ★ | nur bei gelöschtem Licht angreifbar |
| 035 | Schattenluchs | Nebelhain | T S | unsichtbarer Sprung |
| 024 | Wurzelhydra | Nebelhain | K | Mini-Boss, drei Köpfe |
| 058 | Dornenranke | Rosenweil | T | Hinterhalt |
| 080 | Herzfalter | Rosenweil | F ★ | nur mit Fangnetz |
| 049 | Seitenfresser | Labyrinth | P | frisst bei Treffer freie-Slot-Karten |
| 050 | Tintenschatten | Labyrinth | K | teleportiert |
| 059 | Kartensoldat | Labyrinth | P R | marschiert in Formation |

**Bosse (mit Phasen, Angriffsankündigungen, deutlich grösser als der Spieler):**
Moosbart, der Grasriese · Der Tintenkoloss · Tiefenmaul, die Hafenkrake · Der Hausbankier
(lebender Spielautomat) · Sturmgreif Kragor · Die Sphinx der Stunden (Rätsel + Kampf) ·
Die Nebelmutter · Der Dornenbaron · Der Leere Leser (Endboss) · Story-Endkampf gegen
**Varga Aschenherz**.

## 7. Rivalen (11 KI-Spieler)

| Name | Haltung | Rolle |
|---|---|---|
| Mila Sturmfeder | freundlich | Händlerin, bietet Tausch und Allianz |
| Bruno Kessel | freundlich | Arenakämpfer, gemeinsame Kampf-Quests |
| Frida Funkel | freundlich | Rätselforscherin, teilt Hinweise |
| Juna & Lio Tannwald | freundlich | Geschwister-Duo, Allianz |
| Tjark Wellenbrecher | neutral | Seemann, verkauft Informationen |
| Kasimir Glanz | neutral | Glücksspieler, verschuldet |
| **Varga Aschenherz** | gefährlich | Anführerin der **Aschenhand** |
| Nox | gefährlich | Dieb, setzt Raubzauber ein |
| Vesper | gefährlich | Spionin, Informationszauber |
| Grell | gefährlich | Schläger, Nahkampf |

**Story-Arc „Die Aschenhand":** Im späteren Spielverlauf versiegelt die Aschenhand die Bücher
anderer Spieler mit Bannzaubern und gibt sie nur gegen seltene Karten wieder frei. Die
Spielfigur sammelt Beweise, schmiedet Allianzen und stellt Varga in den Ruinen von
Alt-Kartheim. **Rangliste** in Runenhall: Wer hat die meisten Sammelkarten? Limits gelten
global auch für die KI.

## 8. Story

1. **Intro:** Auf einem Flohmarkt findet die Spielfigur eine graue Konsole – die Lumenbox.
   Beim Einschalten zerfällt der Bildschirm in Pixel und saugt sie hinein.
2. **Ankunft** am Ersten Tor im Taufeld. Lumi erklärt Buch, Karten, Entfessle! und Zauber.
3. **Hauptquest:** alle 100 Sammelkarten finden.
4. **Finale:** Bei 100/100 erscheint Spielleiter Nullpunkt. Man wählt 3 Karten für die echte
   Welt → Abspann → **New Game+** (Level bleibt, Monster stärker, Karten neu).

Dialogsystem mit Portraits, Tippeffekt, Entscheidungen und Quest-Log.

## 9. Stilguide Grafik

**Grundlook:** knackiges 16-Bit-Retro-Pixel-Art, klare Formen, gesättigte Farben, viel Wucht.

- **Auflösung:** logisch 480×270, Tiles 16×16, Spielfigur ≈ 16×24 sichtbar in einem
  24×32-Frame, Bosse 48×48 bis 96×96.
- **Palette:** 42 Farben in Rampen (siehe `src/gfx/palette.ts`). Jede Region nutzt eine
  Teilmenge als Farbschema.
- **Umrisse:** 1 px dunkler Aussenumriss (`#0d0a14`) um jede Figur und jedes Objekt.
  Innenlinien in der dunkelsten Stufe der jeweiligen Fläche, nicht schwarz.
- **Schattierung:** Cel-Shading mit 2–3 Stufen pro Fläche (Schatten · Grundton · Licht),
  Licht immer von oben links. Glanzpunkte sparsam (1 px).
- **Proportionen:** Chibi – Kopf ≈ 45 % der Figurenhöhe, grosse Augen, kurze Beine.
- **Animation:** Idle-Wippen (1 px, 2 Frames), Laufzyklus 4 Frames, Angriff mit
  Antizipation (Squash) → Schlag (Stretch) → Nachschwung. Treffer: 1 Frame weiss,
  Rückstoss, Hit-Stop 50–90 ms bei starken Treffern.
- **Effekte:** dick, bunt, 2–4 Frames, additiv leuchtend. Grosse Aufprall-Blitze, Funken,
  Energiebögen. Farben pro Zauberkategorie (Rot/Magenta, Cyan, Gelb, Violett). Kurzer
  Bildschirm-Flash und Screen-Shake bei starken Treffern (abschaltbar).
- **Schadenszahlen:** eigene dicke Ziffern mit Umriss, poppen mit Bounce aus dem Treffer;
  kritische Treffer grösser, gelb-orange, mit Sternblitz.
- **Bosse:** deutlich grösser, Angriffe werden 0,6–1 s vorher angekündigt (Aufleuchten,
  rote Warnflächen).
- **Atmosphäre:** warmes Licht – Rastfeuer, Laternen, Glühwürmchen, Glüh-Effekte;
  Tag/Nacht-Overlay; Wetter (Regen, Nebel, Sand).
- **UI:** dicke, abgerundete Pixel-Rahmen mit dunklem Umriss und Innenschatten, grosse gut
  lesbare Pixel-Schrift (eigene Glyphen inkl. Umlaute), Karten farbcodiert nach Rang plus
  Rang-Buchstabe und Symbol.

## 10. Technik (Kurzüberblick)

- Phaser 3 + TypeScript + Vite, PWA (offline), Deploy via GitHub Pages.
- Rendering: logisch 480×270, gerendert mit ganzzahligem Faktor r (Kamera-Zoom) und
  ganzzahliger Anzeige-Skalierung in Gerätepixeln → pixelgenau, Letterboxing, Safe-Area.
- Welt: Datenarrays + Fenster-Tilemap (nur sichtbarer Ausschnitt wird befüllt),
  Objekt-Streaming mit Pooling, eigene Kollision auf 8-px-Raster.
- Grafiken werden beim Start per Code erzeugt (`src/gfx`). Jede Textur kann durch eine PNG in
  `public/gfx/` ersetzt werden (Layout siehe `src/gfx/AssetManifest.ts`).
- Inhalte datengetrieben in `src/data/`.
