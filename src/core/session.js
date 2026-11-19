// The shared session: the one object every browser module reads and changes.
// It also owns switching screens (selection, loading, game), saving, starting a game,
// and going back to the character selection screen.

import { CHARACTERS } from '../data/characters.js';
import { createGame } from '../game/state.js';
import { createSaveSession, setActive } from '../game/saves.js';
import { createAnimator } from '../animation/clips.js';
import { discover } from '../actions/discover.js';
import { hasJournalPage } from '../world/journal.js';
import { createRenderer } from '../render/renderer.js';
import { logStart, logFinds } from './playtest.js';
import { $ } from '../ui/layout.js';

// The character this tab is playing lives in sessionStorage; null when the browser blocks it.
// sessionStorage is like a sticky note on this one tab: a refresh keeps it, a new tab starts blank.
export const tabStorage = (() => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
})();

/**
 * Creates the shared session object with everything set to "nothing chosen yet".
 *
 * Everything that used to be a top-level `let` in main.js lives here, so every module sees the
 * same values. `keys` and `clock` are never reassigned, only changed in place, so modules may
 * keep a reference to them.
 *
 * @returns {object} The new session: selected character, game state, animator, renderer, save
 *   session, last save failure, current screen, load counter, held keys, and frame clock.
 */
export function createSession() {
  return {
    selected: 'scout',
    state: null,
    animator: createAnimator(),
    renderer: null,
    saveSession: null,
    saveFailure: '',
    screen: 'selection',
    loadId: 0,
    keys: new Set(),
    clock: { last: 0, sinceSave: 0, sinceHud: 0 },
  };
}

/**
 * Shows one screen and hides the others.
 *
 * Only one of "selection", "loading" or "game" is visible at a time, like changing the slide on
 * a projector. Held keys are forgotten so a key pressed on one screen doesn't leak into the next.
 *
 * @param {object} session - The shared session; its `screen` is updated.
 * @param {string} next - The screen to show: 'selection', 'loading' or 'game'.
 */
export function changeScreen(session, next) {
  session.screen = next;
  session.keys.clear();
  for (const name of ['selection', 'loading', 'game']) $(name).hidden = name !== next;
  document.body.classList.toggle('playing', next === 'game');
}

/**
 * Saves the current game and tells the player if it didn't work.
 *
 * Saving can fail when storage is blocked, or when another tab saved this character more
 * recently (a "conflict"). Silent saves (autosaves) only speak up the first time a new kind of
 * failure happens, so the player isn't spammed every 10 seconds.
 *
 * @param {object} session - The shared session holding the game state and save session.
 * @param {object} ui - The UI helpers; `ui.hud.notify` shows messages.
 * @param {boolean} [silent=false] - True for automatic saves that shouldn't announce success.
 * @returns {boolean} True if the save was written.
 */
export function save(session, ui, silent = false) {
  if (!session.state) return false;
  const result = session.saveSession?.write(session.state) ?? { ok: false, reason: 'unavailable' };

  if (result.ok) {
    session.saveFailure = '';
    $('pause-save-note').textContent = 'Progress is saved when you leave.';
    if (!silent) ui.hud.notify('Adventure saved. Your path will be here.');
    return true;
  }

  const conflict = result.reason === 'conflict';
  const message = conflict
    ? 'Another tab saved this character. Return to characters to load the newer adventure.'
    : 'Saving is unavailable. Leaving now will lose this session’s progress.';
  $('pause-save-note').textContent = message;
  if (!silent || session.saveFailure !== result.reason) ui.hud.notify(message);
  session.saveFailure = result.reason;
  return false;
}

/**
 * Loads the selected character's game (or a fresh one) and switches to the game screen.
 *
 * First it shows the loading screen, then builds the renderer the first time (this loads all the
 * artwork, so it can be slow or fail). If loading fails, the loading screen shows a "Try again"
 * button instead of spinning forever. If the player backs out mid-load, `loadId` changes and this
 * call quietly gives up, like a ticket number that is no longer being served.
 *
 * @param {object} session - The shared session; gets the new game state, save session and animator.
 * @param {object} ui - The UI helpers (`selection`, `hud`, `journal`).
 * @param {boolean} [fresh=false] - True to ignore any existing save and start a new adventure.
 * @returns {Promise<void>} Resolves once the game is showing, or loading stopped or failed.
 */
