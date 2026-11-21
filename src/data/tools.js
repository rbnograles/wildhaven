// The tools the player can craft (axe, pickaxe, hammer) and the two weapons (sword, bow), each in
// two tiers (stone, iron). A weapon is kept, crafted, worn out and saved exactly like a tool.
// What a tool costs and how long it lasts are game balance, so those numbers live in balance.js.

/** The tiers a tool can be, weakest first. Stone tools wear out; iron and up last forever.
 *  Gathering tools are only made in stone and iron (no gold/diamond recipe); weapons go all the way. */
export const TIERS = ['stone', 'iron', 'gold', 'diamond'];

/**
 * Every tool, in Build menu order.
 *
 * Fields: `id` is the save key; `name` is the word used in messages ("stone axe"); `aName` is the
 * name with "a" or "an" in front, for "You need an axe"; `use` is the Build menu's short line
 * about what it is for; `key` is the number key that picks it while the Build menu is open;
 * `icon` names its picture in ui/layout.js; `weapon` is true for the sword and the bow, which the
 * Build menu lists under their own heading.
 */
export const TOOLS = [
  {
    id: 'axe',
    name: 'axe',
    aName: 'an axe',
    use: 'Chops every tree for wood',
    key: '2',
    icon: 'axe',
  },
  {
    id: 'pickaxe',
    name: 'pickaxe',
    aName: 'a pickaxe',
    use: 'Mines rocks for stone and iron',
    key: '3',
    icon: 'pickaxe',
  },
  {
    id: 'hammer',
    name: 'hammer',
    aName: 'a hammer',
    use: 'Needed to forge iron tools',
    key: '4',
    icon: 'hammer',
  },
  {
    id: 'sword',
    name: 'sword',
    aName: 'a sword',
    use: 'Hunts and fights faster than an axe',
    key: 'z',
    icon: 'axe',
    weapon: true,
  },
  {
    id: 'bow',
    name: 'bow',
    aName: 'a bow',
    use: 'Hunts from a distance, before the animal runs',
    key: 'x',
    icon: 'axe',
    weapon: true,
  },
];

/** The tool ids alone, such as 'axe'. Saves may only hold these. */
export const TOOL_IDS = TOOLS.map((t) => t.id);

/**
 * Finds a tool's entry in TOOLS.
 *
 * @param {string} id - The tool's id, such as 'axe'.
 * @returns {object|undefined} Its entry, or undefined for an unknown id.
 */
export const toolInfo = (id) => TOOLS.find((t) => t.id === id);
