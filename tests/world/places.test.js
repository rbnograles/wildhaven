// Checks the shared places file: the regions, start spots, supplies, landmarks, signposts and
// old boats that both the map builder and the game read. A typo here would put a landmark in the
// sea or make two things share one save id.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWalkable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { SUPPLIES } from '../../src/data/supplies.js';
import { nodeBases } from '../../src/world/nodes.js';
import { GATHER_RANGE } from '../../src/data/balance.js';
import { REGION_LIST, LANDMARKS, WAYPOINTS, SPAWNS, WRECKS } from '../../src/data/places.js';
import { flood } from './flood.js';

// How many landmarks each region has. The lagoon's three islets add one each.
const LANDMARKS_PER_REGION = { lagoon: 10 };

// Guards the counts the HUD and map show, and the ids saves are keyed by.
test('the world has seven regions, 52 landmarks, 14 signposts and 4 old boats with unique ids', () => {
  assert.equal(REGION_LIST.length, 7);
  assert.equal(LANDMARKS.length, 52);
  assert.equal(WAYPOINTS.length, 14);
  assert.equal(WRECKS.length, 4);

  const ids = [...REGION_LIST, ...LANDMARKS, ...WAYPOINTS, ...WRECKS].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const region of REGION_LIST) {
    const expected = LANDMARKS_PER_REGION[region.id] ?? 7;
    assert.equal(LANDMARKS.filter((l) => l.region === region.id).length, expected, region.id);
    assert.equal(WAYPOINTS.filter((w) => w.region === region.id).length, 2, region.id);
  }
});

// Guards against a rebuilt map putting water or scenery where the player has to stand.
test('every spawn, landmark, signpost and old boat is on ground the player can stand on', () => {
  const solid = nodeBases([]);
  for (const c of CHARACTERS) assert.deepEqual(c.spawn, SPAWNS[c.id]);
  for (const p of [
    ...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })),
    ...LANDMARKS,
    ...WAYPOINTS,
  ])
    assert.ok(isWalkable(p.x, p.y, solid), `${p.id} at ${p.x},${p.y}`);
  // An old boat's own spot is under its solid hull, so only the map itself is checked there.
  for (const w of WRECKS) assert.ok(isWalkable(w.x, w.y), `${w.id} at ${w.x},${w.y}`);
});

// Guards the promise that nothing is cut off by a river, the sea or a wall of trees. Islet
// landmarks are left out: they are reached by boat (see the sea test in tests/world/sea.test.js).
test('every spawn, mainland landmark, signpost, supply and old boat can be reached on foot', () => {
  const solid = nodeBases([]);
  const foot = flood(SPAWNS.builder.x, SPAWNS.builder.y, (x, y) => isWalkable(x, y, solid));
  const islets = ['l-gull-isle', 'l-turtle-isle', 'l-lantern-islet'];

  for (const p of [
    ...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })),
    ...LANDMARKS.filter((l) => !islets.includes(l.id)),
    ...WAYPOINTS,
  ])
    assert.ok(foot.reached(p.x, p.y, 24), `${p.id} cannot be reached`);
  for (const s of SUPPLIES)
    assert.ok(foot.reached(s.x, s.y, GATHER_RANGE - 24), `${s.id} cannot be gathered`);
  for (const w of WRECKS)
    assert.ok(foot.reached(w.x, w.y, GATHER_RANGE - 24), `${w.id} cannot be repaired`);
});
