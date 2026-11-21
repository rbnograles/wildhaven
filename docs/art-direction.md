# Wildhaven art direction

## Diagonal locomotion sprites (2026-11-19)

`assets/characters/diagonal/` adds northeast (rear three-quarter) and southeast (front three-quarter) walk/run sheets for the Scout, Builder and Survivor. Walk sheets have four columns; run sheets have six; each has three character rows. Northwest and southwest reuse them with horizontal mirroring. Created with the built-in image-generation tool and the approved starting-character atlas as the identity/style reference. Exact prompts and frame metadata are in the same folder. Gameplay integration remains separate.

## Survival state sprites (2026-11-19)

`assets/characters/states/` adds seven transparent, four-column, three-row animation sheets matching the approved Scout, Builder, and Survivor: dying, sleeping, waking to standing, hungry, hunger damage, cold damage, and attack damage. Generated with the built-in image-generation tool using the approved starting-character atlas as the identity/style reference. Exact prompts sit beside each PNG; the folder README and manifest describe playback and frame layout. These are delivered art assets, not implemented gameplay animations.

The first screen uses parchment, forest-green ink, large serif typography, and three illustrated character panels. The generated concept is a composition reference; all UI text, buttons, selection states, and gameplay are real HTML/CSS/JavaScript.

## Assets

| File | Purpose |
| --- | --- |
| `docs/design/character-selection-concept.png` | Initial full-screen composition reference |
| `assets/characters/originals/starting-characters-idle-v1.png` | Approved three-character, four-direction sprite atlas |
| `assets/world/starting-regions.png` | Three portrait backgrounds, sliced at render time with CSS |
| `assets/world/wildhaven.png` | Archived original world painting; no longer the playable map |
| `assets/world/source/ground/{grass,dirt,sand,water}.png` | Four independently generated repeating ground textures (`snow`, `rock` and `jungle` beside them are stand-ins) |
| `assets/world/source/objects/<kind>/*.png` | Sixteen independently generated transparent world sprites, the SpriteCook palm, plus stand-ins, in kind folders: `trees/`, `plants/`, `rocks/`, `buildings/`, `props/` |
| `assets/world/source/objects.json` | Each sprite's kind folder, ground-contact origin and solid base footprint |
| `assets/world/map/` | Built terrain atlas, Tiled JSON, and minimap overview |

All generated imagery was produced with the built-in image-generation tool. The current world uses 96 by 64 tiles at 64 pixels each (6144 by 4096 world units). Ground textures repeat at 256 pixels after the map build resizes them. Objects render separately and sort by their ground-contact position. Character sprites are read as a four-column, three-row atlas with a consistent foot anchor.

The 2026-11-19 world replacement used `assets/characters/originals/starting-characters-idle-v1.png` as the style reference for every generation. Exact prompts sit beside each source PNG; `source/generation-manifest.json` records generation and revision prompts. Selected full-resolution generated PNGs are preserved in `source/originals/<kind>/` (`ground/` plus the object kinds). Object delivery files are proportionally fitted to the requested canvas dimensions, with four pixels of transparent padding, using alpha-visible bounds. No painted scenery is cut out of the old world painting. Run `python tools/build-map.py` after source changes; never rerun `tools/make-standin-art.py`, which overwrites these assets.

Exact prompts are in `docs/design/character-selection.prompt.txt`, `docs/design/world.prompt.txt`, `docs/design/starting-regions.prompt.txt`, and `assets/characters/originals/starting-characters-idle-v1.prompt.txt`.

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

`objects/plants/berry-bush.png` now uses independently generated painted art, replacing the old recoloured and compressed oak stand-in. Its game canvas remains 150×104. Characters have separate idle, walking, running, and gathering art. The terrain repeat check, object contact sheets, full-map preview, and in-game checks are retained in `docs/screenshots/`.

## Big-world biome stand-ins (2026-11-19)

Made by `tools/make-biome-standins.py` from existing art, so the 384×256 world could be built before real art exists. Each file has a `.prompt.txt` beside it with the prompt for the real version; generate it, save it over the PNG and re-run `tools/build-map.py`.

