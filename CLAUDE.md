# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wildhaven is a single-player, top-down browser exploration game. It is still a prototype. On the selection screen the player picks one of three characters: Frontier Scout, Wandering Builder, or Shipwreck Survivor. Each one starts at its own spot in one shared world. The current milestone covers character selection, exploration, supply gathering, discovering three regions, and saving each character separately. The long-term direction is a survival-and-settlement game with building, settlers, survival meters, and wolves. That design is in `docs/superpowers/specs/2026-11-19-survival-settlement-design.md`, but none of it is implemented. **Do not describe roadmap features as if they already exist.**

The standardized game design document is `docs/gdd.md` (imported 2026-11-19 with `/game-import`). It tags every item **[Built]** or **[Planned]**, records the audience (cozy survival), fantasy (exploration/discovery), retention hooks, and the hobby/no-monetization intent, and lists open spec-vs-build mismatches. When the GDD and the code disagree, trust the code.

## Commands

```sh
npm install
npm run dev          # Vite on http://127.0.0.1:5173 (also the "wildhaven" config in .claude/launch.json)
npm test             # node --test: runs tests/*.test.js with Node's built-in runner
npm run build        # Vite production build → dist/
npm run preview      # serve dist/

node --test tests/state.test.js                                   # one file
node --test --test-name-pattern="stale tab" tests/storage.test.js # one test by name

python tools/build-map.py [preview.png]   # regenerate assets/world/map/* (needs numpy + Pillow)
```

There is no linter or formatter. Requires Node 20.19+ or 22.12+; the project was developed on Node 24.

Saves are scoped to the page's origin, so `127.0.0.1` and `localhost` are separate save locations. Do verification at `127.0.0.1` (the dev script's host) so it never overwrites the user's own saves on `localhost`.

## Tech Stack

Vanilla JavaScript ES modules, no framework. Vite 7 bundles the code and assets. Phaser 4 is used **only as the renderer**. HTML/CSS handle the UI and dialogs. Node's built-in `node:test` runs the tests. Python (numpy, Pillow) builds the map offline.

## Architecture

Game rules are pure modules. Rendering and the DOM are thin layers around them.

| Module | Role | Runs in Node tests? |
| --- | --- | --- |
| `src/state.js` | World size, characters, spawns, supply nodes (sprite, solid base, verb, clip), regions, collision (`isWalkable`, `nodeBases`), movement, `gatherTime`/gather/discover, save serialize/validate | yes |
| `src/storage.js` | Per-character localStorage save session with compare-before-write | yes |
| `src/animation.js` | Clip table (`CLIPS`), the animator state machine, frame sampling | yes |
| `src/animation-art.js` | Loads sprite sheets and measures each frame's bounds from alpha pixels; `resolvePose` | no (DOM/Vite) |
| `src/render.js` | Phaser scene: tile layers, depth-sorted objects, supply sprites (glow, E cap, progress bar, fade-out), player sprite, camera, minimap/world-map canvases | no |
| `src/animation-preview.js` | "Preview animations" debug dialog that never writes game state | no |
| `src/main.js` | Builds all DOM, switches screens (selection → loading → game), handles input, runs the `requestAnimationFrame` loop, updates the HUD, decides when to save | no |

**Keep the tested modules runnable in Node.** `state.js`, `storage.js`, and `animation.js` must not import PNG/CSS files, use `import.meta.glob`, or touch the DOM. `state.js` loads its JSON with `import ... with { type: 'json' }` so that Node can read it. Browser-only modules use Vite's plain imports.

**Input belongs to `main.js`, not Phaser.** Phaser's keyboard, mouse, and touch input are switched off. `main.js` tracks held keys in a `Set` and feeds them to `movePlayer`. The game counts as paused whenever the pause, map, or reset `<dialog>` is open (`isPaused()`). The simulation also stops while the tab is hidden.

**Frame loop (`main.js` `frame`).** Each frame: clamp `dt` to 0.05; if an action is running and a movement key is held, `cancelAction` (nothing is awarded); call `movePlayer`, then `advanceAnimation`. When a timed action *finishes*, call `gather(state, target)` with the node id it targeted. Pressing E only starts the action (`startAction(animator, node.clip, node.id, gatherTime(state, node))`), so supplies are granted exactly once. Then run `discover`, autosave every 10 s, call `renderer.draw`, and refresh the HUD about every 0.12 s. Because `dt` is clamped, game time runs slower than real time when the page renders below 20 fps (e.g. a hidden browser pane), and an action takes longer.

