// The world editor's map: a canvas showing the overview picture of the world with a marker on
// every place. It handles zooming, panning, picking and dragging, and tells main.js what the
// person did; it never changes the places itself.

import overviewUrl from '../../assets/world/map/overview.webp';
import { WORLD, isWalkable } from '../world/map.js';
import { REGION_GRID, regionIndexAt } from '../world/regions.js';
import { LANDMARK_RADIUS, WAYPOINT_RADIUS } from '../data/balance.js';
import { listPlaces, getPlace } from './model.js';

/** The marker colour of each kind of place. The side panel's list uses the same colours. */
export const COLORS = {
  spawn: '#ffffff',
  supply: '#f2c14e',
  landmark: '#e4572e',
  waypoint: '#4ea8de',
  wreck: '#b07a4a',
  launch: '#7fd1c7',
};

/** How far the map builder keeps scenery from a place, in world units (150 in build-map.py). */
const CLEAR_RING = 150;

/** How close to a marker a click must be to pick it, in screen pixels. */
const HIT = 10;

/** The blocked-ground overlay is drawn in squares this many screen pixels wide. */
const BLOCK_STEP = 8;

/** The overlay only shows from this zoom (screen pixels per world unit); farther out it is noise. */
const BLOCK_ZOOM = 0.08;

/** How much one notch of the mouse wheel zooms. */
const ZOOM_STEP = 1.15;

/**
 * The radius drawn round a selected place: how close the player must come to find it.
 * Old boats are found like landmarks. Other kinds have no finding radius.
 */
const FIND_RADIUS = {
  landmark: LANDMARK_RADIUS,
  wreck: LANDMARK_RADIUS,
  waypoint: WAYPOINT_RADIUS,
};

/**
 * Sets up the map canvas.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to draw on.
 * @param {object} on - What the view asks and tells main.js: `places()`, `selected()`,
 *   `flagged()` (a Set of 'kind:i' with problems), `adding()` (the kind waiting for a click, or
 *   null), `select(ref|null)`, `move(ref, x, y, first)` and `add(x, y)`.
 * @returns {{draw: Function, centerOn: Function, setOverlay: Function}} The view's controls.
 */
export function createView(canvas, on) {
  const ctx = canvas.getContext('2d');
  const overlays = { regions: true, blocked: false };
  const cam = { x: 0, y: 0, scale: 0.05 };
  const picture = new Image();

  /** What the mouse is doing between pointer down and up: a drag of a place, or a pan. */
  let action = null;

  /** False until the first resize, which zooms out so the whole world shows. */
  let fitted = false;

  /** Turns a spot on the screen into world units. */
  const toWorld = (sx, sy) => [cam.x + sx / cam.scale, cam.y + sy / cam.scale];

  /** Turns a spot in the world into screen pixels. */
  const toScreen = (x, y) => [(x - cam.x) * cam.scale, (y - cam.y) * cam.scale];

  /** The zoom at which the whole world just fits on the canvas. */
  const fitScale = () => Math.min(canvas.width / WORLD.width, canvas.height / WORLD.height);

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

  /** Draws every marker, the lines from old boats to their launch points, and the selection. */
  function drawMarkers() {
    const places = on.places();
    const selected = on.selected();
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
      ctx.arc(x, y, p.kind === 'launch' ? 4 : 6, 0, Math.PI * 2);
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

  /** Redraws the whole canvas: the picture, the overlays that are switched on, then the markers. */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;

    if (picture.complete && picture.naturalWidth) {
      const [x, y] = toScreen(0, 0);
      ctx.drawImage(picture, x, y, WORLD.width * cam.scale, WORLD.height * cam.scale);
    }

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

  canvas.addEventListener('pointerdown', (event) => {
    const [x, y] = toWorld(event.offsetX, event.offsetY);

    // Waiting to add a place: this click says where.
    if (on.adding()) return on.add(x, y);

    const p = hit(event.offsetX, event.offsetY);
    canvas.setPointerCapture(event.pointerId);

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
    if (!action) return;

    if (action.drag) {
      const [x, y] = toWorld(event.offsetX, event.offsetY);
      on.move(action.drag, x + action.dx, y + action.dy, !action.moved);
      action.moved = true;
      return;
    }

    cam.x -= (event.offsetX - action.sx) / cam.scale;
    cam.y -= (event.offsetY - action.sy) / cam.scale;
    action.sx = event.offsetX;
    action.sy = event.offsetY;
    action.moved = true;
    draw();
  });

  canvas.addEventListener('pointerup', () => {
    // A click on empty map that didn't pan clears the selection.
    if (action?.pan && !action.moved) on.select(null);
    action = null;
  });

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      // Zoom about the pointer: the world spot under it stays under it.
      const [x, y] = toWorld(event.offsetX, event.offsetY);
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      cam.scale = Math.min(1, Math.max(fitScale() * 0.8, cam.scale * factor));
      cam.x = x - event.offsetX / cam.scale;
      cam.y = y - event.offsetY / cam.scale;
      draw();
    },
    { passive: false },
  );

  new ResizeObserver(resize).observe(canvas);
  picture.onload = draw;
  picture.src = overviewUrl;

  return {
    draw,

    // Moves the camera so a world spot is in the middle of the canvas.
    centerOn: (x, y) => {
      cam.x = x - canvas.width / 2 / cam.scale;
      cam.y = y - canvas.height / 2 / cam.scale;
      draw();
    },

    // Switches an overlay ('regions' or 'blocked') on or off.
    setOverlay: (name, shown) => {
      overlays[name] = shown;
      draw();
    },
  };
}
