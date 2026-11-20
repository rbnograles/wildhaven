// The world editor's map: a canvas showing the world with a marker on every place. Zoomed out it
// shows the small overview picture; zoomed in it draws the real tiles and sprites. It handles
// zooming, panning, picking and dragging in both modes (places and objects) and tells main.js
// what the person did; it never changes the places or the objects itself.

import overviewUrl from '../../assets/world/map/overview.webp';
import { WORLD, isWalkable } from '../world/map.js';
import { REGION_GRID, regionIndexAt } from '../world/regions.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS } from '../data/balance.js';
import { listPlaces, getPlace } from './model.js';
import { createTiles } from './tiles.js';
import { createSprites, bucketObjects, drawOrder } from './sprites.js';
import { BOX } from './terrain.js';

/** The marker colour of each kind of place. The side panel's list uses the same colours. */
export const COLORS = {
  spawn: '#ffffff',
  supply: '#f2c14e',
  landmark: '#e4572e',
  waypoint: '#4ea8de',
  wreck: '#b07a4a',
  launch: '#7fd1c7',
};

/** The flat colour a hand-painted corner is shown in until the map is rebuilt, by ground kind. */
export const GROUND_COLORS = {
  grass: '#6f9a3c',
  dirt: '#9a7b4f',
  soil: '#6b5a3a',
  jungle: '#2f6b2f',
  rock: '#8d8d8d',
  snow: '#f2f4f8',
  sand: '#e6cf8a',
  water: '#3f84b5',
};

/**
 * The game's own ground pictures, by kind, so a painted box shows the real ground and not a flat
 * colour. Each picture repeats every `GROUND_TILE` world units, the same as in the tileset.
 */
const GROUND_URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/source/ground/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.png$/)[1], url]),
);
const GROUND_TILE = 256;

/** The grid of boxes is drawn once a box is at least this many screen pixels wide. */
const GRID_PIXELS = 8;

/** How far the map builder keeps scenery from a place, in world units (150 in build-map.py). */
const CLEAR_RING = 150;

/** How close to a marker a click must be to pick it, in screen pixels. */
const HIT = 10;

/** The blocked-ground overlay is drawn in squares this many screen pixels wide. */
const BLOCK_STEP = 8;

/** The overlay only shows from this zoom (screen pixels per world unit); farther out it is noise. */
const BLOCK_ZOOM = 0.08;

/** From this zoom the real tiles and sprites are drawn instead of the overview picture. */
const SHARP_ZOOM = 0.25;

/** The closest zoom: two screen pixels per world unit. */
const MAX_ZOOM = 2;

/** How much one notch of the mouse wheel zooms. */
const ZOOM_STEP = 1.15;

/** The tallest sprite is about 525 units (the ship), so objects this far off screen still show. */
const REACH = 560;

/**
 * The radius drawn round a selected place: how close the player must come to find it.
 * Old boats are found like landmarks. Other kinds have no finding radius.
 */
const FIND_RADIUS = {
  landmark: LANDMARK_RADIUS,
  wreck: LANDMARK_RADIUS,
  waypoint: WAYPOINT_RADIUS,
};

/** Says whether two objects are the same one: sprite, spot, and whose it is. */
const sameObject = (a, b) => a.name === b.name && a.x === b.x && a.y === b.y && a.own === b.own;

/**
 * Sets up the map canvas.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to draw on.
 * @param {object} on - What the view asks and tells main.js. Places: `places()`, `selected()`,
 *   `flagged()`, `adding()`, `select(ref|null)`, `move(ref, x, y, first)`, `add(x, y)`. Objects:
 *   `mode()` ('places' or 'objects'), `specs`, `objectSelection()`, `armed()` (the sprite waiting
 *   for a click, or null), `lockedWhy(obj)`, `selectObjects(list)`, `moveObjects(dx, dy, first)`,
 *   `turn()` (how far the armed sprite is turned, in degrees), `placeObject(x, y)` and
 *   `hint(text)` for the status line. Terrain: `ground()` (the
 *   hand-painted corners), `tool()` (the ground being painted, or null), `brush()` (its side in
 *   boxes) and `paint(col, row, first)`.
 * @returns {{draw: Function, centerOn: Function, setOverlay: Function, setObjects: Function}} The
 *   view's controls.
 */
