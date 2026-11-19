# Wildhaven — Game Design Document

**Team:** Solo hobby project [inferred: from the "hobby, no monetization" answer and a single-user local workspace]
**Platform:** Desktop web browser, keyboard and mouse
**Genre:** Top-down survival-settlement adventure (cozy survival)
**Target Session:** TBD, not stated in any source [inferred: 15-30 min, based on the planned ~6 min day/night cycle and the "survive three nights" objective]
**Monetization:** None (hobby project)
**Last Updated:** 2026-11-19
**Imported by:** /game-import from `docs/superpowers/specs/2026-11-19-survival-settlement-design.md`, `README.md`, `docs/superpowers/plans/*.md`, `src/state.js`, `src/main.js`, plus answers given in the import session

**Tags used below**
- **[Built]** is in the current build and can be played now.
- **[Planned]** is in the survival-settlement spec and is not implemented. Do not describe it as existing.
- **[Answer]** came from the 2026-11-19 /game-import session.

---

## 1. Overview & Core Concept

**Status:** ✅

**Intent** [moved from spec "Intent and agreed direction"]
The user wants an open-world exploration game with cities built across the world. They selected a survival settlement adventure and a top-down view: guide a character from above with a clear view of the settlement.

**What exists today** [Built, from README]
A playable browser exploration prototype with three starting characters and one shared illustrated world. The current milestone is "open browser → choose character → load and explore the game".

**Audience** [Answer]
Cozy survival players. They want gentle pressure and a home to build; death is rare and recoverable. Closest reference: Stardew Valley crossed with a softened Don't Starve. The spec's tuning already points here: "manageable survival pressure", wolves that "stay away from the starting area, warn before attacking, and retreat from lit campfires", and "No graphic violence".

**Platform** [moved from spec "Playable scope" and "Approaches"]
Single-player, desktop browser, keyboard and mouse. Browser delivery was the spec's proposed builder choice ("immediate local play, quick iteration") and is what got built. No accounts or servers.

**Starting characters** [Built]
All three share one world and start at different places. Each has its own save.

| Character | Starts at | Starting resources (wood/stone/food) | Kit (visual only) | Tagline |
| --- | --- | --- | --- | --- |
| The Frontier Scout | Pinefall Woods (forest, top-left) | 0 / 0 / 3 | Hatchet · Field pack | "Follow the trail. Find your home." |
| The Wandering Builder | Hollowstead Village (abandoned village, center) | 5 / 2 / 2 | Hammer · Work gloves | "Where others see ruins, you see a beginning." |
| The Shipwreck Survivor | Driftwood Coast (shipwreck beach, bottom-right) | 2 / 0 / 4 | Salvaged satchel · Rope | "The sea took your ship. Not your spirit." |

Kit tools are not equip mechanics; they only identify the character visually (README).

**Approval history**
- Spec: "The user has approved the genre and camera direction only."
- Later: the user approved three character types and the browser selection-to-game milestone (plan header).
- 2026-11-19 import session: audience, retention hooks, monetization and player fantasy answered (this document).

---

## 2. Core Loop

**Status:** ⚠️ Phases are listed, but the step that sends the player back around the loop has no mechanic yet.

**Current loop** [Built]
1. Move (WASD/arrows) or run (Shift) along dirt paths.
2. Spot a marked supply. The nearest one within 95 units highlights and shows "E".
3. Press E: a 0.8 s gather animation plays, movement is locked, then the resources are added.
4. Keep walking to reach the other starting regions (3 total).
5. The objective completes when you have gathered once and discovered all 3 regions. Free exploration continues.

The current loop is finite: 9 one-time supply nodes, 3 regions. Resources have no use yet. README: "Resources currently support gathering and exploration objectives, not crafting."

**Planned loop** [Planned, moved from spec "Experience and visual direction"]
> The character begins at the edge of a forest with a few supplies. Explore woodland, meadow, riverbank, and abandoned ruins; gather resources; choose a camp location; and build a settlement that makes subsequent journeys easier.

| Layer | Loop | Status |
| --- | --- | --- |
| Moment to moment | Move, gather (E), place buildings (mouse), repel wolves | Move/gather [Built]; build/repel [Planned] |
| Session | Survive the day/night cycle: gather by day, stay warm by fire and shelter at night | [Planned] |
| Meta | Grow a camp, recruit settlers, found a second camp a meaningful walk away; "towns and cities are later stages" | [Planned] |

