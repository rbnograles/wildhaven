// Night lighting: a dark layer laid over the world that thickens at dusk and night, with soft
// holes of light around each campfire (as wide as its warmth reaches) and a small glow around the
// player. Like shining torches through a dark blanket, the lights burn clear patches into it.

import * as Phaser from 'phaser';
import { WORLD } from '../world/map.js';
import { darknessAt, NIGHT_DARK } from '../world/clock.js';
import { fireRadius } from '../world/camps.js';

// The night's colour (a blue so deep it is almost black), the glow around the player (world
// units), the light picture's size (pixels), and how far past the screen edge the dark layer
// reaches (world units).
const NIGHT_COLOR = 0x040813,
  PLAYER_LIGHT = 150,
  LIGHT_SIZE = 256,
  EDGE = 64;

// The Canvas renderer can't cut holes of light, so its plain layer never gets darker than this:
// a nearly black night with no light at all would hide the player too.
const FLAT_DARK = 0.6;

// The dark layer sits above everything in the world, but below the E key cap and progress bar.
const DEPTH = WORLD.height + 0.5;

/**
 * Builds the night layer for the world scene.
 *
 * @param {Phaser.Scene} scene - The world scene.
 * @param {boolean} reducedMotion - True when the player asked for less motion: fires don't flicker.
 * @returns {{draw: Function}} `draw(state, area)` updates the layer for one frame.
 */
export function createLighting(scene, reducedMotion) {
  // A round light: solid in the middle, fading to nothing at the edge. Painted once.
  const light = scene.textures.createCanvas('night-light', LIGHT_SIZE, LIGHT_SIZE);
  const ctx = light.getContext(),
    half = LIGHT_SIZE / 2,
    gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LIGHT_SIZE, LIGHT_SIZE);
  light.refresh();

  // WebGL can cut lights out of a render texture. The Canvas renderer gets a plain dim layer.
  const webgl = scene.renderer.type === Phaser.WEBGL;
  const layer = webgl
    ? scene.add.renderTexture(0, 0, 2, 2)
    : scene.add.rectangle(0, 0, 2, 2, NIGHT_COLOR);
  layer.setOrigin(0, 0).setDepth(DEPTH).setVisible(false);
  const stamp = scene.make.image({ key: 'night-light' }, false).setOrigin(0.5);

  // Warm orange glows over the fires, made the first time each is needed and reused after.
  const glows = [];

  /**
   * Gives the warm glow for one fire, making it the first time.
   *
   * @param {number} i - Which glow, counting from 0.
   * @returns {Phaser.GameObjects.Image} The glow picture.
   */
  function glowAt(i) {
    glows[i] ??= scene.add
      .image(0, 0, 'night-light')
      .setTint(0xff9a3c)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH + 0.01);
    return glows[i];
  }

  /**
   * Redraws the night layer for this frame.
   *
   * @param {object} state - The game being played (its clock, camps and player).
   * @param {{x: number, y: number, width: number, height: number}} area - The part of the world
   *   the camera shows, in world units.
   */
  function draw(state, area) {
    const darkness = darknessAt(state.time);
    layer.setVisible(darkness > 0);
    for (const glow of glows) glow.setVisible(false);
    if (darkness <= 0) return;

    // Cover the camera's view plus a margin. Even sizes stop the render texture resizing every frame.
    const left = area.x - EDGE,
      top = area.y - EDGE,
      width = 2 * Math.ceil(area.width / 2 + EDGE),
      height = 2 * Math.ceil(area.height / 2 + EDGE);
    layer.setPosition(left, top);
    if (!webgl) {
      layer.setSize(width, height).setFillStyle(NIGHT_COLOR, Math.min(darkness, FLAT_DARK));
      return;
    }
    if (layer.width !== width || layer.height !== height) layer.resize(width, height);

    // Fill the dark, then erase a soft hole as wide as each fire's warmth, and a small one for the player.
    const flicker = reducedMotion ? 1 : 1 + Math.sin(performance.now() / 110) * 0.025;
    layer.clear().fill(NIGHT_COLOR, darkness);
    state.camps.forEach((camp, i) => {
      const radius = fireRadius(camp) * flicker;
      stamp.setScale((radius * 2) / LIGHT_SIZE);
      layer.erase(stamp, camp.x - left, camp.y - top);
      glowAt(i)
        .setPosition(camp.x, camp.y - 30)
        .setScale((radius * 1.1) / LIGHT_SIZE)
        .setAlpha((0.45 * darkness) / NIGHT_DARK)
        .setVisible(true);
    });
    stamp.setScale((PLAYER_LIGHT * 2) / LIGHT_SIZE);
    layer.erase(stamp, state.player.x - left, state.player.y - 40 - top);
    layer.render();
  }

  return { draw };
}
