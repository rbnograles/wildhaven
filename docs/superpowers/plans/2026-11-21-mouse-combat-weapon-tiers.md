# Mouse Combat, Weapon Tiers, and Creature HP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time, mouse-driven combat (draw/sheathe stance, LMB sword, RMB lock-on bow with tap-snap/hold-charge) on top of a new creature-HP damage model, and extend weapons to four tiers (stone/iron/gold/diamond).

**Architecture:** Creatures gain runtime `hp` (never saved). A shared damage path (`applyHit` → `fellCreature`) is used by the existing `E` hunt and by new mouse swings/shots, all routed through the existing timed-action pipeline (`beginHunt`/`beginSwing`/`beginShot` → `finishInteraction` → `finishHunt`). The chosen weapon and charge ride in the hunt target string (`hunt:<id>:<weapon>:<tenths>`). A new pure module `src/actions/combat.js` holds target selection and damage math. Stance lives on the session; input and renderer layers add the controls and visuals.

**Tech Stack:** Vanilla JS ES modules, Phaser 4 (renderer only), `node:test`, Prettier 3. See `CLAUDE.md`.

## Global Constraints

- Node 20.19+ / 22.12+ (developed on Node 24). One line per constant with a `//` or `/** */` comment.
- Pure modules (`data/`, `world/`, `actions/`, `game/`, `animation/clips.js`) must not import `ui/`, `core/`, `render/`, `sheets.js`, `preview.js`, PNG or CSS, and must not use `document`, `window`, `import.meta` — in code **or comments** (`tests/boundaries.test.js` scans comments too). `src/actions/combat.js` is a pure module.
- Every named function needs an ELI5 `/** ... */` comment directly above it (`tests/comments.test.js`). Every `test(...)` needs a `//` line above it, and every test file a header.
- Directions: `0=south, 1=west, 2=east, 3=north`.
- Do NOT use Phaser Arcade Physics. Collision stays in `src/world/map.js`, movement in `src/actions/move.js`, input in `src/core/input.js`. UI in HTML/DOM.
- Tuning numbers live in `src/data/balance.js`; never hardcode them in actions.
- `npm test`, `npm run build`, `npm run format:check` must all pass. Run `npm run format` after editing.
- Save format shape does NOT change; `SAVE_VERSION` stays 16. Creature HP and combat stance are never serialized.
- Damage formula (reconciles the spec's two phrasings): `damage = max(1, floor(full × (0.5 + 0.5 × clamp(charge, 0, 1))))`. At charge 0 this is `floor(full/2)` (the snap shot, "quick release"); at charge 1 it is `full`. The `E` hunt always passes charge 1.
- Commit after each task. Commit messages: plain imperative (repo style, e.g. "Add creature hit points"), ending with:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

## File Structure

- `src/data/tools.js` — `TIERS` becomes the four-tier ladder.
- `src/data/balance.js` — weapon damage table, wolf HP, charge constant, four-tier `SWORD_SECONDS`/`BOW_REACH`, gold/diamond recipes.
- `src/data/animals.js` — per-kind `hp`.
- `src/world/animals.js`, `src/world/wolves.js` — `hp` field on live creatures; reset on spawn/respawn.
- `src/actions/combat.js` — NEW, pure: `creatureMaxHp`, `weaponDamage`, `aimTarget`, `meleeTarget`.
- `src/actions/animals.js` — damage-based hunt: `applyHit`, `fellCreature`, rewritten `finishHunt`, `forcedWeapon`, `beginSwing`, `beginShot`; updated `huntClip`.
- `src/actions/craft.js` — data-driven `nextTier`, fixed `canCraft` "owned" message.
- `src/game/state.js` — `isTools`/`copyTools` accept gold/diamond as permanent tiers.
- `src/core/session.js` — `combat` runtime state.
- `src/core/input.js` — `Q` toggle; LMB/RMB combat branch; suppress context menu; `isDrawn` gating.
- `src/core/loop.js` — charge tick; strip weapon/charge suffix when reading the hunt target.
- `src/render/renderer.js` — aim-path preview, charge ring, stance badge; suffix-safe quarry lookup; tiered arrow art.
- `src/ui/hud.js` — stance indicator; active weapon chip glow.
- `src/data/controls.js` — combat rows (journal Controls tab reads this).
- Tests: `tests/actions/combat.test.js` (NEW), `tests/actions/animals.test.js` (NEW), extended `tests/data/ladder.test.js`, extended `tests/game/saves.test.js`.
- Art: `tools/prepare-weapon-art.py` (gold/diamond placeholders) — final task, optional for mechanics.

---

# Slice A — Data, HP, and damage-based `E` hunt (headless-testable)

### Task A1: Four-tier weapon ladder

**Files:**
- Modify: `src/data/tools.js:6` (`TIERS`)
- Modify: `src/actions/craft.js:24-28` (`nextTier`), `src/actions/craft.js:67-104` (`canCraft` "owned" message)
- Test: `tests/data/ladder.test.js:32-46`

**Interfaces:**
- Produces: `TIERS = ['stone','iron','gold','diamond']`; `nextTier(state, tool)` returns the next tier that has a recipe in `TOOL_RECIPES[tool]`, or `null`.

- [ ] **Step 1: Update the ladder test to handle tiers a tool has no recipe for**

In `tests/data/ladder.test.js`, replace the inner tier loop (lines ~32-41) and the final assertion (lines ~44-46) so a missing recipe is skipped:

```js
      for (const tool of TOOL_IDS)
        for (const tier of TIERS) {
          const recipe = TOOL_RECIPES[tool][tier];
          if (!recipe) continue; // gathering tools stop at iron; weapons go to diamond
          const key = `${tier} ${tool}`;
          const materials = Object.keys(recipe).every((t) => can.has(t));
          const extras = tier === 'stone' || (made.has(`stone ${tool}`) && hammer && fire);
          if (!made.has(key) && materials && extras) {
            made.add(key);
            grew = true;
          }
        }
    }

    for (const tool of TOOL_IDS)
      for (const tier of TIERS) {
        if (!TOOL_RECIPES[tool][tier]) continue;
        assert.ok(made.has(`${tier} ${tool}`), `${character.id} can't reach the ${tier} ${tool}`);
      }
```

- [ ] **Step 2: Run the test to verify it still passes against the current 2-tier data**

Run: `node --test tests/data/ladder.test.js`
Expected: PASS (the `continue` guards are no-ops while `TIERS` is still stone/iron).

- [ ] **Step 3: Widen `TIERS`**

In `src/data/tools.js`, update the `TIERS` constant and its comment:

```js
/** The tiers a tool can be, weakest first. Stone tools wear out; iron and up last forever.
 *  Gathering tools are only made in stone and iron (no gold/diamond recipe); weapons go all the way. */
export const TIERS = ['stone', 'iron', 'gold', 'diamond'];
```

- [ ] **Step 4: Make `nextTier` data-driven (walk to the next tier that has a recipe)**

In `src/actions/craft.js`, replace `nextTier` (and its comment) with:

```js
/**
 * Says which tier of a tool the player would craft next.
 *
 * Climbs the tier ladder (stone → iron → gold → diamond) and returns the first tier above the one
 * they own that this tool actually has a recipe for. Gathering tools only have stone and iron
 * recipes, so they stop at iron; weapons have all four.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id, such as 'axe'.
 * @returns {string|null} The next craftable tier, or null when they already own the top one.
 */
export function nextTier(state, tool) {
  const tier = toolTier(state, tool);
  const ladder = TIERS.filter((t) => TOOL_RECIPES[tool][t]);
  const at = tier ? ladder.indexOf(tier) : -1;
  return ladder[at + 1] ?? null;
}
```

Add `TIERS` to the imports at the top of `src/actions/craft.js`:

```js
import { TOOL_RECIPES, CRAFT_SECONDS } from '../data/balance.js';
import { toolInfo, TIERS } from '../data/tools.js';
```

- [ ] **Step 5: Fix the "already own" message to name the real top tier**

In `src/actions/craft.js` `canCraft`, the `owned` branch hardcodes "an iron". Replace lines ~69-75 with a message that uses the tier the player actually owns:

```js
  if (!tier)
    return {
      ok: false,
      tier,
      reason: 'owned',
      message: `You already have ${aOrAn(toolName(tool, toolTier(state, tool)))}`,
    };
