"""Cuts the two sprite sheets that show all three characters into one sheet per character.

The idle and side-walk sheets were generated as one picture with a row per character (scout,
builder, survivor, top to bottom). The originals and their prompts stay in
assets/characters/originals/; the game loads the cut copies from each character's own folder.
Re-run after replacing an original. It overwrites the copies. Run: python tools/split-character-sheets.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'characters')

# The characters in the order their rows appear on both original sheets, top to bottom.
CHARACTERS = ['scout', 'builder', 'survivor']

# Original sheet file name -> the end of each copy's name (the copy is '<id>-' + this).
SHEETS = {
    'starting-characters-idle-v1.png': 'idle-v1.png',
    'side-walk-v2.png': 'side-walk-v2.png',
}


# Cuts one original into equal-height rows and saves each row in its character's folder.
def split(name, ending):
    sheet = Image.open(os.path.join(ROOT, 'originals', name))
    if sheet.height % len(CHARACTERS):
        raise SystemExit(f'{name} is {sheet.height} px tall, which does not split into equal rows')
    height = sheet.height // len(CHARACTERS)
    for row, character in enumerate(CHARACTERS):
        path = os.path.join(ROOT, character, f'{character}-{ending}')
        sheet.crop((0, row * height, sheet.width, (row + 1) * height)).save(path)
        print('wrote', os.path.relpath(path, ROOT))


for original, ending in SHEETS.items():
    split(original, ending)
