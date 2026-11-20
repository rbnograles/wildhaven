// Draws the map's real ground for the world editor when it is zoomed in. The map has eleven tile
// layers of 448 by 320 tiles; drawing them tile by tile on every mouse move would be far too slow,
// so each block of 16 by 16 tiles is painted once onto its own small canvas and reused.

import MAP from '../../assets/world/map/wildhaven.json';
import tilesetUrl from '../../assets/world/map/tileset.png';

/** One tile's width in world units. */
const TILE = MAP.tilewidth;

/** A chunk is this many tiles wide and tall. */
const CHUNK = 16;

/**
 * How many pixels wide a tile is painted in a chunk canvas. Zoomed out, half size is plenty and
 * keeps the canvases small. From `FULL_ZOOM` the ground is painted at the tileset's own size, so
 * it is as crisp as the sprites standing on it instead of a stretched half-size copy.
 */
const HALF = TILE / 2;
const FULL_ZOOM = 0.5;

/**
 * At most this many chunk canvases are kept at each size. A half-size chunk is 512 pixels square
 * (about 1 MB) and a full-size one 1024 square (about 4 MB), so fewer of the big ones are kept;
 * zoomed in that far, far fewer are on screen anyway.
 */
const KEEP = { [HALF]: 96, [TILE]: 40 };

/** At most this many new chunks are painted per draw, so the first look at a place doesn't freeze. */
const PER_DRAW = 6;

/** The map's tile layers, bottom to top, in the map's own order. */
const LAYERS = MAP.layers.filter((layer) => layer.type === 'tilelayer');

/** Where the tiles sit in the tileset picture: margin, spacing and columns. */
const SET = MAP.tilesets[0];

/**
 * Sets up the chunked ground painter.
 *
 * @param {() => void} onReady - Called when the tileset picture has loaded, to draw again.
 * @returns {{ready: Function, draw: Function}} The painter.
 */
export function createTiles(onReady) {
  const sheet = new Image();
  sheet.onload = onReady;
  sheet.src = tilesetUrl;

  /**
   * Chunk canvases for each tile size, by 'cx,cy', oldest first, so the least recently used can
   * be dropped.
   */
  const caches = { [HALF]: new Map(), [TILE]: new Map() };

  /**
   * Paints one chunk: every layer's tiles for a 16 by 16 block.
   *
   * @param {number} cx - The chunk's column.
   * @param {number} cy - The chunk's row.
   * @param {number} px - How many pixels wide each tile is painted.
   * @returns {HTMLCanvasElement} The painted chunk.
   */
  function paint(cx, cy, px) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = CHUNK * px;
    const ctx = canvas.getContext('2d');

    for (const layer of LAYERS)
      for (let ty = 0; ty < CHUNK; ty++)
        for (let tx = 0; tx < CHUNK; tx++) {
          const col = cx * CHUNK + tx,
            row = cy * CHUNK + ty;
          if (col >= MAP.width || row >= MAP.height) continue;

          const gid = layer.data[row * MAP.width + col];
          if (!gid) continue;

          // A tile's place in the tileset picture, allowing for its margin and spacing.
          const n = gid - SET.firstgid;
          const sx = SET.margin + (n % SET.columns) * (TILE + SET.spacing);
          const sy = SET.margin + Math.floor(n / SET.columns) * (TILE + SET.spacing);
          ctx.drawImage(sheet, sx, sy, TILE, TILE, tx * px, ty * px, px, px);
        }

    return canvas;
  }

  return {
    // Says whether the tileset picture has loaded.
    ready: () => sheet.complete && sheet.naturalWidth > 0,

    // Draws the ground for the part of the world on screen. Returns true if some chunks are
    // still to be painted, so the caller should draw again soon.
    draw(ctx, cam, width, height) {
      const size = CHUNK * TILE;
      const px = cam.scale >= FULL_ZOOM ? TILE : HALF;
      const cache = caches[px];
      const c0 = Math.max(0, Math.floor(cam.x / size)),
        r0 = Math.max(0, Math.floor(cam.y / size));
      const c1 = Math.min(
          Math.ceil(MAP.width / CHUNK) - 1,
          Math.floor((cam.x + width / cam.scale) / size),
        ),
        r1 = Math.min(
          Math.ceil(MAP.height / CHUNK) - 1,
          Math.floor((cam.y + height / cam.scale) / size),
        );
      let painted = 0,
        waiting = false;

      for (let cy = r0; cy <= r1; cy++)
        for (let cx = c0; cx <= c1; cx++) {
          const key = `${cx},${cy}`;
          let chunk = cache.get(key);

          if (!chunk) {
            if (painted >= PER_DRAW) {
              waiting = true;
              continue;
            }
            chunk = paint(cx, cy, px);
            painted++;
          }

          // Re-inserting moves the chunk to the "newest" end of the map.
          cache.delete(key);
          cache.set(key, chunk);

          // Whole-pixel edges, one pixel of overlap: no hairline seams between chunks.
          const x = Math.floor((cx * size - cam.x) * cam.scale),
            y = Math.floor((cy * size - cam.y) * cam.scale);
          const side = Math.ceil(size * cam.scale) + 1;
          ctx.drawImage(chunk, x, y, side, side);
        }

      while (cache.size > KEEP[px]) cache.delete(cache.keys().next().value);
      return waiting;
    },
  };
}
