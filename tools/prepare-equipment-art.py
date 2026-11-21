"""Cuts the equipment icon sheet into the loose pictures the HUD uses.

The sheet is a grid of four by four equal cells, one item in each. Each wanted item is trimmed to its paint
(faint haze wiped clear) and shrunk to the size of the pictures it sits beside.
Input  : assets/items/equipment-expansion-v1.png   (and its .prompt.txt)
Outputs: assets/ui/game/tool-sword-stone.png, tool-sword-iron.png, tool-bow-stone.png, tool-bow-iron.png
         assets/ui/game/item-gold.png, item-diamond.png, item-arrow.png, item-ironarrow.png, item-wolfpelt.png
         assets/ui/game/gear-rod.png, gear-hoe.png, gear-hat.png, gear-jacket.png, gear-gloves.png, gear-boots.png
         (each with a .prompt.txt)
The deer pelt is not cut here: assets/ui/game/item-leather.png is already that picture.
Safe to re-run: the input is never changed.
Run: python tools/prepare-equipment-art.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
SHEET = os.path.join(ROOT, 'items', 'equipment-expansion-v1.png')
UI = os.path.join(ROOT, 'ui', 'game')
GRID = 4      # the sheet has this many columns and rows
HAZE = 40     # pixels this see-through or fainter are haze, not paint
# Picture name → its (column, row) on the sheet and the longest side it is shrunk to, in pixels. The tools'
# pictures are 64 long and the item box's are 96.
WANTED = {
    'tool-sword-stone': ((0, 0), 64),
    'tool-sword-iron': ((1, 0), 64),
    'tool-bow-stone': ((2, 0), 64),
    'tool-bow-iron': ((3, 0), 64),
    'item-gold': ((2, 2), 96),
    'item-diamond': ((3, 2), 96),
    'item-arrow': ((0, 1), 96),
    'item-ironarrow': ((1, 1), 96),
    'item-wolfpelt': ((1, 2), 96),
    # Gear made once and kept: their pictures show on their Build menu rows.
    'gear-rod': ((2, 1), 96),
    'gear-hoe': ((3, 1), 96),
    'gear-hat': ((0, 3), 96),
    'gear-jacket': ((1, 3), 96),
    'gear-gloves': ((2, 3), 96),
    'gear-boots': ((3, 3), 96),
}

sheet = np.array(Image.open(SHEET).convert('RGBA'))
sheet[sheet[..., 3] <= HAZE] = 0
prompt = open(SHEET[:-4] + '.prompt.txt', encoding='utf-8').read()
cell_h, cell_w = sheet.shape[0] / GRID, sheet.shape[1] / GRID
for name, ((col, row), size) in WANTED.items():
    cell = sheet[round(row * cell_h):round((row + 1) * cell_h), round(col * cell_w):round((col + 1) * cell_w)]
    ys, xs = np.nonzero(cell[..., 3])
    art = Image.fromarray(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    scale = size / max(art.size)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    path = os.path.join(UI, name + '.png')
    art.save(path)
    note = f'Cut from ../../items/equipment-expansion-v1.png by tools/prepare-equipment-art.py.\n{prompt}'
    open(path[:-4] + '.prompt.txt', 'w', encoding='utf-8', newline='\n').write(note)
    print(name, art.size)
