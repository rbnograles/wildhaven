// Checks the hills: raised levels of ground with cliff walls, climbed by stairs. If these rules
// break, the player could walk through a cliff, step straight up a ledge, or see a hill top they
// can never reach.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, CLIFF_GAP, elevationAt, isWalkable, mapProperty } from '../../src/world/map.js';
import { SPAWNS } from '../../src/data/places.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

/** The map's tile size and its width and height in tiles. */
const TILE = 64,
  COLS = WORLD.width / TILE,
  ROWS = WORLD.height / TILE;

/** One elevation letter per tile, row by row ('0'-'3' level, 'w' wall, 's' stairs). */
const ELEVATION = mapProperty('elevation');

// Spring Country is flat: no raised levels, walls or stairs. The hill tests below only apply to a map
// that has hills, so they bow out early when the whole map is level 0.
const FLAT = !/[1-3ws]/.test(ELEVATION);

/** Reads the elevation letter of the tile in column c, row r. */
const letter = (c, r) => ELEVATION[r * COLS + c];

/**
 * Lists every tile with one elevation letter.
 *
 * @param {string} wanted - The letter, such as 'w' for walls.
 * @returns {number[][]} The tiles as [column, row] pairs.
 */
const tilesOf = (wanted) => {
  const found = [];
  for (let i = 0; i < ELEVATION.length; i++)
    if (ELEVATION[i] === wanted) found.push([i % COLS, Math.floor(i / COLS)]);
  return found;
};

/**
 * Finds each flight of stairs by its top-left tile: a stairs tile with no stairs to its left or above.
 *
 * @returns {number[][]} One [column, row] pair per flight.
 */
const flights = () =>
  tilesOf('s').filter(([c, r]) => letter(c - 1, r) !== 's' && letter(c, r - 1) !== 's');

/**
 * Walks a fresh game's player in one direction for a while, like holding an arrow key down.
 *
 * @param {number} x - Where the walk starts (world x).
 * @param {number} y - Where the walk starts (world y).
 * @param {number} dy - -1 to walk north, 1 to walk south.
 * @returns {object} The player after the walk: its `x` and `y`.
 */
const walk = (x, y, dy) => {
  const game = createGame('builder');
  game.player.x = x;
  game.player.y = y;
  for (let i = 0; i < 120; i++) movePlayer(game, 0, dy, 0.05);
  return game.player;
};

// Guards the grid the collision reads: wrong length or a stray letter would put walls in the wrong
// place, and a map with no hills would mean the map builder silently dropped them.
test('the elevation grid covers the map with known letters, and the map has hills', () => {
  assert.equal(ELEVATION.length, COLS * ROWS);
  assert.match(ELEVATION, /^[0-3ws]+$/);
  if (FLAT) return;
  for (const wanted of ['1', '2', 'w', 's']) assert.ok(ELEVATION.includes(wanted), wanted);
  assert.ok(flights().length >= 10, 'expected at least ten flights of stairs');
});

// Guards against a cliff wall the player can walk through.
test('no spot on a cliff wall can be stood on', () => {
  for (const [c, r] of tilesOf('w'))
    for (const [u, v] of [
      [0.5, 0.5],
      [0.05, 0.05],
      [0.95, 0.95],
      [0.05, 0.95],
      [0.95, 0.05],
    ])
      assert.equal(isWalkable((c + u) * TILE, (r + v) * TILE), false, `wall at ${c},${r}`);
});

// Guards the low edges (north, west and east): stepping straight from one level to another must be
// blocked on both sides of the edge, or the player could hop onto a hill without the stairs.
test('the edge between two levels blocks the player on both sides', () => {
  if (FLAT) return;
  let edges = 0;
  for (let r = 0; r < ROWS - 1; r++)
    for (let c = 0; c < COLS - 1; c++) {
      const here = letter(c, r);
      if ('ws'.includes(here)) continue;
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
      ]) {
        const next = letter(c + dc, r + dr);
        if (next === here || 'ws'.includes(next)) continue;
        edges++;
        // The edge line runs between the two tiles; test points just either side of it.
        const lineX = (c + dc) * TILE,
          lineY = (r + dr) * TILE;
        for (const off of [-CLIFF_GAP + 2, -1, 1, CLIFF_GAP - 2]) {
          const x = dc ? lineX + off : (c + 0.5) * TILE,
            y = dr ? lineY + off : (r + 0.5) * TILE;
          assert.equal(isWalkable(x, y), false, `edge near ${c},${r} at ${x},${y}`);
        }
      }
    }
  assert.ok(edges > 100, 'expected many level edges');
});

