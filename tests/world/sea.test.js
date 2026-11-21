// Checks the sea around the island: where the small boat may float, where the deep water starts,
// and that one shallow sea links every old boat with the lagoon's islets. If these break, a boat
// could sail off the map, beach itself on the sand, or never reach the islets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, SEA_BORDER, isWalkable, isDeep, isSailable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { LANDMARKS, WRECKS, SPAWNS } from '../../src/data/places.js';
import { BOARD_RANGE, LAND_RANGE } from '../../src/data/balance.js';
import { nodeBases, wreckBases } from '../../src/world/nodes.js';
import { flood } from './flood.js';

// Guards re-boarding after landing: landingSpot only looks inside LAND_RANGE, so the player must
// always be inside BOARD_RANGE of the boat they just left.
test('the landing range never exceeds the boarding range', () => {
  assert.ok(LAND_RANGE <= BOARD_RANGE);
});

// Guards the build-time fact the save migration uses to move old positions onto the bigger map.
test('the sea border is 2048 units wide', () => {
  assert.equal(SEA_BORDER, 2048);
});

// Guards the edge of the world: the outer sea is deep, so neither walking nor the small boat
// can reach the map's edge.
test('the outer sea is deep: nobody can walk or sail there', () => {
  for (const [x, y] of [
    [WORLD.margin + 20, WORLD.height / 2],
    [WORLD.width / 2, WORLD.margin + 20],
    [WORLD.width - WORLD.margin - 20, WORLD.height / 2],
    [WORLD.width / 2, WORLD.height - WORLD.margin - 20],
  ]) {
    assert.ok(isDeep(x, y), `${x},${y}`);
    assert.equal(isSailable(x, y), false, `${x},${y}`);
    assert.equal(isWalkable(x, y), false, `${x},${y}`);
  }
});

// Guards where a boat floats: on the shallow water by each old boat, never on land or on broken
// numbers from a bad save.
test('a boat floats by each old boat, but never on land or on broken numbers', () => {
  for (const w of WRECKS) assert.ok(isSailable(w.launch.x, w.launch.y), w.id);
  for (const c of CHARACTERS) assert.equal(isSailable(c.spawn.x, c.spawn.y), false, c.id);
  assert.equal(isSailable(NaN, 500), false);
  assert.equal(isSailable(500, Infinity), false);
});

// Guards the boat's whole journey: from the beach the player can reach each boat, one shallow sea
// joins every old boat, and each islet has a beach within landing reach of that sea.
test('one shallow sea joins every old boat and reaches each islet', () => {
  const solid = [...nodeBases([]), ...wreckBases(null)];
  const foot = flood(SPAWNS.builder.x, SPAWNS.builder.y, (x, y) => isWalkable(x, y, solid));
  for (const w of WRECKS)
    assert.ok(
      foot.reached(w.launch.x, w.launch.y, BOARD_RANGE - 24),
      `${w.id}: no beach to board from`,
    );

  const east = WRECKS.find((w) => w.id === 'wreck-east');
  const sea = flood(east.launch.x, east.launch.y, isSailable);
  for (const w of WRECKS) assert.ok(sea.reached(w.launch.x, w.launch.y, 24), `${w.id} is cut off`);

  for (const id of ['l-turtle-isle', 'l-lantern-islet']) {
    const place = LANDMARKS.find((l) => l.id === id);
    const islet = flood(place.x, place.y, (x, y) => isWalkable(x, y));
    assert.ok(
      islet.cells.some(([x, y]) => sea.reached(x, y, LAND_RANGE - 24)),
      `${id} cannot be landed on`,
    );
  }
});
