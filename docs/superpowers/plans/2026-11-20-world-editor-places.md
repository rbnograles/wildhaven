# World Editor (Places) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only page at `http://127.0.0.1:5173/editor.html` that moves, adds, deletes and renames the places in `assets/world/source/places.json`, saves the file, and runs `tools/build-map.py` plus the world tests.

**Architecture:** A second HTML page in the same Vite project. A pure module (`src/editor/model.js`) holds the places, the undo history, the checks and the file writer, and is tested in Node. A canvas view and a DOM panel sit around it. A Vite plugin that exists only in `npm run dev` adds three endpoints (read, save, rebuild). The page imports the game's own `world/` modules so its warnings match the game.

**Tech Stack:** Vanilla JS ES modules, Vite 7 (plugin API: `configureServer`, `handleHotUpdate`), Node's `node:test`, Canvas 2D, Python 3 for `build-map.py`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-world-editor-places-design.md`

## Global Constraints

- Follow `CLAUDE.md` "Code Style": Prettier (`npm run format`), a comment directly above **every** named function (`tests/comments.test.js` scans `src/` and `tests/`), a 2 to 4 line `//` header on every file, a `//` line above every `test(...)`.
- `src/editor/model.js` and `src/editor/lookups.js` are pure: no DOM, no CSS or image imports, and the words `document`, `window` and `import.meta` must not appear in them, not even in comments.
- No new npm packages.
- The editor is dev only: `npm run build` must put nothing of it in `dist/`.
- Server endpoints use a fixed file path and fixed commands. Nothing from a request reaches a path or a command line.
- `places.json` keeps its text layout (see Task 5) and its line endings (CRLF in this checkout).
- Work on a branch named `world-editor-places`. Another session may be committing to this repo: `git add` only the files a task names, never `git add -A`.
- Line numbers in this plan were read on 2026-11-20 at commit `04b62e7` and may have drifted. Find the code by the quoted text.
- After every task: `npm test` and `npm run format:check` pass.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/game/state.js` (modify) | `restoreGame` drops found ids the game no longer has. |
| `tests/game/state.test.js` (modify) | Tests for the above. |
| `tests/world/places.test.js`, `tests/world/progress.test.js` (modify) | Stop hard-coding 52 / 14 / 4. |
| `src/editor/model.js` (create) | Places being edited, undo history, checks, file writer. Pure. |
| `src/editor/lookups.js` (create) | Builds the game facts `checkPlaces` needs. Pure. |
| `tests/editor/model.test.js` (create) | Tests for both. |
| `tests/boundaries.test.js` (modify) | Adds the two pure editor files. |
| `tools/editor-server.js` (create) | Vite plugin: the three endpoints. |
| `vite.config.js` (create) | Registers the plugin. |
| `editor.html` (create) | Page skeleton. |
| `src/editor/editor.css` (create) | Page styles. |
| `src/editor/api.js` (create) | `fetch` calls. |
| `src/editor/view.js` (create) | Canvas: picture, overlays, markers, mouse. |
| `src/editor/panel.js` (create) | Toolbar, list, form, problems, log. |
| `src/editor/main.js` (create) | Wiring and keyboard. |
| `CLAUDE.md`, `docs/verification.md` (modify) | Docs. |

A **ref** names one place everywhere in this plan: `{ kind, i }`, where `kind` is `'spawn' | 'supply' | 'landmark' | 'waypoint' | 'wreck' | 'launch'` and `i` is the index in that kind's table (`'launch'` uses the index of its old boat in `wrecks`; spawns and supplies use the order of their keys).

---

### Task 0: Branch

- [ ] **Step 1: Make the branch and commit the spec and plan**

```bash
git checkout -b world-editor-places
git add docs/superpowers/specs/2026-11-20-world-editor-places-design.md docs/superpowers/plans/2026-11-20-world-editor-places.md
git commit -m "Add the world editor (places) spec and plan"
```

---

### Task 1: Saves survive a deleted place

**Files:**
- Modify: `src/game/state.js` (`restoreGame`, about lines 439 to 576)
- Test: `tests/game/state.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `restoreGame(json)` keeps its signature. New behaviour: unknown ids in `landmarks`, `waypoints`, `wrecks` are dropped; a boat whose `from` is an unknown old boat is removed.

- [ ] **Step 1: Write the failing tests**

Add at the end of `tests/game/state.test.js`:

```js
// Guards saves against the world editor: deleting or renaming one place must not throw away
// a whole save that had found it. The stale id is dropped and everything else is kept.
test('a save that found a place the map no longer has loads without that place', () => {
  const game = createGame('builder');
  game.landmarks = ['h-oak', 'gone-landmark'];
  game.waypoints = ['gone-signpost'];
  game.wrecks = ['wreck-east', 'gone-boat'];

  const back = restoreGame(serializeGame(game));

  assert.deepEqual(back.landmarks, ['h-oak']);
  assert.deepEqual(back.waypoints, []);
  assert.deepEqual(back.wrecks, ['wreck-east']);
});

// Guards the rowboat of a deleted old boat: it has no launch spot to drift back to, so it is
// removed, and a player who was sitting in it wakes at their start instead of in the sea.
test('a boat from an old boat the map no longer has is removed, and its rower goes to spawn', () => {
  const moored = createGame('survivor');
  moored.boat = { from: 'gone-boat', x: east.launch.x, y: east.launch.y, dir: 2 };
  const onFoot = restoreGame(serializeGame(moored));
  assert.deepEqual([onFoot.boat, onFoot.aboard], [null, false]);
  assert.deepEqual([onFoot.player.x, onFoot.player.y], [moored.player.x, moored.player.y]);

  const rowing = createGame('survivor');
  const spawn = { x: rowing.player.x, y: rowing.player.y };
  rowing.boat = { from: 'gone-boat', x: east.launch.x, y: east.launch.y, dir: 2 };
  rowing.aboard = true;
  Object.assign(rowing.player, east.launch);
  const ashore = restoreGame(serializeGame(rowing));
  assert.deepEqual([ashore.boat, ashore.aboard], [null, false]);
  assert.deepEqual([ashore.player.x, ashore.player.y], [spawn.x, spawn.y]);
});
```

In the existing test `'invalid, outdated, mismatched and impossible save data is rejected'`, these four edits no longer describe a broken save. Delete them from the list:

```js
    (g) => (g.landmarks = ['nowhere']),
    (g) => (g.waypoints = ['h-oak']),
    (g) => (g.wrecks = ['nowhere']),
    (g) => (g.boat = { from: 'nowhere', x: east.launch.x, y: east.launch.y, dir: 2 }),
```

and add these three in their place, so the list still guards the shape:

```js
    (g) => (g.landmarks = [5]),
    (g) => (g.wrecks = 'wreck-east'),
    (g) => (g.boat = { from: 7, x: east.launch.x, y: east.launch.y, dir: 2 }),
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/game/state.test.js`
Expected: the two new tests FAIL (`restoreGame` returns null, so reading `.landmarks` throws).

- [ ] **Step 3: Change `restoreGame`**

Above `restoreGame` (after `placeBoat`), add the helper:

```js
/**
 * Keeps only the found ids the game still has.
 *
 * A place can be deleted or renamed in the world editor. A save that found it earlier is still a
 * good save, so the stale id is quietly left out, like crossing a closed shop off an old list.
 *
 * @param {string[]} ids - The found ids read from a save.
 * @param {{id: string}[]} places - The places the game has now.
 * @returns {string[]} A fresh list with the unknown ids removed.
 */
const stillThere = (ids, places) => ids.filter((id) => places.some((p) => p.id === id));
```

In the boat check, replace the line

```js
          !WRECKS.some((w) => w.id === boat.from) ||
```

with

```js
          typeof boat.from !== 'string' ||
```

Directly after that whole `if (...) return null;` block (before the "On foot the player must stand somewhere walkable" comment), add:

```js
    // An old boat can be deleted in the world editor. Its rowboat then has no launch spot to go
    // back to, so the boat is removed, and a player who was in it starts from their spawn.
    if (boat !== null && !WRECKS.some((w) => w.id === boat.from)) {
      const { spawn } = CHARACTERS.find((c) => c.id === s.character);
      if (s.aboard) Object.assign(s.player, { x: spawn.x, y: spawn.y });
      s.boat = null;
      s.aboard = false;
    }
```

Replace the whole "The discovered and found lists may only hold real ids" block with:

```js
    // The discovered and found lists are short lists of ids, each listed once. A region must be
    // real. A found place the map no longer has is allowed here and dropped below (`stillThere`).
    for (const list of [s.discovered, s.landmarks, s.waypoints, s.wrecks]) {
      if (
        !Array.isArray(list) ||
        list.length > 1000 ||
        new Set(list).size !== list.length ||
        !list.every((id) => typeof id === 'string')
      )
        return null;
    }
    if (!s.discovered.every((id) => REGIONS.some((r) => r.id === id))) return null;
```

In the returned object, replace the three copies:

```js
      landmarks: stillThere(s.landmarks, LANDMARKS),
      waypoints: stillThere(s.waypoints, WAYPOINTS),
      wrecks: stillThere(s.wrecks, WRECKS),
```

`placeBoat(s)` is called after the new block, so it sees `s.boat === null` and never looks up the missing old boat. Update the sentence in `restoreGame`'s own comment if it says found ids must be real.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/game/state.test.js tests/game/saves.test.js`
Expected: PASS.

- [ ] **Step 5: Format, full tests, commit**

```bash
npm run format
npm test
git add src/game/state.js tests/game/state.test.js
git commit -m "Keep a save when a place it found is gone from the map"
```

---

### Task 2: Tests stop hard-coding the number of places

The editor adds and deletes landmarks, signposts and old boats. Two tests pin the counts (52, 14, 4, and 7 or 10 per region), so the editor's Rebuild would fail on the first added landmark.

**Files:**
- Modify: `tests/world/places.test.js` (the first test and the `LANDMARKS_PER_REGION` constant above it)
- Modify: `tests/world/progress.test.js` (about line 32)

**Interfaces:** none.

- [ ] **Step 1: Replace the count test in `tests/world/places.test.js`**

Delete the `LANDMARKS_PER_REGION` constant with its comment, and replace the test `'the world has seven regions, 52 landmarks, 14 signposts and 4 old boats with unique ids'` with:

```js
// Guards the ids saves are keyed by, and the rule that every region has something to find.
// The counts themselves are not pinned: places are added and removed in the world editor.
test('the world has seven regions, unique ids, and a landmark and a signpost in every region', () => {
  assert.equal(REGION_LIST.length, 7);

  const ids = [...REGION_LIST, ...LANDMARKS, ...WAYPOINTS, ...WRECKS].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);

  const regions = REGION_LIST.map((r) => r.id);
  for (const p of [...LANDMARKS, ...WAYPOINTS, ...WRECKS])
    assert.ok(regions.includes(p.region), `${p.id} names the unknown region ${p.region}`);

  for (const region of regions) {
    assert.ok(LANDMARKS.some((l) => l.region === region), `${region} has no landmark`);
    assert.ok(WAYPOINTS.some((w) => w.region === region), `${region} has no signpost`);
  }
});
```

- [ ] **Step 2: Fix `tests/world/progress.test.js`**

Find `places: { found: 2, total: 52 },`. Change `52` to `LANDMARKS.length`, and add `LANDMARKS` to the file's import from `'../../src/data/places.js'` (add that import line if the file has none):

```js
import { LANDMARKS } from '../../src/data/places.js';
```

- [ ] **Step 3: Run, format, commit**

Run: `node --test tests/world/places.test.js tests/world/progress.test.js`
Expected: PASS.

```bash
npm run format
git add tests/world/places.test.js tests/world/progress.test.js
git commit -m "Stop pinning the number of places in the world tests"
```

Known limit, on purpose: `places.test.js` still lists the three islet landmarks by id (`islets`). A new landmark on an islet fails the on-foot test until its id is added there. Islets belong to build 2.

---

### Task 3: The model: places, edits and undo

**Files:**
- Create: `src/editor/model.js`
- Create: `tests/editor/model.test.js`
- Modify: `tests/boundaries.test.js` (the `PURE` list)

