# Browser First Playable Implementation Plan

> For agentic workers: use superpowers:executing-plans. Implementation is authorized by the user's instruction to build now and reach character selection and game loading.

**Goal:** Open the game in a browser, select any of three characters, and load a playable world at that character's distinct starting location.

**Architecture:** A small Vite-served vanilla JavaScript app with semantic HTML character selection and a Canvas 2D world. Pure state and movement functions are separate from rendering and UI. No backend or accounts.

**Tech Stack:** JavaScript modules, HTML, CSS, Canvas 2D, Vite, Node built-in test runner.

**Spec:** ../specs/2026-11-19-survival-settlement-design.md. The latest user instruction defines this first milestone; the earlier survival and cities design is the roadmap, not this build's completion gate.

## Global constraints

- Preserve the approved character art and three character identities.
- Scout starts in forest, Builder at abandoned village, Survivor at shipwreck coast.
- One shared world, keyboard movement, camera follow, asset loading errors handled with retry.
- Local save per character; starting another character must not overwrite other adventures.
- Desktop keyboard/mouse first; selection must still fit narrow screens.
- Full city construction, wolves, settlers, survival damage, and walking sprite animation remain later work.

## Design system

Visual thesis: an illustrated wilderness atlas with parchment typography and moss-green controls, leading into a world that fills the screen.
Content: restrained brand header, large serif title, three illustrated interactive character panels, selected character detail and one primary start action. Gameplay uses small corner HUDs and a quiet bottom controls bar.
Interaction thesis: selected character comes forward, entering the world fades smoothly, movement follows a gentle camera; reduced-motion disables transitions.
Tokens: parchment #f5f2e8, ink #263b31, moss #385845, muted #777e70, border #d7d9cb; Georgia display, system sans-serif controls. Mostly squared panels with 4–12px corners, no marketing badges.
Generated concept supplies composition. Character sheet remains original. Standalone world illustration supplies terrain and landmarks. Native code supplies accessible controls, selection, state, movement, hit boxes and minimap indicators.

## Review focus

- Invalid/old save: recover gracefully without crashing or silently replacing other slots.
- Switching characters: correct art, spawn, and save slot for each.
- Hidden tab / window blur: no stuck movement or large simulation jumps.
- Asset failure: visible error and retry, never an endless loader.
- Small viewport: selection and primary button accessible without horizontal overflow.

## Task 1: State and world rules

Files: src/state.js, tests/state.test.js, package.json.
Interfaces: CHARACTERS, createGame(characterId), movePlayer(state, dx, dy, dt), serializeGame(state), restoreGame(json), gather(state), discover(state).
- [x] Write tests for distinct spawns, unknown character, normalized movement, bounds/collision, save roundtrip, invalid saves, resource collection and discovery.
- [x] Run node --test and observe missing implementation failure.
- [x] Implement pure state rules, deterministic resource positions, character definitions.
- [x] Run npm test; all pass.

## Task 2: Selection and playable world

Files: index.html, src/main.js, src/style.css, src/render.js, assets/world/*, docs/art-direction.md.
Interfaces: renderer loads the character sheet and world map; renders state provided by main. DOM selection sets selected character; Enter world creates/restores selected slot. Movement uses state module.
- [x] Generate concept and standalone world art; save exact prompts and assets.
- [x] Implement the selection screen, loading/error state, world canvas, controls, pause/map, persistence and return to selection.
- [x] Run production build and state tests.
- [x] Start local server and exercise all three character entry flows in browser, movement, save/resume, pause and map.

## Task 3: Verification and handoff

Files: README.md, docs/verification.md.
- [x] Inspect desktop and narrow-screen layouts, screenshot selection and gameplay; compare with concept and document functional deviations.
- [x] Obtain independent code review; resolve material findings, run tests and production build again.
- [x] Leave the local server running and open the selection screen for the user; provide URL and controls.

## Execution notes

No Git repository exists here. Work stays in the user's workspace; Git-specific worktree, commit-range and ledger scripts do not apply. No remote publication is needed for this milestone. The user's explicit build instruction authorizes native execution without an additional plan approval round.

