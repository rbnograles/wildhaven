// The camp dialogs: naming a camp just founded, the camp itself (its needs and what to do at the
// fire), and the screen shown after passing out. Eating and healing from the keyboard come
// through here too. These only show the game and call the actions in actions/build.js and
// actions/camp.js, which hold the rules.
import {
  FOOD_HUNGER,
  HEAL_HERBS,
  HEAL_HEALTH,
  TEA_HERBS,
  TEA_SECONDS,
  MAX_GROWN,
} from '../data/balance.js';
import { clockLabel, phaseOf } from '../world/clock.js';
import { fireRadius } from '../world/camps.js';
import { describeNeed, needProgress } from '../world/needs.js';
import { nameCamp } from '../actions/build.js';
import { giveToNeed, eat, heal, brewTea, rest } from '../actions/camp.js';
import { startSleep, wakeUp, NAP_SECONDS } from '../animation/clips.js';
import { save } from '../core/session.js';
import { describeEvent } from './hud.js';
import { $ } from './layout.js';

// What each action says when it can't be done, by the reason it gives.
const REFUSED = {
  eat: { empty: 'No food in your pack.', full: "You're not hungry." },
  heal: { full: 'You are already at full health.', short: `Healing takes ${HEAL_HERBS} herbs.` },
  tea: {
    away: 'Brew tea at one of your camps.',
    active: 'Your tea is still warming you.',
    short: `Tea takes ${TEA_HERBS} herbs.`,
  },
  rest: { away: 'Rest at one of your camps.', day: 'You can rest from dusk.' },
};

/**
 * Wires up the camp dialogs and the eat and heal shortcuts.
 *
 * @param {object} session - The shared session (game state, held keys, screen).
 * @param {object} ui - The other UI parts (`hud`, `dialogs`).
 * @returns {{openNaming: Function, openCamp: Function, showPassOut: Function, eatFood: Function,
 *   useHerbs: Function}} Ways to open each dialog, and the F and H key actions.
 */
