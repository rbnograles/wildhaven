// The maps: the corner minimap and the big world map, painted on plain 2D canvases. They show
// the overview picture under the fog of war, the places, signposts, old boats and camps the player
// knows about, their own boat, and the player. The renderer and the map dialog both call `drawMap`.
// The big map covers the whole world, land and sea border (448 by 320 tiles, so 7:5), and its
// canvas in ui/layout.js has the same shape (1120 by 800).

import { WORLD } from '../world/map.js';
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';
import { FOG_CELL } from '../data/balance.js';
import { FOG_GRID, fogCells, isRevealed } from '../world/fog.js';
import { HERDS } from '../world/animals.js';
import { DENS, WOLVES, wolfAlive } from '../world/wolves.js';
import { phaseOf } from '../world/clock.js';
import { FOG_RADIUS } from '../data/balance.js';

// The colour of a herd's dot on the maps, by kind.
const HERD_COLOURS = { deer: '#d9a066', rabbit: '#f4efe4', boar: '#5b3a24' };

// How many world units wide the corner minimap can show, nearest first. The player picks one with
// the mouse wheel or the + and - buttons on the minimap. The whole world would be too small to read.
export const MINI_VIEWS = [2048, 4096, 8192];

// Where the browser remembers which of MINI_VIEWS was picked. It is a setting of this browser, like
// a window's size, so it is not part of any character's save.
const ZOOM_KEY = 'wildhaven.minimapZoom';

// Which of MINI_VIEWS the minimap shows now (its place in the list). It starts at the middle one.
let zoomLevel = readZoom();

// How big a marker's round badge is, in canvas pixels from its middle to its rim.
const ICON_RADIUS = 13;

// The badge colours, so each kind of marker can still be told apart by colour alone.
const BADGE = { place: '#f7ecc5', signpost: '#ffd166', boat: '#d9b98c', camp: '#f08a3c' };

// The fog's colour (a deep green-grey) as red, green, blue, alpha (0-255). It is fully solid, so
// the shape of land the player hasn't seen stays a secret (GDD pillar 1: the world is the reward).
const FOG_RGBA = [38, 54, 45, 255];

// How far to turn the player's arrow, which is drawn pointing up (north), for each facing:
// 0 south, 1 west, 2 east, 3 north. The numbers are angles in radians, clockwise.
const ARROW_TURN = [Math.PI, -Math.PI / 2, Math.PI / 2, 0];

// How far to turn the arrow while the player walks diagonally: halfway between two of the turns
// above. The names are the ones the walk animation uses ('ne' is north-east, and so on).
const DIAGONAL_TURN = {
  ne: Math.PI / 4,
  se: (Math.PI * 3) / 4,
  sw: (-Math.PI * 3) / 4,
  nw: -Math.PI / 4,
};

// The fog picture: one pixel per fog square, remade only when the fog string changes.
const fogPicture = { fog: null, canvas: null };

/**
 * Makes (or reuses) a tiny picture of the fog: one pixel per square, clear where seen, dark where not.
 *
 * Stretched over the map with smoothing on, its square pixels blur into soft edges, like frost on
 * a window that is clear where you have wiped it.
 *
 * @param {string} fog - The character's fog string.
 * @returns {HTMLCanvasElement} The picture, FOG_GRID.cols by FOG_GRID.rows pixels.
 */
function fogCanvas(fog) {
  if (fogPicture.fog === fog) return fogPicture.canvas;
  const canvas = fogPicture.canvas ?? document.createElement('canvas');
  canvas.width = FOG_GRID.cols;
  canvas.height = FOG_GRID.rows;
  const ctx = canvas.getContext('2d'),
    image = ctx.createImageData(FOG_GRID.cols, FOG_GRID.rows);
  fogCells(fog).forEach((seen, i) => {
    if (!seen) image.data.set(FOG_RGBA, i * 4);
  });
  ctx.putImageData(image, 0, 0);
  Object.assign(fogPicture, { fog, canvas });
  return canvas;
}

/**
 * Reads the minimap zoom this browser remembered.
 *
 * Storage can be switched off (private windows do that), so any trouble just gives the middle zoom.
 *
 * @returns {number} A place in MINI_VIEWS.
 */
