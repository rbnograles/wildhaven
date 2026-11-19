# Water Look Design (shores, depth and gentle motion)

**Date:** 2026-11-19 · **Status:** design approved in chat; spec awaiting review · **Builds on:** archipelago slice A1 (`docs/superpowers/specs/2026-11-19-archipelago-design.md`, branch `worktree-archipelago-a1`)

## Goal

Water today is one flat texture with a wide pale foam fade at every edge: no bank, no depth, no motion. Give each kind of water its own shore, make water look deeper away from the shore, and add gentle motion, so rivers, lakes and the sea read as different places.

Decisions made in brainstorming:

| Topic | Decision |
| --- | --- |
| Shore style | Matched to the water kind: sea gets sandy shallows, rivers a raised earth bank, lakes and ponds a muddy shaded edge |
| Motion strength | Gentle |
| Approach | Baked tiles in `build-map.py` plus animated sprites drawn by the renderer (not a water shader, not frame-swapped tiles) |
| Timing | Implemented after archipelago A1 is merged into `main`, on its own branch from there |

Mockups shown in chat (made from the real ground textures and an animated preview) are not kept in the repo.

## What the player sees

### Three kinds of water

Every water corner gets a kind when the map is built:

- **sea**: the sea around the island (archipelago A1), the Driftwood Lagoon and the water around its islets.
- **river**: the two `RIVERS`. Each polyline is listed upstream to downstream: the Frostpeak river flows to the lagoon, the canyon river flows from the west edge to the south edge.
- **lake**: the landmark `POOLS` and any other water that is neither sea nor river.

Where kinds meet (a river mouth at the sea), the style changes at a tile edge.

### Shore and depth by kind

| Kind | Land edge (rim) | Shallows | Deep |
| --- | --- | --- | --- |
| sea | Wet sand and a thin foam line at the waterline | Sandy bottom showing through | Darkens away from the shore; A1's `deep` layer stays darkest |
| river | Earth lip. Where land is above water on screen (the bank faces the camera), a short earth wall, and a soft shadow on the water below the bank | Brown bottom near the edge | Dark middle |
| lake | Muddy edge and a soft shadow | Muddy bottom near the edge | Dark middle |

### Gentle motion

- **River:** pale current streaks drift downstream along the river, faster in the middle, and never over a ford or bridge.
- **Lake:** sparkles fade in and out. No current.
- **Sea:** a foam line at the waterline slowly laps in and out; a few sparkles on open water.
- Motion only exists near the camera. With `prefers-reduced-motion` there is no motion; shores and depth still show.

### What does not change

Collision (where the player can walk and the boat can sail), fords, bridges, and the dry riverbed. The minimap and world map keep working; the water colour in `overview.webp` may shift slightly.

## How the tiles are built (`tools/build-map.py`)

1. **Water kind per corner.** Next to the terrain corners, a `kind` grid records `sea`, `river` or `lake` for each water corner, from the rule that made it water: coast, sea border and islands → sea; `RIVERS` → river; `POOLS` and anything else → lake. A tile whose water corners have mixed kinds uses river, then lake, then sea.
2. **One `water` layer, three tile sets.** The corner-mask scheme stays (15 masks × 16 variants). Each kind gets its own 240 tiles, laid out one after another: sea, river, lake. The shore is drawn inside each water tile, on its land side and just inside the waterline:
   - **rim**: a narrow band of wet sand, earth or mud on the land side of the waterline, fading onto the land;
   - **shallows**: the bottom colour mixed into the water near the waterline, fading toward the middle;
   - **river wall and shadow**: on river tiles where land lies above the water on screen, a short earth wall (about 14 px tall) drawn on the water side just below the waterline, and a soft shadow on the water under it. Banks that face away from the camera or sideways get only the rim and the shadow. The wall is worked out from the corner blend extended a little past the tile's top edge, so it continues across tile edges.
   Because the corner blend and the noise are continuous between neighbouring tiles, rims and walls line up across tile edges.
