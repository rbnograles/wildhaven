// The world editor's entry point (editor.html). It loads the places file and the edits file,
// joins the model, the map view and the side panel together, and handles the keyboard. Every
// edit goes through the model or the edits module, then `refresh` redraws everything.

import './editor.css';
import { MAP_OBJECTS } from '../world/map.js';
import { regionOf } from '../world/regions.js';
import * as model from './model.js';
import * as edits from './edits.js';
import { gameLookups, objectLookups } from './lookups.js';
import { loadFile, saveFile, rebuild } from './api.js';
import { createView } from './view.js';
import { createPanel } from './panel.js';

/** Where the last rebuild's log is kept across the page reload that follows a rebuild. */
const LOG_KEY = 'wildhaven.editor.log';

/** Where the mode is kept across that reload, so a rebuild doesn't drop back to Places. */
const MODE_KEY = 'wildhaven.editor.mode';

/** How far the arrow keys nudge the selection, in world units (Shift nudges by 1). */
const NUDGE = 8;

/** The zoom the view goes to when a problem about an object is clicked. */
const LOOK_ZOOM = 0.6;

/** The game facts the checks read. They describe the map as it was last built. */
const world = gameLookups();
const objectWorld = objectLookups();

/** Everything the page knows: the editing session, the selections and a few flags. */
const app = {
  editor: null,
  hash: { places: '', edits: '' },
  stale: false,
  mode: 'places',
  selected: null,
  adding: null,
  base: [],
  chosen: [],
  armed: null,
  staleEdits: [],
  busy: false,
  status: '',
  problems: [],
};

/** Says whether two objects are the same one: sprite, spot, and whose it is. */
const sameObject = (a, b) => a.name === b.name && a.x === b.x && a.y === b.y && a.own === b.own;

/**
 * Says why an object can't be edited, if it can't.
 *
 * @param {object} obj - The object.
 * @returns {string|null} The reason, or null when it is editable.
 */
function lockedWhy(obj) {
  return (
    edits.lockReason(obj.name, objectWorld.specs) ?? edits.landmarkLock(obj, app.editor.places)
  );
}

const view = createView(document.getElementById('map'), {
  specs: objectWorld.specs,
  // The places as they are being edited (nothing until the file has loaded).
  places: () => app.editor?.places,
  // The ref of the selected place, or null.
  selected: () => app.selected,
  // Which places have a problem, as 'kind:i' keys, so their markers get a ring.
  flagged: () => new Set(app.problems.map((p) => `${p.kind}:${p.i}`)),
  // The kind of place waiting for a click on the map, or null.
  adding: () => app.adding,
  // 'places' or 'objects'.
  mode: () => app.mode,
  // The selected objects.
  objectSelection: () => app.chosen,
  // The sprite waiting to be placed, or null.
  armed: () => app.armed,
  lockedWhy,
  // A marker (or empty map, with null) was clicked.
  select: (ref) => {
    app.selected = ref;
    refresh();
  },
  // A marker is being dragged; only the first move of a drag is an undo step.
  move: (ref, x, y, first) => {
    model.movePlace(app.editor, ref, x, y, first);
    refresh();
  },
  // The map was clicked while an add button was on: make the place there.
  add: (x, y) => {
    const region = app.editor.places.regions.find((r) => r.id === regionOf(x, y).id);
    app.selected = model.addPlace(app.editor, app.adding, x, y, region);
    app.adding = null;
    app.status = '';
    refresh();
  },
  // Objects were clicked or boxed (an empty list clears the selection).
  selectObjects: (list) => {
    app.chosen = list;
    app.status = '';
    refresh();
  },
  // The selected objects are being dragged; only the first move of a drag is an undo step.
  moveObjects: (dx, dy, first) => {
    app.chosen = edits.moveObjects(app.editor, app.chosen, dx, dy, first);
    refresh();
  },
  // The map was clicked while a sprite was armed: place one there and stay armed.
  placeObject: (x, y) => {
    app.chosen = [edits.addObject(app.editor, app.armed, x, y)];
    refresh();
  },
  // The view has something to say in the status line (a locked object, "zoom in").
  hint: (text) => {
    app.status = text;
    refresh();
  },
});

