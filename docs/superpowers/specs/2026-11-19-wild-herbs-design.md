# Wild Flowers as Regrowing Herbs

**Date:** 2026-11-19 · **Status:** approved in chat (yield: herbs; scope: flowers only, regrowing)

## Problem

The 38 flower patches scattered across the open wilds were drawn at full sprite size (255×155) and were bigger than the 112-unit character. They were decoration only. Every gatherable supply was one-time, so the map could only be stripped.

## Decisions

1. **Smaller flowers.** `objects.json` gains a per-sprite `scale` (the footprint scales with it). Flowers use 0.4, about 100×60. `build-map.py` applies it to the overview, and `render.js` applies it to scenery.
2. **A fourth resource, `herbs`.** It is listed in `RESOURCES` and has a HUD counter with a sprig icon. It has no use yet; it is meant as the healing input once health exists.
3. **Wild scenery is harvestable in place.** `WILD` in `state.js` turns every `flowers` map object into a node: id `flowers-<x>-<y>`, type herbs, amount 2, verb Pick, clip gather, `regrow` 180. The patches are walk-through and use the same 6 s timed gather, glow, E cap and progress bar as the supplies.
4. **Regrowth on the game clock.** Picking sets `state.regrowAt[id] = elapsed + regrow`. A patch is available again once `elapsed` reaches that time, so pause and a hidden tab stop regrowth. The patch fades back in.
5. **Saves stay version 2.** Older saves load with `herbs: 0` and `regrowAt: {}`. Timers for unknown ids (a rebuilt map) are dropped, and each timer is capped at one `regrow` ahead, so a bad value can't hide a patch for good. `collected` accepts only fixed supply ids.
6. **Map stays byte-identical.** No spawn or node moved, so neither `KEEP_CLEAR` nor `SCATTER_CLEAR` changed.

## Out of scope

Uses for herbs (crafting, healing), regrowth for trees and rocks, a needs or hunger model, and stump or bare-patch art.
