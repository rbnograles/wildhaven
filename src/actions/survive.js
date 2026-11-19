// Surviving day and night: moves the world clock forward and changes warmth, hunger and health
// to match where the player is and what time it is. It reports the moments worth telling the
// player about (dusk falling, freezing, passing out, a new day) as "events" for the HUD.

import {
  WARMTH_SECONDS,
  STARVING_COLD,
  WARM_BY_FIRE,
  WARM_BY_DAY,
  FREEZE_SECONDS,
  STARVE_SECONDS,
  STARVE_FLOOR,
  HEAL_BY_FIRE,
  HUNGER_SECONDS,
} from '../data/balance.js';
import { dayOf, phaseOf } from '../world/clock.js';
import { byFire } from '../world/camps.js';
import { refreshNeeds } from '../world/needs.js';

/**
 * Keeps a meter between 0 and 100.
 *
 * @param {number} value - The meter's new value.
 * @returns {number} The value, clamped.
 */
const clamp = (value) => Math.min(100, Math.max(0, value));

/**
 * Runs the dawn update for a new day: every camp swaps its met needs for new ones.
 *
 * @param {object} state - The game being played. Camp needs may change.
 * @returns {{kind: string, day: number, camps: string[]}} A `dawn` event naming the day and the
 *   camps whose needs changed.
 */
export function startDay(state) {
  const camps = refreshNeeds(state).map((camp) => camp.name);
  return { kind: 'dawn', day: dayOf(state.time), camps };
}

/**
 * Moves the world forward by one small step of time and updates the three meters.
 *
 * Think of the meters as three buckets. Hunger always drips out slowly. Warmth fills up by a fire
 * and in daylight, holds at dusk, and drains at night away from a fire (faster on an empty
 * stomach) unless tea holds the cold off. Health drains while freezing and refills slowly by a
 * fire for a player who isn't starving. Starving wears health down too, slowly, and only as far
 * as STARVE_FLOOR: an empty stomach alone never makes the player pass out.
 *
 * @param {object} state - The game being played. `time`, `meters`, `tea` and camp needs change.
 * @param {number} dt - Seconds of game time to move forward.
 * @returns {object[]} What happened in this step: `{kind: 'dusk'}`, `{kind: 'night'}`,
 *   `{kind: 'freezing'}`, `{kind: 'starving'}`, `{kind: 'dawn', day, camps}` or `{kind: 'passout'}`.
 */
export function tickSurvival(state, dt) {
  if (!(dt > 0)) return [];
  const { meters } = state;
  const before = { phase: phaseOf(state.time), day: dayOf(state.time), ...meters };
  state.time += dt;
  const phase = phaseOf(state.time),
    warm = byFire(state),
    starving = meters.hunger <= 0;

  // Hunger always falls.
  meters.hunger = clamp(meters.hunger - (100 / HUNGER_SECONDS) * dt);

  // Warmth: up by a fire, up in daylight, steady at dusk, down at night unless tea holds it off.
  const chill = (100 / WARMTH_SECONDS) * (starving ? STARVING_COLD : 1);
  if (warm) meters.warmth = clamp(meters.warmth + WARM_BY_FIRE * dt);
  else if (phase === 'night' && state.tea > 0) state.tea = Math.max(0, state.tea - dt);
  else if (phase === 'night') meters.warmth = clamp(meters.warmth - chill * dt);
  else if (phase !== 'dusk') meters.warmth = clamp(meters.warmth + WARM_BY_DAY * dt);

  // Health: down while freezing, slowly up by a fire for a fed player.
  if (!warm && phase === 'night' && meters.warmth <= 0)
    meters.health = clamp(meters.health - (100 / FREEZE_SECONDS) * dt);
  else if (warm && meters.hunger > 0) meters.health = clamp(meters.health + HEAL_BY_FIRE * dt);

  // Starving wears health down slowly, but never below the floor (freezing still can).
  if (starving && meters.health > STARVE_FLOOR)
    meters.health = Math.max(STARVE_FLOOR, meters.health - (100 / STARVE_SECONDS) * dt);

  // Report each moment once, on the step where it happens.
  const events = [];
  if (phase !== before.phase && (phase === 'dusk' || phase === 'night') && !warm)
    events.push({ kind: phase });
  if (before.warmth > 0 && meters.warmth <= 0) events.push({ kind: 'freezing' });
  if (before.hunger > 0 && meters.hunger <= 0) events.push({ kind: 'starving' });
  if (dayOf(state.time) > before.day) events.push(startDay(state));
  if (before.health > 0 && meters.health <= 0) events.push({ kind: 'passout' });
  return events;
}

/**
 * Jumps the world clock forward, as when resting through the night or passing out.
 *
 * Nobody is out in the cold while the clock jumps, so only hunger changes: it falls for the
 * skipped time. Crossing into a new day runs the dawn update.
 *
 * @param {object} state - The game being played. `time`, hunger and camp needs may change.
 * @param {number} time - The world clock to jump to. A time that isn't ahead does nothing.
 * @returns {object[]} A `starving` event if the stomach ran empty, and a `dawn` event if a new day began.
 */
export function skipTo(state, time) {
  if (!(time > state.time)) return [];
  const { meters } = state,
    day = dayOf(state.time),
    fed = meters.hunger > 0;
  meters.hunger = clamp(meters.hunger - (100 / HUNGER_SECONDS) * (time - state.time));
  state.time = time;

  const events = [];
  if (fed && meters.hunger <= 0) events.push({ kind: 'starving' });
  if (dayOf(time) > day) events.push(startDay(state));
  return events;
}

/**
 * Says what is draining health, for the word beside the health meter.
 *
 * @param {object} state - The game being played.
 * @param {boolean} freezing - True when the cold is draining health right now.
 * @returns {string} 'freezing', 'starving' (hungry and still above STARVE_FLOOR) or ''.
 */
function healthTrend(state, freezing) {
  if (freezing) return 'freezing';
  const { hunger, health } = state.meters;
  return hunger <= 0 && health > STARVE_FLOOR ? 'starving' : '';
}

/**
 * Says why each meter is changing, for the small word beside it on the HUD.
 *
 * @param {object} state - The game being played.
 * @returns {{warmth: string, health: string, hunger: string}} Warmth: 'warming' by a fire, 'tea'
 *   while tea holds off the night's cold, 'cold' while it drains. Health: 'freezing', or
 *   'starving' while an empty stomach is wearing it down. Hunger: 'starving'. An empty string
 *   means there is nothing to say.
 */
export function meterTrends(state) {
  const night = phaseOf(state.time) === 'night',
    warm = byFire(state);
  let warmth = '';
  if (warm) warmth = 'warming';
  else if (night) warmth = state.tea > 0 ? 'tea' : 'cold';
  return {
    warmth,
    health: healthTrend(state, !warm && night && state.meters.warmth <= 0),
    hunger: state.meters.hunger <= 0 ? 'starving' : '',
  };
}
