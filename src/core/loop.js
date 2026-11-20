// The frame loop: the heartbeat of the game.
// About 60 times a second it moves the player (or their boat), runs the current animation and the
// survival clock, hands out gathered supplies, mended boats and crafted tools, checks for new
// finds, lifts the fog, autosaves, and asks the renderer to draw.

import { movePlayer, stepLength } from '../actions/move.js';
import { beginInteraction, finishInteraction } from '../actions/interact.js';
import { aimState } from '../actions/gather.js';
import { beginApproach, beginPlacing, approachStep, eightWay } from '../actions/approach.js';
import { deepAhead } from '../actions/boat.js';
import { discover } from '../actions/discover.js';
import { tickSurvival, meterTrends } from '../actions/survive.js';
import { tickVillagers } from '../actions/villagers.js';
import { advanceAnimation, cancelAction, startCollapse, diagonalOf } from '../animation/clips.js';
import { hasJournalPage } from '../world/journal.js';
import { REPAIR_COST, HUNGRY_BELOW, APPROACH_STUCK, STAND_STUCK } from '../data/balance.js';
import { markFinds, describeNeed } from '../world/needs.js';
import { revealAround } from '../world/fog.js';
import { inSnow } from '../world/regions.js';
import { describeEvent, describeFinish } from '../ui/hud.js';
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

// What the player is told on walking into the snow.
const SNOW_WARNING = 'The snow bites: warmth falls fast here, even by day. Stay near a fire.';

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
 * Picks the flinch to show for what is hurting the player right now.
 *
 * Freezing comes first, because it drains health fastest. Starving drains it slowly, and its
 * cramp keeps showing at the health floor as a reminder to eat. Seated in the boat there is no flinch.
 *
 * @param {object} state - The game being played.
 * @returns {string|null} A reaction clip name (`hurtCold` or `hurtHunger`), or null.
 */
function hurtClip(state) {
  if (state.aboard) return null;
  const trends = meterTrends(state);
  if (trends.health === 'freezing') return 'hurtCold';
  return trends.hunger === 'starving' ? 'hurtHunger' : null;
}

/**
 * Brings up the pass-out screen over the spot where the player fell.
 *
 * It runs when the collapse has played (or at once in the boat). Nothing else changes yet: the
 * character stays lying where they fell behind the screen, and only its "Get up" button moves
 * them to a fire at midday (see `ui/camp.js`), so the scene never changes under the player's eyes.
 *
 * @param {object} ui - The UI helpers (`hud`, `build`, `camp`).
 */
function showPassOut(ui) {
  ui.build.cancel();
  ui.camp.showPassOut();
  ui.hud.update();
}

/**
 * Handles one frame's survival news.
 *
 * With no health left the character first collapses where they stand; the loop shows the
 * pass-out screen when that fall has played. It checks the health itself, not only the `passout`
 * event, because the game may be saved and reloaded mid-fall, and a player loaded with no health
 * must still pass out. Seated in the boat there is no room to fall, so the screen comes at once.
 * Anything else becomes a toast, and a new day saves the game.
 *
 * @param {object} session - The shared session.
 * @param {object} ui - The UI helpers (`hud`, `build`, `camp`).
 * @param {object[]} events - What tickSurvival reported this frame.
 */
function handleSurvival(session, ui, events) {
  const { state, animator } = session;
  if (state.meters.health <= 0) {
    if (state.aboard) showPassOut(ui);
    else if (startCollapse(animator)) {
      ui.build.cancel();
      ui.hud.update();
    }
    return;
  }
  if (!events.length) return;

  const words = events.map(describeEvent).filter(Boolean);
  if (words.length) ui.hud.notify(words.join(' · '));
  ui.hud.update();
  if (events.some((e) => e.kind === 'dawn')) save(session, ui, true);
}

/**
 * Plans a fresh path for a walk that ran into trouble, or gives the walk up.
 *
 * A walk gets one second try (a tree may have grown back in the way, say). If that fails too, or
 * no path exists any more, the walk ends and the player is told.
 *
 * @param {object} session - The shared session; its `walk` is replaced or cleared.
 * @param {object} ui - The UI helpers (`hud`).
 */
function replanWalk(session, ui) {
  const { walk, state } = session,
    next = walk.retried ? null : beginApproach(state, walk.node);
  session.walk = next && { ...next, retried: true };
  if (!next) ui.hud.notify(`Can't find a way to the ${walk.node.label.toLowerCase()}.`);
}

/**
 * Follows the walk to a clicked tree or rock for one frame.
 *
 * Once the target is in reach the walk ends and the chop or the mining starts, just as if the
 * player had clicked it from beside it. Something picked by hand gets one more short step first,
 * to the spot beside it (see standSpot). If the target is gone (or its tool broke on the way) the
 * walk is simply dropped. Otherwise it says which way to push the player this frame.
 *
 * @param {object} session - The shared session; its `walk` is followed and may be cleared.
 * @param {object} ui - The UI helpers (`hud`).
 * @param {number} dt - Seconds since the last frame.
 * @param {boolean} running - True while Shift is held, so the walk becomes a run.
 * @returns {{dx: number, dy: number}|null} The push for movePlayer, or null when not walking on.
 */
