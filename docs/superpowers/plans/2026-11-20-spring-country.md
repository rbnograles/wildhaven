# Spring country rebuild

User direction: one country per biome; begin with a complete large Spring country, balanced survival, no iron/copper/gold/diamond. Deliver an editable Tiled map using credible proportions against the game's 76px character and 64px terrain grid.

Use the existing arranged world as the geography and settlement base. Preserve its source file and live game while producing a separate Spring country. Replace snow, jungle and desert landcover and vegetation with temperate meadow/woodland; keep rivers, coastal beaches, ponds and travel routes. Spring districts are places within one biome, not seven biomes. Remove mineral deposits and mineral-bearing caves. Include ordinary stone, wood, food, herbs, viable camp clearings, safe starter pockets, distant wildlife, and explicit future-country exits.

- [x] Build deterministic Spring map authoring script and focused constraints tests.
- [x] Assemble editable terrain, paths, correctly scaled scenery, resources, settlements and wildlife.
- [x] Check starter supply budgets, exclusions, dry/reachable positions and route joins.
- [x] Render the map through Tiled; inspect overview and starter/detail crops.
- [x] Open the delivered map in native Tiled, document resource/scale rules and import status.

Verified 2026-11-21: two focused tests pass; 39 image references resolve; Tiled opens the map without asset errors. Three starts and eight settlement centers share the traversable component. Every start exceeds the minimum reachable bare-hand supply budget. Final output has 19,820 objects, 11,232 resource nodes and 2,057 connected path tiles. Visual review corrected overlapping houses, east-bay zigzag land, and forage rendering over roofs/canopies. See `assets/world/tiled/SPRING-COUNTRY.md` for editing and simulation limits.

Gameplay country switching and importing this new country over the currently edited live seven-region world are separate integration work. The authoring deliverable must clearly identify this boundary and include usable spawn/resource metadata.
