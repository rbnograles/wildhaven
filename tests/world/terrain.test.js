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
