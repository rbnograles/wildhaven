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
  SWORD_SECONDS,
  BOW_SECONDS,
  ARROW_PER_SHOT,
  BOW_REACH,
  ANIMAL_RETURN,
  ANIMAL_DOWN_SECONDS,
} from '../data/balance.js';
import { ANIMALS } from '../data/animals.js';
import { isWalkable } from '../world/map.js';
import { WILD_ANIMALS, animalById, isAlive, wanderSpot } from '../world/animals.js';
import { WOLVES } from '../world/wolves.js';
import { nextDusk } from './wolves.js';
import { hasTool, toolTier, wearTool } from '../world/tools.js';
import { facing } from './move.js';
import { BAG_FULL, addItem, hasRoomFor } from '../world/bag.js';
import { startAction, slantOf } from '../animation/clips.js';
import { weaponDamage } from './combat.js';

/** The start of a timed hunting action's target: `hunt:<animal id>`. */
export const HUNT_PREFIX = 'hunt:';

// How far from the player an animal is still worth moving each frame; farther ones wait, unseen.
const AWAKE = 3000;

/**
 * Moves an animal a step toward a spot, or says it could not.
 *
 * @param {object} a - The animal. Its position, facing and slant change.
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
  a.slant = slantOf(dx, dy)?.[0] ?? null;
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
        Object.assign(a, {
          phase: 'idle',
          x: a.herd.x,
          y: a.herd.y,
          hp: ANIMALS[a.kind].hp,
          left: 2,
          clock: 0,
        });
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

/** The things that can hunt, best first for a hunt up close: a sword is quicker than an axe. */
const CLOSE_WEAPONS = ['sword', 'axe'];

/**
 * Says whether the player owns anything to hunt with: an axe, a sword or a bow.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True if they do.
 */
export const canHunt = (state) => [...CLOSE_WEAPONS, 'bow'].some((tool) => hasTool(state, tool));

/** True when the player has at least one arrow to loose from a bow. */
const hasArrows = (state) => state.resources.arrow >= ARROW_PER_SHOT;

/**
 * Says how far away the player can hunt from: a bow's reach when they own one, else arm's length.
 *
 * @param {object} state - The game being played.
 * @returns {number} The distance, in world units.
 */
export function huntReach(state) {
  const bow = hasArrows(state) ? toolTier(state, 'bow') : null;
  return bow ? Math.max(HUNT_REACH, BOW_REACH[bow]) : HUNT_REACH;
}

/**
 * Picks what the player would hunt with at a distance, like choosing between a knife and a sling.
 *
 * Up close it is the sword if they own one (quicker), else the axe. Farther off only a bow
 * reaches; a player with only a bow uses it up close too.
 *
 * @param {object} state - The game being played.
 * @param {number} d - How far away the animal is.
 * @returns {{tool: string, seconds: number}|null} The weapon's id and how long the hunt takes with
 *   it, or null when nothing they own reaches that far.
 */
export function huntWeapon(state, d) {
  if (d <= HUNT_REACH) {
    const tool = CLOSE_WEAPONS.find((t) => hasTool(state, t));
    if (tool === 'sword') return { tool, seconds: SWORD_SECONDS[toolTier(state, 'sword')] };
    if (tool) return { tool, seconds: HUNT_SECONDS };
  }
  // A bow reaches far, but only while there are arrows to loose.
  const bow = hasArrows(state) ? toolTier(state, 'bow') : null;
  return bow && d <= BOW_REACH[bow] ? { tool: 'bow', seconds: BOW_SECONDS } : null;
}

/**
 * Picks the swing animation for a weapon, in the metal the player owns.
 *
 * The axe keeps its chopping swing, a sword gets its own slash, and a bow its draw-and-loose. Each
 * has a stone and an iron picture, so an iron weapon shows the iron art.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The weapon's id: 'axe', 'sword' or 'bow'.
 * @returns {string} The clip name, such as 'chop', 'swordIron' or 'bow'.
 */
export function huntClip(state, tool) {
  const base = tool === 'axe' ? 'chop' : tool;
  return base + (toolTier(state, tool) === 'iron' ? 'Iron' : '');
}

/**
 * Finds the animal the player could hunt now: the closest one out and about within reach. A wolf
 * counts too: fighting one is the same swing.
 *
 * @param {object} state - The game being played.
 * @param {number} [reach=HUNT_REACH] - How far to look: arm's length unless told otherwise (pass
 *   `huntReach(state)` to look as far as a bow shoots).
 * @returns {object|null} The animal, or null.
 */
