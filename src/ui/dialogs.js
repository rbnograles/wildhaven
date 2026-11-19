// The pop-up windows shown over the game: pause, world map and "start fresh?".
// Any of them being open counts as paused, so the world stands still behind it.
// This file also wires up their buttons and the fullscreen button.
import { save, start, leave } from '../core/session.js';
import { worldProgress } from '../world/progress.js';
import { travelTo } from '../actions/travel.js';
import { cancelAction } from '../animation/clips.js';
import { WAYPOINTS } from '../data/places.js';
import { WORLD } from '../world/map.js';
import { $ } from './layout.js';

/**
 * Wires up the pause, map and reset dialogs and their buttons.
 *
 * @param {object} session - The shared session (screen, held keys, game state, renderer).
 * @param {object} ui - The other UI parts; the HUD is used to show messages.
 * @returns {{isPaused: Function, openPause: Function, closePause: Function, toggleMap: Function}}
 *   Helpers the keyboard code and game loop use.
 */
export function setupDialogs(session, ui) {
  const dialogs = [$('pause-dialog'), $('map-dialog'), $('reset-dialog')];

  /**
   * Tells whether the game is paused. Any open dialog pauses the game.
   *
   * @returns {boolean} True while the pause, map or reset dialog is open.
   */
  const isPaused = () => dialogs.some((dialog) => dialog.open);

  /**
   * Opens the pause menu, saving first.
   *
   * Held keys are forgotten so the player doesn't keep walking once the menu closes.
   */
  function openPause() {
    if (session.screen !== 'game' || isPaused()) return;
    session.keys.clear();
    save(session, ui, true);
    $('pause-dialog').showModal();
  }

  /** Closes the pause menu and hands the keyboard back to the game world. */
  function closePause() {
    $('pause-dialog').close();
    session.keys.clear();
    $('world').focus();
  }

  /**
   * Travels to a found signpost and closes the map.
   *
   * Any gathering in progress is dropped, the camera jumps instead of flying across the world,
   * and the game saves at once so a refresh keeps the player where they arrived.
   *
   * @param {string} id - The signpost's id.
   */
  function travel(id) {
    const post = travelTo(session.state, id);
    if (!post) return;
    cancelAction(session.animator);
    session.renderer.resetCamera();
    $('map-dialog').close();
    save(session, ui, true);
    ui.hud.notify(`Travelled to ${post.name}`);
    ui.hud.update();
  }

  /** Puts one button on the map for each signpost the player has found. */
  function showWaypoints() {
    $('map-waypoints').replaceChildren(
      ...WAYPOINTS.filter((post) => session.state.waypoints.includes(post.id)).map((post) => {
        const button = document.createElement('button');
        button.className = 'map-waypoint';
        button.style.left = `${(post.x / WORLD.width) * 100}%`;
        button.style.top = `${(post.y / WORLD.height) * 100}%`;
        button.title = `Travel to ${post.name}`;
        button.setAttribute('aria-label', `Travel to ${post.name}`);
        button.addEventListener('click', () => travel(post.id));
        return button;
      }),
    );
  }

  /**
   * Opens the world map, or closes it if it is already open.
   *
   * The map is drawn fresh each time it opens, so it shows where the player is right now.
   * It won't open on top of another dialog.
   */
  function toggleMap() {
    if (session.screen !== 'game') return;
    if ($('map-dialog').open) {
      $('map-dialog').close();
      $('world').focus();
      return;
    }
    if (isPaused()) return;

    session.keys.clear();
    session.renderer.drawMap($('large-map'), session.state);
    showWaypoints();
    const { regions, places, signposts } = worldProgress(session.state);
    $('map-discovered').textContent =
      `${regions.found} of ${regions.total} regions · ${places.found} of ${places.total} places · ` +
      `${signposts.found} of ${signposts.total} signposts`;
    $('map-dialog').showModal();
  }

  // Pause menu buttons.
  $('pause').addEventListener('click', openPause);
  $('resume').addEventListener('click', closePause);
  $('save-game').addEventListener('click', () => {
    if (save(session, ui)) $('pause-save-note').textContent = 'Your adventure has been saved.';
  });
  $('return').addEventListener('click', () => leave(session, ui));

  // Map buttons.
  $('open-map').addEventListener('click', toggleMap);
  $('close-map').addEventListener('click', toggleMap);

  // "Start fresh?" buttons.
  $('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
  $('confirm-reset').addEventListener('click', () => {
    $('reset-dialog').close();
    start(session, ui, true);
  });

  // Fullscreen can be refused by the browser (for example inside a frame), so failures get a message.
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      ui.hud.notify('Fullscreen is unavailable in this browser window.');
    }
  });

  // However a dialog closes (button, Escape key), forget held keys and give focus back to the world.
  for (const dialog of dialogs) {
    dialog.addEventListener('close', () => {
      session.keys.clear();
      if (session.screen === 'game') $('world').focus();
    });
  }

  return { isPaused, openPause, closePause, toggleMap };
}
