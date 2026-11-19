// The "discover" action: notices when the player finds something for the first time.
// Right now that is a region; landmarks and signposts are added to the same list of finds.

import { regionOf } from '../world/regions.js';

/**
 * Marks everything the player has just found and reports it.
 *
 * Like stamping a passport: the first visit to a place adds a stamp, and later visits don't add
 * another one. The game loop calls this every frame.
 *
 * @param {object} state - The game being played. A newly entered region's id is added to `discovered`.
 * @returns {{kind: string, id: string, name: string}[]} What was found just now (usually nothing),
 *   so the HUD can announce it. `kind` is 'region'.
 */
export function discover(state) {
  const found = [];

  const region = regionOf(state.player.x, state.player.y);
  if (!state.discovered.includes(region.id)) {
    state.discovered.push(region.id);
    found.push({ kind: 'region', id: region.id, name: region.name });
  }

  return found;
}
