// The rules for character animation, with no drawing in it.
// It decides which picture (frame) of which animation to show at a given moment, and keeps
// track of timed actions such as gathering. It runs in plain Node, so the tests can check it.

/**
 * Every animation the characters have, by name.
 *
 * - `label`: the name shown in the preview dialog.
 * - `frames`: how many steps the animation has.
 * - `fps`: how many of those steps to show per second.
 * - `loop`: start over at the end (true) or hold the last picture (false).
 * - `sheet`: which sprite sheet the pictures live on (`idleLoop`, `locomotion`, `run`, `actions`,
 *   `chop`, `chopIron`, `mine`, `mineIron`, or one of the survival sheets: `sleep`, `wake`, `hungry`, `hurtHunger`, `hurtCold`,
 *   `hurtAttack`, `dying`).
 * - `row`: which row of that sheet.
 * - `turns`: the sheet has one row per facing (south, west, east, north), added to `row`.
 * - `order`: which column to show at each step, when the pictures are not simply played left to
 *   right. Idle breathes a few times before the picture with the blink, so the eyes don't flutter.
 * - `action`: a timed action (see `startAction`). Its art faces east and is mirrored for west.
 * - `once`: a timed action that plays through one time and then holds its last picture (also
 *   after it finishes), where other actions loop. It also can't be cancelled: a falling character
 *   can't change their mind.
 * - `east`: the art only faces east and is mirrored for west, like an action's, but it is not one.
 * - `reaction`: a short flinch played once when something hurts (see `advanceAnimation`).
 * - `every`: seconds a reaction waits before it may play again while its cause lasts. A flinch
 *   on every frame of freezing would never let the character be seen doing anything else.
 */
export const CLIPS = {
  idle: {
    label: 'Idle',
    frames: 10,
    fps: 2.5,
    loop: true,
    sheet: 'idleLoop',
    row: 0,
    turns: true,
    order: [0, 1, 3, 0, 1, 3, 0, 1, 2, 3],
  },
  walk: {
    label: 'Walking',
    frames: 4,
    fps: 7,
    loop: true,
    sheet: 'locomotion',
    row: 0,
    turns: true,
  },
  run: { label: 'Running', frames: 6, fps: 15, loop: true, sheet: 'run' },
  gather: {
    label: 'Gathering',
    frames: 4,
    fps: 5,
    loop: false,
    sheet: 'actions',
    row: 0,
    action: true,
  },
  build: {
    label: 'Building',
    frames: 4,
    fps: 4,
    loop: true,
    sheet: 'actions',
    row: 1,
    action: true,
  },
  craft: {
    label: 'Crafting',
    frames: 4,
    fps: 5,
    loop: true,
    sheet: 'actions',
    row: 2,
    action: true,
  },
  fight: {
    label: 'Fighting',
    frames: 4,
    fps: 7,
    loop: false,
    sheet: 'actions',
    row: 3,
    action: true,
  },
  swim: {
    label: 'Swimming',
    frames: 4,
    fps: 6,
    loop: true,
    sheet: 'actions',
    row: 4,
    action: true,
  },
  // Chopping a tree with the axe: ready, lift overhead, strike, follow through.
  chop: {
    label: 'Chopping — stone axe',
    frames: 4,
    fps: 5,
    loop: true,
    sheet: 'chop',
    row: 0,
    action: true,
  },
  chopIron: {
    label: 'Chopping — iron axe',
    frames: 4,
    fps: 5,
    loop: true,
    sheet: 'chopIron',
    row: 0,
    action: true,
  },
  mine: {
    label: 'Mining — stone pickaxe',
    frames: 4,
    fps: 5,
    loop: true,
    sheet: 'mine',
    row: 0,
    action: true,
  },
  mineIron: {
    label: 'Mining — iron pickaxe',
    frames: 4,
    fps: 5,
    loop: true,
    sheet: 'mineIron',
    row: 0,
    action: true,
  },
  // Lying on one side, breathing slowly: after passing out, and for a short nap when resting.
  sleep: { label: 'Sleeping', frames: 4, fps: 2, loop: true, sheet: 'sleep', row: 0, east: true },
  // Getting up: lying, pushing upright, kneeling, standing. A timed action, so the character
  // can't slide along the ground while still lying down; a movement key skips it.
  wake: { label: 'Waking up', frames: 4, fps: 4, loop: false, sheet: 'wake', row: 0, action: true },
  // Standing still on a nearly empty stomach: hand on belly, glance down, rub, look up again.
  // The order holds the first pose for a moment, so the rubbing comes in little bouts.
  hungry: {
    label: 'Hungry',
    frames: 8,
    fps: 3,
    loop: true,
    sheet: 'hungry',
    row: 0,
    east: true,
    order: [0, 0, 0, 1, 2, 1, 2, 3],
  },
  // A stomach cramp while starving: weak stance, cramp, doubled over, easing.
  hurtHunger: {
    label: 'Hurt by hunger',
    frames: 4,
    fps: 6,
    loop: false,
    sheet: 'hurtHunger',
    row: 0,
    east: true,
    reaction: true,
    every: 10,
  },
  // A hard shiver while freezing: self-hug, raised shoulders, strong shiver, easing.
  hurtCold: {
    label: 'Hurt by cold',
    frames: 4,
    fps: 6,
    loop: false,
    sheet: 'hurtCold',
    row: 0,
    east: true,
    reaction: true,
    every: 3,
  },
  // Struck by an attack: brace, recoil, stagger, regain balance. It plays when a wolf bites.
  hurtAttack: {
    label: 'Hurt by an attack',
    frames: 4,
    fps: 8,
    loop: false,
    sheet: 'hurtAttack',
    row: 0,
    east: true,
    reaction: true,
    every: 1,
  },
  // Driving wolves back: fists up, arms thrown wide, a two-handed shove, fists up again. A short
  // timed action with no target (R); the push itself happens when it starts (actions/wolves.js).
  repel: {
    label: 'Repel',
    frames: 4,
    fps: 8,
    loop: false,
    sheet: 'repel',
    row: 0,
    east: true,
    action: true,
  },
  // Falling down when health runs out: sagging, knees buckling, kneeling, hip on the ground,
  // rolling onto the back, lying still. It plays where the player stood, before they wake by a fire.
  collapse: {
    label: 'Collapsing',
    frames: 6,
    fps: 6,
    loop: false,
    sheet: 'dying',
    row: 0,
    action: true,
    once: true,
  },
};