**Interfaces:**
- Produces (all exported from `src/editor/model.js`):
  - `KINDS: string[]` = `['spawn', 'supply', 'landmark', 'waypoint', 'wreck']`
  - `createEditor(places) -> editor` where `editor = { places, past: object[], future: object[], saved: string }`
  - `getPlace(places, ref) -> { kind, i, id, name, region?, x, y, pool?, object?, launch? } | undefined`
  - `listPlaces(places) -> place[]` (every spawn, supply, landmark, signpost and old boat; no launch points)
  - `movePlace(editor, ref, x, y, record = true)`
  - `addPlace(editor, kind, x, y, region) -> ref` (`region` is one entry of `places.regions`)
  - `deletePlace(editor, ref)`
  - `setField(editor, ref, field, value)`
  - `undo(editor) -> boolean`, `redo(editor) -> boolean`
  - `isDirty(editor) -> boolean`, `markSaved(editor)`
  - `writePlaces(places) -> string` (a stub in this task, finished in Task 5)

- [ ] **Step 1: Write the failing tests**

Create `tests/editor/model.test.js`:

```js
// Checks the world editor's model: the places being edited, the undo history, the checks that
// warn about a bad spot, and the writer that turns the places back into the file's text.
// The model is the only part of the editor that can lose or corrupt places.json, so it is tested.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEditor,
  getPlace,
  listPlaces,
  movePlace,
  addPlace,
  deletePlace,
  setField,
  undo,
  redo,
  isDirty,
  markSaved,
} from '../../src/editor/model.js';

/** A tiny places file with one of everything, so each test can see exactly what changed. */
const sample = () => ({
  regions: [
    { id: 'pinefall', key: 'P', name: 'Pinefall Woods' },
    { id: 'meadows', key: 'h', name: 'Hollowstead Meadows' },
  ],
  spawns: { scout: [100, 100] },
  supplies: { 'pine-wood': [200, 100] },
  landmarks: [
    { id: 'p-camp', region: 'pinefall', name: 'Scout Camp', x: 300, y: 300 },
    { id: 'h-oak', region: 'meadows', name: 'Old Oak', x: 900, y: 300, object: 'big-oak' },
  ],
  waypoints: [{ id: 'p-wp-camp', region: 'pinefall', name: 'Camp Signpost', x: 400, y: 400 }],
  wrecks: [
    { id: 'wreck-north', region: 'pinefall', name: 'Rowboat', x: 500, y: 100, launch: [500, 40] },
  ],
});

// Guards the editor against editing the caller's object: the loaded file must stay untouched.
test('an editor works on its own copy of the places', () => {
  const places = sample();
  const editor = createEditor(places);
  movePlace(editor, { kind: 'landmark', i: 0 }, 10, 20);
  assert.equal(places.landmarks[0].x, 300);
  assert.equal(editor.places.landmarks[0].x, 10);
});

// Guards the list the panel and the canvas draw from: one row per place, launch points left out.
test('listPlaces gives every place once, with its kind and index', () => {
  const rows = listPlaces(sample());
  assert.deepEqual(
    rows.map((p) => `${p.kind}:${p.i}:${p.id}`),
    [
      'spawn:0:scout',
      'supply:0:pine-wood',
      'landmark:0:p-camp',
      'landmark:1:h-oak',
      'waypoint:0:p-wp-camp',
      'wreck:0:wreck-north',
    ],
  );
  assert.deepEqual(getPlace(sample(), { kind: 'launch', i: 0 }).y, 40);
  assert.equal(getPlace(sample(), { kind: 'landmark', i: 9 }), undefined);
});

// Guards moving: whole numbers only, only the named place changes, and an old boat takes its
// launch point along so the pair never drifts apart by accident.
test('movePlace moves one place to whole numbers, and an old boat carries its launch point', () => {
  const editor = createEditor(sample());

  movePlace(editor, { kind: 'spawn', i: 0 }, 150.6, 99.2);
  assert.deepEqual(editor.places.spawns.scout, [151, 99]);
  assert.deepEqual(editor.places.supplies['pine-wood'], [200, 100]);

  movePlace(editor, { kind: 'wreck', i: 0 }, 510, 120);
  assert.deepEqual(editor.places.wrecks[0].launch, [510, 60]);

  movePlace(editor, { kind: 'launch', i: 0 }, 505, 30);
  assert.deepEqual([editor.places.wrecks[0].x, editor.places.wrecks[0].y], [510, 120]);
  assert.deepEqual(editor.places.wrecks[0].launch, [505, 30]);
});

// Guards new places: a fresh id in the region's own style, and the keyed tables stay closed
// because spawns and supplies are named in code.
test('addPlace makes a place with an unused id, and refuses spawns and supplies', () => {
  const editor = createEditor(sample());
  const [pinefall, meadows] = editor.places.regions;

  const a = addPlace(editor, 'landmark', 320, 330, pinefall);
  const b = addPlace(editor, 'landmark', 340, 350, pinefall);
  const c = addPlace(editor, 'waypoint', 800, 800, meadows);
  const d = addPlace(editor, 'wreck', 600, 300, pinefall);

  assert.deepEqual(a, { kind: 'landmark', i: 2 });
  assert.equal(getPlace(editor.places, a).id, 'p-new-1');
  assert.equal(getPlace(editor.places, b).id, 'p-new-2');
  assert.equal(getPlace(editor.places, c).id, 'h-wp-new-1');
  assert.equal(getPlace(editor.places, c).region, 'meadows');
  assert.equal(getPlace(editor.places, d).id, 'wreck-new-1');
  assert.deepEqual(getPlace(editor.places, d).launch, [600, 80]);

  assert.throws(() => addPlace(editor, 'spawn', 1, 1, pinefall));
  assert.throws(() => addPlace(editor, 'supply', 1, 1, pinefall));
});

// Guards deleting: exactly one place goes, and the kinds code depends on can't be deleted.
test('deletePlace removes one place, and refuses spawns, supplies and launch points', () => {
  const editor = createEditor(sample());
  deletePlace(editor, { kind: 'landmark', i: 0 });
  assert.deepEqual(
    editor.places.landmarks.map((l) => l.id),
    ['h-oak'],
  );
  assert.throws(() => deletePlace(editor, { kind: 'spawn', i: 0 }));
  assert.throws(() => deletePlace(editor, { kind: 'supply', i: 0 }));
  assert.throws(() => deletePlace(editor, { kind: 'launch', i: 0 }));
});

// Guards the form: each field lands on the right place, an emptied optional field disappears
// from the file instead of being saved as "" or null, and the file's key order is kept.
test('setField edits one field, removes an emptied pool or object, and keeps the key order', () => {
  const editor = createEditor(sample());
  const camp = { kind: 'landmark', i: 0 };

  setField(editor, camp, 'name', 'Scout Tent');
  setField(editor, camp, 'object', 'tent');
  setField(editor, camp, 'pool', '260');
  assert.deepEqual(Object.keys(editor.places.landmarks[0]), [
    'id',
    'region',
    'name',
    'x',
    'y',
    'pool',
    'object',
  ]);
  assert.equal(editor.places.landmarks[0].pool, 260);

  setField(editor, camp, 'pool', '');
  setField(editor, { kind: 'landmark', i: 1 }, 'object', '');
  assert.equal('pool' in editor.places.landmarks[0], false);
  assert.equal('object' in editor.places.landmarks[1], false);

  assert.throws(() => setField(editor, { kind: 'spawn', i: 0 }, 'id', 'ranger'));
  assert.throws(() => setField(editor, camp, 'colour', 'red'));
  assert.throws(() => setField(editor, { kind: 'waypoint', i: 0 }, 'pool', '5'));
});

// Guards undo and redo: each edit is one step back, a drag is one step however many mouse
// moves it took, and a new edit after an undo throws away the redo steps.
test('undo and redo walk the history, and a drag counts as one step', () => {
  const editor = createEditor(sample());
  const camp = { kind: 'landmark', i: 0 };
  assert.equal(undo(editor), false);

  movePlace(editor, camp, 310, 300, true);
  movePlace(editor, camp, 320, 300, false);
  movePlace(editor, camp, 330, 300, false);
  setField(editor, camp, 'name', 'Tent');

  assert.equal(undo(editor), true);
  assert.equal(editor.places.landmarks[0].name, 'Scout Camp');
  assert.equal(editor.places.landmarks[0].x, 330);
  assert.equal(undo(editor), true);
  assert.equal(editor.places.landmarks[0].x, 300);
  assert.equal(redo(editor), true);
  assert.equal(editor.places.landmarks[0].x, 330);

  deletePlace(editor, camp);
  assert.equal(redo(editor), false);
});

// Guards the Save button and the "unsaved changes" question: dirty means different from the
// last saved text, so undoing back to it is clean again.
test('an editor is dirty only while its places differ from what was last saved', () => {
  const editor = createEditor(sample());
  assert.equal(isDirty(editor), false);

  movePlace(editor, { kind: 'landmark', i: 0 }, 1, 1);
  assert.equal(isDirty(editor), true);
  undo(editor);
  assert.equal(isDirty(editor), false);

  movePlace(editor, { kind: 'landmark', i: 0 }, 2, 2);
  markSaved(editor);
  assert.equal(isDirty(editor), false);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/editor/model.test.js`
Expected: FAIL, cannot find module `src/editor/model.js`.

- [ ] **Step 3: Write `src/editor/model.js`**

