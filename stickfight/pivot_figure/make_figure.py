#!/usr/bin/env python3
"""Draws the red scythe stickman (reference: TikTok screenshot) as transparent
PNG parts for Pivot Animator, plus full-figure previews.

    python pivot_figure/make_figure.py      -> pivot_figure/out/*.png

All measurements are in "figure units" (head diameter = 70); S scales them to pixels.
"""
import math
import os

import cairo

S = 3.0                                   # pixels per figure unit
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

RED = (0x6E / 255, 0x0E / 255, 0x12 / 255)       # body
HAIR = (0.02, 0.01, 0.02)
STEEL = (0.08, 0.08, 0.09)                       # scythe
CAPE_LIGHT = (0x80 / 255, 0x7F / 255, 0x80 / 255)
CAPE_DARK = (0x3A / 255, 0x37 / 255, 0x37 / 255)
BG = (0xC5 / 255, 0xC3 / 255, 0xC5 / 255)

# Body proportions (figure units). Line thickness = Pivot segment thickness.
T = 31            # limb thickness
T_TORSO = 38      # torso is a bit chunkier
HEAD_R = 35
TORSO = 82        # hip -> neck
NECK = 10
UPPER, FORE = 52, 48
THIGH, SHIN = 60, 58

# Scythe (figure units, butt at 0,0, handle pointing up = -y)
HANDLE = 262
GRIP = 18         # front hand position measured from the butt (held near the end)


def dirv(a):
    """0 = down, 90 = forward (right), 180 = up."""
    r = math.radians(a)
    return complex(math.sin(r), math.cos(r))


def surface(w, h):
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, int(w * S), int(h * S))
    c = cairo.Context(s)
    c.scale(S, S)
    c.set_line_cap(cairo.LINE_CAP_ROUND)
    c.set_line_join(cairo.LINE_JOIN_ROUND)
    return s, c


# ---------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------
def draw_head(c, p, facing=1):
    """Dark red ball with a black short haircut (flat top, slightly raised at the back)."""
    x, y = p.real, p.imag
    c.set_source_rgb(*RED)
    c.arc(x, y, HEAD_R, 0, 2 * math.pi)
    c.fill()
    # hair: from the back (slightly below centre) over the top to the front hairline
    c.save()
    c.translate(x, y)
    c.scale(facing, 1)
    c.new_path()
    pts = []
    for i in range(41):
        a = math.radians(168 + (338 - 168) * i / 40)       # cairo angles, y down
        bump = 1.07 + 0.05 * math.sin(math.pi * min(1.0, i / 24))  # fuller at the back/top
        pts.append(complex(math.cos(a), math.sin(a)) * HEAD_R * bump)
    c.move_to(pts[0].real, pts[0].imag)
    for q in pts[1:]:
        c.line_to(q.real, q.imag)
    # hairline: front point -> slightly concave back to the nape
    c.curve_to(HEAD_R * 0.55, -HEAD_R * 0.18, -HEAD_R * 0.25, -HEAD_R * 0.05, pts[0].real, pts[0].imag)
    c.close_path()
    c.set_source_rgb(*HAIR)
    c.fill()
    c.restore()


def draw_line(c, pts, width=T, color=RED):
    c.set_source_rgb(*color)
    c.set_line_width(width)
    c.move_to(pts[0].real, pts[0].imag)
    for q in pts[1:]:
        c.line_to(q.real, q.imag)
    c.stroke()


