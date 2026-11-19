# Tools and Crafting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tree and rock in the world can be chopped or mined with the right tool, and the player crafts a stone or iron axe, pickaxe and hammer from wood, stone and iron in the Build menu.

**Architecture:** The game rules stay in pure modules: tool data (`src/data/tools.js`), tool ownership and wear (`src/world/tools.js`), and the craft action (`src/actions/craft.js`). The map's trees and rocks become nodes the way wildflower patches already are, but they stay in the renderer's chunk-culled scenery, and their collision boxes in `src/world/map.js` carry ids so a chopped one can be skipped. The browser layer (layout, HUD, build menu, input, loop, renderer) only drives those rules.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 7, Phaser 4 (renderer only), HTML/CSS UI, `node:test`, Prettier 3.

**Spec:** `docs/superpowers/specs/2026-11-19-tools-crafting-design.md`

## Global Constraints

- Work in the worktree `D:\Code\GameDev\game 1\.claude\worktrees\tools-crafting` on branch `tools-crafting` (started from `worktree-archipelago-a1` at `fd2600e`). Never edit the `archipelago-a1` worktree: another session works there.
- `CLAUDE.md` "Code Style" is a rule: Prettier formats everything (`npm run format`, then `npm run format:check` must pass); every named function has a `/** ... */` comment directly above it in plain beginner words, with `@param`/`@returns`; each file opens with a 2–4 line `//` header; each `test(...)` has a `//` line above it saying what it guards against.
- Pure modules (`src/data/`, `src/world/`, `src/actions/`, `src/game/`, `src/animation/clips.js`) must not import `ui/`, `core/`, `render/`, PNG or CSS, and their comments must not contain the words `document`, `window` or `import.meta` (`tests/boundaries.test.js` scans comments too).
- Balance numbers live in `src/data/balance.js`. Exact values: stone axe 3 wood + 2 stone, stone pickaxe 3 wood + 3 stone, stone hammer 2 wood + 3 stone; iron axe 2 wood + 1 stone + 3 iron, iron pickaxe 2 wood + 1 stone + 4 iron, iron hammer 2 wood + 1 stone + 3 iron; stone uses axe 25, pickaxe 25, hammer 10; `TOOL_SECONDS` stone 5, iron 3; `TOOL_WEAR_WARNING` 3; `CRAFT_SECONDS` 3; `HARVEST_REGROW` 1080.
- `GATHER_SECONDS` stays 6 for bare-hand gathers. Do not shorten it.
- `SAVE_VERSION` becomes 6. Version 5 saves are upgraded (iron 0, kit tools), never reset.
- Browser checks use the `wildhaven` launch config at `127.0.0.1`, never `localhost`.
- Commit after each task with a message ending in:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `src/data/tools.js` | new | The three tools (id, name, Build menu line, key, icon) and the two tiers |
| `src/world/tools.js` | new | Which tools the player owns, starting kits, wearing a stone tool out |
| `src/actions/craft.js` | new | `nextTier`, `canCraft`, `beginCraft`, `finishCraft`, `toolName` |
| `src/data/balance.js` | modify | Tool recipes, uses, tool gather times, craft time, harvest regrowth |
| `src/data/characters.js` | modify | `tools` in each character's kit |
| `src/data/supplies.js` | modify | `iron` resource, `HARVEST` table, `tool: 'axe'` on the Pinefall pine |
| `src/world/nodes.js` | modify | Tree and rock nodes (`inScenery`), `nodesNear`, `isSceneryNode` |
| `src/world/map.js` | modify | Obstacle boxes carry ids; `hitsObstacle`/`isWalkable` can skip some; `obstaclesAt` |
| `src/world/needs.js` | modify | Camp needs keep asking for the four everyday resources only |
| `src/actions/gather.js` | modify | Tool rule, `lockedNode`, tool gather times |
| `src/actions/interact.js` | modify | Wear after a gather; finish `craft:<tool>` actions |
| `src/actions/move.js` | modify | Walk through chopped scenery; walk out of regrown scenery |
| `src/actions/build.js` | modify | Node clearance ignores trees and rocks |
| `src/game/state.js` | modify | Save version 6: `tools`, `iron`, dropping run-out timers, loading on a chopped tree's spot |
| `src/ui/layout.js`, `src/style.css` | modify | Iron slot, tools row, Tools group in the Build menu, icons |
| `src/ui/hud.js` | modify | Locked prompt, craft busy label, Build menu entries, tools row, `describeFinish` |
| `src/core/build.js`, `src/core/input.js`, `src/core/loop.js` | modify | `craft(tool)`, keys 2–4, locked toast, finish toasts |
| `src/render/renderer.js` | modify | Fade gone trees and rocks in their chunks; glow and E cap on them |
| `tests/world/tools.test.js`, `tests/actions/craft.test.js`, `tests/data/ladder.test.js` | new | Tool, craft and ladder rules |
| `tests/game/state.test.js`, `tests/world/nodes.test.js`, `tests/actions/gather.test.js`, `tests/actions/interact.test.js`, `tests/actions/move.test.js`, `tests/actions/build.test.js` | modify | Updated and new cases |
| `CLAUDE.md`, `docs/gdd.md`, `docs/verification.md` | modify | Docs |

---

### Task 0: Worktree setup

- [ ] **Step 1: Install dependencies in the worktree**

The worktree has no `node_modules` of its own.

Run (from the worktree): `npm install`
Expected: finishes without errors.

- [ ] **Step 2: Confirm the starting point is green**

Run: `npm test`
Expected: all tests pass. If any fail, stop and report: the archipelago branch itself is broken, and this plan must not paper over it.

---

### Task 1: Tool data, numbers and starting kits

**Files:**
- Create: `src/data/tools.js`
- Create: `src/world/tools.js`
- Modify: `src/data/balance.js` (after the "Regrowth and fog" section, at the end of the file)
- Modify: `src/data/characters.js`
- Test: `tests/world/tools.test.js`

**Interfaces:**
- Produces: `TOOLS` (array of `{id, name, aName, use, key, icon}`), `TOOL_IDS` (`['axe','pickaxe','hammer']`), `TIERS` (`['stone','iron']`), `toolInfo(id)`; `TOOL_RECIPES[tool][tier]` (cost object), `TOOL_USES[tool]`, `TOOL_SECONDS[tier]`, `TOOL_WEAR_WARNING`, `CRAFT_SECONDS`, `HARVEST_REGROW`; `toolTier(state, tool)` → `'stone'|'iron'|null`, `hasTool(state, tool)` → boolean, `newStoneTool(tool)` → `{tier:'stone', uses}`, `startingTools(characterId)` → tools object, `wearTool(state, tool)` → `'warn'|'broke'|null`. A tool in `state.tools` is `{tier: 'stone', uses: n}` or `{tier: 'iron'}`; a missing key means not owned.

- [ ] **Step 1: Write the failing test**

Create `tests/world/tools.test.js`:

```js
// Checks owning and wearing out tools. A slip here could let a stone tool last forever, break an
// iron one, or start a character without the kit their selection card promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_USES, TOOL_WEAR_WARNING, TOOL_RECIPES } from '../../src/data/balance.js';
import { TOOLS, TOOL_IDS, TIERS, toolInfo } from '../../src/data/tools.js';
import { toolTier, hasTool, startingTools, wearTool } from '../../src/world/tools.js';

// Guards the kits on the character cards: the Scout's hatchet and the Builder's hammer are real stone tools.
test('characters start with the stone tools their kit names', () => {
  assert.deepEqual(startingTools('scout'), { axe: { tier: 'stone', uses: TOOL_USES.axe } });
  assert.deepEqual(startingTools('builder'), {
    hammer: { tier: 'stone', uses: TOOL_USES.hammer },
  });
  assert.deepEqual(startingTools('survivor'), {});
  assert.deepEqual(startingTools('nobody'), {});
});

// Guards the tool table: a tool with no recipe for a tier, no use count, or a clashing key would
// break the Build menu or crafting.
test('every tool has a recipe for each tier, a stone use count and its own key', () => {
  assert.deepEqual(TOOL_IDS, ['axe', 'pickaxe', 'hammer']);
  for (const id of TOOL_IDS) {
    for (const tier of TIERS) assert.ok(TOOL_RECIPES[id][tier], `${id} ${tier}`);
    assert.ok(Number.isInteger(TOOL_USES[id]) && TOOL_USES[id] > TOOL_WEAR_WARNING, id);
    assert.equal(toolInfo(id).id, id);
  }
  assert.equal(new Set(TOOLS.map((t) => t.key)).size, TOOLS.length);
  assert.equal(toolInfo('axe').aName, 'an axe');
});

// Guards wear: one use per call, a warning at exactly three left, removal at zero, and iron never wearing.
test('a stone tool warns once, then breaks; an iron tool never wears', () => {
  const state = {
    tools: { axe: { tier: 'stone', uses: TOOL_WEAR_WARNING + 1 }, pickaxe: { tier: 'iron' } },
  };
  assert.equal(wearTool(state, 'axe'), 'warn');
  assert.equal(state.tools.axe.uses, TOOL_WEAR_WARNING);
  for (let left = TOOL_WEAR_WARNING - 1; left > 0; left--)
    assert.equal(wearTool(state, 'axe'), null);
  assert.equal(wearTool(state, 'axe'), 'broke');
  assert.equal(hasTool(state, 'axe'), false);
  assert.equal(toolTier(state, 'axe'), null);

  assert.equal(wearTool(state, 'pickaxe'), null);
  assert.deepEqual(state.tools.pickaxe, { tier: 'iron' });
  assert.equal(toolTier(state, 'pickaxe'), 'iron');
  assert.equal(wearTool(state, 'hammer'), null); // not owned: nothing happens
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tests/world/tools.test.js`
Expected: FAIL with `Cannot find module` for `src/data/tools.js`.

- [ ] **Step 3: Add the tool numbers to `src/data/balance.js`**

Append at the end of the file:

```js

// ---- Tools and crafting ----

/**
 * What each tool costs to craft, per tier. Stone tools are made anywhere; iron tools also need a
 * hammer and one of the player's campfires (the fire is the forge).
 */
export const TOOL_RECIPES = {
  axe: { stone: { wood: 3, stone: 2 }, iron: { wood: 2, stone: 1, iron: 3 } },
  pickaxe: { stone: { wood: 3, stone: 3 }, iron: { wood: 2, stone: 1, iron: 4 } },
  hammer: { stone: { wood: 2, stone: 3 }, iron: { wood: 2, stone: 1, iron: 3 } },
};

/** How many uses a new stone tool has. Iron tools never wear out. */
export const TOOL_USES = { axe: 25, pickaxe: 25, hammer: 10 };

// Seconds a gather that needs a tool takes with a stone or an iron one. Bare-hand gathers keep
// GATHER_SECONDS; this is how tools shorten gathering, as GATHER_SECONDS always promised.
export const TOOL_SECONDS = { stone: 5, iron: 3 };

/** Uses left when the game warns that a stone tool is wearing out. */
export const TOOL_WEAR_WARNING = 3;

/** Seconds one craft takes. Moving cancels it, and nothing is spent. */
export const CRAFT_SECONDS = 3;

/** Game seconds before a chopped tree or mined rock grows back: three in-game days. */
export const HARVEST_REGROW = 1080;
```

Also reword the comment above `GATHER_SECONDS` (keep the "design decision" fact):

```js
// How many seconds a bare-hand gather takes. Tools shorten the gathers that need them (see
// TOOL_SECONDS); bare-hand gathers always take the full time. This is a design decision, so don't
// shorten it as a "fix".
export const GATHER_SECONDS = 6;
```

- [ ] **Step 4: Create `src/data/tools.js`**

