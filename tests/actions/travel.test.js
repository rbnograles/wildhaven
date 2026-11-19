// Checks fast travel: the player may jump to a signpost they have found, and nowhere else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { travelTo } from '../../src/actions/travel.js';
import { isWalkable } from '../../src/world/map.js';
import { nodeBases } from '../../src/world/nodes.js';
import { WAYPOINTS, WRECKS } from '../../src/data/places.js';

// Guards the unlock rule: without it the whole world is reachable from the first second.
test('travel is refused to a signpost that has not been found, or does not exist', () => {
  const game = createGame('scout'),
    before = { ...game.player };

  assert.equal(travelTo(game, 'j-wp-temple'), null);
  assert.equal(travelTo(game, 'nowhere'), null);
  assert.deepEqual(game.player, before);
});

// Guards the arrival: the player lands on the signpost's spot, facing south, on open ground.
test('travel moves the player to a found signpost', () => {
  const game = createGame('scout');
  game.player.direction = 3;
  game.waypoints.push('j-wp-temple');

  const post = travelTo(game, 'j-wp-temple');
  assert.equal(post.name, 'Temple Path Signpost');
  assert.deepEqual(game.player, { x: post.x, y: post.y, direction: 0 });
});

// Guards against a signpost whose arrival spot is inside its own post or other scenery.
test('every signpost can be arrived at', () => {
  for (const w of WAYPOINTS) assert.ok(isWalkable(w.x, w.y, nodeBases([])), w.id);
});

// Guards signpost travel from the boat: the player arrives on foot and the boat stays where it floated.
test('travelling from the boat leaves the boat where it floats', () => {
  const east = WRECKS.find((w) => w.id === 'wreck-east');
  const game = createGame('survivor');
  game.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  game.aboard = true;
  Object.assign(game.player, east.launch);
  game.waypoints.push('l-wp-wreck');

  assert.ok(travelTo(game, 'l-wp-wreck'));
  assert.equal(game.aboard, false);
  assert.deepEqual(game.boat, { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 });
});