❌ **Gap (left for /game-review):** "a settlement that makes subsequent journeys easier" is the only repeat trigger, and no source says which building shortens which journey or how. No fast travel, carry limit or resupply rule is defined.

---

## 3. Progression & Retention

**Status:** ✅ Two of the three hooks are backed by designed systems; the third has no mechanic yet.

**Current objective** [Built, from `src/main.js`]
"YOUR FIRST FOOTSTEPS / A place to begin"
- Gather your first supplies
- Discover the three starting regions (n / 3)
- On completion: "You have found your feet. Keep exploring — this is just the beginning."

**Planned objective chain** [Planned, moved from spec "Progression and failure"]
1. Learn movement and gathering
2. Build a campfire and shelter
3. Recruit a settler
4. Produce food
5. Survive three nights
6. Establish a second camp

"Objectives reflect actual world state and never block free exploration. After completion the player can continue playing."

**Retention hooks** [Answer]
1. **Unfinished business.** The camp still needs a farm, a settler has no job, the second camp isn't started. Supported by the planned save contents (buildings, settlers, depleted nodes, completed objectives) and today's per-character saves of collected nodes and discovered regions [Built].
2. **New places to find.** New regions, landmarks and settlement sites. Supported by region discovery [Built] and the planned minimap that "reveals explored areas" [Planned]. Today there are 3 regions; the spawn sites are about 2,870 units apart, about 12 s apart at a run (measured in the 2026-11-19 feel pass), so all three fit in one short session.
3. **Daily rituals.** ❌ **No mechanic designed.** Open question: the spec says "No offline progression", so any daily hook has to work without the world advancing while the game is closed.

**Replay** [inferred: three characters with separate saves and spawns let a player restart from a different corner of the same world]

