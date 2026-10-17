"""Visual effects: blood particles + floor decals, sliced body parts,
impact flashes, cut lines, dust, shockwaves, smear trails, camera shake."""
import cmath
import math

from . import config

G = config.GRAVITY
GROUND = config.GROUND_Y
TAU = 2 * math.pi


# ---------------------------------------------------------------------------
# Blood
# ---------------------------------------------------------------------------
class Blood:
    MAX_DECALS = 450

    def __init__(self, rng):
        self.rng = rng
        self.ps = []        # [pos, vel, radius, floor_offset]
        self.decals = []    # (pos, rx, ry, angle, dark)

    def burst(self, pos, direction, n, speed=(250, 900), spread=0.55, up=240, size=(1.8, 4.6)):
        rng = self.rng
        base = cmath.phase(direction)
        for _ in range(int(n)):
            a = base + rng.gauss(0, spread)
            sp = rng.uniform(*speed)
            v = cmath.exp(1j * a) * sp + complex(0, -up * rng.random())
            r = rng.uniform(*size)
            if rng.random() < 0.1:
                r *= 1.6
            p = pos + complex(rng.gauss(0, 6), rng.gauss(0, 6))
            self.ps.append([p, v, r, rng.uniform(-12, 34)])

    def step(self, dt):
        keep = []
        for p in self.ps:
            p[1] = complex(p[1].real * (1 - 0.6 * dt), p[1].imag + G * dt)
            p[0] += p[1] * dt
            floor = GROUND + p[3]
            if p[0].imag >= floor and p[1].imag > 0:
                sp = abs(p[1].real)
                if self.rng.random() < 0.55:
                    rx = p[2] * (1.2 + min(sp / 350.0, 1.8))
                    self.decals.append((complex(p[0].real, floor), rx, p[2] * 0.45,
                                        self.rng.random() < 0.35))
            elif -400 < p[0].real < config.SCENE_W + 400 and p[0].imag > -600:
                keep.append(p)
        self.ps = keep
        if len(self.decals) > self.MAX_DECALS:
            self.decals = self.decals[-self.MAX_DECALS:]

    def draw_decals(self, ctx):
        for pos, rx, ry, dark in self.decals:
            ctx.save()
            ctx.translate(pos.real, pos.imag)
            ctx.scale(rx, ry)
            ctx.arc(0, 0, 1, 0, TAU)
            ctx.restore()
            ctx.set_source_rgba(*(config.BLOOD_DARK if dark else config.BLOOD), 0.95)
            ctx.fill()

    def draw(self, ctx):
        ctx.set_line_cap(1)
        for pos, vel, r, _ in self.ps:
            tail = pos - vel * 0.014
            ctx.set_source_rgba(*config.BLOOD, 1.0)
            ctx.set_line_width(r * 2)
            ctx.move_to(tail.real, tail.imag)
            ctx.line_to(pos.real, pos.imag)
            ctx.stroke()


# ---------------------------------------------------------------------------
# Body parts (rigid stick pieces after a hit)
# ---------------------------------------------------------------------------
def _side(q, p0, d):
    return ((q - p0) * d.conjugate()).imag


def slice_group(lines, circles, stumps, p0, d):
    """Split polylines/circles by the infinite line p0 + s*d. Returns two groups."""
    out = {1: ([], [], list()), -1: ([], [], list())}
    for pl in lines:
        cur = [pl[0]]
        sd = 1 if _side(pl[0], p0, d) >= 0 else -1
        for q in pl[1:]:
            sq = 1 if _side(q, p0, d) >= 0 else -1
            if sq != sd:
                a, b = cur[-1], q
                da, db = _side(a, p0, d), _side(b, p0, d)
                x = a + (b - a) * (da / (da - db)) if da != db else a
                cur.append(x)
                if len(cur) > 1:
                    out[sd][0].append(cur)
                out[sd][2].append(x)
                out[sq][2].append(x)
                cur = [x, q]
                sd = sq
            else:
                cur.append(q)
        if len(cur) > 1:
            out[sd][0].append(cur)
    for c, r in circles:
        s = _side(c, p0, d)
        if abs(s) < r * 0.6:
            # cut through the head: keep it whole but on the closer side
            pass
        out[1 if s >= 0 else -1][1].append((c, r))
    for s in stumps:
        out[1 if _side(s, p0, d) >= 0 else -1][2].append(s)
    return [g for g in (out[1], out[-1]) if g[0] or g[1]]


