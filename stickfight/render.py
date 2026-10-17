#!/usr/bin/env python3
"""Render the stickman fight.

    python render.py --preview          # first 3 s at 30 fps + a few stills
    python render.py                    # full video, 60 fps
    python render.py --stills 1.2 4.5   # only save stills at these times (s)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from stickfight import scene  # noqa: E402
from stickfight.video import Renderer, render_video  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="short low-fps preview")
    ap.add_argument("--seconds", type=float, default=None, help="limit rendered length")
    ap.add_argument("--fps", type=int, default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--stills", type=float, nargs="*", default=None, help="times (s) to save as PNG")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    os.makedirs("out", exist_ok=True)
    fps = args.fps or (30 if args.preview else 60)
    seconds = args.seconds or (3.0 if args.preview else None)
    out = args.out or ("out/preview.mp4" if args.preview else "out/stickfight.mp4")

    choreo = scene.build(seed=args.seed)
    r = Renderer(choreo, fps=fps)
    print(f"scene length {choreo.end_time:.2f}s -> video length {r.duration:.2f}s at {fps} fps "
          f"({len(choreo.enemies)} enemies, {len(choreo.hitstops)} hits)")
    limit = None if seconds is None else int(round(seconds * fps))
    stills = args.stills
    if stills is None:
        stills = [0.5, 1.15, 1.6, 2.2, 2.6, 2.9] if args.preview else []
    frames = {int(round(t * fps)) for t in stills}
    if args.stills is not None and not args.preview and args.seconds is None:
        limit = max(frames) + 1
        for i, real_t, s, surf in r.frames(limit):
            if i in frames:
                surf.write_to_png(f"out/still_{real_t:05.2f}s.png")
        return
    n = render_video(r, out, limit=limit, png_frames=frames,
                     png_pattern="out/frame_{i:04d}.png")
    print(f"wrote {out} ({n} frames)")


if __name__ == "__main__":
    main()
