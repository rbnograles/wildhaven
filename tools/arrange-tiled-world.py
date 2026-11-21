"""Lays out the Tiled world map by design: villages, a path network, hidden caves, and forests in groves.

The exported map copies the game's scatter, which looks random and untidy in Tiled. This script keeps the map's
ground, hills, rivers, rocks, ores and everything placed or moved by hand, and lays out the rest again on purpose:
  villages  one big village (Hollowstead) and smaller ones in the other regions: a dirt plaza with a path running
            in a loop round it, and houses round the loop (VILLAGES). Hollowstead is fenced in by a ring of trees
            with gaps where the paths go through. No campfires or tents are put down: the player builds those
  paths     a network joining the villages, the signposts and buildings placed by hand. Each path runs straight
            and turns only to get round water, a hill or something solid in the way (a house, a big rock, a tree
            placed by hand). Extra links make loops and crossroads. A path crosses a river only at a crossing,
            on a bridge
  caves     tucked away: at the foot of hills inside thick forest, in the mountains of the canyons and the snow,
            and on the lagoon's islets. Each one says in its `holds` property whether it holds unique minerals
            (and which, in `mineral`) or is a wolf den
  forests   trees grow in groves: tight stands where the forest is thick, a few loose trees round them, open
            ground between. Pines stand close together, and the snow is full of snowy pines. Sizes vary a little
            and each kind has its own size (SIZE). Bushes, ferns, grass tufts and flowers grow in clumps
  removed   every feather and pine cone lying on the ground; the old caves, bridges, paths, trees and tufts
The game reads none of this: it only changes the Tiled map. The rivers are first mended at every crossing and the
flat layer put back under the objects by tidy-tiled-world.py.
Inputs : the hand-edited map (default assets/world/tiled/wildhaven-world.tmj; it is only read)
         assets/world/map/wildhaven.json      hills (the elevation grid) and regions
         assets/world/source/places.json      places to keep clear, and where villages and caves go
         assets/world/tiled/*.json            the kits' tile numbers and the sprite sheet's sizes
Outputs: the arranged map (default assets/world/tiled/wildhaven-world-generated.tmj; wildhaven-world-arranged.tmj
         is the map edited by hand in Tiled, so it is never the default)
Objects placed or moved by hand are found by exporting a fresh map and comparing: anything not in it, or not where
it was, is kept as it is. A village laid out by hand in Tiled is written into LAYOUTS, so a new run keeps it.
Before the output is replaced, a dated copy of it goes to tiled/backups/.
Run: python tools/arrange-tiled-world.py [hand-edited.tmj] [output.tmj]
"""
import heapq, json, math, os, random, shutil, subprocess, sys, tempfile, time
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(TOOLS, '..', 'assets', 'world')
OUT = os.path.join(ROOT, 'tiled')
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, 'wildhaven-world.tmj')
# The output is a file of its own, never a map that is open and being edited in Tiled.
TARGET = sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, 'wildhaven-world-generated.tmj')
SEED = 11                      # change it for a different but equally tidy layout
GROUNDS = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']   # the ground layers, bottom first
WATER, SAND, DIRT, SNOW = (GROUNDS.index(g) for g in ('water', 'sand', 'dirt', 'snow'))
NORTH, EAST, SOUTH, WEST = 1, 2, 4, 8   # the path kit's numbers for the sides a square joins

# ---- the design --------------------------------------------------------------------------------------
# Villages: name, middle (world units), size. A big one has a wide plaza ringed with houses and many tents.
VILLAGES = [
    ('Hollowstead', 14336, 9348, 'big'),
    ("Scout's Camp", 14288, 4108, 'small'),
    ("Caravan's Rest", 4248, 7148, 'small'),
    ('Stonewater Mine', 6648, 9648, 'small'),
    ('Snowed-in Hut', 23048, 6948, 'small'),
    ('Old Jetty', 22900, 10700, 'small'),
    ('Overgrown Camp', 7248, 16848, 'small'),
    ("Prospector's Camp", 3348, 17048, 'small'),
]
PLAZA = {'big': 6, 'small': 3}  # plaza radius in squares
LOOP = {'big': 7, 'small': 5}   # how far the village's path loop runs from its middle, in squares (a square ring)
# The houses put round a village, outside its loop, by size and region: (sprite, how many). Hollowstead's own four
# buildings already stand inside its loop. Campfires and tents are the player's to build, so none are put down.
HOMES = {
    'big': [('house-c', 2), ('house-b', 1), ('house-a', 1)],
    'snow': [('house-c', 2)],
    'dry': [('house-b', 1), ('house-c', 1)],
    'green': [('house-a', 1), ('house-b', 1)],
}
FENCE = {'big': 15}             # a big village is ringed with trees this many squares from its middle, like a fence
FENCE_TREES = [('pine', 3), ('pines', 1), ('oak', 1)]
FENCE_STEP = 40                 # how far apart the fence trees stand, in world units
CLEARING = 3                    # no forest grows within this many squares outside a small village's loop
# Villages laid out by hand, used instead of made-up houses and a made-up loop. Each object is the bottom middle
# of its picture in world units (as Tiled shows it) and its width; the height keeps the picture's shape. `loop`
# is the path ring's top-left and bottom-right squares, `paths` are extra straight paths (from square, to
# square), and `replaces` lists the game's own buildings there that were moved or taken away (sprite and spot; they
# go even if they were nudged by hand). No grass or flowers are scattered inside a laid-out village: it has its own.
LAYOUTS = {
    'Hollowstead': dict(
        loop=((214, 144), (224, 148)),
        paths=[((224, 148), (224, 152)), ((224, 152), (226, 152)), ((224, 144), (225, 144))],
        objects=[('house-a', 14104, 9166, 195), ('house-c', 13871, 9416, 190), ('house-c', 14169, 9428, 205),
                 ('house-a', 14253, 9676, 195), ('campfire', 14049, 9478, 64), ('signpost', 14431, 9738, 62),
                 ('log', 13662, 9508, 75), ('tall-grass', 13646, 9198, 70), ('tall-grass', 13691, 9244, 70),
                 ('tall-grass', 13801, 9494, 66), ('grass-tuft', 13861, 9504, 56), ('grass-tuft', 13911, 9486, 56),
                 ('grass-tuft', 13926, 9454, 48), ('tall-grass', 14316, 9494, 66), ('grass-tuft', 13856, 9728, 56),
                 ('grass-tuft', 13911, 9721, 56)],
        replaces=[('house-a', 14104, 9151), ('house-c', 14159, 9496), ('workshop', 14571, 9493),
                  ('signpost', 14437, 9462)],
    ),
}
STONE_PATHS = {'desert', 'canyons', 'frostpeak'}   # regions whose paths are cobbled, as in the game
# Where the game's rivers may be crossed (FORDS in build-map.py, in world units): the only places a path may cross.
CROSSINGS = [(18648, 5698), (16748, 9548), (19548, 12148), (22248, 12423), (4948, 11448), (4098, 15148)]
CROSS_REACH = 6                # squares round a crossing where a path may cross the water
TURN = 7                       # what a turn costs a path, in squares walked: high, so paths run straight
SHARED = 0.55                  # what a square already on a path costs: low, so paths join into trunks
SHORTCUT = 1.7                 # an extra link is added where the paths make the trip this many times longer
LINK_MAX = 6500                # no link, first or extra, is longer than this, in world units

