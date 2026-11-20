"""Rebuilds the game's whole world as a Tiled map made from the Tiled kits, not from the game's own tiles.

The game's map (assets/world/map/wildhaven.json) is painted with thousands of machine-made blend tiles that
nobody can paint with by hand. This script reads only WHAT is where in that map (which ground is on each tile
corner, where the footpaths run, where each object stands) and lays the world out again with the hand-usable
kits in assets/world/tiled/, so every layer can be edited in Tiled with the Terrain Brush afterwards.
Inputs : assets/world/map/wildhaven.json           the game's map: where every ground, hill, path and object is
         assets/world/tiled/terrain-<KIT>.json     the ground kit: which tile shows which mix of corners
         assets/world/tiled/path-connectors.json   the path kit: which tile joins which sides (N, E, S, W)
         assets/world/tiled/wildhaven-sheet.json   where each object sprite sits on the one sprite sheet
         assets/world/source/places.json           spawns, supplies, landmarks, signposts and old boats
         assets/world/source/objects.json          which sprites are flat (drawn under the player)
Outputs: assets/world/tiled/wildhaven-world.tmj    the whole world for Tiled, bottom layer first:
           01 deep .. 09 soil   one layer per ground, from terrain-<KIT>.tsx, in the kit's own stacking order
           banks, cliffs        the painted water's edge and the hills; no kit has these, so they still use
                                the game's tiles (../map/tileset.png). banks starts hidden: it was drawn for
                                the game's shoreline, which is a little different from the kit's
           paths                the footpaths as connecting tiles from path-connectors.tsx, straightened
                                into long runs (the game's own paths wind at any angle)
           flat, objects        every object as a picture from wildhaven-objects.tsx
                                Three things here are NOT in the game's map and exist only in this file:
                                some plain rocks are swapped for copper and iron ore rocks (ORE_SHARE), a cave
                                mouth stands at the foot of some hill walls, and half of the pebbles, sticks
                                and wild berries are left out (KEEP)
           places               named points: spawns, supplies, landmarks, signposts, old boats, launch spots
                                (starts hidden: Tiled labels every named point, which crowds the map)
The game does NOT read this file, and build-map.py does not either: changes made to it in Tiled stay in Tiled.
Re-running overwrites the file, so save a map you are editing under another name.
Run: python tools/build-tiled-sheet.py, then python tools/export-tiled-world.py [output.tmj]
"""
import json, math, os, random, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world')
OUT = os.path.join(ROOT, 'tiled')
KIT = 'redrawn'                # which ground kit to use: 'redrawn' (the newly painted one) or 'current'
GAME_ORDER = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']   # the game's layers, bottom first
KIT_ORDER = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']    # the kit's layers, bottom first
PATH_KIND = {'path-dirt': 'dirt', 'path-stone': 'cobblestone'}   # the game's path pieces -> the kit's materials
ROUTE_GAP = 130                # two path pieces farther apart than this belong to different routes
NORTH, EAST, SOUTH, WEST = 1, 2, 4, 8   # the path kit's numbers for the sides a tile joins
PATH_BEND = 1.5                # a route may be moved this many squares off its true line to make it straighter
PATH_RUN = 6                   # a slanted stretch is cut into steps with runs about this many squares long
END_REACH = 5                  # a route's loose end is joined to another path this many squares away or nearer
# Tiled-only changes to what lies about the world. None of this is in the game.
PLAIN_ROCKS = ['rocks-a', 'rocks-b', 'boulder']   # the rocks that may be swapped for an ore rock
ORE_SHARE = {                  # the share of a region's plain rocks that become each ore: copper near the three
    'copper-ore': {'pinefall': 0.15, 'meadows': 0.15, 'lagoon': 0.15, 'canyons': 0.08},   # starts, iron farther out
    'iron-ore': {'canyons': 0.2, 'frostpeak': 0.3},
}
KEEP = {'pebbles': 0.5, 'sticks': 0.5, 'wild-berries': 0.5}   # the share kept of each thing picked up by hand
START_KEEP = 1500              # ...except near a start spot, where all are kept: a new player needs 5 stone close by
CAVE_KIND = {'frostpeak': 'cave-snow', 'canyons': 'cave-canyon', 'desert': 'cave-canyon'}   # every other region: cave-forest
CAVE_APART = 2500              # two caves are never nearer than this, in world units
CAVE_CLEAR = 170               # scenery this near a cave mouth is taken away

