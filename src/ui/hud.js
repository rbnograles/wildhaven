// The HUD: the on-screen panels shown while playing (the player card with clock and survival
// meters, the item box, the build menu and build bar, region name and progress, goals card,
// interact button) and the short pop-up messages called toasts. It only shows the game state; it
// never changes it.
import { RESOURCES } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import { CAMPFIRE_COST, REPAIR_COST, DAY_SECONDS, PHASES } from '../data/balance.js';
import { NODES } from '../world/nodes.js';
import { regionOf } from '../world/regions.js';
import { regionProgress } from '../world/progress.js';
import { clockLabel, phaseOf, timeOfDay } from '../world/clock.js';
import { nearestCamp, campInReach } from '../world/camps.js';
import { describeNeed, needProgress } from '../world/needs.js';
import { missingForRepair, listMissing } from '../actions/boat.js';
import { chooseInteraction } from '../actions/interact.js';
import { meterTrends } from '../actions/survive.js';
import { $ } from './layout.js';

// Turns a supply's verb into its "-ing" form for the busy button, e.g. Chop → Chopping.
const DOING = { Chop: 'Chopping', Pick: 'Picking', 'Pick up': 'Picking up', Gather: 'Gathering' };

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

    // The day dial: its face turns so the present moment sits under the pin at the top.
    const dial = $('day-dial');
    dial.style.setProperty('--turn', `${(-timeOfDay(state.time) / DAY_SECONDS) * 360}deg`);
    dial.title = dial.ariaLabel = clockLabel(state.time);

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
   * Paints the day dial's face once: a round clock of one whole day, coloured by its four parts.
   *
   * Like a pie cut by the hours in `PHASES`: a thin peach slice for dawn, a wide sky-blue one for
   * day, an orange one for dusk and a dark blue one for night. The slices come from the balance
   * numbers, so changing the length of the night changes the dial too.
   */
  function paintDayDial() {
    /** Turns a moment of the day (in game seconds) into how far round the dial it is. */
    const at = (seconds) => `${(seconds / DAY_SECONDS) * 360}deg`;
    $('day-dial-face').style.background =
      `conic-gradient(#f6c98a 0 ${at(PHASES.day)}, #8fd0ee ${at(PHASES.day)}, #5fb2e6 ${at(PHASES.dusk)}, ` +
      `#e58a4a ${at(PHASES.dusk)} ${at(PHASES.night)}, #1c2a57 ${at(PHASES.night)}, #2a3c7a 360deg)`;

    // The sun sits in the middle of the day's slice and the moon in the middle of the night's.
    $('day-dial').style.setProperty('--noon', at((PHASES.day + PHASES.dusk) / 2));
    $('day-dial').style.setProperty('--midnight', at((PHASES.night + DAY_SECONDS) / 2));
  }
  paintDayDial();

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
   * Fills the goals card with the current goal, the most pressing first: building the first
   * campfire, then mending an old boat once one has been found (until the player owns a boat),
   * then the nearest camp's needs.
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
    if (state.wrecks.length && !state.boat) {
      // An old boat has been found but not mended: the card becomes the shopping list for the repair.
      const { wood, stone } = REPAIR_COST;
      $('quest-label').textContent = 'AN OLD BOAT';
      $('quest-title').textContent = 'Mend a boat';
      $('quest-text').textContent =
        'Repair an old boat to sail the coast. Driftwood washes up on the beaches.';
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
   * The button matches what E would do (see core/input.js): "busy" while gathering or repairing,
   * "Place campfire" in build mode, then step ashore, board, repair or gather (chooseInteraction),
   * and "Open <camp>" beside one of the player's fires when none of those is in reach.
   *
   * @param {object} state - The game being played.
   */
  function updateActions(state) {
    const { animator, build } = session;
    const choice = chooseInteraction(state),
      busy = busyLabel(animator),
      camp = !choice && !state.aboard && campInReach(state),
      button = $('interact'),
      label = button.querySelector('span');
    button.hidden = !choice && !busy && !build.active && !camp;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy) label.textContent = busy;
    else if (build.active) label.textContent = 'Place campfire';
    else if (choice) label.textContent = actionLabel(state, choice);
    else if (camp) label.textContent = `Open ${camp.name}`;
    // The controls strip sits where the action button and build menu appear, so it gives way.
    if (!button.hidden || build.menu) hideKeyStrip();

    // The build menu and its button. A campfire the player can't afford yet is shown faded, but
    // can still be picked, so the ghost can explain what is missing.
    const short = Object.entries(CAMPFIRE_COST).some(([type, n]) => state.resources[type] < n);
    $('build-menu').hidden = !build.menu;
    $('build-button').setAttribute('aria-expanded', String(build.menu));
    $('build-button').classList.toggle('active', build.menu || build.active);
    $('build-campfire').classList.toggle('short', short);

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
    // The item box: each slot's count, faded when there is none.
    for (const resource of RESOURCES) {
      $(resource).textContent = state.resources[resource];
      $(resource).parentElement.classList.toggle('empty', state.resources[resource] === 0);
    }
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
