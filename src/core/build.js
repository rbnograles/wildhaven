// Build mode: placing a campfire with the mouse (or in front of the player). While it is on, a
// ghost campfire follows the pointer and shows whether it may stand there; a click or E places it.
// The rules for where a fire may go live in actions/build.js; this file only drives them.

import { checkPlacement, placeCampfire } from '../actions/build.js';
import { cancelAction } from '../animation/clips.js';
import { save } from './session.js';

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
 * Sets up build mode for one session.
 *
 * @param {object} session - The shared session; its `build` record and `pointer` are used here.
 * @param {object} ui - The other UI parts (`hud`, `camp`).
 * @returns {{toggle: Function, cancel: Function, place: Function, update: Function}} Ways to
 *   switch build mode on or off, leave it, place the fire, and move the ghost each frame.
 */
export function setupBuild(session, ui) {
  const { build } = session;

  /** Leaves build mode without placing anything. */
  function cancel() {
    if (!build.active) return;
    build.active = false;
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

  /** Turns build mode on, or off again. Turning it on drops any gathering in progress. */
  function toggle() {
    if (session.screen !== 'game' || !session.state) return;
    if (build.active) return cancel();
    cancelAction(session.animator);
    build.active = true;
    update();
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

  return { toggle, cancel, place, update };
}
