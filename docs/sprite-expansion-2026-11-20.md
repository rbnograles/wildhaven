# Wildhaven sprite expansion — 2026-11-20

Generated with the built-in image_gen tool. This delivery contains **22 source PNG atlases** and an exact prompt beside each. The [manifest](../assets/sprite-expansion-2026-11-20.json) records file paths, generated-source paths, measured dimensions and sampled alpha counts.

## Coverage

- Stone and iron swords, bows and arrows; fishing rod and hoe.
- Deer and wolf pelts; each outfit has hat, jacket, gloves and boots.
- Three-player action sheets: stone/iron sword, stone/iron bow, fishing and hoeing.
- Deer and wolf outfit idle/turnaround sheets plus NE/SE running for Scout, Builder and Survivor.
- Gold and diamond inventory icons and world ore boulders.
- Closed notebook HUD icon and open blank notebook panel.
- Diagonal runs for deer, rabbit, boar, wolf, Maren, Bram and Tilly.
- Base Scout/Builder/Survivor diagonal runs already exist in `assets/characters/diagonal/`; retained.

## Baseline and frame conventions

Diagonal running is part of the basic sprite set for every creature and character, including future additions and outfit variants. Author NE and SE views; mirror horizontally for NW and SW, matching the existing renderer convention. Mirroring also reverses costume asymmetry.

Creature atlases: 6 columns × 2 rows; NE above SE. Villager runs: 6 columns × 3 rows; Maren, Bram, Tilly. Player runs: 6 columns × 3 rows; Scout, Builder, Survivor. Equipment actions: 4 columns × 3 rows in the same player order. Play sequences left to right.

These are source art layouts, **not calibrated engine frame bounds**. Some sheets have variable margins and poses nearly touch nominal boundaries. Measure transparent gutters and anchors when preparing game strips; do not blindly divide and trim. Action views are right-facing three-quarter views; no separate north/south action sheets were generated.

Outfit idle sheets are turnarounds, not animation cycles. Observed deer columns: south, west, rear three-quarter northeast, front three-quarter southwest. Observed wolf columns: south, west, north, southeast. These differ from the requested prompt column order; use the observed art when assigning directions.

The journal has unequal widths: closed notebook occupies roughly the left third, open notebook the right two thirds. It is **not** a uniform two-cell sheet. The pages intentionally have no text so HTML can supply accessible live content.

## Verification and remaining preparation

All 22 selected files were opened by the image decoder; dimensions and alpha samples are in the manifest. Every sheet has fully transparent samples and visible near-opaque/opaque content. Each PNG has its prompt. Images were visually inspected during generation; deer/boar backgrounds and iron-sword noise were corrected, and the stone-bow output was replaced using the iron-bow sheet as a clean template.

Generated edges retain low-alpha fringe; interiors are mostly near-opaque (commonly alpha 252–253). Production preparation should clean fringe and calibrate anchors without erasing thin strings, fishing lines or antlers. Outfit runs have small costume/proportion variations that need playback review.

This task generated source assets. No gameplay changes or in-engine playback verification were performed by this task. These files do not by themselves add crafting recipes, equipment switching, fishing, farming or mining behavior. Outfit sheets are full-body art, not independently compositable clothing layers. Additional cardinal outfit locomotion and outfit-specific action/state animations are outside this delivered sheet set.

## Asset gallery

### deer-run-diagonal

[PNG](../assets/creatures/deer/deer-run-diagonal.png) · [Prompt](../assets/creatures/deer/deer-run-diagonal.prompt.txt)

![deer-run-diagonal](../assets/creatures/deer/deer-run-diagonal.png)

### rabbit-run-diagonal

[PNG](../assets/creatures/rabbit/rabbit-run-diagonal.png) · [Prompt](../assets/creatures/rabbit/rabbit-run-diagonal.prompt.txt)

![rabbit-run-diagonal](../assets/creatures/rabbit/rabbit-run-diagonal.png)

### boar-run-diagonal

[PNG](../assets/creatures/boar/boar-run-diagonal.png) · [Prompt](../assets/creatures/boar/boar-run-diagonal.prompt.txt)

![boar-run-diagonal](../assets/creatures/boar/boar-run-diagonal.png)

### wolf-run-diagonal

[PNG](../assets/creatures/wolf/wolf-run-diagonal.png) · [Prompt](../assets/creatures/wolf/wolf-run-diagonal.prompt.txt)

![wolf-run-diagonal](../assets/creatures/wolf/wolf-run-diagonal.png)

### settlers-run-ne

