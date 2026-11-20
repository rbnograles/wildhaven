// What the villagers of Hollowstead do each frame: rest, find a way to their work, do it, carry
// what it gave to their drop spot, set it down, and start again. Each has their own job (see
// data/npcs.js). Nothing here is saved; world/npcs.js holds where they are meanwhile.

import { VILLAGERS, toward } from '../world/npcs.js';
import { isWalkable } from '../world/map.js';
import { nodeBases, goneSupplies, wreckBases } from '../world/nodes.js';
import { campBases } from '../world/camps.js';
import { findPath } from './approach.js';
import {
  NPC_SPEED,
  NPC_STOP,
  NPC_REST_MIN,
  NPC_REST_MAX,
  NPC_WORK_SECONDS,
  NPC_DEPOSIT_SECONDS,
  NPC_ARRIVE,
  NPC_RETRY,
} from '../data/balance.js';

/**
 * Makes the check for where a villager may stand right now.
 *
 * Villagers walk round the same things the player does: water, cliffs, houses, trees and rocks
 * still standing, supplies still standing, old boats and campfires. Other villagers and the
 * player are not in it: a villager stops for the player instead (see `tickVillagers`).
 *
 * @param {object} state - The game being played.
 * @returns {Function} `(x, y)` → true if a villager may step onto that spot.
 */
export function villagerFooting(state) {
  const bases = [...nodeBases(goneSupplies(state)), ...wreckBases(state.boat), ...campBases(state)];
  /** True for a chopped tree or mined rock that has not grown back: it can be walked through. */
  const skip = (id) => state.regrowAt[id] > state.time;

  return (x, y) => isWalkable(x, y, bases, true, skip);
}

/**
 * Plans a villager's walk to their work spot or their drop spot.
 *
 * The path search brings them close to the spot; the spot itself is added as the last step, so
 * they end up standing exactly where the job says.
 *
 * @param {object} state - The game being played.
 * @param {object} villager - The villager (see `VILLAGERS`); `heading` says which spot.
 * @returns {{x: number, y: number}[]|null} The spots to walk through, or null if there is no way.
 */
export function planErrand(state, villager) {
  const spot = villager.npc.job[villager.heading],
    path = findPath(villagerFooting(state), villager, spot, NPC_ARRIVE);

  return path && [...path, { x: spot.x, y: spot.y }];
}

/**
 * Puts a villager into a phase that lasts a set time, standing still.
 *
 * @param {object} villager - The villager.
 * @param {string} phase - `rest`, `wait`, `work` or `deposit`.
 * @param {number} seconds - How long it lasts.
 */
function settle(villager, phase, seconds) {
  Object.assign(villager, { phase, left: seconds, moving: false, clock: 0 });
}

/**
 * Moves one walking villager a step along their path, and starts the work or the setting down
 * when they arrive.
 *
 * @param {object} villager - The villager.
 * @param {Function} free - `(x, y)` → true if a villager may stand there.
 * @param {number} dt - Seconds since the last frame.
 */
function walkOn(villager, free, dt) {
  const { job } = villager.npc;

  // Arrived at the last spot: turn the way the job faces and begin.
  if (villager.i >= villager.path.length) {
    const spot = job[villager.heading];
    villager.facing = spot.facing;
    if (villager.heading === 'work') settle(villager, 'work', NPC_WORK_SECONDS[spot.clip]);
    else settle(villager, 'deposit', NPC_DEPOSIT_SECONDS);
    return;
  }

  // One step toward the next spot on the path.
  const next = villager.path[villager.i],
    dx = next.x - villager.x,
    dy = next.y - villager.y,
    left = Math.hypot(dx, dy),
    step = Math.min(left, NPC_SPEED * dt);
  if (left < 1) {
    Object.assign(villager, { x: next.x, y: next.y, i: villager.i + 1 });
    return;
  }

  // Try the straight step first. If a corner is in the way, slide along it sideways or up and
  // down instead, the way the player does. A villager who is somehow inside something solid
  // (a fire lit right beside them) may always step, so they can walk out of it.
  const stepX = (dx / left) * step,
    stepY = (dy / left) * step,
    stuckInside = !free(villager.x, villager.y);
  const tries = [
    [stepX, stepY],
    [Math.sign(dx) * Math.min(Math.abs(dx), step), 0],
    [0, Math.sign(dy) * Math.min(Math.abs(dy), step)],
  ].filter(([mx, my]) => mx || my);
  const move = tries.find(([mx, my]) => stuckInside || free(villager.x + mx, villager.y + my));

  // Something now stands squarely in the way (a new campfire, a supply that grew back): stop,
  // then look for another way round.
  if (!move) {
    settle(villager, 'wait', NPC_RETRY);
    return;
  }
  const x = villager.x + move[0],
    y = villager.y + move[1];

  // The carrying pictures only face sideways, so a loaded villager never turns north or south.
  const sideways = dx < 0 ? 1 : dx > 0 ? 2 : villager.facing === 1 ? 1 : 2;
  villager.facing = villager.carrying ? sideways : toward(dx, dy);
  Object.assign(villager, { x, y, moving: true });
  villager.clock += dt;
}

/**
 * Moves every villager a little further through their job.
 *
 * Each villager does the same round over and over, like a baker's morning: rest a moment, walk
 * to the work spot, work, carry the result to the drop spot, set it down, rest again. A walking
 * villager stops whenever the player is close, so they never bump into the player and are easy
 * to walk up to. If the way is blocked they wait a moment and look for another way.
 *
 * @param {object} state - The game being played (the player's spot and what is solid are read).
 * @param {number} dt - Seconds since the last frame.
 * @param {Function} [random=Math.random] - Gives a number from 0 to 1; tests pass their own.
 */
export function tickVillagers(state, dt, random = Math.random) {
  const free = villagerFooting(state);

  for (const villager of VILLAGERS) {
    // Walking: stand still for a player who is close, otherwise step on.
    if (villager.phase === 'walk') {
      const close =
        !state.aboard &&
        Math.hypot(state.player.x - villager.x, state.player.y - villager.y) <= NPC_STOP;
      if (close) villager.moving = false;
      else walkOn(villager, free, dt);
      continue;
    }

    // Every other phase runs for a set time.
    villager.clock += dt;
    villager.left -= dt;
    if (villager.left > 0) continue;

    if (villager.phase === 'work') {
      // The work is done: pick up what it gave and look for the way to the drop spot.
      Object.assign(villager, { carrying: true, heading: 'drop' });
      settle(villager, 'wait', 0);
    } else if (villager.phase === 'deposit') {
      // The load is down: rest a while before the next round.
      villager.carrying = false;
      settle(villager, 'rest', NPC_REST_MIN + random() * (NPC_REST_MAX - NPC_REST_MIN));
    } else if (villager.phase === 'rest') {
      villager.heading = 'work';
      settle(villager, 'wait', 0);
    }

    // Waiting for a way: plan the walk, or wait a little longer if there is none yet.
    if (villager.phase === 'wait') {
      const path = planErrand(state, villager);
      if (path) Object.assign(villager, { phase: 'walk', path, i: 0, clock: 0 });
      else settle(villager, 'wait', NPC_RETRY);
    }
  }
}
