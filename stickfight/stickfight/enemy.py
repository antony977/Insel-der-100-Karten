"""Grunt enemies: run in, wait/attack, get hit. Pose is a pure function of time
up to the moment of the hit; after that the body turns into physics parts."""
import math

from . import config, easing, rig
from .rig import make_pose

GUARD = make_pose(torso=172, head=4, aF1=35, aF2=150, aB1=15, aB2=160,
                  lF1=28, lF2=-4, lB1=-20, lB2=-30)
WINDUP = make_pose(torso=192, head=8, aF1=-60, aF2=-10, aB1=50, aB2=150,
                   lF1=34, lF2=0, lB1=-26, lB2=-40)
KICK = make_pose(torso=205, head=10, aF1=-40, aF2=-90, aB1=60, aB2=120,
                 lF1=95, lF2=92, lB1=-10, lB2=-70)
DRAGGED = make_pose(torso=145, head=-25, aF1=120, aF2=150, aB1=80, aB2=140,
                    lF1=-20, lF2=-45, lB1=-50, lB2=-70)


class Enemy:
    def __init__(self, eid, rng, scale=None, color=None, speed=None):
        self.id = eid
        self.rng = rng
        self.scale = scale if scale is not None else rng.uniform(1.08, 1.2)
        g = rng.uniform(-0.04, 0.05)
        self.color = color or tuple(c + g for c in config.ENEMY)
        self.speed = speed or rng.uniform(330, 400)
        self.stride = rng.uniform(150, 170)
        self.phase0 = rng.uniform(0, 2 * math.pi)
        self.line_width = 8.0
        self.side = None
        self.facing = None
        self.spawn_t = self.arrive_t = None
        self.spawn_x = self.stand_x = None
        self.lunge = None       # (t0, t1, x_from, x_to)
        self.hook = None        # (t0, t1, hero, hero_facing)
        self.hit = None         # (t, reaction, strong)

    # -- scheduling (called by the choreography) ----------------------------------
    @property
    def placed(self):
        return self.stand_x is not None

    def place(self, stand_x, arrive_t, side):
        self.side = side
        self.facing = -side
        self.stand_x = stand_x
        self.arrive_t = arrive_t
        self.spawn_x = config.SCENE_W + 80 if side > 0 else -80
        self.spawn_t = arrive_t - abs(stand_x - self.spawn_x) / self.speed

    def set_lunge(self, t0, dur, x_to):
        self.lunge = (t0, t0 + dur, self.stand_x, x_to)

    def set_hook(self, t0, hero):
        self.hook = [t0, None, hero, hero.facing_at(t0)]

    def set_hit(self, t, reaction, strong):
        self.hit = (t, reaction, strong)
        if self.hook and self.hook[1] is None:
            self.hook[1] = t

    # -- evaluation -------------------------------------------------------------------
    def visible(self, t):
        return self.spawn_t is not None and t >= self.spawn_t and (self.hit is None or t < self.hit[0])

    def _hook_x(self, t):
        hero = self.hook[2]
        grip, D, N = hero.weapon_frame(t, "F")
        p = hero.weapon.point(grip, D, N, hero.weapon.hook_point)
        return p.real - self.facing * 10 * self.scale

    def x_at(self, t):
        if self.hook and t >= self.hook[0]:
            return self._hook_x(min(t, self.hook[1]))
        if t < self.arrive_t:
            u = (t - self.spawn_t) / max(self.arrive_t - self.spawn_t, 1e-6)
            return self.spawn_x + (self.stand_x - self.spawn_x) * u
        if self.lunge and t >= self.lunge[0]:
            t0, t1, xa, xb = self.lunge
            u = min((t - t0) / (t1 - t0), 1.0)
            return xa + (xb - xa) * easing.out_quad(u)
        return self.stand_x

    def pose_at(self, t):
        rng_bob = math.sin(t * 6 + self.phase0)
        if self.hook and t >= self.hook[0]:
            u = min((t - self.hook[0]) / 0.12, 1.0)
            p = rig.lerp_pose(GUARD, DRAGGED, easing.out_cubic(u))
            p["aF1"] += 25 * math.sin(t * 30)
            p["aB1"] -= 25 * math.sin(t * 27)
            return p
        if t < self.arrive_t:
            dist = abs(self.spawn_x - self.x_at(t))
            ph = dist / self.stride * 2 * math.pi + self.phase0
            s, c = math.sin(ph), math.cos(ph)
            p = make_pose(torso=158 + 3 * abs(c), head=-6,
                          lF1=42 * s, lB1=-42 * s,
                          lF2=42 * s - 25 - 55 * max(0.0, -c),
                          lB2=-42 * s - 25 - 55 * max(0.0, c),
                          aF1=-38 * s, aF2=-38 * s + 85, aB1=38 * s, aB2=38 * s + 85)
            return p
        p = dict(GUARD)
        p["torso"] += 2 * rng_bob
        p["aF2"] += 4 * rng_bob
        if t - self.arrive_t < 0.18:
            # skid to a stop
            u = (t - self.arrive_t) / 0.18
            p["torso"] = 160 + (p["torso"] - 160) * easing.out_cubic(u)
        if self.lunge and t >= self.lunge[0]:
            t0, t1, _, _ = self.lunge
            u = min((t - t0) / (t1 - t0), 1.0)
            if u < 1.0:
                k = easing.out_cubic(min(u / 0.35, 1.0))
                p = rig.lerp_pose(p, KICK, k)
                p["air"] = 70 * math.sin(math.pi * u)
            else:
                k = min((t - t1) / 0.25, 1.0)
                p = rig.lerp_pose(KICK, p, easing.out_cubic(k))
        if self.hit and not self.hook:
            th = self.hit[0]
            if th - 0.3 < t:
                u = (t - (th - 0.3)) / 0.3
                p = rig.lerp_pose(p, WINDUP, easing.out_cubic(min(u, 1.0)))
        return p

    def body_at(self, t):
        return rig.solve(self.pose_at(t), self.facing, self.x_at(t), scale=self.scale, prop=rig.GRUNT_PROPS)
