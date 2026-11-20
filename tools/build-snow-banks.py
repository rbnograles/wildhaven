"""Paints a snowy bank along every waterline of the snow in the map drawn in Tiled.

The game's bank tiles (build-map.py, "bank tiles") follow the generated coast. A coast painted by hand in Tiled
has no bank of its own, and the old one is left floating where the coast used to be. This script lays a ribbon of
snow, ice, gravel and sea foam along the water's edge wherever the land is snow. Think of it as icing piped along
the edge of a cake: the ribbon is one straight picture, bent to follow the shore.
Inputs : assets/world/tiled/wildhaven-world-arranged.tmj (or the map named on the command line)
         assets/world/tiled/terrain-redrawn.json                   the ground kit: which tile shows which corners
         assets/world/source/shorelines/snow-ocean-bank.png        the painted snowy bank (only its straight piece)
         assets/world/source/shorelines/shorelines.json            where to cut it ("snow")
Outputs: assets/world/tiled/snow-banks.png   the snowy bank tiles, one of each different tile the shore needs
         the map itself: a `snow-banks` tileset (added after the others, so no other tile number moves) and its
         `banks` layer redone on every square that touches snow. Old bank tiles left in open water are removed.
         A dated copy of the map goes to tiled/backups/ first.
Run: python tools/build-snow-banks.py [map.tmj] [--preview picture.png] [--dry]
     Save the map in Tiled first, and reload it there afterwards. Then run tools/import-tiled-world.py.
     --dry writes nothing but the preview; --preview draws the snow coast with its new banks, to look at.
"""
import json, os, re, shutil, sys, time
import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(TOOLS, '..', 'assets', 'world')
TILED, SRC = os.path.join(ROOT, 'tiled'), os.path.join(ROOT, 'source')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
DRY = '--dry' in sys.argv
PREVIEW = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
if PREVIEW: args.remove(PREVIEW)
SOURCE = args[0] if args else os.path.join(TILED, 'wildhaven-world-arranged.tmj')

TILE = 64                      # the tiles' size in pixels and world units
KIT = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']   # Tiled's ground layers, bottom first
WATER, SNOW = KIT.index('water'), KIT.index('snow')
BANK_LAND = 56                 # how far the bank reaches onto the land, in units (as in build-map.py)
BANK_WET = 7                   # how far its wet edge reaches past the waterline
BANK_LOOP = 256                # the strip repeats after this many units: four tiles
SHEET_COLS = 32                # tiles across the tileset picture
NAME = 'snow-banks'            # the tileset's name in the map, and its picture's file name

tiled = json.load(open(SOURCE))
COLS, ROWS = tiled['width'], tiled['height']
kit = json.load(open(os.path.join(TILED, 'terrain-redrawn.json')))['materials']
layers = {l['name']: l for l in tiled['layers']}

# ---- the ground on every tile corner --------------------------------------------------------------------
# Read from Tiled's ground layers the way import-tiled-world.py reads it: each kit tile says which of its four
# corners its ground covers, and the topmost layer wins.
first = {os.path.basename(t.get('source') or t.get('name')): t['firstgid'] for t in tiled['tilesets']}
mask_of = {first['terrain-redrawn.tsx'] + tile: (i, int(m)) for i, g in enumerate(KIT) for m, tile in kit[g].items()}
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)
for i, g in enumerate(KIT):
    for at, gid in enumerate(layers[f'{i + 1:02d} {g}']['data']):
        found = mask_of.get(gid & 0x1FFFFFFF)
        if not found or found[0] != i: continue
        ty, tx = divmod(at, COLS)
        for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
            if found[1] & bit: corner[ty + dy, tx + dx] = max(corner[ty + dy, tx + dx], i)
land = corner > WATER
snow = corner == SNOW

# Says, for every tile, whether any of its four corners is true in a corner grid.
def any_corner(grid): return grid[:-1, :-1] | grid[:-1, 1:] | grid[1:, :-1] | grid[1:, 1:]

