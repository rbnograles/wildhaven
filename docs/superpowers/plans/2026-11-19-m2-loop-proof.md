# M2 Loop Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GDD's M2 loop playable: day and night, warmth/hunger/health, campfires that found named camps, a needs list that points outward, passing out, fog of war by walked area, herbal tea and healing, and slow regrowth.

**Architecture:** Every rule is a pure module (`src/data`, `src/world`, `src/actions`, `src/game`) tested with `node --test`. The browser layer stays thin: `core/loop.js` calls `tickSurvival` each frame and routes its events to the HUD; `ui/camp.js` holds the camp, name and pass-out dialogs; `core/build.js` drives the build ghost; `render/lighting.js` and `render/maps.js` split drawing out of `renderer.js`. Spec: `docs/superpowers/specs/2026-11-19-m2-loop-proof-design.md`.

**Tech Stack:** Vanilla JS ES modules, Vite 7, Phaser 4.2 (renderer only), HTML/CSS dialogs, `node:test`, Prettier 3.

## Global Constraints

- **Repo code style (CLAUDE.md, enforced by tests):** every named function, method, class and `const name = (...) =>` has a `/** ... */` (or `//`) comment on the line directly above it, written in plain beginner words with `@param`/`@returns`. Object properties holding arrow functions need a `//` line above each. Each file opens with a 2-4 line `//` header. Each `test(...)` has a `//` line above it saying what it guards. Run `npm run format` after editing; `npm run format:check` must pass.
- **Pure modules** (`src/data/`, `src/world/`, `src/actions/`, `src/game/`, `src/animation/clips.js`) must not import `ui/`, `core/`, `render/`, images or CSS, and must not contain the words `document`, `window` or `import.meta` anywhere, comments included (`tests/boundaries.test.js`).
- **Balance numbers live only in `src/data/balance.js`.** Actions import them.
- **No Phaser Arcade Physics.** Collision stays in `src/world/map.js`, movement in `src/actions/move.js`, input in `src/core/input.js`, UI in HTML/DOM.
- **Work in a git worktree on branch `m2-loop-proof`** (superpowers:using-git-worktrees). Another session is writing the archipelago design in the main checkout. Commit only with explicit pathspecs (`git commit -m ... -- <paths>`). Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Save version.** Before Task 3, check `src/game/state.js` on `main`. If the archipelago A1 work already writes `version: 4`, use `SAVE_VERSION = 5` and add an `upgradeV4` step that fills the same M2 defaults as `upgradeV3` (and rebuilds the fog if its length changed). The code below assumes A1 has not landed.
- **The fog grid size is derived from `WORLD`** (`ceil(width / FOG_CELL)` × `ceil(height / FOG_CELL)`); never hardcode 96 × 64.
- **Browser checks** use the `wildhaven` launch config at `http://127.0.0.1:5173` (never `localhost`, which holds the user's own saves).
- **Exact numbers from the spec:** day 360 s (dawn 0, day 20, dusk 210, night 240, midday 120), start time 20, warmth 60 s, freeze 30 s, hunger 720 s, warm by fire +20/s, by day +4/s, heal by fire +2/s, starving cold ×1.5, food +25, heal 3 herbs → +30, tea 5 herbs → 20 s, wake health 50, campfire 3 wood + 2 stone, fire radius 260 + 40 per need (max 10), place range 300, camp spacing 3000, camp reach 140, node clearance 80, wake offset 90, need amounts wood 4 / stone 3 / food 2 / herbs 4, supply regrow 720 s, fog cell 256, fog radius 1000, camp names 1-24 characters, at most 50 camps.

## File Map

| File | New? | Responsibility |
| --- | --- | --- |
| `src/data/balance.js` | modify | All M2 numbers |
| `src/world/clock.js` | new | Day number, phase, darkness, next dawn/midday, clock words |
| `src/world/fog.js` | new | Fog grid, pack/unpack, reveal, region reveal |
| `src/world/nodes.js` | modify | `isAvailable` (moved here), `goneSupplies` |
| `src/data/supplies.js` | modify | Supplies regrow after `SUPPLY_REGROW` |
| `src/actions/gather.js` | modify | Regrowth on `state.time`; re-export `isAvailable` |
| `src/actions/move.js` | modify | Bases = standing supplies + camp fires |
| `src/game/state.js` | modify | Save version 4, validation, v3 upgrade |
| `src/world/camps.js` | new | Fire radius, nearest camp, by-fire, reach, bases, names |
| `src/world/needs.js` | new | Make, meet, mark, refresh and describe needs |
| `src/actions/build.js` | new | Placement check, place, name |
| `src/actions/survive.js` | new | `tickSurvival`, `skipTo`, `startDay`, `meterTrends` |
| `src/actions/camp.js` | new | Give, eat, heal, tea, rest, pass out |
| `src/render/maps.js` | new | Minimap and world map with fog and camps |
| `src/render/lighting.js` | new | Night layer with fire light |
| `src/render/renderer.js` | modify | Uses maps.js and lighting.js; fire sprites; build ghost; `screenToWorld` |
| `src/core/build.js` | new | Build mode: toggle, ghost position, place |
| `src/ui/camp.js` | new | Name, camp and pass-out dialogs; eat/heal from keys |
| `src/ui/hud.js` | modify | Clock, meters, goals card, region progress, interact, build bar, `describeEvent` |
| `src/ui/layout.js` | modify | New markup and icons |
| `src/ui/dialogs.js` | modify | New dialogs pause the game; region labels follow discovery |
| `src/core/loop.js` | modify | Survival tick, events, finds → needs, fog, pass-out |
| `src/core/input.js` | modify | B, F, H, E/click in build mode, Escape in build mode, pointer |
| `src/core/session.js` | modify | `build` and `pointer` fields; resets |
| `src/main.js` | modify | Wire `ui.camp` and `ui.build` |
| `src/style.css` | modify | Meters, clock, build bar, camp dialogs |
| `tests/world/clock.test.js`, `tests/world/fog.test.js`, `tests/world/camps.test.js`, `tests/world/needs.test.js`, `tests/actions/build.test.js`, `tests/actions/survive.test.js`, `tests/actions/camp.test.js` | new | Unit tests |
| `tests/game/state.test.js`, `tests/actions/gather.test.js`, `tests/world/nodes.test.js` | modify | Version 4 and regrowth |
| `docs/gdd.md`, `CLAUDE.md`, `docs/verification.md`, `README.md` | modify | Docs |

---

### Task 1: Balance numbers and the world clock

**Files:**
- Modify: `src/data/balance.js` (append)
- Create: `src/world/clock.js`
- Test: `tests/world/clock.test.js`

**Interfaces:**
- Produces (balance): `DAY_SECONDS`, `PHASES`, `MIDDAY`, `START_TIME`, `WARMTH_SECONDS`, `STARVING_COLD`, `WARM_BY_FIRE`, `WARM_BY_DAY`, `FREEZE_SECONDS`, `HEAL_BY_FIRE`, `HUNGER_SECONDS`, `FOOD_HUNGER`, `HEAL_HERBS`, `HEAL_HEALTH`, `TEA_HERBS`, `TEA_SECONDS`, `WAKE_HEALTH`, `WAKE_OFFSET`, `CAMPFIRE_COST`, `FIRE_RADIUS`, `FIRE_GROWTH`, `MAX_GROWN`, `PLACE_RANGE`, `CAMP_SPACING`, `CAMP_REACH`, `NODE_CLEARANCE`, `NEED_AMOUNTS`, `CAMP_NAME_MAX`, `MAX_CAMPS`, `SUPPLY_REGROW`, `FOG_CELL`, `FOG_RADIUS`.
- Produces (clock): `dayOf(time): number`, `timeOfDay(time): number`, `phaseOf(time): 'dawn'|'day'|'dusk'|'night'`, `darknessAt(time): number`, `nextDawn(time): number`, `nextMidday(time): number`, `clockLabel(time): string`.

- [ ] **Step 1: Write the failing test** — create `tests/world/clock.test.js`:

```js
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
test('darkness is 0 by day, 0.35 at nightfall, 0.6 after ten seconds of night, and lifts at dawn', () => {
  assert.equal(darknessAt(100), 0);
  assert.equal(darknessAt(210), 0);
  assert.ok(near(darknessAt(225), 0.175));
  assert.ok(near(darknessAt(240), 0.35));
  assert.ok(near(darknessAt(245), 0.475));
  assert.equal(darknessAt(250), 0.6);
  assert.equal(darknessAt(359), 0.6);
  assert.equal(darknessAt(360), 0.6);
  assert.ok(near(darknessAt(370), 0.3));
  assert.equal(darknessAt(380), 0);
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/world/clock.test.js`
Expected: FAIL (`Cannot find module .../src/world/clock.js` or missing exports from balance.js).

- [ ] **Step 3: Append the M2 numbers to `src/data/balance.js`**

Add at the end of the file:

```js
// ---- Day and night (M2) ----

/** One in-game day in game seconds: dawn, day and dusk give 240 s of light, then 120 s of night. */
export const DAY_SECONDS = 360;

/** When each part of the day starts, in seconds after dawn. Night lasts until the next dawn. */
export const PHASES = { dawn: 0, day: 20, dusk: 210, night: 240 };

/** Seconds after dawn that count as midday. A player who passes out wakes then. */
export const MIDDAY = 120;

/** The clock reading a brand-new game starts at: the morning of day 1, just after dawn. */
export const START_TIME = 20;

// ---- Survival meters (each runs from 0 to 100) ----

/** Seconds of night away from a fire it takes full warmth to drain to nothing. */
export const WARMTH_SECONDS = 60;

/** How many times faster the cold drains warmth when hunger is empty. */
export const STARVING_COLD = 1.5;

/** Warmth gained per second beside a fire, at any hour. */
export const WARM_BY_FIRE = 20;

/** Warmth gained per second away from a fire during dawn and day. */
export const WARM_BY_DAY = 4;

/** Seconds of freezing (no warmth left, at night, away from a fire) it takes to drain full health. */
export const FREEZE_SECONDS = 30;

/** Health healed per second beside a fire while not starving. */
export const HEAL_BY_FIRE = 2;

/** Seconds it takes a full stomach to empty: two in-game days. */
export const HUNGER_SECONDS = 720;

// ---- Eating, healing and tea ----

/** Hunger one food restores. */
export const FOOD_HUNGER = 25;

/** Herbs one heal uses, and the health it restores. */
export const HEAL_HERBS = 3;
export const HEAL_HEALTH = 30;

/** Herbs one cup of tea uses, and the seconds of cold it holds off. One cup at a time. */
export const TEA_HERBS = 5;
export const TEA_SECONDS = 20;

/** Health the player has on waking up after passing out. */
export const WAKE_HEALTH = 50;

/** How far from a fire the player wakes after passing out, in world units. */
export const WAKE_OFFSET = 90;

// ---- Campfires and camps ----

/** What one campfire costs. Paid only when the fire is really placed. */
export const CAMPFIRE_COST = { wood: 3, stone: 2 };

/** How far a new fire's warmth reaches, and how much each met need adds, in world units. */
export const FIRE_RADIUS = 260;
export const FIRE_GROWTH = 40;

/** The most needs that can grow one fire (so the warmth reaches at most 260 + 10 × 40 = 660). */
export const MAX_GROWN = 10;

/** How far from the player a campfire may be placed. */
export const PLACE_RANGE = 300;

/** How far apart two camps must be: "a meaningful walk". */
export const CAMP_SPACING = 3000;

/** How close to one of their fires the player must stand to open its camp. */
export const CAMP_REACH = 140;

/** How close to a new fire any supply or flower patch may be. */
export const NODE_CLEARANCE = 80;

/** What a "bring" need asks for at first; each two needs met add one more. */
export const NEED_AMOUNTS = { wood: 4, stone: 3, food: 2, herbs: 4 };

// Limits that keep saves small and tidy: the longest camp name, and the most camps one save may hold.
export const CAMP_NAME_MAX = 24;
export const MAX_CAMPS = 50;

// ---- Regrowth and fog ----

/** Game seconds before a gathered supply (tree, stones, berries) grows back: two in-game days. */
export const SUPPLY_REGROW = 720;

/** The fog of war's square size, and how far around the player the fog lifts, in world units. */
export const FOG_CELL = 256;
export const FOG_RADIUS = 1000;
```

- [ ] **Step 4: Create `src/world/clock.js`**

```js
// The world clock: turns `state.time` (game seconds since the dawn of day 1) into a day number,
// a part of the day and how dark the world looks. Like reading a wall clock, it only reads the
// time; it never changes the game.

import { DAY_SECONDS, PHASES, MIDDAY } from '../data/balance.js';

// How dark the world is drawn (0 clear, 1 black) at nightfall and in full night, and how many
// seconds into the night it takes to go from one to the other. These only change the drawing.
const DUSK_DARK = 0.35,
  NIGHT_DARK = 0.6,
  NIGHTFALL = 10;

// The words the HUD clock uses for each part of the day. The day itself is split at midday.
const PHASE_WORDS = {
  dawn: 'Dawn',
  morning: 'Morning',
  afternoon: 'Afternoon',
  dusk: 'Dusk',
  night: 'Night',
};

/**
 * Says which day it is, counting the first day as day 1.
 *
 * @param {number} time - The world clock, in game seconds since the dawn of day 1.
 * @returns {number} The day number.
 */
export const dayOf = (time) => Math.floor(time / DAY_SECONDS) + 1;

/**
 * Says how many seconds have passed since this day's dawn.
 *
 * @param {number} time - The world clock.
 * @returns {number} Seconds since dawn, from 0 up to (not including) one whole day.
 */
export const timeOfDay = (time) => time - (dayOf(time) - 1) * DAY_SECONDS;

/**
 * Names the part of the day it is.
 *
 * The day is cut into four slices, like a pie: dawn, day, dusk and night.
 *
 * @param {number} time - The world clock.
 * @returns {'dawn'|'day'|'dusk'|'night'} The part of the day.
 */
export function phaseOf(time) {
  const t = timeOfDay(time);
  if (t >= PHASES.night) return 'night';
  if (t >= PHASES.dusk) return 'dusk';
  if (t >= PHASES.day) return 'day';
  return 'dawn';
}

/**
 * Says how dark the world should be drawn, from 0 (clear) to 0.6 (deep night).
 *
 * Like a dimmer switch turned slowly: the light fades through dusk, keeps fading for the first
 * seconds of night, holds, and comes back across dawn.
 *
 * @param {number} time - The world clock.
 * @returns {number} How dark to draw the world.
 */
export function darknessAt(time) {
  const t = timeOfDay(time);
  if (t < PHASES.day) return NIGHT_DARK * (1 - t / PHASES.day);
  if (t < PHASES.dusk) return 0;
  if (t < PHASES.night) return DUSK_DARK * ((t - PHASES.dusk) / (PHASES.night - PHASES.dusk));
  return Math.min(
    NIGHT_DARK,
    DUSK_DARK + (NIGHT_DARK - DUSK_DARK) * ((t - PHASES.night) / NIGHTFALL),
  );
}

/**
 * Finds the clock reading at the next dawn: the start of tomorrow.
 *
 * @param {number} time - The world clock.
 * @returns {number} The world clock at the next dawn.
 */
export const nextDawn = (time) => dayOf(time) * DAY_SECONDS;

/**
 * Finds the next midday that is still ahead.
 *
 * @param {number} time - The world clock.
 * @returns {number} The world clock at today's midday if it hasn't come yet, else tomorrow's.
 */
export function nextMidday(time) {
  const today = (dayOf(time) - 1) * DAY_SECONDS + MIDDAY;
  return today > time ? today : today + DAY_SECONDS;
}

/**
 * Writes the clock as words for the HUD, such as "Day 2 · Dusk".
 *
 * @param {number} time - The world clock.
 * @returns {string} The day number and the part of the day.
 */
export function clockLabel(time) {
  const phase = phaseOf(time);
  const part = phase !== 'day' ? phase : timeOfDay(time) < MIDDAY ? 'morning' : 'afternoon';
  return `Day ${dayOf(time)} · ${PHASE_WORDS[part]}`;
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world/clock.test.js` → PASS. Then `npm test` → all pass (the comment and boundary tests now include `clock.js`).

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/data/balance.js src/world/clock.js tests/world/clock.test.js
git commit -m "Add the world clock and the M2 balance numbers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/data/balance.js src/world/clock.js tests/world/clock.test.js
```

---

### Task 2: Fog of war module

**Files:**
- Create: `src/world/fog.js`
- Test: `tests/world/fog.test.js`

**Interfaces:**
- Consumes: `FOG_CELL`, `FOG_RADIUS` (Task 1); `WORLD` from `world/map.js`; `regionOf` from `world/regions.js`.
- Produces: `FOG_GRID: {cols, rows}`, `FOG_LENGTH: number`, `emptyFog(): string`, `isFogString(value): boolean`, `fogCells(fog): Uint8Array` (read-only, cached), `isRevealed(state, x, y): boolean`, `revealAround(state, x, y, radius = FOG_RADIUS): boolean` (true when something new was uncovered; replaces `state.fog`), `revealRegions(state, regionIds): void`. `state` only needs a `fog` string.

- [ ] **Step 1: Write the failing test** — create `tests/world/fog.test.js`:

```js
// Checks the fog of war: which squares of the world a character has seen, and how that is packed
// into the save. A mistake here would hide places the player walked through, or reveal the whole
// map for free (which works against the GDD's first pillar, "the world is the reward").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOG_CELL, FOG_RADIUS } from '../../src/data/balance.js';
import { WORLD } from '../../src/world/map.js';
import { REGIONS } from '../../src/world/regions.js';
import {
  FOG_GRID,
  FOG_LENGTH,
  emptyFog,
  isFogString,
  fogCells,
  isRevealed,
  revealAround,
  revealRegions,
} from '../../src/world/fog.js';

/** A tiny stand-in for a game state that only has the fog field. */
const blank = () => ({ fog: emptyFog() });

// Guards the grid following the map, so a bigger map gets a bigger fog grid by itself.
test('the fog grid covers the whole world, four squares per letter', () => {
  assert.equal(FOG_GRID.cols, Math.ceil(WORLD.width / FOG_CELL));
  assert.equal(FOG_GRID.rows, Math.ceil(WORLD.height / FOG_CELL));
  assert.equal(FOG_LENGTH, Math.ceil((FOG_GRID.cols * FOG_GRID.rows) / 4));
  assert.ok(isFogString(emptyFog()));
  assert.equal(fogCells(emptyFog()).some((seen) => seen), false);
});

// Guards the save check: fog of the wrong length or with odd letters must be refused.
test('only a hex string of the exact length counts as fog', () => {
  assert.equal(isFogString('0'.repeat(FOG_LENGTH - 1)), false);
  assert.equal(isFogString('g' + '0'.repeat(FOG_LENGTH - 1)), false);
  assert.equal(isFogString(null), false);
  assert.equal(isFogString('f'.repeat(FOG_LENGTH)), true);
});

// Guards the reveal circle: the square underfoot and squares inside the radius are seen; squares
// well outside it are not, and revealing the same spot twice uncovers nothing new.
test('walking reveals the squares within the fog radius and no others', () => {
  const state = blank(),
    x = 5000,
    y = 5000;
  assert.equal(revealAround(state, x, y), true);
  assert.ok(isRevealed(state, x, y));
  assert.ok(isRevealed(state, x + FOG_RADIUS - FOG_CELL, y));
  assert.equal(isRevealed(state, x + FOG_RADIUS + 2 * FOG_CELL, y), false);
  assert.equal(isRevealed(state, x, y - FOG_RADIUS - 2 * FOG_CELL), false);
  assert.equal(revealAround(state, x, y), false);
});

// Guards the packing: each letter holds four squares, lowest bit first, in reading order.
test('each fog letter holds four squares, lowest bit first', () => {
  const cells = fogCells('9' + '0'.repeat(FOG_LENGTH - 1)); // 9 is binary 1001
  assert.deepEqual([...cells.slice(0, 5)], [1, 0, 0, 1, 0]);

  const state = blank();
  revealAround(state, FOG_CELL / 2, FOG_CELL / 2, 1); // only the very first square
  assert.equal(state.fog[0], '1');
  assert.equal(state.fog.slice(1), '0'.repeat(FOG_LENGTH - 1));
});

// Guards the save upgrade: an old save's regions are uncovered in full, and only those.
test('revealing regions uncovers every square whose middle lies in them', () => {
  const state = blank(),
    [first, second] = REGIONS;
  revealRegions(state, [first.id]);
  assert.ok(isRevealed(state, first.x, first.y));
  assert.equal(isRevealed(state, second.x, second.y), false);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/world/fog.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/world/fog.js`**

```js
// The fog of war: which parts of the world this character has seen. The world is cut into
// squares FOG_CELL units wide, and each square is either seen or not, like a scratch card whose
// silver comes off where you have walked. The save keeps the squares as hex letters, four per letter.

import { FOG_CELL, FOG_RADIUS } from '../data/balance.js';
import { WORLD } from './map.js';
import { regionOf } from './regions.js';

/** How many fog squares fit across (`cols`) and down (`rows`) the world. It grows with the map. */
export const FOG_GRID = {
  cols: Math.ceil(WORLD.width / FOG_CELL),
  rows: Math.ceil(WORLD.height / FOG_CELL),
};

/** How many hex letters a fog string has: one letter holds four squares. */
export const FOG_LENGTH = Math.ceil((FOG_GRID.cols * FOG_GRID.rows) / 4);

/**
 * Makes the fog for a brand-new game: nothing seen yet.
 *
 * @returns {string} A fog string of all zeros.
 */
export const emptyFog = () => '0'.repeat(FOG_LENGTH);

/**
 * Checks that a saved value really is fog: a string of the right length, made only of hex letters.
 *
 * @param {*} fog - The value read from a save.
 * @returns {boolean} True if it can be used as fog.
 */
export const isFogString = (fog) =>
  typeof fog === 'string' && fog.length === FOG_LENGTH && /^[0-9a-f]*$/.test(fog);

// Unpacking the letters on every frame would be slow, so the last fog string unpacked is kept
// with its squares, like keeping a book open at the page you last read.
let last = { fog: '', cells: new Uint8Array(0) };

/**
 * Unpacks a fog string into one number per square: 1 for seen, 0 for not yet.
 *
 * Squares are numbered row by row from the top-left. Letter n holds squares 4n to 4n + 3, and
 * the lowest bit of the letter is the first of them.
 *
 * @param {string} fog - A fog string.
 * @returns {Uint8Array} One entry per square. Only read it: it is shared with later calls.
 */
export function fogCells(fog) {
  if (last.fog === fog) return last.cells;
  const cells = new Uint8Array(FOG_GRID.cols * FOG_GRID.rows);
  for (let i = 0; i < cells.length; i++) cells[i] = (parseInt(fog[i >> 2], 16) >> (i & 3)) & 1;
  last = { fog, cells };
  return cells;
}

/**
 * Packs one number per square back into a fog string (the opposite of `fogCells`).
 *
 * @param {Uint8Array} cells - 1 for each seen square, 0 for the rest.
 * @returns {string} The fog string.
 */
function packFog(cells) {
  let fog = '';
  for (let i = 0; i < FOG_LENGTH; i++) {
    let letter = 0;
    for (let bit = 0; bit < 4; bit++) letter |= (cells[i * 4 + bit] ?? 0) << bit;
    fog += letter.toString(16);
  }
  return fog;
}

/**
 * Finds the number of the fog square a world spot falls in.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} The square's number, or -1 if the spot is outside the world.
 */
function cellAt(x, y) {
  const cx = Math.floor(x / FOG_CELL),
    cy = Math.floor(y / FOG_CELL);
  if (cx < 0 || cy < 0 || cx >= FOG_GRID.cols || cy >= FOG_GRID.rows) return -1;
  return cy * FOG_GRID.cols + cx;
}

/**
 * Says whether the player has seen the square a spot is in.
 *
 * @param {object} state - Anything with a `fog` string, usually the game state.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if that square has been seen.
 */
export function isRevealed(state, x, y) {
  const i = cellAt(x, y);
  return i >= 0 && fogCells(state.fog)[i] === 1;
}

/**
 * Uncovers every square whose middle is within `radius` of a spot.
 *
 * The game loop calls this every frame with the player's position. Most frames uncover nothing
 * new, and then the fog string is left alone, so it stays cheap.
 *
 * @param {object} state - Anything with a `fog` string. Its `fog` is replaced when squares are uncovered.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {number} [radius=FOG_RADIUS] - How far around the spot to uncover, in world units.
 * @returns {boolean} True if any square was newly uncovered.
 */
export function revealAround(state, x, y, radius = FOG_RADIUS) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const cells = fogCells(state.fog);
  let next = null;

  // Only squares inside the circle's bounding box can be inside the circle.
  const c0 = Math.max(0, Math.floor((x - radius) / FOG_CELL)),
    c1 = Math.min(FOG_GRID.cols - 1, Math.floor((x + radius) / FOG_CELL)),
    r0 = Math.max(0, Math.floor((y - radius) / FOG_CELL)),
    r1 = Math.min(FOG_GRID.rows - 1, Math.floor((y + radius) / FOG_CELL));
  for (let cy = r0; cy <= r1; cy++)
    for (let cx = c0; cx <= c1; cx++) {
      const i = cy * FOG_GRID.cols + cx;
      const away = Math.hypot((cx + 0.5) * FOG_CELL - x, (cy + 0.5) * FOG_CELL - y);
      if (cells[i] || away > radius) continue;
      next ??= cells.slice();
      next[i] = 1;
    }

  if (!next) return false;
  state.fog = packFog(next);
  last = { fog: state.fog, cells: next };
  return true;
}

/**
 * Uncovers every square whose middle lies in one of the given regions.
 *
 * Used when an old save is upgraded: it knew which regions were visited, not where the player walked.
 *
 * @param {object} state - Anything with a `fog` string. Its `fog` is replaced.
 * @param {string[]} regionIds - The ids of the regions to uncover.
 */
export function revealRegions(state, regionIds) {
  const cells = fogCells(state.fog).slice();
  for (let cy = 0; cy < FOG_GRID.rows; cy++)
    for (let cx = 0; cx < FOG_GRID.cols; cx++)
      if (regionIds.includes(regionOf((cx + 0.5) * FOG_CELL, (cy + 0.5) * FOG_CELL).id))
        cells[cy * FOG_GRID.cols + cx] = 1;
  state.fog = packFog(cells);
  last = { fog: state.fog, cells };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/world/fog.test.js` → PASS. Then `npm test` → all pass.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/world/fog.js tests/world/fog.test.js
git commit -m "Add the fog of war grid with walked-area reveal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/world/fog.js tests/world/fog.test.js
```

---

### Task 3: Regrowing supplies and save version 4

**Files:**
- Modify: `src/data/supplies.js`, `src/world/nodes.js`, `src/actions/gather.js`, `src/actions/move.js`, `src/game/state.js`, `src/core/loop.js:75`
- Test: rewrite `tests/game/state.test.js`; modify `tests/actions/gather.test.js`, `tests/world/nodes.test.js`

**Interfaces:**
- Consumes: Task 1 constants; Task 2 `emptyFog`, `isFogString`, `revealAround`, `revealRegions`.
- Produces: `SAVE_VERSION` (4); state fields `time`, `meters: {health, hunger, warmth}`, `tea`, `camps`, `fog` (no `collected`); `isAvailable(state, node)` and `goneSupplies(state): string[]` exported from `world/nodes.js` (`isAvailable` still re-exported by `actions/gather.js`); every supply has `regrow: SUPPLY_REGROW`. Camp shape `{id: 'camp-<n>', name, x, y, grown, needs: [need, need, need]}`; need shapes `{kind: 'bring', resource, amount, done}`, `{kind: 'place', region, done}`, `{kind: 'signpost', done}`.

- [ ] **Step 1: Rewrite `tests/game/state.test.js` (failing)**

```js
// Checks the game state: how a new game starts, how a save is turned back into a game, and how
// an older save is upgraded. Loading is strict on purpose. A broken or tampered save must be
// refused, not half-loaded, so the player never ends up stuck in a wall or holding impossible
// amounts of supplies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { START_TIME, SUPPLY_REGROW, TEA_SECONDS } from '../../src/data/balance.js';
import { isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases } from '../../src/world/nodes.js';
import { REGIONS } from '../../src/world/regions.js';
import { isRevealed } from '../../src/world/fog.js';
import { SAVE_VERSION, createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

/** The wild flower patches: map scenery that can be picked and grows back quickly. */
const wild = NODES.filter((n) => n.id.startsWith('flowers-'));

/**
 * Makes a valid camp standing where the player stands, for tests that put camps in a save.
 *
 * @param {object} game - A game made with createGame.
 * @returns {object} A camp with an id, a name, a spot, no growth and three open needs.
 */
const campAt = (game) => ({
  id: 'camp-1',
  name: 'Test Camp',
  x: game.player.x,
  y: game.player.y,
  grown: 0,
  needs: [
    { kind: 'bring', resource: 'stone', amount: 3, done: false },
    { kind: 'place', region: 'frostpeak', done: false },
    { kind: 'signpost', done: false },
  ],
});

/**
 * Writes a version 3 save the way the old code did, for the upgrade tests.
 *
 * @param {object} [changes={}] - Fields to set on top of a fresh scout's version 3 save.
 * @returns {string} The save as JSON text.
 */
function v3Save(changes = {}) {
  const game = createGame('scout');
  return JSON.stringify({
    version: 3,
    character: game.character,
    player: game.player,
    resources: game.resources,
    collected: [],
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    elapsed: 0,
    distance: 0,
    ...changes,
  });
}

// Guards against two characters sharing a start spot, a start spot inside water, a tree or a
// supply's solid base, and against a typo'd character id quietly making a game.
test('all characters begin at distinct, walkable locations with their own identity', () => {
  const games = CHARACTERS.map((c) => createGame(c.id));
  assert.equal(new Set(games.map((g) => `${g.player.x},${g.player.y}`)).size, 3);

  for (const [i, game] of games.entries()) {
    assert.equal(game.character, CHARACTERS[i].id);
    assert.ok(isWalkable(game.player.x, game.player.y));
    assert.ok(isWalkable(game.player.x, game.player.y, nodeBases([])));
  }

  assert.throws(() => createGame('unknown'));
});

// Guards the starting conditions the first-night design relies on: a morning start, full meters,
// no camps yet, and the fog lifted only around the spawn.
test('a new game starts on the morning of day 1 with full meters and the fog lifted around the spawn', () => {
  const game = createGame('scout');
  assert.equal(game.version, SAVE_VERSION);
  assert.equal(game.time, START_TIME);
  assert.deepEqual(game.meters, { health: 100, hunger: 100, warmth: 100 });
  assert.equal(game.tea, 0);
  assert.deepEqual(game.camps, []);
  assert.equal(game.collected, undefined);
  assert.ok(isRevealed(game, game.player.x, game.player.y));
  assert.equal(isRevealed(game, game.player.x + 5000, game.player.y + 5000), false);
});

// Guards against a save losing a field on the way back in, and against the loaded game sharing
// objects with the original (so changing one would secretly change the other).
test('save restores character, coordinates and progress without sharing mutable objects', () => {
  const original = createGame('builder');
  movePlayer(original, 1, 0, 0.1);
  original.resources.wood = 9;
  original.resources.herbs = 4;
  original.regrowAt[wild[0].id] = 42;
  original.landmarks.push('h-square');
  original.waypoints.push('h-wp-village');
  original.discovered.push('meadows');
  original.time = 1000;
  original.meters.warmth = 12.5;
  original.tea = 7;
  original.camps.push(campAt(original));

  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored, original);

  restored.resources.wood++;
  restored.camps[0].needs[0].done = true;
  assert.equal(original.resources.wood, 9);
  assert.equal(original.camps[0].needs[0].done, false);
});

// Guards the strict loader: each broken save below must be refused.
test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);

  for (const edit of [
    (g) => (g.version = 100),
    (g) => (g.version = 2),
    (g) => (g.version = 3), // a version 3 label on a save with no `collected` list
    (g) => (g.landmarks = ['nowhere']),
    (g) => (g.landmarks = ['h-oak', 'h-oak']),
    (g) => (g.waypoints = undefined),
    (g) => (g.waypoints = ['h-oak']),
    (g) => (g.discovered = ['scout']),
    (g) => (g.character = 'ghost'),
    (g) => (g.player.x = -100),
    (g) => (g.resources.wood = -5),
    (g) => (g.player.y = null),
    (g) => (g.resources.herbs = 1.5),
    (g) => (g.regrowAt = []),
    (g) => (g.regrowAt = { [wild[0].id]: -1 }),
    (g) => (g.time = -1),
    (g) => (g.time = undefined),
    (g) => (g.meters.health = 101),
    (g) => (g.meters.hunger = -1),
    (g) => (g.meters = undefined),
    (g) => (g.tea = TEA_SECONDS + 1),
    (g) => (g.fog = g.fog.slice(1)),
    (g) => (g.fog = 'x' + g.fog.slice(1)),
    (g) => (g.camps = {}),
    (g) => g.camps.push({ ...campAt(g), id: 'tent' }),
    (g) => g.camps.push({ ...campAt(g), name: '' }),
    (g) => g.camps.push({ ...campAt(g), name: ' Padded ' }),
    (g) => g.camps.push({ ...campAt(g), name: 'x'.repeat(25) }),
    (g) => g.camps.push({ ...campAt(g), x: -100 }),
    (g) => g.camps.push({ ...campAt(g), grown: 11 }),
    (g) => g.camps.push({ ...campAt(g), needs: [] }),
    (g) =>
      g.camps.push({
        ...campAt(g),
        needs: [{ kind: 'bring', resource: 'gold', amount: 3, done: false }, ...campAt(g).needs.slice(1)],
      }),
    (g) =>
      g.camps.push({
        ...campAt(g),
        needs: [{ kind: 'place', region: 'moon', done: false }, ...campAt(g).needs.slice(1)],
      }),
    (g) => g.camps.push(campAt(g), campAt(g)), // the same id twice
  ]) {
    const game = createGame('survivor');
    edit(game);
    assert.equal(restoreGame(JSON.stringify(game)), null);
  }
});

// Guards regrow timers on load: a normal timer is kept, a timer set absurdly far ahead is cut
// down to one regrow time, and a timer for a patch the map no longer has is dropped.
test('saved regrowth timers are kept, capped at one regrow, or dropped when the patch is gone', () => {
  const game = createGame('scout'),
    [a, b] = wild;
  game.time = 100;
  game.regrowAt = { [a.id]: 150, [b.id]: 1e9, 'flowers-1-1': 120, 'pine-wood': 1e9 };

  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, {
    [a.id]: 150,
    [b.id]: 100 + b.regrow,
    'pine-wood': 100 + SUPPLY_REGROW,
  });
});

// Guards players' old saves: version 3 progress must survive the upgrade instead of being wiped.
test('a version 3 save is upgraded to the morning of day 1, keeping progress and timers', () => {
  const flower = wild[0];
  const game = restoreGame(
    v3Save({
      elapsed: 500,
      regrowAt: { [flower.id]: 560 },
      collected: ['pine-wood'],
      discovered: ['pinefall'],
      landmarks: ['h-square'],
    }),
  );

  assert.equal(game.version, SAVE_VERSION);
  assert.equal(game.time, START_TIME);
  assert.equal(game.elapsed, 500);
  assert.deepEqual(game.regrowAt, {
    [flower.id]: START_TIME + 60,
    'pine-wood': START_TIME + SUPPLY_REGROW,
  });
  assert.deepEqual(game.landmarks, ['h-square']);
  assert.deepEqual(game.meters, { health: 100, hunger: 100, warmth: 100 });
  assert.deepEqual(game.camps, []);
  assert.equal(game.collected, undefined);
  const pinefall = REGIONS.find((r) => r.id === 'pinefall');
  assert.ok(isRevealed(game, pinefall.x, pinefall.y));
});

// Guards the upgrade against letting a broken old save through.
test('a broken version 3 save is still refused', () => {
  for (const changes of [
    { collected: ['unknown'] },
    { collected: [wild[0].id] },
    { collected: undefined },
    { regrowAt: [] },
    { regrowAt: { [wild[0].id]: -1 } },
  ])
    assert.equal(restoreGame(v3Save(changes)), null, JSON.stringify(changes));
});
```

- [ ] **Step 2: Update `tests/actions/gather.test.js` and `tests/world/nodes.test.js` (failing)**

In `tests/actions/gather.test.js`:
- Add `import { SUPPLY_REGROW } from '../../src/data/balance.js';` (extend the existing balance import).
- Replace the `wild` line with `const wild = NODES.filter((n) => n.id.startsWith('flowers-'));` and its comment with `/** The wild flower patches: map scenery that can be picked and grows back quickly. */`.
- Replace the first test with:

```js
// Guards against gathering from across the map, against taking the same pine tree twice in a row,
// and against a chopped tree never coming back (supplies regrow after two in-game days).
test('gathering is proximity based, and a gathered supply is gone until it grows back', () => {
  const game = createGame('scout'),
    node = NODES.find((n) => n.id === 'pine-wood');
  assert.equal(finishGather(game), null); // nothing is within reach of the camp spawn

  game.player.x = node.x;
  game.player.y = node.y + 40;
  assert.equal(finishGather(game)?.id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount);

  assert.equal(finishGather(game), null);
  assert.equal(finishGather(game, 'pine-wood'), null);
  assert.equal(finishGather(game, 'camp-stone'), null); // named, but out of reach

  game.time += SUPPLY_REGROW - 1;
  assert.equal(finishGather(game, 'pine-wood'), null);
  game.time += 1;
  assert.equal(finishGather(game, 'pine-wood')?.id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount * 2);
});
```

- In the flower test: delete `assert.deepEqual(game.collected, []);` and change both `game.elapsed +=` lines to `game.time +=`.
- In the "beginGather starts the node's own timed action" test: replace `assert.deepEqual(game.collected, []);` with `assert.deepEqual(game.regrowAt, {});`.

In `tests/world/nodes.test.js`:
- Change the imports: `import { RESOURCES, SUPPLIES } from '../../src/data/supplies.js';`, `import { GATHER_SECONDS, SUPPLY_REGROW } from '../../src/data/balance.js';`, `import { NODES, nodeBases, goneSupplies } from '../../src/world/nodes.js';`.
- Replace the `supplies`/`wild` lines:

```js
/** The hand-placed supplies (they grow back after two days), and the wild flower patches. */
const supplies = NODES.filter((n) => SUPPLIES.includes(n)),
  wild = NODES.filter((n) => !SUPPLIES.includes(n));
```

- Add two tests at the end:

```js
// Guards the M2 regrowth rule: fixed supplies come back after two in-game days, flowers sooner.
test('fixed supplies grow back after two days and flower patches after three minutes', () => {
  assert.equal(SUPPLY_REGROW, 720);
  for (const node of supplies) assert.equal(node.regrow, SUPPLY_REGROW, node.id);
  for (const node of wild) assert.equal(node.regrow, 180, node.id);
});

// Guards solid bases following availability: a chopped tree stops blocking, a regrown one blocks again.
test('a gathered supply stops being solid until it grows back', () => {
  const game = createGame('scout');
  assert.deepEqual(goneSupplies(game), []);
  game.regrowAt['pine-wood'] = game.time + 10;
  assert.deepEqual(goneSupplies(game), ['pine-wood']);
  game.time += 10;
  assert.deepEqual(goneSupplies(game), []);
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test tests/game/state.test.js tests/actions/gather.test.js tests/world/nodes.test.js`
Expected: FAIL (`SAVE_VERSION` and `goneSupplies` are not exported; `game.time` is undefined).

- [ ] **Step 4: Make supplies regrow (`src/data/supplies.js`)**

- Add `import { SUPPLY_REGROW } from './balance.js';` under the places import.
- Change the doc comment's first lines to: `The fixed supplies. Each one can be gathered, and grows back SUPPLY_REGROW game-seconds (two in-game days) later.` and add `` `regrow` is the seconds it takes to grow back. `` to the field list.
- Change the end of the `SUPPLIES` array from `];` to:

```js
  // Every fixed supply grows back on the same slow timer.
].map((supply) => ({ ...supply, regrow: SUPPLY_REGROW }));
```

- [ ] **Step 5: Move availability into `src/world/nodes.js`**

Change the header's last sentence to `Also says which nodes can be gathered now and which supplies are still solid.` and add after `NODES`:

```js
/**
 * Says whether a node has something to gather right now.
 *
 * A gathered supply or picked patch is gone until the world clock reaches its regrowAt time,
 * like a gardener's calendar that says when the plants will be back. The clock stops while the
 * game is paused, so nothing regrows behind a menu.
 *
 * @param {object} state - The game being played.
 * @param {object} n - The node to check.
 * @returns {boolean} True if the node can be gathered.
 */
export const isAvailable = (state, n) => !(state.regrowAt[n.id] > state.time);

/**
 * Lists the fixed supplies that were gathered and have not grown back yet.
 *
 * @param {object} state - The game being played.
 * @returns {string[]} Their ids. These supplies are not solid right now.
 */
export const goneSupplies = (state) =>
  SUPPLIES.filter((n) => !isAvailable(state, n)).map((n) => n.id);
```

Change `nodeBases`' doc to: `Lists the solid base of every supply that is standing right now.` / `A tree you haven't chopped is a wall you walk around; once it's chopped, the wall is gone until it grows back.` and its param to `@param {string[]} gone - Ids of the supplies that are not standing right now (see goneSupplies).`, and rename the parameter `collected` → `gone` in the body.

- [ ] **Step 6: Update `src/actions/gather.js`**

- Header line 2-3: `Gathering takes time. Pressing E starts it (beginGather), and the game loop hands out the supplies only when the timer runs out (finishGather). A gathered node is gone until it grows back.`
- Replace `import { NODES } from '../world/nodes.js';` with `import { NODES, isAvailable } from '../world/nodes.js';`.
- Delete the local `isAvailable` (its comment and body) and put this in its place:

```js
// Whether a node can be gathered now is decided in world/nodes.js; it is passed on from here for
// the HUD and the renderer, which already import it from this file.
export { isAvailable };
```

- Replace `hasGathered` with:

```js
/**
 * True once the player has gathered anything at all.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True if any supply or wild patch has a regrow timer.
 */
export const hasGathered = (state) => Object.keys(state.regrowAt).length > 0;
```

- In `finishGather`, change the doc's "marks the node as used: collected for good, or picked until it grows back." to "marks the node as used until it grows back." and replace the two lines

```js
  if (node.regrow) state.regrowAt[node.id] = state.elapsed + node.regrow;
  else state.collected.push(node.id);
```

with

```js
  state.regrowAt[node.id] = state.time + node.regrow;
```

- [ ] **Step 7: Update `src/actions/move.js`**

Replace `import { nodeBases } from '../world/nodes.js';` with `import { nodeBases, goneSupplies } from '../world/nodes.js';` and the bases line with:

```js
  const bases = nodeBases(goneSupplies(state)).filter((base) => !blocks([base], x, y));
```

- [ ] **Step 8: Rewrite `src/game/state.js` for version 4**

```js
// The game state: one plain object that holds everything about a character's adventure (where
// they stand, what's in their backpack, what they've found, their camps, how warm and fed they
// are, and what they've seen). This file creates a new one, turns it into text for saving, and
// carefully checks saved text before loading it back. Older saves are upgraded on the way in.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import {
  START_TIME,
  SUPPLY_REGROW,
  TEA_SECONDS,
  MAX_GROWN,
  CAMP_NAME_MAX,
  MAX_CAMPS,
} from '../data/balance.js';
import { isWalkable } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';
import { emptyFog, isFogString, revealAround, revealRegions } from '../world/fog.js';

/** The save format this code writes. Version 3 saves are upgraded when loaded (see `upgradeV3`). */
export const SAVE_VERSION = 4;

/** The three survival meters. Each is a number from 0 to 100. */
const METERS = ['health', 'hunger', 'warmth'];

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `regrowAt` maps each gathered node to the world time it
 *   grows back; `discovered` lists region ids; `landmarks` and `waypoints` list the places and
 *   signposts found; `elapsed` is game seconds played and `distance` is world units walked;
 *   `time` is the world clock (game seconds since the dawn of day 1); `meters` holds health,
 *   hunger and warmth; `tea` is the seconds of tea warmth left; `camps` lists the camps built;
 *   `fog` records the squares of the world seen so far.
 * @throws {Error} If the character id isn't one of the known characters.
 */
export function createGame(characterId) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  const state = {
    version: SAVE_VERSION,
    character: character.id,
    player: { ...character.spawn, direction: 0 },
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    elapsed: 0,
    distance: 0,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    camps: [],
    fog: emptyFog(),
  };
  revealAround(state, state.player.x, state.player.y);
  return state;
}

/**
 * Turns the game state into text so it can be saved.
 *
 * @param {object} state - The game being played.
 * @returns {string} The state as JSON text.
 */
export function serializeGame(state) {
  return JSON.stringify(state);
}

/**
 * Checks one camp need from a save: a kind the game knows, with sensible fields and a done flag.
 *
 * @param {*} n - The need read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isNeed = (n) =>
  !!n &&
  typeof n.done === 'boolean' &&
  ((n.kind === 'bring' &&
    RESOURCES.includes(n.resource) &&
    Number.isSafeInteger(n.amount) &&
    n.amount >= 1 &&
    n.amount <= 99) ||
    (n.kind === 'place' && REGIONS.some((r) => r.id === n.region)) ||
    n.kind === 'signpost');

/**
 * Checks one camp from a save: an id like "camp-3", a tidy name, a spot on dry land, a growth
 * count in range and exactly three needs.
 *
 * @param {*} c - The camp read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isCamp = (c) =>
  !!c &&
  typeof c.id === 'string' &&
  /^camp-\d+$/.test(c.id) &&
  typeof c.name === 'string' &&
  c.name.length >= 1 &&
  c.name.length <= CAMP_NAME_MAX &&
  c.name.trim() === c.name &&
  isWalkable(c.x, c.y) &&
  Number.isInteger(c.grown) &&
  c.grown >= 0 &&
  c.grown <= MAX_GROWN &&
  Array.isArray(c.needs) &&
  c.needs.length === 3 &&
  c.needs.every(isNeed);

/**
 * Copies a checked need, keeping only the fields its kind uses.
 *
 * @param {object} n - A need that passed `isNeed`.
 * @returns {object} A fresh need object.
 */
function copyNeed(n) {
  if (n.kind === 'bring')
    return { kind: n.kind, resource: n.resource, amount: n.amount, done: n.done };
  if (n.kind === 'place') return { kind: n.kind, region: n.region, done: n.done };
  return { kind: n.kind, done: n.done };
}

/**
 * Copies a checked camp field by field, with fresh copies of its needs.
 *
 * @param {object} c - A camp that passed `isCamp`.
 * @returns {object} A fresh camp object.
 */
const copyCamp = (c) => ({
  id: c.id,
  name: c.name,
  x: c.x,
  y: c.y,
  grown: c.grown,
  needs: c.needs.map(copyNeed),
});

/**
 * Brings a version 3 save up to version 4, so players keep their progress.
 *
 * Version 3 had no world clock, meters, camps or fog. The clock starts again on the morning of
 * day 1, and each regrow timer keeps the time it had left. A supply version 3 called "collected"
 * (gone for good) now grows back two days from that morning. The fog lifts over every region the
 * player had already entered and around where they stand. A broken version 3 save is refused here,
 * exactly as the old loader would have refused it.
 *
 * @param {object} s - The parsed version 3 save.
 * @returns {object|null} The save in the version 4 shape (still to be checked), or null.
 */
function upgradeV3(s) {
  const { regrowAt: timers, collected, elapsed, discovered, player } = s;
  if (
    !timers ||
    typeof timers !== 'object' ||
    Array.isArray(timers) ||
    !Object.values(timers).every((t) => Number.isFinite(t) && t >= 0) ||
    !Array.isArray(collected) ||
    !collected.every((id) => SUPPLIES.some((n) => n.id === id)) ||
    !Number.isFinite(elapsed)
  )
    return null;

  // Each timer keeps the seconds it had left; collected supplies get a fresh two-day timer.
  const regrowAt = Object.fromEntries(
    Object.entries(timers).map(([id, at]) => [id, START_TIME + Math.max(0, at - elapsed)]),
  );
  for (const id of collected) regrowAt[id] = START_TIME + SUPPLY_REGROW;

  // Lift the fog over the regions already entered and around where the player stands.
  const seen = { fog: emptyFog() };
  revealRegions(seen, Array.isArray(discovered) ? discovered : []);
  revealAround(seen, player?.x, player?.y);

  return {
    ...s,
    version: SAVE_VERSION,
    regrowAt,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    camps: [],
    fog: seen.fog,
  };
}

/**
 * Reads saved text back into a game state, or gives up if anything looks wrong.
 *
 * Saved text could be old, broken, or edited by hand, so we check every field before trusting
 * it, like a librarian checking a returned book page by page. Then we build a brand-new object
 * field by field instead of using the loaded one, so stray extra fields never sneak into the game.
 * A new field added to the game state must be checked and copied here too, or it is lost on load.
 *
 * @param {string} json - The saved text.
 * @returns {object|null} A safe game state, or null if the save can't be used.
 */
export function restoreGame(json) {
  try {
    const parsed = JSON.parse(json);
    const s = parsed?.version === 3 ? upgradeV3(parsed) : parsed;

    // The right save version, a known character, and a player standing somewhere they're allowed to be.
    if (
      !s ||
      s.version !== SAVE_VERSION ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !s.player ||
      !isWalkable(s.player.x, s.player.y) ||
      ![0, 1, 2, 3].includes(s.player.direction)
    )
      return null;

    const { resources, regrowAt, meters, tea, camps } = s;

    // Every resource must be a sensible whole number: not negative, not huge.
    if (
      !resources ||
      !RESOURCES.every(
        (key) =>
          Number.isSafeInteger(resources[key]) && resources[key] >= 0 && resources[key] < 100000,
      )
    )
      return null;

    // The discovered and found lists may only hold real ids, each listed once.
    for (const [list, allowed] of [
      [s.discovered, REGIONS],
      [s.landmarks, LANDMARKS],
      [s.waypoints, WAYPOINTS],
    ]) {
      if (
        !Array.isArray(list) ||
        list.length > allowed.length ||
        new Set(list).size !== list.length ||
        !list.every((id) => allowed.some((a) => a.id === id))
      )
        return null;
    }

    // Time played, distance walked and the world clock must be real, non-negative numbers.
    if (![s.elapsed, s.distance, s.time].every((n) => Number.isFinite(n) && n >= 0)) return null;

    // Regrowth timers must be a plain object of non-negative times.
    if (
      !regrowAt ||
      typeof regrowAt !== 'object' ||
      Array.isArray(regrowAt) ||
      !Object.values(regrowAt).every((t) => Number.isFinite(t) && t >= 0)
    )
      return null;

    // Each meter runs from 0 to 100, and tea from none to one full cup.
    if (
      !meters ||
      !METERS.every((k) => Number.isFinite(meters[k]) && meters[k] >= 0 && meters[k] <= 100) ||
      !Number.isFinite(tea) ||
      tea < 0 ||
      tea > TEA_SECONDS
    )
      return null;

    // Camps: a short list of well-formed camps, each id used once.
    if (
      !Array.isArray(camps) ||
      camps.length > MAX_CAMPS ||
      !camps.every(isCamp) ||
      new Set(camps.map((c) => c.id)).size !== camps.length
    )
      return null;

    // The fog must be the right length for this map.
    if (!isFogString(s.fog)) return null;

    // Node ids are map positions, so a rebuilt map can retire one; dropping its timer only lets it regrow early.
    // Each kept timer is also capped at one regrow ahead, so a node can't stay gone forever.
    const timers = NODES.filter((n) => n.regrow && Object.hasOwn(regrowAt, n.id)).map((n) => [
      n.id,
      Math.min(regrowAt[n.id], s.time + n.regrow),
    ]);

    // Build the result fresh, copying only the fields we checked.
    return {
      version: SAVE_VERSION,
      character: s.character,
      player: { x: s.player.x, y: s.player.y, direction: s.player.direction },
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      landmarks: [...s.landmarks],
      waypoints: [...s.waypoints],
      elapsed: s.elapsed,
      distance: s.distance,
      time: s.time,
      meters: Object.fromEntries(METERS.map((k) => [k, meters[k]])),
      tea,
      camps: camps.map(copyCamp),
      fog: s.fog,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 9: Advance the world clock in `src/core/loop.js`**

After `state.elapsed += dt;` add:

```js
        // The world clock: gathered supplies grow back on it, and day and night follow it.
        state.time += dt;
```

- [ ] **Step 10: Run all tests**

Run: `npm test`
Expected: all PASS. (`tests/game/saves.test.js` builds saves with `createGame`, so it keeps passing.)

- [ ] **Step 11: Quick browser check**

Start the `wildhaven` launch config, open `http://127.0.0.1:5173`, start the Scout, chop the pine tree and pick flowers; the console must stay free of errors. Reload: the game resumes (the save is version 4).

- [ ] **Step 12: Format and commit**

```bash
npm run format
git add src/data/supplies.js src/world/nodes.js src/actions/gather.js src/actions/move.js src/game/state.js src/core/loop.js tests/game/state.test.js tests/actions/gather.test.js tests/world/nodes.test.js
git commit -m "Save version 4: world clock, meters, camps and fog; supplies regrow" -m "Version 3 saves are upgraded instead of reset." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/data/supplies.js src/world/nodes.js src/actions/gather.js src/actions/move.js src/game/state.js src/core/loop.js tests/game/state.test.js tests/actions/gather.test.js tests/world/nodes.test.js
```

---

### Task 4: Camps and the needs list

**Files:**
- Create: `src/world/camps.js`, `src/world/needs.js`
- Test: `tests/world/camps.test.js`, `tests/world/needs.test.js`

**Interfaces:**
- Consumes: Task 1 constants and `dayOf`; `OBJECT_SPECS` from `world/map.js`; `REGIONS`, `regionOf` from `world/regions.js`; `LANDMARKS`, `WAYPOINTS` from `data/places.js`; `RESOURCES` from `data/supplies.js`; state fields from Task 3.
- Produces (camps): `fireRadius(camp): number`, `nearestCamp(state, x?, y?): camp|null`, `byFire(state): boolean`, `campInReach(state): camp|null`, `fireBase(x, y): number[4]`, `campBases(state): number[][]`, `suggestCampName(state, x, y): string`, `cleanCampName(text): string`.
- Produces (needs): `outwardRegion(state, camp): region|null`, `makeNeed(state, camp, slot, day): need`, `makeNeeds(state, camp): need[3]`, `meetNeed(camp, need): void`, `markFinds(state, found): {camp, need}[]`, `refreshNeeds(state): camp[]`, `describeNeed(need): string`, `needProgress(state, need): {have, want}`.

- [ ] **Step 1: Write the failing camp tests** — create `tests/world/camps.test.js`:

```js
// Checks the questions the game asks about camps: how far a fire's warmth reaches, which fire is
// closest, whether the player is warm, and what a new camp is called. Warmth and passing out both
// depend on these answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRE_RADIUS,
  FIRE_GROWTH,
  MAX_GROWN,
  CAMP_REACH,
  CAMP_NAME_MAX,
} from '../../src/data/balance.js';
import { isWalkable } from '../../src/world/map.js';
import { createGame } from '../../src/game/state.js';
import {
  fireRadius,
  nearestCamp,
  byFire,
  campInReach,
  fireBase,
  campBases,
  suggestCampName,
  cleanCampName,
} from '../../src/world/camps.js';

/**
 * Adds a bare camp to a game, for the camp tests.
 *
 * @param {object} game - The game to add it to.
 * @param {string} id - The camp's id, such as 'camp-1'.
 * @param {string} name - The camp's name.
 * @param {number} x - World x of its fire.
 * @param {number} y - World y of its fire.
 * @returns {object} The camp that was added.
 */
function addCamp(game, id, name, x, y) {
  const camp = { id, name, x, y, grown: 0, needs: [] };
  game.camps.push(camp);
  return camp;
}

// Guards the warmth radius and its growth cap, which set how far a camp's safe zone reaches.
test('a fire warms 260 units, 40 more per need met, up to 660', () => {
  assert.equal(FIRE_RADIUS, 260);
  assert.equal(fireRadius({ grown: 0 }), FIRE_RADIUS);
  assert.equal(fireRadius({ grown: 3 }), FIRE_RADIUS + 3 * FIRE_GROWTH);
  assert.equal(fireRadius({ grown: MAX_GROWN }), 660);
});

// Guards which fire counts: the nearest one is found, and warmth stops at the edge of its reach.
test("the nearest camp is found, and the player is warm only inside a fire's reach", () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  assert.equal(nearestCamp(game), null);
  assert.equal(byFire(game), false);

  const near = addCamp(game, 'camp-1', 'Near', x + 200, y);
  addCamp(game, 'camp-2', 'Far', x + 5000, y);
  assert.equal(nearestCamp(game), near);
  assert.equal(byFire(game), true);

  game.player.x = x - 100; // 300 units from the near fire
  assert.equal(byFire(game), false);
  near.grown = 1; // now it reaches 300
  assert.equal(byFire(game), true);
});

// Guards the short reach for opening a camp, so E at the edge of the warmth doesn't open it.
test('a camp can be opened only from close by', () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  const camp = addCamp(game, 'camp-1', 'Pinefall Camp', x, y + CAMP_REACH - 1);
  assert.equal(campInReach(game), camp);
  camp.y = y + CAMP_REACH + 1;
  assert.equal(campInReach(game), null);
});

// Guards the fire's solid base: it blocks walking like a tree, sized by the campfire footprint.
test('a camp fire is solid, sized by the campfire footprint', () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  addCamp(game, 'camp-1', 'Pinefall Camp', x, y + 30);
  assert.deepEqual(fireBase(x, y + 30), [x - 47, y + 30 - 70, x + 47, y + 30]);
  assert.deepEqual(campBases(game), [fireBase(x, y + 30)]);
  assert.ok(isWalkable(x, y));
  assert.equal(isWalkable(x, y, campBases(game)), false);
});

// Guards camp names: the region's first word plus "Camp", numbered when taken, and tidied input.
test('suggested names come from the region and never repeat; typed names are tidied', () => {
  const game = createGame('scout'),
    { x, y } = game.player;
  assert.equal(suggestCampName(game, x, y), 'Pinefall Camp');
  addCamp(game, 'camp-1', 'Pinefall Camp', x, y);
  assert.equal(suggestCampName(game, x, y), 'Pinefall Camp 2');

  assert.equal(cleanCampName('  Home   Fire  '), 'Home Fire');
  assert.equal(cleanCampName('x'.repeat(40)).length, CAMP_NAME_MAX);
  assert.equal(cleanCampName('   '), '');
  assert.equal(cleanCampName(undefined), '');
});
```

- [ ] **Step 2: Write the failing needs tests** — create `tests/world/needs.test.js`:

```js
// Checks the camp needs list: what a camp asks for, how needs are met, and the dawn swap.
// The needs are what point the player outward, so a wrong rule here quietly breaks the loop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEED_AMOUNTS, MAX_GROWN, DAY_SECONDS } from '../../src/data/balance.js';
import { RESOURCES } from '../../src/data/supplies.js';
import { LANDMARKS, WAYPOINTS } from '../../src/data/places.js';
import { REGIONS, regionOf } from '../../src/world/regions.js';
import { createGame } from '../../src/game/state.js';
import {
  outwardRegion,
  makeNeed,
  makeNeeds,
  meetNeed,
  markFinds,
  refreshNeeds,
  describeNeed,
  needProgress,
} from '../../src/world/needs.js';

/**
 * Makes a scout's game with one camp at the spawn (in Pinefall Woods), for the needs tests.
 *
 * @returns {{game: object, camp: object}} The game, and its camp (already in `game.camps`).
 */
function campGame() {
  const game = createGame('scout');
  const camp = {
    id: 'camp-1',
    name: 'Pinefall Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [],
  };
  camp.needs = makeNeeds(game, camp);
  game.camps.push(camp);
  return { game, camp };
}

/** Measures the distance from a camp to a region's centre. */
const far = (camp, region) => Math.hypot(region.x - camp.x, region.y - camp.y);

// Guards the three-slot shape: resources first, a place second, and a signpost on odd days.
test('a new camp asks for resources, a place further out, and (on day 1) a new signpost', () => {
  const { camp } = campGame();
  assert.deepEqual(
    camp.needs.map((n) => n.kind),
    ['bring', 'place', 'signpost'],
  );
  assert.ok(camp.needs.every((n) => n.done === false));
});

// Guards the "point outward" rule: never the camp's own region, always the nearest region that
// still has something to find, and a different region once that one is fully explored.
test('a place need names the nearest other region with an unfound place', () => {
  const { game, camp } = campGame();
  const home = regionOf(camp.x, camp.y).id,
    region = outwardRegion(game, camp);
  assert.notEqual(region.id, home);
  for (const other of REGIONS)
    if (other.id !== home) assert.ok(far(camp, region) <= far(camp, other), other.id);

  game.landmarks.push(...LANDMARKS.filter((l) => l.region === region.id).map((l) => l.id));
  const next = outwardRegion(game, camp);
  assert.notEqual(next.id, region.id);
  assert.notEqual(next.id, home);
});

// Guards the fallbacks: with nothing left to find, every need asks for resources instead.
test('with every place and signpost found, every need asks for resources', () => {
  const { game, camp } = campGame();
  game.landmarks = LANDMARKS.map((l) => l.id);
  game.waypoints = WAYPOINTS.map((w) => w.id);
  assert.equal(outwardRegion(game, camp), null);
  for (const slot of [0, 1, 2]) assert.equal(makeNeed(game, camp, slot, 1).kind, 'bring');
});

// Guards reloads and growth: the same camp, slot and day always ask for the same thing, the amount
// rises as the camp grows, and slot 2 asks for resources on even days.
test('resource needs are steady for the same camp, slot and day, and grow with the camp', () => {
  const { game, camp } = campGame();
  const need = makeNeed(game, camp, 0, 4);
  assert.deepEqual(makeNeed(game, camp, 0, 4), need);
  assert.ok(RESOURCES.includes(need.resource));
  assert.equal(need.amount, NEED_AMOUNTS[need.resource]);

  camp.grown = 5;
  assert.equal(makeNeed(game, camp, 0, 4).amount, NEED_AMOUNTS[need.resource] + 2);
  assert.equal(makeNeed(game, camp, 2, 2).kind, 'bring');
});

// Guards the reward: each met need grows the fire one step, and growth stops at the limit.
test('meeting a need marks it done and grows the camp up to the limit', () => {
  const { camp } = campGame();
  meetNeed(camp, camp.needs[0]);
  assert.equal(camp.needs[0].done, true);
  assert.equal(camp.grown, 1);

  camp.grown = MAX_GROWN;
  meetNeed(camp, camp.needs[1]);
  assert.equal(camp.grown, MAX_GROWN);
});

// Guards exploration needs: the right find completes them, the wrong one doesn't.
test('finding a place in the named region, or any signpost, meets those needs', () => {
  const { game, camp } = campGame();
  const place = camp.needs[1];
  const elsewhere = LANDMARKS.find((l) => l.region !== place.region);
  assert.deepEqual(markFinds(game, [{ kind: 'landmark', id: elsewhere.id }]), []);

  const there = LANDMARKS.find((l) => l.region === place.region);
  const met = markFinds(game, [
    { kind: 'landmark', id: there.id },
    { kind: 'waypoint', id: WAYPOINTS[0].id },
  ]);
  assert.equal(met.length, 2);
  assert.ok(place.done && camp.needs[2].done);
  assert.equal(camp.needs[0].done, false);
  assert.equal(camp.grown, 2);
});

// Guards the dawn update: only met needs are replaced; open ones stay exactly as they were.
test('at dawn, met needs are swapped for new ones and open needs stay', () => {
  const { game, camp } = campGame();
  const [, place, signpost] = camp.needs;
  meetNeed(camp, camp.needs[0]);
  game.time = DAY_SECONDS + 1; // day 2

  assert.deepEqual(refreshNeeds(game), [camp]);
  assert.equal(camp.needs[0].done, false);
  assert.equal(camp.needs[1], place);
  assert.equal(camp.needs[2], signpost);
  assert.deepEqual(refreshNeeds(game), []); // nothing met, nothing changes
});

// Guards the words shown to the player and the progress counts beside them.
test('needs are described in plain words with a progress count', () => {
  const { game } = campGame();
  const bring = { kind: 'bring', resource: 'stone', amount: 3, done: false };
  assert.equal(describeNeed(bring), 'Bring 3 stone');
  assert.equal(
    describeNeed({ kind: 'place', region: 'frostpeak', done: false }),
    'Find a place in Frostpeak',
  );
  assert.equal(describeNeed({ kind: 'signpost', done: false }), 'Find a new signpost');

  game.resources.stone = 1;
  assert.deepEqual(needProgress(game, bring), { have: 1, want: 3 });
  game.resources.stone = 9;
  assert.deepEqual(needProgress(game, bring), { have: 3, want: 3 });
  assert.deepEqual(needProgress(game, { kind: 'signpost', done: false }), { have: 0, want: 1 });
  assert.deepEqual(needProgress(game, { kind: 'signpost', done: true }), { have: 1, want: 1 });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test tests/world/camps.test.js tests/world/needs.test.js`
Expected: FAIL (modules not found).

- [ ] **Step 4: Create `src/world/camps.js`**

```js
// Camps: the campfires the player has built. This file answers questions about them (how far a
// fire's warmth reaches, which fire is closest, whether the player is warm, what a new camp is
// called) without changing anything.

import { FIRE_RADIUS, FIRE_GROWTH, CAMP_REACH, CAMP_NAME_MAX } from '../data/balance.js';
import { OBJECT_SPECS } from './map.js';
import { regionOf } from './regions.js';

/**
 * Says how far a camp's fire keeps the player warm.
 *
 * A new fire warms a small circle; every need the camp has had met makes the circle bigger.
 *
 * @param {{grown: number}} camp - The camp.
 * @returns {number} The warmth radius in world units.
 */
export const fireRadius = (camp) => FIRE_RADIUS + FIRE_GROWTH * camp.grown;

/**
 * Measures the distance from a camp's fire to a spot.
 *
 * @param {object} camp - The camp.
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {number} The distance in world units.
 */
const distance = (camp, x, y) => Math.hypot(camp.x - x, camp.y - y);

/**
 * Finds the camp whose fire is closest to a spot (the player, unless another spot is given).
 *
 * @param {object} state - The game being played.
 * @param {number} [x] - World x position; defaults to the player's.
 * @param {number} [y] - World y position; defaults to the player's.
 * @returns {object|null} The nearest camp, or null when there are no camps yet.
 */
export function nearestCamp(state, x = state.player.x, y = state.player.y) {
  let best = null;
  for (const camp of state.camps)
    if (!best || distance(camp, x, y) < distance(best, x, y)) best = camp;
  return best;
}

/**
 * Says whether the player stands inside the warmth of any of their fires.
 *
 * @param {object} state - The game being played.
 * @returns {boolean} True when some fire's warmth reaches the player.
 */
export const byFire = (state) =>
  state.camps.some((camp) => distance(camp, state.player.x, state.player.y) <= fireRadius(camp));

/**
 * Finds the camp the player is close enough to open (by pressing E beside its fire).
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The camp, or null when no fire is that close.
 */
export function campInReach(state) {
  const camp = nearestCamp(state);
  return camp && distance(camp, state.player.x, state.player.y) <= CAMP_REACH ? camp : null;
}

/**
 * Gives the solid base of a campfire standing at a spot, as a box.
 *
 * The box comes from the campfire sprite's footprint in objects.json, like every map object's.
 *
 * @param {number} x - World x of the fire (the middle of its base).
 * @param {number} y - World y of the fire (the bottom edge of its base).
 * @returns {number[]} The box as [left, top, right, bottom].
 */
export function fireBase(x, y) {
  const [halfWidth, depth] = OBJECT_SPECS.campfire.footprint;
  return [x - halfWidth, y - depth, x + halfWidth, y];
}

/**
 * Lists the solid base of every camp's fire, so walking and building go around them.
 *
 * @param {object} state - The game being played.
 * @returns {number[][]} One box per camp.
 */
export const campBases = (state) => state.camps.map((camp) => fireBase(camp.x, camp.y));

/**
 * Suggests a name for a camp founded at a spot: the region's first word plus "Camp".
 *
 * If that name is taken, a number is added: "Pinefall Camp 2", "Pinefall Camp 3" and so on.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the new fire.
 * @param {number} y - World y of the new fire.
 * @returns {string} A name no other camp has.
 */
export function suggestCampName(state, x, y) {
  const base = `${regionOf(x, y).name.split(' ')[0]} Camp`;
  let name = base;
  for (let n = 2; state.camps.some((camp) => camp.name === name); n++) name = `${base} ${n}`;
  return name;
}

/**
 * Tidies a name the player typed: squeezes runs of spaces, trims the ends, and cuts it to the limit.
 *
 * @param {*} text - What was typed.
 * @returns {string} The tidy name, or '' if nothing was left.
 */
export const cleanCampName = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CAMP_NAME_MAX)
    .trim();
```

- [ ] **Step 5: Create `src/world/needs.js`**

```js
// The camp needs list: three things each camp asks for. They point the player outward: bring
// resources home, find a place in a region further out, or find a new signpost. Meeting a need
// grows the camp's fire; at dawn every met need is swapped for a fresh one.

import { NEED_AMOUNTS, MAX_GROWN } from '../data/balance.js';
import { RESOURCES } from '../data/supplies.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import { REGIONS, regionOf } from './regions.js';
import { dayOf } from './clock.js';

/**
 * Turns a piece of text into a steady whole number: the same text always gives the same number.
 *
 * Used to pick a need's resource, so a camp's list is the same after a reload instead of being
 * re-rolled like dice. (This is the FNV-1a hash: mix in each letter, then multiply.)
 *
 * @param {string} text - Any text, such as "camp-1-3-0".
 * @returns {number} A whole number of 0 or more.
 */
function hash(text) {
  let h = 2166136261;
  for (const letter of text) h = Math.imul(h ^ letter.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Picks the region a camp should send the player to: the closest one, other than the camp's own,
 * that still has a place nobody has found.
 *
 * @param {object} state - The game being played (its `landmarks` are the places found).
 * @param {object} camp - The camp asking.
 * @returns {object|null} A region from REGIONS, or null when every other region is fully explored.
 */
export function outwardRegion(state, camp) {
  const home = regionOf(camp.x, camp.y).id;
  /** Measures how far a region's centre is from the camp. */
  const away = (region) => Math.hypot(region.x - camp.x, region.y - camp.y);
  const open = REGIONS.filter(
    (region) =>
      region.id !== home &&
      LANDMARKS.some((l) => l.region === region.id && !state.landmarks.includes(l.id)),
  );
  return open.sort((a, b) => away(a) - away(b))[0] ?? null;
}

/**
 * Makes one need for one slot of a camp's list.
 *
 * Slot 0 always asks for resources. Slot 1 asks for a place in the nearest unexplored region.
 * Slot 2 asks for a new signpost on odd days and for resources on even days. When there is no
 * place or signpost left to find, the slot asks for resources instead.
 *
 * @param {object} state - The game being played.
 * @param {object} camp - The camp the need is for (its id, spot and `grown` are read).
 * @param {number} slot - Which line of the list: 0, 1 or 2.
 * @param {number} day - The day the need is made, from `dayOf`.
 * @returns {object} `{kind: 'bring', resource, amount, done}`, `{kind: 'place', region, done}` or
 *   `{kind: 'signpost', done}`, with `done` false.
 */
export function makeNeed(state, camp, slot, day) {
  if (slot === 1) {
    const region = outwardRegion(state, camp);
    if (region) return { kind: 'place', region: region.id, done: false };
  }
  if (slot === 2 && day % 2 === 1 && WAYPOINTS.some((w) => !state.waypoints.includes(w.id)))
    return { kind: 'signpost', done: false };

  const resource = RESOURCES[hash(`${camp.id}-${day}-${slot}`) % RESOURCES.length];
  const amount = NEED_AMOUNTS[resource] + Math.floor(camp.grown / 2);
  return { kind: 'bring', resource, amount, done: false };
}

/**
 * Makes a full list of three needs for a camp, for today.
 *
 * @param {object} state - The game being played (its clock gives today).
 * @param {object} camp - The camp the needs are for.
 * @returns {object[]} Three needs, one per slot.
 */
export const makeNeeds = (state, camp) =>
  [0, 1, 2].map((slot) => makeNeed(state, camp, slot, dayOf(state.time)));

/**
 * Marks a need as met and grows its camp's fire by one step, up to the limit.
 *
 * @param {object} camp - The camp the need belongs to. Its `grown` goes up.
 * @param {object} need - The need. Its `done` becomes true.
 */
export function meetNeed(camp, need) {
  need.done = true;
  camp.grown = Math.min(MAX_GROWN, camp.grown + 1);
}

/**
 * Ticks off exploration needs that the player's latest finds complete.
 *
 * A place need is met by finding any place in its region; a signpost need by finding any
 * signpost. One find can complete matching needs at several camps: finds are shared, not split.
 *
 * @param {object} state - The game being played. Met needs change, and their camps grow.
 * @param {{kind: string, id: string}[]} found - What `discover` just reported.
 * @returns {{camp: object, need: object}[]} Each need that was met, with its camp, for the HUD.
 */
export function markFinds(state, found) {
  const met = [];
  for (const camp of state.camps)
    for (const need of camp.needs) {
      if (need.done) continue;
      const hit = found.some(
        (f) =>
          (need.kind === 'place' &&
            f.kind === 'landmark' &&
            LANDMARKS.find((l) => l.id === f.id)?.region === need.region) ||
          (need.kind === 'signpost' && f.kind === 'waypoint'),
      );
      if (!hit) continue;
      meetNeed(camp, need);
      met.push({ camp, need });
    }
  return met;
}

/**
 * Swaps every met need for a fresh one: the dawn update.
 *
 * Open needs stay as they are, so a need the player is still working on never vanishes.
 *
 * @param {object} state - The game being played. Camp need lists change.
 * @returns {object[]} The camps whose lists changed, so the HUD can name them.
 */
export function refreshNeeds(state) {
  const day = dayOf(state.time),
    changed = [];
  for (const camp of state.camps) {
    if (!camp.needs.some((need) => need.done)) continue;
    camp.needs = camp.needs.map((need, slot) =>
      need.done ? makeNeed(state, camp, slot, day) : need,
    );
    changed.push(camp);
  }
  return changed;
}

/**
 * Says a need in plain words for the HUD and the camp dialog, such as "Bring 4 stone".
 *
 * @param {object} need - The need.
 * @returns {string} The words.
 */
export function describeNeed(need) {
  if (need.kind === 'bring') return `Bring ${need.amount} ${need.resource}`;
  if (need.kind === 'place')
    return `Find a place in ${REGIONS.find((r) => r.id === need.region).name}`;
  return 'Find a new signpost';
}

/**
 * Measures how close a need is to being met, for the count beside it.
 *
 * A resource need counts what is in the backpack, up to the amount asked. Finding needs are
 * all or nothing. A met need is always full.
 *
 * @param {object} state - The game being played.
 * @param {object} need - The need.
 * @returns {{have: number, want: number}} Progress so far, and the goal.
 */
export function needProgress(state, need) {
  const want = need.kind === 'bring' ? need.amount : 1;
  if (need.done) return { have: want, want };
  if (need.kind === 'bring')
    return { have: Math.min(state.resources[need.resource], want), want };
  return { have: 0, want };
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/world/camps.test.js tests/world/needs.test.js` → PASS; then `npm test` → all PASS.

- [ ] **Step 7: Format and commit**

```bash
npm run format
git add src/world/camps.js src/world/needs.js tests/world/camps.test.js tests/world/needs.test.js
git commit -m "Add camp lookups and the camp needs list" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/world/camps.js src/world/needs.js tests/world/camps.test.js tests/world/needs.test.js
```

---

### Task 5: Placing campfires

**Files:**
- Create: `src/actions/build.js`
- Modify: `src/actions/move.js`
- Test: `tests/actions/build.test.js`

**Interfaces:**
- Consumes: Task 4 `campBases`, `fireBase`, `suggestCampName`, `cleanCampName`, `makeNeeds`; Task 3 `nodeBases`, `goneSupplies`, `NODES`.
- Produces: `checkPlacement(state, x, y): {ok: true} | {ok: false, reason: 'cost'|'limit'|'far'|'blocked'|'close', message: string}`; `placeCampfire(state, x, y): {ok: true, camp} | (refusal as above)`; `nameCamp(state, campId, text): {ok: true, camp} | {ok: false, reason: 'unknown'|'empty'}`. Camp fires block movement.

- [ ] **Step 1: Write the failing test** — create `tests/actions/build.test.js`:

```js
// Checks placing a campfire: where one may stand, what it costs, and naming the camp it founds.
// A wrong rule here could charge for a fire that never appears, or let fires block the paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPFIRE_COST, CAMP_SPACING, PLACE_RANGE, MAX_CAMPS } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';
import { checkPlacement, placeCampfire, nameCamp } from '../../src/actions/build.js';

/**
 * Finds spots near the player where a campfire may stand, trying points on rings around them.
 *
 * @param {object} game - The game being played.
 * @param {number} [count=1] - How many spots to find; each is at least 200 units from the others.
 * @returns {{x: number, y: number}[]} The spots found.
 */
function openSpots(game, count = 1) {
  const spots = [];
  for (let r = 120; r <= PLACE_RANGE && spots.length < count; r += 30)
    for (let a = 0; a < 360 && spots.length < count; a += 15) {
      const x = Math.round(game.player.x + r * Math.cos((a * Math.PI) / 180)),
        y = Math.round(game.player.y + r * Math.sin((a * Math.PI) / 180));
      const apart = spots.every((s) => Math.hypot(s.x - x, s.y - y) >= 200);
      if (apart && checkPlacement(game, x, y).ok) spots.push({ x, y });
    }
  assert.equal(spots.length, count, 'not enough open ground near the player');
  return spots;
}

// Guards the price: a fire can't be placed without 3 wood and 2 stone, and nothing is spent.
test('placing is refused without the wood and stone, and nothing is spent', () => {
  const game = createGame('scout'); // starts with no wood or stone
  const check = checkPlacement(game, game.player.x, game.player.y + 150);
  assert.equal(check.reason, 'cost');
  assert.equal(check.message, 'Needs 3 wood and 2 stone');
  assert.equal(placeCampfire(game, game.player.x, game.player.y + 150).ok, false);
  assert.deepEqual(game.camps, []);
  assert.equal(game.resources.wood, 0);
});

// Guards placing at a distance and on top of things: too far, on the player, or on a supply.
test('placing is refused too far away, on the player, or on a supply', () => {
  const game = createGame('builder'); // 5 wood, 2 stone
  assert.equal(checkPlacement(game, game.player.x + PLACE_RANGE + 1, game.player.y).reason, 'far');
  assert.equal(checkPlacement(game, game.player.x, game.player.y + 30).reason, 'blocked');

  const supply = NODES.find((n) => n.id === 'village-wood');
  game.player.x = supply.x;
  game.player.y = supply.y + 100;
  assert.equal(checkPlacement(game, supply.x + 20, supply.y).reason, 'blocked');
});

// Guards the happy path: the cost is paid once, and the camp has an id, a name and three needs.
test('a placed campfire founds a named camp and charges the cost once', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  const result = placeCampfire(game, spot.x, spot.y);

  assert.equal(result.ok, true);
  assert.deepEqual(game.resources, {
    wood: 5 - CAMPFIRE_COST.wood,
    stone: 2 - CAMPFIRE_COST.stone,
    food: 2,
    herbs: 0,
  });
  assert.equal(game.camps.length, 1);
  assert.equal(result.camp.id, 'camp-1');
  assert.equal(result.camp.name, 'Hollowstead Camp');
  assert.equal(result.camp.needs.length, 3);
  assert.equal(placeCampfire(game, spot.x, spot.y).ok, false); // no stone left
});

// Guards the spacing rule: a second camp must be a meaningful walk from the first.
test('a second camp is refused near the first and allowed far away', () => {
  const game = createGame('builder');
  game.resources.wood = 20;
  game.resources.stone = 20;
  const [a, b] = openSpots(game, 2);
  placeCampfire(game, a.x, a.y);
  const check = checkPlacement(game, b.x, b.y);
  assert.equal(check.reason, 'close');
  assert.equal(check.message, 'Too close to Hollowstead Camp');

  // The scout's start is more than CAMP_SPACING from the village.
  Object.assign(game.player, createGame('scout').player);
  const [c] = openSpots(game);
  const second = placeCampfire(game, c.x, c.y);
  assert.equal(second.camp.id, 'camp-2');
  assert.ok(Math.hypot(c.x - a.x, c.y - a.y) >= CAMP_SPACING);
});

// Guards the save limit, so a save never holds more camps than the loader accepts.
test('placing is refused once the camp limit is reached', () => {
  const game = createGame('builder'),
    far = createGame('scout').player;
  for (let i = 1; i <= MAX_CAMPS; i++)
    game.camps.push({ id: `camp-${i}`, name: `Camp ${i}`, x: far.x, y: far.y, grown: 0, needs: [] });
  assert.equal(checkPlacement(game, game.player.x, game.player.y + 150).reason, 'limit');
});

// Guards naming: a typed name replaces the suggestion; a blank name or unknown camp is refused.
test('a camp can be renamed with a tidied name, but not to nothing', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  const { camp } = placeCampfire(game, spot.x, spot.y);

  assert.deepEqual(nameCamp(game, camp.id, '  Ember   Hollow '), { ok: true, camp });
  assert.equal(camp.name, 'Ember Hollow');
  assert.deepEqual(nameCamp(game, camp.id, '   '), { ok: false, reason: 'empty' });
  assert.equal(camp.name, 'Ember Hollow');
  assert.deepEqual(nameCamp(game, 'camp-9', 'Nowhere'), { ok: false, reason: 'unknown' });
});

// Guards movement: a fire stops the player like a tree does. The same step is free without it.
test('the player cannot walk through a camp fire', () => {
  const game = createGame('builder');
  const [spot] = openSpots(game);
  const below = { x: spot.x, y: spot.y + 12, direction: 0 };

  const free = createGame('builder');
  free.player = { ...below };
  assert.ok(movePlayer(free, 0, -1, 0.1)); // the ground where the fire will stand is open

  placeCampfire(game, spot.x, spot.y);
  game.player = { ...below };
  assert.equal(movePlayer(game, 0, -1, 0.1), false);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/actions/build.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/actions/build.js`**

```js
// The "build" action: placing a campfire, which founds a new camp, and naming that camp.
// A placement is checked first, and the cost is paid only when the fire really goes down.

import {
  CAMPFIRE_COST,
  PLACE_RANGE,
  CAMP_SPACING,
  NODE_CLEARANCE,
  MAX_CAMPS,
} from '../data/balance.js';
import { isWalkable, blocks } from '../world/map.js';
import { NODES, nodeBases, goneSupplies } from '../world/nodes.js';
import { campBases, fireBase, suggestCampName, cleanCampName } from '../world/camps.js';
import { makeNeeds } from '../world/needs.js';

// The spacing, in world units, of the test points poked across a fire's base (see baseIsClear).
const PROBE = 16;

/**
 * Says whether a campfire's whole solid base would stand on open ground.
 *
 * It pokes test points every 16 units across the base, like checking a cake with a skewer, and
 * each one must be clear of water, scenery, standing supplies and other fires.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the fire.
 * @param {number} y - World y of the fire.
 * @returns {boolean} True when the whole base is clear.
 */
function baseIsClear(state, x, y) {
  const [left, top, right, bottom] = fireBase(x, y);
  const solid = [...nodeBases(goneSupplies(state)), ...campBases(state)];
  for (let py = top; py < bottom + PROBE; py += PROBE)
    for (let px = left; px < right + PROBE; px += PROBE)
      if (!isWalkable(Math.min(px, right), Math.min(py, bottom), solid)) return false;
  return true;
}

/**
 * Checks whether a campfire may be placed at a spot, without changing anything.
 *
 * The first rule that fails is the answer: not enough wood and stone, already as many camps as a
 * save can hold, too far from the player, something in the way, or too close to another camp.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the spot.
 * @param {number} y - World y of the spot.
 * @returns {{ok: boolean, reason?: string, message?: string}} `ok` when the fire may go there;
 *   otherwise `reason` ('cost', 'limit', 'far', 'blocked' or 'close') and a `message` to show.
 */
export function checkPlacement(state, x, y) {
  const { resources, player } = state;
  if (Object.entries(CAMPFIRE_COST).some(([type, amount]) => resources[type] < amount))
    return {
      ok: false,
      reason: 'cost',
      message: `Needs ${CAMPFIRE_COST.wood} wood and ${CAMPFIRE_COST.stone} stone`,
    };
  if (state.camps.length >= MAX_CAMPS)
    return { ok: false, reason: 'limit', message: "You can't keep more camps" };
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.hypot(x - player.x, y - player.y) > PLACE_RANGE
  )
    return { ok: false, reason: 'far', message: 'Too far away' };
  if (
    blocks([fireBase(x, y)], player.x, player.y) ||
    NODES.some((n) => Math.hypot(n.x - x, n.y - y) < NODE_CLEARANCE) ||
    !baseIsClear(state, x, y)
  )
    return { ok: false, reason: 'blocked', message: 'Something is in the way' };

  const near = state.camps.find((camp) => Math.hypot(camp.x - x, camp.y - y) < CAMP_SPACING);
  if (near) return { ok: false, reason: 'close', message: `Too close to ${near.name}` };
  return { ok: true };
}

/**
 * Places a campfire, founding a new camp with a suggested name and three needs.
 *
 * The spot is rounded to whole units and checked again, so a refused fire costs nothing. Like
 * paying at a till, the wood and stone leave the backpack only once the fire is really down.
 *
 * @param {object} state - The game being played. Resources and camps change on success.
 * @param {number} x - World x of the spot.
 * @param {number} y - World y of the spot.
 * @returns {{ok: boolean, camp?: object, reason?: string, message?: string}} The new camp, or the
 *   refusal from `checkPlacement`.
 */
export function placeCampfire(state, x, y) {
  const spot = { x: Math.round(x), y: Math.round(y) };
  const check = checkPlacement(state, spot.x, spot.y);
  if (!check.ok) return check;

  for (const [type, amount] of Object.entries(CAMPFIRE_COST)) state.resources[type] -= amount;
  const number = Math.max(0, ...state.camps.map((camp) => Number(camp.id.slice(5)))) + 1;
  const camp = {
    id: `camp-${number}`,
    name: suggestCampName(state, spot.x, spot.y),
    ...spot,
    grown: 0,
    needs: [],
  };
  camp.needs = makeNeeds(state, camp);
  state.camps.push(camp);
  return { ok: true, camp };
}

/**
 * Renames a camp to a name the player typed.
 *
 * @param {object} state - The game being played. The camp's name changes on success.
 * @param {string} campId - The camp's id.
 * @param {*} text - What the player typed; it is tidied first.
 * @returns {{ok: boolean, camp?: object, reason?: string}} The camp, or `reason` 'unknown' (no
 *   such camp) or 'empty' (nothing left after tidying).
 */
export function nameCamp(state, campId, text) {
  const camp = state.camps.find((c) => c.id === campId);
  if (!camp) return { ok: false, reason: 'unknown' };
  const name = cleanCampName(text);
  if (!name) return { ok: false, reason: 'empty' };
  camp.name = name;
  return { ok: true, camp };
}
```

- [ ] **Step 4: Make fires solid in `src/actions/move.js`**

- Header line 2: `trees, buildings, supplies that are standing, or campfires.`
- Add `import { campBases } from '../world/camps.js';` under the nodes import.
- Replace the bases comment and line with:

```js
  // Standing supplies and camp fires are solid. A save made before one stood here may put the
  // player inside its base; let them walk out instead of trapping them.
  const bases = [...nodeBases(goneSupplies(state)), ...campBases(state)].filter(
    (base) => !blocks([base], x, y),
  );
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/actions/build.test.js` → PASS; `npm test` → all PASS.
If `openSpots` cannot find two open spots near the builder's spawn, widen its ring search (more angles), not the rules.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/actions/build.js src/actions/move.js tests/actions/build.test.js
git commit -m "Place campfires that found named camps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/actions/build.js src/actions/move.js tests/actions/build.test.js
```

---

### Task 6: Survival tick and camp actions

**Files:**
- Create: `src/actions/survive.js`, `src/actions/camp.js`
- Test: `tests/actions/survive.test.js`, `tests/actions/camp.test.js`

**Interfaces:**
- Consumes: Task 1 constants and clock; Task 4 `byFire`, `nearestCamp`, `campInReach`, `campBases`, `refreshNeeds`, `meetNeed`; Task 3 `nodeBases`, `goneSupplies`.
- Produces (survive): `tickSurvival(state, dt): event[]`, `skipTo(state, time): event[]`, `startDay(state): {kind: 'dawn', day, camps: string[]}`, `meterTrends(state): {warmth: ''|'warming'|'tea'|'cold', health: ''|'freezing', hunger: ''|'starving'}`. Events: `{kind: 'dusk'}`, `{kind: 'night'}`, `{kind: 'freezing'}`, `{kind: 'starving'}`, `{kind: 'dawn', day, camps}`, `{kind: 'passout'}`.
- Produces (camp): `giveToNeed(state, campId, slot): {ok: true, camp, need} | {ok: false, reason: 'unknown'|'short'}`; `eat(state)`: reasons `'empty'|'full'`; `heal(state)`: `'full'|'short'`; `brewTea(state)`: `'away'|'active'|'short'`; `rest(state): {ok: true, events} | {ok: false, reason: 'away'|'day'}`; `passOut(state): {camp: camp|null, events}`. All successful single actions return `{ok: true}`.

- [ ] **Step 1: Write the failing survival tests** — create `tests/actions/survive.test.js`:

```js
// Checks surviving day and night: how warmth, hunger and health change with the hour and the
// fire, and which moments are reported to the player. These numbers decide whether the first
// night feels fair, so each rule is pinned here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_SECONDS,
  WARMTH_SECONDS,
  FREEZE_SECONDS,
  HUNGER_SECONDS,
  WARM_BY_FIRE,
  WARM_BY_DAY,
  HEAL_BY_FIRE,
  STARVING_COLD,
  TEA_SECONDS,
} from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { tickSurvival, skipTo, meterTrends } from '../../src/actions/survive.js';

/**
 * Makes a scout's game at a given clock time, with some meters set.
 *
 * @param {number} time - The world clock to start at.
 * @param {object} [meters={}] - Meter values to set, such as `{ warmth: 50 }`.
 * @returns {object} The game.
 */
function gameAt(time, meters = {}) {
  const game = createGame('scout');
  game.time = time;
  Object.assign(game.meters, meters);
  return game;
}

/**
 * Puts a camp fire right where the player stands, so they count as being by a fire. Its first
 * need is already met, for the dawn test.
 *
 * @param {object} game - The game to add the camp to.
 */
function lightFire(game) {
  game.camps.push({
    id: 'camp-1',
    name: 'Test Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [
      { kind: 'bring', resource: 'wood', amount: 4, done: true },
      { kind: 'place', region: 'frostpeak', done: false },
      { kind: 'signpost', done: false },
    ],
  });
}

/** True when two numbers are within a hair of each other. */
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Guards the clock: survival moves the world clock forward by exactly the time given, and a
// zero step changes nothing.
test('the survival tick moves the world clock forward', () => {
  const game = gameAt(100);
  tickSurvival(game, 0.5);
  assert.equal(game.time, 100.5);
  assert.deepEqual(tickSurvival(game, 0), []);
  assert.equal(game.time, 100.5);
});

// Guards the warmth rules by time of day, away from any fire.
test('away from a fire, warmth recovers by day, holds at dusk and drains at night', () => {
  const day = gameAt(100, { warmth: 50 });
  tickSurvival(day, 1);
  assert.ok(near(day.meters.warmth, 50 + WARM_BY_DAY));

  const dusk = gameAt(215, { warmth: 50 });
  tickSurvival(dusk, 1);
  assert.equal(dusk.meters.warmth, 50);

  const night = gameAt(250, { warmth: 50 });
  tickSurvival(night, 1);
  assert.ok(near(night.meters.warmth, 50 - 100 / WARMTH_SECONDS));
});

// Guards the fire: it warms at any hour and heals a fed player.
test('by a fire, warmth climbs fast and a fed player heals', () => {
  const game = gameAt(250, { warmth: 10, health: 40 });
  lightFire(game);
  tickSurvival(game, 1);
  assert.ok(near(game.meters.warmth, 10 + WARM_BY_FIRE));
  assert.ok(near(game.meters.health, 40 + HEAL_BY_FIRE));
});

// Guards hunger: it always falls, and an empty stomach makes the cold bite harder and stops healing.
test('hunger falls steadily; when empty, the cold is harsher and the fire stops healing', () => {
  const fed = gameAt(100, { hunger: 50 });
  tickSurvival(fed, 7.2);
  assert.ok(near(fed.meters.hunger, 50 - (100 / HUNGER_SECONDS) * 7.2));

  const starving = gameAt(250, { hunger: 0, warmth: 50 });
  tickSurvival(starving, 1);
  assert.ok(near(starving.meters.warmth, 50 - (100 / WARMTH_SECONDS) * STARVING_COLD));

  const resting = gameAt(250, { hunger: 0, health: 40 });
  lightFire(resting);
  tickSurvival(resting, 1);
  assert.equal(resting.meters.health, 40);
});

// Guards tea: it holds off the cold while it lasts, and only runs down while it protects.
test('tea stops warmth falling at night and only runs down while it protects', () => {
  const night = gameAt(250, { warmth: 50 });
  night.tea = TEA_SECONDS;
  tickSurvival(night, 5);
  assert.equal(night.meters.warmth, 50);
  assert.equal(night.tea, TEA_SECONDS - 5);

  const day = gameAt(100);
  day.tea = TEA_SECONDS;
  tickSurvival(day, 5);
  assert.equal(day.tea, TEA_SECONDS);
});

// Guards freezing: with no warmth left at night, health drains over 30 seconds; never by day.
test('freezing at night drains health', () => {
  const game = gameAt(250, { warmth: 0 });
  tickSurvival(game, 3);
  assert.ok(near(game.meters.health, 100 - (100 / FREEZE_SECONDS) * 3));

  const day = gameAt(100, { warmth: 0 });
  tickSurvival(day, 3);
  assert.equal(day.meters.health, 100);
});

// Guards the first-night pacing the GDD asks for: about 60 s of warmth, then 30 s of health.
test('a whole night away from any fire ends in passing out about 90 seconds after dark', () => {
  const game = gameAt(240);
  let passedOutAfter = null;
  for (let step = 0; step < 2400 && passedOutAfter === null; step++)
    if (tickSurvival(game, 0.05).some((e) => e.kind === 'passout')) passedOutAfter = game.time - 240;
  assert.ok(passedOutAfter !== null, 'never passed out');
  assert.ok(
    Math.abs(passedOutAfter - (WARMTH_SECONDS + FREEZE_SECONDS)) < 0.2,
    `passed out after ${passedOutAfter} s`,
  );
});

// Guards the HUD messages: each event is reported once, on the step where it happens, and the
// dusk and night warnings stay quiet for a player already by a fire.
test('dusk, night, freezing and starving are each reported once as they happen', () => {
  const game = gameAt(209.99);
  assert.deepEqual(
    tickSurvival(game, 0.02).map((e) => e.kind),
    ['dusk'],
  );
  assert.deepEqual(tickSurvival(game, 0.02), []);
  game.time = 239.99;
  assert.deepEqual(
    tickSurvival(game, 0.02).map((e) => e.kind),
    ['night'],
  );

  const warm = gameAt(209.99);
  lightFire(warm);
  assert.deepEqual(tickSurvival(warm, 0.02), []);

  const cold = gameAt(250, { warmth: 0.01 });
  assert.deepEqual(
    tickSurvival(cold, 0.05).map((e) => e.kind),
    ['freezing'],
  );
  const hungry = gameAt(100, { hunger: 0.001 });
  assert.deepEqual(
    tickSurvival(hungry, 0.05).map((e) => e.kind),
    ['starving'],
  );
});

// Guards the dawn update: crossing into a new day reports it and swaps the camps' met needs.
test('crossing into a new day reports dawn and refreshes met camp needs', () => {
  const game = gameAt(DAY_SECONDS - 0.01);
  lightFire(game);
  const events = tickSurvival(game, 0.02);
  assert.deepEqual(
    events.map((e) => e.kind),
    ['dawn'],
  );
  assert.equal(events[0].day, 2);
  assert.deepEqual(events[0].camps, ['Test Camp']);
  assert.equal(game.camps[0].needs[0].done, false);
});

// Guards the clock jumps used by resting and passing out: hunger keeps falling for the skipped
// time, a new day reports dawn, and the clock never runs backwards.
test('skipping time drains hunger for the skipped seconds and reports a new day', () => {
  const game = gameAt(300, { hunger: 50 });
  const events = skipTo(game, DAY_SECONDS);
  assert.equal(game.time, DAY_SECONDS);
  assert.ok(near(game.meters.hunger, 50 - (100 / HUNGER_SECONDS) * 60));
  assert.deepEqual(
    events.map((e) => e.kind),
    ['dawn'],
  );
  assert.deepEqual(skipTo(game, 10), []);
  assert.equal(game.time, DAY_SECONDS);
});

// Guards the HUD's cause words, so a falling meter always says why.
test('meter trends name the cause of each changing meter', () => {
  assert.deepEqual(meterTrends(gameAt(100)), { warmth: '', health: '', hunger: '' });
  assert.deepEqual(meterTrends(gameAt(250)), { warmth: 'cold', health: '', hunger: '' });
  assert.deepEqual(meterTrends(gameAt(250, { warmth: 0, hunger: 0 })), {
    warmth: 'cold',
    health: 'freezing',
    hunger: 'starving',
  });

  const tea = gameAt(250);
  tea.tea = 5;
  assert.equal(meterTrends(tea).warmth, 'tea');
  const warm = gameAt(250);
  lightFire(warm);
  assert.equal(meterTrends(warm).warmth, 'warming');
});
```

- [ ] **Step 2: Write the failing camp action tests** — create `tests/actions/camp.test.js`:

```js
// Checks the camp actions (give to a need, eat, heal, brew tea, rest) and passing out. Each one
// spends resources or moves the clock, so a slip here would cost the player supplies or time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_SECONDS,
  MIDDAY,
  FOOD_HUNGER,
  HEAL_HERBS,
  HEAL_HEALTH,
  TEA_HERBS,
  TEA_SECONDS,
  WAKE_HEALTH,
  WAKE_OFFSET,
} from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { giveToNeed, eat, heal, brewTea, rest, passOut } from '../../src/actions/camp.js';

