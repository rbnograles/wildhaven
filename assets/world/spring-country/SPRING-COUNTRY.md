# Spring country — Tiled authoring map

Open **spring-country.tmj** in Tiled. It is a complete, separate country layout, based on the original arranged Wildhaven geography and rebuilt as a single temperate Spring biome. The original arranged map and active game map are preserved.

## Country and scale

- 448 × 320 tiles; 64 × 64 pixels per tile; 28,672 × 20,480 world units.
- One biome, with meadows, oak/pine woodland, ordinary stone quarries, rivers, ponds, beaches, offshore islands and forest cave entrances. Terrain is flat; this map has no elevation/cliff collision system.
- One major town, Hollowstead, with 13 buildings and a well; seven smaller villages with four buildings and a well each: Pinefall Camp, Blossom Crossroads, Stonebrook Hamlet, Alder Rest, Driftwood Landing, Greenbough Camp and Willowbank.
- New town hall, inn, market building, barn and well art, plus horizontal and vertical wooden fences. The settlements use 153 fence segments with 32 open, reachable gates. Hollowstead has a central plaza, residential streets, workshops and a road around the town hall.
- Scale reference: a 76px character. Houses are 250–290px tall, trees 210–315px, ordinary rock clusters about 105px, rabbits 24px, deer 80px, boars 48px and wolves 52px. Sprite aspect ratios are preserved. Building footprints leave clear entrances and streets.
- Existing east-bay zigzag land artifacts are removed. Water expands by two corner-grid cells (128px) along each bank, widening rivers and lakes. Bridges are enlarged proportionally to span the wider crossings. Willowbank is relocated inland to keep its village and gates dry.
- Six diagonal country routes join the town streets using a shared dirt corner-terrain layer. The exported map has 9,585 path tiles with no mismatched shared corners.

## Survival layout

**No iron, copper, gold or diamond deposits.** Spring contains wood, ordinary stone, food and herbs. Trees/large stones carry axe/pickaxe requirements; loose sticks, small stones, berries and flowers can be gathered by hand. These are authored gameplay properties, not running simulation inside Tiled.

Reachable supplies within 1,000 world units of each start:

| Start | Wood | Stone | Food | Herbs |
|---|---:|---:|---:|---:|
| Scout | 16 | 12 | 8 | 6 |
| Builder | 16 | 12 | 20 | 6 |
| Survivor | 14 | 13 | 7 | 16 |

There are settlement resupply pockets, three crop areas, four stone quarry areas and 24 rabbit/deer/boar habitat markers. Four wolf dens sit at least 2,000 units from all starts. Hunting habitats are at least 1,400 units from starts and 950 units from settlements. Cave entrances are shelter/exploration landmarks with no mineral deposits. Four disabled sea-route markers reserve travel to future countries.

Bare-hand supplies have 720-second regrowth metadata; tool-harvested resources and wildlife habitats generally use 1,080 seconds. Balance is an authored first pass. Actual hunger timing, harvest simulation, combat and respawns require runtime integration/playtesting.

## Editing

Use the existing external TSX files; keep their relative paths intact:

- `../tiled/terrain-redrawn.tsx`: layered corner terrain sets; use its dirt terrain on `Paths - diagonal trails and town streets` for connected diagonal roads.
- `../tiled/path-connectors.tsx`: optional legacy edge-connected trails, retained for manual editing.
- `spring-country-objects.tsx`: individual scenery and wildlife preview images.

Terrain, connected paths, ground details/bridges, scenery, forage and wildlife each have separate editable layers. Turn on **Gameplay markers - show to edit** to inspect starts, settlements, quarries, landmarks, habitats, dens and future exits. Object custom properties record resource amounts/tools/regrowth, ground contact points and solid base dimensions where applicable. Wildlife art shows one representative animal per habitat; the marker contains the intended group count.

Save a manually edited version under a different name before rebuilding. The generator overwrites `spring-country*` outputs, including detail samples.

## Verification and integration boundary

The builder checks dry resource positions, actual exported trail ports, minimum reachable starter supplies and settlement connectivity. Reachability uses a 32px grid with a 12px character radius, solid object bases and bridge decks; it is an authoring approximation, not an in-game movement test. All three starts and eight settlements share traversable terrain.

The expanded map opened in native Tiled. The full overview and seven detail crops were rendered through Tiled's rasterizer. Town, village, diagonal-route and river-crossing previews were visually inspected. Three focused tests pass, including deliberately broken edge-port and corner-terrain cases. All 32 village gates are reachable; resource positions are dry. Forage renders below scenery and new supply placement avoids building roofs.

New art was generated with the built-in image-generation tool. Exact prompts and source provenance are recorded in `../tiled/source/spring-town-generation.json`; prepared transparent sprites are in `spring-country-art`. The pre-expansion map and object tileset are retained as `spring-country-before-town-expansion*` backups.

The country is **not yet the active game map**. Country switching, wildlife/resource loading and collision import remain runtime integration work. Do not use the existing seven-region importer directly on this map: it expects a different tileset/layer contract.

Rebuild and check from the repo root:

```powershell
python tools/build-spring-country.py
python -m unittest discover -s tests/tools -p test_spring_country.py
& 'D:/tmxrasterizer.exe' --size 2400 assets/world/spring-country/spring-country.tmj assets/world/spring-country/spring-country-overview.png
```

`spring-country-report.json` contains the exact object/resource counts and checks: 17,414 objects and 9,739 resource nodes for this expansion. `spring-country-overview.png` is the full-map preview. Seven `spring-country-detail-*.tmj` files and matching PNGs show the three starts, main town, small village, diagonal trails and river crossing.
