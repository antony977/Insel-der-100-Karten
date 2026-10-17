"""Move library for the dual-scythe hero.

Every move is a factory returning a MoveDef (authored facing right; the
choreography mirrors it when the hero faces left). Register new moves with the
@move decorator and use them in a scene via `choreo.move("name", ...)`.

Reactions (see effects.py / world.py):
    split   cut the body along `cuts` (list of angles in degrees)
    fly     whole body is launched
    behead  head flies off, body collapses
    fall    body topples over
Common reaction params: vel=(forward, up) px/s, spin (deg/s), blood (count).
"""
import math

from .anim import Hit, Key, MoveDef, Throw
from .rig import make_pose

MOVES = {}


def move(fn):
    MOVES[fn.__name__] = fn
    return fn


# ---------------------------------------------------------------------------
# Base poses
# ---------------------------------------------------------------------------
STANCE = make_pose(torso=168, head=-6,
                   aF1=38, aF2=100, aB1=-22, aB2=55,
                   lF1=34, lF2=-6, lB1=-16, lB2=-40,
                   wF=150, rF=0, wB=-150, rB=180)

CROUCH = dict(torso=150, lF1=75, lF2=-25, lB1=10, lB2=-75)


def _breathe(p, t):
    s = math.sin(t * 5.2)
    p["torso"] += 2.0 * s
    p["aF1"] += 3.0 * s
    p["aB1"] -= 2.5 * s
    p["wF"] += 2.0 * math.sin(t * 5.2 + 0.6)
    p["wB"] -= 2.0 * math.sin(t * 5.2 + 0.6)
    p["lF1"] += 2.0 * s
    p["lB2"] -= 2.0 * s
    return p


# ---------------------------------------------------------------------------
# Idle / transitions
# ---------------------------------------------------------------------------
@move
def idle(duration=0.6):
    # breathing comes from the hero's always-on layer (hero._alive)
    return MoveDef("idle", [Key(min(0.22, duration), STANCE, "out_cubic")], duration)


@move
def victory(duration=1.4):
    """Scythes crossed in front of the chest, head down, cool pose."""
    k = [
        Key(0.12, dict(torso=160, aF1=70, aF2=150, aB1=50, aB2=160, wF=250, wB=120), "out_cubic"),
        Key(0.34, dict(x=0, torso=178, head=12, aF1=42, aF2=128, aB1=-42, aB2=-128,
                       wF=214, rF=0, wB=-214, rB=180,
                       lF1=18, lF2=2, lB1=-16, lB2=-6), "out_back"),
    ]
    return MoveDef("victory", k, duration, procedural=lambda p, t: _victory_breathe(p, t))


def _victory_breathe(p, t):
    if t > 0.35:
        s = math.sin((t - 0.35) * 4.0)
        p["torso"] += 1.2 * s
        p["head"] += 1.0 * s
    return p


# ---------------------------------------------------------------------------
# Attacks
# ---------------------------------------------------------------------------
@move
def cross_slash(dist=178, reaction=None):
    """Double cross slash: coil back (anticipation), both scythes whip down in
    an X (strike), swing through (follow-through), recoil and settle."""
    react = reaction or dict(type="split", cuts=[-38, 38], vel=(520, -380), spin=600, blood=46)
    k = [
        # anticipation: weight back, knees bend, both scythes cocked behind the head
        Key(0.17, dict(x=-14, torso=194, head=-12,
                       aF1=196, aF2=212, aB1=162, aB2=188,
                       wF=252, rF=180, wB=228, rB=0,
                       lF1=34, lF2=-14, lB1=-14, lB2=-52), "inout_sine"),
        # moving hold: coil a little further, builds tension
        Key(0.23, dict(x=-18, torso=199, aF1=203, aF2=220, aB1=168, aB2=195,
                       wF=262, wB=238, lF1=38, lF2=-18), "out_quad"),
        # strike: explode forward, blades cross in front
        Key(0.33, dict(x=72, torso=150, head=-16,
                       aF1=72, aF2=62, aB1=90, aB2=100,
                       wF=64, rF=180, wB=84, rB=0,
                       lF1=64, lF2=4, lB1=-42, lB2=-68), "snap"),
        # follow-through: blades keep travelling, body sinks into the lunge
        Key(0.42, dict(x=84, torso=140, head=-20,
                       aF1=48, aF2=34, aB1=64, aB2=70,
                       wF=40, wB=64,
                       lF1=72, lF2=6, lB1=-48, lB2=-74), "out_quad", trail=True),
        # recoil (overshoot back up)
        Key(0.62, dict(x=82, torso=164, head=-8,
                       aF1=58, aF2=96, aB1=40, aB2=120,
                       wF=118, wB=-118,
                       lF1=44, lF2=-4, lB1=-26, lB2=-46), "out_back"),
        # settle into stance
        Key(0.9, dict(STANCE, x=80), "inout_cubic"),
    ]
    hits = [Hit(0.282, 0, "damage", 1, dist, react, strong=True)]
    return MoveDef("cross_slash", k, 0.9, hits)


