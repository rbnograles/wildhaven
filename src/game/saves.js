// Saving and remembering. Each character has its own save slot in the browser's storage, and
// this tab remembers which character it is playing so a refresh drops you back into the game.
// The storage is passed in, so tests can use a fake one.

import { serializeGame } from './state.js';
import { CHARACTERS } from '../data/characters.js';

/**
 * Gives the storage key for a character's save slot.
 *
 * @param {string} id - The character id.
 * @returns {string} A key like `wildhaven.adventure.v1.scout`.
 */
export const storageKey = (id) => `wildhaven.adventure.v1.${id}`;

// The character this tab is playing. Kept in sessionStorage so a refresh resumes play,
// while a new tab or an explicit exit goes back to the selection screen.
const activeKey = 'wildhaven.active';

/**
 * Reads which character this tab was playing, like checking a bookmark.
 *
 * @param {Storage} storage - Where the bookmark lives (the tab's sessionStorage).
 * @returns {string|null} A known character id, or null if there's none or storage is blocked.
 */
export function readActive(storage) {
  try {
    const id = storage.getItem(activeKey);
    return CHARACTERS.some((c) => c.id === id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Sets or clears which character this tab is playing. Fails quietly if storage is blocked.
 *
 * @param {Storage} storage - Where the bookmark lives (the tab's sessionStorage).
 * @param {string|null} id - The character id to remember, or null to forget it.
 */
export function setActive(storage, id) {
  try {
    if (id) storage.setItem(activeKey, id);
    else storage.removeItem(activeKey);
  } catch {}
}

/**
 * Creates a saver for one character's slot that refuses to overwrite a newer save.
 *
 * It remembers the last text it saw in the slot. If the slot has changed since then, another
 * tab must have saved, so this one stops instead of wiping out that newer progress. It's like
 * checking nobody else wrote in the shared notebook before you write your page.
 *
 * @param {Storage} storage - Where saves live (the browser's localStorage).
 * @param {string} character - The character id this saver writes for.
 * @param {string|null} initialRaw - The slot's text when the game was loaded (null if empty).
 * @returns {{write: function(object): {ok: boolean, reason?: string}}} The saver.
 */
export function createSaveSession(storage, character, initialRaw) {
  let expected = initialRaw;
  return {
    /**
     * Saves the game into this character's slot.
     *
     * @param {object} state - The game being played.
     * @returns {{ok: boolean, reason?: string}} `ok` when saved; otherwise `reason` is
     *   'character' (wrong character), 'conflict' (another tab saved first) or 'unavailable'
     *   (the browser blocked storage or it is full).
     */
    write(state) {
      if (state.character !== character) return { ok: false, reason: 'character' };
      try {
        const key = storageKey(character),
          next = serializeGame(state);
        if (storage.getItem(key) !== expected) return { ok: false, reason: 'conflict' };
        storage.setItem(key, next);
        expected = next;
        return { ok: true };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
  };
}
