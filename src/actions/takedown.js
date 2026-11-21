// The "take down" action: packing up a tent, breaking up a chest, a wheat bed or a camp centre,
// and putting out a campfire, which ends its camp. A tent goes into the item box whole, as a
// packed tent to pitch again for nothing; everything else gives back half of what it cost.
// Taking down takes time: beginTakeDown starts the timed action and the game loop finishes it
// through finishTakeDown, which checks everything again first.

import { BUILDING_COSTS, CAMPFIRE_COST, TAKEDOWN_SECONDS } from '../data/balance.js';
import { buildingInfo } from '../data/buildings.js';
import { fireRadius } from '../world/camps.js';
import { BAG_FULL, TENT_ITEM, addItem, hasRoomFor, tidyBag } from '../world/bag.js';
import { startAction } from '../animation/clips.js';

/** The start of a timed take-down action's target: `takedown:<camp id>:<building id, or fire>`. */
export const TAKEDOWN_PREFIX = 'takedown:';

/** What stands for the campfire itself in a take-down target, where a building's id would be. */
export const FIRE = 'fire';

/**
 * Halves a cost, rounding each number down, and leaves out anything that comes to nothing.
 *
 * @param {object} cost - Such as {wood: 3, stone: 2}.
 * @returns {object} Half of it, such as {wood: 1, stone: 1}.
 */
const half = (cost) =>
  Object.fromEntries(
    Object.entries(cost)
      .map(([type, n]) => [type, Math.floor(n / 2)])
      .filter(([, n]) => n > 0),
  );

/**
 * Says what taking something down gives back.
 *
 * A campfire, a chest and a wheat bed give half their cost; a camp centre half the cost of the
 * tier it stands at now; a tent gives no resources, because the whole tent is kept.
 *
 * @param {object|null} building - The building, or null for the campfire.
 * @returns {object} The resources given back, such as {wood: 3, stone: 1}.
 */
export function refundOf(building) {
  if (!building) return half(CAMPFIRE_COST);
  if (building.kind === 'tent') return {};
  if (building.kind === 'centre') return half(BUILDING_COSTS.centre[building.tier - 1]);
  return half(BUILDING_COSTS[building.kind]);
}

/**
 * Checks whether something at a camp may be taken down now, without changing anything.
 *
 * The first rule that fails is the answer: the player is in the boat, stands outside the camp's
 * warmth, the fire still has buildings round it (they come down first, so nothing is lost by
 * accident), a chest still holds something, or the item box has no room for what comes back.
 *
 * @param {object} state - The game being played.
 * @param {string} campId - The camp's id.
 * @param {string} what - A building's id, or FIRE for the campfire.
 * @returns {{ok: boolean, camp?: object, building?: object|null, refund?: object, reason?: string,
 *   message?: string}} `ok` with the camp, the building (null for the fire) and what comes back;
 *   otherwise `reason` ('unknown', 'aboard', 'far', 'buildings', 'contents' or 'full') and a
 *   `message` to show.
 */
export function checkTakeDown(state, campId, what) {
  const camp = state.camps.find((c) => c.id === campId),
    building = what === FIRE ? null : camp?.buildings.find((b) => b.id === what);
  if (!camp || (what !== FIRE && !building))
    return { ok: false, reason: 'unknown', message: 'There is nothing to take down' };
  if (state.aboard) return { ok: false, reason: 'aboard', message: 'Step ashore to take it down' };
  if (Math.hypot(camp.x - state.player.x, camp.y - state.player.y) > fireRadius(camp))
    return { ok: false, reason: 'far', message: `Stand within the warmth of ${camp.name}` };

  if (!building && camp.buildings.length)
    return { ok: false, reason: 'buildings', message: 'Take down the buildings here first' };
  if (building?.kind === 'chest' && Object.values(building.contents ?? {}).some((n) => n > 0))
    return { ok: false, reason: 'contents', message: 'Empty the chest first' };

  const refund = refundOf(building),
    coming = building?.kind === 'tent' ? { [TENT_ITEM]: 1 } : refund;
  if (!hasRoomFor(state, coming)) return { ok: false, reason: 'full', message: BAG_FULL };
  return { ok: true, camp, building, refund };
}

/**
 * Starts taking something down: the hammering `build` clip runs for TAKEDOWN_SECONDS.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {string} campId - The camp's id.
 * @param {string} what - A building's id, or FIRE.
 * @returns {object} The check from checkTakeDown, or {ok: false, reason: 'busy'}.
 */
export function beginTakeDown(state, animator, campId, what) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const check = checkTakeDown(state, campId, what);
  if (check.ok)
    startAction(animator, 'build', `${TAKEDOWN_PREFIX}${campId}:${what}`, TAKEDOWN_SECONDS);
  return check;
}

/**
 * Finishes a take-down when its timed action runs out: checks again, removes the building (or the
 * whole camp, for its fire) and puts what comes back in the item box.
 *
 * @param {object} state - The game being played. Camps, resources and the packed tent change.
 * @param {string} target - Such as 'takedown:camp-2:b-5' or 'takedown:camp-2:fire'.
 * @returns {{kind: 'takedown', ok: boolean, what?: string, camp?: object, refund?: object,
 *   message?: string}} `what` is the building's kind, or FIRE; `refund` is what came back.
 */
export function finishTakeDown(state, target) {
  const [campId, what] = target.slice(TAKEDOWN_PREFIX.length).split(':');
  const check = checkTakeDown(state, campId, what);
  if (!check.ok) return { ...check, kind: 'takedown' };
  const { camp, building, refund } = check;

  if (building) camp.buildings = camp.buildings.filter((b) => b !== building);
  else state.camps = state.camps.filter((c) => c !== camp);

  if (building?.kind === 'tent') state.packedTent = true;
  for (const [type, n] of Object.entries(refund)) addItem(state, type, n);
  tidyBag(state);
  return { kind: 'takedown', ok: true, what: building ? building.kind : FIRE, camp, refund };
}

/**
 * Says what a take-down button should read for a building.
 *
 * @param {object} building - The building.
 * @returns {string} "Pack up" for a tent (it is kept), "Take down" for the rest.
 */
export const takeDownVerb = (building) => (building.kind === 'tent' ? 'Pack up' : 'Take down');

/**
 * Names a building for a take-down line, such as "Storage chest".
 *
 * @param {object} building - The building.
 * @returns {string} Its name with a capital first letter.
 */
export function takeDownName(building) {
  const { name } = buildingInfo(building.kind);
  return name[0].toUpperCase() + name.slice(1);
}
