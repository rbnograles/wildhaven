# First playable verification — 2026-11-19

## Harvestable supply sprites and 6 s gathering — 2026-11-19

- Spec: `docs/superpowers/specs/2026-11-19-harvestable-supplies-design.md`. Placement review: `docs/screenshots/node-placement-proposal.png`.
- `npm test`: 24 passed, 0 failed. `npm run build` succeeded (only the existing chunk-size warning).
- `python tools/build-map.py`: `wildhaven.json`, `tileset.png` and `overview.webp` are byte-identical to before (SHA-256 compared). Moving the nodes removed no scenery and reshuffled nothing.
- Browser checks at `http://127.0.0.1:5179/` (a second launch config, `wildhaven-verify`, because another session held 5173). The pane was hidden and the app window not in view, which pauses `requestAnimationFrame`. For the timed checks, the page's `requestAnimationFrame` was routed through `setTimeout` from the console; no project code was changed for this.
  - Scout at the pine: the sprite glows with an E cap on its canopy and the button reads "Chop pine tree". E plays the overhead swing with a progress bar and "Chopping pine tree… move to stop". It finished with +3 wood, `pine-wood` was saved, and the tree faded out.
  - Builder at the village berries: auto-repeat from a key held before E did not cancel; a held movement key did. The uninterrupted pick finished in 6.0 s of real time (+2 food, saved).
  - Survivor: driftwood showed the bar at about 45% after about 2.7 s. At the beach stones, a 120 ms tap of S cancelled with nothing awarded. Esc for 7 s froze an action, which finished about 5 s after resuming (+2 stone).
  - Collision: walking north into the village loose stones stopped at y 2190 (base 2180 + 10 clearance). After gathering, the same walk passed through.
  - 375×812: no horizontal overflow, the cap sits on the canopy rather than under the HUD, and the button and touch arrows fit. The console and Vite error logs were empty.
- Not checked: the Canvas-renderer fallback (no glow, cap only), and `prefers-reduced-motion` (no bob, instant fade) in a browser.

## Sprite-map art replacement — 2026-11-19

- Replaced four ground textures and sixteen object sprites with individually generated art, using the approved character sheet as the reference every time. Exact prompts and selected full-resolution originals are preserved under `assets/world/source/`.
- All twenty delivery PNGs passed filename and prompt-sidecar checks. Ground textures are square at 1254 pixels; the existing build resizes them to 256. All sixteen sprites match the requested canvas dimensions, contain real alpha, and have fully transparent outer borders. Proportional fitting retains the object silhouettes. Origins and rectangular base footprints were adjusted for the new sprites.
- Visually inspected a 2-by-2 repeat of every ground texture, all objects composited over a green background, and the complete rebuilt map. Hidden RGB halos in some generation previews disappear under the actual alpha channel. The selected workshop revision has a cold forge.
- `python tools/build-map.py docs/screenshots/world-map-generated-art.png` succeeded: 736 tiles and 216 objects. `tools/make-standin-art.py` was not run.
- `npm test`: 20 passed, 0 failed. `npm run build` succeeded. Vite still reports inconsistent JSON import attributes in `src/render.js` and a JavaScript chunk larger than 500 kB; no rendering or application code was changed for this art task.
- Browser checks at `http://127.0.0.1:5178/`: Scout, Builder, and Survivor starting areas loaded with the new sprites and minimap. Movement worked in all three. Scout moved from 620 E to 716 E; Builder moved from 3072 E to 3165 E. Survivor moved west away from the driftwood marker. Browser warning/error log was empty.
- Evidence: `docs/screenshots/world-art-scout.jpg`, `world-art-village.jpg`, `world-art-coast.jpg`, `world-sprite-contact-sheet.jpg`, `world-terrain-repeat-check.jpg`, and `world-map-generated-art.png`.
- Collision remains a rectangular approximation of each solid base; every perimeter and scattered placement was not exhaustively playtested. Earlier notes below describe the original prototype and its earlier asset pipeline.

## Automated checks

`npm test`: nine passing Node tests covering distinct valid character starts, normalized movement and bounds, save roundtrip, invalid save rejection, one-time proximity-based gathering, discovery, separate character saves, storage failure, and stale-tab save protection.

The initial state suite failed before the state module existed, then passed after implementation. The stale-tab regression test reproduced a lost-save overwrite (eight passed, one failed); compare-before-write save protection made all nine pass.

`npm run build`: successful Vite production build. Dependencies installed with zero npm audit vulnerabilities at installation time.

## Browser checks

