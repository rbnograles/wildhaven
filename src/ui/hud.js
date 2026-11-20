// The HUD: the on-screen panels shown while playing (the player card with clock and survival
// meters, the item box and tools row, the build menu and build bar, region name and progress,
// goals card, interact button) and the short pop-up messages called toasts. It only shows the game
// state; it never changes it.
import { RESOURCES } from '../data/supplies.js';
import { WRECKS } from '../data/places.js';
import {
  CAMPFIRE_COST,
  REPAIR_COST,
  DAY_SECONDS,
  PHASES,
  TOOL_WEAR_WARNING,
} from '../data/balance.js';
import { TOOLS, toolInfo } from '../data/tools.js';
import { NODES } from '../world/nodes.js';
import { regionOf } from '../world/regions.js';
import { regionProgress } from '../world/progress.js';
import { clockLabel, phaseOf, timeOfDay } from '../world/clock.js';
import { nearestCamp, campInReach } from '../world/camps.js';
import { describeNeed, needProgress } from '../world/needs.js';
import { missingForRepair, listMissing } from '../actions/boat.js';
import { chooseInteraction } from '../actions/interact.js';
import { lockedNode } from '../actions/gather.js';
import { canCraft, nextTier, toolName, CRAFT_PREFIX } from '../actions/craft.js';
import { meterTrends } from '../actions/survive.js';
import { $ } from './layout.js';

// How many pop-up messages can show at once above the player card; an older one makes room.
const TOAST_STACK = 4;

// Turns a supply's verb into its "-ing" form for the busy button, e.g. Chop → Chopping.
const DOING = {
  Chop: 'Chopping',
  Mine: 'Mining',
  Pick: 'Picking',
  'Pick up': 'Picking up',
  Gather: 'Gathering',
};

/**
 * Writes a cost as words for the Build menu.
 *
 * @param {object} cost - Such as `{wood: 2, stone: 1, iron: 3}`.
 * @returns {string} Such as "2 wood · 1 stone · 3 iron".
 */
const costWords = (cost) =>
  Object.entries(cost)
    .map(([type, n]) => `${n} ${type}`)
    .join(' · ');

/**
 * Gives words a capital first letter, such as "Stone axe".
 *
 * @param {string} words - The words.
 * @returns {string} The same words, starting with a capital.
 */
const capital = (words) => words[0].toUpperCase() + words.slice(1);

// How long the controls strip stays up when nobody moves, and how long its fade-out takes.
const KEY_STRIP_MS = 8000,
  KEY_STRIP_FADE_MS = 600;

// The word shown beside a meter for each cause meterTrends gives (tea also shows its seconds left).
const TREND_WORDS = {
  warming: 'By the fire',
  tea: 'Tea',
  cold: 'Cold',
  snow: 'Snow',
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
  if (event.kind === 'starving')
    return "You're starving. Your health is dropping. Eat something (F).";
  if (event.kind === 'dawn') {
    const needs = event.camps.length ? ` New needs at ${event.camps.join(', ')}.` : '';
    return `Dawn, day ${event.day}.${needs}`;
  }
  return '';
}

/**
 * Words for a stone tool wearing out: a warning at a few uses left, or that it broke.
 *
 * @param {string} tool - The tool's id.
 * @param {string|null} wear - What wearTool said: 'warn', 'broke' or null.
 * @returns {string} The words, or '' when there is nothing to say.
 */
function wearWords(tool, wear) {
  if (wear === 'warn') return `Stone ${tool}: ${TOOL_WEAR_WARNING} uses left`;
  if (wear === 'broke') return `Your stone ${tool} broke`;
  return '';
}

/**
 * Puts a finished timed action into words for a toast: a mended boat, supplies gathered, or a tool
 * made, plus any news about a tool wearing out.
 *
 * @param {object} finished - What finishInteraction returned.
 * @returns {string} The message.
 */
