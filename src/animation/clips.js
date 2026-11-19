// The rules for character animation, with no drawing in it.
// It decides which picture (frame) of which animation to show at a given moment, and keeps
// track of timed actions such as gathering. It runs in plain Node, so the tests can check it.

/**
 * Every animation the characters have, by name.
 *
 * - `label`: the name shown in the preview dialog.
 * - `frames`: how many pictures the animation has.
 * - `fps`: how many of those pictures to show per second.
 * - `loop`: start over at the end (true) or hold the last picture (false).
 * - `sheet`: which sprite sheet the pictures live on (`idle`, `locomotion`, `run` or `actions`).
 * - `row`: which row of that sheet. Walking adds the facing direction to it.
 */
export const CLIPS = {
  idle: { label: 'Idle', frames: 1, fps: 1, loop: true, sheet: 'idle' },
  walk: { label: 'Walking', frames: 4, fps: 7, loop: true, sheet: 'locomotion', row: 0 },
  run: { label: 'Running', frames: 6, fps: 15, loop: true, sheet: 'run' },
  gather: { label: 'Gathering', frames: 4, fps: 5, loop: false, sheet: 'actions', row: 0 },
  build: { label: 'Building', frames: 4, fps: 4, loop: true, sheet: 'actions', row: 1 },
  craft: { label: 'Crafting', frames: 4, fps: 5, loop: true, sheet: 'actions', row: 2 },
  fight: { label: 'Fighting', frames: 4, fps: 7, loop: false, sheet: 'actions', row: 3 },
  swim: { label: 'Swimming', frames: 4, fps: 6, loop: true, sheet: 'actions', row: 4 },
};

/**
 * Works out which picture of an animation to show at a moment in time.
 *
 * An animation is like a flip-book. Given how long it has been playing, this finds the page
 * we are on, and says which sheet and row that page is on, whether to mirror it, and how far
 * to lift it off the ground.
 *
 * @param {string} name - The clip name, such as `walk`. Unknown names fall back to `idle`.
 * @param {number} time - Seconds the clip has been playing.
 * @param {number} [direction=0] - Facing: 0 south, 1 west, 2 east, 3 north.
 * @param {boolean} [loop] - Start over at the end. Defaults to the clip's own setting.
 * @returns {{sheet: string, row: number, frame: number, direction: number, flip: boolean, lift: number}}
 *   Where to find the picture, whether to mirror it, and how high to lift it (a share of its height).
 */
export function sampleAnimation(name, time, direction = 0, loop = CLIPS[name]?.loop) {
  const clip = CLIPS[name] ?? CLIPS.idle;
  const facing = [0, 1, 2, 3].includes(direction) ? direction : 0;

  // Count whole frames played so far; the tiny extra stops rounding from landing one frame short.
  const tick = Math.floor(Math.max(0, Number.isFinite(time) ? time : 0) * clip.fps + 1e-8);
  const frame = loop ? tick % clip.frames : Math.min(tick, clip.frames - 1);

  if (clip === CLIPS.run) {
    // South, east (also mirrored west), north. Both flight poses clear the ground.
    return {
      sheet: 'run',
      row: [0, 1, 1, 2][facing],
      frame,
      direction: facing,
      flip: facing === 1,
      lift: frame % 3 === 2 ? 0.125 : 0,
    };
  }

  // Walk rows go one per direction; action art faces east, so it is mirrored for west.
  return {
    sheet: clip.sheet,
    row: clip.sheet === 'locomotion' ? clip.row + facing : (clip.row ?? 0),
    frame,
    direction: facing,
    flip: clip.sheet === 'actions' && facing === 1,
    lift: 0,
  };
}

/**
 * Picks a steady sideways anchor point for each frame of a walk strip.
 *
 * Generated cells do not hold the body at a fixed spot, so anchoring on the cell centre makes the
 * character slide back and forth while walking. Anchor each frame on its head instead, shifted by
 * the strip's average head offset so the sprite keeps its overall placement.
 *
 * @param {number[]} cellCenters - The middle x of each frame's cell.
 * @param {number[]} headCenters - The middle x of the head in each frame.
 * @returns {number[]} The x to pin each frame to, so the head stays still between frames.
 */
