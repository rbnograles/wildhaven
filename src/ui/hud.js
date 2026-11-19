// The HUD: the on-screen panels shown while playing (resources, region name, quest, interact
// button) and the short pop-up messages called toasts. It only shows the game state; it never
// changes it.
import { RESOURCES } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import { REPAIR_COST } from '../data/balance.js';
import { NODES } from '../world/nodes.js';
import { regionAt, regionOf } from '../world/regions.js';
import { regionProgress } from '../world/progress.js';
import { hasGathered } from '../actions/gather.js';
import { missingForRepair, listMissing } from '../actions/boat.js';
import { chooseInteraction } from '../actions/interact.js';
import { $ } from './layout.js';

// Turns a supply's verb into its "-ing" form for the busy button, e.g. Chop → Chopping.
const DOING = { Chop: 'Chopping', Pick: 'Picking', 'Pick up': 'Picking up', Gather: 'Gathering' };

// How long the controls strip stays up when nobody moves, and how long its fade-out takes.
const KEY_STRIP_MS = 8000,
  KEY_STRIP_FADE_MS = 600;

/**
 * Words for the interact button when E would do `choice`, e.g. "Board the boat" or "Chop pine tree".
 *
 * @param {object} state - The game being played.
 * @param {{kind: string, target: object}} choice - What chooseInteraction picked.
 * @returns {string} The button's words.
 */
function actionLabel(state, choice) {
  if (choice.kind === 'land') return 'Step ashore';
  if (choice.kind === 'board') return 'Board the boat';
  if (choice.kind === 'repair') {
    const missing = missingForRepair(state);
    return Object.keys(missing).length
      ? `Repair the old boat · need ${listMissing(missing)}`
      : 'Repair the old boat';
  }
  return `${choice.target.verb} ${choice.target.label.toLowerCase()}`;
}

/**
 * Words for the interact button while a timed action runs, or null when none is running.
 *
 * @param {object} animator - The player's animation state.
 * @returns {string|null} E.g. "Repairing the old boat… move to stop".
 */
function busyLabel(animator) {
  const target = animator.pending?.target;
  if (!target) return null;
  if (WRECKS.some((w) => w.id === target)) return 'Repairing the old boat… move to stop';
  const node = NODES.find((n) => n.id === target);
  return node ? `${DOING[node.verb]} ${node.label.toLowerCase()}… move to stop` : null;
}

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
   * Like updating a scoreboard: it copies the resource counts, the region name and the goals card
   * (the starting goals, a found old boat's repair list, then the current region's progress) onto the
   * screen, and shows the interact button when E would do something.
   */
  function update() {
    const { state, animator } = session;

    // Resources, region and quest progress.
    for (const resource of RESOURCES) $(resource).textContent = state.resources[resource];
    $('region-name').textContent = regionAt(state.player);
    /**
     * Fills one line of the goals card: its words, its count, and whether it is ticked off.
     * The count is a number we made ourselves, so putting it in with innerHTML is safe.
     */
    const line = (id, text, found, total) => {
      $(id).innerHTML = `${text} <b>${found} / ${total}</b>`;
      $(id).classList.toggle('complete', found >= total);
    };

    // The starting goals come first. Once both are done, the card follows the region the player is in.
    const regions = Math.min(state.discovered.length, 3),
      started = hasGathered(state) && regions === 3;
    if (!started) {
      $('quest-label').textContent = 'YOUR FIRST FOOTSTEPS';
      $('quest-title').textContent = 'A place to begin';
      $('quest-text').textContent = 'Gather supplies and set out to discover the world.';
      line('quest-first', 'Gather your first supplies', hasGathered(state) ? 1 : 0, 1);
      line('quest-second', 'Discover three regions', regions, 3);
    } else if (state.wrecks.length && !state.boat) {
      // An old boat has been found but not mended: the card becomes the shopping list for the repair.
      $('quest-label').textContent = 'AN OLD BOAT';
      $('quest-title').textContent = 'Mend a boat';
      $('quest-text').textContent =
        'Repair an old boat to sail the coast. Driftwood washes up on the beaches.';
      line(
        'quest-first',
        'Wood',
        Math.min(state.resources.wood, REPAIR_COST.wood),
        REPAIR_COST.wood,
      );
      line(
        'quest-second',
        'Stone',
        Math.min(state.resources.stone, REPAIR_COST.stone),
        REPAIR_COST.stone,
      );
    } else {
      const region = regionOf(state.player.x, state.player.y),
        progress = regionProgress(state, region.id);
      $('quest-label').textContent = 'EXPLORING';
      $('quest-title').textContent = region.name;
      $('quest-text').textContent = 'Find every place and signpost in this region.';
      line('quest-first', 'Places found', progress.places.found, progress.places.total);
      line('quest-second', 'Signposts found', progress.signposts.found, progress.signposts.total);
    }

    // The interact button: what E would do now, or "busy" while a timed action runs.
    const choice = chooseInteraction(state),
      busy = busyLabel(animator),
      button = $('interact');
    button.hidden = !choice && !busy;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    button.querySelector('span').textContent = busy ?? (choice ? actionLabel(state, choice) : '');
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
