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

// Collision comes from the sprite map (tools/build-map.py): water tiles, the elevation grid of the
// hills, and the solid base of each placed object.

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

// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth shoreline.
const TILE = MAP.tilewidth,
  water = layer('water').data,
  firstWater = mapProperty('firstWaterGid');

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

// Hills (tools/build-map.py, "hills and cliffs"): one letter per tile, row by row. '0' to '3' says how
// many levels up the ground is, 'w' is a cliff wall and 's' is a tile of stairs.
const ELEVATION = mapProperty('elevation'),
  WALL = 'w'.charCodeAt(0),
  STAIRS = 's'.charCodeAt(0),
  GROUND = '0'.charCodeAt(0);

// How close the player's feet may come to a cliff edge or wall, in world units. The strip blocked
// around an edge is this wide on each side, so it must stay wider than the longest single step
// (running at 245 units/s for the longest 0.1 s step is 24.5 units), or a running player could
// hop over an edge in one frame. tests/actions/move.test.js checks this.
export const CLIFF_GAP = 20;

/**
 * Reads the elevation letter of the tile under a spot, as a character code (a number).
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} The letter's code; spots off the map count as ground level.
 */
function elevationCode(x, y) {
  const tx = Math.floor(x / TILE),
    ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP.width || ty >= MAP.height) return GROUND;
  return ELEVATION.charCodeAt(ty * MAP.width + tx);
}

/**
 * Gives the elevation letter of the tile under a spot.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {string} '0' to '3' for how many levels up the ground is, 'w' for a wall, 's' for stairs.
 */
export const elevationAt = (x, y) => String.fromCharCode(elevationCode(x, y));

/**
 * Says whether a cliff keeps the player off a spot.
 *
 * Think of each level of a hill as a table top. You can't stand inside a wall, and you can't step
 * straight from the floor onto the table: near any edge between two levels the spot is blocked.
 * Stairs are the one way up, so a stairs tile never counts as an edge. We look at the spot and at
 * eight spots CLIFF_GAP units around it, so the feet stop a little before the edge.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if a wall or the edge of a level is too close.
 */
export function hitsCliff(x, y) {
  const here = elevationCode(x, y);
  if (here === WALL) return true;
  for (const dx of [-CLIFF_GAP, 0, CLIFF_GAP])
    for (const dy of [-CLIFF_GAP, 0, CLIFF_GAP]) {
      const near = elevationCode(x + dx, y + dy);
      if (near === WALL) return true;
      if (near !== here && near !== STAIRS && here !== STAIRS) return true;
    }
  return false;
}

/**
 * Says whether the player is allowed to stand on a spot.
 *
 * A spot is fine when it's inside the world's border, mostly dry, not inside a solid object, and
 * not on a cliff wall or edge. Anything that isn't a real number (like NaN from a broken save) is
 * never allowed.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number[][]} [extra=[]] - More solid boxes to avoid, such as supplies not yet gathered.
 * @param {boolean} [cliffs=true] - False to ignore cliffs, so a player who loads a save made
 *   before a hill stood where they are can still load and walk off it.
 * @returns {boolean} True if the player may stand there.
 */
export function isWalkable(x, y, extra = [], cliffs = true) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < WORLD.margin ||
    y < WORLD.margin ||
    x > WORLD.width - WORLD.margin ||
    y > WORLD.height - WORLD.margin
  )
    return false;
  return (
    waterAt(x, y) < 0.35 &&
    !hitsObstacle(x, y) &&
    !blocks(extra, x, y) &&
    !(cliffs && hitsCliff(x, y))
  );
}
