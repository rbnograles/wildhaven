# World Editor (Objects) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the world editor, select, move, delete and place the map's trees, rocks, plants, buildings and props, saved in `assets/world/source/edits.json` and applied by `tools/build-map.py` on every rebuild.

**Architecture:** "Generate, then override". The script builds its objects as before, then drops the ones `edits.json` lists as `removed` and appends the ones it lists as `added`. The editor gets a pure module (`src/editor/edits.js`) for those two lists, a sharp view that draws the real tiles (cached per chunk) and sprites, and an Objects mode beside the existing Places mode. No game code changes: the game already reads everything from the map's object layer.

**Tech Stack:** Vanilla JS ES modules, Vite 7, Canvas 2D, `node:test`, Python 3 (numpy, Pillow). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-world-editor-objects-design.md`

## Global Constraints

- Follow `CLAUDE.md` "Code Style": Prettier, a comment directly above every named function in `src/` and `tests/`, a `//` header on every file, a `//` line above every `test(...)`, a `#` comment above every Python `def`.
- `src/editor/edits.js`, `model.js` and `lookups.js` are pure: no DOM, no image or CSS imports, and the words `document`, `window` and `import.meta` must not appear in them.
- No new npm packages. No game code changes (`src/data`, `src/world`, `src/actions`, `src/game`, `src/render`, `src/ui`, `src/core` stay as they are).
- Editable sprites: every `objects.json` entry except those with `path: true`, names ending `-stairs`, and `signpost`, `bridge`, `sea-wave`, `river-ripple`, `lake-ripple`. The same rule is written once in JS (`lockReason`) and once in Python (`editable`).
- `edits.json` positions are whole numbers in world units.
- Work in a git worktree on a branch named `world-editor-objects`. `git add` only the files a task names. The main checkout has the user's own uncommitted `places.json`: never touch it.
- After every task: `npm test` and `npm run format:check` pass.

## File Structure

| File | Responsibility |
| --- | --- |
| `assets/world/source/edits.json` (create) | The hand edits. Starts empty. |
| `src/editor/edits.js` (create) | Pure: the two lists, applying them to the map's objects, checks, the file writer. |
| `src/editor/model.js` (modify) | The undo history keeps places and edits together. |
| `src/editor/lookups.js` (modify) | Adds `objectLookups()`. |
| `tests/editor/edits.test.js` (create) | Tests for `edits.js`. |
| `tools/build-map.py` (modify) | Applies `edits.json`; writes the `staleEdits` map property. |
| `tests/world/edits.test.js` (create) | The built map agrees with `edits.json`. |
| `tools/editor-server.js` (replace) | One read/save route per file (`places`, `edits`). |
| `src/editor/api.js` (replace) | `loadFile`, `saveFile`, `rebuild`. |
| `src/editor/tiles.js` (create) | Chunk canvases of the tile layers. |
| `src/editor/sprites.js` (create) | Sprite pictures, drawing, alpha hit test, the object buckets. |
| `src/editor/palette.js` (create) | The sprite palette. |
| `src/editor/view.js`, `panel.js`, `main.js` (replace), `editor.html`, `editor.css` (modify) | Modes, the sharp view, object editing. |
| `CLAUDE.md`, `docs/verification.md` (modify) | Docs. |

An **object** everywhere in this plan is `{ name, x, y, rotation, own }`: `own` is true when it comes from `edits.added`, false when the script generated it.

---

### Task 0: Worktree

- [ ] **Step 1: Make the worktree and commit the spec and plan**

From the main checkout (`D:/Code/GameDev/game 1`), with the spec and plan still untracked there:

```bash
git fetch origin
git worktree add -b world-editor-objects .claude/worktrees/world-editor-objects origin/main
mv docs/superpowers/specs/2026-11-20-world-editor-objects-design.md .claude/worktrees/world-editor-objects/docs/superpowers/specs/
mv docs/superpowers/plans/2026-11-20-world-editor-objects.md .claude/worktrees/world-editor-objects/docs/superpowers/plans/
cd .claude/worktrees/world-editor-objects
npm ci
git add docs/superpowers/specs/2026-11-20-world-editor-objects-design.md docs/superpowers/plans/2026-11-20-world-editor-objects.md
git commit -m "Add the world editor (objects) spec and plan"
npm test
```