function followWalk(session, ui, dt, running) {
  const { state, animator, walk } = session,
    how = aimState(state, walk.node);

  if (how !== 'far') {
    // In reach of something picked by hand: first step to the spot beside it, so the bending
    // picture reaches toward it. If something blocks that short step, gather from here instead.
    if (how === 'ready') {
      if (!walk.placing) session.walk = beginPlacing(state, walk.node) ?? walk;
      const placing = session.walk.placing && session.walk;
      const push =
        placing &&
        placing.stuck < STAND_STUCK &&
        approachStep(state, placing, stepLength(state, dt, running));
      if (push) return push;
    }

    session.walk = null;
    if (how === 'ready' && beginInteraction(state, animator, walk.node.id).ok) ui.hud.update();
    return null;
  }

  const push = approachStep(state, walk, stepLength(state, dt, running));
  // The path ran out short of the target: plan again from here.
  if (!push) replanWalk(session, ui);
  return push;
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

  // Whether the player was in the snow on the frame before, so walking into it is announced once.
  let wasInSnow = false;

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

      // Opening a dialog (the map, a camp, pause) calls off a walk to a clicked tree or rock.
      if (ui.dialogs.isPaused()) session.walk = null;

      // The simulation only runs while nothing is paused and the tab is visible.
      if (!ui.dialogs.isPaused() && !document.hidden) {
        const keys = ui.input.moveIntent(),
          { running } = keys;
        let { dx, dy } = keys;

        // Moving cancels an action in progress; nothing is awarded. A collapse can't be cancelled.
        if (animator.pending && (dx || dy) && cancelAction(animator)) ui.hud.update();

        // A click on a far tree or rock walks the player to it. A movement key takes the player
        // back, and so does anything that keeps them busy (an action, a nap, building).
        const { build } = session;
        if (dx || dy || animator.pending || animator.asleep > 0 || build.active || build.menu)
          session.walk = null;
        const push = session.walk && followWalk(session, ui, dt, running);
        if (push) ({ dx, dy } = push);

        // Nobody walks while busy with an action or lying asleep.
        const free = !animator.pending && !(animator.asleep > 0);
        const from = { x: state.player.x, y: state.player.y };
        moving = free && movePlayer(state, dx, dy, dt, running);

        // A walk that pushes at something without moving plans a new path, then gives up.
        if (push && session.walk) {
          session.walk.stuck = moving ? 0 : session.walk.stuck + dt;
          // The short step beside a patch is never planned again: followWalk gathers from here.
          if (session.walk.stuck > APPROACH_STUCK && !session.walk.placing) replanWalk(session, ui);
        }
        // The first real step hides the controls strip.
        if (moving) ui.hud.hideKeyStrip();
        state.elapsed += dt;
        // The world clock, the meters and each camp's dawn update move with the survival tick.
        const events = tickSurvival(state, dt);
        // The villagers of Hollowstead get on with their work (and wait while the player is near).
        tickVillagers(state, dt);
        ui.build.update(); // keep the build ghost on the pointer

        // Rowing into deep water: say why the boat won't go on, but not every frame.
        if (deepAhead(state, dx, dy) && now - warnedDeepAt > DEEP_WARN_MS) {
          ui.hud.notify('Too rough for a small boat.');
          warnedDeepAt = now;
        }

        // When a timed action finishes, hand out what it was aimed at (exactly once): supplies, a
        // mended boat or a crafted tool.
        // The diagonal pictures follow where the player really went, so sliding along a wall
        // with two keys held shows the straight walk, not a diagonal one. A walk to a clicked
        // tree goes at any angle, so the movement is first rounded to the nearest of 8 directions.
        const went = eightWay(state.player.x - from.x, state.player.y - from.y);
        const done = advanceAnimation(animator, dt, {
          moving,
          running,
          diagonal: diagonalOf(went.dx, went.dy),
          hungry: !state.aboard && state.meters.hunger < HUNGRY_BELOW,
          hurt: hurtClip(state),
        });
        const finished = done?.target ? finishInteraction(state, done.target) : null;
        // The fall has played: the pass-out screen comes up over the fallen character.
        if (done?.clip === 'collapse') showPassOut(ui);
        if (finished) {
          ui.hud.notify(describeFinish(finished));
          ui.hud.update();
          // A craft whose last check failed changed nothing, so there is nothing to save.
          if (finished.ok !== false) save(session, ui, true);
        }

        // Walking into the snow is worth a warning, told together with any find on the same step.
        const snowy = inSnow(state.player.x, state.player.y),
          chilled = snowy && !wasInSnow ? [SNOW_WARNING] : [];
        wasInSnow = snowy;

        const found = discover(state);
        if (!found.length && chilled.length) ui.hud.notify(SNOW_WARNING);
        if (found.length) {
          // A find can also meet a camp need ("Find a place in Frostpeak"); both are announced together.
          const met = markFinds(state, found);
          ui.hud.notify(
            [
              ...found.map((f) => FOUND[f.kind](f, state)),
              ...met.map(({ camp, need }) => `${camp.name}: need met · ${describeNeed(need)}`),
              ...chilled,
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
      // The tree or rock under the mouse gets a tool badge; the camera moves, so ask every frame.
      // While walking to a clicked one, its badge stays up so the player sees where they are going.
      session.hover = ui.input.hover();
      const aim = session.hover ?? (session.walk && { node: session.walk.node, state: 'ready' });
      renderer.draw(state, dt, animator, session.build, aim);
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
