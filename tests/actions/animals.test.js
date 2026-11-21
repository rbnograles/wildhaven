// Tests for the animals (world/animals.js, actions/animals.js): herds live on open ground in their
// own regions away from the starts, run from a running player but let a walking one creep up, and
// hunting needs an axe, gives food, freezes the animal, and brings it back a day later. Hunting
// is damage-based: a hit lowers hp, a wounded animal flees, and only the killing hit rewards.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import { isWalkable } from '../../src/world/map.js';
import { regionOf } from '../../src/world/regions.js';
import { SPAWNS } from '../../src/data/places.js';
import { ANIMALS } from '../../src/data/animals.js';
import { HERDS, WILD_ANIMALS, resetAnimals, isAlive } from '../../src/world/animals.js';
import {
  tickAnimals,
  huntable,
  huntReach,
  huntWeapon,
  beginHunt,
  finishHunt,
  applyHit,
} from '../../src/actions/animals.js';
import {
  FLEE_RUNNING,
  FLEE_WALKING,
  ANIMAL_RETURN,
  ANIMAL_DOWN_SECONDS,
  HUNT_REACH,
  HUNT_SECONDS,
  SWORD_SECONDS,
  BOW_REACH,
  TOOL_USES,
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

  // An iron axe does 2 damage and a deer has 4 hp, so leave it one hit from falling.
  deer.hp = 2;
  const food = game.resources.food;
  const done = finishHunt(game, animator.pending.target, () => 0);
  assert.equal(done.food, ANIMALS.deer.food);
  assert.equal(done.antler, true);
  // The hide comes off too: leather for the backpack.
  assert.equal(done.leather, ANIMALS[done.animal].leather);
  assert.equal(game.resources.leather, done.leather);
  assert.equal(game.resources.food, food + ANIMALS.deer.food);
  assert.equal(isAlive(deer), false);

  tickAnimals(game, ANIMAL_DOWN_SECONDS + 0.1, {});
  assert.equal(deer.phase, 'gone');
  game.time += ANIMAL_RETURN;
  tickAnimals(game, 0.01, {});
  assert.equal(isAlive(deer), true);
});

// Guards the diagonal running pictures: an animal fleeing up or down the screen must be marked as
// slanting north or south, and one fleeing level must not, or it would show the wrong run.
test('a fleeing animal slants north or south with the way it runs', () => {
  resetAnimals();
  const game = createGame('scout'),
    animal = WILD_ANIMALS[0];

  // Put the animal (and its home, so it is not pulled back) on ground that is clear all around, so
  // the flee runs straight away from the player instead of sliding along a tree or the shore.
  let open = null;
  for (let y = 2000; y < 18000 && !open; y += 192)
    for (let x = 2000; x < 26000 && !open; x += 192)
      if (
        [
          [0, 0],
          [96, 0],
          [-96, 0],
          [0, 96],
          [0, -96],
          [96, 96],
          [-96, -96],
          [96, -96],
          [-96, 96],
        ].every(([dx, dy]) => isWalkable(x + dx, y + dy))
      )
        open = { x, y };
  assert.ok(open, 'found open ground');
  animal.herd = { ...animal.herd, x: open.x, y: open.y };

  for (const [dx, dy, slant] of [
    [-100, 0, null],
    [-80, 80, 'n'],
    [80, -80, 's'],
  ]) {
    Object.assign(animal, { x: open.x, y: open.y, phase: 'idle', slant: null });
    Object.assign(game.player, { x: open.x + dx, y: open.y + dy });
    tickAnimals(game, 0.05, { running: true });
    assert.equal(animal.phase, 'run');
    assert.equal(animal.slant, slant);
  }
  resetAnimals();
});