# Caves per region: how many, and what they hold. Forest caves are hidden in a thick grove.
CAVES = {
    'pinefall': (1, 'wolf den', None), 'meadows': (2, 'wolf den', None), 'jungle': (2, 'minerals', 'jade'),
    'canyons': (3, 'minerals', 'gold'), 'frostpeak': (3, 'minerals', 'frost crystal'),
    'desert': (1, 'minerals', 'sunstone'), 'islets': (2, 'minerals', 'sea glass'),
}
FOREST_CAVES = {'pinefall', 'meadows', 'jungle'}
CAVE_SPRITE = {'frostpeak': 'cave-snow', 'canyons': 'cave-canyon', 'desert': 'cave-canyon'}   # else cave-forest
CAVE_APART = 2400              # two caves are never nearer than this, in world units
GROVE_ROUND_CAVE = 420         # a forest cave stands in thick forest this far round it

# Forests per region. dense/sparse: the share of the region's land that is thick grove or loose woodland (the
# rest is open). Each list is (sprite, weight). lone: the chance a spot in the open still gets a single tree.
FOREST = {
    'pinefall': dict(dense=0.38, sparse=0.2, lone=0.008, thick=[('pine', 7), ('pines', 3), ('oak', 1)],
                     loose=[('pine', 4), ('oak', 2), ('pines', 1)], under=[('tall-grass', 1)],
                     tufts=['grass-tuft', 'tall-grass'], flowers=0.5),
    'frostpeak': dict(dense=0.45, sparse=0.22, lone=0.01, thick=[('snowy-pine', 1)], loose=[('snowy-pine', 1)],
                      under=[('snow-grass', 1)], tufts=['snow-grass'], flowers=0),
    'meadows': dict(dense=0.15, sparse=0.15, lone=0.006, thick=[('oak', 4), ('big-oak', 3), ('pine', 3), ('pines', 1)],
                    loose=[('oak', 3), ('big-oak', 1), ('pine', 1)], under=[('tall-grass', 1)],
                    tufts=['grass-tuft', 'tall-grass'], flowers=1),
    'lagoon': dict(dense=0.12, sparse=0.15, lone=0.006, thick=[('palm', 5), ('oak', 1)], loose=[('palm', 3), ('oak', 1)],
                   under=[('tall-grass', 1)], tufts=['grass-tuft', 'tall-grass'], flowers=0.6),
    'jungle': dict(dense=0.33, sparse=0.18, lone=0.01, thick=[('jungle-tree', 6), ('palm', 2)],
                   loose=[('jungle-tree', 3), ('palm', 2)], under=[('tall-grass', 1)], tufts=['grass-tuft'], flowers=0.3),
    'desert': dict(dense=0.03, sparse=0.06, lone=0.002, thick=[('cactus', 2), ('dead-bush', 1)],
                   loose=[('cactus', 1), ('dead-bush', 2)], under=[('dry-grass', 1)], tufts=['dry-grass'], flowers=0),
    'canyons': dict(dense=0.03, sparse=0.06, lone=0.002, thick=[('dead-bush', 2), ('cactus', 1)],
                    loose=[('dead-bush', 1)], under=[('dry-grass', 1)], tufts=['dry-grass'], flowers=0),
}
# How far apart two of a kind stand in thick grove, in world units: small numbers crowd them together.
SPACING = {'pine': 46, 'pines': 80, 'snowy-pine': 46, 'oak': 105, 'big-oak': 125, 'jungle-tree': 105, 'palm': 80,
           'cactus': 70, 'dead-bush': 60, 'tall-grass': 40, 'grass-tuft': 36, 'dry-grass': 36, 'snow-grass': 36}
LOOSE_SPACE = 2.0              # loose woodland is this many times as spread out as a grove
LOOSE_TAKE = 0.3               # the share of tries that take root in loose woodland
# Each kind's size, as a share of the size the game draws it. Every tree is then 88% to 112% of that.
SIZE = {'pine': 1.0, 'pines': 1.0, 'snowy-pine': 1.0, 'oak': 0.8, 'big-oak': 0.85, 'jungle-tree': 0.85,
        'palm': 0.95, 'cactus': 0.9, 'dead-bush': 0.85}
TUFT_SHARE = 0.18              # the share of open land where grass tufts grow in clumps
FLOWER_PATCHES = 0.0035        # flower patches per open square, before the region's own `flowers` share
GONE = {'feather', 'pine-cone'}
TREES = {'pines', 'pine', 'oak', 'big-oak', 'snowy-pine', 'jungle-tree', 'palm', 'cactus'}
GREENERY = TREES | {'dead-bush', 'berry-bush', 'grass-tuft', 'tall-grass', 'dry-grass', 'snow-grass', 'flowers'}
REPLACED = {'cave-forest', 'cave-snow', 'cave-canyon', 'bridge'}
SOLID = {'tent', 'house-a', 'house-b', 'house-c', 'workshop', 'ship', 'sandstone-ruin', 'cave-forest', 'cave-snow',
         'cave-canyon', 'log', 'signpost', 'campfire', 'rocks-a', 'rocks-b', 'boulder', 'beach-rock', 'ice-rock',
         'cliff-rock', 'iron-ore', 'copper-ore', 'meadow-stairs', 'canyon-stairs', 'snow-stairs'} | TREES
BUILT = {'tent', 'house-a', 'house-b', 'house-c', 'workshop', 'ship', 'sandstone-ruin', 'cave-forest', 'cave-snow',
         'cave-canyon', 'signpost', 'campfire'}   # things a tree must never cover
PICKUPS = {'pebbles', 'sticks', 'antler', 'mossy-stone', 'grey-rock', 'flat-stone', 'wild-berries', 'wild-herbs', 'driftwood'}

# ---- read the map ------------------------------------------------------------------------------------
# A dated copy of the map about to be replaced is kept first, in case it was edited by hand since the last run.
if os.path.exists(TARGET):
    backups = os.path.join(os.path.dirname(TARGET), 'backups'); os.makedirs(backups, exist_ok=True)
    shutil.copy2(TARGET, os.path.join(backups, os.path.basename(TARGET)[:-4] + time.strftime('.%Y-%m-%d-%H%M%S.before-arrange.tmj')))
