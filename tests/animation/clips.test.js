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
  sampleAnimation,
  steadyAnchors,
} from '../../src/animation/clips.js';
import { createGame, serializeGame } from '../../src/game/state.js';

// Guards against a clip going missing or being renamed, and against frame counts that no
// longer match the sprite sheets (which would show blank or wrong pictures).
test('all seven requested actions have distinct clip definitions', () => {
  assert.deepEqual(Object.keys(CLIPS), [
    'idle',
    'walk',
    'run',
    'gather',
    'build',
    'craft',
    'fight',
    'swim',
  ]);
  for (const name of ['walk', 'gather', 'build', 'craft', 'fight', 'swim'])
    assert.equal(CLIPS[name].frames, 4);
  assert.equal(CLIPS.run.frames, 6);
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
