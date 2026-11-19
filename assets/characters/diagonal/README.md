# Diagonal walking and running

Generated with the built-in image-generation tool on 2026-11-19, matching `../originals/starting-characters-idle-v1.png`. Exact prompts are beside the PNGs.

Every sheet has three rows: **Scout, Builder, Survivor**, top to bottom. Walking uses four columns; running uses six. Frames play left to right and loop. Northeast shows the back and side of the character moving away toward the upper-right. Southeast shows the front and side moving toward the lower-right.

| Input | Direction | Walking sheet | Running sheet | Horizontal flip |
| --- | --- | --- | --- | --- |
| W + D | Northeast / upper-right | `walk-ne.png` | `run-ne.png` | No |
| W + A | Northwest / upper-left | `walk-ne.png` | `run-ne.png` | Yes |
| S + D | Southeast / lower-right | `walk-se.png` | `run-se.png` | No |
| S + A | Southwest / lower-left | `walk-se.png` | `run-se.png` | Yes |

Left-facing directions reuse the right-facing sheets through a renderer horizontal flip, matching the existing side-walk convention. This mirrors costume asymmetry as well. They do not need separate image files. Use the running sheet when Shift is held.

Suggested starting speeds: walk at 7 fps, run at 15 fps. See `manifest.json` for measured dimensions, nominal frame rectangles and direction mappings. These are generated draft cycles: stride alternation, pivots, scale and timing still need in-engine review and may need manual pose cleanup. The PNGs retain their original resolution and alpha. All 60 frame cells were checked for visible content and transparent pixels; this is a file/layout check, not a gameplay animation test.

`python tools/split-character-sheets.py` cuts each sheet into one row per character (`<id>/<id>-walk-ne.png` and so on; the 1024 px running sheets cut into rows 341, 342 and 341 px tall) and clears the faint haze around the figures. The game loads those copies as the `walkNE`, `walkSE`, `runNE` and `runSE` sheets in `src/animation/sheets.js`, and plays them while the player really moves diagonally (two movement keys held and neither direction blocked).
