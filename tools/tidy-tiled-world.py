"""Tidies a Tiled world map in place, keeping every hand edit that is not part of a mess it fixes.

export-tiled-world.py makes the map from the game's data; after that the map is edited by hand in Tiled, so it
must never be exported again over those edits. This script is the other way to improve it: it opens the saved
map, fixes a few kinds of untidiness and saves it back, first keeping a dated copy in tiled/backups/.
What it fixes:
  layers    `flat` (things under the player) goes back below `objects`, so pebbles never lie on top of trees
  crossings the river runs on through every crossing. The game leaves a patch of dry ground where a river can
            be crossed on foot (a ford), which showed as dirt cutting the river in two, also under the bridges.
            The banks beside the new water are rebuilt from the river's own bank tiles nearby (see rebank)
  paths     a path square lying wholly on a dirt square (a village plaza) or wholly on water is taken away
  clutter   small things (pebbles, sticks, tufts, flowers...) standing inside a tree, rock or building go
  in water  a loose tree, rock or small thing whose foot is in the water is taken away
  crowding  trees and rocks standing almost on top of each other are thinned: the one with the higher id goes
Buildings, signposts, caves, stairs, bridges and places are never removed or moved.
Inputs : assets/world/tiled/wildhaven-world.tmj (or the map named on the command line)
         assets/world/tiled/terrain-redrawn.json, wildhaven-sheet.json   the kits' tile numbers and sprite names
Outputs: the same map, tidied; a copy of how it was in assets/world/tiled/backups/
Run: python tools/tidy-tiled-world.py [map.tmj] [--steps=layers,crossings,paths,clutter] [--no-backup] [--dry]
     (close the map in Tiled first, or reload it afterwards)
"""
import json, math, os, shutil, sys, time
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world', 'tiled')
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
MAP = ARGS[0] if ARGS else os.path.join(OUT, 'wildhaven-world.tmj')
ALL_STEPS = ['layers', 'crossings', 'paths', 'clutter']
# --steps=layers,crossings runs only those steps; --no-backup skips the dated copy; --dry saves nothing.
STEPS = next((a[8:].split(',') for a in sys.argv if a.startswith('--steps=')), ALL_STEPS)
GROUNDS = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']   # the ground layers, bottom first
WATER, DIRT = GROUNDS.index('water'), GROUNDS.index('dirt')
# Where the game leaves a river dry so it can be crossed on foot, in world units (FORDS in build-map.py, moved
# out by the 2,048-unit sea border). Two of them have a bridge.
CROSSINGS = [(18648, 5698), (16748, 9548), (19548, 12148), (22248, 12423), (4948, 11448), (4098, 15148)]
FORD_REACH = 6                 # how many squares from a crossing its patch of ford dirt may reach
BANK_LOOP = 4                  # the painted bank repeats every four squares along a shore
SMALL = {'pebbles', 'sticks', 'feather', 'pine-cone', 'antler', 'mossy-stone', 'grey-rock', 'flat-stone', 'flowers',
         'driftwood', 'grass-tuft', 'tall-grass', 'dry-grass', 'snow-grass', 'fern', 'wild-berries', 'dead-bush'}
BIG = {'pines', 'pine', 'oak', 'big-oak', 'snowy-pine', 'jungle-tree', 'palm', 'cactus', 'rocks-a', 'rocks-b',
       'beach-rock', 'ice-rock', 'boulder', 'cliff-rock', 'iron-ore', 'copper-ore'}   # scenery that can crowd
SOLID = BIG | {'tent', 'house-a', 'house-b', 'house-c', 'workshop', 'ship', 'sandstone-ruin', 'cave-forest',
               'cave-snow', 'cave-canyon', 'log', 'signpost'}                        # things a small thing can hide in
CROWD = 0.6                    # two big things are too close when nearer than this share of their average width
INSIDE = (0.32, 0.7)           # a small thing is "inside" a solid one within this share of its width and height

