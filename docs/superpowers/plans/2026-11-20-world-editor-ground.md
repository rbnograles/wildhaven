# World Editor (Ground) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Terrain mode in the world editor that paints ground (grass, dirt, soil, jungle, rock, snow, sand) into the map's boxes or erases them to sea, saved in `assets/world/source/terrain.json` and applied by `tools/build-map.py`.

**Architecture:** Stage 1 of three in `docs/superpowers/specs/2026-11-20-world-editor-terrain-design.md` (stage 2, hills and stairs, and stage 3, footpaths, get their own plans after this one lands, because they build on the files made here). The script decides ground at tile corners; a painted box overrides its four corners, and `terrain(x, y)` asks the overrides first, so banks, deep sea, collision, scatter and hills all follow. The editor keeps the overrides in a pure module (`src/editor/terrain.js`), shows them at once as coloured squares, and the real tiles appear after a rebuild.

**Tech Stack:** Vanilla JS ES modules, Vite 7, Canvas 2D, `node:test`, Python 3 (numpy, Pillow). No new dependencies.

## Global Constraints

- `CLAUDE.md` "Code Style": Prettier, a comment directly above every named function in `src/` and `tests/`, file headers, a `//` line above every `test(...)`, a `#` comment above every Python `def`.
- `src/editor/terrain.js` is pure: no DOM, and the words `document`, `window` and `import.meta` must not appear in it.
- No game code changes. No new npm packages.
- Ground kinds, in the script's rank order: `grass`, `dirt`, `soil`, `jungle`, `rock`, `snow`, `sand`, `water` (0 to 7). The order is written once in JS (`KINDS`) and once in Python (`TERRAIN_KINDS`).
- Corners are numbered in map corner rows 0 to 320 and columns 0 to 448. A box is one 64-unit tile; box `(col, row)` has corners `(row, col)`, `(row, col + 1)`, `(row + 1, col)`, `(row + 1, col + 1)`.
- Work continues in the worktree `.claude/worktrees/world-editor-objects` on branch `world-editor-objects`. `git add` only the files a task names.
- After every task: `npm test` and `npm run format:check` pass.

## File Structure

| File | Responsibility |
| --- | --- |
| `assets/world/source/terrain.json` (create) | The ground overrides. Starts empty. |
| `src/editor/terrain.js` (create) | Pure: the overrides, painting, run encoding, the file writer. |
| `src/editor/model.js` (modify) | The undo history also holds the terrain. |
| `tests/editor/terrain.test.js` (create) | Tests for `terrain.js`. |
| `tools/build-map.py` (modify) | Reads the overrides; `terrain()` asks them first; two new map properties; a clean message where it used to crash. |
| `tests/world/terrain.test.js` (create) | The map was built from the current `terrain.json`. |
| `src/editor/lookups.js` (modify) | `groundLookups()`: the generated ground at each corner. |
| `tools/editor-server.js`, `src/editor/main.js`, `view.js`, `panel.js`, `editor.html`, `editor.css` (modify) | The third file and the Terrain mode. |
| `CLAUDE.md`, `docs/verification.md` (modify) | Docs. |

---

### Task 1: The terrain module

**Files:**
- Create: `assets/world/source/terrain.json`, `src/editor/terrain.js`, `tests/editor/terrain.test.js`
- Modify: `src/editor/model.js` (`createEditor`, `remember`, `undo`, `redo`), `tests/boundaries.test.js`

**Interfaces:**
- Produces, from `src/editor/terrain.js`:
  - `KINDS: string[]`, `BOX = 64`, `ERASER = 'water'`
  - `emptyTerrain() -> { ground: {} }` (in memory, `ground` maps `'row,col'` to a kind)
  - `loadTerrain(editor, file)`, `isTerrainDirty(editor)`, `markTerrainSaved(editor)`
  - `paintBoxes(editor, col, row, size, kind, base, record = true)` where `base = { rows, cols, kindAt(row, col) }`
  - `groundAt(terrain, base, row, col) -> string`
  - `encodeRuns(ground) -> [row, firstCol, lastCol, kind][]`, `decodeRuns(runs) -> object`
  - `shapeErrors(file, grid = { rows: 320, cols: 448 }) -> string[]`
  - `writeTerrain(terrain) -> string`
- `editor` gains `terrain` and `savedTerrain`; history entries become `{ places, edits, terrain }`.

- [ ] **Step 1: Create the empty file**

`assets/world/source/terrain.json`, exactly:

```json
{
  "ground": []
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/editor/terrain.test.js`:

```js
// Checks the world editor's ground painting: which corners a brush touches, how an override that
// only repeats the generated ground is dropped, how overrides are packed into runs for the file,
// and the writer of terrain.json. The map build replays this file, so a wrong run moves a coast.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, undo } from '../../src/editor/model.js';
import {
  KINDS,
  emptyTerrain,
  loadTerrain,
  isTerrainDirty,
  markTerrainSaved,
  paintBoxes,
  groundAt,
  encodeRuns,
  decodeRuns,
  shapeErrors,
  writeTerrain,
} from '../../src/editor/terrain.js';

/** A tiny places file; the editor needs one to start. */
const places = () => ({
  regions: [],
  spawns: {},
  supplies: {},
  landmarks: [],
  waypoints: [],
  wrecks: [],
});

/** A pretend generated world of 10 by 10 boxes: grass on the left, water from column 6 on. */
const base = {
  rows: 10,
  cols: 10,
  // Grass up to corner column 5, water beyond.
  kindAt: (row, col) => (col <= 5 ? 'grass' : 'water'),
};

/** Starts an editor with an empty terrain loaded. */
const session = () => {
  const editor = createEditor(places());
  loadTerrain(editor, { ground: [] });
  return editor;
};

// Guards the order the map build relies on: a kind's place in this list is its rank there.
test('the ground kinds are in the map build order', () => {
  assert.deepEqual(KINDS, ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water']);
});

// Guards the brush: one box is its four corners, and a bigger brush is centred on the box.
test('painting one box sets its four corners, and a 3-box brush sets sixteen', () => {
  const one = session();
  paintBoxes(one, 2, 3, 1, 'sand', base);
  assert.deepEqual(Object.keys(one.terrain.ground).sort(), ['3,2', '3,3', '4,2', '4,3']);
  assert.equal(groundAt(one.terrain, base, 3, 2), 'sand');
  assert.equal(groundAt(one.terrain, base, 0, 0), 'grass');

  const three = session();
  paintBoxes(three, 2, 3, 3, 'sand', base);
  assert.equal(Object.keys(three.terrain.ground).length, 16);
  assert.ok('2,1' in three.terrain.ground && '5,4' in three.terrain.ground);
});

// Guards the edge of the world: a brush hanging off the map paints only the corners that exist.
test('a brush at the edge of the map stays inside the corner grid', () => {
  const editor = session();
  paintBoxes(editor, 0, 0, 3, 'sand', base);
  assert.deepEqual(Object.keys(editor.terrain.ground).sort(), ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2']);

  paintBoxes(editor, 9, 9, 3, 'rock', base);
  assert.ok('10,10' in editor.terrain.ground);
  assert.equal('11,11' in editor.terrain.ground, false);
});

// Guards the file against noise: painting the ground that is already there is not an override,
// and painting it back over an override removes the override.
test('painting the generated ground back removes the override', () => {
  const editor = session();
  paintBoxes(editor, 1, 1, 1, 'grass', base);
  assert.deepEqual(editor.terrain.ground, {});

  paintBoxes(editor, 1, 1, 1, 'water', base);
  assert.equal(Object.keys(editor.terrain.ground).length, 4);
  paintBoxes(editor, 1, 1, 1, 'grass', base);
  assert.deepEqual(editor.terrain.ground, {});

  // Erasing where the sea already is changes nothing either.
  paintBoxes(editor, 8, 8, 1, 'water', base);
  assert.deepEqual(editor.terrain.ground, {});
});

// Guards undo: a stroke is one step, and place edits come back with it.
test('a paint stroke is one undo step', () => {
  const editor = session();
  paintBoxes(editor, 1, 1, 1, 'sand', base, true);
  paintBoxes(editor, 2, 1, 1, 'sand', base, false);
  assert.equal(editor.past.length, 1);

  assert.equal(undo(editor), true);
  assert.deepEqual(editor.terrain, emptyTerrain());
});

// Guards the Save button.
test('the terrain is dirty only while it differs from what was last saved', () => {
  const editor = session();
  assert.equal(isTerrainDirty(editor), false);
  paintBoxes(editor, 1, 1, 1, 'sand', base);
  assert.equal(isTerrainDirty(editor), true);
  markTerrainSaved(editor);
  assert.equal(isTerrainDirty(editor), false);
});

// Guards the file's size and its git diff: neighbours of one kind in a row become one run, and
// the runs unpack to exactly the overrides they came from.
test('overrides pack into runs by row and unpack to the same overrides', () => {
  const ground = { '3,2': 'sand', '3,3': 'sand', '3,4': 'rock', '3,6': 'rock', '2,9': 'water' };
  const runs = encodeRuns(ground);

  assert.deepEqual(runs, [
    [2, 9, 9, 'water'],
    [3, 2, 3, 'sand'],
    [3, 4, 4, 'rock'],
    [3, 6, 6, 'rock'],
  ]);
  assert.deepEqual(decodeRuns(runs), ground);
});

// Guards the server's last check before writing the file.
test('shapeErrors accepts runs inside the grid and rejects anything else', () => {
  const grid = { rows: 10, cols: 10 };
  assert.deepEqual(shapeErrors({ ground: [] }, grid), []);
  assert.deepEqual(shapeErrors({ ground: [[3, 2, 4, 'sand']] }, grid), []);
  assert.notDeepEqual(shapeErrors(null, grid), []);
  assert.notDeepEqual(shapeErrors({}, grid), []);
  assert.notDeepEqual(shapeErrors({ ground: [[3, 2, 4, 'lava']] }, grid), []);
  assert.notDeepEqual(shapeErrors({ ground: [[3, 4, 2, 'sand']] }, grid), []);
  assert.notDeepEqual(shapeErrors({ ground: [[11, 0, 0, 'sand']] }, grid), []);
  assert.notDeepEqual(shapeErrors({ ground: [[3, 2, 4.5, 'sand']] }, grid), []);
});

// Guards the layout of terrain.json: one run per line, and text that parses back.
test('writeTerrain writes one run per line and parses back', () => {
  const text = writeTerrain({ ground: { '3,2': 'sand', '3,3': 'sand', '2,9': 'water' } });
  assert.equal(
    text,
    ['{', '  "ground": [', '    [2, 9, 9, "water"],', '    [3, 2, 3, "sand"]', '  ]', '}', ''].join('\n'),
  );
  assert.deepEqual(decodeRuns(JSON.parse(text).ground), { '3,2': 'sand', '3,3': 'sand', '2,9': 'water' });
  assert.equal(writeTerrain(emptyTerrain()), '{\n  "ground": []\n}\n');
});
```

- [ ] **Step 3: Run and see them fail**

Run: `node --test tests/editor/terrain.test.js`
Expected: FAIL, cannot find `src/editor/terrain.js`.

- [ ] **Step 4: Add the terrain to the history in `src/editor/model.js`**

In `createEditor`, add two fields to the returned object: `terrain: { ground: {} },` after `edits`, and `savedTerrain: '',` after `savedEdits`. In `remember`, `undo` and `redo`, add `terrain` wherever `places` and `edits` are named:

```js
export function remember(editor) {
  editor.past.push(copy({ places: editor.places, edits: editor.edits, terrain: editor.terrain }));
  if (editor.past.length > HISTORY) editor.past.shift();
  editor.future = [];
}
```