world = json.load(open(os.path.join(ROOT, 'map', 'wildhaven.json')))
ground_kit = json.load(open(os.path.join(OUT, f'terrain-{KIT}.json')))['materials']
path_kit = json.load(open(os.path.join(OUT, 'path-connectors.json')))
sheet = json.load(open(os.path.join(OUT, 'wildhaven-sheet.json')))['objects']
places = json.load(open(os.path.join(ROOT, 'source', 'places.json')))
spec = json.load(open(os.path.join(ROOT, 'source', 'objects.json')))
COLS, ROWS, TILE = world['width'], world['height'], world['tilewidth']
game_layers = {l['name']: l for l in world['layers']}
game_tiles = world['tilesets'][0]

# The four tilesets, one after another. Each one's first number is where the one before it ends.
FIRST_GROUND, FIRST_PATH = 1, 1 + 144
FIRST_GAME = FIRST_PATH + 64
FIRST_OBJECT = FIRST_GAME + game_tiles['tilecount']

# ---- ground: which material is on every tile corner ----------------------------------------------
# In the game's map each ground layer's tile number says which of the tile's four corners (top-left 1,
# top-right 2, bottom-left 4, bottom-right 8) hold that ground, with 16 look-alike tiles per mix. A higher layer
# wins, so going through the layers bottom to top leaves each corner with the ground you really see there.
firsts = {name: 1 + 16 + i * 240 for i, name in enumerate(GAME_ORDER[1:])}   # 16 grass tiles, then 15 mixes x 16 per ground
corner = np.zeros((ROWS + 1, COLS + 1), dtype=int)                          # 0 = grass, as numbered in GAME_ORDER
for rank, name in enumerate(GAME_ORDER[1:], start=1):
    gids = np.array(game_layers[name]['data']).reshape(ROWS, COLS)
    mask = np.where(gids > 0, (gids - firsts[name]) // 16 + 1, 0)
    for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
        part = corner[dy:dy + ROWS, dx:dx + COLS]
        part[(mask & bit) > 0] = rank

# Paints one kit layer. A layer covers the corners of its own ground and of every ground stacked above it, so
# the lower ground runs on underneath an edge and no gap shows through (the same rule the game uses).
# Returns the layer's tile numbers, row by row; 0 is an empty square.
def ground_layer(name):
    level = np.array([KIT_ORDER.index(g) for g in GAME_ORDER])[corner]   # each corner's place in the kit's stack
    here = (level >= KIT_ORDER.index(name)).astype(int)
    mask = here[:-1, :-1] + 2 * here[:-1, 1:] + 4 * here[1:, :-1] + 8 * here[1:, 1:]
    tile = np.array([ground_kit[name][str(m)] for m in range(16)])[mask] + FIRST_GROUND
    return np.where(mask > 0, tile, 0).flatten().tolist()

# ---- paths: from loose turned pieces to connecting grid tiles -------------------------------------
# The game lays a path as short pieces at any angle. The kit has square tiles that join north, east, south or
# west only, so a slanted route copied square by square comes out as a zigzag. Instead each route is first
# boiled down to its few real turning points, and those are joined by long straight runs: a slanted stretch
# becomes a few big steps, like a staircase with wide treads, never a saw edge.
props = {p['name']: p['value'] for p in world['properties']}
height = props['elevation']                      # one letter per tile: 0-3 level, w wall, s stairs
cliff_tiles = game_layers['cliffs']['data']
wet = corner >= GAME_ORDER.index('water')        # corners that are shallow or deep water
joins, kind_at, owner = {}, {}, {}

# Says whether a path may not be moved onto a square: water, a hill, a wall or stairs.
def blocked(t):
    x, y = t
    return bool(wet[y:y + 2, x:x + 2].any()) or cliff_tiles[y * COLS + x] != 0 or height[y * COLS + x] != '0'

# Joins two next-door squares, so each gets an opening facing the other.
def join(a, b):
    (ax, ay), (bx, by) = a, b
    side = EAST if bx > ax else WEST if bx < ax else SOUTH if by > ay else NORTH
    back = {EAST: WEST, WEST: EAST, SOUTH: NORTH, NORTH: SOUTH}[side]
    joins[a] = joins.get(a, 0) | side; joins[b] = joins.get(b, 0) | back

# Lists the squares from one square to another in single sideways or up-down steps, close to the straight line.
def fine(a, b):
    out, (x, y) = [a], a
    while (x, y) != b:
        dx, dy = b[0] - x, b[1] - y
        x, y = (x + (dx > 0) - (dx < 0), y) if abs(dx) >= abs(dy) else (x, y + (dy > 0) - (dy < 0))
        out.append((x, y))
    return out

# Lists the squares of an L from one square to another: all the way sideways and then up or down (`sideways`
# first), or the other way round.
def ell(a, b, sideways):
    bend = (b[0], a[1]) if sideways else (a[0], b[1])
    return fine(a, bend) + fine(bend, b)[1:]

# Picks the turning points of a route: the fewest squares such that the straight lines between them stay
# within PATH_BEND squares of every square of the route (the Douglas-Peucker way of simplifying a line).
# Returns their positions in the list.
def turning_points(squares):
    keep, stack = {0, len(squares) - 1}, [(0, len(squares) - 1)]
    while stack:
        i, j = stack.pop()
        (ax, ay), (bx, by) = squares[i], squares[j]
        far, worst = None, PATH_BEND
        for k in range(i + 1, j):
            px, py = squares[k]; length = math.hypot(bx - ax, by - ay)
            off = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length if length else math.hypot(px - ax, py - ay)
            if off > worst: far, worst = k, off
        if far is not None: keep.add(far); stack += [(i, far), (far, j)]
    return sorted(keep)

# Lays a path between two turning points. A level or upright stretch is one straight run. A slanted one is
# cut into steps of about PATH_RUN squares; each step is an L, and the Ls turn the opposite way in turn so two
# next to each other share a run. An L that would cross water or a hill gives way to the other L, and if both
# are blocked that step follows the route closely, as the game's own path does.
def lay(a, b, kind, route_no, true_squares):
    dx, dy = b[0] - a[0], b[1] - a[1]
    steps = max(1, round(min(abs(dx), abs(dy)) / PATH_RUN))
    stops = [(a[0] + round(dx * i / steps), a[1] + round(dy * i / steps)) for i in range(steps + 1)]
    for i, (p, q) in enumerate(zip(stops, stops[1:])):
        sideways = (abs(dx) >= abs(dy)) == (i % 2 == 0)
        tries = [ell(p, q, sideways), ell(p, q, not sideways)]
        good = [t for t in tries if all(sq in true_squares or not blocked(sq) for sq in t)]
        squares = good[0] if good else fine(p, q)
        for sq in squares: kind_at.setdefault(sq, kind); owner.setdefault(sq, route_no)
        for u, v in zip(squares, squares[1:]): join(u, v)

pieces = [o for o in game_layers['objects']['objects'] if o['name'].startswith('path-')]
routes, last = [], None
for p in pieces:
    if last is None or math.hypot(p['x'] - last['x'], p['y'] - last['y']) > ROUTE_GAP: routes.append([])
    routes[-1].append(p); last = p
ends = []
for route_no, route in enumerate(routes):
    squares = [(int(p['x'] // TILE), int(p['y'] // TILE)) for p in route]
    true_squares = {sq for a, b in zip(squares, squares[1:]) for sq in fine(a, b)} | set(squares)
    turns = turning_points(squares)
    kind_at.setdefault(squares[0], PATH_KIND[route[0]['name'][:-2]]); owner.setdefault(squares[0], route_no)
    for i, j in zip(turns, turns[1:]): lay(squares[i], squares[j], PATH_KIND[route[j]['name'][:-2]], route_no, true_squares)
    ends += [(squares[0], route_no), (squares[-1], route_no)]

# A route that branches off another one starts or ends on it or right beside it. Straightening can leave such
# an end a few squares short of its trunk, so a loose end is joined to the nearest square of another route.
for end, route_no in ends:
    if bin(joins.get(end, 0)).count('1') > 1 or owner.get(end) != route_no: continue
    near = [(abs(x - end[0]) + abs(y - end[1]), (x, y)) for (x, y), who in owner.items()
            if who != route_no and 0 < abs(x - end[0]) + abs(y - end[1]) <= END_REACH]
    if not near: continue
    target = min(near)[1]
    tries = [t for t in (ell(end, target, True), ell(end, target, False)) if not any(blocked(sq) for sq in t)]
    squares = tries[0] if tries else fine(end, target)
    for sq in squares: kind_at.setdefault(sq, kind_at[end]); owner.setdefault(sq, route_no)
    for u, v in zip(squares, squares[1:]): join(u, v)

path_data = [0] * (COLS * ROWS)
for (x, y), kind in kind_at.items():
    path_data[y * COLS + x] = FIRST_PATH + path_kit[kind][str(joins.get((x, y), 0))]

# ---- objects and places ---------------------------------------------------------------------------
tile_id = {name: i for i, name in enumerate(sheet)}   # the objects tileset numbers its tiles in this same order
next_id = [1]

# Hands out the next free object number; Tiled wants every object to have its own.
def new_id(): next_id[0] += 1; return next_id[0] - 1

# Turns one of the game's object points into a picture object for Tiled.
# The game pins a sprite by its `origin` (the spot that touches the ground); Tiled pins it by the middle of its
# bottom edge. So the pin is moved from one to the other. The sprite's name goes in `type` only: Tiled draws a
# label over every object that has a `name`, and nine thousand labels hide the map.
def picture(obj):
    s = sheet[obj['name']]; w, h = s['width'], s['height']; ox, oy = s['origin']
    return {'id': new_id(), 'name': '', 'type': obj['name'], 'gid': FIRST_OBJECT + tile_id[obj['name']],
            'x': round(obj['x'] + (0.5 - ox) * w, 2), 'y': round(obj['y'] + (1 - oy) * h, 2),
            'width': w, 'height': h, 'rotation': 0, 'visible': True}

# Makes a dot on the map for a place. Its name is kept in a custom property called `place`, not in `name`:
# Tiled draws a label over every object that has a `name`, and the labels crowd the map when zoomed out.
def point(name, kind, x, y):
    return {'id': new_id(), 'name': '', 'type': kind, 'x': x, 'y': y, 'width': 0, 'height': 0, 'rotation': 0,
            'point': True, 'visible': True, 'properties': [{'name': 'place', 'type': 'string', 'value': name}]}

# Says which region a spot is in, by the map's region grid (one digit per 256-unit square).
def region_at(x, y):
    cell = props['regionCell']
    return places['regions'][int(props['regionGrid'][int(y // cell) * props['regionCols'] + int(x // cell)])]['id']

# Gives a number from 0 to 1 that is always the same for the same object, like a dice roll written down.
# Using the object's own name and spot (not one shared dice) means changing one rule never reshuffles another.
def roll(obj, what): return random.Random(f"{what}:{obj['name']}:{obj['x']}:{obj['y']}").random()

# Caves: a cave mouth stands at the foot of a hill's south wall, where the wall is at least three squares wide
# and has no stairs close by. They are taken top to bottom, west to east, skipping any too near one already taken.
caves = []
for ty in range(1, ROWS - 1):
    for tx in range(3, COLS - 3):
        wall = all(height[ty * COLS + x] == 'w' and height[(ty + 1) * COLS + x] == '0' for x in (tx - 1, tx, tx + 1))
        stairs = any(height[y * COLS + x] == 's' for y in (ty - 1, ty, ty + 1) for x in range(tx - 3, tx + 4))
        x, y = tx * TILE + TILE // 2, (ty + 1) * TILE + 24
        if wall and not stairs and all(math.hypot(x - c['x'], y - c['y']) >= CAVE_APART for c in caves):
            caves.append({'name': CAVE_KIND.get(region_at(x, y), 'cave-forest'), 'x': x, 'y': y})

# Scenery that may be taken away where a straightened path or a cave now is. Buildings, signposts, bridges and
# stairs always stay.
LOOSE = {n for n, e in spec.items() if not n.startswith('_') and e['kind'] in ('trees', 'plants', 'rocks')} | {
    'sticks', 'feather', 'pine-cone', 'antler', 'driftwood', 'log'}
piles, counts = {'flat': [], 'objects': []}, {}
for obj in game_layers['objects']['objects']:
    name = obj['name']
    if name.startswith('path-'): continue   # the paths are tiles now
    if name in LOOSE:
        if (int(obj['x'] // TILE), int(obj['y'] // TILE)) in kind_at: continue
        if any(math.hypot(obj['x'] - c['x'], obj['y'] - c['y']) < CAVE_CLEAR for c in caves): continue
    near_start = any(math.hypot(obj['x'] - sx, obj['y'] - sy) < START_KEEP for sx, sy in places['spawns'].values())
    if name in KEEP and not near_start and roll(obj, 'keep') >= KEEP[name]: continue
    if name in PLAIN_ROCKS:
        region, chance, edge = region_at(obj['x'], obj['y']), roll(obj, 'ore'), 0
        for ore, shares in ORE_SHARE.items():
            edge += shares.get(region, 0)
            if chance < edge: obj = dict(obj, name=ore); break
    counts[obj['name']] = counts.get(obj['name'], 0) + 1
    piles['flat' if spec.get(obj['name'], {}).get('flat') else 'objects'].append(picture(obj))
piles['objects'] += [picture(c) for c in caves]

dots = [point(f'spawn: {who}', 'spawn', x, y) for who, (x, y) in places['spawns'].items()]
dots += [point(f'supply: {name}', 'supply', x, y) for name, (x, y) in places['supplies'].items()]
dots += [point(p['name'], 'landmark', p['x'], p['y']) for p in places['landmarks']]
dots += [point(p['name'], 'signpost', p['x'], p['y']) for p in places['waypoints']]
for p in places['wrecks']:
    dots += [point(p['name'], 'old-boat', p['x'], p['y']), point(p['name'] + ' (launch)', 'launch', *p['launch'])]
piles['places'] = dots

# ---- put the map together -------------------------------------------------------------------------
layers = []

# Adds one tile layer to the map.
def tile_layer(name, data, visible=True):
    layers.append({'id': len(layers) + 1, 'name': name, 'type': 'tilelayer', 'x': 0, 'y': 0, 'width': COLS,
                   'height': ROWS, 'opacity': 1, 'visible': visible, 'data': data})

for i, name in enumerate(KIT_ORDER): tile_layer(f'{i + 1:02d} {name}', ground_layer(name))
# The game's bank and cliff tiles keep their pictures; only their numbers move up past the two kits.
for name in ('banks', 'cliffs'):
    tile_layer(name, [g + FIRST_GAME - 1 if g else 0 for g in game_layers[name]['data']], visible=name != 'banks')
tile_layer('paths', path_data)
for name, objects in piles.items():
    layers.append({'id': len(layers) + 1, 'name': name, 'type': 'objectgroup', 'x': 0, 'y': 0, 'opacity': 1,
                   'visible': name != 'places', 'draworder': 'topdown', 'objects': objects})

out = {k: world[k] for k in ('type', 'version', 'tiledversion', 'orientation', 'renderorder', 'infinite', 'width',
                             'height', 'tilewidth', 'tileheight')}
out.update(nextlayerid=len(layers) + 1, nextobjectid=next_id[0], layers=layers, tilesets=[
    {'firstgid': FIRST_GROUND, 'source': f'terrain-{KIT}.tsx'},
    {'firstgid': FIRST_PATH, 'source': 'path-connectors.tsx'},
    dict(game_tiles, firstgid=FIRST_GAME, name='game-banks-and-cliffs', image='../map/tileset.png'),
    {'firstgid': FIRST_OBJECT, 'source': 'wildhaven-objects.tsx'}])
# The map is written to the file named on the command line, if any, so a fresh copy can be made without
# touching a map that is being edited by hand.
target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, 'wildhaven-world.tmj')
json.dump(out, open(target, 'w'), separators=(',', ':'))
print(f'{len(routes)} path routes on {len(kind_at)} squares;', {name: len(objects) for name, objects in piles.items()})
print({n: counts.get(n, 0) for n in list(KEEP) + list(ORE_SHARE)}, f'{len(caves)} caves')