```js
// The three tools the player can craft (axe, pickaxe, hammer) and their two tiers (stone, iron).
// What a tool costs and how long it lasts are game balance, so those numbers live in balance.js.

/** The tiers a tool can be, weakest first. Stone tools wear out; iron tools last forever. */
export const TIERS = ['stone', 'iron'];

/**
 * Every tool, in Build menu order.
 *
 * Fields: `id` is the save key; `name` is the word used in messages ("stone axe"); `aName` is the
 * name with "a" or "an" in front, for "You need an axe"; `use` is the Build menu's short line
 * about what it is for; `key` is the number key that picks it while the Build menu is open;
 * `icon` names its picture in ui/layout.js.
 */
export const TOOLS = [
  {
    id: 'axe',
    name: 'axe',
    aName: 'an axe',
    use: 'Chops every tree for wood',
    key: '2',
    icon: 'axe',
  },
  {
    id: 'pickaxe',
    name: 'pickaxe',
    aName: 'a pickaxe',
    use: 'Mines rocks for stone and iron',
    key: '3',
    icon: 'pickaxe',
  },
  {
    id: 'hammer',
    name: 'hammer',
    aName: 'a hammer',
    use: 'Needed to forge iron tools',
    key: '4',
    icon: 'hammer',
  },
];

/** The tool ids alone, such as 'axe'. Saves may only hold these. */
export const TOOL_IDS = TOOLS.map((t) => t.id);

/**
 * Finds a tool's entry in TOOLS.
 *
 * @param {string} id - The tool's id, such as 'axe'.
 * @returns {object|undefined} Its entry, or undefined for an unknown id.
 */
export const toolInfo = (id) => TOOLS.find((t) => t.id === id);
```

- [ ] **Step 5: Give characters their kit tools in `src/data/characters.js`**

Add `tools` to the field list in the `CHARACTERS` doc comment, after `resources`:

```js
 * begins; `resources` is what is in the backpack at the start; `tools` lists the stone tools in
 * the kit (the Scout's hatchet is a stone axe, the Builder's hammer a stone hammer).
```

Then add a `tools` line after each character's `resources` line:

```js
    resources: { wood: 0, stone: 0, food: 3 },
    tools: ['axe'],
```

```js
    resources: { wood: 5, stone: 2, food: 2 },
    tools: ['hammer'],
```

```js
    resources: { wood: 2, stone: 0, food: 4 },
    tools: [],
```

- [ ] **Step 6: Create `src/world/tools.js`**

```js
// Which tools the player owns, and how they wear out. A tool sits in `state.tools` as
// `{tier: 'stone', uses}` (it wears out) or `{tier: 'iron'}` (it lasts forever); a missing key
// means the player doesn't own that tool. Owning a tool is enough to use it.

import { TOOL_USES, TOOL_WEAR_WARNING } from '../data/balance.js';
import { CHARACTERS } from '../data/characters.js';

/**
 * Says which tier of a tool the player owns.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id, such as 'axe'.
 * @returns {string|null} 'stone' or 'iron', or null when they don't own it.
 */
export const toolTier = (state, tool) => state.tools[tool]?.tier ?? null;

/**
 * Says whether the player owns a tool at any tier.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id.
 * @returns {boolean} True if they own it.
 */
export const hasTool = (state, tool) => !!state.tools[tool];

/**
 * Makes a brand-new stone tool with every use left.
 *
 * @param {string} tool - The tool's id.
 * @returns {{tier: string, uses: number}} The tool, ready to put in `state.tools`.
 */
export const newStoneTool = (tool) => ({ tier: 'stone', uses: TOOL_USES[tool] });

/**
 * Gives the tools a character starts with: one new stone tool per tool in their kit.
 *
 * @param {string} characterId - The character's id, such as 'scout'.
 * @returns {object} A fresh tools object; empty for a character with no kit tools (or an unknown id).
 */
export function startingTools(characterId) {
  const kit = CHARACTERS.find((c) => c.id === characterId)?.tools ?? [];
  return Object.fromEntries(kit.map((tool) => [tool, newStoneTool(tool)]));
}

/**
 * Uses up one use of a stone tool, like a pencil getting shorter each time it is sharpened.
 *
 * Iron tools and tools the player doesn't own are left alone. A stone tool that runs out is
 * removed from the backpack.
 *
 * @param {object} state - The game being played. The tool's uses go down, or it is removed.
 * @param {string} tool - The tool's id.
 * @returns {string|null} 'warn' when exactly TOOL_WEAR_WARNING uses are left, 'broke' when it just
 *   ran out, otherwise null.
 */
export function wearTool(state, tool) {
  const owned = state.tools[tool];
  if (owned?.tier !== 'stone') return null;

  owned.uses -= 1;
  if (owned.uses <= 0) {
    delete state.tools[tool];
    return 'broke';
  }
  return owned.uses === TOOL_WEAR_WARNING ? 'warn' : null;
}
```

- [ ] **Step 7: Run the test to make sure it passes**

Run: `node --test tests/world/tools.test.js`
Expected: PASS (3 tests).

- [ ] **Step 8: Run the full suite and format**

Run: `npm run format && npm test`
Expected: all pass (the comment and boundary tests included).

- [ ] **Step 9: Commit**

```bash
git add src/data/tools.js src/world/tools.js src/data/balance.js src/data/characters.js tests/world/tools.test.js
git commit -m "Add tool data, recipes and starting kit tools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Iron and save version 6

**Files:**
- Modify: `src/data/supplies.js` (`RESOURCES`)
- Modify: `src/world/needs.js:5-6,68-69`
- Modify: `src/ui/layout.js` (icons table; item box)
- Modify: `src/style.css` (one comment)
- Modify: `src/game/state.js`
- Test: `tests/game/state.test.js`

**Interfaces:**
- Consumes: `TOOL_IDS` (Task 1), `TOOL_USES` (Task 1), `startingTools(characterId)` (Task 1).
- Produces: `state.tools` on every game; `state.resources.iron`; `SAVE_VERSION === 6`; `RESOURCES` = `['wood','stone','food','herbs','iron']`; an `#iron` element in the item box.

- [ ] **Step 1: Write the failing tests**

In `tests/game/state.test.js`:

1. Add to the imports: `TOOL_USES` from `'../../src/data/balance.js'` (extend the existing balance import), and a new line:

```js
import { startingTools } from '../../src/world/tools.js';
```

2. In the test `'a new game starts on the morning of day 1 ...'`, change `assert.equal(SAVE_VERSION, 5);` to `assert.equal(SAVE_VERSION, 6);`.

3. In the test `'invalid, outdated, mismatched and impossible save data is rejected'`, add these lines to the list of edits:

```js
    (g) => (g.tools = undefined),
    (g) => (g.tools = []),
    (g) => (g.tools = { saw: { tier: 'stone', uses: 1 } }),
    (g) => (g.tools = { axe: { tier: 'gold' } }),
    (g) => (g.tools = { axe: { tier: 'stone', uses: 0 } }),
    (g) => (g.tools = { axe: { tier: 'stone', uses: 1.5 } }),
    (g) => (g.tools = { hammer: { tier: 'stone', uses: TOOL_USES.hammer + 1 } }),
    (g) => (g.resources.iron = -1),
```

4. Add a helper after the existing `v4Save` helper:

```js
/**
 * Writes a version 5 save the way the archipelago update did: today's shape, but no iron in the
 * backpack and no tools.
 *
 * @param {string} characterId - Whose save it is.
 * @param {object} [changes={}] - Fields to set on top.
 * @returns {string} The save as JSON text.
 */
function v5Save(characterId, changes = {}) {
  const { tools, ...game } = createGame(characterId);
  const { iron, ...resources } = game.resources;
  return JSON.stringify({ ...game, version: 5, resources, ...changes });
}
```

5. Add these tests at the end of the file:

```js
// Guards the starting kit: a new game holds the character's stone tools and an empty iron slot.
test('a new game starts with the kit tools and no iron', () => {
  assert.deepEqual(createGame('scout').tools, { axe: { tier: 'stone', uses: TOOL_USES.axe } });
  assert.deepEqual(createGame('builder').tools, {
    hammer: { tier: 'stone', uses: TOOL_USES.hammer },
  });
  assert.deepEqual(createGame('survivor').tools, {});
  assert.equal(createGame('scout').resources.iron, 0);
});

// Guards tools through a save: both tiers come back as they were, as fresh objects.
test('tools survive a save and load as fresh copies', () => {
  const game = createGame('scout');
  game.tools.pickaxe = { tier: 'iron' };
  game.tools.axe.uses = 7;
  const restored = restoreGame(serializeGame(game));
  assert.deepEqual(restored.tools, game.tools);
  restored.tools.axe.uses = 1;
  assert.equal(game.tools.axe.uses, 7);
});

// Guards archipelago saves: a version 5 adventure keeps its progress and gains an empty iron
// slot and the kit tools the character's card always promised.
test('a version 5 save gains iron and the character kit tools', () => {
  for (const id of ['scout', 'builder', 'survivor']) {
    const game = restoreGame(v5Save(id, { distance: 1234 }));
    assert.equal(game.version, SAVE_VERSION, id);
    assert.equal(game.distance, 1234, id);
    assert.equal(game.resources.iron, 0, id);
    assert.deepEqual(game.tools, startingTools(id), id);
  }
});

// Guards save size: timers that already ran out are dropped, since those nodes are back anyway.
test('regrowth timers that have run out are dropped on load', () => {
  const game = createGame('scout'),
    [a, b] = flowers;
  game.time = 500;
  game.regrowAt = { [a.id]: 400, [b.id]: 600 };
  assert.deepEqual(restoreGame(serializeGame(game)).regrowAt, { [b.id]: 600 });
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `node --test tests/game/state.test.js`
Expected: FAIL (`SAVE_VERSION` is 5; `tools` is undefined).

- [ ] **Step 3: Add iron to `RESOURCES` in `src/data/supplies.js`**

```js
/**
 * Every kind of resource the backpack can hold. Saves must have a whole number for each one.
 * Iron is only mined from iron-streaked rocks, with a pickaxe.
 */
export const RESOURCES = ['wood', 'stone', 'food', 'herbs', 'iron'];
```

- [ ] **Step 4: Keep camp needs on the four everyday resources in `src/world/needs.js`**

Adding iron to `RESOURCES` would change which resource every existing camp need asks for (the pick is `hash % RESOURCES.length`) and could ask for iron, which has no amount. Replace the `RESOURCES` import (line 6) with nothing, and add after the imports:

```js
// The resources a "bring" need can ask for: the ones NEED_AMOUNTS has an amount for, in the same
// order as before iron existed, so existing camps keep the same needs. Camps never ask for iron.
const NEED_RESOURCES = Object.keys(NEED_AMOUNTS);
```

and in `makeNeed` change the pick to:

```js
  const resource = NEED_RESOURCES[hash(`${camp.id}-${day}-${slot}`) % NEED_RESOURCES.length];
```

- [ ] **Step 5: Add the iron slot to the item box in `src/ui/layout.js`**

The HUD fills one `<b id="<resource>">` per entry of `RESOURCES`, so the iron slot must exist now or the HUD breaks.

Add to the `icons` table (after `herbs`):

```js
  iron: '<path d="M3 18 6 10h12l3 8Z"/><path d="M6 10 8 6h8l2 4M9 14h6"/>',
```

In the item box, add the iron slot between the stone slot and the food button, keeping the `</span\n>` line-break style:

```js
            ><span class="slot" title="Stone"
              >${icon('stone')}<b id="stone">0</b><span class="slot-label">Stone</span></span
            ><span class="slot" title="Iron"
              >${icon('iron')}<b id="iron">0</b><span class="slot-label">Iron</span></span
            ><button id="slot-food" class="slot" title="Eat one food (F)">
```

In `src/style.css`, update the comment above `.slot` from "wood and */ /* stone are plain" to say "wood, stone and */ /* iron are plain".

- [ ] **Step 6: Save version 6 in `src/game/state.js`**

1. Imports: add `TOOL_USES` to the balance import, and:

```js
import { TOOL_IDS } from '../data/tools.js';
import { startingTools } from '../world/tools.js';
```

2. Replace the `SAVE_VERSION` block:

```js
/**
 * The save format this code writes. Version 6 is the archipelago's version 5 plus iron and tools.
 * Version 3, 4 and 5 saves are upgraded when loaded (see `upgrade`).
 */
export const SAVE_VERSION = 6;
```

3. In `createGame`, add `tools` after `resources`, and add to its doc comment: "`tools` holds the tools owned (see world/tools.js)".

```js
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    tools: startingTools(character.id),
```

4. In `upgradeV3` and `addSeaBorder`, change `version: SAVE_VERSION,` to `version: 5,` (they produce the version 5 shape; `upgrade` then adds tools). Their doc comments already say "up to version 5".

5. Add after `addSeaBorder`:

```js
/**
 * Brings a version 5 save (the archipelago, before tools) up to version 6.
 *
 * Version 5 had no iron and no tools. The backpack gets an empty iron slot, and the character
 * gets the kit their selection card always promised (the Scout's hatchet, the Builder's hammer),
 * as if they had carried it all along. Anything odd is left alone, for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 5 save.
 * @returns {object} The same adventure in the version 6 shape.
 */