```js
export function undo(editor) {
  if (!editor.past.length) return false;
  editor.future.push({ places: editor.places, edits: editor.edits, terrain: editor.terrain });
  ({ places: editor.places, edits: editor.edits, terrain: editor.terrain } = editor.past.pop());
  return true;
}
```

```js
export function redo(editor) {
  if (!editor.future.length) return false;
  editor.past.push({ places: editor.places, edits: editor.edits, terrain: editor.terrain });
  ({ places: editor.places, edits: editor.edits, terrain: editor.terrain } = editor.future.pop());
  return true;
}
```

Update the comments of `createEditor` and `remember` to mention the terrain.

- [ ] **Step 5: Write `src/editor/terrain.js`**

```js
// The world editor's ground painting: which corners of the map's tile grid have been given a
// ground kind by hand. tools/build-map.py decides ground at tile corners and asks these overrides
// first. This file paints boxes, packs the overrides into runs for terrain.json and writes that
// file's text. It knows nothing about the page.

import { remember } from './model.js';

/**
 * The ground kinds, in the map build's rank order (a higher one is painted over a lower one).
 * `water` is what erasing leaves: there is no "nothing" in this world, only sea.
 */
export const KINDS = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water'];

/** The side of one box (one map tile) in world units. */
export const BOX = 64;

/** The kind the Eraser paints. */
export const ERASER = 'water';

/** Makes a terrain with no overrides. `ground` maps a corner, as 'row,col', to its kind. */
export const emptyTerrain = () => ({ ground: {} });

/**
 * Unpacks the file's runs into one entry per corner.
 *
 * @param {Array[]} runs - `[row, firstCol, lastCol, kind]` runs from terrain.json.
 * @returns {object} The overrides, 'row,col' to kind.
 */
export function decodeRuns(runs) {
  const ground = {};
  for (const [row, first, last, kind] of runs)
    for (let col = first; col <= last; col++) ground[`${row},${col}`] = kind;
  return ground;
}

/**
 * Packs the overrides into runs: neighbours of one kind in a row become one entry.
 *
 * Like writing "seats 4 to 9, row C" instead of six separate seats: the file stays short and a
 * git diff shows a stroke as a few lines.
 *
 * @param {object} ground - The overrides, 'row,col' to kind.
 * @returns {Array[]} `[row, firstCol, lastCol, kind]` runs, sorted by row, then column.
 */
export function encodeRuns(ground) {
  const corners = Object.entries(ground)
    .map(([key, kind]) => [...key.split(',').map(Number), kind])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const runs = [];
  for (const [row, col, kind] of corners) {
    const last = runs.at(-1);
    if (last && last[0] === row && last[2] === col - 1 && last[3] === kind) last[2] = col;
    else runs.push([row, col, col, kind]);
  }
  return runs;
}

/**
 * Puts the terrain read from disk into an editing session.
 *
 * @param {object} editor - The editing session from `createEditor`.
 * @param {object} file - The parsed terrain file.
 */
export function loadTerrain(editor, file) {
  editor.terrain = { ground: decodeRuns(file.ground ?? []) };
  editor.savedTerrain = writeTerrain(editor.terrain);
}

/** Says whether the terrain differs from the text that was last saved. */
export const isTerrainDirty = (editor) => writeTerrain(editor.terrain) !== editor.savedTerrain;

/**
 * Notes that the terrain as it is now has been saved.
 *
 * @param {object} editor - The editing session.
 */
export function markTerrainSaved(editor) {
  editor.savedTerrain = writeTerrain(editor.terrain);
}

/**
 * Says what ground a corner has: the hand-painted kind if there is one, else the generated one.
 *
 * @param {object} terrain - The terrain being edited.
 * @param {{kindAt: Function}} base - The generated ground, from the last built map.
 * @param {number} row - The corner's row.
 * @param {number} col - The corner's column.
 * @returns {string} The ground kind.
 */
export function groundAt(terrain, base, row, col) {
  return terrain.ground[`${row},${col}`] ?? base.kindAt(row, col);
}

/**
 * Paints a square of boxes with one ground kind.
 *
 * A box is painted by setting its four corners. A corner that is given the ground the map build
 * would have made there anyway needs no override, so its entry is removed: the file only ever
 * holds real changes.
 *
 * @param {object} editor - The editing session.
 * @param {number} col - The column of the box under the pointer.
 * @param {number} row - The row of the box under the pointer.
 * @param {number} size - The brush's side in boxes: 1, 3 or 5.
 * @param {string} kind - One of `KINDS`.
 * @param {{rows: number, cols: number, kindAt: Function}} base - The generated ground, and the
 *   size of the map in boxes.
 * @param {boolean} [record] - False for the later moves of one stroke, so the stroke is one undo step.
 */
export function paintBoxes(editor, col, row, size, kind, base, record = true) {
  if (record) remember(editor);

  const half = (size - 1) / 2;
  const { ground } = editor.terrain;

  // Boxes col-half..col+half own corners col-half..col+half+1 (and the same for rows).
  for (let r = Math.max(0, row - half); r <= Math.min(base.rows, row + half + 1); r++)
    for (let c = Math.max(0, col - half); c <= Math.min(base.cols, col + half + 1); c++) {
      if (base.kindAt(r, c) === kind) delete ground[`${r},${c}`];
      else ground[`${r},${c}`] = kind;
    }
}

/**
 * Checks that an object has the shape of the terrain file, before it is written to disk.
 *
 * @param {*} file - What a request sent.
 * @param {{rows: number, cols: number}} [grid] - The map's size in boxes.
 * @returns {string[]} One message per thing that is wrong; empty when the shape is right.
 */
export function shapeErrors(file, grid = { rows: 320, cols: 448 }) {
  if (typeof file !== 'object' || file === null || !Array.isArray(file.ground))
    return ['The terrain must be an object with a "ground" list'];

  const errors = [];
  file.ground.forEach((run, i) => {
    const ok =
      Array.isArray(run) &&
      run.length === 4 &&
      run.slice(0, 3).every(Number.isSafeInteger) &&
      run[0] >= 0 &&
      run[0] <= grid.rows &&
      run[1] >= 0 &&
      run[1] <= run[2] &&
      run[2] <= grid.cols &&
      KINDS.includes(run[3]);
    if (!ok) errors.push(`ground[${i}] must be [row, firstCol, lastCol, kind] inside the map`);
  });
  return errors;
}

/**
 * Turns the terrain into the text of terrain.json: one run per line, in a fixed order.
 *
 * @param {object} terrain - The terrain being edited.
 * @returns {string} The file's text, ending with a newline.
 */
export function writeTerrain(terrain) {
  const runs = encodeRuns(terrain.ground);
  if (!runs.length) return '{\n  "ground": []\n}\n';

  const lines = runs.map(([row, first, last, kind]) => `    [${row}, ${first}, ${last}, "${kind}"]`);
  return `{\n  "ground": [\n${lines.join(',\n')}\n  ]\n}\n`;
}
```