# ---- the strip ------------------------------------------------------------------------------------------
# Makes the first n rows of a picture repeat smoothly: its first `blend` rows fade in from the rows just after n.
def loop_rows(a, n, blend):
    out = a[:n].copy(); w = (np.arange(blend) / blend).reshape((-1,) + (1,) * (a.ndim - 1))
    out[:blend] = a[:blend] * w + a[n:n + blend] * (1 - w)
    return out

# Cuts the snowy strip: BANK_LAND + BANK_WET rows (far land side first, the wet edge last) by BANK_LOOP columns.
# The colours are kept "premultiplied" (already multiplied by how solid the pixel is), so blending two samples
# never drags in the colour of a see-through pixel. The same recipe as bank_strip in build-map.py.
def bank_strip():
    g = json.load(open(os.path.join(SRC, 'shorelines', 'shorelines.json'), encoding='utf-8'))['snow']
    a = np.asarray(Image.open(os.path.join(SRC, 'shorelines', 'snow-ocean-bank.png')).convert('RGBA')).astype(float)
    a[..., 3] = np.clip((a[..., 3] - 48) / 160, 0, 1) * 255   # the generated picture has a faint haze round each piece: drop it
    pic = Image.fromarray(a.astype('uint8')).convert('RGBa')

    # Cuts the rows y0..y1 of the straight piece and shrinks them to `rows` game rows, a little longer than one loop.
    def piece(y0, y1, rows): return np.asarray(pic.crop((g['left'], y0, g['right'], y1)).resize((BANK_LOOP + 16, rows), Image.LANCZOS)).astype(float)
    strip = np.concatenate([piece(g['top'], g['water'], BANK_LAND), piece(g['water'], g['bottom'], BANK_WET)])
    strip = loop_rows(strip.swapaxes(0, 1), BANK_LOOP, 16).swapaxes(0, 1)   # joined end to start, so it repeats
    strip[:g['fade']] *= ((np.arange(g['fade']) + 0.5) / g['fade'])[:, None, None]   # the land side melts into the snow
    return strip

STRIP = bank_strip()

# ---- where the waterline runs ---------------------------------------------------------------------------
# The ground kit draws a land tile's edge as a rounded outline through the middle of the tile. `kit_edge` is the
# kit's own sum (build-tiled-terrain.py, `distance`): above 0 is land, below 0 is not. Using the same sum puts the
# bank exactly on the edge the kit paints.
Y, X = np.mgrid[0:TILE, 0:TILE].astype(float) + 0.5

# One side of a tile: where the edge crosses it, from which of its two corners are land.
def boundary(a, b):
    t = np.arange(TILE) + 0.5
    if a == b: return np.full(TILE, 64.0 if a else -64.0)
    return 32 - t if a else t - 32

# The kit's edge for one tile, from which of its corners are land (top-left 1, top-right 2, bottom-left 4, bottom-right 8).
def kit_edge(mask):
    discs = [32 - np.hypot(X - cx, Y - cy) for cx, cy in ((0, 0), (64, 0), (0, 64), (64, 64))]
    count = bin(mask).count('1')
    if count in (0, 4): d = np.full((TILE, TILE), 64.0 if count else -64.0)
    elif count == 1: d = discs[mask.bit_length() - 1].copy()
    elif count == 3: d = -discs[(15 ^ mask).bit_length() - 1]
    elif mask in (3, 12, 5, 10): d = {3: 32 - Y, 12: Y - 32, 5: 32 - X, 10: X - 32}[mask].copy()
    else: d = np.maximum.reduce([discs[i] for i in range(4) if mask & (1 << i)])
    d += 1.1 * np.sin(X * np.pi / 8) * np.sin(Y * np.pi / 8)
    tl, tr, bl, br = [bool(mask & bit) for bit in (1, 2, 4, 8)]
    d[0], d[-1] = boundary(tl, tr), boundary(bl, br)
    d[:, 0], d[:, -1] = boundary(tl, bl), boundary(tr, br)
    return d

