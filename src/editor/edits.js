// The world editor's object edits: which of the map's generated objects were removed by hand
// and which objects were placed by hand. tools/build-map.py replays these two lists on every
// build. This file also lays them over the map for the editor's own picture, checks them, and
// writes them back as the text of edits.json. It knows nothing about the page.

import { remember } from './model.js';

/**
 * Sprites that can't be edited as loose objects, with the reason. A signpost stands where its
 * waypoint is, so it moves in Places mode. (Hill stairs are locked too, by their name: they
 * belong to their hill and are edited with the hill tools.) Everything else on the map, path
 * pieces, ripples and bridges included, can be removed, and placed from the palette.
 */
const LOCKED = {
  signpost: 'Signposts are moved in Places mode',
};

/** How far north of a landmark its `object` sprite stands (the same 60 as in build-map.py). */
const LANDMARK_NORTH = 60;

/** A solid hand-placed object this close to a place gets a warning (the build keeps 150 clear). */
const PLACE_CLEAR = 150;

/** A solid base within this many units of the middle of a path piece counts as on the path. */
const PATH_CLEAR = 45;

/** Makes an edits object with nothing in it. */
export const emptyEdits = () => ({ removed: [], added: [] });

/** Says whether two entries are the same sprite at the same spot. */
const same = (a, b) => a.name === b.name && a.x === b.x && a.y === b.y;

/** Turns an entry into one piece of text, so entries can be looked up quickly in a Set. */
const keyOf = (o) => `${o.name}|${o.x}|${o.y}`;

/**
 * Keeps only the fields the file stores: the sprite, its spot, and how far it is turned when it
 * is turned at all (only path pieces are; `rotation` is in degrees, clockwise).
 */
const entry = (o) => ({
  name: o.name,
  x: o.x,
  y: o.y,
  ...(o.rotation ? { rotation: o.rotation } : {}),
});

/** Says whether two entries are also turned the same way. */
const sameTurn = (a, b) => (a.rotation ?? 0) === (b.rotation ?? 0);

/**
 * Says why a sprite can't be edited as a loose object, if it can't.
 *
 * @param {string} name - The sprite's name.
 * @param {object} specs - The sprites of objects.json, by name.
 * @returns {string|null} The reason in plain words, or null when the sprite is editable.
 */
export function lockReason(name, specs) {
  const spec = specs[name];
  if (!spec) return `There is no sprite called "${name}"`;
  if (name.endsWith('-stairs')) return 'Hill stairs belong to their hill';
  return LOCKED[name] ?? null;
}

/**
 * Says whether an object is the sprite a landmark placed, which moves with its landmark.
 *
 * @param {{name: string, x: number, y: number}} obj - The object.
 * @param {object} places - The places file.
 * @returns {string|null} The reason it is locked, or null.
 */
export function landmarkLock(obj, places) {
  const owned = places.landmarks.some(
    (l) => l.object === obj.name && l.x === obj.x && l.y - LANDMARK_NORTH === obj.y,
  );
  return owned ? 'This belongs to a landmark: move the landmark in Places mode' : null;
}

/**
 * Reads an object's own size from its `scale` property (a map brought in from Tiled has one; see
 * objectScale in world/map.js, which is not imported here: the editor's server loads this file, and
 * importing the map would make the dev server restart every time a rebuild writes the map).
 *
 * @param {object} o - A map object.
 * @returns {number} Its size factor, 1 when it has none.
 */
const scaleOf = (o) =>
  (Array.isArray(o.properties) ? o.properties.find((p) => p.name === 'scale')?.value : undefined) ??
  1;

/**
 * Works out the map's objects as the script generated them, before any hand edit.
 *
 * After a rebuild the map file already has the added objects in it and lacks the removed ones.
 * The editor needs the untouched list underneath, like the pencil drawing under the ink, so
 * that deleting a hand-placed tree really makes it go and un-removing a tree brings it back.
 *
 * @param {object[]} mapObjects - The objects in the map file (`name`, `x`, `y`, `rotation`).
 * @param {object} builtEdits - The edits file as it was when the page loaded.
 * @param {object[]} builtStale - Removals the last build said matched nothing.
 * @returns {object[]} The generated objects, each `{name, x, y, rotation, own: false}`.
 */