[PNG](../assets/characters/settlers/settlers-run-ne.png) · [Prompt](../assets/characters/settlers/settlers-run-ne.prompt.txt)

![settlers-run-ne](../assets/characters/settlers/settlers-run-ne.png)

### settlers-run-se

[PNG](../assets/characters/settlers/settlers-run-se.png) · [Prompt](../assets/characters/settlers/settlers-run-se.prompt.txt)

![settlers-run-se](../assets/characters/settlers/settlers-run-se.png)

### equipment-icons

[PNG](../assets/items/equipment-expansion-v1.png) · [Prompt](../assets/items/equipment-expansion-v1.prompt.txt)

![equipment-icons](../assets/items/equipment-expansion-v1.png)

### wolf-outfit-icons

[PNG](../assets/items/wolf-outfit-v1.png) · [Prompt](../assets/items/wolf-outfit-v1.prompt.txt)

![wolf-outfit-icons](../assets/items/wolf-outfit-v1.png)

### journal-notebook

[PNG](../assets/ui/game/journal-notebook-v1.png) · [Prompt](../assets/ui/game/journal-notebook-v1.prompt.txt)

![journal-notebook](../assets/ui/game/journal-notebook-v1.png)

### players-sword-stone

[PNG](../assets/characters/equipment/players-sword-stone.png) · [Prompt](../assets/characters/equipment/players-sword-stone.prompt.txt)

![players-sword-stone](../assets/characters/equipment/players-sword-stone.png)

### players-sword-iron

[PNG](../assets/characters/equipment/players-sword-iron.png) · [Prompt](../assets/characters/equipment/players-sword-iron.prompt.txt)

![players-sword-iron](../assets/characters/equipment/players-sword-iron.png)

### players-bow-stone

[PNG](../assets/characters/equipment/players-bow-stone.png) · [Prompt](../assets/characters/equipment/players-bow-stone.prompt.txt)

![players-bow-stone](../assets/characters/equipment/players-bow-stone.png)

### players-bow-iron

[PNG](../assets/characters/equipment/players-bow-iron.png) · [Prompt](../assets/characters/equipment/players-bow-iron.prompt.txt)

![players-bow-iron](../assets/characters/equipment/players-bow-iron.png)

### players-fishing

[PNG](../assets/characters/equipment/players-fishing.png) · [Prompt](../assets/characters/equipment/players-fishing.prompt.txt)

![players-fishing](../assets/characters/equipment/players-fishing.png)

### players-hoe

[PNG](../assets/characters/equipment/players-hoe.png) · [Prompt](../assets/characters/equipment/players-hoe.prompt.txt)

![players-hoe](../assets/characters/equipment/players-hoe.png)

### ore-nodes

[PNG](../assets/world/source/originals/rocks/precious-ore-nodes-v1.png) · [Prompt](../assets/world/source/originals/rocks/precious-ore-nodes-v1.prompt.txt)

![ore-nodes](../assets/world/source/originals/rocks/precious-ore-nodes-v1.png)

### players-deer-outfit-idle

[PNG](../assets/characters/outfits/players-deer-idle.png) · [Prompt](../assets/characters/outfits/players-deer-idle.prompt.txt)

![players-deer-outfit-idle](../assets/characters/outfits/players-deer-idle.png)

### players-wolf-outfit-idle

[PNG](../assets/characters/outfits/players-wolf-idle.png) · [Prompt](../assets/characters/outfits/players-wolf-idle.prompt.txt)

![players-wolf-outfit-idle](../assets/characters/outfits/players-wolf-idle.png)

### players-deer-run-ne

[PNG](../assets/characters/outfits/players-deer-run-ne.png) · [Prompt](../assets/characters/outfits/players-deer-run-ne.prompt.txt)

![players-deer-run-ne](../assets/characters/outfits/players-deer-run-ne.png)

### players-deer-run-se

[PNG](../assets/characters/outfits/players-deer-run-se.png) · [Prompt](../assets/characters/outfits/players-deer-run-se.prompt.txt)

![players-deer-run-se](../assets/characters/outfits/players-deer-run-se.png)

### players-wolf-run-ne

[PNG](../assets/characters/outfits/players-wolf-run-ne.png) · [Prompt](../assets/characters/outfits/players-wolf-run-ne.prompt.txt)

![players-wolf-run-ne](../assets/characters/outfits/players-wolf-run-ne.png)

### players-wolf-run-se

[PNG](../assets/characters/outfits/players-wolf-run-se.png) · [Prompt](../assets/characters/outfits/players-wolf-run-se.prompt.txt)

![players-wolf-run-se](../assets/characters/outfits/players-wolf-run-se.png)