EDGES = [kit_edge(m) for m in range(16)]

# How far every pixel of one tile is from the waterline: above 0 on land, below 0 on water. The bank is wider
# than half a tile, so the tile alone can't tell: the answer needs the eight tiles round it too. `pattern` is the
# land-or-not of the 4x4 corners of that 3x3 block, as one number. Also returns which way the shore slopes.
field_cache = {}
def shore_field(pattern):
    if pattern in field_cache: return field_cache[pattern]
    c = np.array([(pattern >> i) & 1 for i in range(16)]).reshape(4, 4)
    block = np.zeros((3 * TILE, 3 * TILE))
    for by in range(3):
        for bx in range(3):
            mask = c[by, bx] + 2 * c[by, bx + 1] + 4 * c[by + 1, bx] + 8 * c[by + 1, bx + 1]
            block[by * TILE:(by + 1) * TILE, bx * TILE:(bx + 1) * TILE] = EDGES[mask]
    dry = block > 0
    if dry.all() or not dry.any(): field_cache[pattern] = None; return None

    # The pixels right at the waterline, on each side of it. Every other pixel measures to the nearest of them.
    pad = np.pad(dry, 1, mode='edge')
    differs = (pad[1:-1, 1:-1] != pad[:-2, 1:-1]) | (pad[1:-1, 1:-1] != pad[2:, 1:-1]) | (pad[1:-1, 1:-1] != pad[1:-1, :-2]) | (pad[1:-1, 1:-1] != pad[1:-1, 2:])
    yy, xx = np.mgrid[0:3 * TILE, 0:3 * TILE]
    # Measured on the middle tile and a ring of 8 pixels round it, so the slope at its sides is right too.
    lo, hi = TILE - 8, 2 * TILE + 8
    py, px = yy[lo:hi, lo:hi].ravel(), xx[lo:hi, lo:hi].ravel()
    here = dry[lo:hi, lo:hi].ravel()
    far = np.zeros(len(py))
    for side in (True, False):
        ey, ex = np.nonzero(differs & (dry != side))      # edge pixels of the other side
        mine = here == side
        gap = np.hypot(py[mine, None] - ey[None, :], px[mine, None] - ex[None, :]).min(axis=1) - 0.5
        far[mine] = gap if side else -gap
    far = far.reshape(hi - lo, hi - lo)
    # Close to the edge the kit's own smooth number is better than a count of whole pixels (no little steps).
    near = block[lo:hi, lo:hi]
    blend = np.clip((np.abs(far) - 3) / 4, 0, 1)
    far = near * (1 - blend) + far * blend
    slope_y, slope_x = np.gradient(far)
    result = (far[8:-8, 8:-8], slope_x[8:-8, 8:-8], slope_y[8:-8, 8:-8])
    field_cache[pattern] = result
    return result

