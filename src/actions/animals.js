// Not a player action: the animals' lives each frame (grazing, wandering, running from the player,
// lying down when hunted, coming back a day later), and the one player action they share: hunting
// one with an axe. Hunting is a timed action like chopping: beginHunt starts it, and the game loop's
// finishHunt checks again and only then gives the food.

import {
  FLEE_RUNNING,
  FLEE_WALKING,
  FLEE_SECONDS,
  HUNT_REACH,
  HUNT_SECONDS,
  ANIMAL_RETURN,
  ANIMAL_DOWN_SECONDS,
} from '../data/balance.js';
import { ANIMALS } from '../data/animals.js';
import { isWalkable } from '../world/map.js';
import { WILD_ANIMALS, animalById, isAlive, wanderSpot } from '../world/animals.js';
import { WOLVES } from '../world/wolves.js';
import { nextDusk } from './wolves.js';
import { hasTool, wearTool } from '../world/tools.js';
import { facing } from './move.js';
import { BAG_FULL, addItem, hasRoomFor } from '../world/bag.js';
import { startAction } from '../animation/clips.js';

/** The start of a timed hunting action's target: `hunt:<animal id>`. */
export const HUNT_PREFIX = 'hunt:';

// How far from the player an animal is still worth moving each frame; farther ones wait, unseen.
const AWAKE = 3000;

/**
 * Moves an animal a step toward a spot, or says it could not.
 *
 * @param {object} a - The animal. Its position and facing change.
 * @param {number} tx - Where it is going, x.
 * @param {number} ty - Where it is going, y.
 * @param {number} speed - World units per second.
 * @param {number} dt - Seconds since the last frame.
 * @returns {'moved'|'there'|'blocked'} What happened.
 */
function stepToward(a, tx, ty, speed, dt) {
  const dx = tx - a.x,
    dy = ty - a.y,
    d = Math.hypot(dx, dy);
  if (d < 4) return 'there';
  const step = Math.min(d, speed * dt),
    nx = a.x + (dx / d) * step,
    ny = a.y + (dy / d) * step;
  if (dx) a.facing = dx < 0 ? 1 : 2;
  if (!isWalkable(nx, ny)) return 'blocked';
  a.x = nx;
  a.y = ny;
  return 'moved';
}

/**
 * Runs every animal's life for one frame.
 *
 * Each one grazes (idle) for a few seconds, then wanders to a spot near its herd's home and grazes
 * again. A player who comes too close (from farther away when running than walking) sends it running
 * off for FLEE_SECONDS. The animal the player is hunting stands frozen, startled. A hunted animal lies
 * down, fades, and comes back to its herd ANIMAL_RETURN game seconds later.
 *
 * @param {object} state - The game being played (the player's spot, the clock).
 * @param {number} dt - Seconds since the last frame.
 * @param {{running?: boolean, hunting?: string|null, random?: () => number}} [how] - Whether the
 *   player is running, the id of the animal being hunted (if any), and the dice (tests pass their own).
 */
export function tickAnimals(
  state,
  dt,
  { running = false, hunting = null, random = Math.random } = {},
) {
  const { player } = state;
  for (const a of WILD_ANIMALS) {
    if (a.phase === 'gone') {
      if (state.time >= a.respawnAt)
        Object.assign(a, { phase: 'idle', x: a.herd.x, y: a.herd.y, left: 2, clock: 0 });
      continue;
    }
    a.clock += dt;
    if (a.phase === 'down') {
      if (a.clock >= ANIMAL_DOWN_SECONDS) a.phase = 'gone';
      continue;
    }
    const d = Math.hypot(player.x - a.x, player.y - a.y);
    if (d > AWAKE) continue;

    // Startled: the hunter's swing is coming, and it freezes.
    if (a.id === hunting) {
      a.phase = 'idle';
      a.facing = player.x < a.x ? 1 : 2;
      continue;
    }

    // Too close: run, away from the player.
    if (!state.aboard && d < (running ? FLEE_RUNNING : FLEE_WALKING)) {
      if (a.phase !== 'run') a.clock = 0;
      a.phase = 'run';
      a.fleeFor = FLEE_SECONDS;
    }

    const kind = ANIMALS[a.kind];
    if (a.phase === 'run') {
      const away = Math.max(d, 1);
      const went = stepToward(
        a,
        a.x + ((a.x - player.x) / away) * 200,
        a.y + ((a.y - player.y) / away) * 200,
        kind.run,
        dt,
      );
      // Blocked straight away from the player: try running sideways instead.
      if (went === 'blocked')
        stepToward(
          a,
          a.x - ((a.y - player.y) / away) * 200,
          a.y + ((a.x - player.x) / away) * 200,
          kind.run,
          dt,
        );
      a.fleeFor -= dt;
      if (a.fleeFor <= 0) Object.assign(a, { phase: 'idle', left: 2 + random() * 3, clock: 0 });
    } else if (a.phase === 'walk') {
      if (stepToward(a, a.target.x, a.target.y, kind.walk, dt) !== 'moved')
        Object.assign(a, { phase: 'idle', left: 2 + random() * 5, clock: 0 });
    } else {
      a.left -= dt;
      if (a.left <= 0) Object.assign(a, { phase: 'walk', target: wanderSpot(a, random), clock: 0 });
    }
  }
}

