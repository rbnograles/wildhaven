// The world editor's model: the places being edited, the undo history, the checks that warn
// about a bad spot, and the writer that turns the places back into the text of places.json.
// It knows nothing about the page or the canvas, so the tests can run it in Node.

/** The kinds of place the file holds. A launch point is not a kind: it belongs to an old boat. */
export const KINDS = ['spawn', 'supply', 'landmark', 'waypoint', 'wreck'];

/** Which table of the places file holds each kind. */
const TABLES = {
  spawn: 'spawns',
  supply: 'supplies',
  landmark: 'landmarks',
  waypoint: 'waypoints',
  wreck: 'wrecks',
};

/**
 * Kinds kept as `{ id: [x, y] }` tables. Game code names their ids (characters, supplies,
 * villagers), so the editor may move them but never adds, deletes or renames them.
 */
const FIXED = ['spawn', 'supply'];

/** The order a place's keys are written in, the same as the file has always used. */
const KEY_ORDER = ['id', 'region', 'name', 'x', 'y', 'pool', 'object', 'launch'];

/** What a valid id looks like: lowercase words of letters and digits, joined by single dashes. */
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The keys each kind of listed place may have. Anything else is a typo or a stray field. */
const ALLOWED = {
  regions: ['id', 'key', 'name'],
  landmarks: ['id', 'region', 'name', 'x', 'y', 'pool', 'object'],
  waypoints: ['id', 'region', 'name', 'x', 'y'],
  wrecks: ['id', 'region', 'name', 'x', 'y', 'launch'],
};

/** The fields the form may change, by kind. */
const FIELDS = {
  landmark: ['id', 'name', 'region', 'pool', 'object'],
  waypoint: ['id', 'name', 'region'],
  wreck: ['id', 'name', 'region'],
};

/** The name a new place starts with, until the person types a real one. */
const NEW_NAMES = { landmark: 'New place', waypoint: 'New signpost', wreck: 'New rowboat' };

/** How far north of a new old boat its launch point starts, to be dragged onto water. */
const LAUNCH_OFFSET = 220;

/** How many undo steps are remembered before the oldest is forgotten. */
const HISTORY = 200;

/** Makes a deep copy, so two copies never share a nested list or object. */
const copy = (value) => structuredClone(value);

/**
 * Starts an editing session on a places file.
 *
 * Like photocopying a form before writing on it: the editor scribbles on its own copy, keeps a
 * pile of earlier copies for undo, and remembers the text that was last saved.
 *
 * @param {object} places - The parsed places file.
 * @returns {object} The session: `places`, `edits` (the hand edits to the map's objects, filled in
 *   by `loadEdits` in edits.js), `past` and `future` (undo steps, each `{places, edits}`), and the
 *   saved text of each file.
 */
export function createEditor(places) {
  return {
    places: copy(places),
    edits: { removed: [], added: [] },
    past: [],
    future: [],
    saved: writePlaces(places),
    savedEdits: '',
  };
}

/**
 * Looks up one place and gives it in a single shape, whatever table it lives in.
 *
 * @param {object} places - The places being edited.
 * @param {{kind: string, i: number}} ref - Which place.
 * @returns {object|undefined} `{kind, i, id, name, x, y, ...}`, or undefined if there is none.
 */
export function getPlace(places, { kind, i }) {
  if (kind === 'launch') {
    const boat = places.wrecks[i];
    return (
      boat && {
        kind,
        i,
        id: boat.id,
        name: `${boat.name} (launch)`,
        x: boat.launch[0],
        y: boat.launch[1],
      }
    );
  }

  if (FIXED.includes(kind)) {
    const entry = Object.entries(places[TABLES[kind]])[i];
    return entry && { kind, i, id: entry[0], name: entry[0], x: entry[1][0], y: entry[1][1] };
  }

  const place = places[TABLES[kind]]?.[i];
  return place && { kind, i, ...copy(place) };
}

/**
 * Lists every place in the file, in the file's order. Launch points are left out.
 *
 * @param {object} places - The places being edited.
 * @returns {object[]} One `getPlace` result per place.
 */
export function listPlaces(places) {
  return KINDS.flatMap((kind) => {
    const table = places[TABLES[kind]];
    const count = FIXED.includes(kind) ? Object.keys(table).length : table.length;
    return Array.from({ length: count }, (_, i) => getPlace(places, { kind, i }));
  });
}

/**
 * Puts the places and the object edits as they are now on the undo pile, before an edit changes
 * them. edits.js calls this too, so both kinds of edit share one history.
 *
 * @param {object} editor - The editing session.
 */
export function remember(editor) {
  editor.past.push(copy({ places: editor.places, edits: editor.edits }));
  if (editor.past.length > HISTORY) editor.past.shift();
  editor.future = [];
}