# Paints one bank tile for the square at (tx, ty), or returns None when no bank reaches into it.
def bank_tile(tx, ty):
    c = np.zeros((4, 4), dtype=int)
    for dy in range(4):
        for dx in range(4):
            y, x = min(max(ty - 1 + dy, 0), ROWS), min(max(tx - 1 + dx, 0), COLS)
            c[dy, dx] = land[y, x]
    field = shore_field(int(sum(int(v) << i for i, v in enumerate(c.ravel()))))
    if field is None: return None
    inland_by, slope_x, slope_y = field
    row = BANK_LAND - inland_by                                    # which row of the strip each pixel shows
    if not ((row >= 0) & (row <= BANK_LAND + BANK_WET - 1)).any(): return None
    r0 = np.clip(np.floor(row), 0, BANK_LAND + BANK_WET - 2).astype(int); part = np.clip(row - r0, 0, 1)[..., None]

    # The strip must run along the shore. A shore can run any way, so the strip is laid four ways (along x, along
    # y and along both diagonals) and each pixel takes mostly the one that best matches the slope of the shore.
    wx, wy = tx * TILE + X, ty * TILE + Y
    ways = [(slope_y ** 2, wx), (slope_x ** 2, wy), ((slope_x + slope_y) ** 2 / 2, wx - wy), ((slope_x - slope_y) ** 2 / 2, wx + wy)]
    weight = np.stack([w ** 4 for w, _ in ways]); weight[0] += 1e-9
    weight /= weight.sum(axis=0)
    tile = np.zeros((TILE, TILE, 4))
    for w, (_, along) in zip(weight, ways):
        col = np.floor(along).astype(int) % BANK_LOOP
        tile += (STRIP[r0, col] * (1 - part) + STRIP[r0 + 1, col] * part) * w[..., None]
    tile[(row < 0) | (row > BANK_LAND + BANK_WET - 1)] = 0
    tile[..., :3] *= 255 / np.maximum(tile[..., 3:], 1e-6)   # back from premultiplied colour to plain colour
    tile = np.clip(tile, 0, 255).astype('uint8')
    return tile if tile[..., 3].max() > 8 else None

# ---- which squares get a snowy bank ---------------------------------------------------------------------
# Every square with a snow corner is redone: it gets its snowy tile, or nothing when no bank reaches it (which
# also clears an old bank tile stranded inland). The same picture is only stored once.
snowy = any_corner(snow)
tiles, number_of, placed = [], {}, {}
for ty, tx in np.argwhere(snowy):
    tile = bank_tile(int(tx), int(ty))
    if tile is None: placed[(ty, tx)] = None; continue
    key = tile.tobytes()
    if key not in number_of:
        number_of[key] = len(tiles); tiles.append(tile)
    placed[(ty, tx)] = number_of[key]

