// Checks the animation rules: which picture of the character to show at each moment, and how
// timed actions (like gathering) start, run, finish or get cancelled. The gather timer lives here,
// so a mistake could pay out supplies twice, never, or while the game is paused.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIPS,
  createAnimator,
  startAction,
  advanceAnimation,
  cancelAction,
  actionProgress,
  startSleep,
  wakeUp,
  startCollapse,
  isCollapsing,
  COLLAPSE_SECONDS,
  diagonalOf,
  sampleAnimation,
  steadyAnchors,
} from '../../src/animation/clips.js';
import { createGame, serializeGame } from '../../src/game/state.js';

// Guards against a clip going missing or being renamed, and against frame counts that no
// longer match the sprite sheets (which would show blank or wrong pictures).
test('every clip the game plays has its own definition', () => {
  assert.deepEqual(Object.keys(CLIPS), [
    'idle',
    'walk',
    'run',
    'gather',
    'build',
    'craft',
    'fight',
    'swim',
    'chop',
    'chopIron',
    'mine',
    'mineIron',
    'sleep',
    'wake',
    'hungry',
    'hurtHunger',
    'hurtCold',
    'hurtAttack',
    'collapse',
  ]);
  const four = ['walk', 'gather', 'build', 'craft', 'fight', 'swim', 'chop', 'sleep', 'wake'];
  const swings = ['chopIron', 'mine', 'mineIron'];
  for (const name of [...four, ...swings, 'hurtHunger', 'hurtCold', 'hurtAttack'])
    assert.equal(CLIPS[name].frames, 4);
  assert.equal(CLIPS.run.frames, 6);
  assert.equal(CLIPS.collapse.frames, 6);
});

// Guards against the character walking backwards or sideways, against run frames picking the
// wrong row or mirror, and against the run's little hop landing on the wrong frames.
test('walk and run use all four directional rows and loop their frames', () => {
  for (let direction = 0; direction < 4; direction++) {
    assert.equal(sampleAnimation('walk', 0, direction).row, direction);
    const run = sampleAnimation('run', 0, direction);
    assert.equal(run.row, [0, 1, 1, 2][direction]);
    assert.equal(run.flip, direction === 1);
  }

  assert.equal(sampleAnimation('walk', 1 / CLIPS.walk.fps, 0).frame, 1);
  assert.equal(sampleAnimation('walk', 4 / CLIPS.walk.fps, 0).frame, 0);
  assert.ok(CLIPS.run.fps > CLIPS.walk.fps);

  for (let i = 0; i <= 6; i++) {
    const pose = sampleAnimation('run', i / CLIPS.run.fps, 2);
    assert.equal(pose.frame, i % 6);
    assert.equal(pose.lift > 0, i % 3 === 2);
  }
});

// Guards the breathing idle: each facing has its own row (so a character standing still never
// snaps to face south), every step names a real column of the four-frame sheet, and the blink
// picture (column 2) shows only once per loop so the eyes don't flutter.
test('idle breathes on its own row per facing and blinks once per loop', () => {
  const columns = [];
  for (let step = 0; step < CLIPS.idle.frames; step++) {
    const pose = sampleAnimation('idle', step / CLIPS.idle.fps, 3);
    assert.equal(pose.sheet, 'idleLoop');
    assert.equal(pose.row, 3);
    assert.equal(pose.flip, false);
    columns.push(pose.frame);
  }
  assert.ok(columns.every((column) => column >= 0 && column < 4));
  assert.equal(columns.filter((column) => column === 2).length, 1);
  assert.equal(sampleAnimation('idle', CLIPS.idle.frames / CLIPS.idle.fps, 1).row, 1);
});