/**
 * Moves one place to a new spot.
 *
 * Positions are rounded to whole numbers, like the file has always held. Moving an old boat
 * moves its launch point by the same amount, so the two stay together.
 *
 * @param {object} editor - The editing session.
 * @param {{kind: string, i: number}} ref - Which place (or an old boat's launch point).
 * @param {number} x - The new x, in world units.
 * @param {number} y - The new y, in world units.
 * @param {boolean} [record] - False for the later moves of one drag, so the drag is one undo step.
 */
export function movePlace(editor, ref, x, y, record = true) {
  if (record) remember(editor);

  const { places } = editor;
  const at = [Math.round(x), Math.round(y)];

  if (ref.kind === 'launch') {
    places.wrecks[ref.i].launch = at;
  } else if (FIXED.includes(ref.kind)) {
    const table = places[TABLES[ref.kind]];
    table[Object.keys(table)[ref.i]] = at;
  } else {
    const place = places[TABLES[ref.kind]][ref.i];
    if (ref.kind === 'wreck')
      place.launch = [place.launch[0] + at[0] - place.x, place.launch[1] + at[1] - place.y];
    place.x = at[0];
    place.y = at[1];
  }
}

/**
 * Finds an id nobody uses yet: the stem with the first free number after it.
 *
 * @param {object} places - The places being edited.
 * @param {string} stem - The start of the id, such as 'p-new'.
 * @returns {string} For example 'p-new-1'.
 */
function freeId(places, stem) {
  const used = new Set(
    [...places.regions, ...places.landmarks, ...places.waypoints, ...places.wrecks].map(
      (p) => p.id,
    ),
  );
  let n = 1;
  while (used.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}

/**
 * Adds a new landmark, signpost or old boat.
 *
 * The id copies the style the region's other places use: the region's letter for a landmark
 * ('p-new-1'), the letter plus 'wp' for a signpost ('p-wp-new-1'), and 'wreck-new-1' for a boat.
 *
 * @param {object} editor - The editing session.
 * @param {string} kind - 'landmark', 'waypoint' or 'wreck'.
 * @param {number} x - Where it goes, in world units.
 * @param {number} y - Where it goes, in world units.
 * @param {{id: string, key: string}} region - The region under that spot, from `places.regions`.
 * @returns {{kind: string, i: number}} A ref to the new place.
 */
export function addPlace(editor, kind, x, y, region) {
  if (!FIELDS[kind]) throw new Error(`A ${kind} cannot be added in the editor`);
  remember(editor);

  const letter = region.key.toLowerCase();
  const stem =
    kind === 'wreck' ? 'wreck-new' : kind === 'waypoint' ? `${letter}-wp-new` : `${letter}-new`;
  const place = {
    id: freeId(editor.places, stem),
    region: region.id,
    name: NEW_NAMES[kind],
    x: Math.round(x),
    y: Math.round(y),
  };
  if (kind === 'wreck') place.launch = [place.x, place.y - LAUNCH_OFFSET];

  const table = editor.places[TABLES[kind]];
  table.push(place);
  return { kind, i: table.length - 1 };
}

/**
 * Deletes a landmark, signpost or old boat.
 *
 * @param {object} editor - The editing session.
 * @param {{kind: string, i: number}} ref - Which place.
 */
export function deletePlace(editor, ref) {
  if (!FIELDS[ref.kind]) throw new Error(`A ${ref.kind} cannot be deleted in the editor`);
  remember(editor);
  editor.places[TABLES[ref.kind]].splice(ref.i, 1);
}

/**
 * Rebuilds a place with its keys in the file's usual order, so a new field lands in its slot.
 *
 * @param {object} place - A landmark, signpost or old boat.
 * @returns {object} The same fields, in `KEY_ORDER`, then any others.
 */
function tidy(place) {
  const keys = [...KEY_ORDER, ...Object.keys(place)].filter((key) => key in place);
  return Object.fromEntries([...new Set(keys)].map((key) => [key, place[key]]));
}

/**
 * Changes one field of a landmark, signpost or old boat from the form.
 *
 * An emptied `pool` or `object` is removed from the place, because the file leaves those keys
 * out when a place has none. `pool` is stored as a number.
 *
 * @param {object} editor - The editing session.
 * @param {{kind: string, i: number}} ref - Which place.
 * @param {string} field - 'id', 'name', 'region', and for a landmark 'pool' or 'object'.
 * @param {string} value - What was typed or picked.
 */
export function setField(editor, ref, field, value) {
  if (!FIELDS[ref.kind]?.includes(field))
    throw new Error(`A ${ref.kind} has no "${field}" to edit`);
  remember(editor);

  const table = editor.places[TABLES[ref.kind]];
  const place = { ...table[ref.i] };

  if ((field === 'pool' || field === 'object') && String(value).trim() === '') delete place[field];
  else place[field] = field === 'pool' ? Number(value) : String(value);

  table[ref.i] = tidy(place);
}

/**
 * Steps back one edit.
 *
 * @param {object} editor - The editing session.
 * @returns {boolean} False when there was nothing to undo.
 */
export function undo(editor) {
  if (!editor.past.length) return false;
  editor.future.push({ places: editor.places, edits: editor.edits });
  ({ places: editor.places, edits: editor.edits } = editor.past.pop());
  return true;
}

/**
 * Steps forward again after an undo.
 *
 * @param {object} editor - The editing session.
 * @returns {boolean} False when there was nothing to redo.
 */
export function redo(editor) {
  if (!editor.future.length) return false;
  editor.past.push({ places: editor.places, edits: editor.edits });
  ({ places: editor.places, edits: editor.edits } = editor.future.pop());
  return true;
}

/** Says whether the places differ from the text that was last saved. */
export const isDirty = (editor) => writePlaces(editor.places) !== editor.saved;

/**
 * Notes that the places as they are now have been saved.
 *
 * @param {object} editor - The editing session.
 */
export function markSaved(editor) {
  editor.saved = writePlaces(editor.places);
}

/** Says whether a value is a pair of whole numbers, like [14348, 4148]. */
const isSpot = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isSafeInteger);

