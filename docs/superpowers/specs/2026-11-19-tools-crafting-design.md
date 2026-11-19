# Tools and Crafting Design (axe, pickaxe, hammer)

**Date:** 2026-11-19 · **Status:** design approved in chat; spec awaiting review

## Vision

Every tree in the world can be chopped and every rock can be mined, but only with the right tool. The player crafts tools from the Build menu by combining wood, stone and iron. Stone tools come first and wear out; iron tools come later, are faster and last forever. The hammer is the maker's tool: it is needed to forge iron tools, and later to build anything bigger than a campfire and to repair boats.

This is the "gathering tools" piece of M3 in `docs/superpowers/specs/2026-11-19-survival-settlement-design.md`, pulled forward. Shelter, stockpile, farm, settlers and wolves stay out of scope.

Decisions made in brainstorming:

| Topic | Decision |
| --- | --- |
| Iron and tiers | Stone tools first (wood + stone). A stone pickaxe mines iron. Iron tools (wood + stone + iron) come second. |
| What the hammer does | Needed to craft iron tools; later needed for bigger buildings and boat repair |
| Durability | Stone tools wear out after a number of uses; iron tools last forever |
| Where to craft | Stone tools anywhere; iron tools only beside one of the player's campfires (the fire is the forge) |
| A chopped tree or mined rock | Fades out, can be walked through, and grows back after about 3 in-game days |
| How map scenery becomes gatherable | Map trees and rocks become nodes, like wildflower patches (no map rebuild) |

## The progression ladder

```
bare hands ──► loose wood and stone (scrap timber, driftwood, loose stones, beach stones)
           ──► stone axe, stone pickaxe, stone hammer      (crafted anywhere)
stone axe  ──► every tree in the world ──► wood
stone pickaxe ──► every rock ──► stone; iron-streaked rocks ──► iron
stone hammer + iron + a campfire ──► iron axe, iron pickaxe, iron hammer
```

Each step needs one new trip outward. Iron rocks stand almost only in Stonewater Canyons (73) and Frostpeak (70); the map scattered 5 strays elsewhere. So the first iron tool pulls the player into a region they may not have visited yet.

**Bare-hand wood and stone always exist somewhere.** The fixed supplies `village-wood` (scrap timber), `coast-wood` (driftwood) and the three loose-stone supplies stay gatherable by hand, and so do the archipelago's driftwood patches on every sea beach (1 wood each, back after 180 game-seconds). A player whose stone axe breaks with no wood left is never locked out. They only have to walk.

### Character kits become real

The selection screen already lists a kit for each character. Two of them now give a real tool at the start:

| Character | Kit text | Starting tool |
| --- | --- | --- |
| Frontier Scout | Hatchet · Field pack · 3 food | Stone axe (full uses) |
| Wandering Builder | Hammer · Work gloves · 5 wood | Stone hammer (full uses) |
| Shipwreck Survivor | Salvaged satchel · Rope · 4 food | None (starts beside driftwood and beach stones) |

## Tools and recipes

There are three tools (`axe`, `pickaxe`, `hammer`) in two tiers (`stone`, `iron`). All numbers live in `src/data/balance.js`.

| Tool | Cost | Where | Uses |
| --- | --- | --- | --- |
| Stone axe | 3 wood + 2 stone | anywhere | 25 |
| Stone pickaxe | 3 wood + 3 stone | anywhere | 25 |
| Stone hammer | 2 wood + 3 stone | anywhere | 10 |
| Iron axe | 2 wood + 1 stone + 3 iron | beside one of your fires, with a hammer | forever |
| Iron pickaxe | 2 wood + 1 stone + 4 iron | beside one of your fires, with a hammer | forever |
| Iron hammer | 2 wood + 1 stone + 3 iron | beside one of your fires, with a hammer | forever |

- "Beside one of your fires" means inside a camp fire's warmth (`byFire` in `src/world/camps.js`).
- "With a hammer" means owning a stone or iron hammer. Crafting an iron tool uses one use of a stone hammer. An iron hammer is never used up.
- The player holds at most one of each tool. Crafting the iron tier replaces the stone tier of the same tool. A stone tool can't be crafted while the player owns that tool at either tier; once a stone tool breaks, it can be crafted again.
- The player never chooses which tool to use: owning it is enough, and the iron tier is used whenever it is owned.

