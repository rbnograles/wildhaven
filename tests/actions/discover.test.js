import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { discover } from '../../src/actions/discover.js';

test('locations are discovered once when entered', () => {
  const game=createGame('survivor');
  assert.equal(discover(game).length,1);
  assert.equal(discover(game).length,0);
  const builder=createGame('builder');
  game.player.x=builder.player.x; game.player.y=builder.player.y;
  assert.equal(discover(game).length,1);
  assert.equal(game.discovered.length,2);
});
