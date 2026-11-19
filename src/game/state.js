// The game state: one plain object that holds everything about a character's adventure (where
// they stand, what's in their backpack, what they've found, their camps and boat, how warm and fed
// they are, and what they've seen). This file creates a new one, turns it into text for saving,
// and carefully checks saved text before loading it back. Older saves are upgraded on the way in.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';
import {
  START_TIME,
  SUPPLY_REGROW,
  TEA_SECONDS,
  MAX_GROWN,
  CAMP_NAME_MAX,
  MAX_CAMPS,
  FOG_CELL,
} from '../data/balance.js';
import { isWalkable, isSailable, SEA_BORDER } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';
import { emptyFog, isFogString, revealAround, revealRegions, growFog } from '../world/fog.js';

/**
 * The save format this code writes. Version 5 is the survival update's version 4 plus the boat.
 * Version 3 and version 4 saves are upgraded when loaded (see `upgradeV3` and `addSeaBorder`).
 */
export const SAVE_VERSION = 5;

/** The three survival meters. Each is a number from 0 to 100. */
const METERS = ['health', 'hunger', 'warmth'];

/**
 * How many fog squares wide the sea border is. Version 4 fog was saved on the map before the
 * border was added, which was this many squares smaller on every side. tests/game/state.test.js
 * checks it is a whole number, so every old square lands exactly on a new one.
 */
export const BORDER_SQUARES = SEA_BORDER / FOG_CELL;

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `regrowAt` maps each gathered node to the world time it
 *   grows back; `discovered` lists region ids; `landmarks`, `waypoints` and `wrecks` list the
 *   places, signposts and old boats found; `boat` is the repaired boat (`{from, x, y, dir}`) or
 *   null, and `aboard` is true while the player sits in it; `elapsed` is game seconds played and
 *   `distance` is world units travelled; `time` is the world clock (game seconds since the dawn
 *   of day 1); `meters` holds health, hunger and warmth; `tea` is the seconds of tea warmth left;
 *   `camps` lists the camps built; `fog` records the squares of the world seen so far.
 * @throws {Error} If the character id isn't one of the known characters.
 */
export function createGame(characterId) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  const state = {
    version: SAVE_VERSION,
    character: character.id,
    player: { ...character.spawn, direction: 0 },
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    wrecks: [],
    boat: null,
    aboard: false,
    elapsed: 0,
    distance: 0,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    camps: [],
    fog: emptyFog(),
  };
  revealAround(state, state.player.x, state.player.y);
  return state;
}

/**
 * Turns the game state into text so it can be saved.
 *
 * @param {object} state - The game being played.
 * @returns {string} The state as JSON text.
 */
export function serializeGame(state) {
  return JSON.stringify(state);
}

/**
 * Checks one camp need from a save: a kind the game knows, with sensible fields and a done flag.
 *
 * @param {*} n - The need read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isNeed = (n) =>
  !!n &&
  typeof n.done === 'boolean' &&
  ((n.kind === 'bring' &&
    RESOURCES.includes(n.resource) &&
    Number.isSafeInteger(n.amount) &&
    n.amount >= 1 &&
    n.amount <= 99) ||
    (n.kind === 'place' && REGIONS.some((r) => r.id === n.region)) ||
    n.kind === 'signpost');

/**
 * Checks one camp from a save: an id like "camp-3", a tidy name, a spot on dry land, a growth
 * count in range and exactly three needs. Like the player's spot, cliffs are left out of the
 * land check, so a camp built before a hill was added on that spot still loads.
 *
 * @param {*} c - The camp read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isCamp = (c) =>
  !!c &&
  typeof c.id === 'string' &&
  /^camp-\d+$/.test(c.id) &&
  typeof c.name === 'string' &&
  c.name.length >= 1 &&
  c.name.length <= CAMP_NAME_MAX &&
  c.name.trim() === c.name &&
  isWalkable(c.x, c.y, [], false) &&
  Number.isInteger(c.grown) &&
  c.grown >= 0 &&
  c.grown <= MAX_GROWN &&
  Array.isArray(c.needs) &&
  c.needs.length === 3 &&
  c.needs.every(isNeed);

/**
 * Copies a checked need, keeping only the fields its kind uses.
 *
 * @param {object} n - A need that passed `isNeed`.
 * @returns {object} A fresh need object.
 */
