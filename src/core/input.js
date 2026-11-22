// Keyboard and touch controls.
// Phaser's own input is disabled; every key and touch goes through here.
// This file remembers which keys are held down and turns them into "which way to walk".

import { beginInteraction, chooseInteraction } from '../actions/interact.js';
import { listMissing, missingForRepair } from '../actions/boat.js';
import { lockedNode, aimState } from '../actions/gather.js';
import { beginApproach, beginCampApproach, beginPlacing } from '../actions/approach.js';
import { TOOLS, toolInfo } from '../data/tools.js';
import { GEAR } from '../data/gear.js';
import { BUILDINGS } from '../data/buildings.js';
import { repel } from '../actions/wolves.js';
import { BAG_FULL, hasRoomFor } from '../world/bag.js';
import { campInReach } from '../world/camps.js';
import { nearbyBuilding } from '../world/buildings.js';
import { canSleep } from '../actions/camp.js';
import { beginSwing, beginShot } from '../actions/animals.js';
import { meleeTarget, aimTarget } from '../actions/combat.js';
import { hasTool } from '../world/tools.js';
import { BUILDING_REACH, CAMP_REACH } from '../data/balance.js';
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

  /** Gives manual control back and drops the automatic walk. */
  function stopAuto() {
    if (!session.auto) return;
    session.auto = false;
    session.walk = null;
    ui.hud.notify('Auto-gather stopped');
    ui.hud.update();
  }

  /** Starts or stops repeated gathering without saving the setting. */
  function toggleAuto() {
    if (
      session.screen !== 'game' ||
      ui.dialogs.isPaused() ||
      session.build.menu ||
      session.build.active ||
      session.state.aboard ||
      session.animator.asleep > 0 ||
      session.state.meters.health <= 0
    )
      return;
    if (session.auto) stopAuto();
    else {
      session.auto = true;
      session.autoSkipped.clear();
      session.walk = null;
      session.combat.aiming = null;
      keys.clear();
      ui.hud.update();
    }
  }

  /** Uses the same weapon stance for Q and the painted HUD button. */
  function toggleWeapon() {
    if (session.screen !== 'game' || ui.dialogs.isPaused()) return;
    stopAuto();
    if (!hasTool(session.state, 'sword') && !hasTool(session.state, 'bow')) {
      ui.hud.notify('You have no weapon to draw. Make one in the Build menu (B).');
      return;
    }
    session.combat.drawn = !session.combat.drawn;
    session.combat.aiming = null;
    ui.hud.update();
  }

  $('auto-gather').addEventListener('click', toggleAuto);
  $('weapon-toggle').addEventListener('click', toggleWeapon);
  // Capture manual clicks before their action runs, including food, dialogs and touch movement.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.target.closest('#auto-gather')) stopAuto();
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!event.target.closest('#auto-gather')) stopAuto();
    },
    true,
  );

  /**
   * Says whether a weapon is drawn AND combat can act right now: on foot, not paused, and not in
   * the build menu or placing a building. Entering the boat or any dialog quietly sheathes.
   *
   * @returns {boolean} True when the left/right mouse buttons mean sword and bow.
   */
  function isDrawn() {
    return (
      session.combat.drawn &&
      session.screen === 'game' &&
      !ui.dialogs.isPaused() &&
      !session.build.active &&
      !session.build.menu &&
      !session.state?.aboard
    );
  }

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
   * order; a chest opens its window and a tent (from dusk) is slept in. With none of those in reach,
   * E beside one of the player's fires opens that camp; beside a tree or rock it says which tool to
   * make; beside a tent by day it says to come back at dusk; anywhere else it says why nothing happened.
   *
   * Landing and boarding happen at once and save straight away. Repairing and gathering start a
   * timed action that core/loop.js finishes. Held movement keys are forgotten so the player
   * doesn't walk off and cancel straight away.
   */
  function use() {
    // Something to gather or mend: step beside it first; the frame loop starts the work there.
    // A repair the backpack can't pay for skips the step, so E says at once what is missing.
    const choice = chooseInteraction(session.state);
    // No room in the item box for what it gives: say so before walking up to it.
    if (
      choice?.kind === 'gather' &&
      !hasRoomFor(session.state, { [choice.target.type]: choice.target.amount })
    ) {
      ui.hud.notify(BAG_FULL);
      return;
    }
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
    // A tent, from dusk: sleep in it until dawn, the same rest the camp's own button gives.
    if (result.ok && result.kind === 'sleep') {
      keys.clear();
      ui.camp.restNight(result.camp);
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
    // Beside a tent by day (it is only slept in from dusk): say when it can be used.
    const tent = !locked && !session.state.aboard && nearbyBuilding(session.state, ['tent']);
    ui.hud.notify(
      locked
        ? `You need ${toolInfo(locked.tool).aName}. Make one in the Build menu (B).`
        : tent
          ? 'You can sleep in the tent from dusk.'
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
   * @returns {{node?: object, tent?: object, camp?: object, state: string}|null} The node and its
   *   aimState ('ready', 'far' or 'locked'); or, over one of the player's tents, the `tent`, its
   *   `camp` and its tentState; or null when the mouse is over neither.
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

      // With nothing to gather there, one of the player's own tents under the mouse can be slept in.
      const found = !aim && !state.aboard && renderer.tentAt(pointer.x, pointer.y, state);
      if (found) aim = { ...found, state: tentState(state, found.tent) };
      const camp = !aim && !state.aboard && renderer.campAt(pointer.x, pointer.y, state);
      if (camp)
        aim = {
          camp,
          state:
            Math.hypot(camp.x - state.player.x, camp.y - state.player.y) <= CAMP_REACH
              ? 'ready'
              : 'far',
        };
    }
    world.style.cursor = aim && aim.state !== 'locked' && aim.state !== 'day' ? 'pointer' : '';
    return aim;
  }

  /**
   * Says what a click on one of the player's tents would do right now.
   *
   * @param {object} state - The game being played.
   * @param {object} tent - The tent, from a camp's buildings.
   * @returns {'ready'|'far'|'day'} 'day' while it is too early to sleep, 'far' when the player
   *   stands too far from it, and 'ready' when a click would put them to bed.
   */
  function tentState(state, tent) {
    if (!canSleep(state)) return 'day';
    const away = Math.hypot(tent.x - state.player.x, tent.y - state.player.y);
    return away <= BUILDING_REACH ? 'ready' : 'far';
  }

  /**
   * Does what a click on one of the player's tents means: sleep in it, or say why not yet.
   *
   * @param {{camp: object, state: string}} aim - What `hover` found under the mouse.
   */
  function clickTent({ camp, state: how }) {
    if (how === 'day') ui.hud.notify('You can sleep in the tent from dusk.');
    else if (how === 'far') ui.hud.notify('Walk up to the tent to sleep in it.');
    else if (!session.animator.pending && !(session.animator.asleep > 0)) {
      keys.clear();
      ui.camp.restNight(camp);
    }
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
    // No room in the item box for what it gives: say so before walking over.
    if (!hasRoomFor(session.state, { [node.type]: node.amount })) {
      ui.hud.notify(BAG_FULL);
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
    if (
      !event.repeat &&
      (MOVE_KEYS.includes(key) || ['escape', 'm', 'j', 'b', 'q', 'e', 'f', 'h', 'r'].includes(key))
    )
      stopAuto();
    if (key === 'g' && !event.repeat && !session.build.menu) {
      event.preventDefault();
      toggleAuto();
      return;
    }

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

    // Q draws a weapon (sword in the left hand, bow in the right) or sheathes it.
    if (key === 'q' && !event.repeat) {
      event.preventDefault();
      toggleWeapon();
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
    if (session.screen !== 'game') return;

    // Right button while drawn: begin aiming the bow (the contextmenu handler blocks the menu).
    if (event.button === 2 && isDrawn()) {
      beginAim(event);
      return;
    }
    if (event.button !== 0) return;

    // Left button while drawn: swing the sword at the nearest creature in reach.
    if (isDrawn()) {
      swing();
      return;
    }

    if (!session.build.active) {
      const aim = hover();
      if (aim?.tent) clickTent(aim);
      else if (aim?.camp) {
        if (!session.animator.pending && !(session.animator.asleep > 0)) {
          keys.clear();
          session.walk = null;
          if (aim.state === 'ready') ui.camp.openCamp(aim.camp);
          else {
            session.walk = beginCampApproach(session.state, aim.camp);
            if (!session.walk) ui.hud.notify("Can't find a way to the campfire.");
          }
        }
      } else if (aim) clickNode(aim);
      return;
    }
    // Stop the click from also focusing the world afterwards, which would pull the keyboard out
    // of the camp name box that placing the fire opens.
    event.preventDefault();
    interact();
  });

  // Right button up anywhere finishes an aim (even if the cursor left the world).
  window.addEventListener('pointerup', (event) => {
    if (event.button === 2 && session.combat.aiming) releaseAim();
  });
  // While drawn, the right button is the bow, so block its browser context menu over the world.
  world.addEventListener('contextmenu', (event) => {
    if (isDrawn() || session.combat.aiming) event.preventDefault();
  });

  /**
   * Swings the drawn sword at the nearest creature in reach (left mouse button).
   *
   * Like swinging a stick at whatever is closest: if nothing is near, nothing happens.
   */
  function swing() {
    const { state, animator } = session;
    if (animator.pending || animator.asleep > 0) return;
    const r = beginSwing(state, animator, meleeTarget(state));
    if (r.ok) {
      keys.clear();
      ui.hud.update();
    } else if (r.message) ui.hud.notify(r.message);
  }

  /**
   * Begins aiming the bow (right mouse button down).
   *
   * It locks onto the creature nearest the cursor and starts the charge stopwatch. The frame loop
   * grows the charge while the button stays held.
   *
   * @param {PointerEvent} event - The mouse-down event, for the cursor position.
   */
  function beginAim(event) {
    const { state, renderer, animator } = session;
    if (!renderer || animator.pending || animator.asleep > 0) return;
    const spot = renderer.screenToWorld(event.clientX, event.clientY);
    const target = aimTarget(state, spot.x, spot.y);
    session.combat.aiming = { target, start: performance.now(), charge: 0 };
    keys.clear();
  }

  /**
   * Looses the arrow (right mouse button up).
   *
   * Like letting go of a pulled bowstring: it fires at the locked target with the charge held.
   */
  function releaseAim() {
    const aim = session.combat.aiming;
    session.combat.aiming = null;
    if (!aim || !aim.target) return;
    const r = beginShot(session.state, session.animator, aim.target, aim.charge);
    if (r.ok) ui.hud.update();
    else if (r.message) ui.hud.notify(r.message);
  }

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
