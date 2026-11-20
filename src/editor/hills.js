// The world editor's hills: which map tiles have been raised or lowered by hand, and which
// flights of stairs were added or removed. tools/build-map.py lays these over the hills it
// generates, then draws the walls, the cliff tiles and the collision from the result. This file
// changes levels, toggles stairs, checks the shapes and packs the levels into runs for
// terrain.json. It knows nothing about the page.

import { remember } from './model.js';

/** The cliff art a hill can be drawn with, in the map build's order. */
export const KITS = ['meadow', 'canyon', 'snow'];

/** The highest level a tile can have. Level 0 is flat ground. */
export const MAX_LEVEL = 3;

/** A wall hangs this many tiles south of every south edge (the same 2 as in build-map.py). */
export const WALL_ROWS = 2;

/** Makes the hills part of a terrain with nothing in it. */
export const emptyHills = () => ({ levels: {}, stairs: { added: [], removed: [] } });

/** Says whether two flights of stairs are the same: `[leftColumn, edgeRow]`. */
const sameFlight = (a, b) => a[0] === b[0] && a[1] === b[1];

/**
 * Says how high a tile is: the hand-set level if there is one, else the generated one.
 *
 * @param {object} terrain - The terrain being edited (its `levels` map 'row,col' to `[level, kit]`).
 * @param {{levelAt: Function}} hills - The generated hills, from the last built map.
 * @param {number} row - The tile's row.
 * @param {number} col - The tile's column.
 * @returns {number} The level, 0 to 3.
 */
export function levelAt(terrain, hills, row, col) {
  return terrain.levels[`${row},${col}`]?.[0] ?? hills.levelAt(row, col);
}

/**
 * Raises or lowers the 2 by 2 block of tiles a tile is in, by one level.
 *
 * Hills are built from blocks of four tiles, lined up on even rows and columns, because the cliff
 * art needs every wall to be at least two tiles wide. Next-door blocks may differ by one level
 * only, like the steps of a staircase, so a change that would make a taller step is refused.
 * A tile set back to the level the map build generates needs no override and loses its entry.
 *
 * @param {object} editor - The editing session.
 * @param {number} col - The column of the tile under the pointer.
 * @param {number} row - The row of the tile under the pointer.
 * @param {number} delta - 1 to raise, -1 to lower.
 * @param {string} kit - The cliff art for ground raised from flat: one of `KITS`.
 * @param {object} hills - The generated hills: `rows`, `cols`, `levelAt(row, col)`, `kitAt(row, col)`.
 * @param {boolean} [record] - False for the later blocks of one drag, so the drag is one undo step.
 * @returns {string|null} Why nothing was changed, in plain words, or null when it was.
 */
export function changeLevel(editor, col, row, delta, kit, hills, record = true) {
  const { terrain } = editor;
  const c0 = col - (col % 2),
    r0 = row - (row % 2);
  const block = [
    [r0, c0],
    [r0, c0 + 1],
    [r0 + 1, c0],
    [r0 + 1, c0 + 1],
  ];
  if (r0 < 1 || c0 < 1 || r0 + 2 >= hills.rows || c0 + 2 >= hills.cols)
    return 'That is too close to the edge of the map.';

  // The whole block moves to one level: one step from its highest tile (raise) or lowest (lower).
  const now = block.map(([r, c]) => levelAt(terrain, hills, r, c));
  const target = delta > 0 ? Math.max(...now) + 1 : Math.min(...now) - 1;
  if (target > MAX_LEVEL) return `Level ${MAX_LEVEL} is the highest a hill can go.`;
  if (target < 0) return 'This ground is already flat.';

  // No neighbour, corner neighbours included, may end up more than one level away.
  for (let r = r0 - 1; r <= r0 + 2; r++)
    for (let c = c0 - 1; c <= c0 + 2; c++) {
      const inside = r >= r0 && r <= r0 + 1 && c >= c0 && c <= c0 + 1;
      if (!inside && Math.abs(levelAt(terrain, hills, r, c) - target) > 1)
        return delta > 0
          ? 'Raise the ground around it first: next-door boxes may differ by one level only.'
          : 'Lower the ground on top of it first: next-door boxes may differ by one level only.';
    }

  if (record) remember(editor);
  for (const [r, c] of block) {
    const key = `${r},${c}`;
    const keep = terrain.levels[key]?.[1] ?? hills.kitAt(r, c) ?? kit;
    if (target === hills.levelAt(r, c)) delete terrain.levels[key];
    else terrain.levels[key] = [target, keep];
  }
  return null;
}

/**
 * Lists the flights of stairs the map will have: the generated ones that were not removed,
 * plus the ones added by hand.
 *
 * @param {object} terrain - The terrain being edited.
 * @param {{flights: number[][]}} hills - The generated hills.
 * @returns {number[][]} Flights as `[leftColumn, edgeRow]`.
 */