function addTools(s) {
  return {
    ...s,
    version: SAVE_VERSION,
    resources: isPlainObject(s.resources) ? { ...s.resources, iron: 0 } : s.resources,
    tools: startingTools(s.character),
  };
}
```

6. Replace `upgrade`:

```js
/**
 * Picks the upgrades an older save needs, if any, and runs them in order.
 *
 * Like climbing stairs one step at a time: a version 3 or 4 save is first brought to version 5,
 * and every version 5 save then gains its tools.
 *
 * @param {*} parsed - The parsed save.
 * @returns {*} The save in the version 6 shape (still to be checked), or the save unchanged.
 */
function upgrade(parsed) {
  let s = parsed;
  if (s?.version === 3) s = upgradeV3(s);
  else if (s?.version === 4) s = addSeaBorder(s);
  return s?.version === 5 ? addTools(s) : s;
}
```

7. Add the tool checks after `isPlainObject`:

```js
/**
 * Checks the saved tools: only known tools, each either iron or stone with a sensible number of
 * uses left.
 *
 * @param {*} tools - The `tools` read from a save.
 * @returns {boolean} True if the game can use them.
 */
const isTools = (tools) =>
  isPlainObject(tools) &&
  Object.entries(tools).every(
    ([id, t]) =>
      TOOL_IDS.includes(id) &&
      isPlainObject(t) &&
      (t.tier === 'iron' ||
        (t.tier === 'stone' &&
          Number.isSafeInteger(t.uses) &&
          t.uses >= 1 &&
          t.uses <= TOOL_USES[id])),
  );

/**
 * Copies checked tools field by field: iron ones as `{tier}`, stone ones with their uses left.
 *
 * @param {object} tools - Tools that passed `isTools`.
 * @returns {object} A fresh tools object.
 */
const copyTools = (tools) =>
  Object.fromEntries(
    Object.entries(tools).map(([id, t]) => [
      id,
      t.tier === 'iron' ? { tier: 'iron' } : { tier: 'stone', uses: t.uses },
    ]),
  );
```

8. In `restoreGame`, right after the resources check, add:

```js
    // Tools: only known tools, each iron or a stone one with uses left.
    if (!isTools(s.tools)) return null;
```

9. Replace the timers block:

```js
    // Node ids are map positions, so a rebuilt map can retire one; dropping its timer only lets it regrow early.
    // A timer that has already run out is dropped too (that node is back), so a save that chopped
    // hundreds of trees stays small. Each kept timer is capped at one regrow ahead, so a node can't stay gone forever.
    const timers = NODES.filter(
      (n) => n.regrow && Object.hasOwn(regrowAt, n.id) && regrowAt[n.id] > s.time,
    ).map((n) => [n.id, Math.min(regrowAt[n.id], s.time + n.regrow)]);
```

10. In the returned object, add after `resources`:

```js
      tools: copyTools(s.tools),
```

11. Add to the `restoreGame` doc comment: "Version 3, 4 and 5 saves are first upgraded (see `upgrade`)." in place of the sentence about versions 3 and 4.

- [ ] **Step 7: Run the tests to make sure they pass**

Run: `node --test tests/game/state.test.js tests/world/needs.test.js`
Expected: PASS. The existing version 3 and 4 upgrade tests still pass (their timers are in the future, and their saves now go on to version 6).

- [ ] **Step 8: Run the full suite and format**

Run: `npm run format && npm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/data/supplies.js src/world/needs.js src/ui/layout.js src/style.css src/game/state.js tests/game/state.test.js
git commit -m "Save version 6: iron in the backpack and tools in saves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Every tree and rock in the map is a node