```

Add this helper above `canCraft` (ELI5 comment required):

```js
/**
 * Puts "a" or "an" in front of a name, choosing by its first sound.
 *
 * @param {string} name - A name such as "iron sword" or "gold axe".
 * @returns {string} The name with the right word in front.
 */
const aOrAn = (name) => `${'aeiou'.includes(name[0]) ? 'an' : 'a'} ${name}`;
```

- [ ] **Step 6: Run the ladder test (now that balance recipes for gold/diamond do not yet exist, they are skipped)**

Run: `node --test tests/data/ladder.test.js`
Expected: PASS (weapons still only have stone/iron recipes until Task A2; the `continue` guard skips the absent gold/diamond).

- [ ] **Step 7: Format and commit**

```bash
npm run format
git add src/data/tools.js src/actions/craft.js tests/data/ladder.test.js
git commit -m "Make the tool tier ladder four tiers and data-driven"
```

---

### Task A2: Combat balance numbers and animal HP data

**Files:**
- Modify: `src/data/balance.js` (add weapon damage, wolf HP, charge; extend `SWORD_SECONDS`, `BOW_REACH`; add gold/diamond to `TOOL_RECIPES`)
- Modify: `src/data/animals.js` (per-kind `hp`)
- Test: `tests/data/ladder.test.js` (re-run; weapons now reach diamond)

**Interfaces:**
- Produces: `WEAPON_DAMAGE`, `WOLF_HP`, `CHARGE_SECONDS`; `SWORD_SECONDS`/`BOW_REACH` with gold/diamond; `TOOL_RECIPES.sword`/`.bow` gold/diamond entries; `ANIMALS[kind].hp`.

- [ ] **Step 1: Add animal HP to `data/animals.js`**

Add an `hp` field to each animal in `ANIMALS` and document it in the table's comment. deer 4, rabbit 2, boar 6. For example, inside the `deer` entry add `hp: 4,`, `rabbit` `hp: 2,`, `boar` `hp: 6,`. Update the fields comment (lines ~5-12) to mention: "`hp` is how many points of damage it takes to fell (higher-tier weapons deal more per hit)."

- [ ] **Step 2: Extend the weapon-timing and reach tables in `data/balance.js`**

Replace `SWORD_SECONDS` and `BOW_REACH` (lines ~430-440) with four-tier versions:

```js
// Seconds a melee hit with a sword takes, by tier: quicker than the axe's HUNT_SECONDS, and quicker
// at higher tiers.
export const SWORD_SECONDS = { stone: 1, iron: 0.6, gold: 0.6, diamond: 0.5 };

// Seconds a bow shot takes from nocking the arrow to the hit (the `bow` clip fills exactly this long).
export const BOW_SECONDS = 1.5;

// How far away a bow can hunt from, by tier. A walking player startles an animal only within
// FLEE_WALKING, so a bow lets a careful hunter shoot before the animal runs.
export const BOW_REACH = { stone: 260, iron: 340, gold: 400, diamond: 460 };
```

- [ ] **Step 3: Add the damage, wolf-HP, and charge constants to `data/balance.js`**

Add near the hunting block (after `BOW_REACH`):

```js
// How much damage one full-strength hit deals, by weapon and tier. A hit subtracts this from a
// creature's hit points; when they reach 0 it falls. The sword and the bow share the same curve;
// the axe is the weak fallback and is only ever stone or iron.
export const WEAPON_DAMAGE = {
  sword: { stone: 2, iron: 3, gold: 4, diamond: 6 },
  bow: { stone: 2, iron: 3, gold: 4, diamond: 6 },
  axe: { stone: 1, iron: 2 },
};

// How many hit points a wolf has. Animals carry their own hp in data/animals.js.
export const WOLF_HP = 6;

// Seconds of holding the right mouse button to charge a bow shot to full. A quick tap ("quick
// release") is about half damage; a full hold is full damage (see the damage formula in the plan).
export const CHARGE_SECONDS = 0.9;
```

- [ ] **Step 4: Add gold and diamond weapon recipes to `TOOL_RECIPES`**

In `src/data/balance.js`, extend the `sword` and `bow` lines of `TOOL_RECIPES` (lines ~255-256). Gold and diamond are forged like iron (hammer + the player's fire):

```js
  // The weapons. A bow is strung with plant fibre, so it asks for herbs (wild flowers). Gold and
  // diamond are forged like iron, giving the mined gold and diamond their first use.
  sword: {
    stone: { wood: 1, stone: 4 },
    iron: { wood: 1, stone: 1, iron: 4 },
    gold: { wood: 1, gold: 4 },
    diamond: { wood: 1, diamond: 4 },
  },
  bow: {
    stone: { wood: 4, stone: 1, herbs: 2 },
    iron: { wood: 3, iron: 2, herbs: 2 },
    gold: { wood: 3, gold: 2, herbs: 2 },
    diamond: { wood: 3, diamond: 2, herbs: 2 },
  },
```

- [ ] **Step 5: Teach `canCraft` that gold/diamond are forged (hammer + fire), like iron**

In `src/actions/craft.js` `canCraft`, the hammer and fire checks currently test `tier === 'iron'`. Change both to "any forged tier" so gold/diamond also need the forge. Replace lines ~93-102:

```js
  const forged = tier !== 'stone';
  if (forged && !hasTool(state, 'hammer'))
    return { ok: false, tier, cost, reason: 'hammer', message: `${capital(tier)} tools need a hammer` };
  if (forged && !byFire(state))
    return {
      ok: false,
      tier,
      cost,
      reason: 'fire',
      message: `Forge ${tier} tools beside your campfire`,
    };
```

Add a `capital` helper above `canCraft`:

```js
/**
 * Makes a word start with a capital letter, so "gold" reads "Gold" at the start of a sentence.
 *
 * @param {string} word - A word in small letters.
 * @returns {string} The word with a big first letter.
 */
const capital = (word) => word[0].toUpperCase() + word.slice(1);
```

Also update `finishCraft` (line ~144) so gold/diamond, like iron, are stored without `uses` and wear the hammer when forged. Replace lines ~142-146:

```js
  for (const [type, n] of Object.entries(check.cost)) state.resources[type] -= n;
  const forged = check.tier !== 'stone';
  // Forging wears a stone hammer one use. A forged tool lasts forever, so it is stored without uses.
  const wear = forged ? wearTool(state, 'hammer') : null;
  state.tools[tool] = forged ? { tier: check.tier } : newStoneTool(tool);
  return { ok: true, tool, tier: check.tier, wear: tool === 'hammer' ? null : wear };
