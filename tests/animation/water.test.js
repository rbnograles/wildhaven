// Checks that the four-frame water effects fade between pictures without a flash at the loop seam.
// Rendering uses both pictures at once, so their opacity must stay low and add up to one steady value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waterBlend } from '../../src/animation/water.js';

// Halfway to the next picture, both frames should be visible instead of abruptly replacing one another.
test('water blends adjacent frames while keeping a restrained combined opacity', () => {
  const blend = waterBlend(0.5, 1, 0);
  assert.equal(blend.frame, 0);
  assert.equal(blend.next, 1);
  assert.ok(blend.alpha > 0 && blend.nextAlpha > 0);
  assert.ok(Math.abs(blend.alpha - blend.nextAlpha) < 1e-9);
  assert.ok(blend.alpha + blend.nextAlpha <= 0.25);
});

// The last picture fades into the first, with no opacity jump when the four-frame loop wraps.
test('water stays continuous through the last-to-first frame transition', () => {
  const before = waterBlend(4 - 1e-6, 1, 0);
  const after = waterBlend(4, 1, 0);
  assert.equal(before.frame, 3);
  assert.equal(before.next, 0);
  assert.equal(after.frame, 0);
  assert.ok(Math.abs(before.nextAlpha - after.alpha) < 1e-6);
  assert.ok(before.alpha < 1e-6);
});

// Different patches retain their separate start phases without changing their overall brightness.
test('water offsets stagger patches without brightening them', () => {
  for (const start of [0, 0.3, 1.7, 3.9]) {
    const blend = waterBlend(10, 1.5, start);
    assert.ok(blend.frame >= 0 && blend.frame < 4);
    assert.equal(blend.next, (blend.frame + 1) % 4);
    assert.ok(Math.abs(blend.alpha + blend.nextAlpha - 0.22) < 1e-9);
  }
});
