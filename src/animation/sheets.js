// Loads the character sprite sheets (big pictures holding every animation frame) in the browser.
// It finds where each small picture sits inside a sheet, so the game can cut out the right one,
// and it offers a simple painter that the animation preview dialog uses.
// Each character's sheets sit in its own folder: assets/characters/scout/, builder/, survivor/.
import scoutIdle from '../../assets/characters/scout/scout-idle-v1.png';
import builderIdle from '../../assets/characters/builder/builder-idle-v1.png';
import survivorIdle from '../../assets/characters/survivor/survivor-idle-v1.png';
import scoutIdleLoop from '../../assets/characters/scout/scout-idle-loop.png';
import builderIdleLoop from '../../assets/characters/builder/builder-idle-loop.png';
import survivorIdleLoop from '../../assets/characters/survivor/survivor-idle-loop.png';
import scoutChop from '../../assets/characters/scout/scout-axe-stone.png';
import scoutChopIron from '../../assets/characters/scout/scout-axe-iron.png';
import scoutMine from '../../assets/characters/scout/scout-pickaxe-stone.png';
import scoutMineIron from '../../assets/characters/scout/scout-pickaxe-iron.png';
import builderChop from '../../assets/characters/builder/builder-axe-stone.png';
import builderChopIron from '../../assets/characters/builder/builder-axe-iron.png';
import builderMine from '../../assets/characters/builder/builder-pickaxe-stone.png';
import builderMineIron from '../../assets/characters/builder/builder-pickaxe-iron.png';
import survivorChop from '../../assets/characters/survivor/survivor-axe-stone.png';
import survivorChopIron from '../../assets/characters/survivor/survivor-axe-iron.png';
import survivorMine from '../../assets/characters/survivor/survivor-pickaxe-stone.png';
import survivorMineIron from '../../assets/characters/survivor/survivor-pickaxe-iron.png';
import scoutSword from '../../assets/characters/scout/scout-sword-stone.png';
import builderSword from '../../assets/characters/builder/builder-sword-stone.png';
import survivorSword from '../../assets/characters/survivor/survivor-sword-stone.png';
import scoutSwordIron from '../../assets/characters/scout/scout-sword-iron.png';
import builderSwordIron from '../../assets/characters/builder/builder-sword-iron.png';
import survivorSwordIron from '../../assets/characters/survivor/survivor-sword-iron.png';
import scoutBow from '../../assets/characters/scout/scout-bow-stone.png';
import builderBow from '../../assets/characters/builder/builder-bow-stone.png';
import survivorBow from '../../assets/characters/survivor/survivor-bow-stone.png';
import scoutBowIron from '../../assets/characters/scout/scout-bow-iron.png';
import builderBowIron from '../../assets/characters/builder/builder-bow-iron.png';
import survivorBowIron from '../../assets/characters/survivor/survivor-bow-iron.png';
import scoutSideWalk from '../../assets/characters/scout/scout-side-walk-v2.png';
import builderSideWalk from '../../assets/characters/builder/builder-side-walk-v2.png';
import survivorSideWalk from '../../assets/characters/survivor/survivor-side-walk-v2.png';
import scoutRun from '../../assets/characters/scout/scout-run-v2.png';
import builderRun from '../../assets/characters/builder/builder-run-v2.png';
import survivorRun from '../../assets/characters/survivor/survivor-run-v2.png';
import scoutWalk from '../../assets/characters/scout/scout-locomotion.png';
import builderWalk from '../../assets/characters/builder/builder-locomotion.png';
import survivorWalk from '../../assets/characters/survivor/survivor-locomotion.png';
import scoutActions from '../../assets/characters/scout/scout-actions.png';
import builderActions from '../../assets/characters/builder/builder-actions.png';
import survivorActions from '../../assets/characters/survivor/survivor-actions.png';
import scoutSleep from '../../assets/characters/scout/scout-sleeping.png';
import builderSleep from '../../assets/characters/builder/builder-sleeping.png';
import survivorSleep from '../../assets/characters/survivor/survivor-sleeping.png';
import scoutWake from '../../assets/characters/scout/scout-waking-up.png';
import builderWake from '../../assets/characters/builder/builder-waking-up.png';
import survivorWake from '../../assets/characters/survivor/survivor-waking-up.png';
import scoutHungry from '../../assets/characters/scout/scout-hungry.png';
import builderHungry from '../../assets/characters/builder/builder-hungry.png';
import survivorHungry from '../../assets/characters/survivor/survivor-hungry.png';
import scoutHurtHunger from '../../assets/characters/scout/scout-damage-hunger.png';
import builderHurtHunger from '../../assets/characters/builder/builder-damage-hunger.png';
import survivorHurtHunger from '../../assets/characters/survivor/survivor-damage-hunger.png';
import scoutHurtCold from '../../assets/characters/scout/scout-damage-cold.png';
import builderHurtCold from '../../assets/characters/builder/builder-damage-cold.png';
import survivorHurtCold from '../../assets/characters/survivor/survivor-damage-cold.png';
import scoutHurtAttack from '../../assets/characters/scout/scout-damage-attack.png';
import builderHurtAttack from '../../assets/characters/builder/builder-damage-attack.png';
import survivorHurtAttack from '../../assets/characters/survivor/survivor-damage-attack.png';
import scoutRepel from '../../assets/characters/scout/scout-repel.png';
import builderRepel from '../../assets/characters/builder/builder-repel.png';
import survivorRepel from '../../assets/characters/survivor/survivor-repel.png';
import scoutDying from '../../assets/characters/scout/scout-dying-v2.png';
import builderDying from '../../assets/characters/builder/builder-dying-v2.png';
import survivorDying from '../../assets/characters/survivor/survivor-dying-v2.png';
import scoutWalkNE from '../../assets/characters/scout/scout-walk-ne.png';
import builderWalkNE from '../../assets/characters/builder/builder-walk-ne.png';
import survivorWalkNE from '../../assets/characters/survivor/survivor-walk-ne.png';
import scoutWalkSE from '../../assets/characters/scout/scout-walk-se.png';
import builderWalkSE from '../../assets/characters/builder/builder-walk-se.png';
import survivorWalkSE from '../../assets/characters/survivor/survivor-walk-se.png';
import scoutRunNE from '../../assets/characters/scout/scout-run-ne.png';
import builderRunNE from '../../assets/characters/builder/builder-run-ne.png';
import survivorRunNE from '../../assets/characters/survivor/survivor-run-ne.png';
import scoutRunSE from '../../assets/characters/scout/scout-run-se.png';
import builderRunSE from '../../assets/characters/builder/builder-run-se.png';
import survivorRunSE from '../../assets/characters/survivor/survivor-run-se.png';
import settlersIdle from '../../assets/characters/settlers/settlers-idle.png';
import settlersWalkSouth from '../../assets/characters/settlers/settlers-walk-south.png';
import settlersWalkEast from '../../assets/characters/settlers/settlers-walk-east.png';
import settlersWalkNorth from '../../assets/characters/settlers/settlers-walk-north.png';
import settlersRunNE from '../../assets/characters/settlers/settlers-run-ne.png';
import settlersRunSE from '../../assets/characters/settlers/settlers-run-se.png';
import settlersCarry from '../../assets/characters/settlers/settlers-carry.png';
import settlersDeposit from '../../assets/characters/settlers/settlers-deposit.png';
import settlersChop from '../../assets/characters/settlers/settlers-chop.png';
import settlersMine from '../../assets/characters/settlers/settlers-mine.png';
import { CHARACTERS } from '../data/characters.js';
import { sampleAnimation, steadyAnchors } from './clips.js';

