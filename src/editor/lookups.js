// Gathers the facts about the game that the world editor's checks need: the size of the world,
// what ground is walkable or sailable, which region a spot is in, which landmarks the journal
// names and which object sprites exist. Kept apart from the model so the model stays import-free.

import { WORLD, isWalkable, isSailable, OBJECT_SPECS } from '../world/map.js';
import { regionOf } from '../world/regions.js';
import { JOURNALS } from '../data/journal.js';

/**
 * Builds the `world` object that `checkPlaces` reads, from the game's own modules.
 *
 * Using the game's real rules means a warning in the editor is exactly what the game would do.
 * They describe the map as it was last built.
 *
 * @returns {object} `{width, height, isWalkable, isSailable, regionIdAt, journal, sprites}`.
 */
export function gameLookups() {
  return {
    width: WORLD.width,
    height: WORLD.height,
    isWalkable,
    isSailable,
    // The id of the region a spot is in.
    regionIdAt: (x, y) => regionOf(x, y).id,
    journal: Object.fromEntries(
      Object.entries(JOURNALS).map(([region, j]) => [
        region,
        [...new Set([...j.trail, ...Object.keys(j.pages)])],
      ]),
    ),
    sprites: Object.keys(OBJECT_SPECS).filter((name) => !name.startsWith('_')),
  };
}