def cape_path(c, hip, facing=1, drop=0.0):
    """Grey crescent cape (like a second blade): the pointed top tip flies up behind
    the head, the convex side faces backwards, the bottom tip ends under the body.
    Offsets are relative to the hip; `drop` lowers the bottom tip (standing poses)."""
    f = facing

    def P(dx, dy):
        return hip + complex(f * dx, dy)
    top, bottom, shoulder = P(-123, -130), P(-40, 86 + drop), P(2, -55)
    o1, o2 = P(-132, -40), P(-110, 70 + drop)          # outer edge, bulges backwards
    b1, b2 = P(-15, 60 + drop * 0.6), P(-10, -10)      # down the back of the body
    i1, i2 = P(-50, -62), P(-92, -78)                  # sagging edge back up to the tip
    c.move_to(top.real, top.imag)
    c.curve_to(o1.real, o1.imag, o2.real, o2.imag, bottom.real, bottom.imag)
    c.curve_to(b1.real, b1.imag, b2.real, b2.imag, shoulder.real, shoulder.imag)
    c.curve_to(i1.real, i1.imag, i2.real, i2.imag, top.real, top.imag)
    c.close_path()
    g = cairo.LinearGradient(top.real - f * 30, top.imag, bottom.real + f * 20, bottom.imag)
    g.add_color_stop_rgb(0.0, *CAPE_LIGHT)
    g.add_color_stop_rgb(0.45, *CAPE_DARK)
    g.add_color_stop_rgb(1.0, *CAPE_DARK)
    c.set_source(g)
    c.fill()


def _bez(p0, p1, p2, p3, t):
    m = 1 - t
    return m ** 3 * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t ** 3 * p3


def _poly(c, pts):
    c.move_to(pts[0].real, pts[0].imag)
    for q in pts[1:]:
        c.line_to(q.real, q.imag)
    c.close_path()
    c.fill()


def scythe_local(c):
    """Scythe in its own frame: butt at (0, 0), handle up along -y, head at (0, -HANDLE),
    blade sweeping to -x (backwards) and curling down at the tip."""
    c.set_source_rgb(*STEEL)
    c.set_line_width(6.5)
    c.move_to(0, 0)
    c.line_to(0, -HANDLE + 52)
    c.line_to(10, -HANDLE + 38)         # zig-zag under the head
    c.line_to(-5, -HANDLE + 24)
    c.line_to(0, -HANDLE + 8)
    c.stroke()
    _poly(c, [complex(-3.5, -2), complex(4, 18), complex(3.5, -2)])          # butt spike
    H = complex(0, -HANDLE)
    # blade: broad at the head, long sweeping arc, sharp tip curling down
    p0, p1, p2, p3 = H + complex(-14, -4), H + complex(-120, -40), H + complex(-238, -30), H + complex(-258, 82)
    n = 70
    spine, edge = [], []
    for i in range(n + 1):
        t = i / n
        q = _bez(p0, p1, p2, p3, t)
        d = _bez(p0, p1, p2, p3, min(t + 1e-3, 1)) - _bez(p0, p1, p2, p3, max(t - 1e-3, 0))
        d /= abs(d)
        nrm = d * -1j                    # points to the concave (lower/inner) side
        w = 42 * (1 - t) ** 0.8 + 1.0
        spine.append(q - nrm * w * 0.3)
        edge.append(q + nrm * w * 0.7)
    c.move_to(spine[0].real, spine[0].imag)
    for q in spine[1:]:
        c.line_to(q.real, q.imag)
    for q in reversed(edge):
        c.line_to(q.real, q.imag)
    c.close_path()
    c.fill()
    # ornate head (after the reference): tall spike, diagonal spike over the blade,
    # barbs under the blade root, jagged crown in front
    _poly(c, [H + complex(-7, 4), H + complex(0, -58), H + complex(7, 4)])
    _poly(c, [H + complex(-30, -14), H + complex(-62, -46), H + complex(-40, -40), H + complex(-18, -14)])
    _poly(c, [H + complex(-30, 20), H + complex(-50, 44), H + complex(-38, 16)])
    _poly(c, [H + complex(-12, 22), H + complex(-20, 40), H + complex(-4, 22)])
    crown = [complex(-6, -12), complex(10, -26), complex(14, -14), complex(26, -30), complex(28, -12),
             complex(40, -10), complex(34, 0), complex(46, 8), complex(34, 12), complex(38, 26),
             complex(24, 20), complex(18, 34), complex(8, 18), complex(-6, 16)]
    _poly(c, [H + q for q in crown])
    c.arc(H.real, H.imag, 12, 0, 2 * math.pi)
    c.fill()
    c.set_operator(cairo.OPERATOR_CLEAR)      # little holes like in the reference
    for hx, hy in ((-8, 9), (13, 0), (24, 12)):
        c.arc(H.real + hx, H.imag + hy, 3.4, 0, 2 * math.pi)
        c.fill()
    c.set_operator(cairo.OPERATOR_OVER)


