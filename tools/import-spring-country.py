"""Brings Spring Country into the game: writes assets/world/map/ from the Spring Tiled map.

The game draws and collides with assets/world/map/wildhaven.json. This is the Spring counterpart of
tools/import-tiled-world.py (the deprecated Wildhaven importer): it reads the Spring map, which uses a
simpler contract (one flat temperate biome, its own object tileset, seven ground layers, no banks or
cliffs), and writes the game map the player actually loads. Think of it as a translator: Tiled keeps
each picture as a box with a size, while the game wants each thing as a point (where it touches the
ground) with a name.

What it does differently from the Wildhaven importer:
 - matches ground layers by their ground word (Spring renumbers them and omits jungle/snow),
 - reads each object's sprite from its own `type` (Spring objects carry it),
 - writes a FLAT elevation grid and a Spring region grid (eight districts, one per settlement),
   instead of keeping the old map's hills and regions,
 - skips the authoring-only wildlife art layer and the Wildhaven world-editor edits.

Inputs : assets/world/spring-country/spring-country.tmj     the Spring map (or the map named on argv)
         assets/world/tiled/terrain-redrawn.json, .png       the ground kit
         assets/world/tiled/path-connectors.png              the path kit
         assets/world/source/objects.json                    each sprite's origin and solid base
         assets/world/map/wildhaven.json, tileset.png        the game's current map: its own tileset
                                                             (kept) and the stored gids the hidden
                                                             ground layers index into
Outputs: assets/world/map/wildhaven.json, ground-kit.png, path-kit.png, overview.webp
Run: python tools/import-spring-country.py [map.tmj]
     (Tiled's tmxrasterizer draws the minimap: on the PATH, named in TMXRASTERIZER, or via Tiled's installer)
"""
import json, math, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
import spring_geography as sg

ROOT = os.path.join(TOOLS, '..', 'assets', 'world')
TILED, GAME_DIR, SRC = os.path.join(ROOT, 'tiled'), os.path.join(ROOT, 'map'), os.path.join(ROOT, 'source')
SPRING_DIR = os.path.join(ROOT, 'spring-country')
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SPRING_DIR, 'spring-country.tmj')
TILE = 64                      # the tiles' size in pixels and world units
KIT = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']   # ground layers, bottom first
GAME = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']  # the game's, by rank
OVERVIEW = (1568, 1120)        # the minimap picture's size: the map's own 7:5 shape
KEPT_PROPERTIES = {'holds', 'mineral'}   # object properties the game map keeps (a cave's labels)
# Authoring-only Tiled layers the game does not read: the gameplay markers and the wildlife preview art.
# Live animals come from the seed-based herd system, so importing the preview art would double them.
SKIP_LAYERS = {'Gameplay markers - show to edit', 'Wildlife spawn art', 'places'}
# Sprites left off the Spring map on purpose: the wheat bed is a thing the player crafts to grow food,
# so it must not be scattered as scenery.
SKIP_SPRITES = {'wheat-4'}
# Sprites drawn at a fixed scale instead of the Tiled size: the berry bushes were authored large
# ("big cherry"); the standard is a small bush, so they are pinned small.
RESCALE = {'wild-berries': 0.4}
# Rock swap: the old rocks were one picture stretched to each size, which looked wrong. They are
# swapped for the resource-expansion sprites, which have one correct picture per size. A rock's size
# is its base size nudged by how big the Tiled map drew it (the game's own SIZE_SHRINK/SIZE_GROW).
ROCK_BASE = {'rocks-a': 2, 'rocks-b': 2, 'boulder': 3, 'beach-rock': 1}
ROCK_MATERIAL = {'beach-rock': 'beach'}   # every other rock becomes grey stone
SIZE_WORD = {1: 'small', 2: 'medium', 3: 'big'}
SIZE_SHRINK, SIZE_GROW = 0.85, 1.2        # match data/balance.js
IRON_NEAR = 1600                          # grey rocks this close to a cave become iron ore (mine by the cave)

