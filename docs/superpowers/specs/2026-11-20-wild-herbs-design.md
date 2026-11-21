# Wild herbs: a second way to gather herbs

Date: 2026-11-20. Status: design approved, not built.

## Why

Herbs heal (3 herbs), brew tea (5 herbs), fill camp needs (4 herbs) and string a bow (2 herbs).
Today they come only from wildflower patches (2 herbs each), and the map spreads those unevenly:

| Region | Flower patches |
| --- | --- |
| Hollowstead Meadows | 82 |
| Driftwood Lagoon | 45 |
| Emerald Jungle | 30 |
| Pinefall Woods | 16 |
| Frostpeak | 1 |
| Desert, Stonewater Canyons | 0 |

A player in Pinefall (the Scout's start), the desert, the canyons or the snow has almost no way to
heal or to brew the tea that holds off the cold. Wild herbs fill those regions.

## What the player sees

A small leafy plant, "Wild herbs", stands here and there on open ground. It is walk-through, like
a wild berry bush. In reach it glows and shows the E cap; hovering it shows the herbs badge; a
click walks to it and picks it. The interact button says "Pick wild herbs".

- Gives **3 herbs** (wildflowers stay at 2).
- Picked by hand in `GATHER_SECONDS` (6 s) with the `gather` clip. It is not a quick pick-up.
- Grows back 180 game-seconds later, like the other wild patches.
- A full bag refuses it ("Your bag is full"), as for every other gather.

## Game code

One new entry in `WILD` in `src/data/supplies.js`:

```js
'wild-herbs': { type: 'herbs', amount: 3, label: 'Wild herbs', verb: 'Pick', clip: 'gather', regrow: 180 },
```

Everything else already works for any `WILD` sprite: `NODES` (id `wild-herbs-<x>-<y>`), hover and
click to walk, the working position, the bag check through `addItem`, `regrowAt`, the renderer's
fade out and in, and dropping timers for patches the map no longer has. There is no new action, no
new balance constant, no new resource and **no save version change**.

`assets/world/source/objects.json` gets
`"wild-herbs": { "kind": "plants", "origin": [0.5, 0.9], "scale": 0.5 }` (no footprint, so it is
walk-through; the scale is tuned when the stand-in is seen in play).

## Art

A stand-in from `tools/make-biome-standins.py`: `tall-grass` recoloured darker and bluer-green, so
it does not read as plain grass, saved as `source/objects/plants/wild-herbs.png` with a
`wild-herbs.prompt.txt` for the real Nano Banana picture. The script never overwrites, so the real
art later replaces the file by hand. The item box keeps the existing herbs picture.

## Where they grow

About 150 patches, most where flowers are scarce. `build-map.py` gets a `HERBS` pass after the
sticks pass, built like `BERRIES`: one random seed per grid square (so it never reshuffles other
scenery), with its own seed constant. Chance per square by region:

| Region | Share | Why |
| --- | --- | --- |
| Pinefall Woods | high | only 16 flower patches, and a starting region |
| Frostpeak | high | tea matters most here |
| Stonewater Canyons | high | no flowers at all |
| Desert | medium | no flowers at all |
| Emerald Jungle | low | flowers already there |
| Hollowstead Meadows, Driftwood Lagoon | low | flowers already plentiful |

The step and the chances are tuned until each of the four scarce regions has at least 20 patches
and the whole map about 150. A patch is refused on water, dirt, beach sand, walls, edges and
stairs (`on_flat`), within 60 of water, within 130 of a place or another scattered thing, near a
bridge, inside a fixed object's base, or within `PATH_DETAIL` of a footpath: the same rules as
wild berries.

## Getting them into the played map

The game plays the map drawn in Tiled (`assets/world/tiled/wildhaven-world-arranged.tmj`), which
is edited by hand, so the `build-map.py` pass alone would not show in play.

A new script, `tools/add-tiled-herbs.py`, scatters the patches onto the Tiled map itself:

- It reads the saved Tiled map and uses its own ground layers and objects for the checks above
  (it carries the same region shares), so patches fit the hand-drawn coast and scenery.
- It copies the map to `tiled/backups/` with a date first, like `build-snow-banks.py`, and has
  `--dry` to only count the patches per region.
- It adds each patch as an object whose Class is `wild-herbs`; `import-tiled-world.py` already
  reads a sprite from an object's Class. Whether the objects also show the plant's picture inside
  Tiled depends on adding the sprite to Tiled's sheet without moving any tile number; the
  implementation plan checks this, and falls back to Class-only objects.
- Run twice, it removes the patches it added before and lays them again, so it never doubles them.
- The user saves and closes the map in Tiled before the script runs, and reloads it afterwards.

Then `python tools/import-tiled-world.py` writes the game map and the minimap picture.

`tidy-tiled-world.py`'s `SMALL` set and `arrange-tiled-world.py`'s `PICKUPS` set gain
`wild-herbs`, so later tidying treats the patches like the other small pick-ups.

## Tests

- `tests/world/nodes.test.js`: wild herb patches exist, give 3 herbs with a 180 s regrow, are
  walk-through, and Pinefall, Frostpeak, the canyons and the desert each have at least 20.
- `tests/actions/gather.test.js`: picking wild herbs takes `GATHER_SECONDS`, not the quick time.
- The existing world tests (`map`, `places`, `objects`, `edits`, `terrain`) must still pass after
  the import.

## Docs

`CLAUDE.md` (the resources and wild scenery paragraphs, the pipeline commands) and `docs/gdd.md`
(herbs marked as having two sources) are updated. A play check with each character's start goes
in `docs/verification.md`.

## Not in this change

- A herb bed at camps, or any herb farming.
- New uses for herbs.
- A picking animation of its own, or a painted item picture.
- Changing how many herbs flowers give.
