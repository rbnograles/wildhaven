// Tests for the camp buildings (actions/building.js): where a tent, chest, wheat bed or camp centre
// may go up, that it is paid for once and only when finished, the chest moving resources, the wheat
// bed's sow, tend, grow and harvest, raising the centre, and a rest in a tent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import {
  checkBuilding,
  beginBuilding,
  finishBuilding,
  checkRaise,
  beginRaise,
  moveAll,
  farmJob,
  beginFarm,
  finishFarm,
  costOf,
} from '../../src/actions/building.js';
import { growCrops, buildingBases } from '../../src/world/buildings.js';
import { fireRadius } from '../../src/world/camps.js';
import { rest } from '../../src/actions/camp.js';
import { chooseInteraction, beginInteraction } from '../../src/actions/interact.js';
import { isWalkable } from '../../src/world/map.js';
import {
  BUILDING_COSTS,
  BUILD_SECONDS,
  GROW_SECONDS,
  HARVEST_FOOD,
  CENTRE_WARMTH,
  DAY_SECONDS,
  PHASES,
} from '../../src/data/balance.js';

/**
 * Makes a game with a camp at the player's feet and a full backpack, standing somewhere open.
 * The Pinefall start is used: it has open grass round it.
 */
function campGame() {
  const game = createGame('scout');
  Object.assign(game.resources, { wood: 200, stone: 200, iron: 50, food: 20 });
  game.camps.push({
    id: 'camp-1',
    name: 'Test Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 10,
    needs: [],
    buildings: [],
  });
  return game;
}

/** Finds an open spot for a building of a kind near the player, or fails the test. */
function spotFor(game, kind) {
  for (let r = 120; r < 280; r += 20)
    for (let a = 0; a < 24; a++) {
      const x = Math.round(game.player.x + Math.cos((a / 24) * Math.PI * 2) * r),
        y = Math.round(game.player.y + Math.sin((a / 24) * Math.PI * 2) * r);
      if (checkBuilding(game, kind, x, y).ok) return { x, y };
    }
  assert.fail(`no open spot for a ${kind}`);
}

/** Builds one building of a kind next to the player, the way the game does, and returns it. */
function build(game, kind) {
  const { x, y } = spotFor(game, kind);
  const animator = createAnimator();
  assert.equal(beginBuilding(game, animator, kind, x, y).ok, true);
  const done = finishBuilding(game, animator.pending.target);
  assert.equal(done.ok, true, done.message);
  return done.building;
}

// Guards the rule that buildings belong to a camp: away from every fire's warmth there is nowhere to build.
test('a building must stand within the warmth of one of your fires', () => {
  const game = campGame();
  const far = fireRadius(game.camps[0]) + 40;
  const check = checkBuilding(game, 'tent', game.player.x + far, game.player.y);
  assert.equal(check.ok, false);
  assert.ok(['camp', 'far'].includes(check.reason));
});

// Guards the price: starting costs nothing, finishing pays exactly once, and a missing resource
// is named before anything starts.
test('a building is paid for once, when it is finished, and says what is missing', () => {
  const game = campGame();
  const before = { ...game.resources };
  const { x, y } = spotFor(game, 'tent');
  const animator = createAnimator();
  beginBuilding(game, animator, 'tent', x, y);
  assert.deepEqual(game.resources, before);
  assert.equal(animator.pending.duration, BUILD_SECONDS.tent);
  finishBuilding(game, animator.pending.target);
  assert.equal(game.resources.wood, before.wood - BUILDING_COSTS.tent.wood);
  assert.equal(game.resources.stone, before.stone - BUILDING_COSTS.tent.stone);
  assert.equal(game.camps[0].buildings.length, 1);

  const poor = campGame();
  poor.resources.wood = 0;
  const spot = spotFor(game, 'chest');
  const check = checkBuilding(poor, 'chest', spot.x, spot.y);
  assert.equal(check.reason, 'cost');
  assert.match(check.message, /wood/);
});

// Guards the per-camp limits and that a finished building is solid where it stands.
test('a camp holds one tent, and a built tent is solid', () => {
  const game = campGame();
  const tent = build(game, 'tent');
  const { x, y } = spotFor(game, 'chest');
  assert.equal(checkBuilding(game, 'tent', x, y).reason, 'limit');
  assert.equal(buildingBases(game).length, 1);
  assert.equal(isWalkable(tent.x, tent.y - 5, buildingBases(game)), false);
});

