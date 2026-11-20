// Checks the world editor's model: the places being edited, the undo history, the checks that
// warn about a bad spot, and the writer that turns the places back into the file's text.
// The model is the only part of the editor that can lose or corrupt places.json, so it is tested.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  shapeErrors,
  checkPlaces,
  writePlaces,
} from '../../src/editor/model.js';
import { gameLookups } from '../../src/editor/lookups.js';
import PLACES from '../../assets/world/source/places.json' with { type: 'json' };

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

/**
 * A pretend world for the checks: everything walkable and sailable, pinefall on the left and
 * meadows on the right. A test overrides the one fact it wants to break.
 */
const world = (over = {}) => ({
  width: 1000,
  height: 1000,
  // Every spot can be stood on.
  isWalkable: () => true,
  // Every spot floats a boat.
  isSailable: () => true,
  // Left of x = 600 is pinefall; the rest is meadows.
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
  assert.match(
    problems((p) => (p.wrecks[0].launch = [500, 1200]), 'error')[0],
    /outside the world/,
  );
});

// Guards each warning: these don't block Save, because a rebuild reshapes the land around a
// place, but the person should see them.
test('checkPlaces warns about unwalkable spots, the wrong region, a dry launch point and journal pages', () => {
  assert.match(problems(() => {}, 'warning', { isWalkable: (x) => x !== 300 })[0], /can't stand/);
  assert.match(problems((p) => (p.landmarks[0].x = 700), 'warning')[0], /is in meadows/);
  assert.match(problems(() => {}, 'warning', { isSailable: () => false })[0], /not on water/);
  assert.match(problems((p) => (p.landmarks[0].id = 'p-tent'), 'warning').join('|'), /journal/);
  assert.match(problems(() => {}, 'warning', { journal: { pinefall: [] } })[0], /no journal page/);
});

// Guards the real file: with the real game lookups, today's places.json must be clean. If this
// fails after a map change, the message names the place that needs a look.
test('the real places file has no errors or warnings against the real map', () => {
  assert.deepEqual(checkPlaces(PLACES, gameLookups()), []);
});

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