| File | Stand-in made from | Used for |
| --- | --- | --- |
| `source/ground/snow.png` | grass, greyed and brightened | Frostpeak ground |
| `source/ground/rock.png` | dirt, greyed | Stonewater Canyons ground |
| `source/ground/jungle.png` | grass, darkened | Emerald Jungle ground |
| `objects/trees/snowy-pine.png` | pine, frosted tint | Frostpeak trees |
| `objects/rocks/ice-rock.png` | rocks-b, blue tint | Frostpeak rocks |
| `objects/rocks/boulder.png` | rocks-a, grey | Canyons and Frostpeak |
| `objects/rocks/cliff-rock.png` | rocks-a, stretched taller, dark grey | Canyon outcrops and lookouts |
| `objects/trees/jungle-tree.png` | big-oak, deep green | Jungle trees |
| `objects/plants/dead-bush.png` | berry-bush, brown | Desert and canyons |
| `objects/props/bridge.png` | drawn plank deck (flat) | River bridges |
| `source/ground/deep.png` | stand-in from `tools/make-biome-standins.py`; real prompt in its `.prompt.txt` | Deep sea (archipelago A1) |

### Replaced stand-ins

The seven deleted placeholder sprites were regenerated with the built-in image-generation tool on 2026-11-19. The character atlas, painted log and tent supplied the style reference. Each replacement has a fresh exact prompt next to it; full-resolution originals and prompts are preserved at `source/originals/<kind>/<name>-regenerated-v1.*`. `docs/design/regenerated-world-sprites.json` records prompts, paths, source bounds and preparation. Game canvases, origins and collision footprints retain their existing sizes and values.

| Replacement | Game canvas | New artwork |
| --- | --- | --- |
| `objects/plants/berry-bush.png` | 150×104 | Layered leafy shrub with visible red berry clusters |
| `objects/plants/cactus.png` | 110×170 | Ribbed saguaro with two uneven curved arms |
| `objects/buildings/sandstone-ruin.png` | 280×220 | Weathered masonry, broken lintel and cracked foundation |
| `objects/props/driftwood.png` | 150×70 | Three water-worn branches with natural wood grain |
| `objects/props/old-boat.png` | 200×90 | Weathered repairable hull with broken planks |
| `objects/props/rowboat.png` | 200×90 | Sound warm-brown hull with two bench seats |
| `objects/props/signpost.png` | 90×130 | Blank wooden arrow with carved edges and fasteners |

- `objects/trees/palm.png` (lagoon and jungle) was the weakest stand-in: an oak, narrowed and tinted. On 2026-11-19 it was replaced with real art generated by **SpriteCook** (Claude plugin, model `gemini-nano-banana-2.1`, HD, transparent background), with `starting-characters-idle-v1.png` uploaded as the style guide image. The full-size result is in `source/originals/trees/palm.png`; the game sprite is cropped to its alpha bounds and fitted into 200×300 with 4 px padding. Its trunk leans so the base sits right of centre, so its `origin` is `[0.765, 0.982]` and its `footprint` `[15, 12]`. The prompt and settings are in `palm.prompt.txt` and `source/generation-manifest.json`. `tools/make-biome-standins.py` still lists the palm but skips it because the file exists. SpriteCook's Free plan made this image public in its gallery.

## Nano Banana ground detail and cliff kits (2026-11-19)

Generated by the user with Nano Banana (Gemini) from prompts written in this repo's style, with `starting-characters-idle-v1.png` attached as the style reference. Nano Banana cannot paint real transparency, so every sprite was drawn on flat magenta. The full pictures and their prompts are kept in `source/originals/<kind>/` (`.jpg`), and `python tools/prepare-generated-art.py` keys out the magenta (alpha from the distance to the background colour, then the magenta share taken back out of half-solid edge pixels), drops background specks, trims, and fits each one to its game size.

