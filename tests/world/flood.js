// A helper for the world tests: spreads over the map like spilled paint to find out what can be
// reached, on foot or by boat. It is not a test file itself (Node's runner only runs *.test.js),
// so importing it doesn't run any tests twice.

import { WORLD } from '../../src/world/map.js';

/**
 * Spreads outward from one spot over a 24-unit grid, like spilled paint, through every cell that
 * `open` allows.
 *
 * @param {number} x - Where to start, in world units.
 * @param {number} y - Where to start, in world units.
 * @param {Function} open - `(x, y) => boolean`: whether paint may cover the cell centred there.
 * @returns {{reached: Function, cells: number[][]}} `reached(x, y, range)` says whether painted
 *   ground lies within `range` units of a point; `cells` lists each painted cell's centre as [x, y].
 */
export function flood(x, y, open) {
  const STEP = 24,
    cols = Math.ceil(WORLD.width / STEP),
    rows = Math.ceil(WORLD.height / STEP),
    seen = new Uint8Array(cols * rows);
  const start = Math.floor(y / STEP) * cols + Math.floor(x / STEP);
  const stack = [start];
  seen[start] = 1;

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
      if (!open(nx * STEP + STEP / 2, ny * STEP + STEP / 2)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }

  /** True if any painted cell lies within `range` units of the point. */
  const reached = (px, py, range) => {
    const r = Math.ceil(range / STEP);
    for (let cy = Math.floor(py / STEP) - r; cy <= Math.floor(py / STEP) + r; cy++)
      for (let cx = Math.floor(px / STEP) - r; cx <= Math.floor(px / STEP) + r; cx++)
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows && seen[cy * cols + cx]) return true;
    return false;
  };

  // The centre of every painted cell, for checks that need to look at each one.
  const cells = [];
  for (let i = 0; i < seen.length; i++)
    if (seen[i]) cells.push([(i % cols) * STEP + STEP / 2, Math.floor(i / cols) * STEP + STEP / 2]);
  return { reached, cells };
}