// Guards the axe swing: it is a timed action on its own sheet, loops for the whole gather, and
// mirrors for west like the other east-facing action art.
test('chopping is a looping action on its own sheet, mirrored for west', () => {
  const a = createAnimator();
  assert.equal(startAction(a, 'chop', 'pine-wood', 6), true);
  assert.equal(startAction(createAnimator(), 'walk'), false);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => sampleAnimation('chop', i / CLIPS.chop.fps, 2).frame),
    [0, 1, 2, 3, 0],
  );
  assert.equal(sampleAnimation('chop', 0, 2).sheet, 'chop');
  assert.equal(sampleAnimation('chop', 0, 1).flip, true);
});

// Guards against two actions sharing one row of the sheet, and checks that facing west just
// mirrors the east-facing art instead of needing its own pictures.
test('action rows are distinct and the west pose mirrors without changing frames', () => {
  for (const [index, clip] of ['gather', 'build', 'craft', 'fight', 'swim'].entries()) {
    const sample = sampleAnimation(clip, 0, 1);
    assert.equal(sample.row, index);
    assert.equal(sample.sheet, 'actions');
    assert.equal(sample.flip, true);
    assert.equal(sampleAnimation(clip, 0, 2).flip, false);
  }
});

// Guards against "running on the spot" against a wall: the pose follows whether the player
// really moved, not just whether a key is held.
test('actual displacement chooses walking, Shift chooses running, collision chooses idle', () => {
  const a = createAnimator();
  advanceAnimation(a, 0.1, { moving: true });
  assert.equal(a.clip, 'walk');
  advanceAnimation(a, 0.1, { moving: true, running: true });
  assert.equal(a.clip, 'run');
  advanceAnimation(a, 0.1, { moving: false, running: true });
  assert.equal(a.clip, 'idle');
});

// Guards against pressing E again (or moving) restarting a gather, and against a finished
// gather reporting "done" a second time, which would pay out twice.
test('gathering finishes once and repeated input cannot restart or duplicate it', () => {
  const a = createAnimator();
  assert.equal(startAction(a, 'gather', 'pine-wood'), true);
  assert.equal(startAction(a, 'gather', 'pine-wood'), false);
  assert.equal(advanceAnimation(a, 0.1, { moving: true }), null);
  assert.equal(a.clip, 'gather');

  const result = advanceAnimation(a, 1, {});
  assert.deepEqual(result, { clip: 'gather', target: 'pine-wood' });
  assert.equal(advanceAnimation(a, 1, {}), null);
  assert.equal(a.pending, null);
});

// Guards the 6-second gather: the short clip keeps looping, the progress bar fills smoothly,
// and the action ends exactly once at the end.
test('a timed action loops its clip until its duration, then finishes once', () => {
  const a = createAnimator();
  assert.equal(startAction(a, 'gather', 'forest-food', 6), true);
  assert.equal(advanceAnimation(a, 5.9, {}), null);
  assert.equal(a.clip, 'gather');
  assert.ok(Math.abs(actionProgress(a) - 5.9 / 6) < 1e-9);

  assert.deepEqual(advanceAnimation(a, 0.1, {}), { clip: 'gather', target: 'forest-food' });
  assert.equal(a.clip, 'idle');
  assert.equal(actionProgress(a), 0);
});

// Guards against a cancelled action still paying out later.
test('cancelling an action awards nothing and returns to idle', () => {
  const a = createAnimator();
  startAction(a, 'build', 'pine-wood', 6);
  advanceAnimation(a, 3, {});

  assert.equal(cancelAction(a), true);
  assert.equal(a.pending, null);
  assert.equal(a.clip, 'idle');
  assert.equal(advanceAnimation(a, 10, {}), null);
  assert.equal(cancelAction(a), false);
});

// Guards against a gather quietly finishing while the pause menu is open.
test('pause freezes action clocks and does not finish a pending gather', () => {
  const a = createAnimator();
  startAction(a, 'gather', 'pine-wood');
  advanceAnimation(a, 0.2, {});
  const before = structuredClone(a);

  assert.equal(advanceAnimation(a, 4, { paused: true }), null);
  assert.deepEqual(a, before);
});