```js
// The world editor's model: the places being edited, the undo history, the checks that warn
// about a bad spot, and the writer that turns the places back into the text of places.json.
// It knows nothing about the page or the canvas, so the tests can run it in Node.

/** The kinds of place the file holds. A launch point is not a kind: it belongs to an old boat. */
export const KINDS = ['spawn', 'supply', 'landmark', 'waypoint', 'wreck'];

/** Which table of the places file holds each kind. */
const TABLES = {
  spawn: 'spawns',
  supply: 'supplies',
  landmark: 'landmarks',
  waypoint: 'waypoints',
  wreck: 'wrecks',
};

/**
 * Kinds kept as `{ id: [x, y] }` tables. Game code names their ids (characters, supplies,
 * villagers), so the editor may move them but never adds, deletes or renames them.
 */
const FIXED = ['spawn', 'supply'];

/** The order a place's keys are written in, the same as the file has always used. */
const KEY_ORDER = ['id', 'region', 'name', 'x', 'y', 'pool', 'object', 'launch'];

/** The fields the form may change, by kind. */
const FIELDS = {
  landmark: ['id', 'name', 'region', 'pool', 'object'],
  waypoint: ['id', 'name', 'region'],
  wreck: ['id', 'name', 'region'],
};

/** The name a new place starts with, until the person types a real one. */
const NEW_NAMES = { landmark: 'New place', waypoint: 'New signpost', wreck: 'New rowboat' };

/** How far north of a new old boat its launch point starts, to be dragged onto water. */
const LAUNCH_OFFSET = 220;

/** How many undo steps are remembered before the oldest is forgotten. */
const HISTORY = 200;

/** Makes a deep copy, so two copies never share a nested list or object. */
const copy = (value) => structuredClone(value);

/**
 * Starts an editing session on a places file.
 *
 * Like photocopying a form before writing on it: the editor scribbles on its own copy, keeps a
 * pile of earlier copies for undo, and remembers the text that was last saved.
 *
 * @param {object} places - The parsed places file.
 * @returns {{places: object, past: object[], future: object[], saved: string}} The session.
 */
export function createEditor(places) {
  return { places: copy(places), past: [], future: [], saved: writePlaces(places) };
}

/**
 * Looks up one place and gives it in a single shape, whatever table it lives in.
 *
 * @param {object} places - The places being edited.
 * @param {{kind: string, i: number}} ref - Which place.
 * @returns {object|undefined} `{kind, i, id, name, x, y, ...}`, or undefined if there is none.
 */
export function getPlace(places, { kind, i }) {
  if (kind === 'launch') {
    const boat = places.wrecks[i];
    return (
      boat && {
        kind,
        i,
        id: boat.id,
        name: `${boat.name} (launch)`,
        x: boat.launch[0],
        y: boat.launch[1],
      }
    );
  }

  if (FIXED.includes(kind)) {
    const entry = Object.entries(places[TABLES[kind]])[i];
    return entry && { kind, i, id: entry[0], name: entry[0], x: entry[1][0], y: entry[1][1] };
  }

  const place = places[TABLES[kind]]?.[i];
  return place && { kind, i, ...copy(place) };
}

/**
 * Lists every place in the file, in the file's order. Launch points are left out.
 *
 * @param {object} places - The places being edited.
 * @returns {object[]} One `getPlace` result per place.
 */
export function listPlaces(places) {
  return KINDS.flatMap((kind) => {
    const table = places[TABLES[kind]];
    const count = FIXED.includes(kind) ? Object.keys(table).length : table.length;
    return Array.from({ length: count }, (_, i) => getPlace(places, { kind, i }));
  });
}

/**
 * Puts the places as they are now on the undo pile, before an edit changes them.
 *
 * @param {object} editor - The editing session.
 */
function remember(editor) {
  editor.past.push(copy(editor.places));
  if (editor.past.length > HISTORY) editor.past.shift();
  editor.future = [];
}

/**
 * Moves one place to a new spot.
 *
 * Positions are rounded to whole numbers, like the file has always held. Moving an old boat
 * moves its launch point by the same amount, so the two stay together.
 *
 * @param {object} editor - The editing session.
 * @param {{kind: string, i: number}} ref - Which place (or an old boat's launch point).
 * @param {number} x - The new x, in world units.
 * @param {number} y - The new y, in world units.
 * @param {boolean} [record] - False for the later moves of one drag, so the drag is one undo step.
 */
export function movePlace(editor, ref, x, y, record = true) {
  if (record) remember(editor);

  const { places } = editor;
  const at = [Math.round(x), Math.round(y)];

  if (ref.kind === 'launch') {
    places.wrecks[ref.i].launch = at;
  } else if (FIXED.includes(ref.kind)) {
    const table = places[TABLES[ref.kind]];
    table[Object.keys(table)[ref.i]] = at;
  } else {
    const place = places[TABLES[ref.kind]][ref.i];
    if (ref.kind === 'wreck')
      place.launch = [place.launch[0] + at[0] - place.x, place.launch[1] + at[1] - place.y];
    place.x = at[0];
    place.y = at[1];
  }
}

/**
 * Finds an id nobody uses yet: the stem with the first free number after it.
 *
 * @param {object} places - The places being edited.
 * @param {string} stem - The start of the id, such as 'p-new'.
 * @returns {string} For example 'p-new-1'.
 */
function freeId(places, stem) {
  const used = new Set(
    [...places.regions, ...places.landmarks, ...places.waypoints, ...places.wrecks].map(
      (p) => p.id,
    ),
  );
  let n = 1;
  while (used.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}

/**
 * Adds a new landmark, signpost or old boat.
 *
 * The id copies the style the region's other places use: the region's letter for a landmark
 * ('p-new-1'), the letter plus 'wp' for a signpost ('p-wp-new-1'), and 'wreck-new-1' for a boat.
 *
 * @param {object} editor - The editing session.
 * @param {string} kind - 'landmark', 'waypoint' or 'wreck'.
 * @param {number} x - Where it goes, in world units.
 * @param {number} y - Where it goes, in world units.
 * @param {{id: string, key: string}} region - The region under that spot, from `places.regions`.
 * @returns {{kind: string, i: number}} A ref to the new place.
 */
export function addPlace(editor, kind, x, y, region) {
  if (!FIELDS[kind]) throw new Error(`A ${kind} cannot be added in the editor`);
  remember(editor);

  const letter = region.key.toLowerCase();
  const stem = kind === 'wreck' ? 'wreck-new' : kind === 'waypoint' ? `${letter}-wp-new` : `${letter}-new`;
  const place = {
    id: freeId(editor.places, stem),
    region: region.id,
    name: NEW_NAMES[kind],
    x: Math.round(x),
    y: Math.round(y),
  };
  if (kind === 'wreck') place.launch = [place.x, place.y - LAUNCH_OFFSET];

  const table = editor.places[TABLES[kind]];
  table.push(place);
  return { kind, i: table.length - 1 };
}

/**
 * Deletes a landmark, signpost or old boat.
 *
 * @param {object} editor - The editing session.
 * @param {{kind: string, i: number}} ref - Which place.
 */
export function deletePlace(editor, ref) {
  if (!FIELDS[ref.kind]) throw new Error(`A ${ref.kind} cannot be deleted in the editor`);
  remember(editor);
  editor.places[TABLES[ref.kind]].splice(ref.i, 1);
}

/**
 * Rebuilds a place with its keys in the file's usual order, so a new field lands in its slot.
 *
 * @param {object} place - A landmark, signpost or old boat.
 * @returns {object} The same fields, in `KEY_ORDER`, then any others.
 */
function tidy(place) {
  const keys = [...KEY_ORDER, ...Object.keys(place)].filter((key) => key in place);
  return Object.fromEntries([...new Set(keys)].map((key) => [key, place[key]]));
}

/**
 * Changes one field of a landmark, signpost or old boat from the form.
 *
 * An emptied `pool` or `object` is removed from the place, because the file leaves those keys
 * out when a place has none. `pool` is stored as a number.
 *
 * @param {object} editor - The editing session.
 * @param {{kind: string, i: number}} ref - Which place.
 * @param {string} field - 'id', 'name', 'region', and for a landmark 'pool' or 'object'.
 * @param {string} value - What was typed or picked.
 */
export function setField(editor, ref, field, value) {
  if (!FIELDS[ref.kind]?.includes(field))
    throw new Error(`A ${ref.kind} has no "${field}" to edit`);
  remember(editor);

  const table = editor.places[TABLES[ref.kind]];
  const place = { ...table[ref.i] };

  if ((field === 'pool' || field === 'object') && String(value).trim() === '') delete place[field];
  else place[field] = field === 'pool' ? Number(value) : String(value);

  table[ref.i] = tidy(place);
}

/**
 * Steps back one edit.
 *
 * @param {object} editor - The editing session.
 * @returns {boolean} False when there was nothing to undo.
 */
export function undo(editor) {
  if (!editor.past.length) return false;
  editor.future.push(editor.places);
  editor.places = editor.past.pop();
  return true;
}

/**
 * Steps forward again after an undo.
 *
 * @param {object} editor - The editing session.
 * @returns {boolean} False when there was nothing to redo.
 */
export function redo(editor) {
  if (!editor.future.length) return false;
  editor.past.push(editor.places);
  editor.places = editor.future.pop();
  return true;
}

/** Says whether the places differ from the text that was last saved. */
export const isDirty = (editor) => writePlaces(editor.places) !== editor.saved;

/**
 * Notes that the places as they are now have been saved.
 *
 * @param {object} editor - The editing session.
 */
export function markSaved(editor) {
  editor.saved = writePlaces(editor.places);
}

/**
 * Turns the places back into the file's text. (Task 5 replaces this with the file's real layout.)
 *
 * @param {object} places - The places being edited.
 * @returns {string} The text.
 */
export function writePlaces(places) {
  return JSON.stringify(places);
}
```

- [ ] **Step 4: Add the pure editor files to the boundary test**

In `tests/boundaries.test.js`, in the `PURE` list, add one entry after `'animation/clips.js',` and widen the comment above the list to say the editor's model is included:

```js
  'animation/clips.js',
  'editor/model.js',
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/editor/model.test.js tests/boundaries.test.js tests/comments.test.js`
Expected: PASS.

- [ ] **Step 6: Format and commit**

```bash
npm run format
npm test
git add src/editor/model.js tests/editor/model.test.js tests/boundaries.test.js
git commit -m "Add the world editor's model: places, edits and undo"
```

---

### Task 4: Checks: errors and warnings

**Files:**
- Modify: `src/editor/model.js` (add `shapeErrors`, `checkPlaces`)
- Create: `src/editor/lookups.js`
- Modify: `tests/editor/model.test.js`
- Modify: `tests/boundaries.test.js` (add `'editor/lookups.js'`)

