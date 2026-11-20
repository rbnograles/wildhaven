"""Brings the world map drawn in Tiled into the game: writes assets/world/map/ from a Tiled map.

The game draws and collides with assets/world/map/wildhaven.json. build-map.py makes that file from the
generated world; this script makes it from a map edited by hand in Tiled instead, so the game looks exactly like
the Tiled map. Think of it as a translator: Tiled keeps each picture as a box with a size, while the game wants
each thing as a point (where it touches the ground) with a name.
Inputs : assets/world/tiled/wildhaven-world-arranged.tmj (or the map named on the command line)
         assets/world/tiled/terrain-redrawn.json, .png      the ground kit: which tile shows which corners
         assets/world/tiled/path-connectors.png              the path kit
         assets/world/tiled/snow-banks.png                   the snowy bank tiles, when the map uses them
         assets/world/tiled/wildhaven-sheet.json, .png       where each object sprite sits on the sprite sheet
         assets/world/map/wildhaven.json, tileset.png        the game's current map: its hills, regions and
                                                             other stored values, and its own bank and cliff tiles
Outputs: assets/world/map/ground-kit.png, path-kit.png   copies of the two kits, tilesets of the game map
         assets/world/map/snow-banks.png                 a copy of the snowy bank tiles, likewise
         assets/world/map/wildhaven.json the nine ground layers in the game's own coding, hidden, which collision
                                         and the world editor read (water, deep, sand, snow...); then the Tiled
                                         map's tile layers, drawn as they are; every object as a point with its
                                         `scale` and turn, and a cave's `holds` and `mineral`. tileset.png is not
                                         changed
         assets/world/map/overview.webp  the minimap and world map picture, drawn by Tiled's tmxrasterizer
         source/objects/<kind>/<name>.png and objects.json entries for sprites on the map the game did not have
                                         yet (ore rocks and caves), cut from the sprite sheet
The game map's first tileset must be the game's own: true of build-map.py's map and of this script's own.
The hills (the elevation grid), the regions and every other stored value are kept from the game's map, so draw
hills and regions with the world editor, not in Tiled. Running build-map.py (or the world editor's Rebuild) puts
the generated map back; run this script again afterwards.
Run: python tools/import-tiled-world.py [map.tmj]
     (Tiled's tmxrasterizer draws the minimap: on the PATH, named in TMXRASTERIZER, or found through Tiled's installer)
"""
import json, math, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(TOOLS, '..', 'assets', 'world')
TILED, GAME_DIR, SRC = os.path.join(ROOT, 'tiled'), os.path.join(ROOT, 'map'), os.path.join(ROOT, 'source')
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(TILED, 'wildhaven-world-arranged.tmj')
TILE = 64                      # the tiles' size in pixels and world units
KIT = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']   # Tiled's ground layers, bottom first
GAME = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']  # the game's, by rank
OVERVIEW = (1568, 1120)        # the minimap picture's size: the map's own 7:5 shape
KEPT_PROPERTIES = {'holds', 'mineral'}   # Tiled object properties the game map keeps (a cave's labels)
# Sprites the game gets from the sprite sheet the first time a map uses them: the kind folder they go in, the
# solid base [halfWidth, depth], and the picture their prompt comes from.
NEW_SPRITES = {
    'iron-ore': ('rocks', [62, 40], os.path.join('..', '..', 'items', 'ores', 'iron-copper.png')),
    'copper-ore': ('rocks', [62, 40], os.path.join('..', '..', 'items', 'ores', 'iron-copper.png')),
    'cave-forest': ('buildings', [100, 60], os.path.join('landmarks', 'cave-entrances.png')),
    'cave-snow': ('buildings', [100, 60], os.path.join('landmarks', 'cave-entrances.png')),
    'cave-canyon': ('buildings', [100, 60], os.path.join('landmarks', 'cave-entrances.png')),
}

tiled = json.load(open(SOURCE))
game = json.load(open(os.path.join(GAME_DIR, 'wildhaven.json')))
props = {p['name']: p['value'] for p in game['properties']}
COLS, ROWS = tiled['width'], tiled['height']
assert (COLS, ROWS) == (game['width'], game['height']), 'the Tiled map must be the same size as the game map'
sheet_spots = json.load(open(os.path.join(TILED, 'wildhaven-sheet.json')))['objects']
names = list(sheet_spots)
kit = json.load(open(os.path.join(TILED, 'terrain-redrawn.json')))['materials']
first = {os.path.basename(t.get('source') or t.get('name')): t['firstgid'] for t in tiled['tilesets']}
KIT_FIRST, PATH_FIRST, GAME_FIRST = first['terrain-redrawn.tsx'], first['path-connectors.tsx'], first['game-banks-and-cliffs']
OBJECT_FIRST = first['wildhaven-objects.tsx']
report = {}

