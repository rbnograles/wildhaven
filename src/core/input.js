// Keyboard and touch controls.
// Phaser's own input is disabled; every key and touch goes through here.
// This file remembers which keys are held down and turns them into "which way to walk".

import { beginInteraction, chooseInteraction } from '../actions/interact.js';
import { listMissing, missingForRepair } from '../actions/boat.js';
import { lockedNode, aimState } from '../actions/gather.js';
import { beginApproach, beginPlacing } from '../actions/approach.js';
import { TOOLS, toolInfo } from '../data/tools.js';
import { GEAR } from '../data/gear.js';
import { BUILDINGS } from '../data/buildings.js';
import { repel } from '../actions/wolves.js';
import { campInReach } from '../world/camps.js';
import { save } from './session.js';
import { $ } from '../ui/layout.js';

// Keys that move the player (WASD and arrows) plus Shift for running, all lowercase.
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'shift'];

// On-screen touch buttons pretend to be WASD keys: `data-move` value → key it stands for.
const TOUCH_KEYS = { up: 'w', down: 's', left: 'a', right: 'd' };

/**
 * Hooks up every keyboard, touch, and page event the game listens to.
 *
 * Held keys go into `session.keys`, like names written on a whiteboard: pressing a key writes it,
 * letting go erases it. The frame loop reads the whiteboard each frame through `moveIntent`.
 * Also handles E to step ashore, board, repair, gather or open a camp, B for the build menu (and
 * 1 to pick the campfire in it, 2 to 4 to craft a tool, 5 to 8 to make gear), F to eat, H to heal, M for the map, J for the journal, Escape to
 * pause (or to leave the build menu or build mode), the mouse over the world (a click on a tree or
 * rock chops or mines it, walking there first when it is out of reach), and saving when the tab
 * is hidden.
 *
 * @param {object} session - The shared session; its `keys` set and `clock` are used here.
 * @param {object} ui - The UI helpers (`hud`, `dialogs`, `journal`) that key presses open or update.
 * @returns {{moveIntent: Function, hover: Function}} `moveIntent()` reports the current direction
 *   and `hover()` the tree or rock under the mouse.
 */
