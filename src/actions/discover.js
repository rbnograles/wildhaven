// The "discover" action: notices when the player first enters a region, comes close to a
// landmark, or walks up to a signpost.

import { regionOf } from '../world/regions.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS } from '../data/balance.js';

/**
 * Marks everything the player has just found and reports it.
 *
 * Like stamping a passport: the first visit to a place adds a stamp, and later visits don't add
 * another one. The game loop calls this every frame.
 *
 * @param {object} state - The game being played. New finds are added to `discovered`, `landmarks` or `waypoints`.
 * @returns {{kind: string, id: string, name: string}[]} What was found just now (usually nothing),
 *   so the HUD can announce it. `kind` is 'region', 'landmark' or 'waypoint'.
 */
export function discover(state) {
  const found = [];

  const region = regionOf(state.player.x, state.player.y);
  if (!state.discovered.includes(region.id)) {
    state.discovered.push(region.id);
    found.push({ kind: 'region', id: region.id, name: region.name });
  }

  // Landmarks and signposts are found by coming close; each list remembers the ids already found.
  for (const [kind, places, list, radius] of [
    ['landmark', LANDMARKS, state.landmarks, LANDMARK_RADIUS],
    ['waypoint', WAYPOINTS, state.waypoints, WAYPOINT_RADIUS],
  ])
    for (const place of places) {
      if (list.includes(place.id)) continue;
      if (Math.hypot(place.x - state.player.x, place.y - state.player.y) >= radius) continue;
      list.push(place.id);
      found.push({ kind, id: place.id, name: place.name });
    }

  return found;
}
