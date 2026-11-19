# Starting character sprites — first pass

## Folder layout

- `scout/`, `builder/` and `survivor/` each hold every sheet the game loads for that character: `<id>-idle-v1.png` (standing), `<id>-side-walk-v2.png` (walking west or east), `<id>-locomotion.png` (walk and run), `<id>-run-v2.png` (run) and `<id>-actions.png` (gather, build, craft, fight, swim). Each folder also has `<id>-side-walk.prompt.txt`, a per-character side-walk prompt whose sheet is not in the repo.
- `originals/` keeps `starting-characters-idle-v1.png` and `side-walk-v2.png` as they were generated: one picture with a row per character (scout, builder, survivor, top to bottom), with their prompts. `<id>-idle-v1.png` and `<id>-side-walk-v2.png` are cut from them by `python tools/split-character-sheets.py`; to change that art, replace the original and re-run the script.
- Every generated PNG has its exact generation prompt beside it as `.prompt.txt`. The cut copies have none of their own; their prompts are the originals'.

## Idle sheet

Generated with the built-in image generation tool on 2026-11-19.

The user selected all three playable character concepts, each with a different starting location in the same world.

Asset: `originals/starting-characters-idle-v1.png` — transparent PNG, 3 rows by 4 columns, twelve directional idle sprites. This is an initial art asset, not a walk animation or an implemented character system. Generated spacing and foot anchors need checking when preparing engine frames; do not assume exact uniform per-frame alignment.

Rows, top to bottom:

1. Frontier Scout — green cape, orange scarf, backpack, hatchet. Starts at a remote forest camp near mountains.
2. Wandering Builder — ochre shirt, leather apron, gloves, hammer. Starts in an abandoned village with a damaged workshop.
3. Shipwreck Survivor — faded blue coat, red scarf, patched clothing, rope belt, satchel. Starts on a beach beside a wrecked ship.

Columns, left to right: south/front, west/left, east/right, north/back.

All three can explore the same world and develop settlements toward cities. Art choices such as faces, hair, and proportions are first-pass proposals rather than fixed customization restrictions.

The exact generation prompt is saved in `originals/starting-characters-idle-v1.prompt.txt`.
