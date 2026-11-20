// Tests for the animals (world/animals.js, actions/animals.js): herds live on open ground in their
// own regions away from the starts, run from a running player but let a walking one creep up, and
// hunting needs an axe, gives food, freezes the animal, and brings it back a day later.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import { isWalkable } from '../../src/world/map.js';
import { regionOf } from '../../src/world/regions.js';
import { SPAWNS } from '../../src/data/places.js';
import { ANIMALS } from '../../src/data/animals.js';
import { HERDS, WILD_ANIMALS, resetAnimals, isAlive } from '../../src/world/animals.js';
import { tickAnimals, huntable, beginHunt, finishHunt } from '../../src/actions/animals.js';
import {
  FLEE_RUNNING,
  FLEE_WALKING,
  ANIMAL_RETURN,
  ANIMAL_DOWN_SECONDS,
  HUNT_REACH,
} from '../../src/data/balance.js';

/** A game with the player standing just beside the first deer, holding an axe. */
function nextToDeer(distance) {
  resetAnimals();
  const game = createGame('scout');
  const deer = WILD_ANIMALS.find((a) => a.kind === 'deer');
  game.player.x = deer.x + distance;
  game.player.y = deer.y;
  return { game, deer };
}

// Guards where herds live: on ground an animal can stand on, in a region its kind lives in, and
// never on top of a start spot.
test('every herd lives on open ground in its own kind of region, away from the starts', () => {
  assert.ok(HERDS.length >= 20, `${HERDS.length} herds`);
  for (const herd of HERDS) {
    assert.ok(isWalkable(herd.x, herd.y), herd.id);
    assert.ok(ANIMALS[herd.kind].regions.includes(regionOf(herd.x, herd.y).id), herd.id);
    for (const s of Object.values(SPAWNS))
      assert.ok(Math.hypot(s.x - herd.x, s.y - herd.y) > 1000, herd.id);
  }
  for (const kind of Object.keys(ANIMALS))
    assert.ok(
      HERDS.some((h) => h.kind === kind),
      `some ${kind}`,
    );
});

// Guards the flee distances: running near an animal scares it off, but walking up slowly to just
// beyond FLEE_WALKING does not, so hunting is possible.
test('an animal runs from a running player but lets a walking one come close', () => {
  const { game, deer } = nextToDeer((FLEE_WALKING + FLEE_RUNNING) / 2);
  tickAnimals(game, 0.01, { running: false });
  assert.notEqual(deer.phase, 'run');
  tickAnimals(game, 0.01, { running: true });
  assert.equal(deer.phase, 'run');
  const before = Math.hypot(game.player.x - deer.x, game.player.y - deer.y);
  for (let i = 0; i < 20; i++) tickAnimals(game, 0.05, { running: true });
  assert.ok(Math.hypot(game.player.x - deer.x, game.player.y - deer.y) > before);
});

// Guards hunting: no axe, no hunt; with one, the animal freezes, lies down, gives its food, and is
// back with its herd a game day later.
test('hunting needs an axe, gives food, and the animal returns a day later', () => {
  const { game, deer } = nextToDeer(HUNT_REACH - 20);
  const animator = createAnimator();
  game.tools = {};
  assert.equal(huntable(game), deer);
  assert.equal(beginHunt(game, animator, deer).reason, 'tool');

  game.tools = { axe: { tier: 'iron' } };
  assert.equal(beginHunt(game, animator, deer).ok, true);
  tickAnimals(game, 0.5, { running: false, hunting: deer.id });
  assert.equal(deer.phase, 'idle');

  const food = game.resources.food;
  const done = finishHunt(game, animator.pending.target, () => 0);
  assert.equal(done.food, ANIMALS.deer.food);
  assert.equal(done.antler, true);
  assert.equal(game.resources.food, food + ANIMALS.deer.food);
  assert.equal(isAlive(deer), false);

  tickAnimals(game, ANIMAL_DOWN_SECONDS + 0.1, {});
  assert.equal(deer.phase, 'gone');
  game.time += ANIMAL_RETURN;
  tickAnimals(game, 0.01, {});
  assert.equal(isAlive(deer), true);
});