@move
def slash_side(dist=160, reaction=None):
    """Fast horizontal swing with the front scythe."""
    react = reaction or dict(type="behead", vel=(380, -620), spin=900, blood=30)
    k = [
        Key(0.10, dict(torso=178, aF1=-70, aF2=-80, wF=-100, rF=180, aB1=40, aB2=110, wB=170,
                       lF1=28, lF2=-6, lB1=-20, lB2=-38), "out_cubic"),
        Key(0.22, dict(x=40, torso=158, aF1=95, aF2=96, wF=110, rF=180,
                       lF1=50, lF2=0, lB1=-34, lB2=-58), "snap"),
        Key(0.30, dict(aF1=110, aF2=125, wF=165), "out_quad", trail=True),
        Key(0.48, dict(STANCE, x=40), "out_cubic"),
    ]
    hits = [Hit(0.175, 0, "damage", 1, dist, react)]
    return MoveDef("slash_side", k, 0.48, hits)


@move
def slash_up(dist=150, reaction=None):
    """Rising slash with the back scythe, launches the enemy."""
    react = reaction or dict(type="fly", vel=(300, -1050), spin=1100, blood=30)
    k = [
        Key(0.11, dict(torso=150, aB1=-40, aB2=-30, wB=-30, rB=0,
                       aF1=-20, aF2=30, wF=200,
                       lF1=60, lF2=-20, lB1=-5, lB2=-60), "out_cubic"),
        Key(0.24, dict(x=30, air=10, torso=192, aB1=170, aB2=175, wB=195, rB=0,
                       aF1=30, aF2=80, wF=140,
                       lF1=30, lF2=0, lB1=-20, lB2=-10), "snap"),
        Key(0.5, dict(STANCE, x=30), "out_cubic"),
    ]
    hits = [Hit(0.18, 0, "damage", 1, dist, react, strong=True)]
    return MoveDef("slash_up", k, 0.5, hits)


@move
def jump_slash(dist=160, reaction=None):
    """Crouch, front-flip jump, slam both scythes down."""
    react = reaction or dict(type="split", cuts=[88], vel=(150, -260), spin=300, blood=56, spread=1.0)
    k = [
        Key(0.14, dict(CROUCH, air=0, aF1=-50, aF2=-40, aB1=-60, aB2=-50, wF=-110, wB=-95), "inout_cubic"),
        Key(0.31, dict(x=50, air=115, rot=190, torso=160, lF1=140, lF2=25, lB1=125, lB2=8,
                       aF1=120, aF2=170, aB1=110, aB2=160, wF=200, rF=0, wB=190, rB=0), "out_quad"),
        Key(0.42, dict(x=95, air=95, rot=360, torso=188, aF1=205, aF2=218, aB1=192, aB2=208,
                       wF=245, wB=235, lF1=70, lF2=-10, lB1=20, lB2=-40), "linear"),
        Key(0.53, dict(x=125, air=0, torso=140, head=-15, aF1=60, aF2=35, aB1=75, aB2=50,
                       wF=-5, wB=10, lF1=85, lF2=-15, lB1=-15, lB2=-80), "in_quad", trail=True),
        Key(0.92, dict(STANCE, x=125), "out_cubic"),
    ]
    hits = [Hit(0.51, 0, "damage", 1, dist, react, strong=True)]
    fx = [(0.53, "dust", dict(at="front", power=1.4)), (0.53, "shock", {})]
    return MoveDef("jump_slash", k, 0.92, hits, fx)


