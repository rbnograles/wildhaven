// The "gather" action: picking up wood, stone, food, herbs and iron near the player. Trees need an
// axe and rocks a pickaxe. Gathering takes time. Pressing E starts it (`beginGather`), and the game
// loop hands out the supplies only when the timer runs out (`finishGather`), so nothing is awarded
// twice. A gathered node is gone until it grows back.

import { NODES, nodesNear, isAvailable } from '../world/nodes.js';
import { GATHER_RANGE, GATHER_SECONDS, TOOL_SECONDS } from '../data/balance.js';
import { toolTier, hasTool } from '../world/tools.js';
import { startAction } from '../animation/clips.js';

/**
 * Says how many seconds gathering from a node takes.
 *
 * Bare-hand gathers take the full GATHER_SECONDS. A node that needs a tool (a tree, a rock) is
 * quicker with a stone tool and quicker still with an iron one: better tools, faster work.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The supply, wild patch, tree or rock being gathered.
 * @returns {number} Seconds the gathering action lasts.
 */
export function gatherTime(state, node) {
  const tier = node.tool && toolTier(state, node.tool);
  return tier ? TOOL_SECONDS[tier] : GATHER_SECONDS;
}

/** True when the node is close enough to the player to gather it. */
const inReach = (state, n) => Math.hypot(n.x - state.player.x, n.y - state.player.y) < GATHER_RANGE;

/**
 * Says whether the player has whatever tool a node needs. Most supplies need none.
 *
 * @param {object} state - The game being played.
 * @param {object} n - The node to check.
 * @returns {boolean} True if nothing is needed or the player owns the tool.
 */
export const hasToolFor = (state, n) => !n.tool || hasTool(state, n.tool);

// Whether a node can be gathered now is decided in world/nodes.js; it is passed on from here for
// the HUD and the renderer, which already import it from this file.
export { isAvailable };

/**
 * Lists the nodes close enough to gather that have something to give, nearest first.
 *
 * @param {object} state - The game being played.
 * @returns {object[]} The nodes, nearest first (an empty list if none).
 */
function nodesInReach(state) {
  const { x, y } = state.player;
  return nodesNear(x, y)
    .filter((n) => isAvailable(state, n) && inReach(state, n))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}

/**
 * Finds the closest node the player could gather from right now, with the tools they have.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest available node in reach, or null if there is none.
 */
export function nearbyNode(state) {
  return nodesInReach(state).find((n) => hasToolFor(state, n)) ?? null;
}

/**
 * Finds the closest node in reach that needs a tool the player doesn't have yet.
 *
 * The HUD and E use it to say what to craft ("Chop pine tree — needs an axe") instead of
 * staying silent beside a tree.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest such node, or null if there is none.
 */
export function lockedNode(state) {
  return nodesInReach(state).find((n) => !hasToolFor(state, n)) ?? null;
}

/**
 * Says what clicking a tree or rock under the mouse would do right now.
 *
 * The mouse can point at any tree on screen, but the player can only work on one they stand
 * beside and have the tool for. The badge over the tree shows which of the three it is.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The node under the mouse.
 * @returns {'ready'|'far'|'locked'|null} 'ready' when a click would start the work, 'locked' when
 *   the player lacks its tool, 'far' when they must walk closer first, and null when there is
 *   nothing to aim at (the node is gone until it grows back, or the player is in the boat).
 */
export function aimState(state, node) {
  if (state.aboard || !isAvailable(state, node)) return null;
  if (!hasToolFor(state, node)) return 'locked';
  return inReach(state, node) ? 'ready' : 'far';
}

/**
 * Starts gathering from the nearest node: what pressing E does.
 *
 * E starts the node's timed action (its clip, for gatherTime seconds); finishGather awards it
 * once the action runs out. Think of it like starting a microwave timer: pressing the button
 * doesn't cook the food, the ding at the end does.
 *
 * @param {object} state - The game being played. The player turns to face the node.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {string} [id] - Id of one node to gather, for a click on it. It must be in reach, have
 *   something to give and need no tool the player lacks. Without an id the nearest node is used.
 * @returns {{ok: boolean, reason?: string, node?: object}} `ok` with the node when it started;
 *   otherwise `reason` is 'busy' (already doing something) or 'none' (nothing in reach).
 */
export function beginGather(state, animator, id) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const node = id
    ? nodesInReach(state).find((n) => n.id === id && hasToolFor(state, n))
    : nearbyNode(state);
  if (!node) return { ok: false, reason: 'none' };

  // Face the node, unless it's almost straight above or below the player.
  if (Math.abs(node.x - state.player.x) > 8)
    state.player.direction = node.x < state.player.x ? 1 : 2;
  startAction(animator, node.clip, node.id, gatherTime(state, node));
  return { ok: true, node };
}

/**
 * Hands out a node's supplies when its gathering action finishes.
 *
 * It checks the node is still there, still in reach and that the player has its tool, puts the
 * supplies in the backpack, and marks the node as used until it grows back. Wearing the tool down
 * is up to finishInteraction, which reports it.
 * The loop passes the id the action targeted; without one, the nearest available node is used.
 *
 * @param {object} state - The game being played. Its resources and gathered lists change.
 * @param {string} [id] - Id of the node the action was aimed at.
 * @returns {object|null} The node that was gathered, or null if nothing was awarded.
 */
export function finishGather(state, id = nearbyNode(state)?.id) {
  const node = NODES.find((n) => n.id === id);
  if (!node || !isAvailable(state, node) || !inReach(state, node) || !hasToolFor(state, node))
    return null;

  state.regrowAt[node.id] = state.time + node.regrow;
  state.resources[node.type] += node.amount;
  return node;
}