Tested in the Codex in-app browser at http://127.0.0.1:5173.

- Scout: selection loaded Pinefall Woods at 620 E, 550 S with the green sprite and expected supplies. E gathered three wood; D moved the character to about 775 E with camera follow.
- Builder: selection loaded Hollowstead Village at 1450 E, 890 S with the builder sprite and five wood/two stone/two food. Gathering and movement updated the run, and returning to selection preserved its separate slot.
- Survivor: selection loaded Driftwood Coast at 2400 E, 1580 S with the survivor sprite and starting supplies. Gathering increased wood to six. Reloading and continuing restored six wood and the moved position at 2320 E, 1580 S.
- Opening the map displayed all three locations and the player's position. Closing it returned to the world.
- Pause stopped movement: holding D while paused left coordinates at 2320 E, 1580 S. Return to characters and continue both worked.
- Keyboard selection now calculates arrow navigation from the focused card rather than the previously selected card.
- Desktop checked at 1280x720 and concept-sized 1536x1024. Narrow selection and gameplay checked at 390x844, with no horizontal document overflow. Compact movement controls are visible.
- Browser console inspection returned no warning or error entries.

Screenshots are retained as user-facing project evidence in `docs/screenshots/`, rather than temporary QA files. Final delivery uses the clean `localhost` origin so verification progress at `127.0.0.1` does not occupy the user's starting save slots.

## Independent review

A fresh reviewer read state, save handling, rendering, UI and tests. Two material findings were fixed:

1. A stale paused tab could overwrite a newer save during page hide. The save session now compares the current stored slot with its last observed value, preserves newer data and reports a conflict. The regression test failed before the fix and passes after it.
2. Fullscreen previously targeted only the game section, excluding the selection screen when returning. It now targets the document root, which contains both screens. Native fullscreen could not be exercised in the embedded browser, so this particular behavior is code-reviewed but not verified in a separate desktop browser.

The review also identified focused-card arrow navigation; it was corrected and checked in the browser.

## Limits

This is the character-selection and exploration milestone. The original survival/city design remains a roadmap. The map uses approximate major-obstacle geometry and passable decorative foliage. The approved atlas supplies four idle directions with a movement bob, not full walking frames. No city construction, settlers, survival damage or combat is claimed.

Generated assets, exact prompts and the concept-to-render comparison are documented in `docs/art-direction.md`.

## Resume on refresh — 2026-11-19

The tab now remembers which character it is playing (`wildhaven.active` in `sessionStorage`), so refreshing mid-game resumes play instead of showing the selection screen. Only "Return to characters" (pause menu) or "Back to characters" (loading screen) clears it. A new tab, or a closed and reopened browser, starts at selection.

Checked at http://127.0.0.1 in the Claude in-app browser:

- Builder: began a journey, walked east to 3243 E, refreshed. The page went straight to the game as the Wandering Builder at the saved position, with the "Welcome back" toast.
- Pause → Return to characters cleared the marker; refreshing then showed the selection screen.
- A marker pointing at a character with no save (survivor slot removed) fell back to the selection screen with that card selected, and cleared the marker.
- No console errors. `npm test`: 20 passing, including two new tests for the active-character helpers in `src/storage.js`.

## In-game bottom bar removed — 2026-11-19

The strip along the bottom of the game screen (coordinates, key hints, "Saved locally") is gone. Save problems still surface through the toast and the pause dialog's note. The minimap, Gather button, toast and touch controls were lowered by the bar's height so they sit near the screen edge.

Checked at http://127.0.0.1 as the Scout: at desktop size the minimap, Gather prompt and welcome toast don't overlap, and there are no console errors. At 390×844 the touch controls (bottom-left), minimap (bottom-right), Gather prompt and toast don't overlap, and there's no horizontal overflow. `npm test` (20) and `npm run build` pass.

The selection-screen footer now also lists **Shift** Run and **Esc** Pause, since the in-game bar that showed them is gone. It fits on one line at desktop size. At 390 px the five hints wrap to two centered rows with no horizontal overflow.

## Harvestable wild flowers — 2026-11-19

Wild flower patches are drawn at 0.4 scale (about 100×60, smaller than the 112-unit character). All 38 are now pickable for 2 herbs and grow back 180 game-seconds later. The rebuilt map left `wildhaven.json` and `tileset.png` byte-identical. Only `overview.webp` changed, because it now draws the smaller flowers.

Checked at http://127.0.0.1:5179 (the `wildhaven-verify` config) as the Builder, using a seeded save beside `flowers-3480-2429`:

