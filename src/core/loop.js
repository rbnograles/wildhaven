// The frame loop: the heartbeat of the game.
// About 60 times a second it moves the player (or their boat), runs the current animation and the
// survival clock, hands out gathered supplies and mended boats, checks for new finds, lifts the
// fog, autosaves, and asks the renderer to draw.

import { movePlayer } from '../actions/move.js';
import { finishInteraction } from '../actions/interact.js';
import { deepAhead } from '../actions/boat.js';
import { discover } from '../actions/discover.js';
import { tickSurvival } from '../actions/survive.js';
import { passOut } from '../actions/camp.js';
import { advanceAnimation, cancelAction } from '../animation/clips.js';
import { hasJournalPage } from '../world/journal.js';
import { REPAIR_COST } from '../data/balance.js';
import { markFinds, describeNeed } from '../world/needs.js';
import { revealAround } from '../world/fog.js';
import { describeEvent } from '../ui/hud.js';
import { save } from './session.js';
import { logFinds } from './playtest.js';

// Engine timings, not game balance (that lives in data/balance.js).
// MAX_FRAME_DT: the longest step (seconds) one frame may simulate, so a slow frame can't jump ahead.
// AUTOSAVE_EVERY: seconds of play between automatic saves.
// HUD_EVERY: seconds between HUD refreshes; the numbers don't need redrawing every frame.
// DEEP_WARN_MS: real milliseconds between two "too rough" warnings while the boat pushes at deep water.
const MAX_FRAME_DT = 0.05,
  AUTOSAVE_EVERY = 10,
  HUD_EVERY = 0.12,
  DEEP_WARN_MS = 4000;

// The words for each kind of find, used in the pop-up message. Each takes the find
// (`{kind, id, name}`) from discover() and the game state (the old-boat words depend on it).
const FOUND = {
  // Entering a region for the first time.
  region: ({ name }) => `Discovered ${name}`,
  // Coming close to a named place. Places with a journal page say so, to send the player to J.
  landmark: ({ id, name }) =>
    hasJournalPage(id) ? `Found ${name} · New page in your journal (J)` : `Found ${name}`,
  // Walking up to a signpost.
  waypoint: ({ name }) => `Signpost found: ${name}`,
  // Coming close to an old boat on the beach, and what mending it costs.
  // A player who already owns a boat can't repair another, so the cost is left out for them.
  wreck: ({ name }, state) =>
    state.boat
      ? `Found ${name}`
      : `Found ${name} · Repair it with ${REPAIR_COST.wood} wood and ${REPAIR_COST.stone} stone`,
};

/**
 * Handles one frame's survival news.
 *
 * Passing out ends the night at once and shows its own screen. Anything else becomes a toast,
 * and a new day saves the game.
 *
 * @param {object} session - The shared session.
 * @param {object} ui - The UI helpers (`hud`, `build`, `camp`).
 * @param {object[]} events - What tickSurvival reported this frame.
 */
function handleSurvival(session, ui, events) {
  if (!events.length) return;
  if (events.some((e) => e.kind === 'passout')) {
    cancelAction(session.animator);
    ui.build.cancel();
    const result = passOut(session.state);
    session.renderer.resetCamera();
    ui.camp.showPassOut(result);
    ui.hud.update();
    save(session, ui, true);
    return;
  }

  const words = events.map(describeEvent).filter(Boolean);
  if (words.length) ui.hud.notify(words.join(' · '));
  ui.hud.update();
  if (events.some((e) => e.kind === 'dawn')) save(session, ui, true);
}

/**
 * Starts the never-ending frame loop that keeps the game running.
 *
 * The browser calls us right before it paints the screen. Each time, we work out how much time
 * has passed, update the game by that much, and draw the result. Then we ask to be called again.
 * Nothing in the game moves while a dialog is open or the tab is hidden.
 *
 * @param {object} session - The shared session (game state, animator, renderer, clock, keys).
 * @param {object} ui - The UI helpers (`hud`, `dialogs`, `input`, `journal`) the loop talks to.
 */
export function startLoop(session, ui) {
  const { clock } = session;

  // When the last "too rough" warning was shown, so it isn't repeated every frame.
  let warnedDeepAt = -Infinity;

  /**
   * Runs one frame: update the game, then draw it.
   *
   * Like a flip book, each call is one page. We clamp the time step so that if the page was slow
   * (or the browser stalled), the player doesn't leap a long way in one go.
   *
   * @param {number} now - The browser's current time in milliseconds.
   */
  function frame(now) {
    const dt = Math.min((now - clock.last) / 1000, MAX_FRAME_DT);
    clock.last = now;
    const { state, renderer, animator } = session;

    if (session.screen === 'game' && state && renderer) {
      let moving = false;

      // The simulation only runs while nothing is paused and the tab is visible.
      if (!ui.dialogs.isPaused() && !document.hidden) {
        const { dx, dy, running } = ui.input.moveIntent();

        // Moving cancels an action in progress; nothing is awarded.
        if (animator.pending && (dx || dy)) {
          cancelAction(animator);
          ui.hud.update();
        }

        moving = !animator.pending && movePlayer(state, dx, dy, dt, running);
        // The first real step hides the controls strip.
        if (moving) ui.hud.hideKeyStrip();
        state.elapsed += dt;
        // The world clock, the meters and each camp's dawn update move with the survival tick.
        const events = tickSurvival(state, dt);
        ui.build.update(); // keep the build ghost on the pointer

        // Rowing into deep water: say why the boat won't go on, but not every frame.
        if (deepAhead(state, dx, dy) && now - warnedDeepAt > DEEP_WARN_MS) {
          ui.hud.notify('Too rough for a small boat.');
          warnedDeepAt = now;
        }

        // When a timed action finishes, hand out what it was aimed at (exactly once): supplies or a mended boat.
        const done = advanceAnimation(animator, dt, { moving, running });
        const finished = done?.target ? finishInteraction(state, done.target) : null;
        if (finished) {
          ui.hud.notify(
            finished.kind === 'repair'
              ? 'Boat repaired · Walk to the water’s edge and press E to board'
              : `+${finished.node.amount} ${finished.node.type} · ${finished.node.label}`,
          );
          ui.hud.update();
          save(session, ui, true);
        }

        const found = discover(state);
        if (found.length) {
          // A find can also meet a camp need ("Find a place in Frostpeak"); both are announced together.
          const met = markFinds(state, found);
          ui.hud.notify(
            [
              ...found.map((f) => FOUND[f.kind](f, state)),
              ...met.map(({ camp, need }) => `${camp.name}: need met · ${describeNeed(need)}`),
            ].join(' · '),
          );
          ui.hud.update();
          ui.journal.refreshDot();
          logFinds(session, found);
          save(session, ui, true);
        }

        // Lift the fog of war around the player, then deal with the survival news.
        revealAround(state, state.player.x, state.player.y);
        handleSurvival(session, ui, events);

        // Autosave like a stopwatch: count up, save, reset.
        clock.sinceSave += dt;
        if (clock.sinceSave > AUTOSAVE_EVERY) {
          save(session, ui, true);
          clock.sinceSave = 0;
        }
      }

      // Drawing still happens while paused, so the world stays on screen behind the dialog.
      renderer.draw(state, dt, animator, session.build);
      clock.sinceHud += dt;
      if (clock.sinceHud > HUD_EVERY) {
        ui.hud.update();
        clock.sinceHud = 0;
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