// Guards the chest: everything of one resource moves in or out, nothing is lost or made up.
test('a chest takes all of a resource and gives it all back', () => {
  const game = campGame();
  const chest = build(game, 'chest');
  const wood = game.resources.wood;
  assert.equal(moveAll(game, chest, 'wood', true), wood);
  assert.equal(game.resources.wood, 0);
  assert.equal(chest.contents.wood, wood);
  assert.equal(moveAll(game, chest, 'wood', false), wood);
  assert.equal(game.resources.wood, wood);
  assert.equal(chest.contents.wood, undefined);
  assert.equal(moveAll(game, chest, 'gold', true), 0);
});

// Guards the wheat bed's whole round: sow (pays a food), grow by the clock, tending hurries the
// current stage once, harvest gives the food and empties the bed.
test('a wheat bed is sown, tended, grows to ripe and is harvested', () => {
  const game = campGame();
  const bed = build(game, 'farm');
  const animator = createAnimator();
  const food = game.resources.food;

  assert.equal(farmJob(game, bed).what, 'sow');
  beginFarm(game, animator, bed);
  assert.deepEqual(finishFarm(game, animator.pending.target), { ok: true, what: 'sow' });
  assert.equal(game.resources.food, food - 1);
  assert.equal(bed.crop.stage, 1);

  const tend = createAnimator();
  beginFarm(game, tend, bed);
  finishFarm(game, tend.pending.target);
  assert.equal(bed.crop.readyAt, game.time + GROW_SECONDS / 2);
  assert.equal(farmJob(game, bed).reason, 'tended');

  game.time += GROW_SECONDS * 2;
  growCrops(game);
  assert.equal(bed.crop.stage, 3);
  assert.equal(farmJob(game, bed).what, 'harvest');
  const reap = createAnimator();
  beginFarm(game, reap, bed);
  assert.equal(finishFarm(game, reap.pending.target).food, HARVEST_FOOD);
  assert.equal(game.resources.food, food - 1 + HARVEST_FOOD);
  assert.equal(bed.crop.stage, 0);
});

// Guards the camp centre: one per camp, raised tier by tier to a big hall, each tier warming farther.
test('the camp centre is raised tier by tier, and each tier warms farther', () => {
  const game = campGame();
  const radius = fireRadius(game.camps[0]);
  const centre = build(game, 'centre');
  assert.equal(centre.tier, 1);
  assert.equal(fireRadius(game.camps[0]), radius + CENTRE_WARMTH);
  for (const tier of [2, 3]) {
    const animator = createAnimator();
    assert.deepEqual(checkRaise(game).cost, costOf('centre', tier));
    beginRaise(game, animator);
    assert.equal(finishBuilding(game, animator.pending.target).raised, tier);
  }
  assert.equal(checkRaise(game).reason, 'top');
  assert.equal(fireRadius(game.camps[0]), radius + 3 * CENTRE_WARMTH);
});

// Guards the tent's comfort: a night's rest in a camp with a tent costs half the hunger.
test('resting at a camp with a tent costs half the night’s hunger', () => {
  const dusk = PHASES.dusk;
  const plain = campGame(),
    sheltered = campGame();
  build(sheltered, 'tent');
  for (const game of [plain, sheltered]) {
    game.time = dusk + 1;
    game.meters.hunger = 80;
  }
  assert.equal(rest(plain).ok, true);
  assert.equal(rest(sheltered).tent, true);
  const lost = 80 - plain.meters.hunger;
  assert.ok(lost > 0);
  assert.ok(Math.abs(80 - sheltered.meters.hunger - lost / 2) < 0.01);
});

// Guards E at a tent: nothing by day (so E can still open the camp), and from dusk it offers a sleep
// at the tent's own camp, even when the player stands too far from the fire to open the camp.
test('E beside a tent sleeps in it from dusk, and not by day', () => {
  const game = campGame();
  const tent = build(game, 'tent');
  Object.assign(game.player, { x: tent.x, y: tent.y + 30 });

  game.time = 100;
  assert.equal(chooseInteraction(game), null);

  game.time = 300;
  const choice = chooseInteraction(game);
  assert.equal(choice.kind, 'sleep');
  assert.equal(choice.target, tent);
  assert.deepEqual(beginInteraction(game, createAnimator()), {
    ok: true,
    kind: 'sleep',
    camp: game.camps[0],
  });

  // The tent's camp is passed on, so the rest works from the tent's side of the camp.
  game.camps[0].x -= 200;
  assert.equal(rest(game).ok, false);
  const slept = rest(game, choice.camp);
  assert.equal(slept.ok, true);
  assert.equal(slept.tent, true);
  assert.equal(game.time, DAY_SECONDS);
});
