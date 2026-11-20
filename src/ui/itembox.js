// The item box: ten slots that are empty until the player picks something up. This file draws
// what each slot holds, lets a slot be dragged onto another to rearrange them (mouse or finger),
// and makes a click on the food or herbs slot eat or heal. The rules (which slots are open, what
// fits) live in world/bag.js; the order of the slots is part of the save.

import { BAG_MAX, bagSize, carried, slotItem, moveSlot } from '../world/bag.js';
import { save } from '../core/session.js';
import { $, ITEM_LOOKS } from './layout.js';

// How far the pointer must travel, in screen pixels, before a press on a slot becomes a drag. A
// shorter wobble is still a click, so eating food with a slightly shaky hand works.
const DRAG_START = 6;

/**
 * Draws the item box so it matches the game: each slot's picture and count, or nothing.
 *
 * A slot past the open ones is shown shut until the backpack is made. An old save can still hold
 * something in a shut slot; it is shown, and can be dragged out, until it runs out.
 *
 * @param {object} state - The game being played.
 */
export function renderItemBox(state) {
  const open = bagSize(state);
  for (const slot of $('item-box').children) {
    const index = Number(slot.dataset.slot),
      item = slotItem(state, index),
      look = item && ITEM_LOOKS[item],
      [picture, count, label, key] = slot.children;

    slot.dataset.item = item ?? '';
    slot.classList.toggle('filled', !!item);
    slot.classList.toggle('locked', index >= open && !item);
    slot.title = look
      ? look.name
      : index >= open
        ? 'Make a backpack (Build menu) to open this slot'
        : '';

    picture.hidden = count.hidden = !item;
    key.hidden = !look?.key;
    if (!look) continue;
    if (picture.getAttribute('src') !== look.icon) picture.src = look.icon;
    count.textContent = carried(state, item);
    label.textContent = look.name;
    key.textContent = look.key ?? '';
  }
}

/**
 * Wires up the item box for one session: dragging slots about, and clicking food or herbs.
 *
 * Dragging is done with pointer events, which cover the mouse and a finger alike: pressing on a
 * filled slot and moving away lifts a copy of its picture that follows the pointer, and letting
 * go over another open slot moves the thing there (the two swap if that slot is taken).
 *
 * @param {object} session - The shared session; its game state's slots change.
 * @param {object} ui - The other UI parts (`hud`, `camp`).
 */
export function setupItemBox(session, ui) {
  const box = $('item-box');
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
  const slotUnder = (x, y) => document.elementFromPoint(x, y)?.closest('#item-box .slot') ?? null;

  /** Ends the press: takes the floating picture away and clears every drag mark. */
  function endPress() {
    press?.ghost?.remove();
    for (const slot of box.children) slot.classList.remove('dragging', 'drop-target');
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
    for (const slot of box.children)
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
    } else if (to >= bagSize(session.state) && to < BAG_MAX)
      ui.hud.notify('That slot is shut · Make a backpack to open it');
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
