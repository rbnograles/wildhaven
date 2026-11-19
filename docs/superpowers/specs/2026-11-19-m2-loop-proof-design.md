# M2 Loop Proof Design

**Date:** 2026-11-19 · **Status:** design approved in chat; spec awaiting review
**Source:** `docs/gdd.md` section 8, "M2: loop proof", items 1-9, plus the decisions below.

## Goal

Make the GDD's decided loop playable: *explore by day for what the camp needs → get back to a fire before dark → the camp grows and asks for something farther out → build a new camp to reach it → repeat.*

M2 acceptance (GDD section 8): in a running browser the player can live through day and night; get cold away from a fire at night and warm up beside one; place a campfire that founds a named camp, and a second one farther out; see the needs list change at dawn and point outward; pass out from cold and wake at midday at the nearest fire (or spawn if none); watch the fog lift as they walk; brew and drink tea and heal with herbs; see a gathered node come back days later. Rejected placements spend nothing; pause stops time; save then reload restores the run.

## Decisions made in brainstorming

| Topic | Decision |
| --- | --- |
| Scope | All nine M2 items in one spec and one plan. Tasks are ordered so the game stays playable after each one. |
| Fast travel vs the tether (Risk 4) | **No rule.** Signpost travel stays free at any hour. The designer accepts the weaker tether; the GDD records it. |
| Needs list | Mixed needs (resources and exploration). Each met need **grows the camp fire's warmth radius**. New needs replace met ones at dawn. |
| Hunger | **In, gentle.** At zero it stops health from healing and makes the cold bite faster. It never causes a pass-out by itself. |
| Old saves | Version 3 saves are **migrated** to version 4, not reset. |
| Not in M2 | Wolves, shelter, stockpile, farm, settlers, tiers, gathering tools, the carried-today tally (all M3). Fire fuel. Heat or region-specific cold (big-world build 3). |

## Rules

### 1. World clock and day/night

- A new field `state.time` is the world clock in game seconds since the dawn of day 1. `state.elapsed` keeps its old meaning (time played) and stays a statistic for the playtest log.
- One day is `DAY_SECONDS = 360`. Time of day `t = time % 360`, day number `floor(time / 360) + 1`.
- Phases: **dawn** `0 ≤ t < 20`, **day** `20 ≤ t < 210`, **dusk** `210 ≤ t < 240`, **night** `240 ≤ t < 360`. Daylight (dawn + day + dusk) is 240 s and night is 120 s. Midday is `t = 120`.
- A new game starts at `time = 20` (morning of day 1).
- The clock advances by the frame's clamped `dt`, only while the simulation runs. Pause, any open dialog and a hidden tab freeze it, as today.
- Darkness (for drawing only) is a pure function of `t`: 0 by day, rising linearly to 0.35 across dusk, then to 0.6 over the first 10 s of night and holding there, and falling linearly back to 0 across dawn.

### 2. Meters

`state.meters = { health, hunger, warmth }`, each a number from 0 to 100. A new game starts at 100/100/100.

**"By a fire"** means within the warmth radius of any camp's fire (section 3).

| Meter | Rule |
| --- | --- |
| Warmth | By a fire: +20/s (any phase). Away from a fire: +4/s at dawn and by day; unchanged at dusk; at night falls `100 / WARMTH_SECONDS` per second (`WARMTH_SECONDS = 60`), 1.5× faster when hunger is 0. Tea (below) stops the fall while it lasts. |
| Health | Falls `100 / FREEZE_SECONDS` per second (`FREEZE_SECONDS = 30`) while warmth is 0 at night away from a fire. By a fire, with hunger above 0: +2/s. No other change. |
| Hunger | Always falls `100 / HUNGER_SECONDS` per second (`HUNGER_SECONDS = 720`, two days). |

Consequence: a player away from any fire for the whole night has 60 s of warmth, then 30 s of health, and passes out 90 s into the 120 s night. Tea adds 20 s and a heal adds about 9 s.

**Tea.** `state.tea` is the seconds of tea warmth left (0 to `TEA_SECONDS = 20`). While warmth would be falling and `tea > 0`, warmth does not fall and `tea` counts down instead. Tea is brewed only at a camp (section 5) for `TEA_HERBS = 5` herbs, and only when `tea` is 0 (no stacking).

