// The "make gear" action: the torch, the feather coat, the antler grip and the rowboat, made from
// the Build menu out of the finds (feathers, pine cones, antlers) and, for the boat, wood and iron.
// Like crafting a tool, making takes time: beginMake starts it, and the game loop finishes it
// through finishMake, which checks everything again and only then pays, so nothing is paid twice.

import {
  GEAR_RECIPES,
  CRAFT_SECONDS,
  REPAIR_SECONDS,
  TORCH_SECONDS,
  TOOL_USES,
  GRIP_MAX,
  BOARD_RANGE,
} from '../data/balance.js';
import { gearInfo } from '../data/gear.js';
import { TOOL_IDS, toolInfo } from '../data/tools.js';
import { isSailable } from '../world/map.js';
import { byFire } from '../world/camps.js';
import { listMissing, BUILT } from './boat.js';
import { CRAFT_PREFIX } from './craft.js';
import { facing } from './move.js';
import { startAction } from '../animation/clips.js';

/**
 * Finds the stone tool an antler grip would be fitted to: the most worn one.
 *
 * "Most worn" is by share of a new tool's uses, so a hammer with 3 of 10 left counts as more worn
 * than an axe with 10 of 25. A tool already at its limit (GRIP_MAX times a new one's uses) can't
 * take another grip, and iron tools never wear, so neither counts.
 *
 * @param {object} state - The game being played.
 * @returns {string|null} The tool's id, or null when no stone tool can take a grip.
 */
export function gripTool(state) {
  const worn = TOOL_IDS.filter((id) => {
    const tool = state.tools[id];
    return tool?.tier === 'stone' && tool.uses < TOOL_USES[id] * GRIP_MAX;
  }).sort((a, b) => state.tools[a].uses / TOOL_USES[a] - state.tools[b].uses / TOOL_USES[b]);
  return worn[0] ?? null;
}

/**
 * Finds the closest water a new boat could be launched on from where the player stands.
 *
 * It checks rings of spots around the player, 16 units apart and growing outward, like ripples
 * from a stone dropped in water, and keeps the first spot a boat can float on. The rings stay
 * inside BOARD_RANGE, so the player can always step into the boat they just built.
 *
 * @param {object} state - The game being played.
 * @returns {{x: number, y: number}|null} The spot, or null when no water is close enough.
 */
export function launchSpot(state) {
  for (let r = 32; r < BOARD_RANGE; r += 16)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2,
        x = Math.round(state.player.x + Math.cos(angle) * r),
        y = Math.round(state.player.y + Math.sin(angle) * r);
      if (isSailable(x, y)) return { x, y };
    }
  return null;
}

/**
 * Says why a piece of gear can't be made because the player already has it, if that is so.
 *
 * @param {object} state - The game being played.
 * @param {string} id - The gear's id.
 * @returns {string} The message, or '' when nothing of the kind is in the way.
 */
function alreadyHas(state, id) {
  if (id === 'torch' && state.torch > 0) return 'Your torch is still burning';
  if (id === 'coat' && state.coat) return 'You already wear a feather coat';
  if (id === 'boat' && state.boat) return 'You already have a boat';
  if (id === 'backpack' && state.backpack) return 'You already carry a backpack';
  return '';
}

/**
 * Checks whether the player can make a piece of gear right now, without changing anything.
 *
 * The first rule that fails is the answer, in the order that helps most: they already have it,
 * they are sitting in the boat, the backpack is short, or they are in the wrong place (the coat is
 * sewn by one of their campfires, the boat is built beside water, the grip needs a stone tool).
 *
 * @param {object} state - The game being played.
 * @param {string} id - The gear's id: 'torch', 'coat', 'grip', 'boat' or 'backpack'.
 * @returns {{ok: boolean, cost: object, reason?: string, message?: string, tool?: string,
 *   spot?: object}} `ok` with the cost (and the `tool` a grip goes on, or the water `spot` a boat
 *   is launched at); otherwise `reason` ('owned', 'aboard', 'cost', 'tool', 'fire' or 'water')
 *   and a `message` to show.
 */
