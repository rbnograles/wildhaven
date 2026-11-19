# Wildhaven art direction

The first screen uses parchment, forest-green ink, large serif typography, and three illustrated character panels. The generated concept is a composition reference; all UI text, buttons, selection states, and gameplay are real HTML/CSS/JavaScript.

## Assets

| File | Purpose |
| --- | --- |
| `docs/design/character-selection-concept.png` | Initial full-screen composition reference |
| `assets/characters/starting-characters-idle-v1.png` | Approved three-character, four-direction sprite atlas |
| `assets/world/starting-regions.png` | Three portrait backgrounds, sliced at render time with CSS |
| `assets/world/wildhaven.png` | Archived original world painting; no longer the playable map |
| `assets/world/source/{grass,dirt,sand,water}.png` | Four independently generated repeating ground textures |
| `assets/world/source/objects/*.png` | Sixteen independently generated transparent world sprites, plus the `berry-bush.png` stand-in |
| `assets/world/source/objects.json` | Ground-contact origins and solid base footprints for the new art |
| `assets/world/map/` | Built terrain atlas, Tiled JSON, and minimap overview |

All generated imagery was produced with the built-in image-generation tool. The current world uses 96 by 64 tiles at 64 pixels each (6144 by 4096 world units). Ground textures repeat at 256 pixels after the map build resizes them. Objects render separately and sort by their ground-contact position. Character sprites are read as a four-column, three-row atlas with a consistent foot anchor.

The 2026-11-19 world replacement used `assets/characters/starting-characters-idle-v1.png` as the style reference for every generation. Exact prompts sit beside each source PNG; `source/generation-manifest.json` records generation and revision prompts. Selected full-resolution generated PNGs are preserved in `source/originals/`. Object delivery files are proportionally fitted to the requested canvas dimensions, with four pixels of transparent padding, using alpha-visible bounds. No painted scenery is cut out of the old world painting. Run `python tools/build-map.py` after source changes; never rerun `tools/make-standin-art.py`, which overwrites these assets.

Exact prompts are in `docs/design/character-selection.prompt.txt`, `docs/design/world.prompt.txt`, `docs/design/starting-regions.prompt.txt`, and `assets/characters/starting-characters-idle-v1.prompt.txt`.

## Concept comparison

| Point | Reference | Implementation / decision |
| --- | --- | --- |
| Composition | Brand header, centered title, three choices, character description and CTA | Same structure; native layout fits 1280x720 and adapts at 390px |
| Palette | Warm parchment, green ink and green CTA | Retained; restrained borders and single action color |
| Typography | Large editorial serif headline with serif character titles | Retained; compact sans-serif utility copy for readability |
| Artwork | Characters standing in three environments | Original approved sprites layered over separately generated matching scenes |
| Image proportions | Natural, unwarped scenery | Fixed the initial compressed backgrounds with proportional atlas sizing and cropping |
| Selected state | Green outline and checkmark | Native pressed state with visible outline and checkmark |
| Responsive | Desktop primary screen | Compact three-column choices and stacked action area; no horizontal overflow at 390px |
| Gameplay | Separate playable surface required by the user | Full-screen world with small corner HUDs, minimap, pause and map dialogs |

Intentional adaptations from the concept: condensed typography and illustrations for laptop height; shorter descriptive text; starting-kit details; saved-adventure CTA and fresh-start control; native keyboard focus outlines. These support the requested usable browser flow. Generated mockup text was not used as a screenshot interface.

The world uses generated raster art. Code draws map dots, a small character contact shadow, terrain transitions, and the supply cues (the glow outline, E key cap and progress bar).

`objects/berry-bush.png` is **not generated art**. It is a stand-in derived from `oak.png`: the crown squashed into a low shrub, bark recoloured to foliage, and small berry clusters painted on. The script is in `docs/superpowers/plans/2026-11-19-harvestable-supplies.md`. `berry-bush.prompt.txt` holds the prompt for the real sprite. Generate it with the usual style reference, save it over the stand-in at about 150×104, check `origin`/`footprint` in `objects.json`, and re-run `python tools/build-map.py`. Characters have separate idle, walking, running, and gathering art. The terrain repeat check, object contact sheet, full-map preview, and in-game checks are retained in `docs/screenshots/`.

## Big-world biome stand-ins (2026-11-19)

Made by `tools/make-biome-standins.py` from existing art, so the 384×256 world could be built before real art exists. Each file has a `.prompt.txt` beside it with the prompt for the real version; generate it, save it over the PNG and re-run `tools/build-map.py`.

| File | Stand-in made from | Used for |
| --- | --- | --- |
| `source/snow.png` | grass, greyed and brightened | Frostpeak ground |
| `source/rock.png` | dirt, greyed | Stonewater Canyons ground |
| `source/jungle.png` | grass, darkened | Emerald Jungle ground |
| `objects/snowy-pine.png` | pine, frosted tint | Frostpeak trees |
| `objects/ice-rock.png` | rocks-b, blue tint | Frostpeak rocks |
| `objects/boulder.png` | rocks-a, grey | Canyons and Frostpeak |
| `objects/cliff-rock.png` | rocks-a, stretched taller, dark grey | Canyon outcrops and lookouts |
| `objects/jungle-tree.png` | big-oak, deep green | Jungle trees |
| `objects/fern.png` | berry-bush, green | Jungle undergrowth (walk-through) |
| `objects/palm.png` | oak, narrowed, yellow-green | Lagoon and jungle (weakest stand-in) |
| `objects/dead-bush.png` | berry-bush, brown | Desert and canyons |
| `objects/cactus.png` | drawn from rounded rectangles | Desert |
| `objects/sandstone-ruin.png` | drawn from rectangles | Desert ruins, jungle temple |
| `objects/bridge.png` | drawn plank deck (flat) | River bridges |
| `objects/signpost.png` | drawn post and arrow board | Fast-travel signposts |
