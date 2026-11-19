import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

const wild = NODES.filter(n => n.regrow);

test('all characters begin at distinct, walkable locations with their own identity', () => {
  const games = CHARACTERS.map(c => createGame(c.id));
  assert.equal(new Set(games.map(g => `${g.player.x},${g.player.y}`)).size, 3);
  for (const [i, game] of games.entries()) {
    assert.equal(game.character, CHARACTERS[i].id);
    assert.ok(isWalkable(game.player.x, game.player.y));
    assert.ok(isWalkable(game.player.x, game.player.y, nodeBases([])));
  }
  assert.throws(() => createGame('unknown'));
});

test('save restores character, coordinates and progress without sharing mutable objects', () => {
  const original = createGame('builder');
  movePlayer(original, 1,0,0.1);
  original.resources.wood = 9; original.resources.herbs = 4; original.regrowAt[wild[0].id] = 42;
  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored,original);
  restored.resources.wood++;
  assert.equal(original.resources.wood, 9);
});

test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);
  for(const edit of [g=>g.version=100, g=>g.character='ghost', g=>g.player.x=-100, g=>g.resources.wood=-5, g=>g.player.y=null, g=>g.collected=['unknown'],
    g=>g.resources.herbs=1.5, g=>g.collected=[wild[0].id], g=>g.regrowAt=[], g=>g.regrowAt={[wild[0].id]:-1}]) {
    const game = createGame('survivor'); edit(game);
    assert.equal(restoreGame(JSON.stringify(game)), null);
  }
});

test('saves from before herbs and regrowth load with none of either', () => {
  const old = createGame('survivor'); delete old.resources.herbs; delete old.regrowAt;
  const restored = restoreGame(JSON.stringify(old));
  assert.equal(restored.resources.herbs, 0);
  assert.deepEqual(restored.regrowAt, {});
});

test('saved regrowth timers are kept, capped at one regrow, or dropped when the patch is gone', () => {
  const game = createGame('scout'), [a, b] = wild; game.elapsed = 100;
  game.regrowAt = { [a.id]: 150, [b.id]: 1e9, 'flowers-1-1': 120 };
  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, { [a.id]: 150, [b.id]: 100 + b.regrow });
});