**Eat** (F key, or the camp dialog): costs 1 food and adds `FOOD_HUNGER = 25` hunger, capped at 100. Refused when hunger is already 100 ("You're not hungry.") or there is no food ("No food in your pack.").

**Heal** (H key, or the camp dialog): costs `HEAL_HERBS = 3` herbs and adds `HEAL_HEALTH = 30` health, capped at 100. Refused at full health or with too few herbs, with a message.

**Events.** The survival tick reports threshold crossings so the HUD can explain what is happening. It keeps no extra memory: each event is detected by comparing before and after within one tick.

| Event | When | Message (toast) |
| --- | --- | --- |
| `dusk` | phase enters dusk | "Dusk is falling. Head to a fire before dark." (skipped when by a fire) |
| `night` | phase enters night | "Getting dark, head to a fire." (skipped when by a fire) |
| `freezing` | warmth reaches 0 | "You're freezing. Your health is dropping." |
| `starving` | hunger reaches 0 | "You're starving. Eat something (F)." |
| `dawn` | the day number goes up | "Dawn, day N." plus "New needs at <camp>." when any camp's list changed |
| `passout` | health reaches 0 | Opens the pass-out screen (section 6). |

The meters in the HUD also show a short cause tag while a meter is falling ("Cold", "Freezing", "Starving").

### 3. Campfires and camps

- `state.camps` is a list of `{ id, name, x, y, grown, needs }`. `id` is `camp-<n>`, `grown` counts met needs (0 to `MAX_GROWN = 10`), `needs` is the camp's three needs (section 4).
- **Cost:** `CAMPFIRE_COST = { wood: 3, stone: 2 }`, charged only when placement succeeds.
- **Warmth radius:** `FIRE_RADIUS = 260 + FIRE_GROWTH (40) × grown` world units, so 260 to 660.
- **Placement check** `checkPlacement(state, x, y)` returns `{ ok, reason, message }`. First failing rule wins:
  1. `cost`: not enough wood or stone ("Needs 3 wood and 2 stone").
  2. `limit`: the character already has `MAX_CAMPS = 50` camps, the most a save may hold ("You can't keep more camps").
  3. `far`: more than `PLACE_RANGE = 300` from the player ("Too far away").
  4. `blocked`: the fire's solid base (the `campfire` footprint in `objects.json`, `[47, 70]`) is not fully walkable against the map, supply bases and other camp fires (tested on a 16-unit grid of points across the base); or it overlaps the player; or any node (supply or wild patch) is within 80 units ("Something is in the way").
  5. `close`: within `CAMP_SPACING = 3000` of another camp ("Too close to <camp name>").
- **Placing** (`placeCampfire`) re-runs the check, charges the cost, adds the camp with three fresh needs and a suggested name, and returns it. The suggested name is the first word of the region's name plus "Camp" (for example "Pinefall Camp"), with " 2", " 3" and so on added if that name is taken.
- **Naming.** After placement a small dialog asks for the camp's name, prefilled with the suggestion. Names are trimmed and limited to 1-24 characters. Closing the dialog keeps the suggestion. Placement does not depend on the dialog.
- Fires are solid (their footprint joins the movement bases), always lit, and drawn with the existing `campfire` sprite. `movePlayer` keeps ignoring a base the player is already standing in.
- The Scout's scenery campfire at the forest campsite is decoration and does not count as a fire.

### 4. Needs list

Each camp always has three needs in three slots. Need shapes:

| Kind | Fields | Met when |
| --- | --- | --- |
| `bring` | `resource`, `amount` | The player clicks Give in the camp dialog with at least `amount` of `resource`; that amount is spent. No partial delivery. |
| `place` | `region` | Any landmark in `region` is found after the need was posted. |
| `signpost` | none | Any signpost is found after the need was posted. |

Every need also has `done: boolean`.