/**
 * Seconds the collapse lasts before the pass-out screen comes up: one second of falling, then a
 * moment lying still, so the player sees where and that they fell before the scene changes.
 */
export const COLLAPSE_SECONDS = 1.8;

/**
 * Seconds the character is shown asleep when resting at a camp. The night itself is skipped at
 * once, so this is only long enough to see them lying down before they get up.
 */
export const NAP_SECONDS = 2;

/**
 * Says which diagonal a movement heads along, if any.
 *
 * Holding two movement keys at once (W and D, say) walks diagonally, and the walk and run have
 * their own pictures for that. The art faces north-east and south-east; the two west diagonals
 * mirror it.
 *
 * @param {number} dx - Sideways movement: negative is west, 0 is none.
 * @param {number} dy - Up/down movement: negative is north, 0 is none.
 * @returns {string|null} 'ne', 'nw', 'se' or 'sw', or null when the movement is straight or still.
 */
export function diagonalOf(dx, dy) {
  if (!(dx && dy) || ![dx, dy].every(Number.isFinite)) return null;
  return (dy < 0 ? 'n' : 's') + (dx < 0 ? 'w' : 'e');
}

/** The four diagonals `diagonalOf` can name. */
const DIAGONALS = ['ne', 'nw', 'se', 'sw'];

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
 * @param {string|null} [diagonal=null] - 'ne', 'nw', 'se' or 'sw' while walking or running
 *   diagonally. Other clips ignore it.
 * @returns {{sheet: string, row: number, frame: number, direction: number, flip: boolean, lift: number}}
 *   Where to find the picture, whether to mirror it, and how high to lift it (a share of its height).
 */