function copyNeed(n) {
  if (n.kind === 'bring')
    return { kind: n.kind, resource: n.resource, amount: n.amount, done: n.done };
  if (n.kind === 'place') return { kind: n.kind, region: n.region, done: n.done };
  return { kind: n.kind, done: n.done };
}

/**
 * Copies a checked camp field by field, with fresh copies of its needs.
 *
 * @param {object} c - A camp that passed `isCamp`.
 * @returns {object} A fresh camp object.
 */
const copyCamp = (c) => ({
  id: c.id,
  name: c.name,
  x: c.x,
  y: c.y,
  grown: c.grown,
  needs: c.needs.map(copyNeed),
});

/** Says whether a value is a plain object (not null, not a list), like a saved `regrowAt`. */
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Moves the x-y position at the end of a node id out by the sea border.
 * For example `flowers-10-20` becomes `flowers-2058-2068`. Other ids (like `pine-wood`) are left as they are.
 */
const shiftId = (id) =>
  id.replace(/-(\d+)-(\d+)$/, (_, x, y) => `-${Number(x) + SEA_BORDER}-${Number(y) + SEA_BORDER}`);

/**
 * Moves a saved player out by the sea border, onto the same spot of the bigger map.
 *
 * A player who stood where the new coast now cuts in goes back to their character's start instead
 * (a hill there doesn't count: cliffs are ignored, as in restoreGame, so the player can walk off
 * it). A broken position is left broken, for the checks in restoreGame to refuse.
 *
 * @param {object} s - The parsed old save.
 * @returns {object} A fresh player object.
 */
function shiftPlayer(s) {
  // A missing or non-number position (JSON turns NaN into null, and null + 2048 would look fine) is
  // kept as NaN, so restoreGame refuses it.
  const { x, y } = s.player ?? {},
    shifted = (n) => (Number.isFinite(n) ? n + SEA_BORDER : NaN),
    player = { ...s.player, x: shifted(x), y: shifted(y) };
  const spawn = CHARACTERS.find((c) => c.id === s.character)?.spawn;
  if (
    Number.isFinite(player.x) &&
    Number.isFinite(player.y) &&
    spawn &&
    !isWalkable(player.x, player.y, [], false)
  )
    Object.assign(player, spawn);
  return player;
}

/**
 * Says whether a camp moved onto the bigger map now stands in the sea, where no fire can burn.
 *
 * It uses the same land check as isCamp (cliffs don't count), so a spot that new scenery now
 * covers counts too; both happen only near the old map's edge. A camp with a broken position is
 * not "in the sea": it is kept, so the checks in restoreGame refuse the save instead of quietly
 * loading it.
 *
 * @param {*} c - The moved camp.
 * @returns {boolean} True if the camp has a real position that is no longer open dry land.
 */
const inSea = (c) =>
  isPlainObject(c) &&
  Number.isFinite(c.x) &&
  Number.isFinite(c.y) &&
  !isWalkable(c.x, c.y, [], false);

/** The boat fields a save from before the sea border gets: no old boats found, no boat, on foot. */
const NO_BOAT = () => ({ wrecks: [], boat: null, aboard: false });

/**
 * Brings a version 3 save (from before the survival update and the sea) up to version 5.
 *
 * Version 3 had no world clock, meters, camps, fog or boat, and its map had no sea border.
 * - The clock starts again on the morning of day 1, and each regrow timer keeps the time it had
 *   left. A supply version 3 called "collected" (gone for good) now grows back two days from
 *   that morning.
 * - Every position moves out by the sea border, like re-pinning a poster on a bigger board (see
 *   shiftPlayer); wild patch ids hold their position, so their timers move too.
 * - The fog lifts over every region the player had already entered (but not over the new sea
 *   border, which they have never seen) and around where they now stand. This happens after the
 *   move, because the regions are read from today's bigger map.
 * A broken version 3 save is refused here, exactly as the old loader would have refused it.
 *
 * @param {object} s - The parsed version 3 save.
 * @returns {object|null} The save in the version 5 shape (still to be checked), or null.
 */
