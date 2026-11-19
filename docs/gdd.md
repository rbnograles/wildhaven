# Wildhaven — Game Design Document

**Team:** Solo hobby project [inferred: from the "hobby, no monetization" answer and a single-user local workspace]
**Platform:** Desktop web browser, keyboard and mouse
**Genre:** Top-down survival-settlement adventure (cozy survival)
**Target Session:** 15-30 min [inferred from the ~6 min day/night cycle; confirmed in /game-review Phase 0]
**Monetization:** None (hobby project)
**Last Updated:** 2026-11-19
**Imported by:** /game-import from `docs/superpowers/specs/2026-11-19-survival-settlement-design.md`, `README.md`, `docs/superpowers/plans/*.md`, the game source, plus answers given in the import session
**Reviewed by:** /game-review 2026-11-19, Mode B (PC/Console). GDD Health 4.4 → 6.7/10 (SOLID) after the decisions below were written in

**Tags used below**
- **[Built]** is in the current build and can be played now.
- **[Planned]** is in the survival-settlement spec and is not implemented. Do not describe it as existing.
- **[M2]** / **[M3]** is planned work assigned to that milestone by the 2026-11-19 review (see section 8). Not implemented.
- **[Answer]** came from the 2026-11-19 /game-import session.
- **[Review]** is a design decision made in the 2026-11-19 /game-review session.

---

## 1. Overview & Core Concept

**Status:** ✅

**Intent** [moved from spec "Intent and agreed direction"]
The user wants an open-world exploration game with cities built across the world. They selected a survival settlement adventure and a top-down view: guide a character from above with a clear view of the settlement.

**What exists today** [Built, from README]
A playable browser exploration prototype with three starting characters and one shared illustrated world. The current milestone is "open browser → choose character → load and explore the game".

**Audience** [Answer]
Cozy survival players. They want gentle pressure and a home to build; death is rare and recoverable. Closest reference: Stardew Valley crossed with a softened Don't Starve. The spec's tuning already points here: "manageable survival pressure", wolves that "stay away from the starting area, warn before attacking, and retreat from lit campfires", and "No graphic violence".

**Design pillars** [Review: inferred from the import answers and the spec, confirmed by the designer]
1. **The world is the reward.** Discovery is the target feeling. Anything that reveals the world for free works against this.
2. **Gentle pressure, recoverable failure.** Danger warns first, failure costs time rather than progress, and stored work is never taken.
3. **From camp to settlement.** Each camp is a foothold; the long arc is settlements spreading across the world.

**Platform** [moved from spec "Playable scope" and "Approaches"]
Single-player, desktop browser, keyboard and mouse. Browser delivery was the spec's proposed builder choice ("immediate local play, quick iteration") and is what got built. No accounts or servers.

**Starting characters** [Built]
All three share one world and start at different places. Each has its own save.

| Character | Starts at | Starting resources (wood/stone/food) | Kit (visual only) | Tagline |
| --- | --- | --- | --- | --- |
| The Frontier Scout | Pinefall Woods (north) | 0 / 0 / 3 | Hatchet · Field pack | "Follow the trail. Find your home." |
| The Wandering Builder | Hollowstead Meadows, at the abandoned village (center). The character card still says "Hollowstead Village" | 5 / 2 / 2 | Hammer · Work gloves | "Where others see ruins, you see a beginning." |
| The Shipwreck Survivor | Driftwood Lagoon shore, at the shipwreck (east). The character card still says "Driftwood Coast" | 2 / 0 / 4 | Salvaged satchel · Rope | "The sea took your ship. Not your spirit." |

Two kit tools are real since the tools update [Built 2026-11-19]: the Scout's hatchet is a stone axe and the Builder's hammer a stone hammer, each with every use left. The other kit items (field pack, work gloves, satchel, rope) still only identify the character visually.

**Approval history**
- Spec: "The user has approved the genre and camera direction only."
- Later: the user approved three character types and the browser selection-to-game milestone (plan header).
- 2026-11-19 import session: audience, retention hooks, monetization and player fantasy answered (this document).
- 2026-11-19 review session: pillars, core loop, fail state, retention hooks, economy renewal, herb sinks, emotional arc, and the M2/M3 split decided (tagged [Review]).

---

## 2. Core Loop

**Status:** ✅ Loop decided in review; the distance numbers that make it bite are not set yet (see "Distance costs").

**Current loop** [Built]
1. Move (WASD/arrows) or run (Shift) along dirt paths.
2. Spot a marked supply. The nearest one within 95 units highlights and shows "E".
3. Press E: a 6 s gather animation loops (moving cancels it and awards nothing), then the resources are added.
4. Keep walking to reach the other starting regions (3 total).
5. The first objective completes when you have gathered once and discovered three regions. After that the goals card follows the region you are in: places found n / 7 (n / 10 in the lagoon) and signposts found n / 2. Free exploration continues.

The fixed supplies are finite: 9 one-time supply nodes, all near the three starting places. The other four regions (Sunscar Desert, Frostpeak, Stonewater Canyons, Emerald Jungle) have no fixed supplies yet. Wild flower patches (38) are the one renewable source: each gives 2 herbs and grows back 180 game-seconds after picking [Built 2026-11-19]. Wood and stone build campfires and mend old boats, food and herbs feed and heal, and wood, stone and iron craft tools. Iron is the fifth resource: it comes only from iron-streaked rocks (Stonewater Canyons' cliff rocks and Frostpeak's ice rocks), mined with a pickaxe [Built 2026-11-19].

