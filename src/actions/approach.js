// The "approach" action: walking by itself to a tree or rock the player clicked from far away.
// `beginApproach` plans a path round water, cliffs, trees, rocks and fires; the game loop then asks
// `approachStep` each frame which way to push the player, and starts the chop or the mining as
// soon as the target is in reach. Nothing here is saved: a walk is forgotten when the game closes.

import { footing } from './move.js';
import { OBJECT_SPECS } from '../world/map.js';
import {
  GATHER_RANGE,
  APPROACH_CELL,
  APPROACH_SPAN,
  APPROACH_MARGIN,
  STAND_SIDE,
  STAND_GAP,
} from '../data/balance.js';

// How far apart (in units) the spots checked along a straight line are when a path is smoothed.
// The thinnest solid thing is wider than this, so a line can't slip through one unseen.
const LINE_STEP = 6;

// The eight neighbours of a grid square: [sideways, up/down] steps.
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Says whether the player could walk in a straight line from one spot to another.
 *
 * It checks a spot every few units along the line, like testing the ice with a stick before
 * each step.
 *
 * @param {Function} free - `(x, y)` → true if the player may stand there (see footing).
 * @param {{x: number, y: number}} a - Where the line starts.
 * @param {{x: number, y: number}} b - Where the line ends.
 * @returns {boolean} True if every checked spot is free.
 */
function clearLine(free, a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / LINE_STEP));
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps;
    if (!free(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

/**
 * Straightens a zig-zag grid path into a few long, natural strides.
 *
 * From where the player stands it looks for the farthest point of the path it can reach in a
 * straight line, keeps that one, and looks again from there. A walk across an open meadow becomes
 * one straight line instead of a staircase.
 *
 * @param {Function} free - `(x, y)` → true if the player may stand there.
 * @param {{x: number, y: number}} start - Where the player stands.
 * @param {{x: number, y: number}[]} points - The grid path, nearest point first.
 * @returns {{x: number, y: number}[]} The same route with the needless points left out.
 */
function straighten(free, start, points) {
  const out = [];
  let from = start,
    i = 0;

  while (i < points.length) {
    // The next point can always be reached (the search checked it); try to see farther than that.
    let far = i;
    for (let j = points.length - 1; j > i; j -= 1) {
      if (clearLine(free, from, points[j])) {
        far = j;
        break;
      }
    }
    out.push(points[far]);
    from = points[far];
    i = far + 1;
  }
  return out;
}

/**
 * Finds a way on foot from the player to within reach of a node.
 *
 * The ground around the player is treated as squared paper. Starting from the player's square,
 * the search keeps trying the most promising square next (the one whose steps so far plus the
 * straight distance still to go is smallest, known as A*), and never steps onto water, a cliff
 * edge or anything solid. It stops at the first square close enough to gather from.
 *
 * @param {object} state - The game being played.
 * @param {{x: number, y: number}} node - The tree or rock to walk to.
 * @returns {{x: number, y: number}[]|null} The spots to walk through in order (empty when the
 *   node is already in reach), or null when there is no way there on foot.
 */
export function planApproach(state, node) {
  if (state.aboard) return null;

  // Setup: the grid is centred on the player, so square (0, 0) is exactly where they stand.
  const free = footing(state),
    start = { x: state.player.x, y: state.player.y },
    reach = GATHER_RANGE - APPROACH_MARGIN,
    radius = Math.ceil(APPROACH_SPAN / APPROACH_CELL),
    side = radius * 2 + 1;

  /** How far a grid square's middle is from the node. */
  const gap = (i, j) =>
    Math.hypot(start.x + i * APPROACH_CELL - node.x, start.y + j * APPROACH_CELL - node.y);
  if (gap(0, 0) < reach) return [];

  // What is known about each square: the cheapest way found to it, the square that way came
  // from, whether it is settled, and whether it can be stood on (0 not checked, 1 yes, 2 no).
  const cost = new Float32Array(side * side).fill(Infinity),
    cameFrom = new Int32Array(side * side).fill(-1),
    settled = new Uint8Array(side * side),
    ground = new Uint8Array(side * side);

  /** Turns a square's grid position into its place in the lists above. */
  const at = (i, j) => (j + radius) * side + (i + radius);

  /** True if the player may stand in the middle of a square. The answer is remembered. */
  const open = (i, j) => {
    const k = at(i, j);
    if (!ground[k])
      ground[k] = free(start.x + i * APPROACH_CELL, start.y + j * APPROACH_CELL) ? 1 : 2;
    return ground[k] === 1;
  };

  // The squares waiting to be tried, kept as a heap: a pile where the most promising one is
  // always on top. Each entry is [score, i, j].
  const heap = [];

  /** Adds a square to the pile and lets it rise to its place. */
  const push = (entry) => {
    let k = heap.push(entry) - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (heap[parent][0] <= heap[k][0]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  };

  /** Takes the most promising square off the pile and tidies the rest. */
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const left = k * 2 + 1,
          right = left + 1;
        let least = k;
        if (left < heap.length && heap[left][0] < heap[least][0]) least = left;
        if (right < heap.length && heap[right][0] < heap[least][0]) least = right;
        if (least === k) break;
        [heap[least], heap[k]] = [heap[k], heap[least]];
        k = least;
      }
    }
    return top;
  };

  // The search itself.
  cost[at(0, 0)] = 0;
  ground[at(0, 0)] = 1; // the player is standing there, whatever the map says
  push([gap(0, 0), 0, 0]);

  while (heap.length) {
    const [, i, j] = pop(),
      here = at(i, j);
    if (settled[here]) continue;
    settled[here] = 1;

    // Close enough to gather: walk the trail of "came from" notes back to the player.
    if (gap(i, j) < reach) {
      const points = [];
      for (let k = here; k !== at(0, 0); k = cameFrom[k])
        points.push({
          x: start.x + ((k % side) - radius) * APPROACH_CELL,
          y: start.y + (Math.floor(k / side) - radius) * APPROACH_CELL,
        });
      return straighten(free, start, points.reverse());
    }

    for (const [di, dj] of NEIGHBOURS) {
      const ni = i + di,
        nj = j + dj;
      if (Math.abs(ni) > radius || Math.abs(nj) > radius || !open(ni, nj)) continue;
      // A diagonal step must not cut the corner of something solid.
      if (di && dj && !(open(i + di, j) && open(i, j + dj))) continue;
      // Nor may anything thin stand between the two squares' middles.
      if (!free(start.x + (i + di / 2) * APPROACH_CELL, start.y + (j + dj / 2) * APPROACH_CELL))
        continue;

      const next = at(ni, nj),
        steps = cost[here] + Math.hypot(di, dj) * APPROACH_CELL;
      if (steps >= cost[next]) continue;
      cost[next] = steps;
      cameFrom[next] = here;
      push([steps + Math.max(0, gap(ni, nj) - reach), ni, nj]);
    }
  }

  return null;
}

