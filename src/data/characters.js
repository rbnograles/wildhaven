// Region coordinates were first measured on a smaller map; these offsets place each region in the full world.
// tools/build-map.py uses the same offsets for the village and coast.
export const REGION_OFFSETS = { forest: [0, 0], village: [1622, 1158], coast: [3072, 2048] };
export const at = (region, x, y) => ({ x: x + REGION_OFFSETS[region][0], y: y + REGION_OFFSETS[region][1] });

export const CHARACTERS = [
  { id: 'scout', row: 0, name: 'The Frontier Scout', shortName: 'Frontier Scout', location: 'Pinefall Woods', tagline: 'Follow the trail. Find your home.', description: 'A curious wanderer with a steady step and a love of the wild. Begin among the pines, where every trail leads somewhere new.', kit: 'Hatchet · Field pack · 3 food', spawn: at('forest', 620, 550), resources: { wood: 0, stone: 0, food: 3 } },
  { id: 'builder', row: 1, name: 'The Wandering Builder', shortName: 'Wandering Builder', location: 'Hollowstead Village', tagline: 'Where others see ruins, you see a beginning.', description: 'A resourceful craftsperson looking for a place to belong. Start in an abandoned village, with old foundations and new possibilities.', kit: 'Hammer · Work gloves · 5 wood', spawn: at('village', 1450, 890), resources: { wood: 5, stone: 2, food: 2 } },
  { id: 'survivor', row: 2, name: 'The Shipwreck Survivor', shortName: 'Shipwreck Survivor', location: 'Driftwood Coast', tagline: 'The sea took your ship. Not your spirit.', description: 'Washed ashore with a handful of supplies and a will to carry on. Search the coast, follow the inland trail, and make a fresh start.', kit: 'Salvaged satchel · Rope · 4 food', spawn: at('coast', 2400, 1580), resources: { wood: 2, stone: 0, food: 4 } },
];