class Part:
    def __init__(self, lines, circles, stumps, color, lw, vel, angv, rng, floor_off=0.0, t0=0.0):
        pts = [q for pl in lines for q in pl] + [c for c, _ in circles]
        com = sum(pts) / len(pts)
        self.pos = com
        self.lines = [[q - com for q in pl] for pl in lines]
        self.circles = [(c - com, r) for c, r in circles]
        self.stumps = [s - com for s in stumps]
        self.color = color
        self.lw = lw
        self.vel = vel
        self.angv = angv
        self.ang = 0.0
        self.rng = rng
        self.floor = GROUND + floor_off
        self.bleed_until = t0 + 0.55
        self.t0 = t0
        self.resting = 0.0
        # principal axis (for settling flat on the ground)
        if len(pts) > 1:
            sxx = sum((q - com).real ** 2 for q in pts)
            syy = sum((q - com).imag ** 2 for q in pts)
            sxy = sum((q - com).real * (q - com).imag for q in pts)
            self.axis = 0.5 * math.atan2(2 * sxy, sxx - syy)
        else:
            self.axis = 0.0

    def to_world(self, q):
        return self.pos + q * cmath.exp(1j * self.ang)

    def alpha(self, t):
        age = t - self.t0
        return max(0.0, min(1.0, 1.0 - (age - 2.3) / 0.7))

    def step(self, dt, t, blood):
        self.vel += complex(0, G * dt)
        self.pos += self.vel * dt
        self.ang += self.angv * dt
        rot = cmath.exp(1j * self.ang)
        low = -1e9
        for pl in self.lines:
            for q in pl:
                low = max(low, (q * rot).imag + self.lw * 0.5)
        for c, r in self.circles:
            low = max(low, (c * rot).imag + r)
        pen = self.pos.imag + low - self.floor
        if pen > 0:
            self.pos -= complex(0, pen)
            if self.vel.imag > 220:
                self.vel = complex(self.vel.real * 0.55, -self.vel.imag * 0.28)
                self.angv *= 0.55
            else:
                self.vel = complex(self.vel.real * math.exp(-7 * dt), min(self.vel.imag, 0))
                # settle flat: torque towards the nearest horizontal orientation
                wa = self.axis + self.ang
                self.angv += -26.0 * math.sin(2 * wa) * dt * 10
                self.angv *= math.exp(-6 * dt)
                self.resting += dt
        if t < self.bleed_until and self.stumps and blood is not None:
            for s in self.stumps[:2]:
                if self.rng.random() < dt * 40:
                    w = self.to_world(s)
                    out = (w - self.pos)
                    out = out / abs(out) if abs(out) > 1e-3 else complex(0, -1)
                    blood.burst(w, out + self.vel / 2500.0, 1, speed=(120, 380), spread=0.35, up=80,
                                size=(1.8, 3.6))

    def draw(self, ctx, t):
        a = self.alpha(t)
        if a <= 0:
            return
        rot = cmath.exp(1j * self.ang)
        ctx.set_line_cap(1)
        ctx.set_line_join(1)
        ctx.set_source_rgba(*self.color, a)
        ctx.set_line_width(self.lw)
        for pl in self.lines:
            w = [self.pos + q * rot for q in pl]
            ctx.move_to(w[0].real, w[0].imag)
            for q in w[1:]:
                ctx.line_to(q.real, q.imag)
            ctx.stroke()
        for c, r in self.circles:
            w = self.pos + c * rot
            ctx.arc(w.real, w.imag, r, 0, TAU)
            ctx.fill()
        ctx.set_source_rgba(*config.BLOOD, a)
        for s in self.stumps:
            w = self.pos + s * rot
            ctx.arc(w.real, w.imag, self.lw * 0.62, 0, TAU)
            ctx.fill()

    def shadow_x(self):
        return self.pos.real


# ---------------------------------------------------------------------------
# Short-lived overlay effects (all timed in scene time)
# ---------------------------------------------------------------------------
class Flash:
    def __init__(self, pos, t0, angle, size=1.0, dur=0.09):
        self.pos, self.t0, self.angle, self.size, self.dur = pos, t0, angle, size, dur

    def alive(self, t):
        return t < self.t0 + self.dur

    def draw(self, ctx, t):
        u = (t - self.t0) / self.dur
        if not 0 <= u <= 1:
            return
        s = self.size * (0.6 + 0.8 * u)
        ctx.save()
        ctx.translate(self.pos.real, self.pos.imag)
        ctx.rotate(self.angle)
        ctx.set_source_rgba(1, 1, 1, 1 - u ** 2)
        # long thin diamond + short cross diamond = anime impact star
        for L, Wd in ((150 * s, 13 * s), (55 * s, 9 * s)):
            ctx.move_to(-L, 0)
            ctx.line_to(0, -Wd)
            ctx.line_to(L, 0)
            ctx.line_to(0, Wd)
            ctx.close_path()
            ctx.fill()
            ctx.rotate(math.pi / 2)
        ctx.restore()
        ctx.set_source_rgba(1, 1, 1, 0.9 * (1 - u))
        ctx.set_line_width(4 * (1 - u) + 1)
        ctx.arc(self.pos.real, self.pos.imag, 20 * s + 60 * u * s, 0, TAU)
        ctx.stroke()


