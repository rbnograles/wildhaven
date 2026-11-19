// Checks the things you can gather (supplies and wild flower patches): that each one has art, an
// animation and sensible numbers, and that every one of them can really be reached on foot.
// A supply hidden behind water or trees would be a promise the game can't keep.

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

/** The one-time supplies (they never grow back), and the wild patches: flowers and driftwood (they do). */
const supplies = NODES.filter((n) => !n.regrow),
  wild = NODES.filter((n) => n.regrow);

/**
 * Reads a sprite's width and height straight from its PNG file, without a browser.
 * A PNG stores its size at a fixed spot near the start of the file, so we just read those bytes.
 *
 * @param {string} name - The sprite's name, like `flowers` (its file is in the kind folder its
 *   objects.json entry names, such as assets/world/source/objects/plants/).
 * @returns {number[]} `[width, height]` in pixels.
 */
const pngSize = (name) => {
  const file = `../../assets/world/source/objects/${OBJECT_SPECS[name].kind}/${name}.png`;
  const b = readFileSync(new URL(file, import.meta.url));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

// Guards against a supply pointing at a sprite that doesn't exist, having no solid base, or
// using an animation that isn't an action. Also pins the 6-second gather time on purpose:
// future tools are meant to shorten it, so it shouldn't be lowered as a quick "fix".
test('every supply is a known, solid, action-backed sprite that takes the full gather time', () => {
  for (const node of supplies) {
    assert.ok(OBJECT_SPECS[node.sprite]?.footprint, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.scale > 0 && typeof node.verb === 'string', node.id);
    assert.equal(gatherTime(createGame('scout'), node), GATHER_SECONDS);
  }
  assert.equal(GATHER_SECONDS, 6);
});

// Guards the wild patches: each has its own id, you can walk through them, they are gathered with
// an action clip, they grow back, and they are drawn smaller than the player.
test('wild patches are walk-through, regrowing and drawn smaller than a character', () => {
  assert.equal(new Set(NODES.map((n) => n.id)).size, NODES.length);

  for (const node of wild) {
    assert.ok(RESOURCES.includes(node.type));
    assert.equal(OBJECT_SPECS[node.sprite].footprint, undefined, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.regrow > 0 && node.amount > 0, node.id);
    assert.ok(
      pngSize(node.sprite).every((side) => side * node.scale < 112),
      node.id,
    ); // 112 = PLAYER_HEIGHT in src/render/renderer.js
  }
});

// Guards what each wild patch gives: flowers are the only source of herbs, and driftwood on the
// beaches gives the wood an old boat's repair needs.
test('flower patches give herbs and beach driftwood gives wood', () => {
  const flowers = wild.filter((n) => n.sprite === 'flowers'),
    driftwood = wild.filter((n) => n.sprite === 'driftwood');
  assert.ok(flowers.length >= 30);
  assert.ok(driftwood.length >= 20);
  assert.equal(flowers.length + driftwood.length, wild.length);
  for (const n of flowers) assert.equal(n.type, 'herbs', n.id);
  for (const n of driftwood)
    assert.deepEqual([n.type, n.amount, n.verb, n.regrow], ['wood', 1, 'Pick up', 180], n.id);
});

// Guards against a supply, a flower patch or a start spot being cut off by water, trees or
// another supply's base. It paints every reachable spot like spilled paint spreading out, then
// checks that each thing to gather has painted ground close enough to gather it from.
test('every supply and wild patch can be walked to and gathered from each spawn', () => {
  // Flood-fill a 16-unit grid from the scout's spawn while every supply still stands.
  const G = 16,
    cols = Math.ceil(WORLD.width / G),
    rows = Math.ceil(WORLD.height / G),
    bases = nodeBases([]);
  const seen = new Uint8Array(cols * rows),
    queue = [],
    start = createGame('scout').player;

  /**
   * Marks one grid cell as reachable and queues it for spreading, unless it is off the grid,
   * already marked, or not walkable.
   *
   * @param {number} cx - The cell's column.
   * @param {number} cy - The cell's row.
   */
  const visit = (cx, cy) => {
    const i = cy * cols + cx;
    if (
      cx < 0 ||
      cy < 0 ||
      cx >= cols ||
      cy >= rows ||
      seen[i] ||
      !isWalkable(cx * G, cy * G, bases)
    )
      return;
    seen[i] = 1;
    queue.push(i);
  };

  // Spread from the start cell to its four neighbours, one cell at a time, until nothing new is left.
  visit(Math.round(start.x / G), Math.round(start.y / G));
  for (let k = 0; k < queue.length; k++) {
    const cx = queue[k] % cols,
      cy = Math.floor(queue[k] / cols);
    visit(cx + 1, cy);
    visit(cx - 1, cy);
    visit(cx, cy + 1);
    visit(cx, cy - 1);
  }

  /**
   * Finds a reachable cell within `r` units of a point.
   *
   * @param {number} x - The point's x position in the world.
   * @param {number} y - The point's y position in the world.
   * @param {number} r - How close the cell must be.
   * @returns {number|undefined} The cell's index, or `undefined` if none is close enough.
   */
  const near = (x, y, r) =>
    queue.find((i) => Math.hypot((i % cols) * G - x, Math.floor(i / cols) * G - y) < r);

  for (const c of CHARACTERS) assert.notEqual(near(c.spawn.x, c.spawn.y, G), undefined, c.id);

  // For every node, stand on the nearest reachable cell and make sure gathering works from there.
  for (const node of NODES) {
    const i = near(node.x, node.y, 90);
    assert.notEqual(i, undefined, node.id);

    const game = createGame('scout');
    game.player.x = (i % cols) * G;
    game.player.y = Math.floor(i / cols) * G;
    assert.equal(finishGather(game, node.id)?.id, node.id);
  }
});