export async function start(session, ui, fresh = false) {
  const slot = ui.selection.readSlot(session.selected);

  // A save that can't be read asks before it is replaced.
  if (slot.invalid && !fresh) {
    $('reset-message').textContent =
      'This character’s save could not be read. Start a fresh adventure? Other characters will be kept.';
    $('reset-dialog').showModal();
    return;
  }

  // Show the loading screen.
  const token = ++session.loadId;
  changeScreen(session, 'loading');
  $('loading-title').textContent = slot.value && !fresh ? 'Welcome back.' : 'A new path awaits.';
  $('loading-text').textContent =
    `Travelling to ${CHARACTERS.find((c) => c.id === session.selected).location}…`;
  $('loading-bar').hidden = false;
  $('retry').hidden = true;

  try {
    if (!session.renderer) session.renderer = await createRenderer($('world'), $('minimap'));
    if (token !== session.loadId) return;

    // Use the saved game, or make a new one, and get ready to save it.
    const state = (session.state =
      !fresh && slot.value ? slot.value : createGame(session.selected));
    try {
      session.saveSession = createSaveSession(localStorage, state.character, slot.raw);
    } catch {
      session.saveSession = null;
    }
    session.saveFailure = '';
    session.animator = createAnimator();

    // Fill in the HUD and switch to the game screen.
    const c = CHARACTERS.find((c) => c.id === state.character);
    $('hud-name').textContent = c.shortName;
    $('hud-portrait').dataset.portrait = c.id; // style.css picks this character's idle sheet
    // Places found just by arriving (the Scout starts at their camp) count straight away.
    const arrived = discover(state);
    session.renderer.resetCamera();
    changeScreen(session, 'game');
    ui.hud.showKeyStrip();
    setActive(tabStorage, state.character);
    Object.assign(session.clock, { last: performance.now(), sinceSave: 0, sinceHud: 0 });
    ui.hud.update();
    ui.journal.refreshDot();
    save(session, ui, true);
    $('world').focus();
    logStart(session, !(slot.value && !fresh));
    logFinds(session, arrived);

    // The welcome line. A journal page found on arrival is mentioned, so the player learns about J.
    const page = arrived.some((f) => f.kind === 'landmark' && hasJournalPage(f.id))
      ? ' Your journal has its first page (J).'
      : '';
    ui.hud.notify(
      slot.value && !fresh
        ? 'Welcome back. Your journey continues.'
        : `Welcome to ${c.location}. Your story begins here.${page}`,
    );
  } catch (error) {
    // Loading failed: show the reason and a "Try again" button.
    if (token !== session.loadId) return;
    $('loading-title').textContent = 'The trail hit a snag.';
    $('loading-text').textContent = error.message;
    $('loading-bar').hidden = true;
    $('retry').hidden = false;
    $('retry').onclick = () => start(session, ui, fresh);
  }
}

/**
 * Saves and goes back to the character selection screen ("Return to characters" in the pause menu).
 *
 * If the save fails, the player is asked first, because leaving would lose this session's progress.
 *
 * @param {object} session - The shared session; its game state and save session are cleared.
 * @param {object} ui - The UI helpers (`selection`, `hud`).
 */
export function leave(session, ui) {
  if (
    !save(session, ui, true) &&
    !window.confirm(
      'This adventure could not be saved. Return to characters and lose this session’s progress?',
    )
  )
    return;

  $('pause-dialog').close();
  session.state = null;
  session.saveSession = null;
  setActive(tabStorage, null);
  changeScreen(session, 'selection');
  ui.selection.select(session.selected);
  $('begin').focus();
}

/**
 * Stops loading and goes back to the character selection screen ("Back to characters").
 *
 * Bumping `loadId` makes the pending `start()` give up when it notices its number is old.
 *
 * @param {object} session - The shared session.
 */
export function cancelLoading(session) {
  session.loadId++;
  setActive(tabStorage, null);
  changeScreen(session, 'selection');
  $('begin').focus();
}
