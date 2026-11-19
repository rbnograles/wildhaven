// Checks region discovery: walking into one of the three starting regions marks it as found.
// The HUD and the world map count found regions, so each one must be counted exactly once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { discover } from '../../src/actions/discover.js';

// Guards against a region being "discovered" again on every frame while the player stands in it,
// and checks that walking into a second region adds it alongside the first.
test('locations are discovered once when entered', () => {
  const game = createGame('survivor');
  assert.equal(discover(game).length, 1);
  assert.equal(discover(game).length, 0);

  // Teleport the survivor to the builder's start, which is inside a different region.
  const builder = createGame('builder');
  game.player.x = builder.player.x;
  game.player.y = builder.player.y;

  assert.equal(discover(game).length, 1);
  assert.equal(game.discovered.length, 2);
});
