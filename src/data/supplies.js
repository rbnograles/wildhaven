// Everything the player can gather: the fixed supplies placed by hand, the wild plants that
// grow back, the trees and rocks a tool can harvest, and the resource types the backpack holds.

import { SUPPLY_SPOTS } from './places.js';
import { SUPPLY_REGROW, HARVEST_REGROW } from './balance.js';

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
 * `regrow` is the seconds it takes to grow back; `tool`, when set, names the tool needed to
 * gather it (the pine tree needs an axe).
 */
export const SUPPLIES = [
  {
    id: 'pine-wood',
    ...SUPPLY_SPOTS['pine-wood'],
    type: 'wood',
    amount: 3,
    label: 'Pine tree',
    verb: 'Chop',
    clip: 'build',
    tool: 'axe',
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
    sprite: 'rocks-b',
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
    sprite: 'rocks-b',
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
// The key is the sprite name in the map; the fields mean the same as in SUPPLIES. Flowers grow inland; driftwood
// washes up on the sea beaches, so there is always wood for mending a boat.
export const WILD = {
  driftwood: {
    type: 'wood',
    amount: 1,
    label: 'Driftwood',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  flowers: {
    type: 'herbs',
    amount: 2,
    label: 'Wildflowers',
    verb: 'Pick',
    clip: 'gather',
    regrow: 180,
  },
};

/**
 * Makes the HARVEST entry for a tree: chopped with an axe for some wood.
 *
 * @param {string} label - The tree's name on the interact button, such as 'Pine tree'.
 * @param {number} amount - How much wood one chop gives.
 * @returns {object} The entry, with the same fields as SUPPLIES plus `tool`.
 */
const tree = (label, amount) => ({
  type: 'wood',
  amount,
  label,
  verb: 'Chop',
  clip: 'build',
  tool: 'axe',
  regrow: HARVEST_REGROW,
});

/**
 * Makes the HARVEST entry for a rock: mined with a pickaxe for stone or iron.
 *
 * @param {string} label - The rock's name on the interact button, such as 'Boulder'.
 * @param {string} type - What it gives: 'stone' or 'iron'.
 * @param {number} amount - How much one mining gives.
 * @returns {object} The entry, with the same fields as SUPPLIES plus `tool`.
 */
const rock = (label, type, amount) => ({
  type,
  amount,
  label,
  verb: 'Mine',
  clip: 'build',
  tool: 'pickaxe',
  regrow: HARVEST_REGROW,
});

// Map scenery that needs a tool: every tree is chopped with an axe and every rock is mined with a
// pickaxe. world/nodes.js turns each one the map placed into a node (id `<sprite>-<x>-<y>`). Unlike
// WILD patches they stay drawn with the map's scenery, and they keep their solid base while standing.
// Iron comes from the streaked cliff rocks of Stonewater Canyons and the ice rocks of Frostpeak.
// The `build` clip (an overhead swing) stands in for chopping and mining until those animations exist.
export const HARVEST = {
  pine: tree('Pine tree', 2),
  'snowy-pine': tree('Snowy pine', 2),
  palm: tree('Palm tree', 2),
  oak: tree('Oak tree', 2),
  pines: tree('Pine cluster', 3),
  'big-oak': tree('Big oak', 3),
  'jungle-tree': tree('Jungle tree', 3),
  'rocks-a': rock('Rocks', 'stone', 2),
  'rocks-b': rock('Rocks', 'stone', 2),
  'beach-rock': rock('Beach rock', 'stone', 2),
  boulder: rock('Boulder', 'stone', 3),
  'cliff-rock': rock('Iron-streaked rock', 'iron', 1),
  'ice-rock': rock('Iron-streaked rock', 'iron', 1),
};

/**
 * Every kind of resource the backpack can hold. Saves must have a whole number for each one.
 * Iron is only mined from iron-streaked rocks, with a pickaxe.
 */
export const RESOURCES = ['wood', 'stone', 'food', 'herbs', 'iron'];