- **Slots.** Slot 0 is always `bring`. Slot 1 is `place`. Slot 2 is `signpost` on odd days and `bring` on even days (the day the need is made).
- **`place` region:** the region nearest the camp (by distance to the region's centre) that is not the camp's own region and still has an unfound landmark. Only slot 1 makes `place` needs, so a camp never asks for two regions at once. If no region qualifies, the need becomes `bring`. The same fallback applies to `signpost` when every signpost is found.
- **`bring` choice:** the resource is picked from `RESOURCES` by a deterministic hash of `camp id`, `day` and `slot`, so the list never changes on reload. The amount is the resource's base (`wood 4, stone 3, food 2, herbs 4`) plus `floor(grown / 2)`.
- **Exploration finds** complete every matching open need in every camp (a find is generous, not split).
- **Meeting a need** sets `done`, adds 1 to the camp's `grown` (up to 10), and shows "<camp>: need met · <need>".
- **Dawn refresh.** When the day number goes up (by playing, resting or passing out), every `done` need is replaced with a new need for its slot. Open needs stay.
- A new camp gets three needs for the current day.

### 5. Camp dialog

Press E (or the interact button) within 140 units of one of your fires while no gatherable node is in reach. The interact button reads "Open <camp name>". A `<dialog>` opens, which pauses the game like every other dialog. It shows:

- The camp name, the day and phase, and the fire size ("Warmth reaches 340 units · 2 of 10 needs met").
- The three needs, each with its state: a **Give** button for `bring` (disabled with "You have 1 of 3" when short), "Out in the wild" for open exploration needs, and "Met · a new need arrives at dawn" for done ones.
- Camp tasks: **Brew tea** (5 herbs, disabled while tea is active), **Eat** (1 food), **Heal** (3 herbs), **Rest until dawn**. Disabled buttons say why.
- **Rest until dawn** is offered only at dusk and at night ("You can rest from dusk."). It moves the clock to the next dawn, drains hunger for the skipped time, sets health and warmth to 100, runs the dawn refresh, closes the dialog, saves and shows the dawn message.

### 6. Passing out

When health reaches 0 (only possible from cold at night):

- The player wakes at the **next midday** (`t = 120` of the following day), next to the camp fire nearest to where they fell. With no camp, they wake at their spawn.
- "Next to the fire" means the first walkable spot among 90 units south, west, east or north of it, falling back to the fire's own position.
- Health becomes 50, warmth 100, tea 0. Hunger drains for the skipped time. The dawn refresh runs for the day boundary that was crossed. Resources, camps and finds are never touched. Any gather or build in progress is cancelled.
- A pass-out dialog explains cause and cost: "You got too cold away from a fire. You woke at Pinefall Camp at midday." With no camp: "...You woke where you started, at midday. Build a campfire so you have somewhere warm to return to." One button, "Get up", closes it. The game saves.

### 7. Fog of war by walked area

- The world is divided into `FOG_CELL = 256`-unit cells. The grid size is derived from the map size (`ceil(width / 256) × ceil(height / 256)`), so it follows the map if the archipelago work grows it. On today's map that is 96 × 64 = 6,144 cells. `state.fog` stores them as a hex string of `ceil(cells / 4)` characters (1,536 today), 4 cells per character.
- Each frame, every cell whose centre is within `FOG_RADIUS = 1000` of the player is revealed. The fog module caches the decoded cells so a frame that reveals nothing does not rebuild the string.
- The world map and the minimap cover unrevealed cells with an opaque fog colour, drawn from a 96 × 64 mask scaled up with smoothing so the edges are soft.
- On the big map, region labels show only for discovered regions. Found places, signposts and camps are drawn on top of the fog, as today.
- Fog is per character, because it lives in the save.

### 8. Regrowth

- The nine fixed supplies gain `regrow: SUPPLY_REGROW = 720` (two days) and use the same `regrowAt` timers as flower patches, now measured on `state.time`. `state.collected` is removed.
- A supply's solid base exists only while the supply is available. A regrown supply's base appears again; `movePlayer` already lets a player standing inside it walk out.
- Flower patches keep `regrow: 180`.

### 9. Objectives and HUD

- **Goals card before the first camp:** label "BEFORE NIGHTFALL", title "Build a campfire", text "Night is cold away from a fire. Gather 3 wood and 2 stone, then press B to place it.", lines "Wood n / 3" and "Stone n / 2". This replaces "Your first footsteps".
- **Goals card with a camp:** label "CAMP NEEDS", title the nearest camp's name, text "Meet needs to grow the fire. New needs arrive at dawn.", one line per need with its progress (for example "Bring 4 stone · 2 / 4"; done needs are ticked).
- The region's progress ("3 / 7 places · 1 / 2 signposts") moves under the region name.
- The identity panel's status line becomes the clock: a sun or moon icon and "Day 2 · Dusk".
- Three labelled meter bars sit under the identity panel, each with its number for screen readers and the cause tag from section 2.
- Controls strip: `WASD` Move · `Shift` Run · `E` Gather / camp · `B` Campfire · `F` Eat · `H` Heal · `M` Map · `J` Journal · `Esc` Pause.

### 10. Build mode

- **B** toggles build mode, which is runtime only and never saved. A ghost campfire follows the mouse over the world. Without a mouse position (keyboard only, or touch before a tap) it sits 120 units in front of the player.
- The ghost is tinted green when the placement check passes and red when it fails, and a ring shows the base warmth radius. A bar at the bottom says "Campfire · 3 wood · 2 stone · Click or E to place · Esc to cancel" or the failing rule's message. Validity is shown in text as well as colour.
- Click on the world or press E to place. The interact button reads "Place campfire" (this covers touch). Escape or B cancels; while build mode is on, Escape cancels instead of pausing.
- Moving is allowed in build mode. Starting build mode cancels a gather in progress.

### 11. Fast travel

Unchanged. The GDD's Risk 4 and Open Question 11 are closed as "accepted: no rule".

## Architecture

Pure rule modules run in Node tests. The browser modules stay thin. New and changed files:

| File | Role |
| --- | --- |
| `src/data/balance.js` | Every number in this spec, each with a short comment. |
| `src/world/clock.js` | `dayOf`, `timeOfDay`, `phaseOf`, `darknessAt`, `nextDawn`, `nextMidday`. |
| `src/world/camps.js` | `fireRadius`, `nearestCamp`, `byFire`, `campBases`, `suggestCampName`. |
| `src/world/needs.js` | `makeNeed`, `makeNeeds`, `refreshNeeds` (dawn), `markFinds` (exploration), `describeNeed`, `needProgress`. |
| `src/world/fog.js` | Grid size, `revealAround`, `isRevealed`, `revealRegions` (migration), mask for the maps. |
| `src/actions/survive.js` | `tickSurvival(state, dt)` → events; `skipTo(state, time)` shared by rest and pass-out. |
| `src/actions/build.js` | `checkPlacement`, `placeCampfire`, `nameCamp`. |
| `src/actions/camp.js` | `giveToNeed`, `brewTea`, `eat`, `heal`, `rest`, `passOut`. |
| `src/actions/gather.js` | Supplies regrow; availability on `state.time`. |
| `src/world/nodes.js` | `isAvailable` moves here (re-exported by `gather.js`); new `goneSupplies(state)` lists supplies not standing right now; `nodeBases(gone)` keeps its signature. |
| `src/actions/move.js` | Movement bases are supply bases plus camp fire bases. |
| `src/game/state.js` | Version 4 fields, validation, and v3 → v4 migration. |
| `src/render/renderer.js` | Scene, sprites, camera; draws camp fires and the build ghost. |
| `src/render/maps.js` (new) | `drawMap` moved out of the renderer, plus fog and camps. |
| `src/render/lighting.js` (new) | Night overlay: a viewport-sized `RenderTexture` filled with the night colour at the current darkness, with a soft light erased around each fire (its warmth radius) and a small one around the player. Flicker is off under reduced motion. On the Canvas renderer it falls back to a plain dim rectangle. |
| `src/ui/hud.js` | Clock, meters, cause tags, new goals card, region progress, interact labels, build bar. |
| `src/ui/camp.js` (new) | Camp dialog, camp name dialog, pass-out dialog. |
| `src/ui/dialogs.js` | The three new dialogs count as paused. |
| `src/ui/layout.js`, `src/style.css` | Markup and styles for the above. |
| `src/core/loop.js` | Calls `tickSurvival` in place of `state.elapsed += dt` for the clock, routes events to the HUD, marks exploration needs from `discover`, reveals fog, saves on dawn and pass-out. |
| `src/core/input.js` | B, F, H, E in build mode, Escape in build mode, pointer position over the world. |
| `src/core/session.js` | Runtime `build` and `pointer` fields. |

`renderer.js` is split because it already holds 479 lines and this work adds lighting, fog and camps to it.

## Save format (version 4)

```js
{
  version: 4,
  character, player, resources,      // unchanged
  regrowAt,                           // node id → state.time it returns (supplies and wild patches)
  discovered, landmarks, waypoints,   // unchanged
  elapsed,                            // time played, seconds (statistic)
  distance,                           // unchanged
  time,                               // world clock, seconds since the dawn of day 1
  meters: { health, hunger, warmth }, // each 0..100
  tea,                                // 0..TEA_SECONDS
  camps: [{ id, name, x, y, grown, needs: [need, need, need] }],
  fog,                                // hex string, length from the map size (1,536 today)
}
```

**Version clash with archipelago A1.** The A1 spec (`2026-11-19-archipelago-design.md`) also claims version 4. Whichever lands second takes the next number and migrates from the other: if A1 is already on `main` when this work starts, M2 writes version 5, keeps the v3 upgrade, and adds a v4 → v5 upgrade that fills the same M2 defaults. If A1 grows the map, fog strings from older saves have the wrong length and are rebuilt by the same "reveal discovered regions" rule.

`restoreGame` validates every new field strictly (finite numbers in range, known regions and resources, camp ids unique and shaped `camp-<n>`, names 1-24 characters, at most 50 camps, camp spots walkable, exactly three valid needs, fog of the right length and alphabet) and rebuilds the object field by field.

**Migration from version 3:** `time = 20` (morning of day 1). Each regrow timer keeps its remaining time (`time + (old - elapsed)`), and each id in the old `collected` list becomes a supply timer of `time + SUPPLY_REGROW`. Meters start at 100, `tea` at 0, `camps` empty. Fog is revealed for every cell in a discovered region and around the player.

Saves happen as today, plus on placing and naming a camp, every camp-dialog action, rest, pass-out and dawn.

## Error handling

- Every action returns `{ ok, reason }` and changes nothing on failure; the UI turns the reason into a message.
- Camp names are written with `textContent`, never as HTML.
- A save that fails validation takes the existing "could not be read, start fresh" path.

## Testing

Node tests (one file per module under `tests/`):

- **Clock:** phase boundaries, day numbers, darkness values, next dawn and next midday.
- **Survival:** warmth by a fire, by day, at dusk and at night; the starving multiplier; tea stopping the fall and counting down only while it protects; freezing health loss and regen; every event fires once on its crossing; the 90 s whole-night pass-out.
- **Build:** each placement reason, cost charged only on success, spacing, suggested names, name validation, fires blocking movement.
- **Needs:** slot kinds, the `place` region rule and fallbacks, deterministic generation, exploration marking, give, growth cap, dawn refresh replacing only met needs.
- **Camp actions:** eat, heal, tea and rest rules and refusals; pass-out wake spot, time, meters and dawn refresh.
- **Fog:** encode and decode, reveal radius, migration reveal.
- **Regrowth:** supplies regrow after 720 s; bases follow availability.
- **State:** version 4 round trip, every new validation rule, v3 → v4 migration (time, timers, collected, fog).

Browser verification with the `wildhaven` launch config at `127.0.0.1`, for each character: a full day and night, getting cold and warming at a fire, placing a first and a second camp (and a rejected placement that spends nothing), meeting needs and seeing them change at dawn, resting, passing out, tea and healing, the fog on both maps, a regrown supply, pause stopping time, save and reload, and the HUD at about 390 px wide. Notable checks go into `docs/verification.md`.

## Docs to update

`docs/gdd.md` (move the M2 items to [Built], record the fast-travel decision, the numbers chosen and the needs contents), `CLAUDE.md` (architecture table, save model, game rules), `docs/verification.md`, and `README.md` where it describes the loop.
