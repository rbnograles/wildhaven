// The "build at a camp" actions: putting up a tent, a storage chest, a wheat bed or a camp centre
// (or raising the centre a tier), moving resources in and out of a chest, and sowing, tending and
// harvesting a wheat bed. Building and farming take time: a begin function starts the timed action
// and the game loop's finish function checks everything again and only then pays, so nothing is
// paid twice and a cancelled job costs nothing.

import {
  BUILDING_COSTS,
  BUILD_SECONDS,
  BUILDING_LIMITS,
  PLACE_RANGE,
  NODE_CLEARANCE,
  SOW_COST,
  GROW_SECONDS,
  HARVEST_FOOD,
  FARM_SECONDS,
} from '../data/balance.js';
import { RESOURCES } from '../data/supplies.js';
import { BAG_FULL, TENT_ITEM, addItem, hasRoomFor, tidyBag } from '../world/bag.js';
import { buildingInfo } from '../data/buildings.js';
import { isWalkable, blocks } from '../world/map.js';
import { NODES, solidBases } from '../world/nodes.js';
import { campAt, centreOf, plotOf } from '../world/buildings.js';
import { listMissing } from './boat.js';
import { startAction } from '../animation/clips.js';

/** The start of a timed building action's target: `building:<kind>:<x>:<y>`, or `building:raise:<camp id>`. */
export const BUILDING_PREFIX = 'building:';

/** The start of a timed farming action's target: `farm:<building id>:<sow|tend|harvest>`. */
export const FARM_PREFIX = 'farm:';

// The spacing, in world units, of the test points poked across a building's plot (see plotIsClear).
const PROBE = 16;

/**
 * Says what a building of some kind costs next: the centre's cost depends on the tier it is going to.
 *
 * @param {string} kind - The building's kind.
 * @param {number} [tier=1] - For the centre, the tier being built.
 * @returns {object} The cost, such as {wood: 8, stone: 2}.
 */
export const costOf = (kind, tier = 1) =>
  kind === 'centre' ? BUILDING_COSTS.centre[tier - 1] : BUILDING_COSTS[kind];

/**
 * Says what putting up a building costs this player right now.
 *
 * It is costOf, but a tent carried packed in the item box is pitched for nothing: it was paid for
 * when it was first made.
 *
 * @param {object} state - The game being played.
 * @param {string} kind - The building's kind.
 * @returns {object} The cost, such as {wood: 8, stone: 2}, or {} for a packed tent.
 */
export const priceOf = (state, kind) =>
  kind === TENT_ITEM && state.packedTent ? {} : costOf(kind);

/**
 * Says whether the player has a tent standing at any of their camps.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True when a tent stands somewhere.
 */
export const hasTent = (state) =>
  state.camps.some((camp) => (camp.buildings ?? []).some((b) => b.kind === 'tent'));

/**
 * Lists what the backpack is short of for a cost.
 *
 * @param {object} state - The game being played.
 * @param {object} cost - Such as {wood: 8, stone: 2}.
 * @returns {object} Each resource still missing and how many, empty when there is enough.
 */
const shortOf = (state, cost) =>
  Object.fromEntries(
    Object.entries(cost)
      .map(([type, n]) => [type, n - state.resources[type]])
      .filter(([, short]) => short > 0),
  );

/**
 * Says whether a building's plot would stand on open ground: every test point across it must be
 * clear of water, scenery, supplies, fires, other buildings and the player.
 *
 * @param {object} state - The game being played.
 * @param {number[]} plot - The plot as [left, top, right, bottom].
 * @returns {boolean} True when the whole plot is clear.
 */
function plotIsClear(state, plot) {
  const [left, top, right, bottom] = plot;
  const solid = solidBases(state);
  if (blocks([plot], state.player.x, state.player.y)) return false;
  for (let py = top; py < bottom + PROBE; py += PROBE)
    for (let px = left; px < right + PROBE; px += PROBE)
      if (!isWalkable(Math.min(px, right), Math.min(py, bottom), solid)) return false;
  return true;
}