**Save model.** Each character has its own key, `wildhaven.adventure.v1.<characterId>`, and the save object is `version: 2`. `restoreGame` validates the data strictly and *rebuilds* the object field by field. Adding a field to game state therefore means updating `createGame`, the checks in `restoreGame`, and the object it returns, or the field is silently dropped on load. If old saves can't be read safely, bump `version`; old saves then show the "could not be read, start fresh" path. `createSaveSession` remembers the last raw value it saw and refuses to write if storage has changed (`reason: 'conflict'`), so a stale tab can't overwrite a newer save. Saves happen on gather, discovery, opening pause, hiding the tab, `pagehide`, and every 10 s. Separately, `readActive`/`setActive` keep the character being played in `sessionStorage` (`wildhaven.active`); on load `main.js` resumes it if that slot has a readable save, so a refresh returns to the game. Only the "Return to characters" and loading-screen "Back to characters" buttons clear it. Animation state is never saved, and a test checks this.

**Directions** are encoded everywhere (state, sprite columns, locomotion rows) as `0 = south, 1 = west, 2 = east, 3 = north`.

## World / Map Pipeline

```
assets/world/source/{grass,dirt,sand,water}.png
assets/world/source/objects/*.png + objects.json  ──► tools/build-map.py ──► assets/world/map/
                                                                            tileset.png
                                                                            wildhaven.json  (Tiled format)
                                                                            overview.webp   (minimap/world map)
```

- `wildhaven.json` is the single source of truth for both rendering and collision. The map is 96×64 tiles at 64 px each (6144×4096 world units), with tile layers `ground`/`dirt`/`sand`/`water` plus an `objects` point layer.
- Collision in `state.js` combines two sources. The water layer uses per-tile corner masks: the four corner values are blended, and a point counts as water at ≥0.35 (the corner-mask encoding is shared with `build-map.py`). Each object also has a solid base, its `footprint` in `objects.json`.
- `objects.json` fields: `origin` is the ground contact point as a fraction of the sprite size. `footprint` is `[halfWidth, depth]` of the solid base; leave it out for walk-through objects. `flat` means the object is drawn under characters. `scale` is the draw size wherever the map places that sprite (flowers use 0.4 so a patch is smaller than a character); the footprint scales with it. Every other object is depth-sorted by its y position, so the player can walk in front of or behind it.
- **`build-map.py` hard-codes coordinates that also live in `state.js`.** `REGION_OFFSETS` must match `V_OFF`/`C_OFF`. `KEEP_CLEAR` lists the absolute positions of the spawns and supply nodes; scattered scenery within 150 of them is removed after scattering. If you move or add a spawn or node, update `KEEP_CLEAR` and re-run the script. **Never edit `SCATTER_CLEAR`.** It is the frozen list the scatter loop has always skipped. Changing it changes the random sequence and reshuffles every later tree and rock, which can put a solid base under a saved player and make that save unreadable. The placement of landmark buildings (tent, houses, workshop, ship) is also defined in `build-map.py`.
- **Supply nodes are not in the map.** `render.js` draws each one from `NODES` (`sprite` is an `objects.json` key, drawn at `scale`), and `state.js` makes its scaled footprint solid until it is collected (`nodeBases`). `movePlayer` ignores a base the player is already inside, so an old save can't get trapped.
- **Wild scenery is in the map and also harvestable.** `WILD` in `state.js` names scattered sprites (today only `flowers`) that become `NODES` entries with id `<name>-<x>-<y>` and a `regrow` time. `render.js` skips them in the scenery loop and draws them with the supplies. They are walk-through (no footprint), so `nodeBases` covers only the fixed `SUPPLIES`.
- `tools/make-standin-art.py` cut placeholder source art out of `assets/world/wildhaven.png`. **Do not re-run it.** It would overwrite any source art that has since been replaced. To change art, replace the file under `source/` and re-run `build-map.py`.

## Character Sprites