- The patch showed the E cap and "Pick wildflowers". E looped the gather clip with "Picking wildflowers… move to stop" and a progress bar. It finished with "+2 herbs · Wildflowers", Herbs 0 → 2, and "Gather your first supplies" ticked. The patch faded out.
- The save held `regrowAt: {"flowers-3480-2429": 194.05}` with `elapsed` 20.0 and an empty `collected`.
- With the timer edited to five seconds ahead and the player standing beside the patch, it faded back in after the timer ran out (slower in real time while the pane rendered under 20 fps). It came back with the cream glow, the E cap and the prompt.
- At 375×812 the resources panel fits all four counters. No console errors.
- `npm test`: 29 passing. New tests cover herb patches that are walk-through and smaller than a character, a 16-unit flood fill showing every supply and patch can be reached and gathered from the spawns, regrowth on the game clock, old saves loading with no herbs or timers, and timer clamping/dropping. `npm run build` passes.

## src/ restructure — 2026-11-19

Behavior-preserving move to role-based folders (`data/`, `world/`, `actions/`, `game/`, `animation/`, `render/`, `ui/`, `core/`). See `docs/superpowers/specs/2026-11-19-src-restructure-design.md`.

- `npm test`: 37 passing. The old state tests are split by subject. New tests cover `beginGather`, map edges, and `tests/boundaries.test.js`, which keeps the pure modules free of browser-only code. `npm run build` succeeds.
- Before `state.js` was deleted, the copied data was checked equal to its exports: characters, nodes, supplies, wild kinds, resources, `GATHER_SECONDS`, locations, world size, obstacles and solid bases.
- Browser (port 5177): Builder played through selection, loading, walk, the 6 s timed gather (busy label, cancel on a fresh movement press, key-repeat ignored, award once), map, pause (movement ignored), save, return, continue, refresh-resume and the animation preview. Scout and Survivor started fresh and gathered (Survivor picked wildflowers for +2 herbs). Console shows no errors. The "Discovered" toast was not reproduced in the browser (the route to Hollowstead was blocked); discovery is covered by tests/actions/discover.test.js and its loop code is unchanged.
- A Builder save made before the restructure loaded with the same resources.

## Prettier and ELI5 comments — 2026-11-19

Added Prettier 3 (`npm run format`, `npm run format:check`) and a plain-language comment above every named function, plus file headers, data-table notes, CSS section headers and `#` comments on the Python tools. The rule is written under "Code Style" in `CLAUDE.md`, and `tests/comments.test.js` enforces the comments.

- Every JS file except `src/ui/layout.js` and `src/animation/preview.js` was minified with esbuild (whitespace and comments stripped, names kept) at HEAD and after the change. The output is byte-identical, so only formatting and comments changed. The minified CSS is identical to HEAD run through Prettier. The only difference from HEAD is a space Prettier adds after custom-property colons, and browsers trim that space.
- `layout.js` and `preview.js` also had their HTML template strings formatted (`/* HTML */`), which changes whitespace inside the HTML. The old and new templates were both mounted in the browser at 1366×850 and 390×844. All three screens, all three dialogs and the animation preview were measured: 215 elements in all, with every bounding box identical.
- Browser (127.0.0.1:5178): the Builder started fresh, walked at 155 units/s, and gathered scrap timber in 6 s for +3 wood with the busy label. The quest ticked. The map, pause and animation preview all opened. No console errors.
- `npm test`: 38 passing (the new comment-rule test included). `npm run build` and `npm run format:check` pass.

## Main menu (painted triptych) — 2026-11-19

Built from `docs/superpowers/plans/2026-11-19-main-menu.md` (commits 1a4a97b..e7ff0a4). Checked in the browser on the dev server (port 5177).

- No vertical or horizontal scroll at 1920×1080, 1366×768, 1280×720, 768×1024, 390×844, 360×640 and 320×480 (also 667×375 and 844×390).
- Desktop and tablet: the chosen panel takes about half the width (639/321/321 px at 1280×720), each panel shows its own third of the painting without stretching, text is 12 px or larger, and Start fresh and Preview animations are 44 px tall.
- The chosen character stands just above the details at every size, because its position follows the details panel's height: 486 px tall at 1920×1080, 293 px at 1280×720, 380 px at 390×844. Landscape phones leave little room (about 28 px at 667×375); that is a known limitation.
- Phone: one panel at a time; the ‹ › arrows, the dots and a touch swipe change character; mouse drags are ignored; `touch-action: pan-y` lets real swipes through. Swipe was tested with simulated touch pointer events, not on a real device.
- Arrow keys move the selection and focus, wrapping round. Continue, Start a fresh adventure and Preview animations work. No console errors.
- In-game controls strip: shows when the game opens, fades on the first real step or after about 8 s, shows again on Continue, and is hidden on phones. Clicks pass through to the E button, and below 1000 px it moves bottom-left to clear the minimap.

