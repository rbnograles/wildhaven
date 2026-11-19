// Checks the fog of war: which squares of the world a character has seen, and how that is packed
// into the save. A mistake here would hide places the player walked through, or reveal the whole
// map for free (which works against the GDD's first pillar, "the world is the reward").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOG_CELL, FOG_RADIUS } from '../../src/data/balance.js';
import { WORLD } from '../../src/world/map.js';
import { REGIONS } from '../../src/world/regions.js';
import {
  FOG_GRID,
  FOG_LENGTH,
  emptyFog,
  isFogString,
  fogCells,
  isRevealed,
  revealAround,
  revealRegions,
  growFog,
} from '../../src/world/fog.js';

/** A tiny stand-in for a game state that only has the fog field. */
const blank = () => ({ fog: emptyFog() });

// Guards the grid following the map, so a bigger map gets a bigger fog grid by itself.
test('the fog grid covers the whole world, four squares per letter', () => {
  assert.equal(FOG_GRID.cols, Math.ceil(WORLD.width / FOG_CELL));
  assert.equal(FOG_GRID.rows, Math.ceil(WORLD.height / FOG_CELL));
  assert.equal(FOG_LENGTH, Math.ceil((FOG_GRID.cols * FOG_GRID.rows) / 4));
  assert.ok(isFogString(emptyFog()));
  assert.equal(
    fogCells(emptyFog()).some((seen) => seen),
    false,
  );
});

// Guards the save check: fog of the wrong length or with odd letters must be refused.
test('only a hex string of the exact length counts as fog', () => {
  assert.equal(isFogString('0'.repeat(FOG_LENGTH - 1)), false);
  assert.equal(isFogString('g' + '0'.repeat(FOG_LENGTH - 1)), false);
  assert.equal(isFogString(null), false);
  assert.equal(isFogString('f'.repeat(FOG_LENGTH)), true);
});

// Guards the reveal circle: the square underfoot and squares inside the radius are seen; squares
// well outside it are not, and revealing the same spot twice uncovers nothing new.
test('walking reveals the squares within the fog radius and no others', () => {
  const state = blank(),
    x = 5000,
    y = 5000;
  assert.equal(revealAround(state, x, y), true);
  assert.ok(isRevealed(state, x, y));
  assert.ok(isRevealed(state, x + FOG_RADIUS - FOG_CELL, y));
  assert.equal(isRevealed(state, x + FOG_RADIUS + 2 * FOG_CELL, y), false);
  assert.equal(isRevealed(state, x, y - FOG_RADIUS - 2 * FOG_CELL), false);
  assert.equal(revealAround(state, x, y), false);
});

// Guards the packing: each letter holds four squares, lowest bit first, in reading order.
test('each fog letter holds four squares, lowest bit first', () => {
  const cells = fogCells('9' + '0'.repeat(FOG_LENGTH - 1)); // 9 is binary 1001
  assert.deepEqual([...cells.slice(0, 5)], [1, 0, 0, 1, 0]);

  const state = blank();
  revealAround(state, FOG_CELL / 2, FOG_CELL / 2, 1); // only the very first square
  assert.equal(state.fog[0], '1');
  assert.equal(state.fog.slice(1), '0'.repeat(FOG_LENGTH - 1));
});

// Guards the save upgrade: an old save's regions are uncovered in full, and only those.
test('revealing regions uncovers every square whose middle lies in them', () => {
  const state = blank(),
    [first, second] = REGIONS;
  revealRegions(state, [first.id]);
  assert.ok(isRevealed(state, first.x, first.y));
  assert.equal(isRevealed(state, second.x, second.y), false);
});

// Guards the margin used when an old save is upgraded: squares near the world's edge stay covered
// even inside a region that was entered, and everything further in is uncovered as before.
test('revealing regions can leave a margin along the world edge covered', () => {
  const all = REGIONS.map((r) => r.id);
  const state = blank();
  revealRegions(state, all, 2 * FOG_CELL);
  assert.equal(isRevealed(state, FOG_CELL / 2, FOG_CELL / 2), false);
  assert.equal(isRevealed(state, FOG_CELL * 1.5, WORLD.height / 2), false);
  assert.ok(isRevealed(state, FOG_CELL * 2.5, WORLD.height / 2));
  assert.ok(isRevealed(state, WORLD.width / 2, WORLD.height / 2));
});

// Guards moving fog from a smaller map onto this one: each seen square keeps its place on the land
// (moving `ring` squares right and down), the new edge squares start unseen, and fog that doesn't
// fit the smaller grid is refused.
test('growFog moves old fog into the middle of the bigger grid', () => {
  const ring = 2,
    cols = FOG_GRID.cols - 2 * ring,
    rows = FOG_GRID.rows - 2 * ring;
  const letters = new Array(Math.ceil((cols * rows) / 4)).fill('0');
  letters[0] = '1'; // the old top-left square
  const last = cols * rows - 1; // the old bottom-right square
  letters[last >> 2] = (1 << (last & 3)).toString(16);

  const state = { fog: growFog(letters.join(''), ring) };
  assert.ok(isFogString(state.fog));
  assert.equal(
    fogCells(state.fog).reduce((sum, seen) => sum + seen, 0),
    2,
  );
  assert.ok(isRevealed(state, (ring + 0.5) * FOG_CELL, (ring + 0.5) * FOG_CELL));
  assert.ok(isRevealed(state, (ring + cols - 0.5) * FOG_CELL, (ring + rows - 0.5) * FOG_CELL));
  assert.equal(isRevealed(state, FOG_CELL / 2, FOG_CELL / 2), false);

  assert.equal(growFog(letters.join('').slice(1), ring), null);
  assert.equal(growFog(emptyFog(), ring), null);
  assert.equal(growFog(letters.join(''), 1.5), null);
  assert.equal(growFog(undefined, ring), null);
  assert.equal(growFog(emptyFog(), 0), emptyFog());
});