// Guards one-shot clips: in play they stop on their last picture, but the preview dialog can
// still loop them so you can watch them again.
test('non-looping clips hold their last frame while preview can loop them', () => {
  assert.equal(sampleAnimation('gather', 100, 2).frame, 3);
  assert.equal(sampleAnimation('gather', 4 / CLIPS.gather.fps, 2, true).frame, 0);
});

// Guards against the walking character sliding back and forth. Each frame is pinned to the
// head, and the whole strip keeps its average position.
test('steady anchors follow the head so the body does not slide between frames', () => {
  const cells = [100, 300, 500, 700],
    heads = [110, 304, 494, 690];
  const anchors = steadyAnchors(cells, heads);
  const offsets = anchors.map((anchor, i) => heads[i] - anchor);

  for (const offset of offsets) assert.ok(Math.abs(offset - offsets[0]) < 1e-9);
  assert.ok(Math.abs(anchors.reduce((sum, anchor, i) => sum + anchor - cells[i], 0)) < 1e-9);
});

// Guards against animation details sneaking into save files. Saves should only hold the game
// itself, never what pose the character happened to be in.
test('animation state is separate from saved game state', () => {
  const game = createGame('scout'),
    before = serializeGame(game),
    a = createAnimator();
  startAction(a, 'gather', 'pine-wood');
  advanceAnimation(a, 0.4, {});

  assert.equal(serializeGame(game), before);
  assert.equal(startAction(a, 'unknown'), false);
});

// Guards the survival poses: each has its own one-row sheet, faces east and mirrors for west,
// and the hungry pose never asks for a column the four-frame sheet doesn't have.
test('survival poses use their own sheets and mirror for west', () => {
  for (const name of ['sleep', 'wake', 'hungry', 'hurtHunger', 'hurtCold', 'hurtAttack']) {
    assert.equal(sampleAnimation(name, 0, 2).sheet, name);
    assert.equal(sampleAnimation(name, 0, 2).row, 0);
    assert.equal(sampleAnimation(name, 0, 2).flip, false);
    assert.equal(sampleAnimation(name, 0, 1).flip, true);
  }
  for (let step = 0; step < CLIPS.hungry.frames; step++) {
    const { frame } = sampleAnimation('hungry', step / CLIPS.hungry.fps, 2);
    assert.ok(frame >= 0 && frame < 4);
  }
});

// Guards against a well-fed character rubbing their belly, and against the hungry pose
// showing while walking (it is a standing pose, so the feet would slide).
test('a hungry character stands with the hungry pose but walks normally', () => {
  const a = createAnimator();
  advanceAnimation(a, 0.1, { hungry: true });
  assert.equal(a.clip, 'hungry');
  advanceAnimation(a, 0.1, { hungry: true, moving: true });
  assert.equal(a.clip, 'walk');
  advanceAnimation(a, 0.1, {});
  assert.equal(a.clip, 'idle');
});

// Guards the flinch: it plays once all the way through (also while walking), then waits its
// `every` seconds before it may play again, so a freezing character isn't stuck flinching.
test('a hurt reaction plays once, then waits before it plays again', () => {
  const a = createAnimator(),
    length = CLIPS.hurtCold.frames / CLIPS.hurtCold.fps;
  advanceAnimation(a, 0.05, { hurt: 'hurtCold' });
  assert.equal(a.clip, 'hurtCold');
  assert.equal(a.time, 0);

  advanceAnimation(a, length / 2, { hurt: 'hurtCold', moving: true });
  assert.equal(a.clip, 'hurtCold');
  advanceAnimation(a, length / 2, { hurt: 'hurtCold', moving: true });
  assert.equal(a.clip, 'walk');
  assert.equal(a.reaction, null);

  advanceAnimation(a, 0.5, { hurt: 'hurtCold' });
  assert.equal(a.clip, 'idle');
  advanceAnimation(a, CLIPS.hurtCold.every, { hurt: 'hurtCold' });
  assert.equal(a.clip, 'hurtCold');
});

