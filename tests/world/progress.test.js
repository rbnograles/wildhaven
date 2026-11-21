// Checks the "how much have I found?" counts shown in the HUD and on the world map.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { LANDMARKS, WAYPOINTS, REGION_LIST } from '../../src/data/places.js';
import { regionProgress, worldProgress } from '../../src/world/progress.js';

// Totals counted from the places file, so adding a place to the map can't break these tests.
const placesIn = (region) => LANDMARKS.filter((place) => place.region === region).length;
const signpostsIn = (region) => WAYPOINTS.filter((w) => w.region === region).length;

// Guards the per-region counts: finds in one region must not be counted in another.
test('region progress counts only that region’s places and signposts', () => {
  const game = createGame('builder');
  // h-square and h-oak are in Hollowstead; d-needle is in another district (Pinefall Camp).
  game.landmarks.push('h-square', 'h-oak', 'd-needle');
  game.waypoints.push('h-wp-village');

  assert.deepEqual(regionProgress(game, 'hollowstead'), {
    places: { found: 2, total: placesIn('hollowstead') },
    signposts: { found: 1, total: signpostsIn('hollowstead') },
  });
  assert.deepEqual(regionProgress(game, 'willowbank'), {
    places: { found: 0, total: placesIn('willowbank') },
    signposts: { found: 0, total: signpostsIn('willowbank') },
  });
});

// Guards the totals shown under the world map.
test('world progress counts everything found', () => {
  const game = createGame('builder');
  game.discovered.push('hollowstead', 'pinefall-camp');
  game.landmarks.push('h-square', 'd-needle');

  assert.deepEqual(worldProgress(game), {
    regions: { found: 2, total: REGION_LIST.length },
    places: { found: 2, total: LANDMARKS.length },
    signposts: { found: 0, total: WAYPOINTS.length },
  });
});
