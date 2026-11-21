// Not a player action: the wolves' lives each frame. By day a pack stands guard near its den, growls
// at a player who comes close and attacks one who keeps coming; at night it roams far and chases any
// player it sees. Wolves never step into a village or a fire's warmth, and the player can drive them
// back (repel) or fight one with an axe (the hunt action). A downed wolf's pack is whole again at dusk.

import {
  WOLF_GUARD,
  WOLF_WARN,
  WOLF_ATTACK,
  WOLF_ROAM,
  WOLF_SIGHT,
  WOLF_WALK,
  WOLF_RUN,
  WOLF_BITE_REACH,
  WOLF_BITE,
  WOLF_BITE_EVERY,
  PACK_BITE_EVERY,
  REPEL_REACH,
  REPEL_PUSH,
  REPEL_STUN,
  REPEL_EVERY,
  REPEL_SECONDS,
  ANIMAL_DOWN_SECONDS,
  DAY_SECONDS,
  PHASES,
} from '../data/balance.js';
import { isWalkable } from '../world/map.js';
import { phaseOf } from '../world/clock.js';
import { WOLVES, wolfAlive, isSafe } from '../world/wolves.js';
import { startAction, slantOf } from '../animation/clips.js';
import { findPath } from './approach.js';

// How far from the player a wolf is still worth moving each frame; farther ones wait, unseen.
const AWAKE = 3500;

// How often a chasing wolf plans its way round the trees again, in seconds: the player keeps
// moving, so an old plan soon points the wrong way, but planning every frame would be wasteful.
const REPLAN = 0.7;

// When the player last drove the wolves back, in game seconds (for REPEL_EVERY). Never saved.
let repelledAt = -Infinity;

// Seconds until any wolf may bite again (PACK_BITE_EVERY), shared by every pack. Never saved.
let packWait = 0;

/**
 * Gives the time of the next dusk after a moment: when a downed wolf's pack is whole again.
 *
 * @param {number} time - Game seconds.
 * @returns {number} The next dusk, in game seconds.
 */
export function nextDusk(time) {
  const dusk = Math.floor(time / DAY_SECONDS) * DAY_SECONDS + PHASES.dusk;
  return dusk > time ? dusk : dusk + DAY_SECONDS;
}

/**
 * Moves a wolf a step toward a spot, unless the step is blocked or would take it somewhere safe for
 * the player (a village, a fire's warmth), where wolves never go.
 *
 * @param {object} state - The game being played.
 * @param {object} w - The wolf. Its position, facing and slant change.
 * @param {number} tx - Where it is going, x.
 * @param {number} ty - Where it is going, y.
 * @param {number} speed - World units per second.
 * @param {number} dt - Seconds since the last frame.
 * @returns {'moved'|'there'|'blocked'} What happened.
 */
function stepToward(state, w, tx, ty, speed, dt) {
  const dx = tx - w.x,
    dy = ty - w.y,
    d = Math.hypot(dx, dy);
  if (d < 6) return 'there';
  const step = Math.min(d, speed * dt),
    nx = w.x + (dx / d) * step,
    ny = w.y + (dy / d) * step;
  if (dx) w.facing = dx < 0 ? 1 : 2;
  w.slant = slantOf(dx, dy)?.[0] ?? null;

  // A spot the wolf may step onto: walkable, and not into a safe spot from outside one.
  const open = (x, y) => isWalkable(x, y) && (!isSafe(state, x, y) || isSafe(state, w.x, w.y));

  // Straight on if it can; otherwise slide along the tree or rock in the way, like the player does,
  // trying the bigger half of the step first.
  const tries = [
    [nx, ny],
    ...(Math.abs(dx) >= Math.abs(dy)
      ? [
          [w.x + Math.sign(dx) * step, w.y],
          [w.x, w.y + Math.sign(dy || 1) * step],
        ]
      : [
          [w.x, w.y + Math.sign(dy) * step],
          [w.x + Math.sign(dx || 1) * step, w.y],
        ]),
  ];
  for (const [x, y] of tries) {
    if (!open(x, y)) continue;
    w.x = x;
    w.y = y;
    return 'moved';
  }
  return 'blocked';
}

