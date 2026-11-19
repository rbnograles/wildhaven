// The "move" action: walking and running around the world without passing through water,
// trees, buildings, cliff edges, supplies that are standing, or campfires.

import { isWalkable, blocks, hitsCliff } from '../world/map.js';
import { nodeBases, goneSupplies } from '../world/nodes.js';
import { campBases } from '../world/camps.js';
import { WALK_SPEED, RUN_SPEED, MAX_MOVE_DT } from '../data/balance.js';

/**
 * Moves the player one small step in the direction the keys point.
 *
 * Think of the player as a toy on a table: each frame we nudge it a little. If a tree or the
 * sea blocks one direction, the toy still slides along the other one instead of stopping dead.
 *
 * @param {object} state - The game being played. Its `player` position and `distance` change.
 * @param {number} dx - Left/right push: -1 is west, 1 is east, 0 is neither.
 * @param {number} dy - Up/down push: -1 is north, 1 is south, 0 is neither.
 * @param {number} dt - Seconds since the last frame.
 * @param {boolean} [running=false] - True while Shift is held, so the step is longer.
 * @returns {boolean} True if the player really moved, so a blocked step shows the idle pose.
 */
export function movePlayer(state, dx, dy, dt, running = false) {
  if (![dx, dy, dt].every(Number.isFinite) || dt <= 0 || (!dx && !dy)) return false;

  // Make diagonal steps the same length as straight ones, then scale by speed and time.
  const length = Math.hypot(dx, dy),
    speed = running ? RUN_SPEED : WALK_SPEED;
  const step = speed * Math.min(dt, MAX_MOVE_DT);
  dx = (dx / length) * step;
  dy = (dy / length) * step;
  const { x, y } = state.player;

  // Face the way the player is mostly moving (0 south, 1 west, 2 east, 3 north).
  state.player.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;

  // Standing supplies and camp fires are solid. A save made before one stood here may put the
  // player inside its base; let them walk out instead of trapping them.
  // The same goes for a save made before a hill was built where the player stands: cliffs are ignored until they're off it.
  const bases = [...nodeBases(goneSupplies(state)), ...campBases(state)].filter(
    (base) => !blocks([base], x, y),
  );
  const cliffs = !hitsCliff(x, y);

  // Try the x and y parts separately, so a wall in one direction still lets the player slide along it.
  if (isWalkable(x + dx, y, bases, cliffs)) state.player.x += dx;
  if (isWalkable(state.player.x, y + dy, bases, cliffs)) state.player.y += dy;

  const distance = Math.hypot(state.player.x - x, state.player.y - y);
  state.distance += distance;
  return distance > 0;
}