function upgradeV3(s) {
  const { regrowAt: timers, collected, elapsed, discovered } = s;
  if (
    !isPlainObject(timers) ||
    !Object.values(timers).every((t) => Number.isFinite(t) && t >= 0) ||
    !Array.isArray(collected) ||
    !collected.every((id) => SUPPLIES.some((n) => n.id === id)) ||
    !Number.isFinite(elapsed)
  )
    return null;

  // Each timer keeps the seconds it had left; collected supplies get a fresh two-day timer.
  const regrowAt = Object.fromEntries(
    Object.entries(timers).map(([id, at]) => [shiftId(id), START_TIME + Math.max(0, at - elapsed)]),
  );
  for (const id of collected) regrowAt[id] = START_TIME + SUPPLY_REGROW;

  // Lift the fog over the regions already entered and around where the player now stands.
  const player = shiftPlayer(s);
  const seen = { fog: emptyFog() };
  revealRegions(seen, Array.isArray(discovered) ? discovered : [], SEA_BORDER);
  revealAround(seen, player.x, player.y);

  return {
    ...s,
    version: SAVE_VERSION,
    player,
    regrowAt,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    camps: [],
    fog: seen.fog,
    ...NO_BOAT(),
  };
}

/**
 * Brings a version 4 save (the survival update, before the sea border) up to version 5.
 *
 * The map grew by SEA_BORDER units of sea on every side, so everything with a position moves out
 * by that much: the player (see shiftPlayer), every camp's fire, and the regrow timers of wild
 * patches, whose ids hold their position. The fog is redrawn on the bigger grid with each seen
 * square in its old place on the land and the new sea squares still unseen. A camp whose fire
 * would now stand in the sea is left behind, so the rest of the adventure still loads. Version 4
 * had no boat yet. Anything odd is left alone, for the checks in restoreGame to refuse.
 *
 * @param {object} s - The parsed version 4 save.
 * @returns {object} The same adventure in the version 5 shape.
 */
function addSeaBorder(s) {
  const timers = s.regrowAt;
  const regrowAt = isPlainObject(timers)
    ? Object.fromEntries(Object.entries(timers).map(([id, t]) => [shiftId(id), t]))
    : timers;

  // Each camp moves with the land; one now in the sea is dropped.
  const camps = Array.isArray(s.camps)
    ? s.camps
        .map((c) => (isPlainObject(c) ? { ...c, x: c.x + SEA_BORDER, y: c.y + SEA_BORDER } : c))
        .filter((c) => !inSea(c))
    : s.camps;

  return {
    ...s,
    version: SAVE_VERSION,
    player: shiftPlayer(s),
    regrowAt,
    camps,
    fog: growFog(s.fog, BORDER_SQUARES),
    ...NO_BOAT(),
  };
}

/**
 * Works out where a loaded player and boat should be, mending spots a rebuilt map took away.
 *
 * Aboard, the boat sits right under the player. A boat (or a player in it) left on a spot that is
 * no longer sea goes back to the water by the old boat it was repaired from, and the player is set
 * ashore on that beach. Positions that are still fine are kept as they are.
 *
 * @param {object} s - The checked save.
 * @returns {{player: object, boat: object|null, aboard: boolean}} Fresh objects for the restored game.
 */
function placeBoat(s) {
  const player = { x: s.player.x, y: s.player.y, direction: s.player.direction };
  if (!s.boat) return { player, boat: null, aboard: false };

  const wreck = WRECKS.find((w) => w.id === s.boat.from);
  const boat = s.aboard
    ? { from: wreck.id, x: player.x, y: player.y, dir: player.direction }
    : { from: wreck.id, x: s.boat.x, y: s.boat.y, dir: s.boat.dir };
  if (isSailable(boat.x, boat.y)) return { player, boat, aboard: s.aboard };

  // The sea moved: float the boat at its launch spot again, and bring a player who was in it ashore.
  boat.x = wreck.launch.x;
  boat.y = wreck.launch.y;
  if (s.aboard) Object.assign(player, { x: wreck.x, y: wreck.y });
  return { player, boat, aboard: false };
}

/**
 * Picks the upgrade an older save needs, if any.
 *
 * @param {*} parsed - The parsed save.
 * @returns {*} The save in the version 5 shape (still to be checked), or the save unchanged.
 */
function upgrade(parsed) {
  if (parsed?.version === 3) return upgradeV3(parsed);
  if (parsed?.version === 4) return addSeaBorder(parsed);
  return parsed;
}

/**
 * Reads saved text back into a game state, or gives up if anything looks wrong.
 *
 * Saved text could be old, broken, or edited by hand, so we check every field before trusting
 * it, like a librarian checking a returned book page by page. Then we build a brand-new object
 * field by field instead of using the loaded one, so stray extra fields never sneak into the game.
 * A new field added to the game state must be checked and copied here too, or it is lost on load.
 * Version 3 and 4 saves are first upgraded and moved onto the bigger map (see `upgrade`).
 *
 * @param {string} json - The saved text.
 * @returns {object|null} A safe game state, or null if the save can't be used.
 */