**Files:**
- Modify: `src/data/supplies.js` (imports; `HARVEST` after `WILD`)
- Modify: `src/world/nodes.js`
- Modify: `src/render/renderer.js` (one filter, so the renderer doesn't draw ~2,600 extra sprites before Task 8)
- Modify: `src/ui/hud.js` (`DOING` gains `Mine`)
- Test: `tests/world/nodes.test.js`

**Interfaces:**
- Consumes: `HARVEST_REGROW` (Task 1).
- Produces: `HARVEST` (sprite name → `{type, amount, label, verb, clip, tool, regrow}`); every `NODES` entry from the map has `inScenery` (true for trees and rocks); `nodesNear(x, y)` → nodes in the 3×3 squares of 256 units around a spot; `isSceneryNode(id)` → boolean. Node ids for trees and rocks are `<sprite>-<x>-<y>`, the same text the map's obstacle boxes will use in Task 4.

- [ ] **Step 1: Write the failing tests**

In `tests/world/nodes.test.js`:

1. Extend imports: `HARVEST` from supplies, `HARVEST_REGROW` from balance, `nodesNear` from nodes.

2. Replace the `supplies`/`wild` definitions so wild patches don't include trees and rocks:

```js
/**
 * The hand-placed supplies (they grow back after two days), the wild patches: flowers and
 * driftwood (they grow back sooner), and the map's trees and rocks (they need a tool).
 */
const supplies = NODES.filter((n) => SUPPLIES.includes(n)),
  wild = NODES.filter((n) => !SUPPLIES.includes(n) && !n.inScenery),
  harvest = NODES.filter((n) => n.inScenery);
```

3. In the test `'every supply and wild patch can be walked to and gathered from each spawn'`, loop over supplies and wild patches only (checking ~2,600 trees against the flood fill would take minutes, and a tree deep in a thicket is scenery, not a promise):

```js
  for (const node of [...supplies, ...wild]) {
```

4. Add at the end:

```js
// Guards the tree and rock nodes: every HARVEST sprite is in the map with a solid base, each node
// needs the right tool and swings an action clip, trees give wood, and there is iron to mine.
test('every tree and rock in the map is a node that needs a tool', () => {
  assert.ok(harvest.length > 2000);
  for (const name of Object.keys(HARVEST)) {
    assert.ok(OBJECT_SPECS[name]?.footprint, name);
    assert.ok(
      harvest.some((n) => n.sprite === name),
      name,
    );
  }
  for (const node of harvest) {
    assert.ok(['axe', 'pickaxe'].includes(node.tool), node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.equal(node.regrow, HARVEST_REGROW, node.id);
    assert.equal(node.type === 'wood', node.tool === 'axe', node.id);
    assert.equal(node.id, `${node.sprite}-${node.x}-${node.y}`);
  }
  assert.ok(harvest.filter((n) => n.type === 'iron').length >= 100);
});

// Guards the quick lookup: it finds every node close to a spot, the same as checking them all.
test('nodesNear finds every node close to a spot', () => {
  for (const node of NODES.filter((_, i) => i % 97 === 0)) {
    const x = node.x + 60,
      y = node.y - 40;
    /** The ids of the nodes in a list that are within 200 units of the spot, sorted. */
    const close = (list) =>
      list
        .filter((n) => Math.hypot(n.x - x, n.y - y) < 200)
        .map((n) => n.id)
        .sort();
    assert.deepEqual(close(nodesNear(x, y)), close(NODES), node.id);
  }
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test tests/world/nodes.test.js`
Expected: FAIL (`HARVEST` is not exported; `nodesNear` is not a function).

- [ ] **Step 3: Add `HARVEST` to `src/data/supplies.js`**

Add `HARVEST_REGROW` to the balance import. After `WILD`, add:

```js
/**
 * Makes the HARVEST entry for a tree: chopped with an axe for some wood.
 *
 * @param {string} label - The tree's name on the interact button, such as 'Pine tree'.
 * @param {number} amount - How much wood one chop gives.
 * @returns {object} The entry, with the same fields as SUPPLIES plus `tool`.
 */
const tree = (label, amount) => ({
  type: 'wood',
  amount,
  label,
  verb: 'Chop',
  clip: 'build',
  tool: 'axe',
  regrow: HARVEST_REGROW,
});

/**
 * Makes the HARVEST entry for a rock: mined with a pickaxe for stone or iron.
 *
 * @param {string} label - The rock's name on the interact button, such as 'Boulder'.
 * @param {string} type - What it gives: 'stone' or 'iron'.
 * @param {number} amount - How much one mining gives.
 * @returns {object} The entry, with the same fields as SUPPLIES plus `tool`.
 */
const rock = (label, type, amount) => ({
  type,
  amount,
  label,
  verb: 'Mine',
  clip: 'build',
  tool: 'pickaxe',
  regrow: HARVEST_REGROW,
});

// Map scenery that needs a tool: every tree is chopped with an axe and every rock is mined with a
// pickaxe. world/nodes.js turns each one the map placed into a node (id `<sprite>-<x>-<y>`). Unlike
// WILD patches they stay drawn with the map's scenery, and they keep their solid base while standing.
// Iron comes from the streaked cliff rocks of Stonewater Canyons and the ice rocks of Frostpeak.
// The `build` clip (an overhead swing) stands in for chopping and mining until those animations exist.
export const HARVEST = {
  pine: tree('Pine tree', 2),
  'snowy-pine': tree('Snowy pine', 2),
  palm: tree('Palm tree', 2),
  oak: tree('Oak tree', 2),
  pines: tree('Pine cluster', 3),
  'big-oak': tree('Big oak', 3),
  'jungle-tree': tree('Jungle tree', 3),
  'rocks-a': rock('Rocks', 'stone', 2),
  'rocks-b': rock('Rocks', 'stone', 2),
  'beach-rock': rock('Beach rock', 'stone', 2),
  boulder: rock('Boulder', 'stone', 3),
  'cliff-rock': rock('Iron-streaked rock', 'iron', 1),
  'ice-rock': rock('Iron-streaked rock', 'iron', 1),
};
```

- [ ] **Step 4: Make the nodes in `src/world/nodes.js`**

Change the supplies import to `import { SUPPLIES, WILD, HARVEST } from '../data/supplies.js';`, update the file header's first line to mention trees and rocks, and replace `NODES`:

```js
// The fixed supplies plus every wild patch, tree and rock the map scattered; a map node's position
// is its id (`flowers-<x>-<y>`, `pine-<x>-<y>`). Map nodes copy their fields from WILD or HARVEST and
// their size from objects.json. Trees and rocks are marked `inScenery`: the renderer draws them with
// the map's scenery, and their solid base is the map's own (see world/map.js), not a supply base.
export const NODES = [
  ...SUPPLIES,
  ...MAP_OBJECTS.filter((o) => WILD[o.name] || HARVEST[o.name]).map((o) => ({
    id: `${o.name}-${o.x}-${o.y}`,
    x: o.x,
    y: o.y,
    ...(WILD[o.name] ?? HARVEST[o.name]),
    sprite: o.name,
    scale: OBJECT_SPECS[o.name].scale ?? 1,
    inScenery: !!HARVEST[o.name],
  })),
];

// Thousands of trees and rocks are nodes, so finding the ones near the player shouldn't check them
// all. Like the map's obstacle grid, the world is cut into squares and each square lists its nodes,
// like sorting letters into pigeonholes by street.
const NODE_CELL = 256;
const nodeCells = new Map();
for (const node of NODES) {
  const key = `${Math.floor(node.x / NODE_CELL)},${Math.floor(node.y / NODE_CELL)}`;
  if (!nodeCells.has(key)) nodeCells.set(key, []);
  nodeCells.get(key).push(node);
}

/**
 * Lists the nodes in the square around a spot and the eight squares touching it.
 *
 * Every node within one square's width (256 units) of the spot is in the list, which is far more
 * than the 95 units gathering reaches, so callers still check the real distance.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {object[]} The nodes near the spot, as a new list.
 */
export function nodesNear(x, y) {
  const cx = Math.floor(x / NODE_CELL),
    cy = Math.floor(y / NODE_CELL),
    near = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) near.push(...(nodeCells.get(`${cx + dx},${cy + dy}`) ?? []));
  return near;
}

// The ids of the tree and rock nodes, for isSceneryNode.
const sceneryIds = new Set(NODES.filter((n) => n.inScenery).map((n) => n.id));

/**
 * Says whether an id names a tree or rock node, which the map itself draws and makes solid.
 *
 * @param {string} id - A node or map object id, such as `pine-4096-2048`.
 * @returns {boolean} True for a tree or rock that a tool can harvest.
 */
export const isSceneryNode = (id) => sceneryIds.has(id);
```

- [ ] **Step 5: Keep the renderer and HUD working**

In `src/render/renderer.js`, where `supplies` is built, draw only nodes that aren't scenery (trees and rocks are already drawn by the scenery loop; Task 8 lights them up):

```js
        supplies = [
          ...NODES.filter((node) => !node.inScenery).map((node) => ({
```

In `src/ui/hud.js`, add `Mine: 'Mining'` to `DOING`:

```js
const DOING = {
  Chop: 'Chopping',
  Mine: 'Mining',
  Pick: 'Picking',
  'Pick up': 'Picking up',
  Gather: 'Gathering',
};
```

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `node --test tests/world/nodes.test.js`
Expected: PASS.

- [ ] **Step 7: Run the full suite and format**

Run: `npm run format && npm test`
Expected: all pass. (Trees can be gathered by hand until Task 5; that is expected for now.)

- [ ] **Step 8: Commit**

```bash
git add src/data/supplies.js src/world/nodes.js src/render/renderer.js src/ui/hud.js tests/world/nodes.test.js
git commit -m "Make every tree and rock in the map a gatherable node

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Chopped trees and mined rocks stop blocking

**Files:**
- Modify: `src/world/map.js` (`OBSTACLES`, `hitsObstacle`, new `obstaclesAt`, `isWalkable`)
- Modify: `src/actions/move.js`
- Modify: `src/game/state.js` (the on-foot player check)
- Modify: `src/actions/build.js` (node clearance)
- Test: `tests/actions/move.test.js`, `tests/actions/build.test.js`, `tests/game/state.test.js`

**Interfaces:**
- Consumes: `isSceneryNode(id)`, `n.inScenery` (Task 3).
- Produces: `OBSTACLES` entries are `[left, top, right, bottom, id]`; `hitsObstacle(x, y, skip?)`; `obstaclesAt(x, y)` → `string[]`; `isWalkable(x, y, extra = [], cliffs = true, skip = undefined)` where `skip(id)` returns true to ignore that map object.

- [ ] **Step 1: Write the failing tests**

Add to `tests/actions/move.test.js`:

```js
// Guards chopped scenery: a tree stops blocking while it is gone, and a tree that grows back
// around the player never traps them.
test('a chopped tree can be walked through until it grows back, and never traps the player', () => {
  const tree = NODES.find(
    (n) =>
      n.inScenery &&
      n.sprite === 'pine' &&
      !isWalkable(n.x, n.y - 5) &&
      [-60, -50, -40, -30, 30, 40, 50, 60].every((d) => isWalkable(n.x + d, n.y - 5)),
  );
  assert.ok(tree, 'a pine tree with open ground on both sides');
  const game = createGame('scout');

  /** Puts the player west of the tree and walks east for 0.7 s; returns where they end up. */
  const walkEast = () => {
    Object.assign(game.player, { x: tree.x - 60, y: tree.y - 5 });
    for (let i = 0; i < 7; i++) movePlayer(game, 1, 0, 0.1);
    return game.player.x;
  };
  assert.ok(walkEast() < tree.x); // a standing tree blocks the way

  game.regrowAt[tree.id] = game.time + 100;
  assert.ok(walkEast() > tree.x); // a chopped one doesn't

  game.time += 100; // it grows back around a player standing on its spot
  Object.assign(game.player, { x: tree.x, y: tree.y - 5 });
  assert.ok(movePlayer(game, 1, 0, 0.1));
});
```

Add to `tests/actions/build.test.js` (add `isWalkable` from `'../../src/world/map.js'` to the imports):

```js
// Guards regrowth: a fire can't go where a chopped tree will grow back, or the tree would come
// back inside the fire.
test('a campfire cannot be placed where a chopped tree will grow back', () => {
  const tree = NODES.find(
    (n) => n.inScenery && n.tool === 'axe' && isWalkable(n.x, n.y + 160),
  );
  const game = createGame('builder');
  Object.assign(game.resources, { wood: 9, stone: 9 });
  Object.assign(game.player, { x: tree.x, y: tree.y + 160 });
  game.regrowAt[tree.id] = game.time + 100;
  assert.equal(checkPlacement(game, tree.x, tree.y).reason, 'blocked');
});
```

Add to `tests/game/state.test.js`:

```js
// Guards loading a save made on a chopped tree's spot: it must load, not be thrown away.
test('a save made where a chopped tree stood still loads', () => {
  const tree = NODES.find(
    (n) =>
      n.inScenery && !isWalkable(n.x, n.y - 5) && isWalkable(n.x, n.y - 5, [], false, () => true),
  );
  const game = createGame('scout');
  Object.assign(game.player, { x: tree.x, y: tree.y - 5 });
  game.regrowAt[tree.id] = game.time + 100;
  assert.deepEqual(restoreGame(serializeGame(game))?.player, game.player);
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test tests/actions/move.test.js tests/game/state.test.js tests/actions/build.test.js`
Expected: FAIL (the chopped tree still blocks; the save on its spot is refused).

- [ ] **Step 3: Give obstacles ids and let walkability skip some, in `src/world/map.js`**

Replace `OBSTACLES`:

```js
// The solid base of every placed object, as [left, top, right, bottom, id] boxes. An object's
// `footprint` in objects.json is [halfWidth, depth], grown by its `scale`; objects without one are walk-through.
// The id is `<name>-<x>-<y>`, the same id a tree or rock node has, so a chopped tree's box can be skipped.
export const OBSTACLES = MAP_OBJECTS.flatMap((o) => {
  const spec = OBJECT_SPECS[o.name],
    base = spec?.footprint,
    s = spec?.scale ?? 1;
  return base
    ? [[o.x - base[0] * s, o.y - base[1] * s, o.x + base[0] * s, o.y, `${o.name}-${o.x}-${o.y}`]]
    : [];
});
```

(`blocks` reads only the first four numbers, so the id doesn't change it.)

Replace `hitsObstacle` and add `bucketAt` and `obstaclesAt` after the bucket-filling loop:

```js
/**
 * Finds the obstacle boxes filed in the grid square that holds a spot.
 * Spots just left of or above the world share the first column or row, as the objects there do.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {Array|undefined} The boxes, or undefined when that square has none.
 */
const bucketAt = (x, y) =>
  buckets.get(Math.max(0, Math.floor(y / GRID)) * gridCols + Math.max(0, Math.floor(x / GRID)));

/**
 * Says whether a spot is inside the solid base of any object the map placed.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @param {Function} [skip] - Given an object's id, returns true to ignore that object, such as a
 *   tree that has been chopped down. Without it, every object counts.
 * @returns {boolean} True if a tree, rock or building blocks the spot.
 */
export function hitsObstacle(x, y, skip) {
  const near = bucketAt(x, y);
  if (!near) return false;
  return blocks(skip ? near.filter((rect) => !skip(rect[4])) : near, x, y);
}

/**
 * Lists the map objects whose solid base covers a spot.
 *
 * Walking uses it to let a player out of a tree that grew back around them.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {string[]} The objects' ids (empty when the spot is clear).
 */
export function obstaclesAt(x, y) {
  return (bucketAt(x, y) ?? []).filter((rect) => blocks([rect], x, y)).map((rect) => rect[4]);
}
```

In `isWalkable`, add the parameter and pass it on. Add to its doc comment:

```js
 * @param {Function} [skip] - Given a map object's id, returns true to ignore its solid base (a
 *   chopped tree, say). Without it every map object counts.
```

and change the signature and obstacle check to:

```js
export function isWalkable(x, y, extra = [], cliffs = true, skip = undefined) {
```

```js
    !hitsObstacle(x, y, skip) &&
```

- [ ] **Step 4: Walk through chopped scenery in `src/actions/move.js`**

Add `obstaclesAt` to the map import. After `const cliffs = !hitsCliff(x, y);` add:

```js
  // A chopped tree or mined rock isn't solid until it grows back, and one that grew back around
  // the player (or that a save put them inside) lets them walk out, like the bases above.
  const inside = obstaclesAt(x, y);
  /** True for a map object to walk through: chopped and not grown back, or already around the player. */
  const skip = (id) => state.regrowAt[id] > state.time || inside.includes(id);
```

(`tests/comments.test.js` needs the `/** */` line directly above `skip`, like the one above `free`.)

and change `free` to pass it:

```js
  const free = (px, py) =>
    state.aboard ? isSailable(px, py) : isWalkable(px, py, bases, cliffs, skip);
```

Update the file header's list ("trees, buildings, ...") to say "standing trees".

- [ ] **Step 5: Load a player standing on a chopped tree's spot, in `src/game/state.js`**

Add `isSceneryNode` to the nodes import. In `restoreGame`, change the on-foot check to skip every tree and rock (chopped or not; `movePlayer` walks the player out of a standing one):

```js
    // On foot the player must stand somewhere walkable. Aboard, any real position will do here:
    // placeBoat brings them ashore if the map no longer has sea there. Cliffs are left out of the
    // on-foot check: a save made before a hill was built on the spot still loads, and movePlayer
    // lets the player walk off the cliff. Trees and rocks are left out too: the player may have
    // saved where one was chopped, and movePlayer lets them walk out of one that grew back.
    if (
      s.aboard
        ? !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y)
        : !isWalkable(s.player.x, s.player.y, [], false, isSceneryNode)
    )
      return null;
```

- [ ] **Step 6: Leave trees and rocks out of the node clearance in `src/actions/build.js`**

A fire's base is already kept off trees and rocks by their footprints (chopped or not, since `baseIsClear` passes no `skip`). The 80-unit clearance is for supplies and flower patches, which are walk-through; applied to trees it would rule out every forest clearing. Change the clearance line in `checkPlacement`:

```js
    NODES.some((n) => !n.inScenery && Math.hypot(n.x - x, n.y - y) < NODE_CLEARANCE) ||
```

and add above the `if (` a comment:

```js
  // Supplies and flower patches need room around a fire; trees and rocks only need to be off its
  // base, which baseIsClear checks (a chopped one still counts, since it will grow back).
```

- [ ] **Step 7: Run the tests to make sure they pass**

Run: `node --test tests/actions/move.test.js tests/game/state.test.js tests/actions/build.test.js tests/world/map.test.js tests/world/cliffs.test.js`
Expected: PASS.

- [ ] **Step 8: Run the full suite and format**

Run: `npm run format && npm test`
Expected: all pass, including the whole-world flood fill in `tests/world/places.test.js`.

- [ ] **Step 9: Commit**

```bash
git add src/world/map.js src/actions/move.js src/game/state.js src/actions/build.js tests/actions/move.test.js tests/actions/build.test.js tests/game/state.test.js
git commit -m "Let chopped trees and mined rocks be walked through until they regrow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gathering needs the right tool

**Files:**
- Modify: `src/actions/gather.js`
- Modify: `src/actions/interact.js` (`finishInteraction` wears the tool)
- Modify: `src/data/supplies.js` (`pine-wood` needs an axe)
- Test: `tests/actions/gather.test.js`, `tests/actions/interact.test.js`, `tests/world/nodes.test.js`

**Interfaces:**
- Consumes: `toolTier`, `hasTool`, `wearTool` (Task 1); `nodesNear` (Task 3); `TOOL_SECONDS` (Task 1).
- Produces: `hasToolFor(state, node)` → boolean; `nearbyNode(state)` returns only nodes the player can gather now; `lockedNode(state)` → nearest in-reach node whose tool is missing, or null; `gatherTime(state, node)` → 6, 5 or 3; `finishInteraction` returns `{kind: 'gather', node, wear}` where `wear` is `'warn'|'broke'|null`.

- [ ] **Step 1: Update the tests that assumed the Scout's pine takes 6 s by hand**

The Scout now carries a stone axe, so the Pinefall pine takes `TOOL_SECONDS.stone`.

In `tests/actions/gather.test.js`:
- Import `TOOL_SECONDS` from balance and `gatherTime, lockedNode` from gather.js.
- In `"beginGather starts the node's own timed action without awarding it"`, change `duration: GATHER_SECONDS,` to `duration: TOOL_SECONDS.stone, // the Scout's hatchet is a stone axe`.
- In `'the supply is awarded only when the timed action completes'`, change `GATHER_SECONDS - 0.01` to `gatherTime(game, node) - 0.01`.

In `tests/world/nodes.test.js`, in `'every supply is a known, solid, action-backed sprite that takes the full gather time'`, use a character with no tools, so it measures bare hands:

```js
    assert.equal(gatherTime(createGame('survivor'), node), GATHER_SECONDS); // bare hands
```

In `tests/actions/interact.test.js`, in `'finishInteraction hands out a gathered supply, and nothing for an unknown id'`:

```js
  assert.deepEqual(finishInteraction(game, 'pine-wood'), {
    kind: 'gather',
    node: pine,
    wear: null,
  });
```

- [ ] **Step 2: Write the new failing tests**

Add to `tests/actions/gather.test.js`:

```js
// Guards the axe rule: a tree in reach can't be chopped without one, and is reported as locked instead.
test('a tree needs an axe: without one it is locked, with one it can be chopped', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const game = createGame('survivor'); // no tools
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  assert.equal(nearbyNode(game), null);
  assert.equal(lockedNode(game)?.id, 'pine-wood');
  assert.equal(finishGather(game, 'pine-wood'), null);

  game.tools.axe = { tier: 'stone', uses: 5 };
  assert.equal(nearbyNode(game)?.id, 'pine-wood');
  assert.notEqual(lockedNode(game)?.id, 'pine-wood'); // a rock nearby may still need a pickaxe
  assert.equal(finishGather(game, 'pine-wood')?.id, 'pine-wood');
});

// Guards gather times: bare hands keep the full 6 s, a stone tool takes 5 s and an iron one 3 s.
test('tools shorten the gathers that need them, and only those', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood'),
    berries = NODES.find((n) => n.id === 'forest-food');
  const game = createGame('survivor');
  assert.equal(gatherTime(game, berries), GATHER_SECONDS);
  game.tools.axe = { tier: 'stone', uses: 5 };
  assert.equal(gatherTime(game, pine), TOOL_SECONDS.stone);
  game.tools.axe = { tier: 'iron' };
  assert.equal(gatherTime(game, pine), TOOL_SECONDS.iron);
  assert.equal(gatherTime(game, berries), GATHER_SECONDS);
});

// Guards the map's trees and rocks: with the right tool they give their wood, stone or iron.
test('map trees and iron rocks can be gathered with the right tool', () => {
  const game = createGame('survivor');
  game.tools = { axe: { tier: 'iron' }, pickaxe: { tier: 'iron' } };
  for (const sprite of ['big-oak', 'boulder', 'cliff-rock']) {
    const node = NODES.find((n) => n.sprite === sprite && n.inScenery);
    Object.assign(game.player, { x: node.x, y: node.y + 30 });
    const before = game.resources[node.type];
    assert.equal(finishGather(game, node.id)?.id, node.id, sprite);
    assert.equal(game.resources[node.type], before + node.amount, sprite);
  }
  assert.ok(game.resources.iron >= 1);
});
```

Add to `tests/actions/interact.test.js`:

```js
// Guards wear through E: a finished chop costs a stone axe one use, the last use still pays out,
// then the axe breaks; a bare-hand gather wears nothing.
test('chopping wears a stone axe, and the last use still pays before it breaks', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const game = createGame('survivor'); // starts with 2 wood
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  game.tools.axe = { tier: 'stone', uses: 1 };
  assert.deepEqual(finishInteraction(game, 'pine-wood'), {
    kind: 'gather',
    node: pine,
    wear: 'broke',
  });
  assert.equal(game.resources.wood, 2 + pine.amount);
  assert.equal(game.tools.axe, undefined);
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test tests/actions/gather.test.js tests/actions/interact.test.js tests/world/nodes.test.js`
Expected: FAIL (`lockedNode` is not exported; no tool rule; times are all 6).

- [ ] **Step 4: Make the Pinefall pine need an axe in `src/data/supplies.js`**

Add `tool: 'axe',` to the `pine-wood` entry (after `clip: 'build',`), and add to the `SUPPLIES` field list in its doc comment: "`tool`, when set, names the tool needed to gather it (the pine tree needs an axe)".

- [ ] **Step 5: Add the tool rule to `src/actions/gather.js`**

Replace the imports and everything from `gatherTime` through `nearbyNode`:

```js
import { NODES, nodesNear, isAvailable } from '../world/nodes.js';
import { GATHER_RANGE, GATHER_SECONDS, TOOL_SECONDS } from '../data/balance.js';
import { toolTier, hasTool } from '../world/tools.js';
import { startAction } from '../animation/clips.js';

/**
 * Says how many seconds gathering from a node takes.
 *
 * Bare-hand gathers take the full GATHER_SECONDS. A node that needs a tool (a tree, a rock) is
 * quicker with a stone tool and quicker still with an iron one: better tools, faster work.
 *
 * @param {object} state - The game being played.
 * @param {object} node - The supply, wild patch, tree or rock being gathered.
 * @returns {number} Seconds the gathering action lasts.
 */
export function gatherTime(state, node) {
  const tier = node.tool && toolTier(state, node.tool);
  return tier ? TOOL_SECONDS[tier] : GATHER_SECONDS;
}

/** True when the node is close enough to the player to gather it. */
const inReach = (state, n) => Math.hypot(n.x - state.player.x, n.y - state.player.y) < GATHER_RANGE;

/**
 * Says whether the player has whatever tool a node needs. Most supplies need none.
 *
 * @param {object} state - The game being played.
 * @param {object} n - The node to check.
 * @returns {boolean} True if nothing is needed or the player owns the tool.
 */
export const hasToolFor = (state, n) => !n.tool || hasTool(state, n.tool);

// Whether a node can be gathered now is decided in world/nodes.js; it is passed on from here for
// the HUD and the renderer, which already import it from this file.
export { isAvailable };

/**
 * Lists the nodes close enough to gather that have something to give, nearest first.
 *
 * @param {object} state - The game being played.
 * @returns {object[]} The nodes, nearest first (an empty list if none).
 */
function nodesInReach(state) {
  const { x, y } = state.player;
  return nodesNear(x, y)
    .filter((n) => isAvailable(state, n) && inReach(state, n))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}

/**
 * Finds the closest node the player could gather from right now, with the tools they have.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest available node in reach, or null if there is none.
 */
export function nearbyNode(state) {
  return nodesInReach(state).find((n) => hasToolFor(state, n)) ?? null;
}

/**
 * Finds the closest node in reach that needs a tool the player doesn't have yet.
 *
 * The HUD and E use it to say what to craft ("Chop pine tree — needs an axe") instead of
 * staying silent beside a tree.
 *
 * @param {object} state - The game being played.
 * @returns {object|null} The nearest such node, or null if there is none.
 */
export function lockedNode(state) {
  return nodesInReach(state).find((n) => !hasToolFor(state, n)) ?? null;
}
```

In `finishGather`, refuse a node whose tool is missing:

```js
  if (!node || !isAvailable(state, node) || !inReach(state, node) || !hasToolFor(state, node))
    return null;
```

and add to its doc comment: "It also needs the right tool; wearing the tool down is up to finishInteraction, which reports it."

- [ ] **Step 6: Wear the tool after a gather in `src/actions/interact.js`**

Add `import { wearTool } from '../world/tools.js';` and replace the end of `finishInteraction`:

```js
  const node = finishGather(state, target);
  if (!node) return null;
  // A gather that needed a tool wears it a little; only stone tools wear out.
  return { kind: 'gather', node, wear: node.tool ? wearTool(state, node.tool) : null };
```

Update its doc comment's `@returns` to: `{{kind: string, wreck?: object, node?: object, wear?: string|null}|null}` and add "`wear` is 'warn' or 'broke' when a stone tool is wearing out (see wearTool)."

- [ ] **Step 7: Run the tests to make sure they pass**

Run: `node --test tests/actions/gather.test.js tests/actions/interact.test.js tests/world/nodes.test.js`
Expected: PASS.

- [ ] **Step 8: Run the full suite and format**

Run: `npm run format && npm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/actions/gather.js src/actions/interact.js src/data/supplies.js tests/actions/gather.test.js tests/actions/interact.test.js tests/world/nodes.test.js
git commit -m "Need an axe to chop and a pickaxe to mine; tools speed gathering and wear out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Crafting tools, and the tool ladder

**Files:**
- Create: `src/actions/craft.js`
- Modify: `src/actions/interact.js` (finish craft actions)
- Test: `tests/actions/craft.test.js` (new), `tests/data/ladder.test.js` (new)

**Interfaces:**
- Consumes: `TOOL_RECIPES`, `CRAFT_SECONDS` (Task 1); `toolInfo` (Task 1); `toolTier`, `hasTool`, `newStoneTool`, `wearTool`, `startingTools` (Task 1); `byFire(state)` (`src/world/camps.js`); `listMissing(missing)` (`src/actions/boat.js`, formats `{iron: 2}` as "2 iron", joined with " and "); `startAction(animator, clip, target, seconds)` (`src/animation/clips.js`).
- Produces: `CRAFT_PREFIX = 'craft:'`; `nextTier(state, tool)` → `'stone'|'iron'|null`; `toolName(tool, tier)` → e.g. `'stone axe'`; `canCraft(state, tool)` → `{ok: true, tier, cost}` or `{ok: false, tier, cost?, reason, message}` with `reason` one of `'owned'|'aboard'|'cost'|'hammer'|'fire'`; `beginCraft(state, animator, tool)` → `canCraft`'s answer or `{ok: false, reason: 'busy'}`; `finishCraft(state, tool)` → `{ok: true, tool, tier, wear}` or `{ok: false, tool, ...}`; `finishInteraction(state, 'craft:<tool>')` → `{kind: 'craft', ...finishCraft result}`.

- [ ] **Step 1: Write the failing craft tests**

Create `tests/actions/craft.test.js`:

```js
// Checks crafting tools: what each one costs, where iron tools can be forged, and that a craft
// pays exactly once. A slip here could hand out free tools or swallow the materials.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_RECIPES, TOOL_USES, CRAFT_SECONDS } from '../../src/data/balance.js';
import { createGame } from '../../src/game/state.js';
import { canCraft, beginCraft, finishCraft, nextTier } from '../../src/actions/craft.js';
import { finishInteraction } from '../../src/actions/interact.js';
import { createAnimator, advanceAnimation, cancelAction } from '../../src/animation/clips.js';

/**
 * Makes a Survivor (no tools) at their spawn with plenty of wood, stone and iron.
 *
 * @returns {object} The game.
 */
function richGame() {
  const game = createGame('survivor');
  Object.assign(game.resources, { wood: 50, stone: 50, iron: 50 });
  return game;
}

/**
 * Founds a camp right where the player stands, so they are beside one of their fires.
 *
 * @param {object} game - The game being played. A camp is added to it.
 */
function campHere(game) {
  game.camps.push({
    id: 'camp-1',
    name: 'Test Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [],
  });
}

// Guards the stone tier: it costs its recipe, can be made anywhere, and starts with every use.
test('a stone tool costs its recipe, is made anywhere, and starts with every use', () => {
  const game = richGame();
  assert.equal(nextTier(game, 'axe'), 'stone');
  assert.deepEqual(finishCraft(game, 'axe'), { ok: true, tool: 'axe', tier: 'stone', wear: null });
  assert.deepEqual(game.tools.axe, { tier: 'stone', uses: TOOL_USES.axe });
  assert.equal(game.resources.wood, 50 - TOOL_RECIPES.axe.stone.wood);
  assert.equal(game.resources.stone, 50 - TOOL_RECIPES.axe.stone.stone);
  assert.equal(nextTier(game, 'axe'), 'iron');
});

// Guards a short backpack: the craft is refused, says what is missing, and spends nothing.
test('a craft short of materials is refused, says what is missing, and spends nothing', () => {
  const game = createGame('survivor'); // 2 wood, no stone
  const before = { ...game.resources };
  const result = finishCraft(game, 'pickaxe');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cost');
  assert.match(result.message, /1 wood and 3 stone/);
  assert.deepEqual(game.resources, before);
  assert.deepEqual(game.tools, {});
});

// Guards the iron tier's rules and the order of advice: iron first (with where to find it), then
// a hammer, then a campfire.
test('iron tools need iron, a hammer and a campfire', () => {
  const game = richGame();
  game.tools.axe = { tier: 'stone', uses: 4 };
  game.resources.iron = 0;
  assert.equal(canCraft(game, 'axe').reason, 'cost');
  assert.match(canCraft(game, 'axe').message, /Stonewater Canyons and Frostpeak/);
  game.resources.iron = 50;
  assert.equal(canCraft(game, 'axe').reason, 'hammer');
  game.tools.hammer = { tier: 'stone', uses: 2 };
  assert.equal(canCraft(game, 'axe').reason, 'fire');
  campHere(game);
  assert.deepEqual(canCraft(game, 'axe'), { ok: true, tier: 'iron', cost: TOOL_RECIPES.axe.iron });
});

// Guards forging: iron replaces the stone tool, the stone hammer wears (and may break), and an
// iron tool can't be made twice.
test('forging iron replaces the stone tool and wears a stone hammer', () => {
  const game = richGame();
  campHere(game);
  game.tools = { axe: { tier: 'stone', uses: 4 }, hammer: { tier: 'stone', uses: 1 } };
  assert.deepEqual(finishCraft(game, 'axe'), { ok: true, tool: 'axe', tier: 'iron', wear: 'broke' });
  assert.deepEqual(game.tools, { axe: { tier: 'iron' } });
  assert.equal(game.resources.iron, 50 - TOOL_RECIPES.axe.iron.iron);
  assert.equal(canCraft(game, 'axe').reason, 'owned');

  // With the hammer broken, the next iron tool waits for a new one.
  game.tools.pickaxe = { tier: 'stone', uses: 9 };
  assert.equal(canCraft(game, 'pickaxe').reason, 'hammer');
});

// Guards the iron hammer: it is forged with the stone hammer, which it replaces.
test('the iron hammer is forged with the stone one, which it replaces', () => {
  const game = richGame();
  campHere(game);
  game.tools.hammer = { tier: 'stone', uses: 3 };
  assert.deepEqual(finishCraft(game, 'hammer'), {
    ok: true,
    tool: 'hammer',
    tier: 'iron',
    wear: null,
  });
  assert.deepEqual(game.tools.hammer, { tier: 'iron' });
});

// Guards the timed action: starting spends nothing, a cancelled craft spends nothing, and the
// finished one pays exactly once through the loop's finishInteraction.
test('a craft takes time, a cancelled one spends nothing, and a finished one pays once', () => {
  const game = richGame(),
    animator = createAnimator();
  assert.equal(beginCraft(game, animator, 'axe').ok, true);
  assert.equal(animator.pending.target, 'craft:axe');
  assert.equal(beginCraft(game, animator, 'pickaxe').reason, 'busy');
  cancelAction(animator);
  assert.equal(game.resources.wood, 50);
  assert.deepEqual(game.tools, {});

  beginCraft(game, animator, 'axe');
  assert.equal(advanceAnimation(animator, CRAFT_SECONDS - 0.01, {}), null);
  const done = advanceAnimation(animator, 0.02, {});
  assert.equal(done?.target, 'craft:axe');
  assert.equal(finishInteraction(game, done.target).ok, true);
  assert.equal(game.resources.wood, 50 - TOOL_RECIPES.axe.stone.wood);
  assert.equal(game.tools.axe.tier, 'stone');
});

// Guards the boat: no crafting while sitting in it.
test('crafting is refused in the boat', () => {
  const game = richGame();
  game.aboard = true;
  assert.equal(canCraft(game, 'axe').reason, 'aboard');
});
```

- [ ] **Step 2: Write the failing ladder test**

Create `tests/data/ladder.test.js`:

```js
// Checks the tool ladder: from each character's start, every tool can be reached using only what
// bare hands can gather plus the tools made along the way. A broken ladder would strand a player
// with no way to their first axe, or make a tool that needs itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_RECIPES, CAMPFIRE_COST } from '../../src/data/balance.js';
import { TOOL_IDS, TIERS } from '../../src/data/tools.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { NODES } from '../../src/world/nodes.js';
import { startingTools } from '../../src/world/tools.js';

// Guards the whole recipe graph, climbing it like a ladder rung by rung: stone tools need what
// hands (or tools already made) can gather; iron needs the stone tool, a hammer and a campfire.
test('every tool is reachable from each character start', () => {
  for (const character of CHARACTERS) {
    const made = new Set(Object.keys(startingTools(character.id)).map((t) => `stone ${t}`));

    /** The resource types the player can gather now: by hand, or with a tool already made. */
    const gatherable = () =>
      new Set(
        NODES.filter(
          (n) => !n.tool || made.has(`stone ${n.tool}`) || made.has(`iron ${n.tool}`),
        ).map((n) => n.type),
      );

    for (let grew = true; grew; ) {
      grew = false;
      const can = gatherable();
      const fire = Object.keys(CAMPFIRE_COST).every((type) => can.has(type));
      const hammer = made.has('stone hammer') || made.has('iron hammer');
      for (const tool of TOOL_IDS)
        for (const tier of TIERS) {
          const key = `${tier} ${tool}`;
          const materials = Object.keys(TOOL_RECIPES[tool][tier]).every((t) => can.has(t));
          const extras = tier === 'stone' || (made.has(`stone ${tool}`) && hammer && fire);
          if (!made.has(key) && materials && extras) {
            made.add(key);
            grew = true;
          }
        }
    }

    for (const tool of TOOL_IDS)
      for (const tier of TIERS)
        assert.ok(made.has(`${tier} ${tool}`), `${character.id} can't reach the ${tier} ${tool}`);
  }
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test tests/actions/craft.test.js tests/data/ladder.test.js`
Expected: craft test FAILS (`Cannot find module .../craft.js`); the ladder test may already pass (it only reads data). That is fine: it guards the data from now on.

- [ ] **Step 4: Create `src/actions/craft.js`**

```js
// The "craft" action: making tools from wood, stone and iron in the Build menu. Stone tools are
// made anywhere; iron tools need a hammer and one of the player's campfires (the fire is the
// forge). Like gathering, crafting takes time: beginCraft starts it, and the game loop finishes it
// through finishCraft, which checks everything again and only then pays, so nothing is paid twice.

import { TOOL_RECIPES, CRAFT_SECONDS } from '../data/balance.js';
import { toolInfo } from '../data/tools.js';
import { toolTier, hasTool, newStoneTool, wearTool } from '../world/tools.js';
import { byFire } from '../world/camps.js';
import { listMissing } from './boat.js';
import { startAction } from '../animation/clips.js';

/** The start of every craft action's target, such as `craft:axe`, so the loop can tell crafts from gathers. */
export const CRAFT_PREFIX = 'craft:';

/**
 * Says which tier of a tool the player would craft next.
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id, such as 'axe'.
 * @returns {string|null} 'stone' when they don't own it, 'iron' when they own the stone one, and
 *   null when they already own the iron one.
 */
export function nextTier(state, tool) {
  const tier = toolTier(state, tool);
  if (!tier) return 'stone';
  return tier === 'stone' ? 'iron' : null;
}

/**
 * Puts a tool and its tier into words, such as "stone axe".
 *
 * @param {string} tool - The tool's id.
 * @param {string} tier - 'stone' or 'iron'.
 * @returns {string} The words, all lower case.
 */
export const toolName = (tool, tier) => `${tier} ${toolInfo(tool).name}`;

/**
 * Works out what the backpack is short of for a cost.
 *
 * @param {object} state - The game being played.
 * @param {object} cost - What is needed, such as `{wood: 2, iron: 3}`.
 * @returns {object} How much more of each is needed, such as `{iron: 2}`; empty when nothing is.
 */
function missingFor(state, cost) {
  return Object.fromEntries(
    Object.entries(cost)
      .map(([type, n]) => [type, n - state.resources[type]])
      .filter(([, short]) => short > 0),
  );
}

/**
 * Checks whether the player can craft the next tier of a tool right now, without changing anything.
 *
 * The first rule that fails is the answer, in the order that helps most: they already own the iron
 * one, they are sitting in the boat, the backpack is short (with a hint where iron is found), they
 * have no hammer (iron only), or they are away from their campfires (iron only).
 *
 * @param {object} state - The game being played.
 * @param {string} tool - The tool's id.
 * @returns {{ok: boolean, tier: string|null, cost?: object, reason?: string, message?: string}}
 *   `ok` with the tier and its cost; otherwise `reason` ('owned', 'aboard', 'cost', 'hammer' or
 *   'fire') and a `message` to show.
 */
export function canCraft(state, tool) {
  const tier = nextTier(state, tool);
  if (!tier)
    return {
      ok: false,
      tier,
      reason: 'owned',
      message: `You already have an ${toolName(tool, 'iron')}`,
    };
  const cost = TOOL_RECIPES[tool][tier];
  if (state.aboard)
    return { ok: false, tier, cost, reason: 'aboard', message: 'Step ashore to craft' };

  const missing = missingFor(state, cost);
  if (Object.keys(missing).length) {
    const hint = missing.iron ? ' · Mine iron in the rocks of Stonewater Canyons and Frostpeak' : '';
    return {
      ok: false,
      tier,
      cost,
      reason: 'cost',
      message: `Needs ${listMissing(missing)} more${hint}`,
    };
  }
  if (tier === 'iron' && !hasTool(state, 'hammer'))
    return { ok: false, tier, cost, reason: 'hammer', message: 'Iron tools need a hammer' };
  if (tier === 'iron' && !byFire(state))
    return {
      ok: false,
      tier,
      cost,
      reason: 'fire',
      message: 'Forge iron tools beside your campfire',
    };
  return { ok: true, tier, cost };
}

/**
 * Starts crafting the next tier of a tool: what picking it in the Build menu does.
 *
 * It only starts the timed action (the `craft` clip for CRAFT_SECONDS); nothing is paid yet.
 *
 * @param {object} state - The game being played.
 * @param {object} animator - The player's animation state, which runs the timed action.
 * @param {string} tool - The tool's id.
 * @returns {object} canCraft's answer, or `{ok: false, reason: 'busy'}` while another action runs.
 */
export function beginCraft(state, animator, tool) {
  if (animator.pending) return { ok: false, reason: 'busy' };
  const check = canCraft(state, tool);
  if (!check.ok) return check;
  startAction(animator, 'craft', `${CRAFT_PREFIX}${tool}`, CRAFT_SECONDS);
  return check;
}

/**
 * Makes the tool when its craft action finishes.
 *
 * Everything is checked again first, because the backpack or the player's spot may have changed
 * while they worked. Then the cost is paid, a stone hammer used for forging iron wears a little,
 * and the tool goes in the backpack, all in one step, so nothing is ever paid without a tool.
 *
 * @param {object} state - The game being played. Resources and tools change on success.
 * @param {string} tool - The tool's id.
 * @returns {{ok: boolean, tool: string, tier?: string, wear?: string|null, reason?: string,
 *   message?: string}} On success the tier made and the hammer's `wear` ('warn', 'broke' or null);
 *   otherwise canCraft's reason and message, with nothing changed.
 */
export function finishCraft(state, tool) {
  const check = canCraft(state, tool);
  if (!check.ok) return { ...check, tool };

  for (const [type, n] of Object.entries(check.cost)) state.resources[type] -= n;
  // Forging iron wears a stone hammer one use. The iron hammer replaces the stone one anyway, so
  // that hammer's wear isn't worth a message.
  const wear = check.tier === 'iron' ? wearTool(state, 'hammer') : null;
  state.tools[tool] = check.tier === 'iron' ? { tier: 'iron' } : newStoneTool(tool);
  return { ok: true, tool, tier: check.tier, wear: tool === 'hammer' ? null : wear };
}
```

- [ ] **Step 5: Finish craft actions in `src/actions/interact.js`**

Add `import { finishCraft, CRAFT_PREFIX } from './craft.js';`. At the top of `finishInteraction`, before the old-boat check:

```js
  if (target.startsWith(CRAFT_PREFIX))
    return { kind: 'craft', ...finishCraft(state, target.slice(CRAFT_PREFIX.length)) };
```

Update the file header to mention crafting, and the doc comment of `finishInteraction`: "Hands out the result of a timed action when it finishes: a mended boat, gathered supplies or a crafted tool." and `@returns` add "`{kind: 'craft', ok, ...}` for a craft (see finishCraft), even when its last check failed".

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `node --test tests/actions/craft.test.js tests/data/ladder.test.js tests/actions/interact.test.js`
Expected: PASS.

- [ ] **Step 7: Run the full suite and format**

Run: `npm run format && npm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/actions/craft.js src/actions/interact.js tests/actions/craft.test.js tests/data/ladder.test.js
git commit -m "Craft stone and iron tools; check every tool is reachable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Item box, Build menu, E prompt and toasts

**Files:**
- Modify: `src/ui/layout.js`
- Modify: `src/style.css`
- Modify: `src/ui/hud.js`
- Modify: `src/core/build.js`
- Modify: `src/core/input.js`
- Modify: `src/core/loop.js`

**Interfaces:**
- Consumes: `TOOLS`, `toolInfo` (Task 1); `canCraft`, `beginCraft`, `nextTier`, `toolName`, `CRAFT_PREFIX` (Task 6); `lockedNode` (Task 5); `TOOL_WEAR_WARNING` (Task 1); `finishInteraction` result shapes (Tasks 5–6).
- Produces: `describeFinish(finished)` exported from `src/ui/hud.js`; `ui.build.craft(tool)`; DOM ids `craft-axe|pickaxe|hammer` (with `.craft-name` and `.craft-cost` inside) and `tool-axe|pickaxe|hammer` (with `.tool-state` inside).

- [ ] **Step 1: Icons, Tools group and tools row in `src/ui/layout.js`**

Import `TOOLS` from `'../data/tools.js'`. Add to `icons`:

```js
  axe: '<path d="m4 20 10-10"/><path d="M12 5c2.5-2.5 6-2.5 8 0l-5 5c-2-.5-3.5-2.5-3-5Z"/>',
  pickaxe: '<path d="M4 9c5-5 11-5 16 0"/><path d="M12 5.5V21"/>',
```

In the build menu, after the `build-campfire` button and before the closing `</div>`:

```js
            <p class="build-menu-title">TOOLS</p>
            ${TOOLS.map(
              (t) => /* HTML */ `<button
                id="craft-${t.id}"
                class="build-option craft-option"
                data-tool="${t.id}"
              >
                ${icon(t.icon)}<span class="build-option-text"
                  ><b class="craft-name"></b><small>${t.use}</small></span
                ><span class="build-cost craft-cost"></span><kbd>${t.key}</kbd>
              </button>`,
            ).join('')}
```

Inside `.hotbar-area`, after the build menu `</div>` and before `<div class="hotbar ...">`:

```js
          <!-- The tools owned: a chip per tool with its tier, and the uses left on a stone one. -->
          <div class="tool-row" aria-label="Tools">
            ${TOOLS.map(
              (t) => /* HTML */ `<span id="tool-${t.id}" class="tool-chip empty"
                >${icon(t.icon)}<span class="tool-state">—</span></span
              >`,
            ).join('')}
          </div>
```

Update the world's `aria-label` to add ", 2 to 4 in the build menu to craft tools" after "B to open the build menu", and the comment above the item box to mention the tools row and the Tools group.

- [ ] **Step 2: Styles in `src/style.css`**

After the `.build-option.short .build-cost` rule, add:

```css
/* A tool already owned at its best tier: the entry stays in the list but can't be picked. */
.build-option:disabled {
  cursor: default;
  opacity: 0.6;
}

.build-option:disabled:hover {
  background: #fffdf4;
}

/* The tool icons in the Tools group are wood-brown, not the campfire's orange. */
.craft-option svg {
  color: #8a6a43;
}

/* ---- Tools row ---- */

/* The tools the player owns, as small chips in a row above the item box. */
.tool-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 6px;
  border: 1px solid #dcdccb;
  border-radius: 999px;
  background: #fffdf4;
  color: var(--ink);
  font-size: 11px;
  font-weight: 600;
}

.tool-chip svg {
  width: 15px;
  height: 15px;
  color: #8a6a43;
}

/* An iron tool's icon turns steel blue, so the upgrade shows at a glance. */
.tool-chip.iron svg {
  color: #4f6273;
}

/* A tool not owned yet is faded, like an empty item slot. */
.tool-chip.empty {
  opacity: 0.5;
}
```

Change `.build-menu` so a taller menu still fits on short screens:

```css
.build-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  width: 300px;
  max-height: 70svh;
  overflow-y: auto;
  padding: 12px;
}
```

Near the `.interact.busy` rules, add:

```css
/* A tree or rock that needs a tool the player doesn't have: E only explains, so the button is faded. */
.interact.locked {
  opacity: 0.75;
}
```

- [ ] **Step 3: HUD words, Build menu entries and the tools row in `src/ui/hud.js`**

1. Imports: add `TOOL_WEAR_WARNING` to the balance import, and:

```js
import { TOOLS, toolInfo } from '../data/tools.js';
import { lockedNode } from '../actions/gather.js';
import { canCraft, nextTier, toolName, CRAFT_PREFIX } from '../actions/craft.js';
```

2. Add helpers after `DOING`:

```js
/**
 * Writes a cost as words for the Build menu.
 *
 * @param {object} cost - Such as `{wood: 2, stone: 1, iron: 3}`.
 * @returns {string} Such as "2 wood · 1 stone · 3 iron".
 */
const costWords = (cost) =>
  Object.entries(cost)
    .map(([type, n]) => `${n} ${type}`)
    .join(' · ');

/**
 * Gives words a capital first letter, such as "Stone axe".
 *
 * @param {string} words - The words.
 * @returns {string} The same words, starting with a capital.
 */
const capital = (words) => words[0].toUpperCase() + words.slice(1);

/**
 * Words for a stone tool wearing out: a warning at a few uses left, or that it broke.
 *
 * @param {string} tool - The tool's id.
 * @param {string|null} wear - What wearTool said: 'warn', 'broke' or null.
 * @returns {string} The words, or '' when there is nothing to say.
 */
function wearWords(tool, wear) {
  if (wear === 'warn') return `Stone ${tool}: ${TOOL_WEAR_WARNING} uses left`;
  if (wear === 'broke') return `Your stone ${tool} broke`;
  return '';
}

/**
 * Puts a finished timed action into words for a toast: a mended boat, supplies gathered, or a tool
 * made, plus any news about a tool wearing out.
 *
 * @param {object} finished - What finishInteraction returned.
 * @returns {string} The message.
 */
export function describeFinish(finished) {
  if (finished.kind === 'repair')
    return 'Boat repaired · Walk to the water’s edge and press E to board';
  if (finished.kind === 'craft') {
    if (!finished.ok) return finished.message;
    return [`${capital(toolName(finished.tool, finished.tier))} made`, wearWords('hammer', finished.wear)]
      .filter(Boolean)
      .join(' · ');
  }
  const { node, wear } = finished;
  return [`+${node.amount} ${node.type} · ${node.label}`, wearWords(node.tool, wear)]
    .filter(Boolean)
    .join(' · ');
}
```

3. `busyLabel` now needs the game to name a craft. Replace it:

```js
/**
 * Words for the interact button while a timed action runs, or null when none is running.
 *
 * @param {object} state - The game being played (to name the tier being crafted).
 * @param {object} animator - The player's animation state.
 * @returns {string|null} E.g. "Crafting stone axe… move to stop".
 */
function busyLabel(state, animator) {
  const target = animator.pending?.target;
  if (!target) return null;
  if (target.startsWith(CRAFT_PREFIX)) {
    const tool = target.slice(CRAFT_PREFIX.length);
    return `Crafting ${toolName(tool, nextTier(state, tool) ?? 'iron')}… move to stop`;
  }
  if (WRECKS.some((w) => w.id === target)) return 'Repairing the old boat… move to stop';
  const node = NODES.find((n) => n.id === target);
  return node ? `${DOING[node.verb]} ${node.label.toLowerCase()}… move to stop` : null;
}
```

4. Inside `createHud`, replace `updateActions` and add `updateBuildMenu` and `updateTools`:

```js
  /**
   * Shows the interact button and the build bar for what the player can do right now.
   *
   * The button is "busy" while gathering, repairing or crafting, "Place campfire" in build mode,
   * what E would do (step ashore, board, repair, gather), "Open <camp>" beside one of the player's
   * fires, and last of all a faded "Chop pine tree — needs an axe" beside a tree or rock whose
   * tool the player lacks.
   *
   * @param {object} state - The game being played.
   */
  function updateActions(state) {
    const { animator, build } = session;
    const choice = chooseInteraction(state),
      busy = busyLabel(state, animator),
      camp = !choice && !state.aboard && campInReach(state),
      locked = !choice && !camp && !state.aboard && lockedNode(state),
      button = $('interact'),
      label = button.querySelector('span');
    button.hidden = !choice && !busy && !build.active && !camp && !locked;
    button.classList.toggle('busy', !!busy);
    button.classList.toggle('locked', !busy && !build.active && !!locked);
    button.setAttribute('aria-disabled', String(!!busy));
    if (busy) label.textContent = busy;
    else if (build.active) label.textContent = 'Place campfire';
    else if (choice) label.textContent = actionLabel(state, choice);
    else if (camp) label.textContent = `Open ${camp.name}`;
    else if (locked)
      label.textContent = `${locked.verb} ${locked.label.toLowerCase()} — needs ${toolInfo(locked.tool).aName}`;
    // The controls strip sits where the action button and build menu appear, so it gives way.
    if (!button.hidden || build.menu) hideKeyStrip();

    updateBuildMenu(state);

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
   * Fills the build menu: the campfire, and one entry per tool showing the next tier the player
   * can make and its cost.
   *
   * A campfire or tool the player can't afford yet shows its cost in red but can still be picked,
   * so the game can say what is missing. A tool that is blocked for another reason (no hammer, away
   * from a fire) explains on hover. An iron tool already owned says "Owned" and can't be picked.
   *
   * @param {object} state - The game being played.
   */
  function updateBuildMenu(state) {
    const { build } = session;
    const short = Object.entries(CAMPFIRE_COST).some(([type, n]) => state.resources[type] < n);
    $('build-menu').hidden = !build.menu;
    $('build-button').setAttribute('aria-expanded', String(build.menu));
    $('build-button').classList.toggle('active', build.menu || build.active);
    $('build-campfire').classList.toggle('short', short);
    if (!build.menu) return;

    for (const { id } of TOOLS) {
      const option = $(`craft-${id}`),
        check = canCraft(state, id);
      option.querySelector('.craft-name').textContent = capital(toolName(id, check.tier ?? 'iron'));
      option.querySelector('.craft-cost').textContent = check.cost ? costWords(check.cost) : 'Owned';
      option.classList.toggle('short', check.reason === 'cost');
      option.disabled = check.reason === 'owned';
      option.title = check.ok ? '' : check.message;
    }
  }

  /**
   * Fills the tools row: each tool's tier, and the uses left on a stone one.
   *
   * @param {object} state - The game being played.
   */
  function updateTools(state) {
    for (const { id, name } of TOOLS) {
      const chip = $(`tool-${id}`),
        owned = state.tools[id];
      chip.classList.toggle('empty', !owned);
      chip.classList.toggle('iron', owned?.tier === 'iron');
      chip.querySelector('.tool-state').textContent = !owned
        ? '—'
        : owned.tier === 'iron'
          ? 'Iron'
          : String(owned.uses);
      chip.title = !owned
        ? `No ${name} yet · Craft one in the Build menu (B)`
        : owned.tier === 'iron'
          ? `Iron ${name}`
          : `Stone ${name} · ${owned.uses} uses left`;
    }
  }
```

5. In `update()`, call `updateTools(state);` right after the item box loop.

- [ ] **Step 4: `craft(tool)` in `src/core/build.js`**

Imports: add `import { beginCraft } from '../actions/craft.js';` and `import { TOOLS } from '../data/tools.js';`. Update the file header's first sentence to mention crafting tools.

Add inside `setupBuild`, after `start()`:

```js
  /**
   * Starts crafting the next tier of a tool (the menu's Tools entries, or 2, 3 and 4 while the
   * menu is open).
   *
   * The menu closes, any gathering in progress stops, and the craft action starts; the game loop
   * finishes it. A tool that can't be made yet changes nothing, and a toast says why.
   *
   * @param {string} tool - Which tool: 'axe', 'pickaxe' or 'hammer'.
   */
  function craft(tool) {
    if (session.screen !== 'game' || !session.state || refuseAboard()) return;
    build.menu = false;
    cancelAction(session.animator);
    const result = beginCraft(session.state, session.animator, tool);
    if (result.ok) session.keys.clear();
    else ui.hud.notify(result.message);
    ui.hud.update();
  }
```

Wire the buttons and return it:

```js
  // The Build button opens the menu; the menu's Campfire option starts placing one, and each tool
  // entry starts crafting it.
  $('build-button').addEventListener('click', toggleMenu);
  $('build-campfire').addEventListener('click', start);
  for (const { id } of TOOLS) $(`craft-${id}`).addEventListener('click', () => craft(id));

  return { toggleMenu, start, cancel, place, update, craft };
```

Update `setupBuild`'s `@returns` to list `craft: Function` and "start crafting a tool".

- [ ] **Step 5: Keys 2–4 and the locked toast in `src/core/input.js`**

Imports: add `import { TOOLS, toolInfo } from '../data/tools.js';` and `import { lockedNode } from '../actions/gather.js';`.

After the `key === '1'` block:

```js
    // With the build menu open, 2, 3 and 4 craft the axe, pickaxe and hammer.
    const tool = TOOLS.find((t) => t.key === key);
    if (tool && !event.repeat && session.build.menu) {
      event.preventDefault();
      ui.build.craft(tool.id);
      return;
    }
```

Replace the end of `use()` (from `// Camps are opened on foot` on):

```js
    // Camps are opened on foot; from the boat, step ashore first.
    const camp = !session.state.aboard && campInReach(session.state);
    if (camp) {
      ui.camp.openCamp(camp);
      return;
    }
    // A tree or rock in reach that needs a tool the player doesn't have yet: say how to get one.
    const locked = !session.state.aboard && lockedNode(session.state);
    ui.hud.notify(
      locked
        ? `You need ${toolInfo(locked.tool).aName}. Make one in the Build menu (B).`
        : 'Move closer to something you can use.',
    );
```

Update `use()`'s doc comment ("...opens that camp; beside a tree or rock it says which tool to make; anywhere else it says why nothing happened.") and `setupInput`'s ("B for the build menu (and 1 to pick the campfire, 2 to 4 to craft a tool)").

- [ ] **Step 6: Finish toasts in `src/core/loop.js`**

Change the hud import to `import { describeEvent, describeFinish } from '../ui/hud.js';`, and replace the `if (finished) { ... }` block:

```js
        // When a timed action finishes, hand out what it was aimed at (exactly once): supplies, a
        // mended boat or a crafted tool.
        const done = advanceAnimation(animator, dt, { moving, running });
        const finished = done?.target ? finishInteraction(state, done.target) : null;
        if (finished) {
          ui.hud.notify(describeFinish(finished));
          ui.hud.update();
          // A craft whose last check failed changed nothing, so there is nothing to save.
          if (finished.ok !== false) save(session, ui, true);
        }
```

Update the file header's second sentence to include "crafted tools".

- [ ] **Step 7: Run tests and format**

Run: `npm run format && npm test && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 8: Check it in the browser**

Start the `wildhaven` launch config (from this worktree's `.claude/launch.json`) and open `http://127.0.0.1:<port>` (Vite moves to another port if 5173 is taken; use the port it reports). For each character, start a new game and check:
- Survivor: item box shows an Iron slot; tools row shows three faded chips. Walk into the jungle: beside a tree the E button is faded "Chop jungle tree — needs an axe", and E shows "You need an axe. Make one in the Build menu (B)." Open Build (B): Tools group lists Stone axe / Stone pickaxe / Stone hammer with red costs when short. Gather driftwood and beach stones until 3 wood + 2 stone, press B then 2: "Crafting stone axe… move to stop", then "Stone axe made"; the axe chip shows 25. Chop a tree (5 s): "+3 wood · Jungle tree", chip shows 24.
- Scout: axe chip shows 25 at the start; the Pinefall pine says "Chop pine tree".
- Builder: hammer chip shows 10.
- Moving during a craft cancels it and nothing is spent.
- At about 390 px wide (`resize_window` mobile preset), the tools row, item box and Build menu fit; reset with the desktop preset.
- `read_console_messages` with `onlyErrors`: none.

- [ ] **Step 9: Commit**

```bash
git add src/ui/layout.js src/style.css src/ui/hud.js src/core/build.js src/core/input.js src/core/loop.js
git commit -m "Show tools and iron in the item box and craft tools from the Build menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Draw chopped trees and mined rocks

**Files:**
- Modify: `src/render/renderer.js`

**Interfaces:**
- Consumes: `NODES` with `inScenery` (Task 3); `isAvailable` (already imported); `chooseInteraction` (already imported); `glowOf(entry)` (existing: needs `{sprite, glow}`).
- Produces: no new exports. Trees and rocks fade out when gathered, stay hidden while gone, fade back in when they regrow, and glow with an E cap (or progress bar) like supplies.

- [ ] **Step 1: Add the lookup and the per-chunk lists**

Inside `createRenderer`, next to `const chunks = new Map(), fires = new Map();`, add:

```js
  // Trees and rocks a tool can harvest: `sceneryNodes` maps a node id to its node; `harvest` maps
  // it to its drawn entry ({node, sprite, glow, top}), and `harvestChunks` lists the entries in
  // each scenery chunk, so draw() only fades the ones on screen. `litTree` is the one glowing now.
  const sceneryNodes = new Map(NODES.filter((n) => n.inScenery).map((n) => [n.id, n])),
    harvest = new Map(),
    harvestChunks = new Map();
  let litTree = null;
```

- [ ] **Step 2: Record each tree and rock as its scenery image is made**

Replace the scenery loop in `create()`:

```js
        // Standing objects sort by their ground line, so the character can walk behind a tree or in front of it.
        // Harvestable wild patches (flowers, driftwood) are skipped here; they are drawn with the supplies below.
        // Trees and rocks stay here, chunk by chunk, but each also gets an entry in `harvest`, so
        // draw() can fade it out when it is chopped or mined and light it up when E would gather it.
        for (const object of map.getObjectLayer('objects').objects) {
          const spec = objectSpecs[object.name];
          if (!spec || WILD[object.name] || !this.textures.exists(`object-${object.name}`))
            continue;
          const image = this.add
            .image(object.x, object.y, `object-${object.name}`)
            .setOrigin(...spec.origin)
            .setScale(spec.scale ?? 1)
            .setDepth(spec.flat ? -1 : object.y)
            .setVisible(false);
          const key = `${Math.floor(object.x / CHUNK)},${Math.floor(object.y / CHUNK)}`;
          if (!chunks.has(key)) chunks.set(key, []);
          chunks.get(key).push(image);

          const node = sceneryNodes.get(`${object.name}-${object.x}-${object.y}`);
          if (!node) continue;
          const entry = {
            node,
            sprite: image,
            glow: null,
            top: Math.max(node.y - image.displayHeight * image.originY, node.y - 150),
          };
          harvest.set(node.id, entry);
          if (!harvestChunks.has(key)) harvestChunks.set(key, []);
          harvestChunks.get(key).push(entry);
        }
        // Every tree and rock node should have found its picture; if not, the ids drifted apart.
        console.assert(harvest.size === sceneryNodes.size, 'tree and rock nodes without a picture');
```

- [ ] **Step 3: Note which chunks just came into view**

In `draw()`, replace the chunk show/hide lines:

```js
    // Chunks that just came into view; their trees and rocks jump to how they are now (see below).
    const appeared = new Set([...next].filter((key) => !shown.has(key)));
    for (const key of shown)
      if (!next.has(key)) for (const image of chunks.get(key)) image.setVisible(false);
    for (const key of appeared) for (const image of chunks.get(key)) image.setVisible(true);
    shown = next;
```

- [ ] **Step 4: Fade and light trees and rocks**

In `draw()`, right after the `for (const s of supplies) { ... }` loop, add:

```js
    // Trees and rocks on screen fade out when chopped or mined, and back in when they regrow. One
    // in a chunk that just came into view jumps straight to how it is now instead of fading.
    for (const key of shown)
      for (const entry of harvestChunks.get(key) ?? []) {
        const gone = !isAvailable(state, entry.node),
          change = appeared.has(key) ? 1 : step,
          { sprite } = entry;
        sprite.setAlpha(gone ? Math.max(0, sprite.alpha - change) : Math.min(1, sprite.alpha + change));
        sprite.setVisible(sprite.alpha > 0);
      }

    // The tree or rock E would chop or mine (or the one being worked on) glows like a supply, with
    // the E cap over it or the progress bar while the work runs.
    const tree = harvest.get(busy ?? aimed) ?? null;
    if (litTree && litTree !== tree && litTree.glow) litTree.glow.active = false;
    litTree = tree && isAvailable(state, tree.node) ? tree : null;
    if (litTree) {
      const glow = glowOf(litTree);
      if (glow) glow.active = true;
      if (busy) working = litTree;
      else capped = litTree;
    }
```

Update `glowOf`'s `@param` to "One entry of `supplies` or `harvest`."

- [ ] **Step 5: Run tests, build and format**

Run: `npm run format && npm test && npm run build`
Expected: all pass.

- [ ] **Step 6: Check it in the browser**

With the `wildhaven` preview open at `127.0.0.1`:
- `read_console_messages`: no "tree and rock nodes without a picture" assertion and no errors.
- As the Scout, walk to a pine: it glows with an E cap; press E: the progress bar fills for 5 s, the tree fades out, "+2 wood · Pine tree", and the player can walk through its spot.
- Walk far away and back: the chopped tree stays gone (no fade flash).
- Try to place a campfire on the chopped spot: "Something is in the way".
- With a stone pickaxe, mine a boulder and a cliff rock in Stonewater Canyons: stone, then "+1 iron · Iron-streaked rock".
- Take a screenshot of a glowing tree with its E cap as proof.

- [ ] **Step 7: Commit**

```bash
git add src/render/renderer.js
git commit -m "Fade chopped trees and mined rocks, and light the one E would gather

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs and the full check

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/gdd.md`
- Modify: `docs/verification.md`

- [ ] **Step 1: Update `CLAUDE.md`**

Read the current file first (it is the archipelago branch's version). Make these changes:
- **Project Overview:** after the M2 sentence, add: "**Tools and crafting are implemented** (`docs/superpowers/specs/2026-11-19-tools-crafting-design.md`): every tree and rock in the map can be chopped (axe) or mined (pickaxe); stone tools (wood + stone, crafted anywhere, wear out) and iron tools (wood + stone + iron, forged with a hammer beside one of the player's campfires, last forever) are crafted from the Build menu." Remove "gathering tools" from the list of M3 features that are not implemented.
- **Architecture table:** add `tools.js` to `src/data/` ("`TOOLS`, `TOOL_IDS`, `TIERS`, `toolInfo`"), add `HARVEST` to the `supplies.js` description, add `tools.js` to `src/world/` ("`toolTier`, `hasTool`, `startingTools`, `wearTool`"), mention `nodesNear`/`isSceneryNode` under `nodes.js` and `obstaclesAt` and the `skip` argument under `map.js`, and add `craft.js` to `src/actions/` ("`canCraft`, `beginCraft`, `finishCraft`, `nextTier`"). Under `hud.js`, mention the tools row, the Tools group and `describeFinish`.
- **Input paragraph:** "2, 3 and 4 craft the axe, pickaxe and hammer while the build menu is open". E: "...then opens a camp, and last of all says which tool a tree or rock in reach needs."
- **Frame loop step 4:** "When a timed action finishes, call `finishInteraction(state, target)`: a gather (which wears a stone tool), a repair, or a `craft:<tool>` action."
- **Save model:** `version: 6`; "Version 6 added `tools` (`{axe|pickaxe|hammer: {tier: 'stone', uses} | {tier: 'iron'}}`) and the `iron` resource. Version 5 saves are upgraded (`addTools`: iron 0, the character's kit tools)." Add: "`restoreGame` drops `regrowAt` timers that have run out, and ignores trees and rocks when checking the player's spot." Add "every craft" to the list of things that save.
- **Game Rules That Affect Code:** resources are `wood`, `stone`, `food`, `herbs`, `iron`; iron comes only from iron-streaked rocks (`cliff-rock`, `ice-rock`). Add a **Tools** bullet: recipes and uses (copy the table from the spec), "owning a tool is enough", "`gatherTime` is 6 s by hand, 5 s with a stone tool, 3 s with an iron tool", "a chopped tree or mined rock is walk-through until it regrows after `HARVEST_REGROW` (1,080 s), but a campfire may never stand on its spot". Change the `GATHER_SECONDS` bullet: tools now shorten tool gathers; bare-hand gathers keep 6 s.
- **Character Sprites:** "Idle, walk, run, gather, build and craft are used in play (craft for crafting tools). Fight and swim exist only in the preview dialog."

- [ ] **Step 2: Update `docs/gdd.md`**

Mark gathering tools **[Built 2026-11-19]** where they are listed as planned (search for "gather tools", "gathering tools" and "[M3]"), describe the tool ladder in the gathering section, note that the Scout's hatchet and the Builder's hammer are now real stone tools (the "Kit tools are not equip mechanics" line), and add iron to the resources list.

- [ ] **Step 3: Add browser notes to `docs/verification.md`**

Add a "Tools and crafting (2026-11-19)" section listing what Tasks 7 and 8 checked in the browser and the results.

- [ ] **Step 4: Full check**

Run: `npm run format && npm run format:check && npm test && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/gdd.md docs/verification.md docs/superpowers/specs/2026-11-19-tools-crafting-design.md docs/superpowers/plans/2026-11-19-tools-crafting.md
git commit -m "Document tools and crafting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
