// Building: the build menu above the item box, crafting tools from it, and placing a campfire or a
// camp building (tent, chest, wheat bed, camp centre) with the mouse (or in front of the player).
// While placing, a ghost follows the pointer and shows whether it may stand there; a click or E
// places it. A campfire goes down at once; a building starts a timed job the game loop finishes. The
// rules live in actions/build.js, actions/building.js and actions/craft.js; this file only drives them.

import { checkPlacement, placeCampfire, BUILD_ABOARD } from '../actions/build.js';
import { beginCraft } from '../actions/craft.js';
import { beginMake } from '../actions/gear.js';
import { checkBuilding, beginBuilding, checkRaise, beginRaise } from '../actions/building.js';
import { BUILDINGS, buildingInfo } from '../data/buildings.js';
import { GEAR } from '../data/gear.js';
import { TOOLS } from '../data/tools.js';
import { cancelAction } from '../animation/clips.js';
import { save } from './session.js';
import { $ } from '../ui/layout.js';

// How far in front of the player the ghost sits when there is no mouse to follow, in world units.
const AHEAD = 120;

// Which way each facing direction points, as [x, y] steps (0 south, 1 west, 2 east, 3 north).
const FACING = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
];

/**
 * Sets up the build menu and build mode for one session.
 *
 * @param {object} session - The shared session; its `build` record and `pointer` are used here.
 * @param {object} ui - The other UI parts (`hud`, `camp`).
 * @returns {{toggleMenu: Function, start: Function, building: Function, cancel: Function,
 *   place: Function, update: Function, craft: Function, make: Function}} Ways to open or close the
 *   menu, start placing a campfire, pick a camp building, leave building, place what is being
 *   placed, move the ghost each frame, and start crafting a tool or making a piece of gear.
 */