- [ ] **Step 6: Boundary test, run, format, commit**

Add `'editor/terrain.js',` after `'editor/edits.js',` in `PURE` in `tests/boundaries.test.js`.

```bash
npm run format
npm test
git add assets/world/source/terrain.json src/editor/terrain.js src/editor/model.js tests/editor/terrain.test.js tests/boundaries.test.js
git commit -m "Add the world editor's ground painting model"
```

---

### Task 2: The map build reads the overrides

**Files:**
- Modify: `tools/build-map.py`
- Create: `tests/world/terrain.test.js`
- Modify: `src/editor/lookups.js`
- Regenerated: `assets/world/map/wildhaven.json`

**Interfaces:**
- Produces: map properties `baseGround` (one digit per corner, row by row, 321 × 449 characters: the ground the script generated before any override, 0 to 7 in `KINDS` order) and `terrainHash` (sha256 of `terrain.json` with `\r\n` turned into `\n`).
- Produces: `groundLookups() -> { rows: 320, cols: 448, kindAt(row, col) }` from `src/editor/lookups.js`.

- [ ] **Step 1: Write the failing world test**

Create `tests/world/terrain.test.js`:

```js
// Checks that the built map was made from assets/world/source/terrain.json as it is now. It
// fails when someone changes the ground overrides and forgets to run tools/build-map.py.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mapProperty } from '../../src/world/map.js';

// Guards against a stale map: the build stores a fingerprint of the terrain file it read.
test('the map was built from the current terrain file', () => {
  const url = new URL('../../assets/world/source/terrain.json', import.meta.url);
  const text = readFileSync(url, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(mapProperty('terrainHash'), createHash('sha256').update(text).digest('hex'));
});

// Guards the editor's picture of the generated ground: one digit per tile corner.
test('the map records the generated ground at every tile corner', () => {
  assert.match(mapProperty('baseGround'), /^[0-7]+$/);
  assert.equal(mapProperty('baseGround').length, 321 * 449);
});
```

Run: `node --test tests/world/terrain.test.js` → both FAIL (no such properties).

- [ ] **Step 2: Load the overrides in `tools/build-map.py`**

Add `hashlib` to the `import heapq, json, math, os, random, sys` line. Directly after the `OVERLAYS = [...]` line, add:

```python
# ---- hand-painted ground -----------------------------------------------------------------
# assets/world/source/terrain.json holds ground a person painted in the world editor: runs of tile CORNERS
# ([row, first column, last column, kind], in map corner rows and columns) that take the place of whatever the
# rules below would put there. `terrain()` asks these first, so the banks, the deep sea, the scatter and the hills
# all follow a painted coast by themselves. "water" is what the editor's eraser paints.
TERRAIN_KINDS = {'grass': GRASS, 'dirt': DIRT, 'soil': SOIL, 'jungle': JUNGLE, 'rock': ROCK, 'snow': SNOW, 'sand': SAND, 'water': WATER}
terrain_path = os.path.join(SRC, 'terrain.json')
terrain_bytes = open(terrain_path, 'rb').read().replace(b'\r\n', b'\n') if os.path.exists(terrain_path) else b''
try: terrain_file = json.loads(terrain_bytes) if terrain_bytes else {}
except ValueError as e: sys.exit(f'terrain.json is not valid JSON: {e}')

# Reads the "ground" runs of terrain.json into {(row, column): kind}. A wrong run stops the build with a plain message.
def read_paint(runs):
    paint = {}
    if not isinstance(runs, list): sys.exit('terrain.json: "ground" must be a list')
    for run in runs:
        ok = (isinstance(run, list) and len(run) == 4 and all(type(v) is int for v in run[:3]) and run[3] in TERRAIN_KINDS
              and 0 <= run[0] <= ROWS and 0 <= run[1] <= run[2] <= COLS)
        if not ok: sys.exit(f'terrain.json: bad run in "ground": {run}')
        for c in range(run[1], run[2] + 1): paint[(run[0], c)] = TERRAIN_KINDS[run[3]]
    return paint
PAINT = read_paint(terrain_file.get('ground', []) if isinstance(terrain_file, dict) else None)
```

- [ ] **Step 3: Make `terrain()` ask the overrides first**

Rename the existing `def terrain(x, y):` to `def generated_terrain(x, y):` (keep its comment, adding one sentence: "This is the ground before any hand painting; `terrain` below adds that."). Directly after that function, add:

```python
# The ground at the LAND point (x, y): the kind painted by hand on the nearest tile corner if there is one, else
# what the rules above generate. Painted water within 130 units of a place still becomes sand, the same safety
# rule the generated ground has, so a place can never be drowned by the eraser.
def terrain(x, y):
    t = PAINT.get((round((y + PAD) / TILE), round((x + PAD) / TILE)))
    if t is None: return generated_terrain(x, y)
    if t == WATER and any(math.hypot(x - px, y - py) < 130 for px, py in POINTS): t = SAND
    return t
```

