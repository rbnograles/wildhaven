# World editor, build 2: objects

Date: 2026-11-20
Status: design approved, not built

## Why

Build 1 (`2026-11-20-world-editor-places-design.md`) edits only `places.json`. The map itself,
its trees, rocks, plants, buildings and props, still comes straight out of `tools/build-map.py`
and can't be changed by hand. This build makes those objects editable.

## Change of direction: generate, then override

Build 1's spec said the editor edits the script's inputs and nothing else. That is not enough
for scenery: 9,012 objects are scattered by seeded random passes, and there is no input to edit
for "this one tree".

From this build on the rule is **generate, then override**:

- `build-map.py` still makes the base world.
- The editor saves hand edits in `assets/world/source/edits.json`.
- The script applies that file every time it runs, so a rebuild never loses hand work, and the
  banks, cliffs, collision and tests stay automatic.

The remaining builds follow the same rule, each with its own spec: **terrain** (a brush for
ground and water), **paths** (drawn footpaths), **bigger map** (more land; the hardest, because
saves, fog and regions move). Rivers, regions and hills from build 1's list fold into terrain
and bigger map.

## Scope

In:

- A sharp close-up view of the real tiles and sprites.
- An Objects mode: select, move, delete, place, and box-select.
- `edits.json`, read by `build-map.py` and by the editor.
- Warnings, and stale-edit cleanup.

Out:

- A scatter brush (many objects in one stroke), rotating or resizing a sprite, and editing
  `objects.json` (footprints, origins).
- Automatic clearing: placing a house in a forest does not remove the trees under it. The
  person deletes them.
- Path pieces, hill stairs and water ripples. They are drawn but locked; they belong to the
  paths, terrain and bigger-map builds.
