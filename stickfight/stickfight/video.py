"""Frame rendering (portrait canvas + letterboxed fight strip) and MP4 export.

Motion blur: every output frame is the average of several renders spread
over the frame's time span (360 deg shutter). The count adapts to motion:
SUBFRAMES normally, up to MAX_SUBFRAMES when blades move fast, so the blur
stays smooth instead of showing separate ghost copies. Each subframe advances
the simulation, so every one of the 60 frames per second is a unique image.
"""
import subprocess
import time

import cairo
import numpy as np

from . import config
from .choreo import TimeWarp
from .world import World

SUBFRAMES = 6
MAX_SUBFRAMES = 24
BLUR_STEP_PX = 7.0      # aim for at most this much travel between subframes


class Renderer:
    def __init__(self, choreo, fps=config.FPS, overlays=(), subframes=SUBFRAMES, tail=0.0):
        self.choreo = choreo
        self.fps = fps
        self.sub = max(1, subframes)
        self.max_sub = max(self.sub, MAX_SUBFRAMES) if self.sub > 1 else 1
        choreo.hero.bake()
        self.warp = TimeWarp(choreo.hitstops, choreo.slowmos)
        # scene time on a fine grid; frame i owns grid slots i*max_sub .. +max_sub-1
        self.scene_times = self.warp.frames(choreo.end_time, fps * self.max_sub, hold_end=tail)
        self.n_frames = len(self.scene_times) // self.max_sub
        self.world = World(choreo, self.warp)
        self.overlays = list(overlays)
        self.strip = cairo.ImageSurface(cairo.FORMAT_RGB24, config.SCENE_W, config.SCENE_H)
        self.canvas = np.zeros((config.H, config.W, 4), dtype=np.uint8)
        self.surface = cairo.ImageSurface.create_for_data(
            memoryview(self.canvas), cairo.FORMAT_RGB24, config.W, config.H, config.W * 4)
        self.acc = np.zeros((config.SCENE_H, config.SCENE_W, 4), dtype=np.float32)

    @property
    def duration(self):
        return self.n_frames / self.fps

    def frames(self, limit=None):
        """Yields (index, real_time, scene_time, surface) for every output frame."""
        n = self.n_frames if limit is None else min(limit, self.n_frames)
        M = self.max_sub
        slot_dt = 1.0 / (self.fps * M)
        strip = np.ndarray((config.SCENE_H, config.SCENE_W, 4), dtype=np.uint8,
                           buffer=self.strip.get_data())
        self.sub_counts = []
        for i in range(n):
            nsub = self.subframes_for(i)
            self.sub_counts.append(nsub)
            self.acc[:] = 0
            for k in range(nsub):
                j = i * M + int((k + 0.5) * M / nsub) if nsub > 1 else i * M
                s = self.scene_times[j]
                real_t = j * slot_dt
                self.world.advance(s, real_t)
                ctx = cairo.Context(self.strip)
                self.world.draw(ctx, s, real_t)
                self.strip.flush()
                self.acc += strip
            self.acc *= 1.0 / nsub
            real_t = i / self.fps
            self.compose(real_t)
            yield i, real_t, s, self.surface

    def subframes_for(self, i):
        """More subframes when the hero's limbs/blades travel far within the frame."""
        if self.sub <= 1:
            return 1
        M = self.max_sub
        a = self.scene_times[i * M]
        b = self.scene_times[min(i * M + M - 1, len(self.scene_times) - 1)]
        if b - a <= 1e-9:
            return self.sub
        hero, w = self.choreo.hero, self.choreo.hero.weapon
        ba, bb = hero.body_at(a), hero.body_at(b)
        travel = max(abs(ba.pts[k] - bb.pts[k]) for k in ("handF", "handB", "head", "footF", "footB"))
        for side in ("F", "B"):
            if hero.held(a, side) and hero.held(b, side):
                travel = max(travel, abs(w.trail_pair(*ba.weapons[side])[0] - w.trail_pair(*bb.weapons[side])[0]))
        ta, tb = hero.thrown_frame(a), hero.thrown_frame(b)
        if ta and tb:
            travel = max(travel, abs(w.trail_pair(*ta)[0] - w.trail_pair(*tb)[0]))
        need = int(travel / BLUR_STEP_PX) + 1
        for n in (6, 8, 12, 24):
            if n >= need and n >= self.sub:
                return min(n, M)
        return M

    def compose(self, real_t):
        self.canvas[:] = 0
        y0 = config.SCENE_Y
        self.canvas[y0:y0 + config.SCENE_H] = (self.acc + 0.5).astype(np.uint8)
        self.surface.mark_dirty()
        if self.overlays:
            ctx = cairo.Context(self.surface)
            for ov in self.overlays:
                ov.draw(ctx, real_t, config.W, config.H)
            self.surface.flush()


def render_video(renderer, out_path, limit=None, png_frames=(), png_pattern=None, crf=18, log_every=60):
    fps = str(renderer.fps)
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr0", "-s", f"{config.W}x{config.H}",
           "-framerate", fps, "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
           "-r", fps, "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    png_frames = set(png_frames)
    t0 = time.time()
    count = 0
    for i, real_t, s, surf in renderer.frames(limit):
        proc.stdin.write(renderer.canvas.tobytes())
        if i in png_frames and png_pattern:
            surf.write_to_png(png_pattern.format(i=i))
        count += 1
        if log_every and i % log_every == 0:
            print(f"  frame {i:4d}  t={real_t:5.2f}s  scene={s:5.2f}s  ({time.time() - t0:5.1f}s elapsed)", flush=True)
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg failed")
    return count