| File | From | Used for |
| --- | --- | --- |
| `objects/plants/grass-tuft.png` (40 units tall) | `originals/plants/grass-tuft.jpg` | Meadows, Pinefall, lagoon grass, canyons |
| `objects/plants/tall-grass.png` (70 units tall) | `originals/plants/tall-grass.jpg` | Meadows, Pinefall, lagoon grass |
| `objects/plants/dry-grass.png` (50 units tall) | `originals/plants/dry-grass.jpg` | Desert, canyons, lagoon sand, a little on the sea beach |
| `objects/plants/snow-grass.png` (40 units tall) | `originals/plants/snow-grass.jpg` | Frostpeak |
| `objects/props/dirt-patch.png` (200 units wide, flat) | `originals/props/dirt-patch.jpg` | Bare patches on meadow and Pinefall grass |
| `ground/soil.png` | `originals/ground/soil.jpg`, edges blended to repeat | Forest soil under Pinefall pines and in the middle of meadow groves |
| `cliffs/{meadow,canyon,snow}.png` | `originals/cliffs/<kit>.jpg` (canyon and snow are edits of meadow, so all three share one layout) | The hill tiles: `build-map.py` cuts the wall, its end pieces and the lips from them |
| `objects/props/{meadow,canyon,snow}-stairs.png` | the same cliff pictures, steps column only | One flight of stairs per hill level |

The grass and dirt patch are scattered in their own pass on a 150-unit grid, with their own seeds, so the existing trees did not move. `originals/cliffs/meadow-block.jpg` and `meadow-wall.jpg` are kept but not used: the model drew grid lines across the top and panel lines in the wall, which read as square tiles. The thin tips of the tall and dry grass keep a faint pink edge from the magenta; it barely shows on grass and sand.

## Stone and iron tool swings (2026-11-20)

Added four transparent source sheets in `assets/characters/tools/`: stone pickaxe, iron pickaxe, stone axe and iron axe. Each contains Scout, Builder and Survivor in rows with ready/windup/strike/recovery columns. Built-in image generation used the existing character and equipment art as references; exact prompts are beside the PNGs.

`tools/prepare-tool-swings.py` packs twelve game strips in the individual character folders, with four padded 512×512 cells and aligned boot anchors. The renderer uses the owned tool tier while mining or chopping. East is drawn; west is mirrored. All four clips can be inspected in Preview animations. See `assets/characters/tools/README.md` for the inventory and regeneration command.

## Gold and diamond weapon art is a placeholder (2026-11-21)

Weapons now have four tiers (stone, iron, gold, diamond), but only stone and iron have art. **TODO:** paint gold and diamond versions. Until then the game reuses the iron art:

- Sword and bow swing sheets: `huntClip` in `src/actions/animals.js` plays the iron clips (`swordIron`, `bowIron`) for every tier above stone.
- Flying arrow: the iron arrow (`assets/world/effects/arrow-iron.png`) is drawn for gold and diamond bows.
- HUD: the tools-row chip and the Build menu row show the iron picture for gold and diamond (CSS: the `.iron` chip class and the `[data-tier='gold']`/`[data-tier='diamond']` selectors beside the iron ones in `src/style.css`).

Files to add when the real art is made (each with a `.prompt.txt` holding its exact prompt, and listed in the matching `tools/prepare-*.py` script):

| File | Made by |
| --- | --- |
| `assets/characters/<id>/<id>-sword-gold.png`, `-sword-diamond.png` (one row of 4 east-facing frames, like `-sword-iron.png`) | `tools/prepare-weapon-art.py` |
| `assets/characters/<id>/<id>-bow-gold.png`, `-bow-diamond.png` | `tools/prepare-weapon-art.py` |
| `assets/world/effects/arrow-gold.png`, `arrow-diamond.png` | `tools/prepare-weapon-art.py` |
| `assets/ui/game/tool-sword-gold.png`, `tool-sword-diamond.png`, `tool-bow-gold.png`, `tool-bow-diamond.png` | `tools/prepare-equipment-art.py` |

Then add `gold`/`diamond` clips and sheets in `src/animation/clips.js` and `sheets.js`, and change `huntClip` and the chip CSS to use them.
