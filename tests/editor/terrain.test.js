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
  pendingGround,
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

/**
 * A pretend generated world of 10 by 10 boxes: grass on the left, water from column 6 on.
 * `edge: 0` switches off the strip of sea that must stay round a real map, which would cover
 * all of a map this small; one test below checks that rule on its own.
 */
const base = {
  rows: 10,
  cols: 10,
  edge: 0,
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

// Guards the brush: one box is exactly one corner, so what is drawn in a box is what the map
// build paints there, and a bigger brush is a square of boxes centred on the pointer.
test('painting one box sets one corner, and a 3-box brush sets nine', () => {
  const one = session();
  paintBoxes(one, 2, 3, 1, 'sand', base);
  assert.deepEqual(Object.keys(one.terrain.ground), ['3,2']);
  assert.equal(groundAt(one.terrain, base, 3, 2), 'sand');
  assert.equal(groundAt(one.terrain, base, 0, 0), 'grass');

  const three = session();
  paintBoxes(three, 2, 3, 3, 'sand', base);
  assert.equal(Object.keys(three.terrain.ground).length, 9);
  assert.ok('2,1' in three.terrain.ground && '4,3' in three.terrain.ground);
});

// Guards the edge of the world: a brush hanging off the map paints only the corners that exist.
test('a brush at the edge of the map stays inside the corner grid', () => {
  const editor = session();
  paintBoxes(editor, 0, 0, 3, 'sand', base);
  assert.deepEqual(Object.keys(editor.terrain.ground).sort(), ['0,0', '0,1', '1,0', '1,1']);

  paintBoxes(editor, 10, 10, 3, 'rock', base);
  assert.ok('10,10' in editor.terrain.ground && '9,9' in editor.terrain.ground);
  assert.equal('11,11' in editor.terrain.ground, false);
});

// Guards the deep outer sea: land painted near the map's edge would make that sea shallow and
// let the small boat sail off the world, so the brush leaves those corners alone. Erasing is fine.
test('land is not painted within the strip of sea round the edge of the map', () => {
  const real = { rows: 320, cols: 448, kindAt: () => 'water' };
  const editor = session();

  paintBoxes(editor, 5, 150, 1, 'sand', real);
  assert.deepEqual(editor.terrain.ground, {});

  paintBoxes(editor, 19, 150, 1, 'sand', real);
  assert.deepEqual(editor.terrain.ground, {});

  paintBoxes(editor, 20, 150, 1, 'sand', real);
  assert.deepEqual(Object.keys(editor.terrain.ground), ['150,20']);
});

// Guards the file against noise: painting the ground that is already there is not an override,
// and painting it back over an override removes the override.
test('painting the generated ground back removes the override', () => {
  const editor = session();
  paintBoxes(editor, 1, 1, 1, 'grass', base);
  assert.deepEqual(editor.terrain.ground, {});

  paintBoxes(editor, 1, 1, 1, 'water', base);
  assert.equal(Object.keys(editor.terrain.ground).length, 1);
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

// Guards the picture after a rebuild: a box the map already shows must not be covered by the
// flat preview, while a new box, a repainted one and one put back to its generated ground must.
test('only boxes that differ from the built map are previewed', () => {
  const built = { '1,1': 'sand', '2,2': 'sand', '3,3': 'sand' };
  const now = { '1,1': 'sand', '2,2': 'rock', '4,4': 'water' };

  assert.deepEqual(pendingGround(now, built, base), {
    '2,2': 'rock',
    '3,3': 'grass',
    '4,4': 'water',
  });
  assert.deepEqual(pendingGround(built, built, base), {});
  assert.deepEqual(pendingGround(now, {}, base), now);
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
    ['{', '  "ground": [', '    [2, 9, 9, "water"],', '    [3, 2, 3, "sand"]', '  ]', '}', ''].join(
      '\n',
    ),
  );
  assert.deepEqual(decodeRuns(JSON.parse(text).ground), {
    '3,2': 'sand',
    '3,3': 'sand',
    '2,9': 'water',
  });
  assert.equal(writeTerrain(emptyTerrain()), '{\n  "ground": []\n}\n');
});
