# Sensen-Stickman für Pivot Animator

Nachgebaut nach dem TikTok-Screenshot: dunkelroter, dicker Stickman mit schwarzer
Kurzhaarfrisur, grauem Sichel-Umhang und grosser schwarzer Sense mit verziertem Kopf.

Neu erzeugen: `python pivot_figure/make_figure.py` (braucht `pycairo`).

## Dateien (`out/`, alle PNG mit transparentem Hintergrund)

| Datei | Wofür |
|---|---|
| `figur_pose_wie_bild.png` | ganze Figur in der Pose aus dem Screenshot |
| `figur_stehend.png` | ganze Figur stehend (gut als Vorlage zum Nachbauen) |
| `*_vorschau.png` | dieselben Figuren auf dem grauen Video-Hintergrund |
| `bauplan.png` | Segmente und Gelenke nummeriert |
| `teil_kopf.png` | Kopf mit Haaren (Sprite) |
| `teil_torso.png`, `teil_glied.png` | Torso / ein Arm- oder Beinglied (Sprite, falls du keine Linien willst) |
| `teil_umhang.png` | Umhang (Sprite, Befestigung oben rechts = Schulter) |
| `teil_sense.png` | Sense, Klinge nach links. **Der Griffpunkt (Hand) liegt genau in der Bildmitte** – wenn Pivot ein Bild um seine Mitte dreht, dreht sich die Sense also um die Hand. |

## Farben

| Teil | Hex |
|---|---|
| Körper (Linien + Kopf) | `#6E0E12` |
| Haare | `#050205` |
| Sense | `#141417` |
| Umhang | Verlauf `#807F80` (oben) → `#3A3737` (unten) |
| Hintergrund im Video | `#C5C3C5` |

## Körper als echte Pivot-Segmente (empfohlen)

Den Körper am besten mit normalen Linien-Segmenten bauen, dann bleibt er voll animierbar.
Die Masse beziehen sich auf einen Kopfdurchmesser von 70. In Pivot kannst du alles
gleichmässig skalieren; als Startwert passt meist **Faktor 0,5** (Spalte rechts).

| Nr. (siehe `bauplan.png`) | Segment | hängt an | Länge | Dicke | Pivot (×0,5) Länge / Dicke |
|---|---|---|---|---|---|
| 1 | Torso | Hüfte (Hauptgelenk) | 82 | 38 | 41 / 19 |
| 2 | Kopf (Kreis, gefüllt) | Ende Torso | Ø 70 (+ Hals 10) | gefüllt | Ø 35 |
| 3 / 5 | Oberarm vorne / hinten | 90 % der Torsohöhe | 52 | 31 | 26 / 15 |
| 4 / 6 | Unterarm vorne / hinten | Ellbogen | 48 | 31 | 24 / 15 |
| 7 / 9 | Oberschenkel vorne / hinten | Hüfte | 60 | 31 | 30 / 15 |
| 8 / 10 | Schienbein vorne / hinten | Knie | 58 | 31 | 29 / 15 |

Wichtig für den Look: Alle Linien gleiche Farbe `#6E0E12`, sehr dick (Dicke ≈ 45 % des
Kopfdurchmessers), Torso noch etwas dicker. Die Linien in Pivot haben runde Enden,
dadurch gehen die Gelenke nahtlos ineinander über – genau wie im Video.

Haare, Umhang und Sense lassen sich mit Linien nicht sauber nachbauen. Dafür die
Bilder `teil_kopf.png`, `teil_umhang.png` und `teil_sense.png` als Sprites/Bilder
verwenden. Pivot 5 unterstützt mehrere Sprites pro Figur; in älteren Versionen kannst
du die Sense als eigenes Sprite laden und in jedem Frame an die Hand setzen.

Hinweis: Ich konnte die Pivot-Hilfeseiten aus dieser Umgebung nicht öffnen. Die genauen
Menünamen in deiner Pivot-Version können deshalb abweichen.
