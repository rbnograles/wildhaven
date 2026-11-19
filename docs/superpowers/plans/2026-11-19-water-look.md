# Water Look (Shores, Depth and Gentle Motion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give sea, rivers and lakes their own shores, make water darker away from the shore, and add gentle motion (river streaks, sparkles, beach foam) without changing collision.

**Architecture:** `tools/build-map.py` gives every water corner a kind (sea, river, lake), draws each kind's shore into its own set of water tiles in a new `water-tileset.png`, adds a soft `depth` layer, and stores river lines and sea waterline points in the map file. A pure module (`src/world/water.js`) turns that data into flow directions and spawn spots; a browser module (`src/render/water.js`) draws pooled sprites from it. `src/world/map.js` learns to read the three water tile sets, so walking and sailing give the same answers as before.

**Tech Stack:** Python 3 (numpy, Pillow) for the map; vanilla JS ES modules; Phaser 4 (renderer only); `node:test`; Prettier 3.

**Spec:** `docs/superpowers/specs/2026-11-19-water-look-design.md`

## Before you start

- **Archipelago slice A1 must be merged into `main` first.** Check: `git log --oneline main | grep "Surround the home continent"` prints a commit. If it doesn't, stop: this plan edits the A1 versions of `tools/build-map.py`, `src/world/map.js` and `src/render/renderer.js`.
- Work on a new branch from `main`: `git switch -c water-look main` (or a worktree on that branch).
- Line numbers below were taken from branch `worktree-archipelago-a1` before its merge. Find each spot by the quoted code, not the number.
- Baseline: `npm test`, `npm run build` and `npm run format:check` pass before you change anything.
- Execution mode chosen by the user (2026-11-19): inline, with superpowers:executing-plans, one task at a time with a check-in after each.

## Global Constraints

- Collision must not change: every existing test passes, including `tests/world/places.test.js` (flood fill) and `tests/world/sea.test.js` (boat).
- Every tileset image is at most 4096 px wide and tall.
- Motion is gentle and only near the camera. With `prefers-reduced-motion` no effects are created; shores and depth still show.
- Effects advance with game time: they hold still while a dialog is open or the tab is hidden.
- Pure modules (`src/data/`, `src/world/`, `src/actions/`, `src/game/`, `src/animation/clips.js`) must not import `ui/`, `core/`, `render/`, `sheets.js`, `preview.js`, PNG or CSS files, and must not use `import.meta`, `document` or `window`, not even in comments (`tests/boundaries.test.js`).
- Repo code style (CLAUDE.md): a 2–4 line `//` header on each new file; an ELI5 `/** ... */` comment directly above every named function (`tests/comments.test.js`); a `//` line above every `test(...)` saying what it guards; `#` comments (not docstrings) above every Python `def`; run `npm run format` after editing; `npm run format:check` must pass.
- After any change to `tools/build-map.py`, run `python tools/build-map.py` and commit the regenerated files in `assets/world/map/` with the change.
- Browser checks use the `wildhaven` launch config at `127.0.0.1` with a test save, never the user's own saves.

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `tools/build-map.py` | Modify | Water kinds, `water-tileset.png`, shore styling, `depth` layer, `rivers`/`shores`/`waterKinds` properties |
| `assets/world/map/{tileset.png, water-tileset.png, wildhaven.json, overview.webp}` | Regenerated | Build output |
| `src/world/map.js` | Modify | Read the three water tile sets; `waterKindAt`, `WATER_KINDS`, `hasMapProperty` |
| `src/world/water.js` | Create | Pure: `RIVER_LINES`, `SHORES`, `flowAt`, `pickSpawns`, `shoresIn` |
| `src/data/balance.js` | Modify | `WATER_FX` tuning numbers |
| `src/render/water.js` | Create | Browser: pooled streak, sparkle and foam sprites |
| `src/render/renderer.js` | Modify | Load the second tileset, add the `depth` layer, run the water effects |
| `src/core/loop.js` | Modify | Tell the renderer when the game is paused |
| `tests/world/map.test.js` | Modify | `waterKindAt`, water masks, depth layer |
| `tests/world/tilesets.test.js` | Create | Tileset sizes and the map's tileset list |
| `tests/world/water.test.js` | Create | `flowAt`, `pickSpawns`, `shoresIn` |
| `CLAUDE.md`, `docs/art-direction.md`, `docs/gdd.md`, `docs/verification.md` | Modify | Docs |

---

### Task 1: Water kinds and the second tileset (no visible change yet)

Every water tile gets a kind and moves to `water-tileset.png`. All three kinds still look like today's water, so this task can be checked on its own: tests pass, collision is unchanged, and the game looks the same.

**Files:**
- Modify: `tools/build-map.py` (deep sea block ends near line 131; tileset section near lines 133–178; tile layers near 180–194; `tiled` dict near 256–272; overview near 276–293)
- Modify: `src/world/map.js` (constants near line 45–51; `cover` near 73–89)
- Modify: `src/render/renderer.js` (imports near line 17; `preload` near 118–125; `create` near 141–142)
- Test: `tests/world/map.test.js`, `tests/world/tilesets.test.js` (new)

**Interfaces:**
- Produces (Python, used by Tasks 2–4): `WATER_KINDS = ['sea', 'river', 'lake']`, `SEA_KIND, RIVER_KIND, LAKE_KIND`, grid `kind` (same shape as `corner`, `-1` for land), `tile_kind(ty, tx) -> int`, `mask_blend(mask) -> ndarray`, `variants(make, into=tiles)`, `save_sheet(tile_list, file_name) -> (width, height)`, `water_tiles` list, `SET = 240`, `first['water']`, `water_gid(k, mask, tx, ty) -> int`, `water_tile(name, mask, px, py) -> RGBA ndarray`.
- Produces (JS): `WATER_KINDS: string[]`, `waterKindAt(x, y): 'sea'|'river'|'lake'|null`, `hasMapProperty(name): boolean` from `src/world/map.js`. Map property `waterKinds` = `"sea,river,lake"`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/world/map.test.js` (extend the existing import from `../../src/world/map.js` with `waterKindAt` and `WATER_KINDS`, and add the other imports at the top of the file):

```js
import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };
// The raw places file: LANDMARKS in src/data/places.js leaves out each landmark's `pool` size.
import PLACES from '../../assets/world/source/places.json' with { type: 'json' };
```

```js
// Guards the three water tile sets: each water tile must decode to one of the kinds and a real corner pattern,
// or collision would read the wrong corners and let the player walk on water.
test('every water tile decodes to a kind and a corner pattern from 1 to 15', () => {
  const first = mapProperty('firstWaterGid'),
    water = MAP.layers.find((l) => l.name === 'water').data,
    seen = new Set();
  for (const gid of water) {
    if (!gid) continue;
    const kind = Math.floor((gid - first) / 240),
      mask = Math.floor(((gid - first) % 240) / 16) + 1;
    assert.ok(kind >= 0 && kind < WATER_KINDS.length, `gid ${gid}`);
    assert.ok(mask >= 1 && mask <= 15, `gid ${gid}`);
    seen.add(WATER_KINDS[kind]);
  }
  assert.deepEqual([...seen].sort(), ['lake', 'river', 'sea']);
});

// Guards waterKindAt on known spots, so river streaks and lake sparkles land on the right water.
test('waterKindAt tells sea, river, lake and dry land apart', () => {
  const PAD = mapProperty('seaBorder');
  // A bend of the Frostpeak river (RIVERS[0][1] in tools/build-map.py), far from any ford.
  assert.equal(waterKindAt(16200 + PAD, 4800 + PAD), 'river');
  // The open lagoon, east of the coast and away from the islets.
  assert.equal(waterKindAt(23000 + PAD, 9000 + PAD), 'sea');
  // The deep outer sea counts as sea too.
  assert.equal(waterKindAt(WORLD.margin + 20, WORLD.height / 2), 'sea');
  // Each landmark's pond (dug north of it by the map builder).
  for (const l of PLACES.landmarks.filter((l) => l.pool))
    assert.equal(waterKindAt(l.x, l.y - l.pool - 120), 'lake', l.id);
  // Dry land: every spawn, and a ford across the river (FORDS[0]).
  for (const c of CHARACTERS) assert.equal(waterKindAt(c.spawn.x, c.spawn.y), null, c.id);
  assert.equal(waterKindAt(16600 + PAD, 3650 + PAD), null);
  // Outside the world.
  assert.equal(waterKindAt(-50, 100), null);
});
```

Create `tests/world/tilesets.test.js`:

```js
// Checks the map's tileset pictures: their size and that the map file lists them correctly.
// Some graphics cards can't load a picture taller or wider than 4096 px, so a bigger
// tileset would leave the ground blank on those machines.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };

