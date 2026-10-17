"""Keyframe animation primitives shared by hero moves.

A MoveDef is a list of keyframes. Each keyframe only lists the pose values it
changes; everything else is inherited from the previous keyframe (and the
first keyframe inherits from wherever the character was when the move began),
so moves chain smoothly into each other.
"""
from dataclasses import dataclass, field

from . import easing
from .rig import lerp_pose


@dataclass
class Key:
    t: float                  # time inside the move (s)
    pose: dict                # changed pose values
    ease: str = "inout_cubic" # curve used to arrive at this key
    trail: bool = None        # draw weapon smears while moving to this key
                              # (default: only for "snap" strikes)


@dataclass
class Hit:
    """Something that happens to an enemy during a move.

    kind:   "damage" (enemy reacts / dies), "hook" (enemy gets dragged by the
            weapon until the next damage hit), "attack" (the enemy attacks the
            hero at this moment, e.g. a lunge the hero dodges)
    slot:   index into the list of enemies passed to Choreo.move()
    side:   +1 = in front of the hero, -1 = behind
    dist:   where the enemy stands (distance from the hero hip at that time).
            "hook" = auto-placed at the weapon's hook point.
    t:      time in the move, or "throw" = when the thrown weapon passes by
    """
    t: object
    slot: int = 0
    kind: str = "damage"
    side: int = 1
    dist: object = 150
    reaction: dict = field(default_factory=dict)
    strong: bool = False
    lead: float = 0.45        # how long the enemy waits in position before t


@dataclass
class Throw:
    hand: str = "F"
    release: float = 0.2
    catch: float = 1.0
    dist: float = 320.0       # how far the weapon flies out
    rise: float = 40.0
    spins: float = 4.0


@dataclass
class MoveDef:
    name: str
    keys: list
    duration: float
    hits: list = field(default_factory=list)
    fx: list = field(default_factory=list)           # (t, name, params)
    throw: Throw = None
    procedural: object = None                         # fn(pose, local_t) -> pose
    slowmo: tuple = None                              # (t0, t1, factor)

    def scaled(self, k):
        """Return a copy with all timings multiplied by k (speed tweak)."""
        import copy
        m = copy.deepcopy(self)
        for key in m.keys:
            key.t *= k
        m.duration *= k
        for h in m.hits:
            if isinstance(h.t, (int, float)):
                h.t *= k
        m.fx = [(t * k, n, p) for t, n, p in m.fx]
        if m.throw:
            m.throw.release *= k
            m.throw.catch *= k
        if m.slowmo:
            m.slowmo = (m.slowmo[0] * k, m.slowmo[1] * k, m.slowmo[2])
        return m


class Track:
    """Evaluates a list of keys starting from a given pose.

    Joint *angles* are interpolated (never positions), so limbs keep their
    length. Between keys the path is a time-aware Catmull-Rom spline (smooth
    through the keys, no corners), the timing along it uses the key's easing.
    """
    TENSION = 0.0     # 0 = Catmull-Rom, 1 = no tangents (plain eased blend)

    def __init__(self, start_pose, keys):
        self.times = [0.0]
        self.poses = [dict(start_pose)]
        self.eases = [None]
        self.trails = [False]
        cur = dict(start_pose)
        for k in sorted(keys, key=lambda k: k.t):
            cur = dict(cur)
            cur.update(k.pose)
            self.times.append(k.t)
            self.poses.append(cur)
            self.eases.append(easing.get(k.ease))
            self.trails.append(k.ease == "snap" if k.trail is None else k.trail)

    def trail_at(self, t):
        ts = self.times
        for i in range(1, len(ts)):
            if t <= ts[i]:
                return t > 0 and self.trails[i]
        return False

    def __call__(self, t):
        ts = self.times
        if t <= 0:
            return dict(self.poses[0])
        for i in range(1, len(ts)):
            if t <= ts[i]:
                span = ts[i] - ts[i - 1]
                if span <= 0:
                    return dict(self.poses[i])
                u = self.eases[i]((t - ts[i - 1]) / span)
                return self._spline(i, u)
        return dict(self.poses[-1])

    def _spline(self, i, u):
        ts, P = self.times, self.poses
        n = len(P)
        i0, i3 = max(i - 2, 0), min(i + 1, n - 1)
        t0, t1, t2, t3 = ts[i0], ts[i - 1], ts[i], ts[i3]
        p0, p1, p2, p3 = P[i0], P[i - 1], P[i], P[i3]
        span = t2 - t1
        k = 1.0 - self.TENSION
        u2, u3 = u * u, u * u * u
        h00 = 2 * u3 - 3 * u2 + 1
        h10 = u3 - 2 * u2 + u
        h01 = -2 * u3 + 3 * u2
        h11 = u3 - u2
        out = {}
        for key, a in p1.items():
            b = p2[key]
            if a == b:          # held value: no drift caused by the neighbours
                out[key] = a
                continue
            m1 = (b - p0[key]) / (t2 - t0) * span * k if t2 > t0 else 0.0
            m2 = (p3[key] - a) / (t3 - t1) * span * k if t3 > t1 else 0.0
            out[key] = h00 * a + h10 * m1 + h01 * b + h11 * m2
        return out

    @property
    def end_pose(self):
        return dict(self.poses[-1])
