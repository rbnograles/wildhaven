// Keyboard and touch controls.
// Phaser's own input is disabled; every key and touch goes through here.
// This file remembers which keys are held down and turns them into "which way to walk".

import { beginInteraction } from '../actions/interact.js';
import { listMissing } from '../actions/boat.js';
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
 * Also handles E to gather, repair or board, M for the map, J for the journal, Escape to pause, and saving when
 * the tab is hidden.
 *
 * @param {object} session - The shared session; its `keys` set and `clock` are used here.
 * @param {object} ui - The UI helpers (`hud`, `dialogs`, `journal`) that key presses open or update.
 * @returns {{moveIntent: Function}} An object whose `moveIntent()` reports the current direction.
 */
export function setupInput(session, ui) {
  const { keys } = session;

  /**
   * Does what E means right now (step ashore, board, repair or gather), or says why nothing happened.
   *
   * Landing and boarding happen at once and save straight away. Repairing and gathering start a
   * timed action that core/loop.js finishes. Held movement keys are forgotten so the player
   * doesn't walk off and cancel straight away.
   */
  function interact() {
    if (session.screen !== 'game' || ui.dialogs.isPaused()) return;
    const result = beginInteraction(session.state, session.animator);
    if (result.ok) {
      keys.clear();
      if (result.kind === 'board')
        ui.hud.notify('In the boat · Row with WASD, and press E by the shore to step ashore');
      if (result.kind === 'board' || result.kind === 'land') save(session, ui, true);
      ui.hud.update();
    } else if (result.reason === 'missing')
      ui.hud.notify(`The old boat needs ${listMissing(result.missing)} more.`);
    else if (result.reason === 'none') ui.hud.notify('Move closer to something you can use.');
  }

  $('interact').addEventListener('click', interact);

  // Keyboard: Escape pauses, M toggles the map, J the journal, E interacts, and movement keys are remembered.
  window.addEventListener('keydown', (event) => {
    if (session.screen !== 'game') return;
    const key = event.key.toLowerCase();

    if (key === 'escape') {
      if (!ui.dialogs.isPaused()) {
        event.preventDefault();
        ui.dialogs.openPause();
      }
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
