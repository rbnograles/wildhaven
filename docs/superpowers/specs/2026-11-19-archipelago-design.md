# Archipelago Design (slice 1 of 4: island home and a small boat)

**Date:** 2026-11-19 · **Status:** slice A1 built on branch worktree-archipelago-a1

## Vision

The full game is an **archipelago**: about nine continents and many small islands, with open sea between them. The seven-region map built in the big world update is **one** of those continents, the home continent all three characters start on. The others are locked until the player has a boat good enough to reach them.

The reference map the user shared (an illustrated archipelago with a snowy north-west island, a volcanic north-east island, forest islands in the middle, a castle island in the west, a large south-east continent with desert, mountains, forest and a lake, and a desert island in the south-west) is a **mood board only**: layout, scale and biome mix. All art stays our own.

Decisions made in brainstorming:

| Topic | Decision |
| --- | --- |
| How other continents unlock | Build or repair boats |
| How sailing works | Free sailing on the open sea: the player steers the boat |
| What keeps far continents locked | Boat tiers: a small boat for coastal water, a bigger ship for the open sea |
| First step | Slice 1: make the home continent an island and add a small boat |
| How the island gets its sea | Grow the map with a sea border and shift every coordinate (not carving the coast inward, not drawing sea outside the map) |
| How the player gets the first boat | Repair one of several old boats found on the coast |

## The four slices

Each gets its own spec, plan and implementation.

1. **Island home and a small boat (this spec).** Sea around the home continent, deep water as the edge, driftwood, repairable old boats, coastal sailing, three reachable islets.
2. **The ship and the open sea.** Repair the big shipwreck on the Driftwood Lagoon shore into a ship that can cross deep water.
3. **A second continent.** Its own map file, loaded one continent at a time as the ship nears it (for example the volcanic island, with a new lava biome).
4. **Archipelago world map.** The world map zooms out to the whole archipelago; continents not yet visited stay hidden under fog.

This list is ordered within itself. How it interleaves with big-world builds 2 to 4 and the M2/M3 milestones is an open question in `docs/gdd.md`.

## Slice 1: what the player does

### The island

- The home continent is surrounded by sea. The coastline wobbles like the region borders, with a sand beach along it.
- Water more than **1,200 units from land** is **deep water**, drawn darker. The small boat can't enter it; bumping into it shows the toast *"Too rough for a small boat."* Deep water is the edge of the world in this slice and the thing the ship opens in slice 2.
- Rivers stay as they are. A boat can sail up a river until the first ford or bridge, because fords and bridges are dry ground.

### Driftwood

Wood today comes only from three one-time supplies and the starting kits, so there isn't enough for a boat. **Driftwood** is a new regrowing wild patch kind, like the flowers: scattered on sea beaches, it gives **1 wood** and grows back after **180 game-seconds**.

### Old boats

- Four **old boats** lie on the coast: north (near the Scout's start in Pinefall Woods), west (Stonewater Canyons), south (Emerald Jungle) and east (Driftwood Lagoon, near the Survivor's shipwreck).
- An old boat is **found** within 200 units, like a landmark. Found boats are marked on the minimap and the world map. Once the starting goals are done, a found old boat and no boat of your own turn the goals card into the repair list: "Wood n / 6" and "Stone n / 2".
- Repairing costs **6 wood + 2 stone**. It is a timed action using the `build` clip, started with E like a gather. A movement press cancels it and nothing is spent; the cost is taken only when it finishes.
- Each character owns at most **one boat**. Once a boat is repaired, the other old boats are scenery: no E prompt.

With today's supplies:

| Character | Wood | Stone | Still needs |
| --- | --- | --- | --- |
| Survivor | 2 kit + 4 coast-wood = 6 | 2 coast-stone | nothing: the two beach supplies are enough |
| Scout | 3 pine-wood | 2 camp-stone | 3 driftwood |
| Builder | 5 kit + 3 village-wood = 8 | 2 kit + 3 village-stone = 5 | nothing; walk to the coast |

### Sailing

- **Board:** stand within `BOARD_RANGE` (160 units) of your boat and press E ("Board"). The boat floats a little off the sand, so this is wider than the 95-unit gather reach. The player moves into the boat.
- **Steer:** the same movement keys. The boat moves at **210 units/s**, **300** with Shift. Collision is checked per axis like walking, so the boat slides along a shore.
- **Land:** press E ("Step ashore") when walkable ground is within `LAND_RANGE` (160 units). The player steps onto the nearest walkable point; the boat stays moored where it is.
- A boat floats where the sea covers at least half a spot (walking stops at 0.35), so it stays just off the beach.
- Gathering is on foot only. Discovery works while sailing: regions, landmarks, signposts and old boats are found from the boat.
- **Signpost travel** leaves the boat where it is, moored or with the player just taken out of it. The player walks back to it.