/** Says whether a value is a plain `{...}` object, not a list and not null. */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks that an object has the shape of the places file, before it is written to disk.
 *
 * This is the bouncer at the door: it doesn't judge whether a spot is a good one, only that
 * every table and field is the right kind of thing, so a broken request can't wreck the file.
 *
 * @param {*} places - What a request sent.
 * @returns {string[]} One message per thing that is wrong; empty when the shape is right.
 */
export function shapeErrors(places) {
  if (!isObject(places)) return ['The places must be an object'];
  const errors = [];

  for (const table of ['spawns', 'supplies']) {
    if (!isObject(places[table])) errors.push(`"${table}" must be an object`);
    else
      for (const [id, spot] of Object.entries(places[table]))
        if (!isSpot(spot)) errors.push(`${table}.${id} must be [x, y] in whole numbers`);
  }

  for (const [table, allowed] of Object.entries(ALLOWED)) {
    if (!Array.isArray(places[table])) {
      errors.push(`"${table}" must be a list`);
      continue;
    }

    places[table].forEach((p, i) => {
      const where = `${table}[${i}]`;
      if (!isObject(p)) return errors.push(`${where} must be an object`);

      const texts = table === 'regions' ? ['id', 'key', 'name'] : ['id', 'region', 'name'];
      const bad =
        Object.keys(p).find((key) => !allowed.includes(key)) ??
        texts.find((key) => typeof p[key] !== 'string') ??
        (table !== 'regions' && !isSpot([p.x, p.y]) ? 'x, y' : undefined) ??
        (table === 'wrecks' && !isSpot(p.launch) ? 'launch' : undefined) ??
        ('pool' in p && !(Number.isFinite(p.pool) && p.pool > 0) ? 'pool' : undefined) ??
        ('object' in p && typeof p.object !== 'string' ? 'object' : undefined);
      if (bad) errors.push(`${where} has a bad "${bad}"`);
    });
  }

  return errors;
}

/**
 * Looks over the places and lists everything the person should know about.
 *
 * An error is something that would break the game or the map build (a repeated id, an unknown
 * region), so Save is refused while one stands. A warning is a spot that looks wrong on the map
 * as it was last built (in water, in another region). Rebuilding reshapes the land around each
 * place, so a warning doesn't block Save.
 *
 * @param {object} places - The places being edited, already in the file's shape.
 * @param {object} world - Facts about the game: `width`, `height`, `isWalkable(x, y)`,
 *   `isSailable(x, y)`, `regionIdAt(x, y)`, `journal` (landmark ids the journal names, by region
 *   id) and `sprites` (the object sprite names).
 * @returns {{kind: string|null, i: number|null, level: string, message: string}[]} The problems,
 *   each pointing at a place by kind and index (null for one that belongs to no place).
 */
