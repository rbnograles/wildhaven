// Checks the boat actions: repairing an old boat, getting in, rowing and stepping ashore.
// They decide whether the player can reach the islets at all and what the repair costs, so a
// mistake could strand a player or take their wood twice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WRECKS } from '../../src/data/places.js';
import {
  REPAIR_COST,
  REPAIR_SECONDS,
  WALK_SPEED,
  BOAT_SPEED,
  BOAT_FAST_SPEED,
} from '../../src/data/balance.js';
import { isWalkable, isSailable } from '../../src/world/map.js';
import { solidBases } from '../../src/world/nodes.js';
import { movePlayer } from '../../src/actions/move.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';
import {
  nearbyWreck,
  missingForRepair,
  listMissing,
  beginRepair,
  finishRepair,
  canBoard,
  board,
  landingSpot,
  disembark,
  deepAhead,
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

/**
 * Makes a game whose player sits in their boat at an old boat's launch spot.
 *
 * @param {object} wreck - The old boat the boat was repaired from.
 * @returns {object} The game state.
 */
function afloat(wreck) {
  const game = createGame('survivor');
  game.boat = { from: wreck.id, x: wreck.launch.x, y: wreck.launch.y, dir: 2 };
  game.aboard = true;
  Object.assign(game.player, { x: wreck.launch.x, y: wreck.launch.y, direction: 2 });
  return game;
}

// Guards getting in: only next to your own boat, only on foot, and the player ends up in it.
test('boarding works only near your own boat and puts the player in it', () => {
  const game = createGame('survivor');
  Object.assign(game.player, { x: east.launch.x - 120, y: east.launch.y });
  assert.equal(board(game), false); // no boat yet

  game.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  assert.ok(canBoard(game));
  assert.ok(board(game));
  assert.deepEqual(
    [game.player.x, game.player.y, game.player.direction, game.aboard],
    [east.launch.x, east.launch.y, 2, true],
  );
  assert.equal(board(game), false); // already in it

  const far = createGame('survivor');
  far.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  assert.equal(canBoard(far), false);
});

// Guards every old boat's beach: from each launch spot the player can step ashore onto solid
// ground, and from there get back in.
test('by every old boat, the player can step ashore and get back in', () => {
  for (const wreck of WRECKS) {
    const game = afloat(wreck);
    assert.ok(disembark(game), `${wreck.id}: no beach in reach`);
    assert.equal(game.aboard, false);
    assert.ok(isWalkable(game.player.x, game.player.y, solidBases(game)), wreck.id);
    assert.deepEqual([game.boat.x, game.boat.y], [wreck.launch.x, wreck.launch.y]);
    assert.ok(board(game), `${wreck.id}: boat out of reach from the beach`);
  }
});

// Guards the boat's water: it rows across shallow sea, deep water stops it (with a warning ahead),
// and the shallows stop it short of the sand. The boat always stays under the player.
test('the boat sails only on shallow sea: deep water and the beach stop it', () => {
  const game = afloat(east);
  for (let i = 0; i < 600; i++) movePlayer(game, 1, 0, 0.1);
  assert.ok(isSailable(game.player.x, game.player.y));
  assert.ok(deepAhead(game, 1, 0));
  assert.deepEqual([game.boat.x, game.boat.y], [game.player.x, game.player.y]);

  for (let i = 0; i < 900; i++) movePlayer(game, -1, 0, 0.1);
  assert.ok(isSailable(game.player.x, game.player.y));
  assert.ok(game.player.x > east.x);
  assert.equal(deepAhead(game, -1, 0), false);
  assert.equal(deepAhead(createGame('scout'), 1, 0), false); // on foot there is no warning
});

// Guards the boat's speed: faster than walking, and faster again with Shift.
test('the boat is faster than walking, and faster again with Shift', () => {
  const slow = afloat(east),
    fast = afloat(east);
  movePlayer(slow, 1, 0, 0.1);
  movePlayer(fast, 1, 0, 0.1, true);
  assert.ok(Math.abs(slow.player.x - east.launch.x - BOAT_SPEED * 0.1) < 0.001);
  assert.ok(Math.abs(fast.player.x - east.launch.x - BOAT_FAST_SPEED * 0.1) < 0.001);
  assert.ok(BOAT_SPEED > WALK_SPEED);
});

// Guards landing out at sea: with no land in reach, the player stays in the boat.
test('far from land there is nowhere to step ashore', () => {
  const game = afloat(east);
  for (let i = 0; i < 600; i++) movePlayer(game, 1, 0, 0.1);
  assert.equal(landingSpot(game), null);
  assert.equal(disembark(game), false);
  assert.equal(game.aboard, true);
});
