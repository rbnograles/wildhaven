"""Builds the Wildhaven sprite map from assets/world/source/.

Inputs : source/{grass,dirt,jungle,rock,snow,sand,water}.png  seamless ground textures
         source/objects/<name>.png + source/objects.json       one sprite per world object
         source/places.json                                    regions, spawns, supplies, landmarks, waypoints
Outputs: map/tileset.png    terrain tiles incl. generated soft transitions (64px, 1px extruded)
         map/wildhaven.json Tiled-format map: seven tile layers + "objects" layer + a region grid property
         map/overview.webp  small render of the whole map for the minimap and world map
The game reads collision from the JSON (water tiles + object footprints) and regions from its region grid.
Run: python tools/build-map.py [preview.png]
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world')
SRC, OUT = os.path.join(ROOT, 'source'), os.path.join(ROOT, 'map'); os.makedirs(OUT, exist_ok=True)
PLACES = json.load(open(os.path.join(SRC, 'places.json'), encoding='utf-8'))
TILE, COLS, ROWS, TEX = 64, 384, 256, 256
W, H = COLS * TILE, ROWS * TILE

# Terrains in paint order. A higher terrain is painted over a lower one, so the number is also its layer rank.
GRASS, DIRT, JUNGLE, ROCK, SNOW, SAND, WATER = range(7)
OVERLAYS = ['dirt', 'jungle', 'rock', 'snow', 'sand', 'water']   # rank 1..6; grass (rank 0) is the full ground layer

# ---- regions -----------------------------------------------------------------------------
# The world is an 8x8 grid of blocks, one letter per block. The letters are the `key` of each region in places.json.
LAYOUT = ['DDDPPSSS', 'DDDPPSSS', 'DDhhhhSS', 'CChhhhLL', 'CChhhhLL', 'CCJJJJLL', 'CJJJJJJL', 'CJJJJJJL']
BLOCK_W, BLOCK_H = W // 8, H // 8
BASE = {'D': SAND, 'P': GRASS, 'S': SNOW, 'h': GRASS, 'L': GRASS, 'C': ROCK, 'J': JUNGLE}
REGION_INDEX = {r['key']: i for i, r in enumerate(PLACES['regions'])}

# Says which region a point is in. The point is nudged by a few sine waves before the block grid is read, so the
# borders wobble like real coastlines instead of running in straight lines. The nudge is never more than 440 units.
def region_key(x, y):
    wx = x + 300 * math.sin(y / 830 + 1.7) + 140 * math.sin(y / 290 + 0.4)
    wy = y + 300 * math.sin(x / 910 + 0.6) + 140 * math.sin(x / 310 + 2.1)
    return LAYOUT[min(7, max(0, int(wy // BLOCK_H)))][min(7, max(0, int(wx // BLOCK_W)))]

# ---- water and special ground ------------------------------------------------------------
# Distance from a point to a path made of straight pieces (used for rivers and the dry riverbed).
def line_dist(pts, x, y):
    best = 1e9
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(x - ax - t * dx, y - ay - t * dy))
    return best

# Where the sea starts on one row of the lagoon: everything in the lagoon to the right of this x is sea.
def coast(y): return 22000 + 450 * math.sin(y / 1700) + 150 * math.sin(y / 430)

RIVERS = [[(17000, 2500), (16200, 4800), (14800, 6400), (14600, 8600), (16200, 9900), (18800, 10300), (22600, 10500)],   # Frostpeak to the lagoon
          [(-200, 8200), (2200, 8600), (3600, 10200), (2600, 12200), (1500, 14000), (1900, 16600)]]                      # through the canyons
RIVER_HALF = 110
# Crossings: the river is replaced by dry ground within 190 of each point. BRIDGES also get a plank deck drawn on top.
FORDS = [(16600, 3650), (14700, 7500), (17500, 10100), (20200, 10375), (2900, 9400), (2050, 13100)]
BRIDGES = [(14700, 7500), (2900, 9400)]
DRY_BED = [(8800, 600), (6000, 2300), (3000, 2200), (600, 3800)]          # a walkable dirt riverbed across the desert
ISLANDS = [(23300, 8000, 330), (23700, 12500, 280), (23000, 14800, 240)]   # scenery only; nothing can reach them

SPAWN = {k: tuple(v) for k, v in PLACES['spawns'].items()}
POOLS = [(l['x'], l['y'] - l['pool'] - 120, l['pool']) for l in PLACES['landmarks'] if 'pool' in l]
# Every spot the player must be able to stand on. Water is pushed back from them and scenery is kept off them.
POINTS = (list(SPAWN.values()) + [tuple(p) for p in PLACES['supplies'].values()]
          + [(p['x'], p['y']) for p in PLACES['landmarks'] + PLACES['waypoints']])

# Says what the ground is at one point of the world.
def terrain(x, y):
    k = region_key(x, y); t = BASE[k]
    if k == 'D' and line_dist(DRY_BED, x, y) < 90: t = DIRT
    if k == 'L':
        edge = coast(y)
        if x > edge + 16: t = SAND if any(math.hypot(x - ix, y - iy) < r for ix, iy, r in ISLANDS) else WATER
        elif x > edge - 260 - 40 * math.sin(y / 180): t = SAND
    if any(line_dist(r, x, y) < RIVER_HALF + 25 * math.sin(x / 170 + y / 130) for r in RIVERS): t = WATER
    if any(math.hypot(x - px, y - py) < r for px, py, r in POOLS): t = WATER
    if t == WATER and any(math.hypot(x - fx, y - fy) < 190 for fx, fy in FORDS): t = DIRT
    if t != WATER:
        bx, by = SPAWN['builder']; sx, sy = SPAWN['scout']; vx, vy = SPAWN['survivor']
        if ((x - bx) / 400) ** 2 + ((y - by - 12) / 270) ** 2 < 1 + 0.15 * math.sin(x / 90 + y / 70): t = DIRT   # village clearing
        if math.hypot(x - sx + 30, y - sy + 50) < 150: t = DIRT                                                # scout's camp
        if t == GRASS and math.hypot(x - vx, y - vy) < 520: t = SAND                                          # the survivor's beach
    if t == WATER and any(math.hypot(x - px, y - py) < 130 for px, py in POINTS): t = SAND
    return t

corner = np.array([[terrain(x * TILE, y * TILE) for x in range(COLS + 1)] for y in range(ROWS + 1)])

# ---- tileset -----------------------------------------------------------------------------
tex = {n: np.asarray(Image.open(os.path.join(SRC, f'{n}.png')).convert('RGB').resize((TEX, TEX))).astype(float)
       for n in ['grass'] + OVERLAYS}
f = np.fft.fft2(np.random.default_rng(3).random((TEX, TEX)))
fy, fx = np.meshgrid(np.fft.fftfreq(TEX), np.fft.fftfreq(TEX), indexing='ij')
noise = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * 900))); noise -= noise.mean(); noise /= np.abs(noise).max() * 2   # seamless, +-0.5
u = (np.arange(TILE) + 0.5) / TILE; U, V = np.meshgrid(u, u)

tiles = []   # RGBA arrays; gid = index + 1

# Adds 16 tiles to the tileset, one for each 64px square of a 256px texture (4 across, 4 down).
def variants(make):
    for py in range(4):
        for px in range(4): tiles.append(make(px, py))

# Cuts one tile-sized square out of a bigger picture.
def cut(a, px, py): return a[py*TILE:(py+1)*TILE, px*TILE:(px+1)*TILE]

first = {'ground': 1}
variants(lambda px, py: np.dstack([cut(tex['grass'], px, py), np.full((TILE, TILE), 255.0)]))
for name in OVERLAYS:
    first[name] = len(tiles) + 1
    for mask in range(1, 16):   # which of the four tile corners (TL, TR, BL, BR) hold this terrain
        tl, tr, bl, br = mask & 1, mask >> 1 & 1, mask >> 2 & 1, mask >> 3 & 1
        blend = tl * (1 - U) * (1 - V) + tr * U * (1 - V) + bl * (1 - U) * V + br * U * V

        # Paints one edge tile: solid where the corners say so, fading out elsewhere, with noise for a natural edge.
        def make(px, py, blend=blend, name=name):
            val = blend + cut(noise, px, py) * 0.5
            rgb = cut(tex[name], px, py).copy()
            alpha = np.clip((val - 0.5) / 0.05 + 0.5, 0, 1)
            if name == 'water':   # pale surf where water meets land
                foam = np.clip(1 - (val - 0.5) / 0.09, 0, 1)[..., None] * 0.75
                rgb = rgb * (1 - foam) + np.array([236, 250, 244.0]) * foam
            return np.dstack([rgb, alpha * 255])
        variants(make)

# Picks the tileset number (gid) for one map square; 0 means empty.
def gid(name, mask, tx, ty): return 0 if mask == 0 else first[name] + (mask - 1) * 16 + (ty % 4) * 4 + tx % 4

TS_COLS = 32; ts_rows = math.ceil(len(tiles) / TS_COLS); cell = TILE + 2
sheet = np.zeros((ts_rows * cell, TS_COLS * cell, 4), dtype='uint8')
for i, t in enumerate(tiles):
    y, x = (i // TS_COLS) * cell, (i % TS_COLS) * cell
    sheet[y:y+cell, x:x+cell] = np.pad(t.astype('uint8'), ((1, 1), (1, 1), (0, 0)), mode='edge')   # extrusion stops seams when zoomed
Image.fromarray(sheet).save(os.path.join(OUT, 'tileset.png'))

# ---- tile layers -------------------------------------------------------------------------
# A layer only paints a tile when one of the tile's corners is its own terrain. It then covers every corner of
# its rank or higher, so the terrain below a shoreline runs on underneath the water and no grass shows in the seam.
# For water (the top rank) that is exactly "which corners are water", which src/world/map.js reads for collision.
layers = {'ground': [1 + (ty % 4) * 4 + tx % 4 for ty in range(ROWS) for tx in range(COLS)]}
for rank, name in enumerate(OVERLAYS, start=1):
    data = []
    for ty in range(ROWS):
        for tx in range(COLS):
            c = (corner[ty, tx], corner[ty, tx+1], corner[ty+1, tx], corner[ty+1, tx+1])
            mask = sum(int(v >= rank) << i for i, v in enumerate(c)) if rank in c else 0
            data.append(gid(name, mask, tx, ty))
    layers[name] = data

# ---- region grid -------------------------------------------------------------------------
# One digit per 256-unit square, row by row: the index of that square's region in places.json.
REGION_CELL = 256; REGION_COLS, REGION_ROWS = W // REGION_CELL, H // REGION_CELL
region_grid = ''.join(str(REGION_INDEX[region_key(cx * REGION_CELL + REGION_CELL / 2, cy * REGION_CELL + REGION_CELL / 2)])
                      for cy in range(REGION_ROWS) for cx in range(REGION_COLS))

# ---- objects -----------------------------------------------------------------------------
spec = {k: v for k, v in json.load(open(os.path.join(SRC, 'objects.json'))).items() if not k.startswith('_')}
(sx, sy), (bx, by), (vx, vy) = SPAWN['scout'], SPAWN['builder'], SPAWN['survivor']
fixed = [('tent', sx + 137, sy - 160), ('log', sx - 156, sy - 154), ('campfire', sx - 44, sy - 66),
         ('house-a', bx - 305, by - 120), ('house-b', bx + 295, by - 110), ('house-c', bx - 372, by + 310),
         ('workshop', bx + 458, by + 225), ('ship', vx + 325, vy - 20)]
fixed += [(l['object'], l['x'], l['y'] - 60) for l in PLACES['landmarks'] if 'object' in l]   # the feature stands just north of the spot
fixed += [('signpost', w['x'], w['y'] - 50) for w in PLACES['waypoints']]
fixed += [('bridge', x, y) for x, y in BRIDGES]

# Says whether a random tree or rock may go at (x, y): not on a place the player must stand, not on a crossing,
# and not on, behind or just in front of a hand-placed object, where it would cover it up.
def scatter_ok(x, y):
    return (all(math.hypot(x - cx, y - cy) > 150 for cx, cy in POINTS)
            and all(abs(x - cx) > 170 or not (0 < y - cy < 330) for cx, cy in POINTS)   # nothing tall just south, where its canopy would hide the player
            and all(math.hypot(x - fx, y - fy) > 260 for fx, fy in FORDS)
            and all(abs(x - ox) > 330 or not (-150 < oy - y < 420) for _, ox, oy in fixed))

# What grows in each region: (chance that a grid square gets something, what it can be).
SCATTER = {
    'D': (0.16, ['cactus', 'cactus', 'dead-bush', 'beach-rock']),
    'P': (0.85, ['pines', 'pine', 'pine', 'pines', 'rocks-a']),
    'S': (0.32, ['snowy-pine', 'snowy-pine', 'ice-rock', 'boulder']),
    'C': (0.38, ['boulder', 'cliff-rock', 'rocks-a', 'dead-bush', 'boulder']),
    'J': (0.70, ['jungle-tree', 'jungle-tree', 'fern', 'fern', 'big-oak', 'palm']),
}
scattered = []
STEP = 210
for gy in range(STEP // 2, H, STEP):
    for gx in range(STEP // 2, W, STEP):
        # Each grid square has its own random seed, so changing one part of the map never reshuffles another part.
        rng = random.Random(gx * 73856093 ^ gy * 19349663)
        x, y = gx + rng.randint(-70, 70), gy + rng.randint(-70, 70)
        if not (60 < x < W - 60 and 120 < y < H - 30) or not scatter_ok(x, y): continue
        ground = terrain(x, y); roll = rng.random()
        if ground in (WATER, DIRT): continue
        k = region_key(x, y)
        if k == 'h':
            grove = math.sin(x / 610 + 1.3) * math.cos(y / 520 + 0.4) > 0.35   # clumps in the open meadow
            chance, names = (0.8, ['oak', 'big-oak', 'pine', 'pines', 'flowers']) if grove else (0.3, ['oak', 'big-oak', 'pine', 'rocks-a', 'rocks-b', 'flowers', 'flowers'])
        elif k == 'L':
            if ground == SAND: chance, names = (0.14 if x < coast(y) - 60 else 0, ['palm', 'beach-rock'])
            else: chance, names = 0.28, ['oak', 'palm', 'palm', 'flowers', 'rocks-b']
        else: chance, names = SCATTER[k]
        if roll < chance: scattered.append((rng.choice(names), x, y))
objects = fixed + scattered

tiled = {
    'type': 'map', 'version': '1.10', 'tiledversion': '1.11.0', 'orientation': 'orthogonal', 'renderorder': 'right-down', 'infinite': False,
    'width': COLS, 'height': ROWS, 'tilewidth': TILE, 'tileheight': TILE, 'nextlayerid': len(OVERLAYS) + 3, 'nextobjectid': len(objects) + 1,
    'tilesets': [{'firstgid': 1, 'name': 'terrain', 'image': 'tileset.png', 'imagewidth': sheet.shape[1], 'imageheight': sheet.shape[0],
                  'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': TS_COLS, 'tilecount': len(tiles)}],
    'properties': [{'name': 'firstWaterGid', 'type': 'int', 'value': first['water']},
                   {'name': 'regionCell', 'type': 'int', 'value': REGION_CELL},
                   {'name': 'regionCols', 'type': 'int', 'value': REGION_COLS},
                   {'name': 'regionGrid', 'type': 'string', 'value': region_grid}],
    'layers': [{'id': i + 1, 'name': n, 'type': 'tilelayer', 'x': 0, 'y': 0, 'width': COLS, 'height': ROWS, 'opacity': 1, 'visible': True, 'data': layers[n]}
               for i, n in enumerate(['ground'] + OVERLAYS)]
            + [{'id': len(OVERLAYS) + 2, 'name': 'objects', 'type': 'objectgroup', 'x': 0, 'y': 0, 'opacity': 1, 'visible': True, 'draworder': 'topdown',
                'objects': [{'id': i + 1, 'name': n, 'type': n, 'x': x, 'y': y, 'width': 0, 'height': 0, 'rotation': 0, 'point': True, 'visible': True}
                            for i, (n, x, y) in enumerate(objects)]}],
}
map_path = os.path.join(OUT, 'wildhaven.json')
json.dump(tiled, open(map_path, 'w'), separators=(',', ':'))

# ---- overview ----------------------------------------------------------------------------
S = 8; full = Image.new('RGBA', (W // S, H // S))
small = [Image.fromarray(t.astype('uint8')).resize((TILE // S, TILE // S), Image.BOX) for t in tiles]
for n in ['ground'] + OVERLAYS:
    for i, g in enumerate(layers[n]):
        if g: full.alpha_composite(small[g - 1], ((i % COLS) * TILE // S, (i // COLS) * TILE // S))
sprites = {n: Image.open(os.path.join(SRC, 'objects', f'{n}.png')).convert('RGBA') for n in spec}

# Shrinks a sprite to overview size, allowing for the sprite's own `scale` in objects.json.
def shrink(n, im): sc = spec[n].get('scale', 1); return im.resize((max(1, int(im.width * sc) // S), max(1, int(im.height * sc) // S)), Image.LANCZOS)
sprites = {n: shrink(n, im) for n, im in sprites.items()}
for n, x, y in sorted(objects, key=lambda o: (not spec[o[0]].get('flat', False), o[2])):
    im = sprites[n]; ox, oy = spec[n]['origin']
    px, py = round(x / S - im.width * ox), round(y / S - im.height * oy)
    if px >= 0 and py >= 0 and px + im.width <= full.width and py + im.height <= full.height: full.alpha_composite(im, (px, py))
full.convert('RGB').resize((1536, 1024), Image.LANCZOS).save(os.path.join(OUT, 'overview.webp'), quality=85)
if len(sys.argv) > 1: full.convert('RGB').save(sys.argv[1])
print(len(tiles), 'tiles,', len(objects), 'objects,', round(os.path.getsize(map_path) / 1e6, 1), 'MB map file')
