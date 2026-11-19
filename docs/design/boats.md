# Boats and rowing sprite sources

[Open animation preview](boats-preview.html) · [Generation prompts and provenance](boats-manifest.json)

Created with the built-in image-generation tool using the approved character sheet. The repaired ship also references the existing wreck; every rowing sheet references the new empty rowboat.

| Asset | File | Layout |
| --- | --- | --- |
| Repaired sailing ship | [ship-repaired.png](../../assets/world/source/objects/buildings/ship-repaired.png) | 1312 × 1199, single sprite |
| Empty small rowboat | [rowboat.png](../../assets/world/source/objects/props/rowboat.png) | 1774 × 887, single sprite |
| Scout rowing | [scout-rowing.png](../../assets/characters/scout/scout-rowing.png) | Four 543 × 724 cells, one row |
| Builder rowing | [builder-rowing.png](../../assets/characters/builder/builder-rowing.png) | Four 543 × 724 cells, one row |
| Survivor rowing | [survivor-rowing.png](../../assets/characters/survivor/survivor-rowing.png) | Four 543 × 724 cells, one row |

Rowing frames run left to right: catch, drive, finish, recovery. Each frame includes the complete boat, seated character and two oars. All three sequences use an east-pointing bow and west-facing rower. Other directions are not included. The preview starts at 4 fps and supports pause and speed adjustment.

All five PNGs retain their generated full resolution and alpha. Each has a neighboring prompt sidecar. Final hull registration, scale, timing, collision and placement need tuning in the game; these are source sheets, not runtime boating mechanics. The original wreck remains available. The map build and stand-in generator were not run.
