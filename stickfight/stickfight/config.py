"""Global render settings and colour palette."""

# Output canvas (portrait, TikTok)
W, H = 1080, 1920
FPS = 60

# Fight scene = horizontal 16:9 strip centred in the canvas.
SCENE_W = 1080
SCENE_H = 608
SCENE_Y = (H - SCENE_H) // 2
GROUND_Y = 470          # ground line in scene coordinates

# Base camera: slight zoom so the fighters fill the strip like in the trend videos
CAMERA_ZOOM = 1.15
CAMERA_ANCHOR_Y = 300   # scene y that stays fixed when zooming

GRAVITY = 2100.0        # px/s^2 for particles and body parts

# Colours (r, g, b) in 0..1
BG_CENTER = (0.875, 0.875, 0.875)
BG_EDGE = (0.775, 0.775, 0.78)
LETTERBOX = (0.0, 0.0, 0.0)
HERO = (0.05, 0.05, 0.06)
HERO_SCARF = (0.78, 0.06, 0.09)
HERO_SCARF_DARK = (0.50, 0.03, 0.06)
ENEMY = (0.27, 0.27, 0.29)
BLADE = (0.07, 0.07, 0.08)
BLADE_EDGE = (0.62, 0.62, 0.66)
BLOOD = (0.80, 0.05, 0.08)
BLOOD_DARK = (0.62, 0.03, 0.06)
SMEAR = (1.0, 1.0, 1.0)
SHADOW = (0.0, 0.0, 0.0)
