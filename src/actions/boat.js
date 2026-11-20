// The boat actions: repairing an old boat on the beach, getting in, rowing about and stepping
// ashore. Repairing is a timed action like gathering: E starts it (`beginRepair`) and the game
// loop finishes it (`finishRepair`), so the cost is paid exactly once.

import { WRECKS } from '../data/places.js';
import { RESOURCE_NAMES } from '../data/supplies.js';
import {
  GATHER_RANGE,
  REPAIR_COST,
  REPAIR_SECONDS,
  BOARD_RANGE,
  LAND_RANGE,
  DEEP_LOOKOUT,
} from '../data/balance.js';
import { isWalkable, isDeep } from '../world/map.js';
import { solidBases } from '../world/nodes.js';
import { startAction } from '../animation/clips.js';
import { facing } from './move.js';

// What `boat.from` holds for a boat the player built themselves (actions/gear.js) instead of
// mending an old one. Such a boat also carries `home`: the water it was launched on.
export const BUILT = 'built';

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
    .map(([type, count]) => `${count} ${RESOURCE_NAMES[type] ?? type}`)
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
  state.boat = homeMooring(wreck);
  return wreck;
}

/**
 * Gives the spot where a boat mended from an old boat floats when it is "home".
 *
 * Home is the old boat's `launch` spot in the water, with the boat pointing away from the beach,
 * out to sea.
 *
 * @param {object} wreck - The old boat (from WRECKS) the boat was repaired from.
 * @returns {{from: string, x: number, y: number, dir: number}} A fresh boat record for that spot.
 */
function homeMooring(wreck) {
  const { launch } = wreck;
  return {
    from: wreck.id,
    x: launch.x,
    y: launch.y,
    dir: facing(launch.x - wreck.x, launch.y - wreck.y),
  };
}

/**
 * Sends the player's boat back to its home mooring: by the old boat it was repaired from, or the
 * water it was launched on if the player built it.
 *
 * Used when the player is taken away from the boat (for example passing out at sea and waking
 * by a fire): nobody is rowing, so the boat drifts home, like a stray dinghy washing back to its
 * own beach. A player who was aboard is put out of it; the caller then moves them somewhere on land.
 *
 * @param {object} state - The game being played. `boat` and `aboard` may change.
 * @returns {boolean} True when the boat moved; false when there is no boat or it was already home.
 */
export function sendBoatHome(state) {
  state.aboard = false;
  if (!state.boat) return false;

  const built = state.boat.from === BUILT && state.boat.home;
  const home = built
    ? { from: BUILT, home: built, x: built.x, y: built.y, dir: built.dir }
    : homeMooring(WRECKS.find((w) => w.id === state.boat.from));
  const { x, y, dir } = state.boat;
  if (x === home.x && y === home.y && dir === home.dir) return false;
  state.boat = home;
  return true;
}

/**
 * Says whether the player can get into their boat right now: on foot, owning a boat, and close to it.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True if pressing E would board the boat.
 */
export const canBoard = (state) =>
  !state.aboard && !!state.boat && distance(state, state.boat) < BOARD_RANGE;

/**
 * Gets the player into their boat, if it is close enough.
 *
 * The player moves onto the boat's spot and faces the way it points.
 *
 * @param {object} state - The game being played. `player` and `aboard` change.
 * @returns {boolean} True if the player got in.
 */
export function board(state) {
  if (!canBoard(state)) return false;
  Object.assign(state.player, { x: state.boat.x, y: state.boat.y, direction: state.boat.dir });
  state.aboard = true;
  return true;
}

/**
 * Finds the closest dry spot the player could step onto from the boat.
 *
 * It checks rings of spots around the boat, 12 units apart and growing outward, like ripples from
 * a stone dropped in water, and keeps the first spot the player could stand on. The rings stay
 * inside LAND_RANGE, so a spot it finds is always close enough to board again.
 *
 * @param {object} state - The game being played.
 * @returns {{x: number, y: number}|null} The spot, or null when the player isn't aboard or no land is near.
 */
export function landingSpot(state) {
  if (!state.aboard) return null;
  const bases = solidBases(state);
  for (let r = 12; r < LAND_RANGE; r += 12)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2,
        x = Math.round(state.player.x + Math.cos(angle) * r),
        y = Math.round(state.player.y + Math.sin(angle) * r);
      if (isWalkable(x, y, bases)) return { x, y };
    }
  return null;
}

/**
 * Steps the player ashore and leaves the boat moored where it floats.
 *
 * @param {object} state - The game being played. `player`, `boat` and `aboard` change.
 * @returns {boolean} True if the player landed; false when no land is in reach.
 */
export function disembark(state) {
  const spot = landingSpot(state);
  if (!spot) return false;

  Object.assign(state.boat, { x: state.player.x, y: state.player.y, dir: state.player.direction });
  Object.assign(state.player, spot, {
    direction: facing(spot.x - state.boat.x, spot.y - state.boat.y),
  });
  state.aboard = false;
  return true;
}

/**
 * Says whether the boat is heading into deep sea, so the HUD can warn that it's too rough.
 *
 * @param {object} state - The game being played.
 * @param {number} dx - Left/right push from the keys: -1, 0 or 1.
 * @param {number} dy - Up/down push from the keys: -1, 0 or 1.
 * @returns {boolean} True when aboard and the water DEEP_LOOKOUT units ahead is deep.
 */
export function deepAhead(state, dx, dy) {
  if (!state.aboard || (!dx && !dy)) return false;
  const length = Math.hypot(dx, dy);
  return isDeep(
    state.player.x + (dx / length) * DEEP_LOOKOUT,
    state.player.y + (dy / length) * DEEP_LOOKOUT,
  );
}
