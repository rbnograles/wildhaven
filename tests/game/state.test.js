// Checks the game state: how a new game starts, how a save is turned back into a game, and how
// an older save is upgraded and moved onto the bigger map. Loading is strict on purpose. A broken
// or tampered save must be refused, not half-loaded, so the player never ends up stuck in a wall
// or holding impossible amounts of supplies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { SUPPLIES } from '../../src/data/supplies.js';
import { WRECKS } from '../../src/data/places.js';
import {
  START_TIME,
  SUPPLY_REGROW,
  TEA_SECONDS,
  FOG_CELL,
  TOOL_USES,
} from '../../src/data/balance.js';
import { startingTools } from '../../src/world/tools.js';
import { SEA_BORDER, isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { REGIONS, regionOf } from '../../src/world/regions.js';
import { FOG_GRID, fogCells, isRevealed } from '../../src/world/fog.js';
import {
  SAVE_VERSION,
  BORDER_SQUARES,
  createGame,
  serializeGame,
  restoreGame,
} from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';
import { tidyBag } from '../../src/world/bag.js';

/** The wild flower patches: map scenery that can be picked and grows back quickly. */
const flowers = NODES.filter((n) => n.sprite === 'flowers');

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');

/** Moves a spot back by the sea border, to where it was on the map before the border was added. */
const before = (p) => ({ ...p, x: p.x - SEA_BORDER, y: p.y - SEA_BORDER });

/** Counts the fog squares a game has seen. */
const seenCount = (game) => fogCells(game.fog).reduce((sum, seen) => sum + seen, 0);

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
  buildings: [],
});

/**
 * Writes fog the way version 4 saved it: on the grid of the map before the sea border, which is
 * BORDER_SQUARES smaller on every side, four squares per hex letter, lowest bit first.
 *
 * @param {number[][]} seen - The [column, row] of each square seen, on that smaller grid.
 * @returns {string} The fog string.
 */
function oldFog(seen) {
  const cols = FOG_GRID.cols - 2 * BORDER_SQUARES,
    rows = FOG_GRID.rows - 2 * BORDER_SQUARES;
  const letters = new Array(Math.ceil((cols * rows) / 4)).fill(0);
  for (const [cx, cy] of seen) {
    const i = cy * cols + cx;
    letters[i >> 2] |= 1 << (i & 3);
  }
  return letters.map((letter) => letter.toString(16)).join('');
}

/**
 * Writes a version 3 save the way the old code did (before the clock and the sea border).
 *
 * @param {object} [changes={}] - Fields to set on top of a fresh builder's version 3 save.
 * @returns {string} The save as JSON text.
 */
