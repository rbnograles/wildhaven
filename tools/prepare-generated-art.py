"""Gets the Nano Banana pictures in source/originals/ ready for the game.

Nano Banana cannot paint real see-through pixels, so every sprite was drawn on flat magenta. This script
takes the magenta out, trims each picture to what is left, and shrinks it to its size in the game.
Inputs : source/originals/<kind>/<name>.jpg   the generated pictures, each with a .prompt.txt beside it
         source/cliffs/cliffs.json            where the walls and steps sit in each cliff picture
Outputs: source/objects/<kind>/<name>.png     grass tufts, the dirt patch and the three stairs sprites
         source/ground/soil.png               the forest soil texture, with its edges blended so it repeats
         source/cliffs/<kit>.png              each cliff picture with the magenta taken out (build-map.py cuts it)
Every output gets a copy of its original's prompt. The originals are never changed, so it is safe to re-run.
Run: python tools/prepare-generated-art.py, then python tools/build-map.py
"""
import json, os
import numpy as np
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world', 'source')
ORIGINALS = os.path.join(SRC, 'originals')
CLIFFS = json.load(open(os.path.join(SRC, 'cliffs', 'cliffs.json'), encoding='utf-8'))

# Sprites to cut out: name -> (kind folder, size in the game). The size is the height in world units, or
# ('width', n) for the flat dirt patch, which is wider than it is tall. The player is 112 units tall.
SPRITES = {
    'grass-tuft': ('plants', 40),   # about ankle high
    'tall-grass': ('plants', 70),   # about knee to waist high
    'dry-grass': ('plants', 50),
    'snow-grass': ('plants', 40),
    'dirt-patch': ('props', ('width', 200)),
}
PAD = 2   # clear pixels left around each sprite, so its soft edge is never cut off


# Turns a picture drawn on flat magenta into a picture with see-through pixels.
# The background colour is measured from the picture's border. Each pixel's "alpha" (how solid it is) comes from
# how far its colour is from that magenta. Half-solid edge pixels are a mix of the drawing and the magenta, so the
# magenta share is taken back out of their colour; otherwise every edge would have a pink fringe.
def key_out(path):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(float)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    magenta = border[(border[:, 0] > 170) & (border[:, 2] > 170) & (border[:, 1] < 100)]
    bg = np.median(magenta, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - 45) / 85, 0, 1)
    # A second guess for edge pixels: magenta is the only colour here whose red AND blue both sit far above its
    # green, so how far they do says how much magenta is mixed in. Taking the smaller guess stops pink fringes.
    excess = np.minimum(rgb[..., 0] - rgb[..., 1], rgb[..., 2] - rgb[..., 1])
    magenta_excess = min(bg[0] - bg[1], bg[2] - bg[1])
    alpha = np.minimum(alpha, 1 - np.clip((excess - 8) / (magenta_excess - 8), 0, 1))
    safe = np.maximum(alpha, 0.05)[..., None]
    color = np.clip(bg + (rgb - bg) / safe, 0, 255)
    return np.dstack([color, alpha * 255])


