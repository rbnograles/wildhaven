// The "gather" action: picking up wood, stone, food and herbs from supplies near the player.
// Gathering takes time. Pressing E starts it (`beginGather`), and the game loop hands out the
// supplies only when the timer runs out (`finishGather`), so nothing is awarded twice. A gathered
// node is gone until it grows back.

import { NODES, isAvailable } from '../world/nodes.js';
import { GATHER_RANGE, GATHER_SECONDS } from '../data/balance.js';
import { startAction } from '../animation/clips.js';

/**
 * Says how many seconds gathering from a node takes.
 *
 * Today every node takes the same time. This is the one place gathering tools will shorten the
 * action later, which is why it takes the game and the node even though it doesn't use them yet.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The supply or wild patch being gathered.
 * @returns {number} Seconds the gathering action lasts.
 */
export function gatherTime(state, node) {
  return GATHER_SECONDS;
}

/** True when the node is close enough to the player to gather it. */
const inReach = (state, n) => Math.hypot(n.x - state.player.x, n.y - state.player.y) < GATHER_RANGE;

// Whether a node can be gathered now is decided in world/nodes.js; it is passed on from here for
// the HUD and the renderer, which already import it from this file.
export { isAvailable };

/**
 * True once the player has gathered anything at all.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True if any supply or wild patch has a regrow timer.
 */
export const hasGathered = (state) => Object.keys(state.regrowAt).length > 0;

/**
 * Finds the closest node the player could gather from right now.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest available node in reach, or null if there is none.
 */
export function nearbyNode(state) {
  return (
    NODES.filter((n) => isAvailable(state, n) && inReach(state, n)).sort(
      (a, b) =>
        Math.hypot(a.x - state.player.x, a.y - state.player.y) -
        Math.hypot(b.x - state.player.x, b.y - state.player.y),
    )[0] ?? null
  );
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
 * @returns {{ok: boolean, reason?: string, node?: object}} `ok` with the node when it started;
 *   otherwise `reason` is 'busy' (already doing something) or 'none' (nothing in reach).
 */
export function beginGather(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const node = nearbyNode(state);
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
 * It checks the node is still there and still in reach, puts the supplies in the backpack, and
 * marks the node as used until it grows back.
 * The loop passes the id the action targeted; without one, the nearest available node is used.
 *
 * @param {object} state - The game being played. Its resources and gathered lists change.
 * @param {string} [id] - Id of the node the action was aimed at.
 * @returns {object|null} The node that was gathered, or null if nothing was awarded.
 */
export function finishGather(state, id = nearbyNode(state)?.id) {
  const node = NODES.find((n) => n.id === id);
  if (!node || !isAvailable(state, node) || !inReach(state, node)) return null;

  state.regrowAt[node.id] = state.time + node.regrow;
  state.resources[node.type] += node.amount;
  return node;
}