/**
 * Every sprite sheet of each character, by sheet name.
 *
 * `idle` is the first standing art (one row, one column per facing); the game now only uses it to
 * size the others. `idleLoop` is standing still and breathing (4 rows: south, west, east, north).
 * `chop`/`chopIron` swing stone/iron axes; `mine`/`mineIron` swing stone/iron pickaxes.
 * `sword`/`swordIron` slash a stone/iron sword and `bow`/`bowIron` shoot a stone/iron bow (nock,
 * draw, release, lower); tools/prepare-weapon-art.py packs those the same way, and leaves the
 * painted flying arrow out of the bow's release pose because the game draws the arrow itself.
 * These one-row east-facing sheets are packed by tools/prepare-tool-swings.py, anchored by
 * the boots rather than the head so raising a tool does not pull the body sideways.
 * `profile` is walking west or east
 * (one row). `locomotion` is walking and running, `run` is the newer run (3 rows: south, east,
 * north), and `actions` is gathering and the other actions. The survival sheets are one row each,
 * facing east: `sleep` (lying down, breathing), `wake` (getting up), `hungry` (hand on belly) and
 * the flinches `hurtHunger`, `hurtCold` and `hurtAttack`. They are cut from the all-character
 * pictures in assets/characters/states/ by tools/split-character-sheets.py. `walkNE`, `walkSE`,
 * `runNE` and `runSE` are walking and running diagonally (one row each, heading north-east or
 * south-east, mirrored for the west diagonals), cut by the same tool from assets/characters/diagonal/.
 * `dying` is collapsing when health runs out (one row of six frames, facing east: sagging, knees
 * buckling, kneeling, falling, rolling over, lying still). Its six 336x320 cells were packed by
 * hand, bottom-aligned; assets/characters/states/dying-v2.manifest.json says from where.
 *
 * `url` is the image file. `edges` are the y positions where one row of frames ends and the
 * next begins, top to bottom. Measured transparent gutters, rather than assumed equal rows,
 * preserve all generated poses. If a sheet is redrawn, measure its edges again. `steady` lines
 * frames up by the head (see `measureFrames`), and `columns` is how many frames sit in a row
 * when it isn't 4.
 */
