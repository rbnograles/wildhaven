# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wildhaven is a single-player, top-down browser exploration game. It is still a prototype. On the selection screen the player picks one of three characters: Frontier Scout, Wandering Builder, or Shipwreck Survivor. Each one starts far from the others in one shared world of seven regions (desert, pine forest, snow, meadows, lagoon, canyons, jungle). The current milestone covers character selection, exploration, supply gathering, discovering regions, finding 49 landmarks, finding 14 signposts and fast-travelling between them, climbing hills by their stairs, and saving each character separately. The big world is build 1 of 4 in `docs/superpowers/specs/2026-11-19-big-world-design.md`; builds 2 to 4 (objectives journal and collectibles, harsh conditions and gear, locals) are not implemented, except a **prototype field journal for Pinefall Woods only** (a page, keepsake and trail clue per place; open with J). It exists to playtest whether finds that pay off make players chase the next place; the slice plan is `~/.gstack/projects/game 1/ryann-main-slice-plan-20261119-134500.md`. The long-term direction is a survival-and-settlement game with building, settlers, survival meters, and wolves. That design is in `docs/superpowers/specs/2026-11-19-survival-settlement-design.md`, but none of it is implemented. **Do not describe roadmap features as if they already exist.**

The standardized game design document is `docs/gdd.md` (imported 2026-11-19 with `/game-import`). It tags every item **[Built]** or **[Planned]**, records the audience (cozy survival), fantasy (exploration/discovery), retention hooks, and the hobby/no-monetization intent, and lists open spec-vs-build mismatches. When the GDD and the code disagree, trust the code.

## Commands

```sh
npm install
npm run dev          # Vite on http://127.0.0.1:5173 (also the "wildhaven" config in .claude/launch.json)
npm test             # node --test: runs every *.test.js under tests/ with Node's built-in runner
npm run build        # Vite production build → dist/
npm run preview      # serve dist/
npm run format       # Prettier: rewrite every file it covers (see .prettierignore)
npm run format:check # Prettier: fail if any covered file is not formatted

node --test tests/actions/gather.test.js                              # one file
node --test --test-name-pattern="stale tab" tests/game/saves.test.js  # one test by name

python tools/build-map.py [preview.png]   # regenerate assets/world/map/* (needs numpy + Pillow)
python tools/prepare-generated-art.py     # key out the magenta of the Nano Banana art in source/originals/ and size it (then build-map.py)
python tools/make-biome-standins.py       # create any missing stand-in biome art (never overwrites)
python tools/split-character-sheets.py    # cut the all-character idle/side-walk originals per character
```

Prettier 3 is the formatter (see Code Style below); there is no linter. Requires Node 20.19+ or 22.12+; the project was developed on Node 24.

Saves are scoped to the page's origin, so `127.0.0.1` and `localhost` are separate save locations. Do verification at `127.0.0.1` (the dev script's host) so it never overwrites the user's own saves on `localhost`.

## Tech Stack

Vanilla JavaScript ES modules, no framework. Vite 7 bundles the code and assets. Phaser 4 is used **only as the renderer**. HTML/CSS handle the UI and dialogs. Node's built-in `node:test` runs the tests. Prettier formats the code. Python (numpy, Pillow) builds the map offline.

## Architecture

Game rules are pure modules. Rendering and the DOM are thin layers around them. `main.js` only wires things together.

