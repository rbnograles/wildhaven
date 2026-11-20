// The item box's slots: which kind of thing sits in which slot, how many slots are open, and
// whether a new kind of thing still fits. A slot holds one kind (wood, food, a packed tent),
// however many of it. The counts themselves stay in `state.resources`; this file only keeps the
// order of the slots, which the player can change by dragging.

import { RESOURCES } from '../data/supplies.js';
import { BAG_SLOTS, BACKPACK_SLOTS } from '../data/balance.js';

/** The slot name of the packed tent: a tent taken down, waiting to be pitched again. */
export const TENT_ITEM = 'tent';

/** Every kind of thing a slot can hold: the resources, and the packed tent. */
export const ITEMS = [...RESOURCES, TENT_ITEM];

/** What the game says when a new kind of thing has no open slot to go to. */
export const BAG_FULL = 'Your bag is full · Store something in a chest, or make a backpack';

/** How many slots the item box has in all, open or not. `state.slots` is always this long. */
export const BAG_MAX = BACKPACK_SLOTS;

/**
 * Makes an item box with every slot empty.
 *
 * @returns {null[]} BAG_MAX empty slots.
 */
export const emptySlots = () => Array(BAG_MAX).fill(null);

/**
 * Says how many of one kind of thing the player carries.
 *
 * @param {object} state - The game being played.
 * @param {string} item - A resource, or TENT_ITEM.
 * @returns {number} The count: a packed tent counts as one.
 */
export const carried = (state, item) =>
  item === TENT_ITEM ? (state.packedTent ? 1 : 0) : (state.resources[item] ?? 0);

/**
 * Says how many slots are open: the top row, or both rows once the backpack is made.
 *
 * @param {object} state - The game being played.
 * @returns {number} BAG_SLOTS or BACKPACK_SLOTS.
 */
export const bagSize = (state) => (state.backpack ? BACKPACK_SLOTS : BAG_SLOTS);

/**
 * Says what really sits in a slot now: a slot whose thing has run out counts as empty.
 *
 * @param {object} state - The game being played.
 * @param {number} index - The slot, from 0.
 * @returns {string|null} The kind of thing, or null for an empty slot.
 */
export function slotItem(state, index) {
  const item = state.slots[index];
  return item && carried(state, item) > 0 ? item : null;
}

/**
 * Counts how many more kinds of thing fit in the bag.
 *
 * It counts kinds carried, not slots, so the answer is right even before tidyBag has given a
 * newly picked-up thing its slot. Kinds an old save keeps in the shut row count as well: the bag
 * has room again only once fewer kinds are carried than there are open slots.
 *
 * @param {object} state - The game being played.
 * @returns {number} How many open slots are left for new kinds.
 */
export function freeSlots(state) {
  const kinds = ITEMS.filter((item) => carried(state, item) > 0).length;
  return Math.max(0, bagSize(state) - kinds);
}

/**
 * Says whether the things in a list all fit in the bag.
 *
 * More of a kind the player already carries always fits: it goes on the same pile. Only a new
 * kind needs an empty open slot, like a new jar needing its own place on a shelf.
 *
 * @param {object} state - The game being played.
 * @param {string[]} items - The kinds of thing about to be picked up.
 * @returns {boolean} True when every new kind has an open slot to go to.
 */
export function hasRoomFor(state, items) {
  const fresh = new Set(items.filter((item) => carried(state, item) === 0));
  return fresh.size <= freeSlots(state);
}

/**
 * Puts the slots in order with what the player carries.
 *
 * A slot whose thing ran out is emptied, and a thing carried without a slot gets the first empty
 * open one. If no open slot is left (an old save that carried more kinds than the top row holds),
 * it goes into a closed slot instead, so nothing carried is ever out of sight.
 *
 * @param {object} state - The game being played. Its `slots` change.
 */
export function tidyBag(state) {
  const { slots } = state;
  for (let i = 0; i < BAG_MAX; i++) if (slots[i] && carried(state, slots[i]) === 0) slots[i] = null;

  const size = bagSize(state);
  for (const item of ITEMS) {
    if (carried(state, item) === 0 || slots.includes(item)) continue;
    let spot = slots.findIndex((held, i) => !held && i < size);
    if (spot < 0) spot = slots.indexOf(null);
    if (spot >= 0) slots[spot] = item;
  }
}

/**
 * Puts some of a resource in the bag, if it fits.
 *
 * @param {object} state - The game being played. Its resources and slots change.
 * @param {string} resource - Which resource, such as 'wood'.
 * @param {number} [amount=1] - How many.
 * @returns {boolean} True when it went in; false when the bag has no open slot for a new kind.
 */
export function addItem(state, resource, amount = 1) {
  if (!hasRoomFor(state, [resource])) return false;
  state.resources[resource] += amount;
  tidyBag(state);
  return true;
}

/**
 * Moves what is in one slot to another: what dragging it does. If the other slot holds something,
 * the two swap places.
 *
 * @param {object} state - The game being played. Its `slots` change.
 * @param {number} from - The slot dragged from.
 * @param {number} to - The slot dropped on. It must be an open one.
 * @returns {boolean} True when something moved.
 */
export function moveSlot(state, from, to) {
  /** Says whether a number is a real slot of the item box. */
  const inBox = (i) => Number.isInteger(i) && i >= 0 && i < BAG_MAX;
  if (!inBox(from) || !inBox(to) || from === to || to >= bagSize(state)) return false;
  tidyBag(state);
  if (!state.slots[from]) return false;
  [state.slots[from], state.slots[to]] = [state.slots[to], state.slots[from]];
  return true;
}

/**
 * Checks the slots read from a save: the right number of them, each empty or a known kind of
 * thing, and no kind in two slots.
 *
 * @param {*} slots - The `slots` read from a save.
 * @returns {boolean} True if the game can use them.
 */
export function isSlots(slots) {
  if (!Array.isArray(slots) || slots.length !== BAG_MAX) return false;
  const held = slots.filter((s) => s !== null);
  return held.every((s) => ITEMS.includes(s)) && new Set(held).size === held.length;
}
