// The "move" action: walking and running around the world without passing through water,
// standing trees, buildings, cliff edges, old boats, standing supplies or campfires, and rowing the boat
// across shallow sea.

import { isWalkable, isSailable, blocks, hitsCliff, obstaclesAt } from '../world/map.js';
import { solidBases } from '../world/nodes.js';
import {
  WALK_SPEED,
  RUN_SPEED,
  BOAT_SPEED,
  BOAT_FAST_SPEED,
  MAX_MOVE_DT,
} from '../data/balance.js';

/**
 * Says which way something faces when it heads along (dx, dy): mostly sideways or mostly up/down.
 *
 * @param {number} dx - Sideways movement: negative is west.
 * @param {number} dy - Up/down movement: negative is north.
 * @returns {number} 0 south, 1 west, 2 east or 3 north.
 */
export const facing = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0);

/**
 * Makes the check for where the player may stand on foot right now.
 *
 * Standing supplies, old boats and camp fires are solid, and so are cliffs and the map's trees
 * and rocks. A few are let through on purpose, so the player is never trapped: a base or cliff
 * the player already stands inside (an old save may put them there), and a chopped tree or mined
 * rock that has not grown back. Walking and the click-to-walk path share this one check, so a
 * planned path never leads where a step would be refused.
 *
 * @param {object} state - The game being played.
 * @returns {Function} `(x, y)` → true if the player may step onto that spot.
 */
export function footing(state) {
  const { x, y } = state.player;

  // A save made before a supply, fire or hill stood here may put the player inside it; let them walk out.
  const bases = solidBases(state).filter((base) => !blocks([base], x, y));
  const cliffs = !hitsCliff(x, y);

  // A chopped tree or mined rock isn't solid until it grows back, and one that grew back around
  // the player (or that a save put them inside) lets them walk out, like the bases above.
  const inside = obstaclesAt(x, y);
  /** True for a map object to walk through: chopped and not grown back, or already around the player. */
  const skip = (id) => state.regrowAt[id] > state.time || inside.includes(id);

  return (px, py) => isWalkable(px, py, bases, cliffs, skip);
}

/**
 * Says how far one movement update carries the player.
 *
 * @param {object} state - The game being played (the boat is faster than walking).
 * @param {number} dt - Seconds since the last frame.
 * @param {boolean} [running=false] - True while Shift is held.
 * @returns {number} The step's length in world units.
 */
export function stepLength(state, dt, running = false) {
  const speed = state.aboard
    ? running
      ? BOAT_FAST_SPEED
      : BOAT_SPEED
    : running
      ? RUN_SPEED
      : WALK_SPEED;
  return speed * Math.min(dt, MAX_MOVE_DT);
}

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
 * @param {boolean} [running=false] - True while Shift is held, so the step (walking or rowing) is longer.
 * @returns {boolean} True if the player really moved, so a blocked step shows the idle pose.
 */
export function movePlayer(state, dx, dy, dt, running = false) {
  if (![dx, dy, dt].every(Number.isFinite) || dt <= 0 || (!dx && !dy)) return false;

  // Make diagonal steps the same length as straight ones, then scale by speed and time.
  const length = Math.hypot(dx, dy);
  const step = stepLength(state, dt, running);
  dx = (dx / length) * step;
  dy = (dy / length) * step;
  const { x, y } = state.player;

  // Face the way the player is mostly moving (0 south, 1 west, 2 east, 3 north).
  state.player.direction = facing(dx, dy);

  // True if the player may move onto a spot: shallow sea in the boat, dry open ground on foot
  // (see footing for what is solid and what is let through).
  const free = state.aboard ? isSailable : footing(state);

  // Try the x and y parts separately, so a wall in one direction still lets the player slide along it.
  if (free(x + dx, y)) state.player.x += dx;
  if (free(state.player.x, y + dy)) state.player.y += dy;

  // The boat carries the player, so it goes wherever they go and points the same way.
  if (state.aboard)
    Object.assign(state.boat, {
      x: state.player.x,
      y: state.player.y,
      dir: state.player.direction,
    });

  const distance = Math.hypot(state.player.x - x, state.player.y - y);
  state.distance += distance;
  return distance > 0;
}
