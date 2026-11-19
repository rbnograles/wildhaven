// Everything the player can gather: the fixed supplies placed by hand, the wild plants that
// grow back, and the list of resource types the backpack can hold.

import { SUPPLY_SPOTS } from './places.js';
import { SUPPLY_REGROW } from './balance.js';

/**
 * The fixed supplies. Each one can be gathered, and grows back SUPPLY_REGROW game-seconds (two
 * in-game days) later.
 *
 * Each supply is drawn as its own sprite (an objects.json key at `scale`) and stands solid while it stands.
 * Positions live in assets/world/source/places.json; tools/build-map.py keeps scenery off them.
 *
 * Fields: `id` is the save key; `x`/`y` is the world position; `type` and `amount` say what goes
 * into the backpack; `label` and `verb` are the words on the interact button; `clip` is the
 * animation played while gathering; `sprite` and `scale` choose the picture and its size;
 * `regrow` is the seconds it takes to grow back.
 */
export const SUPPLIES = [
  {
    id: 'pine-wood',
    ...SUPPLY_SPOTS['pine-wood'],
    type: 'wood',
    amount: 3,
    label: 'Pine tree',
    verb: 'Chop',
    clip: 'chop',
    sprite: 'pine',
    scale: 1,
  },
  {
    id: 'camp-stone',
    ...SUPPLY_SPOTS['camp-stone'],
    type: 'stone',
    amount: 2,
    label: 'Loose stones',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'rocks-a',
    scale: 0.5,
  },
  {
    id: 'forest-food',
    ...SUPPLY_SPOTS['forest-food'],
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
    ...SUPPLY_SPOTS['village-wood'],
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
    ...SUPPLY_SPOTS['village-stone'],
    type: 'stone',
    amount: 3,
    label: 'Loose stones',
    verb: 'Gather',
    clip: 'gather',
    sprite: 'rocks-a',
    scale: 0.5,
  },
  {
    id: 'village-food',
    ...SUPPLY_SPOTS['village-food'],
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
    ...SUPPLY_SPOTS['coast-wood'],
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
    ...SUPPLY_SPOTS['coast-stone'],
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
    ...SUPPLY_SPOTS['meadow-food'],
    type: 'food',
    amount: 3,
    label: 'Wild berries',
    verb: 'Pick',
    clip: 'gather',
    sprite: 'berry-bush',
    scale: 1,
  },
  // Every fixed supply grows back on the same slow timer.
].map((supply) => ({ ...supply, regrow: SUPPLY_REGROW }));

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