world = json.load(open(MAP))
layers = {l['name']: l for l in world['layers']}
COLS, ROWS, TILE = world['width'], world['height'], world['tilewidth']
first = {os.path.basename(t.get('source', t.get('name', ''))): t['firstgid'] for t in world['tilesets']}
FIRST_GROUND, FIRST_OBJECT = first['terrain-redrawn.tsx'], first['wildhaven-objects.tsx']
kit = json.load(open(os.path.join(OUT, 'terrain-redrawn.json')))['materials']
sprite_names = list(json.load(open(os.path.join(OUT, 'wildhaven-sheet.json')))['objects'])
report = {}

# Gives the name of the ground layer for a ground, as the exporter names it ("04 grass").
def layer_of(i): return layers[f'{i + 1:02d} {GROUNDS[i]}']

# Says what sprite an object shows: its Class if it has one, else worked out from its tile number (an object
# added by hand in Tiled has no Class).
def kind(obj):
    if obj.get('type'): return obj['type']
    n = (obj.get('gid', 0) & 0x1fffffff) - FIRST_OBJECT
    return sprite_names[n] if 0 <= n < len(sprite_names) else ''

# ---- layers: flat things under standing things -----------------------------------------------------
order = world['layers']
if 'layers' in STEPS and 'flat' in layers and 'objects' in layers and order.index(layers['flat']) > order.index(layers['objects']):
    order.remove(layers['flat']); order.insert(order.index(layers['objects']), layers['flat'])
    report['layers'] = 'flat moved back under objects'

# ---- read the ground: which ground shows on every tile corner --------------------------------------
# A ground tile's number says which of its four corners (top-left 1, top-right 2, bottom-left 4, bottom-right 8)
# hold that ground. The topmost layer that holds a corner is the ground you see there.
mask_of = {FIRST_GROUND + tile: (i, int(m)) for i, g in enumerate(GROUNDS) for m, tile in kit[g].items()}
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)
odd = np.zeros((ROWS, COLS), dtype=bool)        # squares holding a tile this script can't read: left alone
for i in range(len(GROUNDS)):
    for at, gid in enumerate(layer_of(i)['data']):
        if not gid: continue
        ty, tx = divmod(at, COLS)
        if mask_of.get(gid, (None,))[0] != i: odd[ty, tx] = True; continue
        for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
            if mask_of[gid][1] & bit: corner[ty + dy, tx + dx] = max(corner[ty + dy, tx + dx], i)

# Repaints the ground tiles of a block of squares from the corners, in every ground layer. A layer covers the
# corners of its own ground and of every ground above it, the same rule the exporter uses.
def repaint(y0, y1, x0, x1):
    for ty in range(max(0, y0), min(ROWS, y1 + 1)):
        for tx in range(max(0, x0), min(COLS, x1 + 1)):
            if odd[ty, tx]: continue
            for i, g in enumerate(GROUNDS):
                here = [corner[ty + dy, tx + dx] >= i for dy, dx in ((0, 0), (0, 1), (1, 0), (1, 1))]
                m = here[0] + 2 * here[1] + 4 * here[2] + 8 * here[3]
                layer_of(i)['data'][ty * COLS + tx] = FIRST_GROUND + kit[g][str(m)] if m else 0

# ---- crossings: let the river run on through ---------------------------------------------------------
# Finds the stretch of water in one line of corners that is nearest to a spot on it. Returns (first, last) or None.
def water_run(line, near):
    wet = [b for b in range(max(0, near - 2 * FORD_REACH), min(len(line) - 1, near + 2 * FORD_REACH) + 1) if line[b] <= WATER]
    if not wet: return None
    b = min(wet, key=lambda b: abs(b - near)); lo = hi = b
    while lo - 1 in wet: lo -= 1
    while hi + 1 in wet: hi += 1
    return (lo, hi) if hi - lo < 2 * FORD_REACH else None

banks = layers['banks']['data'] if 'banks' in layers else None
paths = layers['paths']['data'] if 'paths' in layers else None

