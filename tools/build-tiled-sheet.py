"""Packs the world's ground, path pieces and object sprites into ONE picture for the Tiled map editor.

Tiled likes a tileset to be a single image. The game keeps one PNG per sprite, so this script lays them all
out on one sheet with a 64-pixel grid, like stickers on one page, and writes two Tiled tileset files for it.
Inputs : source/ground/<name>.png              the nine ground textures
         source/objects/<kind>/<name>.png      every object sprite (trees, rocks, buildings, props, path pieces)
         source/objects.json                   each sprite's kind folder, scale and origin
         source/paths/path-<kind>.png          the four path sheets: straight, bend, T and crossroads of each
         source/shorelines/<kind>-bank.png     the three bank sheets, every piece (straight, corners, curves, end)
         source/shorelines/shorelines.json     where the straight strip sits, which gives each sheet's game size
         source/farming/wheat-growth.png       the four stages of a wheat bed
         assets/items/ores/iron-copper.png     iron and copper: loose chunks and the rocks they are mined from
         source/landmarks/cave-entrances.png   three cave mouths: forest, snow and canyon
Outputs: assets/world/tiled/wildhaven-sheet.png    the one picture: grounds on top, then objects by kind
         assets/world/tiled/wildhaven-sheet.tsx    the sheet as a plain 64x64 grid (paint ground; stamp objects
                                                   by selecting all of an object's squares)
         assets/world/tiled/wildhaven-objects.tsx  the same picture, one tile per whole object (needs Tiled 1.9+);
                                                   use it for tile objects on an object layer
         assets/world/tiled/wildhaven-sheet.json   where every ground and object sits on the sheet
Every sprite is drawn at the size the game draws it (its `scale` in objects.json is baked in), and each ground
is the same 256-pixel texture build-map.py uses, cut into 4x4 tiles that repeat without a seam. The path
modules and bank pieces are sized to match the path and bank the game draws; the game itself uses only the
straight piece of each, so the bends, crossings and corners here are extra art for Tiled. The wheat bed is
not in the game yet, so its size (WHEAT_SCALE) is a guess.
The game does NOT load these files: its map still comes from build-map.py. Safe to re-run; it only overwrites
its own outputs.
Run: python tools/build-tiled-sheet.py
"""
import json, os
import numpy as np
from xml.sax.saxutils import quoteattr
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world')
SRC = os.path.join(ROOT, 'source')
OUT = os.path.join(ROOT, 'tiled')
TILE, TEX = 64, 256            # one grid square, and the size build-map.py shrinks a ground texture to
COLS = 36                      # sheet width in squares: nine grounds of four squares each fit exactly
GROUNDS = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']   # bottom to top, as in the map
KINDS = ['trees', 'plants', 'rocks', 'buildings', 'props', 'paths', 'shorelines', 'farming', 'ores', 'caves']   # the order things appear in
# Painted sheets of loose pieces that are not in the game yet. Each entry: the kind it is filed under, the
# picture, the pieces' names in reading order, and how wide each is drawn in world units (a guess until the
# game uses them: an ore rock is about as big as a boulder, a cave about as big as a house).
LOOSE_SHEETS = [
    ('ores', os.path.join('..', '..', 'items', 'ores', 'iron-copper.png'),
     ['iron-chunks', 'copper-chunks', 'iron-ore', 'copper-ore'], [90, 90, 170, 170]),
    ('caves', os.path.join('landmarks', 'cave-entrances.png'), ['cave-forest', 'cave-snow', 'cave-canyon'], [250, 250, 250]),
]
PATH_SHEETS = ['path-dirt', 'path-cobblestone', 'path-boardwalk', 'path-stepping-stone']
PATH_MODULES = ['straight', 'bend', 'tee', 'cross']   # the four quarters of a path sheet, left to right, top to bottom
PATH_WIDTH = 110               # how wide the game draws a path, in world units (the same number as prepare-sprite-art.py)
BANK_DEPTH = 63                # how deep the game draws a bank strip: 56 units of land and a 7-unit wet edge
WHEAT_SCALE = 0.3              # the wheat bed is not in the game yet, so this size is a guess
FIT = {'campfire': 64}         # sprites drawn to fit a box this many pixels wide and tall: a campfire is one square
GAP = 6                        # a run of this many empty pixel rows or columns separates two pieces on a sheet
PAD = 1                        # clear pixels kept around a sprite inside its squares, so neighbours never touch

