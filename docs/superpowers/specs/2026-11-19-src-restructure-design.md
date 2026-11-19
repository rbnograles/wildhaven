# Wildhaven src/ restructure: design

Status: approved in brainstorming on 2026-11-19. This is a behavior-preserving refactor that sets up the code structure before the playability review (`/build-playability-review`).

## Goal

Move from today's 8 flat files (where `state.js` mixes data, collision, actions and saves, and `main.js` runs everything in the browser) to a role-based layout. Each player action gets its own file, and game data and tuning numbers live in `src/data/`.

## Non-goals

- Changing gameplay, UI text, timings, visuals or the save format.
- Turning build, craft, fight or swim into mechanics. They stay as clip data in `animation/clips.js`.
- Moving `style.css` or changing `index.html` (it keeps loading `/src/main.js`).

## Target layout

```
src/
  main.js              bootstrap only (~30 lines)
  style.css            unchanged
  data/
    characters.js      REGION_OFFSETS, at(), CHARACTERS
    supplies.js        NODES (9 supply points)
    balance.js         gameplay tuning constants
  world/
    map.js             WORLD, OBSTACLES, isWalkable (water corner masks + object footprints)
    regions.js         LOCATIONS, regionAt
  actions/
    move.js            movePlayer (walk + run)
    gather.js          nearbyNode, beginGather, finishGather
    discover.js        discover
  game/
    state.js           createGame, serializeGame, restoreGame
    saves.js           storageKey, createSaveSession, readActive, setActive
  animation/
    clips.js           CLIPS, sampleAnimation, steadyAnchors, animator
    sheets.js          sprite-sheet loading and frame measuring, resolvePose, painter
    preview.js         "Preview animations" dialog
  render/
    renderer.js        Phaser scene, camera, minimap and world map
  ui/
    layout.js          icons, icon(), the #app HTML template, $()
    selection.js       character cards, select(), readSlot()
    hud.js             HUD update, toast notify(), interact button label
    dialogs.js         pause, map, reset and fullscreen dialogs, return button, isPaused()
  core/
    session.js         shared session object + start / leave / save / changeScreen
    input.js           keyboard, touch, blur, visibility, pagehide; key-to-action dispatch
    loop.js            requestAnimationFrame frame loop
```

### Where today's code goes

| Today | New home |
| --- | --- |
| `state.js`: `REGION_OFFSETS`, `at()`, `CHARACTERS` | `data/characters.js` |
| `state.js`: `NODES` | `data/supplies.js` |
| `state.js`: literals 155, 245, 0.1, 95, 230, 130 | `data/balance.js` |
| `state.js`: `WORLD`, `OBSTACLES`, `waterAt`, `isWalkable` | `world/map.js` |
| `state.js`: `LOCATIONS`, `regionAt` | `world/regions.js` |
| `state.js`: `movePlayer` | `actions/move.js` |
| `state.js`: `nearbyNode`, `gather` | `actions/gather.js` (`gather` renamed `finishGather`) |
| `state.js`: `discover` | `actions/discover.js` |
| `state.js`: `createGame`, `serializeGame`, `restoreGame` | `game/state.js` |
| `storage.js` | `game/saves.js` |
| `animation.js` | `animation/clips.js` |
| `animation-art.js` | `animation/sheets.js` |
| `animation-preview.js` | `animation/preview.js` |
| `render.js` | `render/renderer.js` |
| `main.js`: icons, HTML template | `ui/layout.js` |
| `main.js`: `readSlot`, `select`, card handlers, Begin / Fresh / loading-screen Back buttons | `ui/selection.js` |
| `main.js`: `updateHud`, `notify` | `ui/hud.js` |
| `main.js`: pause/map/reset (confirm, cancel)/fullscreen/save-game/return handlers, `isPaused` | `ui/dialogs.js` |
| `main.js`: key/touch/blur/visibility/pagehide listeners, `collect` | `core/input.js` (gather rules go to `actions/gather.js`) |
| `main.js`: `frame` | `core/loop.js` |
| `main.js`: `start`, `save`, `changeScreen`, return-to-characters, top-level `let` state | `core/session.js` |