/**
 * Makes a scout's game with one camp right where the player stands. Its first need asks for 3 stone.
 *
 * @returns {{game: object, camp: object}} The game and its camp.
 */
function campGame() {
  const game = createGame('scout');
  const camp = {
    id: 'camp-1',
    name: 'Pinefall Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [
      { kind: 'bring', resource: 'stone', amount: 3, done: false },
      { kind: 'place', region: 'frostpeak', done: false },
      { kind: 'signpost', done: false },
    ],
  };
  game.camps.push(camp);
  return { game, camp };
}

// Guards eating: one food buys 25 hunger (never past full), and refusals spend nothing.
test('eating spends one food for 25 hunger, but not when full or out of food', () => {
  const { game } = campGame(); // the scout carries 3 food
  assert.deepEqual(eat(game), { ok: false, reason: 'full' });
  game.meters.hunger = 50;
  assert.deepEqual(eat(game), { ok: true });
  assert.equal(game.meters.hunger, 50 + FOOD_HUNGER);
  assert.equal(game.resources.food, 2);

  game.meters.hunger = 90;
  eat(game);
  assert.equal(game.meters.hunger, 100);

  game.resources.food = 0;
  game.meters.hunger = 10;
  assert.deepEqual(eat(game), { ok: false, reason: 'empty' });
  assert.equal(game.meters.hunger, 10);
});