def draw_scythe(c, grip, top, facing=1):
    """Place the scythe so the hand sits at GRIP units from the butt and the
    handle points from `grip` towards `top`."""
    d = top - grip
    ang = math.atan2(d.real, -d.imag)          # rotation from straight up
    c.save()
    c.translate(grip.real, grip.imag)
    c.rotate(ang)
    c.scale(facing, 1)
    c.translate(0, GRIP)
    scythe_local(c)
    c.restore()


# ---------------------------------------------------------------------------
# Whole figure
# ---------------------------------------------------------------------------
# Reference pose traced from the screenshot (figure units, facing right)
REF = dict(head=complex(300, 226), neck=complex(287, 262), shoulder=complex(285, 268), hip=complex(268, 332),
           kneeB=complex(196, 370), footB=complex(108, 408), kneeF=complex(326, 344), footF=complex(344, 404),
           elbowF=complex(258, 300), handF=complex(296, 312), elbowB=complex(270, 250), handB=complex(250, 236),
           scythe_top=complex(232, 70))


def stand_pose(hip):
    """Neutral standing pose for building the figure in Pivot."""
    def at(p, a, L):
        return p + dirv(a) * L
    neck = at(hip, 180, TORSO)
    sh = at(hip, 180, TORSO * 0.9)
    j = dict(hip=hip, neck=neck, shoulder=sh, head=at(neck, 180, NECK + HEAD_R))
    j["elbowF"] = at(sh, 25, UPPER)
    j["handF"] = at(j["elbowF"], 115, FORE)
    j["elbowB"] = at(sh, -22, UPPER)
    j["handB"] = at(j["elbowB"], -8, FORE)
    j["kneeF"] = at(hip, 14, THIGH)
    j["footF"] = at(j["kneeF"], 2, SHIN)
    j["kneeB"] = at(hip, -14, THIGH)
    j["footB"] = at(j["kneeB"], -2, SHIN)
    j["scythe_top"] = j["handF"] + complex(10, -HANDLE + GRIP)
    return j


def draw_figure(c, j, facing=1, scythe=True, cape_drop=0.0):
    cape_path(c, j["hip"], facing, cape_drop)
    draw_line(c, [j["footB"], j["kneeB"], j["hip"]])
    draw_line(c, [j["handB"], j["elbowB"], j["shoulder"]])
    draw_line(c, [j["hip"], j["neck"]], width=T_TORSO)
    draw_head(c, j["head"], facing)
    draw_line(c, [j["footF"], j["kneeF"], j["hip"]])
    if scythe:
        draw_scythe(c, j["handF"], j["scythe_top"], facing)
    draw_line(c, [j["handF"], j["elbowF"], j["shoulder"]])


def save(surf, name):
    path = os.path.join(OUT, name)
    surf.write_to_png(path)
    return path


def preview(fig, name, ground):
    s2, c2 = surface(fig.get_width() / S, fig.get_height() / S)
    c2.set_source_rgb(*BG)
    c2.paint()
    c2.save()
    c2.translate(fig.get_width() / S / 2, ground)
    c2.scale(1, 0.1)
    c2.arc(0, 0, 150, 0, 2 * math.pi)
    c2.restore()
    c2.set_source_rgba(0, 0, 0, 0.16)
    c2.fill()
    c2.identity_matrix()
    c2.set_source_surface(fig, 0, 0)
    c2.paint()
    save(s2, name)


