// The camp needs list: three things each camp asks for. They point the player outward: bring
// resources home, find a place in a region further out, or find a new signpost. Meeting a need
// grows the camp's fire; at dawn every met need is swapped for a fresh one.

import { NEED_AMOUNTS, MAX_GROWN } from '../data/balance.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import { REGIONS, regionOf } from './regions.js';
import { dayOf } from './clock.js';

// The resources a "bring" need can ask for: the ones NEED_AMOUNTS has an amount for, in the same
// order as before iron existed, so existing camps keep the same needs. Camps never ask for iron.
const NEED_RESOURCES = Object.keys(NEED_AMOUNTS);

/**
 * Turns a piece of text into a steady whole number: the same text always gives the same number.
 *
 * Used to pick a need's resource, so a camp's list is the same after a reload instead of being
 * re-rolled like dice. (This is the FNV-1a hash: mix in each letter, then multiply.)
 *
 * @param {string} text - Any text, such as "camp-1-3-0".
 * @returns {number} A whole number of 0 or more.
 */
function hash(text) {
  let h = 2166136261;
  for (const letter of text) h = Math.imul(h ^ letter.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Picks the region a camp should send the player to: the closest one, other than the camp's own,
 * that still has a place nobody has found.
 *
 * @param {object} state - The game being played (its `landmarks` are the places found).
 * @param {object} camp - The camp asking.
 * @returns {object|null} A region from REGIONS, or null when every other region is fully explored.
 */
export function outwardRegion(state, camp) {
  const home = regionOf(camp.x, camp.y).id;
  /** Measures how far a region's centre is from the camp. */
  const away = (region) => Math.hypot(region.x - camp.x, region.y - camp.y);
  const open = REGIONS.filter(
    (region) =>
      region.id !== home &&
      LANDMARKS.some((l) => l.region === region.id && !state.landmarks.includes(l.id)),
  );
  return open.sort((a, b) => away(a) - away(b))[0] ?? null;
}

/**
 * Makes one need for one slot of a camp's list.
 *
 * Slot 0 always asks for resources. Slot 1 asks for a place in the nearest unexplored region.
 * Slot 2 asks for a new signpost on odd days and for resources on even days. When there is no
 * place or signpost left to find, the slot asks for resources instead.
 *
 * @param {object} state - The game being played.
 * @param {object} camp - The camp the need is for (its id, spot and `grown` are read).
 * @param {number} slot - Which line of the list: 0, 1 or 2.
 * @param {number} day - The day the need is made, from `dayOf`.
 * @returns {object} `{kind: 'bring', resource, amount, done}`, `{kind: 'place', region, done}` or
 *   `{kind: 'signpost', done}`, with `done` false.
 */
export function makeNeed(state, camp, slot, day) {
  if (slot === 1) {
    const region = outwardRegion(state, camp);
    if (region) return { kind: 'place', region: region.id, done: false };
  }
  if (slot === 2 && day % 2 === 1 && WAYPOINTS.some((w) => !state.waypoints.includes(w.id)))
    return { kind: 'signpost', done: false };

  const resource = NEED_RESOURCES[hash(`${camp.id}-${day}-${slot}`) % NEED_RESOURCES.length];
  const amount = NEED_AMOUNTS[resource] + Math.floor(camp.grown / 2);
  return { kind: 'bring', resource, amount, done: false };
}

/**
 * Makes a full list of three needs for a camp, for today.
 *
 * @param {object} state - The game being played (its clock gives today).
 * @param {object} camp - The camp the needs are for.
 * @returns {object[]} Three needs, one per slot.
 */
export const makeNeeds = (state, camp) =>
  [0, 1, 2].map((slot) => makeNeed(state, camp, slot, dayOf(state.time)));

/**
 * Marks a need as met and grows its camp's fire by one step, up to the limit.
 *
 * @param {object} camp - The camp the need belongs to. Its `grown` goes up.
 * @param {object} need - The need. Its `done` becomes true.
 */
export function meetNeed(camp, need) {
  need.done = true;
  camp.grown = Math.min(MAX_GROWN, camp.grown + 1);
}

/**
 * Ticks off exploration needs that the player's latest finds complete.
 *
 * A place need is met by finding any place in its region; a signpost need by finding any
 * signpost. One find can complete matching needs at several camps: finds are shared, not split.
 *
 * @param {object} state - The game being played. Met needs change, and their camps grow.
 * @param {{kind: string, id: string}[]} found - What `discover` just reported.
 * @returns {{camp: object, need: object}[]} Each need that was met, with its camp, for the HUD.
 */
export function markFinds(state, found) {
  const met = [];
  for (const camp of state.camps)
    for (const need of camp.needs) {
      if (need.done) continue;
      const hit = found.some(
        (f) =>
          (need.kind === 'place' &&
            f.kind === 'landmark' &&
            LANDMARKS.find((l) => l.id === f.id)?.region === need.region) ||
          (need.kind === 'signpost' && f.kind === 'waypoint'),
      );
      if (!hit) continue;
      meetNeed(camp, need);
      met.push({ camp, need });
    }
  return met;
}

/**
 * Swaps every met need for a fresh one: the dawn update.
 *
 * Open needs stay as they are, so a need the player is still working on never vanishes.
 *
 * @param {object} state - The game being played. Camp need lists change.
 * @returns {object[]} The camps whose lists changed, so the HUD can name them.
 */
export function refreshNeeds(state) {
  const day = dayOf(state.time),
    changed = [];
  for (const camp of state.camps) {
    if (!camp.needs.some((need) => need.done)) continue;
    camp.needs = camp.needs.map((need, slot) =>
      need.done ? makeNeed(state, camp, slot, day) : need,
    );
    changed.push(camp);
  }
  return changed;
}

/**
 * Says a need in plain words for the HUD and the camp dialog, such as "Bring 4 stone".
 *
 * @param {object} need - The need.
 * @returns {string} The words.
 */
export function describeNeed(need) {
  if (need.kind === 'bring') return `Bring ${need.amount} ${need.resource}`;
  if (need.kind === 'place')
    return `Find a place in ${REGIONS.find((r) => r.id === need.region).name}`;
  return 'Find a new signpost';
}

/**
 * Measures how close a need is to being met, for the count beside it.
 *
 * A resource need counts what is in the backpack, up to the amount asked. Finding needs are
 * all or nothing. A met need is always full.
 *
 * @param {object} state - The game being played.
 * @param {object} need - The need.
 * @returns {{have: number, want: number}} Progress so far, and the goal.
 */
export function needProgress(state, need) {
  const want = need.kind === 'bring' ? need.amount : 1;
  if (need.done) return { have: want, want };
  if (need.kind === 'bring') return { have: Math.min(state.resources[need.resource], want), want };
  return { have: 0, want };
}