/**
 * Reads a PNG file's width and height from its header, without decoding the picture.
 *
 * @param {string} name - A file name in assets/world/map/.
 * @returns {{width: number, height: number}} The picture's size in pixels.
 */
function pngSize(name) {
  const bytes = readFileSync(new URL(`../../assets/world/map/${name}`, import.meta.url));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// Guards the 4096 px limit for both tileset pictures.
test('every tileset picture is at most 4096 px on each side', () => {
  for (const name of ['tileset.png', 'water-tileset.png']) {
    const { width, height } = pngSize(name);
    assert.ok(width <= 4096 && height <= 4096, `${name} is ${width}x${height}`);
  }
});

// Guards the map file's tileset list: the renderer loads exactly these two pictures, in this order,
// and the recorded sizes must match the real files or Phaser cuts the tiles in the wrong places.
test('the map lists the terrain and water tilesets with their real sizes', () => {
  assert.deepEqual(
    MAP.tilesets.map((t) => t.name),
    ['terrain', 'water'],
  );
  for (const t of MAP.tilesets) {
    const { width, height } = pngSize(t.image);
    assert.equal(t.imagewidth, width, t.name);
    assert.equal(t.imageheight, height, t.name);
  }
  assert.equal(MAP.tilesets[1].firstgid, MAP.tilesets[0].firstgid + MAP.tilesets[0].tilecount);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/world/map.test.js tests/world/tilesets.test.js`
Expected: FAIL. `waterKindAt` and `WATER_KINDS` are not exported, `water-tileset.png` does not exist, and the map lists one tileset.

- [ ] **Step 3: Give every water corner a kind (`tools/build-map.py`)**

Insert right after the deep sea block (after `corner[(corner == WATER) & ~near_land] = DEEP`):

```python
# ---- water kinds -------------------------------------------------------------------------
# Every water corner is sea, river or lake, so each kind can meet the land in its own way.
# The order is also the order of the three tile sets in water-tileset.png; src/world/map.js reads it as `waterKinds`.
WATER_KINDS = ['sea', 'river', 'lake']
SEA_KIND, RIVER_KIND, LAKE_KIND = range(3)
KIND_PRIORITY = [RIVER_KIND, LAKE_KIND, SEA_KIND]   # a tile whose water corners differ is drawn as the first kind it has

# Says which kind of water a water point is, from the rule in terrain() that made it water.
def water_kind(x, y):
    if any(line_dist(r, x, y) < RIVER_HALF + 60 for r in RIVERS): return RIVER_KIND
    if any(math.hypot(x - px, y - py) < r + 60 for px, py, r in POOLS): return LAKE_KIND
    if inland(x, y) < 0 or (region_key(x, y) == 'L' and x > coast(y)): return SEA_KIND
    return LAKE_KIND

kind = np.full(corner.shape, -1)   # -1 on land
for cy, cx in zip(*np.nonzero(corner >= WATER)):
    kind[cy, cx] = SEA_KIND if corner[cy, cx] == DEEP else water_kind(cx * TILE - PAD, cy * TILE - PAD)

# Picks the kind of water one tile is drawn as, from its four corners (see KIND_PRIORITY).
def tile_kind(ty, tx):
    found = {kind[ty, tx], kind[ty, tx + 1], kind[ty + 1, tx], kind[ty + 1, tx + 1]}
    return next(k for k in KIND_PRIORITY if k in found)
```

- [ ] **Step 4: Move water tiles into their own tileset (`tools/build-map.py`)**

Replace the tileset section from `tiles = []   # RGBA arrays; gid = index + 1` down to and including `Image.fromarray(sheet).save(os.path.join(OUT, 'tileset.png'))` with:

```python
tiles = []   # RGBA arrays for tileset.png; gid = index + 1

# Adds 16 tiles to a tile list, one for each 64px square of a 256px texture (4 across, 4 down).
def variants(make, into=tiles):
    for py in range(4):
        for px in range(4): into.append(make(px, py))

# Cuts one tile-sized square out of a bigger picture.
def cut(a, px, py): return a[py*TILE:(py+1)*TILE, px*TILE:(px+1)*TILE]

# How much of each pixel of a tile its corners cover, before noise: 1 at a covered corner, 0 at an empty one.
def mask_blend(mask):
    tl, tr, bl, br = mask & 1, mask >> 1 & 1, mask >> 2 & 1, mask >> 3 & 1
    return tl * (1 - U) * (1 - V) + tr * U * (1 - V) + bl * (1 - U) * V + br * U * V

first = {'ground': 1}
variants(lambda px, py: np.dstack([cut(tex['grass'], px, py), np.full((TILE, TILE), 255.0)]))
for name in OVERLAYS:
    if name == 'water': continue   # water tiles go in water-tileset.png (below)
    first[name] = len(tiles) + 1
    for mask in range(1, 16):   # which of the four tile corners (TL, TR, BL, BR) hold this terrain
        blend = mask_blend(mask)

        # Paints one edge tile: solid where the corners say so, fading out elsewhere, with noise for a natural edge.
        def make(px, py, blend=blend, name=name):
            val = blend + cut(noise, px, py) * 0.5
            alpha = np.clip((val - 0.5) / 0.05 + 0.5, 0, 1)
            return np.dstack([cut(tex[name], px, py), alpha * 255])
        variants(make)

# Picks the tileset number (gid) for one map square; 0 means empty.
def gid(name, mask, tx, ty): return 0 if mask == 0 else first[name] + (mask - 1) * 16 + (ty % 4) * 4 + tx % 4

# ---- water tileset -----------------------------------------------------------------------
# Water tiles live in their own picture, water-tileset.png, because tileset.png is close to the 4096 px size
# some graphics cards can't go past. Their tile numbers carry on after tileset.png's.
SET = 15 * 16      # tiles in one corner-pattern set: 15 corner patterns x 16 texture squares
water_tiles = []   # RGBA arrays for water-tileset.png
first['water'] = len(tiles) + 1

# Paints one water tile the way water has always looked: the texture with pale surf where it meets land.
def water_tile(name, mask, px, py):
    val = mask_blend(mask) + cut(noise, px, py) * 0.5
    alpha = np.clip((val - 0.5) / 0.05 + 0.5, 0, 1)
    foam = np.clip(1 - (val - 0.5) / 0.09, 0, 1)[..., None] * 0.75
    rgb = cut(tex['water'], px, py) * (1 - foam) + np.array([236, 250, 244.0]) * foam
    return np.dstack([rgb, alpha * 255])

for name in WATER_KINDS:
    for mask in range(1, 16):
        variants(lambda px, py, name=name, mask=mask: water_tile(name, mask, px, py), water_tiles)

# Picks the tile number for one square of the water layer: its kind's set, then corner pattern, then texture square.
def water_gid(k, mask, tx, ty): return first['water'] + k * SET + (mask - 1) * 16 + (ty % 4) * 4 + tx % 4

TS_COLS = 32; cell = TILE + 2

# Lays tiles out 32 to a row, each with a 1 px border copied from its own edge, saves the picture, and gives its size.
def save_sheet(tile_list, file_name):
    rows = math.ceil(len(tile_list) / TS_COLS)
    sheet = np.zeros((rows * cell, TS_COLS * cell, 4), dtype='uint8')
    for i, t in enumerate(tile_list):
        y, x = (i // TS_COLS) * cell, (i % TS_COLS) * cell
        sheet[y:y+cell, x:x+cell] = np.pad(t.astype('uint8'), ((1, 1), (1, 1), (0, 0)), mode='edge')   # extrusion stops seams when zoomed
    Image.fromarray(sheet).save(os.path.join(OUT, file_name))
    return sheet.shape[1], sheet.shape[0]

sheet_w, sheet_h = save_sheet(tiles, 'tileset.png')
water_w, water_h = save_sheet(water_tiles, 'water-tileset.png')
```

- [ ] **Step 5: Use the kind in the water layer and list both tilesets (`tools/build-map.py`)**

In the tile layers loop, replace `data.append(gid(name, mask, tx, ty))` with:

```python
            if name == 'water' and mask: data.append(water_gid(tile_kind(ty, tx), mask, tx, ty))
            else: data.append(gid(name, mask, tx, ty))
```

In the `tiled` dict, replace the `'tilesets': [...]` entry with:

```python
    'tilesets': [{'firstgid': 1, 'name': 'terrain', 'image': 'tileset.png', 'imagewidth': sheet_w, 'imageheight': sheet_h,
                  'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': TS_COLS, 'tilecount': len(tiles)},
                 {'firstgid': first['water'], 'name': 'water', 'image': 'water-tileset.png', 'imagewidth': water_w, 'imageheight': water_h,
                  'tilewidth': TILE, 'tileheight': TILE, 'margin': 1, 'spacing': 2, 'columns': TS_COLS, 'tilecount': len(water_tiles)}],
```

and add this entry to `'properties'` right after `firstDeepGid`:

```python
                   {'name': 'waterKinds', 'type': 'string', 'value': ','.join(WATER_KINDS)},
```

In the overview section, replace `for t in tiles]` at the end of the `small = [...]` line with `for t in tiles + water_tiles]`, and change the last line to:

```python
print(len(tiles), '+', len(water_tiles), 'water tiles,', len(objects), 'objects,', round(os.path.getsize(map_path) / 1e6, 1), 'MB map file')
```

- [ ] **Step 6: Rebuild the map**

Run: `python tools/build-map.py`
Expected: prints `1456 + 720 water tiles, ...` (A1 had 1696 tiles in one picture; its 240 water tiles became 720, three kinds of 240, in the new picture) and writes `assets/world/map/water-tileset.png`.

- [ ] **Step 7: Read the three tile sets in `src/world/map.js`**

Replace the constants block that starts `// A water tile records which of its corners` with:

```js
// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth
// shoreline. The deep layer does the same for open sea far from land. The water layer has one set
// of tiles per kind of water (sea, river, lake), one after another.
const TILE = MAP.tilewidth,
  SET = 15 * 16, // tiles in one corner-pattern set: 15 corner patterns x 16 texture squares
  water = layer('water').data,
  firstWater = mapProperty('firstWaterGid'),
  deep = layer('deep').data,
  firstDeep = mapProperty('firstDeepGid');

/** The kinds of water, in the order of their tile sets in the water layer (see tools/build-map.py). */
export const WATER_KINDS = mapProperty('waterKinds').split(',');
```

In `cover`, replace `const mask = Math.floor((gid - first) / 16) + 1,` with:

```js
  const mask = Math.floor(((gid - first) % SET) / 16) + 1,
```

Add after `mapProperty`:

```js
/**
 * Says whether tools/build-map.py stored a named value in the map file.
 *
 * Lets newer features read optional data without breaking on an older map file.
 *
 * @param {string} name - The property name, e.g. 'rivers'.
 * @returns {boolean} True if the map file has it.
 */
export const hasMapProperty = (name) => MAP.properties.some((p) => p.name === name);
```

Add after `isDeep`:

```js
/**
 * Says what kind of water is at a spot: 'sea', 'river', 'lake', or null on dry land.
 *
 * Each kind of water has its own set of tiles, so the tile's number says which kind it is,
 * like a colour-coded label. A spot only counts as water where walking would stop (0.35).
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {string|null} The kind of water, or null if the spot is dry or outside the world.
 */
export function waterKindAt(x, y) {
  if (!(x >= 0 && y >= 0 && x < WORLD.width && y < WORLD.height)) return null;
  if (waterAt(x, y) < 0.35) return null;
  const gid = water[Math.floor(y / TILE) * MAP.width + Math.floor(x / TILE)];
  return WATER_KINDS[Math.floor((gid - firstWater) / SET)];
}
```

- [ ] **Step 8: Load the second tileset in `src/render/renderer.js`**

Add after `import tilesetUrl from '../../assets/world/map/tileset.png';`:

```js
import waterTilesetUrl from '../../assets/world/map/water-tileset.png';
```

In `preload()`, after `this.load.image('terrain', tilesetUrl);`:

```js
        this.load.image('water-terrain', waterTilesetUrl);
```

In `create()`, replace the two lines that make `tiles` and the layers with:

```js
        // Two tileset pictures: land and deep sea in one, the water tiles in the other.
        const tiles = [
          map.addTilesetImage('terrain', 'terrain'),
          map.addTilesetImage('water', 'water-terrain'),
        ];
        TERRAIN_LAYERS.forEach((name, i) => map.createLayer(name, tiles, 0, 0).setDepth(i - 20));
```

- [ ] **Step 9: Run all tests**

Run: `npm run format`, then `npm test`
Expected: PASS, including the new tests, `places.test.js` and `sea.test.js`.

- [ ] **Step 10: Check the game looks the same**

Start the `wildhaven` launch config and open `http://127.0.0.1:5173` with a test save. Look at a river, a landmark pond and the beach: water must look exactly as before, with no missing or black tiles. No console errors.

- [ ] **Step 11: Commit**

```bash
git add tools/build-map.py src/world/map.js src/render/renderer.js tests/world/map.test.js tests/world/tilesets.test.js assets/world/map
git commit -m "Give water tiles a kind and move them to their own tileset"
```

---

### Task 2: Shores by kind (sandy beach, river bank, muddy lake)

**Files:**
- Modify: `tools/build-map.py` (replace `water_tile` from Task 1; add the `SHORE` table)

**Interfaces:**
- Consumes: `mask_blend`, `cut`, `noise`, `tex`, `variants`, `water_tiles`, `WATER_KINDS` (Task 1).
- Produces: `water_tile(name, mask, px, py)` keeps its signature; tile numbers and corner patterns do not change, so collision and `waterKindAt` are untouched.

- [ ] **Step 1: Add the shore table and helpers**

Insert just above `# Paints one water tile the way water has always looked` (and delete that old `water_tile` function):

```python
# ---- how each kind of water meets the land ----------------------------------------------
# Widths are in blend units: a blend goes from 0 to 1 across about one 64px tile. Strengths go from 0 (none) to 1.
# rim: the strip on the land side of the waterline. bottom/shallows: the bed showing through near the waterline.
# wall: rivers only, a short earth wall where the bank faces the camera. shadow: darker water right under the edge.
SHORE = {
    'sea':   {'rim': 'wet-sand', 'rim_width': 0.16, 'bottom': 'sand',  'shallows': 0.45, 'foam': 0.70, 'wall': False, 'shadow': 0.00},
    'river': {'rim': 'earth',    'rim_width': 0.10, 'bottom': 'earth', 'shallows': 0.30, 'foam': 0.15, 'wall': True,  'shadow': 0.35},
    'lake':  {'rim': 'mud',      'rim_width': 0.12, 'bottom': 'mud',   'shallows': 0.35, 'foam': 0.10, 'wall': False, 'shadow': 0.30},
}
WALL_PX, WALL_SHADE_PX = 14, 10   # how tall the river wall is, and how far its shadow reaches below it, in pixels
EXT = WALL_PX + WALL_SHADE_PX     # rows above a tile that the wall needs to look at
# Shore colours made from the existing textures until real art exists.
SHORE_TEX = {
    'sand': tex['sand'],
    'wet-sand': tex['sand'] * np.array([0.82, 0.80, 0.78]),
    'earth': tex['dirt'] * np.array([0.72, 0.62, 0.52]),
    'mud': (tex['dirt'] * 0.6 + tex['sand'] * 0.4) * np.array([0.62, 0.58, 0.50]),
}
UU, VU = np.meshgrid(u, (np.arange(-EXT, TILE) + 0.5) / TILE)   # a tile's pixel spots plus EXT rows above it

# Like mask_blend, but also EXT rows above the tile, carrying the same corner blend on past its top edge.
def mask_blend_up(mask):
    tl, tr, bl, br = mask & 1, mask >> 1 & 1, mask >> 2 & 1, mask >> 3 & 1
    return tl * (1 - UU) * (1 - VU) + tr * UU * (1 - VU) + bl * (1 - UU) * VU + br * UU * VU

# Cuts a tile-sized square out of a bigger seamless picture together with the EXT rows above it, wrapping round.
def cut_up(a, px, py):
    rows = np.arange(py * TILE - EXT, (py + 1) * TILE) % a.shape[0]
    return a[rows, px*TILE:(px+1)*TILE]

# Paints one water tile for one kind of water: rim on the land side, then shallows, shadow, (rivers) the bank wall, and foam.
def water_tile(name, mask, px, py):
    s = SHORE[name]
    up = mask_blend_up(mask) + cut_up(noise, px, py) * 0.5   # this tile's blend and the rows above it
    val = up[EXT:]                                             # just this tile's own pixels
    wet = np.clip((val - 0.5) / 0.05 + 0.5, 0, 1)             # how much of each pixel is water
    rgb = cut(tex['water'], px, py).copy()

    # Shallows: the bed shows through near the waterline and fades toward the middle.
    shallow = (np.clip(1 - (val - 0.5) / 0.35, 0, 1) * s['shallows'])[..., None]
    rgb = rgb * (1 - shallow) + (cut(SHORE_TEX[s['bottom']], px, py) * 1.05 + 10) * shallow

    # Shadow: the water is darker right under the edge of the land.
    rgb *= 1 - (np.clip(1 - (val - 0.5) / 0.25, 0, 1) * s['shadow'])[..., None]

    # River wall: for each water pixel, how many rows below the nearest land straight above it (0 when none within EXT).
    wall = np.zeros(val.shape, dtype=bool)
    if s['wall']:
        below = np.zeros(val.shape)
        for k in range(EXT, 0, -1):   # far to near, so the nearest land wins
            below[up[EXT - k:EXT - k + TILE] < 0.5] = k
        in_water = val >= 0.5
        wall = in_water & (below > 0) & (below <= WALL_PX)
        wall_rgb = cut(SHORE_TEX['earth'], px, py) * (0.85 - 0.4 * (below / WALL_PX))[..., None]   # lit at the top, dark at the foot
        rgb = np.where(wall[..., None], wall_rgb, rgb)
        shade = in_water & (below > WALL_PX)
        rgb *= 1 - (shade * 0.35 * (1 - (below - WALL_PX) / WALL_SHADE_PX))[..., None]

    # Foam: a thin pale line at the waterline (not on the wall).
    foam = (np.clip(1 - (val - 0.5) / 0.04, 0, 1) * s['foam'] * ~wall)[..., None]
    rgb = rgb * (1 - foam) + np.array([238, 250, 244.0]) * foam

    # Rim: wet sand, earth or mud on the land side, fading away from the waterline.
    rim = np.clip(1 - (0.5 - val) / s['rim_width'], 0, 1) * (val < 0.5) * 0.9
    alpha = wet + rim * (1 - wet)
    mixed = rgb * wet[..., None] + cut(SHORE_TEX[s['rim']], px, py) * (rim * (1 - wet))[..., None]
    return np.dstack([mixed / np.maximum(alpha, 1e-6)[..., None], alpha * 255])
```

- [ ] **Step 2: Rebuild the map and run the tests**

Run: `python tools/build-map.py`, then `npm test`
Expected: the build prints the same tile counts as Task 1; all tests PASS (tile numbers did not change).

- [ ] **Step 3: Look at the tiles**

Open `assets/world/map/water-tileset.png`. Expected: rows 1–8 (sea) with a pale foam line and a sandy band on the transparent side; rows 9–15 (river) with a brown lip, and on tiles with water below land (for example corner pattern 12: bottom-left and bottom-right water), a brown wall band just under the waterline with a shadow under it; rows 16–23 (lake) with a muddy band and soft shadow.

- [ ] **Step 4: Check in the game**

Reload `http://127.0.0.1:5173` (test save). Check a river bend where the bank runs east–west (wall visible), a river edge running north–south (lip and shadow only), a landmark pond, and the beach. Zoom with the browser's zoom out and in: rims and walls must line up across tile edges without seams. No console errors.

- [ ] **Step 5: Commit**

```bash
git add tools/build-map.py assets/world/map
git commit -m "Draw sandy beaches, earth river banks and muddy lake edges"
```

---

### Task 3: The depth layer

**Files:**
- Modify: `tools/build-map.py` (after the water kinds block; water tileset section; tile layers; `tiled` dict; overview)
- Modify: `src/render/renderer.js` (`TERRAIN_LAYERS` near line 36)
- Test: `tests/world/map.test.js`

**Interfaces:**
- Consumes: `corner`, `WATER`, `variants`, `water_tiles`, `first`, `gid` (Task 1).
- Produces: map layer `depth` (between `water` and `deep`) and property `firstDepthGid`. `LAYER_ORDER` in the script.

- [ ] **Step 1: Write the failing test**

Add to `tests/world/map.test.js`:

```js
// Guards the depth layer: it may only darken water (never dry land), and the rivers must really get
// a darker middle, or the depth effect silently disappears after a map change.
test('the depth layer only covers water corners and darkens the rivers', () => {
  const tiles = (name) => MAP.layers.find((l) => l.name === name).data;
  const water = tiles('water'),
    depth = tiles('depth'),
    firstWater = mapProperty('firstWaterGid'),
    firstDepth = mapProperty('firstDepthGid');
  let riverDepth = 0;
  depth.forEach((gid, i) => {
    if (!gid) return;
    const waterGid = water[i];
    assert.ok(waterGid, `depth without water at tile ${i}`);
    const depthMask = Math.floor((gid - firstDepth) / 16) + 1,
      waterMask = Math.floor(((waterGid - firstWater) % 240) / 16) + 1;
    assert.equal(depthMask & ~waterMask, 0, `tile ${i}`);
    if (Math.floor((waterGid - firstWater) / 240) === WATER_KINDS.indexOf('river')) riverDepth++;
  });
  assert.ok(riverDepth > 50, `${riverDepth} river tiles have depth`);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/world/map.test.js`
Expected: FAIL (there is no `depth` layer, so `.data` of undefined throws).

- [ ] **Step 3: Work out which corners look deep (`tools/build-map.py`)**

Insert after the water kinds block (after `tile_kind`):

```python
# ---- depth -------------------------------------------------------------------------------
# A water corner looks deep when no land is within DEPTH_FROM. Found with the same round stamp as the deep sea.
# This is only how it looks: walking and sailing don't read it.
DEPTH_FROM = 70      # world units from land
DEPTH_ALPHA = 0.55   # how dark the depth tint gets at its strongest
reach_d = DEPTH_FROM / TILE; Rd = max(1, int(reach_d))
land_d = np.pad(corner < WATER, Rd)
near_d = np.zeros(corner.shape, dtype=bool)
for dy in range(-Rd, Rd + 1):
    for dx in range(-Rd, Rd + 1):
        if dx * dx + dy * dy <= reach_d * reach_d:
            near_d |= land_d[Rd + dy:Rd + dy + corner.shape[0], Rd + dx:Rd + dx + corner.shape[1]]
is_depth = (corner >= WATER) & ~near_d
```

- [ ] **Step 4: Add the depth tiles (`tools/build-map.py`)**

Insert right after the `for name in WATER_KINDS:` loop that fills `water_tiles`:

```python
first['depth'] = first['water'] + len(WATER_KINDS) * SET
depth_rgb = tex['water'] * np.array([0.45, 0.70, 0.80])
for mask in range(1, 16):
    blend = mask_blend(mask)

    # Paints one depth tile: a dark tint that follows the corner blend smoothly, with no hard edge.
    def make(px, py, blend=blend): return np.dstack([cut(depth_rgb, px, py), np.clip(blend, 0, 1) * DEPTH_ALPHA * 255])
    variants(make, water_tiles)
```

- [ ] **Step 5: Write the depth layer and put it in order (`tools/build-map.py`)**

After the tile layers loop (after `layers[name] = data`), add:

```python
# The depth layer: a corner pattern of the corners that look deep.
layers['depth'] = [gid('depth', sum(int(is_depth[cy, cx]) << i for i, (cy, cx) in enumerate(((ty, tx), (ty, tx + 1), (ty + 1, tx), (ty + 1, tx + 1)))), tx, ty)
                   for ty in range(ROWS) for tx in range(COLS)]
# Bottom to top. src/render/renderer.js draws TERRAIN_LAYERS in this same order.
LAYER_ORDER = ['ground', 'dirt', 'jungle', 'rock', 'snow', 'sand', 'water', 'depth', 'deep']
```

In the `tiled` dict: change `'nextlayerid': len(OVERLAYS) + 3` to `'nextlayerid': len(LAYER_ORDER) + 2`; in `'layers'`, change `for i, n in enumerate(['ground'] + OVERLAYS)` to `for i, n in enumerate(LAYER_ORDER)` and `'id': len(OVERLAYS) + 2` (the objects layer) to `'id': len(LAYER_ORDER) + 1`. Add to `'properties'` after `waterKinds`:

```python
                   {'name': 'firstDepthGid', 'type': 'int', 'value': first['depth']},
```

In the overview section, change `for n in ['ground'] + OVERLAYS:` to `for n in LAYER_ORDER:`.

- [ ] **Step 6: Draw the layer (`src/render/renderer.js`)**

```js
const TERRAIN_LAYERS = ['ground', 'dirt', 'jungle', 'rock', 'snow', 'sand', 'water', 'depth', 'deep'];
```

- [ ] **Step 7: Rebuild, format and test**

Run: `python tools/build-map.py`, `npm run format`, `npm test`
Expected: the build prints `... + 960 water tiles, ...`; all tests PASS.

- [ ] **Step 8: Check in the game**

Reload with a test save. Expected: rivers darken smoothly toward the middle, lakes toward their centre, the sea beyond the shallows; the `deep` sea still looks darkest. No hard tile edges in the tint. No console errors.

- [ ] **Step 9: Commit**

```bash
git add tools/build-map.py src/render/renderer.js tests/world/map.test.js assets/world/map
git commit -m "Darken water away from the shore with a depth layer"
```

---

### Task 4: Motion data and the pure water module

**Files:**
- Modify: `tools/build-map.py` (before `tiled = {`; `'properties'`)
- Create: `src/world/water.js`
- Modify: `src/data/balance.js` (end of file)
- Test: `tests/world/water.test.js` (new)

**Interfaces:**
- Consumes: `waterKindAt`, `mapProperty`, `hasMapProperty` (Task 1); `tile_kind`, `SEA_KIND` (Task 1, Python).
- Produces: map properties `rivers` (JSON string `{"half": number, "lines": [[[x, y], ...], ...]}`, world units, upstream to downstream) and `shores` (JSON string `[[x, y, dx, dy], ...]`). From `src/world/water.js`: `RIVER_LINES: number[][][]`, `SHORES: number[][]`, `flowAt(x, y): {dx, dy, centre} | null`, `pickSpawns(view, kind, count, random): {x, y}[]`, `shoresIn(view): {i, x, y, dx, dy}[]`, where `view` is `{left, top, right, bottom}`. From `src/data/balance.js`: `WATER_FX`.

- [ ] **Step 1: Write the failing tests**

Create `tests/world/water.test.js`:

```js
// Checks the maths behind the gentle water motion: which way rivers flow, where effects may start,
// and the sea's waterline points. If these break, river streaks could flow uphill or appear on dry land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIVER_LINES, SHORES, flowAt, pickSpawns, shoresIn } from '../../src/world/water.js';
import { waterKindAt, mapProperty } from '../../src/world/map.js';

/**
 * Makes a small repeatable random number generator, so a test checks the same spots every run.
 *
 * @param {number} seed - Where the sequence starts.
 * @returns {() => number} A function giving numbers from 0 up to 1.
 */
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/**
 * Makes a square box around a point.
 *
 * @param {number} x - The box's centre x.
 * @param {number} y - The box's centre y.
 * @param {number} half - Half the box's width.
 * @returns {{left: number, top: number, right: number, bottom: number}} The box.
 */
const around = (x, y, half) => ({ left: x - half, top: y - half, right: x + half, bottom: y + half });

// Guards the current's direction: at the middle of every straight piece of both rivers, the flow points downstream.
test('flowAt points downstream along both rivers', () => {
  assert.equal(RIVER_LINES.length, 2);
  for (const line of RIVER_LINES)
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i],
        [bx, by] = line[i + 1],
        len = Math.hypot(bx - ax, by - ay),
        f = flowAt((ax + bx) / 2, (ay + by) / 2);
      assert.ok(f.dx * ((bx - ax) / len) + f.dy * ((by - ay) / len) > 0.99, `piece ${i}`);
    }
});

// Guards "faster in the middle": the middle line is centre 1, partway to the bank is lower, past the bank is 0.
test('flowAt says how close a spot is to the middle of the river', () => {
  const [ax, ay] = RIVER_LINES[0][1],
    [bx, by] = RIVER_LINES[0][2],
    len = Math.hypot(bx - ax, by - ay),
    nx = -(by - ay) / len,
    ny = (bx - ax) / len,
    mx = (ax + bx) / 2,
    my = (ay + by) / 2;
  assert.ok(flowAt(mx, my).centre > 0.99);
  assert.ok(flowAt(mx + nx * 60, my + ny * 60).centre < 0.6);
  assert.equal(flowAt(mx + nx * 500, my + ny * 500).centre, 0);
});

// Guards where streaks may start: inside the box, on river water only, and never more than asked.
test('pickSpawns keeps spots inside the box and on the asked kind of water', () => {
  const [x, y] = RIVER_LINES[0][1],
    view = around(x, y, 600),
    spots = pickSpawns(view, 'river', 20, seeded(3));
  assert.ok(spots.length > 5 && spots.length <= 20, `${spots.length} spots`);
  for (const s of spots) {
    assert.ok(s.x >= view.left && s.x <= view.right && s.y >= view.top && s.y <= view.bottom);
    assert.equal(waterKindAt(s.x, s.y), 'river');
  }
});

// Guards repeatability: the same random numbers give the same spots.
test('pickSpawns gives the same spots for the same random numbers', () => {
  const [x, y] = RIVER_LINES[0][1];
  assert.deepEqual(
    pickSpawns(around(x, y, 600), 'river', 10, seeded(9)),
    pickSpawns(around(x, y, 600), 'river', 10, seeded(9)),
  );
});

// Guards the fords: a ford is dry ground across the river, so no streak may start on it.
test('pickSpawns never puts a river spot on a ford', () => {
  const PAD = mapProperty('seaBorder'),
    ford = { x: 16600 + PAD, y: 3650 + PAD }; // FORDS[0] in tools/build-map.py
  for (const s of pickSpawns(around(ford.x, ford.y, 400), 'river', 40, seeded(5)))
    assert.ok(Math.hypot(s.x - ford.x, s.y - ford.y) > 150, `${s.x},${s.y}`);
});

// Guards the beach foam: points found are inside the box, and each one's direction leads into the sea.
test('shoresIn lists waterline points whose direction points to the sea', () => {
  assert.ok(SHORES.length > 300, `${SHORES.length} shore points`);
  const [x, y] = SHORES[0],
    view = around(x, y, 1500),
    found = shoresIn(view);
  assert.ok(found.length > 5, `${found.length} found`);
  let wet = 0;
  for (const p of found) {
    assert.ok(p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom);
    assert.ok(Math.abs(Math.hypot(p.dx, p.dy) - 1) < 0.01);
    if (waterKindAt(p.x + p.dx * 80, p.y + p.dy * 80) === 'sea') wet++;
  }
  assert.ok(wet >= found.length * 0.8, `${wet} of ${found.length} point to the sea`);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world/water.test.js`
Expected: FAIL with a module-not-found error for `src/world/water.js`.

- [ ] **Step 3: Store the river lines and waterline points (`tools/build-map.py`)**

Insert just before `tiled = {`:

```python
# ---- motion data -------------------------------------------------------------------------
# What the game needs to move water gently (src/world/water.js reads both, in WORLD units):
# `rivers`: each river's line from upstream to downstream and its half width, for the current's direction;
# `shores`: points along the sea's waterline about every 128 units, each with the direction toward the water.
rivers_data = {'half': RIVER_HALF, 'lines': [[[x + PAD, y + PAD] for x, y in r] for r in RIVERS]}
shores = []
for ty in range(ROWS):
    for tx in range(COLS):
        if (tx + ty) % 2: continue   # every other tile, so neighbouring points are about 128 units apart
        wet = [corner[ty, tx] >= WATER, corner[ty, tx + 1] >= WATER, corner[ty + 1, tx] >= WATER, corner[ty + 1, tx + 1] >= WATER]
        if all(wet) or not any(wet) or tile_kind(ty, tx) != SEA_KIND: continue
        tl, tr, bl, br = (float(w) for w in wet)
        dx, dy = (tr + br) - (tl + bl), (bl + br) - (tl + tr)
        n = math.hypot(dx, dy)
        if n == 0: continue   # two opposite corners wet: no single direction to the sea
        shores.append([round((tx + 0.5) * TILE), round((ty + 0.5) * TILE), round(dx / n, 3), round(dy / n, 3)])
```

Add to `'properties'` after `firstDepthGid`:

```python
                   {'name': 'rivers', 'type': 'string', 'value': json.dumps(rivers_data, separators=(',', ':'))},
                   {'name': 'shores', 'type': 'string', 'value': json.dumps(shores, separators=(',', ':'))},
```

Run: `python tools/build-map.py`
Expected: same tile counts as Task 3; `wildhaven.json` grows by tens of kilobytes at most.

- [ ] **Step 4: Add the tuning numbers to `src/data/balance.js`**

Append:

```js
/**
 * How the gentle water motion behaves (src/render/water.js). Counts are the most on screen at
 * once, speeds are world units per second, lifetimes and periods are seconds, and travel is world units.
 * [low, high] pairs are ranges each effect picks a value from.
 */
export const WATER_FX = {
  margin: 200, // effects may start this far outside the camera, so they don't pop in at the edge
  streaks: 24, // river current streaks
  streakSpeed: [25, 45], // at the bank, and in the middle of the river
  streakLife: [2, 3],
  sparkles: 16, // on lakes, plus a few at sea
  seaSparkleShare: 0.25, // the part of new sparkles that go to the sea instead of a lake
  sparkleLife: [1.5, 3],
  foam: 80, // foam strokes along the beach
  foamTravel: [8, 12], // how far a foam stroke slides in and out
  foamPeriod: [3.5, 5.5], // seconds for one slide in and out
};
```

- [ ] **Step 5: Create `src/world/water.js`**

```js
// Where the gentle water motion may go: which way each river flows, where the sea's waterline is,
// and random spots of one kind of water near the camera. src/render/water.js draws the effects;
// this file only does the maths, so the tests can run it.

import { hasMapProperty, mapProperty, waterKindAt } from './map.js';

// Each river's line from upstream to downstream and its half width (tools/build-map.py). An older map has none.
const RIVER_DATA = hasMapProperty('rivers')
  ? JSON.parse(mapProperty('rivers'))
  : { half: 1, lines: [] };

/** The rivers as lines of [x, y] points from upstream to downstream, in world units. */
export const RIVER_LINES = RIVER_DATA.lines;

/** Points along the sea's waterline as [x, y, dx, dy]: a position and the direction toward the water. */
export const SHORES = hasMapProperty('shores') ? JSON.parse(mapProperty('shores')) : [];

/**
 * Says which way the river flows at a spot, and how close the spot is to the river's middle.
 *
 * We find the nearest straight piece of any river line, like laying a ruler along the river,
 * and use its downstream direction. `centre` is 1 on the middle line and 0 at the bank or beyond.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {{dx: number, dy: number, centre: number}|null} A one-unit-long direction and the
 *   closeness to the middle, or null when the map has no rivers.
 */
export function flowAt(x, y) {
  let best = null;
  for (const line of RIVER_LINES)
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i],
        [bx, by] = line[i + 1],
        sx = bx - ax,
        sy = by - ay,
        len2 = sx * sx + sy * sy,
        t = Math.max(0, Math.min(1, ((x - ax) * sx + (y - ay) * sy) / len2)),
        dist = Math.hypot(x - ax - t * sx, y - ay - t * sy);
      if (!best || dist < best.dist) best = { dist, sx, sy, len: Math.sqrt(len2) };
    }
  if (!best) return null;
  return {
    dx: best.sx / best.len,
    dy: best.sy / best.len,
    centre: Math.max(0, 1 - best.dist / RIVER_DATA.half),
  };
}

/**
 * Picks random spots of one kind of water inside a box, such as the area around the camera.
 *
 * It throws darts at the box and keeps the ones that land in the right water. After eight
 * throws per spot wanted it stops, so a box with little or no such water gives fewer spots.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} view - The box, in world units.
 * @param {string} kind - 'sea', 'river' or 'lake'.
 * @param {number} count - The most spots wanted.
 * @param {() => number} random - Gives a number from 0 up to 1, like Math.random. Tests pass a repeatable one.
 * @returns {{x: number, y: number}[]} Up to `count` spots.
 */
export function pickSpawns(view, kind, count, random) {
  const spots = [];
  for (let tries = 0; tries < count * 8 && spots.length < count; tries++) {
    const x = view.left + random() * (view.right - view.left),
      y = view.top + random() * (view.bottom - view.top);
    if (waterKindAt(x, y) === kind) spots.push({ x, y });
  }
  return spots;
}

/**
 * Lists the sea's waterline points inside a box.
 *
 * Each point keeps its index `i`, so the renderer can give every point its own wave timing.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} view - The box, in world units.
 * @returns {{i: number, x: number, y: number, dx: number, dy: number}[]} The points inside the box.
 */
export function shoresIn(view) {
  const found = [];
  SHORES.forEach(([x, y, dx, dy], i) => {
    if (x >= view.left && x <= view.right && y >= view.top && y <= view.bottom)
      found.push({ i, x, y, dx, dy });
  });
  return found;
}
```

- [ ] **Step 6: Run the tests**

Run: `npm run format`, then `npm test`
Expected: PASS, including `tests/world/water.test.js`, `tests/boundaries.test.js` and `tests/comments.test.js`.

- [ ] **Step 7: Commit**

```bash
git add tools/build-map.py src/world/water.js src/data/balance.js tests/world/water.test.js assets/world/map
git commit -m "Store river lines and sea waterline points for water motion"
```

---

### Task 5: Draw the gentle motion

**Files:**
- Create: `src/render/water.js`
- Modify: `src/render/renderer.js` (imports; `let` list near line 83; end of `create()`; `draw` near 391–430; doc comment near 62)
- Modify: `src/core/loop.js` (near line 123–124)

**Interfaces:**
- Consumes: `WATER_FX` (Task 4), `waterKindAt` (Task 1), `flowAt`, `pickSpawns`, `shoresIn` (Task 4).
- Produces: `createWaterEffects(scene, reducedMotion): { update(view, dt) }` from `src/render/water.js`. `renderer.draw(state, dt, animator, paused)` gains a 4th parameter.

- [ ] **Step 1: Create `src/render/water.js`**

```js
// Draws the gentle water motion: current streaks drifting down rivers, sparkles on lakes and a few
// at sea, and foam lapping at the beach. src/world/water.js decides where each effect may go; this
// file only draws them, reusing a fixed set of sprites instead of making new ones every frame.

import { WATER_FX } from '../data/balance.js';
import { waterKindAt } from '../world/map.js';
import { flowAt, pickSpawns, shoresIn } from '../world/water.js';

// Drawn above the ground layers (depths -20 to -12) and below flat props (-1) and standing things (their y).
const FX_DEPTH = -11;

/**
 * Picks a random number inside a [low, high] range from WATER_FX.
 *
 * @param {number[]} range - The lowest and highest value.
 * @returns {number} A number between them.
 */
const between = ([low, high]) => low + Math.random() * (high - low);

/**
 * Says whether a point is inside a box.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} view - The box.
 * @param {number} x - The point's x.
 * @param {number} y - The point's y.
 * @returns {boolean} True if the point is inside.
 */
const inside = (view, x, y) => x >= view.left && x <= view.right && y >= view.top && y <= view.bottom;

/**
 * Paints one small white picture in code and stores it as a texture, so no art file is needed.
 *
 * @param {Phaser.Scene} scene - The world scene.
 * @param {string} key - The texture's name.
 * @param {number} w - Width in pixels.
 * @param {number} h - Height in pixels.
 * @param {(ctx: CanvasRenderingContext2D) => void} paint - Draws the shape in white.
 */
function makeTexture(scene, key, w, h, paint) {
  const texture = scene.textures.createCanvas(key, w, h),
    ctx = texture.getContext();
  ctx.fillStyle = ctx.strokeStyle = '#ffffff';
  paint(ctx);
  texture.refresh();
}

/**
 * Makes a fixed set of hidden sprites for one effect, ready to be reused.
 *
 * Like a box of stage props: when one effect ends, its sprite goes back in the box until the
 * next one needs it, so the game never piles up new sprites.
 *
 * @param {Phaser.Scene} scene - The world scene.
 * @param {string} key - The texture every sprite uses.
 * @param {number} size - How many sprites.
 * @returns {object[]} Slots of `{sprite, x, y, age, life, live}`.
 */
function pool(scene, key, size) {
  return Array.from({ length: size }, () => ({
    sprite: scene.add.image(0, 0, key).setDepth(FX_DEPTH).setVisible(false),
    x: 0,
    y: 0,
    age: 0,
    life: 1,
    live: false,
  }));
}

/**
 * Hides a slot's sprite and puts it back in the box.
 *
 * @param {object} slot - One slot from a pool.
 */
function retire(slot) {
  slot.live = false;
  slot.sprite.setVisible(false);
}

/**
 * Starts effects in idle slots at the given spots.
 *
 * @param {object[]} slots - The pool.
 * @param {{x: number, y: number}[]} spots - Where new effects start (at most one per idle slot).
 * @param {number[]} life - The [low, high] lifetime range in seconds.
 */
function start(slots, spots, life) {
  const idle = slots.filter((s) => !s.live);
  spots.slice(0, idle.length).forEach((spot, i) =>
    Object.assign(idle[i], { x: spot.x, y: spot.y, age: 0, life: between(life), live: true }),
  );
}

/**
 * Moves the river streaks downstream, fades them in and out, and starts new ones where some ended.
 *
 * @param {object[]} streaks - The streak pool.
 * @param {object} view - The area around the camera, in world units.
 * @param {number} dt - Seconds since the last frame (0 while paused, so nothing moves).
 */
function updateStreaks(streaks, view, dt) {
  const idle = streaks.filter((s) => !s.live).length;
  if (idle) start(streaks, pickSpawns(view, 'river', idle, Math.random), WATER_FX.streakLife);

  const [slow, fast] = WATER_FX.streakSpeed;
  for (const s of streaks) {
    if (!s.live) continue;
    s.age += dt;
    const flow = flowAt(s.x, s.y);
    if (!flow || s.age >= s.life || !inside(view, s.x, s.y) || waterKindAt(s.x, s.y) !== 'river') {
      retire(s);
      continue;
    }
    const speed = slow + (fast - slow) * flow.centre;
    s.x += flow.dx * speed * dt;
    s.y += flow.dy * speed * dt;
    // The streak picture points down (+y); turn it to point along the current.
    s.sprite
      .setPosition(s.x, s.y)
      .setRotation(Math.atan2(flow.dy, flow.dx) - Math.PI / 2)
      .setAlpha(Math.sin((Math.PI * s.age) / s.life) * 0.5)
      .setVisible(true);
  }
}

/**
 * Twinkles the sparkles (grow, shine, fade) and starts new ones on lakes and, now and then, at sea.
 *
 * @param {object[]} sparkles - The sparkle pool.
 * @param {object} view - The area around the camera, in world units.
 * @param {number} dt - Seconds since the last frame (0 while paused).
 */
function updateSparkles(sparkles, view, dt) {
  const idle = sparkles.filter((s) => !s.live).length;
  if (idle) {
    const atSea = Math.round(idle * WATER_FX.seaSparkleShare);
    start(
      sparkles,
      [
        ...pickSpawns(view, 'lake', idle - atSea, Math.random),
        ...pickSpawns(view, 'sea', atSea, Math.random),
      ],
      WATER_FX.sparkleLife,
    );
  }

  for (const s of sparkles) {
    if (!s.live) continue;
    s.age += dt;
    if (s.age >= s.life || !inside(view, s.x, s.y)) {
      retire(s);
      continue;
    }
    const glow = Math.sin((Math.PI * s.age) / s.life);
    s.sprite
      .setPosition(s.x, s.y)
      .setScale(0.6 + 0.6 * glow)
      .setAlpha(glow * 0.8)
      .setVisible(true);
  }
}

/**
 * Puts one foam stroke on each sea waterline point near the camera and slides it in and out.
 *
 * Each point gets its own speed and timing from a fixed number made from its index, so the
 * beach never moves all at once, and the same point always behaves the same way.
 *
 * @param {object[]} foam - The foam pool.
 * @param {object} view - The area around the camera, in world units.
 * @param {number} time - Seconds of game time since the effects started.
 */
function updateFoam(foam, view, time) {
  const points = shoresIn(view);
  const [t0, t1] = WATER_FX.foamTravel,
    [p0, p1] = WATER_FX.foamPeriod;
  foam.forEach((f, n) => {
    const p = points[n];
    if (!p) return f.sprite.setVisible(false);
    const seed = Math.abs(Math.sin(p.i * 12.9898) * 43758.5453) % 1,
      travel = t0 + (t1 - t0) * seed,
      wave = Math.sin((time / (p0 + (p1 - p0) * seed) + seed) * Math.PI * 2);
    // The foam picture bulges up (-y); turn it so the bulge faces the land, away from the water.
    f.sprite
      .setPosition(p.x + p.dx * travel * wave, p.y + p.dy * travel * wave)
      .setRotation(Math.atan2(-p.dx, p.dy))
      .setAlpha(0.45 + 0.25 * wave)
      .setVisible(true);
  });
}

/**
 * Sets up the water motion for the world scene and gives back its per-frame update.
 *
 * With reduced motion turned on, nothing is made and the update does nothing: the water holds
 * still, while the shores and depth (which are part of the tiles) still show.
 *
 * @param {Phaser.Scene} scene - The world scene.
 * @param {boolean} reducedMotion - True when the player's system asks for less motion.
 * @returns {{update: (view: object, dt: number) => void}} Call `update` every frame with the area
 *   around the camera ({left, top, right, bottom}) and the seconds that passed (0 while paused).
 */
export function createWaterEffects(scene, reducedMotion) {
  if (reducedMotion)
    return {
      /** Does nothing: with reduced motion the water holds still. */
      update() {},
    };

  makeTexture(scene, 'fx-streak', 3, 16, (ctx) => ctx.fillRect(0, 0, 3, 16));
  makeTexture(scene, 'fx-sparkle', 8, 8, (ctx) => {
    ctx.fillRect(3, 0, 2, 8);
    ctx.fillRect(0, 3, 8, 2);
  });
  makeTexture(scene, 'fx-foam', 40, 12, (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(20, 26, 20, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  });

  const streaks = pool(scene, 'fx-streak', WATER_FX.streaks),
    sparkles = pool(scene, 'fx-sparkle', WATER_FX.sparkles),
    foam = pool(scene, 'fx-foam', WATER_FX.foam);
  let time = 0;

  return {
    /**
     * Moves every water effect on by one frame.
     *
     * @param {{left: number, top: number, right: number, bottom: number}} view - The area around the camera.
     * @param {number} dt - Seconds since the last frame; 0 while paused, so everything holds still.
     */
    update(view, dt) {
      if (!dt) return;
      time += dt;
      updateStreaks(streaks, view, dt);
      updateSparkles(sparkles, view, dt);
      updateFoam(foam, view, time);
    },
  };
}
```

- [ ] **Step 2: Run the effects from `src/render/renderer.js`**

Add to the imports:

```js
import { createWaterEffects } from './water.js';
import { WATER_FX } from '../data/balance.js';
```

Add `water,` to the `let player, shadow, ...` list. At the end of `create()`, add:

```js
        // Gentle water motion: river streaks, sparkles, and beach foam (none with reduced motion).
        water = createWaterEffects(this, reducedMotion);
```

Change `function draw(state, dt, animator) {` to `function draw(state, dt, animator, paused = false) {`, add to its comment block:

```js
   * @param {boolean} [paused=false] - True while a dialog is open or the tab is hidden; the water holds still.
```

and add right after `shown = next;` (the end of the chunk culling):

```js
    // Water effects work in the area the camera sees, plus a margin so they don't pop in at the edge.
    const seeW = view.width / zoom / 2 + WATER_FX.margin,
      seeH = view.height / zoom / 2 + WATER_FX.margin;
    water.update(
      { left: camera.x - seeW, top: camera.y - seeH, right: camera.x + seeW, bottom: camera.y + seeH },
      paused ? 0 : dt,
    );
```

Update the renderer's top doc comment line `` `draw(state, dt, animator)` for each frame, `` to `` `draw(state, dt, animator, paused)` for each frame, ``.

- [ ] **Step 3: Tell the renderer when the game is paused (`src/core/loop.js`)**

Replace:

```js
      // Drawing still happens while paused, so the world stays on screen behind the dialog.
      renderer.draw(state, dt, animator);
```

with:

```js
      // Drawing still happens while paused, so the world stays on screen behind the dialog;
      // the renderer is told it is paused so the water holds still too.
      renderer.draw(state, dt, animator, ui.dialogs.isPaused() || document.hidden);
```

- [ ] **Step 4: Format and test**

Run: `npm run format`, `npm test`, `npm run build`
Expected: all PASS; the build succeeds.

- [ ] **Step 5: Check the motion in the game**

Start the `wildhaven` launch config, open `http://127.0.0.1:5173` with a test save, and check:
- On a river: pale streaks drift downstream (Frostpeak river: toward the lagoon), faster in the middle, and vanish at fords and bridges.
- At a landmark pond: sparkles twinkle and fade; nothing drifts.
- On the beach and while sailing: foam strokes slide in and out at different times; a few sparkles at sea.
- Open the pause dialog: every effect freezes; close it and they carry on.
- Turn on reduced motion (Chrome DevTools > Rendering > Emulate CSS `prefers-reduced-motion: reduce`) and reload: no effects; shores and depth still show.
- Console: no errors. Frame rate (DevTools Performance or the FPS meter) while walking along a river and sailing the coast: no noticeable drop compared with before.

- [ ] **Step 6: Commit**

```bash
git add src/render/water.js src/render/renderer.js src/core/loop.js
git commit -m "Add gentle water motion: river streaks, sparkles and beach foam"
```

---

### Task 6: Full browser check and docs

**Files:**
- Modify: `CLAUDE.md`, `docs/art-direction.md`, `docs/gdd.md`, `docs/verification.md`

- [ ] **Step 1: Play through with each character**

From the `wildhaven` launch config at `127.0.0.1`, with test saves for the Scout, Builder and Survivor, walk to the nearest river, a landmark pond and the beach, and sail along the coast once. Check: banks that face the camera show the wall, the shadow and the dark middle; tile seams at several browser zoom levels; the minimap and world map still draw; the page at about 390 px wide (DevTools device toolbar) shows water effects without layout changes; console clean.

- [ ] **Step 2: Update `CLAUDE.md`**

In "World / Map Pipeline", add `water-tileset.png` to the output list of the pipeline diagram (under `tileset.png`), and add this bullet after the bullet about `wildhaven.json`:

```markdown
- **Water has three kinds and its own tileset.** `build-map.py` gives every water corner a kind (`sea`, `river`, `lake`; property `waterKinds`). The `water` layer uses one set of 240 corner-mask tiles per kind, drawn into `water-tileset.png` (the land tiles and A1's `deep` stay in `tileset.png`, which is near the 4096 px texture limit). Each kind draws its own shore inside its water tiles (the `SHORE` table: wet sand and foam for the sea, an earth lip with a wall and shadow where a river bank faces the camera, mud and shadow for lakes). A `depth` layer between `water` and `deep` darkens water more than `DEPTH_FROM` (70) units from land; it is look-only. `src/world/map.js` decodes the mask from any kind's set (`% 240`), so collision is unchanged, and `waterKindAt(x, y)` names the kind. The map also stores `rivers` (lines upstream to downstream plus half width) and `shores` (sea waterline points with the direction to the water) for the water motion.
```

In the Architecture table, add `water.js` (`flowAt`, `pickSpawns`, `shoresIn`, `RIVER_LINES`, `SHORES`; pure) to the `src/world/` row and `water.js` (pooled river streaks, sparkles and beach foam; nothing with reduced motion) to the `src/render/` row. In "Frame loop", change the draw step to say `renderer.draw` gets a `paused` flag so the water effects hold still while paused. In "Game Rules That Affect Code", add: "Water motion numbers live in `WATER_FX` in `src/data/balance.js`."

- [ ] **Step 3: Update `docs/art-direction.md` and `docs/gdd.md`**

Add a section to `docs/art-direction.md`:

```markdown
## Water shores and depth (2026-11-19)

Shores are drawn by `tools/build-map.py`, not separate art: wet sand is `sand.png` darkened, the river bank and wall are `dirt.png` warmed and darkened, and lake mud is a dirt and sand mix. The tints, widths and strengths are in the `SHORE` and `SHORE_TEX` tables at the top of the water tileset section, so real textures can replace them later. Motion (river streaks, sparkles, beach foam) is three small white shapes drawn in code by `src/render/water.js`.
```

In `docs/gdd.md`, add under the archipelago items: `- [Built] Water look: sea, river and lake shores (sandy beach, earth river bank with a wall facing the camera, muddy lake edge), a depth tint away from the shore, and gentle motion (river streaks, lake and sea sparkles, beach foam), off with reduced motion.`

- [ ] **Step 4: Record the checks in `docs/verification.md`**

Append a section headed `## Water look` plus the date you ran the checks (the format the other sections use), listing: the test count from `npm test`, `npm run build` and `npm run format:check` passing, each check from Task 5 Step 5 and Task 6 Step 1 with what was seen, the browser size used, and anything not checked by hand.

- [ ] **Step 5: Final checks and commit**

Run: `npm test`, `npm run build`, `npm run format:check`
Expected: all PASS.

```bash
git add CLAUDE.md docs/art-direction.md docs/gdd.md docs/verification.md
git commit -m "Document the water look and record its browser checks"
```