**Failure** [Planned, moved from spec "Progression and failure"]
If health reaches zero, show a clear death screen with a restart option. Restarting replaces a run only after an explicit in-game confirmation. [Built today: "Start a fresh adventure" replaces one character's save only after confirmation.]

---

## 4. Economy & Monetization

**Status:** ✅

**Monetization** [Answer]
None. Hobby project. The spec also requires no external accounts or paid services.

**Resources**
`wood`, `stone`, `food`. Always non-negative integers; saves with any other value are rejected [Built]. Inventory is "shared globally in this prototype; local storage and trade logistics are deferred" [Planned].

**Faucets**

| Source | Status | Detail |
| --- | --- | --- |
| Starting kit | [Built] | See the character table in section 1 |
| 9 supply nodes, one-time | [Built] | Totals: 10 wood, 7 stone, 7 food |
| More depleting nodes | [Planned] | "Nodes deplete; initial supplies and resource distribution must allow at least two camps and sustained food production." |
| Settler work | [Planned] | Settlers assigned to wood, stone, or farming |
| Farm | [Planned] | "produces food over time when assigned a settler" |

**Supply nodes** [Built]

| Node | Region | Type | Amount |
| --- | --- | --- | --- |
| Fallen branches | Pinefall Woods | wood | 3 |
| Loose stones | Pinefall Woods | stone | 2 |
| Wild berries | Pinefall Woods | food | 2 |
| Scrap timber | Hollowstead Village | wood | 3 |
| Loose stones | Hollowstead Village | stone | 3 |
| Wild berries | Hollowstead Village | food | 2 |
| Wild berries | Meadow between village and coast | food | 3 |
| Driftwood | Driftwood Coast | wood | 4 |
| Beach stones | Driftwood Coast | stone | 2 |

**Sinks**
- [Built] None. Nothing spends resources.
- [Planned] Building costs for campfire, shelter, stockpile and farm. Placement "only charges on successful placement". No cost numbers exist; the spec leaves "resource costs" to the builder.
- [Planned] Food eaten to restore hunger. No rates defined.

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

**Player type** [inferred: Explorer primary, from the discovery fantasy; Achiever secondary, from the objective chain and settlement growth]

Superseded: the spec said "Their broader motivation and preferred art references have not been specified." Motivation is now answered; art references remain unspecified beyond the generated assets in `docs/art-direction.md`.

---

## 6. Systems & Mechanics Detail

**Status:** ✅

### 6.1 Movement and collision [Built]
- Walk 155 units/s, run 245 units/s (hold Shift). Diagonal input is normalized.
- Frame `dt` is clamped to 0.05 s in the loop and 0.1 s inside `movePlayer`.
- Collision is checked separately on x and y, so the player slides along obstacles.
- Blocked: the 42-unit world margin, water (per-tile corner masks, water where the blend is ≥0.35), and each object's solid base (`footprint` in `objects.json`).
- World: 96×64 tiles at 64 px = 6144×4096 units.
- Directions: 0 = south, 1 = west, 2 = east, 3 = north.

### 6.2 Gathering [Built]
- The nearest uncollected node within 95 units can be gathered with E or the gather button.
- E starts a 0.8 s `gather` clip (4 frames at 5 fps). Movement is locked for the whole clip. This length is a design decision, not a bug.
- Resources are awarded once, when the clip finishes. The node is then gone for good (tracked in `state.collected`).

### 6.3 Discovery [Built]
- A region is discovered within 230 units of its center. A toast shows "Discovered <name>" and the HUD counter updates.
- The HUD region label shows a region's name within 360 units of it, otherwise "The Open Wilds".

### 6.4 Maps and pause [Built]
- Minimap in the HUD; world map on M or by clicking the minimap.
- The game pauses while the pause, map or reset dialog is open, on Escape or the pause button, and while the tab is hidden.

### 6.5 Saves [Built]
- One save per character in browser localStorage (`wildhaven.adventure.v1.<characterId>`, `version: 2`).
- Saves on gather, discovery, opening pause, hiding the tab, page hide, and every 10 s; manual save in the pause menu.
- A stale tab cannot overwrite a newer save. Unreadable saves show "This save could not be read. Start fresh to play."
- A refresh resumes the character being played.
- Saved: character, position, facing, resources, collected nodes, discovered regions, elapsed time, distance. Animation state is never saved.

### 6.6 Animation [Built]
- In play: idle, walk and run in four directions; gather uses east-facing art, mirrored for west.
- Preview dialog only: build, craft, fight, swim. These must not imply working mechanics.

### 6.7 Survival meters [Planned, moved from spec "Playable scope"]
"Health, hunger, and warmth create manageable survival pressure. Hunger falls over time; eating restores it. Night drains warmth away from fire and shelter. Critical hunger or cold reduces health, with visible feedback explaining why." No rates defined.

### 6.8 Day/night [Planned]
"A roughly six-minute day/night cycle, with daylight lasting about four minutes. Exact balance is tunable. Pause freezes simulation and survival meters."

### 6.9 Wolves [Planned]
"A simple attack or repel action protects the player from wolves. Wolves stay away from the starting area, warn before attacking, and retreat from lit campfires. No graphic violence." No damage, health or spawn numbers defined.

### 6.10 Building [Planned]
Placement shows validity and cost, rejects water, obstacles, overlapping footprints or insufficient resources, and only charges on success.

| Building | Function |
| --- | --- |
| Campfire | Establishes a named settlement; provides warmth |
| Shelter | Safe resting location; capacity for settlers |
| Stockpile | Enables settlement resource collection |
| Farm | Produces food over time when assigned a settler |

### 6.11 Settlers [Planned]
Discover and recruit up to three settlers. Each belongs to one camp and works nearby on wood, stone or farming. Workers visibly move between work sites and storage. "Unreachable or depleted jobs report their status instead of producing resources invisibly."

### 6.12 Expansion [Planned]
A second camp can be founded "a meaningful walk from the first". Settlements appear on the minimap and can be revisited on foot.

### 6.13 World layout
- [Built] Forest campsite (top-left), abandoned four-cottage village with a workshop (center), shipwreck beach with ocean on the right edge (bottom-right). Connected by dirt paths through open meadow. No river.
- [Planned] "Traversable forest and meadow connect resource sites, a river crossing, ruins, and at least two viable settlement locations."

### 6.14 Controls

| Action | Control | Status |
| --- | --- | --- |
| Move | WASD or arrow keys | [Built] |
| Run | Hold Shift | [Built] |
| Gather | E or the gather button | [Built] |
| World map | M or the minimap | [Built] |
| Pause | Escape or the pause button | [Built] |
| Save / return to characters | Pause menu | [Built] |
| Touch movement | On-screen buttons at narrow widths | [Built] |
| Select and place buildings | Mouse | [Planned] |
| Cancel building | Escape | [Planned] |

### 6.15 HUD layout [Planned, moved from spec "Experience and visual direction"]
```text
Health / hunger / warmth       Day and time       Resources

                  scrolling playable world
                       player + camp

Current objective        contextual action       minimap
             build toolbar when building
```
[Built today: portrait, resources, region name, objective panel, minimap, contextual gather button, controls bar.]

---

## 7. Technical Specs

**Status:** ✅

- **Runtime:** Vanilla JavaScript ES modules, no framework. Vite 7 bundles. Phaser 4 is used only as the renderer; HTML/CSS handle UI and dialogs.
- **Tests:** Node's built-in `node:test`. Game rules live in pure modules (`state.js`, `storage.js`, `animation.js`) that run in Node.
- **Input:** Owned by `main.js`, not Phaser. Held keys are tracked in a `Set`.
- **World data:** Tiled-format `wildhaven.json`, built offline by `tools/build-map.py` (Python, numpy, Pillow). The same file drives rendering and collision.
- **Persistence:** localStorage per character plus sessionStorage for the active character. Saves are scoped to the page origin. No server, no cloud save, no offline progression.
- **Asset loading:** Image loads have timeouts and a 20 s Phaser scene timeout. Any failure ends on a retry screen, never an endless loader.
- **Layout:** The spec targets 1280×720 and up. The build also works at about 390 px wide.
- **Accessibility:** `prefers-reduced-motion` turns off camera smoothing, CSS transitions and preview autoplay [Built]. The spec also asks for readable text and contrast, placement feedback through symbols and text as well as color, and no sound needed to understand threats [Planned].
- **Audio:** None in the build (feel pass, 2026-11-19). Not specified in the spec.
- **Requirements:** Node 20.19+ or 22.12+.

**Non-goals** [moved from spec "Constraints and non-goals"]
Multiplayer, mobile controls, realistic Earth geography, oceans and sailing, world streaming, complex combat, detailed citizen needs, trade routes, and full city-scale population simulation. "The first build should be a playable survival and expansion loop, not a menu mockup or a promise of a complete open-world game."

---

## 8. Milestones & Roadmap

**Status:** ✅ Order is defined. No dates in any source.

| # | Milestone | Status | Source |
| --- | --- | --- | --- |
| M1 | Browser first playable: choose character → load and explore one shared world | Done | `plans/2026-11-19-browser-first-playable.md` (all tasks checked) |
| M1.5 | Character animation: walk/run/gather live, other clips in a preview dialog | Done in code (the plan's checkboxes are not ticked) | `plans/2026-11-19-character-animation.md` |
| M2 | Survival settlement prototype: survival meters, day/night, wolves, four buildings, up to three settlers, second camp, death and restart | Planned. Scope not yet approved: "Review this proposed scope before implementation planning." | `specs/2026-11-19-survival-settlement-design.md` |
| Later | Towns and cities, larger world | Future, unscoped | Spec: "towns and cities are later stages" |

**M2 acceptance** [moved from spec "Acceptance and verification"]
In a running browser the player can explore beyond the starting screen, gather all three resources, place every building, survive and recover from hunger and cold, encounter and repel a wolf, recruit and assign a worker, produce food, establish a second settlement, and continue after the milestone. Rejected placements spend nothing; pause stops time; collisions block walking or building on invalid terrain; workers handle unavailable targets; death and restart work; save then reload restores the run.

---

## Open Questions (spec vs build, recorded, not resolved)

1. **Save slots.** The spec says "one local save slot". The build has one slot per character (three).
2. **Starting location.** The spec says "The character begins at the edge of a forest". The build has three spawns (forest, village, coast) since three characters were approved.
3. **World features.** The spec names a riverbank, a river crossing and abandoned ruins. The built map has no river (its world prompt says "No rivers bisecting the map") and an abandoned village instead of ruins.
4. **Mobile.** The spec lists "mobile controls" as a non-goal. The build ships touch movement buttons at narrow widths.
5. **Daily rituals hook vs "No offline progression".** See section 3.
6. **Animation plan status.** The plan's checkboxes are unticked while the code and `docs/art-direction.md` show the work is done.

---

## GDD Status
- **Completeness:** 7/8 sections (7 ✅ present, 1 ⚠️ partial, 0 ❌ TBD)
- **Imported from:** survival-settlement spec, README, two implementation plans, `src/state.js`, `src/main.js`, 2026-11-19 feel-pass measurements, and four import-session answers
- **Import date:** 2026-11-19
- **Sections needing work:** Core Loop (repeat trigger has no mechanic); Retention (daily rituals has no mechanic); Target session length (TBD); M2 numbers (building costs, hunger/warmth rates, wolf tuning are all unset); Open Questions 1-6
- **Recommended next skill:** /game-review, which will push on the core loop's repeat trigger and the retention gaps, then /player-experience