// Guards against a flinch stopping a gather halfway (which would lose it), and against clip
// names that aren't reactions (a typo, or 'walk') being played as one.
test('a hurt reaction never interrupts a timed action and only reaction clips flinch', () => {
  const a = createAnimator();
  startAction(a, 'gather', 'pine-wood', 6);
  advanceAnimation(a, 1, { hurt: 'hurtCold' });
  assert.equal(a.clip, 'gather');
  assert.equal(a.pending.target, 'pine-wood');

  const b = createAnimator();
  advanceAnimation(b, 0.1, { hurt: 'walk' });
  assert.equal(b.clip, 'idle');
  advanceAnimation(b, 0.1, { hurt: 'nonsense' });
  assert.equal(b.clip, 'idle');
});

// Guards passing out: the sleeper stays down (no walking, no gathering) until woken, then gets
// up through the wake action, which finishes without naming a target, so nothing is awarded.
test('sleep lasts until woken, blocks actions, and waking plays once', () => {
  const a = createAnimator();
  startAction(a, 'gather', 'pine-wood', 6);
  startSleep(a);
  assert.equal(a.pending, null);
  assert.equal(advanceAnimation(a, 30, { moving: true, hurt: 'hurtCold' }), null);
  assert.equal(a.clip, 'sleep');
  assert.equal(startAction(a, 'gather', 'pine-wood'), false);

  assert.equal(wakeUp(a), true);
  assert.equal(wakeUp(a), false);
  assert.equal(a.clip, 'wake');
  assert.deepEqual(advanceAnimation(a, CLIPS.wake.frames / CLIPS.wake.fps, {}), {
    clip: 'wake',
    target: null,
  });
  assert.equal(a.clip, 'idle');
});

// Guards the rest nap: it ends by itself, so a rested player is never left lying down forever.
test('a timed nap ends by itself and the character gets up', () => {
  const a = createAnimator();
  startSleep(a, 2);
  advanceAnimation(a, 1.5, {});
  assert.equal(a.clip, 'sleep');
  advanceAnimation(a, 0.6, {});
  assert.equal(a.clip, 'wake');
  assert.equal(a.asleep, 0);
  assert.equal(wakeUp(createAnimator()), false);
});

// Guards the fall when health runs out: it uses the six-frame dying sheet, mirrors for west,
// plays through once and then stays on the lying-still picture (it must never loop back to
// standing), and lasts longer than the fall itself so that picture is seen.
test('the collapse plays its six frames once and holds the last one', () => {
  const length = CLIPS.collapse.frames / CLIPS.collapse.fps;
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 60].map(
      (i) => sampleAnimation('collapse', i / CLIPS.collapse.fps, 2).frame,
    ),
    [0, 1, 2, 3, 4, 5, 5, 5],
  );
  assert.equal(sampleAnimation('collapse', 0, 2).sheet, 'dying');
  assert.equal(sampleAnimation('collapse', 0, 2).flip, false);
  assert.equal(sampleAnimation('collapse', 0, 1).flip, true);
  assert.equal(CLIPS.collapse.once, true);
  assert.ok(COLLAPSE_SECONDS > length);
});