### The reward

The three islets in the Driftwood Lagoon, scenery until now, become reachable by boat. Each gets **one new landmark** in the lagoon region, so the lagoon has 10 places and the world 52. Completing the lagoon now needs a boat.

## Slice 1: how it is built

### Map (`tools/build-map.py`, `places.json`)

- `PAD = 2048` (32 tiles). The map grows from 384×256 to **448×320 tiles** (28,672×20,480 units). The old land sits at an offset of (2048, 2048).
- **Every coordinate in `places.json` shifts by +2048** on both axes, along with `ISLANDS`, `RIVERS`, `FORDS`, `BRIDGES` and the other hardcoded positions in `build-map.py`. Landmark buildings placed relative to the spawns move with them.
- **Coastline:** land extends a sine-wobbled distance past the old edge (between about −300 and +500 units), so the coast is never a straight line, with a sand beach band on the shore. The existing east lagoon coast (`coast(y)`) joins the new ring.
- **Deep water:** a new tile layer `deep`, ranked above `water`, using the same corner-mask blending. A corner is deep when it is more than 1,200 units from land. Its texture is a darker stand-in derived from `water.png`.
- **Region grid:** sea cells take the nearest edge region (the clamp in `region_key` already does this), so the HUD shows "Sunscar Desert" while sailing off the desert. No new region; every tile is still in exactly one.
- **Scatter seeds** use the old grid-square coordinates (shifted back by `PAD`), so existing scenery doesn't reshuffle.
- **`places.json`** gets a new list `wrecks`: `id`, `region`, `x`/`y` (a walkable beach point where the old boat lies) and `launch` (a sailable water point where the repaired boat floats). Wreck points join `POINTS`, so water within 130 units of them is turned to sand like any listed place. `launch` therefore sits 200–250 units out from the wreck, past that dry circle, close enough that the shore between them is within boarding reach.
- The three islet landmarks are added to `landmarks`. Each islet becomes walkable sand with room for its landmark.
- **Size:** about 46% more tiles, nearly all water. If `wildhaven.json` passes about 4 MB, store layers run-length encoded (already planned in the big world spec).

### Pure modules (run in Node)