@move
def boomerang(d1=210, d2=330, r1=None, r2=None):
    """Throw the front scythe like a boomerang, it cuts two enemies and comes back."""
    r1 = r1 or dict(type="split", cuts=[-15], vel=(260, -300), spin=700, blood=34)
    r2 = r2 or dict(type="fly", vel=(520, -560), spin=900, blood=30)
    k = [
        Key(0.15, dict(torso=192, aF1=-130, aF2=-160, wF=-200, rF=0,
                       aB1=30, aB2=110, wB=160, rB=180,
                       lF1=20, lF2=-8, lB1=-25, lB2=-38), "inout_cubic"),
        Key(0.25, dict(x=25, torso=155, aF1=88, aF2=86, wF=60,
                       lF1=50, lF2=0, lB1=-36, lB2=-60), "snap"),
        Key(0.55, dict(torso=165, aF1=55, aF2=95, aB1=10, aB2=120), "out_cubic"),
        Key(0.98, dict(aF1=75, aF2=95, torso=162), "inout_cubic"),
        Key(1.06, dict(aF1=35, aF2=70, torso=178, wF=160, rF=0), "out_back"),
        Key(1.3, dict(STANCE, x=25), "out_cubic"),
    ]
    hits = [Hit("throw", 0, "damage", 1, d1, r1, strong=False, lead=0.35),
            Hit("throw", 1, "damage", 1, d2, r2, strong=True, lead=0.35)]
    throw = Throw("F", release=0.22, catch=1.02, dist=d2 - 40, rise=50, spins=4.5)
    return MoveDef("boomerang", k, 1.3, hits, throw=throw)


@move
def hook_pull(reaction=None):
    """Hook an enemy at range with the front scythe, yank him in, cut with the back one."""
    react = reaction or dict(type="split", cuts=[-60], vel=(240, -900), spin=900, blood=46)
    k = [
        Key(0.13, dict(torso=185, aF1=-60, aF2=-30, wF=-60, rF=0, aB1=20, aB2=80, wB=-110, rB=0,
                       lF1=24, lF2=-8, lB1=-24, lB2=-40), "out_cubic"),
        Key(0.27, dict(x=45, torso=138, head=-20, aF1=98, aF2=94, wF=100, rF=180,
                       aB1=-30, aB2=-20, wB=-115,
                       lF1=66, lF2=8, lB1=-48, lB2=-70), "snap"),
        Key(0.36, dict(x=40), "linear"),
        Key(0.58, dict(x=-5, torso=196, head=0, aF1=-35, aF2=10, wF=125,
                       aB1=-45, aB2=-25, wB=-105,
                       lF1=40, lF2=10, lB1=-10, lB2=-30), "inout_cubic"),
        Key(0.70, dict(torso=168, aB1=165, aB2=172, wB=205, rB=0,
                       aF1=-10, aF2=40, lF1=40, lF2=-6, lB1=-20, lB2=-42), "snap"),
        Key(1.0, dict(STANCE, x=-5), "out_cubic"),
    ]
    hits = [Hit(0.27, 0, "hook", 1, "hook", {}, lead=0.5),
            Hit(0.64, 0, "damage", 1, None, react, strong=True)]
    return MoveDef("hook_pull", k, 1.0, hits)