**Original spec loop** [Planned, moved from spec "Experience and visual direction"]
> The character begins at the edge of a forest with a few supplies. Explore woodland, meadow, riverbank, and abandoned ruins; gather resources; choose a camp location; and build a settlement that makes subsequent journeys easier.

**Decided loop** [Review]
> Explore by day for what the camp needs → get back to a fire before dark → the camp grows and asks for something farther out → build a new camp to reach it → repeat.

Two halves, both needed:
- **Tether (limit).** Night drains warmth away from fire and shelter (spec), and a campfire gives warmth. Every new camp moves the safe zone outward. This is how "a settlement makes subsequent journeys easier".
- **Needs list (direction).** The camp asks for things that lie farther out, like Stardew Valley's community-center bundles. This is a new system, not in the original spec. [M2]

**Distance costs** [Review, design rule]
A camp's useful reach should be about half a daylight round trip. **Numbers not set.** The home continent is 24,576×16,384 units (diagonal about 29,500, about 100 s to run across); since slice A1 it sits inside a 2,048-unit sea border. The starting places are 5,100 units apart (Scout to Builder), 9,200 (Builder to Survivor) and 11,500 (Scout to Survivor) in a straight line; rivers and fords make real routes longer. With the planned 240 s of daylight, half a daylight round trip is 60 s each way, or 9,300 units walking and 14,700 running, which is roughly one starting place to the next. Daylight length, any off-path slowdown and warmth duration must be derived from measured walking routes on this map. The 2026-11-19 balance review chose 150 s, 50% and 40 s on the old 6,144×4,096 map; those are **not adopted**. [M2]

**Numbers in the build** [Built 2026-11-19, tunable in `src/data/balance.js`]: a 360 s day (dawn 20 s, day 190 s, dusk 30 s, night 120 s). Away from a fire at night, warmth lasts 60 s and then health 30 s, so a player out all night passes out 90 s after dark. There is no off-path slowdown. These are first values, not yet derived from measured routes.

**Fast travel vs the tether** [Decided 2026-11-19]: any found signpost can be travelled to from the world map (14 signposts, two per region) [Built]. **No rule:** travel stays free at any hour. The designer accepts that this weakens the walk home the tether depends on.

| Layer | Loop | Status |
| --- | --- | --- |
| Moment to moment | Move, gather (E), place a campfire (B, then mouse or E) | [Built] |
| Session (one ~6 min in-game day) | Plan at dawn → push into the fog by day → race back to a fire at dusk → night at the fire | [Built] |
| Meta | Needs list points outward → new camp → settlement tiers; "towns and cities are later stages" | Needs list [Built]; tiers [M3]; towns unscoped |

---

## 3. Progression & Retention

**Status:** ✅ D1, D7 and D30 hooks named. ❌ Churn points not analyzed (see below).

**Current objective** [Built, from `src/main.js`]
"YOUR FIRST FOOTSTEPS / A place to begin"
- Gather your first supplies
- Discover three regions (n / 3)
- Then, per region: places found n / 7 (n / 10 in the lagoon), signposts found n / 2
- On completion: "You have found your feet. Keep exploring — this is just the beginning."

**Planned objective chain** [Planned, moved from spec "Progression and failure"]
1. Learn movement and gathering
2. Build a campfire and shelter
3. Recruit a settler
4. Produce food
5. Survive three nights
6. Establish a second camp

"Objectives reflect actual world state and never block free exploration. After completion the player can continue playing."

**Retention hooks** [Answer, made concrete in Review]

| Tier | Hook | Mechanism | Milestone |
| --- | --- | --- | --- |
| D1 | Unfinished business | The camp still has an open need, a fire isn't built yet, the next camp isn't started. Saved per character | [Built] |
| D1 (daily) | Dawn ritual | Each in-game morning at camp: the needs list updates (later also settlers report and the farm yields). Runs on in-game days only, so it respects "no offline progression" and replaces the old "daily rituals" answer | Needs update [Built]; settlers/farm [M3] |
| D7 | Fog + hidden finds | 52 landmarks (seven per region, ten in the lagoon with its islets) and 14 signposts to find, with per-region and world totals [Built]. The maps fill in as you walk [Built] | [Built] |
| D30 | Settlement tiers | Camp → hamlet → village with visible changes and the name you chose ("this is MY town") | [M3] |

Gather tools are a competence hook for D7 as well [Built 2026-11-19]: bare hands gather in 6 s, a stone tool in 5 s and an iron tool in 3 s, and only an axe chops trees and only a pickaxe mines rocks. Going below 3 s (toward 0.5 s) is open.

Today there are seven regions. The starting places are 5,100 to 11,500 units apart, 21 to 47 s at a run in a straight line, so seeing all seven regions and 52 landmarks no longer fits in one short session.

**Replay** [inferred: three characters with separate saves and spawns let a player restart from a different corner of the same world]

