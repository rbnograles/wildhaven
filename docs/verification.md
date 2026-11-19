# First playable verification — 2026-11-19

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