Expected: all tests pass. If `origin/main` does not contain `src/editor/` (the user's local merge was never pushed), base the worktree on local `main` instead.

---

### Task 1: The edits module

**Files:**
- Create: `src/editor/edits.js`, `tests/editor/edits.test.js`, `assets/world/source/edits.json`
- Modify: `src/editor/model.js` (`createEditor`, `remember`, `undo`, `redo`), `tests/boundaries.test.js`

**Interfaces:**
- Consumes: `remember(editor)` from `model.js` (exported by this task).
- Produces, from `src/editor/edits.js`:
  - `emptyEdits() -> { removed: [], added: [] }`
  - `lockReason(name, specs) -> string | null`
  - `landmarkLock(obj, places) -> string | null`
  - `baseObjects(mapObjects, builtEdits, builtStale) -> object[]` (the map as the script generated it, before any edit)
  - `applyEdits(base, edits) -> { objects: object[], stale: {name, x, y}[] }`
  - `loadEdits(editor, edits)`, `isEditsDirty(editor) -> boolean`, `markEditsSaved(editor)`
  - `addObject(editor, name, x, y) -> object`
  - `removeObjects(editor, objs)`
  - `moveObjects(editor, objs, dx, dy, record = true) -> object[]`
  - `dropStale(editor, stale)`
  - `shapeErrors(edits) -> string[]`
  - `checkEdits(edits, ctx) -> { level, message, object }[]` where `ctx = { specs, places, width, height, isBlocked(x, y), paths: {x, y}[], stale: {name, x, y}[] }`
  - `writeEdits(edits) -> string`
- `editor` gains `edits` and `savedEdits`; `editor.past` and `editor.future` entries become `{ places, edits }`.

- [ ] **Step 1: Create the empty edits file**

`assets/world/source/edits.json`, exactly:

```json
{
  "removed": [],
  "added": []
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/editor/edits.test.js`:

```js
// Checks the world editor's object edits: the "removed" and "added" lists, how they are laid
// over the map's own objects, the checks that warn about a badly placed object, and the writer
// of edits.json. These lists are replayed by the map build, so a wrong entry changes the world.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, undo } from '../../src/editor/model.js';
import {
  emptyEdits,
  lockReason,
  landmarkLock,
  baseObjects,
  applyEdits,
  loadEdits,
  isEditsDirty,
  markEditsSaved,
  addObject,
  removeObjects,
  moveObjects,
  dropStale,
  shapeErrors,
  checkEdits,
  writeEdits,
} from '../../src/editor/edits.js';

/** A tiny places file: the editor needs one, and the landmark owns the tent just north of it. */
const places = () => ({
  regions: [{ id: 'pinefall', key: 'P', name: 'Pinefall Woods' }],
  spawns: { scout: [100, 100] },
  supplies: {},
  landmarks: [{ id: 'p-camp', region: 'pinefall', name: 'Camp', x: 500, y: 560, object: 'tent' }],
  waypoints: [],
  wrecks: [],
});

/** The sprites the tests know: a solid tree, a walk-through flower, and three locked kinds. */
const specs = {
  pine: { kind: 'trees', origin: [0.5, 1], footprint: [18, 14] },
  flowers: { kind: 'plants', origin: [0.5, 0.6], flat: true, scale: 0.4 },
  tent: { kind: 'buildings', origin: [0.5, 1], footprint: [84, 65] },
  'path-dirt-a': { kind: 'props', origin: [0.5, 0.5], flat: true, path: true },
  'meadow-stairs': { kind: 'props', origin: [0.5, 1], flat: true },
  signpost: { kind: 'props', origin: [0.5, 1], footprint: [14, 10] },
};

/** The map's own objects, as the script generated them. */
const generated = () => [
  { name: 'pine', x: 10, y: 10, rotation: 0 },
  { name: 'pine', x: 50, y: 10, rotation: 0 },
  { name: 'flowers', x: 30, y: 40, rotation: 0 },
];

/** Starts an editor with the given edits already loaded from disk. */
const session = (edits = emptyEdits()) => {
  const editor = createEditor(places());
  loadEdits(editor, edits);
  return editor;
};

/** The name and position of each object, as short text, so lists are easy to compare. */
const spots = (objects) => objects.map((o) => `${o.name}@${o.x},${o.y}${o.own ? '*' : ''}`);

// Guards the lock list: path pieces, stairs and signposts are made by other parts of the build,
// and the tent of a landmark moves with its landmark, so none of them may be edited here.
test('locked sprites are named with a reason, and editable ones are not', () => {
  assert.equal(lockReason('pine', specs), null);
  assert.equal(lockReason('flowers', specs), null);
  assert.match(lockReason('path-dirt-a', specs), /path/i);
  assert.match(lockReason('meadow-stairs', specs), /stairs/i);
  assert.match(lockReason('signpost', specs), /Places/);
  assert.match(lockReason('dragon', specs), /no sprite/);

  assert.match(landmarkLock({ name: 'tent', x: 500, y: 500 }, places()), /landmark/);
  assert.equal(landmarkLock({ name: 'tent', x: 600, y: 500 }, places()), null);
});

// Guards the picture the editor shows: removed objects vanish, added ones appear marked as the
// person's own, and a removal that matches nothing is reported instead of silently ignored.
test('applyEdits hides removed objects, appends added ones and reports stale removals', () => {
  const edits = {
    removed: [
      { name: 'pine', x: 10, y: 10 },
      { name: 'pine', x: 999, y: 999 },
    ],
    added: [{ name: 'pine', x: 70, y: 70 }],
  };
  const { objects, stale } = applyEdits(generated(), edits);

  assert.deepEqual(spots(objects), ['pine@50,10', 'flowers@30,40', 'pine@70,70*']);
  assert.deepEqual(stale, [{ name: 'pine', x: 999, y: 999 }]);
});

// Guards the editor after a rebuild: the built map already has the added objects and lacks the
// removed ones, so the generated base must be worked back out, or a deleted hand-placed tree
// would reappear and an un-removed tree could never come back.
test('baseObjects works the generated map back out of a map that already has the edits', () => {
  const built = {
    removed: [
      { name: 'pine', x: 10, y: 10 },
      { name: 'pine', x: 999, y: 999 },
    ],
    added: [{ name: 'pine', x: 70, y: 70 }],
  };
  const rebuilt = [
    { name: 'pine', x: 50, y: 10, rotation: 0 },
    { name: 'flowers', x: 30, y: 40, rotation: 0 },
    { name: 'pine', x: 70, y: 70, rotation: 0 },
  ];
  const stale = [{ name: 'pine', x: 999, y: 999 }];

  assert.deepEqual(spots(baseObjects(rebuilt, built, stale)), [
    'pine@50,10',
    'flowers@30,40',
    'pine@10,10',
  ]);
  // A map that was not rebuilt yet still has everything: nothing is doubled.
  assert.deepEqual(spots(baseObjects(generated(), built, stale)), [
    'pine@10,10',
    'pine@50,10',
    'flowers@30,40',
  ]);
});

// Guards deleting: a generated object needs a "removed" entry, but a hand-placed one is simply
// taken off the "added" list, so the file never grows entries that cancel out.
test('removing a generated object records it, removing a hand-placed one just forgets it', () => {
  const editor = session();
  const mine = addObject(editor, 'pine', 70.4, 70.6);
  assert.deepEqual(mine, { name: 'pine', x: 70, y: 71, rotation: 0, own: true });

  removeObjects(editor, [mine, { name: 'pine', x: 10, y: 10, rotation: 0, own: false }]);
  assert.deepEqual(editor.edits, { removed: [{ name: 'pine', x: 10, y: 10 }], added: [] });
});

// Guards moving: a generated object becomes one removal plus one addition, a hand-placed one
// only changes its own entry, and dragging a tree back to where it grew leaves no trace.
test('moving a generated object is a removal and an addition, and moving it back cancels both', () => {
  const editor = session();
  const tree = { name: 'pine', x: 10, y: 10, rotation: 0, own: false };

  const [moved] = moveObjects(editor, [tree], 5, 0);
  assert.deepEqual(editor.edits, {
    removed: [{ name: 'pine', x: 10, y: 10 }],
    added: [{ name: 'pine', x: 15, y: 10 }],
  });
  assert.equal(moved.own, true);

  const [again] = moveObjects(editor, [moved], 5, 5, false);
  assert.deepEqual(editor.edits.added, [{ name: 'pine', x: 20, y: 15 }]);
  assert.equal(editor.edits.removed.length, 1);

  const [home] = moveObjects(editor, [again], -10, -5, false);
  assert.deepEqual(editor.edits, emptyEdits());
  assert.equal(home.own, false);
});

// Guards undo: object edits share the history with place edits, and a drag is one step however
// many mouse moves it took.
test('object edits can be undone, and a drag is one undo step', () => {
  const editor = session();
  const tree = { name: 'pine', x: 10, y: 10, rotation: 0, own: false };

  const [a] = moveObjects(editor, [tree], 1, 0, true);
  moveObjects(editor, [a], 1, 0, false);
  assert.equal(editor.past.length, 1);

  assert.equal(undo(editor), true);
  assert.deepEqual(editor.edits, emptyEdits());
  assert.deepEqual(editor.places, places());
});

// Guards the Save button: dirty means the edits differ from the file on disk.
test('edits are dirty only while they differ from what was last saved', () => {
  const editor = session();
  assert.equal(isEditsDirty(editor), false);
  addObject(editor, 'pine', 1, 1);
  assert.equal(isEditsDirty(editor), true);
  markEditsSaved(editor);
  assert.equal(isEditsDirty(editor), false);
});

// Guards the cleanup button: only the entries named stale go, the rest stay.
test('dropStale removes exactly the stale removals', () => {
  const editor = session({
    removed: [
      { name: 'pine', x: 10, y: 10 },
      { name: 'pine', x: 999, y: 999 },
    ],
    added: [],
  });
  dropStale(editor, [{ name: 'pine', x: 999, y: 999 }]);
  assert.deepEqual(editor.edits.removed, [{ name: 'pine', x: 10, y: 10 }]);
});

// Guards the server's last check before writing the file.
test('shapeErrors accepts the file shape and rejects anything else', () => {
  assert.deepEqual(shapeErrors(emptyEdits()), []);
  assert.deepEqual(shapeErrors({ removed: [], added: [{ name: 'pine', x: 1, y: 2 }] }), []);
  assert.notDeepEqual(shapeErrors(null), []);
  assert.notDeepEqual(shapeErrors({ removed: [] }), []);
  assert.notDeepEqual(shapeErrors({ removed: [], added: [{ name: 'pine', x: 1.5, y: 2 }] }), []);
  assert.notDeepEqual(shapeErrors({ removed: [], added: [{ name: 'pine', x: 1, y: 2, z: 3 }] }), []);
});

/** The facts `checkEdits` needs, with dry open ground everywhere unless a test says otherwise. */
const ctx = (over = {}) => ({
  specs,
  places: places(),
  width: 1000,
  height: 1000,
  // No spot is water or cliff.
  isBlocked: () => false,
  paths: [],
  stale: [],
  ...over,
});

/** Runs the checks on some added objects and gives the messages of one level. */
const found = (added, level, over) =>
  checkEdits({ removed: [], added }, ctx(over))
    .filter((p) => p.level === level)
    .map((p) => p.message);

// Guards the errors that block Save: these would make the map build stop.
test('checkEdits reports errors for locked sprites, spots off the map and doubled objects', () => {
  assert.deepEqual(checkEdits(emptyEdits(), ctx()), []);
  assert.match(found([{ name: 'signpost', x: 300, y: 300 }], 'error')[0], /can't be placed/);
  assert.match(found([{ name: 'pine', x: -5, y: 300 }], 'error')[0], /outside the world/);
  assert.match(
    found(
      [
        { name: 'pine', x: 300, y: 300 },
        { name: 'pine', x: 300, y: 300 },
      ],
      'error',
    )[0],
    /twice/,
  );
  assert.match(
    checkEdits({ removed: [{ name: 'signpost', x: 1, y: 1 }], added: [] }, ctx())[0].message,
    /can't be removed/,
  );
});

// Guards the warnings: a solid thing in a bad spot is flagged, a walk-through flower is not.
test('checkEdits warns about solid objects on blocked ground, on a path or beside a place', () => {
  const tree = [{ name: 'pine', x: 300, y: 300 }];
  const flower = [{ name: 'flowers', x: 300, y: 300 }];

  assert.deepEqual(found(tree, 'warning'), []);
  assert.match(found(tree, 'warning', { isBlocked: () => true })[0], /water or a cliff/);
  assert.match(found(tree, 'warning', { paths: [{ x: 310, y: 290 }] })[0], /footpath/);
  assert.match(found([{ name: 'pine', x: 150, y: 150 }], 'warning')[0], /close to a place/);
  assert.deepEqual(found(flower, 'warning', { isBlocked: () => true, paths: [{ x: 300, y: 300 }] }), []);
  assert.match(
    checkEdits(emptyEdits(), ctx({ stale: [{ name: 'pine', x: 9, y: 9 }] }))[0].message,
    /matches nothing/,
  );
});

// Guards the git diff: one object per line in a fixed order, and text that parses back.
test('writeEdits sorts by position, writes one object per line and parses back', () => {
  const edits = {
    removed: [],
    added: [
      { name: 'pine', x: 50, y: 20 },
      { name: 'flowers', x: 10, y: 20 },
      { name: 'pine', x: 99, y: 5 },
    ],
  };
  const text = writeEdits(edits);

  assert.equal(
    text,
    [
      '{',
      '  "removed": [],',
      '  "added": [',
      '    { "name": "pine", "x": 99, "y": 5 },',
      '    { "name": "flowers", "x": 10, "y": 20 },',
      '    { "name": "pine", "x": 50, "y": 20 }',
      '  ]',
      '}',
      '',
    ].join('\n'),
  );
  assert.deepEqual(JSON.parse(text).added.length, 3);
  assert.equal(writeEdits(emptyEdits()), '{\n  "removed": [],\n  "added": []\n}\n');
});
```

- [ ] **Step 3: Run and see them fail**

Run: `node --test tests/editor/edits.test.js`
Expected: FAIL, cannot find `src/editor/edits.js`.

- [ ] **Step 4: Change the history in `src/editor/model.js`**

Replace `createEditor`'s body, export `remember`, and replace `undo` and `redo`. Keep each function's existing comment, changing only the sentences that are no longer true (the session now also holds `edits`, and a history step is `{places, edits}`).

```js
export function createEditor(places) {
  return {
    places: copy(places),
    edits: { removed: [], added: [] },
    past: [],
    future: [],
    saved: writePlaces(places),
    savedEdits: '',
  };
}
```

```js
export function remember(editor) {
  editor.past.push(copy({ places: editor.places, edits: editor.edits }));
  if (editor.past.length > HISTORY) editor.past.shift();
  editor.future = [];
}
```

```js
export function undo(editor) {
  if (!editor.past.length) return false;
  editor.future.push({ places: editor.places, edits: editor.edits });
  ({ places: editor.places, edits: editor.edits } = editor.past.pop());
  return true;
}
```

```js
export function redo(editor) {
  if (!editor.future.length) return false;
  editor.past.push({ places: editor.places, edits: editor.edits });
  ({ places: editor.places, edits: editor.edits } = editor.future.pop());
  return true;
}
```

- [ ] **Step 5: Write `src/editor/edits.js`**

```js
// The world editor's object edits: which of the map's generated objects were removed by hand
// and which objects were placed by hand. tools/build-map.py replays these two lists on every
// build. This file also lays them over the map for the editor's own picture, checks them, and
// writes them back as the text of edits.json. It knows nothing about the page.

import { remember } from './model.js';

/** Sprites other parts of the map build own, so they can't be edited as loose objects. */
const LOCKED = {
  signpost: 'Signposts are moved in Places mode',
  bridge: 'Bridges belong to their river crossing',
  'sea-wave': 'Water ripples are scattered by the map build',
  'river-ripple': 'Water ripples are scattered by the map build',
  'lake-ripple': 'Water ripples are scattered by the map build',
};

/** How far north of a landmark its `object` sprite stands (the same 60 as in build-map.py). */
const LANDMARK_NORTH = 60;

/** A solid hand-placed object this close to a place gets a warning (the build keeps 150 clear). */
const PLACE_CLEAR = 150;

/** A solid base within this many units of the middle of a path piece counts as on the path. */
const PATH_CLEAR = 45;

/** Makes an edits object with nothing in it. */
export const emptyEdits = () => ({ removed: [], added: [] });

/** Says whether two entries are the same sprite at the same spot. */
const same = (a, b) => a.name === b.name && a.x === b.x && a.y === b.y;

/** Turns an entry into one piece of text, so entries can be looked up quickly in a Set. */
const keyOf = (o) => `${o.name}|${o.x}|${o.y}`;

/** Keeps only the three fields the file stores. */
const entry = (o) => ({ name: o.name, x: o.x, y: o.y });

/**
 * Says why a sprite can't be edited as a loose object, if it can't.
 *
 * @param {string} name - The sprite's name.
 * @param {object} specs - The sprites of objects.json, by name.
 * @returns {string|null} The reason in plain words, or null when the sprite is editable.
 */
export function lockReason(name, specs) {
  const spec = specs[name];
  if (!spec) return `There is no sprite called "${name}"`;
  if (spec.path) return 'Path pieces are laid by the map build';
  if (name.endsWith('-stairs')) return 'Hill stairs belong to their hill';
  return LOCKED[name] ?? null;
}

/**
 * Says whether an object is the sprite a landmark placed, which moves with its landmark.
 *
 * @param {{name: string, x: number, y: number}} obj - The object.
 * @param {object} places - The places file.
 * @returns {string|null} The reason it is locked, or null.
 */
export function landmarkLock(obj, places) {
  const owned = places.landmarks.some(
    (l) => l.object === obj.name && l.x === obj.x && l.y - LANDMARK_NORTH === obj.y,
  );
  return owned ? 'This belongs to a landmark: move the landmark in Places mode' : null;
}

/**
 * Works out the map's objects as the script generated them, before any hand edit.
 *
 * After a rebuild the map file already has the added objects in it and lacks the removed ones.
 * The editor needs the untouched list underneath, like the pencil drawing under the ink, so
 * that deleting a hand-placed tree really makes it go and un-removing a tree brings it back.
 *
 * @param {object[]} mapObjects - The objects in the map file (`name`, `x`, `y`, `rotation`).
 * @param {object} builtEdits - The edits file as it was when the page loaded.
 * @param {object[]} builtStale - Removals the last build said matched nothing.
 * @returns {object[]} The generated objects, each `{name, x, y, rotation, own: false}`.
 */
export function baseObjects(mapObjects, builtEdits, builtStale) {
  // Take out one map object per added entry (the build put it there).
  const extra = new Map();
  for (const a of builtEdits.added) extra.set(keyOf(a), (extra.get(keyOf(a)) ?? 0) + 1);

  const base = [];
  for (const o of mapObjects) {
    const key = keyOf(o);
    if (extra.get(key) > 0) extra.set(key, extra.get(key) - 1);
    else base.push({ name: o.name, x: o.x, y: o.y, rotation: o.rotation ?? 0, own: false });
  }

  // Put back what the build left out, unless it is still there or never matched anything.
  const present = new Set(base.map(keyOf));
  const stale = new Set(builtStale.map(keyOf));
  for (const r of builtEdits.removed)
    if (!present.has(keyOf(r)) && !stale.has(keyOf(r)))
      base.push({ ...entry(r), rotation: 0, own: false });

  return base;
}

/**
 * Lays the edits over the generated objects, the same way the map build does.
 *
 * @param {object[]} base - The generated objects, from `baseObjects`.
 * @param {object} edits - The edits being made.
 * @returns {{objects: object[], stale: object[]}} What the map will hold, and the removals that
 *   match no generated object.
 */
export function applyEdits(base, edits) {
  const gone = new Set(edits.removed.map(keyOf));
  const present = new Set(base.map(keyOf));

  return {
    objects: [
      ...base.filter((o) => !gone.has(keyOf(o))),
      ...edits.added.map((a) => ({ ...entry(a), rotation: 0, own: true })),
    ],
    stale: edits.removed.filter((r) => !present.has(keyOf(r))).map(entry),
  };
}

/**
 * Puts the edits read from disk into an editing session.
 *
 * @param {object} editor - The editing session from `createEditor`.
 * @param {object} edits - The parsed edits file.
 */
export function loadEdits(editor, edits) {
  editor.edits = structuredClone(edits);
  editor.savedEdits = writeEdits(edits);
}

/** Says whether the edits differ from the text that was last saved. */
export const isEditsDirty = (editor) => writeEdits(editor.edits) !== editor.savedEdits;

/**
 * Notes that the edits as they are now have been saved.
 *
 * @param {object} editor - The editing session.
 */
export function markEditsSaved(editor) {
  editor.savedEdits = writeEdits(editor.edits);
}

/**
 * Records that an object now stands at a spot.
 *
 * If that exact object was removed from that exact spot earlier, the two cancel out: the
 * removal is dropped and nothing is added, so the tree is simply the generated one again.
 *
 * @param {object} edits - The edits being made.
 * @param {{name: string, x: number, y: number}} at - The sprite and its spot.
 * @returns {object} The object as it now is, `own` false when the entries cancelled.
 */
function put(edits, at) {
  const i = edits.removed.findIndex((r) => same(r, at));
  if (i >= 0) {
    edits.removed.splice(i, 1);
    return { ...at, rotation: 0, own: false };
  }
  edits.added.push(at);
  return { ...at, rotation: 0, own: true };
}

/**
 * Takes an object off the map: a hand-placed one is forgotten, a generated one is recorded as removed.
 *
 * @param {object} edits - The edits being made.
 * @param {object} obj - The object.
 */
function take(edits, obj) {
  if (!obj.own) return void edits.removed.push(entry(obj));
  const i = edits.added.findIndex((a) => same(a, obj));
  if (i >= 0) edits.added.splice(i, 1);
}

/**
 * Places a new object by hand.
 *
 * @param {object} editor - The editing session.
 * @param {string} name - The sprite's name.
 * @param {number} x - Where it goes, in world units.
 * @param {number} y - Where it goes, in world units.
 * @returns {object} The new object.
 */
export function addObject(editor, name, x, y) {
  remember(editor);
  return put(editor.edits, { name, x: Math.round(x), y: Math.round(y) });
}

/**
 * Deletes objects.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} objs - The objects to delete.
 */
export function removeObjects(editor, objs) {
  remember(editor);
  for (const obj of objs) take(editor.edits, obj);
}

/**
 * Moves objects by the same amount.
 *
 * A generated object that moves becomes a removal at its old spot and an addition at the new
 * one. A hand-placed object only changes its own entry.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} objs - The objects to move.
 * @param {number} dx - How far east, in world units.
 * @param {number} dy - How far south, in world units.
 * @param {boolean} [record] - False for the later moves of one drag, so the drag is one undo step.
 * @returns {object[]} The same objects as they are after the move, to keep as the selection.
 */
export function moveObjects(editor, objs, dx, dy, record = true) {
  if (record) remember(editor);

  // Lift every object first, then set them all down, so two objects of a group never cancel
  // against each other's old spot half way through.
  for (const obj of objs) take(editor.edits, obj);
  return objs.map((obj) =>
    put(editor.edits, { name: obj.name, x: Math.round(obj.x + dx), y: Math.round(obj.y + dy) }),
  );
}

/**
 * Drops removals that match nothing on the map any more.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} stale - The stale removals, from `applyEdits`.
 */
export function dropStale(editor, stale) {
  remember(editor);
  editor.edits.removed = editor.edits.removed.filter((r) => !stale.some((s) => same(s, r)));
}

/**
 * Checks that an object has the shape of the edits file, before it is written to disk.
 *
 * @param {*} edits - What a request sent.
 * @returns {string[]} One message per thing that is wrong; empty when the shape is right.
 */
export function shapeErrors(edits) {
  if (typeof edits !== 'object' || edits === null || Array.isArray(edits))
    return ['The edits must be an object'];
  const errors = [];

  for (const list of ['removed', 'added']) {
    if (!Array.isArray(edits[list])) {
      errors.push(`"${list}" must be a list`);
      continue;
    }

    edits[list].forEach((o, i) => {
      const ok =
        typeof o === 'object' &&
        o !== null &&
        Object.keys(o).length === 3 &&
        typeof o.name === 'string' &&
        Number.isSafeInteger(o.x) &&
        Number.isSafeInteger(o.y);
      if (!ok) errors.push(`${list}[${i}] must be { name, x, y } with whole numbers`);
    });
  }

  return errors;
}

/**
 * Lists every spot in the places file where the player must be able to stand.
 *
 * @param {object} places - The places file.
 * @returns {{x: number, y: number}[]} Spawns, supplies, landmarks, signposts and old boats.
 */
function placePoints(places) {
  const pairs = [...Object.values(places.spawns), ...Object.values(places.supplies)];
  return [
    ...pairs.map(([x, y]) => ({ x, y })),
    ...places.landmarks,
    ...places.waypoints,
    ...places.wrecks,
  ];
}

/**
 * Looks over the edits and lists everything the person should know about.
 *
 * An error is something the map build would stop on, so Save is refused while one stands. A
 * warning is a hand-placed solid object in a spot that looks wrong on the map as it was last
 * built; the rebuild's tests are the real judge.
 *
 * @param {object} edits - The edits being made.
 * @param {object} ctx - Facts about the game: `specs` (objects.json), `places`, `width`,
 *   `height`, `isBlocked(x, y)` (water, cliff or stairs), `paths` (the middle of each path
 *   piece) and `stale` (removals that match nothing).
 * @returns {{level: string, message: string, object: object|null}[]} The problems.
 */
export function checkEdits(edits, ctx) {
  const found = [];
  const points = placePoints(ctx.places);
  const seen = new Set();

  /** Adds one problem to the list. */
  const add = (level, message, object) => found.push({ level, message, object });

  for (const a of edits.added) {
    const where = `${a.name} at ${a.x}, ${a.y}`;
    const why = lockReason(a.name, ctx.specs) ?? landmarkLock(a, ctx.places);

    // Errors: the map build would stop on these.
    if (why) {
      add('error', `${a.name} can't be placed by hand: ${why}`, a);
      continue;
    }
    if (a.x < 0 || a.y < 0 || a.x > ctx.width || a.y > ctx.height) {
      add('error', `${where} is outside the world`, a);
      continue;
    }
    if (seen.has(keyOf(a))) add('error', `${where} is placed twice`, a);
    seen.add(keyOf(a));

    // Warnings only make sense for something the player bumps into.
    const spec = ctx.specs[a.name];
    if (!spec.footprint) continue;
    const half = spec.footprint[0] * (spec.scale ?? 1);

    if (ctx.isBlocked(a.x, a.y)) add('warning', `${where} stands on water or a cliff`, a);
    if (ctx.paths.some((p) => Math.abs(p.x - a.x) < half + PATH_CLEAR && Math.abs(p.y - a.y) < PATH_CLEAR))
      add('warning', `${where} stands on a footpath`, a);
    if (points.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < PLACE_CLEAR))
      add('warning', `${where} is very close to a place the player has to reach`, a);
  }

  for (const r of edits.removed) {
    const why = lockReason(r.name, ctx.specs);
    if (why) add('error', `${r.name} can't be removed by hand: ${why}`, null);
  }

  for (const s of ctx.stale)
    add('warning', `The removed ${s.name} at ${s.x}, ${s.y} matches nothing on the map any more`, null);

  return found;
}

