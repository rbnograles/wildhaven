"""Builds the Wildhaven sprite map from assets/world/source/.

Inputs : source/ground/{grass,dirt,soil,jungle,rock,snow,sand,water,deep}.png  seamless ground textures
         source/objects/<kind>/<name>.png + source/objects.json                 one sprite per world object; its
                                                                                objects.json entry names the kind folder
         source/cliffs/<kit>.png + source/cliffs/cliffs.json                    the cliff pictures the hill tiles are cut from
         source/shorelines/<kind>-bank.png + shorelines.json                    the painted banks drawn along the water's edge
         source/places.json                                                     regions, spawns, supplies, landmarks,
                                                                                waypoints, wrecks (old boats)
Outputs: map/tileset.png    terrain and cliff tiles incl. generated soft transitions (64px, 1px extruded)
         map/wildhaven.json Tiled-format map: nine terrain layers, a "banks" and a "cliffs" layer, an "objects" layer, and
                            properties for the region grid, the elevation grid and the sea
         map/overview.webp  small render of the whole map for the minimap and world map
The home continent sits inside a sea border; water far from any land becomes the "deep" layer.
The game reads collision from the JSON (water and deep tiles, the elevation grid and object footprints) and regions
from its region grid. Run: python tools/build-map.py [preview.png]
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world')
SRC, OUT = os.path.join(ROOT, 'source'), os.path.join(ROOT, 'map'); os.makedirs(OUT, exist_ok=True)
PLACES = json.load(open(os.path.join(SRC, 'places.json'), encoding='utf-8'))
# The home continent is the old 384x256-tile map. A sea border of SEA tiles is added on every side, so the whole
# map is 448x320 tiles. Hand-written positions in this script (rivers, fords, islands, the coast, the region layout)
# are in LAND units, measured from the old map's corner. places.json and the map file are in WORLD units, measured
# from the new corner: `land()` moves a place PAD units back when it is read, and every tile and object is moved
# PAD units out when it is written.
TILE, TEX, SEA = 64, 256, 32
LAND_COLS, LAND_ROWS = 384, 256
COLS, ROWS = LAND_COLS + 2 * SEA, LAND_ROWS + 2 * SEA
PAD = SEA * TILE                                     # 2048 units of sea on each side
W, H = COLS * TILE, ROWS * TILE                      # the whole map, sea included
LAND_W, LAND_H = LAND_COLS * TILE, LAND_ROWS * TILE  # the home continent's old map

# Terrains in paint order. A higher terrain is painted over a lower one, so the number is also its layer rank.
# DEEP is open sea far from land; it is worked out after everything else (see "deep sea" below). WATER and DEEP are
# the two top ranks, so `>= WATER` means "any river, pool or sea".
GRASS, DIRT, SOIL, JUNGLE, ROCK, SNOW, SAND, WATER, DEEP = range(9)
OVERLAYS = ['dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']   # rank 1..8; grass (rank 0) is the full ground layer

# ---- regions -----------------------------------------------------------------------------
# The world is an 8x8 grid of blocks, one letter per block. The letters are the `key` of each region in places.json.
LAYOUT = ['DDDPPSSS', 'DDDPPSSS', 'DDhhhhSS', 'CChhhhLL', 'CChhhhLL', 'CCJJJJLL', 'CJJJJJJL', 'CJJJJJJL']
BLOCK_W, BLOCK_H = LAND_W // 8, LAND_H // 8
BASE = {'D': SAND, 'P': GRASS, 'S': SNOW, 'h': GRASS, 'L': GRASS, 'C': ROCK, 'J': JUNGLE}
REGION_INDEX = {r['key']: i for i, r in enumerate(PLACES['regions'])}

# Says which region a point is in. The point is nudged by a few sine waves before the block grid is read, so the
# borders wobble like real coastlines instead of running in straight lines. The nudge is never more than 440 units.
# A point out at sea falls off the 8x8 grid and takes the letter of the nearest block.
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

# How far a point is inside the island's sea coast: positive on land, negative at sea. The coast follows the old
# map's edge, pulled in or pushed out by two sine waves (from 220 units in to 520 units out), so it never runs
# straight. Landmarks, signposts, spawns and supplies are at least 900 units inside the old edge, so the coast never
# reaches them. The old boats (wrecks) are the exception: they sit on the new beach by design, about 100 units inland
# of the coast (wreck-west lies outside the old edge).
def inland(x, y):
    edge = min(x, y, LAND_W - x, LAND_H - y)
    return edge + 150 + 250 * math.sin((x + y) / 1300 + 0.8) + 120 * math.sin((x - y) / 470 + 2.3)

BEACH = 220        # land closer than this to the sea coast is a sand beach
DEEP_FROM = 1200   # water farther than this from any land is deep sea, where the small boat can't go

RIVERS = [[(17000, 2500), (16200, 4800), (14800, 6400), (14600, 8600), (16200, 9900), (18800, 10300), (22600, 10500)],   # Frostpeak to the lagoon
          [(-200, 8200), (2200, 8600), (3600, 10200), (2600, 12200), (1500, 14000), (1900, 16600)]]                      # through the canyons
RIVER_HALF = 110
# Crossings: the river is replaced by dry ground within 190 of each point. BRIDGES also get a plank deck drawn on top.
FORDS = [(16600, 3650), (14700, 7500), (17500, 10100), (20200, 10375), (2900, 9400), (2050, 13100)]
BRIDGES = [(14700, 7500), (2900, 9400)]
DRY_BED = [(8800, 600), (6000, 2300), (3000, 2200), (600, 3800)]          # a walkable dirt riverbed across the desert
ISLANDS = [(23300, 8000, 330), (23700, 12500, 280), (23000, 14800, 240)]   # the lagoon's islets: reached by boat, each holds a landmark

# Moves a WORLD position from places.json into this script's LAND units.
def land(p): return (p[0] - PAD, p[1] - PAD)

SPAWN = {k: land(v) for k, v in PLACES['spawns'].items()}
LANDMARKS = [{**l, 'x': l['x'] - PAD, 'y': l['y'] - PAD} for l in PLACES['landmarks']]
POOLS = [(l['x'], l['y'] - l['pool'] - 120, l['pool']) for l in LANDMARKS if 'pool' in l]
# Every spot the player must be able to stand on. Water is pushed back from them and scenery is kept off them.
# An old boat's `launch` spot is left out on purpose: it must stay water, so the repaired boat can float there.
POINTS = (list(SPAWN.values()) + [land(p) for p in PLACES['supplies'].values()]
          + [land((p['x'], p['y'])) for p in PLACES['landmarks'] + PLACES['waypoints'] + PLACES['wrecks']])

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
    shore = inland(x, y)
    if shore < 0: t = WATER                          # the sea around the island
    elif shore < BEACH and t != WATER: t = SAND      # its beach; a river still runs across it to the sea
    if t == GRASS and is_soil(k, x, y): t = SOIL
    if t == WATER and any(math.hypot(x - px, y - py) < 130 for px, py in POINTS): t = SAND
    return t

# Says whether a grassy spot is bare forest soil instead: patches of it under the Pinefall pines, and the middle
# of each grove in the meadows (the same wave pattern that groups the meadow's trees, see the scatter below).
def is_soil(k, x, y):
    if k == 'P': return math.sin(x / 520 + 0.8) * math.cos(y / 470 + 2.2) + 0.3 * math.sin(x / 150 + y / 190) > 0.5
    return k == 'h' and math.sin(x / 610 + 1.3) * math.cos(y / 520 + 0.4) > 0.7

corner = np.array([[terrain(x * TILE - PAD, y * TILE - PAD) for x in range(COLS + 1)] for y in range(ROWS + 1)])

# ---- deep sea ----------------------------------------------------------------------------
# Water more than DEEP_FROM units from any land becomes DEEP. To find "near land", the land map is slid over itself
# one corner at a time in every direction inside a circle, like pressing a round stamp onto every bit of land.
reach = DEEP_FROM / TILE; R = int(reach)
is_land = np.pad(corner != WATER, R)
near_land = np.zeros(corner.shape, dtype=bool)
for dy in range(-R, R + 1):
    for dx in range(-R, R + 1):
        if dx * dx + dy * dy <= reach * reach:
            near_land |= is_land[R + dy:R + dy + corner.shape[0], R + dx:R + dx + corner.shape[1]]
corner[(corner == WATER) & ~near_land] = DEEP

# Hand-placed objects, in LAND units: the three starting places, each landmark's feature, the signposts and the bridges.
(sx, sy), (bx, by), (vx, vy) = SPAWN['scout'], SPAWN['builder'], SPAWN['survivor']
# The Scout's camp has no campfire: the only fires in the world are the ones the player builds.
fixed = [('tent', sx + 137, sy - 160), ('log', sx - 156, sy - 154),
         ('house-a', bx - 305, by - 120), ('house-b', bx + 295, by - 110), ('house-c', bx - 372, by + 310),
         ('workshop', bx + 458, by + 225), ('ship', vx + 325, vy - 20)]
fixed += [(l['object'], l['x'], l['y'] - 60) for l in LANDMARKS if 'object' in l]   # the feature stands just north of the spot
fixed += [('signpost', x, y - 50) for x, y in (land((w['x'], w['y'])) for w in PLACES['waypoints'])]
fixed += [('bridge', x, y) for x, y in BRIDGES]

# ---- hills and cliffs --------------------------------------------------------------------
# Raised ground the player climbs by stairs. A hill is a stack of flat-topped levels on the tile grid, like a
# wedding cake seen from above. The south edge of each level drops down a wall WALL_ROWS tiles tall; the other
# edges only show a low lip, because the camera looks at the world from the south. Each hill is cut from one
# "kit": a cliff picture in source/cliffs/ that cliffs.json describes.
# Like every other hand-made or random position in this script, hills are placed in LAND units, on the old land's
# own tile grid (LAND_COLS x LAND_ROWS tiles) and with the seeds they had before the sea border was added, so each
# hill stands on the same spot of land as before. "elevation grid" below then moves them out onto the map's grid.
CLIFF = json.load(open(os.path.join(SRC, 'cliffs', 'cliffs.json'), encoding='utf-8'))
KITS = [k for k in CLIFF['kits']]
WALL_ROWS = 2   # a wall is two tiles (128 units) tall: a little taller than the player
# Per region: the kit its hills use, the chance a candidate spot gets a hill, and the fewest and most levels.
HILL_RULES = {'h': ('meadow', 0.55, 1, 2), 'P': ('meadow', 0.4, 1, 1), 'C': ('canyon', 0.65, 1, 2),
              'D': ('canyon', 0.3, 1, 1), 'S': ('snow', 0.7, 2, 3)}
HILL_STEP = 1600   # land units between candidate hill spots

# Moves a grid of on/off tiles by (dy, dx) rows and columns; tiles moved in from outside are off.
def shifted(m, dy, dx):
    out = np.zeros_like(m); h, w = m.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out

# Keeps a tile only if every tile in the box reaching up/down/left/right that many tiles from it is on too.
def shrink_box(m, up, down, left, right):
    out = m.copy()
    for dy in range(-up, down + 1):
        for dx in range(-left, right + 1): out &= shifted(m, -dy, -dx)
    return out

# Turns on every tile that a box of that size, sitting on a tile that is on, would cover.
def grow_box(m, up, down, left, right):
    out = m.copy()
    for dy in range(-up, down + 1):
        for dx in range(-left, right + 1): out |= shifted(m, dy, dx)
    return out

# Spreads like water from the given tiles over every touching tile `can` allows; returns the tiles reached.
def flood(can, starts):
    seen = np.zeros_like(can); h, w = can.shape; stack = list(starts)
    while stack:
        y, x = stack.pop()
        if 0 <= y < h and 0 <= x < w and can[y, x] and not seen[y, x]:
            seen[y, x] = True; stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    return seen

# Fills every hole inside a shape, so a hill never has a pit that would trap the player.
def fill_holes(m):
    h, w = m.shape
    edge = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for y in (0, h - 1) for x in range(w)]
    return ~flood(~m, edge)

# Keeps only the biggest connected piece of a shape, so each level is one plateau.
def biggest_piece(m):
    left, best = m.copy(), np.zeros_like(m)
    while left.any():
        piece = flood(left, [tuple(np.argwhere(left)[0])])
        if piece.sum() > best.sum(): best = piece
        left &= ~piece
    return best

# Below every south edge there must be room for the wall plus one open row in front of it. Where the shape
# comes back sooner than that, the gap is filled in, so a wall never runs straight into more plateau.
def fill_short_gaps(m):
    m = m.copy(); h, w = m.shape
    for x in range(w):
        for y in range(h - 1):
            if m[y, x] and not m[y + 1, x]:
                for j in range(2, WALL_ROWS + 2):
                    if y + j < h and m[y + j, x]: m[y + 1:y + j, x] = True; break
    return m

# Says whether a shape keeps the rule fill_short_gaps makes.
def gaps_ok(m): return (fill_short_gaps(m) == m).all()

# Smooths a shape: no strips or notches one tile wide, no holes, no short gaps under walls, and one piece.
def tidy(m):
    for _ in range(3):
        m = grow_box(shrink_box(m, 0, 1, 0, 1), 0, 1, 0, 1)   # "opening": drops bits only one tile wide
        m = shrink_box(grow_box(m, 0, 1, 0, 1), 0, 1, 0, 1)   # "closing": fills notches one tile wide
        m = fill_short_gaps(fill_holes(m))
        if m.any(): m = biggest_piece(m)
    return m

# Draws the levels of one hill centred on tile (cx, cy). Returns the top-left tile (x0, y0) of the box the hill
# was drawn in and its levels as on/off grids over that box: levels[0] is every tile at least one level up,
# levels[1] at least two, and so on. Each level sits inside the one below with room for that level's lip
# around it and, on the south side, for its wall and a path in front of the wall.
def hill_shape(rng, cx, cy, n):
    rx = rng.uniform(5, 7.5) + 3 * (n - 1); ry = rx * rng.uniform(0.6, 0.8)
    pad = WALL_ROWS + 4
    x0, y0 = int(cx - rx) - pad, int(cy - ry) - pad
    w, h = int(2 * rx) + 2 * pad + 1, int(2 * ry) + 2 * pad + 1
    ys, xs = np.mgrid[0:h, 0:w]
    # Each 2x2 block of tiles (lined up with the world's even tiles) shares one value, so edges step two tiles at
    # a time and no wall is narrower than two tiles. One-tile steps looked like a row of broken pillars.
    dx, dy = ((xs + x0) // 2 * 2 + 1 - cx) / rx, ((ys + y0) // 2 * 2 + 1 - cy) / ry
    angle, p1, p2 = np.arctan2(dy, dx), rng.uniform(0, 6.3), rng.uniform(0, 6.3)
    # A rounded box rather than an oval, for long straight cliffs, with a gentle wobble so no two hills match.
    reach = (np.abs(dx) ** 3 + np.abs(dy) ** 3) ** (1 / 3) / (1 + 0.1 * np.sin(3 * angle + p1) + 0.06 * np.sin(5 * angle + p2))
    levels = []
    for k in range(n):
        room = shrink_box(levels[-1], 2, WALL_ROWS + 2, 2, 2) if levels else np.ones_like(reach, bool)
        m = tidy((reach < 1 - 0.34 * k) & room) & room
        if m.sum() < 12 or not gaps_ok(m): break
        levels.append(m)
    return x0, y0, levels

# Finds where a level's stairs go: two tiles side by side in the wall under its southernmost straight edge, with
# wall on both sides. `landing_ok(row, col)` says whether the player can stand where the stairs come down.
# Returns (left column, edge row) in box tiles, or None if no edge is long enough.
def stairs_spot(m, landing_ok):
    best, h, w = None, *m.shape
    for y in range(h - 1):
        x = 0
        while x < w:
            if not (m[y, x] and not m[y + 1, x]): x += 1; continue
            start = x
            while x < w and m[y, x] and not m[y + 1, x]: x += 1
            c = start + (x - start - 2) // 2
            if x - start >= 4 and landing_ok(y + WALL_ROWS + 1, c) and landing_ok(y + WALL_ROWS + 1, c + 1):
                if best is None or (y, x - start) > best[0]: best = ((y, x - start), c, y)
    return best and best[1:]

# Lists the wall tiles under a shape's south edges, as an on/off grid the same size as the shape.
def walls_of(m):
    edge = m & ~shifted(m, -1, 0)
    return np.logical_or.reduce([shifted(edge, r + 1, 0) for r in range(WALL_ROWS)])

level = np.zeros((LAND_ROWS, LAND_COLS), int)   # how many levels up each land tile's ground is
taken = np.zeros((LAND_ROWS, LAND_COLS), bool)  # land tiles a hill or its walls already use
kit_of = np.full((LAND_ROWS, LAND_COLS), -1)    # which kit draws each land tile's cliff pieces, or -1
flights = []                                    # stairs: (kit, left column, edge row) in land tiles
land_corner = corner[SEA:SEA + LAND_ROWS + 1, SEA:SEA + LAND_COLS + 1]   # the ground at the land tiles' corners
point_tiles = [(int(px // TILE), int(py // TILE)) for px, py in POINTS + [(ox, oy) for _, ox, oy in fixed] + FORDS]

# Says whether a hill may go where `body` (its plateau and walls, an on/off grid whose top-left is land tile
# (x0, y0)) lies: inside the old land and one region, on dry ground (no river, pool or sea, shallow or deep, within
# 3 tiles), at least 4 tiles from every place the player must reach, hand-placed object and crossing, and at least
# 5 tiles from other hills. Distances are measured from the hill's own tiles, not its bounding box, so a round hill
# can sit near a landmark that only its box would cover.
def hill_fits(key, body, x0, y0):
    h, w = body.shape
    if x0 < 4 or y0 < 4 or x0 + w > LAND_COLS - 4 or y0 + h > LAND_ROWS - 4: return False
    cells = np.argwhere(body) + (y0, x0)
    if any(region_key((x + 0.5) * TILE, (y + 0.5) * TILE) != key for y, x in cells): return False
    near = grow_box(body, 4, 4, 4, 4)
    if any(0 <= py - y0 < h and 0 <= px - x0 < w and near[py - y0, px - x0] for px, py in point_tiles): return False
    box = (slice(y0, y0 + h), slice(x0, x0 + w))
    ground = land_corner[box][grow_box(body, 3, 3, 3, 3)]
    return not ((ground >= WATER) | (ground == DIRT)).any() and not taken[box][grow_box(body, 5, 5, 5, 5)].any()

# Tries to put one hill of n levels centred on land point (cx, cy) in region `key`. Every level needs stairs: the
# lowest level's land on dry ground, the others on the level below. Returns True if the hill was placed.
def place_hill(rng, key, cx, cy, n):
    kit = HILL_RULES[key][0]
    x0, y0, levels = hill_shape(rng, cx / TILE, cy / TILE, n)
    if not levels or x0 < 0 or y0 < 0 or x0 + levels[0].shape[1] > LAND_COLS or y0 + levels[0].shape[0] > LAND_ROWS: return False
    stairs = []
    for k, m in enumerate(levels):
        if k == 0: ok = lambda y, x: y + y0 < LAND_ROWS and not (land_corner[y + y0:y + y0 + 2, x + x0:x + x0 + 2] >= WATER).any()
        else: ok = lambda y, x, low=levels[k - 1]: y + 1 < low.shape[0] and low[y, x] and low[y + 1, x]
        spot = stairs_spot(m, ok)
        if spot is None: levels = levels[:k]; break
        stairs.append(spot)
    if not levels: return False

    body = levels[0] | walls_of(levels[0])
    if not hill_fits(key, body, x0, y0): return False
    box = (slice(y0, y0 + body.shape[0]), slice(x0, x0 + body.shape[1]))
    level[box] += sum(m.astype(int) for m in levels)
    taken[box] |= body
    kit_of[box][grow_box(body, 1, 1, 1, 1)] = KITS.index(kit)
    flights.extend((kit, x0 + c, y0 + y) for c, y in stairs)
    HILL_COUNT[kit] = HILL_COUNT.get(kit, 0) + 1
    return True

HILL_COUNT = {}
for gy in range(HILL_STEP // 2, LAND_H, HILL_STEP):
    for gx in range(HILL_STEP // 2, LAND_W, HILL_STEP):
        # Like the scenery, each candidate spot has its own random seed, so one hill never reshuffles another.
        rng = random.Random(gx * 2654435761 ^ gy * 97531 ^ 0x5eed)
        if rng.random() > 0.9: continue
        n = None
        # A few tries per spot: each moves the centre, and every second try drops a level, so a hill that won't
        # fit next to a river or a landmark can still find room nearby.
        for attempt in range(4):
            cx, cy = gx + rng.randint(-500, 500), gy + rng.randint(-500, 500)
            key = region_key(cx, cy)
            if key not in HILL_RULES: continue
            _, chance, lo, hi = HILL_RULES[key]
            if n is None:
                if rng.random() > chance: break
                n = rng.randint(lo, hi)
            if place_hill(rng, key, cx, cy, max(lo, n - attempt // 2)): break

# ---- elevation grid ----------------------------------------------------------------------
# The hills were placed on the old land's tile grid. The map's grid has SEA more tiles of sea on every side, so the
# grids get a border SEA tiles wide of flat ground level 0 with no cliffs, and every flight of stairs moves SEA tiles
# out. From here on, tile numbers are map tiles and the grids cover the whole map, sea and coast included.
level = np.pad(level, SEA)
kit_of = np.pad(kit_of, SEA, constant_values=-1)
flights = [(kit, c + SEA, y + SEA) for kit, c, y in flights]

# Walls hang below every south edge; stairs replace two tiles of wall. The elevation grid holds one letter per
# tile for the game's collision (src/world/map.js): '0'-'3' is the level, 'w' a wall, 's' stairs.
wall_row = np.full((ROWS, COLS), -1)       # which row of its wall a tile is (0 = top), or -1 if not a wall
edge = level[:-1] > level[1:]
for r in range(WALL_ROWS): wall_row[1 + r:][edge[:ROWS - 1 - r]] = r
on_stairs = np.zeros((ROWS, COLS), bool)
keep_clear = np.zeros((ROWS, COLS), bool)  # the stairs and the ground just above and below them
for _, c, y in flights:
    on_stairs[y + 1:y + 1 + WALL_ROWS, c:c + 2] = True
    keep_clear[y - 1:y + WALL_ROWS + 4, c - 1:c + 3] = True
elevation = np.where(on_stairs, 's', np.where(wall_row >= 0, 'w', level.astype(str)))

# Says whether everything within r units of the LAND point (x, y) is on one flat level, away from walls, edges and
# stairs. Scenery uses it, so no tree stands on a cliff edge or blocks a flight of stairs.
def on_flat(x, y, r):
    x, y = x + PAD, y + PAD   # the grids are in map tiles, so move the land point out by the sea border first
    ys = slice(max(0, int((y - r) // TILE)), int((y + r) // TILE) + 1)
    xs = slice(max(0, int((x - r) // TILE)), int((x + r) // TILE) + 1)
    near = elevation[ys, xs]
    return (near == near.flat[0]).all() and near.flat[0] not in 'ws' and not keep_clear[ys, xs].any()

# ---- tileset -----------------------------------------------------------------------------
tex = {n: np.asarray(Image.open(os.path.join(SRC, 'ground', f'{n}.png')).convert('RGB').resize((TEX, TEX))).astype(float)
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

# ---- cliff tiles -------------------------------------------------------------------------
# Each kit picture is cut into strips at game size (one pixel per world unit):
#   wall       two stretches of plain wall side by side, 128 units wide in all and joined so they repeat. Its top
#              SLIP rows are the lip that overhangs the wall; the 128 rows under them are the wall itself.
#   cap_l/r    the left and right ends of the wall, LIP units wide, with the corner of the lip above them
#   side/sideE the low lip along a west or east edge: LIP units across, 32 units along, joined so it repeats
# A tile is then painted from these strips for each mix of open edges, wall row and shadow the map needs.
LIP = 12                                  # how far a north, west or east lip reaches into the plateau, in units
PPU = CLIFF['pixelsPerUnit']
SLIP = (CLIFF['kits']['meadow']['wallTop'] - CLIFF['kits']['meadow']['lipTop']) // PPU   # rows of lip over a wall

# Makes the first n rows of a picture repeat smoothly: its first `blend` rows fade in from the rows just after n.
def loop_rows(a, n, blend):
    out = a[:n].copy(); w = (np.arange(blend) / blend).reshape((-1,) + (1,) * (a.ndim - 1))
    out[:blend] = a[:blend] * w + a[n:n + blend] * (1 - w)
    return out

# Cuts the strips for one kit out of its picture.
def kit_strips(name):
    g = CLIFF['kits'][name]
    pic = Image.open(os.path.join(SRC, 'cliffs', f'{name}.png')).convert('RGBA')
    rows = (g['wallBottom'] - g['lipTop']) // PPU

    # Cuts a box out of the picture and shrinks it to w x h game pixels.
    def piece(x0, x1, y0, y1, w, h): return np.asarray(pic.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS)).astype(float)
    (a0, a1), (b0, b1) = g['sides']
    a = piece(a0, a1, g['lipTop'], g['wallBottom'], TILE + 8, rows)
    b = piece(b0, b1, g['lipTop'], g['wallBottom'], TILE + 8, rows)
    ramp = (np.arange(8) / 8)[None, :, None]
    wall = np.concatenate([a[:, :TILE], b[:, :TILE]], axis=1)
    wall[:, :8] = a[:, :8] * ramp + b[:, TILE:] * (1 - ramp)               # the right end of b runs on into a...
    wall[:, TILE:TILE + 8] = b[:, :8] * ramp + a[:, TILE:] * (1 - ramp)     # ...and the right end of a into b
    lip_edge = LIP * PPU
    cap_l = piece(g['leftTip'], g['leftTip'] + lip_edge, g['lipTop'], g['wallBottom'], LIP, rows)
    cap_r = piece(g['rightTip'] - lip_edge, g['rightTip'], g['lipTop'], g['wallBottom'], LIP, rows)
    side = loop_rows(piece(g['leftTip'], g['leftTip'] + lip_edge, 8, g['lipTop'] - 5, LIP, 38), 32, 6)
    side_e = loop_rows(piece(g['rightTip'] - lip_edge, g['rightTip'], 8, g['lipTop'] - 5, LIP, 38)[:, ::-1], 32, 6)

    # The inner side of every lip fades out, so it melts into the plateau's own ground texture.
    fade_in = np.clip(np.arange(rows) / 5, 0, 1)[:, None]
    for strip in (wall, cap_l, cap_r): strip[:SLIP, :, 3] *= fade_in[:SLIP]
    across = np.clip((LIP - 0.5 - np.arange(LIP)) / 4, 0, 1)[None, :]
    for strip in (side, side_e): strip[..., 3] *= across
    return {'wall': wall, 'cap_l': cap_l, 'cap_r': cap_r, 'side': side, 'side_e': side_e}

STRIPS = [kit_strips(k) for k in KITS]

# Lays picture `src` over picture `dst` (both RGBA, 0-255, alpha not premultiplied), like stacking tracing paper.
def over(dst, src):
    sa, da = src[..., 3:] / 255, dst[..., 3:] / 255
    out_a = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(out_a, 1e-6)
    return np.dstack([rgb, out_a * 255])

PX = np.arange(TILE) + 0.5
X, Y = np.meshgrid(PX, PX)

# Paints one cliff tile. `edges` says which sides (north, south, west, east) drop to lower ground; `inner` which
# corners (NW, NE, SW, SE) have lower ground only diagonally. `wall` is the wall row (-1: no wall) and `var`
# which half of the repeating wall to use. `caps` says whether the wall ends on its left/right; `shade` whether
# a cliff to the west or a wall to the north throws a soft shadow over this tile. `lift` is the level of a plateau
# tile (0 for anything else): each level up is washed with a little more warm light, so higher ground reads as
# higher even where no wall shows.
def cliff_tile(kit, edges, inner, wall, var, caps, shade, lift):
    s = STRIPS[kit]; tile = np.zeros((TILE, TILE, 4))
    if lift: tile[:] = (255, 240, 200, 20 * lift)

    # Shadows first, on the ground: light comes from the upper left, so cliffs shade the ground east and south of them.
    if shade[0]: tile = over(tile, np.dstack([np.full((TILE, TILE, 3), (25, 30, 40)), 70 * np.clip(1 - X / 18, 0, 1)]))
    if shade[1]: tile = over(tile, np.dstack([np.full((TILE, TILE, 3), (25, 30, 40)), 80 * np.clip(1 - Y / 12, 0, 1)]))

    # A wall tile: a slice of the repeating wall, with an end piece where the wall stops.
    if wall >= 0:
        top = SLIP + wall * TILE
        part = s['wall'][top:top + TILE, var * TILE:(var + 1) * TILE].copy()
        blend = np.clip((np.arange(LIP) - (LIP - 4)) / 3, 0, 1)[None, :, None]   # the last few columns melt into the wall
        if caps[0]: part[:, :LIP] = s['cap_l'][top:top + TILE] * (1 - blend) + part[:, :LIP] * blend
        if caps[1]: part[:, -LIP:] = s['cap_r'][top:top + TILE] * (1 - blend[:, ::-1]) + part[:, -LIP:] * blend[:, ::-1]
        tile = over(tile, part)

    # Lips on a plateau tile. Each pixel takes its lip from the nearest open edge (or inner corner).
    north, south, west, east = edges
    far = np.full((TILE, TILE), 1e9)
    dist = np.stack([np.where(north, Y, far), np.where(south, TILE - Y, far), np.where(west, X, far), np.where(east, TILE - X, far),
                     np.where(inner[0], np.hypot(X, Y), far), np.where(inner[1], np.hypot(TILE - X, Y), far),
                     np.where(inner[2], np.hypot(X, TILE - Y), far), np.where(inner[3], np.hypot(TILE - X, TILE - Y), far)])
    nearest, d = dist.argmin(axis=0), dist.min(axis=0)
    # Round the two back corners: inside the corner square, the distance is measured to a quarter circle instead.
    for on, cx in ((north and west, LIP), (north and east, TILE - LIP)):
        if on:
            corner_sq = (np.abs(X - cx) < LIP) & (Y < LIP) & ((X < cx) == (cx == LIP))
            d = np.where(corner_sq, LIP - np.hypot(X - cx, Y - LIP), d)
            nearest = np.where(corner_sq, np.where(np.abs(X - cx) > LIP - Y, 2 if cx == LIP else 3, 0), nearest)
    lip = np.zeros((TILE, TILE, 4))
    xi, yi = X.astype(int), Y.astype(int); di = np.clip(d, 0, LIP - 1).astype(int)
    band = (d >= 0) & (d < LIP)
    for side, rows, cols, src in ((0, xi % 32, di, s['side']), (2, yi % 32, di, s['side']), (3, yi % 32, di, s['side_e']),
                                  (4, (xi + yi) % 32, di, s['side']), (5, (xi + yi) % 32, di, s['side']),
                                  (6, (xi + yi) % 32, di, s['side']), (7, (xi + yi) % 32, di, s['side'])):
        m = band & (nearest == side)
        lip[m] = src[rows[m], cols[m]]
    if south:   # the lip over a wall comes from the top rows of the wall strip, or of its end pieces at a corner
        m = (nearest == 1) & (Y > TILE - SLIP)
        lip[m] = s['wall'][yi[m] - (TILE - SLIP), var * TILE + xi[m]]
        for on, xs, cap in ((west, slice(0, LIP), 'cap_l'), (east, slice(TILE - LIP, TILE), 'cap_r')):
            if on: lip[TILE - SLIP:, xs] = s[cap][:SLIP]
    lip[~band & (nearest != 1)] = 0
    return over(tile, lip)

# Works out which cliff tile each map square needs and adds every different one to the tileset once.
cliff_gid = {}
cliff_layer = [0] * (ROWS * COLS)

# Reads the level of a tile, treating tiles off the map as ground level.
def lv(y, x): return level[y, x] if 0 <= y < ROWS and 0 <= x < COLS else 0

for y, x in np.argwhere(kit_of >= 0):
    here, r = level[y, x], wall_row[y, x]
    top = r < 0 and here > 0
    edges = tuple(bool(top and lv(y + dy, x + dx) < here) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)))
    inner = tuple(bool(top and lv(y + dy, x) >= here and lv(y, x + dx) >= here and lv(y + dy, x + dx) < here)
                  for dy, dx in ((-1, -1), (-1, 1), (1, -1), (1, 1)))
    caps = (False, False)
    if r >= 0:
        wall_top = level[y - 1 - r, x]
        # Says whether the wall stops at the next tile over: it does unless that tile is the same wall or higher ground.
        def ends(dx): return not (0 <= x + dx < COLS) or not (wall_row[y, x + dx] == r and level[y - 1 - r, x + dx] == wall_top) and level[y, x + dx] < wall_top
        caps = (ends(-1), ends(1))
    shade = (r < 0 and x > 0 and ((wall_row[y, x - 1] < 0 and level[y, x - 1] > here) or wall_row[y, x - 1] >= 0),
             r < 0 and y > 0 and wall_row[y - 1, x] == WALL_ROWS - 1)
    key = (int(kit_of[y, x]), edges, inner, int(r), x % 2 if (r >= 0 or edges[1]) else 0, caps, shade, int(here) if top else 0)
    if not (top or r >= 0 or any(shade)): continue
    if key not in cliff_gid:
        tiles.append(cliff_tile(*key)); cliff_gid[key] = len(tiles)
    cliff_layer[y * COLS + x] = cliff_gid[key]

# ---- bank tiles --------------------------------------------------------------------------
# A painted bank runs along every waterline: sand and sea foam round the sea, rooty earth along the rivers, and
# loam with moss round the pools. Each kind comes from one picture in source/shorelines/ (shorelines.json says where
# to cut). Only the picture's straight piece is used: it becomes a strip that repeats every BANK_LOOP units, and
# each tile bends that strip along its own bit of shore, like laying a ribbon along the water's edge.
SHORE = json.load(open(os.path.join(SRC, 'shorelines', 'shorelines.json'), encoding='utf-8'))
BANK_KINDS = ['ocean', 'river', 'lake']   # a corner's kind is its index here; where two kinds meet, the later one wins
BANK_LAND = 56     # how far the bank reaches onto the land, in units
BANK_WET = 7       # how far its wet edge reaches past the waterline
BANK_LOOP = 256    # the strip repeats after this many units: four tiles, like the ground textures

# Cuts one kind's strip: BANK_LAND + BANK_WET rows (far land side first, the wet edge last) by BANK_LOOP columns.
# The colours are kept "premultiplied" (already multiplied by how solid the pixel is), so blending two samples
# never drags in the colour of a see-through pixel.
def bank_strip(name):
    g = SHORE['kinds'][name]
    a = np.asarray(Image.open(os.path.join(SRC, 'shorelines', f'{name}-bank.png')).convert('RGBA')).astype(float)
    a[..., 3] = np.clip((a[..., 3] - 48) / 160, 0, 1) * 255   # the generated pictures have a faint glow round each piece: drop it
    pic = Image.fromarray(a.astype('uint8')).convert('RGBa')

    # Cuts the rows y0..y1 of the straight piece and shrinks them to `rows` game rows, a little longer than one loop.
    def piece(y0, y1, rows): return np.asarray(pic.crop((g['left'], y0, g['right'], y1)).resize((BANK_LOOP + 16, rows), Image.LANCZOS)).astype(float)
    strip = np.concatenate([piece(g['top'], g['water'], BANK_LAND), piece(g['water'], g['bottom'], BANK_WET)])
    strip = loop_rows(strip.swapaxes(0, 1), BANK_LOOP, 16).swapaxes(0, 1)   # joined end to start, so it repeats
    strip[:g['fade']] *= ((np.arange(g['fade']) + 0.5) / g['fade'])[:, None, None]   # the land side melts into the ground
    return strip

BANKS = [bank_strip(k) for k in BANK_KINDS]

# Says which kind of water a wet LAND point is: 2 a pool, 0 the sea (round the island or in the lagoon), 1 a river.
def water_kind(x, y):
    if any(math.hypot(x - px, y - py) < r for px, py, r in POOLS): return 2
    if inland(x, y) < 0 or (region_key(x, y) == 'L' and x > coast(y) + 16): return 0
    return 1

# How far each tile corner is from water, counted in corners (a diagonal step counts as one): 0 is water, 1 touches
# water, 2 is anything farther. Inside a tile these are blended like the terrain masks, and where the blend passes
# 0.5 is exactly where the water tile draws its edge, so the bank always sits on the waterline.
wet = corner >= WATER
shore_dist = np.where(wet, 0, np.where(grow_box(wet, 1, 1, 1, 1), 1, 2))
# The kind of the nearest water, for every corner within two corners of some: water corners know their own kind,
# and it is then spread outwards twice.
shore_kind = np.full(corner.shape, -1)
for y, x in np.argwhere(wet): shore_kind[y, x] = 0 if corner[y, x] == DEEP else water_kind(x * TILE - PAD, y * TILE - PAD)
for _ in range(2):
    spread = np.max([shifted(shore_kind + 1, dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)], axis=0) - 1
    shore_kind = np.where(shore_kind < 0, spread, shore_kind)

# Paints one bank tile. `dist` holds the four corners' distances from water (TL, TR, BL, BR) and `kinds` their
# bank kinds; px, py say which square of the 4x4 noise block the tile is, as for the terrain tiles.
def bank_tile(dist, kinds, px, py):
    tl, tr, bl, br = dist
    share = [(1 - U) * (1 - V), U * (1 - V), (1 - U) * V, U * V]   # how much each corner counts at each pixel
    away = tl * share[0] + tr * share[1] + bl * share[2] + br * share[3]
    wobble = cut(noise, px, py) * 0.5 * TILE
    inland_by = (away - 0.5) * TILE - wobble                       # units from the waterline: the same wobble as the water tile
    # Only the wet edge follows every little wobble of the waterline. Farther in, the wobble fades away, so the
    # painted roots and pebbles are not smeared into zigzags.
    inland_by += wobble * np.clip(inland_by / BANK_LAND, 0, 1)
    row = BANK_LAND - inland_by                                    # which row of the strip each pixel shows
    r0 = np.clip(np.floor(row), 0, BANK_LAND + BANK_WET - 2).astype(int); part = np.clip(row - r0, 0, 1)[..., None]

    # The strip must run along the shore. A shore can run any way, so the strip is laid four ways (along x, along
    # y and along both diagonals) and each pixel takes mostly the one that best matches the slope of the shore.
    slope_x, slope_y = (1 - V) * (tr - tl) + V * (br - bl), (1 - U) * (bl - tl) + U * (br - tr)
    wx, wy = px * TILE + X, py * TILE + Y
    ways = [(slope_y ** 2, wx), (slope_x ** 2, wy), ((slope_x + slope_y) ** 2 / 2, wx - wy), ((slope_x - slope_y) ** 2 / 2, wx + wy)]
    weight = np.stack([w ** 4 for w, _ in ways]); weight[0] += 1e-9   # on flat ground (no slope) the strip just runs along x
    weight /= weight.sum(axis=0)

    tile = np.zeros((TILE, TILE, 4))
    for k in set(kinds):
        mix = sum(s for s, kind in zip(share, kinds) if kind == k)   # kinds blend where a river meets the sea
        for w, (_, along) in zip(weight, ways):
            col = np.floor(along).astype(int) % BANK_LOOP
            tile += (BANKS[k][r0, col] * (1 - part) + BANKS[k][r0 + 1, col] * part) * (w * mix)[..., None]
    tile[(row < 0) | (row > BANK_LAND + BANK_WET - 1)] = 0
    # A flat pocket (a little spit of land with water all round) has no shore direction, and one row of the strip
    # would be smeared right across it. The bank fades out there and the plain ground shows instead.
    tile *= np.clip(np.hypot(slope_x, slope_y) * 3, 0, 1)[..., None]
    tile[..., :3] *= 255 / np.maximum(tile[..., 3:], 1e-6)   # back from premultiplied colour to plain colour
    return np.clip(tile, 0, 255)

# Works out which bank tile each map square needs and adds every different one to the tileset once. A square needs
# one unless its corners are all water or all far from water.
bank_gid = {}
bank_layer = [0] * (ROWS * COLS)
for ty in range(ROWS):
    for tx in range(COLS):
        dist = tuple(int(v) for v in (shore_dist[ty, tx], shore_dist[ty, tx + 1], shore_dist[ty + 1, tx], shore_dist[ty + 1, tx + 1]))
        if max(dist) == 0 or min(dist) == 2: continue
        kinds = tuple(int(v) for v in (shore_kind[ty, tx], shore_kind[ty, tx + 1], shore_kind[ty + 1, tx], shore_kind[ty + 1, tx + 1]))
        key = (dist, kinds, tx % 4, ty % 4)
        if key not in bank_gid:
            tiles.append(bank_tile(*key)); bank_gid[key] = len(tiles)
        bank_layer[ty * COLS + tx] = bank_gid[key]

TS_COLS = 62; ts_rows = math.ceil(len(tiles) / TS_COLS); cell = TILE + 2   # 62 across keeps the sheet under 4096 px wide
sheet = np.zeros((ts_rows * cell, TS_COLS * cell, 4), dtype='uint8')
for i, t in enumerate(tiles):
    y, x = (i // TS_COLS) * cell, (i % TS_COLS) * cell
    sheet[y:y+cell, x:x+cell] = np.pad(t.astype('uint8'), ((1, 1), (1, 1), (0, 0)), mode='edge')   # extrusion stops seams when zoomed
Image.fromarray(sheet).save(os.path.join(OUT, 'tileset.png'))

# ---- tile layers -------------------------------------------------------------------------
# A layer only paints a tile when one of the tile's corners is its own terrain. It then covers every corner of
# its rank or higher, so the terrain below a shoreline runs on underneath the water and no grass shows in the seam.
# The water layer also paints tiles that have a deep corner, so it marks all sea (shallow and deep) for collision,
# which src/world/map.js reads; the deep layer on top marks only the deep corners, which the small boat can't enter.
layers = {'ground': [1 + (ty % 4) * 4 + tx % 4 for ty in range(ROWS) for tx in range(COLS)]}
for rank, name in enumerate(OVERLAYS, start=1):
    data = []
    for ty in range(ROWS):
        for tx in range(COLS):
            c = (corner[ty, tx], corner[ty, tx+1], corner[ty+1, tx], corner[ty+1, tx+1])
            paints = rank in c or (name == 'water' and DEEP in c)   # a tile of pure deep sea is still water
            mask = sum(int(v >= rank) << i for i, v in enumerate(c)) if paints else 0
            data.append(gid(name, mask, tx, ty))
    layers[name] = data
layers['banks'] = bank_layer     # drawn over the water's edge: the painted shoreline (see "bank tiles")
layers['cliffs'] = cliff_layer   # drawn over the ground: lips, walls and their shadows (see "cliff tiles")
TILE_LAYERS = ['ground'] + OVERLAYS + ['banks', 'cliffs']

# ---- region grid -------------------------------------------------------------------------
# One digit per 256-unit square, row by row: the index of that square's region in places.json.
# Sea squares take the region of the land nearest them, because region_key clamps to the edge of its layout.
REGION_CELL = 256; REGION_COLS, REGION_ROWS = W // REGION_CELL, H // REGION_CELL
region_grid = ''.join(str(REGION_INDEX[region_key(cx * REGION_CELL + REGION_CELL / 2 - PAD, cy * REGION_CELL + REGION_CELL / 2 - PAD)])
                      for cy in range(REGION_ROWS) for cx in range(REGION_COLS))

# ---- objects -----------------------------------------------------------------------------
spec = {k: v for k, v in json.load(open(os.path.join(SRC, 'objects.json'))).items() if not k.startswith('_')}
# The stairs sprite of each flight sits centred on its two stairs tiles, its foot on the ground below the wall.
# Flights are in map tiles by now; like every other object here, the sprite's spot is given in LAND units.
stairs_objects = [(f'{kit}-stairs', (c + 1) * TILE - PAD, (y + 1 + WALL_ROWS) * TILE - PAD) for kit, c, y in flights]

# Says whether a random tree or rock may go at (x, y): not on a place the player must stand, not on a crossing,
# and not on, behind or just in front of a hand-placed object, where it would cover it up.
def scatter_ok(x, y):
    return (all(math.hypot(x - cx, y - cy) > 150 for cx, cy in POINTS)
            and all(abs(x - cx) > 170 or not (0 < y - cy < 330) for cx, cy in POINTS)   # nothing tall just south, where its canopy would hide the player
            and all(math.hypot(x - fx, y - fy) > 260 for fx, fy in FORDS)
            and all(abs(x - ox) > 330 or not (-150 < oy - y < 420) for _, ox, oy in fixed))

# Says whether water is drawn within r units of (x, y). The shoreline is painted from the corners of the 64-unit
# tiles, so water reaches a little past where terrain() says it ends; asking only about the one point let grass
# tufts and bushes stand in a river's edge. This looks at every tile corner around the spot instead.
def near_water(x, y, r):
    c0, c1 = max(0, int((x - r) // TILE)), min(COLS, int((x + r) // TILE) + 1)
    r0, r1 = max(0, int((y - r) // TILE)), min(ROWS, int((y + r) // TILE) + 1)
    return bool((corner[r0:r1 + 1, c0:c1 + 1] >= WATER).any())   # WATER and DEEP are the two highest kinds

# What grows in each region: (chance that a grid square gets something, what it can be).
SCATTER = {
    'D': (0.16, ['cactus', 'cactus', 'dead-bush', 'beach-rock']),
    'P': (0.85, ['pines', 'pine', 'pine', 'pines', 'rocks-a']),
    'S': (0.32, ['snowy-pine', 'snowy-pine', 'ice-rock', 'boulder']),
    'C': (0.38, ['boulder', 'cliff-rock', 'rocks-a', 'dead-bush', 'boulder']),
    'J': (0.70, ['jungle-tree', 'jungle-tree', 'fern', 'fern', 'big-oak', 'palm']),
}
# What washes up on the sea beach all round the island (the lagoon keeps its own shore, below).
BEACH_SCATTER = (0.18, ['driftwood', 'driftwood', 'driftwood', 'beach-rock'])
scattered = []
STEP = 210
# The grid starts ten squares before the old map's corner, so it covers the new coast too. Squares keep the numbers
# (and so the random seeds) they had before the sea border was added, so scenery on the old land stays where it was.
for gy in range(STEP // 2 - 10 * STEP, LAND_H + PAD, STEP):
    for gx in range(STEP // 2 - 10 * STEP, LAND_W + PAD, STEP):
        # Each grid square has its own random seed, so changing one part of the map never reshuffles another part.
        rng = random.Random(gx * 73856093 ^ gy * 19349663)
        x, y = gx + rng.randint(-70, 70), gy + rng.randint(-70, 70)
        if (not (60 - PAD < x < LAND_W + PAD - 60 and 120 - PAD < y < LAND_H + PAD - 30) or not scatter_ok(x, y)
                or not on_flat(x, y, 80)): continue
        ground = terrain(x, y); roll = rng.random()
        if ground in (WATER, DIRT) or near_water(x, y, 60): continue
        k = region_key(x, y)
        if k != 'L' and inland(x, y) < BEACH: chance, names = BEACH_SCATTER
        elif k == 'h':
            grove = math.sin(x / 610 + 1.3) * math.cos(y / 520 + 0.4) > 0.35   # clumps in the open meadow
            chance, names = (0.8, ['oak', 'big-oak', 'pine', 'pines', 'flowers']) if grove else (0.3, ['oak', 'big-oak', 'pine', 'rocks-a', 'rocks-b', 'flowers', 'flowers'])
        elif k == 'L':
            if ground == SAND: chance, names = (0.14 if x < coast(y) - 60 else 0, ['palm', 'beach-rock', 'driftwood'])
            else: chance, names = 0.28, ['oak', 'palm', 'palm', 'flowers', 'rocks-b']
        else: chance, names = SCATTER[k]
        if roll < chance: scattered.append((rng.choice(names), x, y))

# Ground detail: grass tufts and tall grass on a finer grid, so open ground isn't flat colour.
# It is a separate pass with its own seeds, so adding it did not move a single tree from the pass above.
# Per region: (chance a square gets something, what it can be). Sand on the lagoon shore and the sea beach has its
# own rule below.
# There are no round bare-dirt patches any more: scattered over the meadows they read as litter, not as ground.
DETAIL = {
    'h': (0.5, ['grass-tuft', 'grass-tuft', 'grass-tuft', 'tall-grass', 'tall-grass']),
    'P': (0.3, ['grass-tuft', 'grass-tuft', 'tall-grass']),
    'L': (0.3, ['grass-tuft', 'grass-tuft', 'tall-grass']),
    'D': (0.1, ['dry-grass']),
    'C': (0.25, ['dry-grass', 'dry-grass', 'grass-tuft']),
    'S': (0.22, ['snow-grass']),
}
# Solid bases of the hand-placed objects, grown a little, so no tuft pokes out of a house wall.
fixed_bases = [(ox - spec[n]['footprint'][0] - 30, oy - spec[n]['footprint'][1] - 30, ox + spec[n]['footprint'][0] + 30, oy + 30)
               for n, ox, oy in fixed if 'footprint' in spec[n]]
details = []
DETAIL_STEP = 150
# Like the scatter above, the grid starts before the old map's corner (14 squares, just past the sea border) so it
# covers the new coast too, and every square keeps the number (and so the seed) it had before the border was added.
for gy in range(DETAIL_STEP // 2 - 14 * DETAIL_STEP, LAND_H + PAD, DETAIL_STEP):
    for gx in range(DETAIL_STEP // 2 - 14 * DETAIL_STEP, LAND_W + PAD, DETAIL_STEP):
        rng = random.Random(gx * 83492791 ^ gy * 50331653 ^ 0xd17)
        x, y = gx + rng.randint(-55, 55), gy + rng.randint(-55, 55)
        k, ground, roll = region_key(x, y), terrain(x, y), rng.random()
        if (k not in DETAIL or not (60 - PAD < x < LAND_W + PAD - 60 and 120 - PAD < y < LAND_H + PAD - 30)
                or ground in (WATER, DIRT)): continue
        chance, names = DETAIL[k]
        if ground == SAND and (k == 'L' or inland(x, y) < BEACH): chance, names = 0.08, ['dry-grass']   # only a little on a beach
        name = rng.choice(names)
        if (roll >= chance or not on_flat(x, y, 40) or near_water(x, y, 45)
                or any(math.hypot(x - px, y - py) < 70 for px, py in POINTS)
                or any(math.hypot(x - bx_, y - by_) < 260 for bx_, by_ in BRIDGES)
                or any(l < x < r and t < y < b for l, t, r, b in fixed_bases)): continue
        details.append((name, x, y))

# Water ripples: small looping animations on open water, so rivers, pools and the sea are never perfectly still.
# The renderer plays each one from its sheet in assets/world/animations/ (made by tools/prepare-sprite-art.py).
# Another separate pass with its own seeds. Per kind of water (see water_kind): the sprite, how far it reaches
# left/right and up/down from its middle, and the chance a grid square of that water gets one. The sea is huge,
# so its chance is low, and lower still far out in the deep.
RIPPLES = [('sea-wave', 80, 40, 0.12), ('river-ripple', 50, 26, 0.7), ('lake-ripple', 75, 45, 0.3)]
DEEP_RIPPLE_CHANCE = 0.03
RIPPLE_STEP = 120   # a fine grid, or hardly any square would land inside a narrow river
ripples = []

# Says whether any tile corner around the box reaching rx left/right and ry up/down of the LAND point (x, y) is dry.
# The shore is painted from the tile corners, so this keeps a ripple off the painted bank as well.
def dry_near(x, y, rx, ry):
    c0, c1 = int((x + PAD - rx) // TILE), int((x + PAD + rx) // TILE) + 1
    r0, r1 = int((y + PAD - ry) // TILE), int((y + PAD + ry) // TILE) + 1
    return not wet[r0:r1 + 1, c0:c1 + 1].all()

for gy in range(RIPPLE_STEP // 2 - PAD, LAND_H + PAD, RIPPLE_STEP):
    for gx in range(RIPPLE_STEP // 2 - PAD, LAND_W + PAD, RIPPLE_STEP):
        rng = random.Random(gx * 40503 ^ gy * 92821 ^ 0x71de)
        x, y = gx + rng.randint(-40, 40), gy + rng.randint(-40, 40)
        if not (100 - PAD < x < LAND_W + PAD - 100 and 100 - PAD < y < LAND_H + PAD - 100) or terrain(x, y) != WATER: continue
        kind = water_kind(x, y); name, rx, ry, chance = RIPPLES[kind]
        if corner[int(round((y + PAD) / TILE)), int(round((x + PAD) / TILE))] == DEEP: chance = DEEP_RIPPLE_CHANCE
        # The whole ripple must lie on water: its four ends are checked too, and nothing floats under a bridge.
        # A river is too narrow for the stricter corner check, which would leave it almost bare.
        if (rng.random() >= chance or any(terrain(x + dx, y + dy) != WATER for dx, dy in ((-rx, 0), (rx, 0), (0, -ry), (0, ry)))
                or (kind != 1 and dry_near(x, y, rx, ry)) or any(math.hypot(x - bx_, y - by_) < 300 for bx_, by_ in BRIDGES)): continue
        ripples.append((name, x, y))
# Everything above is in LAND units; the map file is in WORLD units.
objects = [(n, x + PAD, y + PAD) for n, x, y in fixed + stairs_objects + scattered + details + ripples]

tiled = {
    'type': 'map', 'version': '1.10', 'tiledversion': '1.11.0', 'orientation': 'orthogonal', 'renderorder': 'right-down', 'infinite': False,
    'width': COLS, 'height': ROWS, 'tilewidth': TILE, 'tileheight': TILE, 'nextlayerid': len(TILE_LAYERS) + 2, 'nextobjectid': len(objects) + 1,
    'tilesets': [{'firstgid': 1, 'name': 'terrain', 'image': 'tileset.png', 'imagewidth': sheet.shape[1], 'imageheight': sheet.shape[0],
                  'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': TS_COLS, 'tilecount': len(tiles)}],
    'properties': [{'name': 'firstWaterGid', 'type': 'int', 'value': first['water']},
                   {'name': 'firstDeepGid', 'type': 'int', 'value': first['deep']},
                   {'name': 'seaBorder', 'type': 'int', 'value': PAD},
                   {'name': 'regionCell', 'type': 'int', 'value': REGION_CELL},
                   {'name': 'regionCols', 'type': 'int', 'value': REGION_COLS},
                   {'name': 'regionGrid', 'type': 'string', 'value': region_grid},
                   {'name': 'elevation', 'type': 'string', 'value': ''.join(elevation.ravel())}],
    'layers': [{'id': i + 1, 'name': n, 'type': 'tilelayer', 'x': 0, 'y': 0, 'width': COLS, 'height': ROWS, 'opacity': 1, 'visible': True, 'data': layers[n]}
               for i, n in enumerate(TILE_LAYERS)]
            + [{'id': len(TILE_LAYERS) + 1, 'name': 'objects', 'type': 'objectgroup', 'x': 0, 'y': 0, 'opacity': 1, 'visible': True, 'draworder': 'topdown',
                'objects': [{'id': i + 1, 'name': n, 'type': n, 'x': x, 'y': y, 'width': 0, 'height': 0, 'rotation': 0, 'point': True, 'visible': True}
                            for i, (n, x, y) in enumerate(objects)]}],
}
map_path = os.path.join(OUT, 'wildhaven.json')
json.dump(tiled, open(map_path, 'w'), separators=(',', ':'))

# ---- overview ----------------------------------------------------------------------------
S = 8; full = Image.new('RGBA', (W // S, H // S))
small = [Image.fromarray(t.astype('uint8')).resize((TILE // S, TILE // S), Image.BOX) for t in tiles]
for n in TILE_LAYERS:
    for i, g in enumerate(layers[n]):
        if g: full.alpha_composite(small[g - 1], ((i % COLS) * TILE // S, (i // COLS) * TILE // S))
sprites = {n: Image.open(os.path.join(SRC, 'objects', spec[n]['kind'], f'{n}.png')).convert('RGBA') for n in spec}

# Shrinks a sprite to overview size, allowing for the sprite's own `scale` in objects.json.
def shrink(n, im): sc = spec[n].get('scale', 1); return im.resize((max(1, int(im.width * sc) // S), max(1, int(im.height * sc) // S)), Image.LANCZOS)
sprites = {n: shrink(n, im) for n, im in sprites.items()}
for n, x, y in sorted(objects, key=lambda o: (not spec[o[0]].get('flat', False), o[2])):
    im = sprites[n]; ox, oy = spec[n]['origin']
    px, py = round(x / S - im.width * ox), round(y / S - im.height * oy)
    if px >= 0 and py >= 0 and px + im.width <= full.width and py + im.height <= full.height: full.alpha_composite(im, (px, py))
full.convert('RGB').resize((1568, 1120), Image.LANCZOS).save(os.path.join(OUT, 'overview.webp'), quality=85)   # 7:5, the map's own shape
if len(sys.argv) > 1: full.convert('RGB').save(sys.argv[1])
print(len(tiles), 'tiles,', len(objects), 'objects,', round(os.path.getsize(map_path) / 1e6, 1), 'MB map file,',
      len(flights), 'flights of stairs,', len(cliff_gid), 'cliff tiles; hills per kit:', HILL_COUNT)