### Wear

- A stone axe or stone pickaxe loses one use each time a gather it was needed for **finishes**. A cancelled gather costs nothing.
- When the last use is spent, the gather still pays out, then the tool breaks and is removed. Toast: *"Your stone axe broke."*
- When a tool reaches 3 uses left, toast: *"Stone axe: 3 uses left."*
- A stone hammer loses one use each time an iron tool is crafted with it.

## Gathering with tools

### Which scenery becomes gatherable

A new table in `src/data/supplies.js`, `HARVEST`, names the map sprites a tool can harvest. It works like `WILD`: each map object of that name becomes a node with id `<name>-<x>-<y>`. Unlike wild patches, these nodes have a `tool` and keep their solid base while standing.

| Sprite | In the map | Tool | Gives | Label |
| --- | --- | --- | --- | --- |
| `pine`, `snowy-pine`, `palm`, `oak` | 248, 149, 310, 135 | axe | 2 wood | Pine tree, Snowy pine, Palm tree, Oak tree |
| `pines`, `big-oak`, `jungle-tree` | 206, 336, 523 | axe | 3 wood | Pine cluster, Big oak, Jungle tree |
| `rocks-a`, `rocks-b`, `beach-rock` | 184, 69, 40 | pickaxe | 2 stone | Rocks, Rocks, Beach rock |
| `boulder` | 232 | pickaxe | 3 stone | Boulder |
| `cliff-rock` (73 in Stonewater Canyons), `ice-rock` (70 in Frostpeak) | 76, 72 | pickaxe | 1 iron | Iron-streaked rock |

- Trees use the verb *Chop*, rocks *Mine*. Both play the `build` clip (the overhead swing) until chop and mine animations exist.
- Every `HARVEST` node grows back `HARVEST_REGROW` = 1,080 game-seconds (3 in-game days) after it is gathered.
- `cactus` and `dead-bush` are not wood and stay plain scenery.
- The fixed supply `pine-wood` (the Pinefall pine tree) is a tree, so it now needs an axe too. The Scout starts with one.
- No new map art is needed. Iron rocks reuse the existing `cliff-rock` and `ice-rock` sprites; rust-streaked art can replace them later.

### Gather time

`gatherTime(state, node)` already exists for this. Bare-hand nodes stay at `GATHER_SECONDS` = 6 s. A node that needs a tool takes `TOOL_SECONDS[tier]`: 5 s with a stone tool, 3 s with an iron tool. Tools do not change bare-hand gathers.

### Prompts when the tool is missing

- `nearbyNode` returns only nodes the player can gather now, so a gatherable node always wins over a locked one.
- E keeps the archipelago's order (step ashore, board, repair, gather), then opens a camp beside one of the player's fires. A locked node comes last of all, so a tree beside a fire never hides "Open <camp>".
- A new `lockedNode(state)` returns the nearest node in reach that needs a tool the player lacks. When nothing above applies but there is a locked node:
  - the interact button shows faded: *"Chop pine tree — needs an axe"*;
  - the node gets no glow and no E cap;
  - pressing E shows the toast *"You need an axe. Make one in the Build menu (B)."*

### Collision of chopped trees and mined rocks

- A gone `HARVEST` node's footprint stops being solid until it grows back. The map's obstacle grid (`hitsObstacle` in `src/world/map.js`) keeps the id of each object's box, and the walkability check takes a way to skip the boxes of gone nodes.
- A tree that grows back where the player stands does not trap them: `movePlayer` already ignores a base the player is inside, and the same rule covers regrown scenery.
- **Campfire placement treats every tree and rock footprint as taken, chopped or not**, so a tree never grows back inside a fire. Clearing land to build on is a later feature.
- `NODE_CLEARANCE` (no node within 80 units of a new fire) keeps applying to fixed supplies and flower patches only. Trees and rocks are kept off the fire's base by their footprints, as they are today, so a fire can still go in a forest clearing.

### Drawing

`HARVEST` sprites stay in the renderer's chunk-culled scenery. They are not moved into the per-node sprite list as flowers are, because there are about 2,600 of them. The renderer finds the scenery image of a gone node by its id, fades it out when gathered, hides it while gone, and fades it back in when it regrows. The glow and E cap work on the one in reach as they do for supplies.

