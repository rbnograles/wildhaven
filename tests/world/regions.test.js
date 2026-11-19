// Checks the seven regions: every part of the world belongs to exactly one, and the places file
// and the map builder agree about which is which.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, isDryLand } from '../../src/world/map.js';
import {
  REGIONS,
  REGION_GRID,
  regionIndexAt,
  regionOf,
  regionAt,
} from '../../src/world/regions.js';
import { LANDMARKS, WAYPOINTS, SPAWNS, WRECKS } from '../../src/data/places.js';

// Guards the grid the map builder stored: it must cover the whole world with known regions.
test('the region grid covers the world and only names known regions', () => {
  assert.equal(REGIONS.length, 7);
  assert.equal(REGION_GRID.cols * REGION_GRID.cell, WORLD.width);
  assert.equal(REGION_GRID.rows * REGION_GRID.cell, WORLD.height);

  const used = new Set();
  for (let cy = 0; cy < REGION_GRID.rows; cy++)
    for (let cx = 0; cx < REGION_GRID.cols; cx++) {
      const i = regionIndexAt(cx, cy);
      assert.ok(REGIONS[i], `square ${cx},${cy}`);
      used.add(i);
    }
  assert.equal(used.size, 7);
});

// Guards the world-map labels: a label on the sea (the lagoon) or on a pool (the desert) looks wrong.
test('every region label is on dry land', () => {
  for (const r of REGIONS) {
    assert.ok(isDryLand(r.x, r.y), r.id);
    assert.equal(regionOf(r.x, r.y).id, r.id, r.id);
  }
});

// Guards the link between a place and its region: the HUD counts places per region, so a
// landmark that sits across a border would be counted where the player never sees it.
test('every landmark, signpost and old boat lies inside the region it names', () => {
  for (const p of [...LANDMARKS, ...WAYPOINTS, ...WRECKS])
    assert.equal(regionOf(p.x, p.y).id, p.region, p.id);
});

// Guards the starting regions and the name shown at the top of the screen.
test('each character starts in the expected region', () => {
  assert.equal(regionAt(SPAWNS.scout), 'Pinefall Woods');
  assert.equal(regionAt(SPAWNS.builder), 'Hollowstead Meadows');
  assert.equal(regionAt(SPAWNS.survivor), 'Driftwood Lagoon');
});

// Guards against a crash when a position is right on, or just past, the world's edge.
test('positions on the edge of the world still resolve to a region', () => {
  assert.ok(regionOf(0, 0).id);
  assert.ok(regionOf(WORLD.width, WORLD.height).id);
});

// Guards the label positions on the world map: a centre must be inside its own region.
test('each region centre lies inside that region', () => {
  for (const r of REGIONS) assert.equal(regionOf(r.x, r.y).id, r.id, r.id);
});
