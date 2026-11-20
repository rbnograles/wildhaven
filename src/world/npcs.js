// Villagers: the people of Hollowstead village. This file keeps where each one is and what they
// are doing right now, and answers questions about them: which way one is looking, which picture
// shows what they are doing, and which bit of ground each stands on (so the player walks around
// them). What they are doing is never saved: every time a game is opened they start again from
// home. Moving them along is the job of actions/villagers.js.

import { NPCS } from '../data/npcs.js';
import {
  NPC_NOTICE,
  NPC_BASE,
  NPC_REST_MIN,
  NPC_WORK_SECONDS,
  NPC_DEPOSIT_SECONDS,
} from '../data/balance.js';

// How many walking pictures a villager shows each second, and how many tool swings.
const WALK_FPS = 6;
const SWING_FPS = 5;

// How many pictures each row of a villager sheet holds.
const FRAMES = 4;

// Which sheet a walking villager uses for each facing (0 south, 1 west, 2 east, 3 north).
// West has no art of its own: it mirrors the east sheet.
const WALK_SHEETS = ['walkSouth', 'walkEast', 'walkEast', 'walkNorth'];

/**
 * Makes one villager's starting state: at home, empty-handed, resting a little before work.
 *
 * @param {object} npc - The villager's entry in `NPCS`.
 * @returns {object} `{npc, x, y, facing, phase, heading, left, moving, carrying, clock, path, i}`:
 *   where they are and which way they look; `phase` is what they are doing (`rest`, `wait` for a
 *   way to open, `walk`, `work` or `deposit`); `heading` is where a walk leads (`work` or `drop`);
 *   `left` is the seconds left of a timed phase; `moving` is true while their feet are moving;
 *   `carrying` is true while they hold a load; `clock` counts the seconds of the pictures being
 *   played; `path` is the spots still to walk through, from number `i` on.
 */
function atHome(npc) {
  return {
    npc,
    x: npc.x,
    y: npc.y,
    facing: npc.facing,
    phase: 'rest',
    heading: 'work',
    left: NPC_REST_MIN,
    moving: false,
    carrying: false,
    clock: 0,
    path: [],
    i: 0,
  };
}

/**
 * Where every villager is and what they are doing right now. The frame loop moves them
 * (`tickVillagers` in actions/villagers.js), the renderer draws them from here, and `npcBases`
 * makes them solid where they stand.
 */
export const VILLAGERS = NPCS.map(atHome);

/** Sends every villager back home, empty-handed and resting. Called whenever a game is opened. */
export function resetVillagers() {
  VILLAGERS.forEach((villager, i) => {
    Object.assign(villager, atHome(NPCS[i]));
  });
}

/**
 * Says which way to look to face a spot that is `dx` across and `dy` down from you.
 *
 * @param {number} dx - How far east the spot is (west if negative).
 * @param {number} dy - How far south the spot is (north if negative).
 * @returns {number} 0 south, 1 west, 2 east or 3 north.
 */
export const toward = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0);

/**
 * Says which way a villager is looking right now.
 *
 * A villager who is walking, working or holding a load looks where their job points them. One
 * who is standing empty-handed minds their own business until the player comes close, then turns
 * to look at them, like someone glancing up when you walk into a shop.
 *
 * @param {object} villager - The villager (see `VILLAGERS`).
 * @param {{x: number, y: number}} player - Where the player is.
 * @returns {number} 0 south, 1 west, 2 east or 3 north.
 */
export function npcFacing(villager, player) {
  const dx = player.x - villager.x,
    dy = player.y - villager.y;

  // Busy, too far away to notice, or on the very same spot: keep looking the same way.
  const busy =
    villager.moving ||
    villager.carrying ||
    villager.phase === 'work' ||
    villager.phase === 'deposit';
  const far = Math.hypot(dx, dy) > NPC_NOTICE;
  if (busy || far || (dx === 0 && dy === 0)) return villager.facing;

  return toward(dx, dy);
}

/**
 * Picks the picture that shows what a villager is doing right now.
 *
 * It is like choosing the right page of a flip-book: the page for chopping, for carrying, for
 * setting a load down, for walking, or just for standing. The pictures of work face east, so
 * facing west mirrors them.
 *
 * @param {object} villager - The villager (see `VILLAGERS`).
 * @param {{x: number, y: number}} player - Where the player is (a resting villager looks at them).
 * @returns {{sheet: string, column: number, flip: boolean}} The settlers sheet to draw from
 *   (`idle`, `walkSouth`, `walkEast`, `walkNorth`, `carry`, `deposit`, `chop` or `mine`), which
 *   picture in the villager's row, and whether to mirror it.
 */
export function villagerPose(villager, player) {
  const { phase, clock, npc } = villager,
    facing = npcFacing(villager, player),
    flip = facing === 1;

  /** Which picture of a play-once clip to show, `seconds` long, after `clock` seconds. */
  const once = (seconds) => Math.min(FRAMES - 1, Math.floor((clock / seconds) * FRAMES));

  if (phase === 'work') {
    const { clip } = npc.job.work;

    // Picking a load up is setting one down, played backwards.
    if (clip === 'pickup')
      return { sheet: 'deposit', column: FRAMES - 1 - once(NPC_WORK_SECONDS.pickup), flip };
    return { sheet: clip, column: Math.floor(clock * SWING_FPS) % FRAMES, flip };
  }

  if (phase === 'deposit') return { sheet: 'deposit', column: once(NPC_DEPOSIT_SECONDS), flip };

  // Holding a load: the carrying pictures, stepping while the feet move and still otherwise.
  if (villager.carrying)
    return {
      sheet: 'carry',
      column: villager.moving ? Math.floor(clock * WALK_FPS) % FRAMES : 1,
      flip,
    };

  if (villager.moving)
    return { sheet: WALK_SHEETS[facing], column: Math.floor(clock * WALK_FPS) % FRAMES, flip };

  return { sheet: 'idle', column: facing, flip: false };
}

/**
 * Lists the solid base of every villager, where each one stands right now.
 *
 * A villager is in the way like a small post: the player walks around their feet, and can still
 * pass behind or in front of them.
 *
 * @returns {number[][]} Boxes as [left, top, right, bottom], ready for `isWalkable`.
 */
export function npcBases() {
  const [halfWidth, depth] = NPC_BASE;
  return VILLAGERS.map(({ x, y }) => [x - halfWidth, y - depth, x + halfWidth, y]);
}
