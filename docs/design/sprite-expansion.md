# Sprite expansion art
Generated 2026-11-19 with the approved `assets/characters/originals/starting-characters-idle-v1.png` as reference. Existing oak, pine, rock and campfire sprites were additional references for their respective sheets.

Open [the local animation preview](sprite-expansion-preview.html) to play the frame sequences and inspect the overlays against different background colors. Full prompts and source provenance are in [the manifest](sprite-expansion-manifest.json); each image also has a prompt sidecar.

## Sheet layouts
All frame orders below are left to right, top to bottom.

| Asset | Layout | Contents |
| --- | --- | --- |
| scout / builder / survivor idle-loop | 4 × 4 | Rows south, west, east, north. Four breathing/blink phases each. |
| scout / builder / survivor chop | 4 × 1 | East-facing ready, overhead anticipation, strike, follow-through. |
| oak / pine wind-fall-break | 4 × 3 | Row 1 wind sway; row 2 falling; row 3 breaking into small wood pieces. |
| fire-loop | 4 × 1 | Four flame phases around a stone campfire ring. |
| rock-break | 4 × 1 | Intact, cracked, splitting, rubble. |
| footprints | 2 × 3 | Left/right pairs; rows soil, sand, snow. |
| tree-base-blends | 3 × 2 | Moss, pine needles, soil; dry leaves, sandy roots, snowy roots. |
| item-box-10-slots | One panel | Ten empty item slots in two rows of five. |
| storage-chest | One object | Wooden item storage chest. |
| path-dirt / cobblestone / boardwalk / stepping-stone | 2 × 2 | Straight, bend, T junction, crossroads. |

These are full-resolution generated source PNGs with alpha, not a runtime animation implementation. The preview divides each sheet into its declared grid. Generated poses may need individual crop/pivot alignment for smooth game playback. Chopping currently has one direction; other directions are not included. Paths need connector/edge alignment for a seamless autotile set. The ten-slot panel is artwork; inventory capacity must be enforced by game code.

No gameplay or map placement changes were made. `tools/make-standin-art.py` was not run.

