import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, createGame, movePlayer, serializeGame, restoreGame, gather, discover, WORLD, isWalkable } from '../src/state.js';

test('all characters begin at distinct, walkable locations with their own identity', () => {
  const games = CHARACTERS.map(c => createGame(c.id));
  assert.equal(new Set(games.map(g => `${g.player.x},${g.player.y}`)).size, 3);
  for (const [i, game] of games.entries()) {
    assert.equal(game.character, CHARACTERS[i].id);
    assert.ok(isWalkable(game.player.x, game.player.y));
  }
  assert.throws(() => createGame('unknown'));
});

test('diagonal movement is normalized and world edges cannot be crossed', () => {
  const a = createGame('scout'), b = createGame('scout');
  const origin = {...a.player};
  movePlayer(a, 1, 0, 0.1); movePlayer(b, 1, 1, 0.1);
  assert.ok(Math.abs(Math.hypot(a.player.x-origin.x,a.player.y-origin.y) - Math.hypot(b.player.x-origin.x,b.player.y-origin.y)) < 0.001);
  for(let i=0; i<500; i++) movePlayer(a, -1,-1,0.1);
  assert.ok(a.player.x >= WORLD.margin && a.player.y >= WORLD.margin);
  assert.ok(isWalkable(a.player.x, a.player.y));
});

test('save restores character, coordinates and progress without sharing mutable objects', () => {
  const original = createGame('builder');
  movePlayer(original, 1,0,0.1);
  original.resources.wood = 9;
  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored,original);
  restored.resources.wood++;
  assert.equal(original.resources.wood, 9);
});

test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);
  for(const edit of [g=>g.version=100, g=>g.character='ghost', g=>g.player.x=-100, g=>g.resources.wood=-5, g=>g.player.y=null, g=>g.collected=['unknown']]) {
    const game = createGame('survivor'); edit(game);
    assert.equal(restoreGame(JSON.stringify(game)), null);
  }
});

test('gathering is proximity based and a node can be collected only once', () => {
  const game = createGame('scout');
  const result = gather(game);
  assert.ok(result);
  assert.ok(game.resources.wood > 0);
  assert.equal(gather(game), null);
});

test('locations are discovered once when entered', () => {
  const game=createGame('survivor');
  assert.equal(discover(game).length,1);
  assert.equal(discover(game).length,0);
  const builder=createGame('builder');
  game.player.x=builder.player.x; game.player.y=builder.player.y;
  assert.equal(discover(game).length,1);
  assert.equal(game.discovered.length,2);
});
