# Auto-gather and weapon HUD implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Implement the approved auto-gather, weapon stance, and HUD layout design.
**Architecture:** Reuse gathering and approach actions, keep automation in the runtime session, and share keyboard/button handlers. Reuse existing weapon frame zero and painted HUD assets.
**Tech Stack:** JavaScript, Phaser, Vite, Node tests, CSS.
**Spec:** ../specs/2026-11-21-autogather-weapon-hud-design.md

## Global constraints

- Runtime automation is never saved; range is 2000 world units.
- Gathering never targets animals or combat.
- Preserve existing artwork and north/south idle fallback.
- Verify all three characters and a 390px viewport using 127.0.0.1.

## Review focus

- Unreachable nearest resources must not cause an endless retry.
- A gathering animation must not switch automation off.
- Manual keyboard, pointer, dialog, building and boat actions must stop automation.
- Weapon ownership and busy/sleeping states must govern the held pose.
- Phone quest, player, hotbar and touch controls must remain separated.

## Task 1: Automatic gathering

- [x] Add failing picker tests for nearest eligible, depleted, locked, out-of-range, excluded, and absent nodes.
- [x] Add `nextAutoNode(state, range, excluded)` in `src/actions/gather.js`, `AUTO_GATHER_RANGE` in balance, and runtime `session.auto`.
- [x] Drive eligible reachable targets through existing approach/gather paths in `core/loop.js`; stop on full bag, exhaustion, and takeover.
- [x] Share G/button toggling and manual cancellation in `core/input.js`.
- [x] Run picker tests and existing action tests.

## Task 2: Weapon and action controls

- [x] Share Q/button toggling; reflect availability, active state and aria-pressed in `ui/hud.js`.
- [x] Render frame zero of sword/bow when standing east/west, with advanced tiers using iron art.
- [x] Add G to `data/controls.js`.

## Task 3: Layout and verification

- [x] Move identity outside bottom grid in `ui/layout.js`, anchor quest right below top controls, and stack G/Q above Build.
- [x] Adjust phone CSS to retain visible quest and separate controls.
- [x] Run npm test, npm run build, npm run format:check.
- [x] Browser-check behavior, all characters, console and mobile layout; record evidence in docs/verification.md.

## Execution notes

Implement in the user's current workspace so changes are immediately reviewable. Preserve the existing untracked .superpowers directory. No publishing or save-schema changes are needed.

Completed 2026-11-22. Picker tests failed before implementation and passed afterwards. Final suite: 364 passed; production build and formatting passed. Fresh review found hungry-standing art and intermediate-width banner overlap; both were corrected and browser-checked. The pre-existing missing helper comment in tests/world/progress.test.js was repaired to pass the repository comment check. Concurrent camp-hover edits were preserved.
