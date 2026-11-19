"""Cuts STAND-IN sprite-map source art out of the original painting (assets/world/wildhaven.png).

Writes assets/world/source/{grass,dirt,sand,water}.png (256px seamless ground textures) and
objects/<name>.png (one sprite per world object, soft-edged). These are placeholders: replace any file
with properly generated art of the same name, then run tools/build-map.py. Do not re-run this
script afterwards or it will overwrite the replacements.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world')
OUT = os.path.join(ROOT, 'source'); os.makedirs(os.path.join(OUT, 'objects'), exist_ok=True)
src = Image.open(os.path.join(ROOT, 'wildhaven.png')).convert('RGB')

# Hunts through the painting for the plainest 64x64 square of one kind of ground.
# `test(r, g, b)` gets a square's average colour and says whether it looks like the ground we
# want (for example, green enough to be grass). Of the squares that pass, the one with the
# least colour change inside it wins, because a smooth patch makes a better repeating texture.
# Returns that square's top-left corner as (x, y).
def flattest(test):
    a = np.asarray(src).astype(float); best = None
    for y in range(0, src.height - 64, 8):
        for x in range(0, src.width - 64, 8):
            p = a[y:y+64, x:x+64]
            if test(*p.mean(axis=(0, 1))):
                s = p.std(axis=(0, 1)).sum()
                if best is None or s < best[0]: best = (s, x, y)
    return best[1:]

GROUND = {
    'grass': flattest(lambda r, g, b: 142 < r < 190 and g > 152 and b < 90),
    'dirt': (700, 404), 'sand': (1084, 726),
    'water': flattest(lambda r, g, b: b > 150 and g > 150 and r < 90),
}
for name, (x, y) in GROUND.items():
    t = src.crop((x, y, x + 64, y + 64)); tile = Image.new('RGB', (128, 128))
    tile.paste(t, (0, 0)); tile.paste(t.transpose(Image.FLIP_LEFT_RIGHT), (64, 0))
    tile.paste(t.transpose(Image.FLIP_TOP_BOTTOM), (0, 64)); tile.paste(t.transpose(Image.ROTATE_180), (64, 64))
    tile.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, f'{name}.png'))

# name: box in the painting. Sprites are stored at 2x so one sprite pixel is one world unit.
OBJECTS = {
    'tent': (312, 110, 438, 202), 'log': (194, 162, 270, 208), 'campfire': (250, 204, 326, 252),
    'house-a': (486, 236, 704, 404), 'house-b': (766, 220, 1004, 398), 'house-c': (436, 436, 664, 614),
    'workshop': (796, 376, 1094, 566), 'ship': (1240, 524, 1506, 786),
    'pines': (1226, 192, 1338, 328), 'oak': (505, 698, 652, 838), 'big-oak': (338, 432, 474, 592),
    'pine': (160, 672, 236, 776), 'rocks-a': (72, 510, 218, 594), 'rocks-b': (452, 806, 584, 874),
    'beach-rock': (1232, 826, 1334, 888), 'flowers': (296, 646, 424, 724),
}
for name, box in OBJECTS.items():
    img = src.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.LANCZOS)
    w, h = img.size; pad = min(36, min(w, h) // 6)
    m = Image.new('L', (w, h), 0); m.paste(255, (pad, pad, w - pad, h - pad))
    m = m.filter(ImageFilter.GaussianBlur(pad / 2.2))
    img.putalpha(m); img.save(os.path.join(OUT, 'objects', f'{name}.png'))

# contact sheet for eyeballing the crops
sheet = Image.new('RGB', (1600, 1300), (150, 160, 62)); x = y = rowh = 0
for name in list(GROUND) + list(OBJECTS):
    p = os.path.join(OUT, f'{name}.png') if name in GROUND else os.path.join(OUT, 'objects', f'{name}.png')
    im = Image.open(p).convert('RGBA'); im.thumbnail((380, 300))
    if x + im.width > 1600: x = 0; y += rowh + 6; rowh = 0
    sheet.paste(im, (x, y), im); x += im.width + 6; rowh = max(rowh, im.height)
sheet.save(os.environ['SHEET'])