# ---- the tilesets: the game's own tiles, then the ground kit, then the path kit ------------------------
# The game's tileset.png is left as build-map.py made it (the Tiled map draws its banks and cliffs from it too).
# The two kits are copied next to it as tilesets of their own, numbered after the game's tiles.
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
# A map with snowy banks (tools/build-snow-banks.py) brings their tileset along too, numbered after the path kit.
snow_set = next((t for t in tiled['tilesets'] if t.get('name') == 'snow-banks'), None)
SNOW_FIRST, FIRST_SNOW_TILE = (snow_set['firstgid'], FIRST_PATH_TILE + 64) if snow_set else (0, 0)
if snow_set:
    shutil.copyfile(os.path.join(os.path.dirname(os.path.abspath(SOURCE)), snow_set['image']), os.path.join(GAME_DIR, 'snow-banks.png'))
    TILESETS.append(dict(snow_set, firstgid=FIRST_SNOW_TILE, image='snow-banks.png'))
    report['tiles'] += f" + {snow_set['tilecount']} snowy banks"

# Gives a Tiled tile number its number in the game's tileset. The top three bits (flips) are kept.
dropped = [0]
def remap(gid):
    flips, t = gid & 0xE0000000, gid & 0x1FFFFFFF
    if not t: return 0
    if KIT_FIRST <= t < KIT_FIRST + 144: return flips | (FIRST_KIT + t - KIT_FIRST)
    if PATH_FIRST <= t < PATH_FIRST + 64: return flips | (FIRST_PATH_TILE + t - PATH_FIRST)
    if GAME_FIRST <= t < GAME_FIRST + base_count: return flips | (1 + t - GAME_FIRST)
    if snow_set and SNOW_FIRST <= t < SNOW_FIRST + snow_set['tilecount']: return flips | (FIRST_SNOW_TILE + t - SNOW_FIRST)
    dropped[0] += 1; return 0

drawn = [dict(l, data=[remap(g) for g in l['data']]) for l in tiled['layers'] if l['type'] == 'tilelayer']
report['tiles Tiled used that the game cannot draw (left out)'] = dropped[0]
layers = []

# ---- the ground for collision: the nine layers in the game's own coding ----------------------------------
# Which ground shows on every tile corner, read from Tiled's ground layers (topmost wins), then written back as
# the game's layers: a game layer covers the corners of its own ground and of every ground ranked above it, and
# its tile number says which corners (top-left 1, top-right 2, bottom-left 4, bottom-right 8). world/map.js reads
# the water, deep, sand and snow layers from these. They are hidden: the game draws the Tiled layers instead.
mask_of = {KIT_FIRST + tile: (i, int(m)) for i, g in enumerate(KIT) for m, tile in kit[g].items()}
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)
tiled_layers = {l['name']: l for l in tiled['layers']}
for i, g in enumerate(KIT):
    for at, gid in enumerate(tiled_layers[f'{i + 1:02d} {g}']['data']):
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
    layers.append({'id': len(layers) + 1, 'name': 'ground' if r == 0 else g, 'type': 'tilelayer',   # grass is 'ground' 'x': 0, 'y': 0, 'width': COLS,
                   'height': ROWS, 'opacity': 1, 'visible': False, 'data': [int(v) for v in data]})
for l in drawn: layers.append(dict(l, id=len(layers) + 1))   # drawn over the hidden ones, bottom to top
assert 1 + 16 + (WATER - 1) * 240 == props['firstWaterGid'] and 1 + 16 + (DEEP - 1) * 240 == props['firstDeepGid']

# ---- sprites the game does not have yet ----------------------------------------------------------------
# Says what sprite a Tiled object shows: its Class, or its tile in the objects tileset.
def sprite_of(o):
    if o.get('type'): return o['type']
    n = (o.get('gid', 0) & 0x1FFFFFFF) - OBJECT_FIRST
    return names[n] if 0 <= n < len(names) else ''