## Big world (build 1) — 2026-11-19

Branch `big-world`. Automated: `npm test` 55 passing (includes the collision-grid check, region lookups, landmark and signpost discovery, travel, version 3 saves, and a 24-unit flood fill reaching every spawn, landmark, signpost and supply); `npm run build` and `npm run format:check` pass. Map build: 1456 tiles, about 3,600 objects, 2.1 MB map file, 6.7 MB tileset.

Browser at `http://127.0.0.1:5199` (a dev server run from the worktree, so saves on port 5173 were untouched):

- Builder, fresh start: title "Hollowstead Meadows"; the save is `version: 3` with `discovered: ['meadows']` and `landmarks: ['h-square']`; the goals card shows "Gather your first supplies 0 / 1" and "Discover three regions 1 / 3".
- With a save holding three regions and a gather, the card switches to "EXPLORING / Hollowstead Meadows / Places found 2 / 7 / Signposts found 2 / 2", and to "Emerald Jungle, 1 / 7, 1 / 2" after travelling there.
- World map: seven region labels, unexplored regions dimmed, found places and signposts marked, one button per found signpost. Clicking "Travel to Temple Path Signpost" closed the map, placed the player at the signpost with the camera already there, showed "Travelled to Temple Path Signpost" and saved the new position.
- Scout, fresh start: "Pinefall Woods", `landmarks: ['p-camp']`. Walking north onto the Pinefall Signpost showed "Signpost found: Pinefall Signpost" and saved it.
- Survivor, fresh start at 390 px wide: "Driftwood Lagoon", `landmarks: ['l-wreck']`; the map dialog fits with no horizontal overflow and its footer wraps to two lines.
- Terrain looked right at a snow ford, the desert oasis and dry riverbed, and in the jungle. Frame rate while walking through the jungle: 61 fps.

Not checked by hand: walking across a region border on foot (positions were set through the save for speed), travel with reduced motion on, the two bridge crossings, and gathering being cancelled by travel. The unit tests cover the rules behind the first three; the last has no test.

## Pinefall field journal (prototype) — 2026-11-19

A playtest prototype for build 2 (slice plan: `~/.gstack/projects/game 1/ryann-main-slice-plan-20261119-134500.md`). Automated: `npm test` 60 passing (4 new in `tests/world/journal.test.js`: one page per Pinefall place, the trail skipping found places, journal pages only for places that have one, and every "<direction> of the <thing>" in a clue checked against the real map within 60°); `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5177` with the Scout's existing save (camp found):

- The top bar shows a "Journal J" button with an orange dot; the controls strip lists `J Journal`.
- J opens the journal and pauses the game: "Pinefall Woods", 1 of 7 pages, the Scout's Camp page with the tent keepsake, six dashed empty pages, and the trail clue "A fallen giant lies hollow a short walk north-west of the Scout's camp." The dot clears on opening.
- Following the clue (north-west, about 8 s at a run) found Hollow Log: the toast read "Found Hollow Log · New page in your journal (J)", the dot came back, and the console log read `found landmark: Hollow Log` then `followed the trail clue to Hollow Log, 10 s after first reading it`.
- Reopened: 2 of 7 pages, the log keepsake shown, the clue moved on to Grandfather Pine.
- 375×812: the journal button shrinks to its icon beside pause; the journal stacks pages one per row and scrolls inside itself; no horizontal scroll.
- No console errors after the reload (earlier 500s in the log came from another session moving character art while the dev server was running).

- Brand-new Scout ("Start a fresh adventure"): the welcome line read "Welcome to Pinefall Woods. Your story begins here. Your journal has its first page (J)." and the log began `start scout (new adventure)`, `found region: Pinefall Woods`, `found landmark: Scout's Camp`. This run found a bug: the dot stayed hidden because the bookmark was kept per character across games. The bookmark is now kept per game.

Not checked by hand: the "every page filled" state, and the other five Pinefall clues on foot (the compass test covers their directions, not whether they read clearly).

## Character sprites split into per-character folders — 2026-11-19

