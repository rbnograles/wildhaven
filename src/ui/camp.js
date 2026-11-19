// The camp dialogs. For now: naming a camp just founded. The rules live in actions/build.js;
// this file only shows the name box and passes on what the player typed.
import { nameCamp } from '../actions/build.js';
import { save } from '../core/session.js';
import { $ } from './layout.js';

/**
 * Wires up the camp dialogs.
 *
 * @param {object} session - The shared session (game state, held keys).
 * @param {object} ui - The other UI parts; the HUD shows messages.
 * @returns {{openNaming: Function}} Opens the name box for a camp just founded.
 */
export function setupCamp(session, ui) {
  // The camp being named while the name box is open.
  let naming = null;

  /**
   * Opens the name box for a camp just founded, filled in with its suggested name.
   *
   * @param {object} camp - The new camp.
   */
  function openNaming(camp) {
    naming = camp;
    session.keys.clear();
    $('camp-name-dialog').returnValue = '';
    $('camp-name-input').value = camp.name;
    $('camp-name-dialog').showModal();
    $('camp-name-input').select();
  }

  // However the name box closes, the camp is kept. "Found camp" also renames it to what was typed.
  $('camp-name-dialog').addEventListener('close', () => {
    if (!naming) return;
    if ($('camp-name-dialog').returnValue === 'found')
      nameCamp(session.state, naming.id, $('camp-name-input').value);
    ui.hud.notify(`${naming.name} is founded. Its fire keeps you warm through the night.`);
    naming = null;
    save(session, ui, true);
    ui.hud.update();
  });

  return { openNaming };
}
