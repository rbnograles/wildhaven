"""Cuts the sprite sheets that show all three characters into one sheet per character.

The idle and side-walk sheets were generated as one picture with a row per character (scout,
builder, survivor, top to bottom). The originals and their prompts stay in
assets/characters/originals/; the game loads the cut copies from each character's own folder.
The survival state sheets (sleeping, waking up, hungry and the three "hurt" reactions) are laid
out the same way and stay, with their prompts, in assets/characters/states/. So are the diagonal
walking and running sheets in assets/characters/diagonal/.
Re-run after replacing an original. It overwrites the copies. Run: python tools/split-character-sheets.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'characters')

# The characters in the order their rows appear on both original sheets, top to bottom.
CHARACTERS = ['scout', 'builder', 'survivor']

# Folder under assets/characters/ -> {original sheet file name: the end of each copy's name}
# (the copy is '<id>-' + this). `dying.png` is left out: the game uses the
# six-frame dying-v2 sheets instead, which were packed by hand (see states/dying-v2.manifest.json).
SHEETS = {
    'originals': {
        'starting-characters-idle-v1.png': 'idle-v1.png',
        'side-walk-v2.png': 'side-walk-v2.png',
    },
    'states': {
        'sleeping.png': 'sleeping.png',
        'waking-up.png': 'waking-up.png',
        'hungry.png': 'hungry.png',
        'damage-hunger.png': 'damage-hunger.png',
        'damage-cold.png': 'damage-cold.png',
        'damage-attack.png': 'damage-attack.png',
    },
    'diagonal': {
        'walk-ne.png': 'walk-ne.png',
        'walk-se.png': 'walk-se.png',
        'run-ne.png': 'run-ne.png',
        'run-se.png': 'run-se.png',
    },
}

# Folders whose pictures carry a faint leftover haze around the figures. Their copies get every
# nearly see-through pixel (alpha of HAZE or less) wiped fully clear, so no glow shows in the game.
# The game already ignores those pixels when it measures a pose (sheets.js counts alpha above 40).
HAZY = {'states', 'diagonal'}
HAZE = 40


# Cuts one original into three rows and saves each row in its character's folder. A height that
# does not divide by three (the 1024 px running sheets) is cut at the nearest whole pixel, so the
# rows are 341, 342 and 341 px tall; sheets.js lists each copy's real height.
def split(folder, name, ending):
    sheet = Image.open(os.path.join(ROOT, folder, name))
    if folder in HAZY:
        sheet = sheet.convert('RGBA')
        alpha = sheet.getchannel('A').point(lambda a: 0 if a <= HAZE else a)
        sheet.putalpha(alpha)
    edges = [round(row * sheet.height / len(CHARACTERS)) for row in range(len(CHARACTERS) + 1)]
    for row, character in enumerate(CHARACTERS):
        path = os.path.join(ROOT, character, f'{character}-{ending}')
        sheet.crop((0, edges[row], sheet.width, edges[row + 1])).save(path)
        print('wrote', os.path.relpath(path, ROOT), f'({edges[row + 1] - edges[row]} px tall)')


for folder, sheets in SHEETS.items():
    for original, ending in sheets.items():
        split(folder, original, ending)
