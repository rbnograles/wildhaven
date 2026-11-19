// The maps: the corner minimap and the big world map, painted on plain 2D canvases. They show
// the overview picture under the fog of war, the places, signposts and camps the player knows
// about, and the player. The renderer and the map dialog both call `drawMap`.

import { WORLD } from '../world/map.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import { FOG_CELL } from '../data/balance.js';
import { FOG_GRID, fogCells } from '../world/fog.js';

// How many world units wide the corner minimap shows. The whole world would be too small to read.
const MINI_VIEW = 4096;

// The fog's colour (a deep green-grey) as red, green, blue, alpha (0-255). It is fully solid, so
// the shape of land the player hasn't seen stays a secret (GDD pillar 1: the world is the reward).
const FOG_RGBA = [38, 54, 45, 255];

// How far to turn the player's arrow, which is drawn pointing up (north), for each facing:
// 0 south, 1 west, 2 east, 3 north. The numbers are angles in radians, clockwise.
const ARROW_TURN = [Math.PI, -Math.PI / 2, Math.PI / 2, 0];

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
 * Paints a map: either the whole world, or a window around the player for the corner minimap.
 *
 * World positions are shrunk to fit the canvas, like tracing a big map onto a postcard. Parts of
 * the world the player hasn't seen are under fog. Found places are cream dots, found signposts
 * gold diamonds, camps orange dots (named on the big map), and the player is the white arrow,
 * which points the way they are facing.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas to paint on.
 * @param {HTMLImageElement} overview - The picture of the whole world (overview.webp).
 * @param {object} state - The game being played.
 * @param {number} w - Canvas width in pixels.
 * @param {number} h - Canvas height in pixels.
 * @param {boolean} [local=false] - True to show only the area around the player.
 */
export function drawMap(ctx, overview, state, w, h, local = false) {
  // The part of the world this map shows, in world units.
  const vw = local ? MINI_VIEW : WORLD.width,
    vh = local ? (MINI_VIEW * h) / w : WORLD.height,
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

  // Found places: small cream dots.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#294c3b';
  ctx.fillStyle = '#f7ecc5';
  for (const place of LANDMARKS) {
    if (!state.landmarks.includes(place.id)) continue;
    ctx.beginPath();
    ctx.arc(px(place.x), py(place.y), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Found signposts: gold diamonds. On the big map a button sits over each one (ui/dialogs.js).
  ctx.fillStyle = '#ffd166';
  for (const post of WAYPOINTS) {
    if (!state.waypoints.includes(post.id)) continue;
    const x = px(post.x),
      y = py(post.y);
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Camps: orange dots. The big map also writes each camp's name below its dot, where it is less
  // likely to sit under a region's name label.
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const camp of state.camps) {
    const x = px(camp.x),
      y = py(camp.y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#3b2412';
    ctx.fillStyle = '#f08a3c';
    ctx.beginPath();
    ctx.arc(x, y, local ? 4 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (local) continue;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#263b31';
    ctx.strokeText(camp.name, x, y + 24);
    ctx.fillStyle = '#fff6df';
    ctx.fillText(camp.name, x, y + 24);
  }

  // The player: an arrowhead with a notched tail, turned to point the way they face.
  // The minimap's canvas is drawn smaller than its pixel size, so its arrow is made bigger to match.
  const size = local ? 13 : 11;
  ctx.save();
  ctx.translate(px(state.player.x), py(state.player.y));
  ctx.rotate(ARROW_TURN[state.player.direction] ?? ARROW_TURN[0]);
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
