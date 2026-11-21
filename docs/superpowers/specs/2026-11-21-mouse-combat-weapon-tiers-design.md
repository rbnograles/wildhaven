# Mouse Combat, Weapon Tiers, and Creature HP — Design

Date: 2026-11-21
Status: Design approved, pending spec review

## Summary

Add a real-time, mouse-driven combat layer on top of Wildhaven's current hunting, and
give creatures hit points so weapons deal tiered damage instead of felling in one swing.

- A **combat stance**: press `Q` to draw a weapon (and press again to sheathe). While drawn,
  the **left mouse button swings the sword** and the **right mouse button aims and looses the bow**.
  While sheathed, the mouse works exactly as it does today (click to walk, click to gather).
- **Bow aiming is lock-on**: holding the right button picks the creature nearest the cursor and
  draws a path line to it. A quick tap is a weak snap shot; holding longer charges up to full damage.
- **Weapons now have four tiers** — stone, iron, gold, diamond — and higher tiers deal more damage.
  This gives the already-mined `gold` and `diamond` resources their first use.
- **Animals and wolves now have HP.** A hit subtracts the weapon's damage; when HP reaches 0 the
  creature falls and gives the same rewards it gives today. A wounded creature flees, so the bow
  matters for finishing a runner.
- The existing **`E` / interact-button hunt stays** as a fallback for touch and keyboard players:
  one `E` press now deals one weapon hit instead of an instant kill.

This is cozy-leaning action combat: lock-on aiming is forgiving, small game still dies fast, and
the whole hunt reward flow is unchanged — only the number of hits to get there changes.

## Goals

- Mouse-driven melee and ranged combat that feels alive, without breaking click-to-walk/gather.
- A damage/HP model that makes weapon tiers meaningful.
- Four weapon tiers that put `gold` and `diamond` to use.
- No regression for touch or keyboard-only players.
- No save-format break.

## Non-goals

- No HP or damage for the **player** from new sources (wolves still bite as they do today; this
  spec does not change player survival meters).
- No gold/diamond tiers for the gathering tools (axe, pickaxe, hammer). They stay stone/iron.
- No new ammo types. There is still one kind of `arrow`; the **bow's** tier sets damage.
- No gravity/arc physics. The world is top-down flat; the "arrow path" is a straight line from the
  archer to the locked target (the same flight the renderer already draws for a bow shot).
- No new touch combat buttons in this slice. Touch players use the `E` hunt fallback.

## Controls