```

- [ ] **Step 6: Run the ladder test — weapons now reach diamond**

Run: `node --test tests/data/ladder.test.js`
Expected: PASS. (If it fails because gold/diamond ore resources are not gatherable, that is a real reachability bug — confirm `gold-ore`/`diamond-ore` are in `NODES` with types `gold`/`diamond`; they are placed in `edits.json` and mined with a pickaxe per `CLAUDE.md`.)

- [ ] **Step 7: Format and commit**

```bash
npm run format
git add src/data/balance.js src/data/animals.js src/actions/craft.js
git commit -m "Add weapon damage, creature HP, charge, and gold/diamond recipes"
```

---

### Task A3: Creature HP runtime + damage math

**Files:**
- Create: `src/actions/combat.js`
- Modify: `src/world/animals.js:100-121` (`atHome` add `hp`), `src/world/animals.js:82-83` (respawn resets `hp`)
- Modify: `src/world/wolves.js:62-80` (`atDen` add `hp`), and the wolf respawn in `src/actions/wolves.js:174-177`
- Test: `tests/actions/combat.test.js` (NEW)

**Interfaces:**
- Produces:
  - `creatureMaxHp(creature) → number`
  - `weaponDamage(state, tool, chargeFrac = 1) → number`
  - `aimTarget(state, wx, wy) → creature | null`
  - `meleeTarget(state) → creature | null`
- Consumes: `WEAPON_DAMAGE`, `CHARGE_SECONDS` (unused here but exported for B), `WOLF_HP`, `HUNT_REACH`, `BOW_REACH` from balance; `ANIMALS` from data/animals; `toolTier` from world/tools; `WILD_ANIMALS`, `isAlive` from world/animals; `WOLVES` from world/wolves.

- [ ] **Step 1: Write the failing test for the damage math and max-HP lookup**

Create `tests/actions/combat.test.js`:

```js
// Checks the combat maths: a weapon's damage by tier and charge, and a creature's max hit points.
// A wrong curve here would make hunts feel random or make a tier pointless.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { weaponDamage, creatureMaxHp } from '../../src/actions/combat.js';

// A full-charge hit deals the tier's full damage; a zero-charge (snap) hit deals floor(full/2), min 1.
test('weapon damage scales with tier and charge', () => {
  const state = createGame('scout');
  state.tools.sword = { tier: 'stone' }; // full 2
  assert.equal(weaponDamage(state, 'sword', 1), 2);
  assert.equal(weaponDamage(state, 'sword', 0), 1); // floor(2/2) = 1
  state.tools.sword = { tier: 'diamond' }; // full 6
  assert.equal(weaponDamage(state, 'sword', 1), 6);
  assert.equal(weaponDamage(state, 'sword', 0), 3); // floor(6/2) = 3
  assert.equal(weaponDamage(state, 'sword', 0.5), 4); // floor(6 * 0.75) = 4
});

// A creature with no weapon owned, or an unowned tier, still yields at least 1 so a hit never no-ops.
test('weapon damage is at least 1', () => {
  const state = createGame('survivor'); // starts with no tools
  state.tools.bow = { tier: 'stone' };
  assert.equal(weaponDamage(state, 'bow', 0), 1);
});

