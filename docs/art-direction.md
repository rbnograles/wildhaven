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
| `assets/world/source/objects/*.png` | Sixteen independently generated transparent world sprites |
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

The world uses generated raster art. Code draws UI markers, map dots, a small character contact shadow, and terrain transitions. Characters have separate idle, walking, running, and gathering art. The terrain repeat check, object contact sheet, full-map preview, and in-game checks are retained in `docs/screenshots/`.
