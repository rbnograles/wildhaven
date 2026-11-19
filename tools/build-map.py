"""Builds the Wildhaven sprite map from assets/world/source/.

Inputs : source/{grass,dirt,sand,water}.png  seamless 256x256 ground textures
         source/objects/<name>.png + source/objects.json  one sprite per world object
Outputs: map/tileset.png   terrain tiles incl. generated soft transitions (64px, 1px extruded)
         map/wildhaven.json Tiled-format map: tile layers ground/dirt/sand/water + "objects" layer
         map/overview.webp  small render of the whole map for the minimap
The JSON opens in the Tiled editor; the game reads collision from it (water tiles + object footprints).
Run: python tools/build-map.py [preview.png]
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world')
SRC, OUT = os.path.join(ROOT, 'source'), os.path.join(ROOT, 'map'); os.makedirs(OUT, exist_ok=True)
TILE, COLS, ROWS, TEX = 64, 96, 64, 256
W, H = COLS * TILE, ROWS * TILE
GRASS, DIRT, SAND, WATER = 0, 1, 2, 3
rng = random.Random(11)

# ---- terrain at tile corners -------------------------------------------------------------
PAINTED = [[0,2790],[240,2710],[480,2745],[720,2680],[920,2790],[1110,2660],[1280,2680],[1500,2970],[1650,2850],[1800,2570],[2048,2200]]
def coast(y):
    if y < 2808: return 5770 + 70 * math.sin(y / 310) + 30 * math.sin(y / 97)
    y -= 2048; i = next((k for k, p in enumerate(PAINTED) if p[0] >= y), len(PAINTED) - 1); a, b = PAINTED[max(0, i - 1)], PAINTED[i]
    return 3072 + a[1] + (b[1] - a[1]) * (0 if a[0] == b[0] else (y - a[0]) / (b[0] - a[0]))
def terrain(x, y):
    edge = coast(y)
    if x > edge + 16: return WATER
    if x > edge - 170 - 40 * math.sin(y / 180) or math.hypot(x - 5420, y - 3660) < 640: return SAND
    if ((x - 3072) / 400) ** 2 + ((y - 2060) / 270) ** 2 < 1 + 0.15 * math.sin(x / 90 + y / 70): return DIRT
    if math.hypot(x - 590, y - 500) < 150: return DIRT
    return GRASS
corner = np.array([[terrain(x * TILE, y * TILE) for x in range(COLS + 1)] for y in range(ROWS + 1)])

# ---- tileset -----------------------------------------------------------------------------
tex = {n: np.asarray(Image.open(os.path.join(SRC, f'{n}.png')).convert('RGB').resize((TEX, TEX))).astype(float) for n in ('grass', 'dirt', 'sand', 'water')}
f = np.fft.fft2(np.random.default_rng(3).random((TEX, TEX)))
fy, fx = np.meshgrid(np.fft.fftfreq(TEX), np.fft.fftfreq(TEX), indexing='ij')
noise = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * 900))); noise -= noise.mean(); noise /= np.abs(noise).max() * 2   # seamless, +-0.5
u = (np.arange(TILE) + 0.5) / TILE; U, V = np.meshgrid(u, u)

tiles = []   # RGBA arrays; gid = index + 1
def variants(make):
    # 16 variants per tile, picked by map position, so each 256px texture runs unbroken across the map
    for py in range(4):
        for px in range(4): tiles.append(make(px, py))
def cut(a, px, py): return a[py*TILE:(py+1)*TILE, px*TILE:(px+1)*TILE]
first = {'ground': 1}
variants(lambda px, py: np.dstack([cut(tex['grass'], px, py), np.full((TILE, TILE), 255.0)]))
for name in ('dirt', 'sand', 'water'):
    first[name] = len(tiles) + 1
    for mask in range(1, 16):   # which of the four tile corners (TL, TR, BL, BR) hold this terrain
        tl, tr, bl, br = mask & 1, mask >> 1 & 1, mask >> 2 & 1, mask >> 3 & 1
        blend = tl * (1 - U) * (1 - V) + tr * U * (1 - V) + bl * (1 - U) * V + br * U * V
        def make(px, py, blend=blend, name=name):
            val = blend + cut(noise, px, py) * 0.5
            rgb = cut(tex[name], px, py).copy()
            alpha = np.clip((val - 0.5) / 0.05 + 0.5, 0, 1)
            if name == 'water':   # pale surf where the sea meets the sand
                foam = np.clip(1 - (val - 0.5) / 0.09, 0, 1)[..., None] * 0.75
                rgb = rgb * (1 - foam) + np.array([236, 250, 244.0]) * foam
            return np.dstack([rgb, alpha * 255])
        variants(make)
def gid(name, mask, tx, ty): return 0 if mask == 0 else first[name] + (mask - 1) * 16 + (ty % 4) * 4 + tx % 4

TS_COLS = 32; ts_rows = math.ceil(len(tiles) / TS_COLS); cell = TILE + 2
sheet = np.zeros((ts_rows * cell, TS_COLS * cell, 4), dtype='uint8')
for i, t in enumerate(tiles):
    y, x = (i // TS_COLS) * cell, (i % TS_COLS) * cell
    sheet[y:y+cell, x:x+cell] = np.pad(t.astype('uint8'), ((1, 1), (1, 1), (0, 0)), mode='edge')   # extrusion stops seams when zoomed
Image.fromarray(sheet).save(os.path.join(OUT, 'tileset.png'))

# ---- tile layers -------------------------------------------------------------------------
tests = {'dirt': lambda c: int(c == DIRT), 'sand': lambda c: int(c >= SAND), 'water': lambda c: int(c == WATER)}
layers = {'ground': [1 + (ty % 4) * 4 + tx % 4 for ty in range(ROWS) for tx in range(COLS)]}
for name, t in tests.items():
    layers[name] = [gid(name, t(corner[ty, tx]) + t(corner[ty, tx+1]) * 2 + t(corner[ty+1, tx]) * 4 + t(corner[ty+1, tx+1]) * 8, tx, ty)
                    for ty in range(ROWS) for tx in range(COLS)]

# ---- objects -----------------------------------------------------------------------------
spec = {k: v for k, v in json.load(open(os.path.join(SRC, 'objects.json'))).items() if not k.startswith('_')}
V_OFF, C_OFF = (1622, 1158), (3072, 2048)
objects = [('tent', 757, 390), ('log', 464, 396), ('campfire', 576, 484),
           ('house-a', 1145 + V_OFF[0], 770 + V_OFF[1]), ('house-b', 1745 + V_OFF[0], 780 + V_OFF[1]),
           ('house-c', 1078 + V_OFF[0], 1200 + V_OFF[1]), ('workshop', 1908 + V_OFF[0], 1115 + V_OFF[1]),
           ('ship', 2725 + C_OFF[0], 1560 + C_OFF[1])]
# Spawns and supply nodes from src/state.js (absolute positions): scenery within 150 of them is dropped after scattering.
KEEP_CLEAR = [(620, 550), (3072, 2048), (5472, 3628), (870, 650), (480, 570), (480, 705), (3180, 2170), (2990, 2180), (3202, 2348), (5630, 3740), (5322, 3778), (3300, 2580)]
# FROZEN: the spots the scatter loop has always skipped. Which candidates it skips decides how many random draws follow,
# so editing this list reshuffles every later tree and rock, and a new solid base under a saved player makes that save
# unreadable. Never edit it; move nodes in KEEP_CLEAR instead, which only removes scenery.
SCATTER_CLEAR = [(620, 550), (3072, 2048), (5472, 3628), (657, 567), (490, 540), (480, 705), (3108, 2072), (2992, 2158), (3202, 2348), (5507, 3648), (5322, 3778), (3542, 2578)]
fixed = list(objects)
def scatter_ok(x, y):
    return (all(math.hypot(x - cx, y - cy) > 150 for cx, cy in SCATTER_CLEAR)
            and all(abs(x - ox) > 330 or not (-150 < oy - y < 420) for _, ox, oy in fixed))
STEP = 210
for gy in range(STEP // 2, H, STEP):
    for gx in range(STEP // 2, W, STEP):
        x, y = gx + rng.randint(-70, 70), gy + rng.randint(-70, 70)
        if not (60 < x < W - 60 and 120 < y < H - 30) or not scatter_ok(x, y): continue
        ground = terrain(x, y); roll = rng.random(); name = None
        woods = x < 1700 and y < 1500 and math.hypot(x - 600, y - 480) > 360          # Pinefall Woods
        grove = math.sin(x / 610 + 1.3) * math.cos(y / 520 + 0.4) > 0.35               # clumps in the open wilds
        if ground == SAND:
            if roll < 0.14 and x < coast(y) - 60: name = 'beach-rock'
        elif ground == GRASS:
            if woods: name = rng.choice(['pines', 'pine', 'pine', 'pines', 'rocks-a']) if roll < 0.9 else None
            elif grove: name = rng.choice(['oak', 'big-oak', 'pine', 'pines', 'flowers']) if roll < 0.8 else None
            else: name = rng.choice(['oak', 'big-oak', 'pine', 'rocks-a', 'rocks-b', 'flowers', 'flowers']) if roll < 0.3 else None
        if name: objects.append((name, x, y))
objects = fixed + [o for o in objects[len(fixed):] if all(math.hypot(o[1] - cx, o[2] - cy) > 150 for cx, cy in KEEP_CLEAR)]

tiled = {
    'type': 'map', 'version': '1.10', 'tiledversion': '1.11.0', 'orientation': 'orthogonal', 'renderorder': 'right-down', 'infinite': False,
    'width': COLS, 'height': ROWS, 'tilewidth': TILE, 'tileheight': TILE, 'nextlayerid': 6, 'nextobjectid': len(objects) + 1,
    'tilesets': [{'firstgid': 1, 'name': 'terrain', 'image': 'tileset.png', 'imagewidth': sheet.shape[1], 'imageheight': sheet.shape[0],
                  'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': TS_COLS, 'tilecount': len(tiles)}],
    'properties': [{'name': 'firstWaterGid', 'type': 'int', 'value': first['water']}],
    'layers': [{'id': i + 1, 'name': n, 'type': 'tilelayer', 'x': 0, 'y': 0, 'width': COLS, 'height': ROWS, 'opacity': 1, 'visible': True, 'data': layers[n]}
               for i, n in enumerate(('ground', 'dirt', 'sand', 'water'))]
            + [{'id': 5, 'name': 'objects', 'type': 'objectgroup', 'x': 0, 'y': 0, 'opacity': 1, 'visible': True, 'draworder': 'topdown',
                'objects': [{'id': i + 1, 'name': n, 'type': n, 'x': x, 'y': y, 'width': 0, 'height': 0, 'rotation': 0, 'point': True, 'visible': True}
                            for i, (n, x, y) in enumerate(objects)]}],
}
json.dump(tiled, open(os.path.join(OUT, 'wildhaven.json'), 'w'), separators=(',', ':'))

# ---- overview ----------------------------------------------------------------------------
S = 4; full = Image.new('RGBA', (W // S, H // S))
small = [Image.fromarray(t.astype('uint8')).resize((TILE // S, TILE // S), Image.BOX) for t in tiles]
for n in ('ground', 'dirt', 'sand', 'water'):
    for i, g in enumerate(layers[n]):
        if g: full.alpha_composite(small[g - 1], ((i % COLS) * TILE // S, (i // COLS) * TILE // S))
sprites = {n: Image.open(os.path.join(SRC, 'objects', f'{n}.png')).convert('RGBA') for n in spec}
def shrink(n, im): sc = spec[n].get('scale', 1); return im.resize((max(1, int(im.width * sc) // S), max(1, int(im.height * sc) // S)), Image.LANCZOS)
sprites = {n: shrink(n, im) for n, im in sprites.items()}
for n, x, y in sorted(objects, key=lambda o: (not spec[o[0]].get('flat', False), o[2])):
    im = sprites[n]; ox, oy = spec[n]['origin']
    px, py = round(x / S - im.width * ox), round(y / S - im.height * oy)
    if px >= 0 and py >= 0 and px + im.width <= full.width and py + im.height <= full.height: full.alpha_composite(im, (px, py))
full.convert('RGB').resize((768, 512), Image.LANCZOS).save(os.path.join(OUT, 'overview.webp'), quality=85)
if len(sys.argv) > 1: full.convert('RGB').save(sys.argv[1])
print(len(tiles), 'tiles,', len(objects), 'objects')