tiled = json.load(open(SOURCE))
game = json.load(open(os.path.join(GAME_DIR, 'wildhaven.json')))
props = {p['name']: p['value'] for p in game['properties']}
COLS, ROWS = tiled['width'], tiled['height']
assert (COLS, ROWS) == (game['width'], game['height']), 'the Spring map must be the same size as the game map'
specs = {k: v for k, v in json.load(open(os.path.join(SRC, 'objects.json'))).items() if not k.startswith('_')}
kit = json.load(open(os.path.join(TILED, 'terrain-redrawn.json')))['materials']
first = {os.path.basename(t.get('source') or t.get('name')): t['firstgid'] for t in tiled['tilesets']}
KIT_FIRST, PATH_FIRST = first['terrain-redrawn.tsx'], first['path-connectors.tsx']
report = {}

# ---- the tilesets: the game's own tiles, then the ground kit, then the path kit ------------------------
# The game's tileset.png is left as build-map.py made it (the hidden ground layers index into it). The two
# kits are copied next to it as tilesets of their own, numbered after the game's tiles.
base_count = game['tilesets'][0]['tilecount']
FIRST_KIT, FIRST_PATH_TILE = base_count + 1, base_count + 145
for kit_file, game_file in (('terrain-redrawn.png', 'ground-kit.png'), ('path-connectors.png', 'path-kit.png')):
    shutil.copyfile(os.path.join(TILED, kit_file), os.path.join(GAME_DIR, game_file))
TILESETS = [
    dict(game['tilesets'][0], firstgid=1),
    {'firstgid': FIRST_KIT, 'name': 'ground-kit', 'image': 'ground-kit.png', 'imagewidth': 792, 'imageheight': 792,
     'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': 12, 'tilecount': 144},
    {'firstgid': FIRST_PATH_TILE, 'name': 'path-kit', 'image': 'path-kit.png', 'imagewidth': 528, 'imageheight': 528,
     'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': 8, 'tilecount': 64},
]
report['tiles'] = f'{base_count} game tiles + 144 ground kit + 64 path kit'


# Gives a Tiled tile number its number in the game's tileset. The top three bits (flips) are kept.
# Spring draws only ground-kit and path-kit tiles, so anything else is dropped (there should be none).
dropped = [0]
def remap(gid):
    flips, t = gid & 0xE0000000, gid & 0x1FFFFFFF
    if not t: return 0
    if KIT_FIRST <= t < KIT_FIRST + 144: return flips | (FIRST_KIT + t - KIT_FIRST)
    if PATH_FIRST <= t < PATH_FIRST + 64: return flips | (FIRST_PATH_TILE + t - PATH_FIRST)
    dropped[0] += 1; return 0


# Spring ground layers are renumbered and omit jungle/snow, so match each layer by its last word
# ('01 deep' -> 'deep', '07 soil' -> 'soil'); the paths layer's last word is ignored here.
word_layer = {l['name'].split()[-1]: l for l in tiled['layers'] if l['type'] == 'tilelayer'}
paths_layer = next((l for l in tiled['layers'] if l['type'] == 'tilelayer' and l['name'].lower().startswith('paths')), None)

# The drawn layers the renderer shows: the ground layers in rank order, then the paths on top.
drawn = []
for g in KIT:
    l = word_layer.get(g)
    if l: drawn.append(dict(l, name=g, data=[remap(x) for x in l['data']]))
if paths_layer:
    drawn.append(dict(paths_layer, name='paths', data=[remap(x) for x in paths_layer['data']]))
report['tiles Tiled used that the game cannot draw (left out)'] = dropped[0]
layers = []