function v3Save(changes = {}) {
  const game = createGame('builder');
  return JSON.stringify({
    version: 3,
    character: game.character,
    player: before(game.player),
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

/**
 * Writes a version 4 save the way the survival update did: its fields, but positions and fog from
 * the map before the sea border, and no boat fields.
 *
 * @param {object} [changes={}] - Fields to set on top of a fresh builder's version 4 save.
 * @returns {object} The save, ready for JSON.stringify.
 */
function v4Save(changes = {}) {
  const { wrecks, boat, aboard, ...game } = createGame('builder');
  return { ...game, version: 4, player: before(game.player), fog: oldFog([]), ...changes };
}

/**
 * Writes a version 5 save the way the archipelago update did: today's shape, but no iron in the
 * backpack and no tools.
 *
 * @param {string} characterId - Whose save it is.
 * @param {object} [changes={}] - Fields to set on top.
 * @returns {string} The save as JSON text.
 */
function v5Save(characterId, changes = {}) {
  const { tools, ...game } = createGame(characterId);
  const { iron, feather, pinecone, antler, ...resources } = game.resources;
  return JSON.stringify({ ...game, version: 5, resources, ...changes });
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
// no camps or boat yet, and the fog lifted only around the spawn.
test('a new game starts on the morning of day 1 with full meters, on foot, and the fog lifted around the spawn', () => {
  const game = createGame('scout');
  assert.equal(game.version, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 11);
  assert.equal(game.time, START_TIME);
  assert.deepEqual(game.meters, { health: 100, hunger: 100, warmth: 100 });
  assert.equal(game.tea, 0);
  assert.deepEqual(game.camps, []);
  assert.deepEqual([game.wrecks, game.boat, game.aboard], [[], null, false]);
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
  tidyBag(original); // the herbs take a slot, as they would in play
  original.regrowAt[flowers[0].id] = 1042; // still growing back at time 1000
  original.landmarks.push('h-square');
  original.waypoints.push('h-wp-village');
  original.discovered.push('meadows');
  original.wrecks.push('wreck-east');
  original.boat = { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 2 };
  original.time = 1000;
  original.meters.warmth = 12.5;
  original.tea = 7;
  original.camps.push(campAt(original));
  original.camps[0].buildings = [
    { id: 'b-1', kind: 'tent', x: original.player.x + 120, y: original.player.y },
    {
      id: 'b-2',
      kind: 'chest',
      x: original.player.x - 120,
      y: original.player.y,
      contents: { wood: 4 },
    },
    {
      id: 'b-3',
      kind: 'farm',
      x: original.player.x,
      y: original.player.y + 120,
      crop: { stage: 1, readyAt: 1300, tended: true },
    },
    { id: 'b-4', kind: 'centre', x: original.player.x, y: original.player.y - 160, tier: 2 },
  ];

  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored, original);

  restored.resources.wood++;
  restored.camps[0].needs[0].done = true;
  restored.boat.x++;
  assert.equal(original.resources.wood, 9);
  assert.equal(original.camps[0].needs[0].done, false);
  assert.equal(original.boat.x, east.launch.x);
});

// Guards the strict loader: each broken save below must be refused.
test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);

  for (const edit of [
    (g) => (g.version = 100),
    (g) => (g.version = 2),
    (g) => (g.version = 3), // a version 3 label on a save with no `collected` list
    (g) => (g.version = 4), // a version 4 label on fog already sized for the bigger map
    (g) => (g.landmarks = [5]),
    (g) => (g.landmarks = ['h-oak', 'h-oak']),
    (g) => (g.waypoints = undefined),
    (g) => (g.discovered = ['scout']),
    (g) => (g.character = 'ghost'),
    (g) => (g.player.x = -100),
    (g) => (g.resources.wood = -5),
    (g) => (g.player.y = null),
    (g) => (g.resources.herbs = 1.5),
    (g) => (g.regrowAt = []),
    (g) => (g.regrowAt = { [flowers[0].id]: -1 }),
    (g) => (g.time = -1),
    (g) => (g.time = undefined),
    (g) => (g.meters.health = 101),
    (g) => (g.meters.hunger = -1),
    (g) => (g.meters = undefined),
    (g) => (g.tea = TEA_SECONDS + 1),
    (g) => (g.fog = g.fog.slice(1)),
    (g) => (g.fog = 'x' + g.fog.slice(1)),
    (g) => (g.tools = undefined),
    (g) => (g.tools = []),
    (g) => (g.tools = { saw: { tier: 'stone', uses: 1 } }),
    (g) => (g.tools = { axe: { tier: 'gold' } }),
    (g) => (g.tools = { axe: { tier: 'stone', uses: 0 } }),
    (g) => (g.tools = { axe: { tier: 'stone', uses: 1.5 } }),
    // An antler grip can take a stone tool up to twice a new one's uses, and no further.
    (g) => (g.tools = { hammer: { tier: 'stone', uses: TOOL_USES.hammer * 2 + 1 } }),
    (g) => (g.torch = -1),
    (g) => (g.torch = 9999),
    (g) => (g.coat = 'yes'),
    (g) => (g.boat = { from: 'built', x: 100, y: 100, dir: 0 }), // a built boat with no home
    (g) => (g.resources.iron = -1),
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
    (g) => (g.wrecks = 'wreck-east'),
    (g) => (g.wrecks = undefined),
    (g) => (g.boat = undefined),
    (g) => (g.boat = { from: 7, x: east.launch.x, y: east.launch.y, dir: 2 }),
    (g) => (g.boat = { from: 'wreck-east', x: east.launch.x, y: east.launch.y, dir: 7 }),
    (g) => (g.boat = { from: 'wreck-east', x: NaN, y: east.launch.y, dir: 2 }),
    (g) => (g.aboard = 'yes'),
    (g) => (g.aboard = true),
    (g) => Object.assign(g.player, east.launch),
  ]) {
    const game = createGame('survivor');
    edit(game);
    assert.equal(restoreGame(JSON.stringify(game)), null, edit.toString());
  }
});

