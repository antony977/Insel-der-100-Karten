# Stickfight – Dual-Scythe Stickman Animation

Rendert ein 2D-Stickman-Kampfvideo (1080x1920, 60 fps, ~15 s) mit pycairo + ffmpeg.

```bash
pip install pycairo            # ffmpeg muss installiert sein
python render.py --preview     # 3 s @ 30 fps -> out/preview.mp4 + Einzelbilder
python render.py               # volles Video  -> out/stickfight.mp4
python render.py --stills 1.2 7.0 11.6   # nur PNGs zu diesen Zeitpunkten
```

## Aufbau (`stickfight/`)

| Datei | Inhalt |
|---|---|
| `config.py` | Auflösung, FPS, Streifen-Position, Farben, Kamera-Zoom |
| `rig.py` | Skelett (Kopf, Hals, Torso, Schultern, Ellbogen, Hände, Hüfte, Knie, Füsse), Vorwärtskinematik, Zeichnen |
| `easing.py` | Easing-Kurven (ease-in/out, snap, back …) |
| `anim.py` | `Key`, `Hit`, `Throw`, `MoveDef`, Keyframe-Interpolation |
| `moves.py` | **Move-Bibliothek** des Helden (Kreuzschnitt, Wirbel, Sprung-Schnitt, Bumerang, Einhaken, Salto, …) |
| `weapons.py` | **Waffen** (`Scythe`); Geometrie in lokalen Koordinaten, hängt an der Hand und dreht mit |
| `hero.py` | Zeitleiste des Helden (Moves aneinandergereiht, auswertbar zu jeder Zeit) |
| `enemy.py` | Gegner: reinlaufen, warten/angreifen, eingehakt werden |
| `effects.py` | Blut + Bodenflecken, zerschnittene Körperteile (Physik), Smear-Trails, Flash, Dust, Shockwave, Kamera-Shake |
| `choreo.py` | Choreografie-Builder (platziert Gegner automatisch passend zum Treffer) + `TimeWarp` (Hit-Stop, Zeitlupe) |
| `world.py` | Simulation (Partikel, Teile, Schal) und Zeichnen der Szene |
| `scene.py` | **Der eigentliche Ablauf der 15 s** |
| `overlays.py` | Ebenen über dem ganzen Hochformat – hier kommt später Text hin (`TextOverlay`) |
| `video.py` | Frame-Rendering (Letterbox) und MP4-Export |

## Erweitern

**Neuer Move** – in `moves.py`:
```python
@move
def spin_kick(dist=150):
    k = [Key(0.12, dict(torso=170, lF1=-40), "inout_cubic"),
         Key(0.25, dict(lF1=95, lF2=90), "snap"),          # "snap" = Schlag, zeichnet Smear
         Key(0.5, dict(STANCE), "out_cubic")]
    hits = [Hit(0.2, 0, "damage", 1, dist, dict(type="fly", vel=(500, -500), spin=800), strong=True)]
    return MoveDef("spin_kick", k, 0.5, hits)
```
und in `scene.py`: `c.move("spin_kick", F, [E()])`. Der Gegner wird automatisch so losgeschickt,
dass er zum Treffer-Zeitpunkt an der richtigen Stelle steht.

**Neue Waffe** – Unterklasse von `Weapon` in `weapons.py` (`shape()` + `trail_local()`),
in `WEAPONS` eintragen, dann `Choreo(weapon="name")`.

**Text** – in `render.py` dem `Renderer` Overlays mitgeben:
```python
from stickfight.overlays import TextOverlay
r = Renderer(choreo, fps=fps, overlays=[TextOverlay("Me if I had to choose a weapon", y=640)])
```

Reaktionen der Gegner: `split` (Schnitt entlang `cuts`-Winkeln), `fly`, `behead`, `fall`.
