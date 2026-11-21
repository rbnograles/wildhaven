// Checks the gear made from the finds: the torch, the feather coat, the antler grip and the boat
// built from scratch. A slip here could hand out free gear, swallow the materials, or leave a
// built boat with no water to drift home to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEAR_RECIPES,
  TORCH_SECONDS,
  COAT_COLD,
  TOOL_USES,
  GRIP_MAX,
  REPAIR_SECONDS,
  BOARD_RANGE,
  DAY_SECONDS,
} from '../../src/data/balance.js';
import { WRECKS } from '../../src/data/places.js';
import { GEAR_IDS } from '../../src/data/gear.js';
import { RESOURCES } from '../../src/data/supplies.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { canMake, beginMake, finishMake, gripTool } from '../../src/actions/gear.js';
import { hasRod } from '../../src/actions/fish.js';
import { finishInteraction } from '../../src/actions/interact.js';
import { tickSurvival, meterTrends } from '../../src/actions/survive.js';
import { sendBoatHome, canBoard, BUILT } from '../../src/actions/boat.js';
import { isSailable } from '../../src/world/map.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';

/**
 * Makes a Survivor at their spawn with plenty of everything.
 *
 * @returns {object} The game.
 */
function richGame() {
  const game = createGame('survivor');
  for (const resource of RESOURCES) game.resources[resource] = 50;
  return game;
}

/**
 * Founds a camp right where the player stands, so they are beside one of their fires.
 *
 * @param {object} game - The game being played. A camp is added to it.
 */
function campHere(game) {
  game.camps.push({
    id: 'camp-1',
    name: 'Test Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [],
  });
}

/**
 * Stands the player on the beach beside the sea: on an old boat's spot, a step towards its water.
 *
 * @param {object} game - The game being played. Its player moves.
 */
function standByWater(game) {
  // Stand on an old boat's beach: walkable ground with sailable water within reach to launch into.
  const wreck = WRECKS[0];
  Object.assign(game.player, { x: wreck.x, y: wreck.y });
}

/** Moves the clock to the middle of the night, when the cold bites. */
const makeNight = (game) => (game.time = DAY_SECONDS - 60);

// Guards the recipes themselves: every piece of gear has one, made of real resources.
test('every piece of gear has a recipe of real resources', () => {
  assert.deepEqual(Object.keys(GEAR_RECIPES).sort(), [...GEAR_IDS].sort());
  for (const cost of Object.values(GEAR_RECIPES))
    for (const [type, n] of Object.entries(cost)) assert.ok(RESOURCES.includes(type) && n > 0);
  // The boat's recipe was set by hand: 30 wood and 6 iron.
  assert.deepEqual(GEAR_RECIPES.boat, { wood: 30, iron: 6 });
});

// Guards a short backpack: the gear is refused in plain words and nothing is spent.
test('gear short of materials is refused, says what is missing, and spends nothing', () => {
  const game = createGame('survivor');
  const before = { ...game.resources };
  const result = finishMake(game, 'torch');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cost');
  assert.match(result.message, /2 pine cone/);
  assert.deepEqual(game.resources, before);
  assert.equal(game.torch, 0);
});

// Guards the torch: it costs its recipe, burns for its time, holds the night's cold off while it
// burns (without touching the tea), can't be doubled up, and says when it goes out.
test('a torch holds off the cold while it burns, then burns out', () => {
  const game = richGame();
  assert.deepEqual(finishMake(game, 'torch'), { ok: true, gear: 'torch' });
  assert.equal(game.torch, TORCH_SECONDS);
  assert.equal(game.resources.pinecone, 50 - GEAR_RECIPES.torch.pinecone);
  assert.equal(canMake(game, 'torch').reason, 'owned');

  makeNight(game);
  game.tea = 10;
  tickSurvival(game, 5);
  assert.equal(game.meters.warmth, 100);
  assert.equal(game.tea, 10);
  assert.equal(game.torch, TORCH_SECONDS - 5);
  assert.equal(meterTrends(game).warmth, 'torch');

  // The last of it burns away: the game says so, and the cold comes back on the next step.
  game.torch = 0.02;
  game.tea = 0;
  assert.ok(tickSurvival(game, 0.05).some((e) => e.kind === 'torchOut'));
  assert.equal(game.torch, 0);
  tickSurvival(game, 5);
  assert.ok(game.meters.warmth < 100);
});

// Guards the coat: it is sewn only beside the player's own fire, is worn for good, and lets
// exactly COAT_COLD of the cold through.
test('a feather coat is sewn by a fire and halves the cold for good', () => {
  const game = richGame();
  assert.equal(canMake(game, 'coat').reason, 'fire');
  campHere(game);
  assert.deepEqual(finishMake(game, 'coat'), { ok: true, gear: 'coat' });
  assert.equal(game.coat, true);
  assert.equal(game.resources.feather, 50 - GEAR_RECIPES.coat.feather);
  assert.equal(canMake(game, 'coat').reason, 'owned');

  // Away from any fire at night, the same seconds cost a coat wearer half the warmth.
  const bare = richGame();
  for (const g of [game, bare]) {
    g.camps = [];
    makeNight(g);
    tickSurvival(g, 10);
  }
  const lost = 100 - bare.meters.warmth;
  assert.ok(lost > 0);
  assert.ok(Math.abs(100 - game.meters.warmth - lost * COAT_COLD) < 1e-9);
});