export function describeFinish(finished) {
  if (finished.kind === 'repair')
    return 'Boat repaired · Walk to the water’s edge and press E to board';
  if (finished.kind === 'craft') {
    if (!finished.ok) return finished.message;
    const made = `${capital(toolName(finished.tool, finished.tier))} made`;
    return [made, wearWords('hammer', finished.wear)].filter(Boolean).join(' · ');
  }
  const { node, wear } = finished;
  return [`+${node.amount} ${node.type} · ${node.label}`, wearWords(node.tool, wear)]
    .filter(Boolean)
    .join(' · ');
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
 * @param {object} state - The game being played (to name the tier being crafted).
 * @param {object} animator - The player's animation state.
 * @returns {string|null} E.g. "Crafting stone axe… move to stop".
 */
function busyLabel(state, animator) {
  const target = animator.pending?.target;
  if (!target) return null;
  if (target.startsWith(CRAFT_PREFIX)) {
    const tool = target.slice(CRAFT_PREFIX.length);
    return `Crafting ${toolName(tool, nextTier(state, tool) ?? 'iron')}… move to stop`;
  }
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
  let keyStripTimer;

  /**
   * Shows a short message above the player card for about three seconds.
   *
   * Messages stack like sticky notes: a new one is added under the others, and each fades out on
   * its own timer. Only the newest few are kept (TOAST_STACK), so a burst of messages can't climb
   * up the screen, and the same message twice in a row just shows once.
   *
   * @param {string} message - The text to show.
   */
  function notify(message) {
    const stack = $('toasts');
    if (stack.lastElementChild?.textContent === message) stack.lastElementChild.remove();
    while (stack.children.length >= TOAST_STACK) stack.firstElementChild.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    stack.append(toast);

    // The class is added a frame later, so the note fades and slides in instead of just appearing.
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => toast.classList.remove('visible'), 3200);
    setTimeout(() => toast.remove(), 3600);
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
    dial.style.setProperty('--turn', `${dialTurn(state.time)}deg`);
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
   * Says how far to turn the day dial so the present moment sits under the pin at its top.
   *
   * The painted dial is half day (the suns, on top) and half night (the moon, below), but the
   * game's day is longer than its night. So the daylight hours are spread over the top half and
   * the night hours over the bottom half, like a clock whose two halves tick at different speeds:
   * dawn is at the left, midday at the top, nightfall at the right and midnight at the bottom.
   *
   * @param {number} time - The world clock, in game seconds.
   * @returns {number} Degrees to turn the dial's face (negative turns it anticlockwise).
   */
  function dialTurn(time) {
    const now = timeOfDay(time);
    const spot =
      now < PHASES.night
        ? -90 + (now / PHASES.night) * 180
        : 90 + ((now - PHASES.night) / (DAY_SECONDS - PHASES.night)) * 180;
    return -spot;
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
   * The button matches what E would do (see core/input.js): "busy" while gathering, repairing or
   * crafting, "Place campfire" in build mode, then step ashore, board, repair or gather
   * (chooseInteraction), "Open <camp>" beside one of the player's fires when none of those is in
   * reach, and last of all a faded "Chop pine tree — needs an axe" beside a tree or rock whose tool
   * the player lacks, with that tool's painted picture crossed out where the E was.
   *
   * @param {object} state - The game being played.
   */
  function updateActions(state) {
    const { animator, build } = session;
    const choice = chooseInteraction(state),
      busy = busyLabel(state, animator),
      camp = !choice && !state.aboard && campInReach(state),
      locked = !choice && !camp && !state.aboard && lockedNode(state),
      button = $('interact'),
      label = button.querySelector('span');
    // The open build menu covers the button's spot (on phones fully), so the button waits until it closes.
    button.hidden = build.menu || (!choice && !busy && !build.active && !camp && !locked);
    button.classList.toggle('busy', !!busy);
    button.classList.toggle('locked', !busy && !build.active && !!locked);
    // A locked button shows the missing tool's painted picture in place of the E (see style.css).
    button.dataset.tool = !busy && !build.active && locked ? locked.tool : '';
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy) label.textContent = busy;
    else if (build.active) label.textContent = 'Place campfire';
    else if (choice) label.textContent = actionLabel(state, choice);
    else if (camp) label.textContent = `Open ${camp.name}`;
    else if (locked)
      label.textContent = `${locked.verb} ${locked.label.toLowerCase()} — needs ${toolInfo(locked.tool).aName}`;
    // The controls strip sits where the action button and build menu appear, so it gives way.
    if (!button.hidden || build.menu) hideKeyStrip();

    updateBuildMenu(state);

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
   * Fills the build menu: the campfire, and one entry per tool showing the next tier the player
   * can make and its cost.
   *
   * A campfire or tool the player can't afford yet shows its cost in red but can still be picked,
   * so the game can say what is missing. A tool that is blocked for another reason (no hammer, away
   * from a fire) explains on hover. An iron tool already owned says "Owned" and can't be picked.
   *
   * @param {object} state - The game being played.
   */
  function updateBuildMenu(state) {
    const { build } = session;
    const short = Object.entries(CAMPFIRE_COST).some(([type, n]) => state.resources[type] < n);
    $('build-menu').hidden = !build.menu;
    $('build-button').setAttribute('aria-expanded', String(build.menu));
    $('build-button').classList.toggle('active', build.menu || build.active);
    $('build-campfire').classList.toggle('short', short);
    if (!build.menu) return;

    for (const { id } of TOOLS) {
      const option = $(`craft-${id}`),
        check = canCraft(state, id);
      option.querySelector('.craft-name').textContent = capital(toolName(id, check.tier ?? 'iron'));
      option.querySelector('.craft-cost').textContent = check.cost
        ? costWords(check.cost)
        : 'Owned';
      // The tier tells the stylesheet which painted picture to show: the stone tool or the iron one.
      option.dataset.tier = check.tier ?? 'iron';
      option.classList.toggle('short', check.reason === 'cost');
      option.disabled = check.reason === 'owned';
      option.title = check.ok ? '' : check.message;
    }
  }

  /**
   * Fills the tools row: each tool's tier, and the uses left on a stone one.
   *
   * @param {object} state - The game being played.
   */
  function updateTools(state) {
    for (const { id, name } of TOOLS) {
      const chip = $(`tool-${id}`),
        owned = state.tools[id];
      chip.classList.toggle('empty', !owned);
      chip.classList.toggle('iron', owned?.tier === 'iron');
      chip.querySelector('.tool-state').textContent = !owned
        ? '—'
        : owned.tier === 'iron'
          ? 'Iron'
          : String(owned.uses);
      chip.title = !owned
        ? `No ${name} yet · Craft one in the Build menu (B)`
        : owned.tier === 'iron'
          ? `Iron ${name}`
          : `Stone ${name} · ${owned.uses} uses left`;
    }
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
    updateTools(state);
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
