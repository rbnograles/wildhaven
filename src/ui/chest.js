// The storage chest window: what is in the backpack and in the chest, one line per resource, with a
// button to put all of it in the chest and one to take all of it out. Opening it pauses the game,
// like every dialog. The moving itself is actions/building.js (moveAll).

import { RESOURCES, RESOURCE_NAMES } from '../data/supplies.js';
import { moveAll } from '../actions/building.js';
import { save } from '../core/session.js';
import { $ } from './layout.js';

/**
 * Sets up the chest window for one session.
 *
 * @param {object} session - The shared session; its game state is read and changed.
 * @param {object} ui - The other UI parts (`hud`).
 * @returns {{open: Function, openChest: () => object|null}} A way to open the window on a chest,
 *   and the chest it is open on (for the renderer: an open chest shows its lid up).
 */
export function setupChest(session, ui) {
  const dialog = $('chest-dialog');
  // The chest the window is open on, or null.
  let chest = null;

  /** Says a resource's name the way a person would: "Pine cones", "Wood". */
  const named = (resource) => {
    const word = RESOURCE_NAMES[resource] ?? resource;
    return word[0].toUpperCase() + word.slice(1);
  };

  /**
   * Fills the list again: each resource either side has, with its two buttons. A resource that
   * neither the backpack nor the chest holds is left out, so the list stays short.
   */
  function fill() {
    const { state } = session,
      list = $('chest-rows');
    list.replaceChildren();
    const shown = RESOURCES.filter((r) => state.resources[r] > 0 || (chest.contents?.[r] ?? 0) > 0);
    if (!shown.length) {
      const empty = document.createElement('li');
      empty.textContent = 'The chest and your backpack are both empty.';
      list.append(empty);
    }
    for (const resource of shown) {
      const row = document.createElement('li'),
        words = document.createElement('span'),
        put = document.createElement('button'),
        take = document.createElement('button');
      words.textContent = `${named(resource)} · ${state.resources[resource]} carried · ${chest.contents?.[resource] ?? 0} in the chest`;
      put.className = take.className = 'secondary';
      put.textContent = 'Put all in';
      take.textContent = 'Take all';
      put.disabled = !state.resources[resource];
      take.disabled = !chest.contents?.[resource];
      put.addEventListener('click', () => move(resource, true));
      take.addEventListener('click', () => move(resource, false));
      row.append(words, put, take);
      list.append(row);
    }
  }

  /**
   * Moves all of one resource in or out, saves, and shows the new counts.
   *
   * @param {string} resource - Which resource.
   * @param {boolean} into - True to put it in the chest, false to take it out.
   */
  function move(resource, into) {
    if (!chest || !moveAll(session.state, chest, resource, into)) return;
    save(session, ui, true);
    ui.hud.update();
    fill();
  }

  /**
   * Opens the window on a chest.
   *
   * @param {object} target - The chest building.
   */
  function open(target) {
    chest = target;
    const camp = session.state.camps.find((c) => c.buildings?.includes(target));
    $('chest-kicker').textContent = camp ? camp.name.toUpperCase() : '';
    fill();
    dialog.showModal();
  }

  $('close-chest').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => (chest = null));

  return { open, openChest: () => chest };
}
