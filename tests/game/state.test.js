// Checks the game state: how a new game starts, and how a save is turned back into a game.
// Loading is strict on purpose. A broken or tampered save must be refused, not half-loaded,
// so the player never ends up stuck in a wall or holding impossible amounts of supplies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

/** The wild patches (flowers and driftwood): the only nodes that grow back after being picked. */
const wild = NODES.filter((n) => n.regrow);

// Guards against two characters sharing a start spot, a start spot inside water, a tree or a
// supply's solid base, and against a typo'd character id quietly making a game.
test('all characters begin at distinct, walkable locations with their own identity', () => {
  const games = CHARACTERS.map((c) => createGame(c.id));
  assert.equal(new Set(games.map((g) => `${g.player.x},${g.player.y}`)).size, 3);

  for (const [i, game] of games.entries()) {
    assert.equal(game.character, CHARACTERS[i].id);
    assert.ok(isWalkable(game.player.x, game.player.y));
    assert.ok(isWalkable(game.player.x, game.player.y, nodeBases([])));
  }

  assert.throws(() => createGame('unknown'));
});

// Guards against a save losing a field on the way back in, and against the loaded game sharing
// objects with the original (so changing one would secretly change the other).
test('save restores character, coordinates and progress without sharing mutable objects', () => {
  const original = createGame('builder');
  movePlayer(original, 1, 0, 0.1);
  original.resources.wood = 9;
  original.resources.herbs = 4;
  original.regrowAt[wild[0].id] = 42;

  original.landmarks.push('h-square');
  original.waypoints.push('h-wp-village');
  original.discovered.push('meadows');

  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored, original);

  restored.resources.wood++;
  assert.equal(original.resources.wood, 9);
});

// Guards the strict loader: each broken save below (bad version, unknown character, off-map
// position, negative or fractional supplies, unknown or wrong ids, bad timers) must be refused.
test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);

  for (const edit of [
    (g) => (g.version = 100),
    (g) => (g.version = 2),
    (g) => (g.landmarks = ['nowhere']),
    (g) => (g.landmarks = ['h-oak', 'h-oak']),
    (g) => (g.waypoints = undefined),
    (g) => (g.waypoints = ['h-oak']),
    (g) => (g.discovered = ['scout']),
    (g) => (g.character = 'ghost'),
    (g) => (g.player.x = -100),
    (g) => (g.resources.wood = -5),
    (g) => (g.player.y = null),
    (g) => (g.collected = ['unknown']),
    (g) => (g.resources.herbs = 1.5),
    (g) => (g.collected = [wild[0].id]),
    (g) => (g.regrowAt = []),
    (g) => (g.regrowAt = { [wild[0].id]: -1 }),
  ]) {
    const game = createGame('survivor');
    edit(game);
    assert.equal(restoreGame(JSON.stringify(game)), null);
  }
});

// Guards regrow timers on load: a normal timer is kept, a timer set absurdly far ahead is cut
// down to one regrow time, and a timer for a patch the map no longer has is dropped.
test('saved regrowth timers are kept, capped at one regrow, or dropped when the patch is gone', () => {
  const game = createGame('scout'),
    [a, b] = wild;
  game.elapsed = 100;
  game.regrowAt = { [a.id]: 150, [b.id]: 1e9, 'flowers-1-1': 120 };

  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, {
    [a.id]: 150,
    [b.id]: 100 + b.regrow,
  });
});
