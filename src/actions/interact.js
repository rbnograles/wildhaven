// What the E key (and the on-screen interact button) does right now. Several things share the
// key, so this file picks one in a fixed order and does it: step ashore, board the boat, repair
// an old boat, or gather a supply. It also finishes timed actions, crafting a tool included.

import { WRECKS } from '../data/places.js';
import { wearTool } from '../world/tools.js';
import { nearbyNode, beginGather, finishGather, dropFrom } from './gather.js';
import { finishCraft, CRAFT_PREFIX } from './craft.js';
import { finishMake } from './gear.js';
import { GEAR_IDS } from '../data/gear.js';
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
 * @param {string} [id] - Id of a node the player clicked. With it, only that node is gathered
 *   (never from the boat) and the usual order is skipped: the click chose the target.
 * @returns {{ok: boolean, kind?: string, reason?: string, missing?: object, node?: object, wreck?: object}}
 *   `ok` with the `kind` done or started; otherwise `reason` is 'busy' (an action is running, or
 *   the character is asleep), 'none' or 'missing'.
 */
export function beginInteraction(state, animator, id) {
  if (animator.pending || animator.asleep > 0) return { ok: false, reason: 'busy' };
  if (id) {
    if (state.aboard) return { ok: false, reason: 'none' };
    return { ...beginGather(state, animator, id), kind: 'gather' };
  }
  const choice = chooseInteraction(state);
  if (!choice) return { ok: false, reason: 'none' };

  if (choice.kind === 'land') return { ok: disembark(state), kind: 'land' };
  if (choice.kind === 'board') return { ok: board(state), kind: 'board' };
  if (choice.kind === 'repair') return { ...beginRepair(state, animator), kind: 'repair' };
  return { ...beginGather(state, animator), kind: 'gather' };
}

/**
 * Hands out the result of a timed action when it finishes: a mended boat, gathered supplies or a
 * crafted tool.
 *
 * @param {object} state - The game being played.
 * @param {string} target - The id the action was aimed at: an old boat's, a node's, or
 *   `craft:<tool>` for a craft.
 * @param {() => number} [roll] - Gives a number from 0 to 1, for the find a chopped tree may drop;
 *   tests pass their own.
 * @returns {{kind: string, wreck?: object, node?: object, wear?: string|null, drop?: string}|null} What was
 *   finished, or null if nothing was awarded. After a gather, `wear` is 'warn' or 'broke' when a
 *   stone tool is wearing out (see wearTool), and `drop` is the resource a chopped tree also
 *   dropped, when it did. A craft always gives `{kind: 'craft', ok, ...}` (see
 *   finishCraft), even when its last check failed.
 */
export function finishInteraction(state, target, roll = Math.random) {
  if (target.startsWith(CRAFT_PREFIX)) {
    // A craft is a tool, or a piece of gear (torch, coat, grip, boat); both report as 'craft'.
    const id = target.slice(CRAFT_PREFIX.length);
    return {
      kind: 'craft',
      ...(GEAR_IDS.includes(id) ? finishMake(state, id) : finishCraft(state, id)),
    };
  }
  if (WRECKS.some((w) => w.id === target)) {
    const wreck = finishRepair(state, target);
    return wreck ? { kind: 'repair', wreck } : null;
  }
  const node = finishGather(state, target);
  if (!node) return null;
  // A gather that needed a tool wears it a little; only stone tools wear out.
  const finished = { kind: 'gather', node, wear: node.tool ? wearTool(state, node.tool) : null };
  // A chopped tree sometimes drops a find as well; `drop` is only there when one fell.
  const drop = dropFrom(state, node, roll);
  return drop ? { ...finished, drop } : finished;
}