# How many grid squares a length of pixels needs, with the padding on both sides.
def squares(pixels): return -(-(pixels + 2 * PAD) // TILE)

# Opens one object sprite and shrinks it to the size the game draws it.
def load_sprite(name, entry):
    im = Image.open(os.path.join(SRC, 'objects', entry['kind'], f'{name}.png')).convert('RGBA')
    sc = FIT[name] / max(im.width, im.height) if name in FIT else entry.get('scale', 1)
    if sc != 1: im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    return im

# Cuts the empty border off a picture.
def trim(im): return im.crop(im.getbbox())

# Shrinks (or grows) a picture by a factor.
def resize(im, sc): return im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)

# Finds the filled stretches along a line of true/false values, treating short empty runs as still filled.
# Returns a list of (start, end) pairs.
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

# Cuts a sheet of loose painted pieces into single pieces, like cutting stickers apart along the empty gaps:
# first into rows, then each row into columns, and again until a piece can't be cut any more.
# Returns the pieces in reading order.
def pieces(im, by_rows=True, tried=False):
    solid = np.asarray(im)[:, :, 3] > 40
    parts = stretches(solid.any(axis=1 if by_rows else 0))
    if len(parts) <= 1:
        return [trim(im)] if tried else pieces(im, not by_rows, True)
    out = []
    for a, b in parts:
        out += pieces(im.crop((0, a, im.width, b) if by_rows else (a, 0, b, im.height)), not by_rows)
    return out

# Puts the sprites on shelves, like books: fill a row left to right, then start a new row under the tallest one.
# Returns each sprite's block as (name, column, row, squares wide, squares tall) and the first free row.
def shelve(sprites, top):
    placed, col, row, tall = [], 0, top, 0
    for name, im in sprites:
        w, h = squares(im.width), squares(im.height)
        if col + w > COLS: col, row, tall = 0, row + tall, 0
        placed.append((name, col, row, w, h)); col += w; tall = max(tall, h)
    return placed, row + tall

spec = {k: v for k, v in json.load(open(os.path.join(SRC, 'objects.json'))).items() if not k.startswith('_')}
sprites = {n: load_sprite(n, e) for n, e in spec.items()}

# The extra sheets. Each piece gets a made-up entry like the ones in objects.json, so it is packed the same way.
for sheet_name in PATH_SHEETS:
    im = Image.open(os.path.join(SRC, 'paths', sheet_name + '.png')).convert('RGBA')
    w, h = im.width // 2, im.height // 2
    quarters = [trim(im.crop((x, y, x + w, y + h))) for y in (0, h) for x in (0, w)]
    sc = PATH_WIDTH / quarters[0].height   # the straight module's height is the path's width
    for module, quarter in zip(PATH_MODULES, quarters):
        name = f'{sheet_name}-{module}'
        spec[name] = {'kind': 'paths', 'origin': [0.5, 0.5]}; sprites[name] = resize(quarter, sc)

cuts = json.load(open(os.path.join(SRC, 'shorelines', 'shorelines.json')))['kinds']
for bank, cut in cuts.items():
    im = Image.open(os.path.join(SRC, 'shorelines', f'{bank}-bank.png')).convert('RGBA')
    sc = BANK_DEPTH / (cut['bottom'] - cut['top'])
    for i, piece in enumerate(pieces(im)):
        name = f'{bank}-bank-{i + 1}'
        spec[name] = {'kind': 'shorelines', 'origin': [0.5, 0.5]}; sprites[name] = resize(piece, sc)

wheat = Image.open(os.path.join(SRC, 'farming', 'wheat-growth.png')).convert('RGBA')
for i, piece in enumerate(pieces(wheat)):
    name = f'wheat-{i + 1}'
    spec[name] = {'kind': 'farming', 'origin': [0.5, 0.95]}; sprites[name] = resize(piece, WHEAT_SCALE)

for kind, file, names, widths in LOOSE_SHEETS:
    cut = pieces(Image.open(os.path.join(SRC, file)).convert('RGBA'))
    assert len(cut) == len(names), f'{file}: expected {len(names)} pieces, found {len(cut)}'
    for name, width, piece in zip(names, widths, cut):
        spec[name] = {'kind': kind, 'origin': [0.5, 0.95]}; sprites[name] = resize(piece, width / piece.width)