/**
 * Writes one list of the file, one object per line, sorted so the order never depends on the
 * order the edits were made in.
 *
 * @param {string} name - 'removed' or 'added'.
 * @param {object[]} list - The entries.
 * @returns {string} The list as text, with no comma after it.
 */
function block(name, list) {
  if (!list.length) return `  "${name}": []`;

  const sorted = [...list].sort(
    (a, b) => a.y - b.y || a.x - b.x || (a.name > b.name) - (a.name < b.name),
  );
  const lines = sorted.map(
    (o) => `    { "name": ${JSON.stringify(o.name)}, "x": ${o.x}, "y": ${o.y} }`,
  );
  return `  "${name}": [\n${lines.join(',\n')}\n  ]`;
}

/**
 * Turns the edits into the text of edits.json.
 *
 * One object per line in a fixed order, so a git diff shows only the objects that changed.
 *
 * @param {object} edits - The edits being made.
 * @returns {string} The file's text, ending with a newline.
 */
export function writeEdits(edits) {
  return `{\n${block('removed', edits.removed)},\n${block('added', edits.added)}\n}\n`;
}
```

- [ ] **Step 6: Add `edits.js` to the boundary test**

In `tests/boundaries.test.js`, add `'editor/edits.js',` after `'editor/lookups.js',` in `PURE`.

- [ ] **Step 7: Run the tests, format, commit**

Run: `node --test tests/editor/ tests/boundaries.test.js tests/comments.test.js` (name the files if a folder argument is refused: `tests/editor/edits.test.js tests/editor/model.test.js`).
Expected: PASS.

```bash
npm run format
npm test
git add assets/world/source/edits.json src/editor/edits.js src/editor/model.js tests/editor/edits.test.js tests/boundaries.test.js
git commit -m "Add the world editor's object edits: removed and added lists"
```

---

### Task 2: The map build applies the edits

**Files:**
- Modify: `tools/build-map.py` (after the line that builds `path_objects`, before `tiled = {`; the `properties` list; the final `print`)
- Create: `tests/world/edits.test.js`
- Modify: `src/editor/lookups.js`
- Regenerated: `assets/world/map/wildhaven.json`

**Interfaces:**
- Produces: map property `staleEdits` (a JSON string: a list of `{name, x, y}`); `objectLookups()` from `src/editor/lookups.js` returning `{ specs, width, height, isBlocked(x, y), paths, builtStale, tags(name) }`.

- [ ] **Step 1: Write the failing world test**

Create `tests/world/edits.test.js`:

```js
// Checks that the built map agrees with assets/world/source/edits.json: every object placed by
// hand is in the map and every object removed by hand is not. It fails when someone changes the
// edits file and forgets to run tools/build-map.py.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import EDITS from '../../assets/world/source/edits.json' with { type: 'json' };
import { MAP_OBJECTS, mapProperty } from '../../src/world/map.js';

/** One piece of text per object, so lists can be compared as sets. */
const keyOf = (o) => `${o.name}|${o.x}|${o.y}`;

// Guards against a stale map: the edits file and the map file must tell the same story.
test('the built map holds every added object and none of the removed ones', () => {
  const inMap = new Set(MAP_OBJECTS.map(keyOf));
  const added = new Set(EDITS.added.map(keyOf));

  for (const a of EDITS.added) assert.ok(inMap.has(keyOf(a)), `${keyOf(a)} is not in the map`);
  for (const r of EDITS.removed)
    assert.ok(added.has(keyOf(r)) || !inMap.has(keyOf(r)), `${keyOf(r)} is still in the map`);
});

// Guards the editor's cleanup list: the build must say which removals matched nothing.
test('the map file lists its stale edits', () => {
  assert.ok(Array.isArray(JSON.parse(mapProperty('staleEdits'))));
});
```

- [ ] **Step 2: Run and see the second test fail**

Run: `node --test tests/world/edits.test.js`
Expected: the first passes (the file is empty), the second FAILS: the map has no `staleEdits` property yet.

- [ ] **Step 3: Add the apply step to `tools/build-map.py`**

Directly after the `path_objects = [...]` line and before `tiled = {`:

```python
# ---- hand edits --------------------------------------------------------------------------
# assets/world/source/edits.json holds what a person changed in the world editor: generated objects to leave out
# ("removed") and objects placed by hand ("added"), in WORLD units. It is applied here, after every pass above has
# run, so an edit can never reshuffle the rest of the map. Nothing is cleared around an added object on purpose:
# the person deletes what is in the way, so there are no surprises.
EDIT_LOCKED = {'signpost', 'bridge', 'sea-wave', 'river-ripple', 'lake-ripple'}

# Says whether a sprite may be named in edits.json. Path pieces, hill stairs, ripples, signposts and bridges are
# made by other parts of this script and may not. (The editor has the same rule: lockReason in src/editor/edits.js.)
def editable(n): return n in spec and not spec[n].get('path') and not n.endswith('-stairs') and n not in EDIT_LOCKED

# Reads one list of edits.json as (name, x, y) rows. A wrong entry stops the build with a plain message.
def edit_rows(edits, key):
    rows = edits.get(key, []) if isinstance(edits, dict) else None
    if not isinstance(rows, list): sys.exit(f'edits.json: "{key}" must be a list')
    for r in rows:
        if not (isinstance(r, dict) and isinstance(r.get('name'), str) and type(r.get('x')) is int and type(r.get('y')) is int):
            sys.exit(f'edits.json: bad entry in "{key}": {r}')
        if not editable(r['name']): sys.exit(f'edits.json: "{r["name"]}" in "{key}" is not a sprite that can be edited by hand')
    return [(r['name'], r['x'], r['y']) for r in rows]

edits_path = os.path.join(SRC, 'edits.json')
try: edits = json.load(open(edits_path, encoding='utf-8')) if os.path.exists(edits_path) else {}
except ValueError as e: sys.exit(f'edits.json is not valid JSON: {e}')
removed, added = set(edit_rows(edits, 'removed')), edit_rows(edits, 'added')
# A removal that matches no generated object is "stale": the editor lists these so they can be cleaned up.
stale_edits = sorted(removed - set(objects))
objects = [o for o in objects if o not in removed] + added
```

In the `'properties': [...]` list, after the `elevation` entry, add:

```python
                   # The world editor reads this to list removals in edits.json that matched nothing.
                   {'name': 'staleEdits', 'type': 'string', 'value': json.dumps([{'name': n, 'x': x, 'y': y} for n, x, y in stale_edits])}],
```

(move the closing `],` from the `elevation` line to this new line).

After the script's final `print(...)` statement, add:

```python
print(len(removed) - len(stale_edits), 'objects removed by hand,', len(added), 'added by hand,', len(stale_edits), 'stale edits', stale_edits or '')
```

- [ ] **Step 4: Rebuild with no edits and check what changed**

Run: `python tools/build-map.py`
Expected: the last line reads `0 objects removed by hand, 0 added by hand, 0 stale edits`.

Run: `git status --short assets/world/map`
Expected: only `wildhaven.json` is modified (it gained the `staleEdits` property). `tileset.png` and `overview.webp` are unchanged.

Run: `git diff --stat assets/world/map/wildhaven.json` and confirm with:

```bash
node -e "const m=require('./assets/world/map/wildhaven.json');console.log(m.layers.at(-1).objects.length, m.properties.at(-1))"
```

Expected: the same object count as before (9012 at the time of writing) and `{ name: 'staleEdits', type: 'string', value: '[]' }`.

- [ ] **Step 5: Prove an edit lands, then undo it**

Pick a real generated pine and a stale spot:

```bash
node -e "
const fs=require('fs');const m=require('./assets/world/map/wildhaven.json');
const pine=m.layers.at(-1).objects.find(o=>o.name==='pine');
fs.writeFileSync('assets/world/source/edits.json', JSON.stringify({removed:[{name:'pine',x:pine.x,y:pine.y},{name:'pine',x:1,y:1}],added:[{name:'big-oak',x:pine.x+40,y:pine.y}]}));
console.log(pine.x,pine.y)"
python tools/build-map.py
node --test tests/world/edits.test.js tests/world/places.test.js tests/world/map.test.js
```

Expected: the script prints `1 objects removed by hand, 1 added by hand, 1 stale edits [('pine', 1, 1)]`, and the tests pass. Then check a bad file stops the build cleanly:

```bash
node -e "require('fs').writeFileSync('assets/world/source/edits.json', JSON.stringify({removed:[],added:[{name:'signpost',x:5000,y:5000}]}))"
python tools/build-map.py
```

Expected: one line, `edits.json: "signpost" in "added" is not a sprite that can be edited by hand`, and no traceback.

Restore and rebuild:

```bash
git checkout assets/world/source/edits.json
python tools/build-map.py
git status --short assets/world
```

Expected: only `assets/world/map/wildhaven.json` modified.

- [ ] **Step 6: Add `objectLookups` to `src/editor/lookups.js`**

Add to the imports: `isDryLand, hitsCliff, elevationAt, MAP_OBJECTS, mapProperty` from `'../world/map.js'`, and `import { WILD, HARVEST } from '../data/supplies.js';`. Then add:

```js
/**
 * Reads the removals the last map build said matched nothing.
 *
 * @returns {{name: string, x: number, y: number}[]} The stale removals; none if the map is older
 *   than this feature.
 */