objects_path = os.path.join(SRC, 'objects.json')
specs = json.load(open(objects_path))
used = {sprite_of(o) for l in tiled['layers'] if l['type'] == 'objectgroup' and l['name'] != 'places' for o in l['objects']}
added = []
for name in sorted(used):
    if name in specs or name not in NEW_SPRITES: continue
    kind, footprint, source = NEW_SPRITES[name]
    s = sheet_spots[name]
    piece = Image.open(os.path.join(TILED, 'wildhaven-sheet.png')).crop((s['x'], s['y'], s['x'] + s['width'], s['y'] + s['height']))
    png = os.path.join(SRC, 'objects', kind, f'{name}.png'); os.makedirs(os.path.dirname(png), exist_ok=True)
    piece.save(png)
    prompt = open(os.path.join(SRC, source[:-4] + '.prompt.txt'), encoding='utf-8').read()
    note = f'Cut from assets/world/tiled/wildhaven-sheet.png (made from {source.replace(os.sep, "/")}) by tools/import-tiled-world.py.'
    open(png[:-4] + '.prompt.txt', 'w', encoding='utf-8', newline='\n').write(note + '\n' + prompt)
    specs[name] = {'kind': kind, 'origin': s['origin'], 'footprint': footprint}; added.append(name)
if added:
    # objects.json keeps one sprite per line, so the new ones are written the same way, before the last brace.
    text = open(objects_path, encoding='utf-8').read().rstrip()
    lines = [f'  "{n}": ' + json.dumps(specs[n], separators=(', ', ': ')).replace('{', '{ ').replace('}', ' }') for n in added]
    text = text[:-1].rstrip() + ',\n' + ',\n'.join(lines) + '\n}\n'
    open(objects_path, 'w', encoding='utf-8', newline='\n').write(text)
report['sprites added to the game'] = added

# ---- objects: from pictures with a size to points with a scale --------------------------------------
# Tiled pins a picture by the middle of its bottom edge and turns it round that point. The game pins it at its
# `origin` (where it meets the ground) and turns it round that. So each object's ground point is worked out
# from its box, allowing for the turn, and its size becomes a `scale`: how many times the game's usual size.
png_size = {}
def usual_width(name):
    if name not in png_size:
        png_size[name] = Image.open(os.path.join(SRC, 'objects', specs[name]['kind'], f'{name}.png')).width * specs[name].get('scale', 1)
    return png_size[name]

# Two things on a map drawn by hand would break the game, so they are left out of it and listed: something
# standing in the water (a coast painted over it), and something solid on a flight of stairs or on the two
# squares above or below one (it would shut a hill off). Ripples, waves and bridges belong on water.
ON_WATER = {'sea-wave', 'river-ripple', 'lake-ripple', 'bridge'}
stairs_near = set()
for at, letter in enumerate(props['elevation']):
    if letter == 's':
        ty, tx = divmod(at, COLS)
        stairs_near.update((tx, ty + dy) for dy in range(-2, 3))
wet_corner = rank >= WATER

