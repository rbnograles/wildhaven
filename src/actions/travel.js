// The "travel" action: jumping to a signpost the player has already found.
// The world takes over a minute to run across, so found signposts work as shortcuts.

import { WAYPOINTS } from '../data/places.js';
import { sendBoatHome } from './boat.js';

/**
 * Moves the player to a signpost, if they have found it.
 *
 * @param {object} state - The game being played. Its `player` position changes on success; `aboard`
 *   turns off, and the boat (if any) drifts back to its home mooring.
 * @param {string} waypointId - The id of the signpost to travel to.
 * @returns {object|null} The signpost travelled to, or null if it is unknown or not yet found.
 */
export function travelTo(state, waypointId) {
  const waypoint = WAYPOINTS.find((w) => w.id === waypointId);
  if (!waypoint || !state.waypoints.includes(waypointId)) return null;

  state.player.x = waypoint.x;
  state.player.y = waypoint.y;
  state.player.direction = 0; // face the camera on arrival
  // Nobody is left to row the boat, so it drifts home to its old boat's beach (otherwise a boat
  // left far out at sea, or by an islet, could never be reached again). The player arrives on foot.
  sendBoatHome(state);
  return waypoint;
}