export function flightsOf(terrain, hills) {
  const { added, removed } = terrain.stairs;
  return [...hills.flights.filter((f) => !removed.some((r) => sameFlight(r, f))), ...added];
}

/**
 * Says whether a flight of stairs can stand at a spot.
 *
 * A flight is two tiles wide. Both tiles of the plateau's last row must be one level above the
 * ground the stairs come down to, and that lower ground must run on for the two wall rows and
 * the landing in front of them.
 *
 * @param {object} terrain - The terrain being edited.
 * @param {object} hills - The generated hills.
 * @param {number} col - The flight's left column.
 * @param {number} row - The edge row: the plateau's last row above the wall.
 * @returns {boolean} True when stairs fit there.
 */
export function stairsFit(terrain, hills, col, row) {
  const top = levelAt(terrain, hills, row, col);
  if (top < 1 || levelAt(terrain, hills, row, col + 1) !== top) return false;

  for (let r = row + 1; r <= row + WALL_ROWS + 1; r++)
    for (const c of [col, col + 1]) if (levelAt(terrain, hills, r, c) !== top - 1) return false;
  return true;
}

/**
 * Adds a flight of stairs where the person clicked, or removes the flight that is there.
 *
 * The click may land on the plateau's edge or on the wall under it; the nearest edge above is
 * used. Removing a generated flight records it as removed; removing a hand-made one forgets it.
 *
 * @param {object} editor - The editing session.
 * @param {number} col - The column of the tile clicked.
 * @param {number} row - The row of the tile clicked.
 * @param {object} hills - The generated hills.
 * @returns {string|null} Why nothing was changed, or null when a flight was added or removed.
 */
export function toggleStairs(editor, col, row, hills) {
  const { terrain } = editor;
  const { added, removed } = terrain.stairs;

  // A click on an existing flight (its edge row or its wall rows) removes it.
  const old = flightsOf(terrain, hills).find(
    ([c, y]) => (col === c || col === c + 1) && row >= y && row <= y + WALL_ROWS,
  );
  if (old) {
    remember(editor);
    const mine = added.findIndex((f) => sameFlight(f, old));
    if (mine >= 0) added.splice(mine, 1);
    else removed.push(old);
    return null;
  }

  // Otherwise look for a south edge at the click or just above it, and stairs that fit there.
  for (let y = row; y >= row - WALL_ROWS; y--)
    for (const c of [col, col - 1]) {
      if (!stairsFit(terrain, hills, c, y)) continue;

      remember(editor);
      const back = removed.findIndex((f) => sameFlight(f, [c, y]));
      if (back >= 0) removed.splice(back, 1);
      else added.push([c, y]);
      return null;
    }

  return 'Stairs go on the south edge of a hill, two boxes wide, with flat lower ground below.';
}

/**
 * Works out which tiles the map does not show yet, and the level each will have.
 *
 * @param {object} levels - The level overrides now, 'row,col' to `[level, kit]`.
 * @param {object} built - The level overrides the map was last built with.
 * @param {{levelAt: Function}} hills - The generated hills.
 * @returns {object} 'row,col' to the level to preview, for the tiles that differ.
 */
export function pendingLevels(levels, built, hills) {
  const pending = {};
  for (const key of new Set([...Object.keys(levels), ...Object.keys(built)])) {
    const [row, col] = key.split(',').map(Number);
    const generated = hills.levelAt(row, col);
    const now = levels[key]?.[0] ?? generated;
    if (now !== (built[key]?.[0] ?? generated)) pending[key] = now;
  }
  return pending;
}

/**
 * Works out which stairs changes the map does not show yet.
 *
 * @param {{added: number[][], removed: number[][]}} stairs - The stairs changes now.
 * @param {{added: number[][], removed: number[][]}} built - The changes the map was built with.
 * @returns {{added: number[][], removed: number[][]}} The changes still to be built.
 */
export function pendingStairs(stairs, built) {
  /** Keeps the flights of one list that the other list does not have. */
  const fresh = (list, old) => list.filter((f) => !old.some((o) => sameFlight(o, f)));
  return { added: fresh(stairs.added, built.added), removed: fresh(stairs.removed, built.removed) };
}

/**
 * Looks over the hand-made hills and lists what would look or play wrong.
 *
 * These are warnings: the rebuild's tests are the real judge (a level nobody can reach fails
 * there). They catch the two things the cliff art can't draw well and one that the build refuses.
 *
 * @param {object} terrain - The terrain being edited.
 * @param {object} hills - The generated hills.
 * @param {(row: number, col: number) => boolean} isWet - Whether a tile touches water.
 * @returns {{level: string, message: string, object: null}[]} The problems.
 */