/**
 * Checks whether a building may go up at a spot, without changing anything.
 *
 * The first rule that fails is the answer: in the boat, not enough in the backpack, too far from
 * the player, not inside one of the player's fires' warmth, the camp already has as many as it may,
 * or something is in the way. A tent is refused before the rest while the player has one standing
 * at any camp: there is one tent per player. A tent carried packed costs nothing. The camp centre is raised a tier instead when its camp has one: see
 * checkRaise.
 *
 * @param {object} state - The game being played.
 * @param {string} kind - Which building: 'tent', 'chest', 'farm' or 'centre'.
 * @param {number} x - World x of the spot.
 * @param {number} y - World y of the spot.
 * @returns {{ok: boolean, camp?: object, cost?: object, reason?: string, message?: string}} `ok`
 *   and the camp it would belong to; otherwise `reason` ('aboard', 'cost', 'far', 'camp', 'limit' or
 *   'blocked') and a `message` to show.
 */
export function checkBuilding(state, kind, x, y) {
  const info = buildingInfo(kind);
  if (!info) return { ok: false, reason: 'unknown', message: 'Nothing to build' };
  const cost = priceOf(state, kind);
  if (state.aboard) return { ok: false, cost, reason: 'aboard', message: 'Step ashore to build' };
  // A player owns one tent in the whole world: to move it, pack it up at its camp first.
  if (kind === 'tent' && hasTent(state))
    return {
      ok: false,
      cost,
      reason: 'limit',
      message: 'You already have a tent · Pack it up at its camp to move it',
    };
  const missing = shortOf(state, cost);
  if (Object.keys(missing).length)
    return { ok: false, cost, reason: 'cost', message: `Needs ${listMissing(missing)} more` };
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.hypot(x - state.player.x, y - state.player.y) > PLACE_RANGE
  )
    return { ok: false, cost, reason: 'far', message: 'Too far away' };

  const camp = campAt(state, x, y);
  if (!camp)
    return { ok: false, cost, reason: 'camp', message: 'Build it within the warmth of your fire' };
  const count = (camp.buildings ?? []).filter((b) => b.kind === kind).length;
  if (count >= BUILDING_LIMITS[kind])
    return {
      ok: false,
      cost,
      reason: 'limit',
      message: `${camp.name} has its ${info.name}${count > 1 ? 's' : ''} already`,
    };

  const plot = plotOf(kind, info.sprite, x, y);
  if (
    Math.hypot(camp.x - x, camp.y - y) < 90 ||
    NODES.some((n) => !n.inScenery && Math.hypot(n.x - x, n.y - y) < NODE_CLEARANCE) ||
    !plotIsClear(state, plot)
  )
    return { ok: false, cost, reason: 'blocked', message: 'Something is in the way' };
  return { ok: true, cost, camp };
}

/**
 * Checks whether the centre of the camp the player stands in may be raised a tier.
 *
 * @param {object} state - The game being played.
 * @returns {{ok: boolean, camp?: object, centre?: object, cost?: object, reason?: string,
 *   message?: string}} The camp, its centre and the next tier's cost; or why not: 'none' (no
 *   centre here: build one first), 'top' (already a big hall), 'aboard' or 'cost'.
 */
export function checkRaise(state) {
  const camp = campAt(state, state.player.x, state.player.y),
    centre = camp && centreOf(camp);
  if (!centre) return { ok: false, reason: 'none' };
  if (centre.tier >= BUILDING_COSTS.centre.length)
    return {
      ok: false,
      camp,
      centre,
      reason: 'top',
      message: `${camp.name} has a big hall already`,
    };
  const cost = costOf('centre', centre.tier + 1);
  if (state.aboard)
    return { ok: false, camp, centre, cost, reason: 'aboard', message: 'Step ashore to build' };
  const missing = shortOf(state, cost);
  if (Object.keys(missing).length)
    return {
      ok: false,
      camp,
      centre,
      cost,
      reason: 'cost',
      message: `Needs ${listMissing(missing)} more`,
    };
  return { ok: true, camp, centre, cost };
}