function builtStale() {
  try {
    return JSON.parse(mapProperty('staleEdits'));
  } catch {
    return [];
  }
}

/**
 * Builds the facts the object editor reads, from the game's own modules.
 *
 * @returns {object} `specs` (the sprites of objects.json), `width`, `height`, `isBlocked(x, y)`
 *   (water, a cliff or stairs), `paths` (the middle of each path piece), `builtStale`, and
 *   `tags(name)` (what the game does with a sprite: 'solid', 'chop or mine', 'pick up').
 */
export function objectLookups() {
  const specs = Object.fromEntries(
    Object.entries(OBJECT_SPECS).filter(([name]) => !name.startsWith('_')),
  );

  return {
    specs,
    width: WORLD.width,
    height: WORLD.height,
    // Water, a cliff wall or edge, or a flight of stairs: no place for something solid.
    isBlocked: (x, y) => !isDryLand(x, y) || hitsCliff(x, y) || elevationAt(x, y) === 's',
    paths: MAP_OBJECTS.filter((o) => specs[o.name]?.path).map(({ x, y }) => ({ x, y })),
    builtStale: builtStale(),
    // What the game does with a sprite, in a few words for the side panel.
    tags: (name) =>
      [
        specs[name]?.footprint && 'solid',
        HARVEST[name] && 'chop or mine',
        WILD[name] && 'pick up',
      ].filter(Boolean),
  };
}
```

- [ ] **Step 7: Run everything, commit**

```bash
npm run format
npm test
git add tools/build-map.py tests/world/edits.test.js src/editor/lookups.js assets/world/map/wildhaven.json
git commit -m "Apply hand edits to the map's objects when the map is built"
```

---

### Task 3: Server and API for two files

**Files:**
- Modify: `tools/editor-server.js`
- Replace: `src/editor/api.js`

**Interfaces:**
- Produces (HTTP): `GET /__editor/places`, `GET /__editor/edits` → `{ text, hash, stale }`; `POST` to the same paths with `{ data, hash }` → `{ hash, stale }` | 409 `{ error: 'conflict' }` | 400. `POST /__editor/rebuild` unchanged.
- Produces (`api.js`): `loadFile(name) -> Promise<{text, hash, stale}>`, `saveFile(name, data, hash) -> Promise<{ok: true, hash, stale} | {ok: false, conflict: true}>`, `rebuild(onText) -> Promise<boolean>`; `name` is `'places'` or `'edits'`.

- [ ] **Step 1: Change `tools/editor-server.js`**

Change the model import and add the edits one:

```js
import { shapeErrors as placesShape, writePlaces } from '../src/editor/model.js';
import { shapeErrors as editsShape, writeEdits } from '../src/editor/edits.js';
```

Replace the `PLACES` constant with a table of the files the editor may read and write:

```js
/**
 * The files the editor may read and save, by the name used in the URL. `path` is inside the
 * project folder, `shape` lists what is wrong with a request's data, `write` turns the data into
 * the file's text, and `empty` is the text used when the file does not exist yet.
 */
const FILES = {
  places: { path: 'assets/world/source/places.json', shape: placesShape, write: writePlaces },
  edits: {
    path: 'assets/world/source/edits.json',
    shape: editsShape,
    write: writeEdits,
    empty: '{\n  "removed": [],\n  "added": []\n}\n',
  },
};
```

Replace `readPlaces` with:

```js
/**
 * Reads one of the editor's files from disk.
 *
 * @param {string} root - The project folder.
 * @param {string} name - 'places' or 'edits'.
 * @returns {{text: string, hash: string, crlf: boolean}} The text with plain newlines, its
 *   fingerprint, and whether the file on disk uses Windows line endings.
 */
function readFile(root, name) {
  const file = FILES[name];
  let raw;
  try {
    raw = readFileSync(join(root, file.path), 'utf8');
  } catch (error) {
    if (file.empty === undefined) throw error;
    raw = file.empty;
  }
  const text = raw.replaceAll('\r\n', '\n');
  return { text, hash: hashOf(text), crlf: raw.includes('\r\n') };
}

/** One fingerprint for everything the map is built from: the places and the edits together. */
const sourceHash = (root) => hashOf(readFile(root, 'places').hash + readFile(root, 'edits').hash);
```

In `isStale` and `markBuilt`, replace `readPlaces(root).hash` with `sourceHash(root)`, and reword their comments from "the places file" to "the places and the edits".

Replace `save` with a version that takes the file's name:

```js
  /**
   * Saves the data a request sent, unless the file changed on disk since the page loaded it.
   *
   * @param {object} req - The request, whose body is `{data, hash}`.
   * @param {object} res - The response.
   * @param {string} name - 'places' or 'edits'.
   */
  async function save(req, res, name) {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      return send(res, 400, { error: error.message });
    }

    const file = FILES[name];
    const errors = file.shape(body?.data);
    if (errors.length) return send(res, 400, { error: errors.join('; ') });

    const current = readFile(root, name);
    if (current.hash !== body.hash) return send(res, 409, { error: 'conflict' });

    // Keep the line endings the file already has, so git sees only the changed lines.
    const text = file.write(body.data);
    quietUntil = Date.now() + QUIET;
    writeFileSync(join(root, file.path), current.crlf ? text.replaceAll('\n', '\r\n') : text);
    send(res, 200, { hash: hashOf(text), stale: isStale(root) });
  }
```

Replace the route handler inside `configureServer`:

```js
      server.middlewares.use('/__editor', (req, res, next) => {
        const path = req.url.split('?')[0];
        const name = path.slice(1);

        if (Object.hasOwn(FILES, name) && req.method === 'GET') {
          const { text, hash } = readFile(root, name);
          return send(res, 200, { text, hash, stale: isStale(root) });
        }
        if (Object.hasOwn(FILES, name) && req.method === 'POST') return save(req, res, name);
        if (path === '/rebuild' && req.method === 'POST') return rebuild(res);
        next();
      });
```

Update the file's header comment to say it reads and saves `places.json` and `edits.json`. Add `'tests/world/edits.test.js'` to the test step's `args` in `STEPS` and change its label to `node --test (places, sea, map, edits)`.

- [ ] **Step 2: Replace `src/editor/api.js`**

```js
// The world editor's calls to the dev server (see tools/editor-server.js): read and save the
// two files the editor edits, and run a rebuild while passing on what the build prints.

/**
 * Reads one of the editor's files from disk.
 *
 * @param {string} name - 'places' or 'edits'.
 * @returns {Promise<{text: string, hash: string, stale: boolean}>} The file's text, a fingerprint
 *   to send back when saving, and whether the map is older than the files.
 */
export async function loadFile(name) {
  const res = await fetch(`/__editor/${name}`);
  if (!res.ok) throw new Error(`Could not read the ${name} file (${res.status})`);
  return res.json();
}

/**
 * Saves one of the editor's files.
 *
 * @param {string} name - 'places' or 'edits'.
 * @param {object} data - What to write.
 * @param {string} hash - The fingerprint of the file as this page loaded or last saved it.
 * @returns {Promise<object>} `{ok: true, hash, stale}` when saved, or `{ok: false, conflict: true}`
 *   when the file changed on disk in the meantime. Any other failure throws with the reason.
 */