Replace the `corner = np.array([[terrain(...) ...]])` line with:

```python
# The generated ground at every tile corner, kept as it is for the world editor (map property `baseGround`), and
# the same grid with the hand-painted corners laid over it, which everything below uses.
base_corner = np.array([[generated_terrain(x * TILE - PAD, y * TILE - PAD) for x in range(COLS + 1)] for y in range(ROWS + 1)])
corner = base_corner.copy()
for (r, c) in PAINT: corner[r, c] = terrain(c * TILE - PAD, r * TILE - PAD)
```

Check with `grep -n "terrain(" tools/build-map.py` that every other caller still calls `terrain`, not `generated_terrain`.

- [ ] **Step 4: A plain message where the script used to crash**

In `path_tile`, between the `rows_, cols_ = np.nonzero(...)` line and the `best = np.argmin(...)` line, add:

```python
    # No tile a path may start from within six tiles: say which place it is instead of crashing on an empty list.
    if not len(rows_): sys.exit(f'No dry, level ground for a footpath near the place at world ({round(x + PAD)}, {round(y + PAD)}): move the place, or change the ground around it')
```

- [ ] **Step 5: The two map properties**

In the `'properties': [...]` list, before the `staleEdits` entry, add:

```python
                   # The world editor reads these two: the generated ground at every tile corner (one digit per corner,
                   # row by row, before any hand painting), and a fingerprint of the terrain.json this map was built from.
                   {'name': 'baseGround', 'type': 'string', 'value': ''.join(str(v) for v in base_corner.ravel())},
                   {'name': 'terrainHash', 'type': 'string', 'value': hashlib.sha256(terrain_bytes).hexdigest()},
```

- [ ] **Step 6: Rebuild with no overrides and check nothing moved**

```bash
python tools/build-map.py
git status --short assets/world
node -e "const m=require('./assets/world/map/wildhaven.json');const p=Object.fromEntries(m.properties.map(x=>[x.name,x.value]));console.log(p.baseGround.length, p.terrainHash.slice(0,8), m.layers.at(-1).objects.length)"
```

Expected: only `wildhaven.json` modified; `144129`, a hash, and the same object count as before (9012). Confirm the tile layers are unchanged:

```bash
git show HEAD:assets/world/map/wildhaven.json > "$TEMP/old-map.json"
node -e "const a=require(process.env.TEMP+'/old-map.json'),b=require('./assets/world/map/wildhaven.json');console.log(a.layers.every((l,i)=>JSON.stringify(l)===JSON.stringify(b.layers[i])))"
```

Expected: `true`.

- [ ] **Step 7: Prove a painted patch lands, then undo it**

Paint a 5×5-corner sand patch into open sea west of the island and a water patch into meadow, away from every place:

```bash
node -e "
const run=(r0,c0,kind)=>Array.from({length:5},(_,i)=>[r0+i,c0,c0+4,kind]);
require('fs').writeFileSync('assets/world/source/terrain.json', JSON.stringify({ground:[...run(150,6,'sand'),...run(120,200,'water')]}));"
python tools/build-map.py
node -e "
import('./src/world/map.js').then(({isDryLand})=>console.log('new land', isDryLand(8*64,152*64), 'new water', !isDryLand(202*64,122*64)))"
node --test tests/world/terrain.test.js tests/world/places.test.js tests/world/sea.test.js tests/world/map.test.js tests/world/cliffs.test.js
```

Expected: `new land true new water true`, and the tests pass. If `places.test.js` or `cliffs.test.js` fails because the water patch happened to cut something off, move the patch (change `120, 200`) rather than weakening a test. Then restore:

```bash
git checkout assets/world/source/terrain.json
python tools/build-map.py
git status --short assets/world
```

Expected: only `assets/world/map/wildhaven.json` modified.

- [ ] **Step 8: Add `groundLookups` to `src/editor/lookups.js`**

Add `import { KINDS } from './terrain.js';` and `import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };`, then:

```js
/**
 * Reads the ground the map build generated at each tile corner, before any hand painting.
 *
 * @returns {{rows: number, cols: number, kindAt: Function}} The map's size in boxes, and
 *   `kindAt(row, col)`: the generated ground kind at a corner ('grass' for a map older than
 *   this feature, which has no record).
 */
export function groundLookups() {
  let digits = '';
  try {
    digits = mapProperty('baseGround');
  } catch {
    // An older map has no record of its ground.
  }

  const cols = MAP.width;
  return {
    rows: MAP.height,
    cols,
    // The ground kind the build made at one corner.
    kindAt: (row, col) => KINDS[Number(digits[row * (cols + 1) + col] ?? 0)],
  };
}
```

- [ ] **Step 9: Run everything, commit**

```bash
npm run format
npm test
git add tools/build-map.py tests/world/terrain.test.js src/editor/lookups.js assets/world/map/wildhaven.json
git commit -m "Let the map build take hand-painted ground from terrain.json"
```

---

### Task 3: Terrain mode in the editor

**Files:**
- Modify: `tools/editor-server.js`, `editor.html`, `src/editor/editor.css`, `src/editor/view.js`, `src/editor/panel.js`, `src/editor/main.js`

**Interfaces:**
- Server: `GET`/`POST /__editor/terrain`, same rules as the other two files.
- `view.js`: `on` gains `ground()` (the overrides, `'row,col'` to kind), `tool()` (the kind being painted, or null), `brush()` (1, 3 or 5) and `paint(col, row, first)`. Exports `GROUND_COLORS`.
- `panel.js`: `on` gains `tool(kind)` and `brush(size)`; `state` gains `tool`, `brush`, `painted` (number of overridden corners).

- [ ] **Step 1: Server**

In `tools/editor-server.js`: import `shapeErrors as terrainShape, writeTerrain, decodeRuns` from `'../src/editor/terrain.js'`; add to `FILES`:

