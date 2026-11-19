// Camps: the campfires the player has built. This file answers questions about them (how far a
// fire's warmth reaches, which fire is closest, whether the player is warm, what a new camp is
// called) without changing anything.

import { FIRE_RADIUS, FIRE_GROWTH, CAMP_REACH, CAMP_NAME_MAX } from '../data/balance.js';
import { OBJECT_SPECS } from './map.js';
import { regionOf } from './regions.js';

/**
 * Says how far a camp's fire keeps the player warm.
 *
 * A new fire warms a small circle; every need the camp has had met makes the circle bigger.
 *
 * @param {{grown: number}} camp - The camp.
 * @returns {number} The warmth radius in world units.
 */
export const fireRadius = (camp) => FIRE_RADIUS + FIRE_GROWTH * camp.grown;

/**
 * Measures the distance from a camp's fire to a spot.
 *
 * @param {object} camp - The camp.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} The distance in world units.
 */
const distance = (camp, x, y) => Math.hypot(camp.x - x, camp.y - y);

/**
 * Finds the camp whose fire is closest to a spot (the player, unless another spot is given).
 *
 * @param {object} state - The game being played.
 * @param {number} [x] - World x position; defaults to the player's.
 * @param {number} [y] - World y position; defaults to the player's.
 * @returns {object|null} The nearest camp, or null when there are no camps yet.
 */
export function nearestCamp(state, x = state.player.x, y = state.player.y) {
  let best = null;
  for (const camp of state.camps)
    if (!best || distance(camp, x, y) < distance(best, x, y)) best = camp;
  return best;
}

/**
 * Says whether the player stands inside the warmth of any of their fires.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True when some fire's warmth reaches the player.
 */
export const byFire = (state) =>
  state.camps.some((camp) => distance(camp, state.player.x, state.player.y) <= fireRadius(camp));

/**
 * Finds the camp the player is close enough to open (by pressing E beside its fire).
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The camp, or null when no fire is that close.
 */
export function campInReach(state) {
  const camp = nearestCamp(state);
  return camp && distance(camp, state.player.x, state.player.y) <= CAMP_REACH ? camp : null;
}

/**
 * Gives the solid base of a campfire standing at a spot, as a box.
 *
 * The box comes from the campfire sprite's footprint in objects.json, like every map object's.
 *
 * @param {number} x - World x of the fire (the middle of its base).
 * @param {number} y - World y of the fire (the bottom edge of its base).
 * @returns {number[]} The box as [left, top, right, bottom].
 */
export function fireBase(x, y) {
  const [halfWidth, depth] = OBJECT_SPECS.campfire.footprint;
  return [x - halfWidth, y - depth, x + halfWidth, y];
}

/**
 * Lists the solid base of every camp's fire, so walking and building go around them.
 *
 * @param {object} state - The game being played.
 * @returns {number[][]} One box per camp.
 */
export const campBases = (state) => state.camps.map((camp) => fireBase(camp.x, camp.y));

/**
 * Suggests a name for a camp founded at a spot: the region's first word plus "Camp".
 *
 * If that name is taken, a number is added: "Pinefall Camp 2", "Pinefall Camp 3" and so on.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the new fire.
 * @param {number} y - World y of the new fire.
 * @returns {string} A name no other camp has.
 */
export function suggestCampName(state, x, y) {
  const base = `${regionOf(x, y).name.split(' ')[0]} Camp`;
  let name = base;
  for (let n = 2; state.camps.some((camp) => camp.name === name); n++) name = `${base} ${n}`;
  return name;
}

/**
 * Tidies a name the player typed: squeezes runs of spaces, trims the ends, and cuts it to the limit.
 *
 * @param {*} text - What was typed.
 * @returns {string} The tidy name, or '' if nothing was left.
 */
export const cleanCampName = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CAMP_NAME_MAX)
    .trim();
