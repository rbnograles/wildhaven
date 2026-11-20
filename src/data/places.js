// The shared list of places in the world: regions, start spots, supply spots, landmarks to find,
// signposts to travel between and old boats on the coast. The numbers live in assets/world/source/places.json so that
// tools/build-map.py (which shapes the land around them) and the game read the very same file.

import PLACES from '../../assets/world/source/places.json' with { type: 'json' };

/**
 * Turns an [x, y] pair from the places file into a position object.
 *
 * @param {number[]} pair - World position as [x, y].
 * @returns {{x: number, y: number}} The same spot as an object.
 */
export const spot = ([x, y]) => ({ x, y });

/** Turns a whole table of [x, y] pairs into a table of position objects, keeping the same keys. */
const spots = (pairs) => Object.fromEntries(Object.entries(pairs).map(([id, p]) => [id, spot(p)]));

/** Where each character starts, keyed by character id. */
export const SPAWNS = spots(PLACES.spawns);

/** Where each one-time supply stands, keyed by supply id. */
export const SUPPLY_SPOTS = spots(PLACES.supplies);

/** The seven regions, in the order the map's region grid numbers them. Fields: `id`, `key`, `name`. */
export const REGION_LIST = PLACES.regions;

/**
 * Named places to find. Fields: `id`, `region` (a region id), `name`, `x`, `y`, and `object`: the
 * sprite that marks the place (a tent, a ruin), or null when nothing stands there. The maps use
 * `object` for the place's icon.
 */
export const LANDMARKS = PLACES.landmarks.map(({ id, region, name, x, y, object }) => ({
  id,
  region,
  name,
  x,
  y,
  object: object ?? null,
}));

/** Signposts the player can travel between once found. Fields: `id`, `region`, `name`, `x`, `y`. */
export const WAYPOINTS = PLACES.waypoints.map(({ id, region, name, x, y }) => ({
  id,
  region,
  name,
  x,
  y,
}));

/**
 * Old boats lying on the coast; the player can repair one of them into their own boat.
 * Fields: `id`, `region`, `name`, `x`/`y` (where it lies on the beach) and `launch` (the shallow
 * water next to it, as `{x, y}`, where the mended boat floats).
 */
export const WRECKS = PLACES.wrecks.map(({ id, region, name, x, y, launch }) => ({
  id,
  region,
  name,
  x,
  y,
  launch: spot(launch),
}));
