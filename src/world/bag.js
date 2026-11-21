// The item box's slots: which pile of things sits in which slot, how many slots are open, and
// whether more still fits. A slot holds one pile of one kind (wood, food, a packed tent), up to
// STACK_SIZE pieces; more of the same kind starts another pile in another slot. The totals stay in
// `state.resources`; this file keeps the piles in step with them, in the order the player dragged
// them into.

import { RESOURCES } from '../data/supplies.js';
import { BAG_SLOTS, BACKPACK_SLOTS, STACK_SIZE } from '../data/balance.js';

/** The slot name of the packed tent: a tent taken down, waiting to be pitched again. */
export const TENT_ITEM = 'tent';

/** Every kind of thing a slot can hold: the resources, and the packed tent. */
export const ITEMS = [...RESOURCES, TENT_ITEM];

/** What the game says when something has no room left in the item box. */
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
 * Says how many of one kind of thing the player carries, over all its piles.
 *
 * @param {object} state - The game being played.
 * @param {string} item - A resource, or TENT_ITEM.
 * @returns {number} The count: a packed tent counts as one.
 */
export const carried = (state, item) =>
  item === TENT_ITEM ? (state.packedTent ? 1 : 0) : (state.resources[item] ?? 0);

/**
 * Says how many slots are open: ten, or twenty once the backpack is made.
 *
 * @param {object} state - The game being played.
 * @returns {number} BAG_SLOTS or BACKPACK_SLOTS.
 */
export const bagSize = (state) => (state.backpack ? BACKPACK_SLOTS : BAG_SLOTS);

/**
 * Works out how the piles should lie for some totals, without changing anything.
 *
 * The piles are kept where they are as far as possible. When a total went down (something was
 * eaten or spent), pieces come off that kind's last pile first. When it went up, the kind's
 * piles are topped up to STACK_SIZE, then new piles start in the first empty open slots. If no
 * open slot is left (an old save that carried more than fits), a pile goes into a shut slot, and
 * as a last resort onto the kind's last pile, so nothing carried is ever lost or out of sight.
 *
 * @param {Array<{item: string, n: number}|null>} slots - The piles as they lie now.
 * @param {(item: string) => number} total - Says how many of a kind should be carried.
 * @param {number} size - How many slots are open.
 * @returns {Array<{item: string, n: number}|null>} A fresh list of BAG_MAX slots.
 */
function settle(slots, total, size) {
  const piles = Array.from({ length: BAG_MAX }, (_, i) => (slots[i] ? { ...slots[i] } : null));

  /** Counts how many pieces short (or, below zero, over) a kind's piles are of its total. */
  const short = (item) =>
    total(item) - piles.reduce((sum, p) => sum + (p?.item === item ? p.n : 0), 0);

  // First everything that went down: take pieces off each kind's last pile, and free emptied
  // slots. This comes before any topping up, so a slot one kind just left can take another.
  for (const item of ITEMS) {
    let over = -short(item);
    for (let i = BAG_MAX - 1; i >= 0 && over > 0; i--) {
      if (piles[i]?.item !== item) continue;
      const off = Math.min(piles[i].n, over);
      piles[i].n -= off;
      over -= off;
      if (!piles[i].n) piles[i] = null;
    }
  }

  // Then everything that went up: top the piles up, then start new ones (open slots first, then
  // shut ones), and as a last resort heap the rest onto the kind's last pile.
  for (const item of ITEMS) {
    let extra = short(item);
    for (const pile of piles) {
      if (pile?.item !== item || extra <= 0) continue;
      const on = Math.max(0, Math.min(STACK_SIZE - pile.n, extra));
      pile.n += on;
      extra -= on;
    }
    for (const open of [true, false])
      for (let i = 0; i < BAG_MAX && extra > 0; i++) {
        if (piles[i] || i < size !== open) continue;
        piles[i] = { item, n: Math.min(STACK_SIZE, extra) };
        extra -= piles[i].n;
      }
    const last = piles.findLast((p) => p?.item === item);
    if (extra > 0 && last) last.n += extra;
  }
  return piles;
}