/**
 * Starts putting up a building at a spot: the hammering `build` clip runs for its BUILD_SECONDS.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {string} kind - Which building.
 * @param {number} x - World x of the spot (rounded to whole units).
 * @param {number} y - World y of the spot.
 * @returns {object} The check from checkBuilding, or {ok: false, reason: 'busy'}.
 */
export function beginBuilding(state, animator, kind, x, y) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const spot = { x: Math.round(x), y: Math.round(y) };
  const check = checkBuilding(state, kind, spot.x, spot.y);
  if (!check.ok) return check;
  startAction(
    animator,
    'build',
    `${BUILDING_PREFIX}${kind}:${spot.x}:${spot.y}`,
    BUILD_SECONDS[kind],
  );
  return check;
}

/**
 * Starts raising the camp centre a tier, where it stands.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state.
 * @returns {object} The check from checkRaise, or {ok: false, reason: 'busy'}.
 */
export function beginRaise(state, animator) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const check = checkRaise(state);
  if (!check.ok) return check;
  startAction(animator, 'build', `${BUILDING_PREFIX}raise:${check.camp.id}`, BUILD_SECONDS.centre);
  return check;
}

/**
 * Reads a building action's target back into what is being built and where.
 *
 * @param {string} target - Such as 'building:tent:14120:9480' or 'building:raise:camp-2'.
 * @returns {{kind: string, x?: number, y?: number, campId?: string}|null} The parts, or null.
 */
export function readBuildTarget(target) {
  if (!target?.startsWith(BUILDING_PREFIX)) return null;
  const [kind, a, b] = target.slice(BUILDING_PREFIX.length).split(':');
  if (kind === 'raise') return { kind, campId: a };
  return { kind, x: Number(a), y: Number(b) };
}

/**
 * Finishes a building when its timed action runs out: checks again, pays, and puts it up (or raises
 * the centre a tier). A building's id is `b-<n>`, counting across all camps.
 *
 * @param {object} state - The game being played. Resources and a camp's buildings change.
 * @param {string} target - The timed action's target (see readBuildTarget).
 * @returns {{ok: boolean, kind: string, building?: object, camp?: object, raised?: number,
 *   message?: string}} What was built, or why not.
 */
export function finishBuilding(state, target) {
  const job = readBuildTarget(target);
  if (!job) return { ok: false, kind: 'unknown' };

  if (job.kind === 'raise') {
    const check = checkRaise(state);
    if (!check.ok || check.camp.id !== job.campId) return { ...check, ok: false, kind: 'centre' };
    for (const [type, n] of Object.entries(check.cost)) state.resources[type] -= n;
    check.centre.tier += 1;
    return {
      ok: true,
      kind: 'centre',
      building: check.centre,
      camp: check.camp,
      raised: check.centre.tier,
    };
  }

  const check = checkBuilding(state, job.kind, job.x, job.y);
  if (!check.ok) return { ...check, kind: job.kind };
  for (const [type, n] of Object.entries(check.cost)) state.resources[type] -= n;
  // A packed tent leaves the item box as it goes up.
  if (job.kind === 'tent') state.packedTent = false;
  tidyBag(state);
  const number =
    Math.max(
      0,
      ...state.camps.flatMap((c) => (c.buildings ?? []).map((b) => Number(b.id.slice(2)))),
    ) + 1;
  const building = { id: `b-${number}`, kind: job.kind, x: job.x, y: job.y };
  if (job.kind === 'chest') building.contents = {};
  if (job.kind === 'farm') building.crop = { stage: 0, readyAt: null, tended: false };
  if (job.kind === 'centre') building.tier = 1;
  check.camp.buildings = [...(check.camp.buildings ?? []), building];
  return { ok: true, kind: job.kind, building, camp: check.camp };
}