- Signposts and the sprites that `places.json` places (a landmark's `object`). They are locked
  here and edited in Places mode.
- A faster rebuild. It stays about 40 seconds.

## The edits file

`assets/world/source/edits.json`, in world units, whole numbers:

```json
{
  "removed": [
    { "name": "pine", "x": 14112, "y": 4630 }
  ],
  "added": [
    { "name": "big-oak", "x": 14400, "y": 9100 }
  ]
}
```

- `removed` names objects the script generated. An object is identified by its sprite name and
  position. That is stable: each scatter square has its own random seed, so the same inputs
  give the same object at the same spot.
- `added` lists hand-placed objects.
- Moving a generated object is one `removed` plus one `added`. Moving or deleting a hand-placed
  object only changes `added`.
- The file is written one object per line, sorted by `y`, then `x`, then `name`, so a git diff
  shows only the lines that changed. An empty file is `{ "removed": [], "added": [] }`.
- The file is committed with both lists empty, so the map is unchanged until the first edit.

Which sprites may appear in the file ("editable sprites"): every entry of `objects.json`
except those with `path: true`, the three `<kit>-stairs`, the ripples (`sea-wave`,
`river-ripple`, `lake-ripple`) and `signpost`. An object the script placed for a landmark's
`object` is also locked; the editor knows them because they stand at the fixed offset north of
a landmark in `places.json`.

## `build-map.py`

One new step, after the script has built its full list of objects and before it writes the map
and draws the overview:

1. Read `edits.json` (missing file means no edits).
2. Drop every generated object whose `(name, x, y)` is in `removed`.
3. Append every `added` object.
4. Print one line: how many were removed, how many were added, and each `removed` entry that
   matched nothing ("stale").

Path pieces keep coming last, so they stay the only rotated objects. The script fails with a
clear message, not a traceback, if the file is not valid or names a sprite that is not
editable.

Nothing else in the script reads the edits: the scatter, detail, pebble, berry, stick, find and
footpath passes run exactly as before. That is the "no automatic clearing" rule, and it also
means an edit can never reshuffle the rest of the map.

## What this does in the game

No game code changes. The game already builds everything from the map's `objects` layer:

- A solid base comes from the sprite's `footprint` in `objects.json`.
- A tree or rock named in `HARVEST`, and a patch named in `WILD` (flowers, driftwood, small
  stones, berries, sticks, the finds), becomes a node the player can gather, with the id
  `<name>-<x>-<y>`.
- So a hand-placed pine can be chopped, and a hand-placed berry bush can be picked.

One effect on saves: a node's id contains its position, so a moved tree is a new tree. If the
player had chopped it, it stands again at once. `restoreGame` already drops timers for ids the
map no longer has, so nothing breaks.

## The sharp view

Today the editor draws `overview.webp`, about 18 world units per pixel. Picking one tree needs
the real picture.

- From a zoom of 0.2 screen pixels per world unit, the view draws the map's tile layers from
  `tileset.png` in the map's own layer order, and the object sprites on top. Below that zoom it
  draws the overview as now. The maximum zoom rises from 1 to 2.
- Tiles are drawn once per **chunk** of 16×16 tiles into an offscreen canvas at 32 pixels per
  tile, and the chunk canvases are reused while panning. At most 64 chunks are kept; the least
  recently used is dropped.
- Sprites are loaded from `assets/world/source/objects/<kind>/<name>.png` (the still picture of
  an animated sprite is its first frame, already saved there). Each is drawn at its `origin`
  and `scale` from `objects.json`. `flat` objects and path pieces are drawn first, then the
  rest sorted by `y`, the same order the game uses. Path pieces are drawn rotated.
- Only objects in the visible area are drawn. They are bucketed in a grid of 512-unit squares
  when the map loads and after every edit.
- Supplies and old boats are not in the map's object layer; they stay as build 1's markers.

## Objects mode

The toolbar gets two mode buttons, **Places** and **Objects**. Places mode is build 1,
unchanged, except that it now has the sharp view too. In Objects mode the place markers are
drawn small and can't be picked.

- **Select:** click a sprite. The topmost sprite whose drawn rectangle contains the pointer
  wins, tested on the picture's alpha so a click through the gap between two branches reaches
  the tree behind. A locked object can't be selected; hovering one shows why in the status
  line.
- **Move:** drag a selected object. Positions are whole numbers. Arrow keys nudge by 8, or 1
  with Shift.
- **Delete:** the Delete key or a button.
- **Place:** a palette in the side panel lists the editable sprites, grouped by `kind`, each
  with a thumbnail and its name. Clicking one arms it; each click on the map then places one,
  and the sprite follows the pointer as a faint ghost. Escape or the same palette entry
  disarms it.
- **Box select:** Shift+drag on the map draws a rectangle and selects every editable object
  whose origin is inside. Delete, nudge and drag then act on all of them.
- **Undo and redo** cover object edits and place edits in one history.

How an edit shows before a rebuild: the editor applies `edits.json` on top of the map it
loaded. A removed object is not drawn. A hand-placed object is drawn with a thin outline, so it
is clear which things are yours. After a rebuild the map already contains them, and the editor
recognises them by matching `added`, so they keep the outline and stay "yours".

The side panel shows, for the selection: the sprite name, `x` and `y` (editable for a single
object), whether it is generated or hand-placed, and whether it is solid, harvestable or
gatherable (read from `objects.json`, `HARVEST` and `WILD`).

## Warnings

Checked against the last built map, like build 1's position warnings. None of them blocks
Save.

- A hand-placed solid object stands on water, on a cliff wall or edge, or on stairs.
- A hand-placed solid object's base overlaps a path piece.
- A hand-placed solid object is within 150 units of a place (the distance the script keeps
  scenery from places).
- A `removed` entry matches no object in the map ("stale edit"). The panel offers one button
  that removes all stale entries from the file.

Errors (Save is refused): an entry with a sprite that is not editable, a position outside the
world, or two `added` entries with the same name and position.

The real judge is still Rebuild, which runs the world tests: a landmark walled in by placed
rocks fails `places.test.js`, and a rock dropped on a footpath fails `map.test.js`.

## Server

The plugin in `tools/editor-server.js` gains `GET` and `POST /__editor/edits`, the same shape
and rules as the places endpoints: a hash, 409 on a conflict, a shape check before writing,
the file's own layout and line endings. Save sends whichever of the two files changed; if both
did, places first. The "out of date" note now compares the hash of both files with what the
map was last built from.

## Files

| File | Change |
| --- | --- |
| `assets/world/source/edits.json` | New, both lists empty. |
| `tools/build-map.py` | The apply step. |
| `src/editor/edits.js` | New, pure: the edits being made (`removeObject`, `addObject`, `moveObject`), `applyEdits(mapObjects, edits)`, `checkEdits`, `shapeErrors`, `writeEdits`, stale entries. |
| `src/editor/model.js` | The undo history holds places and edits together. |
| `src/editor/tiles.js` | New: chunk canvases for the tile layers. |
| `src/editor/sprites.js` | New: loads sprite pictures, draws one, alpha hit test, the object buckets. |
| `src/editor/view.js` | Uses `tiles.js` and `sprites.js`; modes; box select; the ghost. |
| `src/editor/palette.js` | New: the sprite palette. |
| `src/editor/panel.js`, `main.js`, `api.js`, `editor.css`, `editor.html` | Mode buttons, the object form, the edits endpoints. |
| `tools/editor-server.js` | The edits endpoints. |
| `tests/editor/edits.test.js` | New. |
| `tests/world/edits.test.js` | New: the built map agrees with `edits.json`. |
| `CLAUDE.md`, `docs/verification.md` | Docs. |

`edits.js` follows the pure-module rules and joins the boundary test's list.

## Testing

Node tests for `edits.js`:

- Removing a generated object adds one `removed` entry; removing a hand-placed one deletes its
  `added` entry and adds nothing to `removed`.
- Moving a generated object gives one `removed` and one `added`; moving it back to its first
  spot leaves both lists empty.
- `applyEdits` hides removed objects, appends added ones and reports stale entries.
- `checkEdits` reports each error and warning above.
- `writeEdits` sorts, writes one object per line, and round-trips.
- Locked sprites are refused.

A world test: every `added` entry is in the built map's object layer and no `removed` entry
is, so a forgotten rebuild after editing the file by hand is caught by `npm test`.

For `build-map.py`: run it with an empty edits file and check the map file is byte-for-byte
what it was; then with one removed and one added object and check exactly those two differ.

In the browser (noted in `docs/verification.md`): the sharp view at several zooms and while
panning; select, move, delete, place, box-select and undo; a save that changes only the
expected lines of `edits.json`; a rebuild after which the object is where it was put; in the
game, walking to a hand-placed pine and chopping it, and walking through the spot of a deleted
tree.

`npm test`, `npm run build` and `npm run format:check` must pass.