const panel = createPanel(document, {
  specs: objectWorld.specs,
  // A list row or a problem was clicked: select that place and bring it into view.
  pick: (ref) => {
    app.mode = 'places';
    app.selected = ref;
    const place = model.getPlace(app.editor.places, ref);
    if (place) view.centerOn(place.x, place.y);
    refresh();
  },
  // A problem about an object was clicked: go to objects mode and look at it up close.
  pickObject: (obj) => {
    app.mode = 'objects';
    app.chosen = [{ ...obj, rotation: 0, own: true }];
    view.centerOn(obj.x, obj.y, LOOK_ZOOM);
    refresh();
  },
  // A form field was changed.
  field: (name, value) => edit(() => model.setField(app.editor, app.selected, name, value)),
  // The x or y box of a place was changed.
  move: (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y))
      edit(() => model.movePlace(app.editor, app.selected, x, y));
  },
  // The x or y box of an object was changed.
  objectMove: (x, y) => {
    const [obj] = app.chosen;
    if (obj && Number.isFinite(x) && Number.isFinite(y))
      edit(() => {
        app.chosen = edits.moveObjects(app.editor, app.chosen, x - obj.x, y - obj.y);
      });
  },
  remove: removeSelected,
  removeObjects: removeChosen,
  // The cleanup button: forget removals that match nothing on the map.
  dropStale: () => edit(() => edits.dropStale(app.editor, app.staleEdits)),
  // Steps back one edit.
  undo: () => model.undo(app.editor) && refresh(),
  // Steps forward again after an undo.
  redo: () => model.redo(app.editor) && refresh(),
  // An add button was pressed: switch on waiting for a click on the map, or off again.
  add: (kind) => {
    app.adding = app.adding === kind ? null : kind;
    app.status = app.adding ? 'Click the map to place it.' : '';
    refresh();
  },
  // A mode button was pressed.
  mode: (name) => {
    Object.assign(app, { mode: name, adding: null, armed: null, status: '' });
    refresh();
  },
  // A palette sprite was clicked: arm it, or disarm it if it was armed already.
  armSprite: (name) => {
    app.armed = app.armed === name ? null : name;
    app.chosen = [];
    refresh();
  },
  save,
  rebuild: runRebuild,
  // An overlay checkbox was ticked or cleared.
  overlay: (name, shown) => view.setOverlay(name, shown),
});

/**
 * Runs one edit and redraws, showing the reason if it is refused.
 *
 * @param {Function} change - The edit to run.
 */
function edit(change) {
  try {
    change();
    app.status = '';
  } catch (error) {
    app.status = error.message;
  }
  refresh();
}

/** Deletes the selected place after asking, if it is a kind that can be deleted. */
function removeSelected() {
  const place = app.selected && model.getPlace(app.editor.places, app.selected);
  if (!place || ['spawn', 'supply', 'launch'].includes(place.kind)) return;
  if (!confirm(`Delete "${place.name}"?`)) return;

  edit(() => model.deletePlace(app.editor, app.selected));
}

/** Deletes the selected objects. No question is asked: undo brings them back. */
function removeChosen() {
  if (!app.chosen.length) return;
  edit(() => {
    edits.removeObjects(app.editor, app.chosen);
    app.chosen = [];
  });
}

/** Says whether anything differs from what is on disk. */
const isDirty = () => model.isDirty(app.editor) || edits.isEditsDirty(app.editor);

/** Re-runs the checks and redraws the panel and the map from the model. */
function refresh() {
  const { places } = app.editor;

  // Lay the edits over the generated objects: this is what the map will hold after a rebuild.
  const applied = edits.applyEdits(app.base, app.editor.edits);
  app.staleEdits = applied.stale;
  view.setObjects(applied.objects);

  // An undo or a delete can leave a selection pointing at something that is gone.
  if (app.selected && !model.getPlace(places, app.selected)) app.selected = null;
  app.chosen = app.chosen.filter((c) => applied.objects.some((o) => sameObject(o, c)));

  app.problems = [
    ...model.checkPlaces(places, world),
    ...edits.checkEdits(app.editor.edits, { ...objectWorld, places, stale: applied.stale }),
  ];
  const dirty = isDirty();

  panel.render({
    mode: app.mode,
    rows: model.listPlaces(places),
    selected: app.selected,
    place: app.selected && model.getPlace(places, app.selected),
    regions: places.regions,
    sprites: world.sprites,
    objects: app.chosen,
    armed: app.armed,
    tags: objectWorld.tags,
    staleEdits: applied.stale.length > 0,
    problems: app.problems,
    dirty,
    stale: app.stale || dirty,
    canUndo: app.editor.past.length > 0,
    canRedo: app.editor.future.length > 0,
    adding: app.adding,
    busy: app.busy,
    status: app.status || (dirty ? 'Unsaved changes' : ''),
  });
  view.draw();
}

