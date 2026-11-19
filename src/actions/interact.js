// What the E key (and the on-screen interact button) does right now. Several things share the
// key, so this file picks one in a fixed order and does it: step ashore, board the boat, repair
// an old boat, or gather a supply.

import { WRECKS } from '../data/places.js';
import { nearbyNode, beginGather, finishGather } from './gather.js';
import {
  nearbyWreck,
  beginRepair,
  finishRepair,
  canBoard,
  board,
  landingSpot,
  disembark,
} from './boat.js';

/**
 * Picks what pressing E would do right now, without doing it.
 *
 * Only one thing happens per press, so the choices are tried in order, like a queue at a counter:
 * step ashore when in the boat, get in when next to it, repair an old boat, then gather. The HUD
 * uses the answer for the button's words and the renderer for its highlight.
 *
 * @param {object} state - The game being played.
 * @returns {{kind: string, target: object}|null} `kind` is 'land', 'board', 'repair' or 'gather';
 *   `target` is the landing spot, the boat, the old boat or the node. Null when nothing is in reach.
 */
export function chooseInteraction(state) {
  if (state.aboard) {
    const spot = landingSpot(state);
    return spot ? { kind: 'land', target: spot } : null;
  }
  if (canBoard(state)) return { kind: 'board', target: state.boat };
  const wreck = nearbyWreck(state);
  if (wreck) return { kind: 'repair', target: wreck };
  const node = nearbyNode(state);
  return node ? { kind: 'gather', target: node } : null;
}

/**
 * Does what pressing E means right now.
 *
 * Landing and boarding happen at once. Repairing and gathering only start a timed action, which
 * the game loop finishes later through finishInteraction, so their rewards arrive exactly once.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state.
 * @returns {{ok: boolean, kind?: string, reason?: string, missing?: object, node?: object, wreck?: object}}
 *   `ok` with the `kind` done or started; otherwise `reason` is 'busy', 'none' or 'missing'.
 */
export function beginInteraction(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const choice = chooseInteraction(state);
  if (!choice) return { ok: false, reason: 'none' };

  if (choice.kind === 'land') return { ok: disembark(state), kind: 'land' };
  if (choice.kind === 'board') return { ok: board(state), kind: 'board' };
  if (choice.kind === 'repair') return { ...beginRepair(state, animator), kind: 'repair' };
  return { ...beginGather(state, animator), kind: 'gather' };
}

/**
 * Hands out the result of a timed action when it finishes: a mended boat or gathered supplies.
 *
 * @param {object} state - The game being played.
 * @param {string} target - The id the action was aimed at: an old boat's or a node's.
 * @returns {{kind: string, wreck?: object, node?: object}|null} What was finished, or null if
 *   nothing was awarded.
 */
export function finishInteraction(state, target) {
  if (WRECKS.some((w) => w.id === target)) {
    const wreck = finishRepair(state, target);
    return wreck ? { kind: 'repair', wreck } : null;
  }
  const node = finishGather(state, target);
  return node ? { kind: 'gather', node } : null;
}
