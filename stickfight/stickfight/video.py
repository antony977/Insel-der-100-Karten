"""Frame rendering (portrait canvas + letterboxed fight strip) and MP4 export via ffmpeg."""
import subprocess
import time

import cairo

from . import config
from .choreo import TimeWarp
from .world import World


class Renderer:
    def __init__(self, choreo, fps=config.FPS, overlays=(), tail=0.0):
        self.choreo = choreo
        self.fps = fps
        self.warp = TimeWarp(choreo.hitstops, choreo.slowmos)
        self.scene_times = self.warp.frames(choreo.end_time, fps, hold_end=tail)
        self.world = World(choreo, self.warp)
        self.overlays = list(overlays)
        self.surface = cairo.ImageSurface(cairo.FORMAT_RGB24, config.W, config.H)

    @property
    def duration(self):
        return len(self.scene_times) / self.fps

    def frames(self, limit=None):
        """Yields (index, real_time, scene_time, surface) for every frame."""
        n = len(self.scene_times) if limit is None else min(limit, len(self.scene_times))
        for i in range(n):
            real_t = i / self.fps
            s = self.scene_times[i]
            self.world.advance(s, real_t)
            self.draw(s, real_t)
            yield i, real_t, s, self.surface

    def draw(self, s, real_t):
        ctx = cairo.Context(self.surface)
        ctx.set_source_rgb(*config.LETTERBOX)
        ctx.paint()
        ctx.save()
        ctx.translate(0, config.SCENE_Y)
        ctx.rectangle(0, 0, config.SCENE_W, config.SCENE_H)
        ctx.clip()
        self.world.draw(ctx, s, real_t)
        ctx.restore()
        for ov in self.overlays:
            ov.draw(ctx, real_t, config.W, config.H)
        self.surface.flush()


def render_video(renderer, out_path, limit=None, png_frames=(), png_pattern=None, crf=17, log_every=60):
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr0", "-s", f"{config.W}x{config.H}",
           "-r", str(renderer.fps), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    png_frames = set(png_frames)
    t0 = time.time()
    count = 0
    for i, real_t, s, surf in renderer.frames(limit):
        proc.stdin.write(bytes(surf.get_data()))
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