function readZoom() {
  try {
    const stored = Number(localStorage.getItem(ZOOM_KEY) ?? 1);
    return Number.isInteger(stored) && stored >= 0 && stored < MINI_VIEWS.length ? stored : 1;
  } catch {
    return 1;
  }
}

/**
 * Says which zoom the minimap is on.
 *
 * @returns {number} A place in MINI_VIEWS: 0 is the nearest view, the last is the farthest.
 */
export function miniZoom() {
  return zoomLevel;
}

/**
 * Zooms the minimap one step in or out, and remembers it for next time.
 *
 * Like turning a spyglass one click: it stops at the nearest and the farthest view.
 *
 * @param {number} step - -1 to zoom in (see less, bigger), 1 to zoom out (see more, smaller).
 * @returns {number} The new place in MINI_VIEWS.
 */
export function stepMiniZoom(step) {
  zoomLevel = Math.min(Math.max(zoomLevel + step, 0), MINI_VIEWS.length - 1);
  try {
    localStorage.setItem(ZOOM_KEY, String(zoomLevel));
  } catch {
    // Storage is off: the zoom still works, it just isn't remembered.
  }
  return zoomLevel;
}

/**
 * Draws one marker: a small round badge with a picture of the thing in it.
 *
 * Like a pin on a paper map with a tiny drawing on its head. The picture is the game's own sprite
 * shrunk to fit. With no picture (a place where nothing stands, or art that failed to load) the
 * badge shows a little flag instead.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas to paint on.
 * @param {HTMLImageElement|undefined} image - The sprite to show, if there is one.
 * @param {number} x - The badge's middle, in canvas pixels.
 * @param {number} y - The badge's middle, in canvas pixels.
 * @param {string} colour - The badge's fill colour (see BADGE).
 */
function drawIcon(ctx, image, x, y, colour) {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#294c3b';
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, ICON_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (image) {
    // The biggest size that keeps the whole sprite inside the badge, whatever its shape.
    const room = ICON_RADIUS * 1.5,
      scale = Math.min(room / image.width, room / image.height),
      w = image.width * scale,
      h = image.height * scale;
    ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
    return;
  }

  // The flag: a pole with a small pennant flying to the right.
  const top = y - ICON_RADIUS * 0.6,
    foot = y + ICON_RADIUS * 0.6,
    pole = x - ICON_RADIUS * 0.3;
  ctx.beginPath();
  ctx.moveTo(pole, foot);
  ctx.lineTo(pole, top);
  ctx.stroke();
  ctx.fillStyle = '#b5482f';
  ctx.beginPath();
  ctx.moveTo(pole, top);
  ctx.lineTo(pole + ICON_RADIUS * 0.8, top + ICON_RADIUS * 0.3);
  ctx.lineTo(pole, top + ICON_RADIUS * 0.6);
  ctx.closePath();
  ctx.fill();
}

/**
 * Paints a map: either the whole world, or a window around the player for the corner minimap.
 *
 * World positions are shrunk to fit the canvas, like tracing a big map onto a postcard. Parts of
 * the world the player hasn't seen are under fog. Every marker is a round badge with a small
 * picture of the thing itself (see `drawIcon`): found places are cream (the place's own sprite,
 * or a flag), found signposts gold, found old boats and the player's moored boat tan, and camps
 * orange (named on the big map). The player is the white arrow, which points the way they are
 * facing, or the way they are heading while they walk diagonally.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas to paint on.
 * @param {HTMLImageElement} overview - The picture of the whole world (overview.webp).
 * @param {object} state - The game being played.
 * @param {number} w - Canvas width in pixels.
 * @param {number} h - Canvas height in pixels.
 * @param {object} [options] - What kind of map to paint.
 * @param {number|null} [options.view=null] - How many world units wide a window around the player
 *   to show (one of MINI_VIEWS, for the minimap), or null for the whole world.
 * @param {string|null} [options.diagonal=null] - 'ne', 'nw', 'se' or 'sw' while the player is
 *   moving diagonally, so the arrow tilts that way; otherwise it points one of the four straight ways.
 * @param {Object<string, HTMLImageElement>} [options.icons={}] - Sprite name to its picture, for
 *   the markers. A missing one just shows the flag or an empty badge.
 */