# Says why an object can't go into the game, or '' when it can.
def misplaced(name, x, y, scale):
    tx, ty = int(round(x / TILE)), int(round((y - 6) / TILE))
    if name not in ON_WATER and 0 <= ty <= ROWS and 0 <= tx <= COLS and wet_corner[ty, tx]: return 'in the water'
    base = specs[name].get('footprint')
    if not base: return ''
    s = specs[name].get('scale', 1) * scale
    left, top, right = x - base[0] * s - 10, y - base[1] * s - 10, x + base[0] * s + 10
    if any((cx, cy) in stairs_near for cx in range(int(left // TILE), int(right // TILE) + 1)
           for cy in range(int(top // TILE), int((y + 10) // TILE) + 1)):
        return 'on or beside stairs'
    return ''

points, skipped, left_out = [], {}, []
source_of = {}   # id(point) -> (its Tiled layer's name, its Tiled object), so the minimap can draw the same things
for l in tiled['layers']:
    if l['type'] != 'objectgroup' or l['name'] == 'places': continue
    for o in l['objects']:
        name = sprite_of(o)
        if name not in specs: skipped[name] = skipped.get(name, 0) + 1; continue
        ox, oy = specs[name]['origin']; w, h = o['width'], o['height']
        turn = math.radians(o.get('rotation', 0))
        dx, dy = (ox - 0.5) * w, (oy - 1) * h
        x = o['x'] + dx * math.cos(turn) - dy * math.sin(turn)
        y = o['y'] + dx * math.sin(turn) + dy * math.cos(turn)
        point = {'id': len(points) + 1, 'name': name, 'type': name, 'x': round(x), 'y': round(y), 'width': 0, 'height': 0,
                 'rotation': o.get('rotation', 0), 'point': True, 'visible': True}
        scale = w / usual_width(name)
        why = misplaced(name, x, y, scale)
        if why: left_out.append(f'{name} at {round(x)},{round(y)}: {why}'); continue
        props_out = [{'name': 'scale', 'type': 'float', 'value': round(scale, 3)}] if abs(scale - 1) > 0.02 else []
        # A cave's labels go along: the game reads `holds` to pick its wolf dens.
        props_out += [{'name': q['name'], 'type': 'string', 'value': q['value']} for q in o.get('properties', [])
                      if q.get('name') in KEPT_PROPERTIES]
        if props_out: point['properties'] = props_out
        points.append(point); source_of[id(point)] = (l['name'], o)
# The world editor's hand edits (source/edits.json, Objects mode) are laid over the Tiled objects, as build-map.py
# lays them over the generated ones: each `removed` entry takes out one object of that name at that spot, and each
# `added` entry puts one in. Moving an object in the editor is a removal plus an addition, so an added object takes
# the size of a removed one of the same name nearby (within MOVED_NEAR units), or else its usual size.
MOVED_NEAR = 600
edits = json.load(open(os.path.join(SRC, 'edits.json')))
taken, stale = [], []
for r in edits.get('removed', []):
    hit = next((p for p in points if p['name'] == r['name'] and p['x'] == round(r['x']) and p['y'] == round(r['y'])), None)
    if hit: points.remove(hit); taken.append(hit)
    else: stale.append(f"{r['name']} at {r['x']},{r['y']}")
for a in edits.get('added', []):
    if a['name'] not in specs: skipped[a['name']] = skipped.get(a['name'], 0) + 1; continue
    near = [t for t in taken if t['name'] == a['name'] and math.hypot(t['x'] - a['x'], t['y'] - a['y']) < MOVED_NEAR]
    was = min(near, key=lambda t: math.hypot(t['x'] - a['x'], t['y'] - a['y'])) if near else None
    if was: taken.remove(was)
    point = {'name': a['name'], 'type': a['name'], 'x': round(a['x']), 'y': round(a['y']), 'width': 0, 'height': 0,
             'rotation': a.get('rotation', 0), 'point': True, 'visible': True}
    if was and 'properties' in was: point['properties'] = was['properties']
    points.append(point)
for i, p in enumerate(points): p['id'] = i + 1
report['editor edits'] = f"{len(edits.get('removed', []))} removed, {len(edits.get('added', []))} added"
if stale: report['editor removals that match nothing on the Tiled map'] = stale

# A path square whose middle lies inside something solid (a house put down over a path) can't be walked, so it is
# taken off the path layer and listed, and the path ends at the house instead.
paths = next((l for l in layers if l['name'] == 'paths'), None)
under, cleared = [], []   # cleared: the squares' places in the layer, so the minimap leaves them out too
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
                    paths['data'][ty * COLS + tx] = 0; cleared.append(ty * COLS + tx); under.append(f"under {p['name']} at {p['x']},{p['y']}")
if under: report['path squares taken off (something solid stands on them)'] = sorted(set(under))

layers.append({'id': len(layers) + 1, 'name': 'objects', 'type': 'objectgroup', 'x': 0, 'y': 0, 'opacity': 1,
               'visible': True, 'draworder': 'topdown', 'objects': points})
report['objects'] = len(points)
if skipped: report['objects the game has no sprite for (left out)'] = skipped
if left_out: report['objects left out (move them in Tiled)'] = '\n  ' + '\n  '.join(left_out)

# ---- save --------------------------------------------------------------------------------------------
# The stored values are kept as they were, with one added: which map this one came from.
stored = [p for p in game['properties'] if p['name'] != 'importedFrom']
stored += [{'name': 'importedFrom', 'type': 'string', 'value': os.path.basename(SOURCE)}]
out = {k: game[k] for k in ('type', 'version', 'tiledversion', 'orientation', 'renderorder', 'infinite', 'width',
                            'height', 'tilewidth', 'tileheight')}
out.update(nextlayerid=len(layers) + 1, nextobjectid=len(points) + 1, layers=layers, properties=stored, tilesets=TILESETS)
json.dump(out, open(os.path.join(GAME_DIR, 'wildhaven.json'), 'w'), separators=(',', ':'))

# The minimap picture: Tiled's own renderer draws the map small, places left out. Without it (not on the PATH and
# not named in TMXRASTERIZER) the picture build-map.py drew is kept, which shows the generated world instead.
# Finds Tiled's tmxrasterizer: named in TMXRASTERIZER, on the PATH, or (on Windows) in the folder Tiled's
# installer recorded. Returns its path, or None.
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

# Turns one of the game's points back into the box Tiled draws: the object loop's sum, done backwards.
def tiled_box(p, number):
    name = p['name']; s = sheet_spots[name]; ox, oy = specs[name]['origin']
    scale = next((q['value'] for q in p.get('properties', []) if q['name'] == 'scale'), 1)
    w = usual_width(name) * scale; h = w * s['height'] / s['width']
    turn = math.radians(p.get('rotation', 0)); dx, dy = (ox - 0.5) * w, (oy - 1) * h
    return {'gid': OBJECT_FIRST + names.index(name), 'id': number, 'name': '', 'type': name, 'opacity': 1, 'visible': True,
            'rotation': p.get('rotation', 0), 'width': w, 'height': h,
            'x': p['x'] - (dx * math.cos(turn) - dy * math.sin(turn)), 'y': p['y'] - (dx * math.sin(turn) + dy * math.cos(turn))}

# Makes the map the minimap is drawn from: the Tiled map with exactly the objects the game ended up with. The
# Tiled file alone would be wrong, because the game leaves some of its objects out (in water, by stairs, no
# sprite) and the world editor's hand edits remove, add and move others: the minimap showed a moved cave on its
# old spot. Objects that came from Tiled are kept as they are; the ones the editor added are turned into boxes.
def overview_map():
    kept = {id(source_of[id(p)][1]) for p in points if id(p) in source_of}
    extra = {'flat': [], 'objects': []}
    number = tiled.get('nextobjectid', 1)
    for p in points:
        if id(p) in source_of or p['name'] not in sheet_spots: continue
        spec = specs[p['name']]
        extra['flat' if spec.get('flat') or spec.get('path') else 'objects'].append(tiled_box(p, number)); number += 1
    view = []
    for l in tiled['layers']:
        if l['type'] == 'objectgroup' and l['name'] != 'places':
            l = dict(l, objects=[o for o in l['objects'] if id(o) in kept] + extra.pop(l['name'], []))
        elif l['name'] == 'paths' and cleared:
            data = list(l['data'])
            for at in cleared: data[at] = 0
            l = dict(l, data=data)
        view.append(l)
    leftover = [o for objects in extra.values() for o in objects]   # a map without a 'flat' or 'objects' layer
    if leftover:
        last = max(i for i, l in enumerate(view) if l['type'] == 'objectgroup' and l['name'] != 'places')
        view[last] = dict(view[last], objects=view[last]['objects'] + leftover)
    return dict(tiled, layers=view)

rasterizer = find_rasterizer()
if rasterizer:
    small = os.path.join(tempfile.mkdtemp(), 'overview-full.png')   # outside assets/, so the dev server does not reload the page
    # The map to draw is saved next to the Tiled map (its tilesets are named from that folder) and removed after.
    shown = os.path.join(os.path.dirname(os.path.abspath(SOURCE)), 'overview-temp-' + os.path.basename(SOURCE))
    json.dump(overview_map(), open(shown, 'w'), separators=(',', ':'))
    try:
        subprocess.run([rasterizer, '--scale', str(OVERVIEW[0] / (COLS * TILE)), '--hide-layer', 'places', shown, small], check=True)
    finally:
        os.remove(shown)
    Image.open(small).convert('RGB').resize(OVERVIEW, Image.LANCZOS).save(os.path.join(GAME_DIR, 'overview.webp'), quality=85)
    os.remove(small)
else:
    report['minimap'] = 'NOT redrawn: Tiled\'s tmxrasterizer was not found (put it on the PATH or set TMXRASTERIZER)'
for what, said in report.items(): print(f'{what}: {said}')