# Turns the patch of ford dirt at a crossing back into river. The river is found just before and just after the
# patch, and drawn straight across from the one to the other; what is left of the dirt becomes the ground
# around it. A river may run down the map or across it, so both ways are tried: `flip` turns the map on its
# side, and everything below then reads `a` as "along the river" and `b` as "across it".
# Returns True if a river was mended.
def mend(cx, cy):
    global corner
    for flip in (False, True):
        C = corner.T if flip else corner
        a0, b0 = (cx, cy) if flip else (cy, cx)
        A, B = C.shape
        ford = [(a, b) for a in range(max(1, a0 - FORD_REACH), min(A - 2, a0 + FORD_REACH) + 1)
                for b in range(max(0, b0 - FORD_REACH), min(B - 1, b0 + FORD_REACH) + 1) if C[a, b] == DIRT]
        if not ford: return False
        first, last = min(a for a, b in ford), max(a for a, b in ford)
        before, after = water_run(C[first - 1], b0), water_run(C[last + 1], b0)
        if not before or not after: continue
        # The ground round the ford (not dirt, not water) is what the dry edges of the patch turn back into.
        ring = [int(v) for v in C[max(0, first - 2):last + 3, max(0, b0 - FORD_REACH - 2):b0 + FORD_REACH + 3].flatten()
                if v not in (DIRT, WATER, 0)]
        land = max(set(ring), key=ring.count) if ring else GROUNDS.index('grass')
        old_wet = (corner <= WATER).copy()
        for a in range(first, last + 1):
            t = (a - first + 1) / (last - first + 2)   # 0 just before the ford, 1 just after: the river slides across
            lo, hi = round(before[0] + (after[0] - before[0]) * t), round(before[1] + (after[1] - before[1]) * t)
            for b in range(max(0, b0 - FORD_REACH), min(B - 1, b0 + FORD_REACH) + 1):
                if lo <= b <= hi: C[a, b] = WATER
                elif C[a, b] == DIRT: C[a, b] = land
        a_lo, a_hi, b_lo, b_hi = first - 1, last, b0 - FORD_REACH - 1, b0 + FORD_REACH
        y0, y1, x0, x1 = (b_lo, b_hi, a_lo, a_hi) if flip else (a_lo, a_hi, b_lo, b_hi)
        repaint(y0, y1, x0, x1)
        if banks: rebank(old_wet, y0 - 2, y1 + 2, x0 - 2, x1 + 2)
        return True
    return False

SAMPLE = 40                     # how many squares round a mended crossing its river's bank tiles are read from

# Says how far each tile corner is from water, the way build-map.py counts it: 0 is water, 1 touches water
# (a diagonal step counts), 2 is anything farther.
def shore_distance(wet):
    near = wet.copy(); near[1:] |= wet[:-1]; near[:-1] |= wet[1:]
    box = near.copy(); box[:, 1:] |= near[:, :-1]; box[:, :-1] |= near[:, 1:]
    return np.where(wet, 0, np.where(box, 1, 2))

# Gives the bank tiles of a block of squares again after the water there changed.
# A game bank tile is chosen by its four corners' distances from water and by where it sits in the 4x4 block the
# bank picture repeats over. So the river's own bank tiles nearby (within SAMPLE squares, before the change) are
# listed by those, like a catalogue, and each square of the block takes the tile its new shape needs. A shape
# never seen nearby takes the commonest tile with the same corner distances, wherever in the block it was.
def rebank(old_wet, y0, y1, x0, x1):
    old_d, new_d = shore_distance(old_wet), shore_distance(corner <= WATER)
    exact, loose = {}, {}
    for ty in range(max(0, y0 - SAMPLE), min(ROWS, y1 + SAMPLE)):
        for tx in range(max(0, x0 - SAMPLE), min(COLS, x1 + SAMPLE)):
            gid = banks[ty * COLS + tx]
            if not gid or (y0 <= ty <= y1 and x0 <= tx <= x1): continue
            d = tuple(old_d[ty:ty + 2, tx:tx + 2].flatten())
            exact.setdefault((d, tx % 4, ty % 4), []).append(gid); loose.setdefault(d, []).append(gid)
    for ty in range(max(0, y0), min(ROWS, y1 + 1)):
        for tx in range(max(0, x0), min(COLS, x1 + 1)):
            d = tuple(new_d[ty:ty + 2, tx:tx + 2].flatten())
            seen = exact.get((d, tx % 4, ty % 4)) or loose.get(d)
            banks[ty * COLS + tx] = 0 if max(d) == 0 or min(d) == 2 or not seen else max(set(seen), key=seen.count)

if 'crossings' in STEPS:
    mended = sum(mend(round(x / TILE), round(y / TILE)) for x, y in CROSSINGS)
    report['crossings'] = f'{mended} of {len(CROSSINGS)} with the river running through again'

