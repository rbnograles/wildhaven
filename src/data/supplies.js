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
 * gather it (the pine tree and the logs need an axe, the small boulders a pickaxe). For stone, only
 * the small stones scattered over the land (`pebbles` in WILD) are picked up by hand.
 */
export const SUPPLIES = [
  {
    id: 'pine-wood',
    ...SUPPLY_SPOTS['pine-wood'],
    type: 'wood',
    amount: 7,
    label: 'Pine tree',
    verb: 'Chop',
    clip: 'chop',
    tool: 'axe',
    sprite: 'pine',
    scale: 1,
  },
  {
    id: 'camp-stone',
    ...SUPPLY_SPOTS['camp-stone'],
    type: 'stone',
    amount: 5,
    label: 'Small boulder',
    verb: 'Mine',
    clip: 'build',
    tool: 'pickaxe',
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
    amount: 4,
    label: 'Scrap timber',
    verb: 'Chop',
    clip: 'chop',
    tool: 'axe',
    sprite: 'log',
    scale: 0.8,
  },
  {
    id: 'village-stone',
    ...SUPPLY_SPOTS['village-stone'],
    type: 'stone',
    amount: 5,
    label: 'Small boulder',
    verb: 'Mine',
    clip: 'build',
    tool: 'pickaxe',
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
    verb: 'Chop',
    clip: 'chop',
    tool: 'axe',
    sprite: 'log',
    scale: 0.8,
  },
  {
    id: 'coast-stone',
    ...SUPPLY_SPOTS['coast-stone'],
    type: 'stone',
    amount: 5,
    label: 'Beach boulder',
    verb: 'Mine',
    clip: 'build',
    tool: 'pickaxe',
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
// washes up on the sea beaches, so there is always wood for mending a boat. Pebbles are small stones lying all
// over the land, picked up with bare hands, so there is always stone for a first campfire and pickaxe.
// Wild berries are small bushes in the green regions, so food is not only at the three big berry bushes.
// Sticks are fallen branches under the trees of the wooded regions: a little wood for bare hands, so a
// first axe or campfire does not wait on a walk to the beach for driftwood.
export const WILD = {
  'wild-berries': {
    type: 'food',
    amount: 1,
    label: 'Wild berries',
    verb: 'Pick',
    clip: 'gather',
    regrow: 180,
  },
  pebbles: {
    type: 'stone',
    amount: 1,
    label: 'Small stones',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  // The finds: a feather, a pine cone or an antler is a resource of its own (nothing uses them yet);
  // the three loose stones are just stone that looks different.
  feather: {
    type: 'feather',
    amount: 1,
    label: 'Feather',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  'pine-cone': {
    type: 'pinecone',
    amount: 1,
    label: 'Pine cone',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  antler: {
    type: 'antler',
    amount: 1,
    label: 'Antler',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  'mossy-stone': {
    type: 'stone',
    amount: 1,
    label: 'Mossy stone',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  'grey-rock': {
    type: 'stone',
    amount: 1,
    label: 'Loose rock',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  'flat-stone': {
    type: 'stone',
    amount: 1,
    label: 'Flat stone',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
  sticks: {
    type: 'wood',
    amount: 2,
    label: 'Sticks',
    verb: 'Pick up',
    clip: 'gather',
    regrow: 180,
  },
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
  clip: 'chop',
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
// Trees play the `chop` clip (the axe swing); rocks play `build` (an overhead swing) until a mining
// animation exists.
export const HARVEST = {
  pine: tree('Pine tree', 7),
  'snowy-pine': tree('Snowy pine', 7),
  palm: tree('Palm tree', 7),
  oak: tree('Oak tree', 7),
  pines: tree('Pine cluster', 10),
  'big-oak': tree('Big oak', 10),
  'jungle-tree': tree('Jungle tree', 10),
  // A fallen log is wood like a tree, so it is chopped with an axe too, not picked up by hand.
  log: tree('Fallen log', 4),
  'rocks-a': rock('Rocks', 'stone', 2),
  'rocks-b': rock('Rocks', 'stone', 2),
  'beach-rock': rock('Beach rock', 'stone', 2),
  boulder: rock('Boulder', 'stone', 10),
  'cliff-rock': rock('Iron-streaked rock', 'iron', 1),
  'ice-rock': rock('Iron-streaked rock', 'iron', 1),
};

/**
 * Every kind of resource the backpack can hold. Saves must have a whole number for each one.
 * Iron is only mined from iron-streaked rocks, with a pickaxe.
 */
export const RESOURCES = [
  'wood',
  'stone',
  'food',
  'herbs',
  'iron',
  'feather',
  'pinecone',
  'antler',
];

// The words for a resource in a message, where its key is not how you would say it.
// A resource that is not listed here is called by its key ("wood", "stone").
export const RESOURCE_NAMES = { pinecone: 'pine cone' };

// What can fall out of a tree when it is chopped down: the map tree's sprite name → the resource.
// A pine drops a cone; a leafy tree drops a feather from a bird that nested in it. A fallen log
// drops nothing. How often is DROP_CHANCE in data/balance.js.
export const TREE_DROPS = {
  pine: 'pinecone',
  pines: 'pinecone',
  'snowy-pine': 'pinecone',
  oak: 'feather',
  'big-oak': 'feather',
  'jungle-tree': 'feather',
  palm: 'feather',
};
