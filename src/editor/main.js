// The world editor's entry point (editor.html). It loads the places file, joins the model, the
// map view and the side panel together, and handles the keyboard. Every edit goes through the
// model, then `refresh` redraws everything from it.

import './editor.css';
import { regionOf } from '../world/regions.js';
import * as model from './model.js';
import { gameLookups } from './lookups.js';
import { loadPlaces, savePlaces, rebuild } from './api.js';
import { createView } from './view.js';
import { createPanel } from './panel.js';

/** Where the last rebuild's log is kept across the page reload that follows a rebuild. */
const LOG_KEY = 'wildhaven.editor.log';

/** How far the arrow keys nudge the selected place, in world units (Shift nudges by 1). */
const NUDGE = 8;

/** The game facts the checks read. They describe the map as it was last built. */
const world = gameLookups();

/** Everything the page knows: the editing session, the selection and a few flags. */
const app = {
  editor: null,
  hash: '',
  stale: false,
  selected: null,
  adding: null,
  busy: false,
  status: '',
  problems: [],
};

const view = createView(document.getElementById('map'), {
  // The places as they are being edited (nothing until the file has loaded).
  places: () => app.editor?.places,
  // The ref of the selected place, or null.
  selected: () => app.selected,
  // Which places have a problem, as 'kind:i' keys, so their markers get a ring.
  flagged: () => new Set(app.problems.map((p) => `${p.kind}:${p.i}`)),
  // The kind waiting for a click on the map, or null.
  adding: () => app.adding,
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
});

const panel = createPanel(document, {
  // A list row or a problem was clicked: select that place and bring it into view.
  pick: (ref) => {
    app.selected = ref;
    const place = model.getPlace(app.editor.places, ref);
    if (place) view.centerOn(place.x, place.y);
    refresh();
  },
  // A form field was changed.
  field: (name, value) => edit(() => model.setField(app.editor, app.selected, name, value)),
  // The x or y box was changed.
  move: (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y))
      edit(() => model.movePlace(app.editor, app.selected, x, y));
  },
  remove: removeSelected,
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
  save,
  rebuild: runRebuild,
  // An overlay checkbox was ticked or cleared.
  overlay: (name, shown) => view.setOverlay(name, shown),
});

/**
 * Runs one edit on the model and redraws, showing the reason if the model refuses it.
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

/** Re-runs the checks and redraws the panel and the map from the model. */
function refresh() {
  const { places } = app.editor;

  // An undo or a delete can leave the selection pointing at a place that is gone.
  if (app.selected && !model.getPlace(places, app.selected)) app.selected = null;
  app.problems = model.checkPlaces(places, world);
  const dirty = model.isDirty(app.editor);

  panel.render({
    rows: model.listPlaces(places),
    selected: app.selected,
    place: app.selected && model.getPlace(places, app.selected),
    regions: places.regions,
    sprites: world.sprites,
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

/** Reads the places file from disk and starts a fresh editing session on it. */
async function load() {
  const { text, hash, stale } = await loadPlaces();
  Object.assign(app, { editor: model.createEditor(JSON.parse(text)), hash, stale, selected: null });
  refresh();
}

/** Saves the places, or offers to reload when the file changed on disk in the meantime. */
async function save() {
  try {
    const result = await savePlaces(app.editor.places, app.hash);

    if (!result.ok) {
      const reload = confirm(
        'places.json changed on disk since this page loaded it, so it was not overwritten.\n\n' +
          'Reload it and drop the edits on this page?',
      );
      if (reload) await load();
      return;
    }

    model.markSaved(app.editor);
    Object.assign(app, { hash: result.hash, stale: result.stale, status: 'Saved.' });
  } catch (error) {
    app.status = error.message;
  }
  refresh();
}

/**
 * Runs the map build and the world tests, then reloads the page.
 *
 * The reload brings in the freshly built map, so the picture and the warnings are up to date.
 * The log is kept in session storage first, so it is still there to read after the reload.
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
  } catch {
    // Storage can be blocked; the log is then lost on reload, which is only a nuisance.
  }
  location.reload();
}

/** Shows the log of the rebuild that ran just before this page load, if there was one. */
function showLastLog() {
  try {
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
    app.adding = null;
    app.status = '';
    return refresh();
  }
  if (key === 'delete') return removeSelected();

  const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
  const place = app.selected && model.getPlace(app.editor.places, app.selected);
  if (step && place) {
    event.preventDefault();
    const by = event.shiftKey ? 1 : NUDGE;
    edit(() =>
      model.movePlace(app.editor, app.selected, place.x + step[0] * by, place.y + step[1] * by),
    );
  }
});

// Leaving with unsaved edits asks first.
addEventListener('beforeunload', (event) => {
  if (app.editor && model.isDirty(app.editor) && !app.busy) event.preventDefault();
});

showLastLog();
load().catch((error) => {
  document.getElementById('status').textContent = error.message;
});