/**
 * Moves a chasing wolf one step toward the player, round the trees and rocks in the way.
 *
 * Running straight at the player leaves a wolf stuck behind the first tree, so it plans a way with
 * the same path search the villagers use (findPath), never through a safe spot, and follows it.
 * The plan is made again every REPLAN seconds; with no way found it runs straight at the player.
 *
 * @param {object} state - The game being played.
 * @param {object} w - The wolf. Its position, facing and plan (`path`, `replanIn`) change.
 * @param {number} dt - Seconds since the last frame.
 */
function chaseStep(state, w, dt) {
  const { player } = state;
  w.replanIn -= dt;
  if (w.replanIn <= 0 || !w.path) {
    w.replanIn = REPLAN;
    w.path = findPath(
      (x, y) => isWalkable(x, y) && !isSafe(state, x, y),
      w,
      player,
      WOLF_BITE_REACH * 0.8,
    );
  }

  // Drop the turning points already reached, then head for the next one (or the player).
  while (w.path?.length && Math.hypot(w.path[0].x - w.x, w.path[0].y - w.y) < 12) w.path.shift();
  const next = w.path?.[0] ?? player;
  stepToward(state, w, next.x, next.y, WOLF_RUN, dt);
}

/**
 * Picks a spot for a wolf to wander to: near its den by day, anywhere within WOLF_ROAM of it at night.
 *
 * @param {object} w - The wolf.
 * @param {boolean} night - True at night.
 * @param {() => number} random - Gives a number from 0 to 1.
 * @returns {{x: number, y: number}} The spot.
 */
function wanderSpot(w, night, random) {
  const angle = random() * Math.PI * 2,
    r = random() * (night ? WOLF_ROAM : WOLF_GUARD);
  return { x: w.den.x + Math.cos(angle) * r, y: w.den.y + Math.sin(angle) * r * 0.7 };
}

/**
 * Runs every wolf's life for one frame and reports what the player should hear about.
 *
 * - Lying down: a downed wolf fades, and is back at its den at the next dusk.
 * - Stunned (after a repel): it stands still until the stun wears off.
 * - Hunted: the wolf the player is swinging at stands its ground.
 * - The player is near and not safe: by day a wolf growls (`snarl`) within WOLF_WARN and attacks within
 *   WOLF_ATTACK; at night it chases from WOLF_SIGHT. Within WOLF_BITE_REACH it lunges and bites.
 * - Otherwise it wanders: near the den by day, far and wide at night. A wolf caught inside a safe
 *   spot (a fire was lit beside it) runs out of it.
 *
 * @param {object} state - The game being played. A bite takes health from the player.
 * @param {number} dt - Seconds since the last frame.
 * @param {{hunting?: string|null, random?: () => number}} [how] - The id of the wolf being fought
 *   (if any), and the dice (tests pass their own).
 * @returns {{kind: 'snarl'|'bite', wolf: object}[]} Growls and bites this frame.
 */
