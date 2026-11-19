// Blends the four pictures of a water effect so it changes smoothly instead of flickering.
// The two images share a small opacity budget, keeping the ground texture visible beneath them.

/**
 * Finds two neighboring water frames and how faintly each should be drawn.
 *
 * @param {number} time - Seconds the world has been drawn for.
 * @param {number} fps - Frames advanced per second.
 * @param {number} start - This patch's starting point in the four-frame loop.
 * @returns {{frame: number, next: number, alpha: number, nextAlpha: number}} Frames and opacities.
 */
export function waterBlend(time, fps, start) {
  const phase = Math.abs(time) * fps + start;
  const frame = Math.floor(phase) % 4;
  const fraction = phase % 1;
  const mix = fraction * fraction * (3 - 2 * fraction);
  return { frame, next: (frame + 1) % 4, alpha: 0.22 * (1 - mix), nextAlpha: 0.22 * mix };
}