# ---- the ground for collision: the nine layers in the game's own coding ----------------------------------
# Which ground shows on every tile corner, read from Spring's ground layers (topmost wins), then written
# back as the game's hidden layers in the exact encoding build-map.py and import-tiled-world.py use.
# world/map.js reads the water, deep, sand and snow layers from these; the game draws the layers above.
mask_of = {KIT_FIRST + tile: (i, int(m)) for i, g in enumerate(KIT) for m, tile in kit[g].items()}
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)
for i, g in enumerate(KIT):
    layer = word_layer.get(g)
    if not layer: continue
    for at, gid in enumerate(layer['data']):
        found = mask_of.get(gid & 0x1FFFFFFF)
        if not found or found[0] != i: continue
        ty, tx = divmod(at, COLS)
        for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
            if found[1] & bit: corner[ty + dy, tx + dx] = max(corner[ty + dy, tx + dx], i)
rank = np.array([GAME.index(g) for g in KIT])[corner]
variant = np.array([[1 + (ty % 4) * 4 + tx % 4 for tx in range(COLS)] for ty in range(ROWS)])
WATER, DEEP = GAME.index('water'), GAME.index('deep')
for r, g in enumerate(GAME):
    if r == 0:
        data = variant.flatten()
    else:
        covered = (rank >= r).astype(int)
        own = (rank >= WATER) if r == WATER else (rank == r)   # the water layer also marks deep sea
        mask = covered[:-1, :-1] + 2 * covered[:-1, 1:] + 4 * covered[1:, :-1] + 8 * covered[1:, 1:]
        paint = own[:-1, :-1] | own[:-1, 1:] | own[1:, :-1] | own[1:, 1:]
        data = np.where(paint & (mask > 0), 1 + 16 + (r - 1) * 240 + (mask - 1) * 16 + variant - 1, 0).flatten()
    layers.append({'id': len(layers) + 1, 'name': 'ground' if r == 0 else g, 'type': 'tilelayer', 'x': 0, 'y': 0,
                   'width': COLS, 'height': ROWS, 'opacity': 1, 'visible': False, 'data': [int(v) for v in data]})
for l in drawn: layers.append(dict(l, id=len(layers) + 1))   # drawn over the hidden ones, bottom to top
assert 1 + 16 + (WATER - 1) * 240 == props['firstWaterGid'] and 1 + 16 + (DEEP - 1) * 240 == props['firstDeepGid']

# ---- objects: from pictures with a size to points with a scale --------------------------------------
# Tiled pins a picture by the middle of its bottom edge and turns it round that point. The game pins it at
# its `origin` (where it meets the ground) and turns it round that. So each object's ground point is worked
# out from its box, allowing for the turn, and its size becomes a `scale`: how many times the usual size.
png_size = {}
def usual_width(name):
    if name not in png_size:
        png_size[name] = Image.open(os.path.join(SRC, 'objects', specs[name]['kind'], f'{name}.png')).width * specs[name].get('scale', 1)
    return png_size[name]

# Says what sprite a Spring object shows: its own `type` (Spring objects always carry it).
def sprite_of(o):
    return o.get('type', '')

# Something standing in the water (a coast painted over it) would break the game, so it is left out and
# listed. Ripples, waves and bridges belong on water.
ON_WATER = {'sea-wave', 'river-ripple', 'lake-ripple', 'bridge'}
wet_corner = rank >= WATER

# Says why an object can't go into the game, or '' when it can.
def misplaced(name, x, y):
    tx, ty = int(round(x / TILE)), int(round((y - 6) / TILE))
    if name not in ON_WATER and 0 <= ty <= ROWS and 0 <= tx <= COLS and wet_corner[ty, tx]: return 'in the water'
    return ''

