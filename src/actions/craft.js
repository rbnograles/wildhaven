// The "craft" action: making tools from wood, stone and iron in the Build menu. Stone tools are
// made anywhere; iron tools need a hammer and one of the player's campfires (the fire is the
// forge). Like gathering, crafting takes time: beginCraft starts it, and the game loop finishes it
// through finishCraft, which checks everything again and only then pays, so nothing is paid twice.

import { TOOL_RECIPES, CRAFT_SECONDS } from '../data/balance.js';
import { toolInfo, TIERS } from '../data/tools.js';
import { toolTier, hasTool, newStoneTool, wearTool } from '../world/tools.js';
import { byFire } from '../world/camps.js';
import { listMissing } from './boat.js';
import { startAction } from '../animation/clips.js';

/** The start of every craft action's target, such as `craft:axe`, so the loop can tell crafts from gathers. */
export const CRAFT_PREFIX = 'craft:';

/**
 * Says which tier of a tool the player would craft next.
 *
 * Climbs the tier ladder (stone → iron → gold → diamond) and returns the first tier above the one
 * they own that this tool actually has a recipe for. Gathering tools only have stone and iron
 * recipes, so they stop at iron; weapons have all four.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id, such as 'axe'.
 * @returns {string|null} The next craftable tier, or null when they already own the top one.
 */
export function nextTier(state, tool) {
  const tier = toolTier(state, tool);
  const ladder = TIERS.filter((t) => TOOL_RECIPES[tool][t]);
  const at = tier ? ladder.indexOf(tier) : -1;
  return ladder[at + 1] ?? null;
}

/**
 * Puts a tool and its tier into words, such as "stone axe".
 *
 * @param {string} tool - The tool's id.
 * @param {string} tier - 'stone' or 'iron'.
 * @returns {string} The words, all lower case.
 */
export const toolName = (tool, tier) => `${tier} ${toolInfo(tool).name}`;

/**
 * Works out what the backpack is short of for a cost.
 *
 * @param {object} state - The game being played.
 * @param {object} cost - What is needed, such as `{wood: 2, iron: 3}`.
 * @returns {object} How much more of each is needed, such as `{iron: 2}`; empty when nothing is.
 */
function missingFor(state, cost) {
  return Object.fromEntries(
    Object.entries(cost)
      .map(([type, n]) => [type, n - state.resources[type]])
      .filter(([, short]) => short > 0),
  );
}

/**
 * Puts "a" or "an" in front of a name, choosing by its first sound.
 *
 * @param {string} name - A name such as "iron sword" or "gold axe".
 * @returns {string} The name with the right word in front.
 */
const aOrAn = (name) => `${'aeiou'.includes(name[0]) ? 'an' : 'a'} ${name}`;

/**
 * Checks whether the player can craft the next tier of a tool right now, without changing anything.
 *
 * The first rule that fails is the answer, in the order that helps most: they already own the iron
 * one, they are sitting in the boat, the backpack is short (with a hint where iron is found), they
 * have no hammer (iron only), or they are away from their campfires (iron only).
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id.
 * @returns {{ok: boolean, tier: string|null, cost?: object, reason?: string, message?: string}}
 *   `ok` with the tier and its cost; otherwise `reason` ('owned', 'aboard', 'cost', 'hammer' or
 *   'fire') and a `message` to show.
 */
export function canCraft(state, tool) {
  const tier = nextTier(state, tool);
  if (!tier)
    return {
      ok: false,
      tier,
      reason: 'owned',
      message: `You already have ${aOrAn(toolName(tool, toolTier(state, tool)))}`,
    };
  const cost = TOOL_RECIPES[tool][tier];
  if (state.aboard)
    return { ok: false, tier, cost, reason: 'aboard', message: 'Step ashore to craft' };

  const missing = missingFor(state, cost);
  if (Object.keys(missing).length) {
    const hint = missing.iron
      ? ' · Mine iron in the rocks of Stonewater Canyons and Frostpeak'
      : '';
    return {
      ok: false,
      tier,
      cost,
      reason: 'cost',
      message: `Needs ${listMissing(missing)} more${hint}`,
    };
  }
  if (tier === 'iron' && !hasTool(state, 'hammer'))
    return { ok: false, tier, cost, reason: 'hammer', message: 'Iron tools need a hammer' };
  if (tier === 'iron' && !byFire(state))
    return {
      ok: false,
      tier,
      cost,
      reason: 'fire',
      message: 'Forge iron tools beside your campfire',
    };
  return { ok: true, tier, cost };
}

/**
 * Starts crafting the next tier of a tool: what picking it in the Build menu does.
 *
 * It only starts the timed action (the `craft` clip for CRAFT_SECONDS); nothing is paid yet.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {string} tool - The tool's id.
 * @returns {object} canCraft's answer, or `{ok: false, reason: 'busy'}` while another action runs.
 */
export function beginCraft(state, animator, tool) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const check = canCraft(state, tool);
  if (!check.ok) return check;
  startAction(animator, 'craft', `${CRAFT_PREFIX}${tool}`, CRAFT_SECONDS);
  return check;
}

/**
 * Makes the tool when its craft action finishes.
 *
 * Everything is checked again first, because the backpack or the player's spot may have changed
 * while they worked. Then the cost is paid, a stone hammer used for forging iron wears a little,
 * and the tool goes in the backpack, all in one step, so nothing is ever paid without a tool.
 *
 * @param {object} state - The game being played. Resources and tools change on success.
 * @param {string} tool - The tool's id.
 * @returns {{ok: boolean, tool: string, tier?: string, wear?: string|null, reason?: string,
 *   message?: string}} On success the tier made and the hammer's `wear` ('warn', 'broke' or null);
 *   otherwise canCraft's reason and message, with nothing changed.
 */
export function finishCraft(state, tool) {
  const check = canCraft(state, tool);
  if (!check.ok) return { ...check, tool };

  for (const [type, n] of Object.entries(check.cost)) state.resources[type] -= n;
  // Forging iron wears a stone hammer one use. The iron hammer replaces the stone one anyway, so
  // that hammer's wear isn't worth a message.
  const wear = check.tier === 'iron' ? wearTool(state, 'hammer') : null;
  state.tools[tool] = check.tier === 'iron' ? { tier: 'iron' } : newStoneTool(tool);
  return { ok: true, tool, tier: check.tier, wear: tool === 'hammer' ? null : wear };
}
