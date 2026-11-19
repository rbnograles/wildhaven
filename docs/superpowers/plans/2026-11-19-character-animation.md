# Character Animation Implementation Plan

**Goal:** Add walk, run, gather, build, craft, fight, and swim animation clips for the three existing characters, with a browser preview of every clip.

**Architecture:** Preserve the original idle atlas and generate two new transparent atlases per character. Locomotion contains eight rows (walk south/west/east/north, then run south/west/east/north), four frames each. Action sheets contain five rows (gather, build, craft, fight, swim), four frames each, at a consistent three-quarter right-facing angle. This first action pass can mirror left but does not claim full directional action art.

**Scope:** Live movement selects walk/run from actual displacement and Shift. Gathering shows a short action before completing resource collection exactly once. Other clips play in a paused character-animation viewer, accessible from selection and pause menus. Swimming preview does not unlock water traversal; crafting/building/fighting previews do not alter game resources or imply implemented mechanics. Existing saves retain their schema.

**Files:** src/animation.js (clip data and timing), src/animation-art.js (assets and sprite frame extraction), src/render.js (world rendering), src/animation-preview.js (preview UI/render loop), src/main.js (events/action lifecycle), src/style.css (viewer), tests/animation.test.js, assets/characters/animations/*, docs/animation-notes.md.

## Tasks

- [ ] Generate and inspect three locomotion and three action atlases using the approved original characters as visual reference. Preserve files and exact prompts.
- [ ] Test animation selection, looping, single-action completion, pause behavior, direction rows, interruption, and unchanged saves before implementation.
- [ ] Implement animation controller and frame rendering with per-cell alpha bounds and a consistent foot anchor. Respect reduced-motion preferences for non-essential UI effects while retaining meaningful action frames.
- [ ] Add a responsive animation viewer with character, clip, direction, play/pause, and speed controls; no game-state writes from preview.
- [ ] Wire walk/run/gather to live play, verify assets and transitions in browser, obtain a focused independent review, run tests/build, and leave the viewer open.

## Verification focus

Frame extraction never crosses neighboring sprite cells. Non-looping gathering completes once, cannot award twice on repeated E, and pauses with the game. Collision-stopped characters idle. Preview work never changes saves. All three characters and all seven requested clips have working assets. Missing assets surface retry UI rather than an endless loader.
