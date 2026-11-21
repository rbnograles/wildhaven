"""Scatters wild herb patches over the map drawn in Tiled.

Wild herbs (WILD['wild-herbs'] in src/data/supplies.js) are picked by hand for herbs. Flowers were the only
herbs, and they grow almost only in the meadows, the lagoon and the jungle, so this script plants herbs mostly in
the pine woods, the snow, the canyons and the desert. Think of it as walking the map with a bag of seeds: one
throw per big square, and a seed only stays where the ground is dry, level and clear.
Each patch is added to the map's `objects` layer as a plain POINT whose Class is `wild-herbs`. Tiled's sprite
sheet has no picture for it, so Tiled shows a pin; tools/import-tiled-world.py reads the point as the plant.
A point can be moved or deleted in Tiled like anything else.
Inputs : assets/world/tiled/wildhaven-world-arranged.tmj (or the map named on the command line)
         assets/world/tiled/terrain-redrawn.json     the ground kit: which tile shows which corners
         assets/world/map/wildhaven.json             the game map: its regions and hills
         assets/world/source/places.json             each region's letter
         assets/world/source/objects.json            which sprites are solid
Outputs: the map itself, with the herb points (the ones an earlier run added are taken out first, so running
         twice never doubles them). A dated copy of the map goes to tiled/backups/ first.
Run: python tools/add-tiled-herbs.py [map.tmj] [--dry]
     Save and close the map in Tiled first, and open it again afterwards. Then run tools/import-tiled-world.py.
     --dry writes nothing and only prints how many patches each region would get.
"""
import json, os, random, shutil, sys, time
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(TOOLS, '..', 'assets', 'world')
TILED, SRC, GAME_DIR = os.path.join(ROOT, 'tiled'), os.path.join(ROOT, 'source'), os.path.join(ROOT, 'map')
DRY = '--dry' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]
SOURCE = args[0] if args else os.path.join(TILED, 'wildhaven-world-arranged.tmj')

TILE = 64                      # the tiles' size in pixels and world units
KIT = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']   # Tiled's ground layers, bottom first
WATER, SAND, DIRT = KIT.index('water'), KIT.index('sand'), KIT.index('dirt')
NAME = 'wild-herbs'            # the sprite's name: each point's Class
# The chance that one square grows a patch, by region letter (places.json): high where flowers are scarce.
SHARE = {'P': 0.9, 'S': 0.32, 'C': 0.18, 'D': 0.16, 'J': 0.035, 'h': 0.04, 'L': 0.035}
STEP, JITTER = 380, 110        # one throw per STEP-unit square, landing up to JITTER from its middle
DRY_REACH, BEACH_REACH = 2, 5  # tile corners that must be dry around a patch: 128 units, or 320 on desert sand (no beach herbs)
CLEAR = 120                    # units kept from anything solid and from other things picked up by hand
PLACE_CLEAR, BRIDGE_CLEAR = 150, 260   # units kept from a place (spawn, landmark, signpost...) and from a bridge
# Walk-through things a patch still keeps clear of, so two pick-ups never sit on top of each other.
PICKUPS = {'pebbles', 'sticks', 'antler', 'mossy-stone', 'grey-rock', 'flat-stone', 'wild-berries', 'driftwood', 'flowers'}

tiled_time = os.path.getmtime(SOURCE)
tiled = json.load(open(SOURCE))
game = json.load(open(os.path.join(GAME_DIR, 'wildhaven.json')))
props = {p['name']: p['value'] for p in game['properties']}
specs = json.load(open(os.path.join(SRC, 'objects.json')))
region_keys = [r['key'] for r in json.load(open(os.path.join(SRC, 'places.json')))['regions']]
region_names = {r['key']: r['name'] for r in json.load(open(os.path.join(SRC, 'places.json')))['regions']}
COLS, ROWS = tiled['width'], tiled['height']
assert (COLS, ROWS) == (game['width'], game['height']), 'the Tiled map must be the same size as the game map'
by_name = {l['name']: l for l in tiled['layers']}

# ---- the ground at every tile corner (read as tools/import-tiled-world.py reads it) -----------------------
kit = json.load(open(os.path.join(TILED, 'terrain-redrawn.json')))['materials']
first = {os.path.basename(t.get('source') or t.get('name')): t['firstgid'] for t in tiled['tilesets']}
KIT_FIRST = first['terrain-redrawn.tsx']
mask_of = {KIT_FIRST + tile: (i, int(m)) for i, g in enumerate(KIT) for m, tile in kit[g].items()}
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)
for i, g in enumerate(KIT):
    for at, gid in enumerate(by_name[f'{i + 1:02d} {g}']['data']):
        found = mask_of.get(gid & 0x1FFFFFFF)
        if not found or found[0] != i: continue
        ty, tx = divmod(at, COLS)
        for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
            if found[1] & bit: corner[ty + dy, tx + dx] = max(corner[ty + dy, tx + dx], i)