sheet_rows = -(-len(tiles) // SHEET_COLS); cell = TILE + 2
sheet = np.zeros((sheet_rows * cell, SHEET_COLS * cell, 4), dtype='uint8')
for i, t in enumerate(tiles):
    y, x = (i // SHEET_COLS) * cell, (i % SHEET_COLS) * cell
    sheet[y:y + cell, x:x + cell] = np.pad(t, ((1, 1), (1, 1), (0, 0)), mode='edge')   # extrusion stops seams when zoomed

# ---- the map: the tileset and the banks layer -----------------------------------------------------------
# The tileset goes after every other one, so no tile already on the map changes its number. A map that has it
# already (this script was run before) keeps its first number.
# Says how many tiles a tileset of the map holds; one kept in its own .tsx file is asked there.
def tile_count(t):
    if 'tilecount' in t: return t['tilecount']
    return int(re.search(r'tilecount="(\d+)"', open(os.path.join(os.path.dirname(SOURCE), t['source'])).read()).group(1))

others = [t for t in tiled['tilesets'] if t.get('name') != NAME]
old = next((t for t in tiled['tilesets'] if t.get('name') == NAME), None)
FIRST = old['firstgid'] if old else max(t['firstgid'] + tile_count(t) for t in others)
old_count = old['tilecount'] if old else 0
entry = {'columns': SHEET_COLS, 'firstgid': FIRST, 'image': f'{NAME}.png', 'imageheight': sheet.shape[0],
         'imagewidth': sheet.shape[1], 'margin': 1, 'name': NAME, 'spacing': 2, 'tilecount': sheet_rows * SHEET_COLS,
         'tileheight': TILE, 'tilewidth': TILE}
tiled['tilesets'] = others + [entry]

banks = layers['banks']['data']
wet_square = ~any_corner(land)
changed = cleared = afloat = 0
for (ty, tx), n in placed.items():
    at = int(ty) * COLS + int(tx); new = 0 if n is None else FIRST + n
    if banks[at] != new: changed += new > 0; cleared += new == 0
    banks[at] = new
for ty, tx in np.argwhere(wet_square):
    at = int(ty) * COLS + int(tx)
    if banks[at]: banks[at] = 0; afloat += 1
# A snowy tile left on a square that has no snow corner any more (the snow was repainted since the last run).
for at, gid in enumerate(banks):
    if FIRST <= gid < FIRST + max(old_count, entry['tilecount']) and not snowy[divmod(at, COLS)]: banks[at] = 0; cleared += 1

print(f'{len(tiles)} different snowy bank tiles; {sum(n is not None for n in placed.values())} squares have one')
print(f'banks layer: {changed} squares given a snowy tile, {cleared} old tiles taken off snow, {afloat} taken out of open water')

# ---- a picture to look at -------------------------------------------------------------------------------
# Draws the map's tile layers over the snow's part of the map, small, with the new banks in. Only the tile layers
# (no trees or houses): enough to judge the shore.
def draw_preview(path, scale=0.5):
    ys, xs = np.nonzero(snowy)
    y0, y1, x0, x1 = max(ys.min() - 3, 0), min(ys.max() + 4, ROWS), max(xs.min() - 3, 0), min(xs.max() + 4, COLS)
    pictures = {}
    for t in tiled['tilesets']:
        if 'image' in t: pictures[t['firstgid']] = (t, Image.fromarray(sheet) if t.get('name') == NAME else Image.open(os.path.join(os.path.dirname(SOURCE), t['image'])).convert('RGBA'))
        elif t['source'] in ('terrain-redrawn.tsx', 'path-connectors.tsx'):
            file = t['source'][:-4] + '.png'; im = Image.open(os.path.join(TILED, file)).convert('RGBA')
            pictures[t['firstgid']] = ({'columns': im.width // 66, 'margin': 1, 'spacing': 2, 'tilecount': (im.width // 66) * (im.height // 66)}, im)
    out = Image.new('RGBA', ((x1 - x0) * TILE, (y1 - y0) * TILE))
    for l in tiled['layers']:
        if l['type'] != 'tilelayer' or not l.get('visible', True): continue
        for ty in range(y0, y1):
            for tx in range(x0, x1):
                gid = l['data'][ty * COLS + tx] & 0x1FFFFFFF
                start = max((f for f in pictures if f <= gid), default=None)
                if not gid or start is None or gid - start >= pictures[start][0]['tilecount']: continue
                t, im = pictures[start]; n = gid - start
                sx, sy = 1 + (n % t['columns']) * 66, 1 + (n // t['columns']) * 66
                out.alpha_composite(im.crop((sx, sy, sx + TILE, sy + TILE)), ((tx - x0) * TILE, (ty - y0) * TILE))
    out.resize((int(out.width * scale), int(out.height * scale)), Image.LANCZOS).convert('RGB').save(path)
    print(f'preview: {path} (tiles {x0}-{x1} across, {y0}-{y1} down)')

if PREVIEW: draw_preview(PREVIEW)

# ---- save -----------------------------------------------------------------------------------------------
if DRY:
    print('dry run: nothing written')
else:
    backups = os.path.join(os.path.dirname(SOURCE), 'backups'); os.makedirs(backups, exist_ok=True)
    shutil.copy2(SOURCE, os.path.join(backups, os.path.basename(SOURCE)[:-4] + time.strftime('.%Y-%m-%d-%H%M%S.before-snow-banks.tmj')))
    Image.fromarray(sheet).save(os.path.join(os.path.dirname(SOURCE), f'{NAME}.png'))
    json.dump(tiled, open(SOURCE, 'w'), indent=1)   # one value per line, the way Tiled itself saves
    print(f'wrote {os.path.basename(SOURCE)} and {NAME}.png (tiles {FIRST}-{FIRST + entry["tilecount"] - 1}). Reload the map in Tiled.')
