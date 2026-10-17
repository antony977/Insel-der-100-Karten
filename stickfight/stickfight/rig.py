"""Stickman skeleton: pose parameters -> joint positions -> drawing.

Angle convention (degrees, in the character's own frame, facing right):
    0 = straight down, 90 = forward, 180 = up, -90 = backward.
Every limb angle is absolute in the body frame (not relative to its parent),
which makes keyframes easy to author and to interpolate.

Pose keys
    x      forward offset of the hip from the move's start position (px)
    air    height above the ground (px). Feet are auto-planted on the ground.
    rot    whole-body rotation around the belly (+ = front flip direction)
    yaw    rotation around the vertical axis (for horizontal spins)
    torso  direction hip -> neck            head  head tilt relative to torso
    aF1/aF2, aB1/aB2   front/back arm: upper arm, forearm
    lF1/lF2, lB1/lB2   front/back leg: thigh, shin
    wF/wB  weapon handle direction in the front/back hand
    rF/rB  weapon roll (0 = blade on one side, 180 = other side, 90 = edge-on)
"""
import math
from dataclasses import dataclass

from . import config


def dirv(a):
    r = math.radians(a)
    return complex(math.sin(r), math.cos(r))


@dataclass
class Proportions:
    torso: float = 60
    neck: float = 7
    head_r: float = 16
    upper: float = 35
    fore: float = 33
    thigh: float = 46
    shin: float = 47
    shoulder: float = 0.88   # where the arms attach along the torso
    pivot: float = 0.35      # rotation centre along the torso


HERO_PROPS = Proportions()
GRUNT_PROPS = Proportions(torso=58, head_r=15.5, upper=33, fore=32, thigh=45, shin=45)

POSE_KEYS = ("x", "air", "rot", "yaw", "torso", "head",
             "aF1", "aF2", "aB1", "aB2", "lF1", "lF2", "lB1", "lB2",
             "wF", "wB", "rF", "rB")

NEUTRAL = dict(x=0, air=0, rot=0, yaw=0, torso=180, head=0,
               aF1=12, aF2=6, aB1=-12, aB2=-6,
               lF1=10, lF2=0, lB1=-10, lB2=0,
               wF=180, wB=180, rF=0, rB=0)


def make_pose(base=None, **kw):
    p = dict(NEUTRAL if base is None else base)
    p.update(kw)
    return p


def lerp_pose(a, b, u):
    return {k: a[k] + (b[k] - a[k]) * u for k in a}


class Affine:
    """x' = a*x + b*y + tx ; y' = c*x + d*y + ty  (points as complex)."""
    __slots__ = ("a", "b", "c", "d", "tx", "ty")

    def __init__(self, a, b, c, d, tx=0.0, ty=0.0):
        self.a, self.b, self.c, self.d, self.tx, self.ty = a, b, c, d, tx, ty

    def __call__(self, p):
        return complex(self.a * p.real + self.b * p.imag + self.tx,
                       self.c * p.real + self.d * p.imag + self.ty)

    def lin(self, v):
        return complex(self.a * v.real + self.b * v.imag,
                       self.c * v.real + self.d * v.imag)


@dataclass
class Body:
    pts: dict            # joint name -> world position (complex)
    weapons: dict        # "F"/"B" -> (grip, D, N) in world space
    depth: dict          # draw-order depth of limb groups
    affine: Affine
    facing: int
    scale: float
    head_r: float
    eye: complex
    eye_visible: bool

    def segments(self):
        """Polylines of the stick figure (used for slicing on hit)."""
        p = self.pts
        return [[p["footB"], p["kneeB"], p["hip"]],
                [p["footF"], p["kneeF"], p["hip"]],
                [p["hip"], p["neck"]],
                [p["handB"], p["elbowB"], p["shoulder"]],
                [p["handF"], p["elbowF"], p["shoulder"]]]


YAW_TILT = 0.24   # camera looks slightly down: spinning limbs trace ellipses