// Max HP comes from the animal table for animals and from WOLF_HP for wolves (wolves carry a `den`).
test('creature max hp by kind', () => {
  assert.equal(creatureMaxHp({ kind: 'deer' }), 4);
  assert.equal(creatureMaxHp({ kind: 'rabbit' }), 2);
  assert.equal(creatureMaxHp({ den: {}, id: 'wolf-x' }), 6);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/actions/combat.test.js`
Expected: FAIL (`combat.js` does not exist).

- [ ] **Step 3: Create `src/actions/combat.js`**

```js
// Combat maths and target-picking, shared by the E hunt and the mouse combat. Pure: no renderer,
// no input, no DOM. It works out how much damage a weapon does, how much a creature can take, and
// which creature a swing or an aimed shot is pointed at.

import { WEAPON_DAMAGE, HUNT_REACH, BOW_REACH } from '../data/balance.js';
import { ANIMALS } from '../data/animals.js';
import { WOLF_HP } from '../data/balance.js';
import { toolTier } from '../world/tools.js';
import { WILD_ANIMALS, isAlive } from '../world/animals.js';
import { WOLVES } from '../world/wolves.js';

/**
 * Says how many hit points a creature can take before it falls.
 *
 * Wolves all share one number (they carry a `den`); each kind of animal has its own, from the
 * animal table.
 *
 * @param {object} creature - An animal or a wolf.
 * @returns {number} Its full hit points.
 */
export function creatureMaxHp(creature) {
  return creature.den ? WOLF_HP : ANIMALS[creature.kind].hp;
}

/**
 * Works out how much damage one hit with a weapon deals, from its tier and how charged the shot is.
 *
 * A tap ("quick release", charge 0) deals about half; a full hold (charge 1) deals the tier's full
 * damage; it slides between the two. Never below 1, so a hit always counts.
 *
 * @param {object} state - The game being played (to read the weapon's tier).
 * @param {string} tool - The weapon's id: 'sword', 'bow' or 'axe'.
 * @param {number} [chargeFrac=1] - How charged the shot is, 0 to 1. The E hunt is always 1.
 * @returns {number} The damage, a whole number of at least 1.
 */
export function weaponDamage(state, tool, chargeFrac = 1) {
  const full = WEAPON_DAMAGE[tool]?.[toolTier(state, tool)] ?? 1;
  const frac = Math.min(Math.max(chargeFrac, 0), 1);
  return Math.max(1, Math.floor(full * (0.5 + 0.5 * frac)));
}

/**
 * Picks the creature an aimed bow shot would lock onto: the one nearest the cursor, among those
 * within the bow's reach of the player.
 *
 * @param {object} state - The game being played.
 * @param {number} wx - Where the cursor points, world x.
 * @param {number} wy - Where the cursor points, world y.
 * @returns {object|null} The locked creature, or null when none is in reach.
 */
export function aimTarget(state, wx, wy) {
  const reach = BOW_REACH[toolTier(state, 'bow')] ?? 0;
  let best = null,
    bestD = Infinity;
  for (const c of [...WILD_ANIMALS, ...WOLVES]) {
    if (!isAlive(c)) continue;
    if (Math.hypot(state.player.x - c.x, state.player.y - c.y) > reach) continue;
    const d = Math.hypot(wx - c.x, wy - c.y);
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

/**
 * Picks the creature a sword swing would hit: the nearest one within arm's length of the player.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The creature, or null when none is close enough.
 */
export function meleeTarget(state) {
  let best = null,
    bestD = HUNT_REACH;
  for (const c of [...WILD_ANIMALS, ...WOLVES]) {
    if (!isAlive(c)) continue;
    const d = Math.hypot(state.player.x - c.x, state.player.y - c.y);
    if (d <= bestD) [best, bestD] = [c, d];
  }
  return best;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/actions/combat.test.js`
Expected: PASS.

- [ ] **Step 5: Give live animals an `hp` field**

In `src/world/animals.js` `atHome` (the returned object, ~lines 106-120), add `hp` seeded from the kind, right after `kind`:

```js
    kind: herd.kind,
    hp: ANIMALS[herd.kind].hp,
    herd,
```

In the respawn branch (`resetAnimals` uses `atHome`, so it is covered), fix the in-place respawn in `src/actions/animals.js` `tickAnimals` (~lines 82-83) to restore hp:

```js
      if (state.time >= a.respawnAt)
        Object.assign(a, {
          phase: 'idle',
          x: a.herd.x,
          y: a.herd.y,
          hp: ANIMALS[a.kind].hp,
          left: 2,
          clock: 0,
        });
```

`ANIMALS` is already imported in `actions/animals.js`.

- [ ] **Step 6: Give live wolves an `hp` field**

In `src/world/wolves.js` `atDen` (returned object, ~lines 63-79), add after `den`:

```js
    den,
    hp: WOLF_HP,
```

Import `WOLF_HP`: add it to the balance import at the top of `src/world/wolves.js`:

```js
import { DENS_PER_REGION, PACK_SIZE, DEN_FROM_SPAWN, WOLF_HP } from '../data/balance.js';
```

Fix the wolf respawn in `src/actions/wolves.js` `tickWolves` (~lines 174-177) to restore hp:

```js
      if (state.time >= w.respawnAt)
        Object.assign(w, { phase: 'idle', x: w.den.x, y: w.den.y, hp: WOLF_HP, left: 1, clock: 0 });
```

Import `WOLF_HP` into `src/actions/wolves.js` (add to its balance import list).

- [ ] **Step 7: Run the full test suite + boundaries**

Run: `npm test`
Expected: PASS, including `tests/boundaries.test.js` (confirms `combat.js` has no forbidden imports/words).

- [ ] **Step 8: Format and commit**

```bash
npm run format
git add src/actions/combat.js src/world/animals.js src/world/wolves.js src/actions/animals.js src/actions/wolves.js tests/actions/combat.test.js
git commit -m "Add creature hit points and combat damage maths"
```

---

### Task A4: Damage-based hunt (`applyHit`, `fellCreature`, rewritten `finishHunt`)

**Files:**
- Modify: `src/actions/animals.js` (`finishHunt`, new `applyHit`, `fellCreature`, `forcedWeapon`; updated `huntClip`; import from combat.js)
- Modify: `src/core/loop.js:284-293` (strip the weapon/charge suffix when reading the hunt target)
- Test: `tests/actions/animals.test.js` (NEW)

**Interfaces:**
- Consumes: `creatureMaxHp`, `weaponDamage` from `actions/combat.js`.
- Produces:
  - `applyHit(state, creature, damage, roll = Math.random) → { dead: boolean, reward?: object, blocked?: boolean }`
  - `finishHunt(state, target, roll)` now deals one hit per call; target may be `hunt:<id>` (auto) or `hunt:<id>:<weapon>:<tenths>` (forced).

- [ ] **Step 1: Write the failing test for per-hit damage and felling**

Create `tests/actions/animals.test.js`:

```js
// Checks the damage-based hunt: a hit lowers a creature's hp, a wounded animal flees, and the
// killing hit gives the reward exactly once. Guards against one-shot kills creeping back, or a hit
// that gives food without lowering hp.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { resetAnimals, WILD_ANIMALS } from '../../src/world/animals.js';
import { applyHit, finishHunt } from '../../src/actions/animals.js';

/** Builds a plain deer-like creature for a hit test. */
const deer = () => ({ id: 'test-deer', kind: 'deer', hp: 4, phase: 'idle', x: 0, y: 0, clock: 0, fleeFor: 0 });

// A non-lethal hit lowers hp and sends an animal running, with no reward.
test('a non-lethal hit wounds and does not reward', () => {
  const state = createGame('scout');
  const a = deer();
  const before = state.resources.food;
  const hit = applyHit(state, a, 2);
  assert.equal(hit.dead, false);
  assert.equal(a.hp, 2);
  assert.equal(a.phase, 'run');
  assert.equal(state.resources.food, before);
});

// The hit that drops hp to 0 fells the animal and gives its food.
test('the killing hit fells and rewards', () => {
  const state = createGame('scout');
  const a = deer();
  a.hp = 2;
  const hit = applyHit(state, a, 5);
  assert.equal(hit.dead, true);
  assert.equal(a.phase, 'down');
  assert.equal(hit.reward.food, 5);
});

// finishHunt with a real animal and a sword takes one bite of hp per call (no instant kill).
test('finishHunt deals one hit, not an instant kill', () => {
  const state = createGame('scout'); // scout owns a stone axe
  state.tools.sword = { tier: 'stone' }; // full damage 2
  resetAnimals();
  const a = WILD_ANIMALS.find((x) => x.kind === 'deer');
  Object.assign(a, { x: state.player.x + 20, y: state.player.y, hp: 4, phase: 'idle' });
  const r = finishHunt(state, `hunt:${a.id}:sword:10`, () => 0.99);
  assert.equal(r.wounded, true); // 4 hp - 2 = 2, still up
  assert.equal(a.hp, 2);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/actions/animals.test.js`
Expected: FAIL (`applyHit` not exported; `finishHunt` still instant-kills / ignores the suffix).

- [ ] **Step 3: Add `applyHit` and `fellCreature` to `actions/animals.js`**

Add the combat import near the top of `src/actions/animals.js`:

```js
import { creatureMaxHp, weaponDamage } from './combat.js';
```

Add these two functions (place them just above `finishHunt`):

```js
/**
 * Gives one creature the rewards for being felled, and lays it down.
 *
 * A wolf gives only its pelt and is back at its den next dusk. Any other animal gives its food (and
 * for a deer sometimes an antler) and its hide, and comes back to its herd a day later. An animal
 * whose food has no room in the bag is not felled: the caller leaves it wounded instead.
 *
 * @param {object} state - The game being played. Resources change.
 * @param {object} a - The creature (already at 0 hp).
 * @param {() => number} roll - Gives 0 to 1, for the antler.
 * @returns {{animal: string, food: number, leather?: number, pelt?: number, antler: boolean}|null}
 *   The reward, or null when a full bag means an animal is not felled after all.
 */
function fellCreature(state, a, roll) {
  if (a.den) {
    Object.assign(a, { phase: 'down', clock: 0, respawnAt: nextDusk(state.time) });
    const pelt = addItem(state, 'wolfpelt') ? 1 : 0;
    return { animal: 'wolf', food: 0, pelt, antler: false };
  }
  const kind = ANIMALS[a.kind];
  if (!hasRoomFor(state, { food: kind.food })) return null;
  const rolled = roll() < kind.antler;
  Object.assign(a, { phase: 'down', clock: 0, respawnAt: state.time + ANIMAL_RETURN });
  addItem(state, 'food', kind.food);
  const leather = addItem(state, 'leather', kind.leather) ? kind.leather : 0;
  const antler = rolled && addItem(state, 'antler');
  return { animal: kind.name, food: kind.food, leather, antler };
}

/**
 * Lands one hit on a creature: takes the damage off its hit points, and fells it if that empties them.
 *
 * A wounded animal bolts (a wounded wolf keeps coming). If a killing blow lands on an animal but the
 * bag has no room for its food, the hit is wasted and the animal stays up, so a full bag never loses
 * a kill into thin air.
 *
 * @param {object} state - The game being played.
 * @param {object} creature - The animal or wolf being hit.
 * @param {number} damage - How much to take off.
 * @param {() => number} [roll=Math.random] - For a deer's antler.
 * @returns {{dead: boolean, reward?: object, blocked?: boolean}} Whether it fell and the reward, or
 *   `blocked` when a full bag stopped an animal's kill.
 */
export function applyHit(state, creature, damage, roll = Math.random) {
  if (creature.hp - damage > 0) {
    creature.hp -= damage;
    // Animals run from a wound; wolves press on.
    if (!creature.den) {
      if (creature.phase !== 'run') creature.clock = 0;
      Object.assign(creature, { phase: 'run', fleeFor: FLEE_SECONDS });
    }
    return { dead: false };
  }
  const reward = fellCreature(state, creature, roll);
  if (!reward) return { dead: false, blocked: true };
  creature.hp = 0;
  return { dead: true, reward };
}
```

Note: `creatureMaxHp` is imported for use in Task B and the HP resets; it is fine to import it now (used by B). If the unused-import lint-free rule bites (there is no linter, only Prettier), leave it — it is used in Task B. To keep A4 self-contained you may omit `creatureMaxHp` from the import here and add it in Task B2.

- [ ] **Step 4: Add `forcedWeapon` and rewrite `finishHunt`**

Add `forcedWeapon` above `finishHunt`:

```js
/**
 * Confirms a weapon the mouse combat chose is still usable on a target at distance `d`.
 *
 * The player must still own it, and the target must be within that weapon's reach (a bow's long
 * reach, or arm's length for a sword or axe).
 *
 * @param {object} state - The game being played.
 * @param {string} tool - 'sword', 'bow' or 'axe'.
 * @param {number} d - How far the target is (already made a little lenient by the caller).
 * @returns {{tool: string}|null} The weapon, or null when it can't be used now.
 */
function forcedWeapon(state, tool, d) {
  if (!hasTool(state, tool)) return null;
  if (tool === 'bow') return d <= BOW_REACH[toolTier(state, 'bow')] ? { tool } : null;
  return d <= HUNT_REACH ? { tool } : null;
}
```

Replace `finishHunt` (lines ~282-322) with:

```js
export function finishHunt(state, target, roll = Math.random) {
  const [id, forcedTool, chargeTag] = target.slice(HUNT_PREFIX.length).split(':');
  const a = animalById(id) ?? WOLVES.find((w) => w.id === id);
  if (!a || !isAlive(a)) return null;
  // The creature may have shifted a little during the swing: half as far again still counts.
  const d = Math.hypot(state.player.x - a.x, state.player.y - a.y) / 1.5;
  const weapon = forcedTool ? forcedWeapon(state, forcedTool, d) : huntWeapon(state, d);
  if (!weapon) return null;
  // A bow spends an arrow per shot, hit or miss.
  if (weapon.tool === 'bow') {
    if (!hasArrows(state)) return null;
    state.resources.arrow -= ARROW_PER_SHOT;
  }
  const frac = chargeTag ? Number(chargeTag) / 10 : 1;
  const wear = wearTool(state, weapon.tool);
  const hit = applyHit(state, a, weaponDamage(state, weapon.tool, frac), roll);
  if (!hit.dead)
    return {
      kind: 'hunt',
      wounded: true,
      animal: a.den ? 'wolf' : ANIMALS[a.kind].name,
      wear,
    };
  return { kind: 'hunt', ...hit.reward, wear };
}
```

Update `finishHunt`'s doc comment to say it deals one hit (felling only when hp reaches 0) and returns `wounded: true` for a non-killing hit.

- [ ] **Step 5: Keep the JSDoc and remove now-dead code**

The old `finishHunt` body (the inline wolf/animal reward logic) is now in `fellCreature`; ensure it is fully replaced, not duplicated. Keep imports `addItem`, `hasRoomFor`, `BAG_FULL`, `nextDusk`, `ANIMAL_RETURN`, `ARROW_PER_SHOT` — all still used.

- [ ] **Step 6: Fix the loop's hunt-target reading to ignore the suffix**

In `src/core/loop.js`, the `hunting` ids passed to `tickAnimals` and `tickWolves` slice the target but keep the `:weapon:tenths` suffix. Replace lines ~284-293:

```js
          hunting: animator.pending?.target?.startsWith('hunt:')
            ? animator.pending.target.slice(5).split(':')[0]
            : null,
        });
        // The wolves guard their dens by day and roam at night; a growl or a bite is told in a toast.
        const howled = tickWolves(state, dt, {
          hunting: animator.pending?.target?.startsWith('hunt:wolf-')
            ? animator.pending.target.slice(5).split(':')[0]
            : null,
        });
```

- [ ] **Step 7: Run the hunt tests**

Run: `node --test tests/actions/animals.test.js`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Format and commit**

```bash
npm run format
git add src/actions/animals.js src/core/loop.js tests/actions/animals.test.js
git commit -m "Make hunting deal damage per hit instead of an instant kill"
```

---

### Task A5: Saves accept gold/diamond weapons

**Files:**
- Modify: `src/game/state.js:243-268` (`isTools`, `copyTools`)
- Test: `tests/game/saves.test.js` (add a case)

**Interfaces:**
- Produces: a save holding `tools.sword = { tier: 'gold' }` (no `uses`) loads; stone/iron saves are unchanged.

- [ ] **Step 1: Write the failing save test**

Add to `tests/game/saves.test.js` (follow the file's existing imports and `restoreGame`/serialize helpers). A minimal shape — adapt field names to the file's existing helpers:

```js
// A save that holds a forged gold weapon (no uses, like iron) must load, not be thrown away.
test('a gold weapon loads', () => {
  const state = createGame('scout');
  state.tools.sword = { tier: 'gold' };
  const raw = JSON.parse(JSON.stringify(serializeGame(state)));
  const loaded = restoreGame(raw);
  assert.ok(loaded);
  assert.deepEqual(loaded.tools.sword, { tier: 'gold' });
});
```

(If the test file uses a different serialize entry point, match it; the point is round-tripping a `{ tier: 'gold' }` tool.)

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/game/saves.test.js`
Expected: FAIL (`isTools` rejects the `gold` tier → save treated as unreadable).

- [ ] **Step 3: Accept forged (permanent) tiers in `isTools`**

In `src/game/state.js`, add a constant near the top of the tools-validation area and use it. A permanent tier is any non-stone tier (iron/gold/diamond) stored without `uses`:

```js
/** Tiers stored without a use count: they never wear out. Stone is the only one that does. */
const PERMANENT_TIERS = TIERS.filter((t) => t !== 'stone');
```

Import `TIERS` into `src/game/state.js` (it already imports from `data/tools.js` — add `TIERS` to that import).

Replace the `isTools` tier check (lines ~249-253):

```js
      (PERMANENT_TIERS.includes(t.tier) ||
        (t.tier === 'stone' &&
          Number.isSafeInteger(t.uses) &&
          t.uses >= 1 &&
          t.uses <= TOOL_USES[id] * GRIP_MAX)),
```

- [ ] **Step 4: Preserve the real tier in `copyTools`**

Replace `copyTools`'s mapping (lines ~262-268) so forged tiers keep their own tier string:

```js
const copyTools = (tools) =>
  Object.fromEntries(
    Object.entries(tools).map(([id, t]) => [
      id,
      PERMANENT_TIERS.includes(t.tier) ? { tier: t.tier } : { tier: 'stone', uses: t.uses },
    ]),
  );
```

- [ ] **Step 5: Run the save tests, then the full suite**

Run: `node --test tests/game/saves.test.js`
Expected: PASS.
Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add src/game/state.js tests/game/saves.test.js
git commit -m "Load saves that hold gold or diamond weapons"
```

**End of Slice A.** At this point weapons have four tiers, creatures have HP, and the `E`/interact hunt deals damage per press. Run `npm test`, `npm run build`, `npm run format:check` — all must pass before starting Slice B.

---

# Slice B — Mouse combat and visuals (browser-verified)

These tasks touch input, the renderer, the HUD, and session state — layers that `node:test` does not cover. Each ends with explicit browser verification using the `wildhaven` launch config at `127.0.0.1` (never `localhost`, to protect real saves). B1 is pure and unit-tested.

### Task B1: Mouse begin-swing and begin-shot actions

**Files:**
- Modify: `src/actions/animals.js` (`beginSwing`, `beginShot`; updated `huntClip`)
- Test: `tests/actions/animals.test.js` (add cases)

**Interfaces:**
- Produces:
  - `beginSwing(state, animator, creature) → { ok, tool?, reason?, message? }` — starts a sword melee action, target `hunt:<id>:sword:10`.
  - `beginShot(state, animator, creature, chargeFrac) → { ok, tool?, charge?, reason?, message? }` — starts a bow action, target `hunt:<id>:bow:<tenths>`.
  - `huntClip` returns the iron art for any non-stone tier (gold/diamond reuse iron art).

- [ ] **Step 1: Write failing tests for the two begin functions**

Add to `tests/actions/animals.test.js`:

```js
// A sword swing starts a melee action aimed at a creature in reach, with the sword in the target.
test('beginSwing starts a sword action on a nearby creature', () => {
  const state = createGame('scout');
  state.tools.sword = { tier: 'iron' };
  const animator = { pending: null };
  const a = { id: 'herd-x-0', kind: 'deer', hp: 4, phase: 'idle', x: state.player.x + 30, y: state.player.y };
  const r = beginSwing(state, animator, a);
  assert.equal(r.ok, true);
  assert.equal(animator.pending.target, 'hunt:herd-x-0:sword:10');
});

// A bow shot encodes the charge as tenths in the target; a tap is 0, a full hold is 10.
test('beginShot encodes charge in the target', () => {
  const state = createGame('scout');
  state.tools.bow = { tier: 'stone' };
  state.resources.arrow = 5;
  const animator = { pending: null };
  const a = { id: 'herd-y-1', kind: 'rabbit', hp: 2, phase: 'idle', x: state.player.x + 150, y: state.player.y };
  assert.equal(beginShot(state, animator, a, 0).ok, false === false && true); // sanity; replaced below
});
```

Replace that last placeholder assertion with two real ones:

```js
  const snap = beginShot(state, { pending: null }, a, 0);
  assert.equal(snap.ok, true);
  // target ends with :bow:0
  // (read it off the animator you passed)
```

Prefer this clearer version instead of the placeholder — pass a fresh animator and read the target:

```js
test('beginShot encodes charge in the target', () => {
  const state = createGame('scout');
  state.tools.bow = { tier: 'stone' };
  state.resources.arrow = 5;
  const a = { id: 'herd-y-1', kind: 'rabbit', hp: 2, phase: 'idle', x: state.player.x + 150, y: state.player.y };

  const tap = { pending: null };
  beginShot(state, tap, a, 0);
  assert.ok(tap.pending.target.endsWith(':bow:0'));

  const full = { pending: null };
  beginShot(state, full, a, 1);
  assert.ok(full.pending.target.endsWith(':bow:10'));
});

// A bow with no arrows refuses the shot with a clear reason.
test('beginShot needs arrows', () => {
  const state = createGame('scout');
  state.tools.bow = { tier: 'stone' };
  state.resources.arrow = 0;
  const a = { id: 'herd-z-0', kind: 'deer', hp: 4, phase: 'idle', x: state.player.x + 150, y: state.player.y };
  assert.equal(beginShot(state, { pending: null }, a, 1).reason, 'arrows');
});
```

Import the new functions at the top of the test file: `import { applyHit, finishHunt, beginSwing, beginShot } from '../../src/actions/animals.js';`

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/actions/animals.test.js`
Expected: FAIL (`beginSwing`/`beginShot` not exported).

- [ ] **Step 3: Update `huntClip` to reuse iron art for gold/diamond**

In `src/actions/animals.js`, change `huntClip` (line ~196-199):

```js
export function huntClip(state, tool) {
  const base = tool === 'axe' ? 'chop' : tool;
  // Only stone and iron swing sheets exist; gold and diamond reuse the iron art for now.
  return base + (toolTier(state, tool) !== 'stone' ? 'Iron' : '');
}
```

- [ ] **Step 4: Add `beginSwing` and `beginShot`**

Add these next to `beginHunt` in `src/actions/animals.js` (they share its import set — `startAction`, `HUNT_PREFIX`, `hasTool`, `toolTier`, `hasRoomFor`, `BAG_FULL`, `ANIMALS`, `SWORD_SECONDS`, `BOW_SECONDS`, `BOW_REACH`, `HUNT_REACH`, `hasArrows`). Add `SWORD_SECONDS`, `BOW_SECONDS` to the balance import if not already present.

```js
/**
 * Starts a sword swing at a creature in reach: what the left mouse button does while a weapon is
 * drawn. The swing's clip plays for the sword's tier time, and finishInteraction lands the hit.
 *
 * @param {object} state - The game being played. The player turns to face the creature.
 * @param {object} animator - The player's animation state.
 * @param {object} creature - The animal or wolf to hit (picked by meleeTarget).
 * @returns {{ok: boolean, tool?: string, reason?: string, message?: string}} Whether the swing
 *   started, or why not: 'busy', 'tool' (no sword), 'far', or 'full' (no room for the food).
 */
export function beginSwing(state, animator, creature) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  if (!hasTool(state, 'sword')) return { ok: false, reason: 'tool' };
  if (!creature || !isAlive(creature)) return { ok: false, reason: 'far' };
  const d = Math.hypot(state.player.x - creature.x, state.player.y - creature.y);
  if (d > HUNT_REACH) return { ok: false, reason: 'far' };
  if (!creature.den && !hasRoomFor(state, { food: ANIMALS[creature.kind].food }))
    return { ok: false, reason: 'full', message: BAG_FULL };
  state.player.direction = creature.x < state.player.x ? 1 : 2;
  startAction(
    animator,
    huntClip(state, 'sword'),
    `${HUNT_PREFIX}${creature.id}:sword:10`,
    SWORD_SECONDS[toolTier(state, 'sword')],
  );
  return { ok: true, tool: 'sword' };
}

/**
 * Starts a bow shot at a locked creature: what releasing the right mouse button does. How long the
 * button was held (0 to 1) is turned into tenths and carried in the target, so finishInteraction
 * knows how charged — and so how strong — the shot was.
 *
 * @param {object} state - The game being played. The player turns to face the target.
 * @param {object} animator - The player's animation state.
 * @param {object} creature - The locked creature (from aimTarget).
 * @param {number} chargeFrac - How charged the shot is, 0 (quick tap) to 1 (full hold).
 * @returns {{ok: boolean, tool?: string, charge?: number, reason?: string, message?: string}}
 *   Whether the shot started, or why not: 'busy', 'tool' (no bow), 'arrows', 'far', or 'full'.
 */
export function beginShot(state, animator, creature, chargeFrac) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  if (!hasTool(state, 'bow')) return { ok: false, reason: 'tool' };
  if (!hasArrows(state))
    return { ok: false, reason: 'arrows', message: 'Out of arrows · Fletch more in the Build menu (B)' };
  if (!creature || !isAlive(creature)) return { ok: false, reason: 'far' };
  const d = Math.hypot(state.player.x - creature.x, state.player.y - creature.y);
  if (d > BOW_REACH[toolTier(state, 'bow')]) return { ok: false, reason: 'far' };
  if (!creature.den && !hasRoomFor(state, { food: ANIMALS[creature.kind].food }))
    return { ok: false, reason: 'full', message: BAG_FULL };
  state.player.direction = creature.x < state.player.x ? 1 : 2;
  const tenths = Math.round(Math.min(Math.max(chargeFrac, 0), 1) * 10);
  startAction(animator, huntClip(state, 'bow'), `${HUNT_PREFIX}${creature.id}:bow:${tenths}`, BOW_SECONDS);
  return { ok: true, tool: 'bow', charge: tenths / 10 };
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/actions/animals.test.js`
Expected: PASS.

- [ ] **Step 6: Run the full suite + boundaries**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Format and commit**

```bash
npm run format
git add src/actions/animals.js tests/actions/animals.test.js
git commit -m "Add mouse sword-swing and bow-shot hunt actions"
```

---

### Task B2: Combat stance on the session + `isDrawn` helper

**Files:**
- Modify: `src/core/session.js` (add `combat` to the session object)
- Modify: `src/core/input.js` (add `isDrawn` helper used by B3's handlers)

**Interfaces:**
- Produces: `session.combat = { drawn: false, aiming: null }`; `isDrawn(session)` → true only when a weapon is drawn and combat is live (on foot, not paused, not in build mode/menu).

- [ ] **Step 1: Add combat state to the session**

In `src/core/session.js` `createSession()`, add alongside the other runtime fields (e.g. near `build` and `pointer`):

```js
    // Combat stance (runtime only, never saved): whether a weapon is drawn, and the live bow aim.
    combat: { drawn: false, aiming: null },
```

Document it in the function's comment line listing what the session holds.

- [ ] **Step 2: Add an `isDrawn` helper in input.js**

In `src/core/input.js`, inside `setupInput` (so it closes over `session`/`ui`), add:

```js
  /**
   * Says whether a weapon is drawn AND combat can act right now: on foot, not paused, and not in
   * the build menu or placing a building. Entering the boat or any dialog quietly sheathes.
   *
   * @returns {boolean} True when the left/right mouse buttons mean sword and bow.
   */
  function isDrawn() {
    return (
      session.combat.drawn &&
      session.screen === 'game' &&
      !ui.dialogs.isPaused() &&
      !session.build.active &&
      !session.build.menu &&
      !session.state?.aboard
    );
  }
```

(This is wired to inputs in Task B3. It is safe to add now; nothing calls it yet.)

- [ ] **Step 3: Verify the game still starts (no behaviour change yet)**

Run: `npm run build`
Expected: PASS (build succeeds; the new fields are inert).

- [ ] **Step 4: Commit**

```bash
npm run format
git add src/core/session.js src/core/input.js
git commit -m "Add a combat stance to the session"
```

---

### Task B3: Input — Q toggle, LMB swing, RMB aim/charge/loose

**Files:**
- Modify: `src/core/input.js` (Q key; pointer handlers for left/right buttons; suppress context menu; expose charge start)
- Modify: `src/core/loop.js` (tick the live charge each frame)

**Interfaces:**
- Consumes: `isDrawn`, `beginSwing`, `beginShot`, `meleeTarget`, `aimTarget`, `renderer.screenToWorld`.
- Produces: pressing `Q` toggles `session.combat.drawn`; while drawn, left button swings, right button holds-to-aim and releases to shoot; `session.combat.aiming = { target, start, charge }` while held.

- [ ] **Step 1: Import the combat functions in input.js**

Add:

```js
import { beginSwing, beginShot, HUNT_PREFIX } from '../actions/animals.js';
import { meleeTarget, aimTarget } from '../actions/combat.js';
```

(`HUNT_PREFIX` may already be reachable; import what you use.)

- [ ] **Step 2: Add the `Q` toggle to the keydown handler**

In the `keydown` listener (after the `b` handler, before the number keys), add:

```js
    // Q draws a weapon (sword in the left hand, bow in the right) or sheathes it.
    if (key === 'q' && !event.repeat) {
      event.preventDefault();
      if (!hasTool(session.state, 'sword') && !hasTool(session.state, 'bow')) {
        ui.hud.notify('You have no weapon to draw. Make one in the Build menu (B).');
        return;
      }
      session.combat.drawn = !session.combat.drawn;
      session.combat.aiming = null;
      ui.hud.update();
      return;
    }
```

Import `hasTool`: add `import { hasTool } from '../world/tools.js';` to input.js.

- [ ] **Step 3: Branch the left mouse button to a sword swing while drawn**

In the `world` `pointerdown` handler, at the very top of the left-button branch (currently `if (event.button !== 0 ...)` then `if (!session.build.active) { ... hover/clickNode }`), insert a drawn-stance check for the left button:

```js
  world.addEventListener('pointerdown', (event) => {
    session.pointer = { x: event.clientX, y: event.clientY };
    if (session.screen !== 'game') return;

    // Right button while drawn: begin aiming the bow (see the contextmenu handler for the preventDefault).
    if (event.button === 2 && isDrawn()) {
      beginAim(event);
      return;
    }
    if (event.button !== 0) return;

    // Left button while drawn: swing the sword at the nearest creature in reach.
    if (isDrawn()) {
      swing();
      return;
    }

    if (!session.build.active) {
      const aim = hover();
      if (aim?.tent) clickTent(aim);
      else if (aim) clickNode(aim);
      return;
    }
    event.preventDefault();
    interact();
  });
```

- [ ] **Step 4: Add `swing`, `beginAim`, and `releaseAim` functions**

Inside `setupInput`, add:

```js
  /** Swings the drawn sword at the nearest creature in reach (left mouse button). */
  function swing() {
    const { state, animator } = session;
    if (animator.pending || animator.asleep > 0) return;
    const r = beginSwing(state, animator, meleeTarget(state));
    if (r.ok) {
      keys.clear();
      ui.hud.update();
    } else if (r.message) ui.hud.notify(r.message);
  }

  /**
   * Begins aiming the bow (right mouse button down): locks onto the creature nearest the cursor and
   * starts the charge clock. The loop grows the charge and the renderer draws the path and ring.
   *
   * @param {PointerEvent} event - The mouse-down event, for the cursor position.
   */
  function beginAim(event) {
    const { state, renderer, animator } = session;
    if (!renderer || animator.pending || animator.asleep > 0) return;
    const world = renderer.screenToWorld(event.clientX, event.clientY);
    const target = aimTarget(state, world.x, world.y);
    session.combat.aiming = { target, start: performance.now(), charge: 0 };
    keys.clear();
  }

  /** Looses the arrow (right mouse button up): fires at the locked target with the charge held. */
  function releaseAim() {
    const aim = session.combat.aiming;
    session.combat.aiming = null;
    if (!aim || !aim.target) return;
    const r = beginShot(session.state, session.animator, aim.target, aim.charge);
    if (r.ok) ui.hud.update();
    else if (r.message) ui.hud.notify(r.message);
  }
```

- [ ] **Step 5: Listen for the right-button release and suppress the context menu**

Add listeners on `world`:

```js
  // Right button up anywhere finishes an aim (even if the cursor left the world).
  window.addEventListener('pointerup', (event) => {
    if (event.button === 2 && session.combat.aiming) releaseAim();
  });
  // While drawn, the right button is the bow, so block its browser context menu over the world.
  world.addEventListener('contextmenu', (event) => {
    if (isDrawn() || session.combat.aiming) event.preventDefault();
  });
```

- [ ] **Step 6: Tick the live charge in the loop**

In `src/core/loop.js`, inside the simulation block (after `tickSurvival`/before drawing is fine; a natural spot is near the `ui.build.update()` call), add:

```js
        // Grow the bow charge while the right mouse button is held (capped at full).
        if (session.combat.aiming)
          session.combat.aiming.charge = Math.min(
            1,
            (now - session.combat.aiming.start) / 1000 / CHARGE_SECONDS,
          );
```

Import `CHARGE_SECONDS` into `loop.js` (add to the `data/balance.js` import list).

- [ ] **Step 7: Make a movement/pause cancel an in-progress aim**

Where the loop clears `session.walk` on a movement key / pause (the `if (dx || dy || ... ) session.walk = null;` area, and the `isPaused()` guard at the top), also drop a stale aim so a paused or walking player isn't stuck aiming. Add near the `isPaused()` walk-clear (line ~240):

```js
      if (ui.dialogs.isPaused()) {
        session.walk = null;
        session.combat.aiming = null;
      }
```

- [ ] **Step 8: Browser verification**

Start the app: use `preview_start` with `{ name: 'wildhaven' }` (serves `127.0.0.1:5173`). In the Browser pane:
1. Play the Scout. Craft or grant a sword and a bow with arrows (via the Build menu, or temporarily seed resources).
2. Press `Q` — confirm the stance indicator appears (after B5; for now confirm no error and that `session.combat.drawn` flips via console `wildhaven`/devtools).
3. Walk up to a deer; left-click — the sword swing plays and the deer loses HP (it flees; repeat clicks fell it, giving food).
4. Hold right-click on a deer at range — the aim path and ring appear (after B4); release — the arrow flies and lands, dealing damage. A quick tap deals less than a full hold.
5. Press `Q` again to sheathe — left-click returns to click-to-walk/gather.
6. Check the console for errors. Confirm right-click shows no browser context menu while drawn.

Record results in `docs/verification.md`.

- [ ] **Step 9: Commit**

```bash
npm run format
git add src/core/input.js src/core/loop.js
git commit -m "Wire mouse combat: Q to draw, left to swing, right to aim and loose"
```

---

### Task B4: Renderer — aim path, charge ring, stance badge, tiered arrow

**Files:**
- Modify: `src/render/renderer.js` (aim preview before the shot; suffix-safe quarry lookup; stance badge; confirm tiered arrow texture via `huntClip` from B1)

**Interfaces:**
- Consumes: `session.combat` (pass it into `renderer.draw`); existing `reticle`/`arrow` graphics.

- [ ] **Step 1: Pass combat state into `renderer.draw`**

In `src/core/loop.js`, change the draw call (line ~375) to include combat:

```js
      renderer.draw(state, dt, animator, session.build, aim, session.combat);
```

In `src/render/renderer.js`, extend the `draw(...)` signature to accept `combat` (default `null`) and document it.

- [ ] **Step 2: Make the in-flight quarry lookup ignore the target suffix**

In `renderer.js` (~line 1250-1251), the quarry id is `target.slice(HUNT_PREFIX.length)`. Change to strip any `:weapon:tenths`:

```js
        ? [...WILD_ANIMALS, ...WOLVES].find(
            (a) => a.id === target.slice(HUNT_PREFIX.length).split(':')[0],
          )
```

- [ ] **Step 3: Draw the aim path + charge ring while the button is held (before the shot)**

The existing reticle code only runs during the shot action. Add a pre-shot preview driven by `combat.aiming`. Near the reticle block (after it, so the in-flight arrow still wins when an action is running), add:

```js
    // Holding the right mouse button: show where the shot is going and how charged it is, before it
    // is loosed. A line runs from the archer to the locked creature, and the ring tightens as it
    // charges. Skipped while an action is already running (then the in-flight arrow above is drawn).
    if (combat?.aiming?.target && !animator.pending) {
      const t = combat.aiming.target,
        ch = combat.aiming.charge,
        aimed = t.y - 18;
      reticle
        .setVisible(true)
        .lineStyle(2, 0xf7f1de, 0.35 + 0.4 * ch)
        .lineBetween(state.player.x, state.player.y - 40, t.x, aimed)
        .strokeCircle(t.x, aimed, RETICLE_RADIUS * (1.6 - 0.6 * ch));
    }
```

(Keep reduced-motion behaviour consistent with the rest of the renderer — this is a thin overlay and is acceptable; if the file gates effects behind a reduced-motion flag, follow that pattern.)

- [ ] **Step 4: Draw a stance badge when a weapon is drawn**

Add a small on-world or screen-space indicator that a weapon is drawn. The simplest in-world option: when `combat?.drawn`, draw a faint weapon glyph or ring near the player's feet. Prefer the HUD indicator (Task B5) as the primary signal; in the renderer, a minimal cue is enough:

```js
    // A drawn weapon: a faint ring under the player, so the stance reads at a glance.
    if (combat?.drawn) {
      reticle
        .setVisible(true)
        .lineStyle(2, 0xf7d98a, 0.5)
        .strokeCircle(state.player.x, state.player.y + 8, 26);
    }
```

(If `reticle` is cleared each frame before these blocks, ensure the ordering keeps all intended overlays. Combine the draw calls on the single `reticle` graphics object.)

- [ ] **Step 5: Confirm tiered arrow art**

The flying-arrow texture is chosen by `animator.clip === 'bowIron' ? 'iron' : 'stone'` (renderer ~line 1279). Because `huntClip` (B1) now returns `bowIron` for iron/gold/diamond, gold/diamond shots already draw the iron arrow — the agreed placeholder. No change needed unless `arrow-gold`/`arrow-diamond` textures are added later.

- [ ] **Step 6: Browser verification**

Re-run the `wildhaven` preview. Confirm: holding right-click shows the path line + tightening ring; the ring brightens as it charges; releasing fires the arrow along the path; a drawn weapon shows the stance ring; gold/diamond bows draw the iron arrow. Check console for errors. Add notes to `docs/verification.md`.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/render/renderer.js src/core/loop.js
git commit -m "Draw the bow aim path, charge ring, and stance cue"
```

---

### Task B5: HUD stance indicator, weapon chip glow, and controls list

**Files:**
- Modify: `src/ui/hud.js` (stance indicator; glow the active weapon chip while drawn)
- Modify: `src/data/controls.js` (add the combat rows)

**Interfaces:**
- Consumes: `session.combat.drawn`.

- [ ] **Step 1: Add combat rows to the controls list**

In `src/data/controls.js`, add to the `'Doing things'` group's `rows` (near the top, after movement, or in a new small group — keep it discoverable):

```js
      { keys: ['Q'], does: 'Draw or sheathe your weapon (sword + bow)' },
      { keys: ['Left click'], does: 'Swing the sword (while drawn)' },
      { keys: ['Right click'], does: 'Aim the bow: tap for a quick shot, hold to charge (while drawn)' },
```

And update the `'Getting around'` note or the `['Click']` row to clarify it applies when sheathed, e.g. change its `does` to `'Walk to a tree, rock or patch and gather it (when sheathed)'`.

- [ ] **Step 2: Add the stance indicator and chip glow in the HUD**

In `src/ui/hud.js`, in the HUD update path that draws the tools row, add a class to the row/body when `session.combat.drawn` is true (e.g. toggle `drawn` on the tools row container and glow the sword/bow chips). Follow the file's existing pattern for the active state of chips. Add the small CSS in `src/style.css` under a new section header (`/* ---- Combat stance ---- */`) that highlights the drawn weapon chips and shows a compact "Weapon drawn (Q)" marker.

(Exact DOM selectors depend on `hud.js`; follow its existing chip-rendering code. The signal must be visible at ~390 px width too.)

- [ ] **Step 3: Browser verification**

Re-run the preview. Press `Q`: the HUD shows the drawn state and the sword/bow chips glow; press `Q` again: it clears. Open the journal Controls tab (`J`): the three combat rows appear. Check at ~390 px width. Note results in `docs/verification.md`.

- [ ] **Step 4: Commit**

```bash
npm run format
git add src/ui/hud.js src/data/controls.js src/style.css
git commit -m "Show the combat stance in the HUD and controls list"
```

---

### Task B6: Gold/diamond placeholder art (optional for mechanics)

**Files:**
- Modify: `tools/prepare-weapon-art.py` (and/or `tools/prepare-equipment-art.py`) to emit gold/diamond placeholders, or document the reuse.
- Modify: `docs/art-direction.md` (record the placeholder reuse and the real-art TODO).

**Interfaces:** none (assets + docs only).

- [ ] **Step 1: Decide placeholder source**

Since `huntClip` already reuses the iron swing art and the iron arrow for gold/diamond, no new sheet is strictly required to play. For HUD chips, point the gold/diamond weapon chips at the iron chip picture (or a tinted copy) so the Build menu shows something sensible.

- [ ] **Step 2: Record the art dependency**

In `docs/art-direction.md`, add an entry: gold and diamond sword/bow swing sheets and arrow effects are TODO; the game currently reuses iron art for both. List the expected files (`<id>-sword.png` gold/diamond variants, `arrow-gold.png`, `arrow-diamond.png`) and their prompts to be generated later.

- [ ] **Step 3: Commit**

```bash
git add docs/art-direction.md tools/prepare-weapon-art.py
git commit -m "Note gold and diamond weapon art placeholders"
```

---

## Final verification

- [ ] `npm test` — all pass (combat, animals, ladder, saves, boundaries, comments, flood fill).
- [ ] `npm run build` — succeeds.
- [ ] `npm run format:check` — clean.
- [ ] Browser playthrough on the `wildhaven` config at `127.0.0.1` with each character: draw/sheathe, sword swing fells a deer in the expected hits per tier, snap vs charged bow damage differs, lock-on follows a runner, arrows deplete and the out-of-arrows notice shows, `E` fallback still hunts, wolves can be fought and felled across multiple hits, and no console errors. Confirm the HUD at ~390 px.
- [ ] Update `docs/verification.md` with the combat checks.

## Self-review notes

- **Spec coverage:** stance (B2/B3/B5), lock-on bow with tap-snap/hold-charge (B1/B3/B4), four-tier weapons (A1/A2/A5), creature HP (A2/A3/A4), `E` fallback as one hit (A4), no save break (A5), placeholder art (B6) — all mapped.
- **Type consistency:** the hunt target format `hunt:<id>[:<weapon>:<tenths>]` is produced by `beginSwing`/`beginShot` (B1) and consumed by `finishHunt` (A4), `loop.js` (A4), and `renderer.js` (B4) — all split on `:` and take `[0]` for the id. `applyHit` returns `{ dead, reward?, blocked? }` used by `finishHunt`. `weaponDamage(state, tool, chargeFrac)` and `creatureMaxHp(creature)` signatures match across combat.js, animals.js, and the resets.
- **Charge encoding:** charge is a 0..1 fraction everywhere except the target string, where it is tenths (0..10); `finishHunt` divides by 10. A quick tap is `0`, a full hold is `10`.
- **Ordering caveat:** A4 imports `creatureMaxHp` from combat.js but only uses it in the resets (A3) — it is already used by the time B runs; if a strict unused-symbol check ever applies, move that import to where it is first used.