### Finding nodes quickly

There are about 2,600 more nodes. `nearbyNode` and `lockedNode` look only at nodes in the player's 256-unit grid square and its neighbours, using the same bucket idea as `hitsObstacle`.

## Crafting in the Build menu

- The Build menu gets a **Tools** group under Campfire, with one entry each for Axe, Pickaxe and Hammer. Each entry shows the **next tier the player can make** and its cost:
  - no tool, or the stone tool broke: the stone recipe;
  - the stone tool is owned: the iron recipe;
  - the iron tool is owned: the entry says *Owned* and can't be picked.
- While the menu is open, keys **2**, **3** and **4** pick Axe, Pickaxe and Hammer (1 stays Campfire).
- An entry the player can't craft yet is faded but can still be picked, and the toast says why. Examples: *"Needs 3 iron · found in Stonewater Canyons and Frostpeak rocks"*, *"Craft iron tools beside your campfire"*, *"Needs a hammer"*.
- Picking a craftable entry closes the menu and starts a timed action of `CRAFT_SECONDS` = 3 s, using the existing `craft` clip. The interact button reads *"Crafting stone axe… move to stop"*. Moving cancels it, and nothing is spent.
- **The craft is atomic.** When the action finishes, `finishCraft` checks every rule again (cost, place, hammer, not already owned), then takes the materials, wears the hammer and adds the tool, all in one step. If a check fails, nothing changes and the toast says why.
- The action target is `craft:<tool>` (gathers target a node id), so the frame loop knows to call `finishCraft` instead of `finishGather`.
- Crafting saves the game, like every other action.

### Item box

- A new **iron** slot joins wood, stone, food and herbs.
- A small **tools row** shows the three tools: empty when not owned, a stone or iron icon when owned, and the uses left on a stone tool. Icons are simple inline SVG in `src/ui/layout.js`, like the existing item box icons.
- On phones (≤700 px) the tools row stays inside the item box above the touch arrows. The layout must still work at about 390 px wide.

## Architecture

The rules stay in pure modules that run in Node tests.