shutil.copy2(SOURCE, TARGET)
subprocess.run([sys.executable, os.path.join(TOOLS, 'tidy-tiled-world.py'), TARGET, '--steps=layers,crossings',
                '--no-backup'], check=True)
fresh = os.path.join(tempfile.mkdtemp(), 'fresh.tmj')
subprocess.run([sys.executable, os.path.join(TOOLS, 'export-tiled-world.py'), fresh], check=True, stdout=subprocess.DEVNULL)

world = json.load(open(TARGET))
game = json.load(open(os.path.join(ROOT, 'map', 'wildhaven.json')))
places = json.load(open(os.path.join(ROOT, 'source', 'places.json')))
sheet = json.load(open(os.path.join(OUT, 'wildhaven-sheet.json')))['objects']
kit = json.load(open(os.path.join(OUT, 'terrain-redrawn.json')))['materials']
path_kit = json.load(open(os.path.join(OUT, 'path-connectors.json')))
layers = {l['name']: l for l in world['layers']}
props = {p['name']: p['value'] for p in game['properties']}
COLS, ROWS, TILE = world['width'], world['height'], world['tilewidth']
W, H = COLS * TILE, ROWS * TILE
first = {os.path.basename(t.get('source', t.get('name', ''))): t['firstgid'] for t in world['tilesets']}
FIRST_GROUND, FIRST_PATH, FIRST_OBJECT = first['terrain-redrawn.tsx'], first['path-connectors.tsx'], first['wildhaven-objects.tsx']
names = list(sheet)
height = props['elevation']    # one letter per square: 0-3 level, w wall, s stairs
cliffs = layers['cliffs']['data']
rng = random.Random(SEED)
report = {}

# Says what sprite an object shows: its Class if it has one, else worked out from its tile number.
def kind(obj):
    if obj.get('type'): return obj['type']
    n = (obj.get('gid', 0) & 0x1fffffff) - FIRST_OBJECT
    return names[n] if 0 <= n < len(names) else ''

