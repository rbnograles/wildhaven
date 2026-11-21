// Checks the things you can gather (supplies and wild patches: flowers, driftwood, small stones): that each one has art, an
// animation and sensible numbers, and that every one of them can really be reached on foot.
// A supply hidden behind water or trees would be a promise the game can't keep.

import { test } from 'node:test';
import { npcBases } from '../../src/world/npcs.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import OBJECT_SPECS from '../../assets/world/source/objects.json' with { type: 'json' };
import { CHARACTERS } from '../../src/data/characters.js';
import { WRECKS } from '../../src/data/places.js';
import { RESOURCES, SUPPLIES, HARVEST, WILD } from '../../src/data/supplies.js';
import { GATHER_SECONDS, SUPPLY_REGROW, HARVEST_REGROW } from '../../src/data/balance.js';
import { WORLD, isWalkable } from '../../src/world/map.js';
import { regionOf } from '../../src/world/regions.js';
import {
  NODES,
  nodeBases,
  wreckBases,
  goneSupplies,
  solidBases,
  nodesNear,
} from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { gatherTime, finishGather } from '../../src/actions/gather.js';
import { CLIPS } from '../../src/animation/clips.js';

/**
 * The hand-placed supplies (they grow back after two days), the wild patches: flowers, driftwood
 * and small stones (they grow back sooner), and the map's trees and rocks (they need a tool).
 */
const supplies = NODES.filter((n) => SUPPLIES.includes(n)),
  wild = NODES.filter((n) => !SUPPLIES.includes(n) && !n.inScenery),
  harvest = NODES.filter((n) => n.inScenery);

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
/** The finds the map scatters: sprite name → the resource one gives. */
const FINDS = {
  'mossy-stone': 'stone',
  'grey-rock': 'stone',
  'flat-stone': 'stone',
};

test('every supply is a known, solid, action-backed sprite that takes the full gather time', () => {
  for (const node of supplies) {
    assert.ok(OBJECT_SPECS[node.sprite]?.footprint, node.id);
    assert.equal(CLIPS[node.clip]?.action, true, node.id);
    assert.ok(node.scale > 0 && typeof node.verb === 'string', node.id);
    assert.equal(gatherTime(createGame('survivor'), node), GATHER_SECONDS); // bare hands
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
    assert.equal(CLIPS[node.clip]?.action, true, node.id);
    assert.ok(node.regrow > 0 && node.amount > 0, node.id);
    assert.ok(
      pngSize(node.sprite).every((side) => side * node.scale < 112),
      node.id,
    ); // 112: the player's height until it became 76 (PLAYER_HEIGHT in src/render/renderer.js)
  }
});

// Guards what each wild patch gives: flowers and wild herbs are the sources of herbs, driftwood on the
// beaches gives the wood an old boat's repair needs, and small stones, wild berries and sticks
// give stone, food and wood to bare hands. The counts are floors, not targets: the Tiled map
// (tools/arrange-tiled-world.py) keeps about half of the hand-picked things on purpose, so a
// start is not too easy, and a few lie under trees or paths and are left out.
test('flowers give herbs, driftwood and sticks give wood, small stones give stone and wild berries give food', () => {
  const flowers = wild.filter((n) => n.sprite === 'flowers'),
    driftwood = wild.filter((n) => n.sprite === 'driftwood'),
    pebbles = wild.filter((n) => n.sprite === 'pebbles'),
    berries = wild.filter((n) => n.sprite === 'wild-berries'),
    sticks = wild.filter((n) => n.sprite === 'sticks'),
    herbs = wild.filter((n) => n.sprite === 'wild-herbs'),
    finds = wild.filter((n) => FINDS[n.sprite]);
  assert.ok(flowers.length >= 30);
  // Spring scatters no beach driftwood (sticks are the bare-hands wood there); a world with it has plenty.
  assert.ok(driftwood.length === 0 || driftwood.length >= 12);
  assert.ok(pebbles.length >= 150);
  assert.ok(berries.length >= 60);
  assert.ok(sticks.length >= 60);
  assert.equal(
    flowers.length +
      driftwood.length +
      pebbles.length +
      berries.length +
      sticks.length +
      herbs.length +
      finds.length,
    wild.length,
  );
  for (const n of sticks)
    assert.deepEqual([n.type, n.amount, n.tool, n.regrow], ['wood', 2, undefined, 180], n.id);
  for (const n of berries)
    assert.deepEqual([n.type, n.amount, n.tool, n.regrow], ['food', 1, undefined, 180], n.id);
  for (const n of pebbles)
    assert.deepEqual([n.type, n.amount, n.tool, n.regrow], ['stone', 1, undefined, 180], n.id);
  for (const n of flowers) assert.equal(n.type, 'herbs', n.id);
  for (const n of driftwood)
    assert.deepEqual([n.type, n.amount, n.verb, n.regrow], ['wood', 1, 'Pick up', 180], n.id);

  // A new player needs 5 stone for a first pickaxe and campfire, so each start has piles in easy reach.
  for (const c of CHARACTERS) {
    const close = pebbles.filter((n) => Math.hypot(n.x - c.spawn.x, n.y - c.spawn.y) < 1500);
    assert.ok(close.length >= 5, `${c.id}: ${close.length}`);
  }
});

