#!/usr/bin/env python3
"""Katana sprites for Pivot Animator (same style and scale as make_figure.py).

    python pivot_figure/make_katana.py      -> pivot_figure/out/katana_*.png

Local frame: blade points up (-y), handle down (+y), the cutting edge is on the
left (-x), the blade curves slightly towards the spine (+x). The front hand
(grip point) sits just below the guard and is exactly the image centre.
"""
import math

import cairo

import make_figure as mf

BLADE = 180       # habaki -> tip (figure units; head diameter = 70)
HANDLE = 64       # guard -> end of the pommel
GRIP = 16         # hand position below the guard
SORI = 10.0       # curvature: sideways offset of the tip
BW = 13.0         # blade width at the base (bold, to match the chunky figure)

SILVER_EDGE = (0.93, 0.94, 0.96)
SILVER_BACK = (0.58, 0.61, 0.66)
GOLD = (0.78, 0.62, 0.25)
BLACK = (0.06, 0.06, 0.07)
WRAP = mf.RED


def _blade_outline():
    """Spine and edge points from the base (y=0) to the tip (y=-BLADE)."""
    spine, edge = [], []
    n = 50
    kissaki = 0.86          # where the angled tip starts
    for i in range(n + 1):
        t = i / n
        y = -BLADE * t
        cx = SORI * t * t
        w = BW * (1 - 0.22 * t)
        spine.append(complex(cx + w * 0.5, y))
        if t <= kissaki:
            edge.append(complex(cx - w * 0.5, y))
    tip = complex(SORI + BW * 0.39, -BLADE - 2)
    # kissaki: the edge sweeps up in a curve to the tip
    e0 = edge[-1]
    for i in range(1, 9):
        u = i / 8
        edge.append(e0 + (tip - e0) * u + complex(-2.2 * math.sin(math.pi * u), 0))
    spine[-1] = tip
    return spine, edge


def _fill(c, pts, color=None, source=None):
    c.move_to(pts[0].real, pts[0].imag)
    for q in pts[1:]:
        c.line_to(q.real, q.imag)
    c.close_path()
    if source is not None:
        c.set_source(source)
    else:
        c.set_source_rgb(*color)
    c.fill()


def katana_local(c, style="classic"):
    """Draws the katana with the guard at (0, 0)."""
    black = style == "black"
    spine, edge = _blade_outline()
    blade = spine + edge[::-1]
    if black:
        _fill(c, blade, BLACK)
        c.set_source_rgba(0.75, 0.76, 0.8, 0.9)        # thin bright edge
        c.set_line_width(1.6)
    else:
        g = cairo.LinearGradient(-BW, 0, BW, 0)
        g.add_color_stop_rgb(0.0, *SILVER_EDGE)
        g.add_color_stop_rgb(0.55, *SILVER_EDGE)
        g.add_color_stop_rgb(1.0, *SILVER_BACK)
        _fill(c, blade, source=g)
        # hamon: wavy temper line along the edge
        c.set_source_rgba(1, 1, 1, 0.95)
        c.set_line_width(1.0)
        for i in range(0, 45):
            t = i / 50
            y = -BLADE * t
            x = SORI * t * t - BW * (1 - 0.22 * t) * 0.5 + 2.2 + 0.8 * math.sin(t * 60)
            (c.move_to if i == 0 else c.line_to)(x, y)
        c.stroke()
        # shinogi line (ridge) and spine shading
        c.set_source_rgba(0.35, 0.37, 0.42, 0.8)
        c.set_line_width(0.7)
        for i in range(0, 44):
            t = i / 50
            x = SORI * t * t + BW * (1 - 0.22 * t) * 0.18
            (c.move_to if i == 0 else c.line_to)(x, -BLADE * t)
        c.stroke()
        c.set_source_rgba(0.2, 0.22, 0.26, 0.9)
        c.set_line_width(0.8)
    # outline along the cutting edge
    c.move_to(edge[0].real, edge[0].imag)
    for q in edge[1:]:
        c.line_to(q.real, q.imag)
    c.stroke()
    # habaki (collar) + seppa
    _fill(c, [complex(-BW * 0.6, 0), complex(BW * 0.65, 0), complex(BW * 0.6, -6), complex(-BW * 0.55, -6)],
          BLACK if black else GOLD)
    # tsuba (guard), seen from the side
    _fill(c, [complex(-18, 0), complex(18, 0), complex(18, 6.5), complex(-18, 6.5)], BLACK)
    if not black:
        c.set_source_rgb(*GOLD)
        c.set_line_width(1.0)
        c.rectangle(-18, 0, 36, 6.5)
        c.stroke()
    # tsuka (handle), wrapped
    top, bot = 6.5, HANDLE
    hw = 6.8
    _fill(c, [complex(-hw, top), complex(hw, top), complex(hw - 0.4, bot - 4), complex(-hw + 0.4, bot - 4)],
          BLACK if black else WRAP)
    if not black:
        # hishigata: black diamonds left between the crossing wraps
        c.set_source_rgb(*BLACK)
        n = 6
        step = (bot - 4 - top - 2) / n
        for i in range(n):
            yc = top + 1 + step * (i + 0.5)
            _fill(c, [complex(0, yc - step * 0.32), complex(hw * 0.55, yc), complex(0, yc + step * 0.32),
                      complex(-hw * 0.55, yc)], BLACK)
        c.set_source_rgba(0, 0, 0, 0.55)
        c.set_line_width(0.6)
        for i in range(n + 1):
            yc = top + 1 + step * i
            c.move_to(-hw, yc - step * 0.25)
            c.line_to(hw, yc + step * 0.25)
            c.move_to(hw, yc - step * 0.25)
            c.line_to(-hw, yc + step * 0.25)
        c.stroke()
    # kashira (pommel cap)
    _fill(c, [complex(-hw - 0.3, bot - 4), complex(hw + 0.3, bot - 4), complex(hw - 0.5, bot),
              complex(-hw + 0.5, bot)], BLACK)
    if not black:
        c.set_source_rgb(*GOLD)
        c.set_line_width(0.7)
        c.move_to(-hw, bot - 4)
        c.line_to(hw, bot - 4)
        c.stroke()