| Folder | Role | Runs in Node tests? |
| --- | --- | --- |
| `src/data/` | `places.js` (regions, spawns, supply spots, `LANDMARKS`, `WAYPOINTS`, all read from `assets/world/source/places.json`), `characters.js` (characters), `supplies.js` (`SUPPLIES` with sprite, scale, verb, clip; `WILD` regrowing patch kinds; `RESOURCES`), `balance.js` (speeds, reach, `GATHER_SECONDS`, landmark and signpost radii), `journal.js` (`JOURNALS`: per region, trail order and a page per landmark with text, keepsake, stand-in sprite and clue; Pinefall only) | yes |
| `src/world/` | `map.js` (world size, collision: `isWalkable`, `blocks`, `OBSTACLES`, the `hitsObstacle` grid lookup, `hitsCliff`/`elevationAt`/`CLIFF_GAP` for hills, `mapProperty`), `nodes.js` (`NODES` = supplies + wild map patches; `nodeBases` solid bases), `regions.js` (`REGIONS`, `regionOf`, `regionAt`, read from the map's region grid), `progress.js` (found counts per region and for the world), `journal.js` (`readJournal`: pages filled from `state.landmarks` and the next trail clue; `hasJournalPage`) | yes |
| `src/actions/` | One file per player action: `move.js` (`movePlayer`), `gather.js` (`beginGather` starts the timed action, `finishGather` awards by id; `gatherTime`, `isAvailable`, `nearbyNode`), `discover.js` (regions, landmarks, signposts), `travel.js` (`travelTo` a found signpost) | yes |
| `src/game/` | `state.js` (create, serialize, validate saves), `saves.js` (per-character localStorage session, active character) | yes |
| `src/animation/` | `clips.js` (clip table, animator, timed actions; pure), `sheets.js` (sprite loading and frame measuring), `preview.js` (preview dialog) | `clips.js` only |
| `src/render/` | `renderer.js`: Phaser scene, supply sprites (glow, E cap, progress bar, fade-out), camera, chunk culling of scenery, local minimap and world map with markers | no |
| `src/ui/` | `layout.js` (HTML template, icons), `selection.js` (main menu: three painted character panels, the chosen one widens; arrows, swipe and dots on phones), `hud.js` (HUD, goals card with region progress, interact button, toast, in-game controls strip), `dialogs.js` (pause, map with signpost travel buttons, reset, fullscreen; any open dialog, the journal included, pauses), `journal.js` (field journal dialog, HUD button and its "new page" dot) | no |
| `src/core/` | `session.js` (shared session; start, leave, save), `input.js` (keys, touch), `loop.js` (frame loop), `playtest.js` (console log of finds, journal opens and followed clues for the journal playtest; `wildhavenPlaytest()` in the console returns it as text) | no |

**Keep the pure modules runnable in Node.** `data/`, `world/`, `actions/`, `game/` and `animation/clips.js` must not import `ui/`, `core/`, `render/`, `sheets.js`, `preview.js`, PNG or CSS files, and must not use `import.meta`, `document` or `window`. `tests/boundaries.test.js` enforces this. JSON is imported with `import ... with { type: 'json' }` so Node can read it.

**Adding an action:** add a file in `src/actions/`, bind its key in `src/core/input.js`, add a clip in `src/animation/clips.js` if it's animated, and add a test in `tests/actions/`.

**Shared session.** `core/session.js` `createSession()` holds what the browser layer shares: selected character, game state, animator, renderer, save session, current screen, held keys, and frame clock. `main.js` builds one `ui` object (`hud`, `dialogs`, `selection`, `input`) and passes `(session, ui)` to each module, so modules don't import each other in cycles.

**Input belongs to `core/input.js`, not Phaser.** Phaser's keyboard, mouse, and touch input are switched off. `core/input.js` tracks held keys in `session.keys` and exposes `moveIntent()`. The game counts as paused whenever the pause, map, or reset `<dialog>` is open (`ui.dialogs.isPaused()`). The simulation also stops while the tab is hidden.

**Frame loop (`core/loop.js`).** Each frame:
1. Clamp `dt` to 0.05.
2. If an action is running and a movement key is held, `cancelAction` (nothing is awarded).
3. Call `movePlayer`, then `advanceAnimation`.
4. When a timed action *finishes*, call `finishGather(state, target)` with the node id it targeted. Pressing E only calls `beginGather`, which starts the node's clip for `gatherTime(state, node)` seconds, so supplies are granted exactly once.
5. Run `discover`, autosave every 10 s, call `renderer.draw`, and refresh the HUD about every 0.12 s.

Because `dt` is clamped, game time runs slower than real time when the page renders below 20 fps (e.g. a hidden browser pane), and an action takes longer.

**Save model.** Each character has its own key, `wildhaven.adventure.v1.<characterId>`, and the save object is `version: 3` (it added `landmarks` and `waypoints`, the ids found; version 2 saves take the start-fresh path). `restoreGame` validates the data strictly and *rebuilds* the object field by field. Adding a field to game state therefore means updating `createGame`, the checks in `restoreGame`, and the object it returns, or the field is silently dropped on load. If old saves can't be read safely, bump `version`; old saves then show the "could not be read, start fresh" path. `createSaveSession` remembers the last raw value it saw and refuses to write if storage has changed (`reason: 'conflict'`), so a stale tab can't overwrite a newer save. Saves happen on gather, discovery, signpost travel, opening pause, hiding the tab, `pagehide`, and every 10 s. Separately, `readActive`/`setActive` keep the character being played in `sessionStorage` (`wildhaven.active`); on load `main.js` resumes it if that slot has a readable save, so a refresh returns to the game. Only the "Return to characters" and loading-screen "Back to characters" buttons clear it. Animation state is never saved, and a test checks this. `restoreGame` checks the saved spot with `isWalkable(x, y, [], false)` (cliffs ignored), so a save made where a hill now stands still loads; `movePlayer` then ignores cliffs until the player has walked off one.

**Directions** are encoded everywhere (state, sprite columns, locomotion rows) as `0 = south, 1 = west, 2 = east, 3 = north`.

## World / Map Pipeline

```
assets/world/source/ground/{grass,dirt,soil,jungle,rock,snow,sand,water}.png
assets/world/source/places.json  (regions, spawns, supplies, landmarks, waypoints)
assets/world/source/cliffs/<kit>.png + cliffs.json  (cliff pictures the hill tiles are cut from)
assets/world/source/objects/<kind>/*.png + objects.json  ──► tools/build-map.py ──► assets/world/map/
                                                                                   tileset.png
                                                                                   wildhaven.json  (Tiled format)
                                                                                   overview.webp   (minimap/world map)
```

- **World art is split into folders by kind.** `source/ground/` holds the eight ground textures. `source/cliffs/` holds the three cliff pictures (`meadow`, `canyon`, `snow`) the hill tiles are cut from, and `cliffs.json`. `source/objects/` has one folder per kind of thing: `trees/`, `plants/`, `rocks/`, `buildings/` (houses, workshop, tent, ship, sandstone ruin) and `props/` (bridge, campfire, log, signpost). `source/originals/` keeps the full-size generated PNGs in the same kind folders. Every sprite's `kind` field in `objects.json` names its folder; `build-map.py`, `make-biome-standins.py` and `tests/world/nodes.test.js` find files through it. Everything else (the map, `places.json`, `SUPPLIES`, the renderer's `objectUrls`) names sprites by file name alone, so **a sprite name must be unique across all kind folders**. `tests/world/objects.test.js` checks this, and that every file is in the folder its entry names.
- To add an object sprite: save `<name>.png` and `<name>.prompt.txt` in the right kind folder, add a `<name>` entry with that `kind` to `objects.json`, and re-run `build-map.py`.

