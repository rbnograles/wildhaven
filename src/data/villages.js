// The villages of the world, where wolves never go. They match the villages laid out on the Tiled map
// (VILLAGES in tools/arrange-tiled-world.py): each one's middle and how far its safety reaches.
// Hollowstead, the big one, reaches farther.

/**
 * Every village. Fields: `name`; `x` and `y`, its middle in world units; `radius`, how far from the
 * middle a player is safe from wolves.
 */
export const VILLAGES = [
  { name: 'Hollowstead', x: 14336, y: 9348, radius: 1000 },
  { name: "Scout's Camp", x: 14288, y: 4108, radius: 600 },
  { name: "Caravan's Rest", x: 4248, y: 7148, radius: 600 },
  { name: 'Stonewater Mine', x: 6648, y: 9648, radius: 600 },
  { name: 'Snowed-in Hut', x: 23048, y: 6948, radius: 600 },
  { name: 'Old Jetty', x: 22900, y: 10700, radius: 600 },
  { name: 'Overgrown Camp', x: 7248, y: 16848, radius: 600 },
  { name: "Prospector's Camp", x: 3348, y: 17048, radius: 600 },
];