const SOURCES = {
  scout: {
    idle: { url: scoutIdle, edges: [0, 418] },
    idleLoop: { url: scoutIdleLoop, edges: [0, 318, 632, 944, 1254], steady: true },
    chop: { url: scoutChop, edges: [0, 512] },
    chopIron: { url: scoutChopIron, edges: [0, 512] },
    mine: { url: scoutMine, edges: [0, 512] },
    mineIron: { url: scoutMineIron, edges: [0, 512] },
    sword: { url: scoutSword, edges: [0, 512] },
    swordIron: { url: scoutSwordIron, edges: [0, 512] },
    bow: { url: scoutBow, edges: [0, 512] },
    bowIron: { url: scoutBowIron, edges: [0, 512] },
    profile: { url: scoutSideWalk, edges: [0, 418], steady: true },
    locomotion: { url: scoutWalk, edges: [0, 228, 447, 663, 889, 1112, 1331, 1547, 1774] },
    run: { url: scoutRun, edges: [0, 290, 579, 887], steady: true, columns: 6 },
    actions: { url: scoutActions, edges: [0, 295, 592, 852, 1153, 1402] },
    sleep: { url: scoutSleep, edges: [0, 362] },
    wake: { url: scoutWake, edges: [0, 362] },
    hungry: { url: scoutHungry, edges: [0, 418], steady: true },
    hurtHunger: { url: scoutHurtHunger, edges: [0, 418] },
    hurtCold: { url: scoutHurtCold, edges: [0, 418], steady: true },
    hurtAttack: { url: scoutHurtAttack, edges: [0, 362] },
    repel: { url: scoutRepel, edges: [0, 418] },
    dying: { url: scoutDying, edges: [0, 320], columns: 6 },
    walkNE: { url: scoutWalkNE, edges: [0, 418], steady: true },
    walkSE: { url: scoutWalkSE, edges: [0, 418], steady: true },
    runNE: { url: scoutRunNE, edges: [0, 341], steady: true, columns: 6 },
    runSE: { url: scoutRunSE, edges: [0, 341], steady: true, columns: 6 },
  },
  builder: {
    idle: { url: builderIdle, edges: [0, 418] },
    idleLoop: { url: builderIdleLoop, edges: [0, 364, 722, 1081, 1448], steady: true },
    chop: { url: builderChop, edges: [0, 512] },
    chopIron: { url: builderChopIron, edges: [0, 512] },
    mine: { url: builderMine, edges: [0, 512] },
    mineIron: { url: builderMineIron, edges: [0, 512] },
    sword: { url: builderSword, edges: [0, 512] },
    swordIron: { url: builderSwordIron, edges: [0, 512] },
    bow: { url: builderBow, edges: [0, 512] },
    bowIron: { url: builderBowIron, edges: [0, 512] },
    profile: { url: builderSideWalk, edges: [0, 418], steady: true },
    locomotion: { url: builderWalk, edges: [0, 228, 446, 667, 891, 1109, 1332, 1552, 1774] },
    run: { url: builderRun, edges: [0, 292, 579, 887], steady: true, columns: 6 },
    actions: { url: builderActions, edges: [0, 308, 627, 890, 1190, 1402] },
    sleep: { url: builderSleep, edges: [0, 362] },
    wake: { url: builderWake, edges: [0, 362] },
    hungry: { url: builderHungry, edges: [0, 418], steady: true },
    hurtHunger: { url: builderHurtHunger, edges: [0, 418] },
    hurtCold: { url: builderHurtCold, edges: [0, 418], steady: true },
    hurtAttack: { url: builderHurtAttack, edges: [0, 362] },
    repel: { url: builderRepel, edges: [0, 418] },
    dying: { url: builderDying, edges: [0, 320], columns: 6 },
    walkNE: { url: builderWalkNE, edges: [0, 418], steady: true },
    walkSE: { url: builderWalkSE, edges: [0, 418], steady: true },
    runNE: { url: builderRunNE, edges: [0, 342], steady: true, columns: 6 },
    runSE: { url: builderRunSE, edges: [0, 342], steady: true, columns: 6 },
  },
  survivor: {
    idle: { url: survivorIdle, edges: [0, 418] },
    idleLoop: { url: survivorIdleLoop, edges: [0, 322, 655, 982, 1312], steady: true },
    chop: { url: survivorChop, edges: [0, 512] },
    chopIron: { url: survivorChopIron, edges: [0, 512] },
    mine: { url: survivorMine, edges: [0, 512] },
    mineIron: { url: survivorMineIron, edges: [0, 512] },
    sword: { url: survivorSword, edges: [0, 512] },
    swordIron: { url: survivorSwordIron, edges: [0, 512] },
    bow: { url: survivorBow, edges: [0, 512] },
    bowIron: { url: survivorBowIron, edges: [0, 512] },
    profile: { url: survivorSideWalk, edges: [0, 418], steady: true },
    locomotion: { url: survivorWalk, edges: [0, 241, 456, 675, 902, 1119, 1331, 1554, 1774] },
    run: { url: survivorRun, edges: [0, 294, 583, 887], steady: true, columns: 6 },
    actions: { url: survivorActions, edges: [0, 298, 602, 883, 1188, 1402] },
    sleep: { url: survivorSleep, edges: [0, 362] },
    wake: { url: survivorWake, edges: [0, 362] },
    hungry: { url: survivorHungry, edges: [0, 418], steady: true },
    hurtHunger: { url: survivorHurtHunger, edges: [0, 418] },
    hurtCold: { url: survivorHurtCold, edges: [0, 418], steady: true },
    hurtAttack: { url: survivorHurtAttack, edges: [0, 362] },
    repel: { url: survivorRepel, edges: [0, 418] },
    dying: { url: survivorDying, edges: [0, 320], columns: 6 },
    walkNE: { url: survivorWalkNE, edges: [0, 418], steady: true },
    walkSE: { url: survivorWalkSE, edges: [0, 418], steady: true },
    runNE: { url: survivorRunNE, edges: [0, 341], steady: true, columns: 6 },
    runSE: { url: survivorRunSE, edges: [0, 341], steady: true, columns: 6 },
  },
};

