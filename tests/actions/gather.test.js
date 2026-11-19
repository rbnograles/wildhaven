// Checks gathering: standing near a supply, pressing E, waiting for the action, and getting the
// goods. These rules decide what ends up in the player's backpack, so mistakes here would hand
// out free supplies or swallow earned ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER_SECONDS, SUPPLY_REGROW } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import {
  nearbyNode,
  isAvailable,
  hasGathered,
  beginGather,
  finishGather,
} from '../../src/actions/gather.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';

/** The wild flower patches: map scenery that can be picked and grows back quickly. */
const wild = NODES.filter((n) => n.id.startsWith('flowers-'));

// Guards against gathering from across the map, against taking the same pine tree twice in a row,
// and against a chopped tree never coming back (supplies regrow after two in-game days).
test('gathering is proximity based, and a gathered supply is gone until it grows back', () => {
  const game = createGame('scout'),
    node = NODES.find((n) => n.id === 'pine-wood');
  assert.equal(finishGather(game), null); // nothing is within reach of the camp spawn

  game.player.x = node.x;
  game.player.y = node.y + 40;
  assert.equal(finishGather(game)?.id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount);

  assert.equal(finishGather(game), null);
  assert.equal(finishGather(game, 'pine-wood'), null);
  assert.equal(finishGather(game, 'camp-stone'), null); // named, but out of reach

  game.time += SUPPLY_REGROW - 1;
  assert.equal(finishGather(game, 'pine-wood'), null);
  game.time += 1;
  assert.equal(finishGather(game, 'pine-wood')?.id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount * 2);
});

// Guards the flower life cycle: picking gives herbs, the patch is gone for a while, and it comes
// back exactly when the game clock reaches its regrow time (not a moment before).
test('a picked flower patch gives herbs, then grows back on the game clock', () => {
  const game = createGame('scout'),
    node = wild[0];
  game.player.x = node.x;
  game.player.y = node.y;

  assert.equal(hasGathered(game), false);
  assert.equal(finishGather(game, node.id)?.id, node.id);
  assert.equal(game.resources.herbs, node.amount);
  assert.ok(hasGathered(game));

  // While it regrows, the patch can't be picked and isn't offered as the nearest thing to gather.
  assert.equal(finishGather(game, node.id), null);
  assert.notEqual(nearbyNode(game)?.id, node.id);

  game.time += node.regrow - 1;
  assert.equal(isAvailable(game, node), false);
  game.time += 1;
  assert.equal(isAvailable(game, node), true);

  assert.equal(finishGather(game, node.id)?.id, node.id);
  assert.equal(game.resources.herbs, node.amount * 2);
});

// Guards against pressing E paying out right away. E should only start the timed action.
test("beginGather starts the node's own timed action without awarding it", () => {
  const game = createGame('scout'),
    animator = createAnimator(),
    node = NODES.find((n) => n.id === 'pine-wood'),
    before = { ...game.resources };
  game.player.x = node.x - 60;
  game.player.y = node.y;

  const result = beginGather(game, animator);

  assert.equal(result.ok, true);
  assert.equal(result.node.id, 'pine-wood');
  assert.equal(animator.clip, node.clip);
  assert.deepEqual(animator.pending, {
    clip: node.clip,
    target: 'pine-wood',
    duration: GATHER_SECONDS,
  });
  assert.deepEqual(game.resources, before);
  assert.deepEqual(game.regrowAt, {});
});

// Guards against mashing E to stack actions, and against starting an action with nothing nearby.
test('beginGather refuses while an action is running, and when nothing is in reach', () => {
  const game = createGame('scout'),
    animator = createAnimator(),
    node = NODES.find((n) => n.id === 'pine-wood');
  game.player.x = node.x - 60;
  game.player.y = node.y;
  beginGather(game, animator);
  assert.deepEqual(beginGather(game, animator), { ok: false, reason: 'busy' });

  const far = createGame('scout'),
    idle = createAnimator(); // nothing is within reach of the camp spawn
  assert.deepEqual(beginGather(far, idle), { ok: false, reason: 'none' });
  assert.equal(idle.pending, null);
});

// Guards the facing rule: the player turns to face a supply beside them, but doesn't spin
// around when the supply is almost straight above or below.
test('beginGather turns the player toward a node that is off to the side', () => {
  const node = NODES.find((n) => n.id === 'pine-wood');

  const east = createGame('scout');
  east.player.x = node.x + 40;
  east.player.y = node.y;
  east.player.direction = 0;
  beginGather(east, createAnimator());
  assert.equal(east.player.direction, 1);

  const close = createGame('scout');
  close.player.x = node.x + 5;
  close.player.y = node.y + 30;
  close.player.direction = 3;
  beginGather(close, createAnimator());
  assert.equal(close.player.direction, 3);
});

// Guards the full flow: nothing a hair before the timer ends, then the supply once it does.
test('the supply is awarded only when the timed action completes', () => {
  const game = createGame('scout'),
    animator = createAnimator(),
    node = NODES.find((n) => n.id === 'pine-wood');
  game.player.x = node.x - 60;
  game.player.y = node.y;
  beginGather(game, animator);

  assert.equal(advanceAnimation(animator, GATHER_SECONDS - 0.01, {}), null);
  assert.deepEqual(advanceAnimation(animator, 0.02, {}), { clip: node.clip, target: 'pine-wood' });
  assert.equal(finishGather(game, 'pine-wood').id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount);
});
