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

/**
 * Reads one named value that tools/build-map.py stored in the map file.
 *
 * @param {string} name - The property name, e.g. 'firstWaterGid'.
 * @returns {*} The stored value.
 */
export const mapProperty = (name) => MAP.properties.find((p) => p.name === name).value;

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

// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth
// shoreline. The deep layer does the same for open sea far from land.
const TILE = MAP.tilewidth,
  water = layer('water').data,
  firstWater = mapProperty('firstWaterGid'),
  deep = layer('deep').data,
  firstDeep = mapProperty('firstDeepGid');

/** How many world units of sea surround the home continent on every side (PAD in tools/build-map.py). */
export const SEA_BORDER = mapProperty('seaBorder');

// The sea must cover at least this much of a spot before a boat floats there. Walking stops at
// 0.35, so a boat stays a little off the sand instead of sitting on the beach.
const FLOAT_AT = 0.5;

/**
 * Says how much of a spot one corner-pattern layer covers, from 0 (none) to 1 (all of it).
 *
 * Each tile of the layer knows which of its four corners are covered. We blend those corners by
 * how close the spot is to each one, like mixing paint, so the coastline is a smooth curve instead
 * of a staircase of squares. The tile's number in the map (its "gid") encodes the corner pattern.
 *
 * @param {number[]} data - The layer's tile numbers, row by row.
 * @param {number} first - The tile number of the layer's first tile.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} How covered the spot is, between 0 and 1.
 */
function cover(data, first, x, y) {
  const tx = Math.floor(x / TILE),
    ty = Math.floor(y / TILE),
    gid = data[ty * MAP.width + tx];
  if (!gid) return 0;

  // The mask is four on/off bits, one per corner; u and v say how far across the tile the spot is.
  const mask = Math.floor((gid - first) / 16) + 1,
    u = x / TILE - tx,
    v = y / TILE - ty;
  return (
    (mask & 1) * (1 - u) * (1 - v) +
    ((mask >> 1) & 1) * u * (1 - v) +
    ((mask >> 2) & 1) * (1 - u) * v +
    ((mask >> 3) & 1) * u * v
  );
}

/** Says how wet a spot is, from 0 (dry land) to 1 (sea, shallow or deep). */
const waterAt = (x, y) => cover(water, firstWater, x, y);

/**
 * Says whether a spot is deep sea, far from any land, where the small boat can't go.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True for deep water.
 */
export const isDeep = (x, y) => cover(deep, firstDeep, x, y) >= 0.35;

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

// The map holds thousands of solid objects, so checking every one on every step would be slow.
// Instead the world is cut into big squares, and each square remembers the objects that touch it,
// like sorting books onto shelves so you only search one shelf.
const GRID = 256,
  PAD = 10, // the same padding `blocks` adds around each box
  gridCols = Math.ceil(WORLD.width / GRID),
  buckets = new Map();

for (const rect of OBSTACLES) {
  const [left, top, right, bottom] = rect;
  for (
    let cy = Math.max(0, Math.floor((top - PAD) / GRID));
    cy <= Math.floor((bottom + PAD) / GRID);
    cy++
  )
    for (
      let cx = Math.max(0, Math.floor((left - PAD) / GRID));
      cx <= Math.floor((right + PAD) / GRID);
      cx++
    ) {
      const key = cy * gridCols + cx;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(rect);
    }
}

/**
 * Says whether a spot is inside the solid base of any object the map placed.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if a tree, rock or building blocks the spot.
 */
export function hitsObstacle(x, y) {
  // Spots just left of or above the world share the first column or row, as the objects there do.
  const near = buckets.get(
    Math.max(0, Math.floor(y / GRID)) * gridCols + Math.max(0, Math.floor(x / GRID)),
  );
  return near ? blocks(near, x, y) : false;
}

/**
 * Says whether a spot is a real position inside the world's border.
 *
 * Anything that isn't a real number (like NaN from a broken save) is never inside.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the spot is inside the border.
 */
const insideWorld = (x, y) =>
  Number.isFinite(x) &&
  Number.isFinite(y) &&
  x >= WORLD.margin &&
  y >= WORLD.margin &&
  x <= WORLD.width - WORLD.margin &&
  y <= WORLD.height - WORLD.margin;

/**
 * Says whether the player is allowed to stand on a spot.
 *
 * A spot is fine when it's inside the world's border, mostly dry, and not inside a solid object.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number[][]} [extra=[]] - More solid boxes to avoid, such as supplies not yet gathered.
 * @returns {boolean} True if the player may stand there.
 */
export function isWalkable(x, y, extra = []) {
  if (!insideWorld(x, y)) return false;
  return waterAt(x, y) < 0.35 && !hitsObstacle(x, y) && !blocks(extra, x, y);
}

/**
 * Says whether the small boat may float on a spot.
 *
 * The boat needs enough water under it (it can't sit on the beach), must stay out of the deep
 * sea, and can't pass through anything solid, such as a bridge post.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the boat may be there.
 */
export function isSailable(x, y) {
  if (!insideWorld(x, y)) return false;
  return waterAt(x, y) >= FLOAT_AT && !isDeep(x, y) && !hitsObstacle(x, y);
}