### Dependency rule

- `data/`, `world/`, `actions/`, `game/` and `animation/clips.js` are **pure**. They run in Node tests and must not import `ui/`, `core/`, `render/`, `animation/sheets.js` or `animation/preview.js`. They also must not import PNG or CSS files, use `import.meta`, or reference `document` or `window`. JSON is imported with `with { type: 'json' }`.
- Browser modules (`ui/`, `core/`, `render/`, `animation/sheets.js`, `animation/preview.js`, `main.js`) may import anything.
- Within the pure layer, dependencies point in one direction: data → world → actions → game.

## Action files

Action files are pure functions. They take the game state (plus the animator for gather) and return results. They never touch the DOM, storage or sprites. All player-facing text (toasts, labels) stays in `ui/`.

**`actions/move.js`**
- `movePlayer(state, dx, dy, dt, running) -> boolean`: same math as today. It normalizes the direction, uses `WALK_SPEED`/`RUN_SPEED`, caps `dt` at `MAX_MOVE_DT`, checks collision per axis via `isWalkable`, and keeps the same facing rule.

**`actions/gather.js`**
- `nearbyNode(state) -> node | null`: the closest uncollected supply within `GATHER_RANGE`.
- `beginGather(state, animator) -> {ok:true, node} | {ok:false, reason:'busy'|'none'}`. This is new, lifted out of `main.js` `collect()`. It returns `busy` while a clip is pending and `none` when no supply is in range. Otherwise it turns the player to face the node (when the node is more than 8 units away sideways) and starts the `gather` clip. It awards nothing.
- `finishGather(state) -> node | null`: today's `gather`, renamed. It awards `node.amount` once and records the node id in `state.collected`.

**`actions/discover.js`**
- `discover(state) -> location[]`: unchanged.

**Callers**
- `core/input.js`: the E key and the interact button call `beginGather`. On `reason:'none'`, it shows the toast "Move closer to a marked supply to gather it." Both inputs check that the screen is `game` and nothing is paused first, as `collect()` does today. On success, it clears the held keys, as today.
- `core/loop.js`, every unpaused frame: `movePlayer` (skipped while a clip is pending, which is the intended 0.8 s gather lock) → `advanceAnimation` → when the `gather` clip completes, `finishGather` plus toast, HUD update and save → `discover` plus toast and save → autosave timer.

