// Every spot in the world the player can gather from (a "node"): the hand-placed supplies plus
// each wild patch (flowers, driftwood) the map scattered. Also works out which supplies and old boats are still solid.

import { SUPPLIES, WILD } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import { MAP_OBJECTS, OBJECT_SPECS } from './map.js';

// The fixed supplies plus every wild patch the map scattered; a patch's map position is its id
// (`flowers-<x>-<y>`, `driftwood-<x>-<y>`). Wild patches copy their fields from WILD and their size from objects.json.
export const NODES = [
  ...SUPPLIES,
  ...MAP_OBJECTS.filter((o) => WILD[o.name]).map((o) => ({
    id: `${o.name}-${o.x}-${o.y}`,
    x: o.x,
    y: o.y,
    ...WILD[o.name],
    sprite: o.name,
    scale: OBJECT_SPECS[o.name].scale ?? 1,
  })),
];

/**
 * Lists the solid base of every supply that hasn't been gathered yet.
 *
 * A tree you haven't chopped is a wall you walk around; once it's chopped, the wall is gone.
 * Only one-time supplies are solid; wild patches are walk-through.
 *
 * @param {string[]} collected - Ids of the supplies this character already gathered.
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export function nodeBases(collected) {
  return SUPPLIES.filter((n) => !collected.includes(n.id)).map((n) => {
    const [halfWidth, depth] = OBJECT_SPECS[n.sprite].footprint;
    return [n.x - halfWidth * n.scale, n.y - depth * n.scale, n.x + halfWidth * n.scale, n.y];
  });
}

/**
 * Lists the solid base of every old boat still lying on the beach.
 *
 * An old boat is in the way like a fallen log. The one the player repaired has gone to sea, so
 * its base is left out.
 *
 * @param {object|null} boat - The player's boat (`{from, ...}`), or null if they have none.
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export function wreckBases(boat) {
  const [halfWidth, depth] = OBJECT_SPECS['old-boat'].footprint;
  return WRECKS.filter((w) => w.id !== boat?.from).map((w) => [
    w.x - halfWidth,
    w.y - depth,
    w.x + halfWidth,
    w.y,
  ]);
}

/**
 * Lists everything solid that isn't part of the map itself: supplies not yet gathered and old
 * boats still on the beach.
 *
 * @param {object} state - The game being played.
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export const solidBases = (state) => [...nodeBases(state.collected), ...wreckBases(state.boat)];
