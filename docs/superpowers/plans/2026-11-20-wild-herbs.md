# Wild Herbs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Wild herbs", a hand-picked plant that gives 3 herbs, scattered mostly over the regions that have few or no wildflowers.

**Architecture:** One new `WILD` entry makes the plant gatherable; everything else in the game (nodes, hover, click to walk, bag, regrow, saves) already handles any `WILD` sprite. The patches reach the played map through a new script that adds point objects to the hand-edited Tiled map, a small importer change that reads such points, and the usual import. `build-map.py` gets the matching scatter pass so the generated map has them too.

**Tech Stack:** Vanilla JS ES modules, `node:test`, Prettier, Python 3 (numpy, Pillow), Tiled `.tmj` JSON.

**Spec:** `docs/superpowers/specs/2026-11-20-wild-herbs-design.md`

## Global Constraints

- Wild herbs give **3 herbs**, take `GATHER_SECONDS` (not quick), regrow in **180** game-seconds, are walk-through (no `footprint`).
- No save version change, no new resource, no new balance constant, no new action.
- Sprite name `wild-herbs`, kind `plants`; a sprite name must be unique across all kind folders.
- Never write the Tiled map while the user may have it open: the user saves and closes it first; the script makes a dated backup and refuses to write if the file changed while it ran.
- Each of Pinefall Woods, Frostpeak, Stonewater Canyons and Sunscar Desert gets at least 20 patches; the whole map about 150 (130 to 170).
- Code style: every named JS function has a `/** */` comment in plain words; every test has a `//` line above it; Python uses a `#` comment above each `def`; run `npm run format` after JS edits.
- **Do not commit** unless the user asks: the working tree already holds much uncommitted work.
- Verify in the browser at `http://127.0.0.1:5173` only (never `localhost`, which holds the user's saves).

## Files

| File | Change |
| --- | --- |
| `tools/make-biome-standins.py` | make the `wild-herbs` stand-in sprite and prompt |
| `assets/world/source/objects.json` | `wild-herbs` entry |
| `assets/world/source/objects/plants/wild-herbs.png`, `.prompt.txt` | created by the script |
| `src/data/supplies.js` | `WILD['wild-herbs']` |
| `tests/actions/gather.test.js` | wild herbs take the full hand-pick time |
| `tools/build-map.py` | `HERBS` scatter pass |
| `tools/import-tiled-world.py` | read class-only point objects |
| `tools/add-tiled-herbs.py` | new: scatter herb points onto the Tiled map |
| `tools/tidy-tiled-world.py`, `tools/arrange-tiled-world.py` | name `wild-herbs` among the small pick-ups |
| `tests/world/nodes.test.js` | herb patches exist, give 3 herbs, fill the scarce regions |
| `assets/world/tiled/wildhaven-world-arranged.tmj`, `assets/world/map/*` | regenerated |
| `CLAUDE.md`, `docs/gdd.md`, `docs/verification.md` | docs |

---

### Task 1: The plant in the game's data, with stand-in art

**Files:**
- Modify: `assets/world/source/objects.json` (after the `wild-berries` line)
- Modify: `tools/make-biome-standins.py` (after the wild berries block, about line 176)
- Modify: `src/data/supplies.js` (`WILD`, after `flowers`)
- Test: `tests/actions/gather.test.js`

**Interfaces:**
- Produces: `WILD['wild-herbs']` = `{ type: 'herbs', amount: 3, label: 'Wild herbs', verb: 'Pick', clip: 'gather', regrow: 180 }`; sprite `wild-herbs` in `objects.json` (kind `plants`, origin `[0.5, 0.92]`, no footprint, no scale).

- [ ] **Step 1: Write the failing test**

In `tests/actions/gather.test.js`, add `WILD` to the existing import from `'../../src/data/supplies.js'` (add that import if the file has none), then add after the "picking up small stones and sticks" test:

```js
// Guards the second herb source: wild herbs are picked like berries (the full bare-hand time, no
// tool) and give more than a flower patch, so they are worth walking to.
test('wild herbs are picked by hand for 3 herbs in the full hand-pick time', () => {
  const game = createGame('scout');
  const herbs = { id: 'wild-herbs-0-0', sprite: 'wild-herbs', ...WILD['wild-herbs'] };

  assert.deepEqual(
    [herbs.type, herbs.amount, herbs.tool, herbs.quick, herbs.regrow],
    ['herbs', 3, undefined, undefined, 180],
  );
  assert.equal(gatherTime(game, herbs), GATHER_SECONDS);
  assert.ok(herbs.amount > WILD.flowers.amount);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test --test-name-pattern="wild herbs" tests/actions/gather.test.js`
Expected: FAIL (`WILD['wild-herbs']` is undefined, so `herbs.type` is undefined).

- [ ] **Step 3: Add the WILD entry**

In `src/data/supplies.js`, inside `WILD` right after the `flowers` entry:

```js
  // A leafy plant picked by hand, like berries. It gives more than a flower patch and grows mostly
  // where flowers are scarce (the pine woods, the snow, the canyons and the desert), so a player
  // far from the meadows can still heal and brew tea.
  'wild-herbs': {
    type: 'herbs',
    amount: 3,
    label: 'Wild herbs',
    verb: 'Pick',
    clip: 'gather',
    regrow: 180,
  },
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test --test-name-pattern="wild herbs" tests/actions/gather.test.js`
Expected: PASS.

- [ ] **Step 5: Add the sprite entry**

In `assets/world/source/objects.json`, add on its own line after the `"wild-berries"` line (keep one sprite per line):

```json
  "wild-herbs": { "kind": "plants", "origin": [0.5, 0.92] },
```

The stand-in is `tall-grass` sized (79×74), already smaller than the 76-unit player, so it needs no `scale`.

- [ ] **Step 6: Make the stand-in art**

In `tools/make-biome-standins.py`, after the `save(... obj('wild-berries') ...)` call:

```python
# ---- wild herbs (picked by hand) ------------------------------------------------------------
# The painted tall grass turned a darker, bluer green, so a herb patch can be told from plain grass (which
# can't be picked). A stand-in until the real plant is painted; the prompt asks for broad leaves.
save(recolor(sprite('tall-grass'), (0.62, 0.92, 0.9), (0, 8, 14)), obj('wild-herbs'),
     object_prompt('a small clump of wild medicinal herbs: broad soft sage-green leaves with a few tiny pale '
                   'purple flower spikes, clearly a leafy herb and not grass', 79, 74))
```

Run: `python tools/make-biome-standins.py`
Expected: a line `made objects\plants\wild-herbs.png`, every other line `kept ...`. Open the PNG with the Read tool and check it reads as a blue-green plant, clearly different from `tall-grass.png`. If it looks like plain grass, delete the two new files, push the tint further (for example `(0.5, 0.88, 0.95)`), and run again.

- [ ] **Step 7: Check the data tests**

Run: `node --test tests/world/objects.test.js tests/actions/gather.test.js tests/boundaries.test.js`
Expected: PASS (the sprite is in its kind folder with a prompt; its name is unique).

Run: `npm run format`

---

### Task 2: The scatter pass in `build-map.py`

**Files:**
- Modify: `tools/build-map.py` (new block after the sticks pass, about line 1064; the `busy_xy` line about 1080; the `objects = [...]` line about 1128)

**Interfaces:**
- Consumes: sprite `wild-herbs` in `objects.json` (Task 1).
- Produces: `herbs`, a list of `('wild-herbs', x, y)` in land units, included in the map's objects.

The generated map is not the one played (Task 4's import puts the Tiled map back), but the pass keeps the generator in step, so a later world-editor Rebuild still has herbs.

- [ ] **Step 1: Back up the played map**

Copy the folder `assets/world/map/` to the session scratchpad (`map-before-herbs/`). `build-map.py` overwrites it, and a crash can leave `tileset.png` half-written.

- [ ] **Step 2: Add the pass**

After the sticks loop (the line `sticks.append(('sticks', x, y))`):

```python
# Wild herbs: leafy plants picked with bare hands for herbs (WILD['wild-herbs'] in src/data/supplies.js). Flowers
# were the only herbs and grow almost only in the meadows, the lagoon and the jungle, so this pass does the
# opposite: most herbs in the pine woods, the snow, the canyons and the desert, a few elsewhere. The same kind of
# pass as the berries and sticks, with its own seeds, so adding it moved nothing else. The desert's ground is
# sand, so sand is allowed there; the sea beach (inland < BEACH) stays bare everywhere.
HERBS = {'P': 0.4, 'S': 0.2, 'C': 0.2, 'D': 0.18, 'J': 0.04, 'h': 0.05, 'L': 0.05}
HERB_STEP = 420
full_xy = np.array([(sx, sy) for _, sx, sy in fixed + stairs_objects + scattered + pebbles + berries + sticks], float)
herbs = []
for gy in range(HERB_STEP // 2 - 5 * HERB_STEP, LAND_H + PAD, HERB_STEP):
    for gx in range(HERB_STEP // 2 - 5 * HERB_STEP, LAND_W + PAD, HERB_STEP):
        rng = random.Random(gx * 83492791 ^ gy * 49979687 ^ 0x4e2b)
        x, y = gx + rng.randint(-120, 120), gy + rng.randint(-120, 120)
        k, ground, roll = region_key(x, y), terrain(x, y), rng.random()
        if (roll >= HERBS.get(k, 0) or not (60 - PAD < x < LAND_W + PAD - 60 and 120 - PAD < y < LAND_H + PAD - 30)
                or ground in (WATER, DIRT) or (ground == SAND and k != 'D') or inland(x, y) < BEACH
                or not on_flat(x, y, 60) or near_water(x, y, 60)
                or any(math.hypot(x - px, y - py) < 130 for px, py in POINTS)
                or any(math.hypot(x - bx_, y - by_) < 260 for bx_, by_ in BRIDGES)
                or any(l < x < r and t < y < b for l, t, r, b in fixed_bases)
                or (np.hypot(full_xy[:, 0] - x, full_xy[:, 1] - y) < 120).any() or on_path(x, y, PATH_DETAIL)): continue
        herbs.append(('wild-herbs', x, y))
print('wild herbs:', {k: sum(1 for _, x, y in herbs if region_key(x, y) == k) for k in HERBS})
```

Then add `+ herbs` to the two lists that name `sticks`:

- the `busy_xy = np.array([... + pebbles + berries + sticks], float)` line becomes `... + pebbles + berries + sticks + herbs], float)`;
- the `objects = [(n, x + PAD, y + PAD) for n, x, y in fixed + ... + sticks + finds + ripples]` line gets `+ herbs` after `sticks`.

- [ ] **Step 3: Run it and read the counts**

Run: `python tools/build-map.py` (about 30 s)
Expected: it ends without a traceback and prints `wild herbs: {'P': .., 'S': .., 'C': .., 'D': .., 'J': .., 'h': .., 'L': ..}`.

Wanted: `P`, `S`, `C` and `D` each 24 or more, the total between 130 and 170. If a scarce region is under 24, raise its share in `HERBS` by 0.05 and run again; if the total is over 170, lower `J`, `h` and `L` by 0.01 each. Shares are per region, so tuning one never moves another's patches.

- [ ] **Step 4: Check the generated map**

Run: `node --test tests/world/map.test.js tests/world/objects.test.js tests/world/edits.test.js tests/world/terrain.test.js`
Expected: PASS. (`nodes.test.js` and `places.test.js` are run after the import in Task 4; the map on disk is now the generated one, not the played one.)

If `build-map.py` crashes: restore `assets/world/map/` from the scratchpad copy, fix, and run again.

---

### Task 3: The importer reads class-only points

**Files:**
- Modify: `tools/import-tiled-world.py` (the object loop, about lines 204 to 222)

**Interfaces:**
- Produces: a Tiled object with **no `gid`**, `"point": true` and a Class (`type`) naming a game sprite is imported as that sprite at exactly its `x`, `y`, at its usual size. It is not drawn on the minimap picture.

Why: Tiled's sprite sheet (`wildhaven-sheet.png`) is older than some game sprites (it lacks `gold-ore` and `diamond-ore`), and rebuilding it would renumber every object tile in the hand-edited map. So herb patches go into Tiled as plain points with a Class, which need no tile. Today the importer would give such a point a size of 0 (`w / usual_width`) and shift it by its origin.

- [ ] **Step 1: Change the object loop**

In the loop `for o in l['objects']:`, replace the lines from `ox, oy = specs[name]['origin']; w, h = o['width'], o['height']` through `scale = w / usual_width(name)` with:

```python
        if 'gid' not in o:
            # A plain point with a Class and no picture (tools/add-tiled-herbs.py makes these): the point is the
            # spot where the thing meets the ground, and it is drawn at its usual size.
            if not o.get('point'): skipped[name] = skipped.get(name, 0) + 1; continue
            x, y, scale = o['x'], o['y'], 1
        else:
            ox, oy = specs[name]['origin']; w, h = o['width'], o['height']
            turn = math.radians(o.get('rotation', 0))
            dx, dy = (ox - 0.5) * w, (oy - 1) * h
            x = o['x'] + dx * math.cos(turn) - dy * math.sin(turn)
            y = o['y'] + dx * math.sin(turn) + dy * math.cos(turn)
            scale = w / usual_width(name)
        point = {'id': len(points) + 1, 'name': name, 'type': name, 'x': round(x), 'y': round(y), 'width': 0, 'height': 0,
                 'rotation': o.get('rotation', 0), 'point': True, 'visible': True}
```

(The `point = {...}` line moves below the `if`/`else`; delete its old copy.)

Then, at the end of the loop body, record the Tiled object for the minimap only when it has a picture. Replace

```python
        points.append(point); source_of[id(point)] = (l['name'], o)
```

with

```python
        points.append(point)
        # A point has no picture, and Tiled's renderer would draw it as a pin: it is left off the minimap.
        if 'gid' in o: source_of[id(point)] = (l['name'], o)
```

`overview_map` already leaves out any point that is not in `source_of` and whose sprite is not on Tiled's sheet (`p['name'] not in sheet_spots`), which is true of `wild-herbs`.

- [ ] **Step 2: Update the header**

In the docstring's `Outputs` part, after "every object as a point with its `scale` and turn", add: "(a Tiled point with a Class and no picture, such as a wild herb patch, is taken as it is, at its usual size)".

- [ ] **Step 3: Check nothing else changed**

The map on disk is the generated one from Task 2, so this run also puts the played map back.

Run: `python tools/import-tiled-world.py`
Expected: the usual report, `objects:` the same number as the last import (the Tiled map has no class-only points yet), no traceback.

Run: `git diff --stat -- assets/world/map/wildhaven.json`, then compare object names with the scratchpad backup:

```sh
python -c "import json,collections,sys; c=lambda f: collections.Counter(o['name'] for l in json.load(open(f))['layers'] if l['type']=='objectgroup' for o in l['objects']); a,b=c(sys.argv[1]),c('assets/world/map/wildhaven.json'); print({k:(a[k],b[k]) for k in a|b if a[k]!=b[k]} or 'same objects')" "<scratchpad>/map-before-herbs/wildhaven.json"
```

Expected: `same objects`. If anything differs, stop and find out why before going on (restore `assets/world/map/` from the backup if needed).

---

### Task 4: Scatter herb points onto the Tiled map, import, test

**Files:**
- Create: `tools/add-tiled-herbs.py`
- Modify: `tools/tidy-tiled-world.py:38` (`SMALL`), `tools/arrange-tiled-world.py:150` (`PICKUPS`)
- Modify: `assets/world/tiled/wildhaven-world-arranged.tmj` (by the script), `assets/world/map/*` (by the import)
- Test: `tests/world/nodes.test.js`

**Interfaces:**
- Consumes: the importer's class-only points (Task 3); `WILD['wild-herbs']` (Task 1).
- Produces: `NODES` entries with `sprite: 'wild-herbs'`, id `wild-herbs-<x>-<y>`.

- [ ] **Step 1: Write the failing test**

In `tests/world/nodes.test.js`, add `import { regionOf } from '../../src/world/regions.js';` to the imports. In the existing test `'flowers give herbs, driftwood and sticks give wood, ...'`:

- change its lead comment's "flowers are the only source of herbs" to "flowers and wild herbs are the sources of herbs";
- add `herbs = wild.filter((n) => n.sprite === 'wild-herbs'),` to the `const` list;
- add `herbs.length +` to the sum that must equal `wild.length`.

Then add a new test after it:

```js
// Guards the second herb source. Flowers grow almost only in the meadows, the lagoon and the
// jungle, so without wild herbs a player in the pine woods, the snow, the canyons or the desert
// cannot heal or brew the tea that holds off the cold.
test('wild herbs give 3 herbs and grow in every region that has few flowers', () => {
  const herbs = wild.filter((n) => n.sprite === 'wild-herbs');

  assert.ok(herbs.length >= 110 && herbs.length <= 180, `${herbs.length} patches`);
  for (const n of herbs) {
    assert.deepEqual([n.type, n.amount, n.tool, n.regrow], ['herbs', 3, undefined, 180], n.id);
    assert.equal(OBJECT_SPECS[n.sprite].footprint, undefined, 'walk-through');
  }

  for (const name of ['Pinefall Woods', 'Frostpeak', 'Stonewater Canyons', 'Sunscar Desert']) {
    const here = herbs.filter((n) => regionOf(n.x, n.y).name === name);
    assert.ok(here.length >= 20, `${name}: ${here.length}`);
  }
});
```

(If `wild` in that file is not the list of non-scenery map nodes, read its definition near the top and use the same list the flowers test uses.)

- [ ] **Step 2: Run it and see it fail**

Run: `node --test --test-name-pattern="wild herbs" tests/world/nodes.test.js`
Expected: FAIL with `0 patches`.

- [ ] **Step 3: Write the script**

Create `tools/add-tiled-herbs.py`:

```python
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
SHARE = {'P': 0.4, 'S': 0.2, 'C': 0.2, 'D': 0.18, 'J': 0.04, 'h': 0.05, 'L': 0.05}
STEP, JITTER = 420, 120        # one throw per STEP-unit square, landing up to JITTER from its middle
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
```

- [ ] **Step 4: Dry run and tune**

Run: `python tools/add-tiled-herbs.py --dry`
Expected: seven region lines and a total, nothing written.

Wanted: Pinefall Woods, Frostpeak, Stonewater Canyons and Sunscar Desert each 24 or more (the test's floor is 20; a few may be left out by the importer), the total between 130 and 170. Tune `SHARE` as in Task 2 Step 3 and rerun `--dry` until it holds. If a scarce region stays low even at a share of 0.9, lower `STEP` to 360 (this moves every patch) and tune again.

- [ ] **Step 5: Ask the user to save and close the map in Tiled**

Stop and ask: "Paki-save at isara ang `wildhaven-world-arranged.tmj` sa Tiled, tapos sabihin mo kapag tapos na." Do not run the next step until they confirm. Then note the file's modified time; it must not be newer than their confirmation by surprise.

- [ ] **Step 6: Add the patches and import**

Run: `python tools/add-tiled-herbs.py`
Expected: the same counts as the dry run, then `saved tiled\wildhaven-world-arranged.tmj ...`; a new `*.before-herbs.tmj` in `assets/world/tiled/backups/`.

Run: `python tools/import-tiled-world.py`
Expected: `objects:` higher than before by about the number of patches; `wild-herbs` is **not** listed under "objects the game has no sprite for"; any herbs under "objects left out" are few.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/world/nodes.test.js`
Expected: PASS, including the reach test (every wild patch can be walked to).

If the reach test names herb patches that can't be reached (a pocket shut in by trees or cliffs): raise `CLEAR` to 150 in the script, rerun Steps 4, 6 and 7. The script replaces its own points, so this is safe to repeat.

- [ ] **Step 8: Name the sprite in the other Tiled scripts**

In `tools/tidy-tiled-world.py`, add `'wild-herbs'` to the `SMALL` set (after `'wild-berries'`). In `tools/arrange-tiled-world.py`, add `'wild-herbs'` to `PICKUPS`. Both sets are matched against an object's Class, so they now cover the points.

Check `tidy-tiled-world.py` and `arrange-tiled-world.py` for code that reads `o['gid']`, `o['width']` or `o['height']` of every object in those sets without a guard (search for `['gid']` and `['width']`). Where a class-only point would crash or be moved by its zero size, skip objects without a `gid` with a one-line comment saying points have no box. Do not run either script.

- [ ] **Step 9: Full checks**

Run: `npm test`
Expected: all pass.

Run: `npm run format` then `npm run format:check` and `npm run build`
Expected: both succeed.

---

### Task 5: Play check and docs

**Files:**
- Modify: `CLAUDE.md`, `docs/gdd.md`, `docs/verification.md`

- [ ] **Step 1: Play it**

Start the `wildhaven` launch config (preview tools; `http://127.0.0.1:5173`). With the Scout (Pinefall start):

1. Find the nearest patch from the console-free route: read `NODES` positions through the test helper or walk; a quick way is a one-off Node line that prints the patch nearest the scout's spawn:
   `node -e "import('./src/world/nodes.js').then(async ({NODES})=>{const {CHARACTERS}=await import('./src/data/characters.js');const s=CHARACTERS.find(c=>c.id==='scout').spawn;const h=NODES.filter(n=>n.sprite==='wild-herbs').sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];console.log(h, Math.round(Math.hypot(h.x-s.x,h.y-s.y)))})"`
2. Walk there. Check: the plant is drawn at a sensible size beside the character, it can be walked through, in reach it glows with the E cap, hovering shows the herbs badge, the interact button reads "Pick wild herbs".
3. Press E: the bar runs about 6 s over the player's head, the toast reports 3 herbs, the herbs slot goes up by 3, the plant fades out.
4. Click a second patch from afar: the player walks to it and picks it.
5. No errors in the browser console.

Then with the Survivor or Builder, open the map (M) and confirm the minimap shows no stray pins or boxes where herbs stand. Take a screenshot of a patch in reach as proof.

If the plant looks too big or too small, set `"scale"` on its `objects.json` line (for example `0.8`), rerun `python tools/import-tiled-world.py` (not needed for scale alone: the game reads `objects.json` directly, so a reload is enough) and look again.

- [ ] **Step 2: Update `CLAUDE.md`**

- Commands block: add `python tools/add-tiled-herbs.py [--dry]   # scatter wild herb points onto the Tiled map (save and close it in Tiled first; then import-tiled-world.py)`.
- "Wild scenery is in the map and also harvestable" bullet: add `wild-herbs` ("Wild herbs": about 150 leafy plants, most in Pinefall, Frostpeak, the canyons and the desert, where flowers are scarce (`HERBS` in `build-map.py`; `tools/add-tiled-herbs.py` puts them on the Tiled map as points with the Class `wild-herbs`), each giving 3 herbs to bare hands in `GATHER_SECONDS` and regrowing in 180 s).
- Resources bullet: change "Herbs come only from wild flowers" to "Herbs come from wild flowers (2) and wild herb patches (3)".
- Fixed supplies bullet: add "wild herbs 3 herbs" to the list of what wild patches give.
- The Tiled paragraph ("The game now plays the map drawn in Tiled"): add one sentence: a Tiled point with a Class and no picture is imported as that sprite at its usual size and left off the minimap.

- [ ] **Step 3: Update `docs/gdd.md` and `docs/verification.md`**

In `docs/gdd.md`, find where herbs or wildflowers are described (search "herbs") and note the second source as **[Built]**: wild herb patches, 3 herbs, mostly in the flower-poor regions.

In `docs/verification.md`, add a dated entry (2026-11-20) with what Step 1 checked and its result, and the final per-region patch counts.

- [ ] **Step 4: Final checks**

Run: `npm test`, `npm run build`, `npm run format:check`
Expected: all pass. Report the per-region counts and the screenshot to the user, and say that nothing was committed.
