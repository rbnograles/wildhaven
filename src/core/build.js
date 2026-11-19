// Building: the build menu above the item box, crafting tools from it, and placing a campfire with
// the mouse (or in front of the player). While placing, a ghost campfire follows the pointer and
// shows whether it may stand there; a click or E places it. The rules for where a fire may go live
// in actions/build.js and the crafting rules in actions/craft.js; this file only drives them.

import { checkPlacement, placeCampfire, BUILD_ABOARD } from '../actions/build.js';
import { beginCraft } from '../actions/craft.js';
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
 * @returns {{toggleMenu: Function, start: Function, cancel: Function, place: Function,
 *   update: Function, craft: Function}} Ways to open or close the menu, start placing a campfire,
 *   leave building, place the fire, move the ghost each frame, and start crafting a tool.
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
    build.check = checkPlacement(session.state, build.x, build.y);
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
   * Starts placing a campfire (the menu's Campfire option, or 1 while the menu is open).
   * The menu closes, the ghost appears, and any gathering in progress stops. Not from the boat.
   */
  function start() {
    if (session.screen !== 'game' || !session.state || refuseAboard()) return;
    build.menu = false;
    cancelAction(session.animator);
    build.active = true;
    update();
    ui.hud.update();
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
   * Places the campfire at the ghost, if it may stand there, then asks for the camp's name.
   *
   * A refused spot changes nothing and says why. The fire is paid for and placed before the name
   * is asked, so closing the name box never undoes the camp.
   */
  function place() {
    if (!build.active) return;
    update();
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
  $('build-campfire').addEventListener('click', start);
  for (const { id } of TOOLS) $(`craft-${id}`).addEventListener('click', () => craft(id));

  return { toggleMenu, start, cancel, place, update, craft };
}