```js
  terrain: {
    path: 'assets/world/source/terrain.json',
    // The page sends the file's own shape: a list of runs.
    shape: terrainShape,
    // The writer wants the overrides one per corner, so the runs are unpacked first.
    write: (data) => writeTerrain({ ground: decodeRuns(data.ground) }),
    empty: '{\n  "ground": []\n}\n',
  },
```

Change `sourceHash` to cover all three files:

```js
const sourceHash = (root) =>
  hashOf(Object.keys(FILES).map((name) => readFile(root, name).hash).join(''));
```

In `STEPS`, add `'tests/world/terrain.test.js'` and `'tests/world/cliffs.test.js'` to the test step and change its label to `node --test (places, sea, map, cliffs, edits, terrain)`.

- [ ] **Step 2: `editor.html`**

After the Objects mode button add `<button type="button" data-mode="terrain">Terrain</button>`. After the `objects-pane` section add:

```html
        <section id="terrain-pane" hidden>
          <p id="terrain-help">
            Pick a ground, then click or drag on the map to paint boxes. The Eraser turns boxes to
            sea. With no ground picked, dragging moves the map; holding Space does too. Painted
            boxes show as flat colour until you rebuild.
          </p>
          <div id="grounds">
            <button type="button" data-ground="grass">Grass</button>
            <button type="button" data-ground="dirt">Dirt</button>
            <button type="button" data-ground="soil">Soil</button>
            <button type="button" data-ground="jungle">Jungle</button>
            <button type="button" data-ground="rock">Rock</button>
            <button type="button" data-ground="snow">Snow</button>
            <button type="button" data-ground="sand">Sand</button>
            <button type="button" data-ground="water">Eraser</button>
          </div>
          <label
            >Brush
            <select id="brush">
              <option value="1">1 box</option>
              <option value="3">3 boxes</option>
              <option value="5">5 boxes</option>
            </select></label
          >
          <p id="painted"></p>
        </section>
```

- [ ] **Step 3: `editor.css`**

Append:

```css
/* ---- Terrain pane ---- */
#terrain-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#terrain-pane[hidden] {
  display: none;
}

#terrain-pane p {
  margin: 0;
  color: #a9b5ab;
}

#grounds {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

/* Each ground button carries a swatch of its preview colour, set from panel.js. */
#grounds button {
  display: flex;
  align-items: center;
  gap: 6px;
}

#grounds .swatch {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid #10140f;
  border-radius: 3px;
}
```

- [ ] **Step 4: `src/editor/view.js`**

Add the import `import { BOX } from './terrain.js';` and, after `COLORS`:

```js
/** The flat colour a hand-painted corner is shown in until the map is rebuilt, by ground kind. */
export const GROUND_COLORS = {
  grass: '#6f9a3c',
  dirt: '#9a7b4f',
  soil: '#6b5a3a',
  jungle: '#2f6b2f',
  rock: '#8d8d8d',
  snow: '#f2f4f8',
  sand: '#e6cf8a',
  water: '#3f84b5',
};

/** The grid of boxes is drawn once a box is at least this many screen pixels wide. */
const GRID_PIXELS = 8;
```

Inside `createView`, after `let booked = false;`:

```js
  /** The box under the pointer in terrain mode, as [col, row], for the brush outline. */
  let brushAt = null;

  /** True while the Space bar is held: dragging then moves the map instead of painting. */
  let space = false;
```

After `drawObjects`, add:

```js
  /**
   * Shows every hand-painted corner as a flat square of its ground's colour.
   *
   * A corner sits where four boxes meet, so its square is drawn centred on it: that is roughly
   * the patch the rebuilt map will show, a full box with a soft edge half a box out.
   */
  function drawGround() {
    const ground = on.ground();
    const side = BOX * cam.scale;
    ctx.globalAlpha = 0.8;

    for (const key in ground) {
      const [row, col] = key.split(',').map(Number);
      const [x, y] = toScreen(col * BOX - BOX / 2, row * BOX - BOX / 2);
      if (x > canvas.width || y > canvas.height || x + side < 0 || y + side < 0) continue;
      ctx.fillStyle = GROUND_COLORS[ground[key]];
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(side), Math.ceil(side));
    }
    ctx.globalAlpha = 1;
  }

  /** Draws the grid of boxes and the outline of the brush, in terrain mode. */
  function drawGrid() {
    const side = BOX * cam.scale;

    if (side >= GRID_PIXELS) {
      const [x0, y0] = toWorld(0, 0);
      const [x1, y1] = toWorld(canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let c = Math.max(0, Math.floor(x0 / BOX)); c * BOX <= Math.min(WORLD.width, x1); c++) {
        const x = Math.round(toScreen(c * BOX, 0)[0]) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let r = Math.max(0, Math.floor(y0 / BOX)); r * BOX <= Math.min(WORLD.height, y1); r++) {
        const y = Math.round(toScreen(0, r * BOX)[1]) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }

    // The boxes the next click would paint.
    if (brushAt && on.tool()) {
      const half = (on.brush() - 1) / 2;
      const [x, y] = toScreen((brushAt[0] - half) * BOX, (brushAt[1] - half) * BOX);
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, on.brush() * side, on.brush() * side);
    }
  }
```

In `drawMarkers`, change `const small = on.mode() === 'objects';` to `const small = on.mode() !== 'places';` and its comment to "In objects and terrain mode they are small and can't be picked."

In `draw`, after the `if (sharp()) {...} else if (...) {...}` block and before the blocked overlay, add:

```js
    if (on.places()) drawGround();
    if (on.mode() === 'terrain') drawGrid();
```

Add before `pressObjects`:

```js
  /**
   * Works out which box a world spot is in.
   *
   * @param {number} x - World x.
   * @param {number} y - World y.
   * @returns {number[]} `[col, row]` of the box.
   */
  const boxAt = (x, y) => [Math.floor(x / BOX), Math.floor(y / BOX)];

  /**
   * Starts whatever a press in terrain mode means: paint, or move the map.
   *
   * @param {PointerEvent} event - The press.
   * @param {number} x - World x under the pointer.
   * @param {number} y - World y under the pointer.
   */
  function pressTerrain(event, x, y) {
    // No ground picked, the Space bar held, or the middle button: this drag moves the map.
    if (!on.tool() || space || event.button === 1) {
      action = { pan: true, sx: event.offsetX, sy: event.offsetY, moved: true };
      return;
    }

    const [col, row] = boxAt(x, y);
    action = { paint: true, col, row };
    on.paint(col, row, true);
  }
```

