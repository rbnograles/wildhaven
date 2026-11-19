// The three characters a player can pick, and where each one starts in the shared world.
// The selection screen, the HUD, saves and region discovery all read from this list.

// Region coordinates were first measured on a smaller map; these offsets place each region in the full world.
// tools/build-map.py uses the same offsets for the village and coast, so change both together.
// Each value is the [x, y] shift added to a position measured inside that region.
export const REGION_OFFSETS = { forest: [0, 0], village: [1622, 1158], coast: [3072, 2048] };

/**
 * Turns a position measured inside a region into a position in the whole world.
 *
 * Like giving directions from a landmark: "620 steps from the forest's corner" becomes a full
 * street address once we add where the forest itself sits on the big map.
 *
 * @param {string} region - Which region the position was measured in: 'forest', 'village' or 'coast'.
 * @param {number} x - Distance from the region's left edge.
 * @param {number} y - Distance from the region's top edge.
 * @returns {{x: number, y: number}} The same spot in world coordinates.
 */
export const at = (region, x, y) => ({
  x: x + REGION_OFFSETS[region][0],
  y: y + REGION_OFFSETS[region][1],
});

/**
 * Every playable character.
 *
 * Fields: `id` is the save and lookup key; `row` is the character's row in the sprite sheets;
 * `name`/`shortName` are display names; `location` names the starting region; `tagline`,
 * `description` and `kit` are selection-screen text; `spawn` is the world position where play
 * begins; `resources` is what is in the backpack at the start.
 */
export const CHARACTERS = [
  {
    id: 'scout',
    row: 0,
    name: 'The Frontier Scout',
    shortName: 'Frontier Scout',
    location: 'Pinefall Woods',
    tagline: 'Follow the trail. Find your home.',
    description:
      'A curious wanderer with a steady step and a love of the wild. Begin among the pines, where every trail leads somewhere new.',
    kit: 'Hatchet · Field pack · 3 food',
    spawn: at('forest', 620, 550),
    resources: { wood: 0, stone: 0, food: 3 },
  },
  {
    id: 'builder',
    row: 1,
    name: 'The Wandering Builder',
    shortName: 'Wandering Builder',
    location: 'Hollowstead Village',
    tagline: 'Where others see ruins, you see a beginning.',
    description:
      'A resourceful craftsperson looking for a place to belong. Start in an abandoned village, with old foundations and new possibilities.',
    kit: 'Hammer · Work gloves · 5 wood',
    spawn: at('village', 1450, 890),
    resources: { wood: 5, stone: 2, food: 2 },
  },
  {
    id: 'survivor',
    row: 2,
    name: 'The Shipwreck Survivor',
    shortName: 'Shipwreck Survivor',
    location: 'Driftwood Coast',
    tagline: 'The sea took your ship. Not your spirit.',
    description:
      'Washed ashore with a handful of supplies and a will to carry on. Search the coast, follow the inland trail, and make a fresh start.',
    kit: 'Salvaged satchel · Rope · 4 food',
    spawn: at('coast', 2400, 1580),
    resources: { wood: 2, stone: 0, food: 4 },
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