/**
 * Starts a walk to a clicked tree or rock.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The node to walk to.
 * @returns {{node: object, path: object[], i: number, stuck: number, retried: boolean}|null} The
 *   walk for the game loop to follow: its target, the spots still to pass (`path` from `i` on),
 *   how long the player has been stuck, and whether a second path was already tried. Null when
 *   there is no way there.
 */
export function beginApproach(state, node) {
  const path = planApproach(state, node);
  return path && { node, path, i: 0, stuck: 0, retried: false };
}

/**
 * Finds the spot beside a hand-picked node where the player should stand to gather it.
 *
 * The bending picture faces east or west, so the player looks right only when the berries or
 * stones are at their side, like kneeling next to a flower bed rather than with your back to it.
 * The spot is level with the node, on the side the player is already on; if something is in the
 * way there, the other side is tried. Trees and rocks keep their own swing and get no spot.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The node about to be gathered.
 * @returns {{x: number, y: number}|null} The spot to step to, or null when no step is needed:
 *   the node needs a tool, the player already stands there, or neither side can be walked to in
 *   a straight line.
 */
export function standSpot(state, node) {
  if (node.tool || state.aboard) return null;

  // A solid supply (a berry bush with a base) is stood beside its base, not inside it.
  const free = footing(state),
    base = (OBJECT_SPECS[node.sprite]?.footprint?.[0] ?? 0) * (node.scale ?? 1),
    side = Math.max(STAND_SIDE, base + STAND_GAP),
    here = { x: state.player.x, y: state.player.y },
    first = here.x <= node.x ? -1 : 1;

  for (const way of [first, -first]) {
    const spot = { x: node.x + way * side, y: node.y + 2 };
    if (Math.hypot(spot.x - here.x, spot.y - here.y) < 4) return null;
    if (free(spot.x, spot.y) && clearLine(free, here, spot)) return spot;
  }
  return null;
}

/**
 * Starts the short step to the spot beside a hand-picked node that is already in reach.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The node to gather.
 * @returns {object|null} A walk like beginApproach's, marked `placing`, whose path is just the
 *   spot. Null when no step is needed (see standSpot), so the gathering can start at once.
 */
export function beginPlacing(state, node) {
  const spot = standSpot(state, node);
  return spot && { node, path: [spot], i: 0, stuck: 0, retried: false, placing: true };
}

/**
 * Says which way to push the player this frame to follow a walk.
 *
 * The path is a row of stepping stones. The player heads for the next stone, and once it is
 * within one step it counts as reached, so they never overshoot and turn back.
 *
 * @param {object} state - The game being played.
 * @param {object} walk - The walk from beginApproach; its `i` moves on as spots are reached.
 * @param {number} step - How far the player moves this frame (see stepLength).
 * @returns {{dx: number, dy: number}|null} The push for movePlayer, or null at the end of the path.
 */
export function approachStep(state, walk, step) {
  while (walk.i < walk.path.length) {
    const dx = walk.path[walk.i].x - state.player.x,
      dy = walk.path[walk.i].y - state.player.y;
    if (Math.hypot(dx, dy) > Math.max(step, 1)) return { dx, dy };
    walk.i += 1;
  }
  return null;
}

/**
 * Rounds a movement to the nearest of the eight compass directions.
 *
 * Keys can only push in eight directions, but a walk to a clicked tree goes at any angle. The
 * diagonal walking pictures should show only when the movement is really close to a diagonal.
 *
 * @param {number} dx - Sideways movement: negative is west.
 * @param {number} dy - Up/down movement: negative is north.
 * @returns {{dx: number, dy: number}} Each part as -1, 0 or 1.
 */
export function eightWay(dx, dy) {
  // 0.41 is the slope of a line halfway between straight and diagonal (22.5 degrees).
  const ax = Math.abs(dx),
    ay = Math.abs(dy);
  return { dx: ax > ay * 0.41 ? Math.sign(dx) : 0, dy: ay > ax * 0.41 ? Math.sign(dy) : 0 };
}
