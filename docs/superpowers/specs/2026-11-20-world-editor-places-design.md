# World editor, build 1: places

Date: 2026-11-20
Status: design approved, not built

## Why

The map file `assets/world/map/wildhaven.json` is the output of `tools/build-map.py`. Opening it
in Tiled is slow (448×320 tiles, 5 MB), and anything changed there is lost the next time the
script runs. The things a person actually wants to change by hand, the positions in
`assets/world/source/places.json`, can only be edited as numbers in a text file.

We are building our own editor. It edits the **inputs** of `build-map.py`; the script keeps
making the tiles, banks, cliffs, footpaths and scattered scenery. Nobody paints 143,000 tiles.

## The whole editor, in four builds

Each build gets its own spec and plan. All of them share one editor page.

1. **Places** (this spec): the editor page, and editing `places.json`.
2. **Rivers and water**: rivers, fords, bridges, the dry riverbed and the lagoon islets. These
   lists move out of `build-map.py` into a JSON file first.
3. **Regions**: painting which region each part of the land is in (`LAYOUT`, now an 8×8 grid of
   letters).
4. **Hills**: placing and removing hills by hand instead of by random seed.

Builds 2 to 4 are not designed here.

## Build 1 scope

In:

- A dev-only editor page at `http://127.0.0.1:5173/editor.html`.
- Moving every place in `places.json`: spawns, supplies, landmarks, signposts (`waypoints`) and
  old boats (`wrecks`, with their `launch` point).
- Adding, deleting and renaming landmarks, signposts and old boats, and setting a landmark's
  `pool` and `object`.
- Saving `places.json`, and running `build-map.py` plus the world tests from the page.
- Letting a save survive a deleted place (see "Saves and deleted places").

Out:

- Terrain, rivers, regions, hills and scenery.
- A sharp close-up view of the tiles. The page shows `overview.webp`, which is about 18 world
  units per pixel. That is enough here because the smallest radius that matters is 110 units.
