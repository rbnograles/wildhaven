// The gear the player can make from the Build menu besides tools: a torch, a feather coat, an
// antler grip and a rowboat. What each one costs and does is game balance, so those numbers live
// in balance.js (GEAR_RECIPES and the constants beside it).

/**
 * Every piece of gear, in Build menu order.
 *
 * Fields: `id` is its key in GEAR_RECIPES; `name` is the word used in messages ("torch"); `use` is
 * the Build menu's short line about what it does; `key` is the number key that picks it while the
 * Build menu is open (1 to 4 are the campfire and the tools); `icon` names its line picture in
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