/**
 * The villagers' sheets: each has one row per villager (woodsworker, stoneworker, grower).
 * `idle` is standing, with four poses across (south, west, east, north). `walkSouth`, `walkEast`
 * and `walkNorth` are four walking frames each; walking west mirrors the east frames. `runNE` and
 * `runSE` are six frames each of heading north-east and south-east (mirrored for the two west
 * diagonals); they are the only diagonal pictures the villagers have, so a villager walking
 * diagonally shows them. The work
 * sheets all face east and are mirrored for west: `carry` (walking with a load: logs, a crate of
 * stones or a sheaf of wheat), `deposit` (holding the load, bending, setting it down, standing
 * empty-handed; played backwards it is picking a load up), `chop` (an axe swing) and `mine` (a
 * pickaxe swing). All three villagers were painted in one picture per sheet, so they share one
 * size and stay as tall next to each other as they were painted.
 *
 * `edges` are measured from the see-through gaps between the rows, like the character sheets
 * above. `cuts` are the x positions where one frame ends and the next begins, for a sheet whose
 * poses are too wide for equal quarters (a swung axe reaches into the next quarter). `feet` lines
 * the frames up by the boots, so a swing or a bend doesn't slide the body about.
 */
const SETTLERS = {
  idle: { url: settlersIdle, edges: [0, 421, 841, 1254] },
  walkSouth: { url: settlersWalkSouth, edges: [0, 361, 723, 1086], steady: true },
  walkEast: { url: settlersWalkEast, edges: [0, 420, 836, 1254], steady: true },
  walkNorth: { url: settlersWalkNorth, edges: [0, 418, 836, 1254], steady: true },
  runNE: { url: settlersRunNE, edges: [0, 302, 597, 887], steady: true, columns: 6 },
  runSE: { url: settlersRunSE, edges: [0, 301, 593, 887], steady: true, columns: 6 },
  carry: { url: settlersCarry, edges: [0, 361, 720, 1086], steady: true },
  deposit: { url: settlersDeposit, edges: [0, 418, 836, 1254], feet: true },
  chop: {
    url: settlersChop,
    edges: [0, 412, 830, 1254],
    cuts: [0, 303, 592, 970, 1254],
    feet: true,
  },
  mine: { url: settlersMine, edges: [0, 412, 828, 1254], feet: true },
};