export function checkHills(terrain, hills, isWet) {
  const found = [];
  const seen = new Set();

  /** Adds one problem, once, however many tiles it shows up on. */
  const add = (level, message) => {
    if (!seen.has(message)) found.push({ level, message, object: null });
    seen.add(message);
  };

  for (const key in terrain.levels) {
    const [row, col] = key.split(',').map(Number);
    const here = terrain.levels[key][0];
    const where = `near column ${col}, row ${row}`;

    if (here > 0 && isWet(row, col))
      add('error', `A hill ${where} stands on water. Hills need dry ground.`);

    // Under a south edge the wall takes two rows, and one more must be open in front of it.
    for (const r of [row, row - 1, row - 2, row - 3]) {
      const top = levelAt(terrain, hills, r, col);
      if (top <= levelAt(terrain, hills, r + 1, col)) continue;
      for (let j = 1; j <= WALL_ROWS + 1; j++)
        if (levelAt(terrain, hills, r + j, col) !== top - 1)
          add(
            'warning',
            `The south edge of a hill ${where} needs three boxes of lower flat ground below it for its wall.`,
          );
    }
  }

  for (const [c, y] of terrain.stairs.added)
    if (!stairsFit(terrain, hills, c, y))
      add('warning', `The stairs at column ${c}, row ${y} no longer have an edge to stand on.`);

  return found;
}

/**
 * Packs the level overrides into runs: neighbours in a row with the same level and kit share one.
 *
 * @param {object} levels - 'row,col' to `[level, kit]`.
 * @returns {Array[]} `[row, firstCol, lastCol, level, kit]` runs, sorted by row, then column.
 */
export function encodeLevels(levels) {
  const tiles = Object.entries(levels)
    .map(([key, [level, kit]]) => [...key.split(',').map(Number), level, kit])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const runs = [];
  for (const [row, col, level, kit] of tiles) {
    const last = runs.at(-1);
    if (last && last[0] === row && last[2] === col - 1 && last[3] === level && last[4] === kit)
      last[2] = col;
    else runs.push([row, col, col, level, kit]);
  }
  return runs;
}

/**
 * Unpacks the file's level runs into one entry per tile.
 *
 * @param {Array[]} runs - `[row, firstCol, lastCol, level, kit]` runs from terrain.json.
 * @returns {object} 'row,col' to `[level, kit]`.
 */
export function decodeLevels(runs) {
  const levels = {};
  for (const [row, first, last, level, kit] of runs)
    for (let col = first; col <= last; col++) levels[`${row},${col}`] = [level, kit];
  return levels;
}

/**
 * Checks the hills part of a terrain file, before it is written to disk.
 *
 * @param {object} file - The parsed file.
 * @param {{rows: number, cols: number}} grid - The map's size in tiles.
 * @returns {string[]} One message per thing that is wrong.
 */
export function hillShapeErrors(file, grid) {
  const errors = [];
  /** Says whether a value is a whole number from `low` to `high`. */
  const within = (v, low, high) => Number.isSafeInteger(v) && v >= low && v <= high;

  if (!Array.isArray(file.levels)) errors.push('"levels" must be a list');
  else
    file.levels.forEach((run, i) => {
      const ok =
        Array.isArray(run) &&
        run.length === 5 &&
        within(run[0], 0, grid.rows - 1) &&
        within(run[1], 0, grid.cols - 1) &&
        within(run[2], run[1], grid.cols - 1) &&
        within(run[3], 0, MAX_LEVEL) &&
        KITS.includes(run[4]);
      if (!ok)
        errors.push(`levels[${i}] must be [row, firstCol, lastCol, level, kit] inside the map`);
    });

  for (const list of ['added', 'removed']) {
    const flights = file.stairs?.[list];
    if (!Array.isArray(flights)) {
      errors.push(`"stairs.${list}" must be a list`);
      continue;
    }
    flights.forEach((f, i) => {
      const ok =
        Array.isArray(f) &&
        f.length === 2 &&
        within(f[0], 0, grid.cols - 2) &&
        within(f[1], 0, grid.rows - 1);
      if (!ok) errors.push(`stairs.${list}[${i}] must be [leftColumn, edgeRow] inside the map`);
    });
  }
  return errors;
}

/**
 * Writes the hills part of terrain.json: one level run per line, then the stairs.
 *
 * @param {object} terrain - The terrain being edited.
 * @returns {string[]} The two sections as text, with no comma after them.
 */
export function writeHills(terrain) {
  /** Writes one list of flights on a line, sorted so the order never depends on edit order. */
  const flights = (list) =>
    `[${[...list]
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map(([c, y]) => `[${c}, ${y}]`)
      .join(', ')}]`;

  const runs = encodeLevels(terrain.levels).map(
    ([row, first, last, level, kit]) => `    [${row}, ${first}, ${last}, ${level}, "${kit}"]`,
  );
  return [
    runs.length ? `  "levels": [\n${runs.join(',\n')}\n  ]` : '  "levels": []',
    `  "stairs": {\n    "added": ${flights(terrain.stairs.added)},\n    "removed": ${flights(terrain.stairs.removed)}\n  }`,
  ];
}
