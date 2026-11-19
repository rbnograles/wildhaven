// Camp actions: what the player can do with their backpack and at their camps (give to a need,
// eat, heal, brew tea, rest through the night) and what happens when they pass out from the cold.
// Each one checks first and changes nothing when it says no.

import { CHARACTERS } from '../data/characters.js';
import {
  FOOD_HUNGER,
  HEAL_HERBS,
  HEAL_HEALTH,
  TEA_HERBS,
  TEA_SECONDS,
  WAKE_HEALTH,
  WAKE_OFFSET,
} from '../data/balance.js';
import { isWalkable } from '../world/map.js';
import { nodeBases, goneSupplies } from '../world/nodes.js';
import { nearestCamp, campInReach, campBases } from '../world/camps.js';
import { meetNeed } from '../world/needs.js';
import { nextDawn, nextMidday, phaseOf } from '../world/clock.js';
import { skipTo } from './survive.js';

/**
 * Hands over the resources a camp's need asks for, which meets the need and grows the fire.
 *
 * @param {object} state - The game being played. Resources and the camp change on success.
 * @param {string} campId - The camp's id.
 * @param {number} slot - Which need in its list: 0, 1 or 2.
 * @returns {{ok: boolean, camp?: object, need?: object, reason?: string}} The camp and need on
 *   success; otherwise `reason` 'unknown' (no such open resource need) or 'short' (not enough).
 */
export function giveToNeed(state, campId, slot) {
  const camp = state.camps.find((c) => c.id === campId),
    need = camp?.needs[slot];
  if (!need || need.kind !== 'bring' || need.done) return { ok: false, reason: 'unknown' };
  if (state.resources[need.resource] < need.amount) return { ok: false, reason: 'short' };

  state.resources[need.resource] -= need.amount;
  meetNeed(camp, need);
  return { ok: true, camp, need };
}

/**
 * Eats one food from the backpack.
 *
 * @param {object} state - The game being played. Food and hunger change on success.
 * @returns {{ok: boolean, reason?: string}} `reason` is 'empty' (no food) or 'full' (not hungry).
 */
export function eat(state) {
  if (state.resources.food < 1) return { ok: false, reason: 'empty' };
  if (state.meters.hunger >= 100) return { ok: false, reason: 'full' };
  state.resources.food -= 1;
  state.meters.hunger = Math.min(100, state.meters.hunger + FOOD_HUNGER);
  return { ok: true };
}

/**
 * Uses herbs to heal.
 *
 * @param {object} state - The game being played. Herbs and health change on success.
 * @returns {{ok: boolean, reason?: string}} `reason` is 'full' (already healthy) or 'short' (too few herbs).
 */
export function heal(state) {
  if (state.meters.health >= 100) return { ok: false, reason: 'full' };
  if (state.resources.herbs < HEAL_HERBS) return { ok: false, reason: 'short' };
  state.resources.herbs -= HEAL_HERBS;
  state.meters.health = Math.min(100, state.meters.health + HEAL_HEALTH);
  return { ok: true };
}

/**
 * Brews a cup of herbal tea at a camp, which holds off the night's cold for a while.
 *
 * Like a hot water bottle, it only works while it is warm: one cup at a time, and the next can
 * only be brewed once this one has run out.
 *
 * @param {object} state - The game being played. Herbs and `tea` change on success.
 * @returns {{ok: boolean, reason?: string}} `reason` is 'away' (not at a camp), 'active' (a cup
 *   is still working) or 'short' (too few herbs).
 */
export function brewTea(state) {
  if (!campInReach(state)) return { ok: false, reason: 'away' };
  if (state.tea > 0) return { ok: false, reason: 'active' };
  if (state.resources.herbs < TEA_HERBS) return { ok: false, reason: 'short' };
  state.resources.herbs -= TEA_HERBS;
  state.tea = TEA_SECONDS;
  return { ok: true };
}

/**
 * Rests at a camp through the night, waking rested at dawn.
 *
 * Only from dusk onwards, so it can't be used to skip the day.
 *
 * @param {object} state - The game being played. The clock jumps; health and warmth fill up.
 * @returns {{ok: boolean, events?: object[], reason?: string}} The events of the skipped time on
 *   success; otherwise `reason` 'away' (not at a camp) or 'day' (too early to sleep).
 */
export function rest(state) {
  if (!campInReach(state)) return { ok: false, reason: 'away' };
  const phase = phaseOf(state.time);
  if (phase !== 'dusk' && phase !== 'night') return { ok: false, reason: 'day' };

  const events = skipTo(state, nextDawn(state.time));
  Object.assign(state.meters, { health: 100, warmth: 100 });
  return { ok: true, events };
}

/**
 * Picks where to wake beside a fire: the first open spot south, west, east or north of it.
 *
 * @param {object} state - The game being played.
 * @param {object} camp - The camp to wake at.
 * @returns {{x: number, y: number}} A walkable spot, or the fire's own spot if all four are blocked.
 */
function wakeSpot(state, camp) {
  const solid = [...nodeBases(goneSupplies(state)), ...campBases(state)];
  for (const [dx, dy] of [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ]) {
    const x = camp.x + dx * WAKE_OFFSET,
      y = camp.y + dy * WAKE_OFFSET;
    if (isWalkable(x, y, solid)) return { x, y };
  }
  return { x: camp.x, y: camp.y };
}

/**
 * Passes the player out from the cold: they lose the morning and wake somewhere warm.
 *
 * Nothing is taken away: resources, camps and finds all stay. The clock jumps to the next midday
 * and the player wakes beside the camp fire nearest to where they fell (or at their starting
 * spot if they have no camp yet) with half their health, full warmth and no tea.
 *
 * @param {object} state - The game being played. The clock, position, meters and tea change.
 * @returns {{camp: object|null, events: object[]}} The camp they woke at (null for the spawn),
 *   and the events of the skipped time.
 */
export function passOut(state) {
  const camp = nearestCamp(state);
  const spot = camp
    ? wakeSpot(state, camp)
    : CHARACTERS.find((c) => c.id === state.character).spawn;
  const events = skipTo(state, nextMidday(state.time));
  Object.assign(state.player, { x: spot.x, y: spot.y, direction: 0 });
  Object.assign(state.meters, { health: WAKE_HEALTH, warmth: 100 });
  state.tea = 0;
  return { camp, events };
}
