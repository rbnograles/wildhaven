"""Cuts the precious ore sheet into the two world sprites the game can place: gold ore and diamond ore.

The sheet shows two big rocks side by side, one in each half. Each is trimmed to its paint (faint haze wiped
clear) and shrunk to boulder size, so it sits beside the other rocks without looking like a giant.
Input  : assets/world/source/originals/rocks/precious-ore-nodes-v1.png   (and its .prompt.txt)
Outputs: assets/world/source/objects/rocks/gold-ore.png, diamond-ore.png (each with a .prompt.txt)
(Their item box pictures come from the equipment icon sheet: tools/prepare-equipment-art.py.)
Their objects.json entries are written by hand. Safe to re-run: the input is never changed.
Run: python tools/prepare-ore-art.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world', 'source')
SHEET = os.path.join(ROOT, 'originals', 'rocks', 'precious-ore-nodes-v1.png')
OUT = os.path.join(ROOT, 'objects', 'rocks')
NAMES = ['gold-ore', 'diamond-ore']   # left half, right half
WIDE = 240                            # how wide each rock is in the game, in pixels (a boulder is 290)
HAZE = 40                             # pixels this see-through or fainter are haze, not paint

sheet = np.array(Image.open(SHEET).convert('RGBA'))
sheet[sheet[..., 3] <= HAZE] = 0
prompt = open(SHEET[:-4] + '.prompt.txt', encoding='utf-8').read()
half = sheet.shape[1] // 2
for i, name in enumerate(NAMES):
    cell = sheet[:, i * half:(i + 1) * half]
    ys, xs = np.nonzero(cell[..., 3])
    rock = Image.fromarray(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    rock = rock.resize((WIDE, round(rock.height * WIDE / rock.width)), Image.LANCZOS)
    rock.save(os.path.join(OUT, name + '.png'))
    note = f'Cut from ../../originals/rocks/precious-ore-nodes-v1.png by tools/prepare-ore-art.py.\n{prompt}'
    open(os.path.join(OUT, name + '.prompt.txt'), 'w', encoding='utf-8', newline='\n').write(note)

    print(name, rock.size)