# Says which region a spot is in, by the map's region grid (one digit per 256-unit square).
def region_at(x, y):
    cell = props['regionCell']
    x, y = min(max(x, 0), W - 1), min(max(y, 0), H - 1)
    return places['regions'][int(props['regionGrid'][int(y // cell) * props['regionCols'] + int(x // cell)])]['id']

# ---- the ground --------------------------------------------------------------------------------------
# Which ground shows on every tile corner: a ground tile's number says which of its four corners (top-left 1,
# top-right 2, bottom-left 4, bottom-right 8) hold that ground, and the topmost layer wins.
def layer_of(i): return layers[f'{i + 1:02d} {GROUNDS[i]}']
mask_of = {FIRST_GROUND + tile: (i, int(m)) for i, g in enumerate(GROUNDS) for m, tile in kit[g].items()}
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)
odd = np.zeros((ROWS, COLS), dtype=bool)       # squares holding a tile this script can't read: left alone
for i in range(len(GROUNDS)):
    for at, gid in enumerate(layer_of(i)['data']):
        if not gid: continue
        ty, tx = divmod(at, COLS)
        if mask_of.get(gid, (None,))[0] != i: odd[ty, tx] = True; continue
        for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
            if mask_of[gid][1] & bit: corner[ty + dy, tx + dx] = max(corner[ty + dy, tx + dx], i)

# Repaints the ground tiles of a block of squares from the corners, in every ground layer.
def repaint(y0, y1, x0, x1):
    for ty in range(max(0, y0), min(ROWS, y1 + 1)):
        for tx in range(max(0, x0), min(COLS, x1 + 1)):
            if odd[ty, tx]: continue
            for i, g in enumerate(GROUNDS):
                here = [corner[ty + dy, tx + dx] >= i for dy, dx in ((0, 0), (0, 1), (1, 0), (1, 1))]
                m = here[0] + 2 * here[1] + 4 * here[2] + 8 * here[3]
                layer_of(i)['data'][ty * COLS + tx] = FIRST_GROUND + kit[g][str(m)] if m else 0

# Says whether a square is dry, flat, low ground: no water corner, no hill, no cliff picture.
def open_square(tx, ty):
    if not (0 <= tx < COLS and 0 <= ty < ROWS): return False
    return (corner[ty:ty + 2, tx:tx + 2] > WATER).all() and height[ty * COLS + tx] == '0' and not cliffs[ty * COLS + tx]

# Says whether a spot is good ground for a tree or a bush: dry for a square round it, and on one level (low
# ground or a hilltop), away from every wall, stair and edge.
def plantable(x, y):
    tx, ty = int(x // TILE), int(y // TILE)
    if not (1 <= tx < COLS - 1 and 1 <= ty < ROWS - 1): return False
    if not (corner[ty - 1:ty + 3, tx - 1:tx + 3] > WATER).all(): return False
    level = height[ty * COLS + tx]
    return level.isdigit() and all(height[(ty + dy) * COLS + tx + dx] == level and not cliffs[(ty + dy) * COLS + tx + dx]
                                   for dy in (-1, 0, 1) for dx in (-1, 0, 1))

# ---- what is on the map now ----------------------------------------------------------------------------
# Objects placed or moved by hand: anything the fresh export does not have at the same spot and size.
made = {o['id']: o for l in json.load(open(fresh))['layers'] if l['type'] == 'objectgroup' for o in l['objects']}
# Says whether an object was placed or moved by hand: the fresh export has nothing of that kind at that spot and size.
def by_hand(o):
    m = made.get(o['id'])
    return (m is None or m.get('type') != kind(o) or abs(m['x'] - o['x']) > 1 or abs(m['y'] - o['y']) > 1
            or abs(m['width'] - o['width']) > 1)

# A landmark's own picture (the Great Oak, Grandfather Pine...) stands 60 units north of its point: it stays.
landmark_art = [(p['object'], p['x'], p['y'] - 60) for p in places['landmarks'] if p.get('object')]
# Says whether an object is a landmark's own picture.
def is_landmark_art(o, k):
    return any(k == a and math.hypot(o['x'] - x, o['y'] - y) < 200 for a, x, y in landmark_art)

replaced = [(k, x, y) for layout in LAYOUTS.values() for k, x, y in layout['replaces']]
hand, removed = 0, {}
for name in ('flat', 'objects'):
    keep = []
    for o in layers[name]['objects']:
        k = kind(o); o['type'] = k
        mine = by_hand(o)
        if k in GONE or (not mine and not is_landmark_art(o, k) and k in GREENERY | REPLACED) or any(
                k == rk and math.hypot(o['x'] - rx, o['y'] - ry) < 40 for rk, rx, ry in replaced):
            removed[k] = removed.get(k, 0) + 1; continue
        hand += mine; keep.append(o)
    layers[name]['objects'] = keep
report['kept as placed by hand'] = hand
report['taken away'] = removed
next_id = [world['nextobjectid']]

# Spots that must stay clear: every place, and the signposts' sprites 50 units north of their points.
spots = [tuple(v) for v in places['spawns'].values()] + [tuple(v) for v in places['supplies'].values()]
spots += [(p['x'], p['y']) for p in places['landmarks'] + places['waypoints'] + places['wrecks']]
spots += [tuple(p['launch']) for p in places['wrecks']] + [(p['x'], p['y'] - 50) for p in places['waypoints']]

# Solid boxes (left, top, right, bottom) of things in the way, kept in 256-unit buckets so a check only looks
# at its neighbours. A box is the lower, solid part of a picture: the trunk of a tree, the walls of a house.
boxes, built_boxes, built_whole = {}, {}, {}
# The whole picture of an object, as a box (left, top, right, bottom).
def whole_of(o): return (o['x'] - o['width'] * 0.5, o['y'] - o['height'], o['x'] + o['width'] * 0.5, o['y'] + 10)
# The solid lower part of an object's picture, as a box.
def box_of(o): return (o['x'] - o['width'] * 0.32, o['y'] - min(o['height'] * 0.45, 120), o['x'] + o['width'] * 0.32, o['y'] + 6)
# Files a box in every 256-unit bucket it touches.
def add_box(b, store):
    for bx in range(int(b[0] // 256), int(b[2] // 256) + 1):
        for by in range(int(b[1] // 256), int(b[3] // 256) + 1): store.setdefault((bx, by), []).append(b)
# Says whether a box, grown by `pad` on every side, overlaps any box in a store.
def hits(b, store, pad=0):
    for bx in range(int((b[0] - pad) // 256), int((b[2] + pad) // 256) + 1):
        for by in range(int((b[1] - pad) // 256), int((b[3] + pad) // 256) + 1):
            for c in store.get((bx, by), []):
                if b[0] - pad < c[2] and c[0] < b[2] + pad and b[1] - pad < c[3] and c[1] < b[3] + pad: return True
    return False
for o in layers['flat']['objects'] + layers['objects']['objects']:
    if o['type'] in SOLID: add_box(box_of(o), boxes)
    if o['type'] in BUILT: add_box(box_of(o), built_boxes); add_box(whole_of(o), built_whole)

# Makes a picture object of a sprite whose ground point (its foot) is at (x, y), drawn at `scale`.
def new_object(sprite, x, y, scale=1.0, rotation=0, properties=None):
    s = sheet[sprite]; w, h = s['width'] * scale, s['height'] * scale; ox, oy = s['origin']
    o = {'id': next_id[0], 'name': '', 'type': sprite, 'gid': FIRST_OBJECT + names.index(sprite),
         'x': round(x + (0.5 - ox) * w, 2), 'y': round(y + (1 - oy) * h, 2), 'width': round(w, 2),
         'height': round(h, 2), 'rotation': rotation, 'visible': True}
    if properties: o['properties'] = [{'name': k, 'type': 'string', 'value': v} for k, v in properties.items()]
    next_id[0] += 1
    return o

# Puts an object on the map: flat things on the flat layer, the rest on the objects layer.
def put(o):
    (layers['flat'] if o['type'] in ('bridge', 'campfire') else layers['objects'])['objects'].append(o)
    if o['type'] in SOLID: add_box(box_of(o), boxes)
    if o['type'] in BUILT: add_box(box_of(o), built_boxes); add_box(whole_of(o), built_whole)

# ---- villages ----------------------------------------------------------------------------------------
plaza = set()                  # squares of village plazas
# Makes a plaza's edge wobble: how far out the edge is in a direction, as a share of its radius.
def ring_noise(angle, seed): return 1 + 0.16 * math.sin(3 * angle + seed) + 0.08 * math.sin(7 * angle + 2 * seed)

# Lists the squares of a square ring round (cx, cy), `half` squares out, going round clockwise from its top left.
def ring_squares(cx, cy, half):
    top = [(x, cy - half) for x in range(cx - half, cx + half)]
    right = [(cx + half, y) for y in range(cy - half, cy + half)]
    bottom = [(x, cy + half) for x in range(cx + half, cx - half, -1)]
    left = [(cx - half, y) for y in range(cy + half, cy - half, -1)]
    return top + right + bottom + left

# Says whether a building may stand with its foot at (x, y): on dry low ground, clear of the plaza's middle,
# of places, of anything solid, and with no loop path under its picture.
def room_for(sprite, x, y, middle, loop=()):
    s = sheet[sprite]; w, h = s['width'], s['height']
    b = (x - w * 0.42, y - min(h * 0.55, 150), x + w * 0.42, y + 8)
    if any(not open_square(tx, ty) for tx in range(int(b[0] // TILE), int(b[2] // TILE) + 1)
           for ty in range(int(b[1] // TILE), int(b[3] // TILE) + 1)): return False
    if math.hypot(x - middle[0], y - middle[1]) < 150: return False
    if any(math.hypot(x - px, y - py) < 150 + w * 0.3 for px, py in spots): return False
    whole = (x - w * 0.5, y - h, x + w * 0.5, y + 10)
    if any(whole[0] - 40 < (tx + 0.5) * TILE < whole[2] + 40 and whole[1] - 40 < (ty + 0.5) * TILE < whole[3] + 50 for tx, ty in loop):
        return False
    return not hits(b, boxes, 24) and not hits(whole, built_whole, 16)

# Makes a picture object whose bottom middle is at (x, y), `width` wide, as a layout gives it.
def laid_object(sprite, x, y, width):
    s = sheet[sprite]
    o = {'id': next_id[0], 'name': '', 'type': sprite, 'gid': FIRST_OBJECT + names.index(sprite), 'x': x, 'y': y,
         'width': width, 'height': round(s['height'] * width / s['width'], 2), 'rotation': 0, 'visible': True}
    next_id[0] += 1
    return o

villages, rects = [], {}
rng.seed(SEED + 1)   # each stage rolls its own dice, so a change in one stage never reshuffles a later one
for vi, (name, vx, vy, size) in enumerate(VILLAGES):
    region = region_at(vx, vy)
    r = PLAZA[size]; cx, cy = round(vx / TILE), round(vy / TILE)
    # The plaza: every dry, low corner within a wobbly circle becomes dirt.
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            d, a = math.hypot(x - cx, y - cy), math.atan2(y - cy, x - cx)
            if d <= r * ring_noise(a, vi) and 0 < y < ROWS and 0 < x < COLS and corner[y, x] > WATER and all(
                    height[(y + dy) * COLS + x + dx] == '0' for dy in (-1, 0) for dx in (-1, 0)):
                corner[y, x] = DIRT
    repaint(cy - r - 3, cy + r + 3, cx - r - 3, cx + r + 3)
    for ty in range(cy - r - 2, cy + r + 2):
        for tx in range(cx - r - 2, cx + r + 2):
            if (corner[ty:ty + 2, tx:tx + 2] == DIRT).all(): plaza.add((tx, ty))

    # A village laid out by hand gets its own houses and loop.
    half = LOOP[size]
    if name in LAYOUTS:
        for sprite, x, y, width in LAYOUTS[name]['objects']: put(laid_object(sprite, x, y, width))
        (x0, y0), (x1, y1) = LAYOUTS[name]['loop']; rects[name] = (x0, y0, x1, y1)
        villages.append((name, vx, vy, region, size, cx, cy, half))
        continue
    # Houses stand round the outside of the loop, as close to it as they fit, none with the path under it.
    loop = ring_squares(cx, cy, half); rects[name] = (cx - half, cy - half, cx + half, cy + half)
    look = 'big' if size == 'big' else 'snow' if region == 'frostpeak' else 'dry' if region in ('desert', 'canyons') else 'green'
    for sprite, count in HOMES[look]:
        for _ in range(count):
            start = rng.random() * 2 * math.pi
            for step in range(96):
                a = start + step * 2.4             # the golden angle: tries spread evenly round the ring
                d = (half + 1.5 + (step // 24) * 1.2) * TILE
                x, y = vx + d * math.cos(a), vy + d * math.sin(a)
                if math.sin(a) > 0.3: y += sheet[sprite]['height'] * 0.8   # south of the loop the roof must clear it
                if room_for(sprite, x, y, (vx, vy), loop):
                    put(new_object(sprite, x, y)); break
    villages.append((name, vx, vy, region, size, cx, cy, half))
report['villages'] = f'{len(VILLAGES)} (1 big), plazas of {len(plaza)} squares'

# ---- paths ---------------------------------------------------------------------------------------------
# Squares a path may not use: anything solid in the way, except inside a plaza.
in_way = np.zeros((ROWS, COLS), dtype=bool)
for bucket in boxes.values():
    for b in bucket:
        for tx in range(int(b[0] // TILE), int(b[2] // TILE) + 1):
            for ty in range(int(b[1] // TILE), int(b[3] // TILE) + 1):
                if 0 <= tx < COLS and 0 <= ty < ROWS: in_way[ty, tx] = True
crossing = np.zeros((ROWS, COLS), dtype=bool)
for x, y in CROSSINGS:
    cx, cy = round(x / TILE), round(y / TILE)
    crossing[cy - CROSS_REACH:cy + CROSS_REACH + 1, cx - CROSS_REACH:cx + CROSS_REACH + 1] = True
wet_square = ~(np.stack([corner[:-1, :-1], corner[:-1, 1:], corner[1:, :-1], corner[1:, 1:]]) > WATER).all(axis=0)
low = np.array([c == '0' for c in height]).reshape(ROWS, COLS) & (np.array(cliffs).reshape(ROWS, COLS) == 0)
cost = np.where(wet_square, np.where(crossing, 3.0, np.inf), 1.0)
cost[~low & ~wet_square] = np.inf
cost[in_way] = np.inf
near_water = np.zeros_like(wet_square)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1): near_water |= np.roll(np.roll(wet_square, dy, 0), dx, 1)
cost[near_water & ~wet_square & np.isfinite(cost)] += 1.5   # keep paths off the banks
for tx, ty in plaza: cost[ty, tx] = 1.0
on_path = np.zeros((ROWS, COLS), dtype=bool)
STEP = ((0, -1, NORTH), (1, 0, EAST), (0, 1, SOUTH), (-1, 0, WEST))

# Finds the cheapest way from one square to another, where every turn costs TURN squares and squares already on
# a path cost less. It searches squares together with the way the path is heading (A*, the usual map search).
# Returns the list of squares, or None.
def route(a, b):
    margin = 40
    x0, x1 = max(0, min(a[0], b[0]) - margin), min(COLS - 1, max(a[0], b[0]) + margin)
    y0, y1 = max(0, min(a[1], b[1]) - margin), min(ROWS - 1, max(a[1], b[1]) + margin)
    best, came = {(a, 4): 0.0}, {}
    todo = [(0.0, 0.0, a, 4)]
    while todo:
        _, g, sq, d = heapq.heappop(todo)
        if sq == b:
            out = [sq]
            while (sq, d) in came: sq, d = came[(sq, d)]; out.append(sq)
            return out[::-1]
        if g > best.get((sq, d), math.inf): continue
        for nd, (dx, dy, _) in enumerate(STEP):
            nx, ny = sq[0] + dx, sq[1] + dy
            if not (x0 <= nx <= x1 and y0 <= ny <= y1): continue
            c = cost[ny, nx]
            if not math.isfinite(c): continue
            ng = g + (SHARED if on_path[ny, nx] and not wet_square[ny, nx] else c) + (TURN if d not in (4, nd) else 0)
            key = ((nx, ny), nd)
            if ng < best.get(key, math.inf):
                best[key] = ng; came[key] = (sq, d)
                heapq.heappush(todo, (ng + 0.8 * (abs(nx - b[0]) + abs(ny - b[1])), ng, (nx, ny), nd))
    return None

# Moves a spot to the nearest square a path may stand on.
def nearest_open(x, y):
    tx, ty = int(x // TILE), int(y // TILE)
    for r in range(0, 8):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) == r and 0 <= ty + dy < ROWS and 0 <= tx + dx < COLS and math.isfinite(cost[ty + dy, tx + dx]) and not wet_square[ty + dy, tx + dx]:
                    return (tx + dx, ty + dy)
    return None

joins, kind_at, failed = {}, {}, 0
# Joins two next-door path squares, so each gets an opening facing the other.
def join(u, v):
    side = EAST if v[0] > u[0] else WEST if v[0] < u[0] else SOUTH if v[1] > u[1] else NORTH
    back = {EAST: WEST, WEST: EAST, SOUTH: NORTH, NORTH: SOUTH}[side]
    joins[u] = joins.get(u, 0) | side; joins[v] = joins.get(v, 0) | back

# Puts a laid-out way of squares on the map as path.
def lay(way):
    for sq in way:
        on_path[sq[1], sq[0]] = True
        kind_at.setdefault(sq, 'cobblestone' if region_at(sq[0] * TILE + 32, sq[1] * TILE + 32) in STONE_PATHS else 'dirt')
    for u, v in zip(way, way[1:]): join(u, v)

# Lists the squares of a straight line from one square to another (they share a row or a column).
def line(a, b):
    dx, dy = (b[0] > a[0]) - (b[0] < a[0]), (b[1] > a[1]) - (b[1] < a[1])
    return [(a[0] + dx * k, a[1] + dy * k) for k in range(max(abs(b[0] - a[0]), abs(b[1] - a[1])) + 1)]

# Each village's loop: the four sides of its square ring, each laid straight, or round whatever is in the way.
loops = []
for name, vx, vy, region, size, cx, cy, half in villages:
    x0, y0, x1, y1 = rects[name]
    corners = [nearest_open(x * TILE + 32, y * TILE + 32) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    if None in corners: loops.append([]); continue
    ring = []
    for a, b in zip(corners, corners[1:] + corners[:1]):
        straight = (a[0] == b[0] or a[1] == b[1]) and all(math.isfinite(cost[y, x]) and not wet_square[y, x] for x, y in line(a, b))
        way = line(a, b) if straight else route(a, b)
        if way: lay(way); ring += way
        else: failed += 1
    for a, b in LAYOUTS.get(name, {}).get('paths', []):
        lay(line(a, b)); ring += line(a, b)
    loops.append(ring)

# The places the paths join: villages (anywhere on their loop), signposts, and buildings put down by hand (their
# doorstep). A stop is a list of squares; a link uses the one nearest the other end.
stops = [(vx, vy) for _, vx, vy, *_ in villages] + [(p['x'], p['y'] + 40) for p in places['waypoints']]
for o in layers['objects']['objects']:
    if o['type'] in ('house-a', 'house-b', 'house-c', 'workshop', 'tent') and by_hand(o) and not any(
            math.hypot(o['x'] - vx, o['y'] - vy) < 900 for _, vx, vy, *_ in villages):
        stops.append((o['x'], o['y'] + 70))
ends = [(loops[i] if i < len(villages) and loops[i] else [nearest_open(x, y)]) for i, (x, y) in enumerate(stops)]
keep = [i for i, e in enumerate(ends) if e[0]]
stops = [stops[i] for i in keep]; ends = [ends[i] for i in keep]

# Picks the square of one stop nearest to another stop.
def end_for(i, j):
    tx, ty = stops[j][0] / TILE, stops[j][1] / TILE
    return min(ends[i], key=lambda sq: abs(sq[0] - tx) + abs(sq[1] - ty))

# The links: first the shortest set that joins every stop (a minimum spanning tree), then extra links wherever
# going round by the paths would be much longer than going straight: those make the loops and crossroads.
n = len(stops)
dist = [[math.hypot(stops[i][0] - stops[j][0], stops[i][1] - stops[j][1]) for j in range(n)] for i in range(n)]
links, joined = [], {0}
while len(joined) < n:
    i, j = min(((i, j) for i in joined for j in range(n) if j not in joined), key=lambda p: dist[p[0]][p[1]])
    links.append((i, j)); joined.add(j)
graph = [[math.inf] * n for _ in range(n)]
for i in range(n): graph[i][i] = 0
for i, j in links: graph[i][j] = graph[j][i] = dist[i][j]
for k in range(n):
    for i in range(n):
        for j in range(n): graph[i][j] = min(graph[i][j], graph[i][k] + graph[k][j])
for d, i, j in sorted((dist[i][j], i, j) for i in range(n) for j in range(i + 1, n)):
    if d < LINK_MAX and graph[i][j] > SHORTCUT * d:
        links.append((i, j))
        for p in range(n):
            for q in range(n): graph[p][q] = min(graph[p][q], graph[p][i] + d + graph[j][q], graph[p][j] + d + graph[i][q])

for i, j in sorted(links, key=lambda l: dist[l[0]][l[1]]):
    way = route(end_for(i, j), end_for(j, i))
    if not way: failed += 1; continue
    lay(way)

# Bridges: a run of path squares over water gets a bridge, turned to run along the path.
bridges, seen = 0, set()
for sq in list(kind_at):
    if sq in seen or not wet_square[sq[1], sq[0]]: continue
    run, todo = [], [sq]
    while todo:
        s = todo.pop()
        if s in seen or s not in kind_at or not wet_square[s[1], s[0]]: continue
        seen.add(s); run.append(s)
        todo += [(s[0] + dx, s[1] + dy) for dx, dy, side in STEP if joins.get(s, 0) & side]
    xs, ys = [s[0] for s in run], [s[1] for s in run]
    across = max(xs) - min(xs) >= max(ys) - min(ys)   # the path crosses east-west, so the deck runs east-west
    mx, my = (min(xs) + max(xs) + 1) / 2 * TILE, (min(ys) + max(ys) + 1) / 2 * TILE
    span = (max(xs) - min(xs) if across else max(ys) - min(ys)) + 3.2
    s = sheet['bridge']; length = max(s['width'], span * TILE); deep = s['height'] * length / s['width'] * 0.8
    if across:
        o = {'x': mx, 'y': my + deep / 2, 'width': length, 'height': deep, 'rotation': 0}
    else:   # turned a quarter clockwise round its bottom middle, the picture lies to the east of that point
        o = {'x': mx - deep / 2, 'y': my, 'width': length, 'height': deep, 'rotation': 90}
    put(dict(o, id=next_id[0], name='', type='bridge', gid=FIRST_OBJECT + names.index('bridge'), visible=True))
    next_id[0] += 1; bridges += 1

data = [0] * (COLS * ROWS)
for (x, y), k in kind_at.items():
    if wet_square[y, x]: continue
    data[y * COLS + x] = FIRST_PATH + path_kit[k][str(joins.get((x, y), 0))]
layers['paths']['data'] = data
report['paths'] = f'{sum(1 for l in loops if l)} village loops, {len(links)} links between {n} stops ({failed} could not be laid), {sum(1 for v in data if v)} squares, {bridges} bridges'

# The squares on or right beside a path: nothing grows on them, and no tree stands just south of one (its crown
# would hide the path).
path_near = set()
for (x, y) in kind_at:
    for dy in range(-1, 4):
        for dx in (-1, 0, 1): path_near.add((x + dx, y + dy))

# ---- caves ---------------------------------------------------------------------------------------------
# Says whether no path square lies within r squares of a square.
def far_from_paths(tx, ty, r): return not any((tx + dx, ty + dy) in kind_at for dy in range(-r, r + 1) for dx in range(-r, r + 1))
# Says whether no place lies within r units of a spot.
def far_from_spots(x, y, r): return all(math.hypot(x - px, y - py) >= r for px, py in spots)

# A forest value from 0 to 1 for every 32-unit cell: two layers of smooth noise, one with big blobs (the groves)
# and one with small ones (their ragged edges). Smooth noise is random numbers on a coarse grid, blended between.
def smooth_noise(cell, seed):
    g = np.random.default_rng(seed).random((int(H / cell) + 3, int(W / cell) + 3))
    ys, xs = np.arange(H // 32) * 32 / cell, np.arange(W // 32) * 32 / cell
    iy, ix = ys.astype(int), xs.astype(int)
    fy, fx = (ys - iy)[:, None], (xs - ix)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b, c, d = g[iy][:, ix], g[iy][:, ix + 1], g[iy + 1][:, ix], g[iy + 1][:, ix + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
forest = 0.65 * smooth_noise(900, SEED) + 0.35 * smooth_noise(280, SEED + 1)
tufty = smooth_noise(420, SEED + 2)
# Reads the forest value at a spot.
def forest_at(x, y): return forest[min(int(y // 32), forest.shape[0] - 1), min(int(x // 32), forest.shape[1] - 1)]

caves, wanted = [], dict(CAVES)
# Hill caves: at the foot of a south wall at least three squares wide, with no stairs close by. In a forest
# region the spot under the thickest forest is taken first, so the cave is hidden among the trees.
spots_for = {}
for ty in range(1, ROWS - 2):
    for tx in range(3, COLS - 3):
        if not all(height[ty * COLS + x] == 'w' and height[(ty + 1) * COLS + x] == '0' for x in (tx - 1, tx, tx + 1)): continue
        if any(height[y * COLS + x] == 's' for y in (ty - 1, ty, ty + 1) for x in range(tx - 3, tx + 4)): continue
        x, y = tx * TILE + TILE // 2, (ty + 1) * TILE + 24
        spots_for.setdefault(region_at(x, y), []).append((forest_at(x, y), x, y))
# Islets: small pieces of land apart from the mainland, found by flooding the dry corners from each one.
land = corner > WATER
label = np.zeros(land.shape, dtype=int); pieces = []
for y0, x0 in np.argwhere(land):
    if label[y0, x0]: continue
    label[y0, x0] = len(pieces) + 1; todo, cells = [(y0, x0)], []
    while todo:
        y, x = todo.pop(); cells.append((y, x))
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny <= ROWS and 0 <= nx <= COLS and land[ny, nx] and not label[ny, nx]:
                label[ny, nx] = len(pieces) + 1; todo.append((ny, nx))
    pieces.append(cells)
for cells in pieces:
    if 40 < len(cells) < 3000:
        my, mx = np.mean(cells, axis=0)
        for cy, cx in cells:   # every corner of the islet is a try; the ones nearest its middle come first
            spots_for.setdefault('islets', []).append((-math.hypot(cx - mx, cy - my), cx * TILE, cy * TILE))
# Jungle caves stand free in the thickest jungle: the jungle has no hills.
for ty in range(0, ROWS, 3):
    for tx in range(0, COLS, 3):
        x, y = tx * TILE + 32, ty * TILE + 32
        if region_at(x, y) == 'jungle' and plantable(x, y): spots_for.setdefault('jungle', []).append((forest_at(x, y), x, y))

for region, (count, holds, mineral) in CAVES.items():
    sprite = CAVE_SPRITE.get(region, 'cave-forest')
    for _, x, y in sorted(spots_for.get(region, []), reverse=True):
        if count == 0: break
        tx, ty = int(x // TILE), int(y // TILE)
        far = 2 if region == 'islets' else 4
        if not far_from_paths(tx, ty, far) or not far_from_spots(x, y, 160 if region == 'islets' else 380 if region in FOREST_CAVES else 300): continue
        if any(math.hypot(x - c[1], y - c[2]) < (900 if region == 'islets' else CAVE_APART) for c in caves): continue
        s = sheet[sprite]; b = (x - s['width'] * 0.4, y - s['height'] * 0.5, x + s['width'] * 0.4, y + 5)
        if hits(b, boxes, 10) or any((corner[int(b[1] // TILE):int(b[3] // TILE) + 2, int(b[0] // TILE):int(b[2] // TILE) + 2] <= WATER).flatten()):
            continue
        put(new_object(sprite, x, y, properties={'holds': holds, **({'mineral': mineral} if mineral else {})}))
        caves.append((region, x, y)); count -= 1
report['caves'] = {r: sum(1 for c in caves if c[0] == r) for r in CAVES}

# ---- forests -------------------------------------------------------------------------------------------
# Each region's forest values, sorted, give the levels above which its land is thick grove or loose woodland.
region_cells = {}
for y in range(0, H, 128):
    for x in range(0, W, 128):
        if plantable(x, y): region_cells.setdefault(region_at(x, y), []).append(forest_at(x, y))
levels = {r: (np.quantile(v, 1 - FOREST[r]['dense']), np.quantile(v, 1 - FOREST[r]['dense'] - FOREST[r]['sparse']))
          for r, v in region_cells.items() if r in FOREST}

# Says how thick the forest is at a spot: 'thick', 'loose' or 'open'. Round a forest cave it is always thick.
def zone(x, y, region):
    if any(r in FOREST_CAVES and math.hypot(x - cx, y - cy) < GROVE_ROUND_CAVE for r, cx, cy in caves): return 'thick'
    f = forest_at(x, y); dense, sparse = levels[region]
    return 'thick' if f >= dense else 'loose' if f >= sparse else 'open'

# Picks a sprite from a list of (sprite, weight).
def pick(choices):
    t = rng.random() * sum(w for _, w in choices)
    for sprite, w in choices:
        t -= w
        if t <= 0: return sprite
    return choices[-1][0]

# Each village keeps a clearing: inside a fenced village's fence, or a few squares round a small one's loop.
laid_clearings = [(vx, vy, FENCE.get(size, LOOP[size]) * TILE) for name, vx, vy, _, size, *_ in villages if name in LAYOUTS]
clearings = [(vx, vy, (FENCE[size] - 0.7 if size in FENCE else half + CLEARING) * TILE) for _, vx, vy, _, size, _, _, half in villages]

# Says whether nothing stops a plant with its foot at (x, y): good ground, clear of paths, places, plazas, cave
# mouths, solid things, and of anything built that its crown would cover.
def clear_for(sprite, x, y, scale, tall):
    tx, ty = int(x // TILE), int(y // TILE)
    if not plantable(x, y) or (tx, ty) in plaza or any((tx + dx, ty + dy) in plaza for dx in (-1, 0, 1) for dy in (-1, 0, 1)): return False
    if tall and (tx, ty) in path_near: return False
    if not tall and (tx, ty) in kind_at: return False
    if not tall and any(math.hypot(x - cx, y - cy) < r for cx, cy, r in laid_clearings): return False
    if not far_from_spots(x, y, 170 if tall else 90): return False
    if tall and any(math.hypot(x - cx, y - cy) < r for cx, cy, r in clearings): return False
    if any(abs(x - cx) < 170 and cy - 60 < y < cy + 230 for _, cx, cy in caves): return False   # the way into a cave
    s = sheet[sprite]; w, h = s['width'] * scale, s['height'] * scale
    if hits((x - w * 0.2, y - 30, x + w * 0.2, y + 4), boxes, 6): return False
    return not tall or not hits((x - w * 0.42, y - h * 0.95, x + w * 0.42, y - 10), built_boxes)

# Grows the plants of one layer, like scattering seeds: a few tries in every square, in random order, and a try
# takes root only where nothing of its own kind already stands too close. `chooser` says, for a spot, which
# sprite grows there and how far apart (or None for nothing).
def grow(tries, chooser, tall):
    planted, buckets = [], {}
    spots_ = [(rng.random() * W, rng.random() * H) for _ in range(tries)]
    for x, y in spots_:
        if not (0 < x < W and 0 < y < H): continue
        choice = chooser(x, y)
        if not choice: continue
        sprite, space = choice
        bx, by = int(x // 128), int(y // 128)
        if any(math.hypot(x - px, (y - py) * 1.3) < (space + ps) / 2 for dy in (-1, 0, 1) for dx in (-1, 0, 1)
               for px, py, ps in buckets.get((bx + dx, by + dy), [])): continue
        scale = SIZE.get(sprite, 1.0) * (0.88 + 0.24 * rng.random())
        if not clear_for(sprite, x, y, scale, tall): continue
        buckets.setdefault((bx, by), []).append((x, y, space)); planted.append((sprite, x, y, scale))
    return planted

# Which tree grows at a spot, by region, ground and how thick the forest is there.
def tree_choice(x, y):
    region = region_at(x, y)
    if region not in FOREST: return None
    f, z = FOREST[region], zone(x, y, region)
    if z == 'open' and rng.random() > f['lone']: return None
    ground = corner[int(y // TILE), int(x // TILE)]
    if ground == SAND and region not in ('desert',):
        if region == 'frostpeak': return None
        sprite = 'palm'
    elif ground == SNOW and region != 'frostpeak': sprite = 'snowy-pine'
    else: sprite = pick(f['thick' if z == 'thick' else 'loose'])
    if z == 'loose' and rng.random() > LOOSE_TAKE: return None
    return sprite, SPACING[sprite] * (1 if z == 'thick' else LOOSE_SPACE if z == 'loose' else 4)

# The fence: trees close together round a big village, on a rounded square (a squircle), with a gap wherever a
# path goes through, round places, and where a house stands.
rng.seed(SEED + 2)
fence = 0
for _, vx, vy, region, size, _, _, half in villages:
    if size not in FENCE: continue
    radius, a = FENCE[size] * TILE, 0.0
    while a < 2 * math.pi:
        c, s_ = math.cos(a), math.sin(a)
        r = radius / (c ** 4 + s_ ** 4) ** 0.25
        x, y = vx + r * c + rng.uniform(-8, 8), vy + r * s_ + rng.uniform(-8, 8)
        a += FENCE_STEP / r
        sprite = pick(FENCE_TREES); scale = SIZE.get(sprite, 1) * (0.92 + 0.14 * rng.random())
        tx, ty = int(x // TILE), int(y // TILE)
        if any((tx + dx, ty + dy) in kind_at for dx in (-1, 0, 1) for dy in (-1, 0, 1, 2)): continue
        if not plantable(x, y) or not far_from_spots(x, y, 100): continue
        w, h = sheet[sprite]['width'] * scale, sheet[sprite]['height'] * scale
        if hits((x - w * 0.2, y - 30, x + w * 0.2, y + 4), boxes, 4) or hits((x - w * 0.42, y - h * 0.95, x + w * 0.42, y - 10), built_boxes): continue
        put(new_object(sprite, x, y, scale)); fence += 1
report['fence trees'] = fence

rng.seed(SEED + 3)
trees = grow(COLS * ROWS * 3, tree_choice, True)
for sprite, x, y, scale in trees: put(new_object(sprite, x, y, scale))
counted = {}
for t in trees: counted[t[0]] = counted.get(t[0], 0) + 1
report['trees'] = counted

# Bushes and tall grass under the groves, and grass tufts in clumps in the open.
def under_choice(x, y):
    region = region_at(x, y)
    if region not in FOREST: return None
    f, z = FOREST[region], zone(x, y, region)
    if z != 'open' and rng.random() < 0.3:
        sprite = pick(f['under'])
        return sprite, SPACING.get(sprite, 40) * 1.6
    if tufty[min(int(y // 32), tufty.shape[0] - 1), min(int(x // 32), tufty.shape[1] - 1)] > 1 - TUFT_SHARE * 1.6 and rng.random() < 0.6:
        sprite = rng.choice(f['tufts'])
        ground = corner[int(y // TILE), int(x // TILE)]
        if ground == SNOW: sprite = 'snow-grass'
        elif ground == SAND and region != 'frostpeak': sprite = 'dry-grass'
        return sprite, SPACING.get(sprite, 36)
    return None
under = grow(COLS * ROWS * 2, under_choice, False)
for sprite, x, y, scale in under: put(new_object(sprite, x, y, 1.0 if 'grass' in sprite else scale))
report['bushes and tufts'] = len(under)

# Flower patches: a handful of flowers close together in the open, where the region has flowers.
patches = 0
for _ in range(int(COLS * ROWS * FLOWER_PATCHES)):
    x, y = rng.random() * W, rng.random() * H
    region = region_at(x, y)
    if region not in FOREST or rng.random() > FOREST[region]['flowers'] or zone(x, y, region) == 'thick': continue
    if not clear_for('flowers', x, y, 1, False): continue
    patches += 1
    for _ in range(rng.randint(3, 6)):
        fx, fy = x + rng.gauss(0, 45), y + rng.gauss(0, 30)
        if clear_for('flowers', fx, fy, 1, False): put(new_object('flowers', fx, fy, 0.4 * (0.85 + 0.3 * rng.random())))
report['flower patches'] = patches

# Small things picked up by hand that now lie under a new tree's crown, on a path or in a plaza go.
tree_boxes = {}
for sprite, x, y, scale in trees:
    s = sheet[sprite]; add_box((x - s['width'] * scale * 0.3, y - s['height'] * scale * 0.6, x + s['width'] * scale * 0.3, y + 4), tree_boxes)
hidden = 0
for name in ('flat', 'objects'):
    keep = []
    for o in layers[name]['objects']:
        if o['type'] in PICKUPS and not by_hand(o):
            sq = (int(o['x'] // TILE), int((o['y'] - 8) // TILE))
            if sq in kind_at or sq in plaza or hits((o['x'] - 4, o['y'] - 10, o['x'] + 4, o['y']), tree_boxes):
                hidden += 1; continue
        keep.append(o)
    layers[name]['objects'] = keep
report['pickups under trees or on paths taken away'] = hidden

# ---- save ----------------------------------------------------------------------------------------------
layers['banks']['visible'] = True
layers['cliffs']['visible'] = True
world['nextobjectid'] = next_id[0]
json.dump(world, open(TARGET, 'w'), separators=(',', ':'))
for what, said in report.items(): print(f'{what}: {said}')
print('saved', os.path.relpath(TARGET))