/**
 * How tall the first frame of each villager work or walking sheet is, as a share of standing
 * straight (knees bend a little while walking or holding a tool ready). `loadCharacterSheets`
 * uses it to size these sheets, which were painted at their own sizes, so a busy villager is as
 * big as a standing one.
 */
const SETTLER_STOOP = {
  walkSouth: 0.97,
  walkEast: 0.97,
  walkNorth: 0.97,
  runNE: 0.95,
  runSE: 0.95,
  carry: 0.97,
  deposit: 1,
  chop: 0.97,
  mine: 0.97,
};

/**
 * How tall the first pose of each standing survival sheet is, as a share of standing straight.
 * `loadCharacterSheets` uses it to size those sheets, so a hunched pose isn't stretched to full height.
 */
const STOOP = {
  hungry: 1,
  hurtHunger: 0.97,
  hurtCold: 0.97,
  hurtAttack: 0.97,
  dying: 0.97,
  repel: 1,
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
 * @param {number[]} [cuts] - The x positions where each column starts and ends, when they are
 *   not equal widths.
 * @param {boolean} [feet=false] - Line frames up by the boots (the middle of the lowest pixels)
 *   instead of the cell centre.
 * @returns {{image: HTMLImageElement, frames: object[][], referenceHeight: number}} The image, each
 *   frame's box as `frames[row][column]`, and the height used to size the whole sheet.
 */
function measureFrames(image, edges, steady = false, columns = 4, cuts = null, feet = false) {
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
      const left = cuts ? cuts[col] : Math.round((col * image.width) / columns),
        right = cuts ? cuts[col + 1] : Math.round(((col + 1) * image.width) / columns),
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

      // The middle of the boots: the middle one of all the drawn pixels in the lowest strip of
      // the pose. A tool tip or a load resting on the ground is small next to two boots, so it
      // barely moves that middle.
      const soles = [];
      if (feet)
        for (let y = maxY - Math.round((maxY - minY) * 0.07); y <= maxY; y++)
          for (let x = minX; x <= maxX; x++)
            if (data[(y * image.width + x) * 4 + 3] > 40) soles.push(x);
      soles.sort((a, b) => a - b);

      strip.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        anchorX: feet ? soles[soles.length >> 1] : (left + right) / 2,
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
 * Resolves to {atlases:{[characterId]:{idle, profile, locomotion, run, actions}}, settlers:{idle,
 * walkSouth, walkEast, walkNorth, runNE, runSE, carry, deposit, chop, mine}};
 * each sheet is {image, frames[row][col], referenceHeight}. `settlers` holds the villagers' sheets.
 *
 * @returns {Promise<{atlases: object, settlers: object}>} Every measured sheet, by character (or
 *   `settlers`) and sheet name.
 */
export function loadCharacterSheets() {
  if (cached) return cached;
  cached = (async () => {
    // Every character's sheets, all loaded side by side.
    const atlases = {};
    const settlers = {};
    /** Loads and measures the villagers' sheets, next to the characters' ones. */
    const loadSettlers = async () => {
      for (const [name, source] of Object.entries(SETTLERS))
        settlers[name] = measureFrames(
          await loadImage(source.url, 'villager artwork'),
          source.edges,
          source.steady,
          source.columns,
          source.cuts,
          source.feet,
        );
    };
    await Promise.all([
      loadSettlers(),
      ...CHARACTERS.map(async (character) => {
        const sheets = await Promise.all(
          Object.entries(SOURCES[character.id]).map(async ([name, source]) => [
            name,
            measureFrames(await loadImage(source.url), source.edges, source.steady, source.columns),
          ]),
        );
        atlases[character.id] = Object.fromEntries(sheets);
      }),
    ]);

    // Size each villager walking and work sheet so its first frame is as tall as the standing
    // pose (a touch shorter where the knees are bent).
    const standingTall = settlers.idle.frames[0][0].height / settlers.idle.referenceHeight;
    for (const [name, stoop] of Object.entries(SETTLER_STOOP))
      settlers[name].referenceHeight = settlers[name].frames[0][0].height / (standingTall * stoop);

    // The idle and side-walk art was painted as one picture of all three characters, and the
    // game has always sized it by the scout's row. Every character keeps that one size, so each
    // stays as tall next to the others as it was painted.
    for (const atlas of Object.values(atlases)) {
      // The breathing and chopping sheets were painted one character at a time, each at its own
      // size. Size them so the first breathing pose is exactly as tall as the old standing pose,
      // and the "axe ready" pose a touch shorter (the knees are bent).
      const standing = atlas.idle.frames[0][0].height / atlases.scout.idle.referenceHeight;
      atlas.idleLoop.referenceHeight = atlas.idleLoop.frames[0][0].height / standing;
      // Tool poses are packed around the boots; an overhead tool must not shrink the body.
      for (const name of ['chop', 'chopIron', 'mine', 'mineIron'])
        atlas[name].referenceHeight = atlas[name].frames[0][0].height / (standing * 0.97);
      // The sword and bow strips are packed the same way. The sword's guard is a bent-knee stance
      // like the axe's; the archer nocking an arrow stands straight.
      for (const name of ['sword', 'swordIron'])
        atlas[name].referenceHeight = atlas[name].frames[0][0].height / (standing * 0.97);
      for (const name of ['bow', 'bowIron'])
        atlas[name].referenceHeight = atlas[name].frames[0][0].height / standing;

      // The survival sheets were painted at their own sizes too. The standing ones are sized by
      // their first pose, a little shorter than standing straight where the body is hunched.
      // Getting up is sized by its last pose, which stands straight, and sleeping so that the
      // sleeper is as long on the ground as the lying pose that getting up starts from.
      for (const [name, hunch] of Object.entries(STOOP))
        atlas[name].referenceHeight = atlas[name].frames[0][0].height / (standing * hunch);
      atlas.wake.referenceHeight = atlas.wake.frames[0][3].height / standing;
      atlas.sleep.referenceHeight =
        (atlas.sleep.frames[0][0].width * atlas.wake.referenceHeight) /
        atlas.wake.frames[0][0].width;

      atlas.idle.referenceHeight = atlases.scout.idle.referenceHeight;
      atlas.profile.referenceHeight = atlases.scout.profile.referenceHeight;
    }
    return { atlases, settlers };
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
 * the box on it. Walking west or east uses the character's side-walk (`profile`) sheet instead.
 * The 2D-canvas painter below and the Phaser renderer both draw from this.
 *
 * @param {object} sheets - The result of `loadCharacterSheets`.
 * @param {string} characterId - Which character, such as `scout`.
 * @param {string} clip - The animation name, such as `walk`.
 * @param {number} time - Seconds the clip has been playing.
 * @param {number} direction - Facing: 0 south, 1 west, 2 east, 3 north.
 * @param {boolean} [loop] - Start the clip over at the end. Defaults to the clip's own setting.
 * @param {string|null} [diagonal=null] - 'ne', 'nw', 'se' or 'sw' while walking or running diagonally.
 * @returns {{sheet: object, key: string, name: string, frame: object, flip: boolean, lift: number}}
 *   The sheet, its texture key, the frame's `row-column` name and box, whether to mirror it, and its lift.
 */
export function resolvePose(sheets, characterId, clip, time, direction, loop, diagonal = null) {
  const sample = sampleAnimation(clip, time, direction, loop, diagonal);
  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];

  // Walking sideways uses the side-walk sheet; everything else (a diagonal walk included, which
  // `sampleAnimation` has already pointed at its own sheet) uses the sheet the sample names.
  const profile = sample.sheet === 'locomotion' && (direction === 1 || direction === 2);
  const sheetName = profile ? 'profile' : sample.sheet;
  const sheet = sheets.atlases[character.id][sheetName];

  // The side-walk sheet has a single row.
  const row = profile ? 0 : sample.row;
  return {
    sheet,
    key: character.id + '-' + sheetName,
    name: row + '-' + sample.frame,
    frame: sheet.frames[row][sample.frame],
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
     * @param {string|null} [diagonal=null] - 'ne', 'nw', 'se' or 'sw' for a diagonal walk or run.
     */
    draw(ctx, characterId, clip, time, direction, x, y, height = 105, loop, diagonal = null) {
      const { sheet, frame, flip, lift } = resolvePose(
        sheets,
        characterId,
        clip,
        time,
        direction,
        loop,
        diagonal,
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