**Interfaces:**
- Consumes: `listPlaces`, `KINDS` from Task 3.
- Produces:
  - `shapeErrors(places) -> string[]` (empty when the object has the file's shape; the server uses it before writing)
  - `checkPlaces(places, world) -> { kind: string|null, i: number|null, level: 'error'|'warning', message: string }[]`
  - `world` shape: `{ width: number, height: number, isWalkable(x, y): boolean, isSailable(x, y): boolean, regionIdAt(x, y): string, journal: { [regionId]: string[] }, sprites: string[] }`
  - `gameLookups() -> world` from `src/editor/lookups.js`, built from the real game modules

- [ ] **Step 1: Write the failing tests**

Add to the imports of `tests/editor/model.test.js`:

```js
import { shapeErrors, checkPlaces } from '../../src/editor/model.js';
import { gameLookups } from '../../src/editor/lookups.js';
import PLACES from '../../assets/world/source/places.json' with { type: 'json' };
```

Add below `sample`:

```js
/**
 * A pretend world for the checks: everything walkable and sailable, pinefall on the left and
 * meadows on the right. A test overrides the one fact it wants to break.
 */
const world = (over = {}) => ({
  width: 1000,
  height: 1000,
  isWalkable: () => true,
  isSailable: () => true,
  regionIdAt: (x) => (x < 600 ? 'pinefall' : 'meadows'),
  journal: { pinefall: ['p-camp'] },
  sprites: ['big-oak'],
  ...over,
});

/** Runs the checks on the sample after one change, and gives the messages of one level. */
const problems = (change, level, over) => {
  const places = sample();
  change(places);
  return checkPlaces(places, world(over))
    .filter((p) => p.level === level)
    .map((p) => p.message);
};
```

Add the tests:

```js
// Guards the server's last line of defence: a request with the wrong shape must never be
// written over places.json.
test('shapeErrors accepts the file shape and names what is wrong with anything else', () => {
  assert.deepEqual(shapeErrors(sample()), []);
  assert.deepEqual(shapeErrors(PLACES), []);

  assert.notDeepEqual(shapeErrors(null), []);
  assert.notDeepEqual(shapeErrors({ ...sample(), landmarks: {} }), []);
  assert.notDeepEqual(shapeErrors({ ...sample(), spawns: { scout: [1, 'two'] } }), []);

  const broken = sample();
  broken.landmarks[0].x = 1.5;
  broken.wrecks[0].launch = [1];
  broken.waypoints[0].extra = true;
  assert.equal(shapeErrors(broken).length, 3);
});

// Guards the clean case: a good file must show no problems, or people learn to ignore the list.
test('checkPlaces finds nothing wrong with a good file', () => {
  assert.deepEqual(checkPlaces(sample(), world()), []);
});

// Guards each error that blocks Save: a bad or repeated id would break saves and the tests,
// and an unknown region or sprite would break the map build.
test('checkPlaces reports errors for bad ids, an empty name, unknown regions and sprites, and spots off the map', () => {
  assert.match(problems((p) => (p.landmarks[0].id = 'P Camp'), 'error')[0], /not a valid id/);
  assert.match(problems((p) => (p.landmarks[0].id = ''), 'error')[0], /not a valid id/);
  assert.match(problems((p) => (p.waypoints[0].id = 'p-camp'), 'error')[0], /more than once/);
  assert.match(problems((p) => (p.wrecks[0].id = 'pinefall'), 'error')[0], /more than once/);
  assert.match(problems((p) => (p.landmarks[0].name = '  '), 'error')[0], /needs a name/);
  assert.match(problems((p) => (p.landmarks[0].region = 'moon'), 'error')[0], /unknown region/);
  assert.match(problems((p) => (p.landmarks[1].object = 'dragon'), 'error')[0], /no sprite/);
  assert.match(problems((p) => (p.spawns.scout = [-5, 100]), 'error')[0], /outside the world/);
  assert.match(problems((p) => (p.wrecks[0].launch = [500, 1200]), 'error')[0], /outside the world/);
});

// Guards each warning: these don't block Save, because a rebuild reshapes the land around a
// place, but the person should see them.
test('checkPlaces warns about unwalkable spots, the wrong region, a dry launch point and journal pages', () => {
  assert.match(
    problems(() => {}, 'warning', { isWalkable: (x) => x !== 300 })[0],
    /can't stand/,
  );
  assert.match(problems((p) => (p.landmarks[0].x = 700), 'warning')[0], /is in meadows/);
  assert.match(problems(() => {}, 'warning', { isSailable: () => false })[0], /not on water/);
  assert.match(problems((p) => (p.landmarks[0].id = 'p-tent'), 'warning').join('|'), /journal/);
  assert.match(
    problems(() => {}, 'warning', { journal: { pinefall: [] } })[0],
    /no journal page/,
  );
});

// Guards the real file: with the real game lookups, today's places.json must be clean. If this
// fails after a map change, the message names the place that needs a look.
test('the real places file has no errors or warnings against the real map', () => {
  assert.deepEqual(checkPlaces(PLACES, gameLookups()), []);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/editor/model.test.js`
Expected: FAIL, `shapeErrors` is not exported / `lookups.js` not found.

- [ ] **Step 3: Add the checks to `src/editor/model.js`**

Add below `KEY_ORDER`:

```js
/** What a valid id looks like: lowercase words of letters and digits, joined by single dashes. */
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The keys each kind of listed place may have. Anything else is a typo or a stray field. */
const ALLOWED = {
  regions: ['id', 'key', 'name'],
  landmarks: ['id', 'region', 'name', 'x', 'y', 'pool', 'object'],
  waypoints: ['id', 'region', 'name', 'x', 'y'],
  wrecks: ['id', 'region', 'name', 'x', 'y', 'launch'],
};
```

Add above `writePlaces`:

```js
/** Says whether a value is a pair of whole numbers, like [14348, 4148]. */
const isSpot = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isSafeInteger);

/** Says whether a value is a plain `{...}` object, not a list and not null. */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks that an object has the shape of the places file, before it is written to disk.
 *
 * This is the bouncer at the door: it doesn't judge whether a spot is a good one, only that
 * every table and field is the right kind of thing, so a broken request can't wreck the file.
 *
 * @param {*} places - What a request sent.
 * @returns {string[]} One message per thing that is wrong; empty when the shape is right.
 */
export function shapeErrors(places) {
  if (!isObject(places)) return ['The places must be an object'];
  const errors = [];

  for (const table of ['spawns', 'supplies']) {
    if (!isObject(places[table])) errors.push(`"${table}" must be an object`);
    else
      for (const [id, spot] of Object.entries(places[table]))
        if (!isSpot(spot)) errors.push(`${table}.${id} must be [x, y] in whole numbers`);
  }

  for (const [table, allowed] of Object.entries(ALLOWED)) {
    if (!Array.isArray(places[table])) {
      errors.push(`"${table}" must be a list`);
      continue;
    }

    places[table].forEach((p, i) => {
      const where = `${table}[${i}]`;
      if (!isObject(p)) return errors.push(`${where} must be an object`);

      const texts = table === 'regions' ? ['id', 'key', 'name'] : ['id', 'region', 'name'];
      const bad =
        Object.keys(p).find((key) => !allowed.includes(key)) ??
        texts.find((key) => typeof p[key] !== 'string') ??
        (table !== 'regions' && !isSpot([p.x, p.y]) ? 'x, y' : undefined) ??
        (table === 'wrecks' && !isSpot(p.launch) ? 'launch' : undefined) ??
        ('pool' in p && !(Number.isFinite(p.pool) && p.pool > 0) ? 'pool' : undefined) ??
        ('object' in p && typeof p.object !== 'string' ? 'object' : undefined);
      if (bad) errors.push(`${where} has a bad "${bad}"`);
    });
  }

  return errors;
}

/**
 * Looks over the places and lists everything the person should know about.
 *
 * An error is something that would break the game or the map build (a repeated id, an unknown
 * region), so Save is refused while one stands. A warning is a spot that looks wrong on the map
 * as it was last built (in water, in another region). Rebuilding reshapes the land around each
 * place, so a warning doesn't block Save.
 *
 * @param {object} places - The places being edited, already in the file's shape.
 * @param {object} world - Facts about the game: `width`, `height`, `isWalkable(x, y)`,
 *   `isSailable(x, y)`, `regionIdAt(x, y)`, `journal` (landmark ids the journal names, by region
 *   id) and `sprites` (the object sprite names).
 * @returns {{kind: string|null, i: number|null, level: string, message: string}[]} The problems,
 *   each pointing at a place by kind and index (null for one that belongs to no place).
 */
export function checkPlaces(places, world) {
  const found = [];
  const regionIds = places.regions.map((r) => r.id);

  /** Adds one problem to the list. */
  const add = (ref, level, message) =>
    found.push({ kind: ref?.kind ?? null, i: ref?.i ?? null, level, message });

  /** Says whether a spot is inside the world. */
  const inside = (x, y) => x >= 0 && y >= 0 && x <= world.width && y <= world.height;

  // Ids of regions, landmarks, signposts and old boats share one pool: count each one's uses.
  const uses = new Map();
  for (const p of [...places.regions, ...places.landmarks, ...places.waypoints, ...places.wrecks])
    uses.set(p.id, (uses.get(p.id) ?? 0) + 1);

  for (const p of listPlaces(places)) {
    const ref = { kind: p.kind, i: p.i };
    const editable = !FIXED.includes(p.kind);
    const label = p.name?.trim() || p.id || `A ${p.kind}`;

    // Errors: things the game or the map build can't live with.
    if (editable) {
      if (!ID.test(p.id))
        add(ref, 'error', `"${p.id}" is not a valid id: use lowercase letters, digits and dashes`);
      else if (uses.get(p.id) > 1) add(ref, 'error', `The id "${p.id}" is used more than once`);

      if (!p.name.trim()) add(ref, 'error', `${p.id || 'A place'} needs a name`);
      if (!regionIds.includes(p.region))
        add(ref, 'error', `${label} names the unknown region "${p.region}"`);
      if (p.object !== undefined && !world.sprites.includes(p.object))
        add(ref, 'error', `${label} uses "${p.object}", but there is no sprite with that name`);
    }

    if (!inside(p.x, p.y)) {
      add(ref, 'error', `${label} is outside the world`);
      continue;
    }

    // Warnings: the spot looks wrong on the map as it was last built.
    if (!world.isWalkable(p.x, p.y))
      add(ref, 'warning', `${label} is on ground the player can't stand on`);

    const here = world.regionIdAt(p.x, p.y);
    if (editable && regionIds.includes(p.region) && here !== p.region)
      add(ref, 'warning', `${label} says ${p.region} but is in ${here}`);

    if (p.kind === 'wreck') {
      const launch = { kind: 'launch', i: p.i };
      if (!inside(p.launch[0], p.launch[1]))
        add(launch, 'error', `The launch point of ${label} is outside the world`);
      else if (!world.isSailable(p.launch[0], p.launch[1]))
        add(launch, 'warning', `The launch point of ${label} is not on water a boat can float on`);
    }
  }

  // The field journal names landmarks by id, so a renamed or deleted one leaves a page orphaned.
  for (const [regionId, named] of Object.entries(world.journal)) {
    for (const id of named)
      if (!places.landmarks.some((l) => l.id === id))
        add(null, 'warning', `The journal has a page for "${id}", but no landmark has that id`);

    places.landmarks.forEach((l, i) => {
      if (l.region === regionId && !named.includes(l.id))
        add({ kind: 'landmark', i }, 'warning', `${l.name} has no journal page`);
    });
  }

  return found;
}
```

- [ ] **Step 4: Write `src/editor/lookups.js`**

```js
// Gathers the facts about the game that the world editor's checks need: the size of the world,
// what ground is walkable or sailable, which region a spot is in, which landmarks the journal
// names and which object sprites exist. Kept apart from the model so the model stays import-free.

import { WORLD, isWalkable, isSailable, OBJECT_SPECS } from '../world/map.js';
import { regionOf } from '../world/regions.js';
import { JOURNALS } from '../data/journal.js';

/**
 * Builds the `world` object that `checkPlaces` reads, from the game's own modules.
 *
 * Using the game's real rules means a warning in the editor is exactly what the game would do.
 * They describe the map as it was last built.
 *
 * @returns {object} `{width, height, isWalkable, isSailable, regionIdAt, journal, sprites}`.
 */
export function gameLookups() {
  return {
    width: WORLD.width,
    height: WORLD.height,
    isWalkable: (x, y) => isWalkable(x, y),
    isSailable: (x, y) => isSailable(x, y),
    regionIdAt: (x, y) => regionOf(x, y).id,
    journal: Object.fromEntries(
      Object.entries(JOURNALS).map(([region, j]) => [
        region,
        [...new Set([...j.trail, ...Object.keys(j.pages)])],
      ]),
    ),
    sprites: Object.keys(OBJECT_SPECS).filter((name) => !name.startsWith('_')),
  };
}
```

Before relying on it, open `src/world/map.js` and confirm `OBJECT_SPECS` is the parsed `objects.json` (keys are sprite names, plus `_comment`). If it is shaped differently, build `sprites` from whatever holds the sprite names there.

Add `'editor/lookups.js',` to `PURE` in `tests/boundaries.test.js`, after `'editor/model.js',`.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/editor/model.test.js tests/boundaries.test.js tests/comments.test.js`
Expected: PASS.