export function setupBuild(session, ui) {
  const { build } = session;

  /** Closes the build menu and leaves build mode, without placing anything. */
  function cancel() {
    if (!build.active && !build.menu) return;
    build.active = false;
    build.menu = false;
    ui.hud.update();
  }

  /**
   * Moves the ghost to where it should be this frame and checks whether a fire may stand there.
   *
   * It follows the mouse while the mouse is over the world; otherwise it sits a step in front of
   * the player, so keyboard and touch players can build too.
   */
  function update() {
    if (!build.active || !session.state) return;
    const { player } = session.state;
    const spot =
      session.pointer && session.renderer?.screenToWorld(session.pointer.x, session.pointer.y);
    const [fx, fy] = FACING[player.direction];
    build.x = Math.round(spot ? spot.x : player.x + fx * AHEAD);
    build.y = Math.round(spot ? spot.y : player.y + fy * AHEAD);
    build.check =
      build.kind === 'campfire'
        ? checkPlacement(session.state, build.x, build.y)
        : checkBuilding(session.state, build.kind, build.x, build.y);
  }

  /**
   * Says whether building is off because the player sits in the boat, and tells them why.
   *
   * @returns {boolean} True when the player is aboard, so the menu or build mode must not open.
   */
  function refuseAboard() {
    if (!session.state.aboard) return false;
    build.menu = false;
    ui.hud.notify(BUILD_ABOARD);
    ui.hud.update();
    return true;
  }

  /**
   * Opens the build menu, or closes it again (the Build button and B). While a campfire is being
   * placed, it leaves build mode instead, so B always backs out one step. In the boat the menu
   * stays shut: fires are built on land.
   */
  function toggleMenu() {
    if (session.screen !== 'game' || !session.state) return;
    if (build.active) return cancel();
    if (!build.menu && refuseAboard()) return;
    build.menu = !build.menu;
    ui.hud.update();
  }

  /**
   * Starts placing a campfire (the menu's Campfire option, or 1 while the menu is open) or a camp
   * building. The menu closes, the ghost appears, and any gathering in progress stops. Not from the boat.
   *
   * @param {string} [kind='campfire'] - What to place: 'campfire', or a building's kind.
   */
  function start(kind = 'campfire') {
    if (session.screen !== 'game' || !session.state || refuseAboard()) return;
    build.menu = false;
    cancelAction(session.animator);
    build.kind = kind;
    build.active = true;
    update();
    ui.hud.update();
  }

  /**
   * Picks a camp building from the menu (its option, or its key while the menu is open).
   *
   * A camp centre in a camp that already has one is raised a tier where it stands, with no ghost:
   * the job starts at once, or a toast says why it can't. Anything else is placed with the ghost.
   *
   * @param {string} kind - The building's kind.
   */
  function building(kind) {
    if (session.screen !== 'game' || !session.state || refuseAboard()) return;
    if (kind === 'centre' && checkRaise(session.state).reason !== 'none') {
      build.menu = false;
      cancelAction(session.animator);
      const result = beginRaise(session.state, session.animator);
      if (result.ok) session.keys.clear();
      else if (result.message) ui.hud.notify(result.message);
      ui.hud.update();
      return;
    }
    start(kind);
  }

  /**
   * Starts crafting the next tier of a tool (the menu's Tools entries, or 2, 3 and 4 while the
   * menu is open).
   *
   * The menu closes, any gathering in progress stops, and the craft action starts; the game loop
   * finishes it. A tool that can't be made yet changes nothing, and a toast says why.
   *
   * @param {string} tool - Which tool: 'axe', 'pickaxe' or 'hammer'.
   */
  function craft(tool) {
    if (session.screen !== 'game' || !session.state || refuseAboard()) return;
    build.menu = false;
    cancelAction(session.animator);
    const result = beginCraft(session.state, session.animator, tool);
    if (result.ok) session.keys.clear();
    else ui.hud.notify(result.message);
    ui.hud.update();
  }

  /**
   * Starts making a piece of gear (the menu's Gear entries, or 5 to 8 while the menu is open).
   *
   * It works like crafting a tool: the menu closes, any gathering stops, and the action starts for
   * the game loop to finish. Gear that can't be made yet changes nothing, and a toast says why.
   *
   * @param {string} id - Which gear: 'torch', 'coat', 'grip' or 'boat'.
   */
  function make(id) {
    if (session.screen !== 'game' || !session.state || refuseAboard()) return;
    build.menu = false;
    cancelAction(session.animator);
    const result = beginMake(session.state, session.animator, id);
    if (result.ok) session.keys.clear();
    else ui.hud.notify(result.message);
    ui.hud.update();
  }

  /**
   * Places what is being placed at the ghost, if it may stand there.
   *
   * A campfire goes down at once and the camp's name is asked (the fire is paid for and placed
   * before, so closing the name box never undoes the camp). A building starts its timed job, paid
   * when it is done. A refused spot changes nothing and says why.
   */
  function place() {
    if (!build.active) return;
    update();
    if (build.kind !== 'campfire') {
      const job = beginBuilding(session.state, session.animator, build.kind, build.x, build.y);
      if (!job.ok) {
        if (job.message) ui.hud.notify(job.message);
        return;
      }
      build.active = false;
      session.keys.clear();
      ui.hud.notify(`Building the ${buildingInfo(build.kind).name}… move to stop`);
      ui.hud.update();
      return;
    }
    const result = placeCampfire(session.state, build.x, build.y);
    if (!result.ok) {
      ui.hud.notify(result.message);
      return;
    }
    build.active = false;
    session.keys.clear();
    save(session, ui, true);
    ui.hud.update();
    ui.camp.openNaming(result.camp);
  }

  // The Build button opens the menu; the menu's Campfire option starts placing one, and each tool
  // entry starts crafting it.
  $('build-button').addEventListener('click', toggleMenu);
  $('build-campfire').addEventListener('click', () => start());
  for (const { id } of BUILDINGS) $(`build-${id}`).addEventListener('click', () => building(id));
  for (const { id } of TOOLS) $(`craft-${id}`).addEventListener('click', () => craft(id));
  for (const { id } of GEAR) $(`make-${id}`).addEventListener('click', () => make(id));

  return { toggleMenu, start, building, cancel, place, update, craft, make };
}
