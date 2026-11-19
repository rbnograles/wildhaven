// The fog of war: which parts of the world this character has seen. The world is cut into
// squares FOG_CELL units wide, and each square is either seen or not, like a scratch card whose
// silver comes off where you have walked. The save keeps the squares as hex letters, four per letter.

import { FOG_CELL, FOG_RADIUS } from '../data/balance.js';
import { WORLD } from './map.js';
import { regionOf } from './regions.js';

/** How many fog squares fit across (`cols`) and down (`rows`) the world. It grows with the map. */
export const FOG_GRID = {
  cols: Math.ceil(WORLD.width / FOG_CELL),
  rows: Math.ceil(WORLD.height / FOG_CELL),
};

/** How many hex letters a fog string has: one letter holds four squares. */
export const FOG_LENGTH = Math.ceil((FOG_GRID.cols * FOG_GRID.rows) / 4);

/**
 * Makes the fog for a brand-new game: nothing seen yet.
 *
 * @returns {string} A fog string of all zeros.
 */
export const emptyFog = () => '0'.repeat(FOG_LENGTH);

/**
 * Checks that a saved value really is fog: a string of the right length, made only of hex letters.
 *
 * @param {*} fog - The value read from a save.
 * @returns {boolean} True if it can be used as fog.
 */
export const isFogString = (fog) =>
  typeof fog === 'string' && fog.length === FOG_LENGTH && /^[0-9a-f]*$/.test(fog);

// Unpacking the letters on every frame would be slow, so the last fog string unpacked is kept
// with its squares, like keeping a book open at the page you last read.
let last = { fog: '', cells: new Uint8Array(0) };

/**
 * Unpacks a fog string into one number per square: 1 for seen, 0 for not yet.
 *
 * Squares are numbered row by row from the top-left. Letter n holds squares 4n to 4n + 3, and
 * the lowest bit of the letter is the first of them.
 *
 * @param {string} fog - A fog string.
 * @returns {Uint8Array} One entry per square. Only read it: it is shared with later calls.
 */
export function fogCells(fog) {
  if (last.fog === fog) return last.cells;
  const cells = new Uint8Array(FOG_GRID.cols * FOG_GRID.rows);
  for (let i = 0; i < cells.length; i++) cells[i] = (parseInt(fog[i >> 2], 16) >> (i & 3)) & 1;
  last = { fog, cells };
  return cells;
}

/**
 * Packs one number per square back into a fog string (the opposite of `fogCells`).
 *
 * @param {Uint8Array} cells - 1 for each seen square, 0 for the rest.
 * @returns {string} The fog string.
 */
function packFog(cells) {
  let fog = '';
  for (let i = 0; i < FOG_LENGTH; i++) {
    let letter = 0;
    for (let bit = 0; bit < 4; bit++) letter |= (cells[i * 4 + bit] ?? 0) << bit;
    fog += letter.toString(16);
  }
  return fog;
}

/**
 * Finds the number of the fog square a world spot falls in.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} The square's number, or -1 if the spot is outside the world.
 */
function cellAt(x, y) {
  const cx = Math.floor(x / FOG_CELL),
    cy = Math.floor(y / FOG_CELL);
  if (cx < 0 || cy < 0 || cx >= FOG_GRID.cols || cy >= FOG_GRID.rows) return -1;
  return cy * FOG_GRID.cols + cx;
}

/**
 * Says whether the player has seen the square a spot is in.
 *
 * @param {object} state - Anything with a `fog` string, usually the game state.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if that square has been seen.
 */
export function isRevealed(state, x, y) {
  const i = cellAt(x, y);
  return i >= 0 && fogCells(state.fog)[i] === 1;
}

/**
 * Uncovers every square whose middle is within `radius` of a spot.
 *
 * The game loop calls this every frame with the player's position. Most frames uncover nothing
 * new, and then the fog string is left alone, so it stays cheap.
 *
 * @param {object} state - Anything with a `fog` string. Its `fog` is replaced when squares are uncovered.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number} [radius=FOG_RADIUS] - How far around the spot to uncover, in world units.
 * @returns {boolean} True if any square was newly uncovered.
 */
export function revealAround(state, x, y, radius = FOG_RADIUS) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const cells = fogCells(state.fog);
  let next = null;

  // Only squares inside the circle's bounding box can be inside the circle.
  const c0 = Math.max(0, Math.floor((x - radius) / FOG_CELL)),
    c1 = Math.min(FOG_GRID.cols - 1, Math.floor((x + radius) / FOG_CELL)),
    r0 = Math.max(0, Math.floor((y - radius) / FOG_CELL)),
    r1 = Math.min(FOG_GRID.rows - 1, Math.floor((y + radius) / FOG_CELL));
  for (let cy = r0; cy <= r1; cy++)
    for (let cx = c0; cx <= c1; cx++) {
      const i = cy * FOG_GRID.cols + cx;
      const away = Math.hypot((cx + 0.5) * FOG_CELL - x, (cy + 0.5) * FOG_CELL - y);
      if (cells[i] || away > radius) continue;
      next ??= cells.slice();
      next[i] = 1;
    }

  if (!next) return false;
  state.fog = packFog(next);
  last = { fog: state.fog, cells: next };
  return true;
}

/**
 * Uncovers every square whose middle lies in one of the given regions.
 *
 * Used when an old save is upgraded: it knew which regions were visited, not where the player walked.
 *
 * @param {object} state - Anything with a `fog` string. Its `fog` is replaced.
 * @param {string[]} regionIds - The ids of the regions to uncover.
 */
export function revealRegions(state, regionIds) {
  const cells = fogCells(state.fog).slice();
  for (let cy = 0; cy < FOG_GRID.rows; cy++)
    for (let cx = 0; cx < FOG_GRID.cols; cx++)
      if (regionIds.includes(regionOf((cx + 0.5) * FOG_CELL, (cy + 0.5) * FOG_CELL).id))
        cells[cy * FOG_GRID.cols + cx] = 1;
  state.fog = packFog(cells);
  last = { fog: state.fog, cells };
}
