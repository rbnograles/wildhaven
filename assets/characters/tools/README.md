# Mining and chopping swings

Generated on 2026-11-20 with the built-in image-generation tool. Exact prompts sit beside each source PNG. Character identity references `originals/starting-characters-idle-v1.png`; equipment references `assets/items/tools-stone-iron.png` and `axes-stone-iron.png`.

| Source | Animation | Game clip |
| --- | --- | --- |
| [pickaxe-stone.png](pickaxe-stone.png) | Mining with a lashed stone pickaxe | `mine` |
| [pickaxe-iron.png](pickaxe-iron.png) | Mining with a forged iron pickaxe | `mineIron` |
| [axe-stone.png](axe-stone.png) | Chopping with a lashed stone axe | `chop` |
| [axe-iron.png](axe-iron.png) | Chopping with a forged iron axe | `chopIron` |

Each source has Scout, Builder and Survivor in three rows, with four poses per row: ready, windup, strike, recovery. All face east; west uses a horizontal flip, matching the existing action convention. There are no separate north/south swings.

`python tools/prepare-tool-swings.py` creates the twelve `<character>/<character>-<tool>-<tier>.png` game strips. The script finds transparent gutters, keeps complete raised tools, clears faint alpha haze, preserves body scale across each sequence, and anchors the planted boots. Each strip is 2048×512: four 512×512 cells, nominal feet anchor (256,496). `manifest.json` records source cuts and output paths. Original generated sheets remain untouched.

The game loops these at 5 fps while gathering. `beginGather` chooses the tool and tier owned: trees use axes and mineable rocks use pickaxes. Loose stones, plants and driftwood retain their existing gathering animation. Gathering time, rewards, durability and cancellation rules are unchanged.

To view all twelve animations, open **Preview animations** from character selection or pause, then choose **Chopping — stone axe**, **Chopping — iron axe**, **Mining — stone pickaxe**, or **Mining — iron pickaxe**. The original generic `*-chop.png` sources are retained but no longer loaded by the game.
