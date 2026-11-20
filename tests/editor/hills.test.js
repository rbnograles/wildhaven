// Checks the world editor's hand-made hills: raising and lowering blocks of ground, the rule
// that next-door blocks differ by one level only, adding and removing stairs, the warnings, and
// how the levels are packed for terrain.json. The map build draws cliffs and collision from
// these, so a wrong level is a wall in the wrong place.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, undo } from '../../src/editor/model.js';
import {
  loadTerrain,
  emptyTerrain,
  writeTerrain,
  decodeFile,
  shapeErrors,
} from '../../src/editor/terrain.js';
import {
  levelAt,
  changeLevel,
  flightsOf,
  stairsFit,
  toggleStairs,
  pendingLevels,
  pendingStairs,
  checkHills,
  encodeLevels,
  decodeLevels,
} from '../../src/editor/hills.js';

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
 * A pretend generated world of 40 by 40 tiles: flat, except one generated hill of level 1 over
 * rows 20 to 23 and columns 20 to 25, with a flight of stairs at its south edge.
 */
const hills = {
  rows: 40,
  cols: 40,
  // Level 1 inside the generated hill, 0 elsewhere.
  levelAt: (row, col) => (row >= 20 && row <= 23 && col >= 20 && col <= 25 ? 1 : 0),
  // The generated hill is drawn with the canyon kit.
  kitAt: (row, col) => (row >= 20 && row <= 23 && col >= 20 && col <= 25 ? 'canyon' : null),
  flights: [[22, 23]],
};

/** Starts an editor with an empty terrain loaded. */
const session = () => {
  const editor = createEditor(places());
  loadTerrain(editor, {});
  return editor;
};

/** Raises the block at a tile once and expects it to work. */
const raise = (editor, col, row) =>
  assert.equal(changeLevel(editor, col, row, 1, 'meadow', hills), null);

// Guards the block rule: a click anywhere in a 2 by 2 block raises all four tiles, lined up on
// even rows and columns, and the kit picked in the panel is recorded for ground raised from flat.
test('raising lifts the whole 2 by 2 block one level and records the kit', () => {
  const editor = session();
  raise(editor, 7, 5);

  assert.deepEqual(Object.keys(editor.terrain.levels).sort(), ['4,6', '4,7', '5,6', '5,7']);
  assert.deepEqual(editor.terrain.levels['4,6'], [1, 'meadow']);
  assert.equal(levelAt(editor.terrain, hills, 5, 7), 1);
  assert.equal(levelAt(editor.terrain, hills, 6, 7), 0);
});

// Guards the staircase rule: a block may not stand two levels above a neighbour, corners
// included, and no hill goes above level 3 or below the ground.
test('a block cannot be raised two levels above its neighbours, above level 3 or below flat', () => {
  const editor = session();
  raise(editor, 6, 4);
  assert.match(changeLevel(editor, 6, 4, 1, 'meadow', hills), /one level only/);
  assert.match(changeLevel(editor, 10, 10, -1, 'meadow', hills), /already flat/);

  // Surround the block, then it may go up again.
  for (const [c, r] of [
    [4, 2],
    [6, 2],
    [8, 2],
    [4, 4],
    [8, 4],
    [4, 6],
    [6, 6],
    [8, 6],
  ])
    raise(editor, c, r);
  raise(editor, 6, 4);
  assert.equal(levelAt(editor.terrain, hills, 4, 6), 2);

  // Lowering a neighbour under the higher block is refused too.
  assert.match(changeLevel(editor, 4, 4, -1, 'meadow', hills), /one level only/);
  assert.match(changeLevel(editor, 0, 0, 1, 'meadow', hills), /edge of the map/);
});

// Guards the file against noise, and deleting a generated hill: lowering it to the ground is an
// override, raising it back to what the build makes removes the override again.
test('lowering a generated hill records level 0, and raising it back removes the override', () => {
  const editor = session();
  assert.equal(changeLevel(editor, 20, 20, -1, 'meadow', hills), null);
  assert.deepEqual(editor.terrain.levels['20,20'], [0, 'canyon']);

  raise(editor, 20, 20);
  assert.deepEqual(editor.terrain.levels, {});
});

// Guards undo for hills, and that a refused change leaves no empty undo step behind.
test('a level change is one undo step, and a refused one is none', () => {
  const editor = session();
  raise(editor, 6, 4);
  changeLevel(editor, 6, 4, 1, 'meadow', hills);
  assert.equal(editor.past.length, 1);

  assert.equal(undo(editor), true);
  assert.deepEqual(editor.terrain, emptyTerrain());
});

// Guards where stairs may stand: on a south edge one level high, two tiles wide, with the lower
// ground running on below for the wall and the landing.
test('stairs fit only on a one-level south edge with flat lower ground below', () => {
  const editor = session();
  assert.equal(stairsFit(editor.terrain, hills, 22, 23), true);
  assert.equal(stairsFit(editor.terrain, hills, 22, 22), false);
  assert.equal(stairsFit(editor.terrain, hills, 25, 23), false);
  assert.equal(stairsFit(editor.terrain, hills, 5, 5), false);
});

