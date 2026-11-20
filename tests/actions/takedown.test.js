// Tests for taking things down (actions/takedown.js): a campfire gives back half its cost and
// ends its camp, a tent is packed into the item box and pitched again for nothing, there is one
// tent per player, and nothing comes down while something would be lost.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import {
  checkBuilding,
  beginBuilding,
  finishBuilding,
  moveAll,
  priceOf,
} from '../../src/actions/building.js';
import {
  FIRE,
  checkTakeDown,
  beginTakeDown,
  finishTakeDown,
  refundOf,
} from '../../src/actions/takedown.js';
import { finishInteraction } from '../../src/actions/interact.js';
import { tidyBag, slotItem, addItem } from '../../src/world/bag.js';
import { BUILDING_COSTS, CAMPFIRE_COST, TAKEDOWN_SECONDS } from '../../src/data/balance.js';

/** Makes a game with a camp at the player's feet and plenty of wood, stone and iron. */
function campGame() {
  const game = createGame('scout');
  Object.assign(game.resources, { wood: 200, stone: 200, iron: 50, food: 0 });
  tidyBag(game);
  game.camps.push(camp(game, 'camp-1', 0));
  return game;
}

/** Makes a camp `east` units east of the player. */
const camp = (game, id, east) => ({
  id,
  name: `Camp ${id}`,
  x: game.player.x + east,
  y: game.player.y,
  grown: 10,
  needs: [],
  buildings: [],
});

/** Builds one building of a kind near the player, the way the game does, and returns it. */
function build(game, kind) {
  for (let r = 120; r < 280; r += 20)
    for (let a = 0; a < 24; a++) {
      const x = Math.round(game.player.x + Math.cos((a / 24) * Math.PI * 2) * r),
        y = Math.round(game.player.y + Math.sin((a / 24) * Math.PI * 2) * r);
      if (!checkBuilding(game, kind, x, y).ok) continue;
      const animator = createAnimator();
      beginBuilding(game, animator, kind, x, y);
      return finishBuilding(game, animator.pending.target).building;
    }
  assert.fail(`no open spot for a ${kind}`);
}

/** Takes something down the way the game does: the timed action, then the loop's finish. */
function takeDown(game, what) {
  const animator = createAnimator();
  const begun = beginTakeDown(game, animator, 'camp-1', what);
  if (!begun.ok) return begun;
  assert.equal(animator.pending.duration, TAKEDOWN_SECONDS);
  return finishInteraction(game, animator.pending.target);
}

// Guards the campfire's refund: half its cost, rounded down, and the camp is gone with it.
test('putting out a campfire gives back half its cost and ends the camp', () => {
  const game = campGame();
  const before = { ...game.resources };
  const done = takeDown(game, FIRE);

  assert.equal(done.ok, true);
  assert.equal(done.what, FIRE);
  assert.deepEqual(game.camps, []);
  assert.equal(game.resources.wood, before.wood + Math.floor(CAMPFIRE_COST.wood / 2));
  assert.equal(game.resources.stone, before.stone + Math.floor(CAMPFIRE_COST.stone / 2));
});

// Guards against losing buildings by accident: the fire stays while anything stands round it.
test('a campfire with buildings round it can’t be put out', () => {
  const game = campGame();
  const chest = build(game, 'chest');
  assert.equal(checkTakeDown(game, 'camp-1', FIRE).reason, 'buildings');
  assert.equal(takeDown(game, chest.id).ok, true);
  assert.equal(checkTakeDown(game, 'camp-1', FIRE).ok, true);
});

// Guards the tent: packed up it costs nothing and gives no wood back, it sits in a slot, and it
// is pitched again for nothing, at any camp.
test('a tent is packed into the item box and pitched again for nothing', () => {
  const game = campGame();
  const tent = build(game, 'tent');
  const before = { ...game.resources };

  assert.equal(takeDown(game, tent.id).what, 'tent');
  assert.equal(game.packedTent, true);
  assert.deepEqual(game.resources, before);
  assert.ok(game.slots.some((_, i) => slotItem(game, i) === 'tent'));
  assert.deepEqual(priceOf(game, 'tent'), {});

  // Even with no wood left, the packed tent goes up, and leaves the item box.
  game.resources.wood = 0;
  const again = build(game, 'tent');
  assert.equal(again.kind, 'tent');
  assert.equal(game.packedTent, false);
  assert.equal(game.resources.wood, 0);
  assert.deepEqual(priceOf(game, 'tent'), BUILDING_COSTS.tent);
});

// Guards "one tent per player": with a tent standing at one camp, no other camp can have one.
test('only one tent may stand in the whole world', () => {
  const game = campGame();
  build(game, 'tent');
  game.camps.push(camp(game, 'camp-2', 4000));
  game.player.x += 4000;

  const check = checkBuilding(game, 'tent', game.player.x + 150, game.player.y);
  assert.equal(check.reason, 'limit');
  assert.match(check.message, /already have a tent/);
});

// Guards a chest's contents: a chest with anything in it stays up, and an emptied one gives half
// its cost back (the single iron rounds down to none).
test('a chest must be emptied before it comes down', () => {
  const game = campGame();
  const chest = build(game, 'chest');
  moveAll(game, chest, 'stone', true);
  assert.equal(checkTakeDown(game, 'camp-1', chest.id).reason, 'contents');

  moveAll(game, chest, 'stone', false);
  assert.deepEqual(refundOf(chest), { wood: 3, stone: 1 });
  const wood = game.resources.wood;
  assert.equal(takeDown(game, chest.id).ok, true);
  assert.equal(game.resources.wood, wood + 3);
  assert.equal(game.camps[0].buildings.length, 0);
});

// Guards the centre's refund (half of the tier it stands at) and the wheat bed's.
test('a camp centre and a wheat bed give back half their cost', () => {
  const game = campGame();
  const centre = build(game, 'centre');
  centre.tier = 2;
  assert.deepEqual(refundOf(centre), { wood: 10, stone: 5, iron: 1 });
  assert.deepEqual(refundOf(build(game, 'farm')), { wood: 2 });
});

// Guards the checks around the work: not from afar, not with a full bag, and a finish whose
// check now fails changes nothing.
test('taking down needs the player at the camp and room in the bag', () => {
  const game = campGame();
  const tent = build(game, 'tent');

  game.player.x += 5000;
  assert.equal(checkTakeDown(game, 'camp-1', tent.id).reason, 'far');
  game.player.x -= 5000;

  // wood, stone and iron are carried; two more kinds fill the five open slots.
  addItem(game, 'herbs');
  addItem(game, 'copper');
  assert.equal(checkTakeDown(game, 'camp-1', tent.id).reason, 'full');
  const failed = finishTakeDown(game, `takedown:camp-1:${tent.id}`);
  assert.equal(failed.ok, false);
  assert.equal(game.camps[0].buildings.length, 1);
  assert.equal(game.packedTent, false);

  assert.equal(checkTakeDown(game, 'camp-9', FIRE).reason, 'unknown');
});
