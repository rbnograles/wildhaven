# Archipelago A1 (Island Home and a Small Boat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surround the home continent with sea, let each character repair one old boat on the coast with 6 wood + 2 stone (driftwood helps), sail the shallow coastal water, and land on three lagoon islets that each hold a new landmark.

**Architecture:** `tools/build-map.py` grows the map by a 2,048-unit sea border, draws a wobbly coastline with a beach, and adds a `deep` tile layer for water far from land. Pure modules gain the sea rules (`isSailable`, `isDeep` in `world/map.js`), the boat actions (`actions/boat.js`) and one chooser for the E key (`actions/interact.js`). Saves go to version 4 and migrate version 3 by shifting positions. The browser layer (input, loop, HUD, renderer) only wires these in.

**Tech Stack:** Vanilla JS ES modules, Phaser 4 (renderer only), Vite 7, `node:test`, Prettier 3, Python 3 with numpy + Pillow for the map.

**Spec:** `docs/superpowers/specs/2026-11-19-archipelago-design.md`

## Global Constraints

- Follow `CLAUDE.md` exactly. Every named function (also inner ones, `const x = () =>`, object properties holding arrow functions, methods, classes) has a `/** ... */` (or `//`) comment on the line directly above it, in plain ELI5 words with `@param`/`@returns`. `tests/comments.test.js` enforces it.
- Each file opens with a 2–4 line `//` header. Each `test(...)` has a `//` line above it saying what it guards against.
- Pure modules (`src/data/`, `src/world/`, `src/actions/`, `src/game/`, `src/animation/clips.js`) must not import `ui/`, `core/`, `render/`, `sheets.js`, `preview.js`, PNG or CSS, and must not contain the words `document`, `window` or `import.meta` anywhere, comments included.
- Python in `tools/`: a `#` comment above every `def`, no docstrings on defs.
- Balance numbers live in `src/data/balance.js`. `GATHER_SECONDS` stays 6.
- After editing JS, run `npm run format`. `npm test`, `npm run build` and `npm run format:check` must all pass at the end of every task.
- Every generated or stand-in art file sits next to a `.prompt.txt`.
- Browser checks run from the `wildhaven` launch config at `http://127.0.0.1:5173`, never `localhost` (that holds the user's own saves).
- Numbers from the spec: sea border `PAD = 2048` (32 tiles), map 448×320 tiles, deep water beyond 1,200 units from land, beach band 220 units, repair cost 6 wood + 2 stone, `REPAIR_SECONDS = 8`, `WRECK_RADIUS = 200`, `BOAT_SPEED = 210`, `BOAT_FAST_SPEED = 300`, `BOARD_RANGE = 160`, `LAND_RANGE = 160`, driftwood gives 1 wood and regrows in 180 s, save `version: 4`.
- Save version clash: the M2 loop-proof spec also claims version 4. This plan uses 4. If M2 lands first, renumber this plan's version to 5 and migrate from M2's version 4 as well (see the spec's "Saves" section).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `assets/world/source/objects.json` | modify | entries for `driftwood`, `old-boat`, `rowboat` |
| `tools/make-biome-standins.py` | modify | stand-ins: `ground/deep.png`, `props/driftwood.png`, `props/old-boat.png`, `props/rowboat.png` |
| `tools/build-map.py` | modify | sea border, coastline and beach, `deep` layer, wrecks kept clear, beach driftwood, new map properties |
| `assets/world/source/places.json` | modify | every position +2048; 3 islet landmarks; new `wrecks` list |
| `assets/world/map/*` | regenerate | output of `build-map.py` |
| `src/data/places.js` | modify | export `WRECKS` |
| `src/world/map.js` | modify | `SEA_BORDER`, `isDeep`, `isSailable` |
| `src/data/balance.js` | modify | boat numbers |
| `src/data/supplies.js` | modify | `WILD.driftwood` |
| `src/world/nodes.js` | modify | `wreckBases`, `solidBases` |
| `src/game/state.js` | modify | version 4 fields, validation, v3 migration, boat placement |
| `src/actions/move.js` | modify | `facing`, sailing movement, wreck bases |
| `src/actions/boat.js` | create | repair, board, land, deep lookout |
| `src/actions/interact.js` | create | what E does: land → board → repair → gather |
| `src/actions/discover.js` | modify | find old boats |
| `src/actions/travel.js` | modify | travelling leaves the boat |
| `src/core/input.js`, `src/core/loop.js` | modify | E runs `beginInteraction`; loop finishes repairs, warns at deep water |
| `src/ui/hud.js`, `src/ui/layout.js` | modify | button words, boat goal card, key strip, map canvas size |
| `src/render/renderer.js` | modify | deep layer, old boats, the boat, the seated player, map markers |
| tests | modify/create | see each task |
| docs | modify | `CLAUDE.md`, `docs/gdd.md`, `docs/art-direction.md`, `docs/verification.md`, the spec's status |

---

### Task 0: Branch

- [ ] **Step 1: Make a branch and commit the design docs**

The spec, the GDD update and this plan are uncommitted on `main`. Another session's untracked `docs/superpowers/specs/2026-11-19-m2-loop-proof-design.md` must **not** be added.

```bash
git checkout -b archipelago-a1
```

```bash
git add docs/gdd.md docs/superpowers/specs/2026-11-19-archipelago-design.md docs/superpowers/plans/2026-11-19-archipelago-a1.md
```

```bash
git commit -m "Plan the archipelago: island home and a small boat" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Stand-in art for the sea and boats

**Files:**
- Modify: `assets/world/source/objects.json`
- Modify: `tools/make-biome-standins.py` (append a section at the end)
- Modify: `tests/world/objects.test.js:61-66`
- Creates (by running the script): `assets/world/source/ground/deep.png`, `assets/world/source/objects/props/{driftwood,old-boat,rowboat}.png`, each with `.prompt.txt`

**Interfaces:**
- Produces: sprite names `driftwood` (flat, scale 0.6, walk-through), `old-boat` (footprint `[70, 26]`), `rowboat` (origin centre, no footprint, bow points east); ground texture `deep`.

- [ ] **Step 1: Update the ground texture test so it expects `deep`**

In `tests/world/objects.test.js`, replace

```js
  const textures = ['grass', 'dirt', 'jungle', 'rock', 'snow', 'sand', 'water'];
```

with

```js
  const textures = ['grass', 'dirt', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep'];
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/world/objects.test.js`
Expected: FAIL in "every ground texture is in ground/ with its prompt" (no `deep`).

- [ ] **Step 3: Add the three sprites to `objects.json`**

Replace the last entry line

```json
  "signpost": { "kind": "props", "origin": [0.5, 0.97], "footprint": [14, 10] }
```

with

```json
  "signpost": { "kind": "props", "origin": [0.5, 0.97], "footprint": [14, 10] },
  "driftwood": { "kind": "props", "origin": [0.5, 0.7], "flat": true, "scale": 0.6 },
  "old-boat": { "kind": "props", "origin": [0.5, 0.78], "footprint": [70, 26] },
  "rowboat": { "kind": "props", "origin": [0.5, 0.55] }
```

- [ ] **Step 4: Append the stand-in section to `tools/make-biome-standins.py`**

Add at the very end of the file:

```python

# ---- sea and boats (archipelago slice A1) --------------------------------------------------
save(recolor(texture('water'), (0.5, 0.62, 0.78), (0, 4, 18)).convert('RGB'), os.path.join(GROUND, 'deep.png'),
     texture_prompt('deep open sea water in dark teal-blue with slow broad swells and faint lighter wave crests; '
                    'no foam, rocks, fish or shore'))

# Draws a small rowboat seen from above at a slight angle, bow pointing right. `broken` knocks out three planks,
# so the beach shows through the holes.
def rowboat(inside, rim, broken):
    im = blank(200, 90); d = ImageDraw.Draw(im)
    d.polygon([(6, 46), (40, 12), (150, 10), (194, 46), (150, 80), (40, 78)], fill=rim, outline=(60, 40, 24))
    d.polygon([(22, 46), (48, 24), (146, 22), (176, 46), (146, 68), (48, 66)], fill=inside)
    for x in (78, 122): d.rectangle((x, 24, x + 10, 68), fill=rim)   # two seats across the hull
    if broken:
        for x in (58, 100, 140): d.rectangle((x, 30, x + 12, 60), fill=(0, 0, 0, 0))
    return im

save(rowboat((150, 140, 120), (112, 100, 84), True), obj('old-boat'),
     object_prompt('an old wooden rowboat lying on a beach, weathered grey planks with several missing, seen from '
                   'above at a slight angle with the bow pointing right', 200, 90))
save(rowboat((150, 102, 60), (110, 72, 40), False), obj('rowboat'),
     object_prompt('a small sturdy wooden rowboat with warm brown planks and two seats, seen from above at a slight '
                   'angle with the bow pointing right; no water around it', 200, 90))
drift = blank(150, 70); d = ImageDraw.Draw(drift)
d.rounded_rectangle((8, 30, 142, 48), 9, fill=(196, 182, 160), outline=(118, 104, 86), width=OUT)
d.rounded_rectangle((30, 14, 120, 30), 8, fill=(206, 194, 172), outline=(118, 104, 86), width=OUT)
d.line((96, 48, 118, 62), fill=(150, 136, 116), width=5)
save(drift, obj('driftwood'),
     object_prompt('two or three bleached grey driftwood branches lying flat on sand', 150, 70))
```

- [ ] **Step 5: Run the script**

Run: `python tools/make-biome-standins.py`
Expected: every old file prints `kept ...`; four lines print `made ground/deep.png`, `made objects/props/old-boat.png`, `made objects/props/rowboat.png`, `made objects/props/driftwood.png`.

- [ ] **Step 6: Run the object tests**

Run: `node --test tests/world/objects.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/world/source/objects.json tools/make-biome-standins.py tests/world/objects.test.js assets/world/source/ground/deep.png assets/world/source/ground/deep.prompt.txt assets/world/source/objects/props/driftwood.png assets/world/source/objects/props/driftwood.prompt.txt assets/world/source/objects/props/old-boat.png assets/world/source/objects/props/old-boat.prompt.txt assets/world/source/objects/props/rowboat.png assets/world/source/objects/props/rowboat.prompt.txt
```

```bash
git commit -m "Add stand-in art for deep water, driftwood and rowboats" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The island map

**Files:**
- Modify: `tools/build-map.py`
- Modify: `assets/world/source/places.json` (by a one-off script)
- Regenerate: `assets/world/map/tileset.png`, `wildhaven.json`, `overview.webp`
- Modify: `src/data/places.js`
- Modify: `src/ui/layout.js:249-250` (world map canvas size)
- Create: `tests/world/flood.js` (a test helper, not a test file: Node's runner only runs `*.test.js` here)
- Test: `tests/world/map.test.js`, `tests/world/places.test.js`, `tests/world/regions.test.js`, `tests/world/progress.test.js`

**Interfaces:**
- Consumes: sprites from Task 1.
- Produces (tests): `flood(x, y, open)` from `tests/world/flood.js`, returning `{reached(x, y, range), cells}`.
- Produces: `WORLD` is 28,672×20,480; map properties `firstDeepGid` and `seaBorder` (2048); tile layer `deep`; `WRECKS` from `src/data/places.js` as `{id, region, name, x, y, launch: {x, y}}`; landmark ids `l-gull-isle`, `l-turtle-isle`, `l-lantern-islet`; wreck ids `wreck-north`, `wreck-west`, `wreck-south`, `wreck-east`.

- [ ] **Step 1: Write the failing tests**

In `tests/world/map.test.js`, replace the last test:

```js
// Guards the world's size: the renderer, the minimap and the region grid all assume it.
test('the world is 448 by 320 tiles of 64 units: the old 384 by 256 map plus a sea border', () => {
  assert.equal(WORLD.width, 28672);
  assert.equal(WORLD.height, 20480);
});
```

In `tests/world/progress.test.js`, change `places: { found: 2, total: 49 },` to `places: { found: 2, total: 52 },`.

In `tests/world/regions.test.js`, change the import `import { LANDMARKS, WAYPOINTS, SPAWNS } from '../../src/data/places.js';` to `import { LANDMARKS, WAYPOINTS, SPAWNS, WRECKS } from '../../src/data/places.js';`, and replace the second test with:

```js
// Guards the link between a place and its region: the HUD counts places per region, so a
// landmark that sits across a border would be counted where the player never sees it.
test('every landmark, signpost and old boat lies inside the region it names', () => {
  for (const p of [...LANDMARKS, ...WAYPOINTS, ...WRECKS])
    assert.equal(regionOf(p.x, p.y).id, p.region, p.id);
});
```

Create `tests/world/flood.js`:

```js
// A helper for the world tests: spreads over the map like spilled paint to find out what can be
// reached, on foot or by boat. It is not a test file itself (Node's runner only runs *.test.js),
// so importing it doesn't run any tests twice.

import { WORLD } from '../../src/world/map.js';

/**
 * Spreads outward from one spot over a 24-unit grid, like spilled paint, through every cell that
 * `open` allows.
 *
 * @param {number} x - Where to start, in world units.
 * @param {number} y - Where to start, in world units.
 * @param {Function} open - `(x, y) => boolean`: whether paint may cover the cell centred there.
 * @returns {{reached: Function, cells: number[][]}} `reached(x, y, range)` says whether painted
 *   ground lies within `range` units of a point; `cells` lists each painted cell's centre as [x, y].
 */
export function flood(x, y, open) {
  const STEP = 24,
    cols = Math.ceil(WORLD.width / STEP),
    rows = Math.ceil(WORLD.height / STEP),
    seen = new Uint8Array(cols * rows);
  const start = Math.floor(y / STEP) * cols + Math.floor(x / STEP);
  const stack = [start];
  seen[start] = 1;

  while (stack.length) {
    const i = stack.pop(),
      cx = i % cols,
      cy = (i - cx) / cols;
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      const n = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[n]) continue;
      if (!open(nx * STEP + STEP / 2, ny * STEP + STEP / 2)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }

  /** True if any painted cell lies within `range` units of the point. */
  const reached = (px, py, range) => {
    const r = Math.ceil(range / STEP);
    for (let cy = Math.floor(py / STEP) - r; cy <= Math.floor(py / STEP) + r; cy++)
      for (let cx = Math.floor(px / STEP) - r; cx <= Math.floor(px / STEP) + r; cx++)
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows && seen[cy * cols + cx]) return true;
    return false;
  };

  // The centre of every painted cell, for checks that need to look at each one.
  const cells = [];
  for (let i = 0; i < seen.length; i++)
    if (seen[i]) cells.push([(i % cols) * STEP + STEP / 2, Math.floor(i / cols) * STEP + STEP / 2]);
  return { reached, cells };
}
```

Replace all of `tests/world/places.test.js` with:

```js
// Checks the shared places file: the regions, start spots, supplies, landmarks, signposts and
// old boats that both the map builder and the game read. A typo here would put a landmark in the
// sea or make two things share one save id.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWalkable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { SUPPLIES } from '../../src/data/supplies.js';
import { nodeBases } from '../../src/world/nodes.js';
import { GATHER_RANGE } from '../../src/data/balance.js';
import { REGION_LIST, LANDMARKS, WAYPOINTS, SPAWNS, WRECKS } from '../../src/data/places.js';
import { flood } from './flood.js';

// How many landmarks each region has. The lagoon's three islets add one each.
const LANDMARKS_PER_REGION = { lagoon: 10 };

// Guards the counts the HUD and map show, and the ids saves are keyed by.
test('the world has seven regions, 52 landmarks, 14 signposts and 4 old boats with unique ids', () => {
  assert.equal(REGION_LIST.length, 7);
  assert.equal(LANDMARKS.length, 52);
  assert.equal(WAYPOINTS.length, 14);
  assert.equal(WRECKS.length, 4);

  const ids = [...REGION_LIST, ...LANDMARKS, ...WAYPOINTS, ...WRECKS].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const region of REGION_LIST) {
    const expected = LANDMARKS_PER_REGION[region.id] ?? 7;
    assert.equal(LANDMARKS.filter((l) => l.region === region.id).length, expected, region.id);
    assert.equal(WAYPOINTS.filter((w) => w.region === region.id).length, 2, region.id);
  }
});

// Guards against a rebuilt map putting water or scenery where the player has to stand.
test('every spawn, landmark, signpost and old boat is on ground the player can stand on', () => {
  const solid = nodeBases([]);
  for (const c of CHARACTERS) assert.deepEqual(c.spawn, SPAWNS[c.id]);
  for (const p of [
    ...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })),
    ...LANDMARKS,
    ...WAYPOINTS,
  ])
    assert.ok(isWalkable(p.x, p.y, solid), `${p.id} at ${p.x},${p.y}`);
  // An old boat's own spot is under its solid hull, so only the map itself is checked there.
  for (const w of WRECKS) assert.ok(isWalkable(w.x, w.y), `${w.id} at ${w.x},${w.y}`);
});

// Guards the promise that nothing is cut off by a river, the sea or a wall of trees. Islet
// landmarks are left out: they are reached by boat (see the sea test in tests/world/sea.test.js).
test('every spawn, mainland landmark, signpost, supply and old boat can be reached on foot', () => {
  const solid = nodeBases([]);
  const foot = flood(SPAWNS.builder.x, SPAWNS.builder.y, (x, y) => isWalkable(x, y, solid));
  const islets = ['l-gull-isle', 'l-turtle-isle', 'l-lantern-islet'];

  for (const p of [
    ...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })),
    ...LANDMARKS.filter((l) => !islets.includes(l.id)),
    ...WAYPOINTS,
  ])
    assert.ok(foot.reached(p.x, p.y, 24), `${p.id} cannot be reached`);
  for (const s of SUPPLIES)
    assert.ok(foot.reached(s.x, s.y, GATHER_RANGE - 24), `${s.id} cannot be gathered`);
  for (const w of WRECKS)
    assert.ok(foot.reached(w.x, w.y, GATHER_RANGE - 24), `${w.id} cannot be repaired`);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test tests/world/map.test.js tests/world/places.test.js tests/world/regions.test.js tests/world/progress.test.js`
Expected: FAIL: `WRECKS` is not exported, the world is still 24576 wide, and there are 49 landmarks.

- [ ] **Step 3: Shift `places.json` and add the islets and old boats**

Run this once from the repo root. It keeps the file's own formatting and line endings, refuses to run twice, and only moves numbers that are positions.

```bash
python - <<'EOF'
import re
path = 'assets/world/source/places.json'
with open(path, encoding='utf-8', newline='') as f: text = f.read()
assert '"wrecks"' not in text, 'places.json was already converted'
nl = '\r\n' if '\r\n' in text else '\n'

# Every position moves 2048 units out, the width of the new sea border.
text = re.sub(r'\[(\d+), (\d+)\]', lambda m: f'[{int(m[1]) + 2048}, {int(m[2]) + 2048}]', text)
text = re.sub(r'"x": (\d+), "y": (\d+)', lambda m: f'"x": {int(m[1]) + 2048}, "y": {int(m[2]) + 2048}', text)

# One landmark on each lagoon islet, listed after the Old Jetty.
jetty = '"name": "Old Jetty", "x": 23398, "y": 10248, "object": "log" },'
assert jetty in text
islets = [
    '{ "id": "l-gull-isle", "region": "lagoon", "name": "Gull Isle", "x": 25348, "y": 10048, "object": "palm" },',
    '{ "id": "l-turtle-isle", "region": "lagoon", "name": "Turtle Isle", "x": 25748, "y": 14548, "object": "beach-rock" },',
    '{ "id": "l-lantern-islet", "region": "lagoon", "name": "Lantern Islet", "x": 25048, "y": 16848 },',
]
text = text.replace(jetty, jetty + ''.join(nl + '    ' + line for line in islets))

# The old boats: x/y on the beach, launch in the shallow water 220 units out to sea.
end = '"name": "Temple Path Signpost", "x": 15048, "y": 17048 }' + nl + '  ]'
assert end in text
wrecks = [
    '{ "id": "wreck-north", "region": "pinefall", "name": "Pinefall Shore Rowboat", "x": 14948, "y": 2338, "launch": [14948, 2118] },',
    '{ "id": "wreck-west", "region": "canyons", "name": "Canyon Coast Rowboat", "x": 2024, "y": 8848, "launch": [1804, 8848] },',
    '{ "id": "wreck-south", "region": "jungle", "name": "Jungle Beach Rowboat", "x": 11048, "y": 18619, "launch": [11048, 18839] },',
    '{ "id": "wreck-east", "region": "lagoon", "name": "Lagoon Rowboat", "x": 23682, "y": 10748, "launch": [23902, 10748] }',
]
text = text.replace(end, end + ',' + nl + '  "wrecks": [' + ''.join(nl + '    ' + w for w in wrecks) + nl + '  ]')

with open(path, 'w', encoding='utf-8', newline='') as f: f.write(text)
print('places.json shifted; islets and wrecks added')
EOF
```

Check: `"scout": [14348, 4148]` and `"x": 5048, "y": 4248` (Mirage Oasis) now appear in the file.

The wreck spots were worked out from the coastline formula in Step 4: each sits 100 units inland of the sea coast, and its `launch` 220 units further out, past the 130-unit circle `build-map.py` keeps dry around every listed place.

- [ ] **Step 4: Rework `tools/build-map.py`**

Make these edits in order.

(a) Replace the module docstring (lines 1-12) with:

```python
"""Builds the Wildhaven sprite map from assets/world/source/.

Inputs : source/ground/{grass,dirt,jungle,rock,snow,sand,water,deep}.png  seamless ground textures
         source/objects/<kind>/<name>.png + source/objects.json            one sprite per world object; its
                                                                           objects.json entry names the kind folder
         source/places.json                                                regions, spawns, supplies, landmarks,
                                                                           waypoints, wrecks (old boats)
Outputs: map/tileset.png    terrain tiles incl. generated soft transitions (64px, 1px extruded)
         map/wildhaven.json Tiled-format map: eight tile layers + "objects" layer + region grid and sea properties
         map/overview.webp  small render of the whole map for the minimap and world map
The home continent sits inside a sea border; water far from any land becomes the "deep" layer.
The game reads collision from the JSON (water and deep tiles + object footprints) and regions from its region grid.
Run: python tools/build-map.py [preview.png]
"""
```

(b) Replace

```python
TILE, COLS, ROWS, TEX = 64, 384, 256, 256
W, H = COLS * TILE, ROWS * TILE

# Terrains in paint order. A higher terrain is painted over a lower one, so the number is also its layer rank.
GRASS, DIRT, JUNGLE, ROCK, SNOW, SAND, WATER = range(7)
OVERLAYS = ['dirt', 'jungle', 'rock', 'snow', 'sand', 'water']   # rank 1..6; grass (rank 0) is the full ground layer
```

with

```python
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
# DEEP is open sea far from land; it is worked out after everything else (see "deep sea" below).
GRASS, DIRT, JUNGLE, ROCK, SNOW, SAND, WATER, DEEP = range(8)
OVERLAYS = ['dirt', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']   # rank 1..7; grass (rank 0) is the full ground layer
```

(c) Replace `BLOCK_W, BLOCK_H = W // 8, H // 8` with `BLOCK_W, BLOCK_H = LAND_W // 8, LAND_H // 8`, and add one line to the comment above `def region_key`, so it reads:

```python
# Says which region a point is in. The point is nudged by a few sine waves before the block grid is read, so the
# borders wobble like real coastlines instead of running in straight lines. The nudge is never more than 440 units.
# A point out at sea falls off the 8x8 grid and takes the letter of the nearest block.
```

(d) After the `def coast(y): ...` line, add:

```python

# How far a point is inside the island's sea coast: positive on land, negative at sea. The coast follows the old
# map's edge, pulled in or pushed out by two sine waves (from 220 units in to 520 units out), so it never runs
# straight. Every place in places.json is at least 900 units inside the old edge, so the coast never reaches one.
def inland(x, y):
    edge = min(x, y, LAND_W - x, LAND_H - y)
    return edge + 150 + 250 * math.sin((x + y) / 1300 + 0.8) + 120 * math.sin((x - y) / 470 + 2.3)

BEACH = 220        # land closer than this to the sea coast is a sand beach
DEEP_FROM = 1200   # water farther than this from any land is deep sea, where the small boat can't go
```

(e) Change the `ISLANDS` line's comment to `# the lagoon's islets: reached by boat, each holds a landmark`.

(f) Replace

```python
SPAWN = {k: tuple(v) for k, v in PLACES['spawns'].items()}
POOLS = [(l['x'], l['y'] - l['pool'] - 120, l['pool']) for l in PLACES['landmarks'] if 'pool' in l]
# Every spot the player must be able to stand on. Water is pushed back from them and scenery is kept off them.
POINTS = (list(SPAWN.values()) + [tuple(p) for p in PLACES['supplies'].values()]
          + [(p['x'], p['y']) for p in PLACES['landmarks'] + PLACES['waypoints']])
```

with

```python
# Moves a WORLD position from places.json into this script's LAND units.
def land(p): return (p[0] - PAD, p[1] - PAD)

SPAWN = {k: land(v) for k, v in PLACES['spawns'].items()}
LANDMARKS = [{**l, 'x': l['x'] - PAD, 'y': l['y'] - PAD} for l in PLACES['landmarks']]
POOLS = [(l['x'], l['y'] - l['pool'] - 120, l['pool']) for l in LANDMARKS if 'pool' in l]
# Every spot the player must be able to stand on. Water is pushed back from them and scenery is kept off them.
# An old boat's `launch` spot is left out on purpose: it must stay water, so the repaired boat can float there.
POINTS = (list(SPAWN.values()) + [land(p) for p in PLACES['supplies'].values()]
          + [land((p['x'], p['y'])) for p in PLACES['landmarks'] + PLACES['waypoints'] + PLACES['wrecks']])
```

(g) In `def terrain(x, y)`, insert these three lines directly above `    if t == WATER and any(math.hypot(x - px, y - py) < 130 for px, py in POINTS): t = SAND`:

```python
    shore = inland(x, y)
    if shore < 0: t = WATER                          # the sea around the island
    elif shore < BEACH and t != WATER: t = SAND      # its beach; a river still runs across it to the sea
```

(h) Replace

```python
corner = np.array([[terrain(x * TILE, y * TILE) for x in range(COLS + 1)] for y in range(ROWS + 1)])
```

with

```python
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
```

(i) Replace the comment above `layers = {...}` with:

```python
# A layer only paints a tile when one of the tile's corners is its own terrain. It then covers every corner of
# its rank or higher, so the terrain below a shoreline runs on underneath the water and no grass shows in the seam.
# For water that is exactly "which corners are sea, shallow or deep", which src/world/map.js reads for collision;
# the deep layer on top says which corners are deep, which the small boat can't enter.
```

(j) Replace the region grid block with:

```python
# One digit per 256-unit square, row by row: the index of that square's region in places.json.
# Sea squares take the region of the land nearest them, because region_key clamps to the edge of its layout.
REGION_CELL = 256; REGION_COLS, REGION_ROWS = W // REGION_CELL, H // REGION_CELL
region_grid = ''.join(str(REGION_INDEX[region_key(cx * REGION_CELL + REGION_CELL / 2 - PAD, cy * REGION_CELL + REGION_CELL / 2 - PAD)])
                      for cy in range(REGION_ROWS) for cx in range(REGION_COLS))
```

(k) Replace

```python
fixed += [(l['object'], l['x'], l['y'] - 60) for l in PLACES['landmarks'] if 'object' in l]   # the feature stands just north of the spot
fixed += [('signpost', w['x'], w['y'] - 50) for w in PLACES['waypoints']]
```

with

```python
fixed += [(l['object'], l['x'], l['y'] - 60) for l in LANDMARKS if 'object' in l]   # the feature stands just north of the spot
fixed += [('signpost', x, y - 50) for x, y in (land((w['x'], w['y'])) for w in PLACES['waypoints'])]
```

(l) Replace everything from `scattered = []` down to and including `objects = fixed + scattered` with:

```python
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
        if not (60 - PAD < x < LAND_W + PAD - 60 and 120 - PAD < y < LAND_H + PAD - 30) or not scatter_ok(x, y): continue
        ground = terrain(x, y); roll = rng.random()
        if ground in (WATER, DIRT): continue
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
# Everything above is in LAND units; the map file is in WORLD units.
objects = [(n, x + PAD, y + PAD) for n, x, y in fixed + scattered]
```

(m) In the `'properties'` list of `tiled`, add two entries after `firstWaterGid`:

```python
                   {'name': 'firstDeepGid', 'type': 'int', 'value': first['deep']},
                   {'name': 'seaBorder', 'type': 'int', 'value': PAD},
```

(n) Replace `full.convert('RGB').resize((1536, 1024), Image.LANCZOS).save(...)` with the same call at `(1568, 1120)` and append the comment `   # 7:5, the map's own shape`.

- [ ] **Step 5: Rebuild the map**

Run: `python tools/build-map.py`
Expected: it prints a line like `1056 tiles, N objects, 3.x MB map file` (it takes a minute or two). If the map file is over about 4 MB, stop and tell the user; the big-world spec's run-length encoding would be the fix.

- [ ] **Step 6: Export the old boats from `src/data/places.js`**

Append:

```js

/**
 * Old boats lying on the coast; the player can repair one of them into their own boat.
 * Fields: `id`, `region`, `name`, `x`/`y` (where it lies on the beach) and `launch` (the shallow
 * water next to it, as `{x, y}`, where the mended boat floats).
 */
export const WRECKS = PLACES.wrecks.map(({ id, region, name, x, y, launch }) => ({
  id,
  region,
  name,
  x,
  y,
  launch: spot(launch),
}));
```

Also change the header comment's first line to `// The shared list of places in the world: regions, start spots, supply spots, landmarks to find,` and its second line to `// signposts to travel between and old boats on the coast. The numbers live in assets/world/source/places.json so that`.

- [ ] **Step 7: Size the world map canvas to the new 7:5 map**

In `src/ui/layout.js`, change `width="1200"` to `width="1120"` on the `large-map` canvas (its `height="800"` stays).

- [ ] **Step 8: Run the world tests**

Run: `node --test tests/world/`
Expected: PASS. If a wreck or islet landmark fails "inside the region it names", "on ground the player can stand on" or "reached on foot", move that point 40 units further inland along the same line (and its `launch` with it), rebuild (Step 5) and re-run. Note the change in the commit message.

- [ ] **Step 9: Run everything**

Run: `npm run format`, then `npm test`
Expected: PASS except tests that use the old 49-landmark count (none should remain). The journal test still counts 7 Pinefall pages.

- [ ] **Step 10: Commit**

```bash
git add tools/build-map.py assets/world/source/places.json assets/world/map src/data/places.js src/ui/layout.js tests/world tests/world/flood.js
```

```bash
git commit -m "Surround the home continent with sea, deep water and three reachable islets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sea rules (`isSailable`, `isDeep`)

**Files:**
- Modify: `src/world/map.js`
- Modify: `src/data/balance.js`
- Create: `tests/world/sea.test.js`

**Interfaces:**
- Consumes: map properties `firstDeepGid`, `seaBorder`; `WRECKS`; `flood` from `tests/world/flood.js`.
- Produces: `SEA_BORDER: number`, `isDeep(x, y): boolean`, `isSailable(x, y): boolean` from `src/world/map.js`; `BOARD_RANGE = 160`, `LAND_RANGE = 160` from `src/data/balance.js`.

- [ ] **Step 1: Write the failing test file `tests/world/sea.test.js`**

```js
// Checks the sea around the island: where the small boat may float, where the deep water starts,
// and that one shallow sea links every old boat with the lagoon's islets. If these break, a boat
// could sail off the map, beach itself on the sand, or never reach the islets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, SEA_BORDER, isWalkable, isDeep, isSailable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { LANDMARKS, WRECKS, SPAWNS } from '../../src/data/places.js';
import { BOARD_RANGE, LAND_RANGE } from '../../src/data/balance.js';
import { nodeBases } from '../../src/world/nodes.js';
import { flood } from './flood.js';

// Guards the build-time fact the save migration uses to move old positions onto the bigger map.
test('the sea border is 2048 units wide', () => {
  assert.equal(SEA_BORDER, 2048);
});

// Guards the edge of the world: the outer sea is deep, so neither walking nor the small boat
// can reach the map's edge.
test('the outer sea is deep: nobody can walk or sail there', () => {
  for (const [x, y] of [
    [WORLD.margin + 20, WORLD.height / 2],
    [WORLD.width / 2, WORLD.margin + 20],
    [WORLD.width - WORLD.margin - 20, WORLD.height / 2],
    [WORLD.width / 2, WORLD.height - WORLD.margin - 20],
  ]) {
    assert.ok(isDeep(x, y), `${x},${y}`);
    assert.equal(isSailable(x, y), false, `${x},${y}`);
    assert.equal(isWalkable(x, y), false, `${x},${y}`);
  }
});

// Guards where a boat floats: on the shallow water by each old boat, never on land or on broken
// numbers from a bad save.
test('a boat floats by each old boat, but never on land or on broken numbers', () => {
  for (const w of WRECKS) assert.ok(isSailable(w.launch.x, w.launch.y), w.id);
  for (const c of CHARACTERS) assert.equal(isSailable(c.spawn.x, c.spawn.y), false, c.id);
  assert.equal(isSailable(NaN, 500), false);
  assert.equal(isSailable(500, Infinity), false);
});

// Guards the boat's whole journey: from the beach the player can reach each boat, one shallow sea
// joins every old boat, and each islet has a beach within landing reach of that sea.
test('one shallow sea joins every old boat and reaches each islet', () => {
  const solid = nodeBases([]);
  const foot = flood(SPAWNS.builder.x, SPAWNS.builder.y, (x, y) => isWalkable(x, y, solid));
  for (const w of WRECKS)
    assert.ok(foot.reached(w.launch.x, w.launch.y, BOARD_RANGE - 24), `${w.id}: no beach to board from`);

  const east = WRECKS.find((w) => w.id === 'wreck-east');
  const sea = flood(east.launch.x, east.launch.y, isSailable);
  for (const w of WRECKS) assert.ok(sea.reached(w.launch.x, w.launch.y, 24), `${w.id} is cut off`);

  for (const id of ['l-gull-isle', 'l-turtle-isle', 'l-lantern-islet']) {
    const place = LANDMARKS.find((l) => l.id === id);
    const islet = flood(place.x, place.y, (x, y) => isWalkable(x, y));
    assert.ok(
      islet.cells.some(([x, y]) => sea.reached(x, y, LAND_RANGE - 24)),
      `${id} cannot be landed on`,
    );
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/world/sea.test.js`
Expected: FAIL: `SEA_BORDER`, `isDeep`, `isSailable`, `BOARD_RANGE` are not exported.

- [ ] **Step 3: Add the reach numbers to `src/data/balance.js`**

Append:

```js

/**
 * How close the player must stand to their boat to get in. The boat floats a little off the
 * beach, so this is wider than the reach for gathering.
 */
export const BOARD_RANGE = 160;

/** How far from the boat the player may step ashore when landing. */
export const LAND_RANGE = 160;
```

- [ ] **Step 4: Add the sea rules to `src/world/map.js`**

(a) Replace

```js
// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth shoreline.
const TILE = MAP.tilewidth,
  water = layer('water').data,
  firstWater = mapProperty('firstWaterGid');

/**
 * Says how wet a spot is, from 0 (dry land) to 1 (open sea).
 *
 * Each water tile knows which of its four corners are sea. We blend those corners by how close
 * the spot is to each one, like mixing paint, so the coastline is a smooth curve instead of a
 * staircase of squares. The tile's number in the map (its "gid") encodes the corner pattern.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} Wetness between 0 and 1.
 */
function waterAt(x, y) {
  const tx = Math.floor(x / TILE),
    ty = Math.floor(y / TILE),
    gid = water[ty * MAP.width + tx];
  if (!gid) return 0;
```

with

```js
// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth
// shoreline. The deep layer does the same for open sea far from land.
const TILE = MAP.tilewidth,
  water = layer('water').data,
  firstWater = mapProperty('firstWaterGid'),
  deep = layer('deep').data,
  firstDeep = mapProperty('firstDeepGid');

/** How many world units of sea surround the home continent on every side (PAD in tools/build-map.py). */
export const SEA_BORDER = mapProperty('seaBorder');

// The sea must cover at least this much of a spot before a boat floats there. Walking stops at
// 0.35, so a boat stays a little off the sand instead of sitting on the beach.
const FLOAT_AT = 0.5;

/**
 * Says how much of a spot one corner-pattern layer covers, from 0 (none) to 1 (all of it).
 *
 * Each tile of the layer knows which of its four corners are covered. We blend those corners by
 * how close the spot is to each one, like mixing paint, so the coastline is a smooth curve instead
 * of a staircase of squares. The tile's number in the map (its "gid") encodes the corner pattern.
 *
 * @param {number[]} data - The layer's tile numbers, row by row.
 * @param {number} first - The tile number of the layer's first tile.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} How covered the spot is, between 0 and 1.
 */
function cover(data, first, x, y) {
  const tx = Math.floor(x / TILE),
    ty = Math.floor(y / TILE),
    gid = data[ty * MAP.width + tx];
  if (!gid) return 0;
```

and in the rest of that function body change `const mask = Math.floor((gid - firstWater) / 16) + 1,` to `const mask = Math.floor((gid - first) / 16) + 1,`.

(b) Directly after that function, add:

```js

/** Says how wet a spot is, from 0 (dry land) to 1 (sea, shallow or deep). */
const waterAt = (x, y) => cover(water, firstWater, x, y);

/**
 * Says whether a spot is deep sea, far from any land, where the small boat can't go.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True for deep water.
 */
export const isDeep = (x, y) => cover(deep, firstDeep, x, y) >= 0.35;
```

(c) Replace `isWalkable` (its comment and body) with:

```js
/**
 * Says whether a spot is a real position inside the world's border.
 *
 * Anything that isn't a real number (like NaN from a broken save) is never inside.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the spot is inside the border.
 */
const insideWorld = (x, y) =>
  Number.isFinite(x) &&
  Number.isFinite(y) &&
  x >= WORLD.margin &&
  y >= WORLD.margin &&
  x <= WORLD.width - WORLD.margin &&
  y <= WORLD.height - WORLD.margin;

/**
 * Says whether the player is allowed to stand on a spot.
 *
 * A spot is fine when it's inside the world's border, mostly dry, and not inside a solid object.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number[][]} [extra=[]] - More solid boxes to avoid, such as supplies not yet gathered.
 * @returns {boolean} True if the player may stand there.
 */
export function isWalkable(x, y, extra = []) {
  if (!insideWorld(x, y)) return false;
  return waterAt(x, y) < 0.35 && !hitsObstacle(x, y) && !blocks(extra, x, y);
}

/**
 * Says whether the small boat may float on a spot.
 *
 * The boat needs enough water under it (it can't sit on the beach), must stay out of the deep
 * sea, and can't pass through anything solid, such as a bridge post.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the boat may be there.
 */
export function isSailable(x, y) {
  if (!insideWorld(x, y)) return false;
  return waterAt(x, y) >= FLOAT_AT && !isDeep(x, y) && !hitsObstacle(x, y);
}
```

The old border check used `<` and `>`; `insideWorld` keeps the same meaning (a spot exactly on the margin line was walkable before and still is).

- [ ] **Step 5: Run the sea tests and the map tests**

Run: `node --test tests/world/sea.test.js tests/world/map.test.js`
Expected: PASS. If "no beach to board from" fails for one old boat, move its `launch` 20 units closer to the shore in `places.json` (keep it at least 200 units from the wreck), rebuild with `python tools/build-map.py`, and re-run.

- [ ] **Step 6: Format, test everything, commit**

Run: `npm run format`, then `npm test`
Expected: PASS.

```bash
git add src/world/map.js src/data/balance.js tests/world/sea.test.js assets/world
```

```bash
git commit -m "Add the sea rules: where a boat floats and where deep water starts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Driftwood on the beaches

**Files:**
- Modify: `src/data/supplies.js:118-130`
- Modify: `src/world/nodes.js:1-8` (comments only)
- Modify: `src/ui/hud.js:11-12`
- Test: `tests/world/nodes.test.js`, `tests/actions/gather.test.js:18-19`, `tests/game/state.test.js:13-14`

**Interfaces:**
- Produces: wild nodes with `sprite: 'driftwood'`, `type: 'wood'`, `amount: 1`, `verb: 'Pick up'`, `regrow: 180`, ids `driftwood-<x>-<y>`.

- [ ] **Step 1: Write the failing tests**

In `tests/world/nodes.test.js`, change the comment above `const supplies = ...` to `/** The one-time supplies (they never grow back), and the wild patches: flowers and driftwood (they do). */`. Then replace the flower test (its two `//` comment lines and the whole `test('wild flower patches are walk-through herb sources drawn smaller than a character', ...)`) with:

```js
// Guards the wild patches: each has its own id, you can walk through them, they are gathered with
// an action clip, they grow back, and they are drawn smaller than the player.
test('wild patches are walk-through, regrowing and drawn smaller than a character', () => {
  assert.equal(new Set(NODES.map((n) => n.id)).size, NODES.length);

  for (const node of wild) {
    assert.ok(RESOURCES.includes(node.type));
    assert.equal(OBJECT_SPECS[node.sprite].footprint, undefined, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.regrow > 0 && node.amount > 0, node.id);
    assert.ok(
      pngSize(node.sprite).every((side) => side * node.scale < 112),
      node.id,
    ); // 112 = PLAYER_HEIGHT in src/render/renderer.js
  }
});

// Guards what each wild patch gives: flowers are the only source of herbs, and driftwood on the
// beaches gives the wood an old boat's repair needs.
test('flower patches give herbs and beach driftwood gives wood', () => {
  const flowers = wild.filter((n) => n.sprite === 'flowers'),
    driftwood = wild.filter((n) => n.sprite === 'driftwood');
  assert.ok(flowers.length >= 30);
  assert.ok(driftwood.length >= 20);
  assert.equal(flowers.length + driftwood.length, wild.length);
  for (const n of flowers) assert.equal(n.type, 'herbs', n.id);
  for (const n of driftwood)
    assert.deepEqual([n.type, n.amount, n.verb, n.regrow], ['wood', 1, 'Pick up', 180], n.id);
});
```

In `tests/actions/gather.test.js` replace

```js
/** The wild flower patches: the only nodes that grow back after being picked. */
const wild = NODES.filter((n) => n.regrow);
```

with

```js
/** The wild flower patches: herb nodes that grow back after being picked. */
const wild = NODES.filter((n) => n.sprite === 'flowers');
```

In `tests/game/state.test.js` change the comment above `const wild` to `/** The wild patches (flowers and driftwood): the only nodes that grow back after being picked. */`.

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/world/nodes.test.js`
Expected: FAIL: no driftwood nodes yet (the map has `driftwood` objects, but `WILD` doesn't name them).

- [ ] **Step 3: Add driftwood to `WILD` in `src/data/supplies.js`**

Replace the comment and object

```js
// Wild scenery the map scatters (tools/build-map.py) that can be harvested where it stands and grows back `regrow`
// game-seconds later. world/nodes.js turns each map patch into a node; the renderer draws it from NODES instead of from the map.
// The key is the sprite name in the map; the fields mean the same as in SUPPLIES.
export const WILD = {
  flowers: {
```

with

```js
// Wild scenery the map scatters (tools/build-map.py) that can be harvested where it stands and grows back `regrow`
// game-seconds later. world/nodes.js turns each map patch into a node; the renderer draws it from NODES instead of from the map.
// The key is the sprite name in the map; the fields mean the same as in SUPPLIES. Flowers grow inland; driftwood
// washes up on the sea beaches, so there is always wood for mending a boat.
export const WILD = {
  driftwood: {
    type: 'wood',
    amount: 1,
    label: 'Driftwood',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  flowers: {
```

- [ ] **Step 4: Update the wording in `src/world/nodes.js` and `src/ui/hud.js`**

In `src/world/nodes.js`, change the header's second line to `// each wild patch (flowers, driftwood) the map scattered. Also works out which supplies are still solid.` and the comment above `NODES` to:

```js
// The fixed supplies plus every wild patch the map scattered; a patch's map position is its id
// (`flowers-<x>-<y>`, `driftwood-<x>-<y>`). Wild patches copy their fields from WILD and their size from objects.json.
```

In `src/ui/hud.js`, replace `const DOING = { Chop: 'Chopping', Pick: 'Picking', Gather: 'Gathering' };` with `const DOING = { Chop: 'Chopping', Pick: 'Picking', 'Pick up': 'Picking up', Gather: 'Gathering' };`.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world/nodes.test.js tests/actions/gather.test.js tests/game/state.test.js`
Expected: PASS, including "every supply and wild patch can be walked to and gathered from each spawn" (it now walks to every driftwood patch too).

- [ ] **Step 6: Format, test everything, commit**

Run: `npm run format`, then `npm test`
Expected: PASS.

```bash
git add src/data/supplies.js src/world/nodes.js src/ui/hud.js tests/world/nodes.test.js tests/actions/gather.test.js tests/game/state.test.js
```

```bash
git commit -m "Wash driftwood up on the beaches as a regrowing wood source" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Save version 4

**Files:**
- Modify: `src/game/state.js` (whole file below)
- Test: `tests/game/state.test.js`

**Interfaces:**
- Consumes: `isSailable`, `SEA_BORDER` (Task 3), `WRECKS` (Task 2).
- Produces: game state fields `wrecks: string[]`, `boat: null | {from: string, x: number, y: number, dir: 0|1|2|3}`, `aboard: boolean`; `version: 4`; `restoreGame` reads versions 3 and 4.

- [ ] **Step 1: Write the failing tests**

In `tests/game/state.test.js`:

(a) Change the imports to:

```js
import { CHARACTERS } from '../../src/data/characters.js';
import { WRECKS } from '../../src/data/places.js';
import { SEA_BORDER, isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';
```

and below `const wild = ...` add:

```js

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');
```

(b) In the round-trip test, add after `original.discovered.push('meadows');`:

```js
  original.wrecks.push('wreck-east');
  original.boat = { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 2 };
```

(c) In the rejection test's list of edits, add these entries after `(g) => (g.regrowAt = { [wild[0].id]: -1 }),`:

```js
    (g) => (g.wrecks = ['nowhere']),
    (g) => (g.wrecks = undefined),
    (g) => (g.boat = undefined),
    (g) => (g.boat = { from: 'nowhere', x: east.launch.x, y: east.launch.y, dir: 2 }),
    (g) => (g.boat = { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 7 }),
    (g) => (g.boat = { from: 'wreck-east', x: NaN, y: east.launch.y, dir: 2 }),
    (g) => (g.aboard = 'yes'),
    (g) => (g.aboard = true),
    (g) => Object.assign(g.player, east.launch),
```

(`aboard` without a boat is refused, and so is a player on foot standing in the sea.)

(d) Add these tests at the end of the file:

```js
// Guards the boat on load: a player afloat stays afloat, and a boat (or a player in it) that a
// rebuilt map left on dry land goes back to the water by its old boat, with the player ashore.
test('a saved boat stays where it floats, or returns to its launch spot if the sea moved', () => {
  const afloat = createGame('survivor');
  afloat.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  afloat.aboard = true;
  Object.assign(afloat.player, { x: east.launch.x, y: east.launch.y, direction: 2 });
  assert.deepEqual(restoreGame(serializeGame(afloat)), afloat);

  // The same boat saved on dry land (the survivor's start): first moored there, then with the player in it.
  const moored = createGame('survivor');
  moored.boat = { from: east.id, x: moored.player.x, y: moored.player.y, dir: 2 };
  assert.deepEqual(restoreGame(serializeGame(moored)).boat, {
    ...moored.boat,
    x: east.launch.x,
    y: east.launch.y,
  });

  const stranded = structuredClone(moored);
  stranded.aboard = true;
  const back = restoreGame(serializeGame(stranded));
  assert.equal(back.aboard, false);
  assert.deepEqual([back.player.x, back.player.y], [east.x, east.y]);
  assert.deepEqual([back.boat.x, back.boat.y], [east.launch.x, east.launch.y]);
});

// Guards players who saved before the sea border existed: their adventure moves onto the bigger
// map with everything they found, and a flower patch's regrow timer follows the patch.
test('a version 3 save moves onto the bigger map and keeps its progress', () => {
  const game = createGame('builder');
  const flower = wild.find((n) => n.sprite === 'flowers');
  game.landmarks.push('h-square');
  game.collected.push('village-wood');
  game.discovered.push('meadows');
  game.elapsed = 10;
  game.regrowAt[flower.id] = 50;

  // The same adventure as an older build saved it: positions before the border, no boat fields.
  const { wrecks, boat, aboard, ...old } = game;
  old.version = 3;
  old.player = { ...game.player, x: game.player.x - SEA_BORDER, y: game.player.y - SEA_BORDER };
  old.regrowAt = { [`flowers-${flower.x - SEA_BORDER}-${flower.y - SEA_BORDER}`]: 50 };

  assert.deepEqual(restoreGame(JSON.stringify(old)), game);
});

// Guards a version 3 player who stood where the new coast now cuts in: they go back to their
// start instead of losing the whole save.
test('a version 3 player whose spot is now sea starts again at their spawn, progress kept', () => {
  const game = createGame('survivor');
  game.landmarks.push('l-beacon');
  const { wrecks, boat, aboard, ...old } = game;
  old.version = 3;
  old.player = { x: 24000, y: 9000, direction: 2 }; // the old lagoon sea, still sea on the new map

  const restored = restoreGame(JSON.stringify(old));
  assert.deepEqual(restored.player, { ...createGame('survivor').player, direction: 2 });
  assert.deepEqual(restored.landmarks, ['l-beacon']);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/game/state.test.js`
Expected: FAIL: `createGame` has no `wrecks`/`boat`/`aboard`, version is 3.

- [ ] **Step 3: Replace `src/game/state.js`**

```js
// The game state: one plain object that holds everything about a character's adventure
// (where they stand, what's in their backpack, what they've found, their boat). This file creates
// a new one, turns it into text for saving, and carefully checks saved text before loading it back.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { isWalkable, isSailable, SEA_BORDER } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';

/** The save shape this build writes. Version 3 saves are moved up to it; older ones can't be read. */
const VERSION = 4;

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `collected` lists one-time supplies gathered, `regrowAt`
 *   maps each picked wild patch to the game time it grows back, `discovered` lists region ids,
 *   `landmarks`, `waypoints` and `wrecks` list the ids of places, signposts and old boats found,
 *   `boat` is the repaired boat (`{from, x, y, dir}`) or null, `aboard` is true while the player
 *   sits in it, `elapsed` is game seconds played and `distance` is world units travelled.
 * @throws {Error} If the character id isn't one of the known characters.
 */
export function createGame(characterId) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  return {
    version: VERSION,
    character: character.id,
    player: { ...character.spawn, direction: 0 },
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    collected: [],
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    wrecks: [],
    boat: null,
    aboard: false,
    elapsed: 0,
    distance: 0,
  };
}

/**
 * Turns the game state into text so it can be saved.
 *
 * @param {object} state - The game being played.
 * @returns {string} The state as JSON text.
 */
export function serializeGame(state) {
  return JSON.stringify(state);
}

/**
 * Moves the x-y position at the end of a wild patch id out by the sea border.
 * For example `flowers-10-20` becomes `flowers-2058-2068`. Other ids are left as they are.
 */
const shiftId = (id) =>
  id.replace(/-(\d+)-(\d+)$/, (_, x, y) => `-${Number(x) + SEA_BORDER}-${Number(y) + SEA_BORDER}`);

/**
 * Brings a version 3 save up to version 4, the shape since the sea border was added.
 *
 * The map grew by SEA_BORDER units of sea on every side, so every old position moves out by that
 * much, like re-pinning a poster on a bigger board. A player who stood where the new coast now
 * cuts in goes back to their character's start instead. Wild patch ids hold their position, so
 * their regrow timers move too. Old saves have no boat yet. Anything odd is left alone, for the
 * checks in restoreGame to refuse.
 *
 * @param {object} s - The parsed version 3 save.
 * @returns {object} The same adventure in the version 4 shape.
 */
function fromVersion3(s) {
  const player = { ...s.player, x: s.player?.x + SEA_BORDER, y: s.player?.y + SEA_BORDER };
  const spawn = CHARACTERS.find((c) => c.id === s.character)?.spawn;
  if (Number.isFinite(player.x) && Number.isFinite(player.y) && spawn && !isWalkable(player.x, player.y))
    Object.assign(player, spawn);

  const timers = s.regrowAt;
  const regrowAt =
    timers && typeof timers === 'object' && !Array.isArray(timers)
      ? Object.fromEntries(Object.entries(timers).map(([id, t]) => [shiftId(id), t]))
      : timers;

  return { ...s, version: 4, player, regrowAt, wrecks: [], boat: null, aboard: false };
}

/**
 * Works out where a loaded player and boat should be, mending spots a rebuilt map took away.
 *
 * Aboard, the boat sits right under the player. A boat (or a player in it) left on a spot that is
 * no longer sea goes back to the water by the old boat it was repaired from, and the player is set
 * ashore on that beach. Positions that are still fine are kept as they are.
 *
 * @param {object} s - The checked save.
 * @returns {{player: object, boat: object|null, aboard: boolean}} Fresh objects for the restored game.
 */
function placeBoat(s) {
  const player = { x: s.player.x, y: s.player.y, direction: s.player.direction };
  if (!s.boat) return { player, boat: null, aboard: false };

  const wreck = WRECKS.find((w) => w.id === s.boat.from);
  const boat = s.aboard
    ? { from: wreck.id, x: player.x, y: player.y, dir: player.direction }
    : { from: wreck.id, x: s.boat.x, y: s.boat.y, dir: s.boat.dir };
  if (isSailable(boat.x, boat.y)) return { player, boat, aboard: s.aboard };

  // The sea moved: float the boat at its launch spot again, and bring a player who was in it ashore.
  boat.x = wreck.launch.x;
  boat.y = wreck.launch.y;
  if (s.aboard) Object.assign(player, { x: wreck.x, y: wreck.y });
  return { player, boat, aboard: false };
}

/**
 * Reads saved text back into a game state, or gives up if anything looks wrong.
 *
 * Saved text could be old, broken, or edited by hand, so we check every field before trusting
 * it, like a librarian checking a returned book page by page. Then we build a brand-new object
 * field by field instead of using the loaded one, so stray extra fields never sneak into the game.
 * A new field added to the game state must be checked and copied here too, or it is lost on load.
 * Version 3 saves are first moved onto the bigger map (see fromVersion3).
 *
 * @param {string} json - The saved text.
 * @returns {object|null} A safe game state, or null if the save can't be used.
 */
export function restoreGame(json) {
  try {
    const parsed = JSON.parse(json);
    const s = parsed?.version === 3 ? fromVersion3(parsed) : parsed;

    // The right save version, a known character, and a player facing a real direction.
    if (
      !s ||
      s.version !== VERSION ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !s.player ||
      ![0, 1, 2, 3].includes(s.player.direction)
    )
      return null;

    // A boat came from a real old boat, sits at a real position and faces a real direction.
    // Being aboard needs a boat.
    const { boat } = s;
    if (
      typeof s.aboard !== 'boolean' ||
      (s.aboard && !boat) ||
      (boat !== null &&
        (typeof boat !== 'object' ||
          !WRECKS.some((w) => w.id === boat.from) ||
          !Number.isFinite(boat.x) ||
          !Number.isFinite(boat.y) ||
          ![0, 1, 2, 3].includes(boat.dir)))
    )
      return null;

    // On foot the player must stand somewhere walkable. Aboard, any real position will do here:
    // placeBoat brings them ashore if the map no longer has sea there.
    if (
      s.aboard
        ? !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y)
        : !isWalkable(s.player.x, s.player.y)
    )
      return null;

    const { resources, regrowAt } = s;

    // Every resource must be a sensible whole number: not negative, not huge.
    if (
      !resources ||
      !RESOURCES.every(
        (key) =>
          Number.isSafeInteger(resources[key]) && resources[key] >= 0 && resources[key] < 100000,
      )
    )
      return null;

    // The gathered, discovered and found lists may only hold real ids, each listed once.
    for (const [list, allowed] of [
      [s.collected, SUPPLIES],
      [s.discovered, REGIONS],
      [s.landmarks, LANDMARKS],
      [s.waypoints, WAYPOINTS],
      [s.wrecks, WRECKS],
    ]) {
      if (
        !Array.isArray(list) ||
        list.length > allowed.length ||
        new Set(list).size !== list.length ||
        !list.every((id) => allowed.some((a) => a.id === id))
      )
        return null;
    }

    // Time played and distance travelled must be real, non-negative numbers.
    if (
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      !Number.isFinite(s.distance) ||
      s.distance < 0
    )
      return null;

    // Regrowth timers must be a plain object of non-negative times.
    if (
      !regrowAt ||
      typeof regrowAt !== 'object' ||
      Array.isArray(regrowAt) ||
      !Object.values(regrowAt).every((t) => Number.isFinite(t) && t >= 0)
    )
      return null;

    // Patch ids are map positions, so a rebuilt map can retire one; dropping its timer only lets that patch regrow early.
    // Each kept timer is also capped at one regrow ahead, so a patch can't stay gone forever.
    const timers = NODES.filter((n) => n.regrow && Object.hasOwn(regrowAt, n.id)).map((n) => [
      n.id,
      Math.min(regrowAt[n.id], s.elapsed + n.regrow),
    ]);

    // Build the result fresh, copying only the fields we checked.
    const placed = placeBoat(s);
    return {
      version: VERSION,
      character: s.character,
      player: placed.player,
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      collected: [...s.collected],
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      landmarks: [...s.landmarks],
      waypoints: [...s.waypoints],
      wrecks: [...s.wrecks],
      boat: placed.boat,
      aboard: placed.aboard,
      elapsed: s.elapsed,
      distance: s.distance,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/game/`
Expected: PASS. (`tests/game/saves.test.js` only round-trips `createGame` output, so it still passes.)

- [ ] **Step 5: Format, test everything, commit**

Run: `npm run format`, then `npm test`
Expected: PASS.

```bash
git add src/game/state.js tests/game/state.test.js
```

```bash
git commit -m "Save version 4: boat fields, and move version 3 saves onto the bigger map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Old boats: solid hulls, finding them, repairing one

**Files:**
- Modify: `src/data/balance.js` (append)
- Modify: `src/world/nodes.js` (append; import `WRECKS`)
- Modify: `src/actions/move.js` (`facing`, solid wrecks)
- Create: `src/actions/boat.js` (repair part)
- Modify: `src/actions/discover.js`
- Modify: `src/core/loop.js:21-31` (toast words for a found old boat)
- Test: create `tests/actions/boat.test.js`; modify `tests/actions/move.test.js`, `tests/actions/discover.test.js`, `tests/world/places.test.js`, `tests/world/sea.test.js`, `tests/world/nodes.test.js`

**Interfaces:**
- Consumes: `WRECKS`, `REPAIR_COST`, game state fields from Task 5.
- Produces:
  - `src/data/balance.js`: `REPAIR_COST = {wood: 6, stone: 2}`, `REPAIR_SECONDS = 8`, `WRECK_RADIUS = 200`.
  - `src/world/nodes.js`: `wreckBases(boat): number[][]`, `solidBases(state): number[][]`.
  - `src/actions/move.js`: `facing(dx, dy): 0|1|2|3`.
  - `src/actions/boat.js`: `nearbyWreck(state): object|null`, `missingForRepair(state): object`, `listMissing(missing): string`, `beginRepair(state, animator): {ok, reason?, wreck?, missing?}`, `finishRepair(state, id): object|null`.
  - `discover(state)` can return `{kind: 'wreck', id, name}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/actions/boat.test.js`:

```js
// Checks the boat actions: repairing an old boat, getting in, rowing and stepping ashore.
// They decide whether the player can reach the islets at all and what the repair costs, so a
// mistake could strand a player or take their wood twice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WRECKS } from '../../src/data/places.js';
import { REPAIR_COST, REPAIR_SECONDS } from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';
import {
  nearbyWreck,
  missingForRepair,
  listMissing,
  beginRepair,
  finishRepair,
} from '../../src/actions/boat.js';

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');

/**
 * Makes a game whose player stands just south of the lagoon's old boat with exactly enough wood
 * and stone to repair it.
 *
 * @returns {object} The game state.
 */
function besideWreck() {
  const game = createGame('survivor');
  Object.assign(game.player, { x: east.x, y: east.y + 30 });
  game.resources.wood = REPAIR_COST.wood;
  game.resources.stone = REPAIR_COST.stone;
  return game;
}

// Guards who can repair: only a player on foot, next to the old boat, who has no boat yet.
test('an old boat is in reach only from beside it, and only without a boat', () => {
  assert.equal(nearbyWreck(besideWreck())?.id, 'wreck-east');
  assert.equal(nearbyWreck(createGame('survivor')), null); // the start is too far away

  const owner = besideWreck();
  owner.boat = { from: 'wreck-north', x: 0, y: 0, dir: 0 };
  assert.equal(nearbyWreck(owner), null);
});

// Guards the shopping list: it names only what is short, and a short backpack can't start a repair.
test('a repair says what is missing and will not start without it', () => {
  const game = besideWreck(),
    animator = createAnimator();
  game.resources.wood = 2;
  assert.deepEqual(missingForRepair(game), { wood: 4 });
  assert.equal(listMissing({ wood: 4, stone: 1 }), '4 wood and 1 stone');

  assert.deepEqual(beginRepair(game, animator), {
    ok: false,
    reason: 'missing',
    wreck: east,
    missing: { wood: 4 },
  });
  assert.equal(animator.pending, null);
});

// Guards the repair's timing and price: E only starts the hammering, and the wood and stone are
// paid once, when it finishes, with the boat floating at the launch spot pointing out to sea.
test('a repair takes REPAIR_SECONDS, pays exactly once and floats the boat at its launch', () => {
  const game = besideWreck(),
    animator = createAnimator();

  assert.equal(beginRepair(game, animator).ok, true);
  assert.deepEqual(animator.pending, { clip: 'build', target: 'wreck-east', duration: REPAIR_SECONDS });
  assert.equal(game.resources.wood, REPAIR_COST.wood);

  assert.equal(advanceAnimation(animator, REPAIR_SECONDS - 0.01, {}), null);
  assert.deepEqual(advanceAnimation(animator, 0.02, {}), { clip: 'build', target: 'wreck-east' });
  assert.equal(finishRepair(game, 'wreck-east'), east);
  assert.deepEqual([game.resources.wood, game.resources.stone], [0, 0]);
  assert.deepEqual(game.boat, { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 2 });

  assert.equal(finishRepair(game, 'wreck-east'), null);
  assert.deepEqual([game.resources.wood, game.resources.stone], [0, 0]);
});

// Guards against paying for nothing: walking off or spending the wood mid-repair means no boat.
test('a repair is not paid when the player walked away or no longer has enough', () => {
  const away = besideWreck();
  away.player.y += 400;
  assert.equal(finishRepair(away, 'wreck-east'), null);
  assert.equal(away.boat, null);

  const spent = besideWreck();
  spent.resources.stone = 1;
  assert.equal(finishRepair(spent, 'wreck-east'), null);
  assert.equal(spent.resources.wood, REPAIR_COST.wood);
});
```

In `tests/actions/move.test.js`, change the imports to add `WRECKS` and `solidBases`:

```js
import { WORLD, isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases, solidBases } from '../../src/world/nodes.js';
import { WRECKS } from '../../src/data/places.js';
import { createGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';
```

and append:

```js

// Guards the old boats on the beach: each is a solid hull to walk around, except the one the
// player repaired, which has gone to sea.
test('old boats block walking, except the one the player repaired', () => {
  const wreck = WRECKS.find((w) => w.id === 'wreck-east');
  assert.ok(isWalkable(wreck.x, wreck.y - 5));
  assert.equal(isWalkable(wreck.x, wreck.y - 5, solidBases(createGame('survivor'))), false);

  const owner = createGame('survivor');
  owner.boat = { from: wreck.id, x: wreck.launch.x, y: wreck.launch.y, dir: 2 };
  assert.ok(isWalkable(wreck.x, wreck.y - 5, solidBases(owner)));
});
```

In `tests/actions/discover.test.js`, add `WRECKS` to its `places.js` import (or add `import { WRECKS } from '../../src/data/places.js';`), add `import { WRECK_RADIUS } from '../../src/data/balance.js';` (merge with an existing balance import if there is one), and append:

```js

// Guards the old-boat finds: each is found once, from up to WRECK_RADIUS away, so the map can mark it.
test('an old boat is found once when the player comes within its radius', () => {
  const game = createGame('survivor'),
    wreck = WRECKS.find((w) => w.id === 'wreck-east');
  /** The old-boat finds among everything discover() reports this time. */
  const wreckFinds = () => discover(game).filter((f) => f.kind === 'wreck');

  Object.assign(game.player, { x: wreck.x, y: wreck.y + WRECK_RADIUS + 10 });
  assert.deepEqual(wreckFinds(), []);
  game.player.y = wreck.y + WRECK_RADIUS - 10;
  assert.deepEqual(wreckFinds(), [{ kind: 'wreck', id: wreck.id, name: wreck.name }]);
  assert.deepEqual(game.wrecks, [wreck.id]);
  assert.deepEqual(wreckFinds(), []);
});
```

In `tests/world/places.test.js` and `tests/world/sea.test.js` (not `flood.js`, which takes no bases), change the `nodeBases` import to `import { nodeBases, wreckBases } from '../../src/world/nodes.js';` and every `const solid = nodeBases([]);` to `const solid = [...nodeBases([]), ...wreckBases(null)];`. In `tests/world/nodes.test.js`, do the same for `bases = nodeBases([])`.

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/actions/boat.test.js tests/actions/move.test.js tests/actions/discover.test.js`
Expected: FAIL: `src/actions/boat.js` doesn't exist, `solidBases` and `WRECK_RADIUS` aren't exported.

- [ ] **Step 3: Add the repair numbers to `src/data/balance.js`**

Append:

```js

/** What repairing an old boat costs. It is taken from the backpack when the repair finishes. */
export const REPAIR_COST = { wood: 6, stone: 2 };

// How many seconds repairing an old boat takes: a little longer than a 6 s gather, because it is a bigger job.
export const REPAIR_SECONDS = 8;

/** How close the player must come to an old boat to find it (and mark it on the map). */
export const WRECK_RADIUS = 200;
```

- [ ] **Step 4: Make old boats solid in `src/world/nodes.js`**

Add `import { WRECKS } from '../data/places.js';` to the imports, change the header's last sentence to `Also works out which supplies and old boats are still solid.`, and append:

```js

/**
 * Lists the solid base of every old boat still lying on the beach.
 *
 * An old boat is in the way like a fallen log. The one the player repaired has gone to sea, so
 * its base is left out.
 *
 * @param {object|null} boat - The player's boat (`{from, ...}`), or null if they have none.
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export function wreckBases(boat) {
  const [halfWidth, depth] = OBJECT_SPECS['old-boat'].footprint;
  return WRECKS.filter((w) => w.id !== boat?.from).map((w) => [
    w.x - halfWidth,
    w.y - depth,
    w.x + halfWidth,
    w.y,
  ]);
}

/**
 * Lists everything solid that isn't part of the map itself: supplies not yet gathered and old
 * boats still on the beach.
 *
 * @param {object} state - The game being played.
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export const solidBases = (state) => [...nodeBases(state.collected), ...wreckBases(state.boat)];
```

- [ ] **Step 5: Use them in `src/actions/move.js` and add `facing`**

Change the import `import { nodeBases } from '../world/nodes.js';` to `import { solidBases } from '../world/nodes.js';`. Add above `movePlayer`:

```js
/**
 * Says which way something faces when it heads along (dx, dy): mostly sideways or mostly up/down.
 *
 * @param {number} dx - Sideways movement: negative is west.
 * @param {number} dy - Up/down movement: negative is north.
 * @returns {number} 0 south, 1 west, 2 east or 3 north.
 */
export const facing = (dx, dy) =>
  Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;

```

Inside `movePlayer`, replace

```js
  state.player.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;

  // A save made before a supply moved may stand inside its base; let the player walk out instead of trapping them.
  const bases = nodeBases(state.collected).filter((base) => !blocks([base], x, y));
```

with

```js
  state.player.direction = facing(dx, dy);

  // A save made before a supply or old boat moved may stand inside its base; let the player walk out instead of trapping them.
  const bases = solidBases(state).filter((base) => !blocks([base], x, y));
```

and change the header's second line to `// trees, buildings, old boats or supplies that haven't been gathered yet.`

- [ ] **Step 6: Create `src/actions/boat.js` (repair part)**

```js
// The boat actions: repairing an old boat on the beach, getting in, rowing about and stepping
// ashore. Repairing is a timed action like gathering: E starts it (`beginRepair`) and the game
// loop finishes it (`finishRepair`), so the cost is paid exactly once.

import { WRECKS } from '../data/places.js';
import { GATHER_RANGE, REPAIR_COST, REPAIR_SECONDS } from '../data/balance.js';
import { startAction } from '../animation/clips.js';
import { facing } from './move.js';

/** How far a spot is from the player, in world units. */
const distance = (state, p) => Math.hypot(p.x - state.player.x, p.y - state.player.y);

/**
 * Finds the old boat the player could repair right now.
 *
 * Only someone on foot without a boat can repair one, and only when standing next to it (the same
 * reach as gathering).
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest old boat in reach, or null.
 */
export function nearbyWreck(state) {
  if (state.boat || state.aboard) return null;
  return (
    WRECKS.filter((w) => distance(state, w) < GATHER_RANGE).sort(
      (a, b) => distance(state, a) - distance(state, b),
    )[0] ?? null
  );
}

/**
 * Says what the backpack still lacks for a repair, like a shopping list.
 *
 * @param {object} state - The game being played.
 * @returns {object} Each resource that falls short with how many more are needed, e.g. `{wood: 3}`;
 *   an empty object when there is enough.
 */
export function missingForRepair(state) {
  return Object.fromEntries(
    Object.entries(REPAIR_COST)
      .map(([type, cost]) => [type, cost - state.resources[type]])
      .filter(([, short]) => short > 0),
  );
}

/**
 * Puts a shopping list into words, e.g. `{wood: 3, stone: 1}` becomes "3 wood and 1 stone".
 *
 * @param {object} missing - What missingForRepair returned.
 * @returns {string} The list in words.
 */
export const listMissing = (missing) =>
  Object.entries(missing)
    .map(([type, count]) => `${count} ${type}`)
    .join(' and ');

/**
 * Starts repairing the nearest old boat: what pressing E does next to one.
 *
 * Nothing is paid yet. Like beginGather, this only starts the timed action (the hammering `build`
 * clip); finishRepair pays and hands over the boat when it runs out.
 *
 * @param {object} state - The game being played. The player turns to face the old boat.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @returns {{ok: boolean, reason?: string, wreck?: object, missing?: object}} `ok` with the old boat
 *   when it started; otherwise `reason` is 'busy', 'none' (no old boat in reach, or a boat already
 *   owned) or 'missing' (with `missing`, what the backpack lacks).
 */
export function beginRepair(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const wreck = nearbyWreck(state);
  if (!wreck) return { ok: false, reason: 'none' };
  const missing = missingForRepair(state);
  if (Object.keys(missing).length) return { ok: false, reason: 'missing', wreck, missing };

  // Face the old boat, unless it's almost straight above or below the player.
  if (Math.abs(wreck.x - state.player.x) > 8)
    state.player.direction = wreck.x < state.player.x ? 1 : 2;
  startAction(animator, 'build', wreck.id, REPAIR_SECONDS);
  return { ok: true, wreck };
}

/**
 * Pays for a repair and puts the mended boat in the water when the repair action finishes.
 *
 * It checks again that the old boat is in reach, that the player still has no boat, and that the
 * backpack still holds enough, so nothing is paid twice or paid for nothing. The boat floats at
 * the old boat's `launch` spot, pointing out to sea.
 *
 * @param {object} state - The game being played. Its resources and `boat` change.
 * @param {string} id - Id of the old boat the action was aimed at.
 * @returns {object|null} The old boat that was repaired, or null if nothing happened.
 */
export function finishRepair(state, id) {
  const wreck = WRECKS.find((w) => w.id === id);
  if (!wreck || state.boat || state.aboard || distance(state, wreck) >= GATHER_RANGE) return null;
  if (Object.keys(missingForRepair(state)).length) return null;

  for (const [type, cost] of Object.entries(REPAIR_COST)) state.resources[type] -= cost;
  const { launch } = wreck;
  state.boat = {
    from: wreck.id,
    x: launch.x,
    y: launch.y,
    dir: facing(launch.x - wreck.x, launch.y - wreck.y),
  };
  return wreck;
}
```

- [ ] **Step 7: Find old boats in `src/actions/discover.js`**

Change the imports to:

```js
import { regionOf } from '../world/regions.js';
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS, WRECK_RADIUS } from '../data/balance.js';
```

Change the header to `// The "discover" action: notices when the player first enters a region, comes close to a` / `// landmark or an old boat, or walks up to a signpost.`. In the JSDoc, change the `@param` line to mention `wrecks` (`New finds are added to \`discovered\`, \`landmarks\`, \`waypoints\` or \`wrecks\`.`) and the `@returns` line's kinds to `'region', 'landmark', 'waypoint' or 'wreck'`. Add one entry to the loop's list:

```js
  // Landmarks, signposts and old boats are found by coming close; each list remembers the ids already found.
  for (const [kind, places, list, radius] of [
    ['landmark', LANDMARKS, state.landmarks, LANDMARK_RADIUS],
    ['waypoint', WAYPOINTS, state.waypoints, WAYPOINT_RADIUS],
    ['wreck', WRECKS, state.wrecks, WRECK_RADIUS],
  ])
```

- [ ] **Step 8: Give the loop's toast words for a found old boat**

In `src/core/loop.js`, add `import { REPAIR_COST } from '../data/balance.js';` and add to `FOUND` after the `waypoint` entry:

```js
  // Coming close to an old boat on the beach, and what mending it costs.
  wreck: ({ name }) =>
    `Found ${name} · Repair it with ${REPAIR_COST.wood} wood and ${REPAIR_COST.stone} stone`,
```

- [ ] **Step 9: Run the tests**

Run: `node --test tests/actions/ tests/world/`
Expected: PASS.

- [ ] **Step 10: Format, test everything, commit**

Run: `npm run format`, then `npm test`
Expected: PASS.

```bash
git add src/data/balance.js src/world/nodes.js src/actions/move.js src/actions/boat.js src/actions/discover.js src/core/loop.js tests/actions tests/world
```

```bash
git commit -m "Find and repair old boats on the coast" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sailing: board, row, step ashore

**Files:**
- Modify: `src/data/balance.js` (append)
- Modify: `src/actions/move.js`
- Modify: `src/actions/boat.js` (append)
- Modify: `src/actions/travel.js`
- Test: `tests/actions/boat.test.js` (append), `tests/actions/travel.test.js` (append)

**Interfaces:**
- Consumes: `isSailable`, `isDeep`, `isWalkable`, `solidBases`, `facing`, `BOARD_RANGE`, `LAND_RANGE`.
- Produces:
  - `src/data/balance.js`: `BOAT_SPEED = 210`, `BOAT_FAST_SPEED = 300`, `DEEP_LOOKOUT = 60`.
  - `src/actions/boat.js`: `canBoard(state): boolean`, `board(state): boolean`, `landingSpot(state): {x, y}|null`, `disembark(state): boolean`, `deepAhead(state, dx, dy): boolean`.
  - `movePlayer` moves the boat with the player while `state.aboard`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/actions/boat.test.js` (and add the imports shown first to the top of the file):

```js
import { WALK_SPEED, BOAT_SPEED, BOAT_FAST_SPEED } from '../../src/data/balance.js';
import { isWalkable, isSailable } from '../../src/world/map.js';
import { solidBases } from '../../src/world/nodes.js';
import { movePlayer } from '../../src/actions/move.js';
import {
  canBoard,
  board,
  landingSpot,
  disembark,
  deepAhead,
} from '../../src/actions/boat.js';
```

(Merge these with the existing imports: one import line per module.)

```js
/**
 * Makes a game whose player sits in their boat at an old boat's launch spot.
 *
 * @param {object} wreck - The old boat the boat was repaired from.
 * @returns {object} The game state.
 */
function afloat(wreck) {
  const game = createGame('survivor');
  game.boat = { from: wreck.id, x: wreck.launch.x, y: wreck.launch.y, dir: 2 };
  game.aboard = true;
  Object.assign(game.player, { x: wreck.launch.x, y: wreck.launch.y, direction: 2 });
  return game;
}

// Guards getting in: only next to your own boat, only on foot, and the player ends up in it.
test('boarding works only near your own boat and puts the player in it', () => {
  const game = createGame('survivor');
  Object.assign(game.player, { x: east.launch.x - 120, y: east.launch.y });
  assert.equal(board(game), false); // no boat yet

  game.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  assert.ok(canBoard(game));
  assert.ok(board(game));
  assert.deepEqual(
    [game.player.x, game.player.y, game.player.direction, game.aboard],
    [east.launch.x, east.launch.y, 2, true],
  );
  assert.equal(board(game), false); // already in it

  const far = createGame('survivor');
  far.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  assert.equal(canBoard(far), false);
});

// Guards every old boat's beach: from each launch spot the player can step ashore onto solid
// ground, and from there get back in.
test('by every old boat, the player can step ashore and get back in', () => {
  for (const wreck of WRECKS) {
    const game = afloat(wreck);
    assert.ok(disembark(game), `${wreck.id}: no beach in reach`);
    assert.equal(game.aboard, false);
    assert.ok(isWalkable(game.player.x, game.player.y, solidBases(game)), wreck.id);
    assert.deepEqual([game.boat.x, game.boat.y], [wreck.launch.x, wreck.launch.y]);
    assert.ok(board(game), `${wreck.id}: boat out of reach from the beach`);
  }
});

// Guards the boat's water: it rows across shallow sea, deep water stops it (with a warning ahead),
// and the shallows stop it short of the sand. The boat always stays under the player.
test('the boat sails only on shallow sea: deep water and the beach stop it', () => {
  const game = afloat(east);
  for (let i = 0; i < 600; i++) movePlayer(game, 1, 0, 0.1);
  assert.ok(isSailable(game.player.x, game.player.y));
  assert.ok(deepAhead(game, 1, 0));
  assert.deepEqual([game.boat.x, game.boat.y], [game.player.x, game.player.y]);

  for (let i = 0; i < 900; i++) movePlayer(game, -1, 0, 0.1);
  assert.ok(isSailable(game.player.x, game.player.y));
  assert.ok(game.player.x > east.x);
  assert.equal(deepAhead(game, -1, 0), false);
  assert.equal(deepAhead(createGame('scout'), 1, 0), false); // on foot there is no warning
});

// Guards the boat's speed: faster than walking, and faster again with Shift.
test('the boat is faster than walking, and faster again with Shift', () => {
  const slow = afloat(east),
    fast = afloat(east);
  movePlayer(slow, 1, 0, 0.1);
  movePlayer(fast, 1, 0, 0.1, true);
  assert.ok(Math.abs(slow.player.x - east.launch.x - BOAT_SPEED * 0.1) < 0.001);
  assert.ok(Math.abs(fast.player.x - east.launch.x - BOAT_FAST_SPEED * 0.1) < 0.001);
  assert.ok(BOAT_SPEED > WALK_SPEED);
});

// Guards landing out at sea: with no land in reach, the player stays in the boat.
test('far from land there is nowhere to step ashore', () => {
  const game = afloat(east);
  for (let i = 0; i < 600; i++) movePlayer(game, 1, 0, 0.1);
  assert.equal(landingSpot(game), null);
  assert.equal(disembark(game), false);
  assert.equal(game.aboard, true);
});
```

Append to `tests/actions/travel.test.js` (add `import { WRECKS } from '../../src/data/places.js';` at the top if it isn't there):

```js

// Guards signpost travel from the boat: the player arrives on foot and the boat stays where it floated.
test('travelling from the boat leaves the boat where it floats', () => {
  const east = WRECKS.find((w) => w.id === 'wreck-east');
  const game = createGame('survivor');
  game.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  game.aboard = true;
  Object.assign(game.player, east.launch);
  game.waypoints.push('l-wp-wreck');

  assert.ok(travelTo(game, 'l-wp-wreck'));
  assert.equal(game.aboard, false);
  assert.deepEqual(game.boat, { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/actions/boat.test.js tests/actions/travel.test.js`
Expected: FAIL: `board`, `BOAT_SPEED` etc. are not exported.

- [ ] **Step 3: Add the boat speeds to `src/data/balance.js`**

Append:

```js

/** How fast the small boat moves, in world units per second. Faster than walking: the sea is wide. */
export const BOAT_SPEED = 210;

/** How fast the small boat moves while Shift is held, in world units per second. */
export const BOAT_FAST_SPEED = 300;

/** How far ahead of the boat to look for deep sea when warning that it is too rough. */
export const DEEP_LOOKOUT = 60;
```

- [ ] **Step 4: Teach `movePlayer` to row**

In `src/actions/move.js`, change the imports to:

```js
import { isWalkable, isSailable, blocks } from '../world/map.js';
import { solidBases } from '../world/nodes.js';
import {
  WALK_SPEED,
  RUN_SPEED,
  BOAT_SPEED,
  BOAT_FAST_SPEED,
  MAX_MOVE_DT,
} from '../data/balance.js';
```

Change the header to:

```js
// The "move" action: walking and running around the world without passing through water,
// trees, buildings, old boats or supplies that haven't been gathered yet, and rowing the boat
// across shallow sea.
```

Replace the body of `movePlayer` from `// Make diagonal steps the same length...` to the end with:

```js
  // Make diagonal steps the same length as straight ones, then scale by speed and time.
  const length = Math.hypot(dx, dy);
  const speed = state.aboard
    ? running
      ? BOAT_FAST_SPEED
      : BOAT_SPEED
    : running
      ? RUN_SPEED
      : WALK_SPEED;
  const step = speed * Math.min(dt, MAX_MOVE_DT);
  dx = (dx / length) * step;
  dy = (dy / length) * step;
  const { x, y } = state.player;

  state.player.direction = facing(dx, dy);

  // A save made before a supply or old boat moved may stand inside its base; let the player walk out instead of trapping them.
  const bases = solidBases(state).filter((base) => !blocks([base], x, y));

  /** True if the player may move onto the spot: shallow sea in the boat, dry open ground on foot. */
  const free = (px, py) => (state.aboard ? isSailable(px, py) : isWalkable(px, py, bases));

  // Try the x and y parts separately, so a wall in one direction still lets the player slide along it.
  if (free(x + dx, y)) state.player.x += dx;
  if (free(state.player.x, y + dy)) state.player.y += dy;

  // The boat carries the player, so it goes wherever they go and points the same way.
  if (state.aboard)
    Object.assign(state.boat, {
      x: state.player.x,
      y: state.player.y,
      dir: state.player.direction,
    });

  const distance = Math.hypot(state.player.x - x, state.player.y - y);
  state.distance += distance;
  return distance > 0;
```

In the JSDoc, change the `@param {boolean} [running=false]` line to `- True while Shift is held, so the step (walking or rowing) is longer.`

- [ ] **Step 5: Append the sailing actions to `src/actions/boat.js`**

Change the imports to:

```js
import { WRECKS } from '../data/places.js';
import {
  GATHER_RANGE,
  REPAIR_COST,
  REPAIR_SECONDS,
  BOARD_RANGE,
  LAND_RANGE,
  DEEP_LOOKOUT,
} from '../data/balance.js';
import { isWalkable, isDeep } from '../world/map.js';
import { solidBases } from '../world/nodes.js';
import { startAction } from '../animation/clips.js';
import { facing } from './move.js';
```

and append:

```js

/**
 * Says whether the player can get into their boat right now: on foot, owning a boat, and close to it.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True if pressing E would board the boat.
 */
export const canBoard = (state) =>
  !state.aboard && !!state.boat && distance(state, state.boat) < BOARD_RANGE;

/**
 * Gets the player into their boat, if it is close enough.
 *
 * The player moves onto the boat's spot and faces the way it points.
 *
 * @param {object} state - The game being played. `player` and `aboard` change.
 * @returns {boolean} True if the player got in.
 */
export function board(state) {
  if (!canBoard(state)) return false;
  Object.assign(state.player, { x: state.boat.x, y: state.boat.y, direction: state.boat.dir });
  state.aboard = true;
  return true;
}

/**
 * Finds the closest dry spot the player could step onto from the boat.
 *
 * It checks rings of spots around the boat, 12 units apart and growing outward, like ripples from
 * a stone dropped in water, and keeps the first spot the player could stand on. The rings stay
 * inside LAND_RANGE, so a spot it finds is always close enough to board again.
 *
 * @param {object} state - The game being played.
 * @returns {{x: number, y: number}|null} The spot, or null when the player isn't aboard or no land is near.
 */
export function landingSpot(state) {
  if (!state.aboard) return null;
  const bases = solidBases(state);
  for (let r = 12; r < LAND_RANGE; r += 12)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2,
        x = Math.round(state.player.x + Math.cos(angle) * r),
        y = Math.round(state.player.y + Math.sin(angle) * r);
      if (isWalkable(x, y, bases)) return { x, y };
    }
  return null;
}

/**
 * Steps the player ashore and leaves the boat moored where it floats.
 *
 * @param {object} state - The game being played. `player`, `boat` and `aboard` change.
 * @returns {boolean} True if the player landed; false when no land is in reach.
 */
export function disembark(state) {
  const spot = landingSpot(state);
  if (!spot) return false;

  Object.assign(state.boat, { x: state.player.x, y: state.player.y, dir: state.player.direction });
  Object.assign(state.player, spot, {
    direction: facing(spot.x - state.boat.x, spot.y - state.boat.y),
  });
  state.aboard = false;
  return true;
}

/**
 * Says whether the boat is heading into deep sea, so the HUD can warn that it's too rough.
 *
 * @param {object} state - The game being played.
 * @param {number} dx - Left/right push from the keys: -1, 0 or 1.
 * @param {number} dy - Up/down push from the keys: -1, 0 or 1.
 * @returns {boolean} True when aboard and the water DEEP_LOOKOUT units ahead is deep.
 */
export function deepAhead(state, dx, dy) {
  if (!state.aboard || (!dx && !dy)) return false;
  const length = Math.hypot(dx, dy);
  return isDeep(
    state.player.x + (dx / length) * DEEP_LOOKOUT,
    state.player.y + (dy / length) * DEEP_LOOKOUT,
  );
}
```

- [ ] **Step 6: Leave the boat behind on signpost travel**

In `src/actions/travel.js`, add after `state.player.direction = 0; // face the camera on arrival`:

```js
  state.aboard = false; // travelling leaves the boat where it floats; the player arrives on foot
```

and add `\`aboard\` turns off.` to the end of the `@param {object} state` line.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/actions/`
Expected: PASS. If "by every old boat, the player can step ashore and get back in" fails for one boat, move that boat's `launch` 20 units closer to its wreck in `places.json` (keeping it at least 200 units away), rebuild the map and re-run Tasks 3 and 7's tests.

- [ ] **Step 8: Format, test everything, commit**

Run: `npm run format`, then `npm test`
Expected: PASS.

```bash
git add src/data/balance.js src/actions/move.js src/actions/boat.js src/actions/travel.js tests/actions
```

```bash
git commit -m "Board the boat, row the shallow sea and step ashore" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: One chooser for the E key

**Files:**
- Create: `src/actions/interact.js`
- Create: `tests/actions/interact.test.js`

**Interfaces:**
- Consumes: `nearbyNode`, `beginGather`, `finishGather` (gather.js); `nearbyWreck`, `beginRepair`, `finishRepair`, `canBoard`, `board`, `landingSpot`, `disembark` (boat.js).
- Produces:
  - `chooseInteraction(state): {kind: 'land'|'board'|'repair'|'gather', target: object} | null`
  - `beginInteraction(state, animator): {ok: boolean, kind?: string, reason?: 'busy'|'none'|'missing', missing?: object, node?: object, wreck?: object}`
  - `finishInteraction(state, target: string): {kind: 'repair', wreck} | {kind: 'gather', node} | null`

- [ ] **Step 1: Write the failing test `tests/actions/interact.test.js`**

```js
// Checks what the E key does. Several things share it (landing, boarding, repairing, gathering),
// so the order matters: the wrong pick could hammer a boat when the player wanted to land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WRECKS } from '../../src/data/places.js';
import { REPAIR_COST, REPAIR_SECONDS } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';
import {
  chooseInteraction,
  beginInteraction,
  finishInteraction,
} from '../../src/actions/interact.js';

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');

// Guards the order E tries things in: land when afloat, board beside the boat, repair beside an
// old boat, gather beside a supply, and nothing when nothing is in reach.
test('E picks landing, then boarding, then repairing, then gathering', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const gatherer = createGame('scout');
  Object.assign(gatherer.player, { x: pine.x - 60, y: pine.y });
  assert.deepEqual(chooseInteraction(gatherer), { kind: 'gather', target: pine });

  const repairer = createGame('survivor');
  Object.assign(repairer.player, { x: east.x, y: east.y + 30 });
  assert.deepEqual(chooseInteraction(repairer), { kind: 'repair', target: east });

  // Once the boat is mended the old boat can't be repaired again; next to the boat, E boards it.
  repairer.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  Object.assign(repairer.player, { x: east.launch.x - 120, y: east.launch.y });
  assert.equal(chooseInteraction(repairer).kind, 'board');

  Object.assign(repairer.player, { x: east.launch.x, y: east.launch.y });
  repairer.aboard = true;
  assert.equal(chooseInteraction(repairer).kind, 'land');

  assert.equal(chooseInteraction(createGame('scout')), null); // nothing within reach of the camp spawn
});

// Guards the whole boat flow through E: the repair is a timed action finished by the loop, while
// boarding and landing happen at once.
test('E repairs over time, then boards and lands at once', () => {
  const game = createGame('survivor'),
    animator = createAnimator();
  Object.assign(game.player, { x: east.x, y: east.y + 30 });
  Object.assign(game.resources, { wood: REPAIR_COST.wood, stone: REPAIR_COST.stone });

  assert.deepEqual(beginInteraction(game, animator), { ok: true, wreck: east, kind: 'repair' });
  assert.deepEqual(beginInteraction(game, animator), { ok: false, reason: 'busy' });
  const done = advanceAnimation(animator, REPAIR_SECONDS + 0.01, {});
  assert.deepEqual(finishInteraction(game, done.target), { kind: 'repair', wreck: east });

  Object.assign(game.player, { x: east.launch.x - 120, y: east.launch.y });
  assert.deepEqual(beginInteraction(game, animator), { ok: true, kind: 'board' });
  assert.equal(game.aboard, true);
  assert.deepEqual(beginInteraction(game, animator), { ok: true, kind: 'land' });
  assert.equal(game.aboard, false);
});

// Guards the messages E leads to: a short backpack says what is missing, and an empty spot says so.
test('E reports a short backpack and an empty spot', () => {
  const game = createGame('survivor');
  Object.assign(game.player, { x: east.x, y: east.y + 30 });
  game.resources.wood = 0;
  const result = beginInteraction(game, createAnimator());
  assert.equal(result.reason, 'missing');
  assert.equal(result.missing.wood, REPAIR_COST.wood);

  assert.deepEqual(beginInteraction(createGame('scout'), createAnimator()), {
    ok: false,
    reason: 'none',
  });
});

// Guards the loop's hand-out: an id is routed to the repair or the gather it belongs to, and an
// unknown id hands out nothing.
test('finishInteraction hands out a gathered supply, and nothing for an unknown id', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const game = createGame('scout');
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  assert.deepEqual(finishInteraction(game, 'pine-wood'), { kind: 'gather', node: pine });
  assert.equal(finishInteraction(game, 'nowhere'), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/actions/interact.test.js`
Expected: FAIL: `src/actions/interact.js` doesn't exist.

- [ ] **Step 3: Create `src/actions/interact.js`**

```js
// What the E key (and the on-screen interact button) does right now. Several things share the
// key, so this file picks one in a fixed order and does it: step ashore, board the boat, repair
// an old boat, or gather a supply.

import { WRECKS } from '../data/places.js';
import { nearbyNode, beginGather, finishGather } from './gather.js';
import {
  nearbyWreck,
  beginRepair,
  finishRepair,
  canBoard,
  board,
  landingSpot,
  disembark,
} from './boat.js';

/**
 * Picks what pressing E would do right now, without doing it.
 *
 * Only one thing happens per press, so the choices are tried in order, like a queue at a counter:
 * step ashore when in the boat, get in when next to it, repair an old boat, then gather. The HUD
 * uses the answer for the button's words and the renderer for its highlight.
 *
 * @param {object} state - The game being played.
 * @returns {{kind: string, target: object}|null} `kind` is 'land', 'board', 'repair' or 'gather';
 *   `target` is the landing spot, the boat, the old boat or the node. Null when nothing is in reach.
 */
export function chooseInteraction(state) {
  if (state.aboard) {
    const spot = landingSpot(state);
    return spot ? { kind: 'land', target: spot } : null;
  }
  if (canBoard(state)) return { kind: 'board', target: state.boat };
  const wreck = nearbyWreck(state);
  if (wreck) return { kind: 'repair', target: wreck };
  const node = nearbyNode(state);
  return node ? { kind: 'gather', target: node } : null;
}

/**
 * Does what pressing E means right now.
 *
 * Landing and boarding happen at once. Repairing and gathering only start a timed action, which
 * the game loop finishes later through finishInteraction, so their rewards arrive exactly once.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state.
 * @returns {{ok: boolean, kind?: string, reason?: string, missing?: object, node?: object, wreck?: object}}
 *   `ok` with the `kind` done or started; otherwise `reason` is 'busy', 'none' or 'missing'.
 */
export function beginInteraction(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const choice = chooseInteraction(state);
  if (!choice) return { ok: false, reason: 'none' };

  if (choice.kind === 'land') return { ok: disembark(state), kind: 'land' };
  if (choice.kind === 'board') return { ok: board(state), kind: 'board' };
  if (choice.kind === 'repair') return { ...beginRepair(state, animator), kind: 'repair' };
  return { ...beginGather(state, animator), kind: 'gather' };
}

/**
 * Hands out the result of a timed action when it finishes: a mended boat or gathered supplies.
 *
 * @param {object} state - The game being played.
 * @param {string} target - The id the action was aimed at: an old boat's or a node's.
 * @returns {{kind: string, wreck?: object, node?: object}|null} What was finished, or null if
 *   nothing was awarded.
 */
export function finishInteraction(state, target) {
  if (WRECKS.some((w) => w.id === target)) {
    const wreck = finishRepair(state, target);
    return wreck ? { kind: 'repair', wreck } : null;
  }
  const node = finishGather(state, target);
  return node ? { kind: 'gather', node } : null;
}
```

Note: when `beginRepair` refuses for lack of resources, the spread gives `{ok: false, reason: 'missing', wreck, missing, kind: 'repair'}`, which the third test reads.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/actions/interact.test.js`
Expected: PASS.

- [ ] **Step 5: Format, test everything, commit**

Run: `npm run format`, then `npm test`
Expected: PASS (including `tests/boundaries.test.js` and `tests/comments.test.js`).

```bash
git add src/actions/interact.js tests/actions/interact.test.js
```

```bash
git commit -m "Choose what E does: land, board, repair or gather" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Wire E, the loop and the HUD

No unit tests cover the browser layer; this task ends with a browser check.

**Files:**
- Modify: `src/core/input.js:5,30-45,80-83`
- Modify: `src/core/loop.js`
- Modify: `src/ui/hud.js`
- Modify: `src/ui/layout.js:205` (key strip)

**Interfaces:**
- Consumes: `beginInteraction`, `finishInteraction`, `chooseInteraction` (Task 8); `deepAhead`, `missingForRepair`, `listMissing` (boat.js); `REPAIR_COST`; `WRECKS`.

- [ ] **Step 1: E runs the interaction in `src/core/input.js`**

Replace `import { beginGather } from '../actions/gather.js';` with:

```js
import { beginInteraction } from '../actions/interact.js';
import { listMissing } from '../actions/boat.js';
```

Replace the `gather()` function (comment and body) and the click hookup with:

```js
  /**
   * Does what E means right now (step ashore, board, repair or gather), or says why nothing happened.
   *
   * Landing and boarding happen at once and save straight away. Repairing and gathering start a
   * timed action that core/loop.js finishes. Held movement keys are forgotten so the player
   * doesn't walk off and cancel straight away.
   */
  function interact() {
    if (session.screen !== 'game' || ui.dialogs.isPaused()) return;
    const result = beginInteraction(session.state, session.animator);
    if (result.ok) {
      keys.clear();
      if (result.kind === 'board')
        ui.hud.notify('In the boat · Row with WASD, and press E by the shore to step ashore');
      if (result.kind === 'board' || result.kind === 'land') save(session, ui, true);
      ui.hud.update();
    } else if (result.reason === 'missing')
      ui.hud.notify(`The old boat needs ${listMissing(result.missing)} more.`);
    else if (result.reason === 'none') ui.hud.notify('Move closer to something you can use.');
  }

  $('interact').addEventListener('click', interact);
```

In the keydown handler, change `gather();` to `interact();`, and in the comments change "E gathers" / "E to gather" to "E interacts" / "E to gather, repair or board".

- [ ] **Step 2: Finish repairs and warn at deep water in `src/core/loop.js`**

Change the imports: replace `import { finishGather } from '../actions/gather.js';` with:

```js
import { finishInteraction } from '../actions/interact.js';
import { deepAhead } from '../actions/boat.js';
```

Add to the engine timings (and its comment):

```js
// DEEP_WARN_MS: real milliseconds between two "too rough" warnings while the boat pushes at deep water.
const MAX_FRAME_DT = 0.05,
  AUTOSAVE_EVERY = 10,
  HUD_EVERY = 0.12,
  DEEP_WARN_MS = 4000;
```

At the top of `startLoop`, after `const { clock } = session;`, add:

```js
  // When the last "too rough" warning was shown, so it isn't repeated every frame.
  let warnedDeepAt = -Infinity;
```

Replace

```js
        // When a timed action finishes, award the supply it was aimed at (exactly once).
        const done = advanceAnimation(animator, dt, { moving, running });
        if (done?.target) {
          const node = finishGather(state, done.target);
          if (node) {
            ui.hud.notify(`+${node.amount} ${node.type} · ${node.label}`);
            ui.hud.update();
            save(session, ui, true);
          }
        }
```

with

```js
        // Rowing into deep water: say why the boat won't go on, but not every frame.
        if (deepAhead(state, dx, dy) && now - warnedDeepAt > DEEP_WARN_MS) {
          ui.hud.notify('Too rough for a small boat.');
          warnedDeepAt = now;
        }

        // When a timed action finishes, hand out what it was aimed at (exactly once): supplies or a mended boat.
        const done = advanceAnimation(animator, dt, { moving, running });
        const finished = done?.target ? finishInteraction(state, done.target) : null;
        if (finished) {
          ui.hud.notify(
            finished.kind === 'repair'
              ? 'Boat repaired · Walk to the water’s edge and press E to board'
              : `+${finished.node.amount} ${finished.node.type} · ${finished.node.label}`,
          );
          ui.hud.update();
          save(session, ui, true);
        }
```

Update the header's second line to `// About 60 times a second it moves the player (or their boat), runs the current animation, hands out`.

- [ ] **Step 3: Button words and the boat goal in `src/ui/hud.js`**

Change the imports to:

```js
import { RESOURCES } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import { REPAIR_COST } from '../data/balance.js';
import { NODES } from '../world/nodes.js';
import { regionAt, regionOf } from '../world/regions.js';
import { regionProgress } from '../world/progress.js';
import { hasGathered } from '../actions/gather.js';
import { missingForRepair, listMissing } from '../actions/boat.js';
import { chooseInteraction } from '../actions/interact.js';
import { $ } from './layout.js';
```

Add these two helpers above `createHud`:

```js
/**
 * Words for the interact button when E would do `choice`, e.g. "Board the boat" or "Chop pine tree".
 *
 * @param {object} state - The game being played.
 * @param {{kind: string, target: object}} choice - What chooseInteraction picked.
 * @returns {string} The button's words.
 */
function actionLabel(state, choice) {
  if (choice.kind === 'land') return 'Step ashore';
  if (choice.kind === 'board') return 'Board the boat';
  if (choice.kind === 'repair') {
    const missing = missingForRepair(state);
    return Object.keys(missing).length
      ? `Repair the old boat · need ${listMissing(missing)}`
      : 'Repair the old boat';
  }
  return `${choice.target.verb} ${choice.target.label.toLowerCase()}`;
}

/**
 * Words for the interact button while a timed action runs, or null when none is running.
 *
 * @param {object} animator - The player's animation state.
 * @returns {string|null} E.g. "Repairing the old boat… move to stop".
 */
function busyLabel(animator) {
  const target = animator.pending?.target;
  if (!target) return null;
  if (WRECKS.some((w) => w.id === target)) return 'Repairing the old boat… move to stop';
  const node = NODES.find((n) => n.id === target);
  return node ? `${DOING[node.verb]} ${node.label.toLowerCase()}… move to stop` : null;
}
```

In `update()`, replace the `} else {` branch start of the goals card (the line before `const region = regionOf(...)`) with:

```js
    } else if (state.wrecks.length && !state.boat) {
      // An old boat has been found but not mended: the card becomes the shopping list for the repair.
      $('quest-label').textContent = 'AN OLD BOAT';
      $('quest-title').textContent = 'Mend a boat';
      $('quest-text').textContent =
        'Repair an old boat to sail the coast. Driftwood washes up on the beaches.';
      line('quest-first', 'Wood', Math.min(state.resources.wood, REPAIR_COST.wood), REPAIR_COST.wood);
      line(
        'quest-second',
        'Stone',
        Math.min(state.resources.stone, REPAIR_COST.stone),
        REPAIR_COST.stone,
      );
    } else {
```

and replace the interact button block with:

```js
    // The interact button: what E would do now, or "busy" while a timed action runs.
    const choice = chooseInteraction(state),
      busy = busyLabel(animator),
      button = $('interact');
    button.hidden = !choice && !busy;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    button.querySelector('span').textContent = busy ?? (choice ? actionLabel(state, choice) : '');
```

Update `update()`'s JSDoc: "...(the starting goals, a found old boat's repair list, then the current region's progress) onto the screen, and shows the interact button when E would do something."

- [ ] **Step 4: Key strip words in `src/ui/layout.js`**

Change `><span><kbd>E</kbd> Gather</span><span><kbd>M</kbd> Map</span` to `><span><kbd>E</kbd> Gather · Boat</span><span><kbd>M</kbd> Map</span`.

- [ ] **Step 5: Format and test**

Run: `npm run format`, then `npm test`, then `npm run build`
Expected: all PASS.

- [ ] **Step 6: Browser check (the boat is not drawn yet; the HUD and toasts are)**

Start the `wildhaven` launch config (preview_start `{name: "wildhaven"}`) and open `http://127.0.0.1:5173`. Pick the Shipwreck Survivor, start fresh if asked. Then:
1. Gather the beach stones and driftwood log by the ship (6 s each). The backpack shows 6 wood, 2 stone.
2. Walk north-east along the beach to the Lagoon Rowboat (about 1,500 units from the start). The toast says "Found Lagoon Rowboat · Repair it with 6 wood and 2 stone"; the goals card shows "AN OLD BOAT" with Wood 6 / 6 and Stone 2 / 2 (only once the starting goals are done).
3. Next to it the button reads "Repair the old boat"; press E. "Repairing the old boat… move to stop" for 8 s, then "Boat repaired". Wood and stone drop to 0.
4. Walk toward the water: the button reads "Board the boat"; press E, then row with WASD (an invisible boat for now) and press E by the shore ("Step ashore").
5. Check the console: no errors.

Note anything wrong before Task 10 and fix it here.

- [ ] **Step 7: Commit**

```bash
git add src/core/input.js src/core/loop.js src/ui/hud.js src/ui/layout.js
```

```bash
git commit -m "Wire E to repair, board and land, with HUD words and a boat goal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Draw the sea, the old boats and the boat

No unit tests cover rendering; this task ends with a browser check.

**Files:**
- Modify: `src/render/renderer.js`

**Interfaces:**
- Consumes: `WRECKS`, `chooseInteraction`, `isAvailable`, sprites `old-boat` and `rowboat`, tile layer `deep`.

- [ ] **Step 1: Imports and constants**

Change the imports:

```js
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';
import { WILD } from '../data/supplies.js';
import { isAvailable } from '../actions/gather.js';
import { chooseInteraction } from '../actions/interact.js';
```

(`nearbyNode` is no longer imported.) Change `TERRAIN_LAYERS` to:

```js
// The map's ground layers, bottom to top: each one is painted over the one before.
const TERRAIN_LAYERS = ['ground', 'dirt', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep'];
```

Add after `PLAYER_HEIGHT`:

```js
// How much of the character shows above the hull while sitting in the boat, from the top down.
const SEATED = 0.6;
```

Add `boat,` to the `let player, shadow, supplies, cue, bar, ...` list.

- [ ] **Step 2: Old boats join the supplies, and the boat sprite is made**

In `create()`, replace the `supplies = NODES.map((node) => { ... });` block (keep the comment above it, adding one line: `// Old boats on the beach are drawn the same way; the one the player repaired fades out.`) with:

```js
        supplies = [
          ...NODES.map((node) => ({
            node,
            /** True while the supply or patch has nothing to give. */
            gone: (state) => !isAvailable(state, node),
          })),
          ...WRECKS.map((w) => ({
            node: { ...w, sprite: 'old-boat', scale: 1 },
            /** True once this old boat has been repaired and is at sea. */
            gone: (state) => state.boat?.from === w.id,
          })),
        ].map(({ node, gone }) => {
          const spec = objectSpecs[node.sprite];
          const sprite = this.add
            .image(node.x, node.y, `object-${node.sprite}`)
            .setOrigin(...spec.origin)
            .setScale(node.scale)
            .setDepth(spec.flat ? -1 : node.y);
          // Cue height: the sprite's top, but on a tall tree's canopy rather than its tip, where it would crowd the HUD.
          return {
            node,
            gone,
            sprite,
            glow: null,
            top: Math.max(node.y - sprite.displayHeight * sprite.originY, node.y - 150),
          };
        });

        // The player's own boat, hidden until they have one.
        boat = this.add
          .image(0, 0, 'object-rowboat')
          .setOrigin(...objectSpecs.rowboat.origin)
          .setVisible(false);
```

- [ ] **Step 3: Highlight what E would do, and draw the boat**

In `draw()`, replace

```js
    const nearest = nearbyNode(state),
      busy = animator.pending?.target,
```

with

```js
    // What E would do now: a supply or old boat it targets glows with an E cap over it.
    const choice = chooseInteraction(state),
      aimed = choice?.kind === 'gather' || choice?.kind === 'repair' ? choice.target.id : null,
      busy = animator.pending?.target,
```

In the loop over `supplies`, replace `const gone = !isAvailable(state, s.node);` with `const gone = s.gone(state);` and replace `s.node.id === nearest?.id` with `s.node.id === aimed`.

Directly after that loop (before `// The E key cap bobs gently...`), add:

```js
    // The player's boat, pointing the way it last went and rocking gently on the water.
    // The art's bow points east: it is mirrored for west and turned a quarter for north and south.
    const bob = reducedMotion ? 0 : Math.sin(performance.now() / 500) * 2;
    boat.setVisible(!!state.boat);
    if (state.boat) {
      const { x, y, dir } = state.boat;
      boat
        .setPosition(x, y + bob)
        .setFlipX(dir === 1)
        .setAngle(dir === 0 ? 90 : dir === 3 ? -90 : 0)
        .setDepth(y - 1);
      if (choice?.kind === 'board') capped = { node: { x, y }, top: y - 40 };
    }
```

- [ ] **Step 4: Seat the player in the boat**

Replace the pose and player block (from `// A timed action is longer than one pass...` to `shadow.setPosition(...)...;`) with:

```js
    // A timed action is longer than one pass of its clip, so it loops until the action ends.
    // In the boat the player sits still, so the idle pose is used.
    const pose = resolvePose(
      sheets,
      state.character,
      state.aboard ? 'idle' : animator.clip,
      state.aboard ? 0 : animator.time,
      state.player.direction,
      animator.pending ? true : undefined,
    );
    // Pin the sprite at its anchor (mirrored when the pose is flipped), with feet on the ground.
    const pivot = (pose.frame.anchorX - pose.frame.x) / pose.frame.width;
    player
      .setTexture(pose.key, pose.name)
      .setOrigin(pose.flip ? 1 - pivot : pivot, 1)
      .setFlipX(pose.flip)
      .setScale(PLAYER_HEIGHT / pose.sheet.referenceHeight)
      .setDepth(state.player.y);
    if (state.aboard) {
      // Show only the top of the character and sink the cut line into the hull, so they sit in the boat.
      player
        .setCrop(0, 0, pose.frame.width, pose.frame.height * SEATED)
        .setPosition(
          state.player.x,
          state.player.y + bob + 10 + player.displayHeight * (1 - SEATED),
        );
    } else
      player
        .setCrop()
        .setPosition(state.player.x, state.player.y + 4 - PLAYER_HEIGHT * pose.lift);
    shadow
      .setVisible(!state.aboard)
      .setPosition(state.player.x, state.player.y - 1)
      .setDepth(state.player.y - 0.5);
```

- [ ] **Step 5: Mark old boats and the boat on the maps**

In `drawMap`, after the signposts block and before `// The player.`, add:

```js
    // Old boats found on the beach (not the one already mended): small brown squares.
    ctx.fillStyle = '#9a6b3f';
    for (const w of WRECKS) {
      if (!state.wrecks.includes(w.id) || state.boat?.from === w.id) continue;
      ctx.fillRect(px(w.x) - 3.5, py(w.y) - 3.5, 7, 7);
      ctx.strokeRect(px(w.x) - 3.5, py(w.y) - 3.5, 7, 7);
    }

    // The player's boat while they are ashore: a brown oval where it is moored.
    if (state.boat && !state.aboard) {
      ctx.beginPath();
      ctx.ellipse(px(state.boat.x), py(state.boat.y), 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
```

Update `drawMap`'s JSDoc sentence to: "Found places are cream dots, found signposts are gold diamonds, found old boats are brown squares, a moored boat is a brown oval, and the player is the white dot."

- [ ] **Step 6: Format and test**

Run: `npm run format`, then `npm test`, then `npm run build`
Expected: all PASS.

- [ ] **Step 7: Browser check**

From the `wildhaven` launch config at `http://127.0.0.1:5173`:
1. **Survivor:** repeat Task 9's flow. Check: the old boat glows with an E cap; during the repair a progress bar fills; it fades out and the brown rowboat appears in the water, pointing east. Board: the character shows from the waist up inside the boat, which rocks gently. Row east to Gull Isle (north-east) and find its landmark ("Found Gull Isle"). Keep rowing east until the water darkens: "Too rough for a small boat." appears and the boat stops. Row back, step ashore on the islet and on the mainland. Turn the boat north and south: it rotates.
2. **Reload** while aboard and while ashore: the boat and player come back where they were.
3. **Maps:** the minimap and world map show the sea ring, the darker deep water, a brown square for each found old boat and a brown oval for the moored boat. Region labels sit on land (if one sits in the sea, note it in `docs/verification.md` as a known issue).
4. **Scout:** walk north from the camp to the Pinefall Shore Rowboat; collect driftwood on the beach (the button reads "Pick up driftwood") until the goal card shows 6 / 6 wood.
5. **Version 3 save:** in the browser console at `127.0.0.1`, write an old-shape save for the Builder and reload, then pick the Builder:

```js
localStorage.setItem('wildhaven.adventure.v1.builder', JSON.stringify({ version: 3, character: 'builder', player: { x: 12288, y: 7300, direction: 0 }, resources: { wood: 5, stone: 2, food: 2, herbs: 0 }, collected: [], regrowAt: {}, discovered: ['meadows'], landmarks: [], waypoints: [], elapsed: 5, distance: 0 }));
```

   Expected: "Welcome back.", the Builder stands just south of the village (now at 14336, 9348), Hollowstead Meadows is discovered.
6. **Narrow screen:** resize to about 390 px wide; the interact button reads "Board the boat" next to the boat and works by tap.
7. **Console:** no errors. Note the frame rate while rowing along the coast.

Fix what is wrong, re-run `npm test`, then commit.

- [ ] **Step 8: Commit**

```bash
git add src/render/renderer.js
```

```bash
git commit -m "Draw the deep sea, old boats, the player's boat and map markers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Docs

**Files:**
- Modify: `CLAUDE.md`, `docs/gdd.md`, `docs/art-direction.md`, `docs/verification.md`, `docs/superpowers/specs/2026-11-19-archipelago-design.md`

- [ ] **Step 1: `CLAUDE.md`**

Update these places (keep the file's tone and length):
- **Project Overview:** the current milestone adds "an island home with a sea border, driftwood, four old boats to repair, coastal sailing, and three lagoon islets (archipelago slice A1)". Mention the archipelago spec `docs/superpowers/specs/2026-11-19-archipelago-design.md` and that slices A2–A4 (ship, second continent, archipelago map) are not built.
- **Architecture table:** `src/actions/` adds `boat.js` (repair, board, land, deep lookout) and `interact.js` (what E does: land → board → repair → gather); `src/world/map.js` adds `isSailable`, `isDeep`, `SEA_BORDER`; `src/world/nodes.js` adds `wreckBases`, `solidBases`; `src/data/places.js` adds `WRECKS`.
- **Frame loop:** step 4 now calls `finishInteraction(state, target)` (a repair or a gather); E calls `beginInteraction`. The loop also warns "Too rough for a small boat" at most every 4 s.
- **Save model:** version 4 adds `wrecks`, `boat` (`{from, x, y, dir}` or null) and `aboard`. Version 3 saves are migrated, not reset: positions and wild-patch ids shift by `SEA_BORDER` (2048), a player now at sea goes to their spawn. A boat no longer on sea returns to its wreck's `launch`. Saves also happen on boarding and landing.
- **World / Map Pipeline:** the map is 448×320 tiles (28,672×20,480 units): the old 384×256 land plus a 32-tile sea border (`PAD` in `build-map.py`, map property `seaBorder`). Hand-written positions in `build-map.py` are in land units; `places.json` is in world units. Layers are `ground`…`water`, `deep` (water more than 1,200 units from land). `inland()` draws the wobbly coast with a 220-unit beach. `places.json` has a `wrecks` list (beach point + `launch` water point, launch outside the 130-unit dry circle). The overview is 1568×1120.
- **Collision:** `isSailable` = water ≥ 0.5, not deep, inside the margin, not in an object. Old boats have solid bases except the one repaired.
- **Wild scenery:** `WILD` now also holds `driftwood` (1 wood, regrows in 180 s), scattered on sea beaches.
- **Game Rules:** boat rules: repair 6 wood + 2 stone over 8 s (`REPAIR_SECONDS`), one boat per character, board within 160, land within 160, boat 210 units/s (300 with Shift), deep water blocks the small boat, signpost travel leaves the boat.
- `tests/world/flood.js` is a shared test helper (not a test file) that `places.test.js` and `sea.test.js` use to flood-fill what can be reached on foot or by boat.

- [ ] **Step 2: `docs/gdd.md`**

In "Archipelago Direction", change slice A1's tag from **[Planned]** to **[Built]** and note the date. In section 6.13 change the archipelago bullet to say the home continent is now an island and slice A1 is built. In section 8 change the A1–A4 row's status to "A1 built; A2–A4 planned". Change "a lagoon with three unreachable islands" in sections 6.13 and the Big World Update to "three lagoon islets, reachable by boat since slice A1".

- [ ] **Step 3: `docs/art-direction.md`**

Add the four stand-ins to the asset inventory: `ground/deep.png`, `objects/props/driftwood.png`, `objects/props/old-boat.png`, `objects/props/rowboat.png`, each "stand-in from `tools/make-biome-standins.py`; real prompt in its `.prompt.txt`".

- [ ] **Step 4: `docs/verification.md`**

Add a dated section "Archipelago A1 (2026-11-19)" listing what Task 10's browser check covered, the frame rate seen while rowing, and any known issue found (for example a region label sitting in the sea).

- [ ] **Step 5: Spec status**

In the spec's header, change the status to `**Status:** slice A1 built on branch archipelago-a1`.

- [ ] **Step 6: Final checks and commit**

Run: `npm test`, `npm run build`, `npm run format:check`
Expected: all PASS.

```bash
git add CLAUDE.md docs/gdd.md docs/art-direction.md docs/verification.md docs/superpowers/specs/2026-11-19-archipelago-design.md
```

```bash
git commit -m "Document the island home, old boats and coastal sailing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** sea border and coast (Task 2), deep water and its toast (Tasks 2, 3, 7, 9), rivers sailable to the first ford (falls out of `isSailable`; fords are dry), driftwood (Task 4), four old boats found within 200 and marked on maps (Tasks 2, 6, 10), repair cost and timing (Task 6), one boat per character (Task 6: `nearbyWreck` needs `!state.boat`), board/steer/land (Task 7), discovery while sailing (unchanged `discover` reads the player's position), signpost travel leaves the boat (Task 7), islets with landmarks (Tasks 2, 3), save v4 with v3 migration and boat safety (Task 5), HUD words, goal card and toasts (Task 9), rendering and seated player (Task 10), docs (Task 11).
- **Known risk:** the wreck and launch coordinates come from the coastline formula, not from a built map. Tasks 2, 3 and 7 say exactly how to nudge them if a reach test fails.
- **Type consistency checked:** `facing`, `solidBases`, `wreckBases`, `nearbyWreck`, `missingForRepair`, `listMissing`, `beginRepair`/`finishRepair`, `canBoard`/`board`/`landingSpot`/`disembark`/`deepAhead`, `chooseInteraction`/`beginInteraction`/`finishInteraction`, and the state fields `wrecks`/`boat {from, x, y, dir}`/`aboard` are spelled the same in every task that uses them.
- **Known risk:** `setCrop()` with no arguments must reset the crop in Phaser 4 as it does in Phaser 3. Task 10's browser check catches it (the character would stay cut off after landing); if so, call `player.isCropped = false` instead.