// Guards healing with herbs.
test('healing spends three herbs for 30 health, but not at full health or with too few herbs', () => {
  const { game } = campGame();
  game.resources.herbs = HEAL_HERBS;
  assert.deepEqual(heal(game), { ok: false, reason: 'full' });
  game.meters.health = 40;
  assert.deepEqual(heal(game), { ok: true });
  assert.equal(game.meters.health, 40 + HEAL_HEALTH);
  assert.equal(game.resources.herbs, 0);
  assert.deepEqual(heal(game), { ok: false, reason: 'short' });
});

// Guards tea: brewed only at a camp, for five herbs, one cup at a time.
test('tea is brewed at a camp for five herbs, one cup at a time', () => {
  const { game } = campGame();
  game.resources.herbs = TEA_HERBS * 2;
  assert.deepEqual(brewTea(game), { ok: true });
  assert.equal(game.tea, TEA_SECONDS);
  assert.equal(game.resources.herbs, TEA_HERBS);
  assert.deepEqual(brewTea(game), { ok: false, reason: 'active' });

  game.tea = 0;
  game.player.x += 1000;
  assert.deepEqual(brewTea(game), { ok: false, reason: 'away' });
  game.player.x -= 1000;
  game.resources.herbs = TEA_HERBS - 1;
  assert.deepEqual(brewTea(game), { ok: false, reason: 'short' });
});