export function setupInput(session, ui) {
  const { keys } = session;
  const world = $('world');

  /**
   * Sends the player to the spot beside a node or old boat in reach, if they aren't there yet.
   *
   * The walk is only a step or two; the frame loop follows it and starts the work (picking,
   * chopping, mining, mending) on arrival. Held movement keys are forgotten, because a held key
   * would call the walk off.
   *
   * @param {object} node - The node about to be gathered, or an old boat with its `sprite` name.
   * @returns {boolean} True if the step was started, so the caller should not gather yet.
   */
  function stepBeside(node) {
    const { state, animator } = session;
    if (animator.pending || animator.asleep > 0) return false;
    const walk = beginPlacing(state, node);
    if (!walk) return false;

    keys.clear();
    session.walk = walk;
    return true;
  }

  /**
   * Does what E means outside build mode: step ashore, board, repair or gather, tried in that
   * order. With none of those in reach, E beside one of the player's fires opens that camp; beside a
   * tree or rock it says which tool to make; anywhere else it says why nothing happened.
   *
   * Landing and boarding happen at once and save straight away. Repairing and gathering start a
   * timed action that core/loop.js finishes. Held movement keys are forgotten so the player
   * doesn't walk off and cancel straight away.
   */
  function use() {
    // Something to gather or mend: step beside it first; the frame loop starts the work there.
    // A repair the backpack can't pay for skips the step, so E says at once what is missing.
    const choice = chooseInteraction(session.state);
    if (choice?.kind === 'gather' && stepBeside(choice.target)) return;
    if (
      choice?.kind === 'repair' &&
      !Object.keys(missingForRepair(session.state)).length &&
      stepBeside({ ...choice.target, sprite: 'old-boat' })
    )
      return;

    const result = beginInteraction(session.state, session.animator);
    if (result.ok && result.kind === 'chest') {
      keys.clear();
      ui.chest.open(result.chest);
      return;
    }
    // A wheat bed with nothing to do right now (no seed, or tended and growing) says why, and so
    // does a hunt without an axe.
    if (!result.ok && (result.kind === 'farm' || result.kind === 'hunt')) {
      if (result.message) ui.hud.notify(result.message);
      return;
    }
    if (result.ok) {
      keys.clear();
      if (result.kind === 'board')
        ui.hud.notify('In the boat · Row with WASD, and press E by the shore to step ashore');
      if (result.kind === 'board' || result.kind === 'land') save(session, ui, true);
      ui.hud.update();
      return;
    }
    if (result.reason === 'missing') {
      ui.hud.notify(`The old boat needs ${listMissing(result.missing)} more.`);
      return;
    }
    if (result.reason !== 'none') return;
    // Camps are opened on foot; from the boat, step ashore first.
    const camp = !session.state.aboard && campInReach(session.state);
    if (camp) {
      ui.camp.openCamp(camp);
      return;
    }
    // A tree or rock in reach that needs a tool the player doesn't have yet: say how to get one.
    const locked = !session.state.aboard && lockedNode(session.state);
    ui.hud.notify(
      locked
        ? `You need ${toolInfo(locked.tool).aName}. Make one in the Build menu (B).`
        : 'Move closer to something you can use.',
    );
  }

  /** Does what E (or the action button) means right now: place the campfire in build mode, or `use`. */
  function interact() {
    if (session.screen !== 'game' || ui.dialogs.isPaused()) return;
    if (session.build.active) ui.build.place();
    else use();
  }

  $('interact').addEventListener('click', interact);

  /**
   * Finds the thing to gather under the mouse and what a click on it would do.
   *
   * Trees, rocks, supplies, berries, small stones, flowers and driftwood all count. The frame loop
   * asks every frame, because the camera moves under a still mouse. Nothing is aimed at while
   * placing a campfire, with the build menu open, or while a dialog is up. When two pictures
   * overlap under the mouse, one in reach wins over one that is merely in front. The mouse also
   * turns into a pointing hand over anything a click would gather or walk to.
   *
   * @returns {{node: object, state: string}|null} The node and its aimState ('ready', 'far' or
   *   'locked'), or null when the mouse is over nothing that can be gathered.
   */
  function hover() {
    const { state, renderer, pointer, build } = session;
    let aim = null;
    if (pointer && state && renderer && !build.active && !build.menu && !ui.dialogs.isPaused()) {
      // Where pictures overlap, one a click can work on beats one that is only in front.
      const aims = renderer
        .nodesAt(pointer.x, pointer.y, state)
        .map((node) => ({ node, state: aimState(state, node) }))
        .filter((a) => a.state);
      aim = aims.find((a) => a.state === 'ready') ?? aims[0] ?? null;
    }
    world.style.cursor = aim && aim.state !== 'locked' ? 'pointer' : '';
    return aim;
  }

  /**
   * Does what a click on the thing to gather under the mouse means.
   *
   * In reach (with the right tool, if it needs one), the click starts gathering that very one, like E. From
   * too far, the character walks there by themselves and starts the work on arriving (the frame
   * loop follows the walk; any movement key takes over again). With no tool it says which to make.
   *
   * @param {{node: object, state: string}} aim - What `hover` found under the mouse.
   */
  function clickNode({ node, state: how }) {
    if (how === 'locked') {
      ui.hud.notify(`You need ${toolInfo(node.tool).aName}. Make one in the Build menu (B).`);
      return;
    }
    if (how === 'far') {
      // Busy with an action or lying asleep: the click waits for another time.
      if (session.animator.pending || session.animator.asleep > 0) return;
      session.walk = beginApproach(session.state, node);
      if (!session.walk) ui.hud.notify(`Can't find a way to the ${node.label.toLowerCase()}.`);
      return;
    }
    if (stepBeside(node)) return;
    const result = beginInteraction(session.state, session.animator, node.id);
    if (!result.ok) return;
    // Held movement keys are forgotten, so the player doesn't walk off and cancel straight away.
    keys.clear();
    ui.hud.update();
  }

  // Keyboard: Escape pauses, M toggles the map, J the journal, E interacts, and movement keys are remembered.
  window.addEventListener('keydown', (event) => {
    if (session.screen !== 'game') return;
    // Typing in a text box (such as naming a camp) is not a game key.
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();

    if (key === 'escape') {
      if (ui.dialogs.isPaused()) return;
      event.preventDefault();
      if (session.build.active || session.build.menu) ui.build.cancel();
      else ui.dialogs.openPause();
      return;
    }

    if (key === 'm' && !event.repeat) {
      event.preventDefault();
      ui.dialogs.toggleMap();
      return;
    }

    if (key === 'j' && !event.repeat) {
      event.preventDefault();
      ui.journal.toggleJournal();
      return;
    }

    if (ui.dialogs.isPaused()) return;

    if (key === 'b' && !event.repeat) {
      event.preventDefault();
      ui.build.toggleMenu();
      return;
    }

    // With the build menu open, 1 picks its first building (the campfire).
    if (key === '1' && !event.repeat && session.build.menu) {
      event.preventDefault();
      ui.build.start();
      return;
    }

    // With the build menu open, 2, 3 and 4 craft the axe, pickaxe and hammer.
    const tool = TOOLS.find((t) => t.key === key);
    if (tool && !event.repeat && session.build.menu) {
      event.preventDefault();
      ui.build.craft(tool.id);
      return;
    }

    // With the build menu open, 9, 0, - and = pick the tent, the chest, the wheat bed and the centre.
    const camp = BUILDINGS.find((b) => b.key === key);
    if (camp && !event.repeat && session.build.menu) {
      event.preventDefault();
      ui.build.building(camp.id);
      return;
    }

    // With the build menu open, 5 to 8 make the torch, the coat, the grip and the boat.
    const gear = GEAR.find((g) => g.key === key);
    if (gear && !event.repeat && session.build.menu) {
      event.preventDefault();
      ui.build.make(gear.id);
      return;
    }

    if (key === 'f' && !event.repeat) {
      event.preventDefault();
      ui.camp.eatFood();
      return;
    }

    if (key === 'h' && !event.repeat) {
      event.preventDefault();
      ui.camp.useHerbs();
      return;
    }

    // R drives back any wolves close by (the repel shove), once every few seconds.
    if (key === 'r' && !event.repeat && !ui.dialogs.isPaused()) {
      event.preventDefault();
      const result = repel(session.state, session.animator);
      if (result.ok) {
        keys.clear();
        if (result.pushed)
          ui.hud.notify(
            `You drove back ${result.pushed === 1 ? 'a wolf' : `${result.pushed} wolves`}`,
          );
      }
      ui.hud.update();
      return;
    }

    // Mid-action, key-repeat from a key held since before E is ignored; only a fresh press moves (and so cancels).
    // The same goes for the short step beside a patch that comes just before the picking.
    if (MOVE_KEYS.includes(key)) {
      event.preventDefault();
      const busy = session.animator.pending || session.walk?.placing;
      if (!(busy && event.repeat)) keys.add(key);
    }

    if (key === 'e' && !event.repeat) {
      event.preventDefault();
      interact();
    }
  });

  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

  // Leaving the window means we never hear the key go up, so forget every held key.
  window.addEventListener('blur', () => keys.clear());

  // Hiding the tab saves the game. Resetting the clock stops the first frame back from
  // counting all the time the tab was hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      if (session.screen === 'game') save(session, ui, true);
    }
    session.clock.last = performance.now();
  });

  window.addEventListener('pagehide', () => save(session, ui, true));

  // The mouse over the world is remembered so the build ghost can follow it. In build mode a
  // click (or a tap) on the world places the campfire there; otherwise a click on a tree or rock
  // chops or mines it (see clickNode).
  world.addEventListener('pointermove', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
  });
  world.addEventListener('pointerleave', () => (session.pointer = null));
  // A lifted finger is no longer pointing at anything, so its badge goes away.
  world.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') session.pointer = null;
  });
  world.addEventListener('pointerdown', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
    if (event.button !== 0 || session.screen !== 'game') return;
    if (!session.build.active) {
      const aim = hover();
      if (aim) clickNode(aim);
      return;
    }
    // Stop the click from also focusing the world afterwards, which would pull the keyboard out
    // of the camp name box that placing the fire opens.
    event.preventDefault();
    interact();
  });

  // Touch buttons: holding one "presses" its key; lifting the finger (or losing it) releases it.
  document.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!ui.dialogs.isPaused()) {
        button.setPointerCapture(event.pointerId);
        keys.add(TOUCH_KEYS[button.dataset.move]);
      }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(type, () => keys.delete(TOUCH_KEYS[button.dataset.move]));
  });

  /**
   * Turns the held keys into a walking direction.
   *
   * Right minus left gives the sideways push, down minus up the up/down push. Holding opposite
   * keys cancels out to 0, the same as holding neither.
   *
   * @returns {{dx: number, dy: number, running: boolean}} Each push is -1, 0 or 1; `running` is Shift.
   */
  function moveIntent() {
    const dx =
      Number(keys.has('d') || keys.has('arrowright')) -
      Number(keys.has('a') || keys.has('arrowleft'));
    const dy =
      Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    return { dx, dy, running: keys.has('shift') };
  }

  return { moveIntent, hover };
}
