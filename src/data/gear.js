// The gear the player can make from the Build menu besides tools: a torch, a feather coat, an
// antler grip and a rowboat. What each one costs and does is game balance, so those numbers live
// in balance.js (GEAR_RECIPES and the constants beside it).

/**
 * Every piece of gear, in Build menu order.
 *
 * Fields: `id` is its key in GEAR_RECIPES; `name` is the word used in messages ("torch"); `use` is
 * the Build menu's short line about what it does; `key` is the number key that picks it while the
 * Build menu is open (1 to 4 are the campfire and the tools; the backpack's is P); `icon` names its line picture in
 * ui/layout.js; `made` is the message shown when it is finished.
 */
export const GEAR = [
  {
    id: 'torch',
    name: 'torch',
    use: 'Lights the night and holds off the cold for a while',
    key: '5',
    icon: 'flame',
    made: 'Torch lit',
  },
  {
    id: 'coat',
    name: 'feather coat',
    use: 'The cold bites half as hard, for good',
    key: '6',
    icon: 'herbs',
    made: 'Feather coat sewn · The cold bites half as hard now',
  },
  {
    id: 'grip',
    name: 'antler grip',
    use: 'Gives your most worn stone tool its uses back',
    key: '7',
    icon: 'hammer',
    made: 'Antler grip fitted',
  },
  {
    id: 'boat',
    name: 'rowboat',
    use: 'Built at the water’s edge, without an old boat',
    key: '8',
    icon: 'wood',
    made: 'Boat built · Walk to the water’s edge and press E to board',
  },
  {
    id: 'backpack',
    name: 'backpack',
    use: 'Adds a second item box of ten slots, for good',
    key: 'p',
    icon: 'bag',
    made: 'Backpack made · You carry a second item box of ten slots',
  },
  {
    id: 'rod',
    name: 'fishing rod',
    use: 'Fish open water for food (press E by the shore)',
    key: 't',
    icon: 'wood',
    made: 'Fishing rod made · Press E by the water to fish',
  },
  {
    id: 'hoe',
    name: 'hoe',
    use: 'Wheat beds give more food at harvest',
    key: 'g',
    icon: 'wood',
    made: 'Hoe forged · Wheat harvests give more now',
  },
  {
    id: 'hat',
    name: 'deer-hide hat',
    use: 'Winter clothing · the cold bites a little less',
    key: 'k',
    icon: 'herbs',
    made: 'Deer-hide hat stitched',
  },
  {
    id: 'jacket',
    name: 'deer-hide jacket',
    use: 'Winter clothing · the cold bites a little less',
    key: 'v',
    icon: 'herbs',
    made: 'Deer-hide jacket stitched',
  },
  {
    id: 'gloves',
    name: 'deer-hide gloves',
    use: 'Winter clothing · the cold bites a little less',
    key: 'n',
    icon: 'herbs',
    made: 'Deer-hide gloves stitched',
  },
  {
    id: 'boots',
    name: 'deer-hide boots',
    use: 'Winter clothing · the cold bites a little less',
    key: 'u',
    icon: 'herbs',
    made: 'Deer-hide boots stitched',
  },
  {
    id: 'arrows',
    name: 'arrows',
    use: 'A bundle of arrows · a bow needs them to shoot',
    key: 'c',
    icon: 'wood',
    made: 'Arrows fletched',
  },
];

/** The gear ids alone, such as 'torch'. */
export const GEAR_IDS = GEAR.map((g) => g.id);

/**
 * Finds a piece of gear's entry in GEAR.
 *
 * @param {string} id - The gear's id, such as 'coat'.
 * @returns {object|undefined} Its entry, or undefined for an unknown id.
 */
export const gearInfo = (id) => GEAR.find((g) => g.id === id);
