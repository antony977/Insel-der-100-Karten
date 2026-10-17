"""Layers drawn on the full portrait canvas after the fight strip.

Nothing is used yet (the video has no text). To add a caption later:

    from stickfight.overlays import TextOverlay
    overlays = [TextOverlay("Me if I had to choose a weapon", y=1010, start=0.0, end=15.0)]
    render_video(..., overlays=overlays)
"""
import math


class Overlay:
    def draw(self, ctx, real_t, width, height):
        raise NotImplementedError


class TextOverlay(Overlay):
    def __init__(self, text, y, start=0.0, end=1e9, size=46, font="Sans",
                 color=(1, 1, 1), outline=(0, 0, 0), outline_width=6, fade=0.15):
        self.text, self.y, self.start, self.end = text, y, start, end
        self.size, self.font, self.color = size, font, color
        self.outline, self.outline_width, self.fade = outline, outline_width, fade

    def draw(self, ctx, real_t, width, height):
        if not self.start <= real_t <= self.end:
            return
        a = min(1.0, (real_t - self.start) / self.fade, (self.end - real_t) / self.fade)
        ctx.select_font_face(self.font, 0, 1)
        ctx.set_font_size(self.size)
        ext = ctx.text_extents(self.text)
        x = (width - ext.width) / 2 - ext.x_bearing
        ctx.move_to(x, self.y)
        ctx.text_path(self.text)
        ctx.set_source_rgba(*self.outline, a)
        ctx.set_line_width(self.outline_width)
        ctx.set_line_join(1)
        ctx.stroke_preserve()
        ctx.set_source_rgba(*self.color, a)
        ctx.fill()
