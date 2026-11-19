// Checks the helper that steps between characters on the main menu (arrow keys, phone arrows, swipe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, nextCharacterId } from '../../src/data/characters.js';

// Stepping past either end of the list comes back round to the other end.
test('stepping through characters wraps around both ends', () => {
  assert.deepEqual(
    CHARACTERS.map((c) => c.id),
    ['scout', 'builder', 'survivor'],
  );
  assert.equal(nextCharacterId('scout', 1), 'builder');
  assert.equal(nextCharacterId('builder', 1), 'survivor');
  assert.equal(nextCharacterId('survivor', 1), 'scout');
  assert.equal(nextCharacterId('scout', -1), 'survivor');
  assert.equal(nextCharacterId('builder', -1), 'scout');
});