// Guards the only way up: walking north from the foot of any flight of stairs must end at least on
// the level above (a long walk may climb the next flight too, when two line up), while walking
// north into the plain wall beside it stops at the bottom.
test('stairs climb to the level above, and the wall beside them does not', () => {
  for (const [c, r] of flights()) {
    const above = letter(c, r - 1),
      below = letter(c, r + 2);
    const climber = walk((c + 1) * TILE, (r + 2.5) * TILE, -1);
    assert.ok(Number(elevationAt(climber.x, climber.y)) >= Number(above), `stairs at ${c},${r}`);
    assert.ok(climber.y < r * TILE, `stairs at ${c},${r}: the climb should end above the wall`);

    const blocked = walk((c - 0.5) * TILE, (r + 2.5) * TILE, -1);
    assert.equal(elevationAt(blocked.x, blocked.y), below, `wall beside stairs at ${c},${r}`);
  }
});

// Guards the promise that every hill can be climbed: each raised level of each hill (a group of
// touching tiles of one level) must be reachable on foot from the builder's start.
test('every level of every hill can be reached on foot', () => {
  if (FLAT) return;
  // Flood outward from the builder's start on a 32-unit grid, like water spreading over the land.
  const STEP = 32,
    cols = WORLD.width / STEP,
    rows = WORLD.height / STEP,
    seen = new Uint8Array(cols * rows);
  const stack = [Math.floor(SPAWNS.builder.y / STEP) * cols + Math.floor(SPAWNS.builder.x / STEP)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop(),
      cx = i % cols,
      cy = (i - cx) / cols;
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      const n = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[n]) continue;
      if (!isWalkable(nx * STEP + STEP / 2, ny * STEP + STEP / 2)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }

  // Group the raised tiles into levels of hills, then look for a flooded spot on each group.
  const grouped = new Uint8Array(ELEVATION.length);
  let groups = 0;
  for (let start = 0; start < ELEVATION.length; start++) {
    if (grouped[start] || !'123'.includes(ELEVATION[start])) continue;
    groups++;
    let reached = false;
    const todo = [start];
    grouped[start] = 1;
    while (todo.length) {
      const i = todo.pop(),
        c = i % COLS,
        r = (i - c) / COLS;
      for (let y = r * 2; y < r * 2 + 2; y++)
        for (let x = c * 2; x < c * 2 + 2; x++) if (seen[y * cols + x]) reached = true;
      for (const [nc, nr] of [
        [c + 1, r],
        [c - 1, r],
        [c, r + 1],
        [c, r - 1],
      ]) {
        const n = nr * COLS + nc;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || grouped[n]) continue;
        if (ELEVATION[n] !== ELEVATION[i]) continue;
        grouped[n] = 1;
        todo.push(n);
      }
    }
    assert.ok(
      reached,
      `the level-${ELEVATION[start]} ground at tile ${start % COLS},${Math.floor(start / COLS)} cannot be reached`,
    );
  }
  assert.ok(groups >= 10, 'expected at least ten raised levels');
});

// Guards old saves: a save made where a hill now stands must still load, and the player must be
// able to walk off the cliff instead of being stuck inside it.
test('a save standing inside a cliff wall still loads, and the player can walk off it', () => {
  if (FLAT) return;
  const [c, r] = tilesOf('w').find(([wc, wr]) => letter(wc, wr - 1) !== 'w'); // a wall's top row
  const game = createGame('builder');
  game.player.x = (c + 0.5) * TILE;
  game.player.y = (r + 0.5) * TILE;

  const loaded = restoreGame(serializeGame(game));
  assert.ok(loaded, 'the save should load');
  const after = walk(loaded.player.x, loaded.player.y, 1);
  assert.ok(isWalkable(after.x, after.y), 'the player should end up on open ground');
});
