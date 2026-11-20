# Sprite integration audit — 2026-11-20

Compared `docs/gdd.md`, the survival-settlement / big-world / archipelago specs, the actual source tree, sprite registries and generated assets. This is an inventory and recommended order, not an implementation of the planned systems. No gameplay files were changed for this audit.

## What “based on the story” means here

The GDD's section 5 defines discovery as the main fantasy and says there is no scripted narrative planned. Its intended progression is **explore → gather → campfire and shelter → recruit a settler → produce food → survive nights → establish another camp**, eventually camp → hamlet → village. Character backstories give three useful visual themes:

- **Scout:** discovering Pinefall and finding keepsakes.
- **Builder:** turning an abandoned place into a functioning settlement. Repairing houses is a fitting use of existing art, but the GDD does not yet define a house-repair system.
- **Survivor:** coastal travel and eventually repairing the big ship to reach other continents.

The code has advanced beyond the GDD in places: `src/data/journal.js` already contains a Pinefall field journal with seven short descriptions, keepsakes and clues. This is a limited prototype, not a complete quest or dialogue system.

## Existing art that is not yet used in gameplay

| Priority | Sprite set | Current evidence | Integration still needed |
| --- | --- | --- | --- |
| First | Three character rowing sheets | `assets/characters/{scout,builder,survivor}/*-rowing.png` exist. `src/render/renderer.js` still forces `idle` when aboard and crops the standing character into a separate boat. | Prepare frames and hull anchors; play rowing only while moving, hold a resting frame when stopped. Each generated frame includes **boat + character + oars**, so it must replace the current composite while aboard, otherwise two hulls/characters would be drawn. Art only supplies an east-pointing hull; mirror west and resolve north/south presentation. |
| M3 | Storage chest | `assets/world/source/originals/props/storage-chest.png` exists; no stockpile entry in `objects.json` or building logic. | Prepare a clean game sprite and footprint, then connect to a placeable stockpile and worker delivery destination. The existing inventory panel does not implement a world stockpile. An open-lid state is optional polish. |
| M3 | Repaired house | `assets/world/source/originals/buildings/house-repaired.png` exists; only `house-a/b/c`, `workshop` and `tent` are registered scenery. | Can support a shelter or a visible settlement upgrade. Needs a defined building role, costs, placement, save state and matching before/after alignment. Do not treat static village houses as functional shelters. |
| M3 | Attack reaction and fighting | `hurtAttack` and `fight` are registered character clips, but no live enemy/combat flow triggers them. | Connect to wolf warning/attack/repel rules when that system exists. Review whether the generic fight motion reads as the intended repel action before reusing it. |
| A2 | Repaired sailing ship | `assets/world/source/originals/buildings/ship-repaired.png` exists. The registered `ship` is the wreck, and `src/actions/boat.js` handles small boats only. | Prepare ship scale/pivot/collision, directional sailing presentation and a repair transition. Needs big-ship ownership, deep-water travel and save support; this is more than swapping a PNG. |
| Polish | Footprints, tree-base blends and path sheets | Sources exist under `effects/` and `paths/`; no matching use was found in runtime or the map-building pipeline. | Footsteps need placement/fading; base blends need correct ground layering; paths need connected edges/tiles and placement. These improve scenery but do not unlock the settlement progression. |
| Deferred | Swimming | Character `swim` art exists in the action sheets and preview. | Swimming is explicitly outside archipelago A1. Do not activate it as a shortcut around the boat progression without changing the design. |

The painted bridge is **already integrated** through `tools/prepare-sprite-art.py` into `objects/props/bridge.png`, with fixed bridge placement in `tools/build-map.py`; it is not an outstanding asset.

## Missing art for the next progression steps

The states below are proposed minimum art sets to make the GDD's behavior readable. The GDD specifies systems, not exact animation counts or crop species.

