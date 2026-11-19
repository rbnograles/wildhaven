// The boat actions: repairing an old boat on the beach, getting in, rowing about and stepping
// ashore. Repairing is a timed action like gathering: E starts it (`beginRepair`) and the game
// loop finishes it (`finishRepair`), so the cost is paid exactly once.

import { WRECKS } from '../data/places.js';
import { GATHER_RANGE, REPAIR_COST, REPAIR_SECONDS } from '../data/balance.js';
import { startAction } from '../animation/clips.js';
import { facing } from './move.js';

/** How far a spot is from the player, in world units. */
const distance = (state, p) => Math.hypot(p.x - state.player.x, p.y - state.player.y);

/**
 * Finds the old boat the player could repair right now.
 *
 * Only someone on foot without a boat can repair one, and only when standing next to it (the same
 * reach as gathering).
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest old boat in reach, or null.
 */
export function nearbyWreck(state) {
  if (state.boat || state.aboard) return null;
  return (
    WRECKS.filter((w) => distance(state, w) < GATHER_RANGE).sort(
      (a, b) => distance(state, a) - distance(state, b),
    )[0] ?? null
  );
}

/**
 * Says what the backpack still lacks for a repair, like a shopping list.
 *
 * @param {object} state - The game being played.
 * @returns {object} Each resource that falls short with how many more are needed, e.g. `{wood: 3}`;
 *   an empty object when there is enough.
 */
export function missingForRepair(state) {
  return Object.fromEntries(
    Object.entries(REPAIR_COST)
      .map(([type, cost]) => [type, cost - state.resources[type]])
      .filter(([, short]) => short > 0),
  );
}

/**
 * Puts a shopping list into words, e.g. `{wood: 3, stone: 1}` becomes "3 wood and 1 stone".
 *
 * @param {object} missing - What missingForRepair returned.
 * @returns {string} The list in words.
 */
export const listMissing = (missing) =>
  Object.entries(missing)
    .map(([type, count]) => `${count} ${type}`)
    .join(' and ');

/**
 * Starts repairing the nearest old boat: what pressing E does next to one.
 *
 * Nothing is paid yet. Like beginGather, this only starts the timed action (the hammering `build`
 * clip); finishRepair pays and hands over the boat when it runs out.
 *
 * @param {object} state - The game being played. The player turns to face the old boat.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @returns {{ok: boolean, reason?: string, wreck?: object, missing?: object}} `ok` with the old boat
 *   when it started; otherwise `reason` is 'busy', 'none' (no old boat in reach, or a boat already
 *   owned) or 'missing' (with `missing`, what the backpack lacks).
 */
export function beginRepair(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const wreck = nearbyWreck(state);
  if (!wreck) return { ok: false, reason: 'none' };
  const missing = missingForRepair(state);
  if (Object.keys(missing).length) return { ok: false, reason: 'missing', wreck, missing };

  // Face the old boat, unless it's almost straight above or below the player.
  if (Math.abs(wreck.x - state.player.x) > 8)
    state.player.direction = wreck.x < state.player.x ? 1 : 2;
  startAction(animator, 'build', wreck.id, REPAIR_SECONDS);
  return { ok: true, wreck };
}

/**
 * Pays for a repair and puts the mended boat in the water when the repair action finishes.
 *
 * It checks again that the old boat is in reach, that the player still has no boat, and that the
 * backpack still holds enough, so nothing is paid twice or paid for nothing. The boat floats at
 * the old boat's `launch` spot, pointing out to sea.
 *
 * @param {object} state - The game being played. Its resources and `boat` change.
 * @param {string} id - Id of the old boat the action was aimed at.
 * @returns {object|null} The old boat that was repaired, or null if nothing happened.
 */
export function finishRepair(state, id) {
  const wreck = WRECKS.find((w) => w.id === id);
  if (!wreck || state.boat || state.aboard || distance(state, wreck) >= GATHER_RANGE) return null;
  if (Object.keys(missingForRepair(state)).length) return null;

  for (const [type, cost] of Object.entries(REPAIR_COST)) state.resources[type] -= cost;
  const { launch } = wreck;
  state.boat = {
    from: wreck.id,
    x: launch.x,
    y: launch.y,
    dir: facing(launch.x - wreck.x, launch.y - wreck.y),
  };
  return wreck;
}
