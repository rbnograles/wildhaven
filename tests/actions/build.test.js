// Checks placing a campfire: where one may stand, what it costs, and naming the camp it founds.
// A wrong rule here could charge for a fire that never appears, or let fires block the paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPFIRE_COST, CAMP_SPACING, PLACE_RANGE, MAX_CAMPS } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { isWalkable } from '../../src/world/map.js';
import { createGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';
import { checkPlacement, placeCampfire, nameCamp } from '../../src/actions/build.js';

/**
 * Finds spots near the player where a campfire may stand, trying points on rings around them.
 *
 * @param {object} game - The game being played.
 * @param {number} [count=1] - How many spots to find; each is at least 200 units from the others.
 * @returns {{x: number, y: number}[]} The spots found.
 */
function openSpots(game, count = 1) {
  const spots = [];
  for (let r = 120; r <= PLACE_RANGE && spots.length < count; r += 30)
    for (let a = 0; a < 360 && spots.length < count; a += 15) {
      const x = Math.round(game.player.x + r * Math.cos((a * Math.PI) / 180)),
        y = Math.round(game.player.y + r * Math.sin((a * Math.PI) / 180));
      const apart = spots.every((s) => Math.hypot(s.x - x, s.y - y) >= 200);
      if (apart && checkPlacement(game, x, y).ok) spots.push({ x, y });
    }
  assert.equal(spots.length, count, 'not enough open ground near the player');
  return spots;
}

// Guards the price: a fire can't be placed without 3 wood and 2 stone, and nothing is spent.
test('placing is refused without the wood and stone, and nothing is spent', () => {
  const game = createGame('scout'); // starts with no wood or stone
  const check = checkPlacement(game, game.player.x, game.player.y + 150);
  assert.equal(check.reason, 'cost');
  assert.equal(check.message, 'Needs 3 wood and 2 stone');
  assert.equal(placeCampfire(game, game.player.x, game.player.y + 150).ok, false);
  assert.deepEqual(game.camps, []);
  assert.equal(game.resources.wood, 0);
});

// Guards placing at a distance and on top of things: too far, on the player, or on a supply.
test('placing is refused too far away, on the player, or on a supply', () => {
  const game = createGame('builder'); // 5 wood, 2 stone
  assert.equal(checkPlacement(game, game.player.x + PLACE_RANGE + 1, game.player.y).reason, 'far');
  assert.equal(checkPlacement(game, game.player.x, game.player.y + 30).reason, 'blocked');

  const supply = NODES.find((n) => n.id === 'village-wood');
  game.player.x = supply.x;
  game.player.y = supply.y + 100;
  assert.equal(checkPlacement(game, supply.x + 20, supply.y).reason, 'blocked');
});

// Guards the happy path: the cost is paid once, and the camp has an id, a name and three needs.
test('a placed campfire founds a named camp and charges the cost once', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  const result = placeCampfire(game, spot.x, spot.y);

  assert.equal(result.ok, true);
  assert.deepEqual(game.resources, {
    wood: 5 - CAMPFIRE_COST.wood,
    stone: 2 - CAMPFIRE_COST.stone,
    food: 2,
    herbs: 0,
    iron: 0,
    feather: 0,
    pinecone: 0,
    antler: 0,
  });
  assert.equal(game.camps.length, 1);
  assert.equal(result.camp.id, 'camp-1');
  assert.equal(result.camp.name, 'Hollowstead Camp');
  assert.equal(result.camp.needs.length, 3);
  assert.equal(placeCampfire(game, spot.x, spot.y).ok, false); // no stone left
});

// Guards the spacing rule: a second camp must be a meaningful walk from the first.
test('a second camp is refused near the first and allowed far away', () => {
  const game = createGame('builder');
  game.resources.wood = 20;
  game.resources.stone = 20;
  const [a, b] = openSpots(game, 2);
  placeCampfire(game, a.x, a.y);
  const check = checkPlacement(game, b.x, b.y);
  assert.equal(check.reason, 'close');
  assert.equal(check.message, 'Too close to Hollowstead Camp');

  // The scout's start is more than CAMP_SPACING from the village.
  Object.assign(game.player, createGame('scout').player);
  const [c] = openSpots(game);
  const second = placeCampfire(game, c.x, c.y);
  assert.equal(second.camp.id, 'camp-2');
  assert.ok(Math.hypot(c.x - a.x, c.y - a.y) >= CAMP_SPACING);
});

// Guards the save limit, so a save never holds more camps than the loader accepts.
test('placing is refused once the camp limit is reached', () => {
  const game = createGame('builder'),
    far = createGame('scout').player;
  for (let i = 1; i <= MAX_CAMPS; i++)
    game.camps.push({
      id: `camp-${i}`,
      name: `Camp ${i}`,
      x: far.x,
      y: far.y,
      grown: 0,
      needs: [],
    });
  assert.equal(checkPlacement(game, game.player.x, game.player.y + 150).reason, 'limit');
});

// Guards naming: a typed name replaces the suggestion; a blank name or unknown camp is refused.
test('a camp can be renamed with a tidied name, but not to nothing', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  const { camp } = placeCampfire(game, spot.x, spot.y);

  assert.deepEqual(nameCamp(game, camp.id, '  Ember   Hollow '), { ok: true, camp });
  assert.equal(camp.name, 'Ember Hollow');
  assert.deepEqual(nameCamp(game, camp.id, '   '), { ok: false, reason: 'empty' });
  assert.equal(camp.name, 'Ember Hollow');
  assert.deepEqual(nameCamp(game, 'camp-9', 'Nowhere'), { ok: false, reason: 'unknown' });
});

// Guards movement: a fire stops the player like a tree does. The same step is free without it.
test('the player cannot walk through a camp fire', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  const below = { x: spot.x, y: spot.y + 12, direction: 0 };

  const free = createGame('builder');
  free.player = { ...below };
  assert.ok(movePlayer(free, 0, -1, 0.1)); // the ground where the fire will stand is open

  placeCampfire(game, spot.x, spot.y);
  game.player = { ...below };
  assert.equal(movePlayer(game, 0, -1, 0.1), false);
});

// Guards building from the water: in the boat a campfire is refused with a reason (even with the
// wood and stone, and even on open ground in reach), and nothing is spent.
test('a campfire cannot be placed while the player is in the boat', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  game.boat = { from: 'wreck-east', x: game.player.x, y: game.player.y, dir: 0 };
  game.aboard = true;

  const check = checkPlacement(game, spot.x, spot.y);
  assert.deepEqual(check, { ok: false, reason: 'aboard', message: 'Step ashore to build' });
  assert.equal(placeCampfire(game, spot.x, spot.y).ok, false);
  assert.deepEqual(game.camps, []);
  assert.deepEqual([game.resources.wood, game.resources.stone], [5, 2]);
});

// Guards regrowth: a fire can't go where a chopped tree will grow back, or the tree would come
// back inside the fire.
test('a campfire cannot be placed where a chopped tree will grow back', () => {
  const tree = NODES.find((n) => n.inScenery && n.tool === 'axe' && isWalkable(n.x, n.y + 160));
  const game = createGame('builder');
  Object.assign(game.resources, { wood: 9, stone: 9 });
  Object.assign(game.player, { x: tree.x, y: tree.y + 160 });
  game.regrowAt[tree.id] = game.time + 100;
  assert.equal(checkPlacement(game, tree.x, tree.y).reason, 'blocked');
});
