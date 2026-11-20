"""Pack generated tool poses into equal cells without cutting raised tool heads.

Run: python tools/prepare-tool-swings.py. Originals and prompts remain in characters/tools.
Only the twelve derived tool strips and their layout manifest are written.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'characters'
CHARACTERS = ['scout', 'builder', 'survivor']
CELL = 512


# Find a clear gutter near an expected grid boundary; raised tools cross the nominal cells.
def gutter(mask, axis, fraction):
    length = mask.shape[axis]
    middle, radius = round(length * fraction), round(length / 28)
    counts = mask.sum(axis=1 - axis)
    candidates = np.flatnonzero(counts[middle-radius:middle+radius] == 0) + middle-radius
    assert len(candidates), 'No clear gutter: inspect the source sheet before packing'
    return int(candidates[np.argmin(abs(candidates - middle))])


# Cut at clear gutters, preserve each row's body scale, and align each pose by its planted boots.
def pack(name):
    source = Image.open(ROOT / 'tools' / f'{name}.png').convert('RGBA')
    pixels = np.array(source)
    pixels[pixels[:, :, 3] <= 40] = 0
    source = Image.fromarray(pixels)
    mask = pixels[:, :, 3] > 40
    rows = [0, gutter(mask, 0, 1/3), gutter(mask, 0, 2/3), source.height]
    entries = []
    for row, character in enumerate(CHARACTERS):
        top, bottom = rows[row:row+2]
        columns = [0] + [gutter(mask[top:bottom], 1, i/4) for i in (1, 2, 3)] + [source.width]
        strip = Image.new('RGBA', (CELL * 4, CELL))
        scale = None
        for col in range(4):
            left, right = columns[col:col+2]
            frame = source.crop((left, top, right, bottom))
            bounds = frame.getbbox()
            assert bounds, 'Empty animation frame'
            frame = frame.crop(bounds)
            if scale is None:
                scale = 320 / frame.height
            foot = np.asarray(frame)[:, :, 3] > 40
            _, boot_x = np.where(foot[round(frame.height * .85):])
            pivot = (int(boot_x.min()) + int(boot_x.max())) / 2
            frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
            x, y = round(CELL/2 - pivot * scale), CELL - 16 - frame.height
            assert x >= 8 and x + frame.width <= CELL - 8 and y >= 8, 'Pose exceeds cell padding'
            strip.alpha_composite(frame, (col * CELL + x, y))
        path = ROOT / character / f'{character}-{name}.png'
        strip.save(path)
        entries.append({'character': character, 'file': str(path.relative_to(ROOT)).replace('\\', '/'), 'sourceRows': [top, bottom], 'sourceColumns': columns})
        print(path.name, strip.size)
    return entries


if __name__ == '__main__':
    manifest = {'cell': [CELL, CELL], 'frames': 4, 'anchor': [CELL/2, CELL-16], 'facing': 'east; mirror for west', 'sheets': {}}
    for name in ['pickaxe-stone', 'pickaxe-iron', 'axe-stone', 'axe-iron']:
        manifest['sheets'][name] = pack(name)
    (ROOT / 'tools' / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