(`moved: true` so a click that only pans never clears a selection.)

In the `pointerdown` listener, before the `objects` line: `if (on.mode() === 'terrain') return pressTerrain(event, x, y);`

In the `pointermove` listener, inside `if (!action) {...}`, add before its `return`:

```js
      if (on.mode() === 'terrain') {
        brushAt = boxAt(x, y);
        later();
      }
```

and after the `action.box` branch:

```js
    if (action.paint) {
      // Paint again only when the pointer has reached another box.
      const [col, row] = boxAt(x, y);
      brushAt = [col, row];
      if (col === action.col && row === action.row) return;
      action.col = col;
      action.row = row;
      on.paint(col, row, false);
      return;
    }
```

In the `pointerleave` listener add `brushAt = null;`. After the `wheel` listener add:

```js
  // Holding Space turns painting into moving the map, as in most paint programs.
  addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.target.closest?.('input, select, textarea')) {
      space = true;
      if (on.mode() === 'terrain') event.preventDefault();
    }
  });
  addEventListener('keyup', (event) => {
    if (event.code === 'Space') space = false;
  });
```

Update `createView`'s comment to list the four new `on` members.

- [ ] **Step 5: `src/editor/panel.js`**

Import `GROUND_COLORS` beside `COLORS`. After the `modeButtons` line:

```js
  const groundButtons = [...root.querySelectorAll('[data-ground]')];
```

After the `for (const button of modeButtons)` line:

```js
  for (const button of groundButtons) {
    // A swatch of the colour this ground is previewed in on the map.
    const swatch = el('span', { className: 'swatch' });
    swatch.style.background = GROUND_COLORS[button.dataset.ground];
    button.prepend(swatch);
    button.onclick = () => on.tool(button.dataset.ground);
  }
  $('brush').onchange = () => on.brush(Number($('brush').value));
```

In `render`, replace the two pane lines with:

```js
      $('places-pane').hidden = !places;
      $('objects-pane').hidden = state.mode !== 'objects';
      $('terrain-pane').hidden = state.mode !== 'terrain';
      for (const button of groundButtons)
        button.classList.toggle('on', state.tool === button.dataset.ground);
      $('brush').value = String(state.brush);
      $('painted').textContent = state.painted
        ? `${state.painted} corners painted by hand.`
        : 'Nothing painted yet.';
```

Update `createPanel`'s comment to list `tool(kind)` and `brush(size)`.

- [ ] **Step 6: `src/editor/main.js`**

Import `* as terrain from './terrain.js'` and `groundLookups` from `./lookups.js`; add `const ground = groundLookups();` beside `objectWorld`. In `app`: `hash: { places: '', edits: '', terrain: '' }`, and add `tool: null,` and `brush: 1,`.

Add to the view's handlers:

```js
  // The hand-painted corners, 'row,col' to ground kind.
  ground: () => app.editor.terrain.ground,
  // The ground being painted, or null when dragging should move the map.
  tool: () => app.tool,
  // The brush's side in boxes.
  brush: () => app.brush,
  // A box was clicked or dragged over with a ground picked; only the first box of a stroke is an undo step.
  paint: (col, row, first) => {
    terrain.paintBoxes(app.editor, col, row, app.brush, app.tool, ground, first);
    refresh();
  },
```

Add to the panel's handlers:

```js
  // A ground button was pressed: pick it, or put it down if it was picked already.
  tool: (kind) => {
    app.tool = app.tool === kind ? null : kind;
    refresh();
  },
  // The brush size was changed.
  brush: (size) => {
    app.brush = size;
    refresh();
  },
```

In the panel's `mode` handler, also reset `tool: null`. Change `isDirty` to include `terrain.isTerrainDirty(app.editor)`. In `refresh`, pass `tool: app.tool, brush: app.brush, painted: Object.keys(app.editor.terrain.ground).length` to `panel.render`.

In `load`, read the third file and load it:

```js
  const [places, objects, painted] = await Promise.all([
    loadFile('places'),
    loadFile('edits'),
    loadFile('terrain'),
  ]);
```

then `terrain.loadTerrain(editor, JSON.parse(painted.text));` after `edits.loadEdits(...)`, and `hash: { places: places.hash, edits: objects.hash, terrain: painted.hash }`.

Replace `saveOne` with a table-driven version:

```js
/**
 * How each file is saved: whether it changed, what to send, and how to note it as saved.
 * The terrain is sent as runs, the shape terrain.json has on disk.
 */
const SAVERS = {
  places: {
    dirty: () => model.isDirty(app.editor),
    data: () => app.editor.places,
    saved: () => model.markSaved(app.editor),
  },
  edits: {
    dirty: () => edits.isEditsDirty(app.editor),
    data: () => app.editor.edits,
    saved: () => edits.markEditsSaved(app.editor),
  },
  terrain: {
    dirty: () => terrain.isTerrainDirty(app.editor),
    data: () => ({ ground: terrain.encodeRuns(app.editor.terrain.ground) }),
    saved: () => terrain.markTerrainSaved(app.editor),
  },
};

/**
 * Saves one file if it changed.
 *
 * @param {string} name - 'places', 'edits' or 'terrain'.
 * @returns {Promise<boolean>} False when the file changed on disk, so nothing was written.
 */
async function saveOne(name) {
  const saver = SAVERS[name];
  if (!saver.dirty()) return true;

  const result = await saveFile(name, saver.data(), app.hash[name]);
  if (!result.ok) return false;

  saver.saved();
  app.hash[name] = result.hash;
  app.stale = result.stale;
  return true;
}
```

