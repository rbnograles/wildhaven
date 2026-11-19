# Buildings, water and tools — generated sprite sources

Created with the built-in image-generation tool, using the approved character reference for every image. The repaired cottage additionally references the existing house-a; character equipment sheets reference the new tool sheet.

[Open water-animation and art preview](water-tools-preview.html). [Full prompts and provenance](water-tools-manifest.json). Each PNG has its prompt in a neighboring .prompt.txt file.

| File | Layout | Contents |
| --- | --- | --- |
| [house-repaired.png](../../assets/world/source/objects/buildings/house-repaired.png) | Single sprite | Repaired house-a, complete roof, windows, timber and doorway |
| [bridge-painted.png](../../assets/world/source/objects/props/bridge-painted.png) | Single sprite | Horizontal wooden footbridge, deck and railings |
| [water-ripples-loop.png](../../assets/world/source/animations/water-ripples-loop.png) | 4 columns × 3 rows | Four phases per row: river current, lake ripples, ocean waves |
| [river-bank.png](../../assets/world/source/shorelines/river-bank.png) | 3 × 2 | Soil, exposed roots and damp river edge |
| [lake-bank.png](../../assets/world/source/shorelines/lake-bank.png) | 3 × 2 | Loam, moss, pebbles and reeds |
| [ocean-bank.png](../../assets/world/source/shorelines/ocean-bank.png) | 3 × 2 | Sandy soil, beach sand, wet margin and foam |
| [tools-stone-iron.png](../../assets/items/tools-stone-iron.png) | 2 × 2 | Top: stone hammer, iron hammer. Bottom: stone pickaxe, iron pickaxe |
| [scout-holding-tools.png](../../assets/characters/scout/scout-holding-tools.png) | 4 × 4 | Four tools from four directions |
| [builder-holding-tools.png](../../assets/characters/builder/builder-holding-tools.png) | 4 × 4 | Four tools from four directions |
| [survivor-holding-tools.png](../../assets/characters/survivor/survivor-holding-tools.png) | 4 × 4 | Four tools from four directions |

Character sheet columns: stone hammer, iron hammer, stone pickaxe, iron pickaxe. Rows: south/front, west/left, east/right, north/back. These are stationary equipment poses, not tool-swing animations.

Bank pieces in reading order: horizontal straight, vertical straight, outer curve, inner curve, S curve, rounded tip. Corners and strip endpoints are generated source shapes; crop, align and adjust their edges when assembling a continuous shoreline. They are not a verified seamless autotile set.

Water is an alpha overlay for existing water ground textures, not a replacement ground tile. The preview loops each row at an adjustable frame rate. Final frame placement, pivots, scaling and loop timing should be tuned in the engine.

All ten PNGs were checked as readable RGBA images with transparent pixels. Full generated resolution and original alpha are preserved. Small low-alpha edge pixels remain from generation. Existing world objects and gameplay code were not replaced; new buildings still need placement and collision metadata during integration. The map build and stand-in generator were not run.

