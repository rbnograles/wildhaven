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
  assert.notDeepEqual(
    shapeErrors({ removed: [], added: [{ name: 'pine', x: 1, y: 2, z: 3 }] }),
    [],
  );
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
  assert.deepEqual(
    found(flower, 'warning', { isBlocked: () => true, paths: [{ x: 300, y: 300 }] }),
    [],
  );
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
