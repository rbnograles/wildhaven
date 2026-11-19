// Checks gathering: standing near a supply, pressing E, waiting for the action, and getting the
// goods. These rules decide what ends up in the player's backpack, so mistakes here would hand
// out free supplies or swallow earned ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER_SECONDS, SUPPLY_REGROW, TOOL_SECONDS } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import {
  nearbyNode,
  lockedNode,
  isAvailable,
  beginGather,
  finishGather,
  gatherTime,
} from '../../src/actions/gather.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';

/** The wild flower patches: herb nodes that grow back after being picked. */
const wild = NODES.filter((n) => n.sprite === 'flowers');

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

  assert.equal(finishGather(game, node.id)?.id, node.id);
  assert.equal(game.resources.herbs, node.amount);

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
    duration: TOOL_SECONDS.stone, // the Scout's hatchet is a stone axe
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

  assert.equal(advanceAnimation(animator, gatherTime(game, node) - 0.01, {}), null);
  assert.deepEqual(advanceAnimation(animator, 0.02, {}), { clip: node.clip, target: 'pine-wood' });
  assert.equal(finishGather(game, 'pine-wood').id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount);
});

// Guards the axe rule: a tree in reach can't be chopped without one, and is reported as locked instead.
test('a tree needs an axe: without one it is locked, with one it can be chopped', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const game = createGame('survivor'); // no tools
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  assert.equal(nearbyNode(game), null);
  assert.equal(lockedNode(game)?.id, 'pine-wood');
  assert.equal(finishGather(game, 'pine-wood'), null);

  game.tools.axe = { tier: 'stone', uses: 5 };
  assert.equal(nearbyNode(game)?.id, 'pine-wood');
  assert.notEqual(lockedNode(game)?.id, 'pine-wood'); // a rock nearby may still need a pickaxe
  assert.equal(finishGather(game, 'pine-wood')?.id, 'pine-wood');
});

// Guards gather times: bare hands keep the full 6 s, a stone tool takes 5 s and an iron one 3 s.
test('tools shorten the gathers that need them, and only those', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood'),
    berries = NODES.find((n) => n.id === 'forest-food');
  const game = createGame('survivor');
  assert.equal(gatherTime(game, berries), GATHER_SECONDS);
  game.tools.axe = { tier: 'stone', uses: 5 };
  assert.equal(gatherTime(game, pine), TOOL_SECONDS.stone);
  game.tools.axe = { tier: 'iron' };
  assert.equal(gatherTime(game, pine), TOOL_SECONDS.iron);
  assert.equal(gatherTime(game, berries), GATHER_SECONDS);
});

// Guards the map's trees and rocks: with the right tool they give their wood, stone or iron.
test('map trees and iron rocks can be gathered with the right tool', () => {
  const game = createGame('survivor');
  game.tools = { axe: { tier: 'iron' }, pickaxe: { tier: 'iron' } };
  for (const sprite of ['big-oak', 'boulder', 'cliff-rock']) {
    const node = NODES.find((n) => n.sprite === sprite && n.inScenery);
    Object.assign(game.player, { x: node.x, y: node.y + 30 });
    const before = game.resources[node.type];
    assert.equal(finishGather(game, node.id)?.id, node.id, sprite);
    assert.equal(game.resources[node.type], before + node.amount, sprite);
  }
  assert.ok(game.resources.iron >= 1);
});
