// The named regions of the world, and which one the player is standing in.
// Each character's starting area is one region the other characters can discover.

import { CHARACTERS } from '../data/characters.js';
import { DISCOVERY_RADIUS, REGION_LABEL_RANGE } from '../data/balance.js';

// Each character's starting area is one discoverable region: a circle around that character's
// spawn. Fields: `id` (the character id), `name` (shown on screen), `x`/`y` (centre), `radius`.
export const LOCATIONS = CHARACTERS.map((c) => ({
  id: c.id,
  name: c.location,
  ...c.spawn,
  radius: DISCOVERY_RADIUS,
}));

/**
 * Gives the name of the region around the player, for the big title at the top of the screen.
 *
 * The name stays up a little past the discovery circle, so it doesn't flicker on and off while
 * the player walks along the edge.
 *
 * @param {{x: number, y: number}} player - The player's position.
 * @returns {string} The region's name, or 'The Open Wilds' between regions.
 */
export function regionAt(player) {
  return (
    LOCATIONS.find(
      (l) => Math.hypot(l.x - player.x, l.y - player.y) < l.radius + REGION_LABEL_RANGE,
    )?.name ?? 'The Open Wilds'
  );
}