def saya_local(c):
    """Black lacquered scabbard with a red cord; mouth (koiguchi) at (0, 0)."""
    L = BLADE + 6
    w = BW + 3.5
    pts_r, pts_l = [], []
    for i in range(41):
        t = i / 40
        cx = SORI * t * t
        pts_r.append(complex(cx + w / 2, -L * t))
        pts_l.append(complex(cx - w / 2, -L * t))
    end = complex(SORI, -L - 3)
    _fill(c, pts_r + [end] + pts_l[::-1], BLACK)
    c.set_source_rgba(1, 1, 1, 0.25)                  # lacquer highlight
    c.set_line_width(1.0)
    for i, q in enumerate(pts_r[2:-3]):
        (c.move_to if i == 0 else c.line_to)(q.real - 2.2, q.imag)
    c.stroke()
    _fill(c, [complex(-w / 2 - 0.5, 0), complex(w / 2 + 0.5, 0), complex(w / 2 + 0.5, -5), complex(-w / 2 - 0.5, -5)], GOLD)
    # sageo (cord) wrapped around the kurikata
    c.set_source_rgb(*mf.RED)
    c.set_line_width(2.2)
    c.set_line_cap(cairo.LINE_CAP_ROUND)
    c.move_to(-w / 2, -16)
    c.line_to(w / 2, -20)
    c.move_to(-w / 2, -21)
    c.line_to(w / 2, -25)
    c.move_to(w / 2, -22)
    c.curve_to(w / 2 + 14, -10, w / 2 + 6, 12, w / 2 + 16, 30)
    c.stroke()


def draw_katana(c, grip, angle_deg, style="classic", facing=1):
    """Place the katana with the hand at `grip`; angle 0 = blade straight up, + = forward."""
    c.save()
    c.translate(grip.real, grip.imag)
    c.rotate(math.radians(angle_deg))
    c.scale(facing, 1)
    c.translate(0, -GRIP)          # hand is GRIP below the guard
    katana_local(c, style)
    c.restore()


def main():
    S = mf.S
    # sprites: grip point in the image centre
    half = BLADE + GRIP + 12      # room for the tip above the grip point
    for style in ("classic", "black"):
        s, c = mf.surface(60, 2 * half)
        c.translate(30, half)
        c.translate(0, -GRIP)
        katana_local(c, style)
        mf.save(s, "katana_%s.png" % ("klassisch" if style == "classic" else "schwarz"))
    s, c = mf.surface(70, BLADE + 50)
    c.translate(26, BLADE + 18)
    saya_local(c)
    mf.save(s, "katana_scheide.png")

    # previews: the scythe stickman holding the katana
    for style, name in (("classic", "katana_vorschau.png"), ("black", "katana_schwarz_vorschau.png")):
        j = mf.stand_pose(complex(240, 300))
        s, c = mf.surface(480, 440)
        mf.draw_figure(c, j, cape_drop=20, scythe=False)
        draw_katana(c, j["handF"], 28, style)
        mf.draw_line(c, [j["handF"], j["elbowF"], j["shoulder"]])
        fig = s
        s2, c2 = mf.surface(480, 440)
        c2.set_source_rgb(*mf.BG)
        c2.paint()
        c2.identity_matrix()
        c2.set_source_surface(fig, 0, 0)
        c2.paint()
        # big detail view of the sword on the right
        c2.scale(S, S)
        c2.translate(425, 240)
        c2.rotate(math.radians(12))
        katana_local(c2, style)
        mf.save(s2, name)
    print("written to", mf.OUT)


if __name__ == "__main__":
    main()