export function huntable(state, reach = HUNT_REACH) {
  if (state.aboard) return null;
  let best = null,
    bestD = reach;
  for (const a of [...WILD_ANIMALS, ...WOLVES]) {
    if (!isAlive(a)) continue;
    const d = Math.hypot(state.player.x - a.x, state.player.y - a.y);
    if (d <= bestD) [best, bestD] = [a, d];
  }
  return best;
}

/**
 * Starts hunting an animal in reach: the swing (the weapon's own clip — the axe chops, the sword
 * slashes, the bow draws and looses) runs for as long as the weapon takes. The player turns to face
 * it. With nothing to hunt with, nothing starts.
 *
 * @param {object} state - The game being played. The player's facing changes.
 * @param {object} animator - The player's animation state.
 * @param {object} animal - The animal.
 * @returns {{ok: boolean, tool?: string, reason?: string, message?: string}} Whether the hunt
 *   started (and the weapon used), or why not: 'busy', 'tool' (no axe, sword or bow), 'far' or
 *   'full' (no room for the food).
 */
export function beginHunt(state, animator, animal) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  if (!canHunt(state))
    return {
      ok: false,
      reason: 'tool',
      message: 'You need an axe, a sword or a bow to hunt. Make one in the Build menu (B).',
    };
  if (!animal || !isAlive(animal)) return { ok: false, reason: 'far' };
  const weapon = huntWeapon(
    state,
    Math.hypot(state.player.x - animal.x, state.player.y - animal.y),
  );
  // A bow with no arrows and no close weapon: say so instead of a silent miss.
  if (
    !weapon &&
    hasTool(state, 'bow') &&
    !hasArrows(state) &&
    !hasTool(state, 'sword') &&
    !hasTool(state, 'axe')
  )
    return {
      ok: false,
      reason: 'arrows',
      message: 'Out of arrows · Fletch more in the Build menu (B)',
    };
  if (!weapon) return { ok: false, reason: 'far' };
  // A wolf gives nothing; any other animal's food needs room in the item box.
  if (!animal.den && !hasRoomFor(state, { food: ANIMALS[animal.kind].food }))
    return { ok: false, reason: 'full', message: BAG_FULL };
  state.player.direction = facing(animal.x - state.player.x, 0) === 1 ? 1 : 2;
  startAction(animator, huntClip(state, weapon.tool), `${HUNT_PREFIX}${animal.id}`, weapon.seconds);
  return { ok: true, tool: weapon.tool };
}

/**
 * Gives one creature the rewards for being felled, and lays it down.
 *
 * A wolf gives only its pelt and is back at its den next dusk. Any other animal gives its food (and
 * for a deer sometimes an antler) and its hide, and comes back to its herd a day later. An animal
 * whose food has no room in the bag is not felled: the caller leaves it wounded instead.
 *
 * @param {object} state - The game being played. Resources change.
 * @param {object} a - The creature (already at 0 hp).
 * @param {() => number} roll - Gives 0 to 1, for the antler.
 * @returns {{animal: string, food: number, leather?: number, pelt?: number, antler: boolean}|null}
 *   The reward, or null when a full bag means an animal is not felled after all.
 */
function fellCreature(state, a, roll) {
  // A wolf's thick pelt is the reward for a dangerous fight; it is left behind if the bag is full.
  if (a.den) {
    Object.assign(a, { phase: 'down', clock: 0, respawnAt: nextDusk(state.time) });
    const pelt = addItem(state, 'wolfpelt') ? 1 : 0;
    return { animal: 'wolf', food: 0, pelt, antler: false };
  }
  // The bag is checked again: it may have filled since the swing began.
  const kind = ANIMALS[a.kind];
  if (!hasRoomFor(state, { food: kind.food })) return null;
  const rolled = roll() < kind.antler;
  Object.assign(a, { phase: 'down', clock: 0, respawnAt: state.time + ANIMAL_RETURN });
  addItem(state, 'food', kind.food);
  // The hide and an antler are extras: one with no room in the item box is left behind.
  const leather = addItem(state, 'leather', kind.leather) ? kind.leather : 0;
  const antler = rolled && addItem(state, 'antler');
  return { animal: kind.name, food: kind.food, leather, antler };
}