- `assets/characters/starting-characters-idle-v1.png` has 3 rows, one per character (`CHARACTERS[i].row`), and 4 columns, one per direction. It is also used through CSS for the selection-screen portraits and the HUD portrait.
- `animations/<id>-locomotion.png` has 8 rows (walk S/W/E/N, then run S/W/E/N) with 4 frames each. `animations/<id>-actions.png` has 5 rows (gather, build, craft, fight, swim). The action art faces east and is mirrored for west.
- `animations/side-walk-v2.png` is a shared horizontal-walk sheet with one row per character. It is used for walking west or east, with each frame anchored on the head to prevent sliding (`steadyAnchors`).
- The row boundaries are measured **`edges`** arrays in `SOURCES` in `src/animation-art.js`, not equal-height rows. If you regenerate a sheet, re-measure its edges. Columns are equal quarters of the sheet width. Within each cell the frame bounds come from pixels with alpha > 40.
- Idle, walk, run, gather, and build are used in play. `build` (an overhead swing; the art shows a hammer) stands in for chopping the pine tree until an axe animation exists. Craft, fight, and swim exist only in the preview dialog and must not imply working mechanics.

## Game Rules That Affect Code

- There are four resources (`RESOURCES`): `wood`, `stone`, `food`, `herbs`. They are always non-negative integers, and `restoreGame` rejects anything else. Herbs come only from wild flowers and have no use yet. Saves from before herbs existed load with `herbs: 0`.
- Fixed supplies (`SUPPLIES`, the first nine `NODES`) can each be collected once and are tracked by id in `state.collected`. Wild flower patches give 2 herbs and grow back 180 game-seconds later. `state.regrowAt` maps a picked patch's id to the `state.elapsed` time it returns, so the regrowth clock stops when the game is paused or the tab is hidden. On load, `restoreGame` drops timers for patch ids the map no longer has and caps each timer at one `regrow` ahead. Saves without `regrowAt` load with `{}`. Both rules are availability checks in `isAvailable`. A node is gatherable within 95 units. Regions (`LOCATIONS`) are discovered within a 230-unit radius of each spawn.
- Movement speed is 155 units/s walking and 245 units/s with Shift. Collision is checked separately on the x and y axes so the player slides along obstacles.
- Every gather is a timed action of `GATHER_SECONDS` = 6 s, read through `gatherTime(state, node)`, and its clip loops for the whole time. This is a design decision: planned gathering tools will lower it towards 0.5 s through `gatherTime`, so don't shorten the base time as a "fix." A fresh movement press cancels the action and awards nothing. Key-repeat from a key that was held when E was pressed does not cancel it. Pause and a hidden tab freeze it.
- When a node is in reach, its sprite glows (Phaser Glow filter, WebGL only) and an E key cap floats over it. A progress bar replaces the cap while the action runs. Gathered sprites fade out, and regrown patches fade back in; there is no stump or bare-bush art yet.
- Balance numbers are constants inside `src/state.js`. There is no separate data file.

## Conventions

- Match the existing compact JS style: dense one-line statements and short helpers. Comments explain *why*, not what.
- Every generated art asset sits next to a `.prompt.txt` holding its exact generation prompt. Keep the original PNGs, and add a prompt file for any new generated art. The asset inventory is in `docs/art-direction.md` and `assets/characters/README.md`.
- Any failure while loading assets must end on the loading screen's retry state, never an endless loader. Image loads have timeouts (`loadImage`, plus the 20 s Phaser scene timeout).
- Keep `prefers-reduced-motion` support. It turns off camera smoothing, CSS transitions, and preview autoplay.
- Desktop keyboard and mouse is the primary target. Layouts must still work at about 390 px wide, where on-screen touch movement buttons appear.
- Feature plans go in `docs/superpowers/plans/`, and browser verification notes go in `docs/verification.md`.

## Verifying a Change

- `npm test` and `npm run build` must both pass.
- Unit tests don't cover rendering, input, animation, the map, or the UI. If you change any of those, start the game from the `wildhaven` launch config and play through with each affected character. Check the browser console for errors. If layout changed, also check the page at about 390 px wide. Add notable checks to `docs/verification.md`.

## Stale Docs

Some docs predate the Phaser renderer, the tilemap pipeline, and the animation work. They are wrong in these places:
- `README.md` calls `render.js` "Canvas rendering" and lists walking animation as future work.
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
- This file overrides those skills. In particular: **don't use Phaser Arcade Physics** (the router pairs it with movement work). Collision and movement stay in `state.js`, and input stays in `main.js`. Keep UI in HTML/DOM, not Phaser HUD scenes. Verify through the `wildhaven` launch config rather than adding Playwright.
- Update with `claude plugin marketplace update awesome-gamedev-agent-skills`.
