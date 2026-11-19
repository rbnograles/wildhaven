// The game state: one plain object that holds everything about a character's adventure
// (where they stand, what's in their backpack, what they've found). This file creates a new
// one, turns it into text for saving, and carefully checks saved text before loading it back.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { isWalkable } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `collected` lists one-time supplies gathered, `regrowAt`
 *   maps each picked wild patch to the game time it grows back, `discovered` lists region ids,
 *   `elapsed` is game seconds played and `distance` is world units walked.
 * @throws {Error} If the character id isn't one of the known characters.
 */
export function createGame(characterId) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  return {
    version: 2,
    character: character.id,
    player: { ...character.spawn, direction: 0 },
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    collected: [],
    regrowAt: {},
    discovered: [],
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
    const s = JSON.parse(json);

    // The right save version, a known character, and a player standing somewhere they're allowed to be.
    if (
      !s ||
      s.version !== 2 ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !s.player ||
      !isWalkable(s.player.x, s.player.y) ||
      ![0, 1, 2, 3].includes(s.player.direction)
    )
      return null;

    // Saves from before herbs and regrowth have neither field; they load with none of either.
    const resources = s.resources && { herbs: 0, ...s.resources },
      regrowAt = s.regrowAt ?? {};

    // Every resource must be a sensible whole number: not negative, not huge.
    if (
      !resources ||
      !RESOURCES.every(
        (key) =>
          Number.isSafeInteger(resources[key]) && resources[key] >= 0 && resources[key] < 100000,
      )
    )
      return null;

    // The gathered and discovered lists may only hold real ids, each listed once.
    for (const [list, allowed] of [
      [s.collected, SUPPLIES],
      [s.discovered, REGIONS],
    ]) {
      if (
        !Array.isArray(list) ||
        list.length > allowed.length ||
        new Set(list).size !== list.length ||
        !list.every((id) => allowed.some((a) => a.id === id))
      )
        return null;
    }

    // Time played and distance walked must be real, non-negative numbers.
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
    return {
      version: 2,
      character: s.character,
      player: { x: s.player.x, y: s.player.y, direction: s.player.direction },
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      collected: [...s.collected],
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      elapsed: s.elapsed,
      distance: s.distance,
    };
  } catch {
    return null;
  }
}