export function createView(canvas, on) {
  const ctx = canvas.getContext('2d');
  const overlays = { regions: true, blocked: false };
  const cam = { x: 0, y: 0, scale: 0.05 };
  const picture = new Image();
  const order = drawOrder(on.specs);

  /** What the mouse is doing between pointer down and up: a drag, a pan or a selection box. */
  let action = null;

  /** False until the first resize, which zooms out so the whole world shows. */
  let fitted = false;

  /** The map's objects sorted into squares, replaced by `setObjects` after every edit. */
  let index = bucketObjects([]);

  /** Where the armed sprite's ghost is drawn, in world units, or null. */
  let ghost = null;

  /** True while a redraw is already booked for the next frame. */
  let booked = false;

  /** The box under the pointer in terrain mode, as [col, row], for the brush outline. */
  let brushAt = null;

  /** True while the Space bar is held: dragging then moves the map instead of painting. */
  let space = false;

  /** The ground pictures, loading in the background; a box uses its flat colour until then. */
  const groundImages = Object.fromEntries(
    Object.entries(GROUND_URLS).map(([kind, url]) => {
      const img = new Image();
      img.onload = later;
      img.src = url;
      return [kind, img];
    }),
  );

  /** Books one redraw for the next frame, however many times it is asked for. */
  function later() {
    if (booked) return;
    booked = true;
    requestAnimationFrame(() => {
      booked = false;
      draw();
    });
  }

  const tiles = createTiles(later);
  const sprites = createSprites(on.specs, later);

  /** Turns a spot on the screen into world units. */
  const toWorld = (sx, sy) => [cam.x + sx / cam.scale, cam.y + sy / cam.scale];

  /** Turns a spot in the world into screen pixels. */
  const toScreen = (x, y) => [(x - cam.x) * cam.scale, (y - cam.y) * cam.scale];

  /** The zoom at which the whole world just fits on the canvas. */
  const fitScale = () => Math.min(canvas.width / WORLD.width, canvas.height / WORLD.height);

  /** Says whether the real tiles and sprites are being drawn (zoomed in, pictures loaded). */
  const sharp = () => cam.scale >= SHARP_ZOOM && tiles.ready();

  /**
   * Lists every marker: each place, plus the launch point of each old boat.
   *
   * @returns {object[]} Places as `getPlace` gives them.
   */
  function markers() {
    const places = on.places();
    const boats = places.wrecks.map((_, i) => getPlace(places, { kind: 'launch', i }));
    return [...listPlaces(places), ...boats];
  }

  /**
   * Finds the marker under a spot on the screen. Later markers are drawn on top, so they win.
   *
   * @param {number} sx - Screen x.
   * @param {number} sy - Screen y.
   * @returns {object|undefined} The place under the pointer, if any.
   */
  function hit(sx, sy) {
    return markers().findLast((p) => {
      const [x, y] = toScreen(p.x, p.y);
      return Math.hypot(x - sx, y - sy) <= HIT;
    });
  }

  /**
   * Lists the objects on or near the screen, in the order they are drawn.
   *
   * @returns {object[]} The visible objects, bottom to top.
   */
  function visible() {
    const [x0, y0] = toWorld(0, 0);
    const [x1, y1] = toWorld(canvas.width, canvas.height);
    return index.near(x0 - REACH, y0 - REACH, x1 + REACH, y1 + REACH).sort(order);
  }

  /**
   * Finds the topmost object whose paint is under a world spot.
   *
   * @param {number} x - World x.
   * @param {number} y - World y.
   * @returns {object|undefined} The object, if any.
   */
  function hitObject(x, y) {
    return index
      .near(x - REACH, y - REACH, x + REACH, y + REACH)
      .sort(order)
      .findLast((o) => sprites.hits(o, x, y));
  }

  /** Tints the ground the player can't stand on, sampled in small squares across the screen. */
  function drawBlocked() {
    ctx.fillStyle = 'rgba(255, 40, 80, 0.38)';
    for (let sy = 0; sy < canvas.height; sy += BLOCK_STEP)
      for (let sx = 0; sx < canvas.width; sx += BLOCK_STEP) {
        const [x, y] = toWorld(sx + BLOCK_STEP / 2, sy + BLOCK_STEP / 2);
        if (!isWalkable(x, y)) ctx.fillRect(sx, sy, BLOCK_STEP, BLOCK_STEP);
      }
  }

  /** Draws a line wherever two neighbouring squares of the region grid belong to different regions. */
  function drawRegions() {
    const { cell, cols, rows } = REGION_GRID;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        const here = regionIndexAt(cx, cy);
        const [x0, y0] = toScreen(cx * cell, cy * cell);
        const [x1, y1] = toScreen((cx + 1) * cell, (cy + 1) * cell);

        if (cx + 1 < cols && regionIndexAt(cx + 1, cy) !== here) {
          ctx.moveTo(x1, y0);
          ctx.lineTo(x1, y1);
        }
        if (cy + 1 < rows && regionIndexAt(cx, cy + 1) !== here) {
          ctx.moveTo(x0, y1);
          ctx.lineTo(x1, y1);
        }
      }
    ctx.stroke();
  }

  /**
   * Draws a circle round a spot, sized in world units.
   *
   * @param {object} p - The place at the centre.
   * @param {number} radius - The radius in world units.
   * @param {string} color - The line colour.
   * @param {number[]} dash - The dash pattern, or [] for a solid line.
   */
  function ring(p, radius, color, dash) {
    const [x, y] = toScreen(p.x, p.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.arc(x, y, radius * cam.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Draws a frame round an object's picture.
   *
   * @param {object} obj - The object.
   * @param {string} color - The line colour.
   * @param {number[]} dash - The dash pattern, or [] for a solid line.
   */
  function frame(obj, color, dash) {
    const r = sprites.rect(obj);
    if (!r) return;
    const [x, y] = toScreen(r.x, r.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = dash.length ? 1 : 2;
    ctx.setLineDash(dash);
    ctx.strokeRect(x, y, r.w * cam.scale, r.h * cam.scale);
    ctx.setLineDash([]);
  }

  /** Draws the sprites on screen, then frames the hand-placed and the selected ones. */
  function drawObjects() {
    const list = visible();
    // Generated scenery on a box erased to sea is left out: the rebuild won't grow it in water.
    for (const o of list) if (o.own || !erased(o.x, o.y)) sprites.draw(ctx, o, cam);
    if (on.mode() !== 'objects') return;

    const chosen = on.objectSelection();
    for (const o of list) if (o.own) frame(o, 'rgba(255, 255, 255, 0.75)', [4, 3]);
    for (const o of chosen) frame(o, '#ffe14a', []);

    // The armed sprite follows the pointer, faint, to show where a click would put it.
    if (ghost && on.armed())
      sprites.draw(
        ctx,
        { name: on.armed(), x: ghost[0], y: ghost[1], rotation: on.turn() },
        cam,
        0.6,
      );

    // The selection box being dragged out.
    if (action?.box) {
      const [x0, y0] = toScreen(action.x0, action.y0);
      const [x1, y1] = toScreen(action.x1, action.y1);
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }
  }

  /**
   * Makes the paint for one kind of ground: its real picture, lined up with the world.
   *
   * The picture is used as a repeating pattern pinned to the world's corner, so it lines up
   * from box to box and doesn't swim when the map is moved, like wallpaper on a wall.
   *
   * @param {string} kind - The ground kind.
   * @returns {CanvasPattern|string} The pattern, or the flat colour while the picture loads.
   */
  function groundPaint(kind) {
    const img = groundImages[kind];
    if (!img?.complete || !img.naturalWidth) return GROUND_COLORS[kind];

    const pattern = ctx.createPattern(img, 'repeat');
    const size = (GROUND_TILE / img.naturalWidth) * cam.scale;
    pattern.setTransform(new DOMMatrix([size, 0, 0, size, -cam.x * cam.scale, -cam.y * cam.scale]));
    return pattern;
  }

  /**
   * Says whether a world spot is in a box that was erased to sea by hand.
   *
   * @param {number} x - World x.
   * @param {number} y - World y.
   * @returns {boolean} True when the nearest painted corner is water.
   */
  function erased(x, y) {
    return on.ground()[`${Math.round(y / BOX)},${Math.round(x / BOX)}`] === 'water';
  }

  /**
   * Shows every hand-painted box with its real ground, covering what the map has there now.
   *
   * A box is the square around one tile corner, so it is drawn centred on that corner. The
   * rebuilt map shows the same patch with softened edges and, beside water, a bank.
   */
  function drawGround() {
    const ground = on.ground();
    const side = BOX * cam.scale;
    const paints = {};

    for (const key in ground) {
      const [row, col] = key.split(',').map(Number);
      const [x, y] = toScreen(col * BOX - BOX / 2, row * BOX - BOX / 2);
      if (x > canvas.width || y > canvas.height || x + side < 0 || y + side < 0) continue;

      const kind = ground[key];
      ctx.fillStyle = paints[kind] ??= groundPaint(kind);
      // Whole pixels with a pixel of overlap, so no hairline shows between two painted boxes.
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(side) + 1, Math.ceil(side) + 1);
    }
  }

  /**
   * Draws the grid of boxes and the outline of the brush, in terrain mode.
   *
   * The lines run half a tile off the tile edges, because each box is centred on a tile corner.
   */
  function drawGrid() {
    const side = BOX * cam.scale;

    if (side >= GRID_PIXELS) {
      const [x0, y0] = toWorld(0, 0);
      const [x1, y1] = toWorld(canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let c = Math.floor(x0 / BOX) - 1; (c + 0.5) * BOX <= x1; c++) {
        const x = Math.round(toScreen((c + 0.5) * BOX, 0)[0]) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let r = Math.floor(y0 / BOX) - 1; (r + 0.5) * BOX <= y1; r++) {
        const y = Math.round(toScreen(0, (r + 0.5) * BOX)[1]) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }

    // The boxes the next click would paint.
    if (brushAt && on.tool()) {
      const half = (on.brush() - 1) / 2;
      const [x, y] = toScreen((brushAt[0] - half - 0.5) * BOX, (brushAt[1] - half - 0.5) * BOX);
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, on.brush() * side, on.brush() * side);
    }
  }

  /** Draws every place marker. In objects and terrain mode they are small and can't be picked. */
  function drawMarkers() {
    const places = on.places();
    const small = on.mode() !== 'places';
    const selected = small ? null : on.selected();
    const flagged = on.flagged();

    // A thin line ties each old boat to its launch point.
    ctx.strokeStyle = COLORS.launch;
    ctx.lineWidth = 1;
    for (const boat of places.wrecks) {
      ctx.beginPath();
      ctx.moveTo(...toScreen(boat.x, boat.y));
      ctx.lineTo(...toScreen(boat.launch[0], boat.launch[1]));
      ctx.stroke();
    }

    for (const p of markers()) {
      const [x, y] = toScreen(p.x, p.y);
      const chosen = selected && selected.kind === p.kind && selected.i === p.i;

      if (chosen) {
        ring(p, CLEAR_RING, 'rgba(255, 255, 255, 0.6)', [4, 4]);
        if (FIND_RADIUS[p.kind]) ring(p, FIND_RADIUS[p.kind], COLORS[p.kind], []);
      }

      ctx.beginPath();
      ctx.arc(x, y, small ? 3 : p.kind === 'launch' ? 4 : 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[p.kind];
      ctx.fill();
      ctx.lineWidth = chosen ? 3 : 1.5;
      ctx.strokeStyle = chosen
        ? '#ffffff'
        : flagged.has(`${p.kind}:${p.i}`)
          ? '#ffe14a'
          : '#10140f';
      ctx.stroke();
    }
  }

  /** Redraws the whole canvas: the ground, the sprites, the overlays, then the markers. */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;

    if (sharp()) {
      // Chunks are painted a few per frame; keep drawing until none are waiting.
      if (tiles.draw(ctx, cam, canvas.width, canvas.height)) later();
      if (on.places()) drawGround();
      drawObjects();
    } else if (picture.complete && picture.naturalWidth) {
      const [x, y] = toScreen(0, 0);
      ctx.drawImage(picture, x, y, WORLD.width * cam.scale, WORLD.height * cam.scale);
    }

    if (on.places() && !sharp()) drawGround();
    if (on.mode() === 'terrain') drawGrid();

    if (overlays.blocked && cam.scale >= BLOCK_ZOOM) drawBlocked();
    if (overlays.regions) drawRegions();

    // The picture can arrive before the places file has loaded; the markers wait for it.
    if (on.places()) drawMarkers();
  }

  /** Matches the canvas's drawing size to its size on the page, and fits the world the first time. */
  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (!fitted) cam.scale = fitScale();
    fitted = true;
    draw();
  }

  /**
   * Works out which box a world spot is in.
   *
   * @param {number} x - World x.
   * @param {number} y - World y.
   * @returns {number[]} `[col, row]` of the box.
   */
  const boxAt = (x, y) => [Math.round(x / BOX), Math.round(y / BOX)];

  /**
   * Starts whatever a press in terrain mode means: paint, or move the map.
   *
   * @param {PointerEvent} event - The press.
   * @param {number} x - World x under the pointer.
   * @param {number} y - World y under the pointer.
   */
  function pressTerrain(event, x, y) {
    // No ground picked, the Space bar held, or the middle button: this drag moves the map.
    if (!on.tool() || space || event.button === 1) {
      action = { pan: true, sx: event.offsetX, sy: event.offsetY, moved: true };
      return;
    }

    const [col, row] = boxAt(x, y);
    action = { paint: true, col, row };
    on.paint(col, row, true);
  }

  /**
   * Starts whatever a press in objects mode means: place, box-select, drag or pan.
   *
   * @param {PointerEvent} event - The press.
   * @param {number} x - World x under the pointer.
   * @param {number} y - World y under the pointer.
   */
  function pressObjects(event, x, y) {
    const pan = { pan: true, sx: event.offsetX, sy: event.offsetY, moved: false };

    // Zoomed out, single sprites can't be told apart: only panning works.
    if (!sharp()) {
      on.hint('Zoom in to edit objects.');
      action = pan;
      return;
    }
    if (on.armed()) return on.placeObject(x, y);
    if (event.shiftKey) {
      action = { box: true, x0: x, y0: y, x1: x, y1: y };
      return;
    }

    const obj = hitObject(x, y);
    if (!obj || on.lockedWhy(obj)) {
      if (obj) on.hint(on.lockedWhy(obj));
      action = pan;
      return;
    }

    // Pressing an object outside the selection selects just it; inside, the whole group drags.
    if (!on.objectSelection().some((o) => sameObject(o, obj))) on.selectObjects([obj]);
    action = { objects: true, x, y, moved: false };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const [x, y] = toWorld(event.offsetX, event.offsetY);
    canvas.setPointerCapture(event.pointerId);
    if (on.mode() === 'terrain') return pressTerrain(event, x, y);
    if (on.mode() === 'objects') return pressObjects(event, x, y);

    // Waiting to add a place: this click says where.
    if (on.adding()) return on.add(x, y);

    const p = hit(event.offsetX, event.offsetY);
    if (p) {
      const ref = { kind: p.kind, i: p.i };
      on.select(ref);
      // Remember where inside the marker it was grabbed, so it doesn't jump under the pointer.
      action = { drag: ref, dx: p.x - x, dy: p.y - y, moved: false };
    } else {
      action = { pan: true, sx: event.offsetX, sy: event.offsetY, moved: false };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const [x, y] = toWorld(event.offsetX, event.offsetY);

    // Nothing held: only the armed sprite's ghost follows the pointer.
    if (!action) {
      if (on.mode() === 'objects' && on.armed()) {
        ghost = [Math.round(x), Math.round(y)];
        later();
      }
      if (on.mode() === 'terrain') {
        brushAt = boxAt(x, y);
        later();
      }
      return;
    }

    if (action.drag) {
      on.move(action.drag, x + action.dx, y + action.dy, !action.moved);
      action.moved = true;
      return;
    }

    if (action.objects) {
      // Whole units only, and the grab point advances by what was really moved.
      const dx = Math.round(x - action.x),
        dy = Math.round(y - action.y);
      if (!dx && !dy) return;
      on.moveObjects(dx, dy, !action.moved);
      action.x += dx;
      action.y += dy;
      action.moved = true;
      return;
    }

    if (action.box) {
      action.x1 = x;
      action.y1 = y;
      later();
      return;
    }

    if (action.paint) {
      // Paint again only when the pointer has reached another box.
      const [col, row] = boxAt(x, y);
      brushAt = [col, row];
      if (col === action.col && row === action.row) return;
      action.col = col;
      action.row = row;
      on.paint(col, row, false);
      return;
    }

    cam.x -= (event.offsetX - action.sx) / cam.scale;
    cam.y -= (event.offsetY - action.sy) / cam.scale;
    action.sx = event.offsetX;
    action.sy = event.offsetY;
    action.moved = true;
    later();
  });

  canvas.addEventListener('pointerup', () => {
    const done = action;
    action = null;

    // A finished box selects every editable object whose ground point is inside it.
    if (done?.box) {
      const x0 = Math.min(done.x0, done.x1),
        x1 = Math.max(done.x0, done.x1);
      const y0 = Math.min(done.y0, done.y1),
        y1 = Math.max(done.y0, done.y1);
      const inside = index
        .near(x0, y0, x1, y1)
        .filter((o) => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1 && !on.lockedWhy(o));
      return on.selectObjects(inside);
    }

    // A click on empty map that didn't pan clears the selection.
    if (done?.pan && !done.moved) {
      if (on.mode() === 'objects') on.selectObjects([]);
      else on.select(null);
    }
  });

  canvas.addEventListener('pointerleave', () => {
    ghost = null;
    brushAt = null;
    later();
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      // Zoom about the pointer: the world spot under it stays under it.
      const [x, y] = toWorld(event.offsetX, event.offsetY);
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      cam.scale = Math.min(MAX_ZOOM, Math.max(fitScale() * 0.8, cam.scale * factor));
      cam.x = x - event.offsetX / cam.scale;
      cam.y = y - event.offsetY / cam.scale;
      later();
    },
    { passive: false },
  );

  // Holding Space turns painting into moving the map, as in most paint programs.
  addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.target.closest?.('input, select, textarea')) {
      space = true;
      if (on.mode() === 'terrain') event.preventDefault();
    }
  });
  addEventListener('keyup', (event) => {
    if (event.code === 'Space') space = false;
  });

  new ResizeObserver(resize).observe(canvas);
  picture.onload = later;
  picture.src = overviewUrl;

  return {
    draw,

    // Moves the camera so a world spot is in the middle of the canvas, zooming in if asked.
    centerOn: (x, y, zoom) => {
      if (zoom) cam.scale = Math.max(cam.scale, zoom);
      cam.x = x - canvas.width / 2 / cam.scale;
      cam.y = y - canvas.height / 2 / cam.scale;
      draw();
    },

    // Switches an overlay ('regions' or 'blocked') on or off.
    setOverlay: (name, shown) => {
      overlays[name] = shown;
      draw();
    },

    // Takes the map's objects as they are after the latest edit.
    setObjects: (list) => {
      index = bucketObjects(list);
    },
  };
}
