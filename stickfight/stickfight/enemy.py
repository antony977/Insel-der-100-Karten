"""Grunt enemies: run in, wait/attack, get hit. Pose is a pure function of time
up to the moment of the hit; after that the body becomes a ragdoll.

The run cycle is foot-driven: every foot has fixed contact points on the floor
(stance) and arcs to the next one (swing); the legs are solved with IK, so the
feet never slide."""
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


STANCE = 0.42      # fraction of the run cycle a foot is on the ground
DECEL = 0.3        # seconds of skidding to a stop
SETTLE = 0.22      # seconds to blend from running into the guard stance


class Enemy:
    def __init__(self, eid, rng, scale=None, color=None, speed=None):
        self.id = eid
        self.rng = rng
        self.scale = scale if scale is not None else rng.uniform(1.08, 1.2)
        g = rng.uniform(-0.04, 0.05)
        self.color = color or tuple(c + g for c in config.ENEMY)
        self.speed = speed or rng.uniform(330, 400)
        self.phase0 = rng.uniform(0, 1)
        self.line_width = 11.0
        self.leg = (rig.GRUNT_PROPS.thigh + rig.GRUNT_PROPS.shin) * self.scale
        self.stride = self.leg * rng.uniform(2.2, 2.45)     # floor distance per full cycle
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
        self.spawn_x = config.SCENE_W + 90 if side > 0 else -90
        # constant speed, then a short skid to a stop (DECEL seconds)
        self.spawn_t = arrive_t - (abs(stand_x - self.spawn_x) / self.speed + DECEL / 2)

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
            return self.spawn_x + (self.stand_x - self.spawn_x) * self._run_frac(t)
        if self.lunge and t >= self.lunge[0]:
            t0, t1, xa, xb = self.lunge
            u = min((t - t0) / (t1 - t0), 1.0)
            return xa + (xb - xa) * easing.out_quad(u)
        return self.stand_x

    def _run_frac(self, t):
        T = max(self.arrive_t - self.spawn_t, 1e-6)
        u = min(max((t - self.spawn_t) / T, 0.0), 1.0)
        a = min(DECEL / T, 0.6)
        c = 1.0 / (1.0 - a / 2)
        if u <= 1 - a:
            return c * u
        w = u - (1 - a)
        return c * (1 - a) + c * w - c * w * w / (2 * a)

    # -- run cycle -------------------------------------------------------------------
    def _run_state(self, t):
        """(hip world pos, foot targets, upper-body pose) while running."""
        t = min(t, self.arrive_t)
        x = self.x_at(t)
        dirn = 1 if self.stand_x >= self.spawn_x else -1
        d = abs(x - self.spawn_x)
        S = self.stride
        c = d / S + self.phase0
        floor = config.GROUND_Y - 7.0 * self.scale
        feet, fwd = {}, {}
        for j, side in enumerate(("F", "B")):
            cj = c + 0.5 * j
            k = math.floor(cj)
            fr = cj - k
            # mid-stance (fr = STANCE/2) has the foot right under the hip
            base = self.spawn_x + dirn * ((k + STANCE / 2 - 0.5 * j - self.phase0) * S)
            if fr < STANCE:
                fx, lift = base, 0.0
            else:
                u = (fr - STANCE) / (1 - STANCE)
                e = u * u * (3 - 2 * u)
                fx = base + dirn * S * e
                lift = 0.30 * self.leg * math.sin(math.pi * u) ** 0.8
            feet[side] = complex(fx, floor - lift)
            fwd[side] = max(-1.0, min(1.0, (fx - x) * dirn / (0.45 * S)))
        h = self.leg * (0.83 - 0.035 * math.cos(4 * math.pi * (c - STANCE / 2)))
        hip = complex(x, floor - h)
        p = make_pose(torso=157 + 2 * math.cos(4 * math.pi * c), head=-8,
                      aF1=-55 * fwd["F"] + 5, aB1=-55 * fwd["B"] + 5)
        p["aF2"] = p["aF1"] + 88
        p["aB2"] = p["aB1"] + 88
        p["lF1"], p["lB1"] = 30 * fwd["F"], 30 * fwd["B"]
        return hip, feet, p

    def _guard_pose(self, t):
        p = dict(GUARD)
        b = math.sin(t * 6 + self.phase0 * 6)
        p["torso"] += 2 * b
        p["aF2"] += 4 * b
        p["aB2"] += 3 * math.sin(t * 6 + 1 + self.phase0 * 6)
        if self.hit and not self.hook:
            th = self.hit[0]
            if th - 0.3 < t:
                u = (t - (th - 0.3)) / 0.3
                p = rig.lerp_pose(p, WINDUP, easing.out_cubic(min(u, 1.0)))
        return p

    def pose_at(self, t):
        if self.hook and t >= self.hook[0]:
            u = min((t - self.hook[0]) / 0.12, 1.0)
            p = rig.lerp_pose(GUARD, DRAGGED, easing.out_cubic(u))
            p["aF1"] += 25 * math.sin(t * 30)
            p["aB1"] -= 25 * math.sin(t * 27)
            return p
        if t < self.arrive_t:
            return self._run_state(t)[2]
        p = self._guard_pose(t)
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
        return p

    def body_at(self, t):
        sc, pr = self.scale, rig.GRUNT_PROPS
        if self.hook and t >= self.hook[0]:
            return rig.solve(self.pose_at(t), self.facing, self.x_at(t), scale=sc, prop=pr)
        if t < self.arrive_t:
            hip, feet, p = self._run_state(t)
            body = rig.solve(p, self.facing, hip.real, scale=sc, prop=pr, hip=hip)
            return rig.apply_leg_ik(body, feet)
        if self.lunge and t >= self.lunge[0]:
            return rig.solve(self.pose_at(t), self.facing, self.x_at(t), scale=sc, prop=pr)
        # standing: feet stay where they landed in guard, blend in from the run
        p = self.pose_at(t)
        body = rig.solve(p, self.facing, self.x_at(t), scale=sc, prop=pr)
        plant = self._guard_plant()
        u = (t - self.arrive_t) / SETTLE
        if u < 1.0:
            hip0, feet0, _ = self._run_state(self.arrive_t)
            e = u * u * (3 - 2 * u)
            body = rig.solve(p, self.facing, self.x_at(t), scale=sc, prop=pr,
                             hip=hip0 + (body.pts["hip"] - hip0) * e)
            return rig.apply_leg_ik(body, {s: feet0[s] + (plant[s] - feet0[s]) * e for s in "FB"})
        return rig.apply_leg_ik(body, plant)

    def _guard_plant(self):
        if not hasattr(self, "_plant"):
            b = rig.solve(GUARD, self.facing, self.stand_x, scale=self.scale, prop=rig.GRUNT_PROPS)
            self._plant = {"F": b.pts["footF"], "B": b.pts["footB"]}
        return self._plant
