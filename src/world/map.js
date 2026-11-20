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

// The solid base of every placed object, as [left, top, right, bottom, id] boxes. An object's
// `footprint` in objects.json is [halfWidth, depth], grown by its `scale`; objects without one are walk-through.
// The id is `<name>-<x>-<y>`, the same id a tree or rock node has, so a chopped tree's box can be skipped.
export const OBSTACLES = MAP_OBJECTS.flatMap((o) => {
  const spec = OBJECT_SPECS[o.name],
    base = spec?.footprint,
    s = spec?.scale ?? 1;
  return base
    ? [[o.x - base[0] * s, o.y - base[1] * s, o.x + base[0] * s, o.y, `${o.name}-${o.x}-${o.y}`]]
    : [];
});

// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth
// shoreline. The deep layer does the same for open sea far from land.
const TILE = MAP.tilewidth,
  water = layer('water').data,
  firstWater = mapProperty('firstWaterGid'),
  deep = layer('deep').data,
  firstDeep = mapProperty('firstDeepGid'),
  sand = layer('sand').data,
  firstSand = mapProperty('firstSandGid'),
  snow = layer('snow').data,
  firstSnow = mapProperty('firstSnowGid');

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
 * Says whether a spot is dry land, with no more water than the player may wade through.
 *
 * It uses the same 0.35 limit as walking, so "dry" here means the sea does not cover the spot.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the spot is land (or at least not sea).
 */
export const isDryLand = (x, y) => waterAt(x, y) < 0.35;

/**
 * Says whether a spot is deep sea, far from any land, where the small boat can't go.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True for deep water.
 */
export const isDeep = (x, y) => cover(deep, firstDeep, x, y) >= 0.35;

/**
 * Says what kind of ground is underfoot at a dry spot: sand, snow or plain earth.
 *
 * Only the look of the player's footprints uses this. The map paints sand over snow, and both over
 * everything else, so sand is asked first. A spot counts as sand or snow when that layer covers at
 * least half of it. Ask only about dry land: the sand layer also runs on under the sea.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {'sand' | 'snow' | 'earth'} The ground at the spot.
 */
export function surfaceAt(x, y) {
  if (cover(sand, firstSand, x, y) >= 0.5) return 'sand';
  if (cover(snow, firstSnow, x, y) >= 0.5) return 'snow';
  return 'earth';
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
 * Finds the obstacle boxes filed in the grid square that holds a spot.
 * Spots just left of or above the world share the first column or row, as the objects there do.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {Array|undefined} The boxes, or undefined when that square has none.
 */
const bucketAt = (x, y) =>
  buckets.get(Math.max(0, Math.floor(y / GRID)) * gridCols + Math.max(0, Math.floor(x / GRID)));

/**
 * Says whether a spot is inside the solid base of any object the map placed.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {Function} [skip] - Given an object's id, returns true to ignore that object, such as a
 *   tree that has been chopped down. Without it, every object counts.
 * @returns {boolean} True if a tree, rock or building blocks the spot.
 */
export function hitsObstacle(x, y, skip) {
  const near = bucketAt(x, y);
  if (!near) return false;
  return blocks(skip ? near.filter((rect) => !skip(rect[4])) : near, x, y);
}

/**
 * Lists the map objects whose solid base covers a spot.
 *
 * Walking uses it to let a player out of a tree that grew back around them.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {string[]} The objects' ids (empty when the spot is clear).
 */
export function obstaclesAt(x, y) {
  return (bucketAt(x, y) ?? []).filter((rect) => blocks([rect], x, y)).map((rect) => rect[4]);
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
 * A spot is fine when it's inside the world's border, mostly dry, not inside a solid object, and
 * not on a cliff wall or edge.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number[][]} [extra=[]] - More solid boxes to avoid, such as supplies not yet gathered.
 * @param {boolean} [cliffs=true] - False to ignore cliffs, so a player who loads a save made
 *   before a hill stood where they are can still load and walk off it.
 * @param {Function} [skip] - Given a map object's id, returns true to ignore its solid base (a
 *   chopped tree, say). Without it every map object counts.
 * @returns {boolean} True if the player may stand there.
 */
export function isWalkable(x, y, extra = [], cliffs = true, skip = undefined) {
  if (!insideWorld(x, y)) return false;
  return (
    waterAt(x, y) < 0.35 &&
    !hitsObstacle(x, y, skip) &&
    !blocks(extra, x, y) &&
    !(cliffs && hitsCliff(x, y))
  );
}

/**
 * Says whether the small boat may float on a spot.
 *
 * The boat needs enough water under it (it can't sit on the beach), must stay out of the deep
 * sea, and can't pass through anything solid, such as a rock or a tree standing in the shallows.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if the boat may be there.
 */
export function isSailable(x, y) {
  if (!insideWorld(x, y)) return false;
  return waterAt(x, y) >= FLOAT_AT && !isDeep(x, y) && !hitsObstacle(x, y);
}