export function sampleAnimation(
  name,
  time,
  direction = 0,
  loop = CLIPS[name]?.loop,
  diagonal = null,
) {
  const clip = CLIPS[name] ?? CLIPS.idle;
  const facing = [0, 1, 2, 3].includes(direction) ? direction : 0;

  // Count whole frames played so far; the tiny extra stops rounding from landing one frame short.
  const tick = Math.floor(Math.max(0, Number.isFinite(time) ? time : 0) * clip.fps + 1e-8);
  const step = loop ? tick % clip.frames : Math.min(tick, clip.frames - 1);
  const frame = clip.order ? clip.order[step] : step;

  // Diagonal walking and running have one-row sheets of their own (`walkNE`, `walkSE`, `runNE`,
  // `runSE`), painted heading east and mirrored for the west diagonals. They have as many frames
  // as the straight clips, and the run's two flight poses are the same frames.
  if ((clip === CLIPS.walk || clip === CLIPS.run) && DIAGONALS.includes(diagonal)) {
    return {
      sheet: (clip === CLIPS.run ? 'run' : 'walk') + (diagonal[0] === 'n' ? 'NE' : 'SE'),
      row: 0,
      frame,
      direction: facing,
      flip: diagonal[1] === 'w',
      lift: clip === CLIPS.run && frame % 3 === 2 ? 0.125 : 0,
    };
  }

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

  // Idle and walk rows go one per direction; action and east-only art is mirrored for west.
  return {
    sheet: clip.sheet,
    row: (clip.row ?? 0) + (clip.turns ? facing : 0),
    frame,
    direction: facing,
    flip: !!(clip.action || clip.east) && facing === 1,
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
 * `pending` is the timed action running, `reaction` the flinch playing (a clip name), `hurtWait`
 * the seconds until the next flinch may play, `asleep` the seconds of sleep left (0 is awake,
 * Infinity is "until woken"), and `diagonal` the diagonal being walked ('ne', 'nw', 'se', 'sw')
 * or null.
 *
 * @returns {{clip: string, time: number, pending: object|null, reaction: string|null,
 *   hurtWait: number, asleep: number, diagonal: string|null}} Standing idle, awake, with no
 *   action running.
 */
export function createAnimator() {
  return {
    clip: 'idle',
    time: 0,
    pending: null,
    reaction: null,
    hurtWait: 0,
    asleep: 0,
    diagonal: null,
  };
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
 * @returns {boolean} True if the action started; false if one was already running, the character
 *   is asleep, or the clip isn't an action.
 */
export function startAction(animator, clip, target = null, duration = null) {
  if (animator.pending || animator.asleep > 0 || !CLIPS[clip]?.action) return false;

  // An action takes over from a flinch that was playing.
  const length = CLIPS[clip].frames / CLIPS[clip].fps;
  animator.reaction = null;
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
 * A collapse (a `once` clip) is the one action that can't be stopped: pressing a movement key
 * must not let a player with no health left walk away from passing out.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @returns {boolean} True if an action was stopped; false if none was running or it can't be stopped.
 */
export function cancelAction(animator) {
  if (!animator.pending || CLIPS[animator.pending.clip].once) return false;
  animator.pending = null;
  animator.clip = 'idle';
  animator.time = 0;
  return true;
}

/**
 * Makes the character fall down, dropping whatever they were doing.
 *
 * This is what running out of health looks like. It is a timed action with no target, so when
 * `advanceAnimation` reports it done, the game knows it is time to pass out (see `core/loop.js`).
 * Calling it again while already falling changes nothing, so the fall never starts over.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @returns {boolean} True if the fall started; false if the character was already falling.
 */
export function startCollapse(animator) {
  if (isCollapsing(animator)) return false;
  animator.pending = { clip: 'collapse', target: null, duration: COLLAPSE_SECONDS };
  animator.reaction = null;
  animator.asleep = 0;
  animator.clip = 'collapse';
  animator.time = 0;
  return true;
}

/**
 * Tells whether the character is falling down right now.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @returns {boolean} True while the collapse action runs.
 */
export const isCollapsing = (animator) => animator.pending?.clip === 'collapse';

/**
 * Lays the character down to sleep, dropping whatever they were doing.
 *
 * Closing the pass-out screen lays the character down by a fire and wakes them at once, so they
 * are seen getting up there. Resting at a camp is a short nap: the night is skipped at once, so the nap only shows the character asleep for a
 * moment before they get up by themselves.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @param {number} [seconds=Infinity] - How long to sleep. Missing or bad means until woken.
 */
export function startSleep(animator, seconds = Infinity) {
  animator.pending = null;
  animator.reaction = null;
  animator.clip = 'sleep';
  animator.time = 0;
  animator.asleep = seconds > 0 ? seconds : Infinity;
}

/**
 * Ends sleep and plays the getting-up action.
 *
 * @param {object} animator - The animator from `createAnimator`.
 * @returns {boolean} True if the character was asleep and now gets up; false if they were awake.
 */
export function wakeUp(animator) {
  if (!(animator.asleep > 0)) return false;
  animator.asleep = 0;
  return startAction(animator, 'wake');
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
 * A sleeping character only breathes until the sleep ends, then gets up. If an action is
 * running, its stopwatch ticks and, once time is up, the action ends and is reported back.
 * Otherwise a flinch (`hurt`) may play once, also while walking, because pain doesn't wait for
 * the character to stand still. With none of those, the character shows idle (or the hungry
 * pose), walk or run to match how it is moving, restarting the flip-book whenever that changes.
 *
 * @param {object} animator - The animator from `createAnimator`. It is changed in place.
 * @param {number} dt - Seconds since the last frame.
 * @param {object} [options] - What the character is doing this frame.
 * @param {boolean} [options.moving=false] - The character moved this frame.
 * @param {boolean} [options.running=false] - The character is running, not walking.
 * @param {boolean} [options.paused=false] - The game is paused, so time stands still.
 * @param {boolean} [options.hungry=false] - The stomach is nearly empty: stand with a hand on it.
 * @param {string|null} [options.diagonal=null] - The diagonal the character really moved along
 *   this frame ('ne', 'nw', 'se', 'sw'), or null. Only kept while moving.
 * @param {string|null} [options.hurt=null] - The reaction clip for what is hurting right now
 *   (such as `hurtCold`), or null. It replays every `every` seconds while it stays set.
 * @returns {{clip: string, target: *}|null} The action that just finished, or null if none did.
 */
export function advanceAnimation(
  animator,
  dt,
  {
    moving = false,
    running = false,
    paused = false,
    hungry = false,
    hurt = null,
    diagonal = null,
  } = {},
) {
  if (paused || !Number.isFinite(dt) || dt <= 0) return null;
  animator.diagonal = moving && DIAGONALS.includes(diagonal) ? diagonal : null;
  animator.hurtWait = Math.max(0, animator.hurtWait - dt);

  // Asleep: keep breathing until the sleep runs out, then get up.
  if (animator.asleep > 0) {
    animator.time += dt;
    if (animator.asleep > dt) animator.asleep -= dt;
    else wakeUp(animator);
    return null;
  }

  // A timed action ignores movement; it only counts down until it is done.
  if (animator.pending) {
    animator.time += dt;
    if (animator.time + 1e-8 >= animator.pending.duration) {
      const { clip, target } = animator.pending;
      animator.pending = null;

      // A `once` action (the collapse) keeps its last picture, so the character stays lying
      // down behind the pass-out screen. Every other action goes back to standing.
      if (!CLIPS[clip].once) {
        animator.clip = 'idle';
        animator.time = 0;
      }
      return { clip, target };
    }
    return null;
  }

  // A flinch plays through once. A new one starts when something hurts and the wait is over.
  if (animator.reaction) {
    animator.time += dt;
    const { frames, fps } = CLIPS[animator.reaction];
    if (animator.time + 1e-8 < frames / fps) return null;
    animator.reaction = null;
  } else if (CLIPS[hurt]?.reaction && animator.hurtWait <= 0) {
    animator.reaction = hurt;
    animator.clip = hurt;
    animator.time = 0;
    animator.hurtWait = CLIPS[hurt].every;
    return null;
  }

  // Otherwise match the clip to how the character is moving, starting it over when it changes.
  const still = hungry ? 'hungry' : 'idle';
  const next = moving ? (running ? 'run' : 'walk') : still;
  if (next !== animator.clip) {
    animator.clip = next;
    animator.time = 0;
  } else animator.time += dt;
  return null;
}
