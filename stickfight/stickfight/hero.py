"""The hero: a timeline of move segments that can be evaluated at any time.

Everything here is a pure function of scene time, which lets the renderer
sample the past (for smear trails) without storing history.
"""
import cmath
import math
from dataclasses import dataclass

from . import config, rig
from .anim import MoveDef, Track
from .ik import FootPlanter
from .moves import STANCE

SMEAR_FRAME_SPEED = 2600.0   # deg/s of weapon swing where smear-stretching starts
SMEAR_FRAME_RANGE = 2600.0


def _alive(p, t):
    """Always-on secondary layer: breathing / bobbing so the body never freezes."""
    b = math.sin(t * 5.0)
    b2 = math.sin(t * 5.0 + 0.9)
    p["torso"] += 1.6 * b
    p["head"] += 1.8 * b2
    p["aF1"] += 2.5 * b2
    p["aB1"] -= 2.5 * b2
    p["aF2"] += 2.0 * b
    p["wF"] += 2.2 * math.sin(t * 4.1 + 0.3)
    p["wB"] -= 2.2 * math.sin(t * 4.1 + 1.4)
    p["lF1"] += 1.5 * b
    p["lF2"] -= 1.5 * b
    p["lB2"] -= 1.5 * b
    return p


def _wrap(a):
    return (a + 180.0) % 360.0 - 180.0


@dataclass
class Segment:
    start: float
    move: MoveDef
    facing: int
    x0: float
    track: Track

    @property
    def end(self):
        return self.start + self.move.duration


class Hero:
    def __init__(self, x=540.0, facing=1, scale=1.22, weapon=None, color=config.HERO,
                 line_width=12.5, props=rig.HERO_PROPS):
        self.scale = scale
        self.weapon = weapon
        self.color = color
        self.line_width = line_width
        self.props = props
        self.segments = []
        self._start_x = x
        self._start_facing = facing
        self._start_pose = dict(STANCE)
        self.planter = None

    # -- building --------------------------------------------------------------
    def add(self, move, facing=None, start=None):
        if self.segments:
            prev = self.segments[-1]
            end = prev.track.end_pose
            x0 = prev.x0 + prev.facing * end["x"]
            end["x"] = 0.0
            end["rot"] = _wrap(end["rot"])
            end["yaw"] = _wrap(end["yaw"])
            t = prev.end if start is None else start
            facing = prev.facing if facing is None else facing
        else:
            end = dict(self._start_pose)
            x0 = self._start_x
            t = 0.0 if start is None else start
            facing = self._start_facing if facing is None else facing
        seg = Segment(t, move, facing, x0, Track(end, move.keys))
        self.segments.append(seg)
        return seg

    @property
    def end_time(self):
        return self.segments[-1].end if self.segments else 0.0

    # -- evaluation ------------------------------------------------------------
    def segment_at(self, t):
        segs = self.segments
        for s in segs:
            if t < s.end:
                return s
        return segs[-1]

    def pose_at(self, t):
        seg = self.segment_at(t)
        lt = min(max(t - seg.start, 0.0), seg.move.duration if seg is not self.segments[-1] else 1e9)
        p = seg.track(lt)
        if seg.move.procedural:
            p = seg.move.procedural(p, lt)
        return _alive(p, t), seg

    def stretch_at(self, t, dt=1 / 240.0):
        """Smear-frame stretch per hand, from the weapon's angular speed."""
        a, _ = self.pose_at(t)
        b, _ = self.pose_at(max(t - dt, 0.0))
        out = {}
        for side in ("F", "B"):
            w = abs(a["w" + side] - b["w" + side]) / dt
            out[side] = min(max((w - SMEAR_FRAME_SPEED) / SMEAR_FRAME_RANGE, 0.0), 1.0)
        return out

    def fk_body_at(self, t):
        p, seg = self.pose_at(t)
        return rig.solve(p, seg.facing, seg.x0, scale=self.scale, prop=self.props)

    def body_at(self, t):
        p, seg = self.pose_at(t)
        body = rig.solve(p, seg.facing, seg.x0, scale=self.scale, prop=self.props,
                         stretch=self.stretch_at(t))
        if self.planter is not None:
            rig.apply_leg_ik(body, self.planter.lookup(t, body))
        return body

    def bake(self):
        """Pre-compute foot plants (call once the timeline is complete)."""
        self.planter = None
        self.planter = FootPlanter(self.fk_body_at, self.end_time + 0.5)

    def x_at(self, t):
        p, seg = self.pose_at(t)
        return seg.x0 + seg.facing * p["x"]

    def facing_at(self, t):
        return self.segment_at(t).facing

    # -- weapons -----------------------------------------------------------------
    def throw_state(self, t):
        """None, or (seg, u) when a weapon of the current segment is in flight."""
        seg = self.segment_at(t)
        th = seg.move.throw
        if th is None:
            return None
        lt = t - seg.start
        if th.release <= lt < th.catch:
            return seg, th, (lt - th.release) / (th.catch - th.release)
        return None

    def trail_at(self, t):
        seg = self.segment_at(t)
        return seg.track.trail_at(t - seg.start)

    def held(self, t, side):
        st = self.throw_state(t)
        return not (st and st[1].hand == side)

    def weapon_frame(self, t, side, body=None):
        """(grip, D, N) of a held weapon."""
        body = body or self.body_at(t)
        return body.weapons[side]

    def thrown_frame(self, t):
        """(grip, D, N) of the flying weapon, or None."""
        st = self.throw_state(t)
        if not st:
            return None
        seg, th, u = st
        side = th.hand
        r_grip, r_D, r_N = self.body_at(seg.start + th.release).weapons[side]
        c_grip, c_D, c_N = self.body_at(seg.start + th.catch).weapons[side]
        sc = self.weapon.spin_center
        R = r_grip + r_D * sc
        C = c_grip + c_D * sc
        f = seg.facing
        base = R + (C - R) * (u ** 2.2)
        out = th.dist * math.sin(math.pi * u) ** 0.85
        rise = -th.rise * math.sin(math.pi * u) - 12 * math.sin(2 * math.pi * u)
        center = base + complex(f * out, rise)
        # spin: rotate the release frame, land exactly in the catch frame
        want = -f * 2 * math.pi * th.spins
        delta = cmath.phase(c_D / r_D) if abs(r_D) > 1e-6 else 0.0
        total = delta + 2 * math.pi * round((want - delta) / (2 * math.pi))
        rot = cmath.exp(1j * total * u)
        D = r_D * rot
        N = r_N * rot
        k = u ** 6
        N = N * (1 - k) + c_N * k
        grip = center - D * sc
        return grip, D, N