- `wildhaven.json` is the single source of truth for both rendering and collision. The map is 384×256 tiles at 64 px each (24,576×16,384 world units), with terrain tile layers `ground`/`dirt`/`soil`/`jungle`/`rock`/`snow`/`sand`/`water` (bottom to top), a `cliffs` tile layer over them, and an `objects` point layer. The renderer reads the tile layer names from the map, so a new layer needs no code change. A terrain layer paints a tile only when one of the tile's corners is its own terrain, and then covers every corner of its rank or higher, so the lower terrain runs on underneath a shoreline. The map file's properties also hold the region grid (`regionCell`, `regionCols`, `regionGrid`: one digit per 256-unit square, the region's index in `places.json`) and the `elevation` grid (one letter per tile: `0`–`3` level, `w` cliff wall, `s` stairs).
- Collision in `src/world/map.js` combines three sources. The water layer uses per-tile corner masks: the four corner values are blended, and a point counts as water at ≥0.35 (the corner-mask encoding is shared with `build-map.py`). Each object also has a solid base, its `footprint` in `objects.json`. And `hitsCliff` reads the elevation grid: a wall tile is solid, and a spot within `CLIFF_GAP` (20) units of a tile of another level is blocked unless one of the two is stairs. The blocked strip is 20 units on each side of an edge, wider than the longest step (24.5), which `tests/actions/move.test.js` checks.
- **Hills ("hills and cliffs" in `build-map.py`).** A hill is a stack of flat-topped levels on the tile grid, drawn in 2×2-tile blocks so every wall is at least two tiles wide. Each level's south edge drops down a wall `WALL_ROWS` = 2 tiles (128 units) tall; north, west and east edges show only a low lip, because the camera looks from the south. `HILL_RULES` says which regions get hills, which kit (`meadow`, `canyon`, `snow`) and how many levels; placement uses one random seed per 1,600-unit square, with a few retries, and keeps every hill 4 tiles from places, hand-placed objects and fords, off water and dirt, inside one region and 5 tiles from other hills. Every level gets one two-tile flight of stairs on its southernmost edge, drawn as a flat `<kit>-stairs` object. The `cliffs` tiles are painted from strips cut out of `source/cliffs/<kit>.png` (where things sit in each picture is in `cliffs.json`): the repeating wall, its two end pieces, and the side lips; each higher level also gets a little warm light so it reads as higher. Scenery is kept off walls, edges and stairs (`on_flat`). `tests/world/cliffs.test.js` checks walls are solid, edges block, every flight climbs, and every level of every hill can be reached on foot.
- `objects.json` fields: `kind` is the folder under `objects/` that holds the sprite. `origin` is the ground contact point as a fraction of the sprite size. `footprint` is `[halfWidth, depth]` of the solid base; leave it out for walk-through objects. `flat` means the object is drawn under characters. `scale` is the draw size wherever the map places that sprite (flowers use 0.4 so a patch is smaller than a character); the footprint scales with it. Every other object is depth-sorted by its y position, so the player can walk in front of or behind it.
- **`assets/world/source/places.json` is the single source for positions.** It holds the regions, spawns, supply spots, landmarks and waypoints. `build-map.py` reads it to shape the land (water is pushed back from every listed point, scenery is kept 150 units away and never stands just south of a point, a landmark's `object` sprite stands 60 units north of it, a `pool` is dug north of it, each signpost stands 50 units north of its waypoint). `src/data/places.js` exposes the same file to the game. To move or add a place, edit the JSON and re-run the script; `tests/world/places.test.js` then checks every point is walkable, in its named region and reachable on foot.
- **Regions, rivers and scenery are defined in `build-map.py`.** `LAYOUT` is an 8×8 grid of region letters whose borders are warped by sine waves. `RIVERS` are polylines of water; `FORDS` are the crossing points (dry ground within 190 units) and `BRIDGES` add a plank deck. Scenery is scattered with **one random seed per grid square**, so changing one part of the map never reshuffles another part. The placement of landmark buildings (tent, houses, workshop, ship) is relative to the spawns.
- **Supply nodes are not in the map.** `src/render/renderer.js` draws each one from `NODES` (`src/world/nodes.js`) (`sprite` is an `objects.json` key, drawn at `scale`), and `nodeBases` in `src/world/nodes.js` makes its scaled footprint solid until it is collected. `movePlayer` ignores a base the player is already inside, so an old save can't get trapped.
- **Wild scenery is in the map and also harvestable.** `WILD` in `src/data/supplies.js` names scattered sprites (today only `flowers`) that become `NODES` entries with id `<name>-<x>-<y>` and a `regrow` time. The renderer skips them in the scenery loop and draws them with the supplies. They are walk-through (no footprint), so `nodeBases` covers only the fixed `SUPPLIES`.
- `tools/make-standin-art.py` cut placeholder source art out of `assets/world/wildhaven.png`. **Do not re-run it.** It would overwrite any source art that has since been replaced. It also predates the kind folders and still writes to the old flat paths. To change art, replace the file under `source/ground/` or `source/objects/<kind>/` and re-run `build-map.py`.
- `tools/make-biome-standins.py` derives the snow, rock and jungle textures and twelve biome sprites from existing art. It skips any file that already exists, so it is safe to re-run. Each stand-in has a `.prompt.txt` for generating the real art.

## Character Sprites

- Every sheet the game loads sits in the character's own folder, `assets/characters/<id>/` (`scout/`, `builder/`, `survivor/`), and is listed in `SOURCES` in `src/animation/sheets.js`.
- `<id>/<id>-idle-v1.png` is one row of 4 standing poses, one per direction. It is also used through CSS for the selection-screen figure and the HUD portrait (the "Character idle sheets" rules in `src/style.css`).
- `<id>/<id>-side-walk-v2.png` is one row of 4 frames walking east, mirrored for west, with each frame anchored on the head to prevent sliding (`steadyAnchors`).
- The idle and side-walk sheets were generated as one picture of all three characters. Those originals and their prompts are kept in `assets/characters/originals/`; `python tools/split-character-sheets.py` cuts them into the per-character copies (it overwrites the copies). Because they were painted together, every character's idle and side-walk poses are sized by the scout's row (see `loadCharacterSheets`), so their relative heights match the painting.
- `<id>/<id>-locomotion.png` has 8 rows (walk S/W/E/N, then run S/W/E/N) with 4 frames each. `<id>/<id>-run-v2.png` has 3 rows (south, east, north) of 6 frames. `<id>/<id>-actions.png` has 5 rows (gather, build, craft, fight, swim). The action art faces east and is mirrored for west.
- The row boundaries are measured **`edges`** arrays in `SOURCES` in `src/animation/sheets.js`, not equal-height rows. If you regenerate a sheet, re-measure its edges. Columns are equal quarters of the sheet width. Within each cell the frame bounds come from pixels with alpha > 40.
- Idle, walk, run, gather, and build are used in play. `build` (an overhead swing; the art shows a hammer) stands in for chopping the pine tree until an axe animation exists. Craft, fight, and swim exist only in the preview dialog and must not imply working mechanics.

## Game Rules That Affect Code

- There are four resources (`RESOURCES`): `wood`, `stone`, `food`, `herbs`. They are always non-negative integers, and `restoreGame` rejects anything else. Herbs come only from wild flowers and have no use yet. 
- Fixed supplies (`SUPPLIES`, the first nine `NODES`) can each be collected once and are tracked by id in `state.collected`. Wild flower patches give 2 herbs and grow back 180 game-seconds later. `state.regrowAt` maps a picked patch's id to the `state.elapsed` time it returns, so the regrowth clock stops when the game is paused or the tab is hidden. On load, `restoreGame` drops timers for patch ids the map no longer has and caps each timer at one `regrow` ahead. Both rules are availability checks in `isAvailable`. A node is gatherable within 95 units. A region (`REGIONS`) is discovered by standing in it; every spot in the world is in exactly one. A landmark is found within 200 units (`LANDMARK_RADIUS`) and a signpost within 110 (`WAYPOINT_RADIUS`). `travelTo` only moves the player to a signpost already in `state.waypoints`.
- Movement speed is 155 units/s walking and 245 units/s with Shift. Collision is checked separately on the x and y axes so the player slides along obstacles.
- Hills are climbed only by their stairs: walls and the edges between levels block movement. Height has no other effect yet (no view, speed or discovery bonus).
- Every gather is a timed action of `GATHER_SECONDS` = 6 s, read through `gatherTime(state, node)`, and its clip loops for the whole time. This is a design decision: planned gathering tools will lower it towards 0.5 s through `gatherTime`, so don't shorten the base time as a "fix." A fresh movement press cancels the action and awards nothing. Key-repeat from a key that was held when E was pressed does not cancel it. Pause and a hidden tab freeze it.
- When a node is in reach, its sprite glows (Phaser Glow filter, WebGL only) and an E key cap floats over it. A progress bar replaces the cap while the action runs. Gathered sprites fade out, and regrown patches fade back in; there is no stump or bare-bush art yet.
- Balance numbers live in `src/data/balance.js` (speeds, reach, `GATHER_SECONDS`, landmark and signpost radii). Don't hardcode tuning numbers in actions.

## Code Style (repo rule)

This is a rule, not a preference. Code here should read easily for a beginner. Every change must follow it, and `npm run format:check` and `npm test` enforce most of it.

- **Prettier formats all code.** Run `npm run format` after editing; `npm run format:check` must pass. The settings in `.prettierrc.json` are single quotes, 100-column lines, and each file's existing line endings (this is a Windows checkout with `core.autocrlf`). `.prettierignore` leaves out `assets/` (generated or read by `build-map.py`), Markdown and `docs/`, `.claude/`, and build output. Don't hand-format against Prettier.
- **Every named function has a comment directly above it, written ELI5-style.** Use plain words a beginner understands and short sentences. Explain any jargon. Add an everyday comparison when it really helps (a backpack for resources, a stopwatch for timers), but don't be cutesy and don't label it "ELI5". Use a `/** ... */` block:
  - first line: what it does, in one simple sentence;
  - then a short plain-language explanation of how or why;
  - then `@param {type} name - meaning` and `@returns {type} meaning`, in plain words.

  A tiny one-line helper can have a one-line `/** ... */`. "Named function" means function declarations (inner ones too), `const name = (...) =>`, class and object methods, object properties holding arrow functions, and classes. Anonymous inline callbacks such as `.map((c) => ...)` are exempt unless their logic is non-obvious; then put a `//` line above. `tests/comments.test.js` fails when a named function has no comment on the line right above it.
- **Keep the *why*.** Comments that record why a decision was made stay. Examples are the per-square scatter seed, the clamped `dt`, and the 6 s `GATHER_SECONDS`. Reword them more simply if needed, but never drop the fact.
- **Headers and data.** Each file opens with a 2–4 line `//` header saying what it is for. Constants and data tables say what they hold and what each field means.
- **Spacing.** Put one blank line between top-level declarations and between functions. Inside longer function bodies, put blank lines between steps (setup, checks, work, return), with a short `//` comment on any step that isn't obvious. Short 2–4 line bodies stay tight.
- **HTML in template strings** is marked `/* HTML */` so Prettier formats it too. Prettier keeps inline tags touching by breaking lines as `</button` + `>`. Don't "tidy" those breaks: real whitespace there would add gaps between buttons.
- **Pure modules** (`data/`, `world/`, `actions/`, `game/`, `animation/clips.js`): comments must not contain the words `document`, `window` or `import.meta`, because `tests/boundaries.test.js` scans the whole file, comments included.
- **Tests:** each file has a header, and each `test(...)` has a `//` line above it saying what could break that it guards against.
- **Python in `tools/`:** a `#` comment above each `def`, not a docstring, so one-line defs stay one line. Prettier doesn't format Python.
- **CSS:** section headers (`/* ---- Name ---- */`) grouped by what's on screen, plus a note on any rule that isn't obvious.

Example of the expected tone and shape (`src/actions/move.js`):

```js
/**
 * Moves the player one small step in the direction the keys point.
 *
 * Think of the player as a toy on a table: each frame we nudge it a little. If a tree or the
 * sea blocks one direction, the toy still slides along the other one instead of stopping dead.
 *
 * @param {object} state - The game being played. Its `player` position and `distance` change.
 * @param {number} dx - Left/right push: -1 is west, 1 is east, 0 is neither.
 * @returns {boolean} True if the player really moved, so a blocked step shows the idle pose.
 */
```

## Conventions

- Nano Banana (Gemini) cannot paint real transparency, so its sprites are drawn on flat magenta. The full pictures go in `source/originals/<kind>/<name>.jpg` with their prompts, and `python tools/prepare-generated-art.py` keys out the magenta, trims, sizes and saves the game files (grass tufts, the dirt patch, the soil texture, the cliff pictures and the stairs sprites). Add a new picture to its lists before running it.
- Every generated art asset sits next to a `.prompt.txt` holding its exact generation prompt. Keep the original PNGs, and add a prompt file for any new generated art. The asset inventory is in `docs/art-direction.md` and `assets/characters/README.md`.
- Any failure while loading assets must end on the loading screen's retry state, never an endless loader. Image loads have timeouts (`loadImage`, plus the 20 s Phaser scene timeout).
- Keep `prefers-reduced-motion` support. It turns off camera smoothing, CSS transitions, and preview autoplay.
- Desktop keyboard and mouse is the primary target. Layouts must still work at about 390 px wide, where on-screen touch movement buttons appear.
- The main menu (`#selection`) must stay exactly `100svh` with no scrolling at any size from 320×480 up. Under 700 px wide it shows one character panel at a time.
- Feature plans go in `docs/superpowers/plans/`, and browser verification notes go in `docs/verification.md`.

## Verifying a Change

- `npm test`, `npm run build` and `npm run format:check` must all pass. `npm test` includes the comment rule (`tests/comments.test.js`) and a flood fill of the whole world (`tests/world/places.test.js`), so a map change that seals off a spawn, landmark, signpost or supply fails the tests.
- Unit tests don't cover rendering, input, animation, the map, or the UI. If you change any of those, start the game from the `wildhaven` launch config and play through with each affected character. Check the browser console for errors. If layout changed, also check the page at about 390 px wide. Add notable checks to `docs/verification.md`.

## Stale Docs

Some docs predate the Phaser renderer, the tilemap pipeline, and the animation work. They are wrong in these places:
- `README.md` lists walking animation as future work.
- `docs/art-direction.md` describes the world as `wildhaven.png` at 3072×2048.
- `docs/verification.md` counts nine tests.

When a doc and the code disagree, trust the code, and update the doc if you touch that area.

## gstack-game Skills

Version 0.5.0 of [gstack-game](https://github.com/fagemx/gstack-game) (MIT license) is installed in `.claude/skills/`. It adds 29 skills for reviewing game designs and doing QA; they don't write game code. `.claude/skills/gstack-game/` holds the skill router and the `bin/` helper scripts. The skills that fit this game best are `/feel-pass`, `/playtest`, `/game-qa`, `/gameplay-implementation-review`, `/balance-review`, `/game-ux-review` and `/player-experience`.

- Skill reports and logs are saved under `~/.gstack/`, outside the repo.
- Each skill starts with a shell snippet that doesn't quote the project folder name. Because this folder's name contains a space ("game 1"), every skill run creates an empty `1/` folder in the project root. Delete it; it isn't part of the game.
- `gstack-game-redact` and `gstack-review-log` need Bun, which isn't installed, so those steps are skipped.
- Don't edit the installed `SKILL.md` files, because upstream generates them from `.tmpl` templates. To update, clone the repo fresh and run its `bin/install.sh --no-prefix .` from this project's root.

## awesome-gamedev-agent-skills Plugins

[awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0) is installed as Claude Code plugins at project scope (declared in `.claude/settings.json`). Unlike gstack-game, these skills write game code. Four bundles are enabled: `router`, `web-engines`, `disciplines` and `genres` (31 skills). The router detects Phaser from `package.json` and loads matching skills; the most useful here are `phaser-core`, `survival-crafting`, `save-systems`, `game-ai`, `create-game-assets`, `camera-systems`, `input-systems`, `game-feel` and `game-ui-ux`.

- The other engine bundles were left out to keep the skill list short. The `workflows` bundle was also left out because its `game-docs` skill shares a name with gstack-game's `/game-docs`.
- This file overrides those skills. In particular: **don't use Phaser Arcade Physics** (the router pairs it with movement work). Collision stays in `src/world/map.js`, movement in `src/actions/move.js`, and input in `src/core/input.js`. Keep UI in HTML/DOM, not Phaser HUD scenes. Verify through the `wildhaven` launch config rather than adding Playwright.
- Update with `claude plugin marketplace update awesome-gamedev-agent-skills`.