If only `'the real places file has no errors or warnings against the real map'` fails, read its message. It names a real place the checks dislike. Do **not** loosen the test or edit `places.json` to make it pass: decide whether the check is too strict for a case the game allows (for example an islet landmark's region) and fix the check, and say what you found in the commit message.

- [ ] **Step 6: Format and commit**

```bash
npm run format
npm test
git add src/editor/model.js src/editor/lookups.js tests/editor/model.test.js tests/boundaries.test.js
git commit -m "Add the world editor's checks for errors and warnings"
```

---

### Task 5: Write the file in its own layout

`places.json` is laid out by hand: two-space indent, one place per line, spaces inside braces. `JSON.stringify` can't produce that, and a different layout would make every save a 100-line git diff.

**Files:**
- Modify: `src/editor/model.js` (`writePlaces`)
- Modify: `tests/editor/model.test.js`

**Interfaces:**
- Produces: `writePlaces(places) -> string`, with `\n` line endings and a final newline, identical to the file's text once its `\r\n` are turned into `\n`.

- [ ] **Step 1: Write the failing test**

Add to the imports of `tests/editor/model.test.js`:

```js
import { readFileSync } from 'node:fs';
import { writePlaces } from '../../src/editor/model.js';
```

Add the tests:

```js
// Guards the git diff: saving an untouched file must change nothing, so a real edit shows up
// as only its own lines. The file has Windows line endings in this checkout, hence the replace.
test('writePlaces gives back the real places file character for character', () => {
  const url = new URL('../../assets/world/source/places.json', import.meta.url);
  const text = readFileSync(url, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(writePlaces(JSON.parse(text)), text);
});

// Guards the layout for places the editor makes itself, and that the text is still real JSON.
test('writePlaces writes one place per line and parses back to the same places', () => {
  const places = sample();
  const text = writePlaces(places);
  assert.deepEqual(JSON.parse(text), places);
  assert.ok(
    text.includes(
      '    { "id": "wreck-north", "region": "pinefall", "name": "Rowboat", "x": 500, "y": 100, "launch": [500, 40] }\n',
    ),
  );
  assert.ok(text.includes('  "spawns": { "scout": [100, 100] },\n'));
  assert.ok(text.endsWith('  ]\n}\n'));
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/editor/model.test.js`
Expected: the two new tests FAIL (the stub writes one long line).

- [ ] **Step 3: Replace `writePlaces` in `src/editor/model.js`**

```js
/**
 * Writes a value on one line, the way the places file does: `[1, 2]` and `{ "id": "a" }`.
 *
 * @param {*} value - A number, text, list or object.
 * @returns {string} The value as one line of JSON, with the file's spacing.
 */
function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const fields = Object.entries(value).map(([key, v]) => `${JSON.stringify(key)}: ${inline(v)}`);
    return `{ ${fields.join(', ')} }`;
  }
  return JSON.stringify(value);
}

/**
 * Writes one table of the file with each entry on its own line.
 *
 * @param {string} name - The table's name, such as 'landmarks'.
 * @param {string[]} lines - Its entries, each already written on one line.
 * @param {string} open - '[' for a list or '{' for a keyed table.
 * @returns {string} The table, indented as in the file, with no comma after it.
 */
function block(name, lines, open) {
  const close = open === '[' ? ']' : '}';
  return `  "${name}": ${open}\n${lines.map((line) => `    ${line}`).join(',\n')}\n  ${close}`;
}

/**
 * Turns the places back into the exact text layout of places.json.
 *
 * The file is laid out by hand: one place per line. Keeping that layout means saving changes
 * only the lines of the places that really changed, so a git diff stays readable. Lines end
 * with a plain newline; whoever writes the file to disk picks the line ending.
 *
 * @param {object} places - The places being edited.
 * @returns {string} The file's text, ending with a newline.
 */
export function writePlaces(places) {
  /** Writes a list table: one object per line. */
  const list = (name) => block(name, places[name].map(inline), '[');

  const supplies = Object.entries(places.supplies).map(
    ([id, spot]) => `${JSON.stringify(id)}: ${inline(spot)}`,
  );

  const tables = [
    list('regions'),
    `  "spawns": ${inline(places.spawns)}`,
    block('supplies', supplies, '{'),
    list('landmarks'),
    list('waypoints'),
    list('wrecks'),
  ];

  return `{\n${tables.join(',\n')}\n}\n`;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/editor/model.test.js`
Expected: PASS. If the character-for-character test fails, the assertion diff shows the first line that differs: the file wins. Adjust `inline`/`block`/the table order to match the file, never the file to match the code.

- [ ] **Step 5: Format and commit**

```bash
npm run format
npm test
git add src/editor/model.js tests/editor/model.test.js
git commit -m "Write places.json back in its own one-place-per-line layout"
```

---

### Task 6: The dev server endpoints

**Files:**
- Create: `tools/editor-server.js`
- Create: `vite.config.js`

**Interfaces:**
- Consumes: `shapeErrors`, `writePlaces` from `src/editor/model.js`.
- Produces (HTTP, dev server only):
  - `GET /__editor/places` → 200 `{ "text": string, "hash": string, "stale": boolean }`. `text` uses `\n`. `stale` is true when `places.json` was written after the map was last built.
  - `POST /__editor/places` with JSON body `{ "places": object, "hash": string }` → 200 `{ "hash": string, "stale": true }`, or 409 `{ "error": "conflict" }` when the file on disk has another hash, or 400 `{ "error": string }` for a bad body or shape.
  - `POST /__editor/rebuild` → 200 `text/plain`, streamed, whose last line is `RESULT: pass` or `RESULT: fail`; 409 `{ "error": "busy" }` while a rebuild is running.

- [ ] **Step 1: Write `tools/editor-server.js`**

```js
// The world editor's back end: a Vite plugin that exists only in `npm run dev`. It lets the
// editor page read and save assets/world/source/places.json and run the map build and its tests.
// The file path and the commands are fixed here; nothing a request sends reaches either.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { shapeErrors, writePlaces } from '../src/editor/model.js';

/** The file the editor edits, and the map file a rebuild writes, inside the project folder. */
const PLACES = 'assets/world/source/places.json';
const MAP = 'assets/world/map/wildhaven.json';

/** The biggest request body accepted, in bytes. The places file is about 10 KB. */
const MAX_BODY = 1_000_000;

/** How long after a save or rebuild the page is kept from reloading itself, in milliseconds. */
const QUIET = 3000;

/** The commands a rebuild runs, in order. The second runs only if the first succeeds. */
const STEPS = [
  { label: 'python tools/build-map.py', cmd: 'python', args: ['tools/build-map.py'] },
  {
    label: 'node --test (places, sea, map)',
    cmd: process.execPath,
    args: [
      '--test',
      'tests/world/places.test.js',
      'tests/world/sea.test.js',
      'tests/world/map.test.js',
    ],
  },
];

/** Makes a short fingerprint of a text, so two versions of the file can be told apart. */
const hashOf = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Reads the places file from disk.
 *
 * @param {string} root - The project folder.
 * @returns {{text: string, hash: string, crlf: boolean}} The text with plain newlines, its
 *   fingerprint, and whether the file on disk uses Windows line endings.
 */
function readPlaces(root) {
  const raw = readFileSync(join(root, PLACES), 'utf8');
  const text = raw.replaceAll('\r\n', '\n');
  return { text, hash: hashOf(text), crlf: raw.includes('\r\n') };
}

/**
 * Says whether the places file was written after the map was last built.
 *
 * @param {string} root - The project folder.
 * @returns {boolean} True when the map is older than the places, so the editor's position
 *   warnings may be out of date.
 */
function isStale(root) {
  try {
    return statSync(join(root, PLACES)).mtimeMs > statSync(join(root, MAP)).mtimeMs;
  } catch {
    return true;
  }
}

/**
 * Sends a JSON answer.
 *
 * @param {object} res - The response to write to.
 * @param {number} status - The HTTP status code.
 * @param {object} body - What to send.
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Collects a request's body and parses it as JSON.
 *
 * @param {object} req - The incoming request.
 * @returns {Promise<*>} The parsed body. Rejects if it is too big or not JSON.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) reject(new Error('The request is too big'));
      else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('The request is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Runs one command and copies everything it prints into the response as it arrives.
 *
 * @param {string} root - The project folder, used as the working folder.
 * @param {{label: string, cmd: string, args: string[]}} step - What to run.
 * @param {object} res - The response the output is streamed to.
 * @returns {Promise<boolean>} True if the command ran and finished with exit code 0.
 */
function runStep(root, step, res) {
  return new Promise((resolve) => {
    res.write(`\n$ ${step.label}\n`);
    const child = spawn(step.cmd, step.args, { cwd: root });

    child.stdout.on('data', (text) => res.write(text));
    child.stderr.on('data', (text) => res.write(text));
    child.on('error', (error) => {
      res.write(`Could not start ${step.cmd}: ${error.message}\n`);
      resolve(false);
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Makes the Vite plugin that serves the editor's three endpoints.
 *
 * `apply: 'serve'` means Vite uses it for the dev server only, never for `npm run build`.
 *
 * @returns {object} A Vite plugin.
 */
export function editorServer() {
  let root = process.cwd();
  let running = false;
  let quietUntil = 0;

  /**
   * Saves the places a request sent, unless the file changed on disk since the page loaded it.
   *
   * @param {object} req - The request, whose body is `{places, hash}`.
   * @param {object} res - The response.
   */
  async function save(req, res) {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      return send(res, 400, { error: error.message });
    }

    const errors = shapeErrors(body?.places);
    if (errors.length) return send(res, 400, { error: errors.join('; ') });

    const current = readPlaces(root);
    if (current.hash !== body.hash) return send(res, 409, { error: 'conflict' });

    // Keep the line endings the file already has, so git sees only the changed lines.
    const text = writePlaces(body.places);
    quietUntil = Date.now() + QUIET;
    writeFileSync(join(root, PLACES), current.crlf ? text.replaceAll('\n', '\r\n') : text);
    send(res, 200, { hash: hashOf(text), stale: true });
  }

  /**
   * Runs the map build and then the world tests, streaming what they print.
   *
   * @param {object} res - The response the output is streamed to.
   */
  async function rebuild(res) {
    if (running) return send(res, 409, { error: 'busy' });
    running = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    let pass = true;
    try {
      for (const step of STEPS) {
        pass = await runStep(root, step, res);
        if (!pass) break;
      }
    } finally {
      running = false;
      quietUntil = Date.now() + QUIET;
    }
    res.end(`\nRESULT: ${pass ? 'pass' : 'fail'}\n`);
  }

  return {
    name: 'wildhaven-editor',
    apply: 'serve',

    // Vite calls this once the dev server exists: remember the project folder and add the routes.
    configureServer(server) {
      root = server.config.root;

      server.middlewares.use('/__editor', (req, res, next) => {
        const path = req.url.split('?')[0];

        if (path === '/places' && req.method === 'GET') {
          const { text, hash } = readPlaces(root);
          return send(res, 200, { text, hash, stale: isStale(root) });
        }
        if (path === '/places' && req.method === 'POST') return save(req, res);
        if (path === '/rebuild' && req.method === 'POST') return rebuild(res);
        next();
      });
    },

    // Vite reloads every open page when a file under assets/world changes. During the editor's own
    // save or rebuild that would wipe the undo history or cut the rebuild log short, so those
    // reloads are skipped. The editor page reloads itself once a rebuild has finished.
    handleHotUpdate({ file }) {
      const ours = file.replaceAll('\\', '/').includes('/assets/world/');
      if (ours && (running || Date.now() < quietUntil)) return [];
    },
  };
}
```

- [ ] **Step 2: Write `vite.config.js`**

```js
// Vite's settings. The game needs none of its own; this file only adds the world editor's
// dev-server endpoints (see tools/editor-server.js), which are left out of the production build.

import { defineConfig } from 'vite';
import { editorServer } from './tools/editor-server.js';

export default defineConfig({
  plugins: [editorServer()],
});
```

- [ ] **Step 3: Check the endpoints by hand**

Start the dev server from the `wildhaven` launch config (port 5173; never start it with a shell command if a preview tool is available). Then:

```bash
curl -s http://127.0.0.1:5173/__editor/places | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.hash.length, j.stale, j.text.slice(0,16))})"
```

Expected: `64`, `true` or `false`, and `{` followed by `"regions": [`.

```bash
curl -s -X POST http://127.0.0.1:5173/__editor/places -H "Content-Type: application/json" -d "{\"places\":{},\"hash\":\"x\"}"
```

Expected: a 400 body listing shape errors. `git status --short assets/world/source/places.json` shows no change.

```bash
curl -s -X POST http://127.0.0.1:5173/__editor/places -H "Content-Type: application/json" -d "{\"places\":$(node -e "process.stdout.write(JSON.stringify(require('./assets/world/source/places.json')))"),\"hash\":\"wrong\"}"
```

Expected: `{"error":"conflict"}`. The file is still unchanged.

Do not call `/__editor/rebuild` here: it rewrites the map files. Task 8 exercises it from the page.

- [ ] **Step 4: Check the game and the production build are untouched**

Run: `npm run build`
Expected: succeeds. Then `ls dist` shows `index.html` and `assets/`, and no `editor.html`.

Load `http://127.0.0.1:5173/` and confirm the main menu still appears with no console errors.

- [ ] **Step 5: Format and commit**

```bash
npm run format
npm test
git add tools/editor-server.js vite.config.js
git commit -m "Add dev-only endpoints for reading, saving and rebuilding places"
```

---

### Task 7: The editor page

**Files:**
- Create: `editor.html`, `src/editor/editor.css`, `src/editor/api.js`, `src/editor/view.js`, `src/editor/panel.js`, `src/editor/main.js`

**Interfaces:**
- Consumes: everything exported by `model.js` (Tasks 3 to 5), `gameLookups()` (Task 4), the endpoints (Task 6).
- Produces:
  - `api.js`: `loadPlaces() -> Promise<{text, hash, stale}>`, `savePlaces(places, hash) -> Promise<{ok: true, hash, stale} | {ok: false, conflict: true}>`, `rebuild(onText) -> Promise<boolean>`
  - `view.js`: `createView(canvas, on) -> { draw(), centerOn(x, y), setOverlay(name, shown) }`. `on` = `{ places(), selected(), flagged(), adding(), select(ref|null), move(ref, x, y, first), add(x, y) }`
  - `panel.js`: `createPanel(root, on) -> { render(state), log(text), setLog(text) }`. `on` = `{ pick(ref), field(name, value), move(x, y), remove(), undo(), redo(), add(kind), save(), rebuild(), overlay(name, shown) }`. `state` = `{ rows, selected, place, regions, sprites, problems, dirty, stale, canUndo, canRedo, adding, busy, status }`

- [ ] **Step 1: Write `editor.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wildhaven world editor</title>
  </head>
  <body>
    <header id="bar">
      <strong>Wildhaven places</strong>
      <button type="button" data-add="landmark">+ Landmark</button>
      <button type="button" data-add="waypoint">+ Signpost</button>
      <button type="button" data-add="wreck">+ Old boat</button>
      <button type="button" id="undo">Undo</button>
      <button type="button" id="redo">Redo</button>
      <label><input type="checkbox" data-overlay="regions" checked /> Region borders</label>
      <label><input type="checkbox" data-overlay="blocked" /> Blocked ground</label>
      <span id="status" role="status"></span>
      <button type="button" id="save">Save</button>
      <button type="button" id="rebuild">Rebuild map</button>
    </header>
    <main>
      <canvas id="map"></canvas>
      <aside id="side">
        <input id="filter" type="search" placeholder="Find a place" aria-label="Find a place" />
        <ul id="list"></ul>
        <form id="form"></form>
        <h2>Problems</h2>
        <p id="stale" hidden>
          Places changed since the map was last built, so the position warnings may be out of date.
          Rebuild for the real answer.
        </p>
        <ul id="problems"></ul>
        <h2>Rebuild log</h2>
        <pre id="log"></pre>
      </aside>
    </main>
    <script type="module" src="/src/editor/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `src/editor/editor.css`**

```css
/* Styles for the world editor page (editor.html). It is a developer tool, separate from the
   game's style.css: a toolbar on top, the map on the left and a side panel on the right. */

/* ---- Page ---- */
* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
  background: #1c2420;
  color: #e8e6dc;
  font:
    14px/1.4 system-ui,
    sans-serif;
}