wet = corner <= WATER
path_tiles = np.array(by_name['paths']['data']).reshape(ROWS, COLS) != 0
levels = np.array(list(props['elevation'])).reshape(ROWS, COLS)   # '0'-'3' level, 'w' wall, 's' stairs

# ---- what already stands on the map ---------------------------------------------------------------------
# Earlier herb points are forgotten here, so a second run lays them afresh instead of dodging the old ones.
old = [o for o in by_name['objects']['objects'] if o.get('type') == NAME and 'gid' not in o]
crowd, bridges = [], []
for l in tiled['layers']:
    if l['type'] != 'objectgroup' or l['name'] == 'places': continue
    for o in l['objects']:
        name = o.get('type', '')
        if name not in specs or 'gid' not in o: continue
        if name == 'bridge': bridges.append((o['x'], o['y']))
        if 'footprint' in specs[name] or name in PICKUPS:
            ox, oy = specs[name]['origin']   # Tiled pins a picture by the middle of its bottom edge
            crowd.append((o['x'] + (ox - 0.5) * o['width'], o['y'] + (oy - 1) * o['height']))
crowd, bridges = np.array(crowd, float), np.array(bridges, float).reshape(-1, 2)
places = np.array([(o['x'], o['y']) for o in by_name['places']['objects']], float)

# Says which region letter a spot is in, from the game map's region grid.
def region_key(x, y):
    cell, cols = props['regionCell'], props['regionCols']
    return region_keys[int(props['regionGrid'][int(y // cell) * cols + int(x // cell)])]

# Says whether any of the points lies within `reach` units of the spot.
def near(points, x, y, reach):
    return len(points) > 0 and bool((np.hypot(points[:, 0] - x, points[:, 1] - y) < reach).any())

# Says whether a herb patch may grow on this spot: dry, level, off the paths and clear of other things.
def fits(x, y, key):
    cx, cy, tx, ty = int(round(x / TILE)), int(round(y / TILE)), int(x // TILE), int(y // TILE)
    if not (6 <= tx < COLS - 6 and 6 <= ty < ROWS - 6): return False
    ground = corner[cy, cx]
    if ground <= WATER or ground >= DIRT or (ground == SAND and key != 'D'): return False
    reach = BEACH_REACH if ground == SAND else DRY_REACH
    if wet[cy - reach:cy + reach + 1, cx - reach:cx + reach + 1].any(): return False
    around = levels[ty - 1:ty + 2, tx - 1:tx + 2]
    if not (around == around[1, 1]).all() or around[1, 1] in 'ws': return False
    if path_tiles[ty - 1:ty + 2, tx - 1:tx + 2].any(): return False
    return not (near(places, x, y, PLACE_CLEAR) or near(bridges, x, y, BRIDGE_CLEAR) or near(crowd, x, y, CLEAR))

# ---- scatter: one seeded throw per square, so changing one region's share never moves another's patches ----
herbs = []
for gy in range(STEP // 2, ROWS * TILE, STEP):
    for gx in range(STEP // 2, COLS * TILE, STEP):
        rng = random.Random(gx * 83492791 ^ gy * 49979687 ^ 0x4e2b)
        x, y = gx + rng.randint(-JITTER, JITTER), gy + rng.randint(-JITTER, JITTER)
        roll = rng.random()
        if not (0 <= x < COLS * TILE and 0 <= y < ROWS * TILE): continue
        key = region_key(x, y)
        if roll < SHARE.get(key, 0) and fits(x, y, key): herbs.append((x, y, key))

for key in SHARE: print(f'{region_names[key]}: {sum(1 for h in herbs if h[2] == key)}')
print(f'wild herbs: {len(herbs)} patches ({len(old)} from an earlier run taken out)')
if DRY: sys.exit()

# ---- save: a dated copy first, and never over a map that was saved in Tiled while this ran -----------------
objects = [o for o in by_name['objects']['objects'] if not any(o is gone for gone in old)]
number = tiled.get('nextobjectid', 1)
for x, y, _ in herbs:
    objects.append({'height': 0, 'id': number, 'name': '', 'point': True, 'rotation': 0, 'type': NAME, 'visible': True,
                    'width': 0, 'x': x, 'y': y})
    number += 1
by_name['objects']['objects'] = objects
tiled['nextobjectid'] = number
assert os.path.getmtime(SOURCE) == tiled_time, 'the map was saved while this ran: nothing written, run it again'
backups = os.path.join(os.path.dirname(SOURCE), 'backups'); os.makedirs(backups, exist_ok=True)
shutil.copy2(SOURCE, os.path.join(backups, os.path.basename(SOURCE)[:-4] + time.strftime('.%Y-%m-%d-%H%M%S.before-herbs.tmj')))
json.dump(tiled, open(SOURCE, 'w'), indent=1)   # one value per line, the way Tiled itself saves
print('saved', os.path.relpath(SOURCE, ROOT), '- open it again in Tiled, then run tools/import-tiled-world.py')