class CutLine:
    """Thin white slash line across the target right after the cut."""

    def __init__(self, pos, angle, t0, length=260, dur=0.16):
        self.pos, self.angle, self.t0, self.length, self.dur = pos, angle, t0, length, dur

    def alive(self, t):
        return t < self.t0 + self.dur

    def draw(self, ctx, t):
        u = (t - self.t0) / self.dur
        if not 0 <= u <= 1:
            return
        d = cmath.exp(1j * self.angle)
        L = self.length * (0.75 + 0.35 * u)
        w = 7 * (1 - u) ** 1.5 + 0.5
        n = d * 1j
        a = self.pos - d * L / 2
        b = self.pos + d * L / 2
        ctx.set_source_rgba(1, 1, 1, 1 - u ** 3)
        ctx.move_to(a.real, a.imag)
        m1 = self.pos + n * w
        m2 = self.pos - n * w
        ctx.line_to(m1.real, m1.imag)
        ctx.line_to(b.real, b.imag)
        ctx.line_to(m2.real, m2.imag)
        ctx.close_path()
        ctx.fill()


class Dust:
    def __init__(self, pos, t0, rng, power=1.0, n=9):
        self.t0 = t0
        self.dur = 0.55
        self.puffs = []
        for _ in range(int(n * power)):
            vx = rng.uniform(-1, 1) * 260 * power
            self.puffs.append((pos + complex(rng.uniform(-20, 20), rng.uniform(-4, 4)),
                               vx, rng.uniform(10, 22) * power, rng.uniform(0.7, 1.0)))

    def alive(self, t):
        return t < self.t0 + self.dur

    def draw(self, ctx, t):
        u = (t - self.t0) / self.dur
        if not 0 <= u <= 1:
            return
        k = 1 - (1 - u) ** 3
        for pos, vx, r, life in self.puffs:
            if u > life:
                continue
            uu = u / life
            x = pos.real + vx * 0.35 * k
            y = pos.imag - 26 * k
            ctx.set_source_rgba(0.96, 0.96, 0.96, 0.75 * (1 - uu))
            ctx.arc(x, y, r * (0.6 + 1.2 * k), 0, TAU)
            ctx.fill()


class Shock:
    """Flat white ring expanding over the floor."""

    def __init__(self, pos, t0, big=False):
        self.pos, self.t0 = pos, t0
        self.dur = 0.5 if big else 0.3
        self.r = 520 if big else 230

    def alive(self, t):
        return t < self.t0 + self.dur

    def draw(self, ctx, t):
        u = (t - self.t0) / self.dur
        if not 0 <= u <= 1:
            return
        k = 1 - (1 - u) ** 3
        ctx.save()
        ctx.translate(self.pos.real, self.pos.imag)
        ctx.scale(1, 0.16)
        ctx.set_source_rgba(1, 1, 1, 0.9 * (1 - u))
        ctx.set_line_width(26 * (1 - u) + 2)
        ctx.arc(0, 0, 30 + self.r * k, 0, TAU)
        ctx.stroke()
        ctx.restore()


class Shake:
    """Camera shake driven by real (not scene) time, so it runs during hit-stop."""

    def __init__(self):
        self.events = []

    def add(self, real_t, amp, dur=0.28):
        self.events.append((real_t, amp, dur))

    def offset(self, real_t):
        x = y = 0.0
        for t0, amp, dur in self.events:
            u = (real_t - t0) / dur
            if 0 <= u <= 1:
                k = amp * (1 - u) ** 2
                x += k * (math.sin(real_t * 97 + t0 * 13) * 0.6 + math.sin(real_t * 61 + 2) * 0.4)
                y += k * (math.sin(real_t * 83 + t0 * 7) * 0.6 + math.sin(real_t * 47 + 1) * 0.4)
        return complex(x, y)


# ---------------------------------------------------------------------------
# Smear trails
# ---------------------------------------------------------------------------
def draw_smear(ctx, samples, min_len=70.0, max_jump=420.0, alpha=0.92):
    """samples: list of (outer, inner) points, oldest first."""
    if len(samples) < 3:
        return
    outer = [s[0] for s in samples]
    path = 0.0
    for a, b in zip(outer, outer[1:]):
        step = abs(b - a)
        if step > max_jump:
            return
        path += step
    if path < min_len:
        return
    k = min(1.0, (path - min_len) / 90.0) * alpha
    n = len(samples) - 1
    inner = []
    for i, (o, inn) in enumerate(samples):
        f = (i / n) ** 1.3
        inner.append(o + (inn - o) * f)
    ctx.set_source_rgba(*config.SMEAR, k)
    ctx.move_to(outer[0].real, outer[0].imag)
    for q in outer[1:]:
        ctx.line_to(q.real, q.imag)
    for q in reversed(inner):
        ctx.line_to(q.real, q.imag)
    ctx.close_path()
    ctx.fill()