body {
  display: flex;
  flex-direction: column;
}

/* ---- Toolbar ---- */
#bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #263b31;
}

#status {
  flex: 1;
  text-align: right;
  color: #f2c14e;
}

button,
input,
select {
  font: inherit;
}

button {
  padding: 4px 10px;
  border: 1px solid #55695d;
  border-radius: 4px;
  background: #33493e;
  color: inherit;
  cursor: pointer;
}

button:disabled {
  opacity: 0.45;
  cursor: default;
}

/* The "add" button that is waiting for a click on the map. */
button.on {
  background: #e4572e;
}

/* ---- Map and side panel ---- */
main {
  display: flex;
  flex: 1;
  min-height: 0;
}

#map {
  flex: 1;
  min-width: 0;
  height: 100%;
  cursor: grab;
}

#side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 340px;
  padding: 10px;
  overflow-y: auto;
  background: #222d27;
}

#side h2 {
  margin: 6px 0 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a9b5ab;
}

#filter {
  width: 100%;
  padding: 4px 6px;
}

/* ---- Place list ---- */
#list,
#problems {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The list scrolls on its own so the form below it stays in view. */
#list {
  flex: 0 0 220px;
  overflow-y: auto;
  border: 1px solid #3a4a40;
}

#list li {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 2px 6px;
  cursor: pointer;
}

#list li.selected {
  background: #3d5648;
}

/* The coloured dot that says what kind of place a row is; the colour is set from view.js. */
#list .dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

#list .flag {
  margin-left: auto;
  color: #f2c14e;
}

/* ---- Form ---- */
#form {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 4px 8px;
  align-items: center;
}

#form input,
#form select {
  width: 100%;
  padding: 3px 5px;
}

#form .wide {
  grid-column: 1 / -1;
}

/* ---- Problems and log ---- */
#problems li {
  padding: 3px 0;
  cursor: pointer;
}

#problems .error {
  color: #ff8a70;
}

#problems .warning {
  color: #f2c14e;
}

#stale {
  margin: 0;
  color: #a9b5ab;
  font-style: italic;
}

#log {
  min-height: 80px;
  max-height: 300px;
  margin: 0;
  padding: 6px;
  overflow: auto;
  background: #141a17;
  font-size: 12px;
  white-space: pre-wrap;
}
```

- [ ] **Step 3: Write `src/editor/api.js`**

```js
// The world editor's calls to the dev server (see tools/editor-server.js): read the places file,
// save it, and run a rebuild while passing on what the build prints.

/**
 * Reads the places file from disk.
 *
 * @returns {Promise<{text: string, hash: string, stale: boolean}>} The file's text, a fingerprint
 *   to send back when saving, and whether the map is older than the file.
 */
export async function loadPlaces() {
  const res = await fetch('/__editor/places');
  if (!res.ok) throw new Error(`Could not read the places file (${res.status})`);
  return res.json();
}

/**
 * Saves the places.
 *
 * @param {object} places - The places to write.
 * @param {string} hash - The fingerprint of the file as this page loaded or last saved it.
 * @returns {Promise<object>} `{ok: true, hash, stale}` when saved, or `{ok: false, conflict: true}`
 *   when the file changed on disk in the meantime. Any other failure throws with the reason.
 */
export async function savePlaces(places, hash) {
  const res = await fetch('/__editor/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ places, hash }),
  });

  if (res.status === 409) return { ok: false, conflict: true };
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
  return { ok: true, ...body };
}

/**
 * Runs the map build and the world tests, handing over their output as it is printed.
 *
 * @param {(text: string) => void} onText - Called with each new piece of output.
 * @returns {Promise<boolean>} True if the build and the tests both passed.
 */
export async function rebuild(onText) {
  const res = await fetch('/__editor/rebuild', { method: 'POST' });
  if (res.status === 409) {
    onText('A rebuild is already running.\n');
    return false;
  }
  if (!res.ok || !res.body) {
    onText(`The rebuild could not start (${res.status}).\n`);
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let all = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    all += text;
    onText(text);
  }
  return all.trimEnd().endsWith('RESULT: pass');
}
```

- [ ] **Step 4: Write `src/editor/view.js`**

```js
// The world editor's map: a canvas showing the overview picture of the world with a marker on
// every place. It handles zooming, panning, picking and dragging, and tells main.js what the
// person did; it never changes the places itself.

import overviewUrl from '../../assets/world/map/overview.webp';
import { WORLD, isWalkable } from '../world/map.js';
import { REGION_GRID, regionIndexAt } from '../world/regions.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS } from '../data/balance.js';
import { listPlaces, getPlace } from './model.js';

/** The marker colour of each kind of place. The side panel's list uses the same colours. */
export const COLORS = {
  spawn: '#ffffff',
  supply: '#f2c14e',
  landmark: '#e4572e',
  waypoint: '#4ea8de',
  wreck: '#b07a4a',
  launch: '#7fd1c7',
};

/** How far the map builder keeps scenery from a place, in world units (150 in build-map.py). */
const CLEAR_RING = 150;

/** How close to a marker a click must be to pick it, in screen pixels. */
const HIT = 10;

/** The blocked-ground overlay is drawn in squares this many screen pixels wide. */
const BLOCK_STEP = 8;

/** The overlay only shows from this zoom (screen pixels per world unit); farther out it is noise. */
const BLOCK_ZOOM = 0.08;

/** How much one notch of the mouse wheel zooms. */
const ZOOM_STEP = 1.15;

/**
 * The radius drawn round a selected place: how close the player must come to find it.
 * Old boats are found like landmarks. Other kinds have no finding radius.
 */
const FIND_RADIUS = { landmark: LANDMARK_RADIUS, wreck: LANDMARK_RADIUS, waypoint: WAYPOINT_RADIUS };

/**
 * Sets up the map canvas.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to draw on.
 * @param {object} on - What the view asks and tells main.js: `places()`, `selected()`,
 *   `flagged()` (a Set of 'kind:i' with problems), `adding()` (the kind waiting for a click, or
 *   null), `select(ref|null)`, `move(ref, x, y, first)` and `add(x, y)`.
 * @returns {{draw: Function, centerOn: Function, setOverlay: Function}} The view's controls.
 */