Each arrow in `SAVERS` needs a `//` line above it for the comment test (for example "Whether the places changed.", "What to send.", "Notes the places as saved."). In `save`, chain all three: `(await saveOne('places')) && (await saveOne('edits')) && (await saveOne('terrain'))`. In `restoreSession`, restore any saved mode: replace the `=== 'objects'` line with

```js
    const mode = sessionStorage.getItem(MODE_KEY);
    if (['objects', 'terrain'].includes(mode)) app.mode = mode;
```

- [ ] **Step 7: Static checks**

```bash
npm run format
npm test
npm run build
```

Expected: all pass; `dist/` has no `editor.html`.

- [ ] **Step 8: Verify in the browser**

Start the worktree's dev server through a temporary entry in the main checkout's `.claude/launch.json` (restore the file right after starting). At `http://127.0.0.1:5181/editor.html`:

1. Places and Objects modes still work (select a place; select and drag a tree).
2. Terrain mode: zoomed in, the grid shows; with no ground picked, dragging moves the map.
3. Pick Sand, brush 1, click a grass box: a sand-coloured square covers the box and half of each neighbour; the yellow brush outline follows the pointer. "N corners painted by hand" counts 4.
4. Brush 3 and a drag paint a band without gaps; Ctrl+Z removes the whole stroke.
5. Eraser on land shows blue squares. Painting Grass back over a painted box removes the squares and the count drops.
6. Space+drag moves the map while a ground is picked.
7. Paint a small sand patch on the sea beside the west beach and erase a small patch of meadow away from any place. Save: `git diff assets/world/source/terrain.json` shows a few run lines; the page does not reload.
8. Rebuild: passes, the editor comes back in Terrain mode, the sharp view shows real sand with a bank against the sea and real water with a bank in the meadow, and the coloured squares are still drawn over them (they are the overrides). Note how many seconds the rebuild took.
9. In the game on the same server: move a verification save's player beside the new sand and walk onto it; walk at the new water and be stopped.

Restore: `git checkout assets/world/source/terrain.json`, `python tools/build-map.py`, `git status --short assets/world` shows nothing.

- [ ] **Step 9: Commit**

```bash
git add tools/editor-server.js editor.html src/editor/editor.css src/editor/view.js src/editor/panel.js src/editor/main.js
git commit -m "Add a Terrain mode to the world editor for painting and erasing ground"
```

---

### Task 4: Docs

- [ ] **Step 1: `CLAUDE.md`**

In the `src/editor/` row add `terrain.js` ("pure: hand-painted ground at tile corners, kept as runs in `assets/world/source/terrain.json`; `paintBoxes`, `encodeRuns`, `writeTerrain`") and "three modes: Places, Objects and Terrain (pick a ground and drag to paint boxes; the Eraser paints sea; Space+drag moves the map)"; add `terrain.js` to the row's last column. In "World / Map Pipeline", add `assets/world/source/terrain.json  (ground painted by hand in the world editor)` to the diagram and this bullet after the `edits.json` one:

```markdown
- **`assets/world/source/terrain.json` holds hand-painted ground** (world editor, Terrain mode): `ground` is a list of runs `[row, firstColumn, lastColumn, kind]` of tile **corners** (rows 0 to 320, columns 0 to 448; kinds `grass`, `dirt`, `soil`, `jungle`, `rock`, `snow`, `sand`, `water`). In `build-map.py`, `terrain(x, y)` asks these overrides first and falls back to `generated_terrain`, so banks, deep sea, collision, scatter and hills follow a painted coast; painted water within 130 units of a place still becomes sand. Painting a box sets its four corners, so the rebuilt ground is a full box with a soft edge half a box out. The map stores the generated ground per corner (`baseGround`) and a fingerprint of the file it was built from (`terrainHash`); `tests/world/terrain.test.js` fails if the map was not rebuilt after the file changed. Hills, stairs and footpaths are not editable yet (stages 2 and 3 of `docs/superpowers/specs/2026-11-20-world-editor-terrain-design.md`).
```

- [ ] **Step 2: `docs/verification.md`**

Add "World editor: ground (2026-11-20)" with what Task 3 Step 8 checked, the rebuild time, and anything not checked.

- [ ] **Step 3: Final checks and commit**

```bash
npm run format:check
npm test
npm run build
git add CLAUDE.md docs/verification.md docs/superpowers/specs/2026-11-20-world-editor-terrain-design.md docs/superpowers/plans/2026-11-20-world-editor-ground.md
git commit -m "Document the world editor's Terrain mode, with its spec and plan"
```

---

## Self-review notes

- **Spec coverage (stage 1 only):** Terrain mode, palette, eraser as sea, brush 1/3/5, drag as one undo step, grid from 8 pixels per box, override removed when it matches the generated ground, runs in the file, `terrain()` asking overrides first with the two safety rules kept, the clean message in place of the `path_tile` crash, the third server file, one undo history, the preview squares, no game code changes, tests. Stages 2 (hills and stairs) and 3 (footpaths) are **not** in this plan; each gets its own plan once this lands.
- **Changed from the spec:** the world test checks a fingerprint of the file (`terrainHash`) instead of reading painted kinds back out of the tile layers, which store blended corner masks and can't be read back simply. The spec's "Painting a box with the ground it already has (according to the last built map)" is implemented against the **generated** ground stored in `baseGround`, which is what makes "the file holds only real changes" true.
- **Names checked across tasks:** `KINDS`, `BOX`, `ERASER`, `emptyTerrain`, `loadTerrain`, `isTerrainDirty`, `markTerrainSaved`, `paintBoxes(editor, col, row, size, kind, base, record)`, `groundAt`, `encodeRuns`, `decodeRuns`, `shapeErrors`, `writeTerrain`, `groundLookups`, `GROUND_COLORS`, `generated_terrain`, `terrain`, `PAINT`, `base_corner`, `baseGround`, `terrainHash`.