Every sheet the game loads now sits in `assets/characters/<id>/`. The two all-character originals (idle and side-walk) moved to `assets/characters/originals/`, and `tools/split-character-sheets.py` cut them into per-character copies, each pixel-identical to its row of the original. Automated: `npm test` 60 passing, `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5178` (1280×720):

- Main menu: each panel shows its own character's south-facing idle pose (scout, builder, survivor).
- Builder, fresh start (the old version-2 test save took the start-fresh path): the HUD face shows the builder's head and shoulders (`data-portrait="builder"`, `background-size: 400% 133.333%`); the player stands in the builder's idle pose and walks east on the builder's side-walk sheet. No console errors.

Not checked by hand: the scout and survivor in-game (they use the same code path as the builder) and the 390 px layout (no sizes changed).

## World art split into kind folders — 2026-11-19

Ground textures moved to `assets/world/source/ground/`; object sprites to `objects/{trees,plants,rocks,buildings,props}/`, named by a new `kind` field in `objects.json`; originals to `originals/<kind>/`. Rebuilding with `python tools/build-map.py` before and after the move gave byte-identical `tileset.png`, `wildhaven.json` and `overview.webp` (SHA-256 compared), and `python tools/make-biome-standins.py` found and kept all 15 of its files. Automated: `npm test` 63 passing (3 new in `tests/world/objects.test.js`), `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5178` (1280×720), Builder in Hollowstead: all 29 sprites loaded from their kind folders (buildings 7, plants 5, props 4, rocks 6, trees 7); houses, workshop, boulder, log and berry bush drew as before; no console errors.

Not checked by hand: the field journal's keepsake pictures (they use the same `objectUrls` names, which did not change).

## SpriteCook palm replaces the palm stand-in — 2026-11-19

The palm stand-in (a narrowed oak) was replaced with one image from the SpriteCook Claude plugin (`gemini-nano-banana-2.1`, HD, transparent background, with `starting-characters-idle-v1.png` uploaded as the style guide; 12 credits). The cutout came back clean: alpha is 0 outside the tree. The sprite was cropped to its alpha > 40 bounds and fitted into 200×300 with 4 px padding. Its trunk base sits at x 153 of 200, so `objects.json` now gives the palm `origin` `[0.765, 0.982]` and `footprint` `[15, 12]`. `python tools/build-map.py` rebuilt the map: only `overview.webp` changed, because palm positions and names did not. Automated: `npm test` 63 passing, `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5179` (1024×768, hidden pane), test survivor save (the old version-2 survivor save there was backed up and restored afterwards):
- Driftwood Lagoon, next to the two palms west of the Driftwood Signpost: both palms draw with the trunk base on their map point and the crown leaning left, sized like the other trees.
- Emerald Jungle, after signpost travel to Jungle Gate (the travel button's own click handler): the palm west of the signpost draws the same way.
- `isWalkable` around the palm at (20485, 9518): blocked from x −20 to +20 and y −20 to +5 around the trunk base (footprint plus the player's body); open ground under the crown, where the old centred origin would have put the base.
- No console errors.

Not checked by hand: walking into a palm with the keyboard (the hidden pane ran at a low frame rate), and the 390 px layout (no layout changed).

## Hills, cliffs, soil and grass detail from the Nano Banana art — 2026-11-19

`python tools/prepare-generated-art.py` then `python tools/build-map.py`: 17 hills (8 meadow, 6 canyon, 3 snow), 25 flights of stairs, 132 cliff tiles, 6,728 objects (was 3,633; the new ones are the stairs, grass tufts and dirt patches), 3.0 MB map file. Automated: `npm test` 70 passing (6 new in `tests/world/cliffs.test.js`, 1 new in `tests/actions/move.test.js`), `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5173` (another chat's dev server on this folder; 1024×768, hidden pane). A test builder save was written there (no saves existed at that origin) and removed afterwards.
- Hollowstead, two-level meadow hill: from the foot of the lower stairs, walking north climbed onto level 1 and stopped at the level-2 wall; walking east then north climbed the second flight onto level 2 and stopped at its north edge; running west (Shift) stopped at the edge beside the wall below. The walls, stairs, lips, level highlight, soil patches, tufts and dirt patches drew as in the offline renders.
- Frostpeak, three-level snow mountain: walking north into the bottom wall stopped at its foot. Snow walls and stairs drew correctly.
- No console errors.

Not checked by hand: the canyon kit in game (checked in an offline full-resolution render only), frame rate (the hidden pane is throttled; about 160 sprites are on screen at once), and the 390 px layout (no layout changed).