**Failure** [Review, replaces the spec's "death screen with a restart option"]
- [Built] When health reaches zero (from cold), the player passes out and **loses the morning**: they wake at midday at the nearest campfire. With no campfire built yet, they wake at their spawn point. Settlement and stored resources are never touched (pillar 2). Daylight is the scarce thing in the tether loop, so losing it teaches range.
- [M3] With a "carried today" tally, a share of that trip's haul drops where the player fell and shows on the map, so getting it back is a trip rather than a loss.
- Restarting a run still happens only through "Start a fresh adventure", after confirmation [Built].

**Difficulty curve**
Only implied: wolves avoid the start area, and under "distance costs" farther from camp means colder nights. No sawtooth or milestone releases are written down. ⚠️

**Churn points** ⚠️ One analyzed. The first night was walked as a Casual Newcomer in /player-experience (2026-11-19, 7.1/10) and now has a first-night design (6.20). Whether a newcomer survives it still depends on unset numbers. No other churn points are analyzed. See Risk 2.

---

## 4. Economy & Monetization

**Status:** ✅

**Monetization** [Answer]
None. Hobby project. The spec also requires no external accounts or paid services.

**Resources**
`wood`, `stone`, `food`, `herbs` (herbs added 2026-11-19). Always non-negative integers; saves with any other value are rejected [Built]. Inventory is "shared globally in this prototype; local storage and trade logistics are deferred" [Planned]. No resource converts into another.

**Renewal** [Review]
Wood, stone and food nodes **regrow slowly**, over several in-game days, using the same regrow mechanism the flower patches already have [Built: 720 game-seconds, two in-game days]. Camps thin out but never die, so founding a new camp is a choice, not forced. The needs list and "distance costs" carry the outward pull. Herbs stay the fast-renewing resource (180 game-seconds).

**Faucets**

| Source | Status | Detail |
| --- | --- | --- |
| Starting kit | [Built] | See the character table in section 1 |
| 9 supply nodes | [Built], regrowing after 2 in-game days | Totals per full harvest: 10 wood, 7 stone, 7 food. Each stands solid as its own sprite while it stands |
| 38 wild flower patches, regrowing | [Built] | 2 herbs each, back 180 game-seconds after picking (the game clock pauses with the game) |
| Spec supply rule | [Planned] | "initial supplies and resource distribution must allow at least two camps and sustained food production." Met by slow regrowth [Built] |
| Settler work | [M3] | Settlers assigned to wood, stone, or farming |
| Farm | [M3] | "produces food over time when assigned a settler" |

**Supply nodes** [Built]

| Node | Region | Type | Amount |
| --- | --- | --- | --- |
| Pine tree (chop) | Pinefall Woods | wood | 3 |
| Loose stones | Pinefall Woods | stone | 2 |
| Wild berries | Pinefall Woods | food | 2 |
| Scrap timber | Hollowstead Meadows (village) | wood | 3 |
| Loose stones | Hollowstead Meadows (village) | stone | 3 |
| Wild berries | Hollowstead Meadows (village) | food | 2 |
| Wild berries | Hollowstead Meadows (south of the village) | food | 3 |
| Driftwood | Driftwood Lagoon | wood | 4 |
| Beach stones | Driftwood Lagoon | stone | 2 |

**Sinks**
- [Built] Campfire cost: **3 wood + 2 stone** (each fire founds a camp). This is the ceiling the Scout sets: they start with 0 wood and 0 stone and their home supplies hold exactly 3 wood and 2 stone. [Balance review 2026-11-19] Shelter, stockpile and farm costs [M3]. Placement "only charges on successful placement".
- [Built] Needs list: the camp asks for resources (4 wood, 3 stone, 2 food or 4 herbs, plus 1 for every 2 needs met) and for finds (see 6.17).
- [Built] Herbs: healing (**3 herbs, +30 health**, anywhere with H) and a **warming tea** (5 herbs, at a camp) that holds off the night's cold. Herbs therefore buy extra range on a trip. [Review]
- [Built] Food eaten to restore hunger: **1 food, +25 hunger** (F). Hunger was kept in M2, in its gentle form (see 6.7). [Review]
- Set in the 2026-11-19 balance review: campfire cost, tea, regrowth (see 6.18, 6.19). Set when M2 was built: needs-list amounts, hunger rate (empty after 2 in-game days), herbs per heal (3).
- **Known surplus (escalated in the balance review):** herbs come in at about 12 per day on a 6-patch route and go out at 5 per night at most, a 2.4× surplus, and resting at a fire skips the night so most nights use no tea. Chosen by the designer; expect herbs to pile up.

---

## 5. Player Motivation & Fantasy

**Status:** ✅

**Core fantasy** [Answer]
**Explore, specifically discovery.** The world itself is the reward: new regions, landmarks, resources and settlement sites. The reference is the Breath of the Wild moment of climbing a hill to see what's there, not Firewatch-style story uncovering.

**Narrative**
None planned. The character backstories (a shipwreck, an abandoned village) are flavor, not a story system. No lore, NPC dialogue or written narrative exists in any source.

**Tone signals from the sources**
- Character taglines: "Follow the trail. Find your home." / "Where others see ruins, you see a beginning." / "The sea took your ship. Not your spirit."
- Spec visuals: "a cohesive illustrated 2D presentation ... soft shadows, and a warm campfire at night".
- Plan design system: "an illustrated wilderness atlas with parchment typography and moss-green controls".

**Player types** [inferred, used in Review]
- Served: Explorer (primary: fog, hidden finds, pushing the range) and Achiever (secondary: needs list, settlement tiers, objectives).
- Not served, on purpose: Socializer (single-player; multiplayer is a non-goal) and Killer/Competitor (no PvP; "complex combat" is a non-goal).

**Emotional arc of one in-game day** [Review]
Dawn: calm, check the camp's needs and plan → Midday: push into the fog, the discovery peak (power) → Dusk: race back to a fire (vulnerable) → Night: safe at the fire (release). Power and vulnerability sit about 2-3 minutes apart and repeat every ~6 min day, close to Don't Starve's rhythm without the dread.

**Known motivation gaps** [Review, deferred]
- **Relatedness is unserved.** Settlers are labor only ("detailed citizen needs" is a non-goal), so nothing creates a bond with anyone.
- **The three characters play identically.** They differ only in spawn and starting resources. The Builder builds like everyone else and the Scout's hatchet does nothing, which works against their taglines.

Superseded: the spec said "Their broader motivation and preferred art references have not been specified." Motivation is now answered; art references remain unspecified beyond the generated assets in `docs/art-direction.md`.

---

## 6. Systems & Mechanics Detail

**Status:** ✅

### 6.1 Movement and collision [Built]
- Walk 155 units/s, run 245 units/s (hold Shift). Diagonal input is normalized.
- Frame `dt` is clamped to 0.05 s in the loop and 0.1 s inside `movePlayer`.
- Collision is checked separately on x and y, so the player slides along obstacles.
- Blocked: the 42-unit world margin, water (per-tile corner masks, water where the blend is ≥0.35), and each object's solid base (`footprint` in `objects.json`).
- World: 448×320 tiles at 64 px = 28,672×20,480 units: the 384×256-tile home continent (24,576×16,384 units, about 100 s to run across) inside a 2,048-unit sea border (slice A1). In the boat the player moves over shallow sea only; deep sea blocks it.
- Directions: 0 = south, 1 = west, 2 = east, 3 = north.

### 6.2 Gathering [Built]
- The nearest available node within 95 units can be gathered with E or the gather button. In reach, its sprite glows and an E key cap floats over it.
- Every gather is a timed action; a progress bar replaces the key cap and the clip loops for the whole time. Bare hands take 6 s (`GATHER_SECONDS`), a stone tool 5 s and an iron tool 3 s (`TOOL_SECONDS`). The 6 s base is a design decision. [Built]
- **Tools [Built 2026-11-19]** (`docs/superpowers/specs/2026-11-19-tools-crafting-design.md`). Every tree in the map (about 1,640) needs an axe and gives 2 or 3 wood; every rock (about 450) needs a pickaxe and gives 2 or 3 stone, or 1 iron from one of the 96 iron-streaked rocks. A chopped tree or mined rock can be walked through and grows back after three in-game days. Tools are crafted from the Build menu (keys 2 to 4): stone tools from wood and stone, anywhere, with 25 uses (axe, pickaxe) or 10 (hammer); iron tools from wood, stone and iron, beside one of the player's campfires and with a hammer, lasting forever. The ladder is hands, then stone tools, then iron from the canyons or Frostpeak, then iron tools at camp. Bare-hand wood and stone (scrap timber, driftwood, loose stones) always exist, so a broken axe never strands the player.
- A fresh movement press cancels the action and awards nothing. Pause and a hidden tab freeze it.
- Resources are awarded once, when the action finishes, and the sprite fades out. Supply nodes then grow back after two in-game days (6.19); flower patches, beach driftwood and small stones fade back in 180 game-seconds later. Small stones (about 670 piles all over the land, 1 stone each, bare hands) were added 2026-11-19 so a first pickaxe and campfire don't depend on the three fixed stone supplies. Wild berry bushes (about 285 in the green regions, 1 food each, bare hands) were added the same day.
- Trees are chopped with the `chop` axe swing; rocks are mined with the overhead `build` swing until a mining animation exists; other supplies use `gather`. Crafting plays the `craft` clip. Oaks, pines and `rocks-a` fall or crack apart before fading when gathered.

### 6.3 Discovery [Built]
- A region is discovered by standing in it; every spot in the world belongs to exactly one of the seven regions.
- A landmark is found within 200 units (52 landmarks: seven per region, plus one on each of the three lagoon islets). A signpost is found within 110 units (14, two per region).
- The HUD and world map show progress for the current region and for the whole world.

### 6.4 Maps and pause [Built]
- The minimap shows the area around the player. The world map (M, or click the minimap) shows the whole 7:5 world, land and sea border, under the fog of war (6.16), and marks found places, signposts, old boats, the moored boat and camps.
- Fast travel: any found signpost can be travelled to from the world map. A player who travels arrives on foot and their boat drifts back to its old boat's launch spot, so it is never stranded.
- The game pauses while the pause, map or reset dialog is open, on Escape or the pause button, and while the tab is hidden.

### 6.5 Saves [Built]
- One save per character in browser localStorage (`wildhaven.adventure.v1.<characterId>`, `version: 5`). Version 4 saves (M2, before the sea border) and version 3 saves are upgraded: positions move out by the 2,048-unit sea border and the fog is rebuilt on the bigger grid. Older saves take the start-fresh path.
- Saves on gather, repair, discovery, signpost travel, boarding, landing, camp actions, passing out, dawn, opening pause, hiding the tab, page hide, and every 10 s; manual save in the pause menu.
- A stale tab cannot overwrite a newer save. Unreadable saves show "This save could not be read. Start fresh to play."
- A refresh resumes the character being played.
- Saved: character, position, facing, resources, regrow timers, discovered regions, found landmarks, signposts and old boats, the boat and whether the player is in it, elapsed time, distance, the world clock, meters, tea, camps and fog. Animation state is never saved.

### 6.6 Animation [Built]
- In play: idle, walk and run in four directions; gather and build (used for chopping) use east-facing art, mirrored for west.
- Preview dialog only: craft, fight, swim. These must not imply working mechanics.

### 6.7 Survival meters [Built 2026-11-19]
"Health, hunger, and warmth create manageable survival pressure. Hunger falls over time; eating restores it. Night drains warmth away from fire and shelter. Critical hunger or cold reduces health, with visible feedback explaining why." [moved from spec "Playable scope"]
- Each meter runs 0-100 and shows in the HUD with a word saying why it is changing ("By the fire", "Cold", "Tea 12s", "Freezing", "Starving").
- **Warmth:** +20/s by a fire at any hour; +4/s away from a fire by day; unchanged at dusk; at night away from a fire it drains in 60 s (1.5× faster when starving), unless tea holds it.
- **Health:** drains in 30 s while freezing (no warmth, night, away from a fire); +2/s by a fire for a fed player. Health at zero → pass-out (section 3 "Failure").
- **Hunger:** empties over 720 s (two in-game days). At zero it stops healing and makes the cold harsher, but never causes a pass-out by itself (the gentle version chosen for M2).

### 6.8 Day/night [Built 2026-11-19]
"A roughly six-minute day/night cycle, with daylight lasting about four minutes. Exact balance is tunable. Pause freezes simulation and survival meters." Built as a 360 s day: dawn 20 s, day 190 s, dusk 30 s, night 120 s; a new game starts on the morning of day 1. The world darkens through dusk; each fire lights a circle as wide as its warmth.

### 6.9 Wolves [Planned]
"A simple attack or repel action protects the player from wolves. Wolves stay away from the starting area, warn before attacking, and retreat from lit campfires. No graphic violence." No damage, health or spawn numbers defined.

### 6.10 Building [Campfire built 2026-11-19; the rest Planned]
Placement shows validity and cost, rejects water, obstacles, overlapping footprints or insufficient resources, and only charges on success. [Built for the campfire: B shows a ghost that follows the mouse (or sits in front of the player), green or red with the reason in words; click or E places it within 300 units; the player names the camp.]

| Building | Function |
| --- | --- |
| Campfire | Establishes a named settlement; provides warmth (260 units, +40 per need met, up to 660) [Built] |
| Shelter | Safe resting location; capacity for settlers |
| Stockpile | Enables settlement resource collection |
| Farm | Produces food over time when assigned a settler |

### 6.11 Settlers [Planned]
Discover and recruit up to three settlers. Each belongs to one camp and works nearby on wood, stone or farming. Workers visibly move between work sites and storage. "Unreachable or depleted jobs report their status instead of producing resources invisibly."

### 6.12 Expansion [Built 2026-11-19]
A second camp can be founded "a meaningful walk from the first" (at least 3,000 units away). Camps appear on both maps (named on the world map) and can be revisited on foot.

### 6.13 World layout
- [Built] Seven regions with real borders: Sunscar Desert, Pinefall Woods, Frostpeak, Hollowstead Meadows, Driftwood Lagoon, Stonewater Canyons, Emerald Jungle. Two rivers with fords and bridges, a dry riverbed, ponds, and a lagoon with three islets, reachable by boat since slice A1. The forest campsite, the abandoned village with its workshop, and the shipwreck beach are the three starting places. The new biomes use stand-in art.
- [Built] Hills: terraced plateaus with cliff walls in the meadows, Pinefall, the canyons, the desert and Frostpeak (one to three levels; Frostpeak's are the tallest). Each level is climbed by one flight of stairs; walls and level edges block movement. Grass tufts, tall grass, dry grass, snow grass, bare dirt patches and dark forest soil break up open ground. Height has no gameplay effect yet.
- [Planned] "Traversable forest and meadow connect resource sites, a river crossing, ruins, and at least two viable settlement locations."
- [Built] The seven-region map is now an island home in a sea border, and slice A1 is built (see "Archipelago Direction").
- [Planned] It is the home continent of an archipelago of about nine continents. The others are reached by boat (see "Archipelago Direction").

### 6.14 Controls

| Action | Control | Status |
| --- | --- | --- |
| Move | WASD or arrow keys | [Built] |
| Run | Hold Shift | [Built] |
| Gather | E or the gather button | [Built] |
| Open a camp | E beside one of your fires | [Built] |
| Eat / heal | F / H | [Built] |
| World map | M or the minimap | [Built] |
| Pause | Escape or the pause button | [Built] |
| Save / return to characters | Pause menu | [Built] |
| Touch movement | On-screen buttons at narrow widths | [Built] |
| Select and place buildings | B, then the mouse (or E) | [Built for the campfire] |
| Cancel building | Escape or B | [Built] |

### 6.15 HUD layout [Planned, moved from spec "Experience and visual direction"]
```text
Health / hunger / warmth       Day and time       Resources

                  scrolling playable world
                       player + camp

Current objective        contextual action       minimap
             build toolbar when building
```
[Built 2026-11-19, rearranged after playtest feedback: objective panel top left, region name and progress top centre, journal and pause top right; along the bottom, the player card (portrait, day clock, three meters) on the left, the item box (wood, stone, food and herb slots; clicking food eats and herbs heals) with a Build button and its build menu in the middle, and a round minimap on the right. The contextual action button, controls strip and build bar sit above the item box. The Scout's camp no longer has a decorative campfire, so every fire in the world is one the player built.]

### 6.16 Fog of war [Built 2026-11-19]
The maps fill in as the player walks (the spec's "minimap that reveals explored areas"), and region names appear on the world map only once discovered. The world is cut into 256-unit squares; walking uncovers every square within 1,000 units. Unseen land is solid fog on both maps, so its shape stays hidden. Fog is per character, since each character has its own save; older saves are uncovered region by region.

### 6.17 Needs list [Built 2026-11-19]
Each camp keeps three needs. Slot 1 asks for resources (4 wood, 3 stone, 2 food or 4 herbs, plus 1 for every 2 needs met). Slot 2 asks to find a place in the nearest other region that still has one unfound. Slot 3 asks for a new signpost on odd days and resources on even days. Resources are given at the camp; finds count wherever they happen. Each met need grows the fire's warmth by 40 units (up to 10 needs). At dawn, met needs are replaced and open ones stay. Place-bound finds beyond landmarks arrive with the hidden points of interest [M3].

### 6.18 Herbs: healing and warming tea [Built 2026-11-19]
Herbs restore health and brew a tea that holds off the night's cold, extending how far a trip can go. **Tea: 5 herbs, 20 s in which warmth does not fall, brewed at a camp, one at a time (no stacking).** [Balance review 2026-11-19] **Heal: 3 herbs, +30 health, anywhere (H).**

### 6.19 Regrowth [Built 2026-11-19]
Wood, stone and food nodes regrow after **2 in-game days** (reusing the flower-patch regrow timers). [Balance review 2026-11-19] Consequence recorded with the choice: a camp's home supplies refill within a single session, so supply does not push the player outward; the needs list and the fog carry that job.

### 6.20 First night and night at the fire [Built 2026-11-19, decided in /player-experience 2026-11-19]
- **First objective.** M2's first goal on the objective panel is "Build a campfire before dark", with the place key and the cost shown. It replaces "Discover the three starting regions" as the opening goal, which pointed a new player away from camp before their first night.
- **Dusk.** The world dims, the clock shows dusk, and once warmth starts falling one line says "Getting dark, head to a fire."
- **Pass-out screen.** Explains cause and cost: "You got too cold away from a fire. You woke at your camp at midday." Play resumes at camp.
- **Night at the fire.** Three things are possible: rest, which skips to dawn and saves, with the dawn ritual playing on waking (the natural place to end a session); camp tasks, brewing tea from herbs and handling the needs list at the fire (this is where tea is taught); or waiting it out near the fire's warmth.
- **Built as:** the goals card reads "Build a campfire" with the wood and stone counts and the B key; toasts at dusk ("Dusk is falling...") and nightfall ("Getting dark, head to a fire."); the camp dialog (E at your fire) holds the needs, tea, eat, heal and "Rest until dawn" (offered from dusk). The dawn update does run during a pass-out.
- **Still open from the walkthrough:** in-game hints for WASD, Shift and Esc (a newcomer who never learns Shift walks home 58% slower); feedback when moving cancels a gather; ~18 gathers × 6 s in a first session with no speed-up until tools (tools are now built: a stone axe takes 5 s).

---

## 7. Technical Specs

**Status:** ✅

- **Runtime:** Vanilla JavaScript ES modules, no framework. Vite 7 bundles. Phaser 4 is used only as the renderer; HTML/CSS handle UI and dialogs.
- **Tests:** Node's built-in `node:test`. Game rules live in pure modules that run in Node; balance numbers are constants in one data module. (Exact file layout lives in `CLAUDE.md`; the source tree was reorganized on 2026-11-19.)
- **Input:** Owned by the game's own input code, not Phaser. Held keys are tracked in a `Set`.
- **World data:** Tiled-format `wildhaven.json`, built offline by `tools/build-map.py` (Python, numpy, Pillow). The same file drives rendering and collision.
- **Persistence:** localStorage per character plus sessionStorage for the active character. Saves are scoped to the page origin. No server, no cloud save, no offline progression.
- **Asset loading:** Image loads have timeouts and a 20 s Phaser scene timeout. Any failure ends on a retry screen, never an endless loader.
- **Layout:** The spec targets 1280×720 and up. The build also works at about 390 px wide.
- **Accessibility:** `prefers-reduced-motion` turns off camera smoothing, CSS transitions and preview autoplay [Built]. The spec also asks for readable text and contrast, placement feedback through symbols and text as well as color, and no sound needed to understand threats [Planned].
- **Audio:** None in the build (feel pass, 2026-11-19). Not specified in the spec.
- **Requirements:** Node 20.19+ or 22.12+.

**Non-goals** [moved from spec "Constraints and non-goals"]
Multiplayer, mobile controls, realistic Earth geography, general world streaming, complex combat, detailed citizen needs, trade routes, and full city-scale population simulation. "The first build should be a playable survival and expansion loop, not a menu mockup or a promise of a complete open-world game."

"Oceans and sailing" was on this list in the spec. It was taken off on 2026-11-19, when the archipelago became the long-term world (see "Archipelago Direction" below). Loading one continent at a time (archipelago slice 3) is the only streaming planned.

---

## 8. Milestones & Roadmap

**Status:** ✅ Order and M2 scope are defined. No dates in any source.

| # | Milestone | Status | Source |
| --- | --- | --- | --- |
| M1 | Browser first playable: choose character → load and explore one shared world | Done | `plans/2026-11-19-browser-first-playable.md` (all tasks checked) |
| M1.5 | Character animation: walk/run/gather live, other clips in a preview dialog | Done in code (the plan's checkboxes are not ticked) | `plans/2026-11-19-character-animation.md` |
| — | Supplies as sprites, 6 s cancelable gather, herbs from regrowing flower patches | Built 2026-11-19 | Code + `CLAUDE.md` |
| M2 | Loop proof: the 9-item critical path below | Built 2026-11-19 (branch `worktree-m2-loop-proof`); the numbers are first values, still to be tuned | `specs/2026-11-19-m2-loop-proof-design.md`, `plans/2026-11-19-m2-loop-proof.md` |
| M3 | The rest of the spec plus review additions (10 items below) | Planned [Review] | This document + spec |
| Later | Towns and cities | Future, **unscoped**: needs its own content list before work starts (Risk 3) | Spec: "towns and cities are later stages" |
| A1–A4 | Archipelago: island home and a small boat, the ship and open sea, a second continent, the archipelago world map | A1 built; A2–A4 planned. Order against M2/M3 and big-world builds 2–4 is open (Open Question 14) | `specs/2026-11-19-archipelago-design.md` |

**M2: loop proof (critical path)** [Review]
1. Day/night cycle (~6 min, ~4 min daylight; to be retuned by "distance costs")
2. Warmth, hunger and health meters (**hunger is the named first cut** if M2 slips)
3. Campfire placement; each campfire founds a camp, so it also covers the second camp
4. Needs list (3-4 needs per camp, updated at dawn)
5. "Distance costs" numbers, derived on the 24,576×16,384 map, plus a rule for fast travel at dusk
6. Pass-out → lose the morning, wake at the nearest campfire or at spawn
7. Fog of war by walked area (region-level dimming and a local minimap are already built)
8. Herbs: healing and warming tea
9. Slow regrowth for wood, stone and food (moved in from M3 to keep M2's sinks fed)

**M3** [Review]
Wolves and the repel action; shelter, stockpile and farm; up to three settlers with jobs; farm food production; the 6-step objective chain; settlement tiers; the carried-today tally and dropped haul; the full dawn ritual (settler reports, farm yield). (Gathering tools were pulled forward and are built.)

**M2 acceptance** [Review, adapted from the spec]
In a running browser the player can: live through day and night; get cold away from a fire at night and warm up beside one; place a campfire that founds a named camp, and a second one farther out; see the needs list change at dawn and point outward; pass out from cold and wake at midday at the nearest fire (or spawn if none); watch the fog lift as they walk; brew and drink tea and heal with herbs; see a gathered node come back days later. Rejected placements spend nothing; pause stops time; save then reload restores the run.

**Full spec acceptance** [moved from spec "Acceptance and verification", now spans M2 + M3]
In a running browser the player can explore beyond the starting screen, gather all three resources, place every building, survive and recover from hunger and cold, encounter and repel a wolf, recruit and assign a worker, produce food, establish a second settlement, and continue after the milestone. Rejected placements spend nothing; pause stops time; collisions block walking or building on invalid terrain; workers handle unavailable targets; death and restart work; save then reload restores the run.

---

## Risk Register [Review]

| # | Category | Risk | Probability × impact | Rating | Mitigation |
| --- | --- | --- | --- | --- | --- |
| 1 | Pillar | The world map shows the whole landmass; unexplored regions are only dimmed, so the shape of the world is known from the start | Medium × minor | LOW | Region dimming and a local minimap are built; walked-area fog in M2 (6.16) |
| 2 | Retention cliff | First night: warmth drops and a new player doesn't know why | High × significant | **HIGH** until numbers are set | Partly: campfire-first objective, dusk line, explained pass-out (6.20). Warmth drain and reach must make night 1 survivable at walking speed (/balance-review) |
| 3 | Scope | "Later: towns and cities" has no content list | Medium × significant | MEDIUM | M2 cut to 9 items with a named first cut (hunger); M3 listed. "Later" needs a list before work |
| 4 | Loop | Fast travel to any found signpost can remove the walk home that the tether depends on | High × significant | **HIGH** | **Accepted** by the designer on 2026-11-19: no rule, travel stays free at any hour |
| 5 | Pillar | Slow regrowth makes expansion optional, weakening pillar 3 | Medium × minor | LOW | Accepted trade-off for pillar 2; the needs list carries the outward pull |
| 6 | Market | Cozy survival is a crowded genre (Stardew Valley, Don't Starve, Valheim) | Low × minor | IGNORE | Hobby project, no sales target |

---

## Big World Update (2026-11-19)

The sections above were reconciled with this update on 2026-11-19; this list is kept as the change record. Source: `docs/superpowers/specs/2026-11-19-big-world-design.md`.

- **[Built] World.** 448×320 tiles (28,672×20,480 units): the 384×256-tile home continent (24,576×16,384 units, about 100 s to run across) inside a 2,048-unit sea border. Seven regions with real borders: Sunscar Desert, Pinefall Woods, Frostpeak, Hollowstead Meadows, Driftwood Lagoon, Stonewater Canyons, Emerald Jungle. Two rivers with fords and bridges, a dry riverbed, ponds, and a lagoon with three islets, reachable by boat since slice A1.
- **[Built] Starting places.** Scout in Pinefall Woods, Builder in Hollowstead Meadows, Survivor on the Driftwood Lagoon shore. They are far apart.
- **[Built] Discovery.** A region is discovered by standing in it. 52 landmarks (seven per region, ten in the lagoon with its islets) are found within 200 units; 14 signposts (two per region) within 110.
- **[Built] Fast travel.** Any found signpost can be travelled to from the world map; the boat drifts back to its launch spot.
- **[Built] Objective.** "Your first footsteps" (gather once, discover three regions), then the goals card follows the current region: places found n / 7 (n / 10 in the lagoon) and signposts found n / 2. The world map shows totals.
- **[Built] Maps.** The minimap shows the area around the player; the world map dims unexplored regions and marks found places and signposts.
- **[Built] Saves.** `version: 5` (found landmarks and signposts, survival, camps, fog and the boat). Version 4 and version 3 saves are upgraded; older saves take the start-fresh path.
- **[Built] Art.** The new biomes use stand-in art derived from existing sprites, each with a prompt file for the real version.
- **[Planned] Build 2.** Objectives journal, biome-specific supplies and collectibles.
- **[Planned] Build 3.** Harsh conditions (cold, heat) and gear that counters them; until then every region is freely walkable.
- **[Planned] Build 4.** Stationary locals with requests and rewards.

Retention hook 2 ("new places to find") now has content: the three starts are no longer 12 s apart. Open Question 3 is resolved: rivers and crossings exist.

---

## Archipelago Direction (2026-11-19)

Decided in a brainstorming session on 2026-11-19. Source: `docs/superpowers/specs/2026-11-19-archipelago-design.md`. Slice A1 is built; everything else here is planned.

- **[Planned] The full world.** An archipelago of about nine continents and many small islands, with open sea between them. The seven-region map is the home continent; the others are locked. The user's reference map (snowy, volcanic, forest, castle and desert islands around a large south-east continent) is a mood board only; all art stays our own.
- **[Planned] Unlocking.** Other continents are reached by building or repairing boats. Sailing is free: the player steers the boat on the open sea.
- **[Planned] Boat tiers.** A small boat for coastal water; a bigger ship for deep water and far continents.
- **[Built] Slice A1: island home and a small boat (2026-11-19).** The map grows by a 2,048-unit sea border (448×320 tiles), with deep water as the edge. Driftwood regrows on beaches. Four old boats on the coast; one can be repaired for 6 wood + 2 stone. The player boards, sails coastal water and lands. The three lagoon islets become reachable, with one new landmark each (52 in all). Merged onto M2, the save is version 5: it upgrades M2's version 4 and the older version 3 saves instead of resetting them. Campfires can't be built from the boat; passing out at sea wakes the player ashore and the boat drifts back to where it was mended; fast-travelling to a signpost does the same.
- **[Planned] Slice A2.** Repair the big shipwreck into a ship that crosses deep water.
- **[Planned] Slice A3.** A second continent with its own map, loaded one continent at a time (for example a volcanic island with a new lava biome).
- **[Planned] Slice A4.** The world map zooms out to the archipelago; unvisited continents stay under fog. This also answers Risk 1 at archipelago scale.

---

## Open Questions (spec vs build, recorded, not resolved)

1. **Save slots.** The spec says "one local save slot". The build has one slot per character (three).
2. **Starting location.** The spec says "The character begins at the edge of a forest". The build has three spawns (forest, village, coast) since three characters were approved.
3. ~~**World features.**~~ Resolved by the big world: rivers, fords and bridges exist.
4. **Mobile.** The spec lists "mobile controls" as a non-goal. The build ships touch movement buttons at narrow widths.
5. ~~**Daily rituals hook vs "No offline progression".**~~ Resolved in review: the dawn ritual runs on in-game days (section 3).
6. **Animation plan status.** The plan's checkboxes are unticked while the code and `docs/art-direction.md` show the work is done.
7. **Churn points.** Not analyzed; the first night has no mitigation (Risk 2).
8. ~~**Needs list contents.**~~ Resolved when M2 was built: needs mix resource amounts with finds (a place in the nearest unexplored region, a new signpost), which point outward (6.17).
9. **Character identity.** The three characters play the same apart from spawn and kit (section 5).
10. **Relatedness.** No system creates a bond with anyone (section 5).
11. ~~**Fast travel vs the tether.**~~ Decided 2026-11-19: no rule; travel stays free at any hour and the designer accepts the weaker tether (Risk 4).
12. **Two roadmaps.** The review set M2 (loop proof: night, warmth, campfire, needs list) and M3. The big-world spec plans Build 2 (objectives journal, biome supplies, collectibles), Build 3 (cold and heat with gear) and Build 4 (locals with requests). They overlap (warmth vs harsh conditions, needs list vs requests) and no document orders them against each other.
13. **Character card names.** The cards say "Hollowstead Village" and "Driftwood Coast"; the regions are Hollowstead Meadows and Driftwood Lagoon.
14. **Three roadmaps.** Archipelago slices A1–A4 join M2/M3 and big-world builds 2–4 (Question 12). No document orders the three against each other. A1 was chosen as the first archipelago step, but not whether it comes before M2 or build 2. The A1 and M2 specs both claimed save version 4, and M2's fog grid depends on the map size that A1 grows; whichever is built second must adapt (see the A1 spec, "Saves"). **M2 was built first and took version 4**, so the merged build writes version 5 and upgrades version 4 saves; M2's fog grid is sized from the map, so a bigger map gets a bigger grid, and saved fog strings of the old length are rebuilt in that upgrade (each seen square moves 8 squares in). The save clash is settled; the order of the three roadmaps is still open.

---

## GDD Status
- **Completeness:** 8/8 sections present (churn analysis inside section 3 is ❌)
- **Imported from:** survival-settlement spec, README, two implementation plans, the game source, 2026-11-19 feel-pass measurements, and four import-session answers
- **Import date:** 2026-11-19
- **Reviewed:** 2026-11-19, /game-review Mode B. GDD Health 4.4 → 6.7/10 (SOLID)
- **Sections needing work:** churn points (section 3); tuning the M2 numbers now in the build (daylight length, warmth duration, hunger rate, needs amounts) against measured routes on the big map; Open Questions 1, 2, 4, 6, 7, 9, 10 and 12-14
- **Walked:** 2026-11-19, /player-experience as a Casual Newcomer, 7.1/10 (DONE_WITH_CONCERNS)
- **Balance review:** 2026-11-19, partial (Difficulty 6/10, Economy 3/10; Progression and cross-checks not run)
- **Reconciled with the big world:** 2026-11-19. Sections 1-6, 8, the risk register and the open questions now describe the seven-region map
- **Recommended next skill:** /playtest or /feel-pass on the M2 build (first night, first camp), then /balance-review on the 24,576×16,384 map with the M2 numbers