export async function saveFile(name, data, hash) {
  const res = await fetch(`/__editor/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, hash }),
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

`main.js` still calls the old names until Task 4 replaces it, so the page is broken between these two tasks. Do not open the page yet; commit and go straight on.

- [ ] **Step 3: Format, test, commit**

```bash
npm run format
npm test
npm run build
git add tools/editor-server.js src/editor/api.js
git commit -m "Let the editor's server read and save the edits file as well as the places"
```

---

### Task 4: The sharp view and Objects mode

**Files:**
- Create: `src/editor/tiles.js`, `src/editor/sprites.js`, `src/editor/palette.js`
- Replace: `src/editor/view.js`, `src/editor/panel.js`, `src/editor/main.js`
- Modify: `editor.html`, `src/editor/editor.css`

**Interfaces:**
- `tiles.js`: `createTiles(onReady) -> { ready(): boolean, draw(ctx, cam, width, height): boolean }` (`draw` returns true when chunks are still waiting to be made, so the caller draws again).
- `sprites.js`: `spriteUrl(name)`, `bucketObjects(objects) -> { near(x0, y0, x1, y1): object[] }`, `drawOrder(specs) -> (a, b) => number`, `createSprites(specs, onLoad) -> { rect(obj), draw(ctx, obj, cam, alpha), hits(obj, x, y) }`.
- `palette.js`: `createPalette(root, { specs, pick }) -> { arm(name|null) }`.
- `view.js`: `createView(canvas, on) -> { draw, centerOn, setOverlay, setObjects(list) }`. `on` adds to build 1's handlers: `mode()`, `specs`, `objectSelection()`, `armed()`, `lockedWhy(obj)`, `selectObjects(list)`, `moveObjects(dx, dy, first)`, `placeObject(x, y)`, `hint(text)`.
- `panel.js`: `createPanel(root, on) -> { render(state), log, setLog, palette }`. `on` adds `mode(name)`, `armSprite(name)`, `objectMove(x, y)`, `removeObjects()`, `dropStale()`, `pickObject(obj)`.

- [ ] **Step 1: Write `src/editor/tiles.js`**

```js
// Draws the map's real ground for the world editor when it is zoomed in. The map has eleven tile
// layers of 448 by 320 tiles; drawing them tile by tile on every mouse move would be far too slow,
// so each block of 16 by 16 tiles is painted once onto its own small canvas and reused.

import MAP from '../../assets/world/map/wildhaven.json';
import tilesetUrl from '../../assets/world/map/tileset.png';

/** One tile's width in world units. */
const TILE = MAP.tilewidth;

/** A chunk is this many tiles wide and tall. */
const CHUNK = 16;

/** Each tile is painted this many pixels wide in a chunk canvas: enough to look sharp at zoom 0.5. */
const PX = 32;

/** At most this many chunk canvases are kept (each is 512 by 512 pixels, about 1 MB). */
const KEEP = 96;

/** At most this many new chunks are painted per draw, so the first look at a place doesn't freeze. */
const PER_DRAW = 6;

/** The map's tile layers, bottom to top, in the map's own order. */
const LAYERS = MAP.layers.filter((layer) => layer.type === 'tilelayer');

/** Where the tiles sit in the tileset picture: margin, spacing and columns. */
const SET = MAP.tilesets[0];

/**
 * Sets up the chunked ground painter.
 *
 * @param {() => void} onReady - Called when the tileset picture has loaded, to draw again.
 * @returns {{ready: Function, draw: Function}} The painter.
 */
export function createTiles(onReady) {
  const sheet = new Image();
  sheet.onload = onReady;
  sheet.src = tilesetUrl;

  /** Chunk canvases by 'cx,cy', oldest first, so the least recently used can be dropped. */
  const cache = new Map();

  /**
   * Paints one chunk: every layer's tiles for a 16 by 16 block.
   *
   * @param {number} cx - The chunk's column.
   * @param {number} cy - The chunk's row.
   * @returns {HTMLCanvasElement} The painted chunk.
   */
  function paint(cx, cy) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = CHUNK * PX;
    const ctx = canvas.getContext('2d');

    for (const layer of LAYERS)
      for (let ty = 0; ty < CHUNK; ty++)
        for (let tx = 0; tx < CHUNK; tx++) {
          const col = cx * CHUNK + tx,
            row = cy * CHUNK + ty;
          if (col >= MAP.width || row >= MAP.height) continue;

          const gid = layer.data[row * MAP.width + col];
          if (!gid) continue;

          // A tile's place in the tileset picture, allowing for its margin and spacing.
          const n = gid - SET.firstgid;
          const sx = SET.margin + (n % SET.columns) * (TILE + SET.spacing);
          const sy = SET.margin + Math.floor(n / SET.columns) * (TILE + SET.spacing);
          ctx.drawImage(sheet, sx, sy, TILE, TILE, tx * PX, ty * PX, PX, PX);
        }

    return canvas;
  }

  return {
    // Says whether the tileset picture has loaded.
    ready: () => sheet.complete && sheet.naturalWidth > 0,

    // Draws the ground for the part of the world on screen. Returns true if some chunks are
    // still to be painted, so the caller should draw again soon.
    draw(ctx, cam, width, height) {
      const size = CHUNK * TILE;
      const c0 = Math.max(0, Math.floor(cam.x / size)),
        r0 = Math.max(0, Math.floor(cam.y / size));
      const c1 = Math.min(Math.ceil(MAP.width / CHUNK) - 1, Math.floor((cam.x + width / cam.scale) / size)),
        r1 = Math.min(Math.ceil(MAP.height / CHUNK) - 1, Math.floor((cam.y + height / cam.scale) / size));
      let painted = 0,
        waiting = false;

      for (let cy = r0; cy <= r1; cy++)
        for (let cx = c0; cx <= c1; cx++) {
          const key = `${cx},${cy}`;
          let chunk = cache.get(key);

          if (!chunk) {
            if (painted >= PER_DRAW) {
              waiting = true;
              continue;
            }
            chunk = paint(cx, cy);
            painted++;
          }

          // Re-inserting moves the chunk to the "newest" end of the map.
          cache.delete(key);
          cache.set(key, chunk);

          // Whole-pixel edges, one pixel of overlap: no hairline seams between chunks.
          const x = Math.floor((cx * size - cam.x) * cam.scale),
            y = Math.floor((cy * size - cam.y) * cam.scale);
          const side = Math.ceil(size * cam.scale) + 1;
          ctx.drawImage(chunk, x, y, side, side);
        }

      while (cache.size > KEEP) cache.delete(cache.keys().next().value);
      return waiting;
    },
  };
}
```

- [ ] **Step 2: Write `src/editor/sprites.js`**

```js
// Sprite pictures for the world editor's sharp view: loading each object's picture, drawing it
// where the game would, telling whether a click landed on its paint, and sorting the map's
// thousands of objects into squares so only the ones on screen are looked at.

/** Sprite name to picture address, the same folders the game's renderer reads. */
const URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/source/objects/*/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.png$/)[1], url]),
);

/** The side of one bucket square, in world units. */
const BUCKET = 512;

/** A click this close to a small sprite's ground point picks it even if it missed the paint. */
const NEAR = 22;

/** A pixel counts as painted above this much alpha (0 to 255). */
const SOLID_ALPHA = 40;

/** The address of a sprite's picture, for thumbnails. */
export const spriteUrl = (name) => URLS[name];

/**
 * Sorts objects into a grid of squares by position.
 *
 * Like sorting post into pigeonholes by street: to find what is near a spot, only the nearby
 * holes are opened instead of going through all nine thousand objects.
 *
 * @param {object[]} objects - The objects to sort.
 * @returns {{near: Function}} `near(x0, y0, x1, y1)` lists the objects in the squares that
 *   touch that rectangle (a little more than the rectangle itself).
 */
export function bucketObjects(objects) {
  const grid = new Map();
  for (const o of objects) {
    const key = `${Math.floor(o.x / BUCKET)},${Math.floor(o.y / BUCKET)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(o);
  }

  return {
    // Everything in the squares that touch the rectangle.
    near(x0, y0, x1, y1) {
      const out = [];
      for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++)
        for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++)
          out.push(...(grid.get(`${bx},${by}`) ?? []));
      return out;
    },
  };
}

/**
 * Makes the comparison that puts objects in the order the game draws them.
 *
 * Path pieces go down first, then other flat things, then everything else from north to south,
 * so a tree further south is drawn over one behind it.
 *
 * @param {object} specs - The sprites of objects.json, by name.
 * @returns {(a: object, b: object) => number} A function for `Array.sort`.
 */
export function drawOrder(specs) {
  /** 0 for a path piece, 1 for another flat sprite, 2 for one that stands up. */
  const rank = (o) => (specs[o.name]?.path ? 0 : specs[o.name]?.flat ? 1 : 2);
  return (a, b) => rank(a) - rank(b) || a.y - b.y;
}

/**
 * Sets up sprite loading, drawing and hit testing.
 *
 * @param {object} specs - The sprites of objects.json: `origin`, `scale`, `flat`, `path`.
 * @param {() => void} onLoad - Called each time a picture finishes loading, to draw again.
 * @returns {{rect: Function, draw: Function, hits: Function}} The sprite tools.
 */
export function createSprites(specs, onLoad) {
  const images = new Map();
  const paint = new Map();

  /**
   * Gets a sprite's picture, starting to load it the first time it is asked for.
   *
   * @param {string} name - The sprite's name.
   * @returns {HTMLImageElement|null} The picture, or null while it is still loading.
   */
  function image(name) {
    let img = images.get(name);
    if (!img) {
      img = new Image();
      img.onload = onLoad;
      if (URLS[name]) img.src = URLS[name];
      images.set(name, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  /**
   * Works out the rectangle an object's picture covers in the world.
   *
   * @param {object} obj - The object.
   * @returns {{x: number, y: number, w: number, h: number, img: HTMLImageElement}|null} The
   *   rectangle in world units and the picture, or null while the picture is loading.
   */
  function rect(obj) {
    const img = image(obj.name);
    const spec = specs[obj.name];
    if (!img || !spec) return null;

    const scale = spec.scale ?? 1;
    const w = img.naturalWidth * scale,
      h = img.naturalHeight * scale;
    return { x: obj.x - spec.origin[0] * w, y: obj.y - spec.origin[1] * h, w, h, img };
  }

  /**
   * Reads a picture's pixels once, so clicks can be tested against its paint.
   *
   * @param {string} name - The sprite's name.
   * @param {HTMLImageElement} img - Its loaded picture.
   * @returns {ImageData} The pixels.
   */
  function pixels(name, img) {
    if (!paint.has(name)) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      paint.set(name, ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
    return paint.get(name);
  }

  return {
    rect,

    // Draws one object where the game would, turned if it is a path piece.
    draw(ctx, obj, cam, alpha = 1) {
      const r = rect(obj);
      if (!r) return;
      ctx.globalAlpha = alpha;

      if (obj.rotation) {
        ctx.save();
        ctx.translate((obj.x - cam.x) * cam.scale, (obj.y - cam.y) * cam.scale);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.drawImage(r.img, (r.x - obj.x) * cam.scale, (r.y - obj.y) * cam.scale, r.w * cam.scale, r.h * cam.scale);
        ctx.restore();
      } else {
        ctx.drawImage(r.img, (r.x - cam.x) * cam.scale, (r.y - cam.y) * cam.scale, r.w * cam.scale, r.h * cam.scale);
      }
      ctx.globalAlpha = 1;
    },

    // Says whether a world spot is on an object's paint (or right at a small sprite's foot).
    hits(obj, x, y) {
      if (Math.hypot(x - obj.x, y - obj.y) < NEAR) return true;
      const r = rect(obj);
      if (!r || x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return false;

      const data = pixels(obj.name, r.img);
      const px = Math.floor(((x - r.x) / r.w) * data.width),
        py = Math.floor(((y - r.y) / r.h) * data.height);
      return data.data[(py * data.width + px) * 4 + 3] > SOLID_ALPHA;
    },
  };
}
```

- [ ] **Step 3: Write `src/editor/palette.js`**

```js
// The world editor's sprite palette: every sprite that can be placed by hand, grouped by kind
// (trees, plants, rocks, buildings, props), each with a small picture. Clicking one "arms" it,
// and the map then places one of it per click.

import { spriteUrl } from './sprites.js';
import { lockReason } from './edits.js';

/** The order the groups are shown in. Kinds not listed here follow in name order. */
const KIND_ORDER = ['trees', 'plants', 'rocks', 'buildings', 'props'];

/**
 * Builds the palette.
 *
 * @param {HTMLElement} root - The element to fill.
 * @param {{specs: object, pick: (name: string) => void}} options - The sprites of objects.json,
 *   and what to call when a sprite is clicked.
 * @returns {{arm: Function}} `arm(name)` highlights the armed sprite; `arm(null)` clears it.
 */
export function createPalette(root, { specs, pick }) {
  const buttons = new Map();
  const names = Object.keys(specs)
    .filter((name) => !lockReason(name, specs))
    .sort();
  const kinds = [...new Set([...KIND_ORDER, ...names.map((name) => specs[name].kind).sort()])];

  for (const kind of kinds) {
    const group = names.filter((name) => specs[name].kind === kind);
    if (!group.length) continue;

    const heading = document.createElement('h3');
    heading.textContent = kind;
    const grid = document.createElement('div');
    grid.className = 'sprites';

    for (const name of group) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = name;

      const img = document.createElement('img');
      img.src = spriteUrl(name);
      img.alt = '';
      img.loading = 'lazy';

      const label = document.createElement('span');
      label.textContent = name;

      button.append(img, label);
      button.onclick = () => pick(name);
      buttons.set(name, button);
      grid.append(button);
    }

    root.append(heading, grid);
  }

  return {
    // Highlights the armed sprite's button, or none.
    arm(name) {
      for (const [key, button] of buttons) button.classList.toggle('on', key === name);
    },
  };
}
```

- [ ] **Step 4: Change `editor.html`**

Replace the `<header>` and `<aside>` with:

```html
    <header id="bar">
      <strong>Wildhaven world</strong>
      <button type="button" data-mode="places">Places</button>
      <button type="button" data-mode="objects">Objects</button>
      <span class="places-only">
        <button type="button" data-add="landmark">+ Landmark</button>
        <button type="button" data-add="waypoint">+ Signpost</button>
        <button type="button" data-add="wreck">+ Old boat</button>
      </span>
      <button type="button" id="undo">Undo</button>
      <button type="button" id="redo">Redo</button>
      <label><input type="checkbox" data-overlay="regions" checked /> Region borders</label>
      <label><input type="checkbox" data-overlay="blocked" /> Blocked ground</label>
      <span id="status" role="status"></span>
      <button type="button" id="save">Save</button>
      <button type="button" id="rebuild">Rebuild map</button>
    </header>
```

```html
      <aside id="side">
        <section id="places-pane">
          <input id="filter" type="search" placeholder="Find a place" aria-label="Find a place" />
          <ul id="list"></ul>
          <form id="form"></form>
        </section>
        <section id="objects-pane" hidden>
          <form id="object"></form>
          <h2>Place a sprite</h2>
          <div id="palette"></div>
        </section>
        <h2>Problems</h2>
        <p id="stale" hidden>
          Places or objects changed since the map was last built, so the position warnings may be
          out of date. Rebuild for the real answer.
        </p>
        <button type="button" id="drop-stale" hidden>Remove stale edits</button>
        <ul id="problems"></ul>
        <h2>Rebuild log</h2>
        <pre id="log"></pre>
      </aside>
```

- [ ] **Step 5: Add to `src/editor/editor.css`**

Append:

```css
/* ---- Modes ---- */
/* The two panes share the side panel; the one for the other mode is hidden with [hidden]. */
#places-pane,
#objects-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#places-pane[hidden],
#objects-pane[hidden],
.places-only[hidden] {
  display: none;
}

.places-only {
  display: inline-flex;
  gap: 8px;
}

/* ---- Object form ---- */
#object {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 4px 8px;
  align-items: center;
}

#object input {
  width: 100%;
  padding: 3px 5px;
}

#object .wide {
  grid-column: 1 / -1;
}

/* ---- Sprite palette ---- */
#palette h3 {
  margin: 8px 0 4px;
  font-size: 12px;
  text-transform: capitalize;
  color: #a9b5ab;
}

#palette .sprites {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

#palette button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 2px;
  overflow: hidden;
  font-size: 11px;
}

/* Thumbnails keep their shape inside a fixed box, whatever the sprite's size. */
#palette img {
  width: 100%;
  height: 48px;
  object-fit: contain;
}

#palette span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 6: Replace `src/editor/view.js`**

```js
// The world editor's map: a canvas showing the world with a marker on every place. Zoomed out it
// shows the small overview picture; zoomed in it draws the real tiles and sprites. It handles
// zooming, panning, picking and dragging in both modes (places and objects) and tells main.js
// what the person did; it never changes the places or the objects itself.

import overviewUrl from '../../assets/world/map/overview.webp';
import { WORLD, isWalkable } from '../world/map.js';
import { REGION_GRID, regionIndexAt } from '../world/regions.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS } from '../data/balance.js';
import { listPlaces, getPlace } from './model.js';
import { createTiles } from './tiles.js';
import { createSprites, bucketObjects, drawOrder } from './sprites.js';

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

/** From this zoom the real tiles and sprites are drawn instead of the overview picture. */
const SHARP_ZOOM = 0.25;

/** The closest zoom: two screen pixels per world unit. */
const MAX_ZOOM = 2;

/** How much one notch of the mouse wheel zooms. */
const ZOOM_STEP = 1.15;

/** The tallest sprite is about 525 units (the ship), so objects this far off screen still show. */
const REACH = 560;

/**
 * The radius drawn round a selected place: how close the player must come to find it.
 * Old boats are found like landmarks. Other kinds have no finding radius.
 */
const FIND_RADIUS = {
  landmark: LANDMARK_RADIUS,
  wreck: LANDMARK_RADIUS,
  waypoint: WAYPOINT_RADIUS,
};

/** Says whether two objects are the same one: sprite, spot, and whose it is. */
const sameObject = (a, b) => a.name === b.name && a.x === b.x && a.y === b.y && a.own === b.own;

/**
 * Sets up the map canvas.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to draw on.
 * @param {object} on - What the view asks and tells main.js. Places: `places()`, `selected()`,
 *   `flagged()`, `adding()`, `select(ref|null)`, `move(ref, x, y, first)`, `add(x, y)`. Objects:
 *   `mode()` ('places' or 'objects'), `specs`, `objectSelection()`, `armed()` (the sprite waiting
 *   for a click, or null), `lockedWhy(obj)`, `selectObjects(list)`, `moveObjects(dx, dy, first)`,
 *   `placeObject(x, y)` and `hint(text)` for the status line.
 * @returns {{draw: Function, centerOn: Function, setOverlay: Function, setObjects: Function}} The
 *   view's controls.
 */
export function createView(canvas, on) {
  const ctx = canvas.getContext('2d');
  const overlays = { regions: true, blocked: false };
  const cam = { x: 0, y: 0, scale: 0.05 };
  const picture = new Image();
  const order = drawOrder(on.specs);

  /** What the mouse is doing between pointer down and up: a drag, a pan or a selection box. */
  let action = null;

  /** False until the first resize, which zooms out so the whole world shows. */
  let fitted = false;

  /** The map's objects sorted into squares, replaced by `setObjects` after every edit. */
  let index = bucketObjects([]);

  /** Where the armed sprite's ghost is drawn, in world units, or null. */
  let ghost = null;

  /** True while a redraw is already booked for the next frame. */
  let booked = false;

  /** Books one redraw for the next frame, however many times it is asked for. */
  function later() {
    if (booked) return;
    booked = true;
    requestAnimationFrame(() => {
      booked = false;
      draw();
    });
  }

  const tiles = createTiles(later);
  const sprites = createSprites(on.specs, later);

  /** Turns a spot on the screen into world units. */
  const toWorld = (sx, sy) => [cam.x + sx / cam.scale, cam.y + sy / cam.scale];

  /** Turns a spot in the world into screen pixels. */
  const toScreen = (x, y) => [(x - cam.x) * cam.scale, (y - cam.y) * cam.scale];

  /** The zoom at which the whole world just fits on the canvas. */
  const fitScale = () => Math.min(canvas.width / WORLD.width, canvas.height / WORLD.height);

  /** Says whether the real tiles and sprites are being drawn (zoomed in, pictures loaded). */
  const sharp = () => cam.scale >= SHARP_ZOOM && tiles.ready();

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

  /**
   * Lists the objects on or near the screen, in the order they are drawn.
   *
   * @returns {object[]} The visible objects, bottom to top.
   */
  function visible() {
    const [x0, y0] = toWorld(0, 0);
    const [x1, y1] = toWorld(canvas.width, canvas.height);
    return index.near(x0 - REACH, y0 - REACH, x1 + REACH, y1 + REACH).sort(order);
  }

  /**
   * Finds the topmost object whose paint is under a world spot.
   *
   * @param {number} x - World x.
   * @param {number} y - World y.
   * @returns {object|undefined} The object, if any.
   */
  function hitObject(x, y) {
    return index
      .near(x - REACH, y - REACH, x + REACH, y + REACH)
      .sort(order)
      .findLast((o) => sprites.hits(o, x, y));
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

  /**
   * Draws a frame round an object's picture.
   *
   * @param {object} obj - The object.
   * @param {string} color - The line colour.
   * @param {number[]} dash - The dash pattern, or [] for a solid line.
   */
  function frame(obj, color, dash) {
    const r = sprites.rect(obj);
    if (!r) return;
    const [x, y] = toScreen(r.x, r.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = dash.length ? 1 : 2;
    ctx.setLineDash(dash);
    ctx.strokeRect(x, y, r.w * cam.scale, r.h * cam.scale);
    ctx.setLineDash([]);
  }

  /** Draws the sprites on screen, then frames the hand-placed and the selected ones. */
  function drawObjects() {
    const list = visible();
    for (const o of list) sprites.draw(ctx, o, cam);
    if (on.mode() !== 'objects') return;

    const chosen = on.objectSelection();
    for (const o of list) if (o.own) frame(o, 'rgba(255, 255, 255, 0.75)', [4, 3]);
    for (const o of chosen) frame(o, '#ffe14a', []);

    // The armed sprite follows the pointer, faint, to show where a click would put it.
    if (ghost && on.armed())
      sprites.draw(ctx, { name: on.armed(), x: ghost[0], y: ghost[1], rotation: 0 }, cam, 0.6);

    // The selection box being dragged out.
    if (action?.box) {
      const [x0, y0] = toScreen(action.x0, action.y0);
      const [x1, y1] = toScreen(action.x1, action.y1);
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }
  }

  /** Draws every place marker. In objects mode they are small and can't be picked. */
  function drawMarkers() {
    const places = on.places();
    const small = on.mode() === 'objects';
    const selected = small ? null : on.selected();
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
      ctx.arc(x, y, small ? 3 : p.kind === 'launch' ? 4 : 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[p.kind];
      ctx.fill();
      ctx.lineWidth = chosen ? 3 : 1.5;
      ctx.strokeStyle = chosen
        ? '#ffffff'
        : flagged.has(`${p.kind}:${p.i}`)
          ? '#ffe14a'
          : '#10140f';
      ctx.stroke();
    }
  }

  /** Redraws the whole canvas: the ground, the sprites, the overlays, then the markers. */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;

    if (sharp()) {
      // Chunks are painted a few per frame; keep drawing until none are waiting.
      if (tiles.draw(ctx, cam, canvas.width, canvas.height)) later();
      drawObjects();
    } else if (picture.complete && picture.naturalWidth) {
      const [x, y] = toScreen(0, 0);
      ctx.drawImage(picture, x, y, WORLD.width * cam.scale, WORLD.height * cam.scale);
    }

    if (overlays.blocked && cam.scale >= BLOCK_ZOOM) drawBlocked();
    if (overlays.regions) drawRegions();

    // The picture can arrive before the places file has loaded; the markers wait for it.
    if (on.places()) drawMarkers();
  }

  /** Matches the canvas's drawing size to its size on the page, and fits the world the first time. */
  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (!fitted) cam.scale = fitScale();
    fitted = true;
    draw();
  }

  /**
   * Starts whatever a press in objects mode means: place, box-select, drag or pan.
   *
   * @param {PointerEvent} event - The press.
   * @param {number} x - World x under the pointer.
   * @param {number} y - World y under the pointer.
   */
  function pressObjects(event, x, y) {
    const pan = { pan: true, sx: event.offsetX, sy: event.offsetY, moved: false };

    // Zoomed out, single sprites can't be told apart: only panning works.
    if (!sharp()) {
      on.hint('Zoom in to edit objects.');
      action = pan;
      return;
    }
    if (on.armed()) return on.placeObject(x, y);
    if (event.shiftKey) {
      action = { box: true, x0: x, y0: y, x1: x, y1: y };
      return;
    }

    const obj = hitObject(x, y);
    if (!obj || on.lockedWhy(obj)) {
      if (obj) on.hint(on.lockedWhy(obj));
      action = pan;
      return;
    }

    // Pressing an object outside the selection selects just it; inside, the whole group drags.
    if (!on.objectSelection().some((o) => sameObject(o, obj))) on.selectObjects([obj]);
    action = { objects: true, x, y, moved: false };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const [x, y] = toWorld(event.offsetX, event.offsetY);
    canvas.setPointerCapture(event.pointerId);
    if (on.mode() === 'objects') return pressObjects(event, x, y);

    // Waiting to add a place: this click says where.
    if (on.adding()) return on.add(x, y);

    const p = hit(event.offsetX, event.offsetY);
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
    const [x, y] = toWorld(event.offsetX, event.offsetY);

    // Nothing held: only the armed sprite's ghost follows the pointer.
    if (!action) {
      if (on.mode() === 'objects' && on.armed()) {
        ghost = [Math.round(x), Math.round(y)];
        later();
      }
      return;
    }

    if (action.drag) {
      on.move(action.drag, x + action.dx, y + action.dy, !action.moved);
      action.moved = true;
      return;
    }

    if (action.objects) {
      // Whole units only, and the grab point advances by what was really moved.
      const dx = Math.round(x - action.x),
        dy = Math.round(y - action.y);
      if (!dx && !dy) return;
      on.moveObjects(dx, dy, !action.moved);
      action.x += dx;
      action.y += dy;
      action.moved = true;
      return;
    }

    if (action.box) {
      action.x1 = x;
      action.y1 = y;
      later();
      return;
    }

    cam.x -= (event.offsetX - action.sx) / cam.scale;
    cam.y -= (event.offsetY - action.sy) / cam.scale;
    action.sx = event.offsetX;
    action.sy = event.offsetY;
    action.moved = true;
    later();
  });

  canvas.addEventListener('pointerup', () => {
    const done = action;
    action = null;

    // A finished box selects every editable object whose ground point is inside it.
    if (done?.box) {
      const x0 = Math.min(done.x0, done.x1),
        x1 = Math.max(done.x0, done.x1);
      const y0 = Math.min(done.y0, done.y1),
        y1 = Math.max(done.y0, done.y1);
      const inside = index
        .near(x0, y0, x1, y1)
        .filter((o) => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1 && !on.lockedWhy(o));
      return on.selectObjects(inside);
    }

    // A click on empty map that didn't pan clears the selection.
    if (done?.pan && !done.moved) {
      if (on.mode() === 'objects') on.selectObjects([]);
      else on.select(null);
    }
  });

  canvas.addEventListener('pointerleave', () => {
    ghost = null;
    later();
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      // Zoom about the pointer: the world spot under it stays under it.
      const [x, y] = toWorld(event.offsetX, event.offsetY);
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      cam.scale = Math.min(MAX_ZOOM, Math.max(fitScale() * 0.8, cam.scale * factor));
      cam.x = x - event.offsetX / cam.scale;
      cam.y = y - event.offsetY / cam.scale;
      later();
    },
    { passive: false },
  );

  new ResizeObserver(resize).observe(canvas);
  picture.onload = later;
  picture.src = overviewUrl;

  return {
    draw,

    // Moves the camera so a world spot is in the middle of the canvas, zooming in if asked.
    centerOn: (x, y, zoom) => {
      if (zoom) cam.scale = Math.max(cam.scale, zoom);
      cam.x = x - canvas.width / 2 / cam.scale;
      cam.y = y - canvas.height / 2 / cam.scale;
      draw();
    },

    // Switches an overlay ('regions' or 'blocked') on or off.
    setOverlay: (name, shown) => {
      overlays[name] = shown;
      draw();
    },

    // Takes the map's objects as they are after the latest edit.
    setObjects: (list) => {
      index = bucketObjects(list);
    },
  };
}
```

- [ ] **Step 7: Replace `src/editor/panel.js`**

```js
// The world editor's toolbar and side panel: the mode buttons, the searchable list of places and
// the form for the selected place, the object form and sprite palette, the list of problems and
// the rebuild log. It shows what main.js gives it and reports clicks and typed values back; it
// never changes the places or the objects itself.

import { COLORS } from './view.js';
import { createPalette } from './palette.js';

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
 * @param {object} on - What to call when the person does something. Places: `pick(ref)`,
 *   `field(name, value)`, `move(x, y)`, `remove()`, `add(kind)`. Objects: `mode(name)`,
 *   `armSprite(name)`, `objectMove(x, y)`, `removeObjects()`, `dropStale()`, `pickObject(obj)`.
 *   Both: `undo()`, `redo()`, `save()`, `rebuild()`, `overlay(name, shown)`. Also `specs`, the
 *   sprites of objects.json, for the palette.
 * @returns {{render: Function, log: Function, setLog: Function, palette: object}} The controls.
 */
export function createPanel(root, on) {
  /** Finds one of the page's fixed elements by its id. */
  const $ = (id) => root.getElementById(id);

  const list = $('list'),
    form = $('form'),
    objectForm = $('object'),
    problems = $('problems'),
    log = $('log'),
    filter = $('filter');
  const addButtons = [...root.querySelectorAll('[data-add]')];
  const modeButtons = [...root.querySelectorAll('[data-mode]')];
  const palette = createPalette($('palette'), { specs: on.specs, pick: (name) => on.armSprite(name) });

  /** The last state drawn, kept so typing in the search box can redraw the list. */
  let last = null;

  $('undo').onclick = () => on.undo();
  $('redo').onclick = () => on.redo();
  $('save').onclick = () => on.save();
  $('rebuild').onclick = () => on.rebuild();
  $('drop-stale').onclick = () => on.dropStale();
  for (const button of addButtons) button.onclick = () => on.add(button.dataset.add);
  for (const button of modeButtons) button.onclick = () => on.mode(button.dataset.mode);
  for (const box of root.querySelectorAll('[data-overlay]'))
    box.onchange = () => on.overlay(box.dataset.overlay, box.checked);
  filter.oninput = () => last && drawList(last);
  form.onsubmit = (event) => event.preventDefault();
  objectForm.onsubmit = (event) => event.preventDefault();

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
   * Makes one labelled row of a form.
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
    if (!p)
      return form.replaceChildren(
        el('p', { className: 'wide', textContent: 'Nothing selected.' }),
      );

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
      const sprites = [
        { value: '', label: '(none)' },
        ...state.sprites.map((s) => ({ value: s, label: s })),
      ];
      fields.push(
        ...row('pool', box(p.pool, (v) => on.field('pool', v), 'number')),
        ...row('object', pickList(p.object, sprites, (v) => on.field('object', v))),
      );
    }

    if (!fixed) {
      const remove = el('button', {
        type: 'button',
        className: 'wide',
        textContent: 'Delete this place',
      });
      remove.onclick = () => on.remove();
      fields.push(remove);
    }

    form.replaceChildren(...fields);
  }

  /**
   * Fills the object form: one object's sprite, position and what the game does with it, or a
   * count when several are selected.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawObject(state) {
    const chosen = state.objects;
    if (!chosen.length) {
      const hint = state.armed
        ? `Click the map to place ${state.armed}. Escape stops.`
        : 'Click a sprite to select it, Shift+drag to select several, or pick one below to place.';
      return objectForm.replaceChildren(el('p', { className: 'wide', textContent: hint }));
    }

    const fields = [];
    if (chosen.length === 1) {
      const [o] = chosen;
      const tags = [o.own ? 'placed by hand' : 'generated', ...state.tags(o.name)].join(', ');
      fields.push(
        ...row('sprite', box(o.name)),
        ...row('x', box(o.x, (v) => on.objectMove(Number(v), o.y), 'number')),
        ...row('y', box(o.y, (v) => on.objectMove(o.x, Number(v)), 'number')),
        el('p', { className: 'wide', textContent: tags }),
      );
    } else {
      fields.push(el('p', { className: 'wide', textContent: `${chosen.length} objects selected.` }));
    }

    const remove = el('button', {
      type: 'button',
      className: 'wide',
      textContent: chosen.length === 1 ? 'Delete this object' : 'Delete these objects',
    });
    remove.onclick = () => on.removeObjects();
    fields.push(remove);
    objectForm.replaceChildren(...fields);
  }

  /**
   * Fills the list of problems. Clicking one selects the place or object it is about.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawProblems(state) {
    $('stale').hidden = !state.stale;
    $('drop-stale').hidden = !state.staleEdits;
    if (!state.problems.length)
      return problems.replaceChildren(el('li', { textContent: 'No problems found.' }));

    problems.replaceChildren(
      ...state.problems.map((p) => {
        const item = el('li', { className: p.level, textContent: p.message });
        if (p.kind) item.onclick = () => on.pick({ kind: p.kind, i: p.i });
        else if (p.object) item.onclick = () => on.pickObject(p.object);
        return item;
      }),
    );
  }

  return {
    palette,

    // Redraws the toolbar and the panel from the editor's state.
    render(state) {
      last = state;
      const errors = state.problems.some((p) => p.level === 'error');
      const places = state.mode === 'places';

      $('undo').disabled = !state.canUndo || state.busy;
      $('redo').disabled = !state.canRedo || state.busy;
      $('save').disabled = !state.dirty || errors || state.busy;
      $('rebuild').disabled = state.dirty || state.busy;
      $('status').textContent = state.status;
      $('places-pane').hidden = !places;
      $('objects-pane').hidden = places;
      root.querySelector('.places-only').hidden = !places;

      for (const button of modeButtons) button.classList.toggle('on', state.mode === button.dataset.mode);
      for (const button of addButtons) {
        button.classList.toggle('on', state.adding === button.dataset.add);
        button.disabled = state.busy;
      }
      palette.arm(state.armed);

      drawList(state);
      drawForm(state);
      drawObject(state);
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

- [ ] **Step 8: Replace `src/editor/main.js`**

```js
// The world editor's entry point (editor.html). It loads the places file and the edits file,
// joins the model, the map view and the side panel together, and handles the keyboard. Every
// edit goes through the model or the edits module, then `refresh` redraws everything.

import './editor.css';
import { MAP_OBJECTS } from '../world/map.js';
import { regionOf } from '../world/regions.js';
import * as model from './model.js';
import * as edits from './edits.js';
import { gameLookups, objectLookups } from './lookups.js';
import { loadFile, saveFile, rebuild } from './api.js';
import { createView } from './view.js';
import { createPanel } from './panel.js';

/** Where the last rebuild's log is kept across the page reload that follows a rebuild. */
const LOG_KEY = 'wildhaven.editor.log';

/** Where the mode is kept across that reload, so a rebuild doesn't drop back to Places. */
const MODE_KEY = 'wildhaven.editor.mode';

/** How far the arrow keys nudge the selection, in world units (Shift nudges by 1). */
const NUDGE = 8;

/** The zoom the view goes to when a problem about an object is clicked. */
const LOOK_ZOOM = 0.6;

/** The game facts the checks read. They describe the map as it was last built. */
const world = gameLookups();
const objectWorld = objectLookups();

/** Everything the page knows: the editing session, the selections and a few flags. */
const app = {
  editor: null,
  hash: { places: '', edits: '' },
  stale: false,
  mode: 'places',
  selected: null,
  adding: null,
  base: [],
  chosen: [],
  armed: null,
  staleEdits: [],
  busy: false,
  status: '',
  problems: [],
};

/** Says whether two objects are the same one: sprite, spot, and whose it is. */
const sameObject = (a, b) => a.name === b.name && a.x === b.x && a.y === b.y && a.own === b.own;

/**
 * Says why an object can't be edited, if it can't.
 *
 * @param {object} obj - The object.
 * @returns {string|null} The reason, or null when it is editable.
 */
function lockedWhy(obj) {
  return (
    edits.lockReason(obj.name, objectWorld.specs) ?? edits.landmarkLock(obj, app.editor.places)
  );
}

const view = createView(document.getElementById('map'), {
  specs: objectWorld.specs,
  // The places as they are being edited (nothing until the file has loaded).
  places: () => app.editor?.places,
  // The ref of the selected place, or null.
  selected: () => app.selected,
  // Which places have a problem, as 'kind:i' keys, so their markers get a ring.
  flagged: () => new Set(app.problems.map((p) => `${p.kind}:${p.i}`)),
  // The kind of place waiting for a click on the map, or null.
  adding: () => app.adding,
  // 'places' or 'objects'.
  mode: () => app.mode,
  // The selected objects.
  objectSelection: () => app.chosen,
  // The sprite waiting to be placed, or null.
  armed: () => app.armed,
  lockedWhy,
  // A marker (or empty map, with null) was clicked.
  select: (ref) => {
    app.selected = ref;
    refresh();
  },
  // A marker is being dragged; only the first move of a drag is an undo step.
  move: (ref, x, y, first) => {
    model.movePlace(app.editor, ref, x, y, first);
    refresh();
  },
  // The map was clicked while an add button was on: make the place there.
  add: (x, y) => {
    const region = app.editor.places.regions.find((r) => r.id === regionOf(x, y).id);
    app.selected = model.addPlace(app.editor, app.adding, x, y, region);
    app.adding = null;
    app.status = '';
    refresh();
  },
  // Objects were clicked or boxed (an empty list clears the selection).
  selectObjects: (list) => {
    app.chosen = list;
    app.status = '';
    refresh();
  },
  // The selected objects are being dragged; only the first move of a drag is an undo step.
  moveObjects: (dx, dy, first) => {
    app.chosen = edits.moveObjects(app.editor, app.chosen, dx, dy, first);
    refresh();
  },
  // The map was clicked while a sprite was armed: place one there and stay armed.
  placeObject: (x, y) => {
    app.chosen = [edits.addObject(app.editor, app.armed, x, y)];
    refresh();
  },
  // The view has something to say in the status line (a locked object, "zoom in").
  hint: (text) => {
    app.status = text;
    refresh();
  },
});

const panel = createPanel(document, {
  specs: objectWorld.specs,
  // A list row or a problem was clicked: select that place and bring it into view.
  pick: (ref) => {
    app.mode = 'places';
    app.selected = ref;
    const place = model.getPlace(app.editor.places, ref);
    if (place) view.centerOn(place.x, place.y);
    refresh();
  },
  // A problem about an object was clicked: go to objects mode and look at it up close.
  pickObject: (obj) => {
    app.mode = 'objects';
    app.chosen = [{ ...obj, rotation: 0, own: true }];
    view.centerOn(obj.x, obj.y, LOOK_ZOOM);
    refresh();
  },
  // A form field was changed.
  field: (name, value) => edit(() => model.setField(app.editor, app.selected, name, value)),
  // The x or y box of a place was changed.
  move: (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y))
      edit(() => model.movePlace(app.editor, app.selected, x, y));
  },
  // The x or y box of an object was changed.
  objectMove: (x, y) => {
    const [obj] = app.chosen;
    if (obj && Number.isFinite(x) && Number.isFinite(y))
      edit(() => {
        app.chosen = edits.moveObjects(app.editor, app.chosen, x - obj.x, y - obj.y);
      });
  },
  remove: removeSelected,
  removeObjects: removeChosen,
  // The cleanup button: forget removals that match nothing on the map.
  dropStale: () => edit(() => edits.dropStale(app.editor, app.staleEdits)),
  // Steps back one edit.
  undo: () => model.undo(app.editor) && refresh(),
  // Steps forward again after an undo.
  redo: () => model.redo(app.editor) && refresh(),
  // An add button was pressed: switch on waiting for a click on the map, or off again.
  add: (kind) => {
    app.adding = app.adding === kind ? null : kind;
    app.status = app.adding ? 'Click the map to place it.' : '';
    refresh();
  },
  // A mode button was pressed.
  mode: (name) => {
    Object.assign(app, { mode: name, adding: null, armed: null, status: '' });
    refresh();
  },
  // A palette sprite was clicked: arm it, or disarm it if it was armed already.
  armSprite: (name) => {
    app.armed = app.armed === name ? null : name;
    app.chosen = [];
    refresh();
  },
  save,
  rebuild: runRebuild,
  // An overlay checkbox was ticked or cleared.
  overlay: (name, shown) => view.setOverlay(name, shown),
});

