# Main menu: painted triptych — design

Status: built 2026-11-19 (see docs/superpowers/plans/2026-11-19-main-menu.md).

## Goal

The character-selection screen becomes the game's main menu, built from `assets/world/starting-regions.png`: a 1536×1024 triptych of Pinefall Woods, Hollowstead Village and Driftwood Coast, one third each. The screen is exactly the viewport height (`100svh`) and never scrolls, vertically or horizontally, at any size from 320×480 up.

## What the current menu does wrong

- The 77 px tagline outranks both the game's name and the art.
- The painting only fills about 28% of a 1280×720 screen.
- The page scrolls 13 px on desktop and 110 px on a 390×844 phone.
- It shows 102 words, with text as small as 8 px.

## Removed

- The headline "Every journey starts with you." and its subtitle.
- The motto "A world worth wandering" and the header rule.
- The two-line character description and the kit line ("HATCHET · FIELD PACK · 3 FOOD").
- The controls footer and the "Your adventure saves on this device" note. The storage message now appears only when storage is unavailable, in the save-hint line.

## Desktop and tablet (viewport 700 px wide or more)

- Three panels side by side fill the viewport. Each panel shows its own third of the painting, scaled to cover the panel without distortion and centered on its scene.
- **Expanding panels:** the selected panel takes about 50% of the width and the other two about 25% each. Width changes animate over about 450 ms, and instantly under `prefers-reduced-motion`.
- Unselected panels are dimmed (about 60% brightness) and show their character's name at the bottom. Hover and keyboard focus brighten them.
- Each panel shows its character standing on the path: the south-facing idle frame from `starting-characters-idle-v1.png`, about 45% of the viewport height.
- The selected panel carries an overlay on a dark gradient scrim, reading top to bottom:
  - character name (serif, 28 px or more)
  - location
  - one-line tagline (15 px or more)
  - **Begin your journey** / **Continue your journey** button
  - a secondary row: **Start a fresh adventure** (only when a save exists) · **Preview animations**
  - the save-hint line ("2 of 3 regions discovered · Adventure saved", or the storage-unavailable message), 12 px or more
- The WILDHAVEN wordmark sits top-left over the art with a soft shadow. Nothing else sits at the top.

## Phone (viewport under 700 px wide)

- One scene at a time: the selected panel fills the screen and the other two are hidden.
- Left and right arrow buttons sit at mid-height on the screen edges, and a horizontal swipe changes character. Three dots at the bottom show which of the three is shown, and tapping a dot selects that character.
- The same overlay content as desktop sits at the bottom, with Begin as a full-width button. Touch targets are 44×44 px or larger.

## Interaction and accessibility

- Each panel is a `<button aria-pressed>` labelled "Choose <name>". The left and right arrow keys move the selection, as they do today. Enter and Space select.
- Begin and the secondary actions are separate buttons, never nested inside a panel button.
- Text is at least 12 px everywhere. Text over the art keeps 4.5:1 contrast through the scrim.
- `prefers-reduced-motion` turns off the panel width animation, the hover lift and the arrow transitions.
- `#begin`, `#fresh`, `#save-hint`, `#storage-note` and `[data-character]` keep their meaning, so selection, save, continue, start-fresh and refresh-resume behave exactly as today.

## Controls hint moves into the game

The menu footer was the only place the controls were explained. Each time the game screen opens, a key strip appears bottom-center: `W A S D` Move · `Shift` Run · `E` Gather · `M` Map · `Esc` Pause. It uses the existing `kbd` styling and fades out after the player's first movement or after 8 s, whichever comes first.

## Not changing

The loading screen, game screen, HUD, dialogs, save format and save keys, and the animation preview dialog's contents.

## Sequencing

This is built after the harvestable-supplies work and the `src/` restructure (`docs/superpowers/plans/2026-11-19-src-restructure.md`) have landed. The menu then lives in `src/ui/layout.js` (markup), `src/ui/selection.js` (selection, phone arrows and swipe) and `src/style.css`.

## Verification

- At 1920×1080, 1366×768, 1280×720, 768×1024, 390×844 and 360×640: `document.documentElement.scrollHeight === innerHeight`, and `scrollWidth === innerWidth`.
- Keyboard-only selection and Begin work. The panel animation runs, and is instant under reduced motion. Phone arrows, swipe and dots work.
- Continue, start fresh and refresh-resume still work.
- The in-game key strip shows on entry and hides after the first move.
- The console shows no errors.
