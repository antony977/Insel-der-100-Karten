"""Easing curves (u in 0..1 -> 0..1). Keyframes reference them by name."""
import math


def linear(u): return u
def in_quad(u): return u * u
def out_quad(u): return 1 - (1 - u) ** 2
def inout_quad(u): return 2 * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 2 / 2
def in_cubic(u): return u ** 3
def out_cubic(u): return 1 - (1 - u) ** 3
def inout_cubic(u): return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2
def out_quint(u): return 1 - (1 - u) ** 5
def in_quint(u): return u ** 5
def inout_sine(u): return -(math.cos(math.pi * u) - 1) / 2


def out_expo(u):
    return 1.0 if u >= 1 else 1 - 2 ** (-10 * u)


def in_expo(u):
    return 0.0 if u <= 0 else 2 ** (10 * u - 10)


def out_back(u, s=1.6):
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


def snap(u):
    """Whip curve for strikes: a split-second acceleration, peak speed at 1/3,
    long soft deceleration. Peak speed is only 1.8x the average, so a fast
    strike spreads over several frames instead of teleporting."""
    return 1 - (1 - u) ** 3 * (1 + 3 * u)


EASES = {name: fn for name, fn in globals().items()
         if callable(fn) and not name.startswith("_") and name != "get" and fn.__module__ == __name__}


def get(e):
    if callable(e):
        return e
    return EASES[e]
