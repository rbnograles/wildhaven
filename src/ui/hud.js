// The HUD: the on-screen panels shown while playing (resources, clock, survival meters, region
// name and progress, goals card, interact button, build bar) and the short pop-up messages called
// toasts. It only shows the game state; it never changes it.
import { RESOURCES } from '../data/supplies.js';
import { CAMPFIRE_COST } from '../data/balance.js';
import { NODES } from '../world/nodes.js';
import { regionOf } from '../world/regions.js';
import { regionProgress } from '../world/progress.js';
import { clockLabel, phaseOf } from '../world/clock.js';
import { nearestCamp, campInReach } from '../world/camps.js';
import { describeNeed, needProgress } from '../world/needs.js';
import { nearbyNode } from '../actions/gather.js';
import { meterTrends } from '../actions/survive.js';
import { $ } from './layout.js';

// Turns a supply's verb into its "-ing" form for the busy button, e.g. Chop → Chopping.
const DOING = { Chop: 'Chopping', Pick: 'Picking', Gather: 'Gathering' };

// How long the controls strip stays up when nobody moves, and how long its fade-out takes.
const KEY_STRIP_MS = 8000,
  KEY_STRIP_FADE_MS = 600;

// The word shown beside a meter for each cause meterTrends gives (tea also shows its seconds left).
const TREND_WORDS = {
  warming: 'By the fire',
  tea: 'Tea',
  cold: 'Cold',
  freezing: 'Freezing',
  starving: 'Starving',
};

/**
 * Puts a survival event into words for a toast.
 *
 * @param {object} event - An event from tickSurvival or skipTo, such as `{kind: 'dusk'}`.
 * @returns {string} The message, or '' for an event with no toast (passing out has its own screen).
 */
export function describeEvent(event) {
  if (event.kind === 'dusk') return 'Dusk is falling. Head to a fire before dark.';
  if (event.kind === 'night') return 'Getting dark, head to a fire.';
  if (event.kind === 'freezing') return "You're freezing. Your health is dropping.";
  if (event.kind === 'starving') return "You're starving. Eat something (F).";
  if (event.kind === 'dawn') {
    const needs = event.camps.length ? ` New needs at ${event.camps.join(', ')}.` : '';
    return `Dawn, day ${event.day}.${needs}`;
  }
  return '';
}

/**
 * Builds the HUD helpers for one game session.
 *
 * @param {object} session - The shared session; `update` reads its game state, animator and build mode.
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
   * Shows the clock and the three survival meters, each with a word saying why it is changing.
   *
   * @param {object} state - The game being played.
   */
  function updateMeters(state) {
    $('identity-status').dataset.phase = phaseOf(state.time);
    $('clock').textContent = clockLabel(state.time);
    const trends = meterTrends(state);
    for (const name of ['health', 'hunger', 'warmth']) {
      const value = Math.round(state.meters[name]),
        meter = $(`meter-${name}`),
        trend = trends[name];
      meter.style.setProperty('--fill', `${value}%`);
      meter.setAttribute('aria-valuenow', String(value));
      meter.classList.toggle('low', value <= 25);
      meter.querySelector('.meter-tag').textContent =
        trend === 'tea' ? `Tea ${Math.ceil(state.tea)}s` : (TREND_WORDS[trend] ?? '');
    }
  }

  /**
   * Fills the goals card's list: one line per goal with its count, ticked off when complete.
   *
   * @param {{text: string, have: number, want: number}[]} goals - The goals to show.
   */
  function showGoals(goals) {
    $('quest-lines').replaceChildren(
      ...goals.map(({ text, have, want }) => {
        const item = document.createElement('li'),
          count = document.createElement('b');
        count.textContent = `${have} / ${want}`;
        item.append(text, count);
        item.classList.toggle('complete', have >= want);
        return item;
      }),
    );
  }

  /**
   * Fills the goals card: building the first campfire, then the nearest camp's needs.
   *
   * @param {object} state - The game being played.
   */
  function updateGoals(state) {
    const camp = nearestCamp(state);
    if (!camp) {
      const { wood, stone } = CAMPFIRE_COST;
      $('quest-label').textContent = 'BEFORE NIGHTFALL';
      $('quest-title').textContent = 'Build a campfire';
      $('quest-text').textContent =
        `Night is cold away from a fire. Gather ${wood} wood and ${stone} stone, then press B to place it.`;
      showGoals([
        { text: 'Wood', have: Math.min(state.resources.wood, wood), want: wood },
        { text: 'Stone', have: Math.min(state.resources.stone, stone), want: stone },
      ]);
      return;
    }
    $('quest-label').textContent = 'CAMP NEEDS';
    $('quest-title').textContent = camp.name;
    $('quest-text').textContent = 'Meet needs to grow the fire. New needs arrive at dawn.';
    showGoals(
      camp.needs.map((need) => ({ text: describeNeed(need), ...needProgress(state, need) })),
    );
  }

  /**
   * Shows the interact button and the build bar for what the player can do right now.
   *
   * The button is "busy" while gathering, "Place campfire" in build mode, the gather verb when a
   * supply is in reach, and "Open <camp>" beside one of the player's fires.
   *
   * @param {object} state - The game being played.
   */
  function updateActions(state) {
    const { animator, build } = session;
    const node = nearbyNode(state),
      busy = NODES.find((n) => n.id === animator.pending?.target),
      camp = !node && campInReach(state),
      button = $('interact'),
      label = button.querySelector('span');
    button.hidden = !node && !busy && !build.active && !camp;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy) label.textContent = `${DOING[busy.verb]} ${busy.label.toLowerCase()}… move to stop`;
    else if (build.active) label.textContent = 'Place campfire';
    else if (node) label.textContent = `${node.verb} ${node.label.toLowerCase()}`;
    else if (camp) label.textContent = `Open ${camp.name}`;

    // The build bar: what a campfire costs, or why it can't stand where the ghost is.
    const bar = $('build-bar');
    bar.hidden = !build.active;
    if (!build.active) return;
    const ok = !!build.check?.ok;
    bar.classList.toggle('blocked', !ok);
    bar.textContent = ok
      ? `Campfire · ${CAMPFIRE_COST.wood} wood · ${CAMPFIRE_COST.stone} stone · Click or E to place · Esc to cancel`
      : `${build.check?.message ?? 'Choose a spot'} · Esc to cancel`;
  }

  /**
   * Refreshes every HUD panel so it matches the current game.
   *
   * Like updating a scoreboard: resources, the clock and meters, the region's name and progress,
   * the goals card, and the action button.
   */
  function update() {
    const { state } = session;
    if (!state) return;
    for (const resource of RESOURCES) $(resource).textContent = state.resources[resource];
    updateMeters(state);

    const region = regionOf(state.player.x, state.player.y),
      { places, signposts } = regionProgress(state, region.id);
    $('region-name').textContent = region.name;
    $('region-progress').textContent =
      `${places.found} / ${places.total} places · ${signposts.found} / ${signposts.total} signposts`;

    updateGoals(state);
    updateActions(state);
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