export function tickWolves(state, dt, { hunting = null, random = Math.random } = {}) {
  const events = [],
    night = phaseOf(state.time) === 'night',
    { player } = state,
    exposed = !state.aboard && !isSafe(state, player.x, player.y);
  packWait = Math.max(0, packWait - dt);
  for (const w of WOLVES) {
    if (w.phase === 'gone') {
      if (state.time >= w.respawnAt)
        Object.assign(w, { phase: 'idle', x: w.den.x, y: w.den.y, left: 1, clock: 0 });
      continue;
    }
    w.clock += dt;
    if (w.phase === 'down') {
      if (w.clock >= ANIMAL_DOWN_SECONDS) w.phase = 'gone';
      continue;
    }
    w.biteWait = Math.max(0, w.biteWait - dt);
    const d = Math.hypot(player.x - w.x, player.y - w.y);
    if (d > AWAKE) continue;

    if (w.stunFor > 0) {
      w.stunFor -= dt;
      w.phase = 'idle';
      continue;
    }
    if (w.id === hunting) {
      w.phase = 'snarl';
      w.facing = player.x < w.x ? 1 : 2;
      continue;
    }

    // Caught inside a safe spot: get out, away from its middle (the player is a fair guide to it).
    if (isSafe(state, w.x, w.y)) {
      w.phase = 'run';
      const away = Math.max(d, 1);
      stepToward(
        state,
        w,
        w.x + ((w.x - player.x) / away) * 300,
        w.y + ((w.y - player.y) / away) * 300,
        WOLF_RUN,
        dt,
      );
      continue;
    }

    const chase = exposed && (night ? d < WOLF_SIGHT : d < WOLF_ATTACK);
    if (chase) {
      if (d <= WOLF_BITE_REACH) {
        w.facing = player.x < w.x ? 1 : 2;
        if (w.biteWait <= 0 && packWait <= 0) {
          state.meters.health = Math.max(0, state.meters.health - WOLF_BITE);
          w.biteWait = WOLF_BITE_EVERY;
          packWait = PACK_BITE_EVERY;
          w.phase = 'lunge';
          w.clock = 0;
          events.push({ kind: 'bite', wolf: w });
        } else if (w.phase !== 'lunge' || w.clock > 0.5) w.phase = 'snarl';
      } else {
        if (w.phase !== 'run') Object.assign(w, { clock: 0, path: null });
        w.phase = 'run';
        chaseStep(state, w, dt);
      }
      continue;
    }

    // By day, a player close to the den gets a growl first.
    if (exposed && !night && d < WOLF_WARN) {
      if (w.phase !== 'snarl') {
        w.clock = 0;
        events.push({ kind: 'snarl', wolf: w });
      }
      w.phase = 'snarl';
      w.facing = player.x < w.x ? 1 : 2;
      continue;
    }

    // Wandering: walk to a spot, stand a while, pick another. At dawn a wolf far from home walks back.
    const homeFar = !night && Math.hypot(w.x - w.den.x, w.y - w.den.y) > WOLF_GUARD * 1.5;
    if (w.phase === 'walk' || w.phase === 'run' || homeFar) {
      if (
        homeFar &&
        (!w.target || Math.hypot(w.target.x - w.den.x, w.target.y - w.den.y) > WOLF_GUARD)
      )
        w.target = wanderSpot(w, false, random);
      if (
        !w.target ||
        stepToward(state, w, w.target.x, w.target.y, night ? WOLF_WALK * 1.6 : WOLF_WALK, dt) !==
          'moved'
      )
        Object.assign(w, { phase: 'idle', left: 1 + random() * (night ? 2 : 5), clock: 0 });
      else w.phase = 'walk';
    } else {
      w.phase = 'idle';
      w.left -= dt;
      if (w.left <= 0)
        Object.assign(w, { phase: 'walk', target: wanderSpot(w, night, random), clock: 0 });
    }
  }
  return events;
}

/**
 * Drives the wolves back (R): the player throws their arms wide and shoves, and every wolf within
 * REPEL_REACH is pushed REPEL_PUSH away and stands stunned for REPEL_STUN seconds. Once every
 * REPEL_EVERY seconds.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state, which plays the `repel` clip.
 * @returns {{ok: boolean, pushed?: number, reason?: string}} How many wolves were pushed, or why not:
 *   'busy', 'aboard' or 'wait' (too soon after the last one).
 */
export function repel(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  if (state.aboard) return { ok: false, reason: 'aboard' };
  if (state.time - repelledAt < REPEL_EVERY) return { ok: false, reason: 'wait' };
  repelledAt = state.time;
  startAction(animator, 'repel', null, REPEL_SECONDS);
  let pushed = 0;
  for (const w of WOLVES) {
    if (!wolfAlive(w)) continue;
    const dx = w.x - state.player.x,
      dy = w.y - state.player.y,
      d = Math.hypot(dx, dy);
    if (d > REPEL_REACH) continue;
    // Pushed back in small steps, stopping at anything in the way.
    const ux = d ? dx / d : 1,
      uy = d ? dy / d : 0;
    for (let moved = 0; moved < REPEL_PUSH; moved += 10) {
      if (!isWalkable(w.x + ux * 10, w.y + uy * 10)) break;
      w.x += ux * 10;
      w.y += uy * 10;
    }
    w.stunFor = REPEL_STUN;
    w.phase = 'idle';
    pushed++;
  }
  return { ok: true, pushed };
}

/** Lets the player repel again at once and clears the pack's bite wait: for tests, and when a game is opened. */
export function resetRepel() {
  repelledAt = -Infinity;
  packWait = 0;
}
