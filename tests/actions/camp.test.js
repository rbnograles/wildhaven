// Checks the camp actions (give to a need, eat, heal, brew tea, rest) and passing out. Each one
// spends resources or moves the clock, so a slip here would cost the player supplies or time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_SECONDS,
  MIDDAY,
  FOOD_HUNGER,
  HEAL_HERBS,
  HEAL_HEALTH,
  TEA_HERBS,
  TEA_SECONDS,
  WAKE_HEALTH,
  WAKE_OFFSET,
} from '../../src/data/balance.js';
import { WRECKS } from '../../src/data/places.js';
import { createGame } from '../../src/game/state.js';
import { giveToNeed, eat, heal, brewTea, rest, passOut } from '../../src/actions/camp.js';

/**
 * Makes a scout's game with one camp right where the player stands. Its first need asks for 3 stone.
 *
 * @returns {{game: object, camp: object}} The game and its camp.
 */
function campGame() {
  const game = createGame('scout');
  const camp = {
    id: 'camp-1',
    name: 'Pinefall Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [
      { kind: 'bring', resource: 'stone', amount: 3, done: false },
      { kind: 'place', region: 'frostpeak', done: false },
      { kind: 'signpost', done: false },
    ],
  };
  game.camps.push(camp);
  return { game, camp };
}

// Guards eating: one food buys 25 hunger (never past full), and refusals spend nothing.
test('eating spends one food for 25 hunger, but not when full or out of food', () => {
  const { game } = campGame(); // the scout carries 3 food
  assert.deepEqual(eat(game), { ok: false, reason: 'full' });
  game.meters.hunger = 50;
  assert.deepEqual(eat(game), { ok: true });
  assert.equal(game.meters.hunger, 50 + FOOD_HUNGER);
  assert.equal(game.resources.food, 2);

  game.meters.hunger = 90;
  eat(game);
  assert.equal(game.meters.hunger, 100);

  game.resources.food = 0;
  game.meters.hunger = 10;
  assert.deepEqual(eat(game), { ok: false, reason: 'empty' });
  assert.equal(game.meters.hunger, 10);
});

// Guards healing with herbs.
test('healing spends three herbs for 30 health, but not at full health or with too few herbs', () => {
  const { game } = campGame();
  game.resources.herbs = HEAL_HERBS;
  assert.deepEqual(heal(game), { ok: false, reason: 'full' });
  game.meters.health = 40;
  assert.deepEqual(heal(game), { ok: true });
  assert.equal(game.meters.health, 40 + HEAL_HEALTH);
  assert.equal(game.resources.herbs, 0);
  assert.deepEqual(heal(game), { ok: false, reason: 'short' });
});

// Guards tea: brewed only at a camp, for five herbs, one cup at a time.
test('tea is brewed at a camp for five herbs, one cup at a time', () => {
  const { game } = campGame();
  game.resources.herbs = TEA_HERBS * 2;
  assert.deepEqual(brewTea(game), { ok: true });
  assert.equal(game.tea, TEA_SECONDS);
  assert.equal(game.resources.herbs, TEA_HERBS);
  assert.deepEqual(brewTea(game), { ok: false, reason: 'active' });

  game.tea = 0;
  game.player.x += 1000;
  assert.deepEqual(brewTea(game), { ok: false, reason: 'away' });
  game.player.x -= 1000;
  game.resources.herbs = TEA_HERBS - 1;
  assert.deepEqual(brewTea(game), { ok: false, reason: 'short' });
});

// Guards giving: the exact amount is spent once, the need is met and the camp grows.
test('giving to a need spends the amount, meets the need and grows the camp', () => {
  const { game, camp } = campGame();
  game.resources.stone = 2;
  assert.deepEqual(giveToNeed(game, camp.id, 0), { ok: false, reason: 'short' });

  game.resources.stone = 5;
  const result = giveToNeed(game, camp.id, 0);
  assert.equal(result.ok, true);
  assert.equal(result.need, camp.needs[0]);
  assert.equal(game.resources.stone, 2);
  assert.equal(camp.needs[0].done, true);
  assert.equal(camp.grown, 1);

  assert.deepEqual(giveToNeed(game, camp.id, 0), { ok: false, reason: 'unknown' });
  assert.deepEqual(giveToNeed(game, camp.id, 1), { ok: false, reason: 'unknown' }); // finding needs can't be given
  assert.deepEqual(giveToNeed(game, 'camp-9', 0), { ok: false, reason: 'unknown' });
});

