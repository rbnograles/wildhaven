"""Cuts the art of the things the player builds at a camp out of their painted sheets, at game size.

Each sheet is a row (or a grid) of separate pictures on a see-through background. They are cut apart along the
empty gaps between them, trimmed, and shrunk to the width the game draws them, like cutting stickers off a page.
Inputs : source/settlement/shelter-construction-clean.png   the tent going up: base, frame, roof, done
         source/settlement/stockpile-chest-states-clean.png the storage chest: closed, ajar, open, open and full
         source/farming/wheat-growth.png                     a wheat bed: empty, seedlings, green, ripe
         source/settlement/settlement-centres.png            the camp centre: pavilion, small hall, big hall
         assets/characters/states/tent-sleeping-padded.png   each character asleep in a tent: a row each, 4 frames
Outputs: source/objects/<kind>/<name>.png and its .prompt.txt   shelter-1..4, chest-closed/ajar/open/full,
                                                               wheat-1..4, centre-1..3
         assets/world/buildings/tent-sleep.png, tent-sleep.json the sleeping-in-a-tent frames in even cells
                                                               (a row per character), and their cell size and
                                                               ground point
The objects.json entries for the new sprites are written by hand; this script prints their origins.
Safe to re-run: the inputs are never changed.
Run: python tools/prepare-building-art.py
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
SRC = os.path.join(ROOT, 'world', 'source')
GAP = 6                        # a run of this many see-through rows or columns separates two pictures
SOLID = 40                     # a pixel counts as painted above this much opacity
TENT_WIDTH = 150               # how wide a built tent is drawn, in world units (the sleeping frames match it)
# Sheet, the names of its pictures in reading order, the kind folder they go in, and each one's width.
SHEETS = [
    (os.path.join(SRC, 'settlement', 'shelter-construction-clean.png'), ['shelter-1', 'shelter-2', 'shelter-3', 'shelter-4'], 'buildings', [150, 150, 150, 150]),
    (os.path.join(SRC, 'settlement', 'stockpile-chest-states-clean.png'), ['chest-closed', 'chest-ajar', 'chest-open', 'chest-full'], 'props', [70, 70, 70, 70]),
    (os.path.join(SRC, 'farming', 'wheat-growth.png'), ['wheat-1', 'wheat-2', 'wheat-3', 'wheat-4'], 'plants', [120, 120, 120, 120]),
    (os.path.join(SRC, 'settlement', 'settlement-centres.png'), ['centre-1', 'centre-2', 'centre-3'], 'buildings', [220, 260, 300]),
]

# Finds the painted stretches along a line of true/false values, treating short gaps as still painted.
def stretches(filled):
    out, start, empty = [], None, 0
    for i, on in enumerate(list(filled) + [False] * GAP):
        if on:
            if start is None: start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= GAP: out.append((start, i - empty + 1)); start = None
    return out

# Trims a picture to its paint: faint haze below SOLID opacity is not counted.
def trim(im):
    a = np.asarray(im)[:, :, 3] > SOLID
    ys, xs = np.nonzero(a)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

# Cuts a sheet into its separate pictures: into rows, then each row into columns, and so on until nothing more
# can be cut. Returns the pictures in reading order, each trimmed to its paint.
def pieces(im, by_rows=True, tried=False):
    solid = np.asarray(im)[:, :, 3] > SOLID
    parts = stretches(solid.any(axis=1 if by_rows else 0))
    if len(parts) <= 1:
        return [trim(im)] if tried else pieces(im, not by_rows, True)
    out = []
    for a, b in parts:
        out += pieces(im.crop((0, a, im.width, b) if by_rows else (a, 0, b, im.height)), not by_rows)
    return out

# Writes a picture and a prompt file that says where it came from.
def save(im, path, source):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    prompt = open(source[:-4] + '.prompt.txt', encoding='utf-8').read()
    note = f'Cut from {os.path.relpath(source, os.path.join(ROOT, "..")).replace(os.sep, "/")} by tools/prepare-building-art.py.'
    open(path[:-4] + '.prompt.txt', 'w', encoding='utf-8', newline='\n').write(note + '\n' + prompt)

for source, names, kind, widths in SHEETS:
    cut = pieces(Image.open(source).convert('RGBA'))
    assert len(cut) == len(names), f'{source}: expected {len(names)} pictures, found {len(cut)}'
    for name, width, piece in zip(names, widths, cut):
        small = piece.resize((width, round(piece.height * width / piece.width)), Image.LANCZOS)
        save(small, os.path.join(SRC, 'objects', kind, f'{name}.png'), source)
        print(f'{name}: {small.width}x{small.height}')

# The sleeping frames: a grid of 3 rows (scout, builder, survivor) and 4 columns of equal cells. Each frame is
# trimmed, shrunk so its tent is TENT_WIDTH wide, and set into an even cell standing on its bottom middle.
source = os.path.join(ROOT, 'characters', 'states', 'tent-sleeping-padded.png')
sheet = Image.open(source).convert('RGBA')
rows, cols = 3, 4
frames = []
for r in range(rows):
    for c in range(cols):
        cell = sheet.crop((c * sheet.width // cols, r * sheet.height // rows, (c + 1) * sheet.width // cols, (r + 1) * sheet.height // rows))
        frames.append(trim(cell))
scale = TENT_WIDTH / np.median([f.width for f in frames])
frames = [f.resize((round(f.width * scale), round(f.height * scale)), Image.LANCZOS) for f in frames]
cw, ch = max(f.width for f in frames) + 4, max(f.height for f in frames) + 4
out = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
for i, f in enumerate(frames):
    r, c = divmod(i, cols)
    out.paste(f, (c * cw + (cw - f.width) // 2, r * ch + ch - 2 - f.height))
target = os.path.join(ROOT, 'world', 'buildings', 'tent-sleep.png')
save(out, target, source)
json.dump({'cell': [cw, ch], 'origin': [0.5, (ch - 2) / ch], 'rows': rows, 'columns': cols},
          open(target[:-4] + '.json', 'w'), indent=1)
print(f'tent-sleep: {cols}x{rows} cells of {cw}x{ch}')