# Objects go kind by kind, tallest first inside a kind, so each shelf wastes little room. Path pieces come
# first among the props so all the paths sit together.
blocks, row = [], TEX // TILE
for kind in KINDS:
    names = [n for n in spec if spec[n]['kind'] == kind]
    if kind in KINDS[:5]: names.sort(key=lambda n: (not spec[n].get('path', False), -sprites[n].height, n))
    placed, row = shelve([(n, sprites[n]) for n in names], row)
    blocks += placed

sheet = Image.new('RGBA', (COLS * TILE, row * TILE), (0, 0, 0, 0))
index = {'tile': TILE, 'image': 'wildhaven-sheet.png', 'ground': {}, 'objects': {}}

# Grounds: one 4x4 block each along the top row.
for i, name in enumerate(GROUNDS):
    tex = Image.open(os.path.join(SRC, 'ground', f'{name}.png')).convert('RGB').resize((TEX, TEX))
    sheet.paste(tex, (i * TEX, 0))
    index['ground'][name] = {'x': i * TEX, 'y': 0, 'width': TEX, 'height': TEX}

# Objects: each stands bottom-centre in its block of squares, the way it stands on the ground in the game.
for name, col, top, w, h in blocks:
    im = sprites[name]
    x = col * TILE + (w * TILE - im.width) // 2
    y = (top + h) * TILE - PAD - im.height
    sheet.paste(im, (x, y))
    e = spec[name]
    index['objects'][name] = {'kind': e['kind'], 'x': x, 'y': y, 'width': im.width, 'height': im.height,
                              'origin': e['origin'], 'squares': [col, top, w, h]}

os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, 'wildhaven-sheet.png'), optimize=True)
json.dump(index, open(os.path.join(OUT, 'wildhaven-sheet.json'), 'w'), indent=1)

# The grid tileset: the whole sheet as 64x64 squares. Each square is named after what is drawn on it.
owner = {}
for i, name in enumerate(GROUNDS):
    for t in range(16): owner[(t // 4) * COLS + i * 4 + t % 4] = name
for name, col, top, w, h in blocks:
    for dy in range(h):
        for dx in range(w): owner[(top + dy) * COLS + col + dx] = name
grid = ['<?xml version="1.0" encoding="UTF-8"?>',
        f'<tileset version="1.10" name="wildhaven-sheet" tilewidth="{TILE}" tileheight="{TILE}" '
        f'tilecount="{COLS * row}" columns="{COLS}">',
        f' <image source="wildhaven-sheet.png" width="{sheet.width}" height="{sheet.height}"/>']
grid += [f' <tile id="{i}" type={quoteattr(n)}/>' for i, n in sorted(owner.items())]
open(os.path.join(OUT, 'wildhaven-sheet.tsx'), 'w', newline='\n').write('\n'.join(grid + ['</tileset>', '']))

# The objects tileset: one tile per whole object, each a rectangle of the same picture. `objectalignment`
# makes Tiled hold an object by the middle of its bottom edge, close to the game's ground point.
big_w = max(o['width'] for o in index['objects'].values()); big_h = max(o['height'] for o in index['objects'].values())
objs = ['<?xml version="1.0" encoding="UTF-8"?>',
        f'<tileset version="1.10" name="wildhaven-objects" tilewidth="{big_w}" tileheight="{big_h}" '
        f'tilecount="{len(blocks)}" columns="0" objectalignment="bottom">',
        ' <grid orientation="orthogonal" width="1" height="1"/>']
for i, (name, *_) in enumerate(blocks):
    o = index['objects'][name]
    objs += [f' <tile id="{i}" type={quoteattr(name)} x="{o["x"]}" y="{o["y"]}" width="{o["width"]}" height="{o["height"]}">',
             f'  <image source="wildhaven-sheet.png" width="{sheet.width}" height="{sheet.height}"/>', ' </tile>']
open(os.path.join(OUT, 'wildhaven-objects.tsx'), 'w', newline='\n').write('\n'.join(objs + ['</tileset>', '']))

print({k: sum(spec[n]['kind'] == k for n in spec) for k in KINDS})
print(f'{len(GROUNDS)} grounds and {len(blocks)} pieces on a {sheet.width}x{sheet.height} sheet ({COLS}x{row} squares)')

# Loose path props above have padding and are not grid connectors. Append the fixed
# connector set separately so existing maps keep every legacy tile ID unchanged.
from tiled_path_connectors import rebuild as rebuild_path_connectors
rebuild_path_connectors()
