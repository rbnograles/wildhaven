// The world clock: turns `state.time` (game seconds since the dawn of day 1) into a day number,
// a part of the day and how dark the world looks. Like reading a wall clock, it only reads the
// time; it never changes the game.

import { DAY_SECONDS, PHASES, MIDDAY } from '../data/balance.js';

// How dark the world is drawn (0 clear, 1 black) at nightfall and in full night, and how many
// seconds into the night it takes to go from one to the other. These only change the drawing.
const DUSK_DARK = 0.35,
  NIGHT_DARK = 0.6,
  NIGHTFALL = 10;

// The words the HUD clock uses for each part of the day. The day itself is split at midday.
const PHASE_WORDS = {
  dawn: 'Dawn',
  morning: 'Morning',
  afternoon: 'Afternoon',
  dusk: 'Dusk',
  night: 'Night',
};

/**
 * Says which day it is, counting the first day as day 1.
 *
 * @param {number} time - The world clock, in game seconds since the dawn of day 1.
 * @returns {number} The day number.
 */
export const dayOf = (time) => Math.floor(time / DAY_SECONDS) + 1;

/**
 * Says how many seconds have passed since this day's dawn.
 *
 * @param {number} time - The world clock.
 * @returns {number} Seconds since dawn, from 0 up to (not including) one whole day.
 */
export const timeOfDay = (time) => time - (dayOf(time) - 1) * DAY_SECONDS;

/**
 * Names the part of the day it is.
 *
 * The day is cut into four slices, like a pie: dawn, day, dusk and night.
 *
 * @param {number} time - The world clock.
 * @returns {'dawn'|'day'|'dusk'|'night'} The part of the day.
 */
export function phaseOf(time) {
  const t = timeOfDay(time);
  if (t >= PHASES.night) return 'night';
  if (t >= PHASES.dusk) return 'dusk';
  if (t >= PHASES.day) return 'day';
  return 'dawn';
}

/**
 * Says how dark the world should be drawn, from 0 (clear) to 0.6 (deep night).
 *
 * Like a dimmer switch turned slowly: the light fades through dusk, keeps fading for the first
 * seconds of night, holds, and comes back across dawn.
 *
 * @param {number} time - The world clock.
 * @returns {number} How dark to draw the world.
 */
export function darknessAt(time) {
  const t = timeOfDay(time);
  if (t < PHASES.day) return NIGHT_DARK * (1 - t / PHASES.day);
  if (t < PHASES.dusk) return 0;
  if (t < PHASES.night) return DUSK_DARK * ((t - PHASES.dusk) / (PHASES.night - PHASES.dusk));
  return Math.min(
    NIGHT_DARK,
    DUSK_DARK + (NIGHT_DARK - DUSK_DARK) * ((t - PHASES.night) / NIGHTFALL),
  );
}

/**
 * Finds the clock reading at the next dawn: the start of tomorrow.
 *
 * @param {number} time - The world clock.
 * @returns {number} The world clock at the next dawn.
 */
export const nextDawn = (time) => dayOf(time) * DAY_SECONDS;

/**
 * Finds the next midday that is still ahead.
 *
 * @param {number} time - The world clock.
 * @returns {number} The world clock at today's midday if it hasn't come yet, else tomorrow's.
 */
export function nextMidday(time) {
  const today = (dayOf(time) - 1) * DAY_SECONDS + MIDDAY;
  return today > time ? today : today + DAY_SECONDS;
}

/**
 * Writes the clock as words for the HUD, such as "Day 2 · Dusk".
 *
 * @param {number} time - The world clock.
 * @returns {string} The day number and the part of the day.
 */
export function clockLabel(time) {
  const phase = phaseOf(time);
  const part = phase !== 'day' ? phase : timeOfDay(time) < MIDDAY ? 'morning' : 'afternoon';
  return `Day ${dayOf(time)} · ${PHASE_WORDS[part]}`;
}