export function baseObjects(mapObjects, builtEdits, builtStale) {
  // Take out one map object per added entry (the build put it there).
  const extra = new Map();
  for (const a of builtEdits.added) extra.set(keyOf(a), (extra.get(keyOf(a)) ?? 0) + 1);

  const base = [];
  for (const o of mapObjects) {
    const key = keyOf(o);
    if (extra.get(key) > 0) extra.set(key, extra.get(key) - 1);
    else
      base.push({
        name: o.name,
        x: o.x,
        y: o.y,
        rotation: o.rotation ?? 0,
        scale: scaleOf(o),
        own: false,
      });
  }

  // Put back what the build left out, unless it is still there or never matched anything.
  const present = new Set(base.map(keyOf));
  const stale = new Set(builtStale.map(keyOf));
  for (const r of builtEdits.removed)
    if (!present.has(keyOf(r)) && !stale.has(keyOf(r)))
      base.push({ ...entry(r), rotation: r.rotation ?? 0, own: false });

  return base;
}

/**
 * Lays the edits over the generated objects, the same way the map build does.
 *
 * @param {object[]} base - The generated objects, from `baseObjects`.
 * @param {object} edits - The edits being made.
 * @returns {{objects: object[], stale: object[]}} What the map will hold, and the removals that
 *   match no generated object.
 */
export function applyEdits(base, edits) {
  const gone = new Set(edits.removed.map(keyOf));
  const present = new Set(base.map(keyOf));

  return {
    objects: [
      ...base.filter((o) => !gone.has(keyOf(o))),
      ...edits.added.map((a) => ({ ...entry(a), rotation: a.rotation ?? 0, own: true })),
    ],
    stale: edits.removed.filter((r) => !present.has(keyOf(r))).map(entry),
  };
}

/**
 * Puts the edits read from disk into an editing session.
 *
 * @param {object} editor - The editing session from `createEditor`.
 * @param {object} edits - The parsed edits file.
 */
export function loadEdits(editor, edits) {
  editor.edits = structuredClone(edits);
  editor.savedEdits = writeEdits(edits);
}

/** Says whether the edits differ from the text that was last saved. */
export const isEditsDirty = (editor) => writeEdits(editor.edits) !== editor.savedEdits;

/**
 * Notes that the edits as they are now have been saved.
 *
 * @param {object} editor - The editing session.
 */
export function markEditsSaved(editor) {
  editor.savedEdits = writeEdits(editor.edits);
}

/**
 * Records that an object now stands at a spot.
 *
 * If that exact object was removed from that exact spot earlier, the two cancel out: the
 * removal is dropped and nothing is added, so the tree is simply the generated one again.
 *
 * @param {object} edits - The edits being made.
 * @param {{name: string, x: number, y: number}} at - The sprite and its spot.
 * @returns {object} The object as it now is, `own` false when the entries cancelled.
 */
function put(edits, at) {
  const i = edits.removed.findIndex((r) => same(r, at) && sameTurn(r, at));
  if (i >= 0) {
    edits.removed.splice(i, 1);
    return { ...entry(at), rotation: at.rotation ?? 0, own: false };
  }
  edits.added.push(entry(at));
  return { ...entry(at), rotation: at.rotation ?? 0, own: true };
}

/**
 * Takes an object off the map: a hand-placed one is forgotten, a generated one is recorded as removed.
 *
 * @param {object} edits - The edits being made.
 * @param {object} obj - The object.
 */
function take(edits, obj) {
  if (!obj.own) return void edits.removed.push(entry(obj));
  const i = edits.added.findIndex((a) => same(a, obj));
  if (i >= 0) edits.added.splice(i, 1);
}