export function restoreGame(json) {
  try {
    const s = upgrade(JSON.parse(json));

    // The right save version, a known character, and a player facing a real direction.
    if (
      !s ||
      s.version !== SAVE_VERSION ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !s.player ||
      ![0, 1, 2, 3].includes(s.player.direction)
    )
      return null;

    // A boat came from a real old boat, sits at a real position and faces a real direction.
    // Being aboard needs a boat.
    const { boat } = s;
    if (
      typeof s.aboard !== 'boolean' ||
      (s.aboard && !boat) ||
      (boat !== null &&
        (typeof boat !== 'object' ||
          !WRECKS.some((w) => w.id === boat.from) ||
          !Number.isFinite(boat.x) ||
          !Number.isFinite(boat.y) ||
          ![0, 1, 2, 3].includes(boat.dir)))
    )
      return null;

    // On foot the player must stand somewhere walkable. Aboard, any real position will do here:
    // placeBoat brings them ashore if the map no longer has sea there. Cliffs are left out of the
    // on-foot check: a save made before a hill was built on the spot still loads, and movePlayer
    // lets the player walk off the cliff.
    if (
      s.aboard
        ? !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y)
        : !isWalkable(s.player.x, s.player.y, [], false)
    )
      return null;

    const { resources, regrowAt, meters, tea, camps } = s;

    // Every resource must be a sensible whole number: not negative, not huge.
    if (
      !resources ||
      !RESOURCES.every(
        (key) =>
          Number.isSafeInteger(resources[key]) && resources[key] >= 0 && resources[key] < 100000,
      )
    )
      return null;

    // The discovered and found lists may only hold real ids, each listed once.
    for (const [list, allowed] of [
      [s.discovered, REGIONS],
      [s.landmarks, LANDMARKS],
      [s.waypoints, WAYPOINTS],
      [s.wrecks, WRECKS],
    ]) {
      if (
        !Array.isArray(list) ||
        list.length > allowed.length ||
        new Set(list).size !== list.length ||
        !list.every((id) => allowed.some((a) => a.id === id))
      )
        return null;
    }

    // Time played, distance travelled and the world clock must be real, non-negative numbers.
    if (![s.elapsed, s.distance, s.time].every((n) => Number.isFinite(n) && n >= 0)) return null;

    // Regrowth timers must be a plain object of non-negative times.
    if (
      !isPlainObject(regrowAt) ||
      !Object.values(regrowAt).every((t) => Number.isFinite(t) && t >= 0)
    )
      return null;

    // Each meter runs from 0 to 100, and tea from none to one full cup.
    if (
      !meters ||
      !METERS.every((k) => Number.isFinite(meters[k]) && meters[k] >= 0 && meters[k] <= 100) ||
      !Number.isFinite(tea) ||
      tea < 0 ||
      tea > TEA_SECONDS
    )
      return null;

    // Camps: a short list of well-formed camps, each id used once.
    if (
      !Array.isArray(camps) ||
      camps.length > MAX_CAMPS ||
      !camps.every(isCamp) ||
      new Set(camps.map((c) => c.id)).size !== camps.length
    )
      return null;

    // The fog must be the right length for this map.
    if (!isFogString(s.fog)) return null;

    // Node ids are map positions, so a rebuilt map can retire one; dropping its timer only lets it regrow early.
    // Each kept timer is also capped at one regrow ahead, so a node can't stay gone forever.
    const timers = NODES.filter((n) => n.regrow && Object.hasOwn(regrowAt, n.id)).map((n) => [
      n.id,
      Math.min(regrowAt[n.id], s.time + n.regrow),
    ]);

    // Build the result fresh, copying only the fields we checked.
    const placed = placeBoat(s);
    return {
      version: SAVE_VERSION,
      character: s.character,
      player: placed.player,
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      landmarks: [...s.landmarks],
      waypoints: [...s.waypoints],
      wrecks: [...s.wrecks],
      boat: placed.boat,
      aboard: placed.aboard,
      elapsed: s.elapsed,
      distance: s.distance,
      time: s.time,
      meters: Object.fromEntries(METERS.map((k) => [k, meters[k]])),
      tea,
      camps: camps.map(copyCamp),
      fog: s.fog,
    };
  } catch {
    return null;
  }
}
