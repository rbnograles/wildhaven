// The world map and its collision rules: how big the world is, and which spots the player can
// stand on. Both the drawing and the collision come from the same map file, which
// tools/build-map.py builds.

import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };
import OBJECT_SPECS from '../../assets/world/source/objects.json' with { type: 'json' };

export { OBJECT_SPECS };

/**
 * The size of the world in world units, worked out from the map's tile count and tile size.
 * `margin` is a border the player can't enter, so they never walk off the edge of the map.
 */
export const WORLD = {
  width: MAP.width * MAP.tilewidth,
  height: MAP.height * MAP.tileheight,
  margin: 42,
};

// Collision comes from the sprite map (tools/build-map.py): water tiles and the solid base of each placed object.

/** Finds one layer of the map (such as 'water' or 'objects') by its name. */
const layer = (name) => MAP.layers.find((l) => l.name === name);

/** Every object the map placed: trees, rocks, houses, flowers and so on, each with a name and x/y. */
export const MAP_OBJECTS = layer('objects').objects;

// The solid base of every placed object, as [left, top, right, bottom] boxes. An object's
// `footprint` in objects.json is [halfWidth, depth], grown by its `scale`; objects without one are walk-through.
export const OBSTACLES = MAP_OBJECTS.flatMap((o) => {
  const spec = OBJECT_SPECS[o.name],
    base = spec?.footprint,
    s = spec?.scale ?? 1;
  return base ? [[o.x - base[0] * s, o.y - base[1] * s, o.x + base[0] * s, o.y]] : [];
});

// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth shoreline.
const TILE = MAP.tilewidth,
  water = layer('water').data,
  firstWater = MAP.properties.find((p) => p.name === 'firstWaterGid').value;

/**
 * Says how wet a spot is, from 0 (dry land) to 1 (open sea).
 *
 * Each water tile knows which of its four corners are sea. We blend those corners by how close
 * the spot is to each one, like mixing paint, so the coastline is a smooth curve instead of a
 * staircase of squares. The tile's number in the map (its "gid") encodes the corner pattern.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} Wetness between 0 and 1.
 */
function waterAt(x, y) {
  const tx = Math.floor(x / TILE),
    ty = Math.floor(y / TILE),
    gid = water[ty * MAP.width + tx];
  if (!gid) return 0;

  // The mask is four on/off bits, one per corner; u and v say how far across the tile the spot is.
  const mask = Math.floor((gid - firstWater) / 16) + 1,
    u = x / TILE - tx,
    v = y / TILE - ty;
  return (
    (mask & 1) * (1 - u) * (1 - v) +
    ((mask >> 1) & 1) * u * (1 - v) +
    ((mask >> 2) & 1) * (1 - u) * v +
    ((mask >> 3) & 1) * u * v
  );
}

/**
 * Checks whether a spot is inside any of the given boxes, with 10 units of padding.
 *
 * The padding stands in for the player's body: their feet are a point, but they shouldn't be
 * able to press their nose right into a tree.
 *
 * @param {number[][]} rects - Boxes as [left, top, right, bottom].
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the spot is blocked.
 */
export const blocks = (rects, x, y) =>
  rects.some(
    ([left, top, right, bottom]) =>
      x > left - 10 && x < right + 10 && y > top - 10 && y < bottom + 10,
  );

/**
 * Says whether the player is allowed to stand on a spot.
 *
 * A spot is fine when it's inside the world's border, mostly dry, and not inside a solid object.
 * Anything that isn't a real number (like NaN from a broken save) is never allowed.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number[][]} [extra=[]] - More solid boxes to avoid, such as supplies not yet gathered.
 * @returns {boolean} True if the player may stand there.
 */
export function isWalkable(x, y, extra = []) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < WORLD.margin ||
    y < WORLD.margin ||
    x > WORLD.width - WORLD.margin ||
    y > WORLD.height - WORLD.margin
  )
    return false;
  return waterAt(x, y) < 0.35 && !blocks(OBSTACLES, x, y) && !blocks(extra, x, y);
}
