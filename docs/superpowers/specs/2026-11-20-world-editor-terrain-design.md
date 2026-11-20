# World editor, build 3: ground, hills, stairs and footpaths

Date: 2026-11-20
Status: design approved, not built

## Why

Builds 1 and 2 edit places and objects. The ground itself, the hills on it, their stairs and the
footpaths still come only from `tools/build-map.py`. The owner wants a tile-map editor: a grid of
boxes, paint land into a box, erase a box, raise a hill, put stairs on it, draw a path.

Same rule as build 2: **generate, then override**. The script makes the base world; the editor
saves hand changes in one new file, `assets/world/source/terrain.json`; the script applies them
on every run.

## What a box is

The map is 448×320 tiles of 64 units. The editor shows that grid when zoomed in, and a **box** is
one tile.

The ground in this game is not stored box by box. The script decides a ground kind at every tile
**corner** and blends the corners into curved, natural edges, and the banks, the deep sea and the
collision are all made from those corners. So:

- **As built:** a box is the square round one tile **corner** (half a tile each way), and the
  grid is drawn half a tile off the tile edges. Painting one box sets one corner, so the box in
  the editor is the patch the rebuilt map shows, with softened edges. (The first version set a
  tile's four corners; a single click then covered two boxes by two, off the grid.)
- In the editor a painted box shows the game's real ground picture at once, covering what was
  there, and generated scenery on a box erased to sea is hidden. The preview is drawn only until
  the map has been rebuilt with that box; after that the real tiles show.
- Land may not be painted within 20 boxes of the map edge, so the outer sea stays deep. The
  island can therefore grow by about 12 boxes on each side, not 32.

## Scope

In, built as three stages in this order, each ending in working software:

1. **Ground**: paint grass, dirt, soil, jungle, rock, snow or sand into boxes, or erase boxes.
2. **Hills and stairs**: raise and lower the ground, place and remove flights of stairs.
3. **Footpaths**: draw paths, erase path pieces.

Out:

- A world bigger than 448×320 tiles. (Land can be painted over the sea inside the map, which
  already grows the island by up to 32 boxes on every side.)
- Editing rivers as lines, fords and bridges, and the region borders. Water is painted as boxes.
- Choosing a single tile picture for a box. The script picks tiles from the corners.
- A faster rebuild.

## Stage 1: ground

### In the editor

A third mode, **Terrain**, beside Places and Objects. Its side panel holds the tools for all three
stages; stage 1 adds:

- A palette of the seven ground kinds and an **Eraser**.
- Brush size: 1, 3 or 5 boxes square.
- Click or drag on the map to paint. One drag is one undo step.
- The grid is drawn from the zoom at which a box is at least 8 screen pixels wide.

"Empty" means **sea**: erasing a box turns it to water. There is no other kind of nothing in this
world; the script then decides whether that water is shallow or deep by its distance from land.

Painting a box with the ground it already has (according to the last built map) removes the
override instead of adding one, so the file holds only real changes.

### In the file

```json
{
  "ground": [
    [120, 200, 204, "sand"],
    [121, 200, 204, "water"]
  ]
}
```

`ground` is a list of runs: `[row, firstColumn, lastColumn, kind]`, in map **corner** rows and
columns (0 to 320 and 0 to 448), sorted by row then column, one run per line. Kinds are `grass`,
`dirt`, `soil`, `jungle`, `rock`, `snow`, `sand`, `water`. The editor keeps a corner-to-kind map
in memory and writes merged runs.

### In `build-map.py`

`terrain(x, y)` is the one function that decides ground; scatter, hills, pools and paths all ask
it. It gains a first step: if the corner nearest `(x, y)` has an override, that is the answer.
Two existing rules still run after it, on purpose:

- Water within 130 units of a place becomes sand, so a place can never be drowned.
- The deep-sea rule (water far from land is deep).

Everything downstream then follows by itself: banks, the water and deep layers, collision, where
trees and tufts grow (none on painted water; some on painted land), where hills may stand.

Known consequences, to be stated in the editor's help text:

- Scenery near a painted area is re-scattered on the next rebuild, because it depends on the
  ground. Objects placed by hand in Objects mode never move.
- A generated hill standing on boxes painted to water moves or disappears.
- The script must stop with a plain message, not a traceback, when an edit leaves a signpost or
  a spawn with no dry ground to start a footpath from (today it crashes in `path_tile`).

## Stage 2: hills and stairs

### How hills work today

After the script places its hills it holds three things for the whole map: `level` (0 to 3 per
tile), `kit_of` (which cliff art, `meadow`, `canyon` or `snow`) and `flights` (stairs: kit,
left column, edge row). Walls, the elevation grid for collision and the cliff tiles are all
derived from those three. Hand edits change those three, right after the generated hills are
placed and before anything is derived.

### In the editor

- **Raise** and **Lower** brushes. They work on blocks of 2×2 boxes, snapped to even rows and
  columns, because the cliff art needs every wall to be at least two tiles wide (the generator
  has the same rule). Raise adds one level, up to 3; Lower takes one off, down to 0.
- A **kit** choice (meadow, canyon, snow) used for blocks that are raised from flat ground. It
  starts as the kit the region uses, and meadow where the region has none.
- **Stairs** tool: click the south edge of a plateau to put a flight there (two boxes wide,
  running down the two-box wall). Click a flight to remove it, generated or hand-made.
- Levels are drawn as a tint with the level number in each block, walls as a darker band, and
  flights as a marked pair of boxes, so the shape is readable before a rebuild.

Lowering a generated hill to 0 deletes it. A flight whose edge no longer exists is dropped by
the script, so deleting a hill never leaves stairs behind.

### Rules, checked in the editor as warnings and by the rebuild's tests

- Two neighbouring blocks may differ by one level at most.
- A wall hangs two boxes south of every south edge. Those two boxes must be dry ground of the
  level below, and a higher level must leave at least three boxes of the lower plateau south of
  it, so the upper wall has somewhere to stand.
- No level may be raised on water, on dirt (village clearings and fords), or within four boxes
  of a place.
- Every plateau needs a flight of stairs, with dry level ground at its foot. `tests/world/
  cliffs.test.js` already fails a map where a level can't be reached, so a hill with no stairs
  fails the rebuild and the log says which.
- After applying the edits the script runs the same `tidy` it uses on generated hills (it fills
  holes and gaps too short for the art), so a painted shape can come out slightly filled in.

### In the file

```json
{
  "levels": [[60, 100, 105, 1, "meadow"]],
  "stairs": { "added": [[102, 66]], "removed": [[210, 91]] }
}
```

`levels` are runs `[row, firstColumn, lastColumn, level, kit]` in map **tile** rows and columns;
a run says "this tile is at this level", including level 0 over a generated hill. `stairs.added`
and `stairs.removed` are `[leftColumn, edgeRow]` pairs in map tiles.

## Stage 3: footpaths

### How paths work today

The script joins the three spawns and fourteen signposts with routes, rounds each route, and lays
a rotated piece (`path-dirt-a/b` or `path-stone-a/b` by region) every 80 units. Trees and tufts
near a path are then cleared.

### In the editor

- **Draw path**: click points on the map; each click adds a corner, double-click or Enter ends
  the path, Escape cancels it. The line is shown as it is drawn.
- **Erase path**: a brush that removes the pieces under it, generated or hand-drawn.
- A drawn path can be selected and deleted as a whole.

### In `build-map.py`

- Drawn paths are rounded and laid with the same code as generated routes, after them, so a
  drawn path that meets a generated one joins it without doubled pieces.
- Erased pieces are dropped from the list **before** the scenery is cleared around paths, so
  trees and tufts grow back where a path was erased.
- Scenery is cleared around drawn paths the same way as around generated ones. This is the one
  place hand edits clear scenery, because a path with trees standing on it is never wanted.

`tests/world/map.test.js` already requires every piece to lie on dry, level, clear ground, so a
path drawn across a river (away from a ford or bridge), over a cliff edge or through a house
fails the rebuild. The editor warns about those first.

### In the file

```json
{
  "paths": {
    "drawn": [[[14300, 9200], [14900, 9350], [15400, 9300]]],
    "erased": [[14348, 4148]]
  }
}
```

`drawn` is a list of polylines in world units. `erased` lists the positions of removed pieces in
world units; a piece is identified by its position alone.

## Shared parts

- **One file.** `terrain.json` holds `ground`, `levels`, `stairs` and `paths`. Any section may be
  missing. It is committed empty (`{}` sections), so the map is unchanged until the first edit.
- **Server.** A third entry, `terrain`, in the editor server's file table: read, save with a
  conflict check, a shape check, the file's own layout. The "out of date" note covers all three
  files.
- **Undo.** One history for places, objects and terrain.
- **Stale entries.** An entry that no longer does anything (an erased path piece or removed
  flight that the script no longer generates) is reported by the build in a map property and
  listed in the editor with a cleanup button, like stale object edits.
- **Preview.** Every terrain edit shows at once as an overlay; the real tiles need a rebuild.
- **Pure module.** `src/editor/terrain.js` holds the edits, the run encoding, the checks and the
  writer, and is tested in Node.
- **No game code changes.** The game reads ground, collision, elevation and paths from the map.

## Effect on saves

- A player or camp saved on a box that is now water: `restoreGame` already sends such a player to
  their spawn and drops such a camp when the saved spot is not walkable.
- The fog and the region grid do not change size.
- A hill raised under a saved player: handled already (cliffs are ignored when a save loads, and
  the player can walk off).

## Testing

Node tests for `terrain.js`: painting, erasing and brush sizes; removing an override that matches
the built ground; run encoding round-trips; raise and lower with the one-level rule; stairs added
and removed; path points and erased pieces; each warning; the writer's layout.

World tests: the built map agrees with `terrain.json` (a painted corner has its kind in the tile
layers, a level run has its level in the elevation grid, a drawn path has pieces along it, an
erased piece is gone). The existing places, sea, map and cliffs tests are the judge of whether
an edit left the world playable; the rebuild runs all of them (cliffs is added to its list).

`build-map.py`: with an empty file the tile layers, elevation, objects and tileset are
byte-for-byte what they were.

In the browser, noted in `docs/verification.md`, per stage: paint and erase with each brush size,
undo, save, rebuild, and the result in the editor and in the game (walk onto painted land, be
blocked by painted water, climb hand-made stairs, see a drawn path).