- Adding, deleting or renaming spawns and supplies. Their ids are keys in code (`CHARACTERS`,
  `SUPPLIES`, the villagers' `needs`), so the editor only moves them.
- Editing the `regions` list.

## How it runs

The editor is a second page of the same Vite project, so it can import the game's own pure
modules (`world/map.js`, `world/regions.js`, `data/places.js`, `data/balance.js`) and show the
same answers the game would give.

A small Vite plugin adds three endpoints. It is registered with `apply: 'serve'`, so it exists
only in `npm run dev`. `npm run build` keeps `index.html` as its only entry, so `editor.html`
is never in `dist/`.

| Endpoint | What it does |
| --- | --- |
| `GET /__editor/places` | Returns the text of `places.json` and a hash of it. |
| `POST /__editor/places` | Body: the new places object and the hash the page loaded. Checks the shape, refuses with 409 if the file's hash on disk is different, otherwise writes the file and returns the new hash. |
| `POST /__editor/rebuild` | Runs `python tools/build-map.py`, then `node --test tests/world/places.test.js tests/world/sea.test.js tests/world/map.test.js`. Streams the output as text lines and ends with one line saying pass or fail. Only one run at a time; a second request gets 409. |

Safety: the file path and both commands are fixed in the plugin; nothing from the request
reaches a path or a command line. The dev server listens on `127.0.0.1` only (the `dev`
script's host).

## Files

| File | Role | Node test? |
| --- | --- | --- |
| `editor.html` | The page: a canvas, a side panel, a toolbar. | no |
| `src/editor/model.js` | Pure. Holds the places being edited and the undo history. `movePlace`, `addPlace`, `deletePlace`, `setField`, `undo`, `redo`, `checkPlaces`, `writePlaces`. No DOM. | yes |
| `src/editor/view.js` | The canvas: pan, zoom, the overview picture, overlays, markers, hit testing, dragging. | no |
| `src/editor/panel.js` | The side panel: searchable list, the selected place's form, the warnings list, the rebuild log. | no |
| `src/editor/api.js` | `fetch` calls to the three endpoints. | no |
| `src/editor/main.js` | Wires model, view, panel and api together; keyboard shortcuts. | no |
| `src/editor/editor.css` | The editor's own styles. It does not import the game's `style.css`. | no |
| `tools/editor-server.js` | The Vite plugin with the three endpoints. | no |
| `vite.config.js` | New. Registers the plugin. | no |
| `tests/editor/model.test.js` | Tests for `model.js`. | - |

`src/editor/` is a browser layer like `src/ui/`. `model.js` follows the pure-module rules
(no DOM words, JSON imported `with { type: 'json' }`) so it runs in Node, and
`tests/boundaries.test.js` gains `editor/model.js` in its pure list. The code-style rules
(Prettier, a comment above every named function, file headers) apply to all of it.

## The page

**Map.** Mouse wheel zooms at the pointer; dragging empty map pans. The overview picture is
drawn scaled, with image smoothing on.

**Overlays** (toolbar toggles):

- Region borders, from the map's region grid.
- Blocked ground: a tint over spots where `isWalkable` is false, sampled on a coarse grid for
  the part of the map on screen and only when zoomed in enough for it to mean something.

**Markers.** One per place, coloured by kind (spawn, supply, landmark, signpost, old boat). An
old boat also has a smaller `launch` marker joined to it by a line. The selected place shows
its discovery radius (`LANDMARK_RADIUS` or `WAYPOINT_RADIUS` from `balance.js`) and the
150-unit ring `build-map.py` keeps clear of scenery.

**Editing.**

- Click a marker or a list row to select it. Drag a marker to move it; positions are whole
  numbers. Arrow keys nudge the selection by 8 units (1 with Shift).
- Add: pick landmark, signpost or old boat in the toolbar, then click the map. The new place
  gets the region under the click, a free id that starts the way that region's other places of the same kind
  start (`p-new-1`, `p-wp-new-1`; an old boat gets `wreck-new-1`) and a placeholder name; a new old boat gets a `launch` point
  220 units north of it, to be dragged onto water.
- Delete: the Delete key or a button, with a confirm.
- The form edits `id`, `name`, `region` (a list of the seven), and for a landmark `pool` (a
  number or empty) and `object` (a list of the sprite names in `objects.json`, or none).
- Undo and redo: Ctrl+Z and Ctrl+Y. One drag is one step. The history lives in memory only.
- Leaving the page with unsaved changes asks first.

## Warnings

`checkPlaces` returns a list of `{ id, level, message }`. The panel lists them and the marker
gets a ring. It takes the lookups it needs (`isWalkable`, `isSailable`, `regionAt`, the journal
ids, the sprite names) as arguments, so the tests can pass simple fakes.

Errors (Save is refused while any stand):

- An id that is empty, repeated, or not lowercase letters, digits and dashes.
- A place outside the world.
- A region that is not one of the seven.
- An `object` that is not a sprite in `objects.json`.

Warnings (Save is allowed):

- The spot is not walkable on the current map.
- The spot is in a different region from the one the place names.
- An old boat's `launch` point is not sailable.
- A Pinefall landmark that `JOURNALS` names (trail or page) was deleted or renamed, or a
  Pinefall landmark has no journal page.

The position warnings read the **last built map**. `build-map.py` reshapes the land around
every place (water pushed back, scenery cleared, a pool dug), so a spot in a river today can be
dry after a rebuild. Once anything has moved since the last rebuild, the panel says the
position warnings are out of date. The real verdict is Rebuild.

## Save and Rebuild

**Save** sends the places and the loaded hash. `writePlaces` produces the same text shape the
file has today, so a git diff shows only the lines that changed: two-space indent, one object
per line for regions, landmarks, waypoints and wrecks, one supply per line, spawns on one
line, keys in their current order (`id`, `region`, `name`, `x`, `y`, then `pool`, `object`,
`launch`). A test writes the real `places.json` back and expects the identical text.

A 409 means the file changed on disk since it was loaded. The page says so and offers to
reload the file (dropping the page's edits) and does not overwrite.

**Rebuild** is enabled only when there is nothing unsaved. It shows the output as it arrives
and then pass or fail. When the run ends, pass or fail, the page reloads itself so the game
modules and the overview picture are the new ones (the map files were rewritten either way);
the log is kept across the reload and shown again. A fail leaves `places.json` as saved; the
log says which place the tests could not reach, and the person fixes it and rebuilds again.

While the editor's own save or rebuild is running, the dev server holds back Vite's automatic
page reload for files under `assets/world/`, so a save keeps the undo history and a rebuild's
log is not cut short.

If Python or the script fails to start, the log shows the error text and the run ends as a
fail; the page never waits forever.

## Saves and deleted places

Today `restoreGame` in `src/game/state.js` rejects a whole save when `landmarks`, `waypoints`
or `wrecks` holds an id the game no longer has. Deleting or renaming one place in the editor
would send every save that had found it to the "could not be read, start fresh" path.

Change: unknown ids in those three lists are dropped on load instead (the lists must still be
arrays of strings without repeats). And if `boat.from` names an old boat that no longer
exists, the boat is removed (`boat: null`, `aboard: false`), and a player who was aboard goes
to their character's spawn. The save's shape does not change, so `SAVE_VERSION` does not change.
Camp needs name regions, not places, so they need nothing.

## Tests that pin the number of places

`tests/world/places.test.js` and `tests/world/progress.test.js` expect exactly 52 landmarks, 14
signposts and 4 old boats. Adding or deleting one in the editor would fail every rebuild. They
change to rules that hold for any count: unique ids, a real region on every place, and at least
one landmark and one signpost in every region. `places.test.js` still names the three islet
landmarks by id; a new landmark on an islet waits for build 2.

Tests in `tests/game/saves.test.js` or `state.test.js`: a save with one unknown landmark id
loads with that id gone and the rest kept; a save whose boat came from an unknown old boat
loads on foot with no boat.

## Testing

Node tests for `model.js`:

- Moving, adding, deleting and editing change only the place they name.
- Undo and redo walk the history; a new edit after undo clears redo.
- A new place gets an id nothing else has.
- `checkPlaces` reports each error and warning above, and nothing for the real file.
- `writePlaces` round-trips the real `places.json` byte for byte.
- Spawns and supplies cannot be added, deleted or renamed.

In the browser (noted in `docs/verification.md`): open the editor, move a landmark, save, see
the one-line diff, rebuild, see the tests pass, open the game and find the landmark at its new
spot. Also: a save conflict (edit the file by hand, then Save), a failing rebuild (a signpost
dragged into deep sea), and that `npm run build` puts no editor file in `dist/`.

`npm test`, `npm run build` and `npm run format:check` must pass.

## Docs to update when built

`CLAUDE.md`: the commands list (the editor URL), the architecture table (`src/editor/`), and
the save model (unknown found ids are dropped).