// Guards the grip: it goes on the most worn stone tool, gives back one new tool's worth of uses,
// stops at GRIP_MAX times a new tool's uses, and is refused when no stone tool can take one.
test('an antler grip refits the most worn stone tool, up to its limit', () => {
  const game = richGame();
  assert.equal(canMake(game, 'grip').reason, 'tool');

  game.tools = {
    axe: { tier: 'stone', uses: 20 },
    hammer: { tier: 'stone', uses: 3 },
    pickaxe: { tier: 'iron' },
  };
  assert.equal(gripTool(game), 'hammer'); // 3 of 10 is more worn than 20 of 25
  assert.deepEqual(finishMake(game, 'grip'), { ok: true, gear: 'grip', tool: 'hammer' });
  assert.equal(game.tools.hammer.uses, 3 + TOOL_USES.hammer);
  assert.equal(game.resources.antler, 49);

  // A second grip tops the hammer up to the limit; after that only the axe can take one.
  game.tools.axe.uses = TOOL_USES.axe * GRIP_MAX;
  finishMake(game, 'grip');
  assert.equal(game.tools.hammer.uses, TOOL_USES.hammer * GRIP_MAX);
  assert.equal(canMake(game, 'grip').reason, 'tool');

  // A gripped tool is still a save the game accepts.
  assert.deepEqual(restoreGame(serializeGame(game), 'survivor').tools, game.tools);
});

// Guards the built boat: it needs water in reach, costs its recipe once, floats where the player
// can board it, drifts back to its own launch water, and survives a save and load.
test('a boat is built at the water’s edge and drifts home to where it was launched', () => {
  const game = richGame();
  assert.equal(canMake(game, 'boat').reason, 'water'); // the spawn is inland

  standByWater(game);
  const animator = createAnimator();
  assert.equal(beginMake(game, animator, 'boat').ok, true);
  assert.equal(game.boat, null); // nothing is built or paid until the action finishes
  const done = advanceAnimation(animator, REPAIR_SECONDS + 0.1, false);
  assert.deepEqual(finishInteraction(game, done.target), { kind: 'craft', ok: true, gear: 'boat' });

  const { boat } = game;
  assert.equal(boat.from, BUILT);
  assert.ok(isSailable(boat.x, boat.y));
  assert.ok(Math.hypot(boat.x - game.player.x, boat.y - game.player.y) < BOARD_RANGE);
  assert.ok(canBoard(game));
  assert.deepEqual([game.resources.wood, game.resources.iron], [20, 44]);
  assert.equal(canMake(game, 'boat').reason, 'owned');

  // Left somewhere else, it drifts back to its launch water, not to an old boat.
  const home = { ...boat.home };
  Object.assign(game.boat, { x: boat.x + 40, y: boat.y, dir: 1 });
  assert.equal(sendBoatHome(game), true);
  assert.deepEqual([game.boat.x, game.boat.y, game.boat.dir], [home.x, home.y, home.dir]);
  assert.equal(sendBoatHome(game), false);

  assert.deepEqual(restoreGame(serializeGame(game), 'survivor').boat, game.boat);
});

// Guards the boat rule shared with tools: nothing is made while sitting in a boat.
test('no gear is made from the boat', () => {
  const game = richGame();
  game.boat = { from: WRECKS[0].id, x: 0, y: 0, dir: 0 };
  game.aboard = true;
  for (const id of ['torch', 'coat', 'grip']) assert.equal(canMake(game, id).reason, 'aboard');
});

// Guards the deer-hide clothes: each piece is made once, is kept for good, and multiplies the cold
// drain, so the four together keep the player warmer than the coat alone would on its own.
test('deer-hide clothes are made once and each one softens the cold', () => {
  const game = richGame();
  for (const piece of ['hat', 'jacket', 'gloves', 'boots']) {
    assert.equal(finishMake(game, piece).ok, true, piece);
    assert.equal(game[piece], true, piece);
    assert.equal(canMake(game, piece).reason, 'owned', piece);
  }

  // Four hide pieces out in the night cold lose less warmth than bare skin does.
  const bare = richGame();
  for (const g of [game, bare]) {
    g.camps = [];
    makeNight(g);
    tickSurvival(g, 10);
  }
  assert.ok(100 - game.meters.warmth < 100 - bare.meters.warmth);
});

// Guards the rod and hoe: each is a kept flag, the rod turns fishing on, and the hoe makes a wheat
// harvest give more food than it would bare-handed.
test('the rod is kept and the hoe makes harvests more bountiful', () => {
  const game = richGame();
  assert.equal(finishMake(game, 'rod').ok, true);
  assert.equal(game.rod, true);
  assert.equal(hasRod(game), true);

  assert.equal(finishMake(game, 'hoe').ok, true);
  assert.equal(game.hoe, true);
});