export function setupCamp(session, ui) {
  // The camp being named while the name box is open, and the camp whose dialog is open.
  let naming = null,
    open = null;

  /**
   * Picks the first reason that applies from a list of [applies, words] pairs.
   *
   * @param {Array<[boolean, string]>} checks - Each check, and what to say when it applies.
   * @returns {string} The words of the first check that applies, or '' when none do.
   */
  const reason = (checks) => checks.find(([applies]) => applies)?.[1] ?? '';

  /**
   * Makes a small grey note for a need line, such as "Out in the wild".
   *
   * @param {string} text - The note.
   * @returns {HTMLSpanElement} The note element.
   */
  function note(text) {
    const span = document.createElement('span');
    span.className = 'camp-note';
    span.textContent = text;
    return span;
  }

  /**
   * Builds one line of the needs list: what is asked, and a Give button or the need's state.
   *
   * @param {object} need - The need.
   * @param {number} slot - Its place in the camp's list (0, 1 or 2), for the Give button.
   * @returns {HTMLLIElement} The line.
   */
  function needItem(need, slot) {
    const item = document.createElement('li'),
      words = document.createElement('span');
    item.classList.toggle('done', need.done);
    words.textContent = describeNeed(need);
    item.append(words);

    if (need.done) item.append(note('Met · a new need arrives at dawn'));
    else if (need.kind !== 'bring') item.append(note('Out in the wild'));
    else {
      const { have, want } = needProgress(session.state, need),
        button = document.createElement('button');
      button.className = 'secondary';
      button.disabled = have < want;
      button.textContent =
        have < want ? `You have ${have} of ${want}` : `Give ${want} ${need.resource}`;
      button.addEventListener('click', () => give(slot));
      item.append(button);
    }
    return item;
  }

  /**
   * Sets one camp task button: whether it can be used, and its small line (the cost, or why not).
   *
   * @param {string} id - The button's id.
   * @param {string} why - Why it can't be used right now, or '' when it can.
   * @param {string} cost - What it costs and does, shown when it can be used.
   */
  function task(id, why, cost) {
    $(id).disabled = !!why;
    $(id).querySelector('small').textContent = why || cost;
  }

  /** Fills the camp dialog: its name, the clock, the fire's size, the needs and the four tasks. */
  function render() {
    const { state } = session,
      { meters, resources } = state;
    $('camp-kicker').textContent = `CAMP · ${clockLabel(state.time).toUpperCase()}`;
    $('camp-title').textContent = open.name;
    $('camp-fire').textContent =
      `Warmth reaches ${fireRadius(open)} units · ${open.grown} of ${MAX_GROWN} needs met`;
    $('camp-needs').replaceChildren(...open.needs.map(needItem));

    task(
      'camp-tea',
      reason([
        [state.tea > 0, `Still warming you (${Math.ceil(state.tea)} s)`],
        [resources.herbs < TEA_HERBS, `Needs ${TEA_HERBS} herbs`],
      ]),
      `${TEA_HERBS} herbs · ${TEA_SECONDS} s safe from the cold`,
    );
    task(
      'camp-eat',
      reason([
        [resources.food < 1, 'No food'],
        [meters.hunger >= 100, 'Not hungry'],
      ]),
      `1 food · +${FOOD_HUNGER} hunger`,
    );
    task(
      'camp-heal',
      reason([
        [meters.health >= 100, 'Full health'],
        [resources.herbs < HEAL_HERBS, `Needs ${HEAL_HERBS} herbs`],
      ]),
      `${HEAL_HERBS} herbs · +${HEAL_HEALTH} health`,
    );
    task(
      'camp-rest',
      reason([[!['dusk', 'night'].includes(phaseOf(state.time)), 'You can rest from dusk']]),
      'Sleep until dawn and wake rested',
    );
  }

  /** Saves, then redraws the camp dialog (if it is open) and the HUD after anything changes. */
  function refresh() {
    save(session, ui, true);
    if ($('camp-dialog').open) render();
    ui.hud.update();
  }

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
    $('camp-name-input').focus();
    $('camp-name-input').select();
  }

  /**
   * Opens a camp's dialog. The game pauses while it is open, like every other dialog.
   *
   * @param {object} camp - The camp the player is standing by.
   */
  function openCamp(camp) {
    if (ui.dialogs.isPaused()) return;
    open = camp;
    session.keys.clear();
    render();
    $('camp-dialog').showModal();
  }

  /**
   * Gives the resources one of the open camp's needs asks for.
   *
   * @param {number} slot - Which need: 0, 1 or 2.
   */
  function give(slot) {
    const result = giveToNeed(session.state, open.id, slot);
    if (!result.ok) return;
    ui.hud.notify(`${open.name}: need met · ${describeNeed(result.need)}`);
    refresh();
  }

  /**
   * Runs one action on the game and says how it went: a short success line, or why it was refused.
   *
   * @param {Function} action - The action, such as `eat`; it is given the game state.
   * @param {object} refused - Words for each reason the action can refuse.
   * @param {string} done - The words to show when it works.
   */
  function attempt(action, refused, done) {
    if (session.screen !== 'game' || !session.state) return;
    const result = action(session.state);
    ui.hud.notify(result.ok ? done : refused[result.reason]);
    if (result.ok) refresh();
  }

  /** Eats one food: the F key and the camp's Eat button. */
  const eatFood = () => attempt(eat, REFUSED.eat, `You eat. +${FOOD_HUNGER} hunger`);

  /** Heals with herbs: the H key and the camp's Heal button. */
  const useHerbs = () =>
    attempt(heal, REFUSED.heal, `You use ${HEAL_HERBS} herbs. +${HEAL_HEALTH} health`);

  /**
   * Rests until dawn, closes the camp dialog, and tells the player about the new day.
   * The night is skipped at once; the character is shown asleep for a moment, then gets up.
   */
  function restNight() {
    const result = rest(session.state);
    if (!result.ok) {
      ui.hud.notify(REFUSED.rest[result.reason]);
      return;
    }
    $('camp-dialog').close();
    startSleep(session.animator, NAP_SECONDS);
    ui.hud.notify(['You rest by the fire.', ...result.events.map(describeEvent)].join(' '));
    refresh();
  }

  /**
   * Shows the screen after passing out: what happened, where the player woke, whether their boat
   * drifted home, and any new needs.
   *
   * @param {{camp: object|null, events: object[], boatHome: boolean}} result - What `passOut` returned.
   */
  function showPassOut({ camp, events, boatHome }) {
    const dawn = events.find((e) => e.kind === 'dawn');
    $('passout-text').textContent = [
      'You got too cold away from a fire.',
      camp
        ? `You woke at ${camp.name} at midday.`
        : 'You woke where you started, at midday. Build a campfire so you have somewhere warm to return to.',
      boatHome ? 'Your boat drifted back to where you mended it.' : '',
      dawn?.camps.length ? `New needs at ${dawn.camps.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    session.keys.clear();
    $('passout-dialog').showModal();
  }

  // However the name box closes, the camp is kept. "Found camp" also renames it to what was typed.
  $('camp-name-dialog').addEventListener('close', () => {
    if (!naming) return;
    if ($('camp-name-dialog').returnValue === 'found')
      nameCamp(session.state, naming.id, $('camp-name-input').value);
    ui.hud.notify(`${naming.name} is founded. Its fire keeps you warm through the night.`);
    naming = null;
    refresh();
  });

  // The camp dialog's buttons, and the pass-out screen's.
  $('close-camp').addEventListener('click', () => $('camp-dialog').close());
  $('camp-tea').addEventListener('click', () =>
    attempt(brewTea, REFUSED.tea, `You brew herbal tea: ${TEA_SECONDS} s safe from the cold.`),
  );
  $('camp-eat').addEventListener('click', eatFood);
  $('camp-heal').addEventListener('click', useHerbs);

  // The item box's food and herbs slots do the same as F and H.
  $('slot-food').addEventListener('click', eatFood);
  $('slot-herbs').addEventListener('click', useHerbs);
  $('camp-rest').addEventListener('click', restNight);
  $('passout-close').addEventListener('click', () => $('passout-dialog').close());

  // However the pass-out screen closes (its button or Escape), the sleeper gets up.
  $('passout-dialog').addEventListener('close', () => wakeUp(session.animator));

  return { openNaming, openCamp, showPassOut, eatFood, useHerbs };
}
