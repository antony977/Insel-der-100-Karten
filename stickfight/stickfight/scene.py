"""The actual 15-second fight. Edit this file to change the choreography."""
from .choreo import Choreo

F, B = +1, -1   # hero faces right / left


def build_cross_test(seed=7):
    """2-second test clip: one enemy runs in, double cross slash, ragdoll."""
    c = Choreo(seed=seed, hero_x=470)
    c.idle(0.55, facing=F)
    c.move("cross_slash", F, [c.enemy()])
    c.idle(0.5)
    return c


SCENES = {}


def build(seed=7):
    c = Choreo(seed=seed, hero_x=540)
    E = c.enemy

    # 0-3 s: hero ready, single enemies come in one at a time
    c.idle(0.95, facing=F)
    c.move("cross_slash", F, [E()])
    c.idle(0.2, facing=B)
    c.move("hook_pull", B, [E()])

    # 3-10 s: more enemies from both sides, fast combos
    c.move("boomerang", B, [E(), E()], d1=250, d2=385)
    kicker = E()
    c.move("backflip_dodge", F, [kicker])
    c.move("hook_pull", F, [kicker])
    c.move("slash_side", B, [E()])
    c.move("jump_slash", F, [E()])
    c.move("slash_up", B, [E()])
    c.move("dash_slash", F, [E()])
    c.move("cross_slash", B, [E()], speed=1.2,
           reaction=dict(type="fly", vel=(620, -520), spin=1000, blood=40))

    # 10-14 s: a big group from both sides, slow-motion whirlwind finale
    c.idle(0.35, facing=F)
    crowd = [(F, 160, 0), (B, 165, 0), (F, 200, 1), (B, 205, 1),
             (F, 235, 2), (B, 240, 2), (F, 285, 3), (B, 290, 3)]
    c.move("whirlwind", F, c.group(len(crowd)), enemies=crowd)

    # 14-15 s: victory pose, scythes crossed
    c.move("victory", F, duration=1.25)
    return c


SCENES.update(full=build, cross=build_cross_test)