# ---- paths: none across a plaza or under water -----------------------------------------------------
if paths and 'paths' in STEPS:
    gone = 0
    for at, gid in enumerate(paths):
        if not gid: continue
        ty, tx = divmod(at, COLS)
        four = corner[ty:ty + 2, tx:tx + 2]
        if (four == DIRT).all() or (four <= WATER).all(): paths[at] = 0; gone += 1
    report['paths'] = f'{gone} squares on plaza dirt or water removed'

# ---- clutter and crowding --------------------------------------------------------------------------
# All objects are sorted into 256-unit buckets by their foot, so each one is compared only with its neighbours.
everything = [(o, kind(o), l) for l in (layers['flat'], layers['objects']) for o in l['objects']] if 'clutter' in STEPS else []
buckets = {}
for o, k, _ in everything:
    if k in SOLID: buckets.setdefault((int(o['x'] // 256), int(o['y'] // 256)), []).append((o, k))

# Lists the solid things in the buckets round a spot.
def nearby(x, y):
    bx, by = int(x // 256), int(y // 256)
    return [e for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2) for e in buckets.get((bx + dx, by + dy), [])]

drop = set()
# Anything loose whose foot is in the water goes first: a tree left standing where a ford was, or a rock the
# river now covers. Ripples and waves belong on water and are not in SMALL or BIG, so they stay.
for o, k, _ in everything:
    fx, fy = min(COLS, max(0, round(o['x'] / TILE))), min(ROWS, max(0, round((o['y'] - 6) / TILE)))
    if k in SMALL | BIG and corner[fy, fx] <= WATER: drop.add(o['id'])
report['in water'] = f'{len(drop)} loose things standing in water removed'
in_water = len(drop)
# Crowding first: go through the big things in the order they were made and keep one only if nothing already
# kept stands almost on its spot. Up-and-down distance counts double, because things overlap more sideways.
kept = {}
for o, k, _ in sorted(everything, key=lambda e: e[0]['id']):
    if k not in BIG or o['id'] in drop: continue
    cell = (int(o['x'] // 256), int(o['y'] // 256))
    close = any(math.hypot(o['x'] - p['x'], 2 * (o['y'] - p['y'])) < CROWD * (o['width'] + p['width']) / 2
                for dy in (-1, 0, 1) for dx in (-1, 0, 1) for p in kept.get((cell[0] + dx, cell[1] + dy), []))
    if close: drop.add(o['id'])
    else: kept.setdefault(cell, []).append(o)
report['crowding'] = f'{len(drop) - in_water} trees and rocks removed'

# Then clutter: a small thing whose middle lies inside the body of a solid thing that is still there.
before = len(drop)
for o, k, _ in everything:
    if k not in SMALL: continue
    mx, my = o['x'], o['y'] - o['height'] / 2
    for p, pk in nearby(mx, my):
        if p['id'] in drop: continue
        if abs(mx - p['x']) < INSIDE[0] * p['width'] and p['y'] - INSIDE[1] * p['height'] < my < p['y'] + 12:
            drop.add(o['id']); break
report['clutter'] = f'{len(drop) - before} small things inside bigger ones removed'
for l in (layers['flat'], layers['objects']): l['objects'] = [o for o in l['objects'] if o['id'] not in drop]
if 'clutter' not in STEPS:
    for step in ('in water', 'crowding', 'clutter'): report.pop(step)

# ---- save, keeping a copy of how it was ------------------------------------------------------------
backups = os.path.join(os.path.dirname(MAP), 'backups'); os.makedirs(backups, exist_ok=True)
copy = os.path.join(backups, os.path.basename(MAP)[:-4] + time.strftime('.%Y-%m-%d-%H%M%S.before-tidy.tmj'))
if '--dry' not in sys.argv:
    if '--no-backup' not in sys.argv:
        shutil.copy2(MAP, copy); print('kept a copy at', os.path.relpath(copy, os.path.dirname(MAP)))
    json.dump(world, open(MAP, 'w'), separators=(',', ':'))
if odd.any(): report['left alone'] = f'{int(odd.sum())} ground squares with tiles from another set'
for what, said in report.items(): print(f'{what}: {said}')
