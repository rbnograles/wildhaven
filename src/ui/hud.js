// The HUD: the on-screen panels shown while playing (resources, region name, quest, interact
// button) and the short pop-up messages called toasts. It only shows the game state; it never
// changes it.
import { RESOURCES } from '../data/supplies.js';
import { NODES } from '../world/nodes.js';
import { regionAt } from '../world/regions.js';
import { nearbyNode, hasGathered } from '../actions/gather.js';
import { $ } from './layout.js';

// Turns a supply's verb into its "-ing" form for the busy button, e.g. Chop → Chopping.
const DOING = { Chop: 'Chopping', Pick: 'Picking', Gather: 'Gathering' };

// How long the controls strip stays up when nobody moves, and how long its fade-out takes.
const KEY_STRIP_MS = 8000,
  KEY_STRIP_FADE_MS = 600;

/**
 * Builds the HUD helpers for one game session.
 *
 * @param {object} session - The shared session; `update` reads its game state and animator.
 * @returns {{notify: Function, update: Function, showKeyStrip: Function, hideKeyStrip: Function}} A way to
 * pop up a message, a way to redraw the HUD, and ways to show and hide the controls strip.
 */
export function createHud(session) {
  let toastTimer;
  let keyStripTimer;

  /**
   * Shows a short message at the bottom of the screen for about three seconds.
   *
   * A new message replaces the old one and restarts the timer, so messages never pile up.
   *
   * @param {string} message - The text to show.
   */
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
  }

  /**
   * Refreshes every HUD panel so it matches the current game.
   *
   * Like updating a scoreboard: it copies the resource counts, the region name and the quest
   * progress onto the screen, and shows the interact button when a supply is in reach.
   */
  function update() {
    const { state, animator } = session;

    // Resources, region and quest progress.
    for (const resource of RESOURCES) $(resource).textContent = state.resources[resource];
    $('region-name').textContent = regionAt(state.player);
    $('discovery-count').textContent = `${state.discovered.length} / 3`;
    $('quest-gather').classList.toggle('complete', hasGathered(state));
    $('quest-explore').classList.toggle('complete', state.discovered.length === 3);
    if (hasGathered(state) && state.discovered.length === 3)
      $('quest-text').textContent =
        'You have found your feet. Keep exploring — this is just the beginning.';
    else
      $('quest-text').textContent = 'Gather supplies and follow the paths to discover the world.';

    // The interact button: hidden when nothing is in reach, "busy" while an action runs.
    const node = nearbyNode(state),
      busy = NODES.find((n) => n.id === animator.pending?.target),
      button = $('interact');
    button.hidden = !node && !busy;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy)
      button.querySelector('span').textContent =
        `${DOING[busy.verb]} ${busy.label.toLowerCase()}… move to stop`;
    else if (node)
      button.querySelector('span').textContent = `${node.verb} ${node.label.toLowerCase()}`;
  }

  /**
   * Shows the controls strip at the bottom of the screen, then fades it after 8 seconds.
   * Called each time the game screen opens.
   */
  function showKeyStrip() {
    const strip = $('key-strip');
    clearTimeout(keyStripTimer);
    strip.classList.remove('fading');
    strip.hidden = false;
    keyStripTimer = setTimeout(hideKeyStrip, KEY_STRIP_MS);
  }

  /**
   * Fades the controls strip out and then hides it. Does nothing if it is already hidden or
   * fading, so the game loop can call it on every step without cost.
   */
  function hideKeyStrip() {
    const strip = $('key-strip');
    if (strip.hidden || strip.classList.contains('fading')) return;
    clearTimeout(keyStripTimer);
    strip.classList.add('fading');
    keyStripTimer = setTimeout(() => {
      strip.hidden = true;
      strip.classList.remove('fading');
    }, KEY_STRIP_FADE_MS);
  }

  return { notify, update, showKeyStrip, hideKeyStrip };
}
