// Every spot in the world the player can gather from (a "node"): the hand-placed supplies plus
// each wild flower patch the map scattered. Also says which nodes can be gathered now and which
// supplies are still solid.

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
 * Says whether a node has something to gather right now.
 *
 * A gathered supply or picked patch is gone until the world clock reaches its regrowAt time,
 * like a gardener's calendar that says when the plants will be back. The clock stops while the
 * game is paused, so nothing regrows behind a menu.
 *
 * @param {object} state - The game being played.
 * @param {object} n - The node to check.
 * @returns {boolean} True if the node can be gathered.
 */
export const isAvailable = (state, n) => !(state.regrowAt[n.id] > state.time);

/**
 * Lists the fixed supplies that were gathered and have not grown back yet.
 *
 * @param {object} state - The game being played.
 * @returns {string[]} Their ids. These supplies are not solid right now.
 */
export const goneSupplies = (state) =>
  SUPPLIES.filter((n) => !isAvailable(state, n)).map((n) => n.id);

/**
 * Lists the solid base of every supply that is standing right now.
 *
 * A tree you haven't chopped is a wall you walk around; once it's chopped, the wall is gone until
 * it grows back. Only the fixed supplies are solid; wild patches are walk-through.
 *
 * @param {string[]} gone - Ids of the supplies that are not standing right now (see goneSupplies).
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export function nodeBases(gone) {
  return SUPPLIES.filter((n) => !gone.includes(n.id)).map((n) => {
    const [halfWidth, depth] = OBJECT_SPECS[n.sprite].footprint;
    return [n.x - halfWidth * n.scale, n.y - depth * n.scale, n.x + halfWidth * n.scale, n.y];
  });
}