// Guards resting: only at a camp, only from dusk, and it ends at dawn, rested.
test('resting is allowed at a camp from dusk and wakes the player rested at dawn', () => {
  const { game } = campGame();
  game.time = 100;
  assert.deepEqual(rest(game), { ok: false, reason: 'day' });

  game.time = 300;
  Object.assign(game.meters, { health: 20, warmth: 30, hunger: 50 });
  const result = rest(game);
  assert.equal(result.ok, true);
  assert.equal(game.time, DAY_SECONDS);
  assert.equal(game.meters.health, 100);
  assert.equal(game.meters.warmth, 100);
  assert.ok(game.meters.hunger < 50);
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ['dawn'],
  );

  game.time = 300 + DAY_SECONDS;
  game.player.x += 1000;
  assert.deepEqual(rest(game), { ok: false, reason: 'away' });
});

// Guards passing out: wake beside the nearest fire at the next midday, with nothing taken away.
test('passing out wakes the player beside the nearest fire at the next midday', () => {
  const { game, camp } = campGame();
  game.time = 300;
  game.resources.wood = 7;
  game.tea = 4;
  game.player.x += 2000; // fell far from camp

  const result = passOut(game);
  assert.equal(result.camp, camp);
  assert.equal(game.time, DAY_SECONDS + MIDDAY);
  assert.ok(Math.hypot(game.player.x - camp.x, game.player.y - camp.y) <= WAKE_OFFSET);
  assert.equal(game.meters.health, WAKE_HEALTH);
  assert.equal(game.meters.warmth, 100);
  assert.equal(game.tea, 0);
  assert.equal(game.resources.wood, 7);
  assert.equal(game.camps.length, 1);
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ['dawn'],
  );
});

// Guards the no-camp case: without a fire, the player wakes at their starting spot.
test('passing out with no camp wakes the player at their spawn', () => {
  const game = createGame('survivor');
  const spawn = { ...game.player };
  game.time = 300;
  game.player.x += 500;
  assert.equal(passOut(game).camp, null);
  assert.equal(game.player.x, spawn.x);
  assert.equal(game.player.y, spawn.y);
});

// Guards passing out at sea: the player wakes on foot by their fire, and the empty boat drifts
// back to its home mooring by the old boat it was mended from.
test('passing out in the boat wakes the player ashore and sends the boat home', () => {
  const { game, camp } = campGame();
  const wreck = WRECKS.find((w) => w.id === 'wreck-east');
  game.time = 300;
  game.boat = { from: wreck.id, x: wreck.launch.x + 400, y: wreck.launch.y, dir: 2 };
  game.aboard = true;
  Object.assign(game.player, { x: game.boat.x, y: game.boat.y, direction: 2 });

  const result = passOut(game);
  assert.equal(result.camp, camp);
  assert.equal(result.boatHome, true);
  assert.equal(game.aboard, false);
  assert.ok(Math.hypot(game.player.x - camp.x, game.player.y - camp.y) <= WAKE_OFFSET);
  assert.deepEqual(game.boat, { from: wreck.id, x: wreck.launch.x, y: wreck.launch.y, dir: 2 });
});

// Guards passing out on foot with a boat moored somewhere: the boat stays where it was left.
test('passing out on foot leaves a moored boat where it is', () => {
  const { game } = campGame();
  const wreck = WRECKS.find((w) => w.id === 'wreck-east');
  game.time = 300;
  game.boat = { from: wreck.id, x: wreck.launch.x + 400, y: wreck.launch.y, dir: 2 };
  const moored = { ...game.boat };

  assert.equal(passOut(game).boatHome, false);
  assert.equal(game.aboard, false);
  assert.deepEqual(game.boat, moored);
});