# Keeps only the main drawing: any separate speck of noise in the background is made see-through.
# The picture is looked at in 8-pixel blocks; starting from the most solid block, it spreads to every touching
# block that holds something, like flooding a field from one spot, and whatever the flood never reaches is wiped.
def main_shape(rgba):
    h, w = rgba.shape[:2]; B = 8
    blocks = rgba[:h // B * B, :w // B * B, 3].reshape(h // B, B, w // B, B).max(axis=(1, 3)) > 25
    sums = rgba[:h // B * B, :w // B * B, 3].reshape(h // B, B, w // B, B).sum(axis=(1, 3))
    keep = np.zeros_like(blocks); stack = [np.unravel_index(np.argmax(sums), sums.shape)]
    while stack:
        y, x = stack.pop()
        if not (0 <= y < blocks.shape[0] and 0 <= x < blocks.shape[1]) or keep[y, x] or not blocks[y, x]: continue
        keep[y, x] = True
        stack += [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
    full = np.zeros((h, w), bool); full[:h // B * B, :w // B * B] = keep.repeat(B, 0).repeat(B, 1)
    out = rgba.copy(); out[~full, 3] = 0
    return out


# Cuts a picture down to the box around its solid pixels.
def trim(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 25)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


# Shrinks a trimmed sprite to its game size and puts a thin clear border around it.
def fit(rgba, size):
    h, w = rgba.shape[:2]
    if isinstance(size, tuple): tw = size[1]; th = round(h * tw / w)
    else: th = size; tw = round(w * th / h)
    im = Image.fromarray(rgba.astype('uint8'), 'RGBA').resize((tw, th), Image.LANCZOS)
    canvas = Image.new('RGBA', (tw + 2 * PAD, th + 2 * PAD), (0, 0, 0, 0))
    canvas.paste(im, (PAD, PAD))
    return canvas


# Blends a texture's left edge into its right edge and its top into its bottom, so copies laid side by side join
# without a visible line. `band` is how many pixels near each edge are mixed.
def make_seamless(rgb, band=96):
    out = rgb.copy()
    ramp = np.linspace(0, 1, band)
    for axis in (1, 0):
        out = np.moveaxis(out, axis, 0)
        end = out[-band:].copy()
        w = ramp.reshape((-1,) + (1,) * (out.ndim - 1))
        out[:band] = out[:band] * w + end * (1 - w)   # the first rows slowly turn into the rows the copy ends with
        out = np.moveaxis(out[:-band], 0, axis)       # ...and those end rows are dropped, so the seam is gone
    return np.asarray(Image.fromarray(out.astype('uint8')).resize((rgb.shape[1], rgb.shape[0]), Image.LANCZOS))


# Saves one output picture and copies its original's prompt next to it, saying where it came from.
def save(image, out_path, original):
    image.save(out_path)
    prompt = open(original[:-4] + '.prompt.txt', encoding='utf-8').read()
    note = f'Prepared by tools/prepare-generated-art.py from source/originals/{os.path.relpath(original, ORIGINALS)}'
    open(out_path[:-4] + '.prompt.txt', 'w', encoding='utf-8', newline='\n').write(note.replace('\\', '/') + '\n' + prompt)
    print('made', os.path.relpath(out_path, SRC))


# Cuts the stairs out of one cliff picture and shrinks it to the game's scale.
# Below the wall top everything is kept: the steps and a sliver of wall on each side, which melts into the wall
# tiles drawn next to it. Above the wall top only the gap the steps cut into the plateau is kept, because the
# map's own edge tiles draw the grassy lip on either side.
def stairs_sprite(rgba, kit):
    g = CLIFFS['kits'][kit]; scale = CLIFFS['pixelsPerUnit']
    left, right = g['stairs']; top, wall_top, bottom = g['stairsTop'], g['wallTop'], g['stairsBottom']
    part = rgba[top:bottom, left:right].copy()
    rows = np.arange(top, bottom)[:, None]; cols = np.arange(left, right)[None, :]
    n0, n1 = g['notch']
    notch = np.clip(np.minimum(cols - n0, n1 - cols) / 12, 0, 1)        # soft sides on the gap
    above = np.where(rows < wall_top, notch, 1.0)
    fade_top = np.clip((rows - top) / 25, 0, 1)                          # melts into the plateau's own ground
    fade_side = np.clip(np.minimum(cols - left, right - cols) / 18, 0, 1)  # melts into the wall tiles beside it
    part[..., 3] *= above * fade_top * fade_side
    size = (round((right - left) / scale), round((bottom - top) / scale))
    return Image.fromarray(part.astype('uint8'), 'RGBA').resize(size, Image.LANCZOS)


for name, (kind, size) in SPRITES.items():
    original = os.path.join(ORIGINALS, kind, f'{name}.jpg')
    save(fit(trim(main_shape(key_out(original))), size), os.path.join(SRC, 'objects', kind, f'{name}.png'), original)

original = os.path.join(ORIGINALS, 'ground', 'soil.jpg')
save(Image.fromarray(make_seamless(np.asarray(Image.open(original).convert('RGB')).astype(float))),
     os.path.join(SRC, 'ground', 'soil.png'), original)

for kit in CLIFFS['kits']:
    original = os.path.join(ORIGINALS, 'cliffs', f'{kit}.jpg')
    rgba = key_out(original)
    save(Image.fromarray(rgba.astype('uint8'), 'RGBA'), os.path.join(SRC, 'cliffs', f'{kit}.png'), original)
    save(stairs_sprite(rgba, kit), os.path.join(SRC, 'objects', 'props', f'{kit}-stairs.png'), original)