/**
 * Places a new object by hand.
 *
 * @param {object} editor - The editing session.
 * @param {string} name - The sprite's name.
 * @param {number} x - Where it goes, in world units.
 * @param {number} y - Where it goes, in world units.
 * @param {number} [rotation] - How far it is turned, in degrees; only path pieces are turned.
 * @returns {object} The new object.
 */
export function addObject(editor, name, x, y, rotation = 0) {
  remember(editor);
  return put(editor.edits, { name, x: Math.round(x), y: Math.round(y), rotation });
}

/**
 * Deletes objects.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} objs - The objects to delete.
 */
export function removeObjects(editor, objs) {
  remember(editor);
  for (const obj of objs) take(editor.edits, obj);
}

/**
 * Moves objects by the same amount.
 *
 * A generated object that moves becomes a removal at its old spot and an addition at the new
 * one. A hand-placed object only changes its own entry.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} objs - The objects to move.
 * @param {number} dx - How far east, in world units.
 * @param {number} dy - How far south, in world units.
 * @param {boolean} [record] - False for the later moves of one drag, so the drag is one undo step.
 * @returns {object[]} The same objects as they are after the move, to keep as the selection.
 */
export function moveObjects(editor, objs, dx, dy, record = true) {
  if (record) remember(editor);

  // Lift every object first, then set them all down, so two objects of a group never cancel
  // against each other's old spot half way through.
  for (const obj of objs) take(editor.edits, obj);
  return objs.map((obj) =>
    put(editor.edits, {
      name: obj.name,
      x: Math.round(obj.x + dx),
      y: Math.round(obj.y + dy),
      rotation: obj.rotation,
    }),
  );
}

/**
 * Turns objects on the spot. Used for path pieces, which are the only sprites drawn turned.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} objs - The objects to turn.
 * @param {number} degrees - How far to turn them, clockwise; negative turns the other way.
 * @returns {object[]} The same objects as they are after the turn, to keep as the selection.
 */
export function rotateObjects(editor, objs, degrees) {
  remember(editor);
  for (const obj of objs) take(editor.edits, obj);
  return objs.map((obj) =>
    put(editor.edits, {
      name: obj.name,
      x: obj.x,
      y: obj.y,
      rotation: (((obj.rotation + degrees) % 360) + 360) % 360,
    }),
  );
}

/**
 * Drops removals that match nothing on the map any more.
 *
 * @param {object} editor - The editing session.
 * @param {object[]} stale - The stale removals, from `applyEdits`.
 */
export function dropStale(editor, stale) {
  remember(editor);
  editor.edits.removed = editor.edits.removed.filter((r) => !stale.some((s) => same(s, r)));
}

/**
 * Checks that an object has the shape of the edits file, before it is written to disk.
 *
 * @param {*} edits - What a request sent.
 * @returns {string[]} One message per thing that is wrong; empty when the shape is right.
 */
export function shapeErrors(edits) {
  if (typeof edits !== 'object' || edits === null || Array.isArray(edits))
    return ['The edits must be an object'];
  const errors = [];

  for (const list of ['removed', 'added']) {
    if (!Array.isArray(edits[list])) {
      errors.push(`"${list}" must be a list`);
      continue;
    }

    edits[list].forEach((o, i) => {
      const ok =
        typeof o === 'object' &&
        o !== null &&
        Object.keys(o).every((key) => ['name', 'x', 'y', 'rotation'].includes(key)) &&
        typeof o.name === 'string' &&
        Number.isSafeInteger(o.x) &&
        Number.isSafeInteger(o.y) &&
        (o.rotation === undefined ||
          (Number.isSafeInteger(o.rotation) && o.rotation > 0 && o.rotation < 360));
      if (!ok)
        errors.push(
          `${list}[${i}] must be { name, x, y } in whole numbers, with an optional rotation`,
        );
    });
  }

  return errors;
}

/**
 * Lists every spot in the places file where the player must be able to stand.
 *
 * @param {object} places - The places file.
 * @returns {{x: number, y: number}[]} Spawns, supplies, landmarks, signposts and old boats.
 */
