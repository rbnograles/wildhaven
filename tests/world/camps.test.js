// Checks the questions the game asks about camps: how far a fire's warmth reaches, which fire is
// closest, whether the player is warm, and what a new camp is called. Warmth and passing out both
// depend on these answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRE_RADIUS,
  FIRE_GROWTH,
  MAX_GROWN,
  CAMP_REACH,
  CAMP_NAME_MAX,
} from '../../src/data/balance.js';
import { isWalkable, OBJECT_SPECS } from '../../src/world/map.js';
import { createGame } from '../../src/game/state.js';
import {
  fireRadius,
  nearestCamp,
  byFire,
  campInReach,
  fireBase,
  campBases,
  suggestCampName,
  cleanCampName,
} from '../../src/world/camps.js';

/**
 * Adds a bare camp to a game, for the camp tests.
 *
 * @param {object} game - The game to add it to.
 * @param {string} id - The camp's id, such as 'camp-1'.
 * @param {string} name - The camp's name.
 * @param {number} x - World x of its fire.
 * @param {number} y - World y of its fire.
 * @returns {object} The camp that was added.
 */
function addCamp(game, id, name, x, y) {
  const camp = { id, name, x, y, grown: 0, needs: [] };
  game.camps.push(camp);
  return camp;
}

// Guards the warmth radius and its growth cap, which set how far a camp's safe zone reaches.
test('a fire warms 260 units, 40 more per need met, up to 660', () => {
  assert.equal(FIRE_RADIUS, 260);
  assert.equal(fireRadius({ grown: 0 }), FIRE_RADIUS);
  assert.equal(fireRadius({ grown: 3 }), FIRE_RADIUS + 3 * FIRE_GROWTH);
  assert.equal(fireRadius({ grown: MAX_GROWN }), 660);
});

// Guards which fire counts: the nearest one is found, and warmth stops at the edge of its reach.
test("the nearest camp is found, and the player is warm only inside a fire's reach", () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  assert.equal(nearestCamp(game), null);
  assert.equal(byFire(game), false);

  const near = addCamp(game, 'camp-1', 'Near', x + 200, y);
  addCamp(game, 'camp-2', 'Far', x + 5000, y);
  assert.equal(nearestCamp(game), near);
  assert.equal(byFire(game), true);

  game.player.x = x - 100; // 300 units from the near fire
  assert.equal(byFire(game), false);
  near.grown = 1; // now it reaches 300
  assert.equal(byFire(game), true);
});

// Guards the short reach for opening a camp, so E at the edge of the warmth doesn't open it.
test('a camp can be opened only from close by', () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  const camp = addCamp(game, 'camp-1', 'Pinefall Camp', x, y + CAMP_REACH - 1);
  assert.equal(campInReach(game), camp);
  camp.y = y + CAMP_REACH + 1;
  assert.equal(campInReach(game), null);
});

// Guards the fire's solid base: it blocks walking like a tree, sized by the campfire footprint
// (30 wide each side and 45 deep) times the fire's draw scale.
test('a camp fire is solid, sized by the campfire footprint', () => {
  const game = createGame('scout'),
    { x, y } = game.player,
    s = OBJECT_SPECS.campfire.scale ?? 1;
  addCamp(game, 'camp-1', 'Pinefall Camp', x, y + 30);
  assert.deepEqual(fireBase(x, y + 30), [x - 30 * s, y + 30 - 45 * s, x + 30 * s, y + 30]);
  assert.deepEqual(campBases(game), [fireBase(x, y + 30)]);
  assert.ok(isWalkable(x, y));
  assert.equal(isWalkable(x, y, campBases(game)), false);
});

// Guards camp names: the region's first word plus "Camp", numbered when taken, and tidied input.
test('suggested names come from the region and never repeat; typed names are tidied', () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  assert.equal(suggestCampName(game, x, y), 'Pinefall Camp');
  addCamp(game, 'camp-1', 'Pinefall Camp', x, y);
  assert.equal(suggestCampName(game, x, y), 'Pinefall Camp 2');

  assert.equal(cleanCampName('  Home   Fire  '), 'Home Fire');
  assert.equal(cleanCampName('x'.repeat(40)).length, CAMP_NAME_MAX);
  assert.equal(cleanCampName('   '), '');
  assert.equal(cleanCampName(undefined), '');
});
