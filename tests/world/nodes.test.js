import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import OBJECT_SPECS from '../../assets/world/source/objects.json' with { type: 'json' };
import { CHARACTERS } from '../../src/data/characters.js';
import { RESOURCES } from '../../src/data/supplies.js';
import { GATHER_SECONDS } from '../../src/data/balance.js';
import { WORLD, isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { gatherTime, finishGather } from '../../src/actions/gather.js';
import { CLIPS } from '../../src/animation/clips.js';

const supplies = NODES.filter(n => !n.regrow), wild = NODES.filter(n => n.regrow);
const pngSize = name => { const b = readFileSync(new URL(`../../assets/world/source/objects/${name}.png`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('every supply is a known, solid, action-backed sprite that takes the full gather time', () => {
  for (const node of supplies) {
    assert.ok(OBJECT_SPECS[node.sprite]?.footprint, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.scale > 0 && typeof node.verb === 'string', node.id);
    assert.equal(gatherTime(createGame('scout'), node), GATHER_SECONDS);
  }
  assert.equal(GATHER_SECONDS, 6);
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
    assert.equal(finishGather(game, node.id)?.id, node.id);
  }
});
