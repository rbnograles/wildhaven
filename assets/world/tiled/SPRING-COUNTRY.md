# Spring country — Tiled authoring map

Open **spring-country.tmj** in Tiled. It is a complete, separate country layout, based on the original arranged Wildhaven geography and rebuilt as a single temperate Spring biome. The original arranged map and active game map are preserved.

## Country and scale

- 448 × 320 tiles; 64 × 64 pixels per tile; 28,672 × 20,480 world units.
- One biome, with meadows, oak/pine woodland, ordinary stone quarries, rivers, ponds, beaches, offshore islands and forest cave entrances. Terrain is flat; this map has no elevation/cliff collision system.
- Eight settlements: Hollowstead, Pinefall Camp, Blossom Crossroads, Stonebrook Hamlet, Alder Rest, Driftwood Landing, Greenbough Camp and Willowbank.
- Scale reference: a 76px character. Houses are 250–290px tall, trees 210–315px, ordinary rock clusters about 105px, rabbits 24px, deer 80px, boars 48px and wolves 52px. Sprite aspect ratios are preserved. Building footprints leave clear entrances and streets.
- Existing east-bay zigzag land artifacts are removed. Foot trails use the corrected connecting tile set; bridge sprites preserve their rotation and connect river crossings.

## Survival layout

**No iron, copper, gold or diamond deposits.** Spring contains wood, ordinary stone, food and herbs. Trees/large stones carry axe/pickaxe requirements; loose sticks, small stones, berries and flowers can be gathered by hand. These are authored gameplay properties, not running simulation inside Tiled.

Reachable supplies within 1,000 world units of each start:

| Start | Wood | Stone | Food | Herbs |
|---|---:|---:|---:|---:|
| Scout | 16 | 12 | 8 | 6 |
| Builder | 16 | 12 | 20 | 6 |
| Survivor | 16 | 13 | 8 | 14 |

There are settlement resupply pockets, three crop areas, four stone quarry areas and 24 rabbit/deer/boar habitat markers. Four wolf dens sit at least 2,000 units from all starts. Hunting habitats are at least 1,400 units from starts and 950 units from settlements. Cave entrances are shelter/exploration landmarks with no mineral deposits. Four disabled sea-route markers reserve travel to future countries.

Bare-hand supplies have 720-second regrowth metadata; tool-harvested resources and wildlife habitats generally use 1,080 seconds. Balance is an authored first pass. Actual hunger timing, harvest simulation, combat and respawns require runtime integration/playtesting.

## Editing

Use the existing external TSX files; keep their relative paths intact:

- `terrain-redrawn.tsx`: layered corner terrain sets.
- `path-connectors.tsx`: edge-connected trails.
- `spring-country-objects.tsx`: individual scenery and wildlife preview images.

Terrain, connected paths, ground details/bridges, scenery, forage and wildlife each have separate editable layers. Turn on **Gameplay markers - show to edit** to inspect starts, settlements, quarries, landmarks, habitats, dens and future exits. Object custom properties record resource amounts/tools/regrowth, ground contact points and solid base dimensions where applicable. Wildlife art shows one representative animal per habitat; the marker contains the intended group count.

Save a manually edited version under a different name before rebuilding. The generator overwrites `spring-country*` outputs, including detail samples.

## Verification and integration boundary

The builder checks dry resource positions, actual exported trail ports, minimum reachable starter supplies and settlement connectivity. Reachability uses a 32px grid with a 12px character radius, solid object bases and bridge decks; it is an authoring approximation, not an in-game movement test. All three starts and eight settlements share traversable terrain.

The map opened in native Tiled with all assets resolved. The full overview and three starter crops were rendered through Tiled's rasterizer and visually inspected. Both focused tests pass, including a deliberately broken path-port case. Forage renders below scenery and new supply placement avoids building roofs.

The country is **not yet the active game map**. Country switching, wildlife/resource loading and collision import remain runtime integration work. Do not use the existing seven-region importer directly on this map: it expects a different tileset/layer contract.

Rebuild and check from the repo root:

```powershell
python tools/build-spring-country.py
python -m unittest discover -s tests/tools -p test_spring_country.py
& 'D:/tmxrasterizer.exe' --size 2400 assets/world/tiled/spring-country.tmj assets/world/tiled/spring-country-overview.png
```

`spring-country-report.json` contains the exact object/resource counts and checks. `spring-country-overview.png` is the full-map preview; the three `spring-country-detail-*.tmj` files are small starter-area inspection maps.
