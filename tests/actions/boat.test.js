// Checks the boat actions: repairing an old boat, getting in, rowing and stepping ashore.
// They decide whether the player can reach the islets at all and what the repair costs, so a
// mistake could strand a player or take their wood twice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WRECKS } from '../../src/data/places.js';
import { REPAIR_COST, REPAIR_SECONDS } from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';
import {
  nearbyWreck,
  missingForRepair,
  listMissing,
  beginRepair,
  finishRepair,
} from '../../src/actions/boat.js';

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');

/**
 * Makes a game whose player stands just south of the lagoon's old boat with exactly enough wood
 * and stone to repair it.
 *
 * @returns {object} The game state.
 */
function besideWreck() {
  const game = createGame('survivor');
  Object.assign(game.player, { x: east.x, y: east.y + 30 });
  game.resources.wood = REPAIR_COST.wood;
  game.resources.stone = REPAIR_COST.stone;
  return game;
}

// Guards who can repair: only a player on foot, next to the old boat, who has no boat yet.
test('an old boat is in reach only from beside it, and only without a boat', () => {
  assert.equal(nearbyWreck(besideWreck())?.id, 'wreck-east');
  assert.equal(nearbyWreck(createGame('survivor')), null); // the start is too far away

  const owner = besideWreck();
  owner.boat = { from: 'wreck-north', x: 0, y: 0, dir: 0 };
  assert.equal(nearbyWreck(owner), null);
});

// Guards the shopping list: it names only what is short, and a short backpack can't start a repair.
test('a repair says what is missing and will not start without it', () => {
  const game = besideWreck(),
    animator = createAnimator();
  game.resources.wood = 2;
  assert.deepEqual(missingForRepair(game), { wood: 4 });
  assert.equal(listMissing({ wood: 4, stone: 1 }), '4 wood and 1 stone');

  assert.deepEqual(beginRepair(game, animator), {
    ok: false,
    reason: 'missing',
    wreck: east,
    missing: { wood: 4 },
  });
  assert.equal(animator.pending, null);
});

// Guards the repair's timing and price: E only starts the hammering, and the wood and stone are
// paid once, when it finishes, with the boat floating at the launch spot pointing out to sea.
test('a repair takes REPAIR_SECONDS, pays exactly once and floats the boat at its launch', () => {
  const game = besideWreck(),
    animator = createAnimator();

  assert.equal(beginRepair(game, animator).ok, true);
  assert.deepEqual(animator.pending, {
    clip: 'build',
    target: 'wreck-east',
    duration: REPAIR_SECONDS,
  });
  assert.equal(game.resources.wood, REPAIR_COST.wood);

  assert.equal(advanceAnimation(animator, REPAIR_SECONDS - 0.01, {}), null);
  assert.deepEqual(advanceAnimation(animator, 0.02, {}), { clip: 'build', target: 'wreck-east' });
  assert.equal(finishRepair(game, 'wreck-east'), east);
  assert.deepEqual([game.resources.wood, game.resources.stone], [0, 0]);
  assert.deepEqual(game.boat, { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 2 });

  assert.equal(finishRepair(game, 'wreck-east'), null);
  assert.deepEqual([game.resources.wood, game.resources.stone], [0, 0]);
});

// Guards against paying for nothing: walking off or spending the wood mid-repair means no boat.
test('a repair is not paid when the player walked away or no longer has enough', () => {
  const away = besideWreck();
  away.player.y += 400;
  assert.equal(finishRepair(away, 'wreck-east'), null);
  assert.equal(away.boat, null);

  const spent = besideWreck();
  spent.resources.stone = 1;
  assert.equal(finishRepair(spent, 'wreck-east'), null);
  assert.equal(spent.resources.wood, REPAIR_COST.wood);
});