/**
 * Lands one hit on a creature: takes the damage off its hit points, and fells it if that empties them.
 *
 * A wounded animal bolts (a wounded wolf keeps coming). If a killing blow lands on an animal but the
 * bag has no room for its food, the hit is wasted and the animal stays up, so a full bag never loses
 * a kill into thin air.
 *
 * @param {object} state - The game being played.
 * @param {object} creature - The animal or wolf being hit.
 * @param {number} damage - How much to take off.
 * @param {() => number} [roll=Math.random] - For a deer's antler.
 * @returns {{dead: boolean, reward?: object, blocked?: boolean}} Whether it fell and the reward, or
 *   `blocked` when a full bag stopped an animal's kill.
 */
export function applyHit(state, creature, damage, roll = Math.random) {
  if (creature.hp - damage > 0) {
    creature.hp -= damage;
    // Animals run from a wound; wolves press on.
    if (!creature.den) {
      if (creature.phase !== 'run') creature.clock = 0;
      Object.assign(creature, { phase: 'run', fleeFor: FLEE_SECONDS });
    }
    return { dead: false };
  }
  const reward = fellCreature(state, creature, roll);
  if (!reward) return { dead: false, blocked: true };
  creature.hp = 0;
  return { dead: true, reward };
}

/**
 * Confirms a weapon the mouse combat chose is still usable on a target at distance `d`.
 *
 * The player must still own it, and the target must be within that weapon's reach (a bow's long
 * reach, or arm's length for a sword or axe).
 *
 * @param {object} state - The game being played.
 * @param {string} tool - 'sword', 'bow' or 'axe'.
 * @param {number} d - How far the target is (already made a little lenient by the caller).
 * @returns {{tool: string}|null} The weapon, or null when it can't be used now.
 */
function forcedWeapon(state, tool, d) {
  if (!hasTool(state, tool)) return null;
  if (tool === 'bow') return d <= BOW_REACH[toolTier(state, 'bow')] ? { tool } : null;
  return d <= HUNT_REACH ? { tool } : null;
}

/**
 * Finishes a hunt when its timed action runs out: it deals ONE hit to the creature. The creature
 * is felled (and its food, hide and maybe an antler go into the backpack) only when that hit
 * empties its hit points; otherwise it is wounded and the result says `wounded: true`. The weapon
 * used wears a use if it is a stone one, as chopping wears an axe.
 *
 * The target is `hunt:<id>` (the best weapon is picked, full damage) or
 * `hunt:<id>:<weapon>:<tenths>` (the mouse combat chose the weapon and how charged it was, in
 * tenths from 0 to 10).
 *
 * @param {object} state - The game being played. Resources change.
 * @param {string} target - Such as 'hunt:herd-meadows-2-1' or 'hunt:herd-meadows-2-1:bow:7'.
 * @param {() => number} [roll] - Gives a number from 0 to 1, for the antler; tests pass their own.
 * @returns {{kind: 'hunt', animal: string, food?: number, leather?: number, pelt?: number,
 *   antler?: boolean, wounded?: boolean, wear: string|null}|null}
 *   What the hit did (`wounded: true` when the creature is still up; `animal` 'wolf' and no food
 *   for a wolf), or null when it got away (it is gone, too far now, or nothing can be used).
 */
export function finishHunt(state, target, roll = Math.random) {
  const [id, forcedTool, chargeTag] = target.slice(HUNT_PREFIX.length).split(':');
  const a = animalById(id) ?? WOLVES.find((w) => w.id === id);
  if (!a || !isAlive(a)) return null;

  // The creature may have shifted a little during the swing: half as far again still counts.
  const d = Math.hypot(state.player.x - a.x, state.player.y - a.y) / 1.5;
  const weapon = forcedTool ? forcedWeapon(state, forcedTool, d) : huntWeapon(state, d);
  if (!weapon) return null;

  // A bow spends an arrow per shot, hit or miss.
  if (weapon.tool === 'bow') {
    if (!hasArrows(state)) return null;
    state.resources.arrow -= ARROW_PER_SHOT;
  }

  const frac = chargeTag ? Number(chargeTag) / 10 : 1;
  const wear = wearTool(state, weapon.tool);
  const hit = applyHit(state, a, weaponDamage(state, weapon.tool, frac), roll);
  if (!hit.dead)
    return {
      kind: 'hunt',
      wounded: true,
      animal: a.den ? 'wolf' : ANIMALS[a.kind].name,
      wear,
    };
  return { kind: 'hunt', ...hit.reward, wear };
}
