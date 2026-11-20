// Checks owning and wearing out tools. A slip here could let a stone tool last forever, break an
// iron one, or start a character without the kit their selection card promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_USES, TOOL_WEAR_WARNING, TOOL_RECIPES } from '../../src/data/balance.js';
import { TOOLS, TOOL_IDS, TIERS, toolInfo } from '../../src/data/tools.js';
import { toolTier, hasTool, startingTools, wearTool } from '../../src/world/tools.js';

// Guards the kits on the character cards: the Scout's hatchet and the Builder's hammer are real stone tools.
test('characters start with the stone tools their kit names', () => {
  assert.deepEqual(startingTools('scout'), { axe: { tier: 'stone', uses: TOOL_USES.axe } });
  assert.deepEqual(startingTools('builder'), {
    hammer: { tier: 'stone', uses: TOOL_USES.hammer },
  });
  assert.deepEqual(startingTools('survivor'), {});
  assert.deepEqual(startingTools('nobody'), {});
});

// Guards the tool table: a tool with no recipe for a tier, no use count, or a clashing key would
// break the Build menu or crafting.
test('every tool has a recipe for each tier, a stone use count and its own key', () => {
  assert.deepEqual(TOOL_IDS, ['axe', 'pickaxe', 'hammer']);
  for (const id of TOOL_IDS) {
    for (const tier of TIERS) assert.ok(TOOL_RECIPES[id][tier], `${id} ${tier}`);
    assert.ok(Number.isInteger(TOOL_USES[id]) && TOOL_USES[id] > TOOL_WEAR_WARNING, id);
    assert.equal(toolInfo(id).id, id);
  }
  assert.equal(new Set(TOOLS.map((t) => t.key)).size, TOOLS.length);
  assert.equal(toolInfo('axe').aName, 'an axe');
});

// Guards wear: one use per call, a warning at exactly three left, removal at zero, and iron never wearing.
test('a stone tool warns once, then breaks; an iron tool never wears', () => {
  const state = {
    tools: { axe: { tier: 'stone', uses: TOOL_WEAR_WARNING + 1 }, pickaxe: { tier: 'iron' } },
  };
  assert.equal(wearTool(state, 'axe'), 'warn');
  assert.equal(state.tools.axe.uses, TOOL_WEAR_WARNING);
  for (let left = TOOL_WEAR_WARNING - 1; left > 0; left--)
    assert.equal(wearTool(state, 'axe'), null);
  assert.equal(wearTool(state, 'axe'), 'broke');
  assert.equal(hasTool(state, 'axe'), false);
  assert.equal(toolTier(state, 'axe'), null);

  assert.equal(wearTool(state, 'pickaxe'), null);
  assert.deepEqual(state.tools.pickaxe, { tier: 'iron' });
  assert.equal(toolTier(state, 'pickaxe'), 'iron');
  assert.equal(wearTool(state, 'hammer'), null); // not owned: nothing happens
});

// Guards heavy work: a big rock takes several uses at once, the warning still comes when that
// step jumps past the warning line, and a tool with fewer uses left than the work costs breaks.
test('heavy work takes several uses, still warns once and breaks a nearly worn tool', () => {
  const state = { tools: { pickaxe: { tier: 'stone', uses: TOOL_WEAR_WARNING + 2 } } };
  assert.equal(wearTool(state, 'pickaxe', 3), 'warn');
  assert.equal(state.tools.pickaxe.uses, TOOL_WEAR_WARNING - 1);
  assert.equal(wearTool(state, 'pickaxe', 1), null); // already warned
  assert.equal(wearTool(state, 'pickaxe', 3), 'broke');
  assert.equal(state.tools.pickaxe, undefined);
});