function placePoints(places) {
  const pairs = [...Object.values(places.spawns), ...Object.values(places.supplies)];
  return [
    ...pairs.map(([x, y]) => ({ x, y })),
    ...places.landmarks,
    ...places.waypoints,
    ...places.wrecks,
  ];
}

/**
 * Looks over the edits and lists everything the person should know about.
 *
 * An error is something the map build would stop on, so Save is refused while one stands. A
 * warning is a hand-placed solid object in a spot that looks wrong on the map as it was last
 * built; the rebuild's tests are the real judge.
 *
 * @param {object} edits - The edits being made.
 * @param {object} ctx - Facts about the game: `specs` (objects.json), `places`, `width`,
 *   `height`, `isBlocked(x, y)` (water, cliff or stairs), `paths` (the middle of each path
 *   piece) and `stale` (removals that match nothing).
 * @returns {{level: string, message: string, object: object|null}[]} The problems.
 */
export function checkEdits(edits, ctx) {
  const found = [];
  const points = placePoints(ctx.places);
  const seen = new Set();

  /** Adds one problem to the list. */
  const add = (level, message, object) => found.push({ level, message, object });

  for (const a of edits.added) {
    const where = `${a.name} at ${a.x}, ${a.y}`;
    const why = lockReason(a.name, ctx.specs) ?? landmarkLock(a, ctx.places);

    // Errors: the map build would stop on these.
    if (why) {
      add('error', `${a.name} can't be placed by hand: ${why}`, a);
      continue;
    }
    if (a.x < 0 || a.y < 0 || a.x > ctx.width || a.y > ctx.height) {
      add('error', `${where} is outside the world`, a);
      continue;
    }
    if (seen.has(keyOf(a))) add('error', `${where} is placed twice`, a);
    seen.add(keyOf(a));

    // Warnings only make sense for something the player bumps into.
    const spec = ctx.specs[a.name];
    if (!spec.footprint) continue;
    const half = spec.footprint[0] * (spec.scale ?? 1);

    if (ctx.isBlocked(a.x, a.y)) add('warning', `${where} stands on water or a cliff`, a);
    if (
      ctx.paths.some(
        (p) => Math.abs(p.x - a.x) < half + PATH_CLEAR && Math.abs(p.y - a.y) < PATH_CLEAR,
      )
    )
      add('warning', `${where} stands on a footpath`, a);
    if (points.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < PLACE_CLEAR))
      add('warning', `${where} is very close to a place the player has to reach`, a);
  }

  for (const r of edits.removed) {
    const why = lockReason(r.name, ctx.specs);
    if (why) add('error', `${r.name} can't be removed by hand: ${why}`, null);
  }

  for (const s of ctx.stale)
    add(
      'warning',
      `The removed ${s.name} at ${s.x}, ${s.y} matches nothing on the map any more`,
      null,
    );

  return found;
}

/**
 * Writes one list of the file, one object per line, sorted so the order never depends on the
 * order the edits were made in.
 *
 * @param {string} name - 'removed' or 'added'.
 * @param {object[]} list - The entries.
 * @returns {string} The list as text, with no comma after it.
 */
function block(name, list) {
  if (!list.length) return `  "${name}": []`;

  const sorted = [...list].sort(
    (a, b) => a.y - b.y || a.x - b.x || (a.name > b.name) - (a.name < b.name),
  );
  const lines = sorted.map(
    (o) =>
      `    { "name": ${JSON.stringify(o.name)}, "x": ${o.x}, "y": ${o.y}${o.rotation ? `, "rotation": ${o.rotation}` : ''} }`,
  );
  return `  "${name}": [\n${lines.join(',\n')}\n  ]`;
}

/**
 * Turns the edits into the text of edits.json.
 *
 * One object per line in a fixed order, so a git diff shows only the objects that changed.
 *
 * @param {object} edits - The edits being made.
 * @returns {string} The file's text, ending with a newline.
 */
export function writeEdits(edits) {
  return `{\n${block('removed', edits.removed)},\n${block('added', edits.added)}\n}\n`;
}