def solve(p, facing, base_x, ground_y=config.GROUND_Y, scale=1.0, prop=HERO_PROPS, foot_pad=4.5):
    """Forward kinematics: pose dict -> Body in world coordinates."""
    t = dirv(p["torso"])
    neck = t * prop.torso
    sh = t * prop.torso * prop.shoulder
    hdir = dirv(p["torso"] + p["head"])
    head = neck + hdir * (prop.neck + prop.head_r)
    eF = sh + dirv(p["aF1"]) * prop.upper
    hF = eF + dirv(p["aF2"]) * prop.fore
    eB = sh + dirv(p["aB1"]) * prop.upper
    hB = eB + dirv(p["aB2"]) * prop.fore
    kF = dirv(p["lF1"]) * prop.thigh
    fF = kF + dirv(p["lF2"]) * prop.shin
    kB = dirv(p["lB1"]) * prop.thigh
    fB = kB + dirv(p["lB2"]) * prop.shin
    eye = head + dirv(p["torso"] + p["head"] - 90) * prop.head_r * 0.42 + hdir * prop.head_r * 0.12
    local = dict(hip=0j, neck=neck, shoulder=sh, head=head,
                 elbowF=eF, handF=hF, elbowB=eB, handB=hB,
                 kneeF=kF, footF=fF, kneeB=kB, footB=fB)

    # linear part: scale -> yaw (squash + tilt) -> rotation -> facing mirror
    s = scale
    yaw = math.radians(p["yaw"])
    cy, sy = math.cos(yaw), math.sin(yaw)
    ty_ = sy * YAW_TILT          # depth (x*sin(yaw)) pushes points down a bit
    r = math.radians(p["rot"])
    cr, sr = math.cos(r), math.sin(r)
    # Y = [[cy, 0], [ty_, 1]] ; R = [[cr, -sr], [sr, cr]] ; F = [[facing, 0], [0, 1]]
    a = facing * (cr * cy - sr * ty_) * s
    b = facing * -sr * s
    c = (sr * cy + cr * ty_) * s
    d = cr * s
    M = Affine(a, b, c, d)
    # rotation happens around the belly, not the hip
    pv = t * prop.torso * prop.pivot
    pvy = complex(pv.real * cy * s, (pv.imag + pv.real * ty_) * s)
    rot_pv = complex(cr * pvy.real - sr * pvy.imag, sr * pvy.real + cr * pvy.imag)
    off = pvy - rot_pv
    off = complex(facing * off.real, off.imag)

    # plant the lowest point on the ground
    low = -1e9
    for k in ("footF", "footB", "kneeF", "kneeB", "hip"):
        y = M.lin(local[k]).imag + off.imag
        low = max(low, y)
    low = max(low, M.lin(head).imag + off.imag + prop.head_r * s)
    tx = base_x + facing * p["x"] + off.real
    ty = ground_y - foot_pad * s - low - p["air"] * s
    M.tx, M.ty = tx, ty

    pts = {k: M(v) for k, v in local.items()}
    weapons = {}
    for side, hand in (("F", hF), ("B", hB)):
        wa, roll = p["w" + side], p["r" + side]
        D = M.lin(dirv(wa))
        N = M.lin(dirv(wa + 90)) * math.cos(math.radians(roll))
        weapons[side] = (pts["hand" + side], D, N)
    depth = {
        "armF": cy + sy * hF.real / 40.0,
        "armB": -cy + sy * hB.real / 40.0,
        "legF": 0.5 * cy + sy * kF.real / 60.0,
        "legB": -0.5 * cy + sy * kB.real / 60.0,
    }
    return Body(pts=pts, weapons=weapons, depth=depth, affine=M, facing=facing,
                scale=s, head_r=prop.head_r * s, eye=M(eye), eye_visible=abs(cy) > 0.35)


def _poly(ctx, pts):
    ctx.move_to(pts[0].real, pts[0].imag)
    for q in pts[1:]:
        ctx.line_to(q.real, q.imag)


def draw_body(ctx, body, color, lw, weapon=None, hide_weapon=(), alpha=1.0, eye=False):
    """Draw a solved body. Limb groups are sorted by depth so spins look right."""
    p = body.pts
    lw = lw * body.scale
    ctx.set_line_cap(1)   # round
    ctx.set_line_join(1)

    def stroke(pts, width):
        ctx.set_source_rgba(*color, alpha)
        ctx.set_line_width(width)
        _poly(ctx, pts)
        ctx.stroke()

    def arm(side):
        def f():
            if weapon is not None and side not in hide_weapon:
                grip, D, N = body.weapons[side]
                weapon.draw(ctx, grip, D, N, alpha=alpha)
            stroke([p["hand" + side], p["elbow" + side], p["shoulder"]], lw)
            # fist
            ctx.arc(p["hand" + side].real, p["hand" + side].imag, lw * 0.62, 0, 2 * math.pi)
            ctx.fill()
        return f

    def leg(side):
        return lambda: stroke([p["foot" + side], p["knee" + side], p["hip"]], lw)

    def core():
        stroke([p["hip"], p["neck"]], lw * 1.12)
        ctx.set_source_rgba(*color, alpha)
        ctx.arc(p["head"].real, p["head"].imag, body.head_r, 0, 2 * math.pi)
        ctx.fill()
        if eye and body.eye_visible:
            # small angry slit eye
            e = body.eye
            fw = 1 if body.affine.a >= 0 else -1   # visual facing incl. yaw
            ctx.set_source_rgba(1, 1, 1, alpha)
            ctx.move_to(e.real - 5 * body.scale * fw, e.imag - 2.6 * body.scale)
            ctx.line_to(e.real + 5.5 * body.scale * fw, e.imag + 0.4 * body.scale)
            ctx.line_to(e.real - 3 * body.scale * fw, e.imag + 2.4 * body.scale)
            ctx.close_path()
            ctx.fill()

    items = [(body.depth["legB"], leg("B")), (body.depth["legF"], leg("F")),
             (body.depth["armB"], arm("B")), (body.depth["armF"], arm("F")),
             (0.0, core)]
    items.sort(key=lambda it: it[0])
    for _, fn in items:
        fn()