// Guards passing out: a collapse drops the gather in progress (nothing is awarded), can't be
// walked out of or restarted, and reports itself done exactly once so the player passes out once.
test('a collapse replaces the running action, cannot be cancelled, and finishes once', () => {
  const a = createAnimator();
  startAction(a, 'gather', 'pine-wood', 6);
  assert.equal(startCollapse(a), true);
  assert.equal(isCollapsing(a), true);
  assert.equal(a.pending.target, null);

  assert.equal(startCollapse(a), false);
  assert.equal(cancelAction(a), false);
  assert.equal(startAction(a, 'gather', 'pine-wood'), false);
  assert.equal(advanceAnimation(a, 1, { moving: true, hurt: 'hurtCold' }), null);
  assert.equal(a.clip, 'collapse');
  assert.equal(a.time, 1);

  assert.deepEqual(advanceAnimation(a, COLLAPSE_SECONDS - 1, {}), {
    clip: 'collapse',
    target: null,
  });
  assert.equal(isCollapsing(a), false);

  // The fallen character stays on the lying-still picture behind the pass-out screen.
  assert.equal(a.clip, 'collapse');
  assert.equal(sampleAnimation(a.clip, a.time, 2).frame, 5);
  assert.equal(advanceAnimation(a, 5, {}), null);
});

// Guards against the pause menu letting the fall finish (and the player pass out) behind it.
test('pause freezes a collapse', () => {
  const a = createAnimator();
  startCollapse(a);
  assert.equal(advanceAnimation(a, 10, { paused: true }), null);
  assert.equal(isCollapsing(a), true);
  assert.equal(a.time, 0);
});

// Guards the two-key directions: W+D must read as north-east, S+A as south-west and so on, and
// a single key (or none, or a broken number) must never be taken for a diagonal.
test('two movement keys name a diagonal and one key does not', () => {
  assert.equal(diagonalOf(1, -1), 'ne');
  assert.equal(diagonalOf(-1, -1), 'nw');
  assert.equal(diagonalOf(1, 1), 'se');
  assert.equal(diagonalOf(-1, 1), 'sw');
  assert.equal(diagonalOf(0.3, -4), 'ne');
  for (const [dx, dy] of [
    [1, 0],
    [0, -1],
    [0, 0],
    [NaN, 1],
  ])
    assert.equal(diagonalOf(dx, dy), null);
});

// Guards against a diagonal walk showing the wrong sheet or facing the wrong way: north and
// south diagonals have their own sheets, west ones mirror, and run keeps six frames and its hop.
test('diagonal walking and running use their own sheets and mirror for the west', () => {
  for (const [diagonal, half, flip] of [
    ['ne', 'NE', false],
    ['nw', 'NE', true],
    ['se', 'SE', false],
    ['sw', 'SE', true],
  ]) {
    const walk = sampleAnimation('walk', 0, 3, undefined, diagonal),
      run = sampleAnimation('run', 2 / CLIPS.run.fps, 0, undefined, diagonal);
    assert.deepEqual([walk.sheet, walk.row, walk.flip], ['walk' + half, 0, flip]);
    assert.deepEqual([run.sheet, run.row, run.flip, run.frame], ['run' + half, 0, flip, 2]);
    assert.ok(run.lift > 0);
    assert.equal(walk.lift, 0);
  }

  // Standing, actions and nonsense diagonals keep their usual pictures.
  assert.equal(sampleAnimation('idle', 0, 3, undefined, 'ne').sheet, 'idleLoop');
  assert.equal(sampleAnimation('gather', 0, 2, undefined, 'se').sheet, 'actions');
  assert.equal(sampleAnimation('walk', 0, 2, undefined, 'up').sheet, 'locomotion');
});

// Guards against a character who has stopped (or is gathering, or asleep) still being drawn
// with the diagonal walk from the last step.
test('the animator keeps a diagonal only while really moving', () => {
  const a = createAnimator();
  advanceAnimation(a, 0.1, { moving: true, diagonal: 'ne' });
  assert.equal(a.diagonal, 'ne');
  advanceAnimation(a, 0.1, { moving: true });
  assert.equal(a.diagonal, null);
  advanceAnimation(a, 0.1, { moving: true, diagonal: 'sw' });
  advanceAnimation(a, 0.1, { moving: false, diagonal: 'sw' });
  assert.equal(a.diagonal, null);
  advanceAnimation(a, 0.1, { moving: true, diagonal: 'sideways' });
  assert.equal(a.diagonal, null);
});