// Guards the second herb source. Flowers grow almost only in the meadows, the lagoon and the
// jungle, so without wild herbs a player in the pine woods, the snow, the canyons or the desert
// cannot heal or brew the tea that holds off the cold.
test('herbs come from wild herb patches, or from flowers when the map has no patches', () => {
  const herbs = wild.filter((n) => n.sprite === 'wild-herbs');

  if (herbs.length) {
    // A world with wild-herb patches (the old seven-region map): validate them.
    assert.ok(herbs.length >= 110 && herbs.length <= 180, `${herbs.length} patches`);
    for (const n of herbs) {
      assert.deepEqual([n.type, n.amount, n.tool, n.regrow], ['herbs', 3, undefined, 180], n.id);
      assert.equal(OBJECT_SPECS[n.sprite].footprint, undefined, 'walk-through');
    }
    for (const name of ['Pinefall Woods', 'Frostpeak', 'Stonewater Canyons', 'Sunscar Desert']) {
      const here = herbs.filter((n) => regionOf(n.x, n.y).name === name);
      assert.ok(here.length >= 20, `${name}: ${here.length}`);
    }
  } else {
    // Spring has no wild-herb patches; flowers are the herb source instead.
    const flowers = wild.filter((n) => n.sprite === 'flowers' && n.type === 'herbs');
    assert.ok(flowers.length > 100, `${flowers.length} flower patches give herbs`);
  }
});

// Guards against a supply, a flower patch or a start spot being cut off by water, trees or
// another supply's base. It paints every reachable spot like spilled paint spreading out, then
// checks that each thing to gather has painted ground close enough to gather it from.
test('every supply and wild patch can be walked to and gathered from each spawn', () => {
  // Flood-fill a 16-unit grid from the scout's spawn while every supply still stands.
  const G = 16,
    cols = Math.ceil(WORLD.width / G),
    rows = Math.ceil(WORLD.height / G),
    bases = [...nodeBases([]), ...wreckBases(null)];
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
  // Trees and rocks are left out: checking ~2,600 of them would take minutes, and a tree deep in
  // a thicket is scenery, not a promise.
  for (const node of [...supplies, ...wild]) {
    const i = near(node.x, node.y, 90);
    assert.notEqual(i, undefined, node.id);

    // Some supplies need an axe or a pickaxe; this test is about reaching them, so carry both.
    const game = createGame('scout');
    game.tools = { axe: { tier: 'iron' }, pickaxe: { tier: 'iron' } };
    game.player.x = (i % cols) * G;
    game.player.y = Math.floor(i / cols) * G;
    assert.equal(finishGather(game, node.id)?.id, node.id);
  }
});

// Guards the M2 regrowth rule: fixed supplies come back after two in-game days, flowers sooner.
test('fixed supplies grow back after two days and flower patches after three minutes', () => {
  assert.equal(SUPPLY_REGROW, 720);
  for (const node of supplies) assert.equal(node.regrow, SUPPLY_REGROW, node.id);
  for (const node of wild) assert.equal(node.regrow, 180, node.id);
});

// Guards solid bases following availability: a chopped tree stops blocking, a regrown one blocks again.
test('a gathered supply stops being solid until it grows back', () => {
  const game = createGame('scout');
  assert.deepEqual(goneSupplies(game), []);
  game.regrowAt['pine-wood'] = game.time + 10;
  assert.deepEqual(goneSupplies(game), ['pine-wood']);
  game.time += 10;
  assert.deepEqual(goneSupplies(game), []);
});

