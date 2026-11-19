// Checks the game state: how a new game starts, how a save is turned back into a game, and how
// an older save is upgraded. Loading is strict on purpose. A broken or tampered save must be
// refused, not half-loaded, so the player never ends up stuck in a wall or holding impossible
// amounts of supplies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { START_TIME, SUPPLY_REGROW, TEA_SECONDS } from '../../src/data/balance.js';
import { isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { REGIONS } from '../../src/world/regions.js';
import { isRevealed } from '../../src/world/fog.js';
import { SAVE_VERSION, createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

/** The wild flower patches: map scenery that can be picked and grows back quickly. */
const wild = NODES.filter((n) => n.id.startsWith('flowers-'));

/**
 * Makes a valid camp standing where the player stands, for tests that put camps in a save.
 *
 * @param {object} game - A game made with createGame.
 * @returns {object} A camp with an id, a name, a spot, no growth and three open needs.
 */
const campAt = (game) => ({
  id: 'camp-1',
  name: 'Test Camp',
  x: game.player.x,
  y: game.player.y,
  grown: 0,
  needs: [
    { kind: 'bring', resource: 'stone', amount: 3, done: false },
    { kind: 'place', region: 'frostpeak', done: false },
    { kind: 'signpost', done: false },
  ],
});

/**
 * Writes a version 3 save the way the old code did, for the upgrade tests.
 *
 * @param {object} [changes={}] - Fields to set on top of a fresh scout's version 3 save.
 * @returns {string} The save as JSON text.
 */
function v3Save(changes = {}) {
  const game = createGame('scout');
  return JSON.stringify({
    version: 3,
    character: game.character,
    player: game.player,
    resources: game.resources,
    collected: [],
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    elapsed: 0,
    distance: 0,
    ...changes,
  });
}

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

// Guards the starting conditions the first-night design relies on: a morning start, full meters,
// no camps yet, and the fog lifted only around the spawn.
test('a new game starts on the morning of day 1 with full meters and the fog lifted around the spawn', () => {
  const game = createGame('scout');
  assert.equal(game.version, SAVE_VERSION);
  assert.equal(game.time, START_TIME);
  assert.deepEqual(game.meters, { health: 100, hunger: 100, warmth: 100 });
  assert.equal(game.tea, 0);
  assert.deepEqual(game.camps, []);
  assert.equal(game.collected, undefined);
  assert.ok(isRevealed(game, game.player.x, game.player.y));
  assert.equal(isRevealed(game, game.player.x + 5000, game.player.y + 5000), false);
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
  original.time = 1000;
  original.meters.warmth = 12.5;
  original.tea = 7;
  original.camps.push(campAt(original));

  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored, original);

  restored.resources.wood++;
  restored.camps[0].needs[0].done = true;
  assert.equal(original.resources.wood, 9);
  assert.equal(original.camps[0].needs[0].done, false);
});

// Guards the strict loader: each broken save below must be refused.
test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);

  for (const edit of [
    (g) => (g.version = 100),
    (g) => (g.version = 2),
    (g) => (g.version = 3), // a version 3 label on a save with no `collected` list
    (g) => (g.landmarks = ['nowhere']),
    (g) => (g.landmarks = ['h-oak', 'h-oak']),
    (g) => (g.waypoints = undefined),
    (g) => (g.waypoints = ['h-oak']),
    (g) => (g.discovered = ['scout']),
    (g) => (g.character = 'ghost'),
    (g) => (g.player.x = -100),
    (g) => (g.resources.wood = -5),
    (g) => (g.player.y = null),
    (g) => (g.resources.herbs = 1.5),
    (g) => (g.regrowAt = []),
    (g) => (g.regrowAt = { [wild[0].id]: -1 }),
    (g) => (g.time = -1),
    (g) => (g.time = undefined),
    (g) => (g.meters.health = 101),
    (g) => (g.meters.hunger = -1),
    (g) => (g.meters = undefined),
    (g) => (g.tea = TEA_SECONDS + 1),
    (g) => (g.fog = g.fog.slice(1)),
    (g) => (g.fog = 'x' + g.fog.slice(1)),
    (g) => (g.camps = {}),
    (g) => g.camps.push({ ...campAt(g), id: 'tent' }),
    (g) => g.camps.push({ ...campAt(g), name: '' }),
    (g) => g.camps.push({ ...campAt(g), name: ' Padded ' }),
    (g) => g.camps.push({ ...campAt(g), name: 'x'.repeat(25) }),
    (g) => g.camps.push({ ...campAt(g), x: -100 }),
    (g) => g.camps.push({ ...campAt(g), grown: 11 }),
    (g) => g.camps.push({ ...campAt(g), needs: [] }),
    (g) =>
      g.camps.push({
        ...campAt(g),
        needs: [
          { kind: 'bring', resource: 'gold', amount: 3, done: false },
          ...campAt(g).needs.slice(1),
        ],
      }),
    (g) =>
      g.camps.push({
        ...campAt(g),
        needs: [{ kind: 'place', region: 'moon', done: false }, ...campAt(g).needs.slice(1)],
      }),
    (g) => g.camps.push(campAt(g), campAt(g)), // the same id twice
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
  game.time = 100;
  game.regrowAt = { [a.id]: 150, [b.id]: 1e9, 'flowers-1-1': 120, 'pine-wood': 1e9 };

  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, {
    [a.id]: 150,
    [b.id]: 100 + b.regrow,
    'pine-wood': 100 + SUPPLY_REGROW,
  });
});

// Guards players' old saves: version 3 progress must survive the upgrade instead of being wiped.
test('a version 3 save is upgraded to the morning of day 1, keeping progress and timers', () => {
  const flower = wild[0];
  const game = restoreGame(
    v3Save({
      elapsed: 500,
      regrowAt: { [flower.id]: 560 },
      collected: ['pine-wood'],
      discovered: ['pinefall'],
      landmarks: ['h-square'],
    }),
  );

  assert.equal(game.version, SAVE_VERSION);
  assert.equal(game.time, START_TIME);
  assert.equal(game.elapsed, 500);
  assert.deepEqual(game.regrowAt, {
    [flower.id]: START_TIME + 60,
    'pine-wood': START_TIME + SUPPLY_REGROW,
  });
  assert.deepEqual(game.landmarks, ['h-square']);
  assert.deepEqual(game.meters, { health: 100, hunger: 100, warmth: 100 });
  assert.deepEqual(game.camps, []);
  assert.equal(game.collected, undefined);
  const pinefall = REGIONS.find((r) => r.id === 'pinefall');
  assert.ok(isRevealed(game, pinefall.x, pinefall.y));
});

// Guards the upgrade against letting a broken old save through.
test('a broken version 3 save is still refused', () => {
  for (const changes of [
    { collected: ['unknown'] },
    { collected: [wild[0].id] },
    { collected: undefined },
    { regrowAt: [] },
    { regrowAt: { [wild[0].id]: -1 } },
  ])
    assert.equal(restoreGame(v3Save(changes)), null, JSON.stringify(changes));
});
