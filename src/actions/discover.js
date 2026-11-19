// The "discover" action: notices when the player walks into a region for the first time.

import { LOCATIONS } from '../world/regions.js';

/**
 * Marks every region the player is standing in that they haven't found before.
 *
 * Like stamping a passport: the first visit to a place adds a stamp, and later visits don't add
 * another one. The game loop calls this every frame.
 *
 * @param {object} state - The game being played. Newly found region ids are added to `discovered`.
 * @returns {object[]} The regions found just now (usually none), so the HUD can announce them.
 */
export function discover(state) {
  const found = LOCATIONS.filter(
    (l) =>
      !state.discovered.includes(l.id) &&
      Math.hypot(l.x - state.player.x, l.y - state.player.y) < l.radius,
  );
  state.discovered.push(...found.map((l) => l.id));
  return found;
}
