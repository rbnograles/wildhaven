// Falling snow: soft white flakes that drift down over the screen while the player is in a snowy
// region, and thin out to nothing when they leave it. The flakes live on the screen, not in the
// world, but they slide against the camera so they seem to hang in the air the player walks through.

import { WORLD } from '../world/map.js';
import { inSnow } from '../world/regions.js';

// How many flakes there are, how fast the slowest and fastest fall (screen heights per second), how
// far the wind carries them sideways (screen widths per second), and how quickly the snowfall
// thickens or thins when the player crosses the region's edge (per second).
const FLAKES = 150,
  FALL_SLOW = 0.1,
  FALL_FAST = 0.26,
  WIND = 0.035,
  FADE_RATE = 1.4;

// The flakes are spread over an area this much bigger than the screen on every side, so the
// screen's edges stay covered when the camera zooms out or a flake sways.
const SPILL = 0.12;

// The colour of the faint rim drawn around each flake: the blue-grey of a shadow on snow.
const RIM_COLOR = 0x6d86ad;

// The snow sits above everything in the world but just under the night layer (WORLD.height + 0.5
// in render/lighting.js), so it dims after dark like everything else.
const DEPTH = WORLD.height + 0.4;

/**
 * Wraps a number into the range 0 to 1, like a flake leaving the bottom and coming back at the top.
 *
 * @param {number} value - Any number.
 * @returns {number} The same spot, between 0 (included) and 1.
 */
const wrap = (value) => value - Math.floor(value);

/**
 * Builds the snowfall for the world scene.
 *
 * @param {Phaser.Scene} scene - The world scene.
 * @param {boolean} reducedMotion - True when the player asked for less motion: the flakes hang still.
 * @returns {{draw: Function}} `draw(state, dt, camera, zoom)` updates the snow for one frame.
 */
export function createSnow(scene, reducedMotion) {
  const layer = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);

  // Each flake: where it is (u across and v down, as fractions of the snowy area), how big it is in
  // pixels, how fast it falls, how see-through it is, and where it is in its side-to-side sway.
  const flakes = Array.from({ length: FLAKES }, () => ({
    u: Math.random(),
    v: Math.random(),
    size: 1.6 + Math.random() * 2.6,
    fall: FALL_SLOW + Math.random() * (FALL_FAST - FALL_SLOW),
    alpha: 0.45 + Math.random() * 0.5,
    sway: Math.random() * Math.PI * 2,
  }));

  // `amount` is how thick the snowfall is, from 0 (none) to 1 (full). `last` is where the camera
  // was on the frame before, to tell how far it moved.
  let amount = 0,
    last = null,
    clock = 0;

  /**
   * Draws one frame of snow.
   *
   * Like shaking a snow globe that never settles: every flake sinks a little, sways, and is
   * carried by the wind. When the camera moves, the flakes slide the other way, so walking
   * forward feels like walking through them.
   *
   * @param {object} state - The game being played; the snow falls while its player is in the snow.
   * @param {number} dt - Seconds since the last frame.
   * @param {{x: number, y: number}} camera - Where the camera is looking, in world units.
   * @param {number} zoom - The camera's zoom.
   */
  function draw(state, dt, camera, zoom) {
    const { width, height } = scene.scale;
    const target = inSnow(state.player.x, state.player.y) ? 1 : 0;
    amount = reducedMotion
      ? target
      : amount + Math.sign(target - amount) * Math.min(Math.abs(target - amount), dt * FADE_RATE);

    // How far the camera moved this frame, as a fraction of the snowy area. A jump (travel by
    // signpost, waking at a camp) is not a walk, so it moves no flakes.
    const areaW = width * (1 + SPILL * 2),
      areaH = height * (1 + SPILL * 2);
    let du = 0,
      dv = 0;
    if (last && !reducedMotion) {
      du = ((camera.x - last.x) * zoom) / areaW;
      dv = ((camera.y - last.y) * zoom) / areaH;
      if (Math.abs(du) > 0.5 || Math.abs(dv) > 0.5) du = dv = 0;
    }
    last = { x: camera.x, y: camera.y };

    layer.clear();
    layer.setVisible(amount > 0);
    if (amount <= 0) return;

    // The camera zooms about the screen's middle, and this layer zooms with it. Dividing by the
    // zoom here means a flake drawn at a screen spot really lands on that spot.
    clock += reducedMotion ? 0 : dt;
    for (const flake of flakes) {
      if (!reducedMotion) {
        flake.u = wrap(flake.u + (WIND + Math.sin(clock * 1.3 + flake.sway) * 0.012) * dt - du);
        flake.v = wrap(flake.v + flake.fall * dt - dv);
      }
      const x = (flake.u * areaW - width * SPILL - width / 2) / zoom + width / 2,
        y = (flake.v * areaH - height * SPILL - height / 2) / zoom + height / 2;
      // A soft blue-grey rim under each white flake, so it still shows against white snow.
      layer.fillStyle(RIM_COLOR, flake.alpha * amount * 0.4);
      layer.fillCircle(x, y, (flake.size + 1.2) / zoom);
      layer.fillStyle(0xffffff, flake.alpha * amount);
      layer.fillCircle(x, y, flake.size / zoom);
    }
  }

  return { draw };
}
