"""Choreography builder: chains hero moves, places enemies so they arrive in
time for each hit, and collects timing effects (hit-stop, slow motion).

    c = Choreo()
    c.idle(0.8)
    e = c.enemy()
    c.move("cross_slash", facing=+1, targets=[e])

All times here are *scene time*. TimeWarp later maps video frames to scene
time, inserting hit-stops (freeze) and slow motion.
"""
import math
import random

from .enemy import Enemy
from .hero import Hero
from .moves import MOVES
from .weapons import WEAPONS

HITSTOP_STRONG = 3      # frames at 60 fps
HITSTOP_LIGHT = 2


class Choreo:
    def __init__(self, seed=7, hero_x=540.0, facing=1, weapon="scythe"):
        self.rng = random.Random(seed)
        self.weapon = WEAPONS[weapon]()
        self.hero = Hero(x=hero_x, facing=facing, weapon=self.weapon)
        self.enemies = []
        self.events = []      # (scene_t, kind, payload)
        self.hitstops = []    # (scene_t, real_seconds)
        self.slowmos = []     # (scene_t0, scene_t1, factor)

    # -- enemies -----------------------------------------------------------------
    def enemy(self, **kw):
        e = Enemy(len(self.enemies), self.rng, **kw)
        self.enemies.append(e)
        return e

    def group(self, n, **kw):
        return [self.enemy(**kw) for _ in range(n)]

    # -- hero ----------------------------------------------------------------------
    @property
    def t(self):
        return self.hero.end_time

    def idle(self, duration, facing=None):
        return self.hero.add(MOVES["idle"](duration), facing)

    def move(self, name, facing=None, targets=(), speed=1.0, **params):
        md = MOVES[name](**params)
        if speed != 1.0:
            md = md.scaled(1.0 / speed)
        seg = self.hero.add(md, facing)
        f = seg.facing
        hero = self.hero
        for h in md.hits:
            e = targets[h.slot]
            side = f * h.side
            if h.t == "throw":
                stand = hero.x_at(seg.start) + side * h.dist
                t = self._throw_pass_time(seg, stand, side)
            else:
                t = seg.start + h.t
            if not e.placed:
                if h.dist == "hook":
                    grip, D, N = hero.weapon_frame(t, "F")
                    hp = self.weapon.point(grip, D, N, self.weapon.hook_point)
                    stand = hp.real + side * 10 * (e.scale)
                elif h.t != "throw":
                    stand = hero.x_at(t) + side * h.dist
                e.place(stand, t - h.lead, side)
            if h.kind == "hook":
                if e.placed and e.lunge:
                    # land the lunge exactly where the hook will catch him
                    grip, D, N = hero.weapon_frame(t, "F")
                    hp = self.weapon.point(grip, D, N, self.weapon.hook_point)
                    t0, t1, xa, _ = e.lunge
                    e.lunge = (t0, t1, xa, hp.real + side * 10 * e.scale)
                e.set_hook(t, hero)
                self.events.append((t, "hook", e))
            elif h.kind == "attack":
                x_to = hero.x_at(seg.start) + side * h.reaction.get("lunge_to", 40)
                e.set_lunge(t, h.reaction.get("dur", 0.4), x_to)
                self.events.append((t, "lunge", e))
            else:
                e.set_hit(t, h.reaction, h.strong)
                self.events.append((t, "hit", e))
                frames = HITSTOP_STRONG if h.strong else HITSTOP_LIGHT
                self.hitstops.append((t, frames / 60.0))
        for ft, name_, p in md.fx:
            self.events.append((seg.start + ft, "fx", (name_, p, seg)))
        if md.slowmo:
            a, b, k = md.slowmo
            self.slowmos.append((seg.start + a, seg.start + b, k))
        return seg

    def _throw_pass_time(self, seg, x, side):
        th = seg.move.throw
        t = seg.start + th.release
        end = seg.start + th.catch
        w = self.weapon
        while t < end:
            fr = self.hero.thrown_frame(t)
            if fr:
                grip, D, N = fr
                c = grip + D * w.spin_center
                if (c.real - x) * side >= -25:
                    return t
            t += 1 / 480.0
        return seg.start + (th.release + th.catch) / 2

    # -- summary -------------------------------------------------------------------
    @property
    def end_time(self):
        return self.hero.end_time


class TimeWarp:
    """Maps video frames to scene time (hit-stop freezes, eased slow motion)."""

    def __init__(self, hitstops, slowmos, ramp=0.12):
        self.hitstops = sorted(hitstops)
        self.slowmos = slowmos
        self.ramp = ramp

    def factor(self, s):
        f = 1.0
        r = self.ramp
        for a, b, k in self.slowmos:
            if a - r <= s <= b + r:
                if s < a:
                    w = (s - (a - r)) / r
                elif s > b:
                    w = 1 - (s - b) / r
                else:
                    w = 1.0
                w = w * w * (3 - 2 * w)
                f = min(f, 1 + (k - 1) * w)
        return f

    def slow_amount(self, s):
        """0 = normal speed, 1 = deepest slow motion."""
        f = self.factor(s)
        kmin = min((k for _, _, k in self.slowmos), default=1.0)
        return 0.0 if kmin >= 1 else (1 - f) / (1 - kmin)

    def frames(self, scene_end, fps, hold_end=0.0):
        """Scene time for every output frame."""
        out = []
        s = 0.0
        hold = 0.0
        stops = list(self.hitstops)
        dt_frame = 1.0 / fps
        while s < scene_end:
            out.append(s)
            dt = dt_frame
            while dt > 1e-12:
                if hold > 0:
                    use = min(dt, hold)
                    hold -= use
                    dt -= use
                    continue
                f = self.factor(s)
                ds = dt * f
                if stops and s + ds >= stops[0][0] > s - 1e-9:
                    need = (stops[0][0] - s) / f
                    s = stops[0][0]
                    dt -= need
                    hold = stops[0][1]
                    stops.pop(0)
                else:
                    s += ds
                    dt = 0
                while stops and stops[0][0] < s - 1e-9:
                    stops.pop(0)
        out.extend([scene_end] * int(round(hold_end * fps)))
        return out
