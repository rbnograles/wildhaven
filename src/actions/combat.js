// Combat maths and target-picking, shared by the E hunt and the mouse combat. Pure: no renderer,
// no input, no DOM. It works out how much damage a weapon does, how much a creature can take, and
// which creature a swing or an aimed shot is pointed at.

import { WEAPON_DAMAGE, WOLF_HP, HUNT_REACH, BOW_REACH } from '../data/balance.js';
import { ANIMALS } from '../data/animals.js';
import { toolTier } from '../world/tools.js';
import { WILD_ANIMALS, isAlive } from '../world/animals.js';
import { WOLVES } from '../world/wolves.js';

/**
 * Says how many hit points a creature can take before it falls.
 *
 * Wolves all share one number (they carry a `den`); each kind of animal has its own, from the
 * animal table.
 *
 * @param {object} creature - An animal or a wolf.
 * @returns {number} Its full hit points.
 */
export function creatureMaxHp(creature) {
  return creature.den ? WOLF_HP : ANIMALS[creature.kind].hp;
}

/**
 * Works out how much damage one hit with a weapon deals, from its tier and how charged the shot is.
 *
 * A tap ("quick release", charge 0) deals about half; a full hold (charge 1) deals the tier's full
 * damage; it slides between the two. Never below 1, so a hit always counts.
 *
 * @param {object} state - The game being played (to read the weapon's tier).
 * @param {string} tool - The weapon's id: 'sword', 'bow' or 'axe'.
 * @param {number} [chargeFrac=1] - How charged the shot is, 0 to 1. The E hunt is always 1.
 * @returns {number} The damage, a whole number of at least 1.
 */
export function weaponDamage(state, tool, chargeFrac = 1) {
  const full = WEAPON_DAMAGE[tool]?.[toolTier(state, tool)] ?? 1;
  const frac = Math.min(Math.max(chargeFrac, 0), 1);
  return Math.max(1, Math.floor(full * (0.5 + 0.5 * frac)));
}

/**
 * Picks the creature an aimed bow shot would lock onto: the one nearest the cursor, among those
 * within the bow's reach of the player.
 *
 * @param {object} state - The game being played.
 * @param {number} wx - Where the cursor points, world x.
 * @param {number} wy - Where the cursor points, world y.
 * @returns {object|null} The locked creature, or null when none is in reach.
 */
export function aimTarget(state, wx, wy) {
  const reach = BOW_REACH[toolTier(state, 'bow')] ?? 0;
  let best = null,
    bestD = Infinity;
  for (const c of [...WILD_ANIMALS, ...WOLVES]) {
    if (!isAlive(c)) continue;
    if (Math.hypot(state.player.x - c.x, state.player.y - c.y) > reach) continue;
    const d = Math.hypot(wx - c.x, wy - c.y);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

/**
 * Picks the creature a sword swing would hit: the nearest one within arm's length of the player.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The creature, or null when none is close enough.
 */
export function meleeTarget(state) {
  let best = null,
    bestD = HUNT_REACH;
  for (const c of [...WILD_ANIMALS, ...WOLVES]) {
    if (!isAlive(c)) continue;
    const d = Math.hypot(state.player.x - c.x, state.player.y - c.y);
    if (d <= bestD) [best, bestD] = [c, d];
  }
  return best;
}
