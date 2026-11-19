// The three tools the player can craft (axe, pickaxe, hammer) and their two tiers (stone, iron).
// What a tool costs and how long it lasts are game balance, so those numbers live in balance.js.

/** The tiers a tool can be, weakest first. Stone tools wear out; iron tools last forever. */
export const TIERS = ['stone', 'iron'];

/**
 * Every tool, in Build menu order.
 *
 * Fields: `id` is the save key; `name` is the word used in messages ("stone axe"); `aName` is the
 * name with "a" or "an" in front, for "You need an axe"; `use` is the Build menu's short line
 * about what it is for; `key` is the number key that picks it while the Build menu is open;
 * `icon` names its picture in ui/layout.js.
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
