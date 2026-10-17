"""Runtime: steps stateful things (particles, ragdolls, scarf) through scene
time, handles hit events and draws the fight scene in strip coordinates."""
import cmath
import math

from . import config, effects, rig
from .effects import Blood, CutLine, Dust, Flash, Shake, Shock, draw_smear
from .ragdoll import Ragdoll

SUBSTEP = 1 / 120.0
SMEAR_WINDOW = 0.09
SMEAR_SAMPLES = 20


class Scarf:
    """Springy verlet ribbon tied to the hero's neck (secondary motion).

    It is pulled only by gravity, a light breeze and its own inertia, so it
    trails behind every move and swings back after the body stops."""

    def __init__(self, n=12, seg=10.0, width=7.5, breeze=520.0, phase=0.0, color=config.HERO_SCARF):
        self.n, self.seg, self.width, self.breeze, self.phase = n, seg, width, breeze, phase
        self.color = color
        self.pts = None
        self.prev = None
        self.prev_dt = None

    def anchor(self, body):
        p = body.pts
        return p["neck"] + (p["head"] - p["neck"]) * 0.1

    def step(self, dt, body, t):
        if dt <= 0:
            return
        a = self.anchor(body)
        seg = self.seg * body.scale
        if self.pts is None:
            self.pts = [a + complex(-body.facing * seg * i, seg * 0.3 * i) for i in range(self.n)]
            self.prev = list(self.pts)
        corr = dt / self.prev_dt if self.prev_dt else 1.0
        self.prev_dt = dt
        f = 1 if body.affine.a >= 0 else -1
        new = [a]
        for i in range(1, self.n):
            p, q = self.pts[i], self.prev[i]
            flutter = math.sin(t * 11.0 - i * 0.75 + self.phase)
            wind = complex(-f * self.breeze * (1 + 0.35 * flutter), 260 * flutter)
            acc = wind + complex(0, 900)
            new.append(p + (p - q) * corr * 0.985 + acc * dt * dt)
        self.prev = self.pts
        self.pts = new
        rest2 = 2 * seg * 0.92
        for _ in range(6):
            self.pts[0] = a
            for i in range(1, self.n):
                d = self.pts[i] - self.pts[i - 1]
                L = abs(d) or 1e-6
                c = d * (1 - seg / L)
                if i == 1:
                    self.pts[i] -= c
                else:
                    self.pts[i] -= c * 0.5
                    self.pts[i - 1] += c * 0.5
            # soft bending stiffness: keeps the cloth springy instead of a rope
            for i in range(2, self.n):
                d = self.pts[i] - self.pts[i - 2]
                L = abs(d) or 1e-6
                if L < rest2:
                    c = d * (0.15 * (1 - rest2 / L))
                    self.pts[i] -= c
                    if i - 2 > 0:
                        self.pts[i - 2] += c
            # do not sink into the floor
            for i in range(1, self.n):
                if self.pts[i].imag > config.GROUND_Y - 3:
                    self.pts[i] = complex(self.pts[i].real, config.GROUND_Y - 3)

    def draw(self, ctx, scale):
        if not self.pts:
            return
        pts = self.pts
        n = len(pts)
        left, right = [], []
        for i, p in enumerate(pts):
            a = pts[max(i - 1, 0)]
            b = pts[min(i + 1, n - 1)]
            d = b - a
            d = d / abs(d) if abs(d) > 1e-6 else 1
            w = (self.width - (self.width - 2.5) * i / (n - 1)) * scale
            nrm = d * 1j
            left.append(p + nrm * w)
            right.append(p - nrm * w)
        ctx.set_source_rgb(*self.color)
        ctx.move_to(left[0].real, left[0].imag)
        for q in left[1:]:
            ctx.line_to(q.real, q.imag)
        tip = pts[-1] + (pts[-1] - pts[-2]) * 0.8
        ctx.line_to(tip.real, tip.imag)
        for q in reversed(right):
            ctx.line_to(q.real, q.imag)
        ctx.close_path()
        ctx.fill()
        ctx.set_source_rgb(*config.HERO_SCARF)
        ctx.arc(pts[0].real, pts[0].imag, 10.5 * scale, 0, 2 * math.pi)
        ctx.fill()


