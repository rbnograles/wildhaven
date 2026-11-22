# Auto-gather, weapon toggle + held stance, and HUD layout swap

Date: 2026-11-21
Status: implemented and verified 2026-11-22

Three independent features for the playing HUD and the gather/combat loops:

1. **Auto-gather** — a toggle that walks the player to the nearest reachable resource, gathers it, and repeats.
2. **Weapon toggle button + visible held weapon** — a clickable HUD toggle that mirrors the Q key, lit while a weapon is drawn, and the character visibly holds its weapon (sword or bow) while standing drawn.
3. **HUD layout swap** — player card to the upper-left, objective (quest) card to the upper-right under the pause button; the item box and minimap stay at the bottom.

The three are separable; they share no state and can be built and tested on their own.

## Context (what already exists)

- **Combat** is built (`src/actions/combat.js`, handled in `src/core/input.js`). `Q` toggles `session.combat.drawn`; left mouse swings the sword, right mouse aims the bow. There is **no visible held weapon while idle** — the renderer only draws a faint dilaw ring under the player (`renderer.js`, "A drawn weapon" block). The tool row already shows a `#stance-marker` ("Weapon drawn (Q)") and marks the owned weapon chip `.drawn` when `session.combat.drawn` (`ui/hud.js` `updateTools`).
- **Gathering** uses `nearbyNode` / `nodesInReach` (`src/actions/gather.js`) and `beginGather` / `finishGather`. **Click-to-walk** paths to a node with `session.walk` + `beginApproach` / `approachStep` / `followWalk` (`src/actions/approach.js`, driven in `src/core/loop.js`). There is no auto-gather.
- **Layout** is pure CSS/DOM. `.quest` (objective) is absolutely positioned top-left; `.identity` (player card) sits in the bottom `.game-bottom` grid (`1fr auto 1fr`: player card | item box | minimap). Toasts (`#toasts`) are anchored just above the player card inside `.identity-area`.
- **Weapon art**: per-character `sword`/`swordIron`/`bow`/`bowIron` sheets exist (`src/animation/sheets.js`), one row, east-facing, mirrored for west. Frame 0 is a "ready/guard" stance (sword: bent-knee guard; bow: archer nocking). No north/south weapon art, and no idle/walk "holding a weapon" art.

## Feature 1 — Auto-gather

### Behaviour

A runtime toggle `session.auto` (boolean, never saved, alongside `combat`/`hover`/`walk` in `core/session.js`). While on and the player is idle (no `animator.pending`, no `session.walk`):

- Pick the nearest **available** node the player has the tool for, within a bounded search radius (`AUTO_GATHER_RANGE`, default ~2000 units — a few screens — so it never marches across the whole map and always terminates cleanly). Hand-picked patches count (they need no tool); nodes whose tool the player lacks are skipped.
- If the node is already in reach, start the gather (`beginInteraction`/`beginGather`). Otherwise set `session.walk = beginApproach(state, node)`; the existing `followWalk` walks there and starts the gather on arrival.
- After each gather finishes, the idle state returns and the next nearest node is picked — the loop repeats.

### Stop conditions (turn `auto` off and toast)

- **Bag full** — `hasRoomFor` fails for the chosen node → off, toast "Bag is full".
- **Nothing nearby** — no eligible node within `AUTO_GATHER_RANGE` → off, toast "Nothing nearby to gather".
- **Player takes over** — a movement key (`dx`/`dy`), any manual action, opening a dialog or the Build menu, or boarding the boat → off (the same places `session.walk` is already cleared in `loop.js`).

Auto-gather is pure gathering: it never hunts, fights, or paths toward wolves/animals.

### Trigger

- **HUD button** (see Feature 2 layout) — a toggle lit while active.
- **Key `G`**. No live clash: `G` is the hoe only inside the open Build menu; outside the menu it is unused. Bound in `core/input.js`; added to `data/controls.js`.

### Files

- `core/session.js` — add `auto: false`; clear it in `changeScreen`.
- `core/loop.js` — the auto driver: when `auto` and idle, pick/approach the next node; handle the stop conditions; clear `auto` wherever `walk` is cleared.
- `core/input.js` — `G` toggles `session.auto`; a movement/action press clears it.
- `actions/gather.js` (or a small new `actions/autogather.js`) — a pure `nextAutoNode(state, range)` helper (nearest eligible node within range, with tool), unit-testable.
- `ui/hud.js`, `ui/layout.js`, `style.css` — the toggle button and its lit state.
- `data/controls.js` — the `G` row.
- `tests/actions/` — unit tests for `nextAutoNode` (picks nearest eligible, skips locked, respects range, returns null when none).

