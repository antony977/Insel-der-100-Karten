"""Runtime: steps stateful things (particles, parts, scarf) through scene
time, handles hit events and draws the fight scene in strip coordinates."""
import cmath
import math

from . import config, effects, rig
from .effects import Blood, CutLine, Dust, Flash, Part, Shake, Shock, draw_smear

SUBSTEP = 1 / 120.0
SMEAR_WINDOW = 0.085
SMEAR_SAMPLES = 12


class Scarf:
    """Verlet ribbon tied to the hero's neck."""

    def __init__(self, n=11, seg=11.0):
        self.n, self.seg = n, seg
        self.pts = None
        self.prev = None

    def anchor(self, body):
        p = body.pts
        return p["neck"] + (p["head"] - p["neck"]) * 0.12

    def step(self, dt, body, t):
        a = self.anchor(body)
        seg = self.seg * body.scale
        if self.pts is None:
            self.pts = [a + complex(-body.facing * seg * i, 0) for i in range(self.n)]
            self.prev = list(self.pts)
        f = body.facing
        new = [a]
        for i in range(1, self.n):
            p, q = self.pts[i], self.prev[i]
            wind = complex(-f * (1500 + 600 * math.sin(t * 6.0 + i * 0.5)),
                           -420 + 1500 * math.sin(t * 13.0 - i * 0.8))
            acc = wind + complex(0, 500)
            new.append(p + (p - q) * 0.93 + acc * dt * dt)
        self.prev = self.pts
        self.pts = new
        for _ in range(4):
            self.pts[0] = a
            for i in range(1, self.n):
                d = self.pts[i] - self.pts[i - 1]
                L = abs(d) or 1e-6
                corr = d * (1 - seg / L)
                if i == 1:
                    self.pts[i] -= corr
                else:
                    self.pts[i] -= corr * 0.5
                    self.pts[i - 1] += corr * 0.5

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
            w = (7.0 - 4.0 * i / (n - 1)) * scale
            nrm = d * 1j
            left.append(p + nrm * w)
            right.append(p - nrm * w)
        ctx.set_source_rgb(*config.HERO_SCARF)
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
        ctx.arc(pts[0].real, pts[0].imag, 8.5 * scale, 0, 2 * math.pi)
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
        self.scarf = Scarf()
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
            self.scarf.step(dt, self.hero.body_at(nt), nt)
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
        lines = body.segments()
        circles = [(body.pts["head"], body.head_r)]
        lw = e.line_width * e.scale
        rng = self.rng
        typ = react.get("type", "fly")
        cut_angles = []

        def mk(group, v, av):
            ls, cs, st = group
            self.parts.append(Part(ls, cs, st, e.color, lw, v, av, rng, rng.uniform(-6, 10), t))

        if typ == "split":
            groups = [(lines, circles, [])]
            for ang in react.get("cuts", [0]):
                a = math.radians(ang)
                d = complex(away * math.cos(a), math.sin(a))
                cut_angles.append(cmath.phase(d))
                groups = [g2 for g in groups for g2 in effects.slice_group(*g, center, d)]
            for g in groups:
                pts = [q for pl in g[0] for q in pl] + [c for c, _ in g[1]]
                gc = sum(pts) / len(pts)
                rel = gc - center
                sep = rel / abs(rel) * 170 if abs(rel) > 1e-3 else 0
                upper = rel.imag < 0
                k = 1.0 if upper else 0.35
                v = vel * k * rng.uniform(0.85, 1.15) + sep
                mk(g, v, spin * (1.0 if upper else 0.4) * rng.uniform(0.7, 1.3))
        elif typ == "behead":
            neck, head = body.pts["neck"], body.pts["head"]
            p0 = neck + (head - neck) * 0.25
            d = complex(1, 0)
            cut_angles.append(0.0)
            groups = effects.slice_group(lines, circles, [], p0, d)
            for g in groups:
                if g[1]:   # the head side
                    mk(g, vel, spin * 1.4)
                else:
                    mk(g, complex(away * 60, -40), away * 1.6)
            center = p0
        elif typ == "fall":
            mk((lines, circles, []), complex(away * 120, -80), away * 2.6)
        else:  # fly
            mk((lines, circles, [complex(center.real, center.imag)]), vel, spin)
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
                self.draw_shadow(ctx, p.pos.real, 26, max(0.0, config.GROUND_Y - p.pos.imag - 20))
        self.draw_shadow(ctx, hero_body.pts["hip"].real, 52 * self.hero.scale, hero_pose["air"] * self.hero.scale)

        for p in self.parts:
            p.draw(ctx, s)
        for e, b in bodies:
            rig.draw_body(ctx, b, e.color, e.line_width)

        # smears behind the hero
        for side in ("B", "F", "T"):
            draw_smear(ctx, self.smear_samples(s, side))

        self.scarf.draw(ctx, self.hero.scale)
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