points, skipped, left_out = [], {}, []
for l in tiled['layers']:
    if l['type'] != 'objectgroup' or l['name'] in SKIP_LAYERS: continue
    for o in l['objects']:
        name = sprite_of(o)
        if name in SKIP_SPRITES: continue
        if name not in specs: skipped[name] = skipped.get(name, 0) + 1; continue
        if 'gid' not in o:
            if not o.get('point'): skipped[name] = skipped.get(name, 0) + 1; continue
            x, y, scale = o['x'], o['y'], 1
        else:
            ox, oy = specs[name]['origin']; w, h = o['width'], o['height']
            turn = math.radians(o.get('rotation', 0))
            dx, dy = (ox - 0.5) * w, (oy - 1) * h
            x = o['x'] + dx * math.cos(turn) - dy * math.sin(turn)
            y = o['y'] + dx * math.sin(turn) + dy * math.cos(turn)
            scale = w / usual_width(name)
        if name in RESCALE: scale = RESCALE[name]
        if name in ROCK_BASE:
            size = max(1, min(3, ROCK_BASE[name] + (-1 if scale < SIZE_SHRINK else 1 if scale > SIZE_GROW else 0)))
            name = f'{ROCK_MATERIAL.get(name, "grey")}-rock-{SIZE_WORD[size]}'
            scale = 1   # the new sprite is already the right size for its own picture
        why = misplaced(name, x, y)
        if why: left_out.append(f'{name} at {round(x)},{round(y)}: {why}'); continue
        point = {'id': len(points) + 1, 'name': name, 'type': name, 'x': round(x), 'y': round(y), 'width': 0,
                 'height': 0, 'rotation': o.get('rotation', 0), 'point': True, 'visible': True}
        props_out = [{'name': 'scale', 'type': 'float', 'value': round(scale, 3)}] if abs(scale - 1) > 0.02 else []
        props_out += [{'name': q['name'], 'type': 'string', 'value': q['value']} for q in o.get('properties', [])
                      if q.get('name') in KEPT_PROPERTIES]
        if props_out: point['properties'] = props_out
        points.append(point)

# Iron ore near the caves: a forest cave means minerals, so the grey rocks close to one are mined as
# iron instead of plain stone. That is the only metal in Spring; copper, gold and diamond stay out.
caves = [(p['x'], p['y']) for p in points if p['name'] == 'cave-forest']
iron = 0
for p in points:
    if p['name'] in ('grey-rock-medium', 'grey-rock-big') and any(math.hypot(p['x'] - cx, p['y'] - cy) < IRON_NEAR for cx, cy in caves):
        p['name'] = p['type'] = p['name'].replace('grey', 'iron'); iron += 1
report['iron rocks near caves'] = iron