// Guards giving: the exact amount is spent once, the need is met and the camp grows.
test('giving to a need spends the amount, meets the need and grows the camp', () => {
  const { game, camp } = campGame();
  game.resources.stone = 2;
  assert.deepEqual(giveToNeed(game, camp.id, 0), { ok: false, reason: 'short' });

  game.resources.stone = 5;
  const result = giveToNeed(game, camp.id, 0);
  assert.equal(result.ok, true);
  assert.equal(result.need, camp.needs[0]);
  assert.equal(game.resources.stone, 2);
  assert.equal(camp.needs[0].done, true);
  assert.equal(camp.grown, 1);

  assert.deepEqual(giveToNeed(game, camp.id, 0), { ok: false, reason: 'unknown' });
  assert.deepEqual(giveToNeed(game, camp.id, 1), { ok: false, reason: 'unknown' }); // finding needs can't be given
  assert.deepEqual(giveToNeed(game, 'camp-9', 0), { ok: false, reason: 'unknown' });
});

// Guards resting: only at a camp, only from dusk, and it ends at dawn, rested.
test('resting is allowed at a camp from dusk and wakes the player rested at dawn', () => {
  const { game } = campGame();
  game.time = 100;
  assert.deepEqual(rest(game), { ok: false, reason: 'day' });

  game.time = 300;
  Object.assign(game.meters, { health: 20, warmth: 30, hunger: 50 });
  const result = rest(game);
  assert.equal(result.ok, true);
  assert.equal(game.time, DAY_SECONDS);
  assert.equal(game.meters.health, 100);
  assert.equal(game.meters.warmth, 100);
  assert.ok(game.meters.hunger < 50);
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ['dawn'],
  );

  game.time = 300 + DAY_SECONDS;
  game.player.x += 1000;
  assert.deepEqual(rest(game), { ok: false, reason: 'away' });
});

