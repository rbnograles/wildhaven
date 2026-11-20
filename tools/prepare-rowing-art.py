"""Packs the rowing pictures into one even sheet per character for the game.

The rowing art shows the whole boat with the character sitting in it and pulling the oars. It comes
as one east-facing sheet per character (assets/characters/<id>/<id>-rowing.png, four frames) and
two all-character sheets in assets/characters/rowing/ (bow pointing north, bow pointing south; a
row per character, four frames each). The painted frames are not quite on an even grid: an oar tip
reaches into the next frame, and the faint red haze left around the boats must go.

This writes assets/characters/<id>/<id>-rowboat.png: three rows (east, north, south) of four even
cells, with the middle of the hull in the middle of every cell, so the boat never jumps between
frames. Re-run after replacing a rowing picture. Run: python tools/prepare-rowing-art.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'characters')

# The characters in the order their rows appear on the north and south sheets, top to bottom.
CHARACTERS = ['scout', 'builder', 'survivor']

# The size of one cell on the packed sheet. The renderer reads the same numbers (ROWING_CELL).
CELL = (320, 300)

# How much each picture is shrunk. They were painted at different sizes; these make the hull
# 300 px long from the side and the same width seen from the stern or the bow.
EAST_SCALE = 0.625
UPRIGHT_SCALE = 0.633

# How long the upright hulls are in their pictures, bow tip to stern, in pixels.
NORTH_LENGTH = 395
SOUTH_LENGTH = 361

# Pixels this see-through or fainter are haze, not paint, and are wiped clear.
HAZE = 40


# Opens a picture and wipes its haze, so only real paint is left.
def load(path):
    picture = np.array(Image.open(path).convert('RGBA'))
    picture[picture[..., 3] <= HAZE] = 0
    return picture


# Finds the stretches of True in a list, as (start, end) pairs. Short ones (specks) are dropped.
def runs(flags, least=50):
    found, start = [], None
    for i, flag in enumerate(list(flags) + [False]):
        if flag and start is None:
            start = i
        if not flag and start is not None:
            if i - start >= least:
                found.append((start, i))
            start = None
    return found


# Shrinks one frame and pastes it on the sheet so the hull's middle lands in the cell's middle.
# `box` is the frame's (left, top, right, bottom) in the picture; `centre` is the hull's middle.
def paste(sheet, picture, box, centre, scale, row, column):
    left, top, right, bottom = box
    frame = Image.fromarray(picture[top:bottom, left:right])
    size = (round(frame.width * scale), round(frame.height * scale))
    frame = frame.resize(size, Image.LANCZOS)
    x = column * CELL[0] + CELL[0] / 2 - (centre[0] - left) * scale
    y = row * CELL[1] + CELL[1] / 2 - (centre[1] - top) * scale
    if x < column * CELL[0] or y < row * CELL[1]:
        raise SystemExit('A rowing frame is too big for its cell: make CELL bigger.')
    if x + size[0] > (column + 1) * CELL[0] or y + size[1] > (row + 1) * CELL[1]:
        raise SystemExit('A rowing frame is too big for its cell: make CELL bigger.')
    sheet.alpha_composite(frame, (round(x), round(y)))


# Finds the four frames in a band of rows: each is a stretch of columns with paint in it.
def frames_in(picture, top, bottom):
    found = runs(picture[top:bottom, :, 3].any(axis=0))
    if len(found) != 4:
        raise SystemExit(f'Expected four rowing frames in a row, found {len(found)}.')
    return found


# Packs the east-facing row. The hull fills the frame from side to side, and the flat stern at
# its left end marks the hull's height, which the swinging oars do not.
def pack_east(sheet, character):
    picture = load(os.path.join(ROOT, character, f'{character}-rowing.png'))
    top, bottom = runs(picture[..., 3].any(axis=1))[0]
    for column, (left, right) in enumerate(frames_in(picture, top, bottom)):
        stern = max(runs(picture[top:bottom, left : left + 14, 3].any(axis=1)), key=lambda r: r[1] - r[0])
        centre = ((left + right) / 2, top + (stern[0] + stern[1]) / 2)
        paste(sheet, picture, (left, top, right, bottom), centre, EAST_SCALE, 0, column)


# Packs a north or south row. The bow tip (the top of a north frame, the bottom of a south one)
# marks the hull's middle from side to side, because the oars never reach that far.
def pack_upright(sheet, picture, character, north):
    top, bottom = runs(picture[..., 3].any(axis=1))[CHARACTERS.index(character)]
    for column, (left, right) in enumerate(frames_in(picture, top, bottom)):
        band = picture[top : top + 25] if north else picture[bottom - 25 : bottom]
        tip = runs(band[:, left:right, 3].any(axis=0), least=10)[0]
        middle = top + NORTH_LENGTH / 2 if north else bottom - SOUTH_LENGTH / 2
        centre = (left + (tip[0] + tip[1]) / 2, middle)
        paste(sheet, picture, (left, top, right, bottom), centre, UPRIGHT_SCALE, 1 if north else 2, column)


north = load(os.path.join(ROOT, 'rowing', 'players-rowing-north.png'))
south = load(os.path.join(ROOT, 'rowing', 'players-rowing-south.png'))
for character in CHARACTERS:
    sheet = Image.new('RGBA', (CELL[0] * 4, CELL[1] * 3))
    pack_east(sheet, character)
    pack_upright(sheet, north, character, True)
    pack_upright(sheet, south, character, False)
    path = os.path.join(ROOT, character, f'{character}-rowboat.png')
    sheet.save(path)
    print('wrote', os.path.relpath(path, ROOT))