# A path square the player can't walk is taken off the path layer, so the path just ends there. Two
# cases: a square whose middle lies inside something solid (a house put down over a path), and a square
# over water (a river crossing belongs to a bridge, not a loose path tile; dry land is <2 wet corners).
paths = next((l for l in layers if l['name'] == 'paths'), None)
cleared, cleared_water = 0, 0
if paths:
    for p in points:
        base = specs[p['name']].get('footprint')
        if not base: continue
        s = specs[p['name']].get('scale', 1) * next((q['value'] for q in p.get('properties', []) if q['name'] == 'scale'), 1)
        left, top, right, bottom = p['x'] - base[0] * s, p['y'] - base[1] * s, p['x'] + base[0] * s, p['y']
        for ty in range(int(top // TILE), int(bottom // TILE) + 1):
            for tx in range(int(left // TILE), int(right // TILE) + 1):
                mx, my = tx * TILE + TILE / 2, ty * TILE + TILE / 2
                if 0 <= tx < COLS and 0 <= ty < ROWS and paths['data'][ty * COLS + tx] and left - 10 < mx < right + 10 and top - 10 < my < bottom + 10:
                    paths['data'][ty * COLS + tx] = 0; cleared += 1
    for ty in range(ROWS):
        for tx in range(COLS):
            if not paths['data'][ty * COLS + tx]: continue
            wet = int(wet_corner[ty, tx]) + int(wet_corner[ty, tx + 1]) + int(wet_corner[ty + 1, tx]) + int(wet_corner[ty + 1, tx + 1])
            if wet >= 2: paths['data'][ty * COLS + tx] = 0; cleared_water += 1
report['path squares cleared (under objects / over water)'] = f'{cleared} / {cleared_water}'

layers.append({'id': len(layers) + 1, 'name': 'objects', 'type': 'objectgroup', 'x': 0, 'y': 0, 'opacity': 1,
               'visible': True, 'draworder': 'topdown', 'objects': points})
report['objects'] = len(points)
if skipped: report['objects the game has no sprite for (left out)'] = skipped
if left_out: report['objects left out (in water)'] = len(left_out)

# ---- the stored values: keep most, but flatten the world and give it Spring's regions ------------------
# Spring has no hills, so the elevation grid is all level 0 (no walls, no stairs). The region grid is
# rebuilt from the settlements so every patch of ground belongs to its nearest district.
markers = sg.read_markers(SOURCE)
region_rows = len(props['regionGrid']) // props['regionCols']   # the region grid's height in squares (80)
region_grid, region_ids = sg.region_grid(markers['settlements'], props['regionCols'], region_rows, props['regionCell'])
elevation = sg.flat_elevation(COLS, ROWS)
overrides = {'elevation': elevation, 'baseLevels': elevation, 'baseStairs': '[]', 'regionGrid': region_grid,
             'importedFrom': os.path.basename(SOURCE)}
stored = [{'name': p['name'], 'type': p['type'], 'value': overrides.get(p['name'], p['value'])} for p in game['properties']]
# Spring ships without the extra painted shoreline strip for now: the terrain kit already draws rounded
# water edges. 'banks': 'none' records that choice (bank tiles are deferred polish, see the plan's D7).
if not any(p['name'] == 'banks' for p in stored):
    stored.append({'name': 'banks', 'type': 'string', 'value': 'none'})
report['regions'] = f'{len(region_ids)} districts: ' + ', '.join(region_ids)

out = {k: game[k] for k in ('type', 'version', 'tiledversion', 'orientation', 'renderorder', 'infinite', 'width',
                            'height', 'tilewidth', 'tileheight')}
out.update(nextlayerid=len(layers) + 1, nextobjectid=len(points) + 1, layers=layers, properties=stored, tilesets=TILESETS)
json.dump(out, open(os.path.join(GAME_DIR, 'wildhaven.json'), 'w'), separators=(',', ':'))

# ---- the minimap picture ------------------------------------------------------------------------------
# Tiled's own renderer draws the Spring map small, with the gameplay-marker layer hidden. Without the
# rasterizer the picture build-map.py drew is kept instead.
# Finds Tiled's tmxrasterizer: named in TMXRASTERIZER, on the PATH, or (on Windows) via Tiled's installer.
def find_rasterizer():
    found = os.environ.get('TMXRASTERIZER') or shutil.which('tmxrasterizer')
    if found or os.name != 'nt': return found
    import winreg
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        for key in (r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
                    r'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'):
            try: apps = winreg.OpenKey(hive, key)
            except OSError: continue
            for i in range(winreg.QueryInfoKey(apps)[0]):
                try:
                    app = winreg.OpenKey(apps, winreg.EnumKey(apps, i))
                    if winreg.QueryValueEx(app, 'DisplayName')[0] == 'Tiled':
                        exe = os.path.join(winreg.QueryValueEx(app, 'InstallLocation')[0], 'tmxrasterizer.exe')
                        if os.path.exists(exe): return exe
                except OSError: continue
    return None

rasterizer = find_rasterizer()
if rasterizer:
    small = os.path.join(tempfile.mkdtemp(), 'overview-full.png')   # outside assets/, so the dev server does not reload
    subprocess.run([rasterizer, '--scale', str(OVERVIEW[0] / (COLS * TILE)),
                    '--hide-layer', 'Gameplay markers - show to edit', SOURCE, small], check=True)
    Image.open(small).convert('RGB').resize(OVERVIEW, Image.LANCZOS).save(os.path.join(GAME_DIR, 'overview.webp'), quality=85)
    os.remove(small)
else:
    report['minimap'] = 'NOT redrawn: Tiled\'s tmxrasterizer was not found (put it on the PATH or set TMXRASTERIZER)'
for what, said in report.items(): print(f'{what}: {said}')
