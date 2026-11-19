// Checks the map's "can I stand here?" rule. Every step the player takes asks this question,
// so if it is wrong the player could start inside the sea or walk off the edge of the world.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, isWalkable } from '../../src/world/map.js';
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
