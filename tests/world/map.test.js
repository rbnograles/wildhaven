// Checks the map's "can I stand here?" rule. Every step the player takes asks this question,
// so if it is wrong the player could start inside the sea or walk off the edge of the world.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD,
  OBSTACLES,
  blocks,
  hitsObstacle,
  isWalkable,
  mapProperty,
} from '../../src/world/map.js';
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