3. **New `depth` layer.** A corner is deep when it is more than `DEPTH_FROM` (70) units from land, found the same way A1 finds deep sea. Its tiles are a soft dark tint whose alpha follows the corner blend, so the water darkens smoothly toward the middle of a river and away from a beach. Order, bottom to top: `water`, `depth`, A1's `deep`.
4. **A second tileset.** A1's `tileset.png` is already 2112×3498, close to the 4096 px texture limit of some GPUs. The water and depth tiles (about 960) go in a new `assets/world/map/water-tileset.png` (about 2000 px tall). The Tiled map lists both tilesets; global tile ids stay unique.
5. **Colours from existing textures.** Wet sand comes from `sand.png`, the earth bank and wall from `dirt.png`, mud from a mix of the two, all tinted in code. No new source art in this step. Every tint, width and strength sits in one table near the top of the script, so real textures can replace them later.
6. **Data for the motion,** saved as map properties:
   - `rivers`: the river polylines, upstream to downstream, in map coordinates (after A1's `PAD` shift);
   - `shores`: points every 128 units along the sea waterline, each with the direction toward the water.
   - `firstWaterGid` keeps pointing at the first water tile; the kind order (sea, river, lake) is fixed and also saved as `waterKinds`.

## How the motion works in the game

### `src/world/water.js` (pure, runs in Node)

- `flowAt(x, y)`: the downstream direction at a river point, from the nearest segment of the nearest river polyline.
- `pickSpawns(view, kind, count, random)`: points inside the visible area plus a margin where `waterKindAt` gives that kind, so a river streak never starts on a ford, a bridge or land. `random` is passed in so tests can repeat a result.
- Tuning numbers live in `src/data/balance.js` under a new `WATER_FX` group (speeds, counts, lifetimes, foam travel).

### `src/world/map.js`

- `cover()` reads the mask from any of the three tile sets, so `waterAt`, `isWalkable` and A1's `isSailable` give the same answers as before.
- New `waterKindAt(x, y)`: `'sea'`, `'river'`, `'lake'` or `null` (land), read from the tile set that the water tile at that spot belongs to. A spot counts as water when it passes the same 0.35 test as collision.

### `src/render/water.js` (browser)

A separate file so `renderer.js` does not grow further. It draws three small textures in code (no new art files) and keeps a pool of sprites that it reuses instead of creating new ones each frame:

- **current streaks (river):** about 20–30 on screen. Each moves along `flowAt` at about 25–45 units/s (faster in the middle), fades in and out over 2–3 s, and disappears at once if it leaves river water.
- **sparkles (lakes, and a few at sea):** grow, twinkle and fade over 1.5–3 s. They don't move.
- **shore foam (sea):** one short curved foam stroke per `shores` point near the camera, sliding 8–12 px in and out along the point's direction, each point with its own phase so they don't move in step.
- There is a cap on the total number of sprites.
- Effects draw above the water and depth layers and below objects and the player.

It advances with game time (`dt`), so it stops when the game is paused or the tab is hidden, like everything else. With `prefers-reduced-motion` it creates no effects. If the map has no `rivers` or `shores` property, that effect is skipped silently.

### `src/render/renderer.js`

Loads `water-tileset.png` (an asset load failure ends on the loading screen's retry state, like any other), adds the `depth` layer to the terrain layer list, and calls the water effects from `draw`.

## Testing

- **`tests/world/map.test.js`:** masks decode the same from the sea, river and lake tile sets; `waterKindAt` gives `river` in the middle of a river, `lake` in a landmark pond, `sea` past the coast, and `null` on land and on a ford.
- **`tests/world/water.test.js`:** `flowAt` points downstream at several points on both rivers; `pickSpawns` returns points inside the view and of the asked kind, never on a ford or land, and the same points for the same `random`.
- **Tileset size:** both tilesets are at most 4096 px on each side (read from the PNG header).
- All existing tests still pass, including the flood fill in `tests/world/places.test.js` and A1's boat tests. That is the proof that collision did not change.

## Verification

From the `wildhaven` launch config at `127.0.0.1`, with a test save so no real save is touched: a river (bank wall on banks that face the camera, shadow, dark middle, streaks flowing downstream and vanishing at fords and bridges), a landmark pond (muddy edge, sparkles), the beach and sea (wet sand, foam lapping, a smooth change into `deep`), tile seams at different zoom levels, reduced motion (no effects, shores and depth still drawn), the frame rate while walking and sailing, the console, and the page at about 390 px wide. Record notable checks in `docs/verification.md`.

## Docs to update when built

- `CLAUDE.md`: the map pipeline (`water-tileset.png`, the `depth` layer, the three water tile sets, the `rivers`, `shores` and `waterKinds` properties) and the architecture table (`src/world/water.js`, `src/render/water.js`).
- `docs/art-direction.md`: how the shore colours are derived from existing textures.
- `docs/gdd.md`: the water look as [Built].

## Out of scope

- A water shader or moving water surface (can be added later on top of these tiles).
- New source textures for wet sand, mud or the earth bank (the derived colours can be swapped for real art later).
- Waterfalls, rapids, river width changes, reeds or shore props.
- Sound.
