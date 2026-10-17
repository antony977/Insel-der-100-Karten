"""Verlet ragdoll for hit enemies.

Joints become particles, bones become distance constraints (plus a few hidden
stiffeners so the body folds like a puppet instead of collapsing to a point).
A slash cuts every bone crossing the cut line, inserting new particles at the
cut so the pieces separate with red "stumps".
"""
import cmath
import math

from . import config

G = config.GRAVITY
TAU = 2 * math.pi

# (a, b, drawn)
BONES = [("head", "neck", True), ("neck", "shoulder", True), ("shoulder", "hip", True),
         ("shoulder", "elbowF", True), ("elbowF", "handF", True),
         ("shoulder", "elbowB", True), ("elbowB", "handB", True),
         ("hip", "kneeF", True), ("kneeF", "footF", True),
         ("hip", "kneeB", True), ("kneeB", "footB", True),
         # hidden stiffeners
         ("neck", "hip", False), ("head", "shoulder", False)]
# keep limbs from folding completely flat: (a, b, min fraction of rest length)
MIN_DIST = [("hip", "footF", 0.55), ("hip", "footB", 0.55),
            ("shoulder", "handF", 0.35), ("shoulder", "handB", 0.35),
            ("kneeF", "kneeB", 0.25)]


def _side(q, p0, d):
    return ((q - p0) * d.conjugate()).imag


class Ragdoll:
    def __init__(self, body, color, lw, t0, rng, floor_off=0.0):
        self.color, self.lw, self.t0, self.rng = color, lw, t0, rng
        self.floor = config.GROUND_Y + floor_off
        names = list(body.pts.keys())
        self.idx = {n: i for i, n in enumerate(names)}
        self.p = [body.pts[n] for n in names]
        self.q = list(self.p)
        self.rad = [lw * 0.5] * len(names)
        self.head = self.idx["head"]
        self.head_r = body.head_r
        self.rad[self.head] = body.head_r
        self.sticks = []     # [i, j, rest, drawn]
        for a, b, drawn in BONES:
            i, j = self.idx[a], self.idx[b]
            self.sticks.append([i, j, abs(self.p[i] - self.p[j]), drawn])
        self.mins = []
        for a, b, f in MIN_DIST:
            i, j = self.idx[a], self.idx[b]
            self.mins.append([i, j, abs(self.p[i] - self.p[j]) * f])
        self.stumps = []
        self.prev_dt = None
        self.bleed_until = t0 + 0.6

    # -- setup -------------------------------------------------------------------
    def cut(self, p0, d):
        """Cut every stick that crosses the line p0 + s*d."""
        new_sticks = []
        for st in self.sticks:
            i, j, rest, drawn = st
            si, sj = _side(self.p[i], p0, d), _side(self.p[j], p0, d)
            if (si >= 0) == (sj >= 0):
                new_sticks.append(st)
                continue
            if not drawn:
                continue            # hidden stiffener across the cut just disappears
            f = si / (si - sj)
            x = self.p[i] + (self.p[j] - self.p[i]) * f
            for end, frac in ((i, f), (j, 1 - f)):
                k = len(self.p)
                self.p.append(x)
                self.q.append(x)
                self.rad.append(self.lw * 0.5)
                new_sticks.append([end, k, rest * frac, True])
                self.stumps.append(k)
        self.sticks = new_sticks
        self.mins = [m for m in self.mins
                     if (_side(self.p[m[0]], p0, d) >= 0) == (_side(self.p[m[1]], p0, d) >= 0)]

    def components(self):
        parent = list(range(len(self.p)))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        for i, j, _, _ in self.sticks:
            parent[find(i)] = find(j)
        groups = {}
        for k in range(len(self.p)):
            groups.setdefault(find(k), []).append(k)
        return list(groups.values())

    def set_velocity(self, ids, vel, spin, dt=1 / 120.0):
        """Linear velocity + angular velocity (rad/s) around the group's centre."""
        c = sum(self.p[k] for k in ids) / len(ids)
        for k in ids:
            v = vel + (self.p[k] - c) * 1j * spin
            self.q[k] = self.p[k] - v * dt
        self.prev_dt = dt

    # -- simulation ------------------------------------------------------------------
    def step(self, dt, t, blood):
        if dt <= 0:
            return
        corr = dt / self.prev_dt if self.prev_dt else 1.0
        self.prev_dt = dt
        g = complex(0, G * dt * dt)
        P, Q = self.p, self.q
        for k in range(len(P)):
            v = (P[k] - Q[k]) * corr * 0.997
            Q[k] = P[k]
            P[k] = P[k] + v + g
        for _ in range(8):
            for i, j, rest, _ in self.sticks:
                d = P[j] - P[i]
                L = abs(d) or 1e-6
                c = d * (0.5 * (L - rest) / L)
                P[i] += c
                P[j] -= c
            for i, j, mn in self.mins:
                d = P[j] - P[i]
                L = abs(d) or 1e-6
                if L < mn:
                    c = d * (0.5 * (L - mn) / L)
                    P[i] += c
                    P[j] -= c
            for k in range(len(P)):
                lim = self.floor - self.rad[k]
                if P[k].imag > lim:
                    # ground contact with friction
                    vx = (P[k].real - Q[k].real) * 0.55
                    P[k] = complex(P[k].real, lim)
                    Q[k] = complex(P[k].real - vx, Q[k].imag)
        if t < self.bleed_until and blood is not None:
            for k in self.stumps:
                if self.rng.random() < dt * 30:
                    v = (P[k] - Q[k]) / dt
                    blood.burst(P[k], v / (abs(v) + 1e-6) if abs(v) > 1 else -1j, 1,
                                speed=(80, 320), spread=0.6, up=120, size=(1.8, 3.4))

    # -- drawing --------------------------------------------------------------------
    def alpha(self, t):
        age = t - self.t0
        return max(0.0, min(1.0, 1.0 - (age - 2.6) / 0.7))

    def center(self):
        return sum(self.p) / len(self.p)

    def draw(self, ctx, t):
        a = self.alpha(t)
        if a <= 0:
            return
        ctx.set_line_cap(1)
        ctx.set_line_join(1)
        ctx.set_source_rgba(*self.color, a)
        ctx.set_line_width(self.lw)
        for i, j, _, drawn in self.sticks:
            if drawn and i != self.head and j != self.head:
                ctx.move_to(self.p[i].real, self.p[i].imag)
                ctx.line_to(self.p[j].real, self.p[j].imag)
        ctx.stroke()
        # neck stub towards the head + head
        for i, j, _, drawn in self.sticks:
            if drawn and self.head in (i, j):
                o = j if i == self.head else i
                h = self.p[self.head]
                ctx.move_to(self.p[o].real, self.p[o].imag)
                ctx.line_to(h.real, h.imag)
                ctx.stroke()
        h = self.p[self.head]
        ctx.arc(h.real, h.imag, self.head_r, 0, TAU)
        ctx.fill()
        ctx.set_source_rgba(*config.BLOOD, a)
        for k in self.stumps:
            ctx.arc(self.p[k].real, self.p[k].imag, self.lw * 0.6, 0, TAU)
            ctx.fill()
