// Every spot in the world the player can gather from (a "node"): the hand-placed supplies plus
// each wild patch (flowers, driftwood) the map scattered. Also says which nodes can be gathered now
// and works out what is solid: standing supplies, old boats on the beach and campfires.

import { SUPPLIES, WILD } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import { MAP_OBJECTS, OBJECT_SPECS } from './map.js';
import { campBases } from './camps.js';

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
 * Lists everything solid that isn't part of the map itself: supplies standing right now, old
 * boats still on the beach and the player's campfires.
 *
 * Walking, landing from the boat, placing a fire and waking up all use this one list, so they
 * agree on what is in the way.
 *
 * @param {object} state - The game being played.
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export const solidBases = (state) => [
  ...nodeBases(goneSupplies(state)),
  ...wreckBases(state.boat),
  ...campBases(state),
];
