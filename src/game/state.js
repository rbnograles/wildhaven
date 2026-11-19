// The game state: one plain object that holds everything about a character's adventure (where
// they stand, what's in their backpack, what they've found, their camps, how warm and fed they
// are, and what they've seen). This file creates a new one, turns it into text for saving, and
// carefully checks saved text before loading it back. Older saves are upgraded on the way in.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { LANDMARKS, WAYPOINTS } from '../data/places.js';
import {
  START_TIME,
  SUPPLY_REGROW,
  TEA_SECONDS,
  MAX_GROWN,
  CAMP_NAME_MAX,
  MAX_CAMPS,
} from '../data/balance.js';
import { isWalkable } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';
import { emptyFog, isFogString, revealAround, revealRegions } from '../world/fog.js';

/** The save format this code writes. Version 3 saves are upgraded when loaded (see `upgradeV3`). */
export const SAVE_VERSION = 4;

/** The three survival meters. Each is a number from 0 to 100. */
const METERS = ['health', 'hunger', 'warmth'];

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `regrowAt` maps each gathered node to the world time it
 *   grows back; `discovered` lists region ids; `landmarks` and `waypoints` list the places and
 *   signposts found; `elapsed` is game seconds played and `distance` is world units walked;
 *   `time` is the world clock (game seconds since the dawn of day 1); `meters` holds health,
 *   hunger and warmth; `tea` is the seconds of tea warmth left; `camps` lists the camps built;
 *   `fog` records the squares of the world seen so far.
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
 * count in range and exactly three needs.
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
  isWalkable(c.x, c.y) &&
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

/**
 * Brings a version 3 save up to version 4, so players keep their progress.
 *
 * Version 3 had no world clock, meters, camps or fog. The clock starts again on the morning of
 * day 1, and each regrow timer keeps the time it had left. A supply version 3 called "collected"
 * (gone for good) now grows back two days from that morning. The fog lifts over every region the
 * player had already entered and around where they stand. A broken version 3 save is refused here,
 * exactly as the old loader would have refused it.
 *
 * @param {object} s - The parsed version 3 save.
 * @returns {object|null} The save in the version 4 shape (still to be checked), or null.
 */
function upgradeV3(s) {
  const { regrowAt: timers, collected, elapsed, discovered, player } = s;
  if (
    !timers ||
    typeof timers !== 'object' ||
    Array.isArray(timers) ||
    !Object.values(timers).every((t) => Number.isFinite(t) && t >= 0) ||
    !Array.isArray(collected) ||
    !collected.every((id) => SUPPLIES.some((n) => n.id === id)) ||
    !Number.isFinite(elapsed)
  )
    return null;

  // Each timer keeps the seconds it had left; collected supplies get a fresh two-day timer.
  const regrowAt = Object.fromEntries(
    Object.entries(timers).map(([id, at]) => [id, START_TIME + Math.max(0, at - elapsed)]),
  );
  for (const id of collected) regrowAt[id] = START_TIME + SUPPLY_REGROW;

  // Lift the fog over the regions already entered and around where the player stands.
  const seen = { fog: emptyFog() };
  revealRegions(seen, Array.isArray(discovered) ? discovered : []);
  revealAround(seen, player?.x, player?.y);

  return {
    ...s,
    version: SAVE_VERSION,
    regrowAt,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    camps: [],
    fog: seen.fog,
  };
}

/**
 * Reads saved text back into a game state, or gives up if anything looks wrong.
 *
 * Saved text could be old, broken, or edited by hand, so we check every field before trusting
 * it, like a librarian checking a returned book page by page. Then we build a brand-new object
 * field by field instead of using the loaded one, so stray extra fields never sneak into the game.
 * A new field added to the game state must be checked and copied here too, or it is lost on load.
 *
 * @param {string} json - The saved text.
 * @returns {object|null} A safe game state, or null if the save can't be used.
 */
export function restoreGame(json) {
  try {
    const parsed = JSON.parse(json);
    const s = parsed?.version === 3 ? upgradeV3(parsed) : parsed;

    // The right save version, a known character, and a player standing somewhere they're allowed to be.
    if (
      !s ||
      s.version !== SAVE_VERSION ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !s.player ||
      !isWalkable(s.player.x, s.player.y) ||
      ![0, 1, 2, 3].includes(s.player.direction)
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
    ]) {
      if (
        !Array.isArray(list) ||
        list.length > allowed.length ||
        new Set(list).size !== list.length ||
        !list.every((id) => allowed.some((a) => a.id === id))
      )
        return null;
    }

    // Time played, distance walked and the world clock must be real, non-negative numbers.
    if (![s.elapsed, s.distance, s.time].every((n) => Number.isFinite(n) && n >= 0)) return null;

    // Regrowth timers must be a plain object of non-negative times.
    if (
      !regrowAt ||
      typeof regrowAt !== 'object' ||
      Array.isArray(regrowAt) ||
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
    return {
      version: SAVE_VERSION,
      character: s.character,
      player: { x: s.player.x, y: s.player.y, direction: s.player.direction },
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      landmarks: [...s.landmarks],
      waypoints: [...s.waypoints],
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