@move
def backflip_dodge(dist=200, lunge_to=40):
    """The enemy lunges with a flying kick, the hero backflips away."""
    k = [
        Key(0.10, dict(torso=176, lF1=40, lF2=-30, lB1=0, lB2=-55, aF1=10, aF2=80, aB1=-30, aB2=40), "out_cubic"),
        Key(0.42, dict(x=-150, air=130, rot=-300, torso=170, lF1=120, lF2=-10, lB1=110, lB2=-20,
                       aF1=100, aF2=150, aB1=-100, aB2=-150, wF=230, wB=-60), "out_quad"),
        Key(0.56, dict(x=-185, air=0, rot=-360, torso=160, lF1=70, lF2=-25, lB1=-5, lB2=-70,
                       aF1=60, aF2=100, aB1=-60, aB2=-20), "in_quad"),
        Key(0.78, dict(STANCE, x=-185), "out_cubic"),
    ]
    hits = [Hit(0.08, 0, "attack", 1, dist, dict(lunge_to=lunge_to, dur=0.42), lead=0.4)]
    fx = [(0.56, "dust", dict(at="feet", power=0.8))]
    return MoveDef("backflip_dodge", k, 0.78, hits, fx)


@move
def dash_slash(dist=260, reaction=None):
    """Dash forward and cut through the enemy while passing."""
    react = reaction or dict(type="split", cuts=[-8], vel=(-160, -320), spin=500, blood=40)
    k = [
        Key(0.10, dict(torso=150, aF1=-40, aF2=-20, wF=-80, rF=180, aB1=-50, aB2=-30, wB=-70,
                       lF1=60, lF2=-20, lB1=-10, lB2=-70), "out_cubic"),
        Key(0.24, dict(x=230, torso=140, aF1=110, aF2=120, wF=150, aB1=-70, aB2=-90, wB=-100,
                       lF1=80, lF2=10, lB1=-60, lB2=-80), "snap"),
        Key(0.55, dict(STANCE, x=230), "out_cubic"),
    ]
    hits = [Hit(0.19, 0, "damage", 1, dist, react, strong=True)]
    fx = [(0.12, "dust", dict(at="feet", power=0.7))]
    return MoveDef("dash_slash", k, 0.55, hits, fx)


@move
def whirlwind(enemies=(), spins=2, slow=(0.30, 1.05, 0.28)):
    """360-degree whirl with both scythes stretched out; hits both sides.

    `enemies` = list of (side, dist, wave) tuples; wave 0..spins*2-1 picks the
    half-turn that hits them.
    """
    t0, t1 = 0.30, 1.15
    yaw_end = 360 * spins
    k = [
        Key(0.22, dict(torso=150, yaw=-50, aF1=40, aF2=120, aB1=60, aB2=110, wF=-160, rF=180, wB=200, rB=0,
                       lF1=72, lF2=-30, lB1=-30, lB2=-70), "inout_cubic"),
        Key(t0, dict(torso=172, yaw=0, air=25, aF1=95, aF2=92, aB1=-92, aB2=-90, wF=98, rF=180, wB=-98, rB=0,
                     lF1=30, lF2=-5, lB1=-30, lB2=-10), "out_quad", trail=True),
        Key(t1, dict(yaw=yaw_end, air=10), "linear", trail=True),
        Key(1.28, dict(yaw=yaw_end + 25, air=0, torso=150, aF1=110, aF2=120, aB1=-110, aB2=-120,
                       lF1=70, lF2=-25, lB1=-25, lB2=-70), "out_cubic"),
        Key(1.7, dict(STANCE, yaw=yaw_end), "inout_cubic"),
    ]
    hits = []
    for i, (side, dist, wave) in enumerate(enemies):
        # arms are horizontal (pointing at both sides) every half turn
        yaw_hit = 180 * (wave + 1)
        u = yaw_hit / yaw_end
        t = t0 + (t1 - t0) * u - 0.012 * (dist - 150) / 50.0
        react = dict(type="split" if i % 3 != 2 else "fly",
                     cuts=[(-6 if i % 2 else 8) + 4 * wave], vel=(560 + dist, -420 - 80 * (i % 3)),
                     spin=800 + 200 * (i % 3), blood=34)
        hits.append(Hit(t, i, "damage", side, dist, react, strong=(i % 2 == 0), lead=0.35))
    fx = [(t1 + 0.02, "shock", dict(big=True)), (1.28, "dust", dict(at="feet", power=1.2))]
    return MoveDef("whirlwind", k, 1.7, hits, fx, slowmo=slow)