**`data/balance.js`**: `WALK_SPEED = 155`, `RUN_SPEED = 245`, `MAX_MOVE_DT = 0.1`, `GATHER_RANGE = 95`, `DISCOVERY_RADIUS = 230`, `REGION_LABEL_RANGE = 130` (`regionAt` adds this to a location's radius). The gather length stays in `animation/clips.js` (4 frames at 5 fps). Engine timings stay as named constants in `core/loop.js`: the 0.05 s dt clamp, the 10 s autosave and the 0.12 s HUD refresh.

**Adding an action later** means a new file in `actions/`, an input binding in `core/input.js`, a clip in `animation/clips.js` if it's animated, and a test in `tests/actions/`.

## Session and UI split

`core/session.js` exports `createSession()`, which returns `{selected, state, animator, renderer, saveSession, saveFailure, screen, loadId, keys, clock}`. This replaces the top-level `let` variables in `main.js`. `clock` is `{last, sinceSave, sinceHud}`: the frame loop reads it, and both `start()` and the visibility listener reset it, just as `lastTime`, `lastSave` and `lastHud` are reset today. It also exports lifecycle functions moved from `main.js` with identical logic, text and ordering:
- `start(session, ui, fresh)`
- `leave(session, ui)`: the "Return to characters" flow, including the unsaved-progress `confirm`.
- `save(session, ui, silent)`
- `changeScreen(session, next)`

There are no hidden module globals. `main.js` builds one `ui` object and passes `(session, ui)` to each setup function. Modules call each other through that object, which avoids import cycles.

- `ui/layout.js`: `mountLayout(appEl)` writes the same HTML as today. Also exports `icon(name)` and `$(id)`.
- `ui/selection.js`: `setupSelection(session, ui)` handles card click and arrow-key navigation. Returns `{select(id), readSlot(id)}`.
- `ui/hud.js`: `createHud(session)` returns `{update(), notify(message)}`.
- `ui/dialogs.js`: `setupDialogs(session, ui)` wires the pause, map, reset, fullscreen, save-game and return buttons and refocuses the world when a dialog closes. Returns `{isPaused(), openPause(), closePause(), toggleMap()}`.
- `core/input.js`: `setupInput(session, ui)` sets up the keydown/keyup/blur/visibilitychange/pagehide listeners and the touch buttons. Returns `{moveIntent() -> {dx, dy, running}}`.
- `core/loop.js`: `startLoop(session, ui)` starts the `requestAnimationFrame` loop.

`main.js` (~30 lines): `import './style.css'` → `mountLayout` → `createSession` → hud, dialogs, selection, input → `setupPreview` → resume the active character if its slot has a readable save, otherwise select Scout and clear the active marker → `startLoop`. The DOM is built before any listener is attached, and the preview buttons are inserted after the layout mounts, as today.

## Invariants (must hold after the refactor)

- Save keys `wildhaven.adventure.v1.<id>` and `wildhaven.active`, and save `version: 2`. A save made on the baseline commit still loads.
- The gather locks movement for the full 0.8 s clip and awards exactly once, when the clip ends.
- Same DOM ids, classes and text, so `style.css` needs no changes.
- Same timings: movement speeds, dt clamps, autosave interval, HUD refresh, camera smoothing and toast duration.
- Phaser input stays disabled, and all input goes through `core/input.js`.

## Tests

Tests mirror `src/`. `npm test` stays `node --test`, which finds files in subfolders; nothing under `.claude/` matches its patterns.

| File | Contents |
| --- | --- |
| `tests/actions/move.test.js` | Diagonal normalization and world edges (from `state.test.js`) |
| `tests/actions/gather.test.js` | Proximity and collect-once (from `state.test.js`). New `beginGather` tests: `busy` while a clip is pending, `none` out of range, faces the node, awards nothing until `finishGather` |
| `tests/actions/discover.test.js` | Discover once per region (from `state.test.js`) |
| `tests/world/map.test.js` | Every spawn is walkable; points off the map edge aren't |
| `tests/game/state.test.js` | Distinct starts, save round-trip, rejection of invalid saves (from `state.test.js`) |
| `tests/game/saves.test.js` | Everything in `storage.test.js` |
| `tests/animation/clips.test.js` | Everything in `animation.test.js` |
| `tests/boundaries.test.js` | New. Reads every file in the pure folders and fails on PNG/CSS imports, `import.meta`, `document` or `window` |

All 20 existing test cases keep their assertions. Only import paths change, plus the `gather` → `finishGather` rename.

## Migration

The work happens on branch `restructure-src`, cut from the baseline commit `83b8a6b`. Use `git mv` wherever a file moves whole, so history follows it.

1. Split `state.js` into `data/`, `world/`, `actions/` and `game/state.js`. Update imports and tests.
2. Move `storage.js` → `game/saves.js` and the animation and render files into their folders. Update imports and tests.
3. Split `main.js` into `core/` and `ui/`, and add `beginGather`, the new tests and `tests/boundaries.test.js`.
4. Update the docs.

After each step, `npm test` and `npm run build` must pass, and then the step gets a commit.

## Verification

On the dev server at `127.0.0.1`:
- Select each character, walk, run, and gather (check the 0.8 s lock still holds).
- Discover a region, open the map (M), pause (Esc), and save.
- Return to the characters screen, continue, and refresh mid-game to confirm it resumes.
- Load a save created on the baseline.
- Check the console for errors.

## Docs to update

- `CLAUDE.md`: the architecture table, commands (the test file paths), every `state.js`/`storage.js`/`main.js` path reference, and a note that balance lives in `data/balance.js`.
- `README.md`: the Development paragraph's file references.
- `tools/build-map.py`: the `KEEP_CLEAR` comment (`src/state.js` → `src/data/characters.js` and `src/data/supplies.js`).
- `docs/verification.md`: an entry for the restructure check.
