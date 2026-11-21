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
  // edits.json is the Wildhaven world-editor's hand edits. Spring Country is imported by
  // tools/import-spring-country.py, which does not apply edits.json, so this check only runs on a
  // map built from the Wildhaven pipeline.
  if (mapProperty('importedFrom') === 'spring-country.tmj') return;

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
