# First playable verification — 2026-11-19

## Regenerated deleted world sprites — 2026-11-19

- Replaced seven deleted placeholders with new built-in image-generation artwork: berry bush, cactus, sandstone ruin, driftwood, old boat, rowboat and signpost. Their existing game canvas dimensions, object origins and footprints remain unchanged. Original high-resolution images and exact prompts are preserved; `docs/design/regenerated-world-sprites.json` records paths, source bounds and fitted rectangles.
- Inspected all source images and the prepared contact sheet at `docs/screenshots/regenerated-world-sprites.png`. Confirmed each final PNG has the expected dimensions, zero-alpha background and opaque artwork. The old boat has transparent holes and broken benches; the repaired boat has an intact hull.
- `python tools/build-map.py` passed: 3,117 tiles, 6,715 objects, 25 stair flights. `npm run build` and `npm run format:check` passed. Build emitted JSON import-attribute consistency and bundle-size warnings.
- Final `npm test`: **176 passed, 0 failed**. An earlier run had one hunger-health expectation failure; that test changed concurrently in the workspace and the fresh full rerun passed. This sprite task did not modify gameplay or tests.
- Verification here covers asset files, visual contact-sheet review, map rebuild and automated checks. No new interactive gameplay session was performed for these replacements.

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

## M2 loop proof — 2026-11-19

Day/night, meters, campfires and camps, needs list, passing out, walked-area fog, tea and healing, regrowing supplies, save version 4 (spec `docs/superpowers/specs/2026-11-19-m2-loop-proof-design.md`). Automated: `npm test` 117 passing (54 new: clock, fog, camps, needs, build, survive, camp actions, version 4 and the version 3 upgrade, regrowth), `npm run build` and `npm run format:check` pass. The pure rules were also run in Node for a whole night away from a fire: the pass-out comes 90 s after dark, as designed.

**Moving the clock for checks.** Saves on `127.0.0.1` can be edited in the console; the stale-tab guard stops the open tab overwriting the edit. For example, just before nightfall:
`const k='wildhaven.adventure.v1.builder', s=JSON.parse(localStorage[k]); s.time=238; localStorage[k]=JSON.stringify(s); location.reload()`

