// The "build" action: placing a campfire, which founds a new camp, and naming that camp.
// A placement is checked first, and the cost is paid only when the fire really goes down.

import {
  CAMPFIRE_COST,
  PLACE_RANGE,
  CAMP_SPACING,
  NODE_CLEARANCE,
  MAX_CAMPS,
} from '../data/balance.js';
import { isWalkable, blocks } from '../world/map.js';
import { NODES, solidBases } from '../world/nodes.js';
import { fireBase, suggestCampName, cleanCampName } from '../world/camps.js';
import { makeNeeds } from '../world/needs.js';

// The spacing, in world units, of the test points poked across a fire's base (see baseIsClear).
const PROBE = 16;

/** What the game says when the player tries to build while sitting in the boat. */
export const BUILD_ABOARD = 'Step ashore to build';

/**
 * Says whether a campfire's whole solid base would stand on open ground.
 *
 * It pokes test points every 16 units across the base, like checking a cake with a skewer, and
 * each one must be clear of water, scenery, standing supplies, old boats and other fires.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the fire.
 * @param {number} y - World y of the fire.
 * @returns {boolean} True when the whole base is clear.
 */
function baseIsClear(state, x, y) {
  const [left, top, right, bottom] = fireBase(x, y);
  const solid = solidBases(state);
  for (let py = top; py < bottom + PROBE; py += PROBE)
    for (let px = left; px < right + PROBE; px += PROBE)
      if (!isWalkable(Math.min(px, right), Math.min(py, bottom), solid)) return false;
  return true;
}

/**
 * Checks whether a campfire may be placed at a spot, without changing anything.
 *
 * The first rule that fails is the answer: the player is in the boat (a fire can't be lit from
 * the water), not enough wood and stone, already as many camps as a save can hold, too far from
 * the player, something in the way, or too close to another camp.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the spot.
 * @param {number} y - World y of the spot.
 * @returns {{ok: boolean, reason?: string, message?: string}} `ok` when the fire may go there;
 *   otherwise `reason` ('aboard', 'cost', 'limit', 'far', 'blocked' or 'close') and a `message` to show.
 */
export function checkPlacement(state, x, y) {
  const { resources, player } = state;
  if (state.aboard) return { ok: false, reason: 'aboard', message: BUILD_ABOARD };
  if (Object.entries(CAMPFIRE_COST).some(([type, amount]) => resources[type] < amount))
    return {
      ok: false,
      reason: 'cost',
      message: `Needs ${CAMPFIRE_COST.wood} wood and ${CAMPFIRE_COST.stone} stone`,
    };
  if (state.camps.length >= MAX_CAMPS)
    return { ok: false, reason: 'limit', message: "You can't keep more camps" };
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.hypot(x - player.x, y - player.y) > PLACE_RANGE
  )
    return { ok: false, reason: 'far', message: 'Too far away' };
  // Supplies and flower patches need room around a fire; trees and rocks only need to be off its
  // base, which baseIsClear checks (a chopped one still counts, since it will grow back).
  if (
    blocks([fireBase(x, y)], player.x, player.y) ||
    NODES.some((n) => !n.inScenery && Math.hypot(n.x - x, n.y - y) < NODE_CLEARANCE) ||
    !baseIsClear(state, x, y)
  )
    return { ok: false, reason: 'blocked', message: 'Something is in the way' };

  const near = state.camps.find((camp) => Math.hypot(camp.x - x, camp.y - y) < CAMP_SPACING);
  if (near) return { ok: false, reason: 'close', message: `Too close to ${near.name}` };
  return { ok: true };
}

/**
 * Places a campfire, founding a new camp with a suggested name and three needs.
 *
 * The spot is rounded to whole units and checked again, so a refused fire costs nothing. Like
 * paying at a till, the wood and stone leave the backpack only once the fire is really down.
 *
 * @param {object} state - The game being played. Resources and camps change on success.
 * @param {number} x - World x of the spot.
 * @param {number} y - World y of the spot.
 * @returns {{ok: boolean, camp?: object, reason?: string, message?: string}} The new camp, or the
 *   refusal from `checkPlacement`.
 */
export function placeCampfire(state, x, y) {
  const spot = { x: Math.round(x), y: Math.round(y) };
  const check = checkPlacement(state, spot.x, spot.y);
  if (!check.ok) return check;

  for (const [type, amount] of Object.entries(CAMPFIRE_COST)) state.resources[type] -= amount;
  const number = Math.max(0, ...state.camps.map((camp) => Number(camp.id.slice(5)))) + 1;
  const camp = {
    id: `camp-${number}`,
    name: suggestCampName(state, spot.x, spot.y),
    ...spot,
    grown: 0,
    needs: [],
  };
  camp.needs = makeNeeds(state, camp);
  state.camps.push(camp);
  return { ok: true, camp };
}

/**
 * Renames a camp to a name the player typed.
 *
 * @param {object} state - The game being played. The camp's name changes on success.
 * @param {string} campId - The camp's id.
 * @param {*} text - What the player typed; it is tidied first.
 * @returns {{ok: boolean, camp?: object, reason?: string}} The camp, or `reason` 'unknown' (no
 *   such camp) or 'empty' (nothing left after tidying).
 */
export function nameCamp(state, campId, text) {
  const camp = state.camps.find((c) => c.id === campId);
  if (!camp) return { ok: false, reason: 'unknown' };
  const name = cleanCampName(text);
  if (!name) return { ok: false, reason: 'empty' };
  camp.name = name;
  return { ok: true, camp };
}
