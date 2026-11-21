# Spring Country Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `spring-country.tmj` the one official starting map for all three characters, replacing `wildhaven-world-arranged.tmj`, and reorganize the world assets so the active Spring source lives in its own folder while the old Wildhaven Tiled sheets move to a deprecated folder.

**Architecture:** Spring Country was authored from the arranged Wildhaven geography, so world coordinates (the three spawns, the coastline, river/settlement positions) already line up with the current `places.json`. The integration therefore (1) adds a Spring-aware importer that accepts Spring's layer/tileset contract and writes `assets/world/map/wildhaven.json` + `overview.webp`, (2) regenerates the game's geography data (`places.json` regions/landmarks/waypoints + the map's region grid) and a flat elevation grid from Spring's `Gameplay markers` layer, (3) wires the game to the flat, single-biome world and bumps the save version, and (4) reorganizes the folders. The game keeps reading `assets/world/map/wildhaven.json`, `places.json` and `characters.js` exactly as today — only their contents change — so no runtime loader rewrite is required.

**Tech Stack:** Vanilla JS ES modules (game), Python 3 + numpy + Pillow (map tools), Node `node:test` (JS tests), Python `unittest` (tool tests), Tiled `tmxrasterizer` (minimap render). Prettier for JS formatting.

## Global Constraints

- Node 20.19+ / 22.12+ for the game and tests; the repo is a Windows checkout with `core.autocrlf` — keep each file's existing line endings.
- Pure modules (`src/data/`, `src/world/`, `src/actions/`, `src/game/`, `src/animation/clips.js`) must not import `ui/`/`core/`/`render/`/`sheets.js`/PNG/CSS and must not use `document`, `window` or `import.meta` — in code **or comments** (`tests/boundaries.test.js` scans comments too).
- Every named function needs an ELI5 `/** ... */` comment on the line directly above it (`tests/comments.test.js`); Python `def`s in `tools/` need a `#` comment directly above.
- `npm test`, `npm run build`, `npm run format:check` must all pass. Run `npm run format` after editing JS.
- Tuning numbers live in `src/data/balance.js` — do not hardcode them elsewhere.
- Do not overwrite a Tiled map a user may have open; tools write new files and back up (see `[[tiled-maps-never-overwrite]]` convention). Reply to the user in Taglish; keep repo docs/code in English.
- The map is 448×320 tiles, 64 px/units per tile, 28,672×20,480 world units; Spring's tile size and dimensions already match the game.

---

## Design Decisions (confirm before execution)

These are baked into the tasks below. Flag any you want changed before Stage 1.

- **D1 — Geography source of truth stays `places.json` + `characters.js`.** A new generator `tools/spring-to-places.py` reads Spring's `Gameplay markers` layer and writes `places.json`. Spawns already match, so `characters.js` is unchanged.
- **D2 — Regions = 8 Spring districts.** The 8 settlements become the 8 discovery regions (names from the markers: Hollowstead, Pinefall Camp, Blossom Crossroads, Stonebrook Hamlet, Alder Rest, Driftwood Landing, Greenbough Camp, Willowbank). The region grid is nearest-settlement over the 256-unit cell grid. This keeps the discover/progress/minimap systems working and preserves the exploration hook. (Alternative — a single "Spring" region — is flatter; not chosen.)
- **D3 — Signposts = one per settlement (8 waypoints).** Fast-travel network connects the districts. Landmarks = settlements + stone quarries + cave entrances + notable scenery markers Spring provides (final count comes from the markers, not forced to the old 52).
- **D4 — Flat world.** Elevation grid is all level `0`, no walls, no stairs; `hitsCliff` becomes a no-op everywhere. No snow regions (`SNOW_REGIONS` empty for Spring), so no cold-biome drain.
- **D5 — Save handling: bump `SAVE_VERSION` 16 → 17.** Old saves keep resources, tools, meters, `time`, bag/slots; player position resets to the character's spawn; region/landmark/waypoint/wreck finds and camps are cleared (old-world ids don't exist in Spring). Documented as a one-way world switch.
- **D6 — Boats/sailing (slice A1) deferred for the MVP.** Spring ships as a single-continent land exploration + survival world: `wrecks` is empty, no driftwood-boat loop. Spring's four "disabled sea-route markers" are reserved for later. (If you want sailing in v1, say so — it adds a stage.)
- **D7 — Banks generated for Spring's coastline.** Stage 2 adapts `build-map.py`'s bank routine to Spring's water so shorelines read correctly. If this proves large, the fallback is shipping MVP without bank tiles (water abuts sand) and adding them later — but the plan targets generating them.