- `src/data/places.js`: exports `WRECKS`.
- `src/data/supplies.js`: `WILD.driftwood` (`type: 'wood'`, `amount: 1`, `verb: 'Pick up'`, `clip: 'gather'`, `regrow: 180`).
- `src/data/balance.js`: `BOAT_SPEED = 210`, `BOAT_FAST_SPEED = 300`, `BOARD_RANGE = 160`, `LAND_RANGE = 160`, `REPAIR_COST = { wood: 6, stone: 2 }`, `REPAIR_SECONDS = 8` (a little longer than a 6 s gather, because it is a bigger job), `WRECK_RADIUS = 200`.
- `src/world/map.js`: `isSailable(x, y)`: water by the corner-mask test, not deep, inside the margin, and not inside an object footprint.
- `src/actions/boat.js`: `nearbyWreck`, `beginRepair` / `finishRepair` (spends the cost once, sets `state.boat` at the wreck's `launch`), `canBoard` / `board`, `landingSpot` / `disembark`.
- `src/actions/interact.js`: `chooseInteraction(state)` returns what E does now, in priority order: **Land** (aboard and land in reach) → **Board** (own boat in reach) → **Repair** (unrepaired wreck in reach, no boat yet) → **Gather** (`nearbyNode`). The E key and the HUD interact button both use it.
- `src/actions/move.js`: when `state.aboard`, `movePlayer` uses `isSailable` and the boat speeds, keeps the boat's position equal to the player's, and reports a deep-water bump so the HUD can show the toast.
- `src/actions/discover.js`: finds old boats within `WRECK_RADIUS` into `state.wrecks`.

### Saves (version 4)

- New fields: `wrecks` (found old-boat ids), `boat` (`null` or `{ from, x, y, dir }`, where `from` is the wreck it was repaired from) and `aboard` (boolean). `createGame` and `restoreGame` both handle them.
- **Migration from version 3:** add 2048 to the player's `x` and `y`; `wrecks: []`, `boat: null`, `aboard: false`. Supplies, regions, landmarks and signposts are kept: their ids don't change. A wild patch's id ends in its position (`flowers-<x>-<y>`), and scatter seeds keep every patch in place on the land, so each `regrowAt` id is shifted by 2048 too and its timer survives. A player whose shifted spot is now sea (they stood where the new coast cuts in) goes back to their character's spawn, keeping their progress.
- **Safety:** if the saved boat position is no longer sailable (the map changed), the boat goes back to its wreck's `launch` point; if the player was aboard, they are put ashore at that wreck instead.
- Version 2 and older still take the "could not be read, start fresh" path.
- **Clash with M2:** `specs/2026-11-19-m2-loop-proof-design.md` (also designed on 2026-11-19, also not built) claims version 4 too, and adds a fog grid whose size follows the map. Whichever of the two is built second takes the next version number and migrates from the other's version. If M2 is built first, A1's migration also shifts the fog grid by `PAD` and adds unrevealed sea cells around it. If A1 is built first, M2 sizes its fog grid to the grown map.

### Rendering and UI

- `renderer.js`: old boats drawn from `WRECKS` with the supply glow, E cap and progress bar; the repaired boat drawn at its position; the player drawn in the boat (the idle frame for the facing direction, the boat sprite drawn over its lower half) with a gentle bob that `prefers-reduced-motion` turns off; the `deep` layer; markers for found old boats and the player's boat on the minimap and world map.
- `hud.js`: the interact button's label follows `chooseInteraction` ("Board the boat", "Step ashore", "Repair the old boat", the node's verb); when the backpack is short it reads "Repair the old boat · need 3 wood", and pressing E says the same in a toast. Toasts: "Found <old boat name>", "Boat repaired", "Too rough for a small boat".
- `core/input.js`: E calls the interaction chosen by `chooseInteraction`.
- Layout still works at about 390 px wide; touch players use the interact button.

### Art

Stand-ins from `tools/make-biome-standins.py`, each with a `.prompt.txt` for the real version: `deep.png` (deep water texture), an old broken rowboat, the repaired rowboat (side view, mirrored for west), and a driftwood patch. Rowboat and driftwood entries are added to `objects.json` (the old boat with a footprint; driftwood without one, like flowers).

## Tests (Node)

- **`tests/actions/boat.test.js`:** repair is refused with too little wood or stone and when a boat is already owned; the cost is spent exactly once; boarding only within reach of your own boat; the boat moves only on sailable water and is stopped by land and deep water; landing only with walkable ground in reach, onto a walkable point.
- **`tests/actions/interact.test.js`:** the Land → Board → Repair → Gather priority.
- **`tests/game/saves.test.js`** (or `state.test.js`): version 4 round trip; version 3 migration shifts the player by 2048 and keeps found ids; an unsailable boat returns to its `launch`; unknown wreck ids are rejected.
- **`tests/world/places.test.js`:** every wreck point is walkable and reachable on foot from a spawn, and its `launch` is sailable; each islet landmark is reachable by boat from at least one wreck's `launch` without crossing deep water; 52 landmarks.
- **`tests/world/regions.test.js`:** every tile of the larger map still belongs to a region.
- Existing tests are updated for the shifted coordinates and the new landmark count.

## Verification (browser)

From the `wildhaven` launch config at `127.0.0.1`, for each character: find an old boat, gather driftwood, repair the boat, board it, sail to an islet and find its landmark, bump into deep water, land, reload and confirm the boat and the player are where they were left. Also load a version 3 save and confirm the player is in the same spot on the shifted map, check the minimap and world map markers, check the page at about 390 px wide, check the console, and note the frame rate while sailing. Record notable checks in `docs/verification.md`.

## Out of scope for slice 1

The ship and open-sea sailing, other continents, per-continent loading, the archipelago world map and its fog, swimming, fishing, boat damage or sinking, a boat that follows signpost travel, and real (generated) art for the stand-ins.

## Docs to update

- **Now:** `docs/gdd.md` records the archipelago as [Planned], removes "oceans and sailing" from the non-goals, and adds the ordering question.
- **When slice 1 is built:** `CLAUDE.md` (map size, `PAD`, the `deep` layer, `wrecks`, save version 4 and its migration, the new actions), `docs/gdd.md` (mark slice 1 [Built]), `docs/art-direction.md` (new stand-ins).
