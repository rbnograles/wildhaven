# Wildhaven — survival settlement prototype

Status: longer-term roadmap. The user subsequently approved three character types and instructed implementation of the browser selection-to-game milestone; see ../plans/2026-11-19-browser-first-playable.md. Working title is a builder choice.

## Intent and agreed direction

The user wants an open-world exploration game with cities built across the world. They selected a survival settlement adventure and a top-down view: guide a character from above with a clear view of the settlement. Their broader motivation and preferred art references have not been specified.

This design proposes a small playable foundation for that larger game. All details below beyond the agreed direction are proposed builder choices, not previously approved requirements.

## Approaches

1. Browser-based 2D game: immediate local play, quick iteration, and a good fit for top-down movement and building. Large-scale simulation and world streaming would need later engineering. Recommended builder choice for this first prototype.
2. Desktop game in a dedicated engine: better starting point for a substantial installed game, with editor tooling and packaging, but more setup and a slower first playable delivery.

The user chose the top-down presentation. They have not chosen a platform; browser delivery is the proposed implementation choice. Exact rendering library and code organization are left to implementation planning.

## Experience and visual direction

The character begins at the edge of a forest with a few supplies. Explore woodland, meadow, riverbank, and abandoned ruins; gather resources; choose a camp location; and build a settlement that makes subsequent journeys easier.

Use a cohesive illustrated 2D presentation with readable terrain, trees, rocks, small buildings, animated characters, soft shadows, and a warm campfire at night. Prioritize clear interaction and a world occupying most of the window. Avoid a dashboard dominated by panels or a static map without character control.

Suggested screen arrangement:

```text
Health / hunger / warmth       Day and time       Resources

                  scrolling playable world
                       player + camp

Current objective        contextual action       minimap
             build toolbar when building
```

## Playable scope

- Single-player, desktop browser, keyboard and mouse; locally served from this workspace.
- One deterministic, bounded region substantially larger than the viewport. Traversable forest and meadow connect resource sites, a river crossing, ruins, and at least two viable settlement locations. This represents a first region, not a complete planet.
- Continuous exploration with camera follow, terrain collision, and a minimap that reveals explored areas. No loading between locations in the prototype.
- WASD or arrow-key movement; E for nearby interactions; mouse for building selection and placement; Escape cancels building or pauses. Controls are visible in-game.
- Collect wood, stone, and food from readable nearby sources. Nodes deplete; initial supplies and resource distribution must allow at least two camps and sustained food production.
- Health, hunger, and warmth create manageable survival pressure. Hunger falls over time; eating restores it. Night drains warmth away from fire and shelter. Critical hunger or cold reduces health, with visible feedback explaining why.
- A roughly six-minute day/night cycle, with daylight lasting about four minutes. Exact balance is tunable. Pause freezes simulation and survival meters.
- A simple attack or repel action protects the player from wolves. Wolves stay away from the starting area, warn before attacking, and retreat from lit campfires. No graphic violence.
- Construct a campfire, shelter, stockpile, and farm. Placement shows validity and cost, rejects water, obstacles, overlapping footprints, or insufficient resources, and only charges on successful placement. Buildings are visible and functional.
- Campfire: establishes a named settlement and provides warmth. Shelter: safe resting location and capacity for settlers. Stockpile: enables settlement resource collection. Farm: produces food over time when assigned a settler.
- Discover and recruit up to three settlers. They travel to a settlement and can be assigned wood, stone, or farming work. Workers visibly move between reachable work sites and storage. Unreachable or depleted jobs report their status instead of producing resources invisibly.
- Resource inventory is shared globally in this prototype; local storage and trade logistics are deferred. Each settler belongs to one camp and works nearby.
- A second camp can be established a meaningful walk from the first. Settlements appear on the minimap and can be revisited on foot. This is the first demonstration of expansion across the world; towns and cities are later stages.

## Progression and failure

Suggested objectives teach movement and gathering, then building a campfire and shelter, recruiting a settler, producing food, surviving three nights, and establishing a second camp. Objectives reflect actual world state and never block free exploration. After completion the player can continue playing.

If health reaches zero, show a clear death screen with a restart option. Loading a saved game resumes its recorded state. Restarting replaces a run only after an explicit in-game confirmation.

## Persistence

Provide one local save slot, saved automatically at regular intervals and on meaningful milestones, plus a visible save control. Store world seed, player state, resources, time, explored areas, depleted nodes, buildings, settlers, and completed objectives. Reloading restores these consistently. No offline progression. Invalid or unsupported saves display a recoverable explanation and allow a new game. Saves remain in that browser on that device.

## Constraints and non-goals

The current workspace is empty and has no established game engine or implementation. No external accounts or paid services are required. Target current desktop browsers and a comfortable 1280-by-720-or-larger layout, adapting HUD spacing to smaller windows where practical.

Multiplayer, mobile controls, realistic Earth geography, oceans and sailing, world streaming, complex combat, detailed citizen needs, trade routes, and full city-scale population simulation are future work. Do not present them as existing features. The first build should be a playable survival and expansion loop, not a menu mockup or a promise of a complete open-world game.

## Builder discretion

The builder chooses the frontend tooling, renderer, internal architecture, world dimensions, asset production method, movement speeds, resource costs, combat tuning, and exact accessibility treatment. Maintain readable text and contrast, give placement feedback through symbols/text as well as color, and avoid requiring sound to understand threats.

## Acceptance and verification

Verify in a running browser that the player can explore beyond the starting screen, gather all three resources, place every building, survive and recover from hunger/cold, encounter and repel a wolf, recruit and assign a worker, produce food, establish a second settlement, and continue after the milestone.

Verify rejected placements spend nothing; pause stops time; collisions prevent walking or building on invalid terrain; workers handle unavailable targets; death and restart work; and saving then reloading restores the run. Check the HUD at common desktop sizes and inspect the browser console for errors. Add focused automated checks for world reachability, placement/resource transactions, survival time steps, and save restoration where useful; visual behavior still requires browser verification.

## Approval

The user has approved the genre and camera direction only. Review this proposed scope before implementation planning.
