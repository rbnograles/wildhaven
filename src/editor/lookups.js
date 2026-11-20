// Gathers the facts about the game that the world editor's checks need: the size of the world,
// what ground is walkable or sailable, which region a spot is in, which landmarks the journal
// names and which object sprites exist. Kept apart from the model so the model stays import-free.

import {
  WORLD,
  isWalkable,
  isSailable,
  isDryLand,
  hitsCliff,
  elevationAt,
  OBJECT_SPECS,
  MAP_OBJECTS,
  mapProperty,
} from '../world/map.js';
import { regionOf } from '../world/regions.js';
import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };
import { JOURNALS } from '../data/journal.js';
import { WILD, HARVEST } from '../data/supplies.js';
import { KINDS } from './terrain.js';

/**
 * Builds the `world` object that `checkPlaces` reads, from the game's own modules.
 *
 * Using the game's real rules means a warning in the editor is exactly what the game would do.
 * They describe the map as it was last built.
 *
 * @returns {object} `{width, height, isWalkable, isSailable, regionIdAt, journal, sprites}`.
 */
export function gameLookups() {
  return {
    width: WORLD.width,
    height: WORLD.height,
    isWalkable,
    isSailable,
    // The id of the region a spot is in.
    regionIdAt: (x, y) => regionOf(x, y).id,
    journal: Object.fromEntries(
      Object.entries(JOURNALS).map(([region, j]) => [
        region,
        [...new Set([...j.trail, ...Object.keys(j.pages)])],
      ]),
    ),
    sprites: Object.keys(OBJECT_SPECS).filter((name) => !name.startsWith('_')),
  };
}

/**
 * Reads the removals the last map build said matched nothing.
 *
 * @returns {{name: string, x: number, y: number}[]} The stale removals; none if the map is older
 *   than this feature.
 */
function builtStale() {
  try {
    return JSON.parse(mapProperty('staleEdits'));
  } catch {
    return [];
  }
}

/**
 * Builds the facts the object editor reads, from the game's own modules.
 *
 * @returns {object} `specs` (the sprites of objects.json), `width`, `height`, `isBlocked(x, y)`
 *   (water, a cliff or stairs), `paths` (the middle of each path piece), `builtStale`, and
 *   `tags(name)` (what the game does with a sprite: 'solid', 'chop or mine', 'pick up').
 */
export function objectLookups() {
  const specs = Object.fromEntries(
    Object.entries(OBJECT_SPECS).filter(([name]) => !name.startsWith('_')),
  );

  return {
    specs,
    width: WORLD.width,
    height: WORLD.height,
    // Water, a cliff wall or edge, or a flight of stairs: no place for something solid.
    isBlocked: (x, y) => !isDryLand(x, y) || hitsCliff(x, y) || elevationAt(x, y) === 's',
    paths: MAP_OBJECTS.filter((o) => specs[o.name]?.path).map(({ x, y }) => ({ x, y })),
    builtStale: builtStale(),
    // What the game does with a sprite, in a few words for the side panel.
    tags: (name) =>
      [
        specs[name]?.footprint && 'solid',
        HARVEST[name] && 'chop or mine',
        WILD[name] && 'pick up',
      ].filter(Boolean),
  };
}

/**
 * Reads the ground the map build generated at each tile corner, before any hand painting.
 *
 * @returns {{rows: number, cols: number, builtHash: string, kindAt: Function}} The map's size in
 *   boxes, the fingerprint of the terrain file the map was built from, and
 *   `kindAt(row, col)`: the generated ground kind at a corner ('grass' for a map older than
 *   this feature, which has no record).
 */
export function groundLookups() {
  let digits = '';
  try {
    digits = mapProperty('baseGround');
  } catch {
    // An older map has no record of its ground.
  }

  let builtHash = '';
  try {
    builtHash = mapProperty('terrainHash');
  } catch {
    // An older map has no fingerprint either.
  }

  const cols = MAP.width;
  return {
    rows: MAP.height,
    cols,
    builtHash,
    // The ground kind the build made at one corner.
    kindAt: (row, col) => KINDS[Number(digits[row * (cols + 1) + col] ?? 0)],
  };
}