// Guards passing out: wake beside the nearest fire at the next midday, with nothing taken away.
test('passing out wakes the player beside the nearest fire at the next midday', () => {
  const { game, camp } = campGame();
  game.time = 300;
  game.resources.wood = 7;
  game.tea = 4;
  game.player.x += 2000; // fell far from camp

  const result = passOut(game);
  assert.equal(result.camp, camp);
  assert.equal(game.time, DAY_SECONDS + MIDDAY);
  assert.ok(Math.hypot(game.player.x - camp.x, game.player.y - camp.y) <= WAKE_OFFSET);
  assert.equal(game.meters.health, WAKE_HEALTH);
  assert.equal(game.meters.warmth, 100);
  assert.equal(game.tea, 0);
  assert.equal(game.resources.wood, 7);
  assert.equal(game.camps.length, 1);
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ['dawn'],
  );
});

// Guards the no-camp case: without a fire, the player wakes at their starting spot.
test('passing out with no camp wakes the player at their spawn', () => {
  const game = createGame('survivor');
  const spawn = { ...game.player };
  game.time = 300;
  game.player.x += 500;
  assert.equal(passOut(game).camp, null);
  assert.equal(game.player.x, spawn.x);
  assert.equal(game.player.y, spawn.y);
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test tests/actions/survive.test.js tests/actions/camp.test.js`
Expected: FAIL (modules not found).

- [ ] **Step 4: Create `src/actions/survive.js`**

```js
// Surviving day and night: moves the world clock forward and changes warmth, hunger and health
// to match where the player is and what time it is. It reports the moments worth telling the
// player about (dusk falling, freezing, passing out, a new day) as "events" for the HUD.

import {
  WARMTH_SECONDS,
  STARVING_COLD,
  WARM_BY_FIRE,
  WARM_BY_DAY,
  FREEZE_SECONDS,
  HEAL_BY_FIRE,
  HUNGER_SECONDS,
} from '../data/balance.js';
import { dayOf, phaseOf } from '../world/clock.js';
import { byFire } from '../world/camps.js';
import { refreshNeeds } from '../world/needs.js';

/**
 * Keeps a meter between 0 and 100.
 *
 * @param {number} value - The meter's new value.
 * @returns {number} The value, clamped.
 */
const clamp = (value) => Math.min(100, Math.max(0, value));

/**
 * Runs the dawn update for a new day: every camp swaps its met needs for new ones.
 *
 * @param {object} state - The game being played. Camp needs may change.
 * @returns {{kind: string, day: number, camps: string[]}} A `dawn` event naming the day and the
 *   camps whose needs changed.
 */
export function startDay(state) {
  const camps = refreshNeeds(state).map((camp) => camp.name);
  return { kind: 'dawn', day: dayOf(state.time), camps };
}

/**
 * Moves the world forward by one small step of time and updates the three meters.
 *
 * Think of the meters as three buckets. Hunger always drips out slowly. Warmth fills up by a fire
 * and in daylight, holds at dusk, and drains at night away from a fire (faster on an empty
 * stomach) unless tea holds the cold off. Health drains while freezing and refills slowly by a
 * fire for a player who isn't starving.
 *
 * @param {object} state - The game being played. `time`, `meters`, `tea` and camp needs change.
 * @param {number} dt - Seconds of game time to move forward.
 * @returns {object[]} What happened in this step: `{kind: 'dusk'}`, `{kind: 'night'}`,
 *   `{kind: 'freezing'}`, `{kind: 'starving'}`, `{kind: 'dawn', day, camps}` or `{kind: 'passout'}`.
 */
export function tickSurvival(state, dt) {
  if (!(dt > 0)) return [];
  const { meters } = state;
  const before = { phase: phaseOf(state.time), day: dayOf(state.time), ...meters };
  state.time += dt;
  const phase = phaseOf(state.time),
    warm = byFire(state),
    starving = meters.hunger <= 0;

  // Hunger always falls.
  meters.hunger = clamp(meters.hunger - (100 / HUNGER_SECONDS) * dt);

  // Warmth: up by a fire, up in daylight, steady at dusk, down at night unless tea holds it off.
  const chill = (100 / WARMTH_SECONDS) * (starving ? STARVING_COLD : 1);
  if (warm) meters.warmth = clamp(meters.warmth + WARM_BY_FIRE * dt);
  else if (phase === 'night' && state.tea > 0) state.tea = Math.max(0, state.tea - dt);
  else if (phase === 'night') meters.warmth = clamp(meters.warmth - chill * dt);
  else if (phase !== 'dusk') meters.warmth = clamp(meters.warmth + WARM_BY_DAY * dt);

  // Health: down while freezing, slowly up by a fire for a fed player.
  if (!warm && phase === 'night' && meters.warmth <= 0)
    meters.health = clamp(meters.health - (100 / FREEZE_SECONDS) * dt);
  else if (warm && meters.hunger > 0) meters.health = clamp(meters.health + HEAL_BY_FIRE * dt);

  // Report each moment once, on the step where it happens.
  const events = [];
  if (phase !== before.phase && (phase === 'dusk' || phase === 'night') && !warm)
    events.push({ kind: phase });
  if (before.warmth > 0 && meters.warmth <= 0) events.push({ kind: 'freezing' });
  if (before.hunger > 0 && meters.hunger <= 0) events.push({ kind: 'starving' });
  if (dayOf(state.time) > before.day) events.push(startDay(state));
  if (before.health > 0 && meters.health <= 0) events.push({ kind: 'passout' });
  return events;
}

/**
 * Jumps the world clock forward, as when resting through the night or passing out.
 *
 * Nobody is out in the cold while the clock jumps, so only hunger changes: it falls for the
 * skipped time. Crossing into a new day runs the dawn update.
 *
 * @param {object} state - The game being played. `time`, hunger and camp needs may change.
 * @param {number} time - The world clock to jump to. A time that isn't ahead does nothing.
 * @returns {object[]} A `starving` event if the stomach ran empty, and a `dawn` event if a new day began.
 */
export function skipTo(state, time) {
  if (!(time > state.time)) return [];
  const { meters } = state,
    day = dayOf(state.time),
    fed = meters.hunger > 0;
  meters.hunger = clamp(meters.hunger - (100 / HUNGER_SECONDS) * (time - state.time));
  state.time = time;

  const events = [];
  if (fed && meters.hunger <= 0) events.push({ kind: 'starving' });
  if (dayOf(time) > day) events.push(startDay(state));
  return events;
}

/**
 * Says why each meter is changing, for the small word beside it on the HUD.
 *
 * @param {object} state - The game being played.
 * @returns {{warmth: string, health: string, hunger: string}} Warmth: 'warming' by a fire, 'tea'
 *   while tea holds off the night's cold, 'cold' while it drains. Health: 'freezing'. Hunger:
 *   'starving'. An empty string means there is nothing to say.
 */
export function meterTrends(state) {
  const night = phaseOf(state.time) === 'night',
    warm = byFire(state);
  let warmth = '';
  if (warm) warmth = 'warming';
  else if (night) warmth = state.tea > 0 ? 'tea' : 'cold';
  return {
    warmth,
    health: !warm && night && state.meters.warmth <= 0 ? 'freezing' : '',
    hunger: state.meters.hunger <= 0 ? 'starving' : '',
  };
}
```

- [ ] **Step 5: Create `src/actions/camp.js`**

```js
// Camp actions: what the player can do with their backpack and at their camps (give to a need,
// eat, heal, brew tea, rest through the night) and what happens when they pass out from the cold.
// Each one checks first and changes nothing when it says no.

import { CHARACTERS } from '../data/characters.js';
import {
  FOOD_HUNGER,
  HEAL_HERBS,
  HEAL_HEALTH,
  TEA_HERBS,
  TEA_SECONDS,
  WAKE_HEALTH,
  WAKE_OFFSET,
} from '../data/balance.js';
import { isWalkable } from '../world/map.js';
import { nodeBases, goneSupplies } from '../world/nodes.js';
import { nearestCamp, campInReach, campBases } from '../world/camps.js';
import { meetNeed } from '../world/needs.js';
import { nextDawn, nextMidday, phaseOf } from '../world/clock.js';
import { skipTo } from './survive.js';

/**
 * Hands over the resources a camp's need asks for, which meets the need and grows the fire.
 *
 * @param {object} state - The game being played. Resources and the camp change on success.
 * @param {string} campId - The camp's id.
 * @param {number} slot - Which need in its list: 0, 1 or 2.
 * @returns {{ok: boolean, camp?: object, need?: object, reason?: string}} The camp and need on
 *   success; otherwise `reason` 'unknown' (no such open resource need) or 'short' (not enough).
 */
export function giveToNeed(state, campId, slot) {
  const camp = state.camps.find((c) => c.id === campId),
    need = camp?.needs[slot];
  if (!need || need.kind !== 'bring' || need.done) return { ok: false, reason: 'unknown' };
  if (state.resources[need.resource] < need.amount) return { ok: false, reason: 'short' };

  state.resources[need.resource] -= need.amount;
  meetNeed(camp, need);
  return { ok: true, camp, need };
}

/**
 * Eats one food from the backpack.
 *
 * @param {object} state - The game being played. Food and hunger change on success.
 * @returns {{ok: boolean, reason?: string}} `reason` is 'empty' (no food) or 'full' (not hungry).
 */
export function eat(state) {
  if (state.resources.food < 1) return { ok: false, reason: 'empty' };
  if (state.meters.hunger >= 100) return { ok: false, reason: 'full' };
  state.resources.food -= 1;
  state.meters.hunger = Math.min(100, state.meters.hunger + FOOD_HUNGER);
  return { ok: true };
}

/**
 * Uses herbs to heal.
 *
 * @param {object} state - The game being played. Herbs and health change on success.
 * @returns {{ok: boolean, reason?: string}} `reason` is 'full' (already healthy) or 'short' (too few herbs).
 */
export function heal(state) {
  if (state.meters.health >= 100) return { ok: false, reason: 'full' };
  if (state.resources.herbs < HEAL_HERBS) return { ok: false, reason: 'short' };
  state.resources.herbs -= HEAL_HERBS;
  state.meters.health = Math.min(100, state.meters.health + HEAL_HEALTH);
  return { ok: true };
}

/**
 * Brews a cup of herbal tea at a camp, which holds off the night's cold for a while.
 *
 * Like a hot water bottle, it only works while it is warm: one cup at a time, and the next can
 * only be brewed once this one has run out.
 *
 * @param {object} state - The game being played. Herbs and `tea` change on success.
 * @returns {{ok: boolean, reason?: string}} `reason` is 'away' (not at a camp), 'active' (a cup
 *   is still working) or 'short' (too few herbs).
 */
export function brewTea(state) {
  if (!campInReach(state)) return { ok: false, reason: 'away' };
  if (state.tea > 0) return { ok: false, reason: 'active' };
  if (state.resources.herbs < TEA_HERBS) return { ok: false, reason: 'short' };
  state.resources.herbs -= TEA_HERBS;
  state.tea = TEA_SECONDS;
  return { ok: true };
}

/**
 * Rests at a camp through the night, waking rested at dawn.
 *
 * Only from dusk onwards, so it can't be used to skip the day.
 *
 * @param {object} state - The game being played. The clock jumps; health and warmth fill up.
 * @returns {{ok: boolean, events?: object[], reason?: string}} The events of the skipped time on
 *   success; otherwise `reason` 'away' (not at a camp) or 'day' (too early to sleep).
 */
export function rest(state) {
  if (!campInReach(state)) return { ok: false, reason: 'away' };
  const phase = phaseOf(state.time);
  if (phase !== 'dusk' && phase !== 'night') return { ok: false, reason: 'day' };

  const events = skipTo(state, nextDawn(state.time));
  Object.assign(state.meters, { health: 100, warmth: 100 });
  return { ok: true, events };
}

/**
 * Picks where to wake beside a fire: the first open spot south, west, east or north of it.
 *
 * @param {object} state - The game being played.
 * @param {object} camp - The camp to wake at.
 * @returns {{x: number, y: number}} A walkable spot, or the fire's own spot if all four are blocked.
 */
function wakeSpot(state, camp) {
  const solid = [...nodeBases(goneSupplies(state)), ...campBases(state)];
  for (const [dx, dy] of [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
  ]) {
    const x = camp.x + dx * WAKE_OFFSET,
      y = camp.y + dy * WAKE_OFFSET;
    if (isWalkable(x, y, solid)) return { x, y };
  }
  return { x: camp.x, y: camp.y };
}

/**
 * Passes the player out from the cold: they lose the morning and wake somewhere warm.
 *
 * Nothing is taken away: resources, camps and finds all stay. The clock jumps to the next midday
 * and the player wakes beside the camp fire nearest to where they fell (or at their starting
 * spot if they have no camp yet) with half their health, full warmth and no tea.
 *
 * @param {object} state - The game being played. The clock, position, meters and tea change.
 * @returns {{camp: object|null, events: object[]}} The camp they woke at (null for the spawn),
 *   and the events of the skipped time.
 */
export function passOut(state) {
  const camp = nearestCamp(state);
  const spot = camp
    ? wakeSpot(state, camp)
    : CHARACTERS.find((c) => c.id === state.character).spawn;
  const events = skipTo(state, nextMidday(state.time));
  Object.assign(state.player, { x: spot.x, y: spot.y, direction: 0 });
  Object.assign(state.meters, { health: WAKE_HEALTH, warmth: 100 });
  state.tea = 0;
  return { camp, events };
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/actions/survive.test.js tests/actions/camp.test.js` → PASS; `npm test` → all PASS.

- [ ] **Step 7: Format and commit**

```bash
npm run format
git add src/actions/survive.js src/actions/camp.js tests/actions/survive.test.js tests/actions/camp.test.js
git commit -m "Add the survival tick and the camp actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/actions/survive.js src/actions/camp.js tests/actions/survive.test.js tests/actions/camp.test.js
```

---

### Task 7: Maps with fog and camps

**Files:**
- Create: `src/render/maps.js`
- Modify: `src/render/renderer.js`, `src/ui/dialogs.js`, `src/ui/layout.js`, `src/style.css`

**Interfaces:**
- Consumes: Task 2 `FOG_GRID`, `fogCells`; state `camps` and `fog`.
- Produces: `drawMap(ctx, overview, state, w, h, local = false)` in `render/maps.js`. The renderer's public `drawMap(canvas, state)` is unchanged.

No unit test: this is drawing code (CLAUDE.md: rendering is verified in the browser).

- [ ] **Step 1: Create `src/render/maps.js`**

Move `drawMap` out of `renderer.js`, take the overview picture as a parameter, replace the region dimming with fog, and add camps:

```js
// The maps: the corner minimap and the big world map, painted on plain 2D canvases. They show
// the overview picture under the fog of war, the places, signposts and camps the player knows
// about, and the player. The renderer and the map dialog both call `drawMap`.

import { WORLD } from '../world/map.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import { FOG_CELL } from '../data/balance.js';
import { FOG_GRID, fogCells } from '../world/fog.js';

// How many world units wide the corner minimap shows. The whole world would be too small to read.
const MINI_VIEW = 4096;

// The fog's colour (a deep green-grey) and how solid it is, as red, green, blue, alpha (0-255).
const FOG_RGBA = [38, 54, 45, 242];

// The fog picture: one pixel per fog square, remade only when the fog string changes.
const fogPicture = { fog: null, canvas: null };

/**
 * Makes (or reuses) a tiny picture of the fog: one pixel per square, clear where seen, dark where not.
 *
 * Stretched over the map with smoothing on, its square pixels blur into soft edges, like frost on
 * a window that is clear where you have wiped it.
 *
 * @param {string} fog - The character's fog string.
 * @returns {HTMLCanvasElement} The picture, FOG_GRID.cols by FOG_GRID.rows pixels.
 */
function fogCanvas(fog) {
  if (fogPicture.fog === fog) return fogPicture.canvas;
  const canvas = fogPicture.canvas ?? document.createElement('canvas');
  canvas.width = FOG_GRID.cols;
  canvas.height = FOG_GRID.rows;
  const ctx = canvas.getContext('2d'),
    image = ctx.createImageData(FOG_GRID.cols, FOG_GRID.rows);
  fogCells(fog).forEach((seen, i) => {
    if (!seen) image.data.set(FOG_RGBA, i * 4);
  });
  ctx.putImageData(image, 0, 0);
  Object.assign(fogPicture, { fog, canvas });
  return canvas;
}

/**
 * Paints a map: either the whole world, or a window around the player for the corner minimap.
 *
 * World positions are shrunk to fit the canvas, like tracing a big map onto a postcard. Parts of
 * the world the player hasn't seen are under fog. Found places are cream dots, found signposts
 * gold diamonds, camps orange dots (named on the big map), and the player is the white dot.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas to paint on.
 * @param {HTMLImageElement} overview - The picture of the whole world (overview.webp).
 * @param {object} state - The game being played.
 * @param {number} w - Canvas width in pixels.
 * @param {number} h - Canvas height in pixels.
 * @param {boolean} [local=false] - True to show only the area around the player.
 */
export function drawMap(ctx, overview, state, w, h, local = false) {
  // The part of the world this map shows, in world units.
  const vw = local ? MINI_VIEW : WORLD.width,
    vh = local ? (MINI_VIEW * h) / w : WORLD.height,
    vx = local ? Math.min(Math.max(state.player.x - vw / 2, 0), WORLD.width - vw) : 0,
    vy = local ? Math.min(Math.max(state.player.y - vh / 2, 0), WORLD.height - vh) : 0;
  const sx = overview.width / WORLD.width,
    sy = overview.height / WORLD.height;
  /** Turns a world x position into a canvas x position. */
  const px = (x) => ((x - vx) / vw) * w,
    py = (y) => ((y - vy) / vh) * h;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(overview, vx * sx, vy * sy, vw * sx, vh * sy, 0, 0, w, h);

  // The fog: its tiny picture stretched over the same part of the world, smoothed for soft edges.
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    fogCanvas(state.fog),
    vx / FOG_CELL,
    vy / FOG_CELL,
    vw / FOG_CELL,
    vh / FOG_CELL,
    0,
    0,
    w,
    h,
  );

  // Found places: small cream dots.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#294c3b';
  ctx.fillStyle = '#f7ecc5';
  for (const place of LANDMARKS) {
    if (!state.landmarks.includes(place.id)) continue;
    ctx.beginPath();
    ctx.arc(px(place.x), py(place.y), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Found signposts: gold diamonds. On the big map a button sits over each one (ui/dialogs.js).
  ctx.fillStyle = '#ffd166';
  for (const post of WAYPOINTS) {
    if (!state.waypoints.includes(post.id)) continue;
    const x = px(post.x),
      y = py(post.y);
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Camps: orange dots. The big map also writes each camp's name above its dot.
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const camp of state.camps) {
    const x = px(camp.x),
      y = py(camp.y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#3b2412';
    ctx.fillStyle = '#f08a3c';
    ctx.beginPath();
    ctx.arc(x, y, local ? 4 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (local) continue;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#263b31';
    ctx.strokeText(camp.name, x, y - 12);
    ctx.fillStyle = '#fff6df';
    ctx.fillText(camp.name, x, y - 12);
  }

  // The player.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#294c3b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px(state.player.x), py(state.player.y), 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
```

- [ ] **Step 2: Use it from `src/render/renderer.js`**

- Header line 3: `` This file also paints the minimap through render/maps.js. ``
- Imports: delete `import { REGIONS, REGION_GRID, regionIndexAt } from '../world/regions.js';` and `import { LANDMARKS, WAYPOINTS } from '../data/places.js';`; add `import { drawMap } from './maps.js';`.
- Delete the `MINI_VIEW` constant and its comment.
- Delete the whole `drawMap` function (its JSDoc and body, currently lines 259-337).
- In `draw`, replace `drawMap(mini, state, miniCanvas.width, miniCanvas.height, true);` with `drawMap(mini, overview, state, miniCanvas.width, miniCanvas.height, true);`.
- In the returned object, replace the `drawMap` property with:

```js
    /**
     * Paints the world map onto any canvas, at that canvas's own size.
     *
     * @param {HTMLCanvasElement} canvas - The canvas to paint, e.g. the big map dialog's.
     * @param {object} state - The game being played.
     */
    drawMap: (canvas, state) =>
      drawMap(canvas.getContext('2d'), overview, state, canvas.width, canvas.height),
```

- [ ] **Step 3: Show region names only once discovered**

In `src/ui/layout.js`, in the map dialog's region labels, add `data-region="${l.id}"` to each `<span class="map-label" ...>`. Replace the map footer's first span with:

```js
        <span>● You · <b class="legend-camp">●</b> Camp · ◆ Signpost: click to travel</span
```

(keep the following `><span id="map-discovered">` exactly as it is).

In `src/ui/dialogs.js` `toggleMap`, after `showWaypoints();` add:

```js
    // Region names show on the map only once the player has been there.
    for (const label of document.querySelectorAll('.map-label'))
      label.hidden = !session.state.discovered.includes(label.dataset.region);
```

In `src/style.css`, after the `.map-label` rule add:

```css
/* A region's name stays hidden until the player has been there (ui/dialogs.js sets hidden). */
.map-label[hidden] {
  display: none;
}

/* The orange dot for camps in the map's key. */
.legend-camp {
  color: #f08a3c;
}
```

- [ ] **Step 4: Check in the browser**

Run `npm test` (all pass), then start the `wildhaven` launch config at `http://127.0.0.1:5173` and play the Scout: the minimap shows fog beyond about 1,000 units and clears as you walk; the world map (M) shows fog outside walked areas, only discovered region names, and no console errors.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/render/maps.js src/render/renderer.js src/ui/dialogs.js src/ui/layout.js src/style.css
git commit -m "Draw the maps under a fog of war that lifts where you walk" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/render/maps.js src/render/renderer.js src/ui/dialogs.js src/ui/layout.js src/style.css
```

---

### Task 8: Night lighting, campfire sprites and build mode

**Files:**
- Create: `src/render/lighting.js`, `src/core/build.js`, `src/ui/camp.js`
- Modify: `src/render/renderer.js`, `src/core/session.js`, `src/core/input.js`, `src/core/loop.js`, `src/ui/hud.js`, `src/ui/layout.js`, `src/ui/dialogs.js`, `src/main.js`, `src/style.css`

**Interfaces:**
- Consumes: Task 1 `darknessAt`; Task 4 `fireRadius`; Task 5 `checkPlacement`, `placeCampfire`, `nameCamp`.
- Produces: `createLighting(scene, reducedMotion): {draw(state, area)}`; renderer `draw(state, dt, animator, build = null)` and `screenToWorld(clientX, clientY): {x, y}`; `session.build = {active, x, y, check}` and `session.pointer = {x, y} | null`; `setupBuild(session, ui): {toggle, cancel, place, update}` as `ui.build`; `setupCamp(session, ui): {openNaming}` as `ui.camp` (Task 9 adds more).

- [ ] **Step 1: Create `src/render/lighting.js`**

```js
// Night lighting: a dark layer laid over the world that thickens at dusk and night, with soft
// holes of light around each campfire (as wide as its warmth reaches) and a small glow around the
// player. Like shining torches through a dark blanket, the lights burn clear patches into it.

import * as Phaser from 'phaser';
import { WORLD } from '../world/map.js';
import { darknessAt } from '../world/clock.js';
import { fireRadius } from '../world/camps.js';

// The night's colour (a deep blue), the glow around the player (world units), the light picture's
// size (pixels), and how far past the screen edge the dark layer reaches (world units).
const NIGHT_COLOR = 0x0b1630,
  PLAYER_LIGHT = 150,
  LIGHT_SIZE = 256,
  EDGE = 64;

// The dark layer sits above everything in the world, but below the E key cap and progress bar.
const DEPTH = WORLD.height + 0.5;

/**
 * Builds the night layer for the world scene.
 *
 * @param {Phaser.Scene} scene - The world scene.
 * @param {boolean} reducedMotion - True when the player asked for less motion: fires don't flicker.
 * @returns {{draw: Function}} `draw(state, area)` updates the layer for one frame.
 */
export function createLighting(scene, reducedMotion) {
  // A round light: solid in the middle, fading to nothing at the edge. Painted once.
  const light = scene.textures.createCanvas('night-light', LIGHT_SIZE, LIGHT_SIZE);
  const ctx = light.getContext(),
    half = LIGHT_SIZE / 2,
    gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LIGHT_SIZE, LIGHT_SIZE);
  light.refresh();

  // WebGL can cut lights out of a render texture. The Canvas renderer gets a plain dim layer.
  const webgl = scene.renderer.type === Phaser.WEBGL;
  const layer = webgl
    ? scene.add.renderTexture(0, 0, 2, 2)
    : scene.add.rectangle(0, 0, 2, 2, NIGHT_COLOR);
  layer.setOrigin(0, 0).setDepth(DEPTH).setVisible(false);
  const stamp = scene.make.image({ key: 'night-light' }, false).setOrigin(0.5);

  // Warm orange glows over the fires, made the first time each is needed and reused after.
  const glows = [];

  /**
   * Gives the warm glow for one fire, making it the first time.
   *
   * @param {number} i - Which glow, counting from 0.
   * @returns {Phaser.GameObjects.Image} The glow picture.
   */
  function glowAt(i) {
    glows[i] ??= scene.add
      .image(0, 0, 'night-light')
      .setTint(0xff9a3c)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH + 0.01);
    return glows[i];
  }

  /**
   * Redraws the night layer for this frame.
   *
   * @param {object} state - The game being played (its clock, camps and player).
   * @param {{x: number, y: number, width: number, height: number}} area - The part of the world
   *   the camera shows, in world units.
   */
  function draw(state, area) {
    const darkness = darknessAt(state.time);
    layer.setVisible(darkness > 0);
    for (const glow of glows) glow.setVisible(false);
    if (darkness <= 0) return;

    // Cover the camera's view plus a margin. Even sizes stop the render texture resizing every frame.
    const left = area.x - EDGE,
      top = area.y - EDGE,
      width = 2 * Math.ceil(area.width / 2 + EDGE),
      height = 2 * Math.ceil(area.height / 2 + EDGE);
    layer.setPosition(left, top);
    if (!webgl) {
      layer.setSize(width, height).setFillStyle(NIGHT_COLOR, darkness);
      return;
    }
    if (layer.width !== width || layer.height !== height) layer.resize(width, height);

    // Fill the dark, then erase a soft hole as wide as each fire's warmth, and a small one for the player.
    const flicker = reducedMotion ? 1 : 1 + Math.sin(performance.now() / 110) * 0.025;
    layer.clear().fill(NIGHT_COLOR, darkness);
    state.camps.forEach((camp, i) => {
      const radius = fireRadius(camp) * flicker;
      stamp.setScale((radius * 2) / LIGHT_SIZE);
      layer.erase(stamp, camp.x - left, camp.y - top);
      glowAt(i)
        .setPosition(camp.x, camp.y - 30)
        .setScale((radius * 1.1) / LIGHT_SIZE)
        .setAlpha((0.45 * darkness) / 0.6)
        .setVisible(true);
    });
    stamp.setScale((PLAYER_LIGHT * 2) / LIGHT_SIZE);
    layer.erase(stamp, state.player.x - left, state.player.y - 40 - top);
    layer.render();
  }

  return { draw };
}
```

- [ ] **Step 2: Draw fires, the build ghost and the night in `src/render/renderer.js`**

- Imports: add `import { createLighting } from './lighting.js';` and `import { FIRE_RADIUS } from '../data/balance.js';`.
- Change the scene-object comment and `let` list to include the new objects:

```js
  // Scene objects filled in by create() below. `snap` makes the next draw skip fade animations.
  // `chunks` maps a chunk key to the scenery images in it; `shown` holds the keys now visible.
  // `fires` maps "<character>:<camp id>" to that camp's campfire sprite.
  let player,
    shadow,
    supplies,
    cue,
    bar,
    ghost,
    ring,
    lighting,
    webgl = false,
    snap = true,
    shown = new Set();
  const chunks = new Map(),
    fires = new Map();
```

- In `create()`, after the line that makes `player`, add:

```js
        // The ghost campfire shown while placing one, and the ring of warmth it would give.
        // Both sit above the night layer so they stay visible in the dark.
        ghost = this.add
          .image(0, 0, 'object-campfire')
          .setOrigin(...objectSpecs.campfire.origin)
          .setAlpha(0.75)
          .setDepth(WORLD.height + 0.75)
          .setVisible(false);
        ring = this.add.graphics().setDepth(WORLD.height + 0.74);

        // The night layer and the light around fires (render/lighting.js).
        lighting = createLighting(this, reducedMotion);
```

- Change `draw`'s signature and JSDoc to `function draw(state, dt, animator, build = null)` with the extra param `@param {object|null} [build=null] - Build mode from the session: when \`active\`, the ghost is drawn at \`x\`/\`y\`, coloured by \`check.ok\`.` and add to its description: `Camp fires are drawn, the build ghost follows the pointer, and the night layer goes over everything.`
- In `draw`, right after the chunk-culling block (`shown = next;`), add:

```js
    // Campfires: one sprite per camp, made when the camp is founded. Keys include the character,
    // so switching characters never reuses another character's fire.
    const fireKeys = new Set(state.camps.map((camp) => `${state.character}:${camp.id}`));
    for (const [key, sprite] of fires)
      if (!fireKeys.has(key)) {
        sprite.destroy();
        fires.delete(key);
      }
    for (const camp of state.camps) {
      const key = `${state.character}:${camp.id}`;
      if (!fires.has(key))
        fires.set(
          key,
          scene.add
            .image(camp.x, camp.y, 'object-campfire')
            .setOrigin(...objectSpecs.campfire.origin)
            .setDepth(camp.y),
        );
    }
```

- In `draw`, after the shadow line (`shadow.setPosition(...)`) and before the minimap call, add:

```js
    // The ghost campfire while placing one: tinted green where it may stand and red where it may
    // not, with a ring showing how far a new fire's warmth reaches.
    ring.clear();
    ghost.setVisible(!!build?.active);
    if (build?.active) {
      const ok = !!build.check?.ok;
      ghost.setPosition(build.x, build.y).setTint(ok ? 0xb6f0a0 : 0xff8a7a);
      ring.lineStyle(2, ok ? 0xf7f1de : 0xff8a7a, 0.85).strokeCircle(build.x, build.y, FIRE_RADIUS);
    }

    // Night: the dark layer covers what the camera sees. The camera stops at the world's edge,
    // so the covered area is kept inside the world the same way.
    const halfW = view.width / zoom / 2,
      halfH = view.height / zoom / 2;
    lighting.draw(state, {
      x: Math.min(Math.max(camera.x, halfW), WORLD.width - halfW) - halfW,
      y: Math.min(Math.max(camera.y, halfH), WORLD.height - halfH) - halfH,
      width: halfW * 2,
      height: halfH * 2,
    });
```

- In the returned object, after `drawMap`, add:

```js
    /**
     * Turns a spot on the screen (such as the mouse) into a spot in the world.
     *
     * @param {number} clientX - Pixels from the left edge of the page.
     * @param {number} clientY - Pixels from the top edge of the page.
     * @returns {{x: number, y: number}} The world position under that spot.
     */
    screenToWorld: (clientX, clientY) => {
      const box = scene.game.canvas.getBoundingClientRect();
      const point = scene.cameras.main.getWorldPoint(clientX - box.left, clientY - box.top);
      return { x: point.x, y: point.y };
    },
```

- Update the `createRenderer` `@returns` line to mention `screenToWorld(clientX, clientY)`.

- [ ] **Step 3: Add build mode to the session (`src/core/session.js`)**

In `createSession`, add to the returned object (after `clock`):

```js
    build: { active: false, x: 0, y: 0, check: null },
    pointer: null,
```

and extend its `@returns` text: `` ..., held keys, frame clock, build mode (`build`: on or off, the ghost's spot and its placement check; never saved) and the mouse position over the world (`pointer`, or null). ``
In `start()`, after `session.animator = createAnimator();` add `session.build.active = false;`. In `leave()`, after `session.saveSession = null;` add `session.build.active = false;`.

- [ ] **Step 4: Create `src/core/build.js`**

```js
// Build mode: placing a campfire with the mouse (or in front of the player). While it is on, a
// ghost campfire follows the pointer and shows whether it may stand there; a click or E places it.
// The rules for where a fire may go live in actions/build.js; this file only drives them.

import { checkPlacement, placeCampfire } from '../actions/build.js';
import { cancelAction } from '../animation/clips.js';
import { save } from './session.js';

// How far in front of the player the ghost sits when there is no mouse to follow, in world units.
const AHEAD = 120;

// Which way each facing direction points, as [x, y] steps (0 south, 1 west, 2 east, 3 north).
const FACING = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
];

/**
 * Sets up build mode for one session.
 *
 * @param {object} session - The shared session; its `build` record and `pointer` are used here.
 * @param {object} ui - The other UI parts (`hud`, `camp`).
 * @returns {{toggle: Function, cancel: Function, place: Function, update: Function}} Ways to
 *   switch build mode on or off, leave it, place the fire, and move the ghost each frame.
 */
export function setupBuild(session, ui) {
  const { build } = session;

  /** Leaves build mode without placing anything. */
  function cancel() {
    if (!build.active) return;
    build.active = false;
    ui.hud.update();
  }

  /**
   * Moves the ghost to where it should be this frame and checks whether a fire may stand there.
   *
   * It follows the mouse while the mouse is over the world; otherwise it sits a step in front of
   * the player, so keyboard and touch players can build too.
   */
  function update() {
    if (!build.active || !session.state) return;
    const { player } = session.state;
    const spot =
      session.pointer && session.renderer?.screenToWorld(session.pointer.x, session.pointer.y);
    const [fx, fy] = FACING[player.direction];
    build.x = Math.round(spot ? spot.x : player.x + fx * AHEAD);
    build.y = Math.round(spot ? spot.y : player.y + fy * AHEAD);
    build.check = checkPlacement(session.state, build.x, build.y);
  }

  /** Turns build mode on, or off again. Turning it on drops any gathering in progress. */
  function toggle() {
    if (session.screen !== 'game' || !session.state) return;
    if (build.active) return cancel();
    cancelAction(session.animator);
    build.active = true;
    update();
    ui.hud.update();
  }

  /**
   * Places the campfire at the ghost, if it may stand there, then asks for the camp's name.
   *
   * A refused spot changes nothing and says why. The fire is paid for and placed before the name
   * is asked, so closing the name box never undoes the camp.
   */
  function place() {
    if (!build.active) return;
    update();
    const result = placeCampfire(session.state, build.x, build.y);
    if (!result.ok) {
      ui.hud.notify(result.message);
      return;
    }
    build.active = false;
    session.keys.clear();
    save(session, ui, true);
    ui.hud.update();
    ui.camp.openNaming(result.camp);
  }

  return { toggle, cancel, place, update };
}
```

- [ ] **Step 5: Create `src/ui/camp.js` with the name box**

```js
// The camp dialogs. For now: naming a camp just founded. The rules live in actions/build.js;
// this file only shows the name box and passes on what the player typed.
import { nameCamp } from '../actions/build.js';
import { save } from '../core/session.js';
import { $ } from './layout.js';

/**
 * Wires up the camp dialogs.
 *
 * @param {object} session - The shared session (game state, held keys).
 * @param {object} ui - The other UI parts; the HUD shows messages.
 * @returns {{openNaming: Function}} Opens the name box for a camp just founded.
 */
export function setupCamp(session, ui) {
  // The camp being named while the name box is open.
  let naming = null;

  /**
   * Opens the name box for a camp just founded, filled in with its suggested name.
   *
   * @param {object} camp - The new camp.
   */
  function openNaming(camp) {
    naming = camp;
    session.keys.clear();
    $('camp-name-dialog').returnValue = '';
    $('camp-name-input').value = camp.name;
    $('camp-name-dialog').showModal();
    $('camp-name-input').select();
  }

  // However the name box closes, the camp is kept. "Found camp" also renames it to what was typed.
  $('camp-name-dialog').addEventListener('close', () => {
    if (!naming) return;
    if ($('camp-name-dialog').returnValue === 'found')
      nameCamp(session.state, naming.id, $('camp-name-input').value);
    ui.hud.notify(`${naming.name} is founded. Its fire keeps you warm through the night.`);
    naming = null;
    save(session, ui, true);
    ui.hud.update();
  });

  return { openNaming };
}
```

- [ ] **Step 6: Markup in `src/ui/layout.js`**

- Add `import { CAMP_NAME_MAX } from '../data/balance.js';` to the imports.
- Add a `flame` icon to `icons`:

```js
  flame:
    '<path d="M12 21c-3.9 0-6-2.6-6-5.6C6 11 11 9 10 3c3 1.8 5 4.4 5 7.2 1-.6 1.6-1.7 1.8-2.9C18 9 18 11 18 15.4 18 18.4 15.9 21 12 21Z"/>',
```

- After the `#interact` button, add:

```js
      <!-- Build mode's bar: what a campfire costs, or why the ghost's spot is refused. ui/hud.js fills it. -->
      <div id="build-bar" class="build-bar" role="status" hidden></div>
```

- In the key strip, after the `E Gather` span, add `<span><kbd>B</kbd> Campfire</span` + `>` (keep Prettier's `</span\n>` joins).
- In `#world`'s `aria-label`, after `E to gather,` add ` B to place a campfire,`.
- After the reset dialog, add:

```js
    <!-- Naming a camp just founded. ui/camp.js fills in the suggested name. -->
    <dialog
      id="camp-name-dialog"
      class="pause-dialog camp-name-dialog"
      aria-labelledby="camp-name-title"
    >
      <form method="dialog">
        <span class="modal-mark">${icon('flame')}</span>
        <p class="dialog-kicker">A NEW CAMP</p>
        <h2 id="camp-name-title">Name your camp</h2>
        <label for="camp-name-input">Camp name</label>
        <input id="camp-name-input" maxlength="${CAMP_NAME_MAX}" autocomplete="off" required />
        <button class="primary" value="found">Found camp ${icon('arrow')}</button>
      </form>
    </dialog>
```

- [ ] **Step 7: The name box pauses the game (`src/ui/dialogs.js`)**

Add `$('camp-name-dialog')` to the `dialogs` array and to the `isPaused` doc ("pause, map, journal, reset or camp name dialog").

- [ ] **Step 8: HUD build bar and action label (`src/ui/hud.js`)**

- Add `import { CAMPFIRE_COST } from '../data/balance.js';`.
- Replace the interact-button block at the end of `update()` with:

```js
    // The interact button: hidden when there's nothing to do, "busy" while an action runs, and
    // "Place campfire" in build mode.
    const node = nearbyNode(state),
      busy = NODES.find((n) => n.id === animator.pending?.target),
      { build } = session,
      button = $('interact'),
      label = button.querySelector('span');
    button.hidden = !node && !busy && !build.active;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy) label.textContent = `${DOING[busy.verb]} ${busy.label.toLowerCase()}… move to stop`;
    else if (build.active) label.textContent = 'Place campfire';
    else if (node) label.textContent = `${node.verb} ${node.label.toLowerCase()}`;

    // The build bar: what a campfire costs, or why it can't stand where the ghost is.
    const bar = $('build-bar');
    bar.hidden = !build.active;
    if (!build.active) return;
    const ok = !!build.check?.ok;
    bar.classList.toggle('blocked', !ok);
    bar.textContent = ok
      ? `Campfire · ${CAMPFIRE_COST.wood} wood · ${CAMPFIRE_COST.stone} stone · Click or E to place · Esc to cancel`
      : `${build.check?.message ?? 'Choose a spot'} · Esc to cancel`;
```

- [ ] **Step 9: Keys and pointer (`src/core/input.js`)**

- Header: add `B for build mode,` to the list in the `setupInput` doc.
- Replace `gather` and the interact listener with:

```js
  /**
   * Starts gathering the closest supply, or says to move closer if nothing is in reach.
   *
   * E starts the node's timed action; the supply is awarded when the action runs out (see core/loop.js).
   * Held movement keys are forgotten so the player doesn't walk off and cancel straight away.
   */
  function gather() {
    const result = beginGather(session.state, session.animator);
    if (result.ok) {
      keys.clear();
      ui.hud.update();
    } else if (result.reason === 'none') ui.hud.notify('Move closer to something you can gather.');
  }

  /** Does what E (or the action button) means right now: place the campfire in build mode, or gather. */
  function interact() {
    if (session.screen !== 'game' || ui.dialogs.isPaused()) return;
    if (session.build.active) ui.build.place();
    else gather();
  }

  $('interact').addEventListener('click', interact);
```

- At the top of the `keydown` listener, after `if (session.screen !== 'game') return;`, add:

```js
    // Typing in a text box (such as naming a camp) is not a game key.
    if (event.target instanceof HTMLInputElement) return;
```

- Make Escape cancel build mode before it pauses:

```js
    if (key === 'escape') {
      if (ui.dialogs.isPaused()) return;
      event.preventDefault();
      if (session.build.active) ui.build.cancel();
      else ui.dialogs.openPause();
      return;
    }
```

- After `if (ui.dialogs.isPaused()) return;`, add:

```js
    if (key === 'b' && !event.repeat) {
      event.preventDefault();
      ui.build.toggle();
      return;
    }
```

- Change the E handler to call `interact()` instead of `gather()`.
- Before the touch-buttons block, add:

```js
  // The mouse over the world is remembered so the build ghost can follow it. In build mode a
  // click (or a tap) on the world places the campfire there.
  const world = $('world');
  world.addEventListener('pointermove', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
  });
  world.addEventListener('pointerleave', () => (session.pointer = null));
  world.addEventListener('pointerdown', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
    if (session.build.active && event.button === 0) interact();
  });
```

- [ ] **Step 10: Loop and wiring**

In `src/core/loop.js`: after the `state.time += dt;` line add `ui.build.update(); // keep the build ghost on the pointer`, and change the draw call to `renderer.draw(state, dt, animator, session.build);`.

In `src/main.js`: add `import { setupCamp } from './ui/camp.js';` and `import { setupBuild } from './core/build.js';`, and after `ui.journal = setupJournal(session, ui);` add:

```js
ui.camp = setupCamp(session, ui);
ui.build = setupBuild(session, ui);
```

- [ ] **Step 11: Styles (`src/style.css`)**

Add after the "In-game: the action button and pop-up messages" section:

```css
/* ---- In-game: build mode ---- */
/* The bar under the region name while placing a campfire: the cost, or why the spot is refused. */
.build-bar {
  position: absolute;
  top: 200px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(90vw, 620px);
  padding: 10px 16px;
  border-radius: 7px;
  background: #263b31ec;
  color: #f8f5e9;
  font-size: 12px;
  text-align: center;
  pointer-events: none;
}

/* A refused spot is told in words and with a red background, so colour is never the only signal. */
.build-bar.blocked {
  background: #6b2b22ee;
}

.build-bar[hidden] {
  display: none;
}

/* ---- Dialogs: naming a new camp ---- */
.camp-name-dialog label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  text-align: left;
  margin-bottom: 6px;
}

.camp-name-dialog input {
  width: 100%;
  box-sizing: border-box;
  font: 400 22px var(--serif);
  padding: 10px 12px;
  border: 1px solid #b8c1aa;
  border-radius: 7px;
  background: #fffdf4;
  color: var(--ink);
}
```

and in the `@media (max-width: 700px)` block add `.build-bar { top: 215px; font-size: 11px; }`.

- [ ] **Step 12: Check in the browser**

`npm test` must pass. Start `wildhaven` at `http://127.0.0.1:5173`:
1. Builder: press B. The ghost follows the mouse, red with "Something is in the way" over a house, green on open ground. Escape leaves build mode without pausing.
2. Place it: the name box opens with "Hollowstead Camp"; type a name and press Found camp. The fire stays, the camp appears on the world map with its name, and the player can't walk through it. Wood 5→2, stone 2→0.
3. Scout: press B with no wood: the bar says "Needs 3 wood and 2 stone"; clicking places nothing.
4. Night: in the console, `const k='wildhaven.adventure.v1.builder', s=JSON.parse(localStorage[k]); s.time=230; localStorage[k]=JSON.stringify(s); location.reload()`. (The stale-tab guard stops the old tab overwriting this edit.) Wait 10-20 s: the world darkens, the fire shows a soft lit circle with a warm glow, and the player has a small light.
5. Console free of errors; at 390 px wide the build bar fits.

- [ ] **Step 13: Format and commit**

```bash
npm run format
git add src/render/lighting.js src/render/renderer.js src/core/build.js src/ui/camp.js src/core/session.js src/core/input.js src/core/loop.js src/ui/hud.js src/ui/layout.js src/ui/dialogs.js src/main.js src/style.css
git commit -m "Place campfires in build mode; light the night around them" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/render/lighting.js src/render/renderer.js src/core/build.js src/ui/camp.js src/core/session.js src/core/input.js src/core/loop.js src/ui/hud.js src/ui/layout.js src/ui/dialogs.js src/main.js src/style.css
```

---

### Task 9: Survival in play: meters, clock, goals, camp dialog and passing out

**Files:**
- Modify: `src/core/loop.js`, `src/ui/hud.js` (rewrite), `src/ui/camp.js` (extend), `src/core/input.js`, `src/core/session.js`, `src/ui/layout.js`, `src/ui/dialogs.js`, `src/actions/gather.js`, `src/style.css`
- Test: `tests/actions/gather.test.js` (drop `hasGathered`)

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: `describeEvent(event): string` exported from `ui/hud.js`; `ui.camp = {openNaming, openCamp, showPassOut, eatFood, useHerbs}`.

- [ ] **Step 1: Retire `hasGathered`**

The goals card no longer uses it. Delete `hasGathered` (and its comment) from `src/actions/gather.js`; in `tests/actions/gather.test.js` remove it from the import and delete the lines `assert.equal(hasGathered(game), false);` and `assert.ok(hasGathered(game));`. Run `npm test` → PASS.

- [ ] **Step 2: Rewrite `src/ui/hud.js`**

```js
// The HUD: the on-screen panels shown while playing (resources, clock, survival meters, region
// name and progress, goals card, interact button, build bar) and the short pop-up messages called
// toasts. It only shows the game state; it never changes it.
import { RESOURCES } from '../data/supplies.js';
import { CAMPFIRE_COST } from '../data/balance.js';
import { NODES } from '../world/nodes.js';
import { regionOf } from '../world/regions.js';
import { regionProgress } from '../world/progress.js';
import { clockLabel, phaseOf } from '../world/clock.js';
import { nearestCamp, campInReach } from '../world/camps.js';
import { describeNeed, needProgress } from '../world/needs.js';
import { nearbyNode } from '../actions/gather.js';
import { meterTrends } from '../actions/survive.js';
import { $ } from './layout.js';

// Turns a supply's verb into its "-ing" form for the busy button, e.g. Chop → Chopping.
const DOING = { Chop: 'Chopping', Pick: 'Picking', Gather: 'Gathering' };

// How long the controls strip stays up when nobody moves, and how long its fade-out takes.
const KEY_STRIP_MS = 8000,
  KEY_STRIP_FADE_MS = 600;

// The word shown beside a meter for each cause meterTrends gives (tea also shows its seconds left).
const TREND_WORDS = {
  warming: 'By the fire',
  tea: 'Tea',
  cold: 'Cold',
  freezing: 'Freezing',
  starving: 'Starving',
};

/**
 * Puts a survival event into words for a toast.
 *
 * @param {object} event - An event from tickSurvival or skipTo, such as `{kind: 'dusk'}`.
 * @returns {string} The message, or '' for an event with no toast (passing out has its own screen).
 */
export function describeEvent(event) {
  if (event.kind === 'dusk') return 'Dusk is falling. Head to a fire before dark.';
  if (event.kind === 'night') return 'Getting dark, head to a fire.';
  if (event.kind === 'freezing') return "You're freezing. Your health is dropping.";
  if (event.kind === 'starving') return "You're starving. Eat something (F).";
  if (event.kind === 'dawn') {
    const needs = event.camps.length ? ` New needs at ${event.camps.join(', ')}.` : '';
    return `Dawn, day ${event.day}.${needs}`;
  }
  return '';
}

/**
 * Builds the HUD helpers for one game session.
 *
 * @param {object} session - The shared session; `update` reads its game state, animator and build mode.
 * @returns {{notify: Function, update: Function, showKeyStrip: Function, hideKeyStrip: Function}} A way to
 * pop up a message, a way to redraw the HUD, and ways to show and hide the controls strip.
 */
export function createHud(session) {
  let toastTimer;
  let keyStripTimer;

  /**
   * Shows a short message at the bottom of the screen for about three seconds.
   *
   * A new message replaces the old one and restarts the timer, so messages never pile up.
   *
   * @param {string} message - The text to show.
   */
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
  }

  /**
   * Shows the clock and the three survival meters, each with a word saying why it is changing.
   *
   * @param {object} state - The game being played.
   */
  function updateMeters(state) {
    $('identity-status').dataset.phase = phaseOf(state.time);
    $('clock').textContent = clockLabel(state.time);
    const trends = meterTrends(state);
    for (const name of ['health', 'hunger', 'warmth']) {
      const value = Math.round(state.meters[name]),
        meter = $(`meter-${name}`),
        trend = trends[name];
      meter.style.setProperty('--fill', `${value}%`);
      meter.setAttribute('aria-valuenow', String(value));
      meter.classList.toggle('low', value <= 25);
      meter.querySelector('.meter-tag').textContent =
        trend === 'tea' ? `Tea ${Math.ceil(state.tea)}s` : (TREND_WORDS[trend] ?? '');
    }
  }

  /**
   * Fills the goals card's list: one line per goal with its count, ticked off when complete.
   *
   * @param {{text: string, have: number, want: number}[]} goals - The goals to show.
   */
  function showGoals(goals) {
    $('quest-lines').replaceChildren(
      ...goals.map(({ text, have, want }) => {
        const item = document.createElement('li'),
          count = document.createElement('b');
        count.textContent = `${have} / ${want}`;
        item.append(text, count);
        item.classList.toggle('complete', have >= want);
        return item;
      }),
    );
  }

  /**
   * Fills the goals card: building the first campfire, then the nearest camp's needs.
   *
   * @param {object} state - The game being played.
   */
  function updateGoals(state) {
    const camp = nearestCamp(state);
    if (!camp) {
      const { wood, stone } = CAMPFIRE_COST;
      $('quest-label').textContent = 'BEFORE NIGHTFALL';
      $('quest-title').textContent = 'Build a campfire';
      $('quest-text').textContent =
        `Night is cold away from a fire. Gather ${wood} wood and ${stone} stone, then press B to place it.`;
      showGoals([
        { text: 'Wood', have: Math.min(state.resources.wood, wood), want: wood },
        { text: 'Stone', have: Math.min(state.resources.stone, stone), want: stone },
      ]);
      return;
    }
    $('quest-label').textContent = 'CAMP NEEDS';
    $('quest-title').textContent = camp.name;
    $('quest-text').textContent = 'Meet needs to grow the fire. New needs arrive at dawn.';
    showGoals(camp.needs.map((need) => ({ text: describeNeed(need), ...needProgress(state, need) })));
  }

  /**
   * Shows the interact button and the build bar for what the player can do right now.
   *
   * The button is "busy" while gathering, "Place campfire" in build mode, the gather verb when a
   * supply is in reach, and "Open <camp>" beside one of the player's fires.
   *
   * @param {object} state - The game being played.
   */
  function updateActions(state) {
    const { animator, build } = session;
    const node = nearbyNode(state),
      busy = NODES.find((n) => n.id === animator.pending?.target),
      camp = !node && campInReach(state),
      button = $('interact'),
      label = button.querySelector('span');
    button.hidden = !node && !busy && !build.active && !camp;
    button.classList.toggle('busy', !!busy);
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy) label.textContent = `${DOING[busy.verb]} ${busy.label.toLowerCase()}… move to stop`;
    else if (build.active) label.textContent = 'Place campfire';
    else if (node) label.textContent = `${node.verb} ${node.label.toLowerCase()}`;
    else if (camp) label.textContent = `Open ${camp.name}`;

    // The build bar: what a campfire costs, or why it can't stand where the ghost is.
    const bar = $('build-bar');
    bar.hidden = !build.active;
    if (!build.active) return;
    const ok = !!build.check?.ok;
    bar.classList.toggle('blocked', !ok);
    bar.textContent = ok
      ? `Campfire · ${CAMPFIRE_COST.wood} wood · ${CAMPFIRE_COST.stone} stone · Click or E to place · Esc to cancel`
      : `${build.check?.message ?? 'Choose a spot'} · Esc to cancel`;
  }

  /**
   * Refreshes every HUD panel so it matches the current game.
   *
   * Like updating a scoreboard: resources, the clock and meters, the region's name and progress,
   * the goals card, and the action button.
   */
  function update() {
    const { state } = session;
    if (!state) return;
    for (const resource of RESOURCES) $(resource).textContent = state.resources[resource];
    updateMeters(state);

    const region = regionOf(state.player.x, state.player.y),
      { places, signposts } = regionProgress(state, region.id);
    $('region-name').textContent = region.name;
    $('region-progress').textContent =
      `${places.found} / ${places.total} places · ${signposts.found} / ${signposts.total} signposts`;

    updateGoals(state);
    updateActions(state);
  }

  /**
   * Shows the controls strip at the bottom of the screen, then fades it after 8 seconds.
   * Called each time the game screen opens.
   */
  function showKeyStrip() {
    const strip = $('key-strip');
    clearTimeout(keyStripTimer);
    strip.classList.remove('fading');
    strip.hidden = false;
    keyStripTimer = setTimeout(hideKeyStrip, KEY_STRIP_MS);
  }

  /**
   * Fades the controls strip out and then hides it. Does nothing if it is already hidden or
   * fading, so the game loop can call it on every step without cost.
   */
  function hideKeyStrip() {
    const strip = $('key-strip');
    if (strip.hidden || strip.classList.contains('fading')) return;
    clearTimeout(keyStripTimer);
    strip.classList.add('fading');
    keyStripTimer = setTimeout(() => {
      strip.hidden = true;
      strip.classList.remove('fading');
    }, KEY_STRIP_FADE_MS);
  }

  return { notify, update, showKeyStrip, hideKeyStrip };
}
```

- [ ] **Step 3: Extend `src/ui/camp.js` with the camp and pass-out dialogs**

Replace the whole file:

```js
// The camp dialogs: naming a camp just founded, the camp itself (its needs and what to do at the
// fire), and the screen shown after passing out. Eating and healing from the keyboard come
// through here too. These only show the game and call the actions in actions/build.js and
// actions/camp.js, which hold the rules.
import {
  FOOD_HUNGER,
  HEAL_HERBS,
  HEAL_HEALTH,
  TEA_HERBS,
  TEA_SECONDS,
  MAX_GROWN,
} from '../data/balance.js';
import { clockLabel, phaseOf } from '../world/clock.js';
import { fireRadius } from '../world/camps.js';
import { describeNeed, needProgress } from '../world/needs.js';
import { nameCamp } from '../actions/build.js';
import { giveToNeed, eat, heal, brewTea, rest } from '../actions/camp.js';
import { save } from '../core/session.js';
import { describeEvent } from './hud.js';
import { $ } from './layout.js';

// What each action says when it can't be done, by the reason it gives.
const REFUSED = {
  eat: { empty: 'No food in your pack.', full: "You're not hungry." },
  heal: { full: 'You are already at full health.', short: `Healing takes ${HEAL_HERBS} herbs.` },
  tea: {
    away: 'Brew tea at one of your camps.',
    active: 'Your tea is still warming you.',
    short: `Tea takes ${TEA_HERBS} herbs.`,
  },
  rest: { away: 'Rest at one of your camps.', day: 'You can rest from dusk.' },
};

/**
 * Wires up the camp dialogs and the eat and heal shortcuts.
 *
 * @param {object} session - The shared session (game state, held keys, screen).
 * @param {object} ui - The other UI parts (`hud`, `dialogs`).
 * @returns {{openNaming: Function, openCamp: Function, showPassOut: Function, eatFood: Function,
 *   useHerbs: Function}} Ways to open each dialog, and the F and H key actions.
 */
export function setupCamp(session, ui) {
  // The camp being named while the name box is open, and the camp whose dialog is open.
  let naming = null,
    open = null;

  /**
   * Picks the first reason that applies from a list of [applies, words] pairs.
   *
   * @param {Array<[boolean, string]>} checks - Each check, and what to say when it applies.
   * @returns {string} The words of the first check that applies, or '' when none do.
   */
  const reason = (checks) => checks.find(([applies]) => applies)?.[1] ?? '';

  /**
   * Makes a small grey note for a need line, such as "Out in the wild".
   *
   * @param {string} text - The note.
   * @returns {HTMLSpanElement} The note element.
   */
  function note(text) {
    const span = document.createElement('span');
    span.className = 'camp-note';
    span.textContent = text;
    return span;
  }

  /**
   * Builds one line of the needs list: what is asked, and a Give button or the need's state.
   *
   * @param {object} need - The need.
   * @param {number} slot - Its place in the camp's list (0, 1 or 2), for the Give button.
   * @returns {HTMLLIElement} The line.
   */
  function needItem(need, slot) {
    const item = document.createElement('li'),
      words = document.createElement('span');
    item.classList.toggle('done', need.done);
    words.textContent = describeNeed(need);
    item.append(words);

    if (need.done) item.append(note('Met · a new need arrives at dawn'));
    else if (need.kind !== 'bring') item.append(note('Out in the wild'));
    else {
      const { have, want } = needProgress(session.state, need),
        button = document.createElement('button');
      button.className = 'secondary';
      button.disabled = have < want;
      button.textContent =
        have < want ? `You have ${have} of ${want}` : `Give ${want} ${need.resource}`;
      button.addEventListener('click', () => give(slot));
      item.append(button);
    }
    return item;
  }

  /**
   * Sets one camp task button: whether it can be used, and its small line (the cost, or why not).
   *
   * @param {string} id - The button's id.
   * @param {string} why - Why it can't be used right now, or '' when it can.
   * @param {string} cost - What it costs and does, shown when it can be used.
   */
  function task(id, why, cost) {
    $(id).disabled = !!why;
    $(id).querySelector('small').textContent = why || cost;
  }

  /** Fills the camp dialog: its name, the clock, the fire's size, the needs and the four tasks. */
  function render() {
    const { state } = session,
      { meters, resources } = state;
    $('camp-kicker').textContent = `CAMP · ${clockLabel(state.time).toUpperCase()}`;
    $('camp-title').textContent = open.name;
    $('camp-fire').textContent =
      `Warmth reaches ${fireRadius(open)} units · ${open.grown} of ${MAX_GROWN} needs met`;
    $('camp-needs').replaceChildren(...open.needs.map(needItem));

    task(
      'camp-tea',
      reason([
        [state.tea > 0, `Still warming you (${Math.ceil(state.tea)} s)`],
        [resources.herbs < TEA_HERBS, `Needs ${TEA_HERBS} herbs`],
      ]),
      `${TEA_HERBS} herbs · ${TEA_SECONDS} s safe from the cold`,
    );
    task(
      'camp-eat',
      reason([
        [resources.food < 1, 'No food'],
        [meters.hunger >= 100, 'Not hungry'],
      ]),
      `1 food · +${FOOD_HUNGER} hunger`,
    );
    task(
      'camp-heal',
      reason([
        [meters.health >= 100, 'Full health'],
        [resources.herbs < HEAL_HERBS, `Needs ${HEAL_HERBS} herbs`],
      ]),
      `${HEAL_HERBS} herbs · +${HEAL_HEALTH} health`,
    );
    task(
      'camp-rest',
      reason([[!['dusk', 'night'].includes(phaseOf(state.time)), 'You can rest from dusk']]),
      'Sleep until dawn and wake rested',
    );
  }

  /** Saves, then redraws the camp dialog (if it is open) and the HUD after anything changes. */
  function refresh() {
    save(session, ui, true);
    if ($('camp-dialog').open) render();
    ui.hud.update();
  }

  /**
   * Opens the name box for a camp just founded, filled in with its suggested name.
   *
   * @param {object} camp - The new camp.
   */
  function openNaming(camp) {
    naming = camp;
    session.keys.clear();
    $('camp-name-dialog').returnValue = '';
    $('camp-name-input').value = camp.name;
    $('camp-name-dialog').showModal();
    $('camp-name-input').select();
  }

  /**
   * Opens a camp's dialog. The game pauses while it is open, like every other dialog.
   *
   * @param {object} camp - The camp the player is standing by.
   */
  function openCamp(camp) {
    if (ui.dialogs.isPaused()) return;
    open = camp;
    session.keys.clear();
    render();
    $('camp-dialog').showModal();
  }

  /**
   * Gives the resources one of the open camp's needs asks for.
   *
   * @param {number} slot - Which need: 0, 1 or 2.
   */
  function give(slot) {
    const result = giveToNeed(session.state, open.id, slot);
    if (!result.ok) return;
    ui.hud.notify(`${open.name}: need met · ${describeNeed(result.need)}`);
    refresh();
  }

  /**
   * Runs one action on the game and says how it went: a short success line, or why it was refused.
   *
   * @param {Function} action - The action, such as `eat`; it is given the game state.
   * @param {object} refused - Words for each reason the action can refuse.
   * @param {string} done - The words to show when it works.
   */
  function attempt(action, refused, done) {
    if (session.screen !== 'game' || !session.state) return;
    const result = action(session.state);
    ui.hud.notify(result.ok ? done : refused[result.reason]);
    if (result.ok) refresh();
  }

  /** Eats one food: the F key and the camp's Eat button. */
  const eatFood = () => attempt(eat, REFUSED.eat, `You eat. +${FOOD_HUNGER} hunger`);

  /** Heals with herbs: the H key and the camp's Heal button. */
  const useHerbs = () =>
    attempt(heal, REFUSED.heal, `You use ${HEAL_HERBS} herbs. +${HEAL_HEALTH} health`);

  /** Rests until dawn, closes the camp dialog, and tells the player about the new day. */
  function restNight() {
    const result = rest(session.state);
    if (!result.ok) {
      ui.hud.notify(REFUSED.rest[result.reason]);
      return;
    }
    $('camp-dialog').close();
    ui.hud.notify(['You rest by the fire.', ...result.events.map(describeEvent)].join(' '));
    refresh();
  }

  /**
   * Shows the screen after passing out: what happened, where the player woke, and any new needs.
   *
   * @param {{camp: object|null, events: object[]}} result - What `passOut` returned.
   */
  function showPassOut({ camp, events }) {
    const dawn = events.find((e) => e.kind === 'dawn');
    $('passout-text').textContent = [
      'You got too cold away from a fire.',
      camp
        ? `You woke at ${camp.name} at midday.`
        : 'You woke where you started, at midday. Build a campfire so you have somewhere warm to return to.',
      dawn?.camps.length ? `New needs at ${dawn.camps.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    session.keys.clear();
    $('passout-dialog').showModal();
  }

  // However the name box closes, the camp is kept. "Found camp" also renames it to what was typed.
  $('camp-name-dialog').addEventListener('close', () => {
    if (!naming) return;
    if ($('camp-name-dialog').returnValue === 'found')
      nameCamp(session.state, naming.id, $('camp-name-input').value);
    ui.hud.notify(`${naming.name} is founded. Its fire keeps you warm through the night.`);
    naming = null;
    refresh();
  });

  // The camp dialog's buttons, and the pass-out screen's.
  $('close-camp').addEventListener('click', () => $('camp-dialog').close());
  $('camp-tea').addEventListener('click', () =>
    attempt(brewTea, REFUSED.tea, `You brew herbal tea: ${TEA_SECONDS} s safe from the cold.`),
  );
  $('camp-eat').addEventListener('click', eatFood);
  $('camp-heal').addEventListener('click', useHerbs);
  $('camp-rest').addEventListener('click', restNight);
  $('passout-close').addEventListener('click', () => $('passout-dialog').close());

  return { openNaming, openCamp, showPassOut, eatFood, useHerbs };
}
```

- [ ] **Step 4: Markup (`src/ui/layout.js`)**

- Add icons to `icons`:

```js
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z"/>',
```

- Add above `mountLayout`:

```js
/**
 * Makes the HTML for one survival meter: its icon, a bar that ui/hud.js fills through the
 * `--fill` style, and a small word for why it is changing.
 *
 * @param {string} id - 'health', 'hunger' or 'warmth'.
 * @param {string} label - The meter's name, read out by screen readers.
 * @param {string} iconName - Which icon to show.
 * @returns {string} The meter as an HTML string.
 */
const meter = (id, label, iconName) => /* HTML */ `<div
  id="meter-${id}"
  class="meter"
  role="meter"
  aria-label="${label}"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="100"
>
  ${icon(iconName)}<span class="meter-bar"></span><span class="meter-tag"></span>
</div>`;
```

- Replace the identity panel's inner status span (`<span class="identity-status"><span></span> Exploring the wilds</span>`) with the clock, and add the meters after the name block:

```js
        <div class="identity hud-panel">
          <span id="hud-portrait" class="hud-portrait"></span>
          <div>
            <span id="hud-name" class="hud-name"></span
            ><span id="identity-status" class="identity-status" data-phase="day"
              ><span class="sun">${icon('sun')}</span><span class="moon">${icon('moon')}</span
              ><span id="clock"></span
            ></span>
          </div>
          <div class="meters">
            ${meter('health', 'Health', 'heart')}${meter('hunger', 'Hunger', 'food')}${meter(
              'warmth',
              'Warmth',
              'flame',
            )}
          </div>
        </div>
```

- In the region block, after `<span class="region-rule"></span>` add `<p id="region-progress" class="region-progress"></p>`.
- In the goals card, replace the `<ul>` with its two `<li>` by `<ul id="quest-lines"></ul>`.
- Key strip: change `<kbd>E</kbd> Gather` to `<kbd>E</kbd> Gather / camp` and add `<span><kbd>F</kbd> Eat</span>` and `<span><kbd>H</kbd> Heal</span>` after the B span (keep the `</span\n>` joins).
- `#world` `aria-label`: `Playable world. Use WASD or arrow keys to move, Shift to run, E to gather or open a camp, B to place a campfire, F to eat, H to heal with herbs, M for map, J for journal, Escape to pause.`
- After the camp name dialog, add:

```js
    <!-- A camp: its needs and what to do at the fire. ui/camp.js fills it. -->
    <dialog id="camp-dialog" class="camp-dialog" aria-labelledby="camp-title">
      <div class="map-heading">
        <div>
          <p id="camp-kicker" class="dialog-kicker"></p>
          <h2 id="camp-title"></h2>
        </div>
        <button id="close-camp" class="icon-button" aria-label="Close camp">
          ${icon('close')}
        </button>
      </div>
      <p id="camp-fire" class="camp-fire"></p>
      <h3 class="camp-heading">What the camp needs</h3>
      <ol id="camp-needs" class="camp-needs"></ol>
      <h3 class="camp-heading">At the fire</h3>
      <div class="camp-tasks">
        <button id="camp-tea" class="secondary">Brew tea<small></small></button
        ><button id="camp-eat" class="secondary">Eat<small></small></button
        ><button id="camp-heal" class="secondary">Heal<small></small></button
        ><button id="camp-rest" class="secondary">Rest until dawn<small></small></button>
      </div>
    </dialog>

    <!-- Shown after passing out from the cold. ui/camp.js says where the player woke. -->
    <dialog id="passout-dialog" class="pause-dialog" aria-labelledby="passout-title">
      <span class="modal-mark">${icon('moon')}</span>
      <p class="dialog-kicker">YOU PASSED OUT</p>
      <h2 id="passout-title">The cold caught you.</h2>
      <p id="passout-text"></p>
      <button id="passout-close" class="primary">Get up ${icon('arrow')}</button>
    </dialog>
```

- [ ] **Step 5: The new dialogs pause the game (`src/ui/dialogs.js`)**

Add `$('camp-dialog')` and `$('passout-dialog')` to the `dialogs` array, and update the `isPaused` doc to list every dialog.

- [ ] **Step 6: E opens a camp, F eats, H heals (`src/core/input.js`)**

- Add `import { campInReach } from '../world/camps.js';`.
- Replace `gather` with:

```js
  /**
   * Starts gathering the closest supply. With nothing to gather, E beside one of the player's
   * fires opens that camp instead; anywhere else it says to move closer.
   *
   * E starts the node's timed action; the supply is awarded when the action runs out (see core/loop.js).
   * Held movement keys are forgotten so the player doesn't walk off and cancel straight away.
   */
  function gather() {
    const result = beginGather(session.state, session.animator);
    if (result.ok) {
      keys.clear();
      ui.hud.update();
      return;
    }
    if (result.reason !== 'none') return;
    const camp = campInReach(session.state);
    if (camp) ui.camp.openCamp(camp);
    else ui.hud.notify('Move closer to something you can gather.');
  }
```

- After the B handler, add:

```js
    if (key === 'f' && !event.repeat) {
      event.preventDefault();
      ui.camp.eatFood();
      return;
    }

    if (key === 'h' && !event.repeat) {
      event.preventDefault();
      ui.camp.useHerbs();
      return;
    }
```

- Update the `setupInput` doc line to: `Also handles E to gather or open a camp, B for build mode, F to eat, H to heal, M for the map, J for the journal, Escape to pause, and saving when the tab is hidden.`

- [ ] **Step 7: Run survival in the loop (`src/core/loop.js`)**

- Header: `About 60 times a second it moves the player, runs the current animation and the survival clock, hands out gathered supplies, checks for new finds, lifts the fog, autosaves, and asks the renderer to draw.`
- Add imports:

```js
import { tickSurvival } from '../actions/survive.js';
import { passOut } from '../actions/camp.js';
import { markFinds, describeNeed } from '../world/needs.js';
import { revealAround } from '../world/fog.js';
import { describeEvent } from '../ui/hud.js';
```

- Add above `startLoop`:

```js
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
```

- In `frame`, replace the two lines added in Tasks 3 and 8 (`state.time += dt;` with its comment, and `ui.build.update();`) with:

```js
        // The world clock, the meters and each camp's dawn update move with the survival tick.
        const events = tickSurvival(state, dt);
        ui.build.update(); // keep the build ghost on the pointer
```

- Replace the `if (found.length) { ... }` block with:

```js
        const found = discover(state);
        if (found.length) {
          // A find can also meet a camp need ("Find a place in Frostpeak"); both are announced together.
          const met = markFinds(state, found);
          ui.hud.notify(
            [
              ...found.map((f) => FOUND[f.kind](f)),
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
```

- [ ] **Step 8: A first-night hint on arrival (`src/core/session.js`)**

In `start()`, change the new-game welcome line to: `` `Welcome to ${c.location}. Build a campfire before dark (B).${page}` ``.

- [ ] **Step 9: Styles (`src/style.css`)**

- Replace the `.identity-status > span` dot rule (and its comment) with:

```css
/* The sun or moon before the clock. ui/hud.js sets data-phase to the part of the day. */
.identity-status svg {
  width: 11px;
  height: 11px;
  display: block;
}

.identity-status .moon,
.identity-status[data-phase='dusk'] .sun,
.identity-status[data-phase='night'] .sun {
  display: none;
}

.identity-status[data-phase='dusk'] .moon,
.identity-status[data-phase='night'] .moon {
  display: block;
}
```

- Add a section after the top bar rules:

```css
/* ---- In-game HUD: survival meters ---- */
/* Three thin bars beside the name: health, hunger and warmth. ui/hud.js sets --fill (0-100%). */
.meters {
  display: grid;
  gap: 4px;
  margin-left: 4px;
  padding-left: 12px;
  border-left: 1px solid #d3d8c7;
}

.meter {
  display: grid;
  grid-template-columns: 13px 72px 58px;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: var(--muted);
}

.meter svg {
  width: 13px;
  height: 13px;
}

.meter-bar {
  position: relative;
  height: 5px;
  border-radius: 3px;
  background: #dfe2d4;
  overflow: hidden;
}

.meter-bar::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--fill, 100%);
  border-radius: inherit;
  background: var(--meter-color);
}

#meter-health {
  --meter-color: #c0533f;
}

#meter-hunger {
  --meter-color: #c99a3b;
}

#meter-warmth {
  --meter-color: #e07a35;
}

/* A meter at a quarter or less says so in bold red words, not only with its short bar. */
.meter.low .meter-tag {
  color: #a43c2c;
  font-weight: 600;
}

/* The "3 / 7 places · 1 / 2 signposts" line under the region name. */
.region-progress {
  margin: 8px 0 0;
  font-size: 10px;
  letter-spacing: 0.4px;
}
```

- Add a dialogs section after "Dialogs: naming a new camp":

```css
/* ---- Dialogs: a camp (its needs and the things to do at the fire) ---- */
.camp-dialog {
  padding: 23px;
  width: min(560px, calc(100vw - 34px));
  max-height: 94svh;
  overflow: auto;
}

.camp-fire {
  font-size: 12px;
  color: var(--muted);
  margin: 4px 0 0;
}

.camp-heading {
  font: 400 19px var(--serif);
  margin: 20px 0 8px;
}

.camp-needs {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.camp-needs li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}

.camp-needs li.done {
  color: #668653;
}

.camp-needs .secondary {
  min-height: 0;
  padding: 8px 12px;
}

.camp-note {
  font-size: 11px;
  color: var(--muted);
}

/* The four tasks in a two-by-two grid; each button shows its cost (or why not) underneath. */
.camp-tasks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.camp-tasks .secondary {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}

.camp-tasks small {
  font-size: 10px;
  color: var(--muted);
}

.camp-dialog button:disabled {
  opacity: 0.55;
  cursor: default;
}
```

- In `@media (max-width: 700px)` add:

```css
  .meter {
    grid-template-columns: 11px 46px 44px;
    font-size: 8px;
  }
  .camp-tasks {
    grid-template-columns: 1fr;
  }
  .camp-dialog {
    padding: 15px;
  }
```

- [ ] **Step 10: Run the tests and play**

`npm test`, `npm run build` and `npm run format:check` must pass. Then start `wildhaven` at `http://127.0.0.1:5173` and check, using the console trick from Task 8 to set `time` (230 = just before night, 355 = just before dawn) and meters:
1. Scout, new game: goals card says "Build a campfire" with Wood 0/3 and Stone 0/2; welcome toast mentions B. Clock reads "Day 1 · Morning". Chop the pine and gather the stones; place a fire with B.
2. At dusk away from the fire: toast "Dusk is falling..."; at night "Getting dark, head to a fire."; warmth drains with the "Cold" tag, then "Freezing" on health. Walking back into the light: warmth climbs ("By the fire").
3. Stay out all night: the pass-out screen says where you woke (the nearest fire, at midday). With no camp (survivor fresh game), you wake at the shipwreck.
4. E by the fire opens the camp: three needs; Give works for a bring need you can afford; tea, eat and heal buttons show cost or reason; Rest is offered only from dusk and skips to dawn with "Dawn, day N." and new needs where some were met.
5. Find a place in the region a need names: the toast says "<camp>: need met · Find a place in ...", and the fire's light grows.
6. F and H work anywhere with the right messages.
7. Pause and each dialog stop the clock; save and reload keeps time, meters, camps and fog.
8. A chopped pine comes back two in-game days later (set `time` forward by 720 in the save to check).
9. 390 px wide: identity panel with meters fits on one row with the pause and journal buttons; the camp dialog stacks its tasks.
10. Console free of errors throughout.

- [ ] **Step 11: Format and commit**

```bash
npm run format
git add src/core/loop.js src/ui/hud.js src/ui/camp.js src/core/input.js src/core/session.js src/ui/layout.js src/ui/dialogs.js src/actions/gather.js src/style.css tests/actions/gather.test.js
git commit -m "Survive the night: meters, clock, camp needs, camp dialog and passing out" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/core/loop.js src/ui/hud.js src/ui/camp.js src/core/input.js src/core/session.js src/ui/layout.js src/ui/dialogs.js src/actions/gather.js src/style.css tests/actions/gather.test.js
```

---

### Task 10: Docs and the full verification pass

**Files:**
- Modify: `docs/gdd.md`, `CLAUDE.md`, `docs/verification.md`, `README.md`

- [ ] **Step 1: Bring in main's newest docs first**

Another session is editing `docs/gdd.md` (the archipelago direction). Run `git fetch` and look at `git log main -- docs/gdd.md`; if it changed since this branch started, merge `main` into this branch before editing, so these edits sit on top of theirs.

- [ ] **Step 2: Update `docs/gdd.md`**

Mark the M2 items as built and record the decisions; keep every other section as it is.
- Section 2: in the layers table, campfire, the session loop and the needs list become **[Built]**. Under "Distance costs", record the numbers now in the build: a 360 s day (240 s light, 120 s night), 60 s of warmth plus 30 s of health away from a fire at night, tunable in `src/data/balance.js`, still to be re-derived from measured routes. Replace "Fast travel vs the tether [open]" with "**[Decided 2026-11-19]** No rule: signpost travel stays free at any hour. The designer accepts the weaker tether."
- Section 3: the failure rule (pass out, lose the morning, wake at the nearest fire or spawn) is **[Built]**; in the retention table, unfinished business, the dawn needs update and walked-area fog are **[Built]**.
- Section 4: wood, stone and food regrowth after 2 days **[Built]**; campfire cost **[Built]**; needs list **[Built]**; herbs: tea (5 herbs, 20 s) and heal (3 herbs, +30 health) **[Built]**; food eaten for +25 hunger **[Built]**; supply table note: supplies regrow after 720 game-seconds.
- Section 6: 6.7 meters **[Built]** with the rates; 6.8 day/night **[Built]**; 6.10 campfire **[Built]** (shelter, stockpile, farm stay M3); 6.12 a second camp **[Built]** (3,000 units apart); 6.14 controls add B (build mode), Escape cancels building, F eat, H heal, E opens a camp; 6.15 HUD now shows meters and the day clock; 6.16 fog **[Built]** (256-unit squares, 1,000-unit reveal, saved per character); 6.17 needs **[Built]** with their contents (bring, place in the nearest unexplored region, new signpost on odd days; each met need grows the fire's warmth by 40 units up to 660; replaced at dawn); 6.18-6.20 **[Built]**, with the open walkthrough items that remain open.
- Section 8: M2 status "Built 2026-11-19 (branch m2-loop-proof)".
- Risk 4: mitigation "Accepted by the designer: no rule". Open Questions 8 and 11: resolved (strike through, with the answer). Open Question 14: note which work took save version 4.

- [ ] **Step 3: Update `CLAUDE.md`**

- Project Overview: the current milestone now also covers the M2 survival loop (day/night, warmth, hunger, health, campfires that found camps, needs list, passing out, fog of war, tea and healing, regrowth). Remove "none of it is implemented" for those items; settlers, buildings other than the campfire, wolves and tools remain unimplemented.
- Architecture table: add `clock.js`, `camps.js`, `needs.js`, `fog.js` to `src/world/`; `survive.js`, `build.js`, `camp.js` to `src/actions/`; `maps.js`, `lighting.js` to `src/render/`; `camp.js` to `src/ui/`; `build.js` to `src/core/`.
- Frame loop: step 3 becomes `movePlayer`, `tickSurvival` (world clock, meters, dawn update), `ui.build.update`, `advanceAnimation`; step 5 adds `markFinds`, `revealAround`, and survival events (pass-out → `passOut` and the pass-out screen; dawn saves).
- Save model: `version: 4`; fields `time`, `meters`, `tea`, `camps`, `fog`; `collected` is gone (supplies use `regrowAt` on `state.time`); version 3 saves are upgraded by `upgradeV3`, not reset. Saves also happen on placing or naming a camp, every camp action, rest, pass-out and dawn.
- Game Rules: fixed supplies regrow after `SUPPLY_REGROW` (720 s); the day/night phases; meter rates; campfire cost and placement rules; needs; tea/heal/eat; passing out; fog; controls B/F/H/E.
- Input section: `core/input.js` also tracks the pointer over the world (`session.pointer`) for build mode.

- [ ] **Step 4: Update `docs/verification.md` and `README.md`**

Add an "M2 loop proof" section to `docs/verification.md` listing the Task 9 browser checks and the console trick for moving the clock. In `README.md`, describe the loop now playable (gather, build a campfire before dark, survive the night, meet camp needs, found a second camp).

- [ ] **Step 5: Final checks**

Run `npm test`, `npm run build`, `npm run format:check`. Play through all three characters once more: first campfire, first night, a pass-out, a rest, a met need, a second camp 3,000+ units away, and a reload. Then commit:

```bash
git add docs/gdd.md CLAUDE.md docs/verification.md README.md
git commit -m "Document the M2 survival loop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/gdd.md CLAUDE.md docs/verification.md README.md
```
