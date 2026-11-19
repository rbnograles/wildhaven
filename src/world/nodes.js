// Every spot in the world the player can gather from (a "node"): the hand-placed supplies plus
// each wild flower patch the map scattered. Also works out which supplies are still solid.

import { SUPPLIES, WILD } from '../data/supplies.js';
import { MAP_OBJECTS, OBJECT_SPECS } from './map.js';

// The fixed supplies plus every wild patch the map scattered; a patch's map position is its id
// (`flowers-<x>-<y>`). Wild patches copy their fields from WILD and their size from objects.json.
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
