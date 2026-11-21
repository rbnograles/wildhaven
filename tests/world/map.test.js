// Checks the map's "can I stand here?" rule. Every step the player takes asks this question,
// so if it is wrong the player could start inside the sea or walk off the edge of the world.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };
import {
  WORLD,
  OBSTACLES,
  blocks,
  hitsObstacle,
  isWalkable,
  mapProperty,
  MAP_OBJECTS,
  elevationAt,
  isDryLand,
  surfaceAt,
} from '../../src/world/map.js';
import { inSnow } from '../../src/world/regions.js';
import { CHARACTERS } from '../../src/data/characters.js';

// Guards against a map rebuild putting water, a tree or a rock on a character's start spot.
test('every character spawn is walkable ground', () => {
  for (const c of CHARACTERS) assert.ok(isWalkable(c.spawn.x, c.spawn.y), c.id);
});

// Guards the world's edges, and against broken numbers (NaN, Infinity) from a bad save being
// treated as a real place to stand.
test('points past the world margin or not finite are never walkable', () => {
  for (const [x, y] of [
    [WORLD.margin - 1, 500],
    [500, WORLD.margin - 1],
    [WORLD.width - WORLD.margin + 1, 500],
    [500, WORLD.height - WORLD.margin + 1],
    [NaN, 500],
    [500, Infinity],
  ])
    assert.equal(isWalkable(x, y), false, `${x},${y}`);
});

// Guards the collision grid: looking only at nearby objects must give the same answer as
// checking every object on the map, or the player could walk through a tree near a grid line.
test('the collision grid agrees with a scan of every obstacle', () => {
  let seed = 7;
  /** A small repeatable random number generator, so the test checks the same points every run. */
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let hits = 0;

  for (let i = 0; i < 4000; i++) {
    const o = OBSTACLES[Math.floor(rand() * OBSTACLES.length)];
    const x = o[0] - 40 + rand() * (o[2] - o[0] + 80),
      y = o[1] - 40 + rand() * (o[3] - o[1] + 80);
    const expected = blocks(OBSTACLES, x, y);
    if (expected) hits++;
    assert.equal(hitsObstacle(x, y), expected, `${x},${y}`);
  }

  assert.ok(hits > 500, 'the sample should include plenty of blocked points');
});

// Guards the helper other modules use to read build-time facts stored in the map file.
test('mapProperty reads a named value from the map file', () => {
  assert.ok(Number.isInteger(mapProperty('firstWaterGid')));
});

// Guards the world's size: the renderer, the minimap and the region grid all assume it.
test('the world is 448 by 320 tiles of 64 units: the old 384 by 256 map plus a sea border', () => {
  assert.equal(WORLD.width, 28672);
  assert.equal(WORLD.height, 20480);
});

// Guards the ground lookup the footprints use: if the sand or snow layer were read wrongly, every
// print would be the earth one (or snow prints would show up on a beach).
test('surfaceAt tells sand, snow and earth apart on dry land', () => {
  const seen = { sand: 0, snow: 0, earth: 0 };
  let snowy = 0,
    snowyAsSnow = 0;

  // Look at one spot in every 128-unit square of the world.
  for (let y = 64; y < WORLD.height; y += 128)
    for (let x = 64; x < WORLD.width; x += 128) {
      if (!isDryLand(x, y)) continue;
      const surface = surfaceAt(x, y);
      seen[surface]++;
      if (inSnow(x, y)) {
        snowy++;
        if (surface === 'snow') snowyAsSnow++;
      }
    }

  assert.ok(seen.sand > 200 && seen.earth > 2000, JSON.stringify(seen));
  // Spring has no snow; only check the snow surface where the world actually has a snowy region.
  // Nearly all of a snowy region is snow underfoot (its beach is sand).
  if (snowy > 0) assert.ok(snowyAsSnow / snowy > 0.8, `${snowyAsSnow} of ${snowy}`);
});

// Guards the footpaths between the villages, starting places and signposts: a piece in a river, on
// a hill or under a tree would be a path nobody can follow. The map builder lays turned path pieces;
// a map brought in from Tiled has a `paths` tile layer instead, and every square of it is checked.
test('every piece of footpath lies on dry, level ground with nothing solid on it', () => {
  const tiles = MAP.layers.find((l) => l.name === 'paths' && l.type === 'tilelayer');
  if (tiles) {
    const squares = tiles.data.flatMap((gid, i) => (gid ? [i] : []));
    assert.ok(squares.length > 500, `${squares.length} path squares`);
    for (const i of squares) {
      const x = (i % MAP.width) * MAP.tilewidth + 32,
        y = Math.floor(i / MAP.width) * MAP.tileheight + 32,
        where = `the path square at ${x},${y}`;
      assert.ok(isDryLand(x, y), `${where} is in water`);
      assert.equal(elevationAt(x, y), '0', `${where} is on a hill`);
      assert.ok(!hitsObstacle(x, y), `${where} is under something solid`);
    }
    return;
  }

  const pieces = MAP_OBJECTS.filter((o) => o.name.startsWith('path-'));
  assert.ok(pieces.length > 500, `${pieces.length} pieces`);

  for (const piece of pieces) {
    const where = `${piece.name} at ${piece.x},${piece.y}`;
    assert.ok(isDryLand(piece.x, piece.y), `${where} is in water`);
    assert.equal(elevationAt(piece.x, piece.y), '0', `${where} is on a hill`);
    assert.ok(!hitsObstacle(piece.x, piece.y), `${where} is under something solid`);
    assert.ok(piece.rotation >= 0 && piece.rotation < 360, `${where} has no turn`);
  }
});
