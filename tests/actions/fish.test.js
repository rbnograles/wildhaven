// Checks fishing: it needs the rod, casts near the player, and lands food. A slip here could hand
// out free fish with no rod, or fish into a bag that has no room.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FISH_FOOD } from '../../src/data/balance.js';
import { FISH_PREFIX } from '../../src/actions/fish.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import { hasRod, beginFish, finishFish } from '../../src/actions/fish.js';
import { tidyBag } from '../../src/world/bag.js';

// Guards the rod gate and the catch: no rod means no fishing, and a cast with a rod lands food.
test('fishing needs the rod and lands food beside the player', () => {
  const game = createGame('scout');
  const animator = createAnimator();
  const spot = { x: game.player.x + 40, y: game.player.y + 40 };

  assert.equal(hasRod(game), false);
  assert.equal(beginFish(game, animator, spot).reason, 'tool');

  game.rod = true;
  const food = game.resources.food;
  assert.equal(beginFish(game, animator, spot).ok, true);
  const done = finishFish(game, `${FISH_PREFIX}${spot.x}:${spot.y}`);
  assert.deepEqual(done, { kind: 'fish', food: FISH_FOOD });
  assert.equal(game.resources.food, food + FISH_FOOD);
});

// Guards the bag check: a full bag catches nothing instead of overflowing.
test('fishing with a full bag catches nothing', () => {
  const game = createGame('scout');
  game.rod = true;
  const animator = createAnimator();
  const spot = { x: game.player.x, y: game.player.y };

  // Ten different kinds (not food) fill all ten open slots, so a fish has nowhere to go.
  const kinds = [
    'wood',
    'stone',
    'herbs',
    'iron',
    'feather',
    'pinecone',
    'antler',
    'copper',
    'gold',
    'diamond',
  ];
  game.resources.food = 0;
  for (const kind of kinds) game.resources[kind] = 1;
  tidyBag(game);

  assert.equal(beginFish(game, animator, spot).reason, 'full');
});
