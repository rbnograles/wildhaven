// The world editor's ground painting: which corners of the map's tile grid have been given a
// ground kind by hand. tools/build-map.py decides ground at tile corners and asks these overrides
// first. This file paints boxes, packs the overrides into runs for terrain.json and writes that
// file's text. It knows nothing about the page.

import { remember } from './model.js';

/**
 * The ground kinds, in the map build's rank order (a higher one is painted over a lower one).
 * `water` is what erasing leaves: there is no "nothing" in this world, only sea.
 */
export const KINDS = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water'];

/** The side of one box (one map tile) in world units. */
export const BOX = 64;

/** The kind the Eraser paints. */
export const ERASER = 'water';

/** Makes a terrain with no overrides. `ground` maps a corner, as 'row,col', to its kind. */
export const emptyTerrain = () => ({ ground: {} });

/**
 * Unpacks the file's runs into one entry per corner.
 *
 * @param {Array[]} runs - `[row, firstCol, lastCol, kind]` runs from terrain.json.
 * @returns {object} The overrides, 'row,col' to kind.
 */
export function decodeRuns(runs) {
  const ground = {};
  for (const [row, first, last, kind] of runs)
    for (let col = first; col <= last; col++) ground[`${row},${col}`] = kind;
  return ground;
}

/**
 * Packs the overrides into runs: neighbours of one kind in a row become one entry.
 *
 * Like writing "seats 4 to 9, row C" instead of six separate seats: the file stays short and a
 * git diff shows a stroke as a few lines.
 *
 * @param {object} ground - The overrides, 'row,col' to kind.
 * @returns {Array[]} `[row, firstCol, lastCol, kind]` runs, sorted by row, then column.
 */
export function encodeRuns(ground) {
  const corners = Object.entries(ground)
    .map(([key, kind]) => [...key.split(',').map(Number), kind])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const runs = [];
  for (const [row, col, kind] of corners) {
    const last = runs.at(-1);
    if (last && last[0] === row && last[2] === col - 1 && last[3] === kind) last[2] = col;
    else runs.push([row, col, col, kind]);
  }
  return runs;
}

/**
 * Puts the terrain read from disk into an editing session.
 *
 * @param {object} editor - The editing session from `createEditor`.
 * @param {object} file - The parsed terrain file.
 */
export function loadTerrain(editor, file) {
  editor.terrain = { ground: decodeRuns(file.ground ?? []) };
  editor.savedTerrain = writeTerrain(editor.terrain);
}

/** Says whether the terrain differs from the text that was last saved. */
export const isTerrainDirty = (editor) => writeTerrain(editor.terrain) !== editor.savedTerrain;

/**
 * Notes that the terrain as it is now has been saved.
 *
 * @param {object} editor - The editing session.
 */
export function markTerrainSaved(editor) {
  editor.savedTerrain = writeTerrain(editor.terrain);
}

/**
 * Says what ground a corner has: the hand-painted kind if there is one, else the generated one.
 *
 * @param {object} terrain - The terrain being edited.
 * @param {{kindAt: Function}} base - The generated ground, from the last built map.
 * @param {number} row - The corner's row.
 * @param {number} col - The corner's column.
 * @returns {string} The ground kind.
 */
export function groundAt(terrain, base, row, col) {
  return terrain.ground[`${row},${col}`] ?? base.kindAt(row, col);
}

/**
 * Paints a square of boxes with one ground kind.
 *
 * A box is painted by setting its four corners. A corner that is given the ground the map build
 * would have made there anyway needs no override, so its entry is removed: the file only ever
 * holds real changes.
 *
 * @param {object} editor - The editing session.
 * @param {number} col - The column of the box under the pointer.
 * @param {number} row - The row of the box under the pointer.
 * @param {number} size - The brush's side in boxes: 1, 3 or 5.
 * @param {string} kind - One of `KINDS`.
 * @param {{rows: number, cols: number, kindAt: Function}} base - The generated ground, and the
 *   size of the map in boxes.
 * @param {boolean} [record] - False for the later moves of one stroke, so the stroke is one undo step.
 */
export function paintBoxes(editor, col, row, size, kind, base, record = true) {
  if (record) remember(editor);

  const half = (size - 1) / 2;
  const { ground } = editor.terrain;

  // Boxes col-half..col+half own corners col-half..col+half+1 (and the same for rows).
  for (let r = Math.max(0, row - half); r <= Math.min(base.rows, row + half + 1); r++)
    for (let c = Math.max(0, col - half); c <= Math.min(base.cols, col + half + 1); c++) {
      if (base.kindAt(r, c) === kind) delete ground[`${r},${c}`];
      else ground[`${r},${c}`] = kind;
    }
}

/**
 * Checks that an object has the shape of the terrain file, before it is written to disk.
 *
 * @param {*} file - What a request sent.
 * @param {{rows: number, cols: number}} [grid] - The map's size in boxes.
 * @returns {string[]} One message per thing that is wrong; empty when the shape is right.
 */
export function shapeErrors(file, grid = { rows: 320, cols: 448 }) {
  if (typeof file !== 'object' || file === null || !Array.isArray(file.ground))
    return ['The terrain must be an object with a "ground" list'];

  const errors = [];
  file.ground.forEach((run, i) => {
    const ok =
      Array.isArray(run) &&
      run.length === 4 &&
      run.slice(0, 3).every(Number.isSafeInteger) &&
      run[0] >= 0 &&
      run[0] <= grid.rows &&
      run[1] >= 0 &&
      run[1] <= run[2] &&
      run[2] <= grid.cols &&
      KINDS.includes(run[3]);
    if (!ok) errors.push(`ground[${i}] must be [row, firstCol, lastCol, kind] inside the map`);
  });
  return errors;
}

/**
 * Turns the terrain into the text of terrain.json: one run per line, in a fixed order.
 *
 * @param {object} terrain - The terrain being edited.
 * @returns {string} The file's text, ending with a newline.
 */
export function writeTerrain(terrain) {
  const runs = encodeRuns(terrain.ground);
  if (!runs.length) return '{\n  "ground": []\n}\n';

  const lines = runs.map(
    ([row, first, last, kind]) => `    [${row}, ${first}, ${last}, "${kind}"]`,
  );
  return `{\n  "ground": [\n${lines.join(',\n')}\n  ]\n}\n`;
}
