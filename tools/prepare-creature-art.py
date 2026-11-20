"""Cuts the animal sheets into even flip-book sheets the game can play, at game size.

Each painted sheet is a grid of equal cells, one picture per cell, every animal facing east. Each picture is
trimmed to its paint, shrunk so the animal stands its game height, and set into an even cell standing on its
bottom middle, like stickers lined up on a shelf, so the animal never jumps about between frames.
Inputs : assets/creatures/<animal>/<animal>-states.png   (the wolf: wolf-states-clean.png) a grid of rows
         assets/creatures/wolf/wolf-dying.png            one row of six: the wolf lying down
Outputs: assets/world/creatures/<animal>.png             one even sheet per animal, a row per state
         assets/world/creatures/creatures.json           each sheet's cell size, ground point and rows
Rows: deer, rabbit, boar: idle, walk, run, lying down (4 frames each). Wolf: idle, walk, snarl, lunge, run
(4 frames each), then lying down (6 frames, from wolf-dying.png).
Safe to re-run: the inputs are never changed.
Run: python tools/prepare-creature-art.py
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
IN = os.path.join(ROOT, 'creatures')
OUT = os.path.join(ROOT, 'world', 'creatures')
SOLID = 40                     # a pixel counts as painted above this much opacity
# Animal: its sheet, the grid (columns, rows), the names of its rows, and how tall it stands in world units
# (measured on its first, standing picture). The player is 76 units tall.
ANIMALS = {
    'deer': ('deer/deer-states.png', (4, 4), ['idle', 'walk', 'run', 'down'], 92),
    'rabbit': ('rabbit/rabbit-states.png', (4, 4), ['idle', 'walk', 'run', 'down'], 30),
    'boar': ('boar/boar-states.png', (4, 4), ['idle', 'walk', 'run', 'down'], 48),
    'wolf': ('wolf/wolf-states-clean.png', (4, 5), ['idle', 'walk', 'snarl', 'lunge', 'run'], 52),
}
# Extra rows from a sheet of their own: animal, sheet, columns, row name.
EXTRA = {'wolf': ('wolf/wolf-dying.png', 6, 'down')}

# Trims a picture to its paint: faint haze below SOLID opacity is not counted.
def trim(im):
    ys, xs = np.nonzero(np.asarray(im)[:, :, 3] > SOLID)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

# Cuts a sheet into its grid's cells, row by row, each trimmed.
def cells(path, cols, rows):
    sheet = Image.open(os.path.join(IN, path)).convert('RGBA')
    return [[trim(sheet.crop((c * sheet.width // cols, r * sheet.height // rows,
                              (c + 1) * sheet.width // cols, (r + 1) * sheet.height // rows)))
             for c in range(cols)] for r in range(rows)]

# Writes a prompt file beside a sheet saying where it came from.
def note(target, sources):
    text = f'Made by tools/prepare-creature-art.py from {", ".join(sources)}.\n'
    for s in sources: text += '\n' + open(os.path.join(IN, s[:-4] + '.prompt.txt'), encoding='utf-8').read()
    open(target[:-4] + '.prompt.txt', 'w', encoding='utf-8', newline='\n').write(text)

os.makedirs(OUT, exist_ok=True)
manifest = {}
for animal, (path, (cols, rows), names, tall) in ANIMALS.items():
    grid = cells(path, cols, rows)
    sources = [path]
    scale = tall / grid[0][0].height
    shrink = lambda f, sc: f.resize((max(1, round(f.width * sc)), max(1, round(f.height * sc))), Image.LANCZOS)
    grid = [[shrink(f, scale) for f in row] for row in grid]
    if animal in EXTRA:
        # A sheet painted on its own has its own scale: its first picture is made as long as the
        # standing animal, so the two sheets match.
        extra_path, extra_cols, extra_name = EXTRA[animal]
        extra = cells(extra_path, extra_cols, 1)[0]
        grid.append([shrink(f, grid[0][0].width / extra[0].width) for f in extra])
        names = names + [extra_name]
        sources.append(extra_path)
    cw = max(f.width for row in grid for f in row) + 4
    ch = max(f.height for row in grid for f in row) + 4
    width = max(len(row) for row in grid)
    out = Image.new('RGBA', (cw * width, ch * len(grid)), (0, 0, 0, 0))
    for r, row in enumerate(grid):
        for c, f in enumerate(row):
            out.paste(f, (c * cw + (cw - f.width) // 2, r * ch + ch - 2 - f.height))
    target = os.path.join(OUT, f'{animal}.png')
    out.save(target)
    note(target, sources)
    manifest[animal] = {'cell': [cw, ch], 'origin': [0.5, (ch - 2) / ch], 'columns': width,
                        'rows': {name: {'row': r, 'frames': len(grid[r])} for r, name in enumerate(names)}}
    print(f'{animal}: {len(grid)} rows of {width} cells, {cw}x{ch}')
json.dump(manifest, open(os.path.join(OUT, 'creatures.json'), 'w'), indent=1)
