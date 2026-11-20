// Footprints: the boot prints the player leaves on the ground while walking, which fade away after
// a few seconds. They are only a picture: nothing is saved and no game rule reads them. The prints
// are cut from the painted sheet by tools/prepare-sprite-art.py (soil, sand and snow; left and right).

import { MAP_OBJECTS, isDryLand, surfaceAt, elevationAt } from '../world/map.js';
import sheetUrl from '../../assets/world/effects/footprints.png';
import sheetSpec from '../../assets/world/effects/footprints.json';

// How far the player walks between two prints (world units), how far left or right of the walking
// line each foot lands, and how long a print is drawn (the sheet is painted at twice that size).
const STRIDE = 30,
  FOOT_SIDE = 8,
  PRINT_LENGTH = 20;

// How each kind of ground shows a print: `row` is its row of the sheet, `alpha` how strong a fresh
// print is, and `life` how many seconds it lasts. Sand and snow hold a clear print; on grass and
// earth it is only a faint mark, so a meadow is not covered in dark boot shapes. Snow keeps a
// print longest.
const GROUND = {
  earth: { row: 0, alpha: 0.5, life: 6 },
  sand: { row: 1, alpha: 0.75, life: 7 },
  snow: { row: 2, alpha: 0.85, life: 10 },
};

// A print spends the last part of its life fading out, this many seconds long.
const FADE = 2.5;

// The most prints drawn at once. When all are in use the oldest one is taken for the new print.
const MAX_PRINTS = 64;

// A jump longer than this in one frame is not a step (signpost travel, waking by a fire, loading
// a game), so no print is left and the walk starts counting again.
const JUMP = 120;

// Prints lie on the ground: above the tile layers and the flat things (bridges, stairs and small
// stones are at -1), under everything that stands up.
const DEPTH = -0.9;

// The plank bridges: [x, y] of each one's middle. No prints are left on the planks, which reach
// about this far left/right and up/down from the middle.
const BRIDGES = MAP_OBJECTS.filter((o) => o.name === 'bridge'),
  BRIDGE_HALF_WIDTH = 240,
  BRIDGE_HALF_HEIGHT = 70;

/**
 * Says whether a spot is ground that can take a boot print.
 *
 * Water, plank bridges and stone stairs don't: a print there would look painted on.
 *
 * @param {number} x - World x position.
 * @param {number} y - World y position.
 * @returns {boolean} True if a print may be left there.
 */
function holdsPrint(x, y) {
  if (!isDryLand(x, y) || elevationAt(x, y) === 's') return false;
  return !BRIDGES.some(
    (b) => Math.abs(x - b.x) < BRIDGE_HALF_WIDTH && Math.abs(y - b.y) < BRIDGE_HALF_HEIGHT,
  );
}

/**
 * Asks Phaser to download the sheet of boot prints. Call it from the scene's preload().
 *
 * @param {Phaser.Scene} scene - The world scene.
 */
export function preloadFootprints(scene) {
  scene.load.spritesheet('footprints', sheetUrl, {
    frameWidth: sheetSpec.cell[0],
    frameHeight: sheetSpec.cell[1],
  });
}

/**
 * Builds the footprints for the world scene.
 *
 * It keeps a small box of print pictures and reuses them, like a rubber stamp and a fixed number
 * of ink pads: each new step takes a free picture (or the oldest one) and stamps it on the ground.
 *
 * @param {Phaser.Scene} scene - The world scene, after its artwork has loaded.
 * @returns {{draw: Function}} `draw(state, dt)` updates the prints for one frame.
 */
export function createFootprints(scene) {
  const scale = PRINT_LENGTH / sheetSpec.cell[1];

  // Each print: its picture, how many seconds it has left, and its ground's `alpha` and `life`.
  const prints = Array.from({ length: MAX_PRINTS }, () => ({
    image: scene.add.image(0, 0, 'footprints', 0).setScale(scale).setDepth(DEPTH).setVisible(false),
    left: 0,
    ground: GROUND.earth,
  }));

  // `last` is where the player stood on the frame before, `walked` how far they have come since
  // the last print, `leftFoot` which boot is next, and `next` which picture is reused next.
  let last = null,
    walked = 0,
    leftFoot = true,
    next = 0;

  /**
   * Stamps one print on the ground beside the walking line.
   *
   * @param {number} x - World x of the player's feet.
   * @param {number} y - World y of the player's feet.
   * @param {number} dx - How far the player just moved left/right; with dy it gives the heading.
   * @param {number} dy - How far the player just moved up/down.
   */
  function stamp(x, y, dx, dy) {
    // The foot lands a little to the left or right of the line walked. Turning the heading a
    // quarter turn gives "left"; the right foot goes the other way.
    const length = Math.hypot(dx, dy),
      side = (leftFoot ? 1 : -1) * FOOT_SIDE,
      px = x + (dy / length) * side,
      py = y - (dx / length) * side;
    if (!holdsPrint(px, py)) return;

    const print = prints[next],
      ground = GROUND[surfaceAt(px, py)];
    next = (next + 1) % MAX_PRINTS;
    print.left = ground.life;
    print.ground = ground;

    // The painted boots point up the sheet, so they are turned a quarter turn more than the heading
    // (Phaser's angle 0 points east).
    print.image
      .setFrame(ground.row * 2 + (leftFoot ? 0 : 1))
      .setPosition(px, py)
      .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
      .setAlpha(ground.alpha)
      .setVisible(true);
  }

  /**
   * Updates the prints for one frame: fades the old ones and stamps a new one every stride.
   *
   * The distance comes from how far the player really moved, so a player pushing against a tree
   * leaves nothing, and running leaves prints just as far apart as walking.
   *
   * @param {object} state - The game being played; its player position is read. No prints in the boat.
   * @param {number} dt - Seconds since the last frame.
   */
  function draw(state, dt) {
    // Old prints fade out over their last FADE seconds, then their picture is free again.
    for (const print of prints) {
      if (print.left <= 0) continue;
      print.left -= dt;
      if (print.left <= 0) print.image.setVisible(false);
      else print.image.setAlpha(print.ground.alpha * Math.min(1, print.left / FADE));
    }

    const { x, y } = state.player,
      dx = last ? x - last.x : 0,
      dy = last ? y - last.y : 0,
      moved = Math.hypot(dx, dy);
    last = { x, y };

    // In the boat, or after a jump across the map, there is no walk to leave prints from.
    if (state.aboard || moved > JUMP) {
      walked = 0;
      return;
    }
    if (moved === 0) return;

    walked += moved;
    if (walked < STRIDE) return;
    walked = 0;
    stamp(x, y, dx, dy);
    leftFoot = !leftFoot;
  }

  return { draw };
}