---

## File Structure

**New files**
- `tools/import-spring-country.py` — Spring-aware importer: reads Spring's 7 ground layers + `spring-country-objects.tsx`, writes `assets/world/map/wildhaven.json`, `overview.webp`, `ground-kit.png`, `path-kit.png`, and the flat elevation + region grid into the map properties. Adapted from `tools/import-tiled-world.py`; shares its object-box→point math.
- `tools/spring-to-places.py` — reads Spring's `Gameplay markers` layer, writes `assets/world/source/places.json` (regions, spawns, supplies, landmarks, waypoints, empty wrecks) and prints a report.
- `tools/spring_geography.py` — pure helpers shared by the two tools above (nearest-settlement region grid, flat elevation grid, marker parsing). Keeps one copy of the logic for the tool tests.
- `tests/tools/test_spring_integration.py` — Python checks: region grid covers every cell, all three spawns walkable + in a region, every landmark/waypoint walkable + reachable, elevation grid all flat, importer output has the expected layers/tilesets.
- `assets/world/spring-country/` — the active Spring source folder (moved out of `tiled/`): `spring-country.tmj`, `spring-country-objects.tsx`, `spring-country-art/`, `SPRING-COUNTRY.md`, `spring-country-report.json`, detail/overview samples.
- `assets/world/tiled/_deprecated-wildhaven/` — the deprecated Wildhaven Tiled sheets grouped together: `wildhaven-world.tmj`, `wildhaven-world-arranged.tmj`, `wildhaven-sheet.*`, `wildhaven-objects.tsx`, and a `README.md` saying they are deprecated and why.

**Modified files**
- `assets/world/source/places.json` — regenerated for Spring (regions renamed to districts, landmarks/waypoints repositioned, `wrecks: []`).
- `assets/world/map/wildhaven.json`, `overview.webp`, `ground-kit.png`, `path-kit.png` — regenerated by the Spring importer.
- `assets/world/source/objects.json` + `source/objects/<kind>/*.png` — any Spring-only sprites the game lacks get cut in and registered.
- `src/data/places.js` — no code change expected (reads `places.json`); verify it tolerates the new region set.
- `src/world/regions.js` — confirm `SNOW_REGIONS`/`inSnow` handle Spring (no snow regions).
- `src/world/map.js` — confirm `hitsCliff` on an all-flat elevation grid is a no-op; confirm `firstSandGid`/`firstSnowGid` still resolve (snow layer may be absent).
- `src/game/state.js` — `SAVE_VERSION` 16 → 17 + an `upgradeToSpring` migration path.
- `tools/build-spring-country.py` — update its `OUT`/source paths to the new `assets/world/spring-country/` location and the deprecated Wildhaven inputs.
- `tools/import-tiled-world.py` — leave working for the old pipeline, but update the deprecated-Wildhaven input path and add a header note that Spring uses `import-spring-country.py`.
- `.claude/launch.json` — unchanged (same dev server); the game auto-loads the regenerated `wildhaven.json`.
- `CLAUDE.md`, `docs/gdd.md`, `docs/verification.md` — update the World/Map Pipeline and overview sections to describe Spring as the active map.

---

## Stage 0 — Folder reorganization (safe, no gameplay change)

Moves the Spring source into its own folder and groups the deprecated Wildhaven sheets, updating every tool path that referenced the old locations. After this stage the game still runs on the current (pre-Spring) map; only paths changed.

### Task 0.1: Move Spring source into `assets/world/spring-country/`

**Files:**
- Move: `assets/world/tiled/spring-country.tmj`, `spring-country-objects.tsx`, `spring-country-art/`, `SPRING-COUNTRY.md`, `spring-country-report.json`, `spring-country-overview.png`, `spring-country-before-town-expansion*.{tmj,tsx}`, `spring-country-detail-*.{tmj,png}` → `assets/world/spring-country/`
- Keep in place (shared kits still used by both pipelines): `terrain-redrawn.*`, `path-connectors.*`