def main():
    os.makedirs(OUT, exist_ok=True)
    # full figures (transparent) + previews on the video's grey background
    off = complex(30, 10)
    j = {k: v + off for k, v in REF.items()}
    s, c = surface(430, 440)
    draw_figure(c, j)
    save(s, "figur_pose_wie_bild.png")
    preview(s, "figur_pose_wie_bild_vorschau.png", 418)

    j = stand_pose(complex(320, 300))
    s, c = surface(480, 440)
    draw_figure(c, j, cape_drop=20)
    save(s, "figur_stehend.png")
    preview(s, "figur_stehend_vorschau.png", 425)

    # building plan: standing figure with numbered segments and joints
    s, c = surface(480, 440)
    c.set_source_rgb(1, 1, 1)
    c.paint()
    draw_figure(c, j, cape_drop=20, scythe=False)
    c.set_source_rgba(1, 1, 1, 0.55)
    c.paint()
    segs = [("1 Torso", "hip", "neck"), ("2 Hals+Kopf", "neck", "head"),
            ("3 Oberarm v.", "shoulder", "elbowF"), ("4 Unterarm v.", "elbowF", "handF"),
            ("5 Oberarm h.", "shoulder", "elbowB"), ("6 Unterarm h.", "elbowB", "handB"),
            ("7 Oberschenkel v.", "hip", "kneeF"), ("8 Schienbein v.", "kneeF", "footF"),
            ("9 Oberschenkel h.", "hip", "kneeB"), ("10 Schienbein h.", "kneeB", "footB")]
    c.set_line_width(2)
    c.select_font_face("Sans", 0, 1)
    c.set_font_size(11)
    for i, (label, a, b) in enumerate(segs):
        pa, pb = j[a], j[b]
        c.set_source_rgb(0.1, 0.3, 0.9)
        c.move_to(pa.real, pa.imag)
        c.line_to(pb.real, pb.imag)
        c.stroke()
        m = pa + (pb - pa) * (0.88 if i == 0 else 0.5)    # torso label high, clear of the arm labels
        side = 1 if ("v." in label or i < 2) else -1
        tx = m.real + side * (40 if i == 0 else 26) + (0 if side > 0 else -len(label) * 6.2)
        c.move_to(m.real, m.imag)
        c.line_to(tx + (0 if side > 0 else len(label) * 6.2), m.imag - 4)
        c.stroke()
        c.set_source_rgb(0, 0, 0)
        c.move_to(tx, m.imag)
        c.show_text(label)
    c.set_source_rgb(0.9, 0.1, 0.1)
    for k in ("hip", "neck", "shoulder", "elbowF", "handF", "elbowB", "handB", "kneeF", "footF", "kneeB", "footB"):
        c.arc(j[k].real, j[k].imag, 4, 0, 2 * math.pi)
        c.fill()
    c.set_source_rgb(0, 0, 0)
    c.set_font_size(13)
    c.move_to(12, 22)
    c.show_text("Hauptgelenk (Griff in Pivot) = Huefte. Rote Punkte = Gelenke.")
    save(s, "bauplan.png")

    # single parts for Pivot sprites -------------------------------------------
    s, c = surface(92, 92)
    draw_head(c, complex(46, 48))
    save(s, "teil_kopf.png")

    pad = T / 2 + 4
    s, c = surface(2 * pad, UPPER + 2 * pad)
    draw_line(c, [complex(pad, pad), complex(pad, pad + UPPER)])
    save(s, "teil_glied.png")

    pad_t = T_TORSO / 2 + 4
    s, c = surface(2 * pad_t, TORSO + 2 * pad_t)
    draw_line(c, [complex(pad_t, pad_t), complex(pad_t, pad_t + TORSO)], width=T_TORSO)
    save(s, "teil_torso.png")

    s, c = surface(190, 250)
    cape_path(c, complex(160, 140))
    save(s, "teil_umhang.png")

    # scythe upright, blade to the left; the grip point is exactly the image centre
    half_h = HANDLE - GRIP + 70
    w_ = 2 * 285
    s, c = surface(w_, 2 * half_h)
    g = complex(w_ / 2, half_h)
    draw_scythe(c, g, g - 1j)
    save(s, "teil_sense.png")
    print("written to", OUT)


if __name__ == "__main__":
    main()