/**
 * Runs one edit and redraws, showing the reason if it is refused.
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

/** Deletes the selected objects. No question is asked: undo brings them back. */
function removeChosen() {
  if (!app.chosen.length) return;
  edit(() => {
    edits.removeObjects(app.editor, app.chosen);
    app.chosen = [];
  });
}

/** Says whether anything differs from what is on disk. */
const isDirty = () => model.isDirty(app.editor) || edits.isEditsDirty(app.editor);

/** Re-runs the checks and redraws the panel and the map from the model. */
function refresh() {
  const { places } = app.editor;

  // Lay the edits over the generated objects: this is what the map will hold after a rebuild.
  const applied = edits.applyEdits(app.base, app.editor.edits);
  app.staleEdits = applied.stale;
  view.setObjects(applied.objects);

  // An undo or a delete can leave a selection pointing at something that is gone.
  if (app.selected && !model.getPlace(places, app.selected)) app.selected = null;
  app.chosen = app.chosen.filter((c) => applied.objects.some((o) => sameObject(o, c)));

  app.problems = [
    ...model.checkPlaces(places, world),
    ...edits.checkEdits(app.editor.edits, { ...objectWorld, places, stale: applied.stale }),
  ];
  const dirty = isDirty();

  panel.render({
    mode: app.mode,
    rows: model.listPlaces(places),
    selected: app.selected,
    place: app.selected && model.getPlace(places, app.selected),
    regions: places.regions,
    sprites: world.sprites,
    objects: app.chosen,
    armed: app.armed,
    tags: objectWorld.tags,
    staleEdits: applied.stale.length > 0,
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

/** Reads both files from disk and starts a fresh editing session on them. */
async function load() {
  const [places, objects] = await Promise.all([loadFile('places'), loadFile('edits')]);
  const built = JSON.parse(objects.text);

  const editor = model.createEditor(JSON.parse(places.text));
  edits.loadEdits(editor, built);

  Object.assign(app, {
    editor,
    hash: { places: places.hash, edits: objects.hash },
    stale: places.stale,
    base: edits.baseObjects(MAP_OBJECTS, built, objectWorld.builtStale),
    selected: null,
    chosen: [],
  });
  refresh();
}

/**
 * Saves one file if it changed.
 *
 * @param {string} name - 'places' or 'edits'.
 * @returns {Promise<boolean>} False when the file changed on disk, so nothing was written.
 */
async function saveOne(name) {
  const places = name === 'places';
  if (!(places ? model.isDirty(app.editor) : edits.isEditsDirty(app.editor))) return true;

  const data = places ? app.editor.places : app.editor.edits;
  const result = await saveFile(name, data, app.hash[name]);
  if (!result.ok) return false;

  if (places) model.markSaved(app.editor);
  else edits.markEditsSaved(app.editor);
  app.hash[name] = result.hash;
  app.stale = result.stale;
  return true;
}

/** Saves what changed, or offers to reload when a file changed on disk in the meantime. */
async function save() {
  try {
    const ok = (await saveOne('places')) && (await saveOne('edits'));

    if (!ok) {
      const reload = confirm(
        'A file changed on disk since this page loaded it, so it was not overwritten.\n\n' +
          'Reload from disk and drop the unsaved edits on this page?',
      );
      if (reload) await load();
      return;
    }
    app.status = 'Saved.';
  } catch (error) {
    app.status = error.message;
  }
  refresh();
}

/**
 * Runs the map build and the world tests, then reloads the page.
 *
 * The reload brings in the freshly built map, so the picture and the warnings are up to date.
 * The log and the mode are kept in session storage first, so they survive the reload.
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
    sessionStorage.setItem(MODE_KEY, app.mode);
  } catch {
    // Storage can be blocked; the log is then lost on reload, which is only a nuisance.
  }
  location.reload();
}

/** Brings back the mode and the log of the rebuild that ran just before this page load. */
function restoreSession() {
  try {
    if (sessionStorage.getItem(MODE_KEY) === 'objects') app.mode = 'objects';
    sessionStorage.removeItem(MODE_KEY);

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
    Object.assign(app, { adding: null, armed: null, status: '' });
    return refresh();
  }
  if (key === 'delete') return app.mode === 'objects' ? removeChosen() : removeSelected();

  const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
  if (!step) return;
  const by = event.shiftKey ? 1 : NUDGE;

  if (app.mode === 'objects' && app.chosen.length) {
    event.preventDefault();
    edit(() => {
      app.chosen = edits.moveObjects(app.editor, app.chosen, step[0] * by, step[1] * by);
    });
    return;
  }

  const place = app.mode === 'places' && app.selected && model.getPlace(app.editor.places, app.selected);
  if (place) {
    event.preventDefault();
    edit(() =>
      model.movePlace(app.editor, app.selected, place.x + step[0] * by, place.y + step[1] * by),
    );
  }
});

// Leaving with unsaved edits asks first.
addEventListener('beforeunload', (event) => {
  if (app.editor && isDirty() && !app.busy) event.preventDefault();
});

restoreSession();
load().catch((error) => {
  document.getElementById('status').textContent = error.message;
});
```

- [ ] **Step 9: Static checks**

```bash
npm run format
npm test
npm run build
```

Expected: all pass, and `dist/` has no `editor.html`. Fix any function `tests/comments.test.js` names by adding its comment.

- [ ] **Step 10: Verify in the browser**

The Browser pane's preview runs from the main checkout. Add a temporary entry to the main checkout's `.claude/launch.json` that runs `npm --prefix <this worktree> run dev -- --port 5181 --strictPort`, start it, and restore `launch.json` at once. Open `http://127.0.0.1:5181/editor.html` and check, reading the console after each:

1. Places mode still works as before: markers, list, select, drag, undo.
2. Zoom in past the overview: real tiles and sprites appear with no seams between chunks, panning stays smooth, and zooming out returns to the overview. Note roughly how long the first sharp frame takes.
3. Objects mode: place markers shrink. Clicking a tree frames it in yellow and the form shows its sprite, position and "generated, solid, chop or mine". Clicking a path piece or a signpost selects nothing and the status line says why.
4. Drag a tree: it follows the pointer; the form's x and y change; Ctrl+Z puts it back in one step and the file lists are empty again (Save disabled).
5. Delete a tree with the Delete key: it vanishes. Undo brings it back.
6. Arm `big-oak` in the palette: a faint ghost follows the pointer; three clicks place three oaks with dashed outlines; Escape disarms.
7. Shift+drag a box over a few trees: all are framed; Delete removes them all; one undo brings them all back.
8. Place a pine on water: a "stands on water or a cliff" warning; clicking the warning centres on it.
9. Save: status "Saved.", the page does not reload, and `git diff assets/world/source/edits.json` shows one line per edited object.
10. Rebuild: passes; after the reload the mode is still Objects, the placed oaks are in the map with their dashed outline, and the deleted trees are gone. Delete one of the placed oaks, Save, Rebuild: it is gone from the map.
11. In the game (`/` on the same server), start the Builder, move a save's player beside a hand-placed pine (edit the verification save's position), and check it blocks walking and offers "Chop".

Restore afterwards: `git checkout assets/world/source/edits.json`, run `python tools/build-map.py`, and check `git status --short assets/world` shows nothing.

- [ ] **Step 11: Commit**

```bash
git add editor.html src/editor/editor.css src/editor/tiles.js src/editor/sprites.js src/editor/palette.js src/editor/view.js src/editor/panel.js src/editor/main.js
git commit -m "Add a sharp map view and an Objects mode to the world editor"
```

---

### Task 5: Docs

**Files:**
- Modify: `CLAUDE.md`, `docs/verification.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the Architecture table's `src/editor/` row, add after the `lookups.js` description: `` `edits.js` (pure: the hand edits to the map's objects, `removed` and `added`, kept in `assets/world/source/edits.json`; `baseObjects`, `applyEdits`, `checkEdits`, `writeEdits`), `tiles.js` (the real ground, painted once per 16×16-tile chunk), `sprites.js` (sprite pictures, alpha hit test, object buckets), `palette.js` ``; change "It edits places only; rivers, regions and hills are later builds" to "It has two modes, Places and Objects; terrain, paths and a bigger map are later builds"; and change the last column to "`model.js`, `lookups.js` and `edits.js` only".

In "World / Map Pipeline", add a bullet after the `places.json` one:

```markdown
- **`assets/world/source/edits.json` holds hand edits to the map's objects** (world editor, Objects mode): `removed` lists generated objects to leave out and `added` lists objects placed by hand, each `{name, x, y}` in world units. `build-map.py` applies it last ("hand edits"), after every scatter pass, so an edit never reshuffles anything else, and nothing is cleared around an added object. Path pieces, hill stairs, ripples, signposts and bridges can't be named in it (`editable` in the script, `lockReason` in `src/editor/edits.js`). A removal that matches nothing is listed in the map's `staleEdits` property. `tests/world/edits.test.js` fails if the map was not rebuilt after the file changed.
```

In the pipeline diagram at the top of that section, add a line `assets/world/source/edits.json  (objects removed and placed by hand in the world editor)` beside `places.json`.

- [ ] **Step 2: Add a dated section to `docs/verification.md`**

"World editor: objects (2026-11-20)": list what Task 4 Step 10 checked and its results, the measured time of the first sharp frame and of a rebuild, and anything not checked.

- [ ] **Step 3: Final checks and commit**

```bash
npm run format:check
npm test
npm run build
git add CLAUDE.md docs/verification.md
git commit -m "Document the world editor's Objects mode"
```

---

## Self-review notes

- **Spec coverage:** edits file and its layout (Task 1), build step, clean error, stale list (Task 2), endpoints and out-of-date note over both files (Task 3), sharp view with chunk cache, sprite order, buckets, max zoom 2 (Task 4 Steps 1, 2, 6), select by alpha, move, delete, place with ghost, box select, shared undo, own outline, object form with tags (Task 4), warnings and errors and stale cleanup (Tasks 1, 4), world test (Task 2), docs (Task 5).
- **Changed from the spec:**
  - The spec said the map file is byte-for-byte unchanged with an empty edits file. It gains one property, `staleEdits`, so the editor can tell a removal that was applied from one that never matched; the tile layers, objects, tileset and overview are unchanged.
  - The sharp view starts at zoom 0.25, not 0.2, and keeps 96 chunks, not 64, so a wide window never needs more chunks than the cache holds.
  - A sprite's foot also counts as a hit (within 22 units), because a small flat sprite such as a flower patch has almost no paint to click.
  - `bridge` joins the locked sprites: bridges come from the script's `BRIDGES` list.
  - The mode survives the reload after a rebuild.
- **Names checked across tasks:** `emptyEdits`, `lockReason`, `landmarkLock`, `baseObjects`, `applyEdits`, `loadEdits`, `isEditsDirty`, `markEditsSaved`, `addObject`, `removeObjects`, `moveObjects`, `dropStale`, `shapeErrors`, `checkEdits`, `writeEdits`, `remember`, `objectLookups`, `loadFile`, `saveFile`, `rebuild`, `createTiles`, `createSprites`, `bucketObjects`, `drawOrder`, `spriteUrl`, `createPalette`, `createView` (`setObjects`, `centerOn(x, y, zoom)`), `createPanel`.
