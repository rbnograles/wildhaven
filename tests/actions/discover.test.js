// Checks discovery: walking into a region marks it as found, exactly once.
// The HUD and the world map count found regions, so each one must be counted exactly once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { discover } from '../../src/actions/discover.js';
import { SPAWNS } from '../../src/data/places.js';

// Guards against a region being "discovered" again on every frame while the player stands in it,
// and checks that walking into a second region adds it alongside the first.
test('a region is discovered once, when the player first stands in it', () => {
  const game = createGame('survivor');

  const first = discover(game).filter((f) => f.kind === 'region');
  assert.deepEqual(first, [{ kind: 'region', id: 'lagoon', name: 'Driftwood Lagoon' }]);
  assert.equal(discover(game).filter((f) => f.kind === 'region').length, 0);

  // Teleport the survivor to the scout's start, which is in a different region.
  Object.assign(game.player, SPAWNS.scout);
  assert.equal(discover(game).filter((f) => f.kind === 'region')[0].id, 'pinefall');
  assert.deepEqual(game.discovered, ['lagoon', 'pinefall']);
});
