// Checks surviving day and night: how warmth, hunger and health change with the hour and the
// fire, and which moments are reported to the player. These numbers decide whether the first
// night feels fair, so each rule is pinned here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_SECONDS,
  WARMTH_SECONDS,
  FREEZE_SECONDS,
  HUNGER_SECONDS,
  WARM_BY_FIRE,
  WARM_BY_DAY,
  HEAL_BY_FIRE,
  STARVING_COLD,
  TEA_SECONDS,
  SNOW_COLD,
  SNOW_NIGHT_COLD,
} from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { tickSurvival, skipTo, meterTrends } from '../../src/actions/survive.js';

/**
 * Makes a scout's game at a given clock time, with some meters set.
 *
 * @param {number} time - The world clock to start at.
 * @param {object} [meters={}] - Meter values to set, such as `{ warmth: 50 }`.
 * @returns {object} The game.
 */
function gameAt(time, meters = {}) {
  const game = createGame('scout');
  game.time = time;
  Object.assign(game.meters, meters);
  return game;
}

/**
 * Puts a camp fire right where the player stands, so they count as being by a fire. Its first
 * need is already met, for the dawn test.
 *
 * @param {object} game - The game to add the camp to.
 */
function lightFire(game) {
  game.camps.push({
    id: 'camp-1',
    name: 'Test Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [
      { kind: 'bring', resource: 'wood', amount: 4, done: true },
      { kind: 'place', region: 'frostpeak', done: false },
      { kind: 'signpost', done: false },
    ],
  });
}

/**
 * Moves a game's player into the snow: the Traveller's Cairn in Frostpeak.
 *
 * @param {object} game - The game to change.
 * @returns {object} The same game, for chaining.
 */
function intoSnow(game) {
  Object.assign(game.player, { x: 21248, y: 3848 });
  return game;
}

/** True when two numbers are within a hair of each other. */
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Guards the clock: survival moves the world clock forward by exactly the time given, and a
// zero step changes nothing.
test('the survival tick moves the world clock forward', () => {
  const game = gameAt(100);
  tickSurvival(game, 0.5);
  assert.equal(game.time, 100.5);
  assert.deepEqual(tickSurvival(game, 0), []);
  assert.equal(game.time, 100.5);
});

// Guards the warmth rules by time of day, away from any fire.
test('away from a fire, warmth recovers by day, holds at dusk and drains at night', () => {
  const day = gameAt(100, { warmth: 50 });
  tickSurvival(day, 1);
  assert.ok(near(day.meters.warmth, 50 + WARM_BY_DAY));

  const dusk = gameAt(215, { warmth: 50 });
  tickSurvival(dusk, 1);
  assert.equal(dusk.meters.warmth, 50);

  const night = gameAt(250, { warmth: 50 });
  tickSurvival(night, 1);
  assert.ok(near(night.meters.warmth, 50 - 100 / WARMTH_SECONDS));
});

// Guards the fire: it warms at any hour and heals a fed player.
test('by a fire, warmth climbs fast and a fed player heals', () => {
  const game = gameAt(250, { warmth: 10, health: 40 });
  lightFire(game);
  tickSurvival(game, 1);
  assert.ok(near(game.meters.warmth, 10 + WARM_BY_FIRE));
  assert.ok(near(game.meters.health, 40 + HEAL_BY_FIRE));
});

// Guards hunger: it always falls, and an empty stomach makes the cold bite harder and stops healing.
test('hunger falls steadily; when empty, the cold is harsher and the fire stops healing', () => {
  const fed = gameAt(100, { hunger: 50 });
  tickSurvival(fed, 7.2);
  assert.ok(near(fed.meters.hunger, 50 - (100 / HUNGER_SECONDS) * 7.2));

  const starving = gameAt(250, { hunger: 0, warmth: 50 });
  tickSurvival(starving, 1);
  assert.ok(near(starving.meters.warmth, 50 - (100 / WARMTH_SECONDS) * STARVING_COLD));

  const resting = gameAt(250, { hunger: 0, health: 40 });
  lightFire(resting);
  tickSurvival(resting, 1);
  assert.equal(resting.meters.health, 40);
});

// Guards tea: it holds off the cold while it lasts, and only runs down while it protects.
test('tea stops warmth falling at night and only runs down while it protects', () => {
  const night = gameAt(250, { warmth: 50 });
  night.tea = TEA_SECONDS;
  tickSurvival(night, 5);
  assert.equal(night.meters.warmth, 50);
  assert.equal(night.tea, TEA_SECONDS - 5);

  const day = gameAt(100);
  day.tea = TEA_SECONDS;
  tickSurvival(day, 5);
  assert.equal(day.tea, TEA_SECONDS);
});

// Guards freezing: with no warmth left at night, health drains over 30 seconds; never by day.
test('freezing at night drains health', () => {
  const game = gameAt(250, { warmth: 0 });
  tickSurvival(game, 3);
  assert.ok(near(game.meters.health, 100 - (100 / FREEZE_SECONDS) * 3));

  const day = gameAt(100, { warmth: 0 });
  tickSurvival(day, 3);
  assert.equal(day.meters.health, 100);
});

