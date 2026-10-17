"""Weapons. Geometry is defined in a local frame:
    a = along the handle (from the grip towards the weapon head)
    b = along the blade normal N
World point = grip + a*D + b*N, where D/N come from the rig (they already
contain scale, mirroring, rotation and yaw squash).

To add a new weapon: subclass Weapon, implement `shape()` (local polygons and
lines) and `trail_local()` (two local points whose paths form the smear),
then register it in WEAPONS.
"""
import math

from . import config


class Weapon:
    name = "weapon"
    hook_point = (0.0, 0.0)       # local point used to hook enemies
    spin_center = 0.0             # local `a` used as rotation centre when thrown

    def __init__(self):
        self._shape = self.shape()

    # -- to override -------------------------------------------------------
    def shape(self):
        """Return dict(lines=[(pts, width, color)], polys=[(pts, color)]) in local coords."""
        raise NotImplementedError

    def trail_local(self):
        """(outer, inner) local points; their sweep forms the white smear."""
        raise NotImplementedError

    # -- helpers -------------------------------------------------------------
    @staticmethod
    def to_world(grip, D, N, ab):
        return grip + ab[0] * D + ab[1] * N

    def point(self, grip, D, N, ab):
        return self.to_world(grip, D, N, ab)

    def trail_pair(self, grip, D, N):
        o, i = self.trail_local()
        return self.to_world(grip, D, N, o), self.to_world(grip, D, N, i)

    def draw(self, ctx, grip, D, N, alpha=1.0):
        scale = abs(D) or 1.0
        ctx.set_line_cap(1)
        ctx.set_line_join(1)
        for pts, width, color in self._shape["lines"]:
            ctx.set_source_rgba(*color, alpha)
            ctx.set_line_width(width * scale)
            w = [self.to_world(grip, D, N, q) for q in pts]
            ctx.move_to(w[0].real, w[0].imag)
            for q in w[1:]:
                ctx.line_to(q.real, q.imag)
            ctx.stroke()
        for pts, color in self._shape["polys"]:
            ctx.set_source_rgba(*color, alpha)
            w = [self.to_world(grip, D, N, q) for q in pts]
            ctx.move_to(w[0].real, w[0].imag)
            for q in w[1:]:
                ctx.line_to(q.real, q.imag)
            ctx.close_path()
            ctx.fill_preserve()
            ctx.set_line_width(1.2)
            ctx.stroke()
        for pts, width, color in self._shape.get("edges", []):
            ctx.set_source_rgba(*color, alpha * 0.9)
            ctx.set_line_width(width * scale)
            w = [self.to_world(grip, D, N, q) for q in pts]
            ctx.move_to(w[0].real, w[0].imag)
            for q in w[1:]:
                ctx.line_to(q.real, q.imag)
            ctx.stroke()


class Scythe(Weapon):
    """Long-handled scythe with a curved, serrated blade."""
    name = "scythe"

    def __init__(self, handle_back=34, handle_fwd=100, blade_len=96, blade_w=21,
                 curve=0.46, teeth=5, tooth_depth=7.5):
        self.handle_back = handle_back
        self.handle_fwd = handle_fwd
        self.blade_len = blade_len
        self.blade_w = blade_w
        self.curve = curve
        self.teeth = teeth
        self.tooth_depth = tooth_depth
        super().__init__()
        self.hook_point = self._center(0.42)
        self.spin_center = (handle_fwd - handle_back) * 0.5 + 10

    def _center(self, t):
        L = self.blade_len
        return (self.handle_fwd + 3 - self.curve * L * t * t, L * t)

    def _frame(self, t):
        L = self.blade_len
        ta, tb = -2 * self.curve * L * t, L
        n = math.hypot(ta, tb)
        ta, tb = ta / n, tb / n
        return (tb, -ta)  # perpendicular pointing to the spine (+a side)

    def shape(self):
        L, W = self.blade_len, self.blade_w
        n = 48
        spine, edge = [], []
        t0, t1 = 0.14, 0.82
        for i in range(n + 1):
            t = i / n
            ca, cb = self._center(t)
            pa, pb = self._frame(t)
            w = W * (1 - t) ** 0.8 + 1.0
            # spine bulges a little, edge is concave and serrated
            spine.append((ca + pa * w * 0.55, cb + pb * w * 0.55))
            tooth = 0.0
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0) * self.teeth
                f = k - math.floor(k)
                tooth = self.tooth_depth * (1 - t * 0.6) * (f ** 2.2)
            edge.append((ca - pa * (w * 0.45 + tooth), cb - pb * (w * 0.45 + tooth)))
        blade = [(self.handle_fwd - W * 0.5, -4)] + edge + spine[::-1] + [(self.handle_fwd + W * 0.62, -3)]
        # little back spike on the head
        spike = [(self.handle_fwd + 4, -2), (self.handle_fwd + 26, -15), (self.handle_fwd - 6, -6)]
        butt = [(-self.handle_back - 2, -3.5), (-self.handle_back - 16, 0), (-self.handle_back - 2, 3.5)]
        collar = [(self.handle_fwd - 14, -5), (self.handle_fwd - 6, 0), (self.handle_fwd - 14, 5), (self.handle_fwd - 22, 0)]
        inner = [(ca, cb) for ca, cb in (self._center(i / 20) for i in range(2, 18))]
        inner = [(a - self._frame(i / 20 + 0.1)[0] * 3, b - self._frame(i / 20 + 0.1)[1] * 3)
                 for i, (a, b) in enumerate(inner)]
        return dict(
            lines=[([(-self.handle_back, 0), (self.handle_fwd + 6, 0)], 5.0, config.BLADE)],
            polys=[(spike, config.BLADE), (blade, config.BLADE), (butt, config.BLADE), (collar, config.BLADE)],
            edges=[(inner, 1.6, config.BLADE_EDGE)],
        )

    def trail_local(self):
        return self._center(1.0), self._center(0.3)


WEAPONS = {"scythe": Scythe}