/**
 * Gives the piles as they should be shown right now: `state.slots`, brought in step with what is
 * carried, as a fresh list. The game's own slots are not changed.
 *
 * @param {object} state - The game being played.
 * @returns {Array<{item: string, n: number}|null>} BAG_MAX slots, each a pile or null.
 */
export const viewSlots = (state) =>
  settle(state.slots, (item) => carried(state, item), bagSize(state));

/**
 * Brings the game's slots in step with what the player carries (see settle).
 *
 * @param {object} state - The game being played. Its `slots` change.
 */
export function tidyBag(state) {
  state.slots = viewSlots(state);
}

/**
 * Says whether some things all fit in the bag, on top of what is carried.
 *
 * It works it out on paper first, like planning how to pack a bag: each kind first tops up its
 * own piles, and whatever is left over needs empty open slots, STACK_SIZE pieces to a slot.
 *
 * @param {object} state - The game being played.
 * @param {object} things - How many of each kind, such as {wood: 7, feather: 1}.
 * @returns {boolean} True when all of it fits in the open slots.
 */
export function hasRoomFor(state, things) {
  const open = viewSlots(state).slice(0, bagSize(state));
  let empty = open.filter((pile) => !pile).length;

  for (const [item, amount] of Object.entries(things)) {
    const onPiles = open
      .filter((pile) => pile?.item === item)
      .reduce((space, pile) => space + Math.max(0, STACK_SIZE - pile.n), 0);
    empty -= Math.ceil(Math.max(0, amount - onPiles) / STACK_SIZE);
    if (empty < 0) return false;
  }
  return true;
}

/**
 * Says how many more pieces of one kind fit in the bag.
 *
 * @param {object} state - The game being played.
 * @param {string} item - The kind of thing.
 * @returns {number} Pieces: the space on that kind's piles, plus STACK_SIZE per empty open slot.
 */
export function roomFor(state, item) {
  const size = bagSize(state);
  return viewSlots(state).reduce((room, pile, i) => {
    if (i >= size) return room;
    if (!pile) return room + STACK_SIZE;
    return pile.item === item ? room + Math.max(0, STACK_SIZE - pile.n) : room;
  }, 0);
}

/**
 * Puts some of a resource in the bag, if all of it fits.
 *
 * @param {object} state - The game being played. Its resources and slots change.
 * @param {string} resource - Which resource, such as 'wood'.
 * @param {number} [amount=1] - How many.
 * @returns {boolean} True when it went in; false when the bag has no room for all of it.
 */
export function addItem(state, resource, amount = 1) {
  if (!hasRoomFor(state, { [resource]: amount })) return false;
  state.resources[resource] += amount;
  tidyBag(state);
  return true;
}

/**
 * Moves the pile in one slot to another: what dragging it does. Dropped on a pile of the same
 * kind, as much as fits is added to it; on a pile of another kind, the two swap places.
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
  const { slots } = state,
    pile = slots[from],
    onto = slots[to];
  if (!pile) return false;

  if (onto?.item === pile.item) {
    const moved = Math.min(pile.n, Math.max(0, STACK_SIZE - onto.n));
    if (!moved) return false;
    onto.n += moved;
    pile.n -= moved;
    if (!pile.n) slots[from] = null;
    return true;
  }
  [slots[from], slots[to]] = [onto, pile];
  return true;
}

/**
 * Checks the slots read from a save: the right number of them, each empty or a pile of a known
 * kind with a sensible count.
 *
 * @param {*} slots - The `slots` read from a save.
 * @returns {boolean} True if the game can use them.
 */
export function isSlots(slots) {
  return (
    Array.isArray(slots) &&
    slots.length === BAG_MAX &&
    slots.every(
      (s) =>
        s === null ||
        (!!s &&
          typeof s === 'object' &&
          ITEMS.includes(s.item) &&
          Number.isSafeInteger(s.n) &&
          s.n >= 1 &&
          s.n < 100000),
    )
  );
}