| File | Change |
| --- | --- |
| `src/data/balance.js` | `TOOL_RECIPES` (cost per tool and tier), `TOOL_USES` (stone uses per tool), `TOOL_SECONDS` (`{stone: 5, iron: 3}`), `CRAFT_SECONDS` (3), `HARVEST_REGROW` (1,080), `TOOL_WEAR_WARNING` (3) |
| `src/data/tools.js` (new) | `TOOLS`: the three tools with their labels, which node kind needs them, and their icons' names; `TIERS` |
| `src/data/supplies.js` | `HARVEST` table; `tool: 'axe'` on `pine-wood`; `RESOURCES` gains `iron` |
| `src/data/characters.js` | Each character's starting `tools` |
| `src/world/tools.js` (new) | `toolTier(state, tool)`, `hasTool`, `wearTool(state, tool)` (returns `'warn'`, `'broke'` or null) |
| `src/world/nodes.js` | `NODES` adds the `HARVEST` nodes; a bucket lookup for nodes near a point; gone `HARVEST` ids for collision |
| `src/world/map.js` | Obstacle boxes keep their object's id; `hitsObstacle` and `isWalkable` can skip the boxes of gone nodes |
| `src/actions/gather.js` | `nearbyNode` needs the tool; new `lockedNode`; `gatherTime` by tier; `finishGather` refuses a node whose tool is missing |
| `src/actions/craft.js` (new) | `canCraft(state, tool)` (next tier, or the reason it can't be made), `beginCraft`, `finishCraft` (atomic) |
| `src/actions/interact.js` | `finishInteraction` wears the tool after a gather (`{kind: 'gather', node, wear}`) and finishes `craft:<tool>` actions |
| `src/actions/move.js` | Passes the gone-node check and the "already inside" rule for regrown scenery |
| `src/actions/build.js` | Campfire placement treats all `HARVEST` footprints as taken; `NODE_CLEARANCE` only for supplies and flowers |
| `src/game/state.js` | Save version 6 (see below) |
| `src/core/build.js`, `src/core/input.js`, `src/core/loop.js` | Tools group, keys 2 to 4, finishing a craft, wear toasts |
| `src/ui/hud.js`, `src/ui/layout.js`, `src/style.css` | Tools group in the Build menu, iron slot, tools row, locked prompt, crafting label |
| `src/render/renderer.js` | Hide and fade gone `HARVEST` scenery by id; glow and E cap on harvest nodes |
| `src/animation/clips.js` | The `craft` clip is now used in play (the preview dialog note changes) |

## Save version 6

- `SAVE_VERSION` goes from 5 (the archipelago's version: the survival update plus the boat) to 6.
- `state.tools` maps a tool id to `{tier: 'stone', uses: n}` (1 ≤ n ≤ that tool's `TOOL_USES`) or `{tier: 'iron'}`. A missing key means the tool is not owned. `restoreGame` rejects unknown tool ids, unknown tiers and bad use counts.
- `state.resources.iron` is a whole number like every other resource.
- **Version 5 saves are upgraded, not reset:** `iron: 0`, and `tools` set to the character's starting kit. Version 3 and 4 saves first take their existing upgrades to version 5, then this one.
- `restoreGame` drops `regrowAt` timers that have already passed, so a save that chopped hundreds of trees doesn't grow forever. It already drops timers for ids the map no longer has.
- `restoreGame` lets the player load standing where a tree or rock grows, chopped or not (the player may have saved on a chopped tree's spot). `movePlayer` lets them walk out of a regrown one.
- `createGame`, the checks in `restoreGame` and the object it returns all gain `tools`, or the field would be silently dropped on load.

## Testing

New and changed tests, all in Node:

- `tests/actions/craft.test.js`: each recipe crafts with enough materials; short materials, wrong place (iron away from a fire), no hammer, and already owned are refused with a reason; a cancelled craft spends nothing; `finishCraft` re-checks and changes nothing if materials vanished meanwhile; iron replaces stone; a stone hammer loses a use per iron tool.
- `tests/actions/gather.test.js`: a tree can't be gathered without an axe and `lockedNode` finds it; gather time is 6, 5 and 3 s for hands, stone and iron; a finished gather wears a stone tool, a cancelled one doesn't; the last use pays out and breaks the tool; the 3-uses warning fires once.
- `tests/data/ladder.test.js` (new): for each character, every tool is reachable from the starting kit and bare-hand supplies through the recipe graph, and no recipe needs its own output or a later tier.
- `tests/actions/move.test.js` / `tests/world/map.test.js`: a chopped tree's spot is walkable; a regrown tree doesn't trap a player inside it.
- `tests/actions/build.test.js`: a campfire can't be placed on a chopped tree's spot.
- `tests/game/state.test.js`: a version 5 save upgrades with kit tools and `iron: 0`; bad `tools` data is rejected; past `regrowAt` timers are dropped; a save made on a chopped tree's spot loads.
- `tests/world/nodes.test.js`: every `HARVEST` sprite exists in `objects.json`, and harvest node ids are unique.

Browser checks (`wildhaven` launch config, at `127.0.0.1`), noted in `docs/verification.md`: play each character through crafting a stone tool, chopping and mining, breaking a stone tool, mining iron in Stonewater Canyons or Frostpeak, and crafting an iron tool at a camp; check the item box and Build menu at about 390 px wide; check the console for errors.

## Docs to update

`CLAUDE.md` (resources, tools, save version 6, keys 2 to 4, gather rules, the craft clip now in play), `docs/gdd.md` (gathering tools move from [Planned] to [Built]; kit tools are now real), `docs/verification.md`.

## Out of scope

Shelter, stockpile and other buildings that need the hammer; boat repair with the hammer; clearing land permanently; more tools (sickle, fishing rod, shovel); smelting ore into bars; chop, mine and tree-fall animations (planned in `docs/design/sprite-expansion-manifest.json`); rust-streaked rock art; iron in camp needs.

## Built on the archipelago branch

The user chose to build this on top of archipelago slice 1. Branch `tools-crafting` starts from `worktree-archipelago-a1` at `fd2600e` ("Merge main (M2 survival loop) into archipelago A1"), which already holds M2 and saves as version 5. A separate session was still working on the archipelago branch at the time, so this work has its own branch and worktree (`.claude/worktrees/tools-crafting`) instead of sharing that one. Any later archipelago commits are merged into `tools-crafting` before it merges back.
