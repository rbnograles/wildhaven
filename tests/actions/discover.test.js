// Checks discovery: walking into a region marks it as found, exactly once.
// The HUD and the world map count found regions, so each one must be counted exactly once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { discover } from '../../src/actions/discover.js';
import { SPAWNS, LANDMARKS, WAYPOINTS, WRECKS } from '../../src/data/places.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS, WRECK_RADIUS } from '../../src/data/balance.js';

// Guards against a region being "discovered" again on every frame while the player stands in it,
// and checks that walking into a second region adds it alongside the first.
test('a region is discovered once, when the player first stands in it', () => {
  const game = createGame('survivor');

  const first = discover(game).filter((f) => f.kind === 'region');
  assert.deepEqual(first, [{ kind: 'region', id: 'driftwood-landing', name: 'Driftwood Landing' }]);
  assert.equal(discover(game).filter((f) => f.kind === 'region').length, 0);

  // Teleport the survivor to the scout's start, which is in a different region.
  Object.assign(game.player, SPAWNS.scout);
  assert.equal(discover(game).filter((f) => f.kind === 'region')[0].id, 'pinefall-camp');
  assert.deepEqual(game.discovered, ['driftwood-landing', 'pinefall-camp']);
});

// Guards landmark finding: standing close enough finds it once; standing just outside does not.
test('a landmark is found once when the player comes within its radius', () => {
  const game = createGame('builder'),
    oak = LANDMARKS.find((l) => l.id === 'h-oak');

  Object.assign(game.player, { x: oak.x, y: oak.y + LANDMARK_RADIUS + 5 });
  assert.equal(discover(game).filter((f) => f.kind === 'landmark').length, 0);

  Object.assign(game.player, { x: oak.x, y: oak.y + LANDMARK_RADIUS - 5 });
  assert.deepEqual(
    discover(game).filter((f) => f.kind === 'landmark'),
    [{ kind: 'landmark', id: 'h-oak', name: 'The Great Oak' }],
  );
  assert.equal(discover(game).length, 0);
  assert.deepEqual(game.landmarks, ['h-oak']);
});

// Guards signpost finding, which is what unlocks fast travel.
test('a signpost is found once when the player walks up to it', () => {
  const game = createGame('builder'),
    post = WAYPOINTS.find((w) => w.id === 'h-wp-village');

  Object.assign(game.player, { x: post.x + WAYPOINT_RADIUS + 5, y: post.y });
  assert.equal(discover(game).filter((f) => f.kind === 'waypoint').length, 0);

  Object.assign(game.player, { x: post.x, y: post.y });
  assert.deepEqual(
    discover(game).filter((f) => f.kind === 'waypoint'),
    [{ kind: 'waypoint', id: post.id, name: post.name }],
  );
  assert.deepEqual(game.waypoints, ['h-wp-village']);
});

// Guards the old-boat finds: each is found once, from up to WRECK_RADIUS away, so the map can mark it.
test('an old boat is found once when the player comes within its radius', () => {
  const game = createGame('survivor'),
    wreck = WRECKS.find((w) => w.id === 'wreck-east');
  /** The old-boat finds among everything discover() reports this time. */
  const wreckFinds = () => discover(game).filter((f) => f.kind === 'wreck');

  Object.assign(game.player, { x: wreck.x, y: wreck.y + WRECK_RADIUS + 10 });
  assert.deepEqual(wreckFinds(), []);
  game.player.y = wreck.y + WRECK_RADIUS - 10;
  assert.deepEqual(wreckFinds(), [{ kind: 'wreck', id: wreck.id, name: wreck.name }]);
  assert.deepEqual(game.wrecks, [wreck.id]);
  assert.deepEqual(wreckFinds(), []);
});
