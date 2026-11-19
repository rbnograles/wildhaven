// The character selection screen, the first screen the player sees.
// It shows each character's story and save status, and starts the game when "Begin" is pressed.
import { CHARACTERS, nextCharacterId } from '../data/characters.js';
import { restoreGame } from '../game/state.js';
import { storageKey } from '../game/saves.js';
import { start, cancelLoading } from '../core/session.js';
import { $, icon } from './layout.js';

/**
 * Wires up the character cards and buttons on the selection screen.
 *
 * @param {object} session - The shared session; `selected` holds the chosen character's id.
 * @param {object} ui - The other UI parts, passed on when the game starts.
 * @returns {{readSlot: Function, select: Function}} Helpers to read a character's save and to pick a character.
 */
export function setupSelection(session, ui) {
  /**
   * Reads one character's saved game from the browser's storage.
   *
   * Each character has its own save slot, like a separate notebook. This opens the notebook
   * and checks that the save inside is readable and really belongs to that character.
   *
   * @param {string} id - The character id, such as `scout`.
   * @returns {{raw: string|null, value: object|null, invalid: boolean}} The stored text, the
   *   restored game (null if there is none or it is unreadable), and whether a save exists but can't be read.
   */
  function readSlot(id) {
    try {
      const raw = localStorage.getItem(storageKey(id));
      const value = raw ? restoreGame(raw) : null;
      return {
        raw,
        value: value?.character === id ? value : null,
        invalid: !!raw && (!value || value.character !== id),
      };
    } catch {
      // The browser blocked storage (for example in some private modes). Play still works, unsaved.
      $('storage-note').textContent =
        'Storage is unavailable. You can play, but progress will not persist.';
      return { raw: null, value: null, invalid: false };
    }
  }

  /**
   * Picks a character and shows their story, kit and save status.
   *
   * The big button says "Continue" when the character has a save and "Begin" when they don't.
   *
   * @param {string} id - The character id, such as `scout`.
   */
  function select(id) {
    session.selected = id;
    const c = CHARACTERS.find((c) => c.id === id),
      slot = readSlot(id);

    // Mark only the chosen card as pressed.
    document
      .querySelectorAll('[data-character]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.character === id)));

    $('tagline').textContent = c.tagline;
    $('description').textContent = c.description;
    $('kit').textContent = c.kit;
    $('begin').innerHTML =
      `${slot.value ? 'Continue your journey' : 'Begin your journey'} ${icon('arrow')}`;
    $('fresh').hidden = !slot.value;
    $('save-hint').textContent = slot.value
      ? `${slot.value.discovered.length} of 3 regions discovered · Adventure saved`
      : slot.invalid
        ? 'This save could not be read. Start fresh to play.'
        : 'Your own path through a shared world.';
  }

  // Character cards: click to pick, or use the left and right arrow keys to move between them.
  document.querySelectorAll('[data-character]').forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.character));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      // Step one card right or left (wrapping round), then focus that card.
      select(nextCharacterId(button.dataset.character, event.key === 'ArrowRight' ? 1 : -1));
      document.querySelector(`[data-character="${session.selected}"]`).focus();
    });
  });

  $('begin').addEventListener('click', () => start(session, ui));

  // "Start a fresh adventure" asks first, because it replaces the saved game.
  $('fresh').addEventListener('click', () => {
    $('reset-message').textContent =
      'This replaces this character’s saved adventure. Your other characters will be kept.';
    $('reset-dialog').showModal();
  });

  $('loading-back').addEventListener('click', () => cancelLoading(session));

  return { readSlot, select };
}