Browser at `http://127.0.0.1:5180` (800×600), checked:
- Scout, existing version 3 save: loads as version 4 (`time` 20, full meters, 1,536-letter fog); no console errors.
- Fog: the world map is solid fog except around the spawn, and only "Pinefall Woods" is labelled; the minimap clears as you walk. (First pass let the land's shape show through faintly; the fog is now fully solid.)
- Builder, B: the ghost follows the mouse, red with "Something is in the way · Esc to cancel" over the player, green with the cost line on open ground, with the warmth ring. A click placed it: the name box opened with "Hollowstead Camp"; wood 5→2, stone 2→0; the camp shows on the map. Real key presses typed into the name box (m, b, e, w, space) went into the text and did not open the map or move the player.
- Night (time set to 300 and frames stepped by hand): the world goes deep blue; the fire lights a soft circle as wide as its warmth, with a warm glow, and the player has a small light.
- HUD at night beside the fire: "Day 1 · Night" with the moon icon; three meters with "By the fire"; the goals card shows the camp's three needs ("Bring 3 stone 0 / 3", "Find a place in Pinefall Woods 0 / 1", "Find a new signpost 0 / 1"); "1 / 7 places · 0 / 2 signposts" under the region name; the controls strip lists E Gather / camp, B, F and H.

Second pass, with the Browser pane visible (a hidden pane runs no animation frames, so the game cannot even finish loading there):
- Scout with no camp, clock 230 and warmth 4: the goals card read "Build a campfire" (Wood 0 / 3, Stone 0 / 2); at nightfall the toasts "Getting dark, head to a fire." then "You're freezing. Your health is dropping."; the meter words "Cold" and "Freezing". With health 12 the pass-out screen read "You got too cold away from a fire. You woke where you started, at midday. Build a campfire..."; the save then held time 480 (day 2, midday), health 50, warmth 100, hunger lower by the skipped time, and the player at the spawn.
- Builder beside its camp at night, E: the camp dialog showed the name, "CAMP · DAY 1 · NIGHT", the fire size and the three needs. Give 3 stone met the need (fire 260 → 300 units, "1 of 10 needs met"); tea (−5 herbs, 20 s), eat (−1 food, +25 hunger) and heal (−3 herbs, +30 health) each worked, and their buttons then said why they were off ("Still warming you (20 s)", "Needs 3 herbs"). Rest until dawn closed the dialog: "You rest by the fire. Dawn, day 2. New needs at Ember Ho.", time 360, health and warmth 100, and only the met need was replaced (by "Bring 4 wood").
- F then F then H away from a fire: "You eat. +25 hunger", "No food in your pack.", "You are already at full health."
- A pine tree set to regrow 8 s after load was missing, then stood again.
- Survivor: a first camp on the beach (placed with E, renamed "Saltwind Hollow"), then a second one in Pinefall 9,000+ units away (placed with a mouse click, renamed "North Hearth"). Both show on the world map with their names. The ghost turned red with "Something is in the way" next to the driftwood (the 80-unit clearance).
- 375×812: the identity panel with clock and meters fills the first row, the journal, pause and resources wrap below, no horizontal scroll; the camp dialog stacks its four tasks in one column. No console errors.

Bugs found and fixed in these passes: a duplicate `halfW` in `renderer.draw` (blank page); land shapes faintly visible through the fog (fog made fully solid); a mouse click that placed a fire also moved keyboard focus out of the name box, so typing and Enter went nowhere (the click's default is now prevented and the box focuses its input); camp names on the world map sat under region labels (now drawn below the dot).

Not checked by hand: the dusk toast itself (the runs started at dusk; the unit tests cover it), a starving player, and the Canvas-renderer fallback for the night layer.

## HUD rearranged after playtest feedback — 2026-11-19

Feedback: two campfires at the Scout's start; no item box; no build icon; the top resource bar looked poor; the player card should be lower left; the minimap should be round. Changes: the decorative campfire is gone from `tools/build-map.py` (map rebuilt; only that object changed, and the journal's camp page no longer mentions a fire ring); a bottom bar with the player card (left), an item box of resource slots plus a Build button whose menu lists the campfire (centre), and a round minimap (right). Automated: `npm test` 117 passing, `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5180`:
- Fresh Scout: the camp shows the tent, log and rocks, and no campfire.
- 1020×845: card, item box and round map sit in one bottom row without overlapping; the controls strip sits above the card; the goals card is top left and the region name top centre.
- Build button (and B) opens the menu above the item box: "Campfire · Warms the night and founds a camp · 3 wood · 2 stone · 1", with the cost in red when short. 1 starts placing (the bar read "Needs 3 wood and 2 stone · Esc to cancel"); Escape closes the menu or leaves placing; B again closes the menu.
- Food slot: "You eat. +25 hunger"; herbs slot at full health: "You are already at full health."; empty slots are faded.
- 768×1024: card 24–241 px, item box 282–575 px, map 616–744 px; no horizontal scroll.
- 375×812: card top left, journal and pause top right, item box above the touch arrows, round map bottom right, the build menu opens above the item box; key hints are hidden; no horizontal scroll.

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

## Archipelago A1 (2026-11-19)

Browser check (Task 10) at 127.0.0.1:5188, because other sessions held 5173 and 5179. Survivor repaired the Lagoon Rowboat (glow and E cap, progress bar, old boat faded, brown rowboat in the water pointing east), boarded (character shows from the waist up, boat rocks), rowed to Gull Isle ("Found Gull Isle"), hit "Too rough for a small boat." at the deep water, landed on the islet and the mainland, and the boat turned for north and south. Reloading aboard and ashore restored player and boat. Scout found the Pinefall Shore Rowboat, "Pick up driftwood" on the beach, goal card read Wood 6 / 6. A version 3 Builder save loaded with "Welcome back." Narrow screen (375 px): the button read "Board the boat" and boarded by tap. After landing, `player.setCrop()` with no arguments reset the crop (full body again). No console errors; about 60 fps while rowing (requestAnimationFrame count over 5 s).

Known issue: on the world map the "Driftwood Lagoon" label sits over the shallow sea east of the coast, not on land.

## Main's hills and ground detail merged into archipelago A1 — 2026-11-19

`python tools/build-map.py`: 2068 tiles, 6,838 objects, 4.4 MB map file, 25 flights of stairs, 132 cliff tiles; hills per kit: 6 canyon, 8 meadow, 3 snow. Hills are placed in land units on the old land's grid with main's seeds, so main's elevation grid equals the merged grid cropped to tiles 32–287 (rows) × 32–415 (columns), tile for tile: no hill moved or dropped, and the sea border is all level 0. The cliffs layer matches main's too (its tile numbers move up by 240, the new `deep` layer's tiles), and the 25 stairs objects sit at main's spots plus 2,048. Automated: `npm test` 94 passing, `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5188` (this worktree's dev server, 800×600, hidden pane), with the test builder save moved by hand; the origin's saves were backed up and restored afterwards:
- Stonewater Canyons, the hill nearest the west coast (stairs foot at 4096, 9888): walking north climbed the stairs onto the plateau and stopped at its north edge. Walls, stairs, lips and dry grass drew.
- West coast by the Canyon Coast Rowboat: sea, sand beach and the old boat drew; the minimap showed shallow and deep sea.
- No console errors on these loads. (The log's 500s and `"<<<<<<< HE"` JSON errors came from Vite reloading while the merge still had conflict markers.)

Not checked by hand: boating next to a hill (no flight of stairs is within 700 units of water), the meadow and snow kits in game, and the 390 px layout (no layout changed).

## Main's M2 survival loop merged into archipelago A1 — 2026-11-19

`python tools/build-map.py`: 2068 tiles, 6837 objects, 4.4 MB map file, 25 flights of stairs, 132 cliff tiles; hills per kit: 6 canyon, 8 meadow, 3 snow (one object fewer than before: M2 took the Scout's fixed campfire out of the map). Automated: `npm test` 159 passing (new: version 5 round trip, version 3 → 5 and version 4 → 5 upgrades with a camp and fog squares landing at +2,048, rejections including the never-released archipelago version 4, `growFog`, the region-reveal margin, `solidBases`, `sendBoatHome`, passing out aboard, no building aboard), `npm run build` and `npm run format:check` pass. An offline check of main's map against the merged one: of the old map's standable spots (100-unit grid), 0.28% are no longer standable after the 2,048 shift, nearly all within 600 units of the old map's edge where the new coast cuts in; a version 4 player there goes to their spawn and a camp there is dropped.

Browser at `http://127.0.0.1:5188` (this worktree's dev server; 1280×800 and the pane's own narrow size). The origin's three saves were backed up, replaced by test saves, and restored afterwards:
- An M2 version 4 Survivor save (old map positions, old-size fog, one camp) loaded: player and camp both 2,048 further in, fog 2,240 letters, saved back as version 5.
- The goals card read "AN OLD BOAT · Mend a boat" with Wood 6 / 6 and Stone 2 / 2 while the old boat was found and unmended, then the camp's needs. The key strip read "E Gather · Boat", the big map canvas is 1120×800, and the bottom bar showed the player card, item box with Build and the round minimap.
- E repaired the old boat (8 s, cost paid once), boarded it ("Board the boat"), B in the boat said "Step ashore to build" and kept the menu shut, rowing east at dusk drew the night layer and the light around the boat over the whole view out to the deep sea, E stepped ashore, and beside the camp the button read "Open Lagoon Camp" and E opened its dialog.
- Passing out aboard (test save at night, warmth 0, health 2): the pass-out screen said "Your boat drifted back to where you mended it."; the player woke on foot 90 units south of the fire and the boat sat at its launch spot pointing east.
- World map: the whole 7:5 world under fog, the camp named, the moored boat's brown oval drawn.
- A fresh Scout began on day 1 morning with "Build a campfire" and no campfire at the Scout's camp. An archipelago-only version 4 save showed "could not be read. Start fresh to play.", as decided.
- No console errors.

Not checked by hand: the 390 px layout beyond a first look (no layout rule changed), signpost travel while aboard (left for the final fixes), and the far corners of the sea border at night (the camera stops at the world edge and the night layer follows the camera, as in M2).

## Tools and crafting — 2026-11-19

Branch `tools-crafting` (from archipelago A1 at `6f87677`). Automated: `npm test` 187 passing (new: tool kits and wear, recipes and use counts, version 6 saves and the version 5 → 6 upgrade, run-out timers dropped, a save on a chopped tree's spot, the tree and rock nodes and `nodesNear`, walking through a chopped tree and out of a regrown one, no campfire on a chopped tree's spot, the axe rule and `lockedNode`, tool gather times, wear through `finishInteraction`, every craft rule, and the tool ladder for each character), `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5181` (this worktree's own Vite server; other sessions held 5173, 5179 and 5180). The pane ran at about 4 fps for most of the session, so the game ran slow (the clamped `dt`); to save walking, test saves on that origin were moved next to a tree or rock and the page reloaded.
- A new Survivor: the item box showed an Iron slot and the tools row three faded chips. "Gather driftwood" (bare hands, 6 s) gave +4 wood and "Gather beach stones" +2 stone.
- B opened the build menu with the Tools group: "Stone axe · 3 wood · 2 stone" ready, the pickaxe and hammer costs in red with "Needs 1 stone more" on hover. 2 started "Crafting stone axe… move to stop", then "Stone axe made"; wood 6 → 3, stone 2 → 0, and the axe chip read 25.
- Beside a `rocks-b` rock without a pickaxe the button read "Mine rocks — needs a pickaxe" (faded, no glow on the rock), and E said "You need a pickaxe. Make one in the Build menu (B)."
- Beside a palm with the stone axe: glow and E cap on the palm, "Chop palm tree"; E ran "Chopping palm tree… move to stop", then "+2 wood · Palm tree", the palm faded out and the axe chip read 24. Walking north went straight through the palm's spot.
- The save was version 6 with `tools: {axe: {tier: 'stone', uses: 25}}` after crafting.
- A new Scout started with the axe chip at 25; beside the Pinefall pine the button read "Chop pine tree" with the glow and E cap. With the build menu open, 3 said "Needs 3 wood and 3 stone more" and changed nothing; the axe entry now offered the iron axe (2 wood · 1 stone · 3 iron).
- At 390 × 844 the tools row, item box and Build button fit above the touch arrows, and the open build menu fits without scrolling.
- Two layout problems found and fixed: the action button overlapped the tools row by 5 px (it and the toast now sit 30 px higher), and on phones the button covered the bottom of the taller build menu (it now hides while the menu is open).
- No console errors, and no "tree and rock nodes without a picture" warning (every tree and rock node found its scenery picture).

Not checked by hand: mining iron in Stonewater Canyons or Frostpeak, forging an iron tool at a camp, a stone tool's 3-uses warning and break toast, the Builder's hammer chip, a chopped tree staying hidden after walking away and back, and a tree growing back (three in-game days). The rules behind each are covered by the unit tests above; the drawing is not.

## Main (archipelago A1 and the sprite-expansion art) merged into tools-crafting — 2026-11-19

Conflicts were in `CLAUDE.md`, `src/data/supplies.js`, `src/render/renderer.js`, `src/style.css`, `src/ui/hud.js` and `src/ui/layout.js`. Trees now play main's `chop` clip (the Pinefall pine and every map tree) and rocks keep `build`; map oaks, pines and `rocks-a` fall or crack before fading through one `showGone` helper shared with the supplies; the iron slot sits in main's painted item box with the line icon (no painted iron picture yet). Main's map clean-up left 96 iron-streaked rocks (48 + 48), about 1,640 trees and 450 rocks, so the node test now asks for at least 80 iron rocks. Automated: `npm test` 189 passing, `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5181` (this worktree's server), with a test Scout save moved beside a map pine:
- The painted item box holds wood, stone, iron (line icon), food, herbs and Build; the tools row sits above it. Main's painted "E" button overlapped the tools row, so it moved up: 175 px on desktop (main had 146), 160 px up to 1000 px wide, and 243 px on phones (toast 298 px). Measured gaps between the button and the tools row: 19 px at 1024 × 768, 15 px at 900 × 700, 10 px at 390 × 844.
- Beside the pine: glow and E cap, "Chop pine tree"; E played the Scout's axe swing with the progress bar, then "+2 wood · Pine tree", the pine tipped over (the fall frames) and then faded; the axe chip went 25 → 24.
- The painted build menu opened with the Tools group (Iron axe for the Scout, Stone pickaxe, Stone hammer).
- No console errors.

## Painted banks and water ripples — 2026-11-19

`python tools/build-map.py`: 3117 tiles (1,049 of them bank tiles), 6715 objects (1,041 sea waves, 169 river ripples, 8 lake ripples), 4.7 MB map file; the tileset is 4092×3366. Automated: `npm test` 176 passing, `npm run build` and `npm run format:check` pass.

Offline: patches of the built map were drawn at full size from `wildhaven.json` and `tileset.png` (a river bend, the west sea beach, a meadow pond, the lagoon): the bank's waterline sits on the water tile's edge, the sea uses the sand strip, rivers the rooty one and pools the loam one.

Browser at `http://127.0.0.1:5174` (Survivor, 800×600 pane): the sand bank shows along the lagoon beach by the ship; with a test save standing beside the lagoon river, the river bank shows on both sides and the river ripples change picture between two looks a second apart, with no console warnings.

Not checked by hand: the snow and canyon rivers in play, the 390 px layout (no layout rule changed), reduced motion (ripples are hidden by code, not seen), and frame rate on a slow machine with the larger tileset. The pane ran as a background page, so nothing here says how smooth the animation is.

## Collapse animation before passing out — 2026-11-19

The six-frame `dying-v2` sheets are loaded as the `dying` sheet and played as the `collapse` clip. Automated: `npm test` 206 passing (three new collapse tests in `tests/animation/clips.test.js`), `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5177` (Scout, 800×600 pane), with a test save edited to 0 health and reloaded:
- The preview dialog lists "Collapsing" and draws it.
- On loading with no health the Scout fell where she stood (seen: upright, kneeling, lying flat on the back, held), then the pass-out screen came up and she lay asleep at the spawn behind it. This is also the "saved mid-fall" path.
- No console errors.

Not checked by hand: the Builder and Survivor in play, facing west (mirrored), freezing to 0 health the slow way, holding a movement key during the fall, and passing out in the boat (no fall there). The pane ran as a background page, so it says nothing about how smooth the fall is.

### Scene change waits for "Get up" (same day)

The fall now only opens the pass-out screen; closing it runs `passOut`. Automated: `npm test` 206 passing, `npm run build` and `npm run format:check` pass.

Browser at `http://127.0.0.1:5173` (Survivor, walked about 170 units west of the spawn, test save edited to 0 health and reloaded):
- With the screen open the save still held the fall spot, 0 health and the morning clock, and the screen read "You will wake where you started, at midday."
- After "Get up" the save held the spawn, 50 health and midday; the Survivor was seen pushing up from the ground there, then standing.
- No console errors.

Not checked by hand: waking at a named camp, the toast for a drifted boat or new needs, and Escape instead of the button (same `close` handler).

## Small stones, wild berries and still trees (2026-11-19)

Played the Scout at `http://127.0.0.1:5173` in Pinefall Woods.

- A pile of small stones near the tent showed the E cap and "Pick up small stones"; picking it took stone from 3 to 4 and the pile faded.
- A wild berry bush west of the spawn showed "Pick wild berries"; picking it took food from 2 to 3.
- Pines on screen stood still (the sway was removed).

Not checked by hand: the other two characters, other regions, regrowth after 180 s, a chopped tree still falling and breaking, and 390 px wide.
