// Checks the shared places file: the regions, start spots, supplies, landmarks, signposts and
// old boats that both the map builder and the game read. A typo here would put a landmark in the
// sea or make two things share one save id.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWalkable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { SUPPLIES } from '../../src/data/supplies.js';
import { nodeBases, wreckBases } from '../../src/world/nodes.js';
import { GATHER_RANGE } from '../../src/data/balance.js';
import { REGION_LIST, LANDMARKS, WAYPOINTS, SPAWNS, WRECKS } from '../../src/data/places.js';
import { LANDMARK_RADIUS } from '../../src/data/balance.js';
import { flood } from './flood.js';

// The lagoon islets are reached only by boat, so the on-foot tests leave them out; the sea test
// (tests/world/sea.test.js) checks a boat can reach them.
const ISLETS = ['l-gull-isle', 'l-turtle-isle', 'l-lantern-islet'];

// Guards the ids saves are keyed by, and the rule that every region has a landmark to find.
// The counts themselves are not pinned: places are added and removed in the world editor. Signposts
// are a travel network, not one-per-region, so a district may have none.
test('the world has eight regions, unique ids, and a landmark in every region', () => {
  assert.equal(REGION_LIST.length, 8);
  assert.ok(WAYPOINTS.length > 0, 'there are signposts to travel between');

  const ids = [...REGION_LIST, ...LANDMARKS, ...WAYPOINTS, ...WRECKS].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);

  const regions = REGION_LIST.map((r) => r.id);
  for (const p of [...LANDMARKS, ...WAYPOINTS, ...WRECKS])
    assert.ok(regions.includes(p.region), `${p.id} names the unknown region ${p.region}`);

  for (const region of regions)
    assert.ok(
      LANDMARKS.some((l) => l.region === region),
      `${region} has no landmark`,
    );
});

// Guards against a rebuilt map putting water or scenery where the player has to stand. Spawns and
// signposts are stood on, so their exact spot must be walkable; a landmark can mark a lake or an
// islet, so it is only checked for being reachable (the next test), not for being stood on.
test('every spawn and signpost is on ground the player can stand on', () => {
  const solid = [...nodeBases([]), ...wreckBases(null)];
  for (const c of CHARACTERS) assert.deepEqual(c.spawn, SPAWNS[c.id]);
  for (const p of [...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })), ...WAYPOINTS])
    assert.ok(isWalkable(p.x, p.y, solid), `${p.id} at ${p.x},${p.y}`);
});

// Guards the promise that nothing is cut off by a river, the sea or a wall of trees. A landmark is
// found within LANDMARK_RADIUS, so it counts as reachable when a walked spot comes that close; a
// spawn or signpost must be reached exactly. Islet landmarks are left out: they are reached by boat
// (see the sea test in tests/world/sea.test.js).
test('every spawn, mainland landmark, signpost, supply and old boat can be reached on foot', () => {
  const solid = [...nodeBases([]), ...wreckBases(null)];
  const foot = flood(SPAWNS.builder.x, SPAWNS.builder.y, (x, y) => isWalkable(x, y, solid));

  for (const p of [...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })), ...WAYPOINTS])
    assert.ok(foot.reached(p.x, p.y, 24), `${p.id} cannot be reached`);
  for (const l of LANDMARKS.filter((l) => !ISLETS.includes(l.id)))
    assert.ok(foot.reached(l.x, l.y, LANDMARK_RADIUS), `${l.id} cannot be found on foot`);
  for (const s of SUPPLIES)
    assert.ok(foot.reached(s.x, s.y, GATHER_RANGE - 24), `${s.id} cannot be gathered`);
  for (const w of WRECKS)
    assert.ok(foot.reached(w.x, w.y, GATHER_RANGE - 24), `${w.id} cannot be repaired`);
});
