# Wildhaven

A playable browser exploration prototype with three starting characters and one shared illustrated world.

## Run locally

Requires Node.js 20.19+ or 22.12+ (developed and tested with Node 24).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally http://localhost:5173.

Choose the Frontier Scout, Wandering Builder, or Shipwreck Survivor and press **Begin your journey**. Each enters the same world at a different location: Pinefall Woods, Hollowstead Village, or Driftwood Coast. A character with an existing save has **Continue your journey** instead. Use **Start a fresh adventure** to replace only that character's save, after confirmation.

## Controls

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Run | Hold Shift while moving |
| Gather the glowing supply in reach (6 s; move to stop) | E or the gather button |
| World map | M or the minimap |
| Pause | Escape or the pause button |
| Save / return to characters | Pause menu |

Small windows show directional touch buttons. Desktop keyboard and mouse is the primary target.

## What works

- Three illustrated, keyboard-accessible character choices and different starting supplies.
- Correct directional sprite, camera following, bounded terrain, major building/ship collision footprints, and coastline blocking.
- Nine gatherable supplies (a pine tree to chop, berry bushes, stones, timber, driftwood), plus 38 wild flower patches across the open wilds that give herbs and grow back a few minutes after picking; three discoverable regions; minimap and world map.
- Pause on focus loss, manual pause, and map pause.
- Per-character saves, auto-save, manual save, restore after reload, and confirmation before replacing a save.
- Validation of saved data and protection against an older tab overwriting another tab's newer save.
- Asset-loading error and retry states; graceful messages if browser storage is unavailable.

Saves live in this browser for this exact site address. `localhost` and `127.0.0.1` are separate save locations. Private browsing, cleared browser data, or disabled storage can prevent persistence. This is a local game; there is no server account or cloud save.

## Development

```sh
npm test
npm run build
npm run preview
npm run format        # format the code with Prettier
npm run format:check  # check the formatting without changing files
```

Game data and tuning live in `src/data/`, collision, supply nodes and regions in `src/world/`, and each player action (move, gather, discover) in its own file in `src/actions/`. Save state and storage are in `src/game/`. Phaser rendering is in `src/render/renderer.js`, animation clips and sprite sheets are in `src/animation/`, and the DOM screens and dialogs are in `src/ui/`. Input, the frame loop and the shared session are in `src/core/`, and `src/main.js` wires them together. Styling is in `src/style.css`.

### Code style

The code is meant to be easy to read, even for a beginner. Prettier formats it; run `npm run format` before committing. Every named function has a short plain-language comment above it that explains what it does, as if to someone new to the code. `npm test` fails if one is missing. The full rule is under "Code Style" in `CLAUDE.md`.

## Current milestone

This delivers **open browser → choose character → load and explore the game**. City construction, settlers, combat, survival damage, day/night simulation, and walking animation frames are future milestones. Resources currently support gathering and exploration objectives, not crafting. Tools in character descriptions identify their starting equipment visually; they are not separate equip/unequip mechanics yet.

The map is a painted first region. Major obstacle footprints are approximated; decorative foliage is passable and is not individually simulated. Directional idle art uses a light movement bob until walking animation is authored. Fonts have local fallbacks; the optional web fonts need an internet connection.

See `docs/verification.md` for checks, `docs/art-direction.md` for the visual inventory and generation prompts, and `docs/superpowers/plans/2026-11-19-browser-first-playable.md` for the scoped implementation plan.
