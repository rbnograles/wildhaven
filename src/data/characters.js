// The three characters a player can pick, and where each one starts in the shared world.
// The selection screen, the HUD, saves and region discovery all read from this list.

import { SPAWNS } from './places.js';

/**
 * Every playable character.
 *
 * Fields: `id` is the save and lookup key, and also names the character's sprite folder
 * (assets/characters/<id>/); `name`/`shortName` are display names; `location` names the starting region; `tagline`,
 * `description` and `kit` are selection-screen text; `spawn` is the world position where play
 * begins; `resources` is what is in the backpack at the start; `tools` lists the stone tools in
 * the kit (the Scout's hatchet is a stone axe, the Builder's hammer a stone hammer).
 */
export const CHARACTERS = [
  {
    id: 'scout',
    name: 'The Frontier Scout',
    shortName: 'Frontier Scout',
    location: 'Pinefall Woods',
    tagline: 'Follow the trail. Find your home.',
    description:
      'A curious wanderer with a steady step and a love of the wild. Begin among the pines, where every trail leads somewhere new.',
    kit: 'Hatchet · Field pack · 3 food',
    spawn: SPAWNS.scout,
    resources: { wood: 0, stone: 0, food: 3 },
    tools: ['axe'],
  },
  {
    id: 'builder',
    name: 'The Wandering Builder',
    shortName: 'Wandering Builder',
    location: 'Hollowstead Village',
    tagline: 'Where others see ruins, you see a beginning.',
    description:
      'A resourceful craftsperson looking for a place to belong. Start in an abandoned village, with old foundations and new possibilities.',
    kit: 'Hammer · Work gloves · 5 wood',
    spawn: SPAWNS.builder,
    resources: { wood: 5, stone: 2, food: 2 },
    tools: ['hammer'],
  },
  {
    id: 'survivor',
    name: 'The Shipwreck Survivor',
    shortName: 'Shipwreck Survivor',
    location: 'Driftwood Coast',
    tagline: 'The sea took your ship. Not your spirit.',
    description:
      'Washed ashore with a handful of supplies and a will to carry on. Search the coast, follow the inland trail, and make a fresh start.',
    kit: 'Salvaged satchel · Rope · 4 food',
    spawn: SPAWNS.survivor,
    resources: { wood: 2, stone: 0, food: 4 },
    tools: [],
  },
];

/**
 * Finds the character a number of places along from another one, in menu order, wrapping
 * around at both ends. The menu's arrow keys, phone arrows and swipes all use it.
 *
 * @param {string} id - The current character's id, such as `scout`.
 * @param {number} step - How far to move: 1 for the next character, -1 for the previous one.
 * @returns {string} The id of the character `step` places along.
 */
export function nextCharacterId(id, step) {
  const count = CHARACTERS.length;
  const index = CHARACTERS.findIndex((c) => c.id === id);
  return CHARACTERS[(((index + step) % count) + count) % count].id;
}
