// The seven named regions of the world, and which one a spot is in.
// tools/build-map.py decides the borders and stores them in the map file as a grid of big squares,
// one digit per square; each digit is a region's place in the list in assets/world/source/places.json.

import { REGION_LIST } from '../data/places.js';
import { mapProperty } from './map.js';

const cell = mapProperty('regionCell'),
  cols = mapProperty('regionCols'),
  grid = mapProperty('regionGrid'),
  rows = grid.length / cols;

/** The size of the region grid: `cell` is a square's width in world units. */
export const REGION_GRID = { cell, cols, rows };

/**
 * Says which region one square of the grid belongs to.
 *
 * @param {number} cx - The square's column, from 0.
 * @param {number} cy - The square's row, from 0.
 * @returns {number} The region's index in `REGIONS`.
 */
export const regionIndexAt = (cx, cy) => Number(grid[cy * cols + cx]);

// A label on the world map needs one spot per region. The average of a region's squares can fall
// outside an L-shaped region, so the label goes on the region's own square nearest that average.
const centreOf = (index) => {
  const squares = [];
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) if (regionIndexAt(cx, cy) === index) squares.push([cx, cy]);
  const ax = squares.reduce((sum, s) => sum + s[0], 0) / squares.length,
    ay = squares.reduce((sum, s) => sum + s[1], 0) / squares.length;
  const [cx, cy] = squares.reduce((best, s) =>
    Math.hypot(s[0] - ax, s[1] - ay) < Math.hypot(best[0] - ax, best[1] - ay) ? s : best,
  );
  return { x: (cx + 0.5) * cell, y: (cy + 0.5) * cell };
};

/** Every region. Fields: `id` (the save key), `name` (shown on screen), `x`/`y` (its label spot). */
export const REGIONS = REGION_LIST.map(({ id, name }, index) => ({ id, name, ...centreOf(index) }));

/**
 * Finds the region a spot is in. Every spot in the world is in exactly one.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {{id: string, name: string, x: number, y: number}} The region.
 */
export function regionOf(x, y) {
  const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / cell))),
    cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cell)));
  return REGIONS[regionIndexAt(cx, cy)];
}

/**
 * Gives the name of the region the player is standing in, for the title at the top of the screen.
 *
 * @param {{x: number, y: number}} player - The player's position.
 * @returns {string} The region's name.
 */
export const regionAt = (player) => regionOf(player.x, player.y).name;
