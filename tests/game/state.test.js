// Checks the game state: how a new game starts, and how a save is turned back into a game.
// Loading is strict on purpose. A broken or tampered save must be refused, not half-loaded,
// so the player never ends up stuck in a wall or holding impossible amounts of supplies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { WRECKS } from '../../src/data/places.js';
import { SEA_BORDER, isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

/** The wild patches (flowers and driftwood): the only nodes that grow back after being picked. */
const wild = NODES.filter((n) => n.regrow);

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');

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
  original.wrecks.push('wreck-east');
  original.boat = { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 2 };

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
    (g) => (g.wrecks = ['nowhere']),
    (g) => (g.wrecks = undefined),
    (g) => (g.boat = undefined),
    (g) => (g.boat = { from: 'nowhere', x: east.launch.x, y: east.launch.y, dir: 2 }),
    (g) => (g.boat = { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 7 }),
    (g) => (g.boat = { from: 'wreck-east', x: NaN, y: east.launch.y, dir: 2 }),
    (g) => (g.aboard = 'yes'),
    (g) => (g.aboard = true),
    (g) => Object.assign(g.player, east.launch),
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

// Guards the boat on load: a player afloat stays afloat, and a boat (or a player in it) that a
// rebuilt map left on dry land goes back to the water by its old boat, with the player ashore.
test('a saved boat stays where it floats, or returns to its launch spot if the sea moved', () => {
  const afloat = createGame('survivor');
  afloat.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  afloat.aboard = true;
  Object.assign(afloat.player, { x: east.launch.x, y: east.launch.y, direction: 2 });
  assert.deepEqual(restoreGame(serializeGame(afloat)), afloat);

  // The same boat saved on dry land (the survivor's start): first moored there, then with the player in it.
  const moored = createGame('survivor');
  moored.boat = { from: east.id, x: moored.player.x, y: moored.player.y, dir: 2 };
  assert.deepEqual(restoreGame(serializeGame(moored)).boat, {
    ...moored.boat,
    x: east.launch.x,
    y: east.launch.y,
  });

  const stranded = structuredClone(moored);
  stranded.aboard = true;
  const back = restoreGame(serializeGame(stranded));
  assert.equal(back.aboard, false);
  assert.deepEqual([back.player.x, back.player.y], [east.x, east.y]);
  assert.deepEqual([back.boat.x, back.boat.y], [east.launch.x, east.launch.y]);
});

// Guards players who saved before the sea border existed: their adventure moves onto the bigger
// map with everything they found, and a flower patch's regrow timer follows the patch.
test('a version 3 save moves onto the bigger map and keeps its progress', () => {
  const game = createGame('builder');
  const flower = wild.find((n) => n.sprite === 'flowers');
  game.landmarks.push('h-square');
  game.collected.push('village-wood');
  game.discovered.push('meadows');
  game.elapsed = 10;
  game.regrowAt[flower.id] = 50;

  // The same adventure as an older build saved it: positions before the border, no boat fields.
  const { wrecks, boat, aboard, ...old } = game;
  old.version = 3;
  old.player = { ...game.player, x: game.player.x - SEA_BORDER, y: game.player.y - SEA_BORDER };
  old.regrowAt = { [`flowers-${flower.x - SEA_BORDER}-${flower.y - SEA_BORDER}`]: 50 };

  assert.deepEqual(restoreGame(JSON.stringify(old)), game);
});

// Guards a version 3 player who stood where the new coast now cuts in: they go back to their
// start instead of losing the whole save.
test('a version 3 player whose spot is now sea starts again at their spawn, progress kept', () => {
  const game = createGame('survivor');
  game.landmarks.push('l-beacon');
  const { wrecks, boat, aboard, ...old } = game;
  old.version = 3;
  old.player = { x: 24000, y: 9000, direction: 2 }; // the old lagoon sea, still sea on the new map

  const restored = restoreGame(JSON.stringify(old));
  assert.deepEqual(restored.player, { ...createGame('survivor').player, direction: 2 });
  assert.deepEqual(restored.landmarks, ['l-beacon']);
});
