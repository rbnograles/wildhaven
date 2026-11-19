// Loads the character sprite sheets (big pictures holding every animation frame) in the browser.
// It finds where each small picture sits inside a sheet, so the game can cut out the right one,
// and it offers a simple painter that the animation preview dialog uses.
import idleUrl from '../../assets/characters/starting-characters-idle-v1.png';
import sideWalkUrl from '../../assets/characters/animations/side-walk-v2.png';
import scoutRun from '../../assets/characters/animations/scout-run-v2.png';
import builderRun from '../../assets/characters/animations/builder-run-v2.png';
import survivorRun from '../../assets/characters/animations/survivor-run-v2.png';
import scoutWalk from '../../assets/characters/animations/scout-locomotion.png';
import builderWalk from '../../assets/characters/animations/builder-locomotion.png';
import survivorWalk from '../../assets/characters/animations/survivor-locomotion.png';
import scoutActions from '../../assets/characters/animations/scout-actions.png';
import builderActions from '../../assets/characters/animations/builder-actions.png';
import survivorActions from '../../assets/characters/animations/survivor-actions.png';
import { CHARACTERS } from '../data/characters.js';
import { sampleAnimation, steadyAnchors } from './clips.js';

/**
 * Each character's walking (`locomotion`) and action sheets.
 *
 * `url` is the image file. `edges` are the y positions where one row of frames ends and the
 * next begins, top to bottom. Measured transparent gutters, rather than assumed equal rows,
 * preserve all generated poses. If a sheet is redrawn, measure its edges again.
 */
const SOURCES = {
  scout: {
    locomotion: { url: scoutWalk, edges: [0, 228, 447, 663, 889, 1112, 1331, 1547, 1774] },
    actions: { url: scoutActions, edges: [0, 295, 592, 852, 1153, 1402] },
  },
  builder: {
    locomotion: { url: builderWalk, edges: [0, 228, 446, 667, 891, 1109, 1332, 1552, 1774] },
    actions: { url: builderActions, edges: [0, 308, 627, 890, 1190, 1402] },
  },
  survivor: {
    locomotion: { url: survivorWalk, edges: [0, 241, 456, 675, 902, 1119, 1331, 1554, 1774] },
    actions: { url: survivorActions, edges: [0, 298, 602, 883, 1188, 1402] },
  },
};

/**
 * Loads one image file and waits until it is ready to draw.
 *
 * It gives up after 15 seconds, so a slow or broken download ends in a friendly error message
 * (and the loading screen's retry button) instead of waiting forever.
 *
 * @param {string} url - Where the image file is.
 * @param {string} [label='character artwork'] - What to call the image in the error message.
 * @returns {Promise<HTMLImageElement>} The loaded image.
 */
export function loadImage(url, label = 'character artwork') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => reject(new Error(`The ${label} took too long to load. Please try again.`)),
      15000,
    );

    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`We could not load the ${label}. Please try again.`));
    };
    image.src = url;
  });
}

/**
 * Finds the exact box around each character pose on a sprite sheet.
 *
 * A sheet is a grid of pictures. Each cell has empty, see-through space around the character,
 * so this looks at every pixel and keeps only the part that is actually drawn (alpha above 40).
 * It also finds where the head is, so walking frames can be lined up without wobbling.
 *
 * @param {HTMLImageElement} image - The loaded sprite sheet.
 * @param {number[]} edges - The y positions where each row of frames starts and ends.
 * @param {boolean} [steady=false] - Line frames up by the head (see `steadyAnchors`) instead of the cell centre.
 * @param {number} [columns=4] - How many equal-width columns the sheet has.
 * @returns {{image: HTMLImageElement, frames: object[][], referenceHeight: number}} The image, each
 *   frame's box as `frames[row][column]`, and the height used to size the whole sheet.
 */
function measureFrames(image, edges, steady = false, columns = 4) {
  // Copy the image onto a hidden canvas so its pixels can be read.
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser could not prepare the animation frames.');
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);

  const frames = [];
  for (let row = 0; row < edges.length - 1; row++) {
    const strip = [];
    for (let col = 0; col < columns; col++) {
      const left = Math.round((col * image.width) / columns),
        right = Math.round(((col + 1) * image.width) / columns),
        top = edges[row],
        bottom = edges[row + 1];

      // Shrink a box around every visible pixel in this cell.
      let minX = right,
        minY = bottom,
        maxX = left,
        maxY = top;
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++) {
          if (data[(y * image.width + x) * 4 + 3] > 40) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      if (minX > maxX || minY > maxY)
        throw new Error('An animation frame is empty. Please reload the artwork.');

      // Centre of the head band (top quarter of the cell height, limbs never reach it).
      let headSum = 0,
        headCount = 0;
      for (let y = minY, end = Math.min(maxY, minY + Math.round((bottom - top) / 4)); y <= end; y++)
        for (let x = minX; x <= maxX; x++) {
          if (data[(y * image.width + x) * 4 + 3] > 40) {
            headSum += x;
            headCount++;
          }
        }

      strip.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        anchorX: (left + right) / 2,
        headX: headSum / headCount,
      });
    }

    if (steady) {
      const anchors = steadyAnchors(
        strip.map((frame) => frame.anchorX),
        strip.map((frame) => frame.headX),
      );
      strip.forEach((frame, i) => {
        frame.anchorX = anchors[i];
      });
    }
    frames.push(strip);
  }

  // One scale per sheet preserves crouching and horizontal swimming proportions.
  return { image, frames, referenceHeight: Math.max(...frames[0].map((frame) => frame.height)) };
}

