"""Foot planting: keeps grounded feet locked to the floor (no sliding).

The planter walks once through the whole animation at a fine time step and
records where each foot should be. Feet stay planted while the forward-
kinematics foot is near its plant; if the body drifts too far, the foot takes
a quick little step to the new spot. Feet in the air simply follow FK.
The result is a lookup table, so poses stay a pure function of time.
"""
import math

from . import config

BAKE_DT = 1 / 240.0


class FootPlanter:
    def __init__(self, fk_body, t_end, release=34.0, step_time=0.09, step_lift=16.0,
                 blend_time=0.07, contact=6.0):
        """fk_body(t) -> rig.Body without IK."""
        self.dt = BAKE_DT
        n = int(math.ceil(t_end / self.dt)) + 2
        self.targets = {"F": [None] * n, "B": [None] * n}
        self.weights = {"F": [0.0] * n, "B": [0.0] * n}
        floor = config.GROUND_Y
        for side in ("F", "B"):
            state = "free"
            plant = None
            step_from = step_t0 = None
            weight = 0.0
            for i in range(n):
                t = i * self.dt
                body = fk_body(t)
                f = body.pts["foot" + side]
                rel = 7.0 * body.scale           # foot_pad used by rig.solve
                grounded = f.imag >= floor - rel - contact * body.scale
                if not grounded:
                    state = "free"
                    weight = max(0.0, weight - self.dt / blend_time)
                    tgt = plant if plant is not None else f
                    self.targets[side][i] = tgt
                    self.weights[side][i] = weight
                    continue
                fx = f.real
                if state == "free":
                    plant = complex(fx, floor - rel)
                    state = "planted"
                elif state == "planted" and abs(fx - plant.real) > release * body.scale:
                    state = "step"
                    step_from, step_t0 = plant, t
                if state == "step":
                    u = min((t - step_t0) / step_time, 1.0)
                    e = u * u * (3 - 2 * u)
                    x = step_from.real + (fx - step_from.real) * e
                    lift = step_lift * body.scale * math.sin(math.pi * u)
                    tgt = complex(x, floor - rel - lift)
                    if u >= 1.0:
                        plant = complex(fx, floor - rel)
                        state = "planted"
                else:
                    tgt = plant
                weight = min(1.0, weight + self.dt / blend_time)
                self.targets[side][i] = tgt
                self.weights[side][i] = weight

    def lookup(self, t, body):
        """Foot targets for rig.apply_leg_ik (blended with FK by weight)."""
        x = t / self.dt
        i = int(x)
        n = len(self.targets["F"]) - 1
        if i >= n:
            i, fr = n - 1, 1.0
        else:
            fr = x - i
        out = {}
        for side in ("F", "B"):
            w = self.weights[side][i] * (1 - fr) + self.weights[side][i + 1] * fr
            if w <= 0.001:
                continue
            a, b = self.targets[side][i], self.targets[side][i + 1]
            tgt = a + (b - a) * fr
            fk = body.pts["foot" + side]
            out[side] = fk + (tgt - fk) * w
        return out