## Feature 2 — Weapon toggle button + held stance

### Toggle button

A new HUD toggle that mirrors `Q`: clicking it runs the same path as the `Q` handler in `core/input.js` (`session.combat.drawn = !session.combat.drawn; session.combat.aiming = null; ui.hud.update()`). It is **lit** (an `.active`/`.drawn` class, styled like `.build-button.active`) while `session.combat.drawn`, and **faded/disabled** when the player owns no weapon (reuse the `canHunt`/`hasTool` check already used by the `Q` handler's "no weapon to draw" guard). `ui/hud.js` `updateTools` already reads `session.combat.drawn`; it extends to set the button's state.

### Visible held weapon (overlay of existing art — no new assets)

In `render/renderer.js`, where the player pose is resolved (the `resolvePose(...)` call), override the clip while the weapon is drawn:

- **Drawn + standing still** (no `animator.pending`, not moving) and facing **east or west** → render frame 0 of the owned weapon's sheet (`sword`/`swordIron` if the player has a sword, else `bow`/`bowIron`), east/west via the normal `flip`. This shows the character holding the weapon.
- **Drawn + moving, or mid-swing/shot** → the normal walk / swing animation (the swing and shot clips already show the weapon).
- **Facing north or south while standing drawn** → fall back to the normal idle pose; the existing dilaw ring under the player still signals the stance. (Known limitation: the weapon sheets are east-facing only. North/south held art can be added later.)
- Never applied aboard the boat, while sleeping, or during the collapse.

The faint ring block in the renderer stays (it still helps for north/south and for the bow).

### Files

- `ui/layout.js`, `style.css`, `ui/hud.js` — the weapon toggle button and its lit/faded state.
- `render/renderer.js` — the drawn-stance pose override.
- `data/controls.js` — note the button beside the `Q` row (optional).

## Feature 3 — HUD layout swap

- **Player card** (`.identity` / `.identity-area`, with its `#toasts`) → **upper-left**, where `.quest` is now. Likely moved out of the `.game-bottom` grid into its own absolutely-positioned block top-left (`ui/layout.js` DOM move + `style.css`).
- **Objective / quest card** (`.quest`) → **upper-right**, below the pause/journal/fullscreen row (`.game-top`). Re-position in `style.css` (and clear space so it does not overlap `.game-top`'s buttons).
- **Item box** (center) and **minimap** (right) → **stay at the bottom**. With the player card gone from `.game-bottom`, simplify the grid so the item box stays centered and the minimap hugs the right.

### Two new HUD toggle buttons

The auto-gather and weapon toggles are stacked just above the Build button (near the bottom-center hotbar), so they sit with the other action affordances. Each is a small square toggle with its key cap (`G`, `Q`) and a lit `.active` state.

### Responsive

Verify at ~390px width (phones): the player card top-left, objective top-right, and the bottom hotbar must not overlap or push the touch arrows. Adjust the phone media queries as needed.

### Files

- `style.css` — the main work (re-position `.quest`, new top-left player card block, grid simplification, the two toggle buttons, phone media queries).
- `ui/layout.js` — move `.identity-area` out of `.game-bottom` if needed; add the two toggle buttons.

## Testing / verification

- `npm test`, `npm run build`, `npm run format:check` must pass. Add unit tests for the pure auto-gather picker (`nextAutoNode`).
- Renderer, HUD, input and layout are not unit-tested: browser pass via the `wildhaven` launch config at `127.0.0.1` (not `localhost`, to protect real saves), all three characters. Check: auto-gather walks/gathers/stops correctly and bag-full/nothing-nearby toasts fire; the weapon button toggles and lights and the held weapon shows east/west while standing drawn; the layout reads correctly and nothing overlaps, including at ~390px. Check the console for errors. Record notable checks in `docs/verification.md`.

## Out of scope

- North/south held-weapon art (fall back to idle + ring for now).
- Auto-gather auto-crafting tools, hunting, or any combat.
- Touch button for the weapon/auto toggles beyond what the responsive pass needs (R still has no touch button either).
