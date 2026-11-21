// The item box: ten slots that are empty until the player picks something up, and ten more in a
// second box once the backpack is made. A slot holds a pile of up to fifty of one kind. This file
// draws each slot's pile, lets a pile be dragged onto another slot to rearrange them (mouse or
// finger), and makes a click on a food or herbs pile eat or heal. The rules (which slots are open,
// what fits) live in world/bag.js; where the piles lie is part of the save.

import { BAG_MAX, BAG_FULL, bagSize, viewSlots, moveSlot } from '../world/bag.js';
import { save } from '../core/session.js';
import { $, ITEM_LOOKS } from './layout.js';

// How far the pointer must travel, in screen pixels, before a press on a slot becomes a drag. A
// shorter wobble is still a click, so eating food with a slightly shaky hand works.
const DRAG_START = 6;

/**
 * Lists every slot element of both item boxes, in slot order.
 *
 * @returns {HTMLElement[]} The twenty slot buttons.
 */
const allSlots = () => [...$('item-box').children, ...$('item-box-extra').children];

/**
 * Draws the item boxes so they match the game: each slot's picture and how many are in its pile,
 * or nothing.
 *
 * The backpack's box shows once the backpack is made. An old save can still hold piles in it
 * without a backpack; then it shows too, with its empty slots shut, until those piles run out.
 *
 * @param {object} state - The game being played.
 */
export function renderItemBox(state) {
  const open = bagSize(state),
    piles = viewSlots(state);
  $('item-box-extra').hidden = open < BAG_MAX && !piles.slice(open).some(Boolean);

  for (const slot of allSlots()) {
    const index = Number(slot.dataset.slot),
      pile = piles[index],
      item = pile?.item,
      // A kind with no picture yet still shows its count, with its name as the tooltip.
      look = item && (ITEM_LOOKS[item] ?? { icon: '', name: item }),
      [picture, count, label, key] = slot.children;

    slot.dataset.item = item ?? '';
    slot.classList.toggle('filled', !!item);
    slot.classList.toggle('locked', index >= open && !item);
    slot.title = look
      ? look.name
      : index >= open
        ? 'A backpack slot · Make a backpack (Build menu) to use it'
        : '';

    count.hidden = !item;
    picture.hidden = !look?.icon;
    key.hidden = !look?.key;
    if (!look) continue;
    if (look.icon && picture.getAttribute('src') !== look.icon) picture.src = look.icon;
    count.textContent = pile.n;
    label.textContent = look.name;
    key.textContent = look.key ?? '';
  }
}

/**
 * Wires up the item box for one session: dragging slots about, and clicking food or herbs.
 *
 * Dragging is done with pointer events, which cover the mouse and a finger alike: pressing on a
 * filled slot and moving away lifts a copy of its picture that follows the pointer, and letting
 * go over another open slot moves the pile there (two piles of one kind join up to fifty; two
 * of different kinds swap).
 *
 * @param {object} session - The shared session; its game state's slots change.
 * @param {object} ui - The other UI parts (`hud`, `camp`).
 */
export function setupItemBox(session, ui) {
  const box = $('item-box').parentElement;
  // The press in progress: which slot, where it began, and the floating picture once it is a drag.
  let press = null,
    // True just after a drag ends, so the click the browser sends next does not also eat or heal.
    dragged = false;

  /**
   * Finds the slot under a point on the screen.
   *
   * @param {number} x - Screen x.
   * @param {number} y - Screen y.
   * @returns {HTMLElement|null} The slot element, or null when the point is off the item box.
   */
  const slotUnder = (x, y) => document.elementFromPoint(x, y)?.closest('.item-box .slot') ?? null;

  /** Ends the press: takes the floating picture away and clears every drag mark. */
  function endPress() {
    press?.ghost?.remove();
    for (const slot of allSlots()) slot.classList.remove('dragging', 'drop-target');
    press = null;
  }

  box.addEventListener('pointerdown', (event) => {
    const slot = event.target.closest('.slot');
    if (!slot?.dataset.item || event.button > 0) return;
    press = { slot, id: event.pointerId, x: event.clientX, y: event.clientY, ghost: null };
    dragged = false;
  });

  window.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.id) return;

    // The press becomes a drag once the pointer has really moved away.
    if (!press.ghost) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_START) return;
      press.ghost = press.slot.querySelector('img').cloneNode();
      press.ghost.className = 'slot-ghost';
      press.ghost.style.width = `${press.slot.offsetWidth}px`;
      document.body.append(press.ghost);
      press.slot.classList.add('dragging');
    }

    press.ghost.style.left = `${event.clientX}px`;
    press.ghost.style.top = `${event.clientY}px`;
    // Light up the slot the thing would land in, if it may land there.
    const over = slotUnder(event.clientX, event.clientY);
    for (const slot of allSlots())
      slot.classList.toggle(
        'drop-target',
        slot === over && slot !== press.slot && Number(slot.dataset.slot) < bagSize(session.state),
      );
  });

  window.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const { slot, ghost } = press,
      over = ghost && slotUnder(event.clientX, event.clientY);
    endPress();
    if (!ghost) return;

    dragged = true;
    if (!over || !session.state) return;
    const to = Number(over.dataset.slot);
    if (moveSlot(session.state, Number(slot.dataset.slot), to)) {
      save(session, ui, true);
      ui.hud.update();
    } else if (to >= bagSize(session.state) && to < BAG_MAX) ui.hud.notify(BAG_FULL);
  });

  window.addEventListener('pointercancel', endPress);

  // A plain click on the food slot eats and on the herbs slot heals, the same as F and H.
  box.addEventListener('click', (event) => {
    if (dragged) {
      dragged = false;
      return;
    }
    const item = event.target.closest('.slot')?.dataset.item;
    if (item === 'food') ui.camp.eatFood();
    if (item === 'herbs') ui.camp.useHerbs();
  });
}