export function checkPlaces(places, world) {
  const found = [];
  const regionIds = places.regions.map((r) => r.id);

  /** Adds one problem to the list. */
  const add = (ref, level, message) =>
    found.push({ kind: ref?.kind ?? null, i: ref?.i ?? null, level, message });

  /** Says whether a spot is inside the world. */
  const inside = (x, y) => x >= 0 && y >= 0 && x <= world.width && y <= world.height;

  // Ids of regions, landmarks, signposts and old boats share one pool: count each one's uses.
  const uses = new Map();
  for (const p of [...places.regions, ...places.landmarks, ...places.waypoints, ...places.wrecks])
    uses.set(p.id, (uses.get(p.id) ?? 0) + 1);

  for (const p of listPlaces(places)) {
    const ref = { kind: p.kind, i: p.i };
    const editable = !FIXED.includes(p.kind);
    const label = p.name?.trim() || p.id || `A ${p.kind}`;

    // Errors: things the game or the map build can't live with.
    if (editable) {
      if (!ID.test(p.id))
        add(ref, 'error', `"${p.id}" is not a valid id: use lowercase letters, digits and dashes`);
      else if (uses.get(p.id) > 1) add(ref, 'error', `The id "${p.id}" is used more than once`);

      if (!p.name.trim()) add(ref, 'error', `${p.id || 'A place'} needs a name`);
      if (!regionIds.includes(p.region))
        add(ref, 'error', `${label} names the unknown region "${p.region}"`);
      if (p.object !== undefined && !world.sprites.includes(p.object))
        add(ref, 'error', `${label} uses "${p.object}", but there is no sprite with that name`);
    }

    if (!inside(p.x, p.y)) {
      add(ref, 'error', `${label} is outside the world`);
      continue;
    }

    // Warnings: the spot looks wrong on the map as it was last built.
    if (!world.isWalkable(p.x, p.y))
      add(ref, 'warning', `${label} is on ground the player can't stand on`);

    const here = world.regionIdAt(p.x, p.y);
    if (editable && regionIds.includes(p.region) && here !== p.region)
      add(ref, 'warning', `${label} says ${p.region} but is in ${here}`);

    if (p.kind === 'wreck') {
      const launch = { kind: 'launch', i: p.i };
      if (!inside(p.launch[0], p.launch[1]))
        add(launch, 'error', `The launch point of ${label} is outside the world`);
      else if (!world.isSailable(p.launch[0], p.launch[1]))
        add(launch, 'warning', `The launch point of ${label} is not on water a boat can float on`);
    }
  }

  // The field journal names landmarks by id, so a renamed or deleted one leaves a page orphaned.
  for (const [regionId, named] of Object.entries(world.journal)) {
    for (const id of named)
      if (!places.landmarks.some((l) => l.id === id))
        add(null, 'warning', `The journal has a page for "${id}", but no landmark has that id`);

    places.landmarks.forEach((l, i) => {
      if (l.region === regionId && !named.includes(l.id))
        add({ kind: 'landmark', i }, 'warning', `${l.name} has no journal page`);
    });
  }

  return found;
}

/**
 * Writes a value on one line, the way the places file does: `[1, 2]` and `{ "id": "a" }`.
 *
 * @param {*} value - A number, text, list or object.
 * @returns {string} The value as one line of JSON, with the file's spacing.
 */
function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const fields = Object.entries(value).map(([key, v]) => `${JSON.stringify(key)}: ${inline(v)}`);
    return `{ ${fields.join(', ')} }`;
  }
  return JSON.stringify(value);
}

/**
 * Writes one table of the file with each entry on its own line.
 *
 * @param {string} name - The table's name, such as 'landmarks'.
 * @param {string[]} lines - Its entries, each already written on one line.
 * @param {string} open - '[' for a list or '{' for a keyed table.
 * @returns {string} The table, indented as in the file, with no comma after it.
 */
function block(name, lines, open) {
  const close = open === '[' ? ']' : '}';
  return `  "${name}": ${open}\n${lines.map((line) => `    ${line}`).join(',\n')}\n  ${close}`;
}

/**
 * Turns the places back into the exact text layout of places.json.
 *
 * The file is laid out by hand: one place per line. Keeping that layout means saving changes
 * only the lines of the places that really changed, so a git diff stays readable. Lines end
 * with a plain newline; whoever writes the file to disk picks the line ending.
 *
 * @param {object} places - The places being edited.
 * @returns {string} The file's text, ending with a newline.
 */
export function writePlaces(places) {
  /** Writes a list table: one object per line. */
  const list = (name) => block(name, places[name].map(inline), '[');

  const supplies = Object.entries(places.supplies).map(
    ([id, spot]) => `${JSON.stringify(id)}: ${inline(spot)}`,
  );

  const tables = [
    list('regions'),
    `  "spawns": ${inline(places.spawns)}`,
    block('supplies', supplies, '{'),
    list('landmarks'),
    list('waypoints'),
    list('wrecks'),
  ];

  return `{\n${tables.join(',\n')}\n}\n`;
}
