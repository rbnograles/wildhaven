// Every spot in the world the player can gather from (a "node"): the hand-placed supplies plus
// each wild patch (flowers, driftwood, sticks), tree and rock the map scattered. Also says which nodes can
// be gathered now and works out what is solid: standing supplies, old boats on the beach and campfires.

import { SUPPLIES, WILD, HARVEST } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import { MAP_OBJECTS, OBJECT_SPECS } from './map.js';
import { campBases } from './camps.js';
import { npcBases } from './npcs.js';

// The fixed supplies plus every wild patch, tree and rock the map scattered; a map node's position
// is its id (`flowers-<x>-<y>`, `pine-<x>-<y>`). Map nodes copy their fields from WILD or HARVEST and
// their size from objects.json. Trees and rocks are marked `inScenery`: the renderer draws them with
// the map's scenery, and their solid base is the map's own (see world/map.js), not a supply base.
export const NODES = [
  ...SUPPLIES,
  ...MAP_OBJECTS.filter((o) => WILD[o.name] || HARVEST[o.name]).map((o) => ({
    id: `${o.name}-${o.x}-${o.y}`,
    x: o.x,
    y: o.y,
    ...(WILD[o.name] ?? HARVEST[o.name]),
    sprite: o.name,
    scale: OBJECT_SPECS[o.name].scale ?? 1,
    inScenery: !!HARVEST[o.name],
  })),
];

// Thousands of trees and rocks are nodes, so finding the ones near the player shouldn't check them
// all. Like the map's obstacle grid, the world is cut into squares and each square lists its nodes,
// like sorting letters into pigeonholes by street.
const NODE_CELL = 256;
const nodeCells = new Map();
for (const node of NODES) {
  const key = `${Math.floor(node.x / NODE_CELL)},${Math.floor(node.y / NODE_CELL)}`;
  if (!nodeCells.has(key)) nodeCells.set(key, []);
  nodeCells.get(key).push(node);
}

/**
 * Lists the nodes in the square around a spot and the eight squares touching it.
 *
 * Every node within one square's width (256 units) of the spot is in the list, which is far more
 * than the 95 units gathering reaches, so callers still check the real distance.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {object[]} The nodes near the spot, as a new list.
 */
export function nodesNear(x, y) {
  const cx = Math.floor(x / NODE_CELL),
    cy = Math.floor(y / NODE_CELL),
    near = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) near.push(...(nodeCells.get(`${cx + dx},${cy + dy}`) ?? []));
  return near;
}

// The ids of the tree and rock nodes, for isSceneryNode.
const sceneryIds = new Set(NODES.filter((n) => n.inScenery).map((n) => n.id));

/**
 * Says whether an id names a tree or rock node, which the map itself draws and makes solid.
 *
 * @param {string} id - A node or map object id, such as `pine-4096-2048`.
 * @returns {boolean} True for a tree or rock that a tool can harvest.
 */
export const isSceneryNode = (id) => sceneryIds.has(id);

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
 * boats still on the beach, the player's campfires and the villagers.
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
  ...npcBases(),
];