export function createView(canvas, on) {
  const ctx = canvas.getContext('2d');
  const overlays = { regions: true, blocked: false };
  const cam = { x: 0, y: 0, scale: 0.05 };
  const picture = new Image();

  /** What the mouse is doing between pointer down and up: a drag of a place, or a pan. */
  let action = null;

  /** False until the first resize, which zooms out so the whole world shows. */
  let fitted = false;

  /** Turns a spot on the screen into world units. */
  const toWorld = (sx, sy) => [cam.x + sx / cam.scale, cam.y + sy / cam.scale];

  /** Turns a spot in the world into screen pixels. */
  const toScreen = (x, y) => [(x - cam.x) * cam.scale, (y - cam.y) * cam.scale];

  /** The zoom at which the whole world just fits on the canvas. */
  const fitScale = () => Math.min(canvas.width / WORLD.width, canvas.height / WORLD.height);

  /**
   * Lists every marker: each place, plus the launch point of each old boat.
   *
   * @returns {object[]} Places as `getPlace` gives them.
   */
  function markers() {
    const places = on.places();
    const boats = places.wrecks.map((_, i) => getPlace(places, { kind: 'launch', i }));
    return [...listPlaces(places), ...boats];
  }

  /**
   * Finds the marker under a spot on the screen. Later markers are drawn on top, so they win.
   *
   * @param {number} sx - Screen x.
   * @param {number} sy - Screen y.
   * @returns {object|undefined} The place under the pointer, if any.
   */
  function hit(sx, sy) {
    return markers().findLast((p) => {
      const [x, y] = toScreen(p.x, p.y);
      return Math.hypot(x - sx, y - sy) <= HIT;
    });
  }

  /** Tints the ground the player can't stand on, sampled in small squares across the screen. */
  function drawBlocked() {
    ctx.fillStyle = 'rgba(255, 40, 80, 0.38)';
    for (let sy = 0; sy < canvas.height; sy += BLOCK_STEP)
      for (let sx = 0; sx < canvas.width; sx += BLOCK_STEP) {
        const [x, y] = toWorld(sx + BLOCK_STEP / 2, sy + BLOCK_STEP / 2);
        if (!isWalkable(x, y)) ctx.fillRect(sx, sy, BLOCK_STEP, BLOCK_STEP);
      }
  }

  /** Draws a line wherever two neighbouring squares of the region grid belong to different regions. */
  function drawRegions() {
    const { cell, cols, rows } = REGION_GRID;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        const here = regionIndexAt(cx, cy);
        const [x0, y0] = toScreen(cx * cell, cy * cell);
        const [x1, y1] = toScreen((cx + 1) * cell, (cy + 1) * cell);

        if (cx + 1 < cols && regionIndexAt(cx + 1, cy) !== here) {
          ctx.moveTo(x1, y0);
          ctx.lineTo(x1, y1);
        }
        if (cy + 1 < rows && regionIndexAt(cx, cy + 1) !== here) {
          ctx.moveTo(x0, y1);
          ctx.lineTo(x1, y1);
        }
      }
    ctx.stroke();
  }

  /**
   * Draws a circle round a spot, sized in world units.
   *
   * @param {object} p - The place at the centre.
   * @param {number} radius - The radius in world units.
   * @param {string} color - The line colour.
   * @param {number[]} dash - The dash pattern, or [] for a solid line.
   */
  function ring(p, radius, color, dash) {
    const [x, y] = toScreen(p.x, p.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.arc(x, y, radius * cam.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Draws every marker, the lines from old boats to their launch points, and the selection. */
  function drawMarkers() {
    const places = on.places();
    const selected = on.selected();
    const flagged = on.flagged();

    // A thin line ties each old boat to its launch point.
    ctx.strokeStyle = COLORS.launch;
    ctx.lineWidth = 1;
    for (const boat of places.wrecks) {
      ctx.beginPath();
      ctx.moveTo(...toScreen(boat.x, boat.y));
      ctx.lineTo(...toScreen(boat.launch[0], boat.launch[1]));
      ctx.stroke();
    }

    for (const p of markers()) {
      const [x, y] = toScreen(p.x, p.y);
      const chosen = selected && selected.kind === p.kind && selected.i === p.i;

      if (chosen) {
        ring(p, CLEAR_RING, 'rgba(255, 255, 255, 0.6)', [4, 4]);
        if (FIND_RADIUS[p.kind]) ring(p, FIND_RADIUS[p.kind], COLORS[p.kind], []);
      }

      ctx.beginPath();
      ctx.arc(x, y, p.kind === 'launch' ? 4 : 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[p.kind];
      ctx.fill();
      ctx.lineWidth = chosen ? 3 : 1.5;
      ctx.strokeStyle = chosen ? '#ffffff' : flagged.has(`${p.kind}:${p.i}`) ? '#ffe14a' : '#10140f';
      ctx.stroke();
    }
  }

  /** Redraws the whole canvas: the picture, the overlays that are switched on, then the markers. */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;

    if (picture.complete && picture.naturalWidth) {
      const [x, y] = toScreen(0, 0);
      ctx.drawImage(picture, x, y, WORLD.width * cam.scale, WORLD.height * cam.scale);
    }

    if (overlays.blocked && cam.scale >= BLOCK_ZOOM) drawBlocked();
    if (overlays.regions) drawRegions();
    drawMarkers();
  }

  /** Matches the canvas's drawing size to its size on the page, and fits the world the first time. */
  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (!fitted) cam.scale = fitScale();
    fitted = true;
    draw();
  }

  canvas.addEventListener('pointerdown', (event) => {
    const [x, y] = toWorld(event.offsetX, event.offsetY);

    // Waiting to add a place: this click says where.
    if (on.adding()) return on.add(x, y);

    const p = hit(event.offsetX, event.offsetY);
    canvas.setPointerCapture(event.pointerId);

    if (p) {
      const ref = { kind: p.kind, i: p.i };
      on.select(ref);
      // Remember where inside the marker it was grabbed, so it doesn't jump under the pointer.
      action = { drag: ref, dx: p.x - x, dy: p.y - y, moved: false };
    } else {
      action = { pan: true, sx: event.offsetX, sy: event.offsetY, moved: false };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!action) return;

    if (action.drag) {
      const [x, y] = toWorld(event.offsetX, event.offsetY);
      on.move(action.drag, x + action.dx, y + action.dy, !action.moved);
      action.moved = true;
      return;
    }

    cam.x -= (event.offsetX - action.sx) / cam.scale;
    cam.y -= (event.offsetY - action.sy) / cam.scale;
    action.sx = event.offsetX;
    action.sy = event.offsetY;
    action.moved = true;
    draw();
  });

  canvas.addEventListener('pointerup', () => {
    // A click on empty map that didn't pan clears the selection.
    if (action?.pan && !action.moved) on.select(null);
    action = null;
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      // Zoom about the pointer: the world spot under it stays under it.
      const [x, y] = toWorld(event.offsetX, event.offsetY);
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      cam.scale = Math.min(1, Math.max(fitScale() * 0.8, cam.scale * factor));
      cam.x = x - event.offsetX / cam.scale;
      cam.y = y - event.offsetY / cam.scale;
      draw();
    },
    { passive: false },
  );

  new ResizeObserver(resize).observe(canvas);
  picture.onload = draw;
  picture.src = overviewUrl;

  return {
    draw,

    // Moves the camera so a world spot is in the middle of the canvas.
    centerOn: (x, y) => {
      cam.x = x - canvas.width / 2 / cam.scale;
      cam.y = y - canvas.height / 2 / cam.scale;
      draw();
    },

    // Switches an overlay ('regions' or 'blocked') on or off.
    setOverlay: (name, shown) => {
      overlays[name] = shown;
      draw();
    },
  };
}
```

- [ ] **Step 5: Write `src/editor/panel.js`**

```js
// The world editor's toolbar and side panel: the buttons, the searchable list of places, the
// form for the selected place, the list of problems and the rebuild log. It shows what main.js
// gives it and reports clicks and typed values back; it never changes the places itself.

import { COLORS } from './view.js';

/**
 * Makes one element with its properties and children set, to keep the code below short.
 *
 * @param {string} tag - The tag name, such as 'li'.
 * @param {object} [props] - Properties to copy onto the element, such as `textContent`.
 * @param {(Node|string)[]} [children] - What goes inside it.
 * @returns {HTMLElement} The new element.
 */
function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/**
 * Sets up the toolbar and the side panel.
 *
 * @param {Document} root - The page.
 * @param {object} on - What to call when the person does something: `pick(ref)`,
 *   `field(name, value)`, `move(x, y)`, `remove()`, `undo()`, `redo()`, `add(kind)`, `save()`,
 *   `rebuild()` and `overlay(name, shown)`.
 * @returns {{render: Function, log: Function, setLog: Function}} The panel's controls.
 */
export function createPanel(root, on) {
  /** Finds one of the page's fixed elements by its id. */
  const $ = (id) => root.getElementById(id);

  const list = $('list'),
    form = $('form'),
    problems = $('problems'),
    log = $('log'),
    filter = $('filter');
  const addButtons = [...root.querySelectorAll('[data-add]')];

  /** The last state drawn, kept so typing in the search box can redraw the list. */
  let last = null;

  $('undo').onclick = () => on.undo();
  $('redo').onclick = () => on.redo();
  $('save').onclick = () => on.save();
  $('rebuild').onclick = () => on.rebuild();
  for (const button of addButtons) button.onclick = () => on.add(button.dataset.add);
  for (const box of root.querySelectorAll('[data-overlay]'))
    box.onchange = () => on.overlay(box.dataset.overlay, box.checked);
  filter.oninput = () => last && drawList(last);
  form.onsubmit = (event) => event.preventDefault();

  /**
   * Fills the list of places, keeping only the rows that match the search box.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawList(state) {
    const query = filter.value.trim().toLowerCase();
    const flagged = new Set(state.problems.map((p) => `${p.kind}:${p.i}`));
    const rows = state.rows.filter(
      (row) => !query || `${row.id} ${row.name}`.toLowerCase().includes(query),
    );

    list.replaceChildren(
      ...rows.map((row) => {
        const chosen = state.selected?.kind === row.kind && state.selected.i === row.i;
        const dot = el('span', { className: 'dot' });
        dot.style.background = COLORS[row.kind];

        const item = el('li', { className: chosen ? 'selected' : '' }, [dot, row.name]);
        if (flagged.has(`${row.kind}:${row.i}`))
          item.append(el('span', { className: 'flag', textContent: '!' }));
        item.onclick = () => on.pick({ kind: row.kind, i: row.i });
        return item;
      }),
    );
  }

  /**
   * Makes one labelled row of the form.
   *
   * @param {string} label - The words shown beside the input.
   * @param {HTMLElement} input - The input or select.
   * @returns {HTMLElement[]} The label and the input, for the form's two columns.
   */
  function row(label, input) {
    return [el('label', { textContent: label }), input];
  }

  /**
   * Makes a text or number box that reports its value when the person finishes typing.
   *
   * @param {string} value - What it shows.
   * @param {(value: string) => void} [change] - Called with the new value; without it the box is read-only.
   * @param {string} [type] - 'text' or 'number'.
   * @returns {HTMLInputElement} The box.
   */
  function box(value, change, type = 'text') {
    const input = el('input', { type, value: value ?? '', readOnly: !change });
    if (change) input.onchange = () => change(input.value);
    return input;
  }

  /**
   * Makes a drop-down list.
   *
   * @param {string} value - The option picked now.
   * @param {{value: string, label: string}[]} options - The choices.
   * @param {(value: string) => void} change - Called with the new choice.
   * @returns {HTMLSelectElement} The list.
   */
  function pickList(value, options, change) {
    const select = el(
      'select',
      {},
      options.map((o) => el('option', { value: o.value, textContent: o.label })),
    );
    select.value = value ?? '';
    select.onchange = () => change(select.value);
    return select;
  }

  /**
   * Fills the form for the selected place, or empties it when nothing is selected.
   *
   * Spawns, supplies and launch points show only a position: code names their ids, so they
   * can be moved but not renamed or deleted here.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawForm(state) {
    const p = state.place;
    if (!p) return form.replaceChildren(el('p', { className: 'wide', textContent: 'Nothing selected.' }));

    const fixed = ['spawn', 'supply', 'launch'].includes(p.kind);
    const fields = [];

    if (fixed) {
      fields.push(...row(p.kind, box(p.name)));
    } else {
      const regions = state.regions.map((r) => ({ value: r.id, label: r.name }));
      fields.push(
        ...row('id', box(p.id, (v) => on.field('id', v))),
        ...row('name', box(p.name, (v) => on.field('name', v))),
        ...row('region', pickList(p.region, regions, (v) => on.field('region', v))),
      );
    }

    fields.push(
      ...row('x', box(p.x, (v) => on.move(Number(v), p.y), 'number')),
      ...row('y', box(p.y, (v) => on.move(p.x, Number(v)), 'number')),
    );

    if (p.kind === 'landmark') {
      const sprites = [{ value: '', label: '(none)' }, ...state.sprites.map((s) => ({ value: s, label: s }))];
      fields.push(
        ...row('pool', box(p.pool, (v) => on.field('pool', v), 'number')),
        ...row('object', pickList(p.object, sprites, (v) => on.field('object', v))),
      );
    }

    if (!fixed) {
      const remove = el('button', { type: 'button', className: 'wide', textContent: 'Delete this place' });
      remove.onclick = () => on.remove();
      fields.push(remove);
    }

    form.replaceChildren(...fields);
  }

  /**
   * Fills the list of problems. Clicking one selects the place it is about.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawProblems(state) {
    $('stale').hidden = !state.stale;
    if (!state.problems.length)
      return problems.replaceChildren(el('li', { textContent: 'No problems found.' }));

    problems.replaceChildren(
      ...state.problems.map((p) => {
        const item = el('li', { className: p.level, textContent: p.message });
        if (p.kind) item.onclick = () => on.pick({ kind: p.kind, i: p.i });
        return item;
      }),
    );
  }

  return {
    // Redraws the toolbar and the panel from the editor's state.
    render(state) {
      last = state;
      const errors = state.problems.some((p) => p.level === 'error');

      $('undo').disabled = !state.canUndo || state.busy;
      $('redo').disabled = !state.canRedo || state.busy;
      $('save').disabled = !state.dirty || errors || state.busy;
      $('rebuild').disabled = state.dirty || state.busy;
      $('status').textContent = state.status;
      for (const button of addButtons) {
        button.classList.toggle('on', state.adding === button.dataset.add);
        button.disabled = state.busy;
      }

      drawList(state);
      drawForm(state);
      drawProblems(state);
    },

    // Adds text to the end of the rebuild log and keeps the newest lines in view.
    log(text) {
      log.textContent += text;
      log.scrollTop = log.scrollHeight;
    },

    // Replaces the whole rebuild log.
    setLog(text) {
      log.textContent = text;
      log.scrollTop = log.scrollHeight;
    },
  };
}
```

- [ ] **Step 6: Write `src/editor/main.js`**

```js
// The world editor's entry point (editor.html). It loads the places file, joins the model, the
// map view and the side panel together, and handles the keyboard. Every edit goes through the
// model, then `refresh` redraws everything from it.

import './editor.css';
import { regionOf } from '../world/regions.js';
import * as model from './model.js';
import { gameLookups } from './lookups.js';
import { loadPlaces, savePlaces, rebuild } from './api.js';
import { createView } from './view.js';
import { createPanel } from './panel.js';

/** Where the last rebuild's log is kept across the page reload that follows a rebuild. */
const LOG_KEY = 'wildhaven.editor.log';

/** How far the arrow keys nudge the selected place, in world units (Shift nudges by 1). */
const NUDGE = 8;

/** The game facts the checks read. They describe the map as it was last built. */
const world = gameLookups();

/** Everything the page knows: the editing session, the selection and a few flags. */
const app = {
  editor: null,
  hash: '',
  stale: false,
  selected: null,
  adding: null,
  busy: false,
  status: '',
  problems: [],
};

const view = createView(document.getElementById('map'), {
  places: () => app.editor.places,
  selected: () => app.selected,
  flagged: () => new Set(app.problems.map((p) => `${p.kind}:${p.i}`)),
  adding: () => app.adding,
  select: (ref) => {
    app.selected = ref;
    refresh();
  },
  move: (ref, x, y, first) => {
    model.movePlace(app.editor, ref, x, y, first);
    refresh();
  },
  add: (x, y) => {
    const region = app.editor.places.regions.find((r) => r.id === regionOf(x, y).id);
    app.selected = model.addPlace(app.editor, app.adding, x, y, region);
    app.adding = null;
    refresh();
  },
});

const panel = createPanel(document, {
  pick: (ref) => {
    app.selected = ref;
    const place = model.getPlace(app.editor.places, ref);
    if (place) view.centerOn(place.x, place.y);
    refresh();
  },
  field: (name, value) => edit(() => model.setField(app.editor, app.selected, name, value)),
  move: (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y))
      edit(() => model.movePlace(app.editor, app.selected, x, y));
  },
  remove: removeSelected,
  undo: () => model.undo(app.editor) && refresh(),
  redo: () => model.redo(app.editor) && refresh(),
  add: (kind) => {
    app.adding = app.adding === kind ? null : kind;
    app.status = app.adding ? 'Click the map to place it.' : '';
    refresh();
  },
  save,
  rebuild: runRebuild,
  overlay: (name, shown) => view.setOverlay(name, shown),
});

/**
 * Runs one edit on the model and redraws, showing the reason if the model refuses it.
 *
 * @param {Function} change - The edit to run.
 */
function edit(change) {
  try {
    change();
    app.status = '';
  } catch (error) {
    app.status = error.message;
  }
  refresh();
}

/** Deletes the selected place after asking, if it is a kind that can be deleted. */
function removeSelected() {
  const place = app.selected && model.getPlace(app.editor.places, app.selected);
  if (!place || ['spawn', 'supply', 'launch'].includes(place.kind)) return;
  if (!confirm(`Delete "${place.name}"?`)) return;

  edit(() => model.deletePlace(app.editor, app.selected));
}

