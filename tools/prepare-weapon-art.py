"""Packs the sword and bow action sheets into one even strip per character, and cuts out the arrow.

Each input is one picture of all three characters (a row each, four poses across, facing east). A raised
sword or a drawn bow is wider than a quarter of the sheet, so the poses are found by the clear gaps between
them, not by equal cells. Each pose is put in a 512x512 cell with its boots in the middle of the bottom
edge, like the axe and pickaxe swings (tools/prepare-tool-swings.py), so a swing never slides the body.
The bow's third pose was painted with the arrow already flying beside the archer. The game draws the
flying arrow by itself, so that loose arrow is left out of the strip and saved as its own little picture.
Inputs : assets/characters/equipment/players-{sword,bow}-{stone,iron}.png   (and their .prompt.txt)
Outputs: assets/characters/<id>/<id>-{sword,bow}-{stone,iron}.png
         assets/world/effects/arrow-{stone,iron}.png   (each with a .prompt.txt)
Safe to re-run: the inputs are never changed.
Run: python tools/prepare-weapon-art.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
SOURCE = ASSETS / 'characters' / 'equipment'
CHARACTERS = ['scout', 'builder', 'survivor']
CELL = 512       # each packed pose gets a square cell this big
TALL = 320       # the first pose of every row is made this tall, like the tool swings
HAZE = 40        # pixels this see-through or fainter are haze, not paint
GAP = 5          # a clear gap at least this wide separates two poses (or two rows)


# Lists the painted stretches along a line of true/false values, split wherever a clear gap is wide enough.
def stretches(painted):
    found, start, last = [], None, None
    for i in np.flatnonzero(painted):
        if start is None:
            start = i
        elif i - last > GAP:
            found.append((int(start), int(last) + 1))
            start = i
        last = i
    if start is not None:
        found.append((int(start), int(last) + 1))
    # A speck a few pixels wide is stray paint, not a pose.
    return [s for s in found if s[1] - s[0] > 12]


# Packs one sheet into a strip per character. For a bow it also returns the loose arrow of the top row.
def pack(name, loose_arrow):
    pixels = np.array(Image.open(SOURCE / f'players-{name}.png').convert('RGBA'))
    pixels[pixels[..., 3] <= HAZE] = 0
    mask = pixels[..., 3] > 0
    rows = stretches(mask.any(axis=1))
    assert len(rows) == 3, f'{name}: expected 3 rows of characters, found {len(rows)}'
    arrow = None
    for character, (top, bottom) in zip(CHARACTERS, rows):
        poses = stretches(mask[top:bottom].any(axis=0))
        assert len(poses) == (5 if loose_arrow else 4), f'{name} {character}: found {len(poses)} pieces'
        if loose_arrow:
            # The fourth piece is the arrow flying beside the third pose.
            left, right = poses.pop(3)
            piece = Image.fromarray(pixels[top:bottom, left:right])
            arrow = arrow or (piece.crop(piece.getbbox()), None)
        strip, scale = Image.new('RGBA', (CELL * 4, CELL)), None
        for col, (left, right) in enumerate(poses):
            frame = Image.fromarray(pixels[top:bottom, left:right])
            frame = frame.crop(frame.getbbox())
            scale = scale or TALL / frame.height
            # The middle of the boots: the lowest part of the pose.
            _, boot_x = np.nonzero(np.asarray(frame)[round(frame.height * .85):, :, 3])
            pivot = (int(boot_x.min()) + int(boot_x.max())) / 2
            frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.LANCZOS)
            x, y = round(CELL / 2 - pivot * scale), CELL - 16 - frame.height
            assert x >= 4 and x + frame.width <= CELL - 4 and y >= 4, f'{name} {character}: pose {col} is too big'
            strip.alpha_composite(frame, (col * CELL + x, y))
        if arrow and arrow[1] is None:
            arrow = (arrow[0], scale)
        path = ASSETS / 'characters' / character / f'{character}-{name}.png'
        strip.save(path)
        print(path.name, strip.size)
    return arrow


# Saves the arrow at the same scale as the archer it was painted beside, with a note on where it is from.
def save_arrow(tier, arrow):
    picture, scale = arrow
    picture = picture.resize((round(picture.width * scale), round(picture.height * scale)), Image.LANCZOS)
    path = ASSETS / 'world' / 'effects' / f'arrow-{tier}.png'
    picture.save(path)
    prompt = (SOURCE / f'players-bow-{tier}.prompt.txt').read_text(encoding='utf-8')
    note = f'The flying arrow, cut from ../../characters/equipment/players-bow-{tier}.png by tools/prepare-weapon-art.py.\n{prompt}'
    path.with_suffix('.prompt.txt').write_text(note, encoding='utf-8', newline='\n')
    print(path.name, picture.size)


if __name__ == '__main__':
    for tier in ['stone', 'iron']:
        pack(f'sword-{tier}', False)
        save_arrow(tier, pack(f'bow-{tier}', True))
