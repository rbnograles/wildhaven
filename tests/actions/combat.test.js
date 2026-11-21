// Checks the combat maths: a weapon's damage by tier and charge, and a creature's max hit points.
// A wrong curve here would make hunts feel random or make a tier pointless.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { weaponDamage, creatureMaxHp } from '../../src/actions/combat.js';

// A full-charge hit deals the tier's full damage; a zero-charge (snap) hit deals floor(full/2), min 1.
test('weapon damage scales with tier and charge', () => {
  const state = createGame('scout');
  state.tools.sword = { tier: 'stone' }; // full 2
  assert.equal(weaponDamage(state, 'sword', 1), 2);
  assert.equal(weaponDamage(state, 'sword', 0), 1); // floor(2/2) = 1
  state.tools.sword = { tier: 'diamond' }; // full 6
  assert.equal(weaponDamage(state, 'sword', 1), 6);
  assert.equal(weaponDamage(state, 'sword', 0), 3); // floor(6/2) = 3
  assert.equal(weaponDamage(state, 'sword', 0.5), 4); // floor(6 * 0.75) = 4
});

// A creature with no weapon owned, or an unowned tier, still yields at least 1 so a hit never no-ops.
test('weapon damage is at least 1', () => {
  const state = createGame('survivor'); // starts with no tools
  state.tools.bow = { tier: 'stone' };
  assert.equal(weaponDamage(state, 'bow', 0), 1);
});

// Max HP comes from the animal table for animals and from WOLF_HP for wolves (wolves carry a `den`).
test('creature max hp by kind', () => {
  assert.equal(creatureMaxHp({ kind: 'deer' }), 4);
  assert.equal(creatureMaxHp({ kind: 'rabbit' }), 2);
  assert.equal(creatureMaxHp({ den: {}, id: 'wolf-x' }), 6);
});