export function steadyAnchors(cellCenters, headCenters) {
  const drift =
    headCenters.reduce((sum, head, i) => sum + head - cellCenters[i], 0) / headCenters.length;
  return headCenters.map((head) => head - drift);
}

/**
 * Makes a fresh animator: the little record of what the character is animating right now.
 *
 * @returns {{clip: string, time: number, pending: object|null}} Standing idle, with no action running.
 */
export function createAnimator() {
  return { clip: 'idle', time: 0, pending: null };
}

/**
 * Starts a timed action, such as gathering, on the animator.
 *
 * An action runs for `duration` seconds (default: one pass of its clip); longer actions loop the
 * clip. Think of it as starting a stopwatch: when it runs out, `advanceAnimation` reports that
 * the action is done. Only one action can run at a time.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @param {string} clip - An action clip name, such as `gather` or `build`.
 * @param {*} [target=null] - What the action is aimed at (a supply id), handed back when it ends.
 * @param {number|null} [duration=null] - How many seconds it takes. Missing or bad means one clip pass.
 * @returns {boolean} True if the action started; false if one was already running or the clip isn't an action.
 */
export function startAction(animator, clip, target = null, duration = null) {
  if (animator.pending || CLIPS[clip]?.sheet !== 'actions') return false;

  const length = CLIPS[clip].frames / CLIPS[clip].fps;
  animator.clip = clip;
  animator.time = 0;
  animator.pending = {
    clip,
    target,
    duration: Number.isFinite(duration) && duration > 0 ? duration : length,
  };
  return true;
}

/**
 * Stops the running action early and goes back to standing still. Nothing is finished or awarded.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @returns {boolean} True if an action was stopped; false if none was running.
 */
export function cancelAction(animator) {
  if (!animator.pending) return false;
  animator.pending = null;
  animator.clip = 'idle';
  animator.time = 0;
  return true;
}

/**
 * Tells how far through the running action we are, from 0 (just started) to 1 (done).
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @returns {number} The share of the action that has passed, or 0 when no action is running.
 */
export const actionProgress = (animator) =>
  animator.pending ? Math.min(1, animator.time / animator.pending.duration) : 0;

/**
 * Moves the animation forward by one frame's worth of time.
 *
 * If an action is running, its stopwatch ticks and, once time is up, the action ends and is
 * reported back. Otherwise the character shows idle, walk or run to match how it is moving,
 * restarting the flip-book whenever that changes.
 *
 * @param {object} animator - The animator from `createAnimator`. It is changed in place.
 * @param {number} dt - Seconds since the last frame.
 * @param {object} [options] - What the character is doing this frame.
 * @param {boolean} [options.moving=false] - The character moved this frame.
 * @param {boolean} [options.running=false] - The character is running, not walking.
 * @param {boolean} [options.paused=false] - The game is paused, so time stands still.
 * @returns {{clip: string, target: *}|null} The action that just finished, or null if none did.
 */
export function advanceAnimation(
  animator,
  dt,
  { moving = false, running = false, paused = false } = {},
) {
  if (paused || !Number.isFinite(dt) || dt <= 0) return null;

  // A timed action ignores movement; it only counts down until it is done.
  if (animator.pending) {
    animator.time += dt;
    if (animator.time + 1e-8 >= animator.pending.duration) {
      const { clip, target } = animator.pending;
      animator.pending = null;
      animator.clip = 'idle';
      animator.time = 0;
      return { clip, target };
    }
    return null;
  }

  // Otherwise match the clip to how the character is moving, starting it over when it changes.
  const next = moving ? (running ? 'run' : 'walk') : 'idle';
  if (next !== animator.clip) {
    animator.clip = next;
    animator.time = 0;
  } else animator.time += dt;
  return null;
}
