// The "fish" action: with a fishing rod, E beside open water casts a line and, after a while,
// lands a fish for food. Like gathering it takes time: beginFish starts it, and the game loop's
// finishFish checks again and only then gives the food, so a catch is never given twice.

import { FISH_REACH, FISH_SECONDS, FISH_FOOD } from '../data/balance.js';
import { isDryLand } from '../world/map.js';
import { BAG_FULL, addItem, hasRoomFor } from '../world/bag.js';
import { facing } from './move.js';
import { startAction } from '../animation/clips.js';

/** The start of a timed fishing action's target: `fish:<x>:<y>`, the spot the line is cast to. */
export const FISH_PREFIX = 'fish:';

/**
 * Says whether the player owns a fishing rod.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True if they have made the rod.
 */
export const hasRod = (state) => !!state.rod;

/**
 * Finds the closest open water the player could cast a line into from where they stand.
 *
 * It checks rings of spots round the player, growing outward like ripples, and keeps the first
 * spot that is water. The rings stay inside FISH_REACH, so the player fishes from the bank.
 *
 * @param {object} state - The game being played.
 * @returns {{x: number, y: number}|null} The spot, or null when no water is close enough.
 */
export function fishingSpot(state) {
  if (state.aboard) return null;
  for (let r = 40; r <= FISH_REACH; r += 14)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2,
        x = Math.round(state.player.x + Math.cos(angle) * r),
        y = Math.round(state.player.y + Math.sin(angle) * r);
      if (!isDryLand(x, y)) return { x, y };
    }
  return null;
}

/**
 * Starts fishing at a spot of water: the player turns to it and works the line for FISH_SECONDS.
 *
 * Nothing is caught yet; finishFish gives the food when the time is up.
 *
 * @param {object} state - The game being played. The player's facing changes.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {{x: number, y: number}} spot - The water to cast into (see fishingSpot).
 * @returns {{ok: boolean, reason?: string, message?: string}} Whether fishing started, or why not:
 *   'busy', 'tool' (no rod) or 'full' (no room for the fish).
 */
export function beginFish(state, animator, spot) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  if (!hasRod(state))
    return { ok: false, reason: 'tool', message: 'Make a fishing rod in the Build menu (B)' };
  if (!hasRoomFor(state, { food: FISH_FOOD }))
    return { ok: false, reason: 'full', message: BAG_FULL };

  // The working pictures face east or west, so the player turns to whichever side the water is.
  state.player.direction = facing(spot.x - state.player.x, 0) === 1 ? 1 : 2;
  startAction(animator, 'gather', `${FISH_PREFIX}${spot.x}:${spot.y}`, FISH_SECONDS);
  return { ok: true };
}

/**
 * Lands the fish when the fishing action finishes, if the player is still there with their rod.
 *
 * @param {object} state - The game being played. The backpack gains food.
 * @param {string} target - Such as 'fish:13200:8840'.
 * @returns {{kind: 'fish', food: number}|null} The catch, or null when the rod is gone, the player
 *   has wandered off, or the bag filled up meanwhile.
 */
export function finishFish(state, target) {
  const [x, y] = target.slice(FISH_PREFIX.length).split(':').map(Number);
  const far = Math.hypot(state.player.x - x, state.player.y - y) > FISH_REACH * 1.5;
  if (!hasRod(state) || state.aboard || far || !hasRoomFor(state, { food: FISH_FOOD })) return null;
  addItem(state, 'food', FISH_FOOD);
  return { kind: 'fish', food: FISH_FOOD };
}
