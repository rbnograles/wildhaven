# Harvestable Supplies Design

**Date:** 2026-11-19 · **Status:** approved in chat

## Problem

Supply nodes had no artwork. Each was an invisible point with a floating "+" circle, and `build-map.py` kept scenery 150 units away from it, so the marker always sat on bare ground. Real-looking rocks and flowers nearby were only scenery. Driftwood and scrap timber sat about 40 units from a spawn point, and the meadow berries were hidden under an oak canopy. Gathering took 0.8 s.

## Decisions

1. **Every supply node is its own sprite.** `NODES` in `src/state.js` gains `sprite` (an `objects.json` key), `scale`, `verb` and `clip`. Node ids are unchanged, so saves keep their progress and the save `version` stays 2.

   | id | Becomes | Sprite | Absolute position |
   | --- | --- | --- | --- |
   | pine-wood | Pine tree (Chop, 3 wood) | pine ×1 | 870, 650 |
   | camp-stone | Loose stones | rocks-b ×0.5 | 480, 570 |
   | forest-food | Wild berries (Pick) | berry-bush ×1 | 480, 705 (unchanged) |
   | village-wood | Scrap timber | log ×0.8 | 3180, 2170 |
   | village-stone | Loose stones | rocks-b ×0.5 | 2990, 2180 |
   | village-food | Wild berries | berry-bush ×1 | 3202, 2348 (unchanged) |
   | coast-wood | Driftwood | log ×0.8 | 5630, 3740 |
   | coast-stone | Beach stones | beach-rock ×0.6 | 5322, 3778 (unchanged) |
   | meadow-food | Wild berries | berry-bush ×1 | 3300, 2580 |

2. **Solid until gathered.** An uncollected node's base (its `objects.json` footprint × scale) blocks movement. After gathering, the sprite fades out and the base clears. If a player is already standing inside a base (an old save made before the node moved), they can walk out.
3. **The highlight is on the sprite.** The circle markers are removed. When a node is within reach, its sprite gets a cream Glow filter outline and a small E key cap floats above it, bobbing unless reduced motion is on. If the browser falls back to the Canvas renderer, only the E cap shows. The bottom HUD button stays as the touch target, labelled with the verb ("Chop pine tree").
4. **Actions take 6 s.** `GATHER_SECONDS = 6` in `state.js`, read through `gatherTime(state, node)`, so gathering tools can lower it later (target 0.5 s) in one place. The action clip loops for the whole duration, and a progress bar over the sprite replaces the E. A fresh movement key or touch-arrow press cancels and awards nothing. Key-repeat from a key held when E was pressed does not cancel. Pause and a hidden tab freeze the timer. When the bar fills, the targeted node (by id) awards its supplies.
5. **Animations.** Chopping uses the `build` row (an overhead swing; the art shows a hammer until an axe animation exists). Everything else uses `gather`.
6. **Map build stays stable.** `build-map.py` freezes the list the scatter loop has always used (`SCATTER_CLEAR`), so its random sequence never changes. `KEEP_CLEAR` holds the current spawns and nodes and only *removes* scenery within 150 units afterwards. With these positions it removes nothing, so `wildhaven.json` is byte-identical and no save can become unreadable.
7. **Berry bush art.** `objects/berry-bush.png` is a stand-in derived from `oak.png` (the crown squashed into a low shrub, with painted berries). `berry-bush.prompt.txt` holds the generation prompt for the real art; drop the generated PNG in and re-run `build-map.py`.

## Out of scope

Stumps or bare bushes after harvesting (the sprite fades out), gathering tools, repairing ("fixing") objects, making every tree or rock harvestable, and respawning supplies.