export function canMake(state, id) {
  const cost = GEAR_RECIPES[id];
  const owned = alreadyHas(state, id);
  if (owned) return { ok: false, cost, reason: 'owned', message: owned };
  if (state.aboard) return { ok: false, cost, reason: 'aboard', message: 'Step ashore to craft' };

  // The backpack: say what is still missing.
  const missing = Object.fromEntries(
    Object.entries(cost)
      .map(([type, n]) => [type, n - state.resources[type]])
      .filter(([, short]) => short > 0),
  );
  if (Object.keys(missing).length)
    return { ok: false, cost, reason: 'cost', message: `Needs ${listMissing(missing)} more` };

  // The place, or the tool the grip goes on.
  if (id === 'coat' && !byFire(state))
    return { ok: false, cost, reason: 'fire', message: 'Sew the coat beside your campfire' };
  if (id === 'grip') {
    const tool = gripTool(state);
    return tool
      ? { ok: true, cost, tool }
      : { ok: false, cost, reason: 'tool', message: 'You have no stone tool to fit a grip to' };
  }
  if (id === 'boat') {
    const spot = launchSpot(state);
    return spot
      ? { ok: true, cost, spot }
      : { ok: false, cost, reason: 'water', message: 'Build a boat at the water’s edge' };
  }
  return { ok: true, cost };
}

/**
 * Starts making a piece of gear: what picking it in the Build menu does.
 *
 * It only starts the timed action; nothing is paid yet. The boat takes as long as mending an old
 * one and uses the hammering `build` clip; the rest take CRAFT_SECONDS with the `craft` clip.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {string} id - The gear's id.
 * @returns {object} canMake's answer, or `{ok: false, reason: 'busy'}` while another action runs.
 */
export function beginMake(state, animator, id) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const check = canMake(state, id);
  if (!check.ok) return check;
  const boat = id === 'boat';
  startAction(
    animator,
    boat ? 'build' : 'craft',
    `${CRAFT_PREFIX}${id}`,
    boat ? REPAIR_SECONDS : CRAFT_SECONDS,
  );
  return check;
}

/**
 * Makes the gear when its action finishes.
 *
 * Everything is checked again first, because the backpack or the player's spot may have changed
 * while they worked. Then the cost is paid and the gear takes effect in one step: the torch
 * starts burning, the coat is worn for good, the backpack opens the item box's second row, the grip adds a new tool's worth of uses to the most
 * worn stone tool (up to GRIP_MAX times a new one's), and the boat floats on the water beside the
 * player, which is also where it drifts back to if it is ever left behind.
 *
 * @param {object} state - The game being played. Resources and the gear's own field change.
 * @param {string} id - The gear's id.
 * @returns {{ok: boolean, gear: string, tool?: string, reason?: string, message?: string}} On
 *   success the gear made (and the `tool` a grip went on); otherwise canMake's reason and message,
 *   with nothing changed.
 */
export function finishMake(state, id) {
  const check = canMake(state, id);
  if (!check.ok) return { ...check, gear: id };

  for (const [type, n] of Object.entries(check.cost)) state.resources[type] -= n;
  if (id === 'torch') state.torch = TORCH_SECONDS;
  if (id === 'coat') state.coat = true;
  if (id === 'backpack') state.backpack = true;
  if (id === 'grip') {
    const tool = state.tools[check.tool];
    tool.uses = Math.min(tool.uses + TOOL_USES[check.tool], TOOL_USES[check.tool] * GRIP_MAX);
  }
  if (id === 'boat') {
    const { x, y } = check.spot,
      dir = facing(x - state.player.x, y - state.player.y);
    state.boat = { from: BUILT, home: { x, y, dir }, x, y, dir };
  }
  return { ok: true, gear: id, ...(check.tool ? { tool: check.tool } : {}) };
}

/**
 * Puts a finished piece of gear into words for a toast.
 *
 * @param {{gear: string, tool?: string}} finished - What finishMake returned on success.
 * @returns {string} Such as "Torch lit" or "Antler grip fitted to your stone axe".
 */
export function madeWords(finished) {
  const { made } = gearInfo(finished.gear);
  return finished.tool ? `${made} to your stone ${toolInfo(finished.tool).name}` : made;
}
