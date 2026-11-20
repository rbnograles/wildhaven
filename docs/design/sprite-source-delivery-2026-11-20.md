# Sprite source delivery — 2026-11-20

33 selected source sheets, generated with the built-in image_gen tool. Exact generation/edit prompts sit beside each PNG as `.prompt.txt`. The [interactive preview](sprite-source-preview.html) plays each row and allows frame scrubbing; the [manifest](sprite-source-manifest-2026-11-20.json) records grids, dimensions and selected variants.

## Included
- All three player characters sleeping visibly inside the existing tent; four breathing poses each.
- Deer, boar and rabbit: idle, walking, running, and four-frame non-graphic dying sequences.
- Wolf: idle, walk, warning, attack, retreat, plus a six-frame non-graphic dying sequence.
- Snowy shore: six modular bank pieces; iron/copper loose chunks and ore nodes; forest/snow/canyon cave entrances.
- Three settlers: cardinal idle, east/south/north walk, carry, deposit, chopping, mining, sowing, tending, harvesting.
- Player sow/tend/harvest, wildlife repel, and north/south rowing; repaired ship north/east/south sailing.
- Wheat growth stages, shelter construction stages, chest opening/stock states, three settlement centre concepts, dropped haul and seven Pinefall keepsakes.

## Integration notes
These are source art, not new gameplay implemented by this delivery. Runtime crops, consistent pivots, scale and registrations still need preparation. Some settler states may already be consumed by concurrent game work; this inventory does not override that work.

The preview uses nominal equal-cell grids. Generated poses vary slightly in placement; do not assume all raw sheets can be loaded directly with one fixed runtime frame size. Keep body/feet or hull anchors stable when packing. Settler sow/harvest are front three-quarter views; most work poses and animals face east. Mirror east for west; animal north/south art is not included.

Tent sleeping frames include the entire tent and occupant; hide the normal tent and standing player while using them. Rowing frames include hull, occupant and both oars; do not draw a second boat underneath. Ship directions are north/east/south rows, with three sail phases each.

Dying plays once and holds the last frame. The keepsake sheet's final cell is deliberately blank. The three settlement centres are visual concepts, not a definition of tier costs or unlocks. Cave art supplies entrances only. Snow shoreline is a source kit and has not changed the live map bank generator.

Selected cleanup/padding variants are listed below; earlier draft PNGs are preserved. Use the selected filenames from the manifest.

## Selected files
| Source PNG | Columns × rows | Row contents |
| --- | --- | --- |
| [tent-sleeping-padded.png](../../assets/characters/states/tent-sleeping-padded.png) | 4 × 3 | scout sleep; builder sleep; survivor sleep |
| [deer-states.png](../../assets/creatures/deer/deer-states.png) | 4 × 4 | idle; walk; run; dying |
| [boar-states.png](../../assets/creatures/boar/boar-states.png) | 4 × 4 | idle; walk; run; dying |
| [rabbit-states.png](../../assets/creatures/rabbit/rabbit-states.png) | 4 × 4 | idle; walk; run; dying |
| [wolf-dying.png](../../assets/creatures/wolf/wolf-dying.png) | 6 × 1 | dying |
| [snow-ocean-bank-clean.png](../../assets/world/source/shorelines/snow-ocean-bank-clean.png) | 3 × 2 | straight horizontal / straight vertical / convex; concave / S curve / rounded tip |
| [iron-copper.png](../../assets/items/ores/iron-copper.png) | 2 × 2 | loose iron / loose copper; iron ore node / copper ore node |
| [cave-entrances.png](../../assets/world/source/landmarks/cave-entrances.png) | 3 × 1 | forest cave / snow cave / canyon cave |
| [players-repel.png](../../assets/characters/states/players-repel.png) | 4 × 3 | scout repel; builder repel; survivor repel |
| [shelter-construction-clean.png](../../assets/world/source/settlement/shelter-construction-clean.png) | 4 × 1 | foundation / frame / roof / finished |
| [stockpile-chest-states-clean.png](../../assets/world/source/settlement/stockpile-chest-states-clean.png) | 4 × 1 | closed / half open / empty / stocked |
| [settlement-centres.png](../../assets/world/source/settlement/settlement-centres.png) | 3 × 1 | camp / hamlet / village |
| [dropped-haul.png](../../assets/items/dropped-haul.png) | 2 × 1 | world bundle / map icon |
| [players-rowing-north.png](../../assets/characters/rowing/players-rowing-north.png) | 4 × 3 | scout rowing; builder rowing; survivor rowing |
| [players-rowing-south.png](../../assets/characters/rowing/players-rowing-south.png) | 4 × 3 | scout rowing; builder rowing; survivor rowing |
| [ship-sailing-directions.png](../../assets/world/source/settlement/ship-sailing-directions.png) | 3 × 3 | north; east; south |
| [settlers-idle.png](../../assets/characters/settlers/settlers-idle.png) | 4 × 3 | woodsworker directions; stoneworker directions; grower directions |
| [settlers-walk-east.png](../../assets/characters/settlers/settlers-walk-east.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-walk-south.png](../../assets/characters/settlers/settlers-walk-south.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-walk-north.png](../../assets/characters/settlers/settlers-walk-north.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-carry.png](../../assets/characters/settlers/settlers-carry.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-deposit.png](../../assets/characters/settlers/settlers-deposit.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-chop.png](../../assets/characters/settlers/settlers-chop.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-mine.png](../../assets/characters/settlers/settlers-mine.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-sow.png](../../assets/characters/settlers/settlers-sow.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-tend.png](../../assets/characters/settlers/settlers-tend.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [settlers-harvest.png](../../assets/characters/settlers/settlers-harvest.png) | 4 × 3 | woodsworker; stoneworker; grower |
| [players-sow.png](../../assets/characters/farming/players-sow.png) | 4 × 3 | scout; builder; survivor |
| [players-tend.png](../../assets/characters/farming/players-tend.png) | 4 × 3 | scout; builder; survivor |
| [players-harvest.png](../../assets/characters/farming/players-harvest.png) | 4 × 3 | scout; builder; survivor |
| [wheat-growth.png](../../assets/world/source/farming/wheat-growth.png) | 4 × 1 | tilled / seedling / growing / ripe |
| [pinefall-keepsakes.png](../../assets/items/keepsakes/pinefall-keepsakes.png) | 4 × 2 | notebook / feather / pinecone / moss pebble; antler / wind stone / skipping stone / empty |
| [wolf-states-clean.png](../../assets/creatures/wolf/wolf-states-clean.png) | 4 × 5 | idle; walk; warning; attack; retreat |

## Verification
All 33 selected PNGs decoded as RGBA with transparent pixels and matching prompt sidecars. All 33 loaded successfully in the browser preview. Tent and snowy shoreline transparency were visually checked over a terrain-colored backdrop. The preview is configured to hold dying clips at their final frame; that playback behavior was not separately confirmed in the UI. No gameplay test suite was run for this source-art delivery.