// The shared promise from the first loadCharacterSheets call, so the sheets load only once.
let cached;

/**
 * Loads and measures every character sprite sheet, once.
 *
 * The first call starts the downloads; later calls get the same answer without loading again.
 * If loading fails, the memory is cleared so the next call (a retry) can try again.
 * Resolves to {idle, profile, atlases:{[characterId]:{locomotion, actions, run}}}; each sheet is
 * {image, frames[row][col], referenceHeight}.
 *
 * @returns {Promise<{idle: object, profile: object, atlases: object}>} Every measured sheet.
 */
export function loadCharacterSheets() {
  if (cached) return cached;
  cached = (async () => {
    // Sheets every character shares: standing still, and walking sideways.
    const idle = measureFrames(await loadImage(idleUrl), [0, 418, 836, 1254]);
    const profile = measureFrames(await loadImage(sideWalkUrl), [0, 418, 836, 1254], true);

    // Each character's own sheets, loaded side by side.
    const atlases = {};
    await Promise.all(
      CHARACTERS.map(async (character) => {
        const source = SOURCES[character.id];
        const sheets = await Promise.all(
          ['locomotion', 'actions'].map(async (name) => [
            name,
            measureFrames(await loadImage(source[name].url), source[name].edges),
          ]),
        );
        atlases[character.id] = Object.fromEntries(sheets);

        // Run sheets: [image, row edges]. Each has 3 rows (south, east, north) of 6 frames.
        const runSheets = {
          scout: [scoutRun, [0, 290, 579, 887]],
          builder: [builderRun, [0, 292, 579, 887]],
          survivor: [survivorRun, [0, 294, 583, 887]],
        };
        const [url, edges] = runSheets[character.id];
        atlases[character.id].run = measureFrames(await loadImage(url), edges, true, 6);
      }),
    );
    return { idle, atlases, profile };
  })().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}

/**
 * Finds the exact picture to draw for a character's pose.
 *
 * `sampleAnimation` says "walk, frame 2, facing east"; this turns that into the real sheet and
 * the box on it. Walking west or east uses the shared side-walk sheet instead. The 2D-canvas
 * painter below and the Phaser renderer both draw from this.
 *
 * @param {object} sheets - The result of `loadCharacterSheets`.
 * @param {string} characterId - Which character, such as `scout`.
 * @param {string} clip - The animation name, such as `walk`.
 * @param {number} time - Seconds the clip has been playing.
 * @param {number} direction - Facing: 0 south, 1 west, 2 east, 3 north.
 * @param {boolean} [loop] - Start the clip over at the end. Defaults to the clip's own setting.
 * @returns {{sheet: object, key: string, name: string, frame: object, flip: boolean, lift: number}}
 *   The sheet, its texture key, the frame's `row-column` name and box, whether to mirror it, and its lift.
 */
export function resolvePose(sheets, characterId, clip, time, direction, loop) {
  const sample = sampleAnimation(clip, time, direction, loop);
  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];

  // Walking sideways uses the shared side-walk sheet; standing uses the shared idle sheet.
  const profile = clip === 'walk' && (direction === 1 || direction === 2);
  const key = profile
    ? 'profile'
    : sample.sheet === 'idle'
      ? 'idle'
      : character.id + '-' + sample.sheet;
  const sheet = sheets[key] ?? sheets.atlases[character.id][sample.sheet];

  // Shared sheets have one row per character; on the idle sheet each column is a direction.
  const row = profile || sample.sheet === 'idle' ? character.row : sample.row;
  const column = sample.sheet === 'idle' ? sample.direction : sample.frame;
  return {
    sheet,
    key,
    name: row + '-' + column,
    frame: sheet.frames[row][column],
    flip: sample.flip || (profile && direction === 1),
    lift: sample.lift,
  };
}

/**
 * Loads the sheets and gives back a simple painter for a plain 2D canvas.
 *
 * The animation preview dialog uses it to show a character moving, without starting the game.
 *
 * @returns {Promise<{draw: Function}>} An object whose `draw` paints one pose.
 */
export async function loadCharacterPainter() {
  const sheets = await loadCharacterSheets();
  return {
    /**
     * Paints one character pose onto a canvas, standing with its feet at (x, y).
     *
     * @param {CanvasRenderingContext2D} ctx - The canvas to paint on.
     * @param {string} characterId - Which character, such as `scout`.
     * @param {string} clip - The animation name, such as `walk`.
     * @param {number} time - Seconds the clip has been playing.
     * @param {number} direction - Facing: 0 south, 1 west, 2 east, 3 north.
     * @param {number} x - Where the feet go, across.
     * @param {number} y - Where the feet go, down.
     * @param {number} [height=105] - How tall to draw the character, in pixels.
     * @param {boolean} [loop] - Start the clip over at the end. Defaults to the clip's own setting.
     */
    draw(ctx, characterId, clip, time, direction, x, y, height = 105, loop) {
      const { sheet, frame, flip, lift } = resolvePose(
        sheets,
        characterId,
        clip,
        time,
        direction,
        loop,
      );
      const scale = height / sheet.referenceHeight;

      // Move the pen to the feet (raised for running lift-off) and mirror if facing west.
      ctx.save();
      ctx.translate(x, y - height * lift);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(
        sheet.image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        (frame.x - frame.anchorX) * scale,
        -frame.height * scale,
        frame.width * scale,
        frame.height * scale,
      );
      ctx.restore();
    },
  };
}