- [ ] **Step 1: Create the folder and `git mv` the Spring files**

```bash
mkdir -p "assets/world/spring-country"
git mv assets/world/tiled/spring-country.tmj assets/world/spring-country/
git mv assets/world/tiled/spring-country-objects.tsx assets/world/spring-country/
git mv assets/world/tiled/spring-country-art assets/world/spring-country/
git mv assets/world/tiled/SPRING-COUNTRY.md assets/world/spring-country/
git mv assets/world/tiled/spring-country-report.json assets/world/spring-country/
git mv assets/world/tiled/spring-country-overview.png assets/world/spring-country/
git mv assets/world/tiled/spring-country-detail-scout.tmj assets/world/spring-country/
git mv assets/world/tiled/spring-country-detail-builder.tmj assets/world/spring-country/
git mv assets/world/tiled/spring-country-detail-survivor.tmj assets/world/spring-country/
git mv assets/world/tiled/spring-country-detail-scout.png assets/world/spring-country/
git mv assets/world/tiled/spring-country-detail-builder.png assets/world/spring-country/
git mv assets/world/tiled/spring-country-detail-survivor.png assets/world/spring-country/
git mv assets/world/tiled/spring-country-before-town-expansion.tmj assets/world/spring-country/
git mv assets/world/tiled/spring-country-before-town-expansion-objects.tsx assets/world/spring-country/
```

- [ ] **Step 2: Fix the TSX relative paths**

`spring-country-objects.tsx` and the `.tmj` reference `../source/objects/...` and `terrain-redrawn.tsx`/`path-connectors.tsx` by relative path. After moving one folder deeper is avoided (still directly under `assets/world/`), so `../source/...` still resolves and the kits are now one level up at `../tiled/`. Update the `.tmj` tileset `source` fields and the TSX `<image source>` fields:
- In `spring-country.tmj`: `"source":"terrain-redrawn.tsx"` → `"source":"../tiled/terrain-redrawn.tsx"`, `"path-connectors.tsx"` → `"../tiled/path-connectors.tsx"`, `"spring-country-objects.tsx"` → `"spring-country-objects.tsx"` (same folder).
- Verify `spring-country-objects.tsx` image sources `../source/objects/...` still resolve from the new folder (`assets/world/spring-country/../source` = `assets/world/source` ✓).

- [ ] **Step 3: Open the map in Tiled headless to confirm assets resolve**

