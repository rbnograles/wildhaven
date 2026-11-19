// Everything the player can gather: the fixed supplies placed by hand, the wild plants that
// grow back, and the list of resource types the backpack can hold.

import { at } from './characters.js';

/**
 * The fixed supplies. Each one can be gathered once per character and is then gone for good.
 *
 * Each supply is drawn as its own sprite (an objects.json key at `scale`) and stands solid until gathered.
 * tools/build-map.py keeps scenery off these spots (KEEP_CLEAR), so move them there too.
 *
 * Fields: `id` is the save key; `x`/`y` is the world position; `type` and `amount` say what goes
 * into the backpack; `label` and `verb` are the words on the interact button; `clip` is the
 * animation played while gathering; `sprite` and `scale` choose the picture and its size.
 */
export const SUPPLIES = [
  {
    id: 'pine-wood',
    ...at('forest', 870, 650),
    type: 'wood',
    amount: 3,
    label: 'Pine tree',
    verb: 'Chop',
    clip: 'build',
    sprite: 'pine',
    scale: 1,
  },
  {
    id: 'camp-stone',
    ...at('forest', 480, 570),
    type: 'stone',
    amount: 2,
    label: 'Loose stones',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'rocks-b',
    scale: 0.5,
  },
  {
    id: 'forest-food',
    ...at('forest', 480, 705),
    type: 'food',
    amount: 2,
    label: 'Wild berries',
    verb: 'Pick',
    clip: 'gather',
    sprite: 'berry-bush',
    scale: 1,
  },
  {
    id: 'village-wood',
    ...at('village', 1558, 1012),
    type: 'wood',
    amount: 3,
    label: 'Scrap timber',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'log',
    scale: 0.8,
  },
  {
    id: 'village-stone',
    ...at('village', 1368, 1022),
    type: 'stone',
    amount: 3,
    label: 'Loose stones',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'rocks-b',
    scale: 0.5,
  },
  {
    id: 'village-food',
    ...at('village', 1580, 1190),
    type: 'food',
    amount: 2,
    label: 'Wild berries',
    verb: 'Pick',
    clip: 'gather',
    sprite: 'berry-bush',
    scale: 1,
  },
  {
    id: 'coast-wood',
    ...at('coast', 2558, 1692),
    type: 'wood',
    amount: 4,
    label: 'Driftwood',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'log',
    scale: 0.8,
  },
  {
    id: 'coast-stone',
    ...at('coast', 2250, 1730),
    type: 'stone',
    amount: 2,
    label: 'Beach stones',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'beach-rock',
    scale: 0.6,
  },
  {
    id: 'meadow-food',
    ...at('village', 1678, 1422),
    type: 'food',
    amount: 3,
    label: 'Wild berries',
    verb: 'Pick',
    clip: 'gather',
    sprite: 'berry-bush',
    scale: 1,
  },
];

// Wild scenery the map scatters (tools/build-map.py) that can be harvested where it stands and grows back `regrow`
// game-seconds later. world/nodes.js turns each map patch into a node; the renderer draws it from NODES instead of from the map.
// The key is the sprite name in the map; the fields mean the same as in SUPPLIES.
export const WILD = {
  flowers: {
    type: 'herbs',
    amount: 2,
    label: 'Wildflowers',
    verb: 'Pick',
    clip: 'gather',
    regrow: 180,
  },
};

/** Every kind of resource the backpack can hold. Saves must have a whole number for each one. */
export const RESOURCES = ['wood', 'stone', 'food', 'herbs'];
