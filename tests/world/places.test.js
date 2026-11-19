// Checks the shared places file: the regions, start spots, supplies, landmarks and signposts
// that both the map builder and the game read. A typo here would put a landmark in the sea or
// make two things share one save id.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, isWalkable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { SUPPLIES } from '../../src/data/supplies.js';
import { nodeBases } from '../../src/world/nodes.js';
import { GATHER_RANGE } from '../../src/data/balance.js';
import { REGION_LIST, LANDMARKS, WAYPOINTS, SPAWNS } from '../../src/data/places.js';

// Guards the counts the HUD and map show, and the ids saves are keyed by.
test('the world has seven regions, 49 landmarks and 14 signposts with unique ids', () => {
  assert.equal(REGION_LIST.length, 7);
  assert.equal(LANDMARKS.length, 49);
  assert.equal(WAYPOINTS.length, 14);

  const ids = [...REGION_LIST, ...LANDMARKS, ...WAYPOINTS].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const region of REGION_LIST) {
    assert.equal(LANDMARKS.filter((l) => l.region === region.id).length, 7, region.id);
    assert.equal(WAYPOINTS.filter((w) => w.region === region.id).length, 2, region.id);
  }
});

// Guards against a rebuilt map putting water or scenery where the player has to stand.
test('every spawn, landmark and signpost is on ground the player can stand on', () => {
  const solid = nodeBases([]);
  for (const c of CHARACTERS) assert.deepEqual(c.spawn, SPAWNS[c.id]);
  for (const p of [
    ...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })),
    ...LANDMARKS,
    ...WAYPOINTS,
  ])
    assert.ok(isWalkable(p.x, p.y, solid), `${p.id} at ${p.x},${p.y}`);
});

// Guards the promise that nothing is cut off by a river, the sea or a wall of trees.
// It floods outward from the builder's start on a 24-unit grid, like water spreading over the land.
test('every spawn, landmark, signpost and supply can be reached on foot', () => {
  const STEP = 24,
    cols = Math.ceil(WORLD.width / STEP),
    rows = Math.ceil(WORLD.height / STEP),
    seen = new Uint8Array(cols * rows),
    solid = nodeBases([]);
  const start = Math.floor(SPAWNS.builder.y / STEP) * cols + Math.floor(SPAWNS.builder.x / STEP);
  const stack = [start];
  seen[start] = 1;

  while (stack.length) {
    const i = stack.pop(),
      cx = i % cols,
      cy = (i - cx) / cols;
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      const n = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[n]) continue;
      if (!isWalkable(nx * STEP + STEP / 2, ny * STEP + STEP / 2, solid)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }

  /** True if any flooded grid cell lies within `range` units of the point. */
  const reached = (x, y, range) => {
    const r = Math.ceil(range / STEP);
    for (let cy = Math.floor(y / STEP) - r; cy <= Math.floor(y / STEP) + r; cy++)
      for (let cx = Math.floor(x / STEP) - r; cx <= Math.floor(x / STEP) + r; cx++)
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows && seen[cy * cols + cx]) return true;
    return false;
  };

  for (const p of [
    ...CHARACTERS.map((c) => ({ id: c.id, ...c.spawn })),
    ...LANDMARKS,
    ...WAYPOINTS,
  ])
    assert.ok(reached(p.x, p.y, STEP), `${p.id} cannot be reached`);
  for (const s of SUPPLIES)
    assert.ok(reached(s.x, s.y, GATHER_RANGE - STEP), `${s.id} cannot be gathered`);
});
