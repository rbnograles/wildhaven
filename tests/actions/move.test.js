// Checks walking: how far one step goes, and what the player can't walk through.
// If these rules break, players could zip faster on diagonals, leave the map, or get stuck.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, CLIFF_GAP, isWalkable } from '../../src/world/map.js';
import { RUN_SPEED, MAX_MOVE_DT } from '../../src/data/balance.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

// Guards against diagonal steps being longer than straight ones (an old trick to move faster),
// and against walking off the edge of the world.
test('diagonal movement is normalized and world edges cannot be crossed', () => {
  const a = createGame('scout'),
    b = createGame('scout');
  const origin = { ...a.player };

  // One step east and one step south-east should cover the same distance.
  movePlayer(a, 1, 0, 0.1);
  movePlayer(b, 1, 1, 0.1);
  assert.ok(
    Math.abs(
      Math.hypot(a.player.x - origin.x, a.player.y - origin.y) -
        Math.hypot(b.player.x - origin.x, b.player.y - origin.y),
    ) < 0.001,
  );

  // Walk north-west for a long time; the player must stop at the world's edge on solid ground.
  for (let i = 0; i < 500; i++) movePlayer(a, -1, -1, 0.1);
  assert.ok(a.player.x >= WORLD.margin && a.player.y >= WORLD.margin);
  assert.ok(isWalkable(a.player.x, a.player.y));
});

// Guards two rules about a supply's solid base: it blocks the way until gathered, and a player
// who somehow starts inside it can still walk out instead of being stuck forever.
test('supply bases block movement until gathered, and never trap a player already inside', () => {
  const node = NODES.find((n) => n.id === 'pine-wood');
  assert.ok(isWalkable(node.x, node.y - 5));
  assert.equal(isWalkable(node.x, node.y - 5, nodeBases([])), false);
  assert.ok(isWalkable(node.x, node.y - 5, nodeBases(['pine-wood'])));

  const game = createGame('scout');
  game.player.x = node.x;
  game.player.y = node.y - 5;
  assert.ok(movePlayer(game, -1, 0, 0.1)); // e.g. a save made before the tree stood here
});

// Guards the cliff edges against a fast runner: even at running speed with the longest step the
// game allows, one step must never carry the player from one level of a hill onto another. The
// blocked strip is CLIFF_GAP wide on each side of an edge, so a step must be shorter than both.
test('running at full speed never jumps an edge between two levels', () => {
  const step = RUN_SPEED * MAX_MOVE_DT;
  assert.ok(
    step < 2 * CLIFF_GAP,
    `a run step (${step}) must be shorter than the blocked strip (${2 * CLIFF_GAP})`,
  );
});
