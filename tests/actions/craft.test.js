// Checks crafting tools: what each one costs, where iron tools can be forged, and that a craft
// pays exactly once. A slip here could hand out free tools or swallow the materials.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_RECIPES, TOOL_USES, CRAFT_SECONDS } from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { canCraft, beginCraft, finishCraft, nextTier } from '../../src/actions/craft.js';
import { finishInteraction } from '../../src/actions/interact.js';
import { createAnimator, advanceAnimation, cancelAction } from '../../src/animation/clips.js';

/**
 * Makes a Survivor (no tools) at their spawn with plenty of wood, stone and iron.
 *
 * @returns {object} The game.
 */
function richGame() {
  const game = createGame('survivor');
  Object.assign(game.resources, { wood: 50, stone: 50, iron: 50 });
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

// Guards the stone tier: it costs its recipe, can be made anywhere, and starts with every use.
test('a stone tool costs its recipe, is made anywhere, and starts with every use', () => {
  const game = richGame();
  assert.equal(nextTier(game, 'axe'), 'stone');
  assert.deepEqual(finishCraft(game, 'axe'), { ok: true, tool: 'axe', tier: 'stone', wear: null });
  assert.deepEqual(game.tools.axe, { tier: 'stone', uses: TOOL_USES.axe });
  assert.equal(game.resources.wood, 50 - TOOL_RECIPES.axe.stone.wood);
  assert.equal(game.resources.stone, 50 - TOOL_RECIPES.axe.stone.stone);
  assert.equal(nextTier(game, 'axe'), 'iron');
});

// Guards a short backpack: the craft is refused, says what is missing, and spends nothing.
test('a craft short of materials is refused, says what is missing, and spends nothing', () => {
  const game = createGame('survivor');
  Object.assign(game.resources, { wood: 2, stone: 0 });
  const before = { ...game.resources };
  const result = finishCraft(game, 'pickaxe');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cost');
  assert.match(result.message, /1 wood and 3 stone/);
  assert.deepEqual(game.resources, before);
  assert.deepEqual(game.tools, {});
});

// Guards the iron tier's rules and the order of advice: iron first (with where to find it), then
// a hammer, then a campfire.
test('iron tools need iron, a hammer and a campfire', () => {
  const game = richGame();
  game.tools.axe = { tier: 'stone', uses: 4 };
  game.resources.iron = 0;
  assert.equal(canCraft(game, 'axe').reason, 'cost');
  assert.match(canCraft(game, 'axe').message, /Stonewater Canyons and Frostpeak/);
  game.resources.iron = 50;
  assert.equal(canCraft(game, 'axe').reason, 'hammer');
  game.tools.hammer = { tier: 'stone', uses: 2 };
  assert.equal(canCraft(game, 'axe').reason, 'fire');
  campHere(game);
  assert.deepEqual(canCraft(game, 'axe'), { ok: true, tier: 'iron', cost: TOOL_RECIPES.axe.iron });
});

// Guards forging: iron replaces the stone tool, the stone hammer wears (and may break), and an
// iron tool can't be made twice.
test('forging iron replaces the stone tool and wears a stone hammer', () => {
  const game = richGame();
  campHere(game);
  game.tools = { axe: { tier: 'stone', uses: 4 }, hammer: { tier: 'stone', uses: 1 } };
  assert.deepEqual(finishCraft(game, 'axe'), {
    ok: true,
    tool: 'axe',
    tier: 'iron',
    wear: 'broke',
  });
  assert.deepEqual(game.tools, { axe: { tier: 'iron' } });
  assert.equal(game.resources.iron, 50 - TOOL_RECIPES.axe.iron.iron);
  assert.equal(canCraft(game, 'axe').reason, 'owned');

  // With the hammer broken, the next iron tool waits for a new one.
  game.tools.pickaxe = { tier: 'stone', uses: 9 };
  assert.equal(canCraft(game, 'pickaxe').reason, 'hammer');
});

// Guards the iron hammer: it is forged with the stone hammer, which it replaces.
test('the iron hammer is forged with the stone one, which it replaces', () => {
  const game = richGame();
  campHere(game);
  game.tools.hammer = { tier: 'stone', uses: 3 };
  assert.deepEqual(finishCraft(game, 'hammer'), {
    ok: true,
    tool: 'hammer',
    tier: 'iron',
    wear: null,
  });
  assert.deepEqual(game.tools.hammer, { tier: 'iron' });
});

// Guards the timed action: starting spends nothing, a cancelled craft spends nothing, and the
// finished one pays exactly once through the loop's finishInteraction.
test('a craft takes time, a cancelled one spends nothing, and a finished one pays once', () => {
  const game = richGame(),
    animator = createAnimator();
  assert.equal(beginCraft(game, animator, 'axe').ok, true);
  assert.equal(animator.pending.target, 'craft:axe');
  assert.equal(beginCraft(game, animator, 'pickaxe').reason, 'busy');
  cancelAction(animator);
  assert.equal(game.resources.wood, 50);
  assert.deepEqual(game.tools, {});

  beginCraft(game, animator, 'axe');
  assert.equal(advanceAnimation(animator, CRAFT_SECONDS - 0.01, {}), null);
  const done = advanceAnimation(animator, 0.02, {});
  assert.equal(done?.target, 'craft:axe');
  assert.equal(finishInteraction(game, done.target).ok, true);
  assert.equal(game.resources.wood, 50 - TOOL_RECIPES.axe.stone.wood);
  assert.equal(game.tools.axe.tier, 'stone');
});

// Guards the boat: no crafting while sitting in it.
test('crafting is refused in the boat', () => {
  const game = richGame();
  game.aboard = true;
  assert.equal(canCraft(game, 'axe').reason, 'aboard');
});
