// The game state: one plain object that holds everything about a character's adventure
// (where they stand, what's in their backpack, what they've found, their boat). This file creates
// a new one, turns it into text for saving, and carefully checks saved text before loading it back.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { isWalkable, isSailable, SEA_BORDER } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';

/** The save shape this build writes. Version 3 saves are moved up to it; older ones can't be read. */
const VERSION = 4;

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `collected` lists one-time supplies gathered, `regrowAt`
 *   maps each picked wild patch to the game time it grows back, `discovered` lists region ids,
 *   `landmarks`, `waypoints` and `wrecks` list the ids of places, signposts and old boats found,
 *   `boat` is the repaired boat (`{from, x, y, dir}`) or null, `aboard` is true while the player
 *   sits in it, `elapsed` is game seconds played and `distance` is world units travelled.
 * @throws {Error} If the character id isn't one of the known characters.
 */
export function createGame(characterId) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  return {
    version: VERSION,
    character: character.id,
    player: { ...character.spawn, direction: 0 },
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    collected: [],
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    wrecks: [],
    boat: null,
    aboard: false,
    elapsed: 0,
    distance: 0,
  };
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
 * Moves the x-y position at the end of a wild patch id out by the sea border.
 * For example `flowers-10-20` becomes `flowers-2058-2068`. Other ids are left as they are.
 */
const shiftId = (id) =>
  id.replace(/-(\d+)-(\d+)$/, (_, x, y) => `-${Number(x) + SEA_BORDER}-${Number(y) + SEA_BORDER}`);

/**
 * Brings a version 3 save up to version 4, the shape since the sea border was added.
 *
 * The map grew by SEA_BORDER units of sea on every side, so every old position moves out by that
 * much, like re-pinning a poster on a bigger board. A player who stood where the new coast now
 * cuts in goes back to their character's start instead. Wild patch ids hold their position, so
 * their regrow timers move too. Old saves have no boat yet. Anything odd is left alone, for the
 * checks in restoreGame to refuse.
 *
 * @param {object} s - The parsed version 3 save.
 * @returns {object} The same adventure in the version 4 shape.
 */
function fromVersion3(s) {
  const player = { ...s.player, x: s.player?.x + SEA_BORDER, y: s.player?.y + SEA_BORDER };
  const spawn = CHARACTERS.find((c) => c.id === s.character)?.spawn;
  if (
    Number.isFinite(player.x) &&
    Number.isFinite(player.y) &&
    spawn &&
    !isWalkable(player.x, player.y)
  )
    Object.assign(player, spawn);

  const timers = s.regrowAt;
  const regrowAt =
    timers && typeof timers === 'object' && !Array.isArray(timers)
      ? Object.fromEntries(Object.entries(timers).map(([id, t]) => [shiftId(id), t]))
      : timers;

  return { ...s, version: 4, player, regrowAt, wrecks: [], boat: null, aboard: false };
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
 * Reads saved text back into a game state, or gives up if anything looks wrong.
 *
 * Saved text could be old, broken, or edited by hand, so we check every field before trusting
 * it, like a librarian checking a returned book page by page. Then we build a brand-new object
 * field by field instead of using the loaded one, so stray extra fields never sneak into the game.
 * A new field added to the game state must be checked and copied here too, or it is lost on load.
 * Version 3 saves are first moved onto the bigger map (see fromVersion3).
 *
 * @param {string} json - The saved text.
 * @returns {object|null} A safe game state, or null if the save can't be used.
 */
export function restoreGame(json) {
  try {
    const parsed = JSON.parse(json);
    const s = parsed?.version === 3 ? fromVersion3(parsed) : parsed;

    // The right save version, a known character, and a player facing a real direction.
    if (
      !s ||
      s.version !== VERSION ||
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
    // placeBoat brings them ashore if the map no longer has sea there.
    if (
      s.aboard
        ? !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y)
        : !isWalkable(s.player.x, s.player.y)
    )
      return null;

    const { resources, regrowAt } = s;

    // Every resource must be a sensible whole number: not negative, not huge.
    if (
      !resources ||
      !RESOURCES.every(
        (key) =>
          Number.isSafeInteger(resources[key]) && resources[key] >= 0 && resources[key] < 100000,
      )
    )
      return null;

    // The gathered, discovered and found lists may only hold real ids, each listed once.
    for (const [list, allowed] of [
      [s.collected, SUPPLIES],
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

    // Time played and distance travelled must be real, non-negative numbers.
    if (
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      !Number.isFinite(s.distance) ||
      s.distance < 0
    )
      return null;

    // Regrowth timers must be a plain object of non-negative times.
    if (
      !regrowAt ||
      typeof regrowAt !== 'object' ||
      Array.isArray(regrowAt) ||
      !Object.values(regrowAt).every((t) => Number.isFinite(t) && t >= 0)
    )
      return null;

    // Patch ids are map positions, so a rebuilt map can retire one; dropping its timer only lets that patch regrow early.
    // Each kept timer is also capped at one regrow ahead, so a patch can't stay gone forever.
    const timers = NODES.filter((n) => n.regrow && Object.hasOwn(regrowAt, n.id)).map((n) => [
      n.id,
      Math.min(regrowAt[n.id], s.elapsed + n.regrow),
    ]);

    // Build the result fresh, copying only the fields we checked.
    const placed = placeBoat(s);
    return {
      version: VERSION,
      character: s.character,
      player: placed.player,
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      collected: [...s.collected],
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      landmarks: [...s.landmarks],
      waypoints: [...s.waypoints],
      wrecks: [...s.wrecks],
      boat: placed.boat,
      aboard: placed.aboard,
      elapsed: s.elapsed,
      distance: s.distance,
    };
  } catch {
    return null;
  }
}