class World:
    def __init__(self, choreo, warp):
        self.c = choreo
        self.hero = choreo.hero
        self.warp = warp
        self.rng = choreo.rng
        self.blood = Blood(self.rng)
        self.parts = []
        self.fx = []
        self.shake = Shake()
        self.scarves = [Scarf(), Scarf(n=8, seg=9.0, width=6.0, breeze=430.0, phase=1.7,
                                         color=config.HERO_SCARF_DARK)]
        self.events = sorted(choreo.events, key=lambda e: e[0])
        self.ei = 0
        self.t = 0.0
        self.screen_flash = []   # (real_t0, dur, alpha)

    # -- simulation ---------------------------------------------------------------
    def advance(self, s1, real_t):
        while self.t < s1 - 1e-9:
            nt = min(self.t + SUBSTEP, s1)
            while self.ei < len(self.events) and self.events[self.ei][0] <= nt:
                ev = self.events[self.ei]
                self.ei += 1
                self.handle(ev, real_t)
            dt = nt - self.t
            self.t = nt
            self.blood.step(dt)
            for p in self.parts:
                p.step(dt, nt, self.blood)
            hb = self.hero.body_at(nt)
            for sc in self.scarves:
                sc.step(dt, hb, nt)
            self.fx = [f for f in self.fx if f.alive(nt)]
        # events exactly at the current time (e.g. t=0)
        while self.ei < len(self.events) and self.events[self.ei][0] <= s1:
            self.handle(self.events[self.ei], real_t)
            self.ei += 1

    def handle(self, ev, real_t):
        t, kind, data = ev
        if kind == "hit":
            self.on_hit(t, data, real_t)
        elif kind == "hook":
            grip, D, N = self.hero.weapon_frame(t, "F")
            hp = self.hero.weapon.point(grip, D, N, self.hero.weapon.hook_point)
            self.fx.append(Flash(hp, t, 0.4, size=0.45, dur=0.07))
            self.blood.burst(hp, complex(-data.facing, -0.5), 10, speed=(150, 420))
        elif kind == "lunge":
            x = data.x_at(t)
            self.fx.append(Dust(complex(x, config.GROUND_Y), t, self.rng, 0.6))
        elif kind == "fx":
            name, p, seg = data
            hx = self.hero.x_at(t)
            if name == "dust":
                off = 70 * seg.facing if p.get("at") == "front" else 0
                self.fx.append(Dust(complex(hx + off, config.GROUND_Y), t, self.rng, p.get("power", 1.0)))
            elif name == "shock":
                big = p.get("big", False)
                self.fx.append(Shock(complex(hx, config.GROUND_Y), t, big))
                self.shake.add(real_t, 20 if big else 10, 0.35 if big else 0.25)
                if big:
                    self.screen_flash.append((real_t, 0.16, 0.55))

    def on_hit(self, t, e, real_t):
        _, react, strong = e.hit
        body = e.body_at(t - 1e-4)
        hx = self.hero.x_at(t)
        away = 1 if body.pts["hip"].real >= hx else -1
        vx, vy = react.get("vel", (400, -400))
        vel = complex(away * vx, vy)
        spin = math.radians(react.get("spin", 600)) * away
        center = (body.pts["hip"] + body.pts["neck"]) / 2
        lw = e.line_width * e.scale
        rng = self.rng
        typ = react.get("type", "fly")
        cut_angles = []
        doll = Ragdoll(body, e.color, lw, t, rng, rng.uniform(-6, 12))
        self.parts.append(doll)

        if typ == "split":
            for ang in react.get("cuts", [0]):
                a = math.radians(ang)
                d = complex(away * math.cos(a), math.sin(a))
                cut_angles.append(cmath.phase(d))
                doll.cut(center, d)
            for ids in doll.components():
                gc = sum(doll.p[k] for k in ids) / len(ids)
                rel = gc - center
                sep = rel / abs(rel) * 190 if abs(rel) > 1e-3 else 0
                upper = rel.imag < 0
                k = 1.0 if upper else 0.3
                doll.set_velocity(ids, vel * k * rng.uniform(0.85, 1.15) + sep,
                                  spin * (1.0 if upper else 0.35) * rng.uniform(0.7, 1.3))
        elif typ == "behead":
            neck, head = body.pts["neck"], body.pts["head"]
            p0 = neck + (head - neck) * 0.3
            cut_angles.append(0.0)
            doll.cut(p0, complex(1, 0))
            for ids in doll.components():
                if doll.head in ids:
                    doll.set_velocity(ids, vel, spin * 1.4)
                else:
                    doll.set_velocity(ids, complex(away * 90, -30), away * 1.2)
            center = p0
        elif typ == "fall":
            doll.set_velocity(range(len(doll.p)), complex(away * 140, -60), away * 2.2)
        else:  # fly
            doll.set_velocity(range(len(doll.p)), vel, spin)
        # blood
        n = react.get("blood", 30) * 0.6
        vdir = vel / abs(vel) if abs(vel) > 0 else complex(away, 0)
        self.blood.burst(center, vdir, n * 0.6, spread=0.5 * react.get("spread", 1.0))
        for a in cut_angles or [cmath.phase(vdir)]:
            d = cmath.exp(1j * a)
            self.blood.burst(center, d, n * 0.2, spread=0.25, speed=(300, 1000))
            self.blood.burst(center, -d, n * 0.15, spread=0.25, speed=(250, 800))
            self.fx.append(CutLine(center, a, t, length=240 * e.scale))
        self.fx.append(Flash(center, t, (cut_angles or [cmath.phase(vdir)])[0],
                             size=1.0 if strong else 0.7))
        self.shake.add(real_t, 13 if strong else 6)

    # -- drawing --------------------------------------------------------------------
    def camera(self, s, real_t):
        """(zoom, focus_x, shake offset): zooms towards the hero in slow motion."""
        k = self.warp.slow_amount(s)
        k = k * k * (3 - 2 * k)
        zoom = config.CAMERA_ZOOM * (1.0 + 0.16 * k)
        cx = config.SCENE_W / 2
        focus_x = cx + (self.hero.x_at(s) - cx) * k
        return zoom, focus_x, self.shake.offset(real_t)

    def draw_background(self, ctx):
        import cairo
        W, H = config.SCENE_W, config.SCENE_H
        g = cairo.RadialGradient(W / 2, H * 0.55, 60, W / 2, H * 0.55, W * 0.75)
        g.add_color_stop_rgb(0, *config.BG_CENTER)
        g.add_color_stop_rgb(1, *config.BG_EDGE)
        ctx.rectangle(0, 0, W, H)
        ctx.set_source(g)
        ctx.fill()

    def draw_floor(self, ctx):
        import cairo
        W, H = config.SCENE_W, config.SCENE_H
        gy = config.GROUND_Y
        g = cairo.LinearGradient(0, gy - 6, 0, gy + 90)
        g.add_color_stop_rgba(0, 0, 0, 0, 0.0)
        g.add_color_stop_rgba(0.12, 0, 0, 0, 0.05)
        g.add_color_stop_rgba(1, 0, 0, 0, 0.0)
        ctx.rectangle(-400, gy - 6, W + 800, 200)
        ctx.set_source(g)
        ctx.fill()

    def draw_shadow(self, ctx, x, width, height_above=0.0):
        k = max(0.25, 1 - height_above / 320.0)
        ctx.save()
        ctx.translate(x, config.GROUND_Y + 3)
        ctx.scale(width * k, 9 * k)
        ctx.arc(0, 0, 1, 0, 2 * math.pi)
        ctx.restore()
        ctx.set_source_rgba(*config.SHADOW, 0.16 * k)
        ctx.fill()

    def smear_samples(self, s, side):
        hero, w = self.hero, self.hero.weapon
        out = []
        for i in range(SMEAR_SAMPLES + 1):
            tt = s - SMEAR_WINDOW * (1 - i / SMEAR_SAMPLES)
            if tt < 0:
                continue
            if side == "T":
                fr = hero.thrown_frame(tt)
                if fr is None:
                    out = []
                    continue
            else:
                if not hero.held(tt, side) or not hero.trail_at(tt):
                    out = []
                    continue
                fr = hero.weapon_frame(tt, side)
            out.append(w.trail_pair(*fr))
        return out

    def draw(self, ctx, s, real_t):
        zoom, focus_x, off = self.camera(s, real_t)
        self.draw_background(ctx)
        ctx.save()
        cx = config.SCENE_W / 2
        cy = config.CAMERA_ANCHOR_Y + (config.GROUND_Y - 120 - config.CAMERA_ANCHOR_Y) * self.warp.slow_amount(s)
        ctx.translate(cx + off.real, cy + off.imag)
        ctx.scale(zoom, zoom)
        ctx.translate(-focus_x, -cy)
        self.draw_floor(ctx)
        self.blood.draw_decals(ctx)

        hero_body = self.hero.body_at(s)
        hero_pose, _ = self.hero.pose_at(s)
        alive = [e for e in self.c.enemies if e.visible(s)]
        bodies = [(e, e.body_at(s)) for e in alive]
        # shadows
        for e, b in bodies:
            self.draw_shadow(ctx, b.pts["hip"].real, 42 * e.scale, config.GROUND_Y - max(b.pts["footF"].imag, b.pts["footB"].imag))
        for p in self.parts:
            if p.alpha(s) > 0:
                c = p.center()
                self.draw_shadow(ctx, c.real, 30, max(0.0, config.GROUND_Y - c.imag - 30))
        self.draw_shadow(ctx, hero_body.pts["hip"].real, 52 * self.hero.scale, hero_pose["air"] * self.hero.scale)

        for p in self.parts:
            p.draw(ctx, s)
        for e, b in bodies:
            rig.draw_body(ctx, b, e.color, e.line_width)

        # smears behind the hero
        for side in ("B", "F", "T"):
            draw_smear(ctx, self.smear_samples(s, side))

        for sc in self.scarves[::-1]:
            sc.draw(ctx, self.hero.scale)
        hide = () if self.hero.held(s, "F") else ("F",)
        rig.draw_body(ctx, hero_body, self.hero.color, self.hero.line_width,
                      weapon=self.hero.weapon, hide_weapon=hide, eye=True)
        thrown = self.hero.thrown_frame(s)
        if thrown:
            self.hero.weapon.draw(ctx, *thrown)

        self.blood.draw(ctx)
        for f in self.fx:
            f.draw(ctx, s)
        ctx.restore()

        for t0, dur, a in self.screen_flash:
            u = (real_t - t0) / dur
            if 0 <= u <= 1:
                ctx.set_source_rgba(1, 1, 1, a * (1 - u))
                ctx.rectangle(0, 0, config.SCENE_W, config.SCENE_H)
                ctx.fill()
