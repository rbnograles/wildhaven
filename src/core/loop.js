// The frame loop: the heartbeat of the game.
// About 60 times a second it moves the player, runs the current animation, hands out gathered
// supplies, checks for newly discovered regions, autosaves, and asks the renderer to draw.

import { movePlayer } from '../actions/move.js';
import { finishGather } from '../actions/gather.js';
import { discover } from '../actions/discover.js';
import { advanceAnimation, cancelAction } from '../animation/clips.js';
import { hasJournalPage } from '../world/journal.js';
import { REPAIR_COST } from '../data/balance.js';
import { save } from './session.js';
import { logFinds } from './playtest.js';

// Engine timings, not game balance (that lives in data/balance.js).
// MAX_FRAME_DT: the longest step (seconds) one frame may simulate, so a slow frame can't jump ahead.
// AUTOSAVE_EVERY: seconds of play between automatic saves.
// HUD_EVERY: seconds between HUD refreshes; the numbers don't need redrawing every frame.
const MAX_FRAME_DT = 0.05,
  AUTOSAVE_EVERY = 10,
  HUD_EVERY = 0.12;

// The words for each kind of find, used in the pop-up message. Each takes the find
// (`{kind, id, name}`) from discover().
const FOUND = {
  // Entering a region for the first time.
  region: ({ name }) => `Discovered ${name}`,
  // Coming close to a named place. Places with a journal page say so, to send the player to J.
  landmark: ({ id, name }) =>
    hasJournalPage(id) ? `Found ${name} · New page in your journal (J)` : `Found ${name}`,
  // Walking up to a signpost.
  waypoint: ({ name }) => `Signpost found: ${name}`,
  // Coming close to an old boat on the beach, and what mending it costs.
  wreck: ({ name }) =>
    `Found ${name} � Repair it with ${REPAIR_COST.wood} wood and ${REPAIR_COST.stone} stone`,
};

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

        // When a timed action finishes, award the supply it was aimed at (exactly once).
        const done = advanceAnimation(animator, dt, { moving, running });
        if (done?.target) {
          const node = finishGather(state, done.target);
          if (node) {
            ui.hud.notify(`+${node.amount} ${node.type} · ${node.label}`);
            ui.hud.update();
            save(session, ui, true);
          }
        }

        const found = discover(state);
        if (found.length) {
          ui.hud.notify(found.map((f) => FOUND[f.kind](f)).join(' · '));
          ui.hud.update();
          ui.journal.refreshDot();
          logFinds(session, found);
          save(session, ui, true);
        }

        // Autosave like a stopwatch: count up, save, reset.
        clock.sinceSave += dt;
        if (clock.sinceSave > AUTOSAVE_EVERY) {
          save(session, ui, true);
          clock.sinceSave = 0;
        }
      }

      // Drawing still happens while paused, so the world stays on screen behind the dialog.
      renderer.draw(state, dt, animator);
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