export function drawMap(
  ctx,
  overview,
  state,
  w,
  h,
  { view = null, diagonal = null, icons = {} } = {},
) {
  // The part of the world this map shows, in world units.
  const local = view !== null,
    vw = local ? view : WORLD.width,
    vh = local ? (view * h) / w : WORLD.height,
    vx = local ? Math.min(Math.max(state.player.x - vw / 2, 0), WORLD.width - vw) : 0,
    vy = local ? Math.min(Math.max(state.player.y - vh / 2, 0), WORLD.height - vh) : 0;
  const sx = overview.width / WORLD.width,
    sy = overview.height / WORLD.height;
  /** Turns a world x position into a canvas x position. */
  const px = (x) => ((x - vx) / vw) * w,
    py = (y) => ((y - vy) / vh) * h;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(overview, vx * sx, vy * sy, vw * sx, vh * sy, 0, 0, w, h);

  // The fog: its tiny picture stretched over the same part of the world, smoothed for soft edges.
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    fogCanvas(state.fog),
    vx / FOG_CELL,
    vy / FOG_CELL,
    vw / FOG_CELL,
    vh / FOG_CELL,
    0,
    0,
    w,
    h,
  );

  // Found places: the place's own sprite in a cream badge, or a flag where nothing stands.
  for (const place of LANDMARKS) {
    if (!state.landmarks.includes(place.id)) continue;
    drawIcon(ctx, icons[place.object], px(place.x), py(place.y), BADGE.place);
  }

  // Found signposts: gold badges. On the big map a button sits over each one (ui/dialogs.js).
  for (const post of WAYPOINTS) {
    if (!state.waypoints.includes(post.id)) continue;
    drawIcon(ctx, icons.signpost, px(post.x), py(post.y), BADGE.signpost);
  }

  // Old boats found on the beach (not the one already mended).
  for (const wreck of WRECKS) {
    if (!state.wrecks.includes(wreck.id) || state.boat?.from === wreck.id) continue;
    drawIcon(ctx, icons['old-boat'], px(wreck.x), py(wreck.y), BADGE.boat);
  }

  // Herds the player has come across (their home is out of the fog): a small coloured dot for the
  // kind, light tan for deer, white for rabbits, dark brown for boars. Nothing shows under fog.
  for (const herd of HERDS) {
    if (!isRevealed(state, herd.x, herd.y)) continue;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#2b2116';
    ctx.fillStyle = HERD_COLOURS[herd.kind];
    ctx.beginPath();
    ctx.arc(px(herd.x), py(herd.y), local ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Wolf dens the player has come across: a dark grey dot with a red rim. At night the wolves out
  // roaming show as small red dots, but only those within the fog's reach of the player.
  for (const den of DENS) {
    if (!isRevealed(state, den.x, den.y)) continue;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b3312c';
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(px(den.x), py(den.y), local ? 4 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (phaseOf(state.time) === 'night')
    for (const w of WOLVES) {
      if (!wolfAlive(w) || Math.hypot(w.x - state.player.x, w.y - state.player.y) > FOG_RADIUS)
        continue;
      ctx.fillStyle = '#e04a3f';
      ctx.beginPath();
      ctx.arc(px(w.x), py(w.y), local ? 2.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

  // The player's boat while they are ashore, where it is moored.
  if (state.boat && !state.aboard)
    drawIcon(ctx, icons.rowboat, px(state.boat.x), py(state.boat.y), BADGE.boat);

  // Camps: a campfire in an orange badge. The big map also writes each camp's name below it,
  // where it is less likely to sit under a region's name label.
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const camp of state.camps) {
    const x = px(camp.x),
      y = py(camp.y);
    drawIcon(ctx, icons.campfire, x, y, BADGE.camp);
    if (local) continue;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#263b31';
    ctx.strokeText(camp.name, x, y + ICON_RADIUS + 18);
    ctx.fillStyle = '#fff6df';
    ctx.fillText(camp.name, x, y + ICON_RADIUS + 18);
  }

  // The player: an arrowhead with a notched tail, turned to point the way they face.
  // The minimap's canvas is drawn smaller than its pixel size, so its arrow is made bigger to match.
  const size = local ? 13 : 11;
  ctx.save();
  ctx.translate(px(state.player.x), py(state.player.y));
  ctx.rotate(DIAGONAL_TURN[diagonal] ?? ARROW_TURN[state.player.direction] ?? ARROW_TURN[0]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#294c3b';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.75, size * 0.8);
  ctx.lineTo(0, size * 0.35);
  ctx.lineTo(-size * 0.75, size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