/** Re-runs the checks and redraws the panel and the map from the model. */
function refresh() {
  const { places } = app.editor;

  // An undo or a delete can leave the selection pointing at a place that is gone.
  if (app.selected && !model.getPlace(places, app.selected)) app.selected = null;
  app.problems = model.checkPlaces(places, world);
  const dirty = model.isDirty(app.editor);

  panel.render({
    rows: model.listPlaces(places),
    selected: app.selected,
    place: app.selected && model.getPlace(places, app.selected),
    regions: places.regions,
    sprites: world.sprites,
    problems: app.problems,
    dirty,
    stale: app.stale || dirty,
    canUndo: app.editor.past.length > 0,
    canRedo: app.editor.future.length > 0,
    adding: app.adding,
    busy: app.busy,
    status: app.status || (dirty ? 'Unsaved changes' : ''),
  });
  view.draw();
}

/** Reads the places file from disk and starts a fresh editing session on it. */
async function load() {
  const { text, hash, stale } = await loadPlaces();
  Object.assign(app, { editor: model.createEditor(JSON.parse(text)), hash, stale, selected: null });
  refresh();
}

/** Saves the places, or offers to reload when the file changed on disk in the meantime. */
async function save() {
  try {
    const result = await savePlaces(app.editor.places, app.hash);

    if (!result.ok) {
      const reload = confirm(
        'places.json changed on disk since this page loaded it, so it was not overwritten.\n\n' +
          'Reload it and drop the edits on this page?',
      );
      if (reload) await load();
      return;
    }

    model.markSaved(app.editor);
    Object.assign(app, { hash: result.hash, stale: result.stale, status: 'Saved.' });
  } catch (error) {
    app.status = error.message;
  }
  refresh();
}

/**
 * Runs the map build and the world tests, then reloads the page.
 *
 * The reload brings in the freshly built map, so the picture and the warnings are up to date.
 * The log is kept in session storage first, so it is still there to read after the reload.
 */
async function runRebuild() {
  app.busy = true;
  app.status = 'Rebuilding the map. This takes a while.';
  panel.setLog('');
  refresh();

  let text = '';
  const pass = await rebuild((piece) => {
    text += piece;
    panel.log(piece);
  }).catch((error) => {
    text += `\nThe rebuild stopped: ${error.message}\n`;
    return false;
  });

  try {
    sessionStorage.setItem(LOG_KEY, `${pass ? 'PASSED' : 'FAILED'}\n${text}`);
  } catch {
    // Storage can be blocked; the log is then lost on reload, which is only a nuisance.
  }
  location.reload();
}

/** Shows the log of the rebuild that ran just before this page load, if there was one. */
function showLastLog() {
  try {
    const text = sessionStorage.getItem(LOG_KEY);
    if (!text) return;
    sessionStorage.removeItem(LOG_KEY);
    panel.setLog(text);
    app.status = text.startsWith('PASSED') ? 'Rebuild passed.' : 'Rebuild FAILED: see the log.';
  } catch {
    // No storage, no log.
  }
}

addEventListener('keydown', (event) => {
  // Keys typed into a box belong to the box.
  if (event.target.closest?.('input, select, textarea') || app.busy || !app.editor) return;

  const key = event.key.toLowerCase();
  if (event.ctrlKey && key === 'z') return model.undo(app.editor) && refresh();
  if (event.ctrlKey && key === 'y') return model.redo(app.editor) && refresh();
  if (key === 'escape') {
    app.adding = null;
    app.status = '';
    return refresh();
  }
  if (key === 'delete') return removeSelected();

  const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
  const place = app.selected && model.getPlace(app.editor.places, app.selected);
  if (step && place) {
    event.preventDefault();
    const by = event.shiftKey ? 1 : NUDGE;
    edit(() =>
      model.movePlace(app.editor, app.selected, place.x + step[0] * by, place.y + step[1] * by),
    );
  }
});

// Leaving with unsaved edits asks first.
addEventListener('beforeunload', (event) => {
  if (app.editor && model.isDirty(app.editor) && !app.busy) event.preventDefault();
});

showLastLog();
load().catch((error) => {
  document.getElementById('status').textContent = error.message;
});
```

- [ ] **Step 7: Format and run the static checks**

```bash
npm run format
npm test
npm run build
```

Expected: all pass (`tests/comments.test.js` covers the new files). `ls dist` shows no `editor.html`. If the comment test names a function, add its comment; do not restructure to dodge the rule.

- [ ] **Step 8: Verify in the browser**

Start the `wildhaven` launch config and open `http://127.0.0.1:5173/editor.html`. Check each of these, reading the console for errors after each:

1. The world picture fills the canvas; 82 place markers and 4 smaller launch markers show; region borders are drawn; the list has 82 rows; Problems says "No problems found."
2. Wheel zooms about the pointer; dragging empty map pans; ticking "Blocked ground" when zoomed in tints the sea, rivers and cliffs.
3. Click a landmark: its row highlights, the form fills, a solid ring (200 units) and a dashed ring (150) appear. Click a signpost: the solid ring is smaller (110).
4. Drag a landmark into the sea: a warning appears and the marker gets a yellow ring; "Unsaved changes" shows; the stale note appears. Ctrl+Z puts it back in one step and the warning goes.
5. Click "+ Landmark", then the map: a "New place" appears selected with id like `p-new-1` and the region under the click. Rename its id to an existing id: an error appears and Save is disabled. Delete it (Delete key, confirm).
6. Select an old boat and drag its launch marker onto land: a "not on water" warning. Drag the old boat: the launch point follows.
7. Arrow keys nudge the selection by 8, Shift+arrow by 1. Typing in the search box filters the list and arrow keys there do not move a place.
8. Move one landmark a little and press Save. Status says "Saved." and the page does **not** reload (the undo button is still enabled). `git diff --stat assets/world/source/places.json` shows `1 insertion(+), 1 deletion(-)`.
9. Conflict: with the page open, change a number in `places.json` by hand in an editor and save it. Wait 4 seconds. Move a place in the page and press Save: the conflict question appears and the hand edit is still in the file. Choose reload.
10. Put the file back: `git checkout assets/world/source/places.json`, then reload the page.

If step 8 reloads the page, `handleHotUpdate` in `tools/editor-server.js` is not matching: log `file` there, fix the path test, and re-check. Do not remove the suppression.

- [ ] **Step 9: Commit**

```bash
git add editor.html src/editor/editor.css src/editor/api.js src/editor/view.js src/editor/panel.js src/editor/main.js
git commit -m "Add the world editor page for moving, adding and deleting places"
```

---

### Task 8: Rebuild from the page, and docs

The Rebuild code is already written (Tasks 6 and 7). This task proves it end to end and writes the docs.

**Files:**
- Modify: `CLAUDE.md`, `docs/verification.md`
- Possibly modify: `tools/editor-server.js`, `src/editor/main.js` (only for a defect found in Step 1)

- [ ] **Step 1: Verify a passing rebuild**

A rebuild rewrites `assets/world/map/*`. Before starting, run `git status --short assets/world/map` and note whether those files are already modified, so you can tell your changes from someone else's.

1. Open the editor. Move one meadow landmark about 100 units onto open grass. Save. Press "Rebuild map".
2. While it runs: the log fills line by line, the buttons are disabled, and the page does not reload by itself.
3. When it ends the page reloads once; the log is still shown, headed `PASSED`, ending `RESULT: pass`; status says "Rebuild passed."; the stale note is gone.
4. Open `http://127.0.0.1:5173/` in the same browser, start the Builder, walk to the landmark's new spot and confirm it is found there (toast and map marker).

Note how long the rebuild took; it goes in the docs.

- [ ] **Step 2: Verify a failing rebuild**

1. Drag a signpost far out into the deep sea (north edge of the map). Save. Rebuild.
2. Expected: the log shows a failing test that names the signpost, the page reloads, the log is headed `FAILED`, status says "Rebuild FAILED: see the log."
3. Undo the damage: `git checkout assets/world/source/places.json`, reload the editor, press "Rebuild map", and confirm it passes.

- [ ] **Step 3: Verify a missing Python is reported, not hung**

Temporarily change `cmd: 'python'` to `cmd: 'python-nope'` in `tools/editor-server.js`, restart the dev server, press Rebuild. Expected: the log says "Could not start python-nope" and ends `RESULT: fail` within a second. Change it back and restart.

- [ ] **Step 4: Restore the map files**

If Step 1's landmark move is not meant to be kept:

```bash
git checkout assets/world/source/places.json
```

Then rebuild once more from the editor so the map matches the file, and check `git status --short assets/world` shows only what was modified before this task began (the build is seeded, so the same places give the same map).

- [ ] **Step 5: Update `CLAUDE.md`**

In "Commands", after the `npm run dev` line, add:

```sh
                     # world editor (dev only): http://127.0.0.1:5173/editor.html
```

In the Architecture table, add a row after `src/core/`:

```markdown
| `src/editor/` | The dev-only world editor page (`editor.html`, opened at `/editor.html` while `npm run dev` runs; never in `dist/`): `model.js` (pure: the places being edited, undo, `checkPlaces`, `shapeErrors`, and `writePlaces`, which keeps `places.json` in its one-place-per-line layout), `lookups.js` (pure: the game facts the checks read), `view.js` (canvas map, overlays, markers, dragging), `panel.js` (toolbar, list, form, problems, rebuild log), `api.js`, `main.js`. `tools/editor-server.js` is the Vite plugin (registered in `vite.config.js`, `apply: 'serve'`) with the three `/__editor/` endpoints: read and save `places.json` (refused if the file changed on disk) and rebuild (runs `build-map.py`, then the places, sea and map tests). It edits places only; rivers, regions and hills are later builds (`docs/superpowers/specs/2026-11-20-world-editor-places-design.md`) | `model.js` and `lookups.js` only |
```

In "Save model", after the sentence about `restoreGame` dropping run-out `regrowAt` timers, add:

```markdown
A found id in `landmarks`, `waypoints` or `wrecks` that the map no longer has (a place deleted or renamed in the world editor) is dropped on load, not treated as a broken save; a boat whose old boat is gone is removed, and a player who was aboard it starts from their spawn.
```

In "World / Map Pipeline", in the bullet that begins "**`assets/world/source/places.json` is the single source for positions.**", change "To move or add a place, edit the JSON and re-run the script" to:

```markdown
To move or add a place, use the world editor (`/editor.html` in `npm run dev`), or edit the JSON and re-run the script
```

Where the Project Overview says "finding 52 landmarks, finding 14 signposts", leave the numbers (they are true today) and do not add editor text there.

- [ ] **Step 6: Add a section to `docs/verification.md`**

Append a dated section "World editor: places (2026-11-20)" that lists, as done, the ten checks of Task 7 Step 8 and Steps 1 to 3 of this task, with the measured rebuild time.

- [ ] **Step 7: Final checks and commit**

```bash
npm run format:check
npm test
npm run build
git add CLAUDE.md docs/verification.md
git commit -m "Document the world editor and its verification"
```

If Step 1 to 3 needed a code fix, `git add` those files in the same commit and say what was fixed in the message.

---

## Self-review notes

- **Spec coverage:** dev-only page (Tasks 6, 7), moving every kind (3, 7), add/delete/rename and `pool`/`object` (3, 7), save with conflict refusal and file layout (5, 6, 7), rebuild with streamed log and tests (6, 7, 8), errors and warnings incl. journal and stale note (4, 6, 7), saves and deleted places (1), tests (1 to 5), docs (8). Added beyond the spec: Task 2, because two existing tests pin the number of places and would fail every rebuild after an add or delete.
- **Changed from the spec:** after a rebuild the page reloads on a fail as well as on a pass (the map files were rewritten either way), and keeps the log across the reload in session storage. The spec said `SAVE_VERSION` stays 6; it is 7 in the code now, and still does not change.
- **Names checked across tasks:** `createEditor`, `getPlace`, `listPlaces`, `movePlace(editor, ref, x, y, record)`, `addPlace(editor, kind, x, y, region)`, `deletePlace`, `setField`, `undo`, `redo`, `isDirty`, `markSaved`, `shapeErrors`, `checkPlaces(places, world)`, `writePlaces`, `gameLookups`, `loadPlaces`, `savePlaces`, `rebuild`, `createView`, `createPanel`, `editorServer`.
