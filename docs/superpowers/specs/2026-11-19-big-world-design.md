# Big World Design (build 1 of 4)

**Date:** 2026-11-19 · **Status:** design approved in chat; spec awaiting review

## Vision

One big continent with seven distinct regions, each full of things to do. The reference image the user supplied is a mood board only (layout and biome mix); all art is our own.

Decisions made in brainstorming:

| Topic | Decision |
| --- | --- |
| Objective types | Discover places, gather & collect, unlock regions, help people |
| World size | 4× each side: 384×256 tiles at 64 px = 24,576×16,384 units (~100 s to run across) |
| New biomes | Desert, snowy peaks, rocky canyons, jungle (plus the existing pine forest, meadow and coast) |
| Old map | Redrawn from scratch; old saves reset |
| Fast travel | Waypoints found in the world, used from the world map |
| Region locks | Harsh conditions (cold, heat) countered by gear, not physical barriers |
| People | Stationary locals, one or two per region |
| Build order | Whole world first, then systems |

## The four builds

Each gets its own spec, plan and implementation.

1. **The whole world (this spec).** Map, regions, landmarks, waypoints, "discover places" objectives.
2. **Objectives journal + gather & collect.** A journal screen per region, biome-specific supplies and collectibles.
3. **Harsh conditions and gear.** A small survival meter, region conditions, craftable gear that counters them.
4. **Locals.** Stationary characters with requests and rewards.

Nothing from builds 2 to 4 is in this build. In particular, every region is freely walkable until build 3.

## Build 1 scope

### World layout

384×256 tiles. Approximate layout, one cell = 48×32 tiles:

```
 D D D P P S S S      D = Sunscar Desert     S = Frostpeak
 D D D P P S S S      P = Pinefall Woods     L = Driftwood Lagoon
 D D h h h h S S      h = Hollowstead Meadows
 C C h h h h L L      C = Stonewater Canyons
 C C h h h h L L      J = Emerald Jungle
 C C J J J J L L
 C J J J J J J L
 C J J J J J J L
```

- Region borders are irregular (noise-warped), not straight grid lines.
- Region names for the four new biomes are placeholders the user may change.
- **Rivers:** one from Frostpeak through the meadows to the lagoon; one winding through the canyons; a dry riverbed (walkable) with an oasis pool in the desert. Rivers are water tiles and block walking except at bridges and fords (gaps in the water with a flat bridge sprite or sand ford).
- **Lagoon:** open sea on the east edge with a few small islands (scenery; not reachable in this build).
- **Spawns:** Scout in Pinefall Woods (camp with tent and campfire), Builder in Hollowstead at the centre (the four buildings), Survivor on the lagoon shore (the ship). The nine existing one-time supplies move with their starting places and keep their ids.

### Terrain and art

- New ground textures: `snow`, `rock`, `jungle` (dark lush floor). The desert reuses `sand`. Each becomes a tile layer with the same corner-mask blending as dirt, sand and water.
- New objects: cactus, palm, dead bush, sandstone ruin, snowy pine, ice rock, boulder, cliff rock, jungle tree, fern, bridge, signpost.
- No image generation is available in the implementing session. Every new texture and object starts as a **stand-in** derived from existing art (tinted, reshaped), with a `.prompt.txt` beside it holding the real generation prompt in the established style. Replacing a stand-in means dropping in the PNG and re-running `build-map.py`.

### Regions

- `build-map.py` writes a region id per tile into the map JSON (a `regions` tile layer or property array). This is the single source of truth.
- `src/world/regions.js` replaces the spawn-radius `LOCATIONS` with seven regions (`id`, `name`, `biome`) and `regionAt(player)` reads the tile under the player.
- A region is discovered when the player stands in it. The HUD label always shows the current region's name; "The Open Wilds" goes away.

### Landmarks and waypoints

- **Landmarks:** about seven named points per region (~50 total), defined in a new `src/data/landmarks.js` (`id`, `region`, `name`, `x`, `y`). Found by walking within a discovery radius; a toast shows "Found <name>". Each landmark sits on a visible feature (the oasis, the frozen lake, the old mine, the jungle temple).
- **Waypoints:** two signposts per region (14 total), in `src/data/waypoints.js`. Found by walking up to one. In the world map dialog, clicking a found waypoint moves the player there and closes the map. The signpost is a solid object placed by `build-map.py`; the arrival point is just in front of it.
- Both lists are added to `build-map.py`'s keep-clear handling so scenery never covers them.

### UI

- **HUD objective panel:** shows the current region's progress, e.g. "Sunscar Desert · Places 3/7 · Signposts 1/2", replacing the "first footsteps" objective once that is complete.
- **World map:** larger overview image (1536×1024). Found landmarks and waypoints are marked; regions not yet entered are dimmed. Found waypoints are clickable (and keyboard-focusable).
- **Minimap:** shows the area around the player instead of the whole world.
- Layout must still work at about 390 px wide.

### Saves

- Save `version` becomes 3. Version 2 saves take the existing "could not be read, start fresh" path.
- New fields: `landmarks` (found ids) and `waypoints` (found ids), validated in `restoreGame` like `collected`. `discovered` now holds region ids.
- Waypoint travel saves immediately.

### Map build stability

The frozen `SCATTER_CLEAR` list existed to protect version 2 saves; those are now reset, so it is removed. In its place, scenery is scattered with **one seeded RNG per map chunk** (e.g. 16×16 tiles, seed from chunk coordinates). Editing one area can then never reshuffle scenery elsewhere, and keep-clear filtering stays a pure removal step.

### Performance

- **Collision:** `OBSTACLES` goes into a uniform grid so `isWalkable` checks only nearby bases instead of several thousand.
- **Rendering:** object sprites are created or shown only for chunks near the camera.
- **Bundle:** watch the size of `wildhaven.json` (four more-than-doubled layers); if it passes a few MB, store layers run-length encoded and decode on load.

### Tests (Node)

- `regionAt` returns the right region at known points; every tile belongs to a region.
- Landmark and waypoint discovery; travel only to found waypoints; travel lands on a walkable point.
- Version 3 save round trip; version 2 rejected; unknown landmark/waypoint ids rejected.
- Reachability: a flood fill from each spawn reaches every spawn, landmark, waypoint and one-time supply on foot.
- Existing gather, move and animation tests keep passing with moved coordinates.

### Verification (browser)

Play each character from the `wildhaven` launch config at `127.0.0.1`: walk into at least three regions, find a landmark and a waypoint, travel by waypoint, reload and confirm progress, check the map at ~390 px wide, check the console, and note frame rate in the densest area. Record in `docs/verification.md`.

## Out of scope for build 1

Harsh conditions and gear, the journal screen, new supply types and collectibles, locals, mounts, reaching the islands, and real (generated) art for the stand-ins.

## Docs to update when built

`CLAUDE.md` (world size, pipeline, the `SCATTER_CLEAR` rule, save version), `docs/gdd.md` (world layout, regions, retention hook 2), `docs/art-direction.md` (new assets).