| System / GDD basis | Minimum useful sprites | Existing material / dependency |
| --- | --- | --- |
| Shelter, §6.10 | Placeable shelter and recognizable finished state; a construction state if construction takes time | Existing tent can be reused for a first shelter. Repaired cottage can support a later upgrade. Neither is currently a functional shelter. New housing art is not a prerequisite if the tent is reused. |
| Farm, §6.10–6.11 | Empty/tilled plot, planted or seedling state, growing crops, harvest-ready crops; sowing/tending/harvest action | Soil texture exists, but no dedicated crop-stage or farming character sprite set was found. Choose a crop before drawing a whole crop catalog. Worker assignment and production are also unimplemented. |
| Settlers, §6.11 | Up to three distinguishable recruitable NPCs: idle, walk, carry resources, deposit, and work poses | No settler/NPC sprite set found. Woodcutting/mining motions can share the player animation structure, but NPC appearance must be supplied. Farming needs its own work poses. Recruitment, travel, job assignment and blocked-work feedback are still systems work. |
| Wolves and repel, §6.9 | Wolf idle/patrol, warning, approach/run, attack and retreat; readable player repel motion | No wolf assets found. Existing `fight` and `hurtAttack` provide possible player-side starting points. Warning/retreat matter more than a wolf death animation for the stated non-graphic, recoverable survival design. |
| Settlement tiers, §3 / M3 | Visible camp → hamlet → village changes | Houses/workshop exist as scenery, and a repaired house source exists. Decide what unlocks each tier before producing additional buildings, banners or upgrade states. Town/city art is beyond the currently scoped content list. |
| Dropped trip haul, §3 / M3 | Dropped supplies bundle or bag; recognizable map symbol | No dedicated dropped-haul sprite found. This requires the carried-today tally and reclaim rules; it should look distinct from permanent stockpile storage. |
| Discovery keepsakes, big-world build 2 + current Pinefall journal | Trail notebook, owl feather, giant pinecone, moss-green pebble, shed antler, wind-polished stone, flat skipping stone | All seven names already exist in `src/data/journal.js`. `src/ui/journal.js` currently displays existing scenery images: tent, log, pines, rocks, dead bush, cliff rock and beach rock. Dedicated keepsake icons are a concrete art improvement for content that already works. They need not become world pickups unless that mechanic is added. |
| Biome gear and locals, big-world builds 3–4 | Readable cold/heat protection gear and region-specific stationary NPCs | These are later systems. No dedicated protective-gear or local-NPC sets found. Clothing variants should follow actual equipment rules; do not assume seven full character wardrobes are necessary. |

## Existing mechanics with optional animation polish

- **Eat, heal, brew/drink tea:** these actions already change game state through `src/actions/camp.js`, but there are no dedicated character clips. Eating, bandaging/applying herbs and drinking poses would strengthen the daily camp routine. These animations are recommendations, not missing GDD mechanics.
- **Hammer material:** boat repair uses `build`, tool crafting uses `craft`. Static stone/iron hammer holding poses exist, but there are no dedicated material-specific hammer swing sequences. Useful after the new axe/pickaxe tier art if visible tool consistency is desired.
- **Harvest reactions across biomes:** `assets/world/animations/animations.json` has dedicated fall/break sheets for `oak`, `pine` and `rocks-a`. Other tree/rock variants lack matching fall/fracture art. Add palm, snowy pine, jungle tree, boulder and iron/ice-rock variants as polish; gathering already works without bespoke destruction sheets for every species.
- **Remaining biome stand-ins:** snow/rock/jungle ground and several biome trees/rocks/plants are documented stand-ins. Replacing those is art-quality work, separate from adding the missing settlement systems.

## Already connected — do not regenerate just to integrate

- Idle, cardinal and diagonal walking/running.
- Generic gathering, boat-repair building and tool crafting.
- Stone/iron axe chopping and stone/iron pickaxe mining for all three characters.
- Hungry idle, starvation discomfort, cold reaction, six-frame collapse, sleep and waking. The GDD's gentle hunger rule does **not** mean starvation alone drains health; the hunger reaction is visual discomfort.
- Animated campfire, oak/pine falling and rock breaking for the registered variants.
- River/lake/sea overlays, painted bridge, old boats and the small rowboat.
- Regenerated berry bush, cactus, sandstone ruin, driftwood, old boat, rowboat and signpost.

## Recommended order

1. **Finish existing gameplay presentation:** rowing integration; seven proper Pinefall keepsake icons. Optional eat/heal/tea poses after these.
2. **Make the settlement promise playable:** reuse the tent as shelter, prepare the chest as stockpile, create one crop's stages and the farming/settler animations, then implement the connected shelter → recruit → work → produce loop.
3. **Add gentle threats:** wolf states plus player repel/attack reaction integration. Keep the warning and fire-retreat behavior promised by the GDD.
4. **Show growth:** visible hamlet/village upgrades and dropped-haul retrieval.
5. **Expand the Survivor route:** repaired big ship, directional sailing and the next continent, once A2 is scheduled. The GDD leaves A2 versus M3 ordering open; this order is a recommendation, not an approved milestone change.

## GDD statements to reconcile

- §6.2 says rocks still use `build`: they now use `mine` / `mineIron`; axes use `chop` / `chopIron`.
- §6.6 says craft is preview-only and omits diagonal and survival animations; those are now live. Fight/swim remain preview-only, and attack damage has no live enemy trigger.
- §5 says no written narrative exists anywhere; the Pinefall prototype journal now exists in code.
- §2 still calls fixed supplies finite/one-time, contradicting later regrowth sections and current code.
- §3 / the Big World change record retain the old first-footsteps objective, while §6.20 and current HUD use campfire-first guidance.
- Save-version references still say 5 in places; `src/game/state.js` currently uses version 6.
- Some art-delivery docs still say “not integrated” for assets now wired in. Several original source files, including repaired house/ship and the chest, now live under `source/originals/`, not their old delivery paths.

These observations came from static source/asset inspection. No gameplay tests were rerun for this documentation-only audit.
