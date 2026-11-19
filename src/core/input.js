// Keyboard and touch controls.
// Phaser's own input is disabled; every key and touch goes through here.
// This file remembers which keys are held down and turns them into "which way to walk".

import { beginGather } from '../actions/gather.js';
import { campInReach } from '../world/camps.js';
import { save } from './session.js';
import { $ } from '../ui/layout.js';

// Keys that move the player (WASD and arrows) plus Shift for running, all lowercase.
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'shift'];

// On-screen touch buttons pretend to be WASD keys: `data-move` value → key it stands for.
const TOUCH_KEYS = { up: 'w', down: 's', left: 'a', right: 'd' };

/**
 * Hooks up every keyboard, touch, and page event the game listens to.
 *
 * Held keys go into `session.keys`, like names written on a whiteboard: pressing a key writes it,
 * letting go erases it. The frame loop reads the whiteboard each frame through `moveIntent`.
 * Also handles E to gather or open a camp, B for build mode, F to eat, H to heal, M for the map,
 * J for the journal, Escape to pause (or to leave build mode), the mouse over the world, and
 * saving when the tab is hidden.
 *
 * @param {object} session - The shared session; its `keys` set and `clock` are used here.
 * @param {object} ui - The UI helpers (`hud`, `dialogs`, `journal`) that key presses open or update.
 * @returns {{moveIntent: Function}} An object whose `moveIntent()` reports the current direction.
 */
export function setupInput(session, ui) {
  const { keys } = session;

  /**
   * Starts gathering the closest supply. With nothing to gather, E beside one of the player's
   * fires opens that camp instead; anywhere else it says to move closer.
   *
   * E starts the node's timed action; the supply is awarded when the action runs out (see core/loop.js).
   * Held movement keys are forgotten so the player doesn't walk off and cancel straight away.
   */
  function gather() {
    const result = beginGather(session.state, session.animator);
    if (result.ok) {
      keys.clear();
      ui.hud.update();
      return;
    }
    if (result.reason !== 'none') return;
    const camp = campInReach(session.state);
    if (camp) ui.camp.openCamp(camp);
    else ui.hud.notify('Move closer to something you can gather.');
  }

  /** Does what E (or the action button) means right now: place the campfire in build mode, or gather. */
  function interact() {
    if (session.screen !== 'game' || ui.dialogs.isPaused()) return;
    if (session.build.active) ui.build.place();
    else gather();
  }

  $('interact').addEventListener('click', interact);

  // Keyboard: Escape pauses, M toggles the map, J the journal, E gathers, and movement keys are remembered.
  window.addEventListener('keydown', (event) => {
    if (session.screen !== 'game') return;
    // Typing in a text box (such as naming a camp) is not a game key.
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();

    if (key === 'escape') {
      if (ui.dialogs.isPaused()) return;
      event.preventDefault();
      if (session.build.active) ui.build.cancel();
      else ui.dialogs.openPause();
      return;
    }

    if (key === 'm' && !event.repeat) {
      event.preventDefault();
      ui.dialogs.toggleMap();
      return;
    }

    if (key === 'j' && !event.repeat) {
      event.preventDefault();
      ui.journal.toggleJournal();
      return;
    }

    if (ui.dialogs.isPaused()) return;

    if (key === 'b' && !event.repeat) {
      event.preventDefault();
      ui.build.toggle();
      return;
    }

    if (key === 'f' && !event.repeat) {
      event.preventDefault();
      ui.camp.eatFood();
      return;
    }

    if (key === 'h' && !event.repeat) {
      event.preventDefault();
      ui.camp.useHerbs();
      return;
    }

    // Mid-action, key-repeat from a key held since before E is ignored; only a fresh press moves (and so cancels).
    if (MOVE_KEYS.includes(key)) {
      event.preventDefault();
      if (!(session.animator.pending && event.repeat)) keys.add(key);
    }

    if (key === 'e' && !event.repeat) {
      event.preventDefault();
      interact();
    }
  });

  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

  // Leaving the window means we never hear the key go up, so forget every held key.
  window.addEventListener('blur', () => keys.clear());

  // Hiding the tab saves the game. Resetting the clock stops the first frame back from
  // counting all the time the tab was hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      if (session.screen === 'game') save(session, ui, true);
    }
    session.clock.last = performance.now();
  });

  window.addEventListener('pagehide', () => save(session, ui, true));

  // The mouse over the world is remembered so the build ghost can follow it. In build mode a
  // click (or a tap) on the world places the campfire there.
  const world = $('world');
  world.addEventListener('pointermove', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
  });
  world.addEventListener('pointerleave', () => (session.pointer = null));
  world.addEventListener('pointerdown', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
    if (!session.build.active || event.button !== 0) return;
    // Stop the click from also focusing the world afterwards, which would pull the keyboard out
    // of the camp name box that placing the fire opens.
    event.preventDefault();
    interact();
  });

  // Touch buttons: holding one "presses" its key; lifting the finger (or losing it) releases it.
  document.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!ui.dialogs.isPaused()) {
        button.setPointerCapture(event.pointerId);
        keys.add(TOUCH_KEYS[button.dataset.move]);
      }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(type, () => keys.delete(TOUCH_KEYS[button.dataset.move]));
  });

  /**
   * Turns the held keys into a walking direction.
   *
   * Right minus left gives the sideways push, down minus up the up/down push. Holding opposite
   * keys cancels out to 0, the same as holding neither.
   *
   * @returns {{dx: number, dy: number, running: boolean}} Each push is -1, 0 or 1; `running` is Shift.
   */
  function moveIntent() {
    const dx =
      Number(keys.has('d') || keys.has('arrowright')) -
      Number(keys.has('a') || keys.has('arrowleft'));
    const dy =
      Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    return { dx, dy, running: keys.has('shift') };
  }

  return { moveIntent };
}