// Guards the weapons: a sword must make a hunt quicker than the axe and wear instead of it, and a
// bow must reach an animal an axe cannot, wear a use per shot, and reach no farther than its tier.
test('a sword hunts faster than an axe, and a bow hunts from a distance', () => {
  const close = nextToDeer(HUNT_REACH - 20);
  let animator = createAnimator();
  close.game.tools = { axe: { tier: 'iron' }, sword: { tier: 'stone', uses: TOOL_USES.sword } };
  assert.deepEqual(huntWeapon(close.game, HUNT_REACH - 20), {
    tool: 'sword',
    seconds: SWORD_SECONDS.stone,
  });
  assert.ok(SWORD_SECONDS.iron < SWORD_SECONDS.stone && SWORD_SECONDS.stone < HUNT_SECONDS);
  assert.equal(beginHunt(close.game, animator, close.deer).ok, true);
  assert.equal(animator.pending.duration, SWORD_SECONDS.stone);
  assert.ok(finishHunt(close.game, animator.pending.target, () => 1));
  assert.equal(close.game.tools.sword.uses, TOOL_USES.sword - 1);

  const far = nextToDeer(BOW_REACH.stone - 20);
  animator = createAnimator();
  far.game.tools = { axe: { tier: 'iron' } };
  assert.equal(huntable(far.game, huntReach(far.game)), null);
  assert.equal(beginHunt(far.game, animator, far.deer).reason, 'far');

  // A bow needs arrows: with none, it does not even reach the far deer.
  far.game.tools = { bow: { tier: 'stone', uses: TOOL_USES.bow } };
  assert.equal(huntReach(far.game), HUNT_REACH);
  assert.equal(beginHunt(far.game, animator, far.deer).reason, 'arrows');

  // With arrows, the bow reaches, shoots, wears a use and spends one arrow.
  far.game.resources.arrow = 3;
  assert.equal(huntReach(far.game), BOW_REACH.stone);
  assert.equal(huntable(far.game, huntReach(far.game)), far.deer);
  assert.equal(huntWeapon(far.game, BOW_REACH.stone + 1), null);
  assert.equal(beginHunt(far.game, animator, far.deer).ok, true);
  assert.ok(finishHunt(far.game, animator.pending.target, () => 1));
  assert.equal(far.game.tools.bow.uses, TOOL_USES.bow - 1);
  assert.equal(far.game.resources.arrow, 2);
  resetAnimals();
});

/** Builds a plain deer-like creature for a hit test. */
const testDeer = () => ({
  id: 'test-deer',
  kind: 'deer',
  hp: 4,
  phase: 'idle',
  x: 0,
  y: 0,
  clock: 0,
  fleeFor: 0,
});

// A non-lethal hit lowers hp and sends an animal running, with no reward. Guards a hit that gives
// food without lowering hp.
test('a non-lethal hit wounds and does not reward', () => {
  const state = createGame('scout');
  const a = testDeer();
  const before = state.resources.food;
  const hit = applyHit(state, a, 2);
  assert.equal(hit.dead, false);
  assert.equal(a.hp, 2);
  assert.equal(a.phase, 'run');
  assert.equal(state.resources.food, before);
});

// The hit that drops hp to 0 fells the animal and gives its food. Guards a kill with no reward.
test('the killing hit fells and rewards', () => {
  const state = createGame('scout');
  const a = testDeer();
  a.hp = 2;
  const hit = applyHit(state, a, 5);
  assert.equal(hit.dead, true);
  assert.equal(a.phase, 'down');
  assert.equal(hit.reward.food, 5);
});

// finishHunt with a real animal and a sword takes one bite of hp per call. Guards one-shot kills
// creeping back.
test('finishHunt deals one hit, not an instant kill', () => {
  const state = createGame('scout');
  state.tools.sword = { tier: 'stone' };
  resetAnimals();
  const a = WILD_ANIMALS.find((x) => x.kind === 'deer');
  Object.assign(a, { x: state.player.x + 20, y: state.player.y, hp: 4, phase: 'idle' });
  const r = finishHunt(state, `hunt:${a.id}:sword:10`, () => 0.99);
  assert.equal(r.wounded, true);
  assert.equal(a.hp, 2);
  resetAnimals();
});
