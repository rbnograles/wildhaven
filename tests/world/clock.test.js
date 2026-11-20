// Checks the world clock: which day it is, which part of the day, and how dark it looks.
// Every survival rule reads these, so an off-by-one here would make night come early or never.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_SECONDS, PHASES, MIDDAY, START_TIME } from '../../src/data/balance.js';
import {
  dayOf,
  timeOfDay,
  phaseOf,
  darknessAt,
  NIGHT_DARK,
  nextDawn,
  nextMidday,
  clockLabel,
} from '../../src/world/clock.js';

/** True when two numbers are within a hair of each other. */
const near = (a, b) => Math.abs(a - b) < 1e-9;

// Guards the day the GDD asks for: 240 s of light (dawn, day, dusk), then 120 s of night.
test('a day is six minutes: dawn, day and dusk make four, night makes two', () => {
  assert.equal(DAY_SECONDS, 360);
  assert.deepEqual(PHASES, { dawn: 0, day: 20, dusk: 210, night: 240 });
  assert.equal(MIDDAY, 120);
  assert.equal(START_TIME, 20);
});

// Guards day counting from 1 and the time of day starting again at each dawn.
test('days count from 1 and the time of day starts again at each dawn', () => {
  assert.equal(dayOf(0), 1);
  assert.equal(dayOf(359.9), 1);
  assert.equal(dayOf(360), 2);
  assert.equal(timeOfDay(365), 5);
  assert.equal(timeOfDay(720 + 240), 240);
});

// Guards each phase boundary, on day 1 and on a later day.
test('each phase begins exactly at its boundary', () => {
  for (const start of [0, 3 * DAY_SECONDS]) {
    assert.equal(phaseOf(start), 'dawn');
    assert.equal(phaseOf(start + 19.99), 'dawn');
    assert.equal(phaseOf(start + 20), 'day');
    assert.equal(phaseOf(start + 209.99), 'day');
    assert.equal(phaseOf(start + 210), 'dusk');
    assert.equal(phaseOf(start + 239.99), 'dusk');
    assert.equal(phaseOf(start + 240), 'night');
    assert.equal(phaseOf(start + 359.99), 'night');
  }
});

// Guards the drawing curve: clear by day, deepening through dusk into night, lifting at dawn.
test('darkness is 0 by day, 0.5 at nightfall, nearly black after ten seconds of night, and lifts at dawn', () => {
  assert.equal(darknessAt(100), 0);
  assert.equal(darknessAt(210), 0);
  assert.ok(near(darknessAt(225), 0.25));
  assert.ok(near(darknessAt(240), 0.5));
  assert.ok(near(darknessAt(245), 0.72));
  assert.equal(darknessAt(250), NIGHT_DARK);
  assert.equal(darknessAt(359), NIGHT_DARK);
  assert.equal(darknessAt(360), NIGHT_DARK);
  assert.ok(near(darknessAt(370), NIGHT_DARK / 2));
  assert.equal(darknessAt(380), 0);
  // The night must stay "super dark" but never fully black, or the world would vanish.
  assert.ok(NIGHT_DARK >= 0.9 && NIGHT_DARK < 1);
});

// Guards the two clock jumps: resting skips to the next dawn, passing out to the next midday.
test('next dawn and next midday always lie ahead', () => {
  assert.equal(nextDawn(20), 360);
  assert.equal(nextDawn(300), 360);
  assert.equal(nextDawn(360), 720);
  assert.equal(nextMidday(20), 120);
  assert.equal(nextMidday(120), 480);
  assert.equal(nextMidday(300), 480);
});

// Guards the HUD's clock words, so morning and afternoon are told apart.
test('the clock label names the day and the part of the day', () => {
  assert.equal(clockLabel(20), 'Day 1 · Morning');
  assert.equal(clockLabel(130), 'Day 1 · Afternoon');
  assert.equal(clockLabel(215), 'Day 1 · Dusk');
  assert.equal(clockLabel(300), 'Day 1 · Night');
  assert.equal(clockLabel(365), 'Day 2 · Dawn');
});
