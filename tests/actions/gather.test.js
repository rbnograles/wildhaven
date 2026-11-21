// Checks gathering: standing near a supply, pressing E, waiting for the action, and getting the
// goods. These rules decide what ends up in the player's backpack, so mistakes here would hand
// out free supplies or swallow earned ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GATHER_SECONDS,
  PICKUP_SECONDS,
  SUPPLY_REGROW,
  TOOL_SECONDS,
  SIZE_WEAR,
  ROCK_YIELD,
} from '../../src/data/balance.js';
import { HARVEST, WILD, sizedHarvest } from '../../src/data/supplies.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import {
  nearbyNode,
  lockedNode,
  isAvailable,
  beginGather,
  finishGather,
  gatherTime,
  toolWear,
  aimState,
} from '../../src/actions/gather.js';
import { finishInteraction } from '../../src/actions/interact.js';
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

// Guards rock sizes: a bigger rock must give more, take longer and wear a stone pickaxe more than
// a smaller one of the same kind, or the big boulders stop being worth their extra work.
test('a bigger rock gives more, takes longer to mine and wears the pickaxe more', () => {
  const game = createGame('survivor');
  game.tools.pickaxe = { tier: 'stone', uses: 25 };
  // The size mechanic is tested from the HARVEST data (the three sizes), so it does not depend on
  // which rock sizes a particular map happens to scatter (Spring draws only small and large rocks).
  const [small, medium, large] = ['beach-rock', 'rocks-a', 'boulder'].map((s) => HARVEST[s]);

  assert.deepEqual([small.size, medium.size, large.size], [1, 2, 3]);
  assert.ok(small.amount < medium.amount && medium.amount < large.amount);
  assert.equal(gatherTime(game, small), TOOL_SECONDS.stone);
  assert.ok(gatherTime(game, small) < gatherTime(game, medium));
  assert.ok(gatherTime(game, medium) < gatherTime(game, large));
  assert.deepEqual([small, medium, large].map(toolWear), SIZE_WEAR);
  for (const yields of Object.values(ROCK_YIELD))
    assert.ok(yields[0] < yields[1] && yields[1] < yields[2]);

  // A rock the map draws much smaller than usual is mined as the next size down.
  const boulder = HARVEST.boulder;
  assert.equal(sizedHarvest(boulder, 1), boulder);
  assert.deepEqual(
    [sizedHarvest(boulder, 0.7).size, sizedHarvest(boulder, 0.7).amount],
    [2, ROCK_YIELD.stone[1]],
  );
  assert.equal(sizedHarvest(HARVEST['beach-rock'], 0.5).size, 1); // nothing is smaller than small
  assert.equal(sizedHarvest(HARVEST.oak, 0.5), HARVEST.oak); // trees have no size

  // Mining a real boulder (size 3) on the map through the finish step costs the pickaxe three uses.
  const bigRock = NODES.find((n) => n.sprite === 'boulder' && n.inScenery && n.size === 3);
  Object.assign(game.player, { x: bigRock.x, y: bigRock.y + 30 });
  assert.equal(finishInteraction(game, bigRock.id)?.node, bigRock);
  assert.equal(game.tools.pickaxe.uses, 25 - SIZE_WEAR[2]);
});

// Guards the quick pick-ups: loose stones and sticks must be much faster than chopping, while
// picking berries keeps the full bare-hand time.
test('picking up small stones and sticks is quicker than chopping or picking berries', () => {
  const game = createGame('scout');
  // Spring scatters no beach driftwood, so sticks are the bare-hands wood here.
  for (const sprite of ['pebbles', 'sticks', 'grey-rock']) {
    const node = NODES.find((n) => n.sprite === sprite);
    assert.equal(gatherTime(game, node), PICKUP_SECONDS, sprite);
  }
  assert.ok(PICKUP_SECONDS < TOOL_SECONDS.iron);
  assert.equal(
    gatherTime(
      game,
      NODES.find((n) => n.sprite === 'wild-berries'),
    ),
    GATHER_SECONDS,
  );
});

// Guards the second herb source: wild herbs are picked like berries (the full bare-hand time, no
// tool) and give more than a flower patch, so they are worth walking to.
test('wild herbs are picked by hand for 3 herbs in the full hand-pick time', () => {
  const game = createGame('scout');
  const herbs = { id: 'wild-herbs-0-0', sprite: 'wild-herbs', ...WILD['wild-herbs'] };

  assert.deepEqual(
    [herbs.type, herbs.amount, herbs.tool, herbs.quick, herbs.regrow],
    ['herbs', 3, undefined, undefined, 180],
  );
  assert.equal(gatherTime(game, herbs), GATHER_SECONDS);
  assert.ok(herbs.amount > WILD.flowers.amount);
});

// Guards the map's trees and rocks: with the right tool they give their wood, stone or iron.
test('map trees and rocks can be gathered with the right tool', () => {
  const game = createGame('survivor');
  game.tools = { axe: { tier: 'iron' }, pickaxe: { tier: 'iron' } };
  // Spring has no iron-streaked rocks, so this checks a big tree and an ordinary boulder.
  for (const sprite of ['big-oak', 'boulder']) {
    const node = NODES.find((n) => n.sprite === sprite && n.inScenery);
    Object.assign(game.player, { x: node.x, y: node.y + 30 });
    const before = game.resources[node.type];
    assert.equal(finishGather(game, node.id)?.id, node.id, sprite);
    assert.equal(game.resources[node.type], before + node.amount, sprite);
  }
});

// Guards the mouse badge and the click: a click must only chop the tree it points at, and only
// when the player stands beside it with an axe, or a click could gather from across the screen.
test('a clicked tree is chopped only when it is in reach and the player has its tool', () => {
  const game = createGame('survivor'),
    tree = NODES.find((n) => n.inScenery && n.tool === 'axe'),
    animator = createAnimator();
  game.player.x = tree.x;
  game.player.y = tree.y + 60;

  // No axe yet: the badge says locked and a click starts nothing.
  assert.equal(aimState(game, tree), 'locked');
  assert.equal(beginGather(game, animator, tree.id).ok, false);

  // With an axe but far away, the tree is only pointed at.
  game.tools.axe = { tier: 'stone', uses: 5 };
  game.player.y = tree.y + 400;
  assert.equal(aimState(game, tree), 'far');
  assert.equal(beginGather(game, animator, tree.id).ok, false);

  // Beside it, the click starts the chop on that very tree.
  game.player.y = tree.y + 60;
  assert.equal(aimState(game, tree), 'ready');
  const started = beginGather(game, animator, tree.id);
  assert.equal(started.ok, true);
  assert.equal(animator.pending.target, tree.id);

  // A chopped tree, and any tree seen from the boat, gives no badge at all.
  game.regrowAt[tree.id] = game.time + 10;
  assert.equal(aimState(game, tree), null);
  delete game.regrowAt[tree.id];
  game.aboard = true;
  assert.equal(aimState(game, tree), null);
});