// Guards regrow timers on load: a normal timer is kept, a timer set absurdly far ahead is cut
// down to one regrow time, and a timer for a patch the map no longer has is dropped.
test('saved regrowth timers are kept, capped at one regrow, or dropped when the patch is gone', () => {
  const game = createGame('scout'),
    [a, b] = flowers;
  game.time = 100;
  game.regrowAt = { [a.id]: 150, [b.id]: 1e9, 'flowers-1-1': 120, 'pine-wood': 1e9 };

  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, {
    [a.id]: 150,
    [b.id]: 100 + b.regrow,
    'pine-wood': 100 + SUPPLY_REGROW,
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

// Guards the fog re-indexing: the sea border must be a whole number of fog squares, or the old
// squares would land between new ones.
test('the sea border is a whole number of fog squares', () => {
  assert.ok(Number.isInteger(BORDER_SQUARES));
  assert.equal(BORDER_SQUARES * FOG_CELL, SEA_BORDER);
});

// Guards players' oldest saves: version 3 progress must survive both upgrades (the survival
// update and the sea border) instead of being wiped.
test('a version 3 save is upgraded to the morning of day 1 on the bigger map, keeping progress and timers', () => {
  const flower = flowers[0];
  const builder = createGame('builder');
  const game = restoreGame(
    v3Save({
      elapsed: 500,
      regrowAt: { [`flowers-${flower.x - SEA_BORDER}-${flower.y - SEA_BORDER}`]: 560 },
      collected: ['pine-wood'],
      discovered: ['pinefall'],
      landmarks: ['h-square'],
    }),
  );

  assert.equal(game.version, SAVE_VERSION);
  assert.equal(game.time, START_TIME);
  assert.equal(game.elapsed, 500);
  assert.deepEqual(game.player, builder.player);
  assert.deepEqual(game.regrowAt, {
    [flower.id]: START_TIME + 60,
    'pine-wood': START_TIME + SUPPLY_REGROW,
  });
  assert.deepEqual(game.landmarks, ['h-square']);
  assert.deepEqual(game.meters, { health: 100, hunger: 100, warmth: 100 });
  assert.deepEqual(game.camps, []);
  assert.deepEqual([game.wrecks, game.boat, game.aboard], [[], null, false]);
  assert.equal(game.collected, undefined);

  // The fog lifts over the region entered and around the player, but not over the new sea border.
  const pinefall = REGIONS.find((r) => r.id === 'pinefall');
  assert.ok(isRevealed(game, pinefall.x, pinefall.y));
  assert.ok(isRevealed(game, game.player.x, game.player.y));
  const border = [];
  for (let cy = 0; cy < FOG_GRID.rows; cy++)
    for (let cx = 0; cx < FOG_GRID.cols; cx++) {
      const x = (cx + 0.5) * FOG_CELL,
        y = (cy + 0.5) * FOG_CELL;
      const inBorder = cx < BORDER_SQUARES || cy < BORDER_SQUARES;
      if (inBorder && regionOf(x, y).id === 'pinefall') border.push([x, y]);
    }
  assert.ok(border.length > 0);
  for (const [x, y] of border) assert.equal(isRevealed(game, x, y), false, `${x},${y}`);
});

// Guards a version 3 player who stood where the new coast now cuts in: they go back to their
// start instead of losing the whole save.
test('a version 3 player whose spot is now sea starts again at their spawn, progress kept', () => {
  const save = JSON.parse(v3Save({ landmarks: ['l-beacon'] }));
  save.character = 'survivor';
  save.player = { x: 24000, y: 9000, direction: 2 }; // the old lagoon sea, still sea on the new map

  const restored = restoreGame(JSON.stringify(save));
  assert.deepEqual(restored.player, { ...createGame('survivor').player, direction: 2 });
  assert.deepEqual(restored.landmarks, ['l-beacon']);
});

// Guards the upgrade against letting a broken old save through.
test('a broken version 3 save is still refused', () => {
  for (const changes of [
    { collected: ['unknown'] },
    { collected: [flowers[0].id] },
    { collected: undefined },
    { regrowAt: [] },
    { regrowAt: { [flowers[0].id]: -1 } },
    { player: undefined },
  ])
    assert.equal(restoreGame(v3Save(changes)), null, JSON.stringify(changes));
});

// Guards the upgrades against a player with no usable position (JSON turns NaN into null):
// the old labels must not smuggle one into a new game.
test('version 3 and version 4 saves with a broken player position are refused', () => {
  const broken = { x: NaN, y: NaN, direction: 0 };
  assert.equal(restoreGame(v3Save({ player: broken })), null);
  assert.equal(restoreGame(v4Save({ player: broken })), null);
});

// Guards survival-update saves: the player, every camp, the regrow timers and the fog move out by
// the sea border together, so a camp and the fog around it still line up with the land.
test('a version 4 save moves onto the bigger map: player, camps, timers and fog shift by the sea border', () => {
  const builder = createGame('builder'),
    camp = campAt(builder),
    flower = flowers[0];
  const square = [
    Math.floor((camp.x - SEA_BORDER) / FOG_CELL),
    Math.floor((camp.y - SEA_BORDER) / FOG_CELL),
  ];
  const old = v4Save({
    time: 400,
    elapsed: 380,
    meters: { health: 80, hunger: 60, warmth: 40 },
    tea: 5,
    regrowAt: {
      [`flowers-${flower.x - SEA_BORDER}-${flower.y - SEA_BORDER}`]: 500,
      'pine-wood': 900,
    },
    camps: [before(camp)],
    discovered: ['meadows'],
    landmarks: ['h-square'],
    fog: oldFog([[0, 0], square]),
  });

  const game = restoreGame(JSON.stringify(old));
  assert.equal(game.version, SAVE_VERSION);
  assert.deepEqual(game.player, builder.player);
  assert.deepEqual(game.camps, [camp]);
  assert.deepEqual(game.regrowAt, { [flower.id]: 500, 'pine-wood': 900 });
  assert.deepEqual([game.time, game.elapsed, game.tea], [400, 380, 5]);
  assert.deepEqual(game.meters, { health: 80, hunger: 60, warmth: 40 });
  assert.deepEqual([game.discovered, game.landmarks], [['meadows'], ['h-square']]);
  assert.deepEqual([game.wrecks, game.boat, game.aboard], [[], null, false]);

  // Both seen squares land SEA_BORDER further in; the new sea squares stay unseen.
  assert.equal(seenCount(game), 2);
  assert.ok(isRevealed(game, SEA_BORDER + FOG_CELL / 2, SEA_BORDER + FOG_CELL / 2));
  assert.ok(isRevealed(game, camp.x, camp.y));
  assert.equal(isRevealed(game, FOG_CELL / 2, FOG_CELL / 2), false);
});

// Guards a version 4 save with a player or camp where the new coast now cuts in: the player goes
// back to their start and that camp is left behind, but the rest of the adventure loads.
test('a version 4 player now in the sea goes to their spawn, and a camp now in the sea is dropped', () => {
  const builder = createGame('builder'),
    camp = campAt(builder);
  const sunk = { ...camp, id: 'camp-2', name: 'Sunk Camp', x: 24000, y: 9000 }; // still sea on the new map
  const game = restoreGame(
    JSON.stringify(
      v4Save({ player: { x: 24000, y: 9000, direction: 1 }, camps: [before(camp), sunk] }),
    ),
  );
  assert.deepEqual(game.player, { ...builder.player, direction: 1 });
  assert.deepEqual(game.camps, [camp]);
});

// Guards the version 4 upgrade against letting a broken or mislabelled save through, including
// the never-released archipelago version 4 (boat fields but none of the survival fields).
test('a broken version 4 save, or one without the survival fields, is refused', () => {
  for (const changes of [
    { fog: createGame('builder').fog }, // fog already sized for the bigger map
    { fog: undefined },
    { camps: {} },
    { camps: [{ ...campAt(createGame('builder')), name: '' }] },
    { meters: undefined },
    { time: undefined },
    { regrowAt: { [flowers[0].id]: -1 } },
  ])
    assert.equal(restoreGame(JSON.stringify(v4Save(changes))), null, JSON.stringify(changes));

  const archipelago = {
    version: 4,
    character: 'builder',
    player: createGame('builder').player,
    resources: createGame('builder').resources,
    collected: [],
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    wrecks: [],
    boat: null,
    aboard: false,
    elapsed: 0,
    distance: 0,
  };
  assert.equal(restoreGame(JSON.stringify(archipelago)), null);
});

// Guards the supply list the upgrades lean on: no fixed supply id ends in a position, so moving
// wild patch ids out by the sea border never renames a supply's timer by mistake.
test('fixed supply ids never look like a map position', () => {
  for (const supply of SUPPLIES) assert.doesNotMatch(supply.id, /-\d+-\d+$/);
});

// Guards the starting kit: a new game holds the character's stone tools and an empty iron slot.
test('a new game starts with the kit tools and no iron', () => {
  assert.deepEqual(createGame('scout').tools, { axe: { tier: 'stone', uses: TOOL_USES.axe } });
  assert.deepEqual(createGame('builder').tools, {
    hammer: { tier: 'stone', uses: TOOL_USES.hammer },
  });
  assert.deepEqual(createGame('survivor').tools, {});
  assert.equal(createGame('scout').resources.iron, 0);
});

// Guards tools through a save: both tiers come back as they were, as fresh objects.
test('tools survive a save and load as fresh copies', () => {
  const game = createGame('scout');
  game.tools.pickaxe = { tier: 'iron' };
  game.tools.axe.uses = 7;
  const restored = restoreGame(serializeGame(game));
  assert.deepEqual(restored.tools, game.tools);
  restored.tools.axe.uses = 1;
  assert.equal(game.tools.axe.uses, 7);
});

// Guards archipelago saves: a version 5 adventure keeps its progress and gains an empty iron
// slot and the kit tools the character's card always promised.
test('a version 5 save gains iron and the character kit tools', () => {
  for (const id of ['scout', 'builder', 'survivor']) {
    const game = restoreGame(v5Save(id, { distance: 1234 }));
    assert.equal(game.version, SAVE_VERSION, id);
    assert.equal(game.distance, 1234, id);
    assert.equal(game.resources.iron, 0, id);
    assert.deepEqual(game.tools, startingTools(id), id);
  }
});

// Guards save size: timers that already ran out are dropped, since those nodes are back anyway.
test('regrowth timers that have run out are dropped on load', () => {
  const game = createGame('scout'),
    [a, b] = flowers;
  game.time = 500;
  game.regrowAt = { [a.id]: 400, [b.id]: 600 };
  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, { [b.id]: 600 });
});

// Guards loading a save made on a chopped tree's spot: it must load, not be thrown away.
test('a save made where a chopped tree stood still loads', () => {
  const tree = NODES.find(
    (n) =>
      n.inScenery && !isWalkable(n.x, n.y - 5) && isWalkable(n.x, n.y - 5, [], false, () => true),
  );
  const game = createGame('scout');
  Object.assign(game.player, { x: tree.x, y: tree.y - 5 });
  game.regrowAt[tree.id] = game.time + 100;
  assert.deepEqual(restoreGame(serializeGame(game))?.player, game.player);
});

// Guards saves made before the finds existed: a version 6 backpack has no feathers, pine cones or
// antlers, and must load with an empty slot for each instead of being thrown away.
test('a version 6 save gains empty slots for feathers, pine cones and antlers', () => {
  const game = createGame('builder');
  game.resources.wood = 9;
  const { feather, pinecone, antler, ...resources } = game.resources;
  const old = JSON.stringify({ ...game, version: 6, resources });

  const loaded = restoreGame(old, 'builder');
  assert.equal(loaded.version, SAVE_VERSION);
  assert.deepEqual(
    [
      loaded.resources.wood,
      loaded.resources.feather,
      loaded.resources.pinecone,
      loaded.resources.antler,
    ],
    [9, 0, 0, 0],
  );
  assert.deepEqual(loaded.tools, game.tools);
});

// Guards saves made before gear existed: a version 7 save has no torch or coat, and must load with
// the torch unlit and the coat not worn instead of being thrown away.
test('a version 7 save gains an unlit torch and no coat', () => {
  const { torch, coat, ...game } = createGame('scout');
  game.resources.feather = 4;
  const loaded = restoreGame(JSON.stringify({ ...game, version: 7 }), 'scout');
  assert.equal(loaded.version, SAVE_VERSION);
  assert.deepEqual([loaded.torch, loaded.coat, loaded.resources.feather], [0, false, 4]);
});

// Guards saves made before copper existed: a version 8 save has no copper, and must load with an
// empty copper pocket and everything else kept.
test('a version 8 save gains an empty copper pocket', () => {
  const game = createGame('scout');
  delete game.resources.copper;
  game.resources.iron = 3;
  const loaded = restoreGame(JSON.stringify({ ...game, version: 8 }), 'scout');
  assert.equal(loaded.version, SAVE_VERSION);
  assert.deepEqual([loaded.resources.copper, loaded.resources.iron], [0, 3]);
});

// Guards saves made before camp buildings existed: a version 9 save's camps have none, and must
// load with an empty list instead of being thrown away.
test('a version 9 save gains an empty list of buildings at each camp', () => {
  const game = createGame('builder');
  const { buildings, ...camp } = campAt(game);
  const loaded = restoreGame(JSON.stringify({ ...game, version: 9, camps: [camp] }), 'builder');
  assert.equal(loaded.version, SAVE_VERSION);
  assert.deepEqual(loaded.camps[0].buildings, []);
});

// Guards camp buildings in a save: a building of an unknown kind, a chest holding something that
// is not a resource, or two buildings sharing an id make the save unreadable, not half-loaded.
test('a save with a broken camp building is refused', () => {
  const game = createGame('builder');
  const camp = campAt(game);
  const spot = { x: game.player.x + 120, y: game.player.y };
  for (const buildings of [
    [{ id: 'b-1', kind: 'castle', ...spot }],
    [{ id: 'b-1', kind: 'chest', ...spot, contents: { gold: 3 } }],
    [
      { id: 'b-1', kind: 'tent', ...spot },
      { id: 'b-1', kind: 'chest', ...spot, contents: {} },
    ],
  ])
    assert.equal(restoreGame(JSON.stringify({ ...game, camps: [{ ...camp, buildings }] })), null);
});

// Guards saves against the world editor: deleting or renaming one place must not throw away
// a whole save that had found it. The stale id is dropped and everything else is kept.
test('a save that found a place the map no longer has loads without that place', () => {
  const game = createGame('builder');
  game.landmarks = ['h-oak', 'gone-landmark'];
  game.waypoints = ['gone-signpost'];
  game.wrecks = ['wreck-east', 'gone-boat'];

  const back = restoreGame(serializeGame(game));

  assert.deepEqual(back.landmarks, ['h-oak']);
  assert.deepEqual(back.waypoints, []);
  assert.deepEqual(back.wrecks, ['wreck-east']);
});

// Guards the rowboat of a deleted old boat: it has no launch spot to drift back to, so it is
// removed, and a player who was sitting in it wakes at their start instead of in the sea.
test('a boat from an old boat the map no longer has is removed, and its rower goes to spawn', () => {
  const moored = createGame('survivor');
  moored.boat = { from: 'gone-boat', x: east.launch.x, y: east.launch.y, dir: 2 };
  const onFoot = restoreGame(serializeGame(moored));
  assert.deepEqual([onFoot.boat, onFoot.aboard], [null, false]);
  assert.deepEqual([onFoot.player.x, onFoot.player.y], [moored.player.x, moored.player.y]);

  const rowing = createGame('survivor');
  const spawn = { x: rowing.player.x, y: rowing.player.y };
  rowing.boat = { from: 'gone-boat', x: east.launch.x, y: east.launch.y, dir: 2 };
  rowing.aboard = true;
  Object.assign(rowing.player, east.launch);
  const ashore = restoreGame(serializeGame(rowing));
  assert.deepEqual([ashore.boat, ashore.aboard], [null, false]);
  assert.deepEqual([ashore.player.x, ashore.player.y], [spawn.x, spawn.y]);
});