/** Reads both files from disk and starts a fresh editing session on them. */
async function load() {
  const [places, objects] = await Promise.all([loadFile('places'), loadFile('edits')]);
  const built = JSON.parse(objects.text);

  const editor = model.createEditor(JSON.parse(places.text));
  edits.loadEdits(editor, built);

  Object.assign(app, {
    editor,
    hash: { places: places.hash, edits: objects.hash },
    stale: places.stale,
    base: edits.baseObjects(MAP_OBJECTS, built, objectWorld.builtStale),
    selected: null,
    chosen: [],
  });
  refresh();
}

/**
 * Saves one file if it changed.
 *
 * @param {string} name - 'places' or 'edits'.
 * @returns {Promise<boolean>} False when the file changed on disk, so nothing was written.
 */
async function saveOne(name) {
  const places = name === 'places';
  if (!(places ? model.isDirty(app.editor) : edits.isEditsDirty(app.editor))) return true;

  const data = places ? app.editor.places : app.editor.edits;
  const result = await saveFile(name, data, app.hash[name]);
  if (!result.ok) return false;

  if (places) model.markSaved(app.editor);
  else edits.markEditsSaved(app.editor);
  app.hash[name] = result.hash;
  app.stale = result.stale;
  return true;
}

/** Saves what changed, or offers to reload when a file changed on disk in the meantime. */
async function save() {
  try {
    const ok = (await saveOne('places')) && (await saveOne('edits'));

    if (!ok) {
      const reload = confirm(
        'A file changed on disk since this page loaded it, so it was not overwritten.\n\n' +
          'Reload from disk and drop the unsaved edits on this page?',
      );
      if (reload) await load();
      return;
    }
    app.status = 'Saved.';
  } catch (error) {
    app.status = error.message;
  }
  refresh();
}

/**
 * Runs the map build and the world tests, then reloads the page.
 *
 * The reload brings in the freshly built map, so the picture and the warnings are up to date.
 * The log and the mode are kept in session storage first, so they survive the reload.
 */
async function runRebuild() {
  app.busy = true;
  app.status = 'Rebuilding the map. This takes a while.';
  panel.setLog('');
  refresh();

  let text = '';
  const pass = await rebuild((piece) => {
    text += piece;
    panel.log(piece);
  }).catch((error) => {
    text += `\nThe rebuild stopped: ${error.message}\n`;
    return false;
  });

  try {
    sessionStorage.setItem(LOG_KEY, `${pass ? 'PASSED' : 'FAILED'}\n${text}`);
    sessionStorage.setItem(MODE_KEY, app.mode);
  } catch {
    // Storage can be blocked; the log is then lost on reload, which is only a nuisance.
  }
  location.reload();
}

/** Brings back the mode and the log of the rebuild that ran just before this page load. */
function restoreSession() {
  try {
    if (sessionStorage.getItem(MODE_KEY) === 'objects') app.mode = 'objects';
    sessionStorage.removeItem(MODE_KEY);

    const text = sessionStorage.getItem(LOG_KEY);
    if (!text) return;
    sessionStorage.removeItem(LOG_KEY);
    panel.setLog(text);
    app.status = text.startsWith('PASSED') ? 'Rebuild passed.' : 'Rebuild FAILED: see the log.';
  } catch {
    // No storage, no log.
  }
}

addEventListener('keydown', (event) => {
  // Keys typed into a box belong to the box.
  if (event.target.closest?.('input, select, textarea') || app.busy || !app.editor) return;

  const key = event.key.toLowerCase();
  if (event.ctrlKey && key === 'z') return model.undo(app.editor) && refresh();
  if (event.ctrlKey && key === 'y') return model.redo(app.editor) && refresh();
  if (key === 'escape') {
    Object.assign(app, { adding: null, armed: null, status: '' });
    return refresh();
  }
  if (key === 'delete') return app.mode === 'objects' ? removeChosen() : removeSelected();

  const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
  if (!step) return;
  const by = event.shiftKey ? 1 : NUDGE;

  if (app.mode === 'objects' && app.chosen.length) {
    event.preventDefault();
    edit(() => {
      app.chosen = edits.moveObjects(app.editor, app.chosen, step[0] * by, step[1] * by);
    });
    return;
  }

  const place =
    app.mode === 'places' && app.selected && model.getPlace(app.editor.places, app.selected);
  if (place) {
    event.preventDefault();
    edit(() =>
      model.movePlace(app.editor, app.selected, place.x + step[0] * by, place.y + step[1] * by),
    );
  }
});

// Leaving with unsaved edits asks first.
addEventListener('beforeunload', (event) => {
  if (app.editor && isDirty() && !app.busy) event.preventDefault();
});

restoreSession();
load().catch((error) => {
  document.getElementById('status').textContent = error.message;
});
