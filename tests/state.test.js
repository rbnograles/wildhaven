import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTERS, NODES, RESOURCES, GATHER_SECONDS, createGame, movePlayer, serializeGame, restoreGame, gather, gatherTime, discover, WORLD, isWalkable, nodeBases, nearbyNode, isAvailable, hasGathered } from '../src/state.js';
import { CLIPS } from '../src/animation.js';
import OBJECT_SPECS from '../assets/world/source/objects.json' with { type: 'json' };

const supplies = NODES.filter(n => !n.regrow), wild = NODES.filter(n => n.regrow);
const pngSize = name => { const b = readFileSync(new URL(`../assets/world/source/objects/${name}.png`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

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

test('gathering is proximity based and a node can be collected only once', () => {
  const game = createGame('scout'), node = NODES.find(n => n.id === 'pine-wood');
  assert.equal(gather(game), null); // nothing is within reach of the camp spawn
  game.player.x = node.x; game.player.y = node.y + 40;
  assert.equal(gather(game)?.id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount);
  assert.equal(gather(game), null);
  assert.equal(gather(game, 'pine-wood'), null);
  assert.equal(gather(game, 'camp-stone'), null); // named, but out of reach
});

test('every supply is a known, solid, action-backed sprite that takes the full gather time', () => {
  for (const node of supplies) {
    assert.ok(OBJECT_SPECS[node.sprite]?.footprint, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.scale > 0 && typeof node.verb === 'string', node.id);
    assert.equal(gatherTime(createGame('scout'), node), GATHER_SECONDS);
  }
  assert.equal(GATHER_SECONDS, 6);
});

test('supply bases block movement until gathered, and never trap a player already inside', () => {
  const node = NODES.find(n => n.id === 'pine-wood');
  assert.ok(isWalkable(node.x, node.y - 5));
  assert.equal(isWalkable(node.x, node.y - 5, nodeBases([])), false);
  assert.ok(isWalkable(node.x, node.y - 5, nodeBases(['pine-wood'])));
  const game = createGame('scout'); game.player.x = node.x; game.player.y = node.y - 5;
  assert.ok(movePlayer(game, -1, 0, 0.1)); // e.g. a save made before the tree stood here
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

test('wild flower patches are walk-through herb sources drawn smaller than a character', () => {
  assert.ok(wild.length >= 30);
  assert.equal(new Set(NODES.map(n => n.id)).size, NODES.length);
  for (const node of wild) {
    assert.equal(node.type, 'herbs'); assert.ok(RESOURCES.includes(node.type));
    assert.equal(OBJECT_SPECS[node.sprite].footprint, undefined, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.regrow > 0 && node.amount > 0, node.id);
    assert.ok(pngSize(node.sprite).every(side => side * node.scale < 112), node.id); // 112 = PLAYER_HEIGHT in render.js
  }
});

test('every supply and wild patch can be walked to and gathered from each spawn', () => {
  // Flood-fill a 16-unit grid from the scout's spawn while every supply still stands.
  const G = 16, cols = Math.ceil(WORLD.width / G), rows = Math.ceil(WORLD.height / G), bases = nodeBases([]);
  const seen = new Uint8Array(cols * rows), queue = [], start = createGame('scout').player;
  const visit = (cx, cy) => {
    const i = cy * cols + cx;
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows || seen[i] || !isWalkable(cx * G, cy * G, bases)) return;
    seen[i] = 1; queue.push(i);
  };
  visit(Math.round(start.x / G), Math.round(start.y / G));
  for (let k = 0; k < queue.length; k++) { const cx = queue[k] % cols, cy = Math.floor(queue[k] / cols); visit(cx+1, cy); visit(cx-1, cy); visit(cx, cy+1); visit(cx, cy-1); }
  const near = (x, y, r) => queue.find(i => Math.hypot((i % cols) * G - x, Math.floor(i / cols) * G - y) < r);
  for (const c of CHARACTERS) assert.notEqual(near(c.spawn.x, c.spawn.y, G), undefined, c.id);
  for (const node of NODES) {
    const i = near(node.x, node.y, 90);
    assert.notEqual(i, undefined, node.id);
    const game = createGame('scout'); game.player.x = (i % cols) * G; game.player.y = Math.floor(i / cols) * G;
    assert.equal(gather(game, node.id)?.id, node.id);
  }
});

test('a picked flower patch gives herbs, then grows back on the game clock', () => {
  const game = createGame('scout'), node = wild[0];
  game.player.x = node.x; game.player.y = node.y;
  assert.equal(hasGathered(game), false);
  assert.equal(gather(game, node.id)?.id, node.id);
  assert.equal(game.resources.herbs, node.amount);
  assert.deepEqual(game.collected, []);
  assert.ok(hasGathered(game));
  assert.equal(gather(game, node.id), null);
  assert.notEqual(nearbyNode(game)?.id, node.id);
  game.elapsed += node.regrow - 1;
  assert.equal(isAvailable(game, node), false);
  game.elapsed += 1;
  assert.equal(isAvailable(game, node), true);
  assert.equal(gather(game, node.id)?.id, node.id);
  assert.equal(game.resources.herbs, node.amount * 2);
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