// Guards the stairs tool: a click on a flight removes it (a generated one is recorded, a hand-made
// one forgotten), a click on a wall or edge adds one, and a click on flat ground explains itself.
test('toggling stairs removes the flight under the click or adds one on the edge above it', () => {
  const editor = session();
  assert.deepEqual(flightsOf(editor.terrain, hills), [[22, 23]]);

  // Remove the generated flight by clicking its wall.
  assert.equal(toggleStairs(editor, 23, 25, hills), null);
  assert.deepEqual(editor.terrain.stairs, { added: [], removed: [[22, 23]] });
  assert.deepEqual(flightsOf(editor.terrain, hills), []);

  // Add one further west by clicking the wall there; then the generated one again, which just
  // un-removes it.
  assert.equal(toggleStairs(editor, 20, 24, hills), null);
  assert.deepEqual(editor.terrain.stairs.added, [[20, 23]]);
  assert.equal(toggleStairs(editor, 22, 23, hills), null);
  assert.deepEqual(editor.terrain.stairs.removed, []);

  // Clicking the hand-made flight forgets it.
  assert.equal(toggleStairs(editor, 20, 23, hills), null);
  assert.deepEqual(editor.terrain.stairs.added, []);

  assert.match(toggleStairs(editor, 5, 5, hills), /south edge/);
});

// Guards the preview after a rebuild: only what the built map does not show yet is drawn.
test('only levels and stairs that differ from the built map are pending', () => {
  const built = { '4,6': [1, 'meadow'], '4,7': [1, 'meadow'] };
  const now = { '4,6': [1, 'meadow'], '4,7': [2, 'meadow'], '9,9': [1, 'snow'] };
  assert.deepEqual(pendingLevels(now, built, hills), { '4,7': 2, '9,9': 1 });
  assert.deepEqual(pendingLevels({}, built, hills), { '4,6': 0, '4,7': 0 });

  assert.deepEqual(
    pendingStairs(
      {
        added: [
          [1, 2],
          [3, 4],
        ],
        removed: [[5, 6]],
      },
      { added: [[1, 2]], removed: [] },
    ),
    { added: [[3, 4]], removed: [[5, 6]] },
  );
});

// Guards the warnings: a hill on water is an error the build refuses, a south edge with no room
// for its wall is a warning, and stairs left without an edge are pointed out.
test('checkHills reports hills on water, walls without room and orphaned stairs', () => {
  // No tile touches water.
  const dry = () => false;
  const editor = session();
  raise(editor, 6, 4);
  assert.deepEqual(checkHills(editor.terrain, hills, dry), []);
  assert.match(checkHills(editor.terrain, hills, () => true)[0].message, /stands on water/);

  // A second block three rows further south: the first block's wall runs into it.
  raise(editor, 6, 8);
  assert.match(
    checkHills(editor.terrain, hills, dry)[0].message,
    /three boxes of lower flat ground/,
  );

  const lone = session();
  lone.terrain.stairs.added.push([5, 5]);
  assert.match(checkHills(lone.terrain, hills, dry)[0].message, /no longer have an edge/);
});

// Guards the file: levels pack into runs and back, the whole terrain writes and reads back, and
// a bad hills section is refused before it reaches the disk.
test('levels pack into runs, and the terrain file round-trips with its hills', () => {
  const levels = {
    '4,6': [1, 'meadow'],
    '4,7': [1, 'meadow'],
    '4,8': [2, 'meadow'],
    '5,6': [1, 'snow'],
  };
  const runs = encodeLevels(levels);
  assert.deepEqual(runs, [
    [4, 6, 7, 1, 'meadow'],
    [4, 8, 8, 2, 'meadow'],
    [5, 6, 6, 1, 'snow'],
  ]);
  assert.deepEqual(decodeLevels(runs), levels);

  const terrain = {
    ground: { '3,2': 'sand' },
    levels,
    stairs: {
      added: [
        [9, 4],
        [6, 4],
      ],
      removed: [[22, 23]],
    },
  };
  const text = writeTerrain(terrain);
  assert.ok(text.includes('    [4, 6, 7, 1, "meadow"],\n'));
  assert.ok(text.includes('    "added": [[6, 4], [9, 4]],\n    "removed": [[22, 23]]\n'));
  assert.deepEqual(shapeErrors(JSON.parse(text)), []);

  const back = decodeFile(JSON.parse(text));
  assert.deepEqual(back.levels, levels);
  assert.deepEqual(back.stairs.removed, [[22, 23]]);

  assert.notDeepEqual(shapeErrors({ ground: [], levels: [[4, 6, 7, 9, 'meadow']] }), []);
  assert.notDeepEqual(shapeErrors({ ground: [], levels: [[4, 6, 7, 1, 'lava']] }), []);
  assert.notDeepEqual(shapeErrors({ ground: [], stairs: { added: [[1]], removed: [] } }), []);
});