// Guards the one list of solid things walking, landing, building and waking all share: standing
// supplies, old boats still on the beach, campfires and the villagers, and nothing that has gone.
test('solidBases holds standing supplies, beached old boats, campfires and villagers', () => {
  const game = createGame('scout');
  /** Counts the solid boxes the game has right now. */
  const count = () => solidBases(game).length;
  const all = nodeBases([]).length + wreckBases(null).length + npcBases().length;
  assert.equal(count(), all);

  game.regrowAt['pine-wood'] = game.time + 10; // chopped: no longer solid
  assert.equal(count(), all - 1);

  game.boat = { from: WRECKS[0].id, x: 0, y: 0, dir: 0 }; // mended: it left the beach
  assert.equal(count(), all - 2);

  game.camps.push({ id: 'camp-1', name: 'Test Camp', x: 5000, y: 5000, grown: 0, needs: [] });
  assert.equal(count(), all - 1);
  assert.ok(
    solidBases(game).some(
      ([left, , right, bottom]) => left < 5000 && right > 5000 && bottom === 5000,
    ),
  );
});

// Guards the tree and rock nodes: every HARVEST sprite is in the map with a solid base, each node
// needs the right tool and swings an action clip, trees give wood, and there is iron to mine.
test('every tree and rock in the map is a node that needs a tool', () => {
  assert.ok(harvest.length > 2000);
  for (const node of harvest) {
    // Every tree or rock on the map must be a known HARVEST kind with a solid base.
    assert.ok(HARVEST[node.sprite], node.id);
    assert.ok(OBJECT_SPECS[node.sprite]?.footprint, node.sprite);
    assert.ok(['axe', 'pickaxe'].includes(node.tool), node.id);
    assert.equal(CLIPS[node.clip]?.action, true, node.id);
    assert.equal(node.clip, node.tool === 'axe' ? 'chop' : 'build', node.id);
    assert.equal(node.regrow, HARVEST_REGROW, node.id);
    assert.equal(node.type === 'wood', node.tool === 'axe', node.id);
    assert.equal(node.id, `${node.sprite}-${node.x}-${node.y}`);
  }
  // Spring's temperate trees and the resource-expansion rocks are all on the map (no snow/jungle trees).
  for (const name of [
    'pine',
    'oak',
    'big-oak',
    'grey-rock-small',
    'grey-rock-big',
    'beach-rock-small',
  ])
    assert.ok(
      harvest.some((n) => n.sprite === name),
      name,
    );
});

// Guards the quick lookup: it finds every node close to a spot, the same as checking them all.
test('nodesNear finds every node close to a spot', () => {
  for (const node of NODES.filter((_, i) => i % 97 === 0)) {
    const x = node.x + 60,
      y = node.y - 40;
    /** The ids of the nodes in a list that are within 200 units of the spot, sorted. */
    const close = (list) =>
      list
        .filter((n) => Math.hypot(n.x - x, n.y - y) < 200)
        .map((n) => n.id)
        .sort();
    assert.deepEqual(close(nodesNear(x, y)), close(NODES), node.id);
  }
});

// Guards the finds scattered for bare hands: each kind must be on the map in fair numbers and give
// the resource its name promises (the three loose stones all give plain stone). Feathers and pine
// cones never lie on the ground: they come only from chopped trees (TREE_DROPS). Antlers do not
// either: they come only from hunted deer.
test('loose stones give stone, and no antler, feather or pine cone lies about', () => {
  // An antler only comes from a hunted deer: none is a node, and the map holds none.
  assert.equal(WILD.antler, undefined);
  assert.equal(
    NODES.some((n) => n.type === 'antler'),
    false,
  );
  assert.equal(WILD.feather, undefined);
  assert.equal(WILD['pine-cone'], undefined);
  for (const [sprite, type] of Object.entries(FINDS)) {
    const nodes = wild.filter((n) => n.sprite === sprite);
    assert.ok(nodes.length >= 15, `${sprite}: ${nodes.length}`);
    for (const n of nodes)
      assert.deepEqual([n.type, n.amount, n.tool, n.regrow], [type, 1, undefined, 180], n.id);
  }
});

// Guards Spring's "no minerals" rule, and that any precious ore (in a world that has it) is a
// pickaxe node for its own resource rather than plain scenery that gives nothing.
test('precious ore is pickaxe-mined where present, and Spring has none', () => {
  for (const [sprite, type] of [
    ['gold-ore', 'gold'],
    ['diamond-ore', 'diamond'],
  ])
    for (const n of NODES.filter((n) => n.sprite === sprite))
      assert.deepEqual([n.type, n.tool, n.amount], [type, 'pickaxe', 3], n.id);

  // Spring excludes metals and gems: no ore of any kind lies on the map.
  const ore = NODES.filter((n) =>
    ['gold-ore', 'diamond-ore', 'iron-ore', 'copper-ore'].includes(n.sprite),
  );
  assert.equal(ore.length, 0, ore.map((n) => n.sprite).join(','));
});