| Input | Sheathed (today's behaviour) | Drawn (combat stance) |
| --- | --- | --- |
| `Q` | Draw a weapon | Sheathe |
| Left mouse | Click to walk / gather | **Sword swing** |
| Right mouse | (unused) | **Bow: hold to aim, release to loose** |
| `WASD` / arrows | Move | Move |
| `E` / interact button | Gather / board / camp / hunt | Same (one weapon hit on a creature) |

Rules:

- `Q` with no sword and no bow owned shows a notice ("You have no weapon to draw. Make one in the
  Build menu (B).") and does not change stance.
- Drawn with only a bow: the left button does nothing. Drawn with only a sword: the right button
  does nothing.
- While drawn, click-to-walk and click-to-gather are off (the left button is the sword). The build
  menu, pausing, and `E` interactions still work.
- Opening any dialog, the build menu, or build mode, or entering the boat, auto-sheathes (combat is
  on-foot only; the boat already blocks hunting via `huntable`).
- The right mouse button's browser context menu is suppressed over the world while drawn.

## Combat stance (runtime state)

Stance lives on the shared session (`core/session.js`), never in a save:

- `session.combat = { drawn: boolean, aiming: null | { target, charge } }`
  - `drawn` — whether a weapon is out.
  - `aiming` — set while the right button is held: the locked `target` (an animal or wolf) and
    `charge` (seconds held so far, 0..`CHARGE_SECONDS`).

`Q` toggles `drawn` (via `core/input.js`). A fresh game and a loaded game both start sheathed.

## Bow aiming and charge

On right-button down (drawn, bow owned, arrows available):

1. Pick the lock-on target: the huntable creature (animal or wolf) nearest the cursor within the
   bow's reach; if none is near the cursor, the nearest huntable within reach of the player. If none
   exists, aiming still begins but with no target (the shot is wasted / not fired — see below).
2. Start `aiming` with `charge = 0`.

Each frame while held (`core/loop.js`), `charge += dt` (capped at `CHARGE_SECONDS`). The renderer
draws a path line from the player to the target and a charge ring that tightens as `charge` rises.

On right-button up:

- If there is a locked target and at least one arrow: loose it. Damage is
  `round(fullDamage × (0.5 + 0.5 × clamp(charge / CHARGE_SECONDS, 0, 1)))`, so a near-instant tap is
  about half damage ("quick release") and a full hold is full damage. The arrow flies along the path
  (reusing the renderer's existing flying-arrow + reticle), and damage is applied when it lands.
  Spend one arrow (`ARROW_PER_SHOT`). A stone bow wears one use.
- If there is no target or no arrow: no shot, show the relevant notice ("Out of arrows · Fletch
  more in the Build menu (B)").

The target re-locks to follow the creature as it moves while held, so a runner stays aimed at.

## Sword swing

On left-button down (drawn, sword owned):

- Start a melee swing: play the sword clip for `SWORD_SECONDS[tier]`. The swing hits the huntable
  creature within `HUNT_REACH` nearest to the player (lock-on melee, same forgiving feel). Damage is
  the sword's full tier damage. A stone sword wears one use.
- A swing with no creature in reach still plays (a miss), costing nothing.

## HP model

Animals and wolves gain an `hp` field. Like all live-creature state (`WILD_ANIMALS`, `WOLVES`), HP
is **never saved** — it is set when a game opens (`resetAnimals`, `resetWolves`) and when a creature
respawns, to the creature's max.

- Max HP per kind (tunable), in `data/animals.js` (animals) and `data/balance.js` (wolves):

  | Creature | HP |
  | --- | --- |
  | rabbit | 2 |
  | deer | 4 |
  | boar | 6 |
  | wolf | 6 |

- A hit subtracts the weapon's damage. If `hp > 0`, the creature is wounded and flees (reuse the
  existing flee). If `hp <= 0`, it falls and the existing reward flow runs unchanged (`finishHunt`
  logic: food/leather/antler for animals; wolves give a pelt and return to their den at the next
  dusk). The stone-weapon wear that `finishHunt` applies today moves to each hit.

A single "apply a hit" helper is the one place that subtracts HP and, on reaching 0, resolves the
kill. Mouse swings, mouse shots, and the `E` hunt all call it, so the three paths stay consistent.

## Damage per tier

Tunable, in `data/balance.js`:

| Weapon | stone | iron | gold | diamond |
| --- | --- | --- | --- | --- |
| sword (full) | 2 | 3 | 4 | 6 |
| bow arrow (full) | 2 | 3 | 4 | 6 |
| axe (close fallback) | 1 | 2 | — | — |

- Snap shot (minimum charge) = `floor(full / 2)`, at least 1.
- The axe stays a worse weapon than the sword (consistent with today's "sword is quicker").
- Worked examples: a stone sword fells a rabbit in 1 hit, a deer in 2, a boar/wolf in 3; a diamond
  sword fells a boar or wolf in 1.

## Four-tier weapons (data)

- `TIERS` in `data/tools.js` becomes `['stone', 'iron', 'gold', 'diamond']`.
- Gathering tools stay stone/iron: the tier ladder is **data-driven**. `nextTier(tool)` returns the
  next tier that has a recipe in `TOOL_RECIPES[tool]`; axe/pickaxe/hammer have no gold/diamond
  recipe, so they stop at iron; sword/bow have all four.
- **Durability:** stone weapons wear (`TOOL_USES` sword/bow = 20, as today); iron, gold, and diamond
  weapons last forever (same as iron today).
- **Reach (bow), tunable:** stone 260, iron 340, gold 400, diamond 460 (`BOW_REACH`).
- **Recipes** (`TOOL_RECIPES`), forged like iron (needs a hammer and standing in one of the player's
  fires' warmth):
  - sword — gold `{ wood: 1, gold: 4 }`, diamond `{ wood: 1, diamond: 4 }`
  - bow — gold `{ wood: 3, gold: 2, herbs: 2 }`, diamond `{ wood: 3, diamond: 2, herbs: 2 }`
- `SWORD_SECONDS` gains gold and diamond entries (e.g. gold 0.6, diamond 0.5 — tunable; iron is
  0.6 today).

## Save impact

None to the save **shape**. Expanding `TIERS` only widens the set of tier strings `restoreGame`
accepts for a tool; old saves (stone/iron only) remain valid, and `SAVE_VERSION` does **not** change.
Creature HP and the combat stance are runtime-only and never serialized (a test already asserts
animation state is not saved; combat state follows the same rule).

## Rendering and UI

- `render/renderer.js`: draw the aim **path line** and **charge ring** while aiming; draw the
  **stance badge** when drawn; drive the flying arrow + reticle from the combat state (not only from
  the animator clip, which is how the `E` shot drives it today) so a mouse shot shows the same
  effect. Tiered art (below).
- `ui/hud.js`: a small stance indicator, and the active sword/bow chip glows while drawn.
- `data/controls.js`: add `Q` (draw/sheathe), left-mouse (sword), right-mouse (bow aim). The
  journal's Controls tab reads `CONTROLS`, so it updates automatically.

## Art dependencies (placeholders first)

Real gold/diamond art is a follow-up; this slice ships with placeholders so gameplay can be built
and verified:

- Sword/bow swing sheets exist only for stone and iron. Gold and diamond **reuse the iron swing
  art** (tinted if cheap) until real sheets are painted.
- The flying-arrow effect (`arrow-stone`, `arrow-iron`) reuses `arrow-iron` for gold/diamond, or
  adds `arrow-gold`/`arrow-diamond` later.
- Build-menu / HUD chip pictures for gold and diamond weapons reuse or tint the iron chip for now.

These are cosmetic; none blocks the mechanic. Note them in `docs/art-direction.md`.

## Files touched

- New: `src/actions/combat.js` — stance helpers, lock-on target selection, `applyHit`, sword swing,
  bow loose (charge → damage). Keep the pure parts (target pick given a world point, damage math,
  HP subtraction) import-free of `ui/`, `core/`, `render/` so they run in Node tests.
- `src/data/tools.js` — four-tier `TIERS`.
- `src/data/balance.js` — damage tables, wolf HP, charge constants, bow reach, sword seconds,
  gold/diamond recipes.
- `src/data/animals.js` — per-kind HP.
- `src/world/animals.js`, `src/world/wolves.js` — `hp` field, init on reset/respawn.
- `src/actions/animals.js` — route the hunt through the damage model; keep the `E` path (one hit).
- `src/core/input.js` — `Q` toggle; left/right-button branch on stance; suppress context menu.
- `src/core/loop.js` — tick charge while aiming; drive arrow flight; apply damage on landing; feed
  the aimed/struck creature to `tickAnimals` so it is startled/flees.
- `src/core/session.js` — combat runtime state.
- `src/render/renderer.js`, `src/ui/hud.js`, `src/data/controls.js` — visuals and controls listing.
- Art scripts (`tools/prepare-weapon-art.py` and friends) — gold/diamond placeholders.

## Testing

Node tests (`tests/actions/combat.test.js` and extensions):

- Damage subtracts HP; a creature survives above 0 and falls at 0.
- Tier damage: higher tier = fewer hits to fell a given creature.
- Snap vs charged: snap ≈ half (floored, min 1); full hold = full.
- Lock-on picks the creature nearest the cursor within reach, and nothing out of reach.
- `E` hunt now deals one hit (not an instant kill) and still awards on the killing hit.
- Stone weapon wears per hit; iron/gold/diamond do not.
- `tests/data/ladder.test.js` — weapons reach diamond; gathering tools stop at iron.
- Save test — a save holding a gold or diamond weapon loads; a stone/iron save is unaffected.

Browser verification (per CLAUDE.md, run the `wildhaven` config at `127.0.0.1`): draw/sheathe with
`Q`; LMB swing fells a deer in the expected number of hits; RMB tap vs hold damage; lock-on follows a
runner; arrows deplete and the out-of-arrows notice shows; `E` fallback still hunts; check the
console for errors and the layout at ~390 px. Add notes to `docs/verification.md`.

## Suggested build order (optional, one spec)

- **Slice A** — data + HP + damage-based `E` hunt (pure modules + tests; easy to verify headless):
  four-tier weapons, recipes, creature HP, `applyHit`, `E` deals one hit.
- **Slice B** — mouse combat: stance (`Q`), LMB swing, RMB aim/charge/loose, renderer visuals, HUD.

## Open tuning knobs

All numbers in the HP, damage, charge, reach, and recipe tables are first-pass and expected to be
tuned during playtest. `CHARGE_SECONDS` ≈ 0.9 s is the starting value.