/**
 * Moves every one of a resource between the backpack and a chest.
 *
 * @param {object} state - The game being played. Its resources change.
 * @param {object} chest - The chest building. Its contents change.
 * @param {string} resource - Which resource, such as 'wood'.
 * @param {boolean} into - True to put it all in the chest, false to take it all out.
 * @returns {number} How many moved: 0 when there was nothing to move, or no open slot to take it into.
 */
export function moveAll(state, chest, resource, into) {
  if (chest?.kind !== 'chest' || !RESOURCES.includes(resource)) return 0;
  const contents = (chest.contents ??= {});
  const n = into ? state.resources[resource] : (contents[resource] ?? 0);
  if (!n) return 0;
  if (into) {
    state.resources[resource] = 0;
    contents[resource] = (contents[resource] ?? 0) + n;
    tidyBag(state);
  } else {
    // Taking out a new kind of thing needs an open slot in the item box.
    if (!addItem(state, resource, n)) return 0;
    delete contents[resource];
  }
  return n;
}

/**
 * Says what working a wheat bed would do now: sow an empty bed, tend a growing one that has not been
 * tended this stage, or harvest a ripe one.
 *
 * @param {object} state - The game being played.
 * @param {object} bed - The wheat bed.
 * @returns {{ok: boolean, what?: string, reason?: string, message?: string}} The job ('sow', 'tend'
 *   or 'harvest'), or why there is none: 'seed' (no food to sow), 'tended' (wait for it to grow),
 *   'full' (ripe, but the item box has no open slot for food).
 */
export function farmJob(state, bed) {
  const crop = bed.crop;
  if (crop.stage === 0) {
    const missing = shortOf(state, SOW_COST);
    return Object.keys(missing).length
      ? { ok: false, reason: 'seed', message: `Needs ${listMissing(missing)} to sow` }
      : { ok: true, what: 'sow' };
  }
  if (crop.stage >= 3)
    return hasRoomFor(state, ['food'])
      ? { ok: true, what: 'harvest' }
      : { ok: false, reason: 'full', message: BAG_FULL };
  return crop.tended
    ? { ok: false, reason: 'tended', message: 'Tended · Give the wheat time to grow' }
    : { ok: true, what: 'tend' };
}

/**
 * Starts working a wheat bed: the gathering clip runs for FARM_SECONDS.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state.
 * @param {object} bed - The wheat bed.
 * @returns {object} The job from farmJob, or {ok: false, reason: 'busy'}.
 */
export function beginFarm(state, animator, bed) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const job = farmJob(state, bed);
  if (job.ok) startAction(animator, 'gather', `${FARM_PREFIX}${bed.id}:${job.what}`, FARM_SECONDS);
  return job;
}

/**
 * Finishes working a wheat bed when the timed action runs out, if the job still fits the bed.
 *
 * Sowing pays the seed and plants seedlings; tending halves what is left of the stage; harvesting
 * gives HARVEST_FOOD food and leaves the bed empty.
 *
 * @param {object} state - The game being played. The bed's crop and the backpack change.
 * @param {string} target - Such as 'farm:b-3:sow'.
 * @returns {{ok: boolean, what?: string, food?: number}|null} What was done, or null when the bed or
 *   the job no longer fits.
 */
export function finishFarm(state, target) {
  const [id, what] = target.slice(FARM_PREFIX.length).split(':');
  const bed = state.camps.flatMap((c) => c.buildings ?? []).find((b) => b.id === id);
  if (!bed) return null;
  const job = farmJob(state, bed);
  if (!job.ok || job.what !== what) return null;
  const crop = bed.crop;
  if (what === 'sow') {
    for (const [type, n] of Object.entries(SOW_COST)) state.resources[type] -= n;
    Object.assign(crop, { stage: 1, readyAt: state.time + GROW_SECONDS, tended: false });
  } else if (what === 'tend') {
    crop.readyAt = state.time + (crop.readyAt - state.time) / 2;
    crop.tended = true;
  } else {
    addItem(state, 'food', HARVEST_FOOD);
    Object.assign(crop, { stage: 0, readyAt: null, tended: false });
    return { ok: true, what, food: HARVEST_FOOD };
  }
  return { ok: true, what };
}
