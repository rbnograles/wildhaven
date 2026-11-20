// Checks the "how much have I found?" counts shown in the HUD and on the world map.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { LANDMARKS } from '../../src/data/places.js';
import { regionProgress, worldProgress } from '../../src/world/progress.js';

// Guards the per-region counts: finds in one region must not be counted in another.
test('region progress counts only that region’s places and signposts', () => {
  const game = createGame('builder');
  game.landmarks.push('h-oak', 'h-pond', 'd-oasis');
  game.waypoints.push('h-wp-east');

  // The totals are counted from the places file, so adding a place to the map can't break this.
  const placesIn = (region) => LANDMARKS.filter((place) => place.region === region).length;

  assert.deepEqual(regionProgress(game, 'meadows'), {
    places: { found: 2, total: placesIn('meadows') },
    signposts: { found: 1, total: 2 },
  });
  assert.deepEqual(regionProgress(game, 'jungle'), {
    places: { found: 0, total: placesIn('jungle') },
    signposts: { found: 0, total: 2 },
  });
});

// Guards the totals shown under the world map.
test('world progress counts everything found', () => {
  const game = createGame('builder');
  game.discovered.push('meadows', 'desert');
  game.landmarks.push('h-oak', 'd-oasis');

  assert.deepEqual(worldProgress(game), {
    regions: { found: 2, total: 7 },
    places: { found: 2, total: LANDMARKS.length },
    signposts: { found: 0, total: 14 },
  });
});