// Guards the snow: warmth falls there by day too, faster than an ordinary night and faster still
// after dark, and a player with no warmth left takes damage at any hour. Tea and a fire still help.
test('in the snow, warmth drains at every hour and freezing hurts by day', () => {
  const day = intoSnow(gameAt(100, { warmth: 50 }));
  tickSurvival(day, 1);
  assert.ok(near(day.meters.warmth, 50 - (100 / WARMTH_SECONDS) * SNOW_COLD));

  const night = intoSnow(gameAt(250, { warmth: 50 }));
  tickSurvival(night, 1);
  assert.ok(near(night.meters.warmth, 50 - (100 / WARMTH_SECONDS) * SNOW_NIGHT_COLD));

  const frozen = intoSnow(gameAt(100, { warmth: 0 }));
  const events = tickSurvival(frozen, 3);
  assert.ok(near(frozen.meters.health, 100 - (100 / FREEZE_SECONDS) * 3));
  assert.deepEqual(events, []);

  const tea = intoSnow(gameAt(100, { warmth: 50 }));
  tea.tea = TEA_SECONDS;
  tickSurvival(tea, 5);
  assert.equal(tea.meters.warmth, 50);
  assert.equal(tea.tea, TEA_SECONDS - 5);

  const fire = intoSnow(gameAt(100, { warmth: 10, health: 40 }));
  lightFire(fire);
  tickSurvival(fire, 1);
  assert.ok(near(fire.meters.warmth, 10 + WARM_BY_FIRE));
  assert.ok(near(fire.meters.health, 40 + HEAL_BY_FIRE));
  assert.deepEqual(meterTrends(day), { warmth: 'snow', health: '', hunger: '' });
  assert.equal(meterTrends(frozen).health, 'freezing');
});

// Guards the first-night pacing the GDD asks for: about 60 s of warmth, then 30 s of health.
test('a whole night away from any fire ends in passing out about 90 seconds after dark', () => {
  const game = gameAt(240);
  let passedOutAfter = null;
  for (let step = 0; step < 2400 && passedOutAfter === null; step++)
    if (tickSurvival(game, 0.05).some((e) => e.kind === 'passout'))
      passedOutAfter = game.time - 240;
  assert.ok(passedOutAfter !== null, 'never passed out');
  assert.ok(
    Math.abs(passedOutAfter - (WARMTH_SECONDS + FREEZE_SECONDS)) < 0.2,
    `passed out after ${passedOutAfter} s`,
  );
});

// Guards the HUD messages: each event is reported once, on the step where it happens, and the
// dusk and night warnings stay quiet for a player already by a fire.
test('dusk, night, freezing and starving are each reported once as they happen', () => {
  const game = gameAt(209.99);
  assert.deepEqual(
    tickSurvival(game, 0.02).map((e) => e.kind),
    ['dusk'],
  );
  assert.deepEqual(tickSurvival(game, 0.02), []);
  game.time = 239.99;
  assert.deepEqual(
    tickSurvival(game, 0.02).map((e) => e.kind),
    ['night'],
  );

  const warm = gameAt(209.99);
  lightFire(warm);
  assert.deepEqual(tickSurvival(warm, 0.02), []);

  const cold = gameAt(250, { warmth: 0.01 });
  assert.deepEqual(
    tickSurvival(cold, 0.05).map((e) => e.kind),
    ['freezing'],
  );
  const hungry = gameAt(100, { hunger: 0.001 });
  assert.deepEqual(
    tickSurvival(hungry, 0.05).map((e) => e.kind),
    ['starving'],
  );
});

// Guards the dawn update: crossing into a new day reports it and swaps the camps' met needs.
test('crossing into a new day reports dawn and refreshes met camp needs', () => {
  const game = gameAt(DAY_SECONDS - 0.01);
  lightFire(game);
  const events = tickSurvival(game, 0.02);
  assert.deepEqual(
    events.map((e) => e.kind),
    ['dawn'],
  );
  assert.equal(events[0].day, 2);
  assert.deepEqual(events[0].camps, ['Test Camp']);
  assert.equal(game.camps[0].needs[0].done, false);
});

// Guards the clock jumps used by resting and passing out: hunger keeps falling for the skipped
// time, a new day reports dawn, and the clock never runs backwards.
test('skipping time drains hunger for the skipped seconds and reports a new day', () => {
  const game = gameAt(300, { hunger: 50 });
  const events = skipTo(game, DAY_SECONDS);
  assert.equal(game.time, DAY_SECONDS);
  assert.ok(near(game.meters.hunger, 50 - (100 / HUNGER_SECONDS) * 60));
  assert.deepEqual(
    events.map((e) => e.kind),
    ['dawn'],
  );
  assert.deepEqual(skipTo(game, 10), []);
  assert.equal(game.time, DAY_SECONDS);
});

// Guards the HUD's cause words, so a falling meter always says why.
test('meter trends name the cause of each changing meter', () => {
  assert.deepEqual(meterTrends(gameAt(100)), { warmth: '', health: '', hunger: '' });
  assert.deepEqual(meterTrends(gameAt(250)), { warmth: 'cold', health: '', hunger: '' });
  assert.deepEqual(meterTrends(gameAt(250, { warmth: 0, hunger: 0 })), {
    warmth: 'cold',
    health: 'freezing',
    hunger: 'starving',
  });

  const tea = gameAt(250);
  tea.tea = 5;
  assert.equal(meterTrends(tea).warmth, 'tea');
  const warm = gameAt(250);
  lightFire(warm);
  assert.equal(meterTrends(warm).warmth, 'warming');
});
