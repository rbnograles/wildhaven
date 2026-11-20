// Which tools the player owns, and how they wear out. A tool sits in `state.tools` as
// `{tier: 'stone', uses}` (it wears out) or `{tier: 'iron'}` (it lasts forever); a missing key
// means the player doesn't own that tool. Owning a tool is enough to use it.

import { TOOL_USES, TOOL_WEAR_WARNING } from '../data/balance.js';
import { CHARACTERS } from '../data/characters.js';

/**
 * Says which tier of a tool the player owns.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id, such as 'axe'.
 * @returns {string|null} 'stone' or 'iron', or null when they don't own it.
 */
export const toolTier = (state, tool) => state.tools[tool]?.tier ?? null;

/**
 * Says whether the player owns a tool at any tier.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id.
 * @returns {boolean} True if they own it.
 */
export const hasTool = (state, tool) => !!state.tools[tool];

/**
 * Makes a brand-new stone tool with every use left.
 *
 * @param {string} tool - The tool's id.
 * @returns {{tier: string, uses: number}} The tool, ready to put in `state.tools`.
 */
export const newStoneTool = (tool) => ({ tier: 'stone', uses: TOOL_USES[tool] });

/**
 * Gives the tools a character starts with: one new stone tool per tool in their kit.
 *
 * @param {string} characterId - The character's id, such as 'scout'.
 * @returns {object} A fresh tools object; empty for a character with no kit tools (or an unknown id).
 */
export function startingTools(characterId) {
  const kit = CHARACTERS.find((c) => c.id === characterId)?.tools ?? [];
  return Object.fromEntries(kit.map((tool) => [tool, newStoneTool(tool)]));
}

/**
 * Uses up a stone tool a little, like a pencil getting shorter each time it is sharpened.
 *
 * Iron tools and tools the player doesn't own are left alone. A stone tool that runs out is
 * removed from the backpack. Hard work (a big rock) takes more than one use at once.
 *
 * @param {object} state - The game being played. The tool's uses go down, or it is removed.
 * @param {string} tool - The tool's id.
 * @param {number} [uses] - How many uses this piece of work costs. One unless told otherwise.
 * @returns {string|null} 'warn' when this work brought the tool down to TOOL_WEAR_WARNING uses or
 *   fewer for the first time, 'broke' when it just ran out, otherwise null.
 */
export function wearTool(state, tool, uses = 1) {
  const owned = state.tools[tool];
  if (owned?.tier !== 'stone') return null;

  const before = owned.uses;
  owned.uses -= uses;
  if (owned.uses <= 0) {
    delete state.tools[tool];
    return 'broke';
  }
  // Warn once, on the step that crosses the line, even when that step skips right past it.
  return before > TOOL_WEAR_WARNING && owned.uses <= TOOL_WEAR_WARNING ? 'warn' : null;
}