/**
 * Finds the animal the player could hunt now: the closest one out and about within HUNT_REACH. A wolf
 * counts too: fighting one is the same axe swing.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The animal, or null.
 */
export function huntable(state) {
  if (state.aboard) return null;
  let best = null,
    bestD = HUNT_REACH;
  for (const a of [...WILD_ANIMALS, ...WOLVES]) {
    if (!isAlive(a)) continue;
    const d = Math.hypot(state.player.x - a.x, state.player.y - a.y);
    if (d <= bestD) [best, bestD] = [a, d];
  }
  return best;
}

/**
 * Starts hunting an animal in reach: the axe swing (the `chop` clip) runs for HUNT_SECONDS. The
 * player turns to face it. Without an axe nothing starts.
 *
 * @param {object} state - The game being played. The player's facing changes.
 * @param {object} animator - The player's animation state.
 * @param {object} animal - The animal.
 * @returns {{ok: boolean, reason?: string, message?: string}} Whether the hunt started, or why not:
 *   'busy', 'tool' (no axe), 'far' or 'full' (no open slot for the food).
 */
export function beginHunt(state, animator, animal) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  if (!hasTool(state, 'axe'))
    return {
      ok: false,
      reason: 'tool',
      message: 'You need an axe to hunt. Make one in the Build menu (B).',
    };
  if (
    !animal ||
    !isAlive(animal) ||
    Math.hypot(state.player.x - animal.x, state.player.y - animal.y) > HUNT_REACH
  )
    return { ok: false, reason: 'far' };
  // A wolf gives nothing; any other animal's food needs a slot in the item box.
  if (!animal.den && !hasRoomFor(state, ['food']))
    return { ok: false, reason: 'full', message: BAG_FULL };
  state.player.direction = facing(animal.x - state.player.x, 0) === 1 ? 1 : 2;
  startAction(animator, 'chop', `${HUNT_PREFIX}${animal.id}`, HUNT_SECONDS);
  return { ok: true };
}

/**
 * Finishes a hunt when its timed action runs out: the animal lies down, and its food (and, for a deer
 * sometimes, an antler) goes into the backpack. A stone axe wears a use, as chopping does.
 *
 * @param {object} state - The game being played. Resources change.
 * @param {string} target - Such as 'hunt:herd-meadows-2-1'.
 * @param {() => number} [roll] - Gives a number from 0 to 1, for the antler; tests pass their own.
 * @returns {{kind: 'hunt', animal: string, food: number, antler: boolean, wear: string|null}|null}
 *   What the hunt gave (`animal` 'wolf' and no food for a wolf), or null when the animal got away
 *   (it is gone, or too far now).
 */
export function finishHunt(state, target, roll = Math.random) {
  const id = target.slice(HUNT_PREFIX.length),
    a = animalById(id) ?? WOLVES.find((w) => w.id === id);
  if (
    !a ||
    !isAlive(a) ||
    Math.hypot(state.player.x - a.x, state.player.y - a.y) > HUNT_REACH * 1.5
  )
    return null;
  // A wolf gives nothing: it lies down, and its pack is whole again at the next dusk.
  if (a.den) {
    Object.assign(a, { phase: 'down', clock: 0, respawnAt: nextDusk(state.time) });
    return { kind: 'hunt', animal: 'wolf', food: 0, antler: false, wear: wearTool(state, 'axe') };
  }
  // The bag is checked again: it may have filled since the swing began.
  if (!hasRoomFor(state, ['food'])) return null;
  const kind = ANIMALS[a.kind],
    rolled = roll() < kind.antler;
  Object.assign(a, { phase: 'down', clock: 0, respawnAt: state.time + ANIMAL_RETURN });
  addItem(state, 'food', kind.food);
  // An antler with no open slot to go to is left behind.
  const antler = rolled && addItem(state, 'antler');
  return { kind: 'hunt', animal: kind.name, food: kind.food, antler, wear: wearTool(state, 'axe') };
}
