// Counts how much of the world a character has found: per region for the HUD, and in total for
// the world map. It only reads the game state; it never changes it.

import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import { REGIONS } from './regions.js';

/** Counts how many of `places` have their id in `foundIds`. */
const tally = (places, foundIds) => ({
  found: places.filter((p) => foundIds.includes(p.id)).length,
  total: places.length,
});

/**
 * Counts the places and signposts found in one region.
 *
 * @param {object} state - The game being played.
 * @param {string} regionId - The region to count, e.g. 'desert'.
 * @returns {{places: {found: number, total: number}, signposts: {found: number, total: number}}}
 */
export function regionProgress(state, regionId) {
  /** True for a place that belongs to this region. */
  const here = (p) => p.region === regionId;
  return {
    places: tally(LANDMARKS.filter(here), state.landmarks),
    signposts: tally(WAYPOINTS.filter(here), state.waypoints),
  };
}

/**
 * Counts everything found in the whole world.
 *
 * @param {object} state - The game being played.
 * @returns {{regions: object, places: object, signposts: object}} Each as `{found, total}`.
 */
export function worldProgress(state) {
  return {
    regions: tally(REGIONS, state.discovered),
    places: tally(LANDMARKS, state.landmarks),
    signposts: tally(WAYPOINTS, state.waypoints),
  };
}