Run: `& $env:TMXRASTERIZER --size 800 "assets/world/spring-country/spring-country.tmj" "$env:TEMP/spring-check.png"`
Expected: renders with no "could not load" asset errors; the output PNG exists and is non-empty.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Move Spring Country source into assets/world/spring-country/"
```

### Task 0.2: Group the deprecated Wildhaven sheets

**Files:**
- Move: `assets/world/tiled/wildhaven-world.tmj`, `wildhaven-world-arranged.tmj`, `wildhaven-sheet.png`, `wildhaven-sheet.json`, `wildhaven-sheet.tsx`, `wildhaven-objects.tsx` → `assets/world/tiled/_deprecated-wildhaven/`
- Create: `assets/world/tiled/_deprecated-wildhaven/README.md`

- [ ] **Step 1: Move the sheets**

```bash
mkdir -p "assets/world/tiled/_deprecated-wildhaven"
git mv assets/world/tiled/wildhaven-world.tmj assets/world/tiled/_deprecated-wildhaven/
git mv assets/world/tiled/wildhaven-world-arranged.tmj assets/world/tiled/_deprecated-wildhaven/
git mv assets/world/tiled/wildhaven-sheet.png assets/world/tiled/_deprecated-wildhaven/
git mv assets/world/tiled/wildhaven-sheet.json assets/world/tiled/_deprecated-wildhaven/
git mv assets/world/tiled/wildhaven-sheet.tsx assets/world/tiled/_deprecated-wildhaven/
git mv assets/world/tiled/wildhaven-objects.tsx assets/world/tiled/_deprecated-wildhaven/
```

- [ ] **Step 2: Write the deprecation README**

Create `assets/world/tiled/_deprecated-wildhaven/README.md` stating: these are the old seven-region Wildhaven authoring sheets, superseded by Spring Country (`assets/world/spring-country/`), kept only for history and for `import-tiled-world.py`'s legacy path; do not author new maps from them.

- [ ] **Step 3: Repoint every tool/reference to the moved sheets**

Search and update paths. Known references:
- `tools/import-tiled-world.py` default `SOURCE` and `wildhaven-sheet.json`/`wildhaven-sheet.png`/`wildhaven-objects.tsx` reads → `tiled/_deprecated-wildhaven/...`.
- `tools/build-spring-country.py` reads `OUT / 'wildhaven-world-arranged.tmj'` and `OUT / 'wildhaven-sheet.json'` → new paths.
- Any `tools/*.py` or test referencing `wildhaven-world-arranged.tmj`, `wildhaven-sheet`, `wildhaven-objects`.

Run: `grep -rn "wildhaven-world\|wildhaven-sheet\|wildhaven-objects" tools/ tests/ src/`
Expected after edits: every hit points at `_deprecated-wildhaven/` or `spring-country/`, or is a comment.

- [ ] **Step 4: Verify tools still import/parse**

Run: `python -c "import ast; ast.parse(open('tools/import-tiled-world.py').read()); ast.parse(open('tools/build-spring-country.py').read())"`
Expected: no error.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Group deprecated Wildhaven Tiled sheets and repoint tools"
```

---

## Stage 1 — Generate Spring geography (`places.json`, regions, elevation)

Produces the game's geography data from Spring's markers. Test-first via `tests/tools/test_spring_integration.py`, mirroring the existing `tests/tools/test_spring_country.py` pattern.

### Task 1.1: Pure geography helpers + their tests

**Files:**
- Create: `tools/spring_geography.py`
- Create/extend: `tests/tools/test_spring_integration.py`

**Interfaces:**
- Produces: `read_markers(tmj_path) -> dict` (keys: `spawns`, `settlements`, `quarries`, `caves`, `herds`, `dens`, `exits`, each a list of `{name, x, y, props}`); `region_grid(settlements, cols, rows, cell) -> (grid_str, region_ids)` (nearest-settlement index per cell, row-major); `flat_elevation(cols, rows) -> str` (all `'0'`).

- [ ] **Step 1: Write failing tests for the helpers**

```python
# tests/tools/test_spring_integration.py
import os, unittest
import sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools'))
import spring_geography as sg

SPRING = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'world', 'spring-country', 'spring-country.tmj')

class Markers(unittest.TestCase):
    # Guards: the marker reader finds all 3 starts and all 8 settlements.
    def test_reads_starts_and_settlements(self):
        m = sg.read_markers(SPRING)
        self.assertEqual(len(m['spawns']), 3)
        self.assertEqual(len(m['settlements']), 8)

class RegionGrid(unittest.TestCase):
    # Guards: every cell gets a region and ids are within range.
    def test_full_coverage(self):
        m = sg.read_markers(SPRING)
        grid, ids = sg.region_grid(m['settlements'], 112, 80, 256)
        self.assertEqual(len(grid), 112 * 80)
        self.assertTrue(all(0 <= int(c) < len(ids) for c in grid))

class Elevation(unittest.TestCase):
    # Guards: the flat world has no walls or stairs.
    def test_all_flat(self):
        e = sg.flat_elevation(448, 320)
        self.assertEqual(set(e), {'0'})
        self.assertEqual(len(e), 448 * 320)
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -v`
Expected: FAIL (module `spring_geography` not found).

- [ ] **Step 3: Implement `tools/spring_geography.py`**

Implement `read_markers` (iterate the `Gameplay markers - show to edit` object layer, bucket by `type`), `region_grid` (for each cell center, pick the nearest settlement by Euclidean distance; return the row-major digit string and the ordered settlement name list), `flat_elevation` (`'0' * cols * rows`). Each `def` gets a `#` comment directly above it.

- [ ] **Step 4: Run tests, verify they pass**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/spring_geography.py tests/tools/test_spring_integration.py
git commit -m "Add Spring geography helpers (markers, region grid, flat elevation)"
```

### Task 1.2: `spring-to-places.py` writes `places.json` + reachability test

**Files:**
- Create: `tools/spring-to-places.py`
- Modify: `tests/tools/test_spring_integration.py` (add reachability checks that reuse `tests/world/flood.js`'s intent in Python, or assert against the generator's own report)

**Interfaces:**
- Consumes: `spring_geography.read_markers`, `region_grid`.
- Produces: `assets/world/source/places.json` with `regions` (8 districts, `{id, key, name}`), `spawns` (unchanged 3), `supplies` (from Spring forage/supply markers nearest each start), `landmarks` (settlements+quarries+caves, each `{id, region, name, x, y}`), `waypoints` (one per settlement), `wrecks: []`.

- [ ] **Step 1: Write a failing test for generated places**

```python
class Places(unittest.TestCase):
    # Guards: regenerated places.json keeps the 3 spawns and gives 8 regions + 8 signposts.
    def test_shape(self):
        import json
        p = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'world', 'source', 'places.json')))
        self.assertEqual(len(p['regions']), 8)
        self.assertEqual(len(p['waypoints']), 8)
        self.assertEqual(p['wrecks'], [])
        self.assertEqual(p['spawns']['scout'], [14348, 4148])
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -k Places -v`
Expected: FAIL (old `places.json` still has 7 regions / 14 waypoints / non-empty wrecks).

- [ ] **Step 3: Implement `tools/spring-to-places.py` and run it**

Build the regions (district names → `{id: slug, key: first-letter, name}`), landmarks (slug ids, region = nearest settlement), one waypoint per settlement, supplies copied from the nearest Spring supply markers to each start. Write `places.json` preserving its one-item-per-line style. Run `python tools/spring-to-places.py`.

- [ ] **Step 4: Run the test, verify it passes**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -k Places -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/spring-to-places.py tests/tools/test_spring_integration.py assets/world/source/places.json
git commit -m "Generate Spring places.json (8 districts, signposts, no wrecks)"
```

---

## Stage 2 — Spring importer (map + elevation + regions + banks + overview)

### Task 2.1: `import-spring-country.py` writes `wildhaven.json` with flat elevation + Spring region grid

**Files:**
- Create: `tools/import-spring-country.py`
- Modify: `tests/tools/test_spring_integration.py`

**Interfaces:**
- Consumes: `spring_geography.flat_elevation`, `region_grid`; `terrain-redrawn.json`, `path-connectors`, `spring-country-objects.tsx`.
- Produces: `assets/world/map/wildhaven.json` (nine hidden ground layers for collision — Spring's 7 painted layers plus empty `jungle`/`snow` layers so `world/map.js` still finds every `firstXGid`; the Spring tile layers drawn as-is; objects as points), map properties `elevation` (flat), `regionGrid`/`regionCols`/`regionCell`, and `overview.webp`.

- [ ] **Step 1: Write a failing test for importer output**

```python
class Importer(unittest.TestCase):
    # Guards: the imported game map is flat, 448x320, and has the collision ground layers.
    def test_map_shape(self):
        import json
        g = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'world', 'map', 'wildhaven.json')))
        props = {p['name']: p['value'] for p in g['properties']}
        self.assertEqual((g['width'], g['height']), (448, 320))
        self.assertEqual(set(props['elevation']), {'0'})
        self.assertEqual(props['importedFrom'], 'spring-country.tmj')
        names = {l['name'] for l in g['layers']}
        self.assertTrue({'water', 'deep', 'sand'} <= names)
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -k Importer -v`
Expected: FAIL (`importedFrom` is still the arranged map / elevation not flat).

- [ ] **Step 3: Implement `import-spring-country.py`**

Fork `import-tiled-world.py`. Changes: (a) read Spring's 7 ground layers, synthesizing empty `jungle`/`snow` collision layers; (b) resolve objects from `spring-country-objects.tsx` tile `type` attributes; (c) skip the `game-banks-and-cliffs` dependency — build the game tileset fresh or reuse the existing `tileset.png` for shared sprites; (d) write a **flat** `elevation` and a **Spring** `regionGrid`/`regionCols`/`regionCell` from `spring_geography` instead of copying the old map's; (e) set `importedFrom = spring-country.tmj`. Keep the object box→point math and the left-out rules (in-water objects) from the original. Each `def` keeps its `#` comment.

- [ ] **Step 4: Run it + the test**

Run: `python tools/import-spring-country.py` then `python -m unittest discover -s tests/tools -p test_spring_integration.py -k Importer -v`
Expected: importer prints its report; test PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/import-spring-country.py tests/tools/test_spring_integration.py assets/world/map/
git commit -m "Add Spring importer: flat elevation, Spring region grid, Spring objects"
```

### Task 2.2: Spring shoreline banks (or documented MVP fallback)

**Files:**
- Modify: `tools/import-spring-country.py` (bank generation)
- Modify: `tests/tools/test_spring_integration.py`

- [ ] **Step 1: Write a test that bank tiles exist along Spring water OR that the fallback is explicit**

```python
class Banks(unittest.TestCase):
    # Guards: either a banks layer is present, or the map explicitly records no banks (MVP fallback).
    def test_banks_present_or_declared(self):
        import json
        g = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'world', 'map', 'wildhaven.json')))
        names = {l['name'] for l in g['layers']}
        props = {p['name']: p['value'] for p in g['properties']}
        self.assertTrue('banks' in names or props.get('banks') == 'none')
```

- [ ] **Step 2: Run, verify it fails**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -k Banks -v`
Expected: FAIL.

- [ ] **Step 3: Implement banks (port `build-map.py`'s `ocean/river/lake` bank routine to Spring's water mask) or set `props['banks']='none'`**

Prefer generating banks from Spring's water corner masks (ocean round the sea, lake round ponds, river along rivers), writing a `banks` tile layer + the bank tiles. If generation is deferred, set the `banks=none` property and note it in `docs/verification.md`.

- [ ] **Step 4: Run, verify it passes**

Run: `python -m unittest discover -s tests/tools -p test_spring_integration.py -k Banks -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/import-spring-country.py tests/tools/test_spring_integration.py assets/world/map/
git commit -m "Generate Spring shoreline banks (or declare MVP fallback)"
```

---

## Stage 3 — Wire the game to the flat, single-biome Spring world

### Task 3.1: Flat-world + no-snow safety in `world/`

**Files:**
- Modify: `src/world/map.js` (confirm `hitsCliff` no-ops on flat elevation; guard `firstSnowGid` if the snow layer is empty)
- Modify: `src/world/regions.js` (`SNOW_REGIONS` empty / `inSnow` false for Spring)
- Test: `tests/world/map.test.js`, `tests/world/regions.test.js`

- [ ] **Step 1: Write failing tests**

```js
// in tests/world/map.test.js
test('flat Spring world never blocks on cliffs', () => {
  // any walkable grass point stays walkable; hitsCliff is false on flat ground
  assert.equal(hitsCliff(14348, 4148), false);
});
```
```js
// in tests/world/regions.test.js
test('Spring has no snow region', () => {
  assert.equal(inSnow(14348, 4148), false);
});
```

- [ ] **Step 2: Run, verify they fail (or pass trivially — then assert the real risk)**

Run: `node --test tests/world/map.test.js tests/world/regions.test.js`
Expected: FAIL if a guard is missing; if they already pass, keep them as regression guards and continue.

- [ ] **Step 3: Implement the guards**

Only touch what the tests require: make `hitsCliff` tolerate an all-`'0'` grid (it already should — verify), and ensure `firstSnowGid`/`surfaceAt` do not throw when the snow layer is empty. Keep `SNOW_REGIONS` derived so Spring yields none.

- [ ] **Step 4: Run, verify pass**

Run: `node --test tests/world/map.test.js tests/world/regions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/map.js src/world/regions.js tests/world/
git commit -m "Make world layer flat-safe and snow-free for Spring"
```

### Task 3.2: Save version 17 + Spring world-switch migration

**Files:**
- Modify: `src/game/state.js` (`SAVE_VERSION = 17`, `upgradeToSpring`)
- Test: `tests/game/state.test.js`, `tests/game/saves.test.js`

- [ ] **Step 1: Write failing test for the migration**

```js
test('a v16 save upgrades into Spring: keeps resources, resets position and finds', () => {
  const old = { /* minimal valid v16 save with resources, a landmark id, a camp */ version: 16, /* ... */ };
  const game = restoreGame(old, 'scout');
  assert.equal(game.version, 17);
  assert.deepEqual(game.player.x, SPAWNS.scout[0]); // reset to spawn
  assert.deepEqual(game.landmarks, []);             // old-world finds cleared
  assert.ok(game.resources.wood >= 0);              // resources kept
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `node --test --test-name-pattern="upgrades into Spring" tests/game/state.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `SAVE_VERSION = 17` and `upgradeToSpring`**

A v16 (or earlier, after its existing upgrades) save is routed through `upgradeToSpring`: keep `resources`, `tools`, `meters`, `time`, `elapsed`, `slots`/`backpack`/bag, gear flags; set `player` position to the character's spawn; clear `landmarks`, `waypoints`, `wrecks`, `boat`, `aboard`, `camps`, `regrowAt`, and reset `fog` to the Spring-sized grid. Document in the `state.js` save-model comment.

- [ ] **Step 4: Run, verify pass; then full save suite**

Run: `node --test tests/game/state.test.js tests/game/saves.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/state.js tests/game/
git commit -m "Save v17: migrate existing saves into the Spring world"
```

### Task 3.3: Register any Spring-only sprites the game lacks

**Files:**
- Modify: `assets/world/source/objects.json`, `assets/world/source/objects/<kind>/*.png`
- Test: `tests/world/objects.test.js`, `tests/world/nodes.test.js`

- [ ] **Step 1: List Spring sprites missing from `objects.json`**

Run: `python tools/import-spring-country.py` and read its `objects the game has no sprite for (left out)` report line.
Expected: a (possibly empty) list of names.

- [ ] **Step 2: For each missing sprite, add its art + `objects.json` entry**

Cut/copy the art into the right `source/objects/<kind>/` folder with a `.prompt.txt`, add the `objects.json` entry (`kind`, `origin`, `footprint`, `scale`), keeping unique names across kind folders.

- [ ] **Step 3: Re-run the importer and the object tests**

Run: `python tools/import-spring-country.py && node --test tests/world/objects.test.js tests/world/nodes.test.js`
Expected: no "no sprite for" names remain; tests PASS.

- [ ] **Step 4: Commit**

```bash
git add assets/world/source/objects.json assets/world/source/objects assets/world/map
git commit -m "Register Spring-only sprites used by the map"
```

---

## Stage 4 — Full verification + docs

### Task 4.1: Full test suite + build + format

- [ ] **Step 1: Run everything**

Run: `npm test && npm run build && npm run format:check && python -m unittest discover -s tests/tools -p "test_spring*.py"`
Expected: all PASS. The world flood-fill (`tests/world/places.test.js`) proves every Spring spawn/landmark/signpost/supply is reachable on foot.

- [ ] **Step 2: Fix any failures, re-run, commit**

```bash
git add -A && git commit -m "Fix Spring integration test/build/format failures"
```

### Task 4.2: Manual playtest each character (browser)

- [ ] **Step 1: Launch the `wildhaven` config at 127.0.0.1 and play each character**

Verify on each of scout/builder/survivor: spawns in Spring, can walk/gather/craft a campfire, discovers its district, finds a landmark and a signpost, fast-travels, day/night + meters tick, no console errors. Check the minimap/world map show Spring. Check ~390 px width if layout changed.

- [ ] **Step 2: Record notes in `docs/verification.md`**

### Task 4.3: Update docs

- [ ] **Step 1: Update `CLAUDE.md` (World/Map Pipeline, Project Overview), `docs/gdd.md`, `docs/verification.md`, `README.md`**

State that Spring Country is the active map, the importer is `tools/import-spring-country.py`, geography comes from `tools/spring-to-places.py`, the world is flat and single-biome, and the Wildhaven sheets are deprecated. Mark deferred: sailing/boats (D6), and banks if the fallback was used (D7).

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Docs: Spring Country is the active world map"
```

---

## Self-Review Notes

- **Spec coverage:** reorg (Stage 0) ✓; "official map for all players" = spawns already shared + regenerated geography + importer + wiring (Stages 1–3) ✓; deprecation grouping (Task 0.2) ✓.
- **Open risks to confirm with the user before Stage 1:** D2 (8 districts vs single region), D3 (signpost/landmark mapping), D6 (defer sailing), D7 (banks now vs later), D5 (save reset vs migrate discovery). These are flagged at the top.
- **Biggest technical unknowns (resolve during execution, not assumed here):** exact Spring-only sprite list (Task 3.3 reads it from the importer report); whether the existing `tileset.png` can be reused for shared sprites or must be rebuilt (Task 2.1 Step 3); bank generation effort (Task 2.2 has a declared fallback).
