// The list of what every key and button does, grouped the way the journal's Controls page shows
// it. The Build menu's number keys are read from the tool, gear and building tables, so a key
// changed there is never written wrongly here.
import { TOOLS } from './tools.js';
import { GEAR } from './gear.js';
import { BUILDINGS } from './buildings.js';

/**
 * Makes a name start with a capital letter, so "feather coat" reads "Feather coat" in a list.
 *
 * @param {string} name - A name in small letters.
 * @returns {string} The same name with its first letter made big.
 */
const capital = (name) => name[0].toUpperCase() + name.slice(1);

/**
 * Turns one row of a Build menu table into a row for the controls list.
 *
 * @param {{key: string, name: string}} thing - A tool, a piece of gear or a camp building.
 * @returns {{keys: string[], does: string}} The key to press and what it makes.
 */
const menuRow = (thing) => ({ keys: [thing.key.toUpperCase()], does: capital(thing.name) });

// Every group of controls, in the order the journal shows them. Each group has a `title`, an
// optional `note` (a line of small print under the title) and its `rows`. A row's `keys` are the
// key caps to draw (two or more mean "any of these") and `does` says what happens.
export const CONTROLS = [
  {
    title: 'Getting around',
    rows: [
      { keys: ['W A S D', 'Arrows'], does: 'Walk, or row the boat' },
      { keys: ['Shift'], does: 'Hold to run, or to row faster' },
      { keys: ['Click'], does: 'Walk to a tree, rock or patch and gather it' },
    ],
  },
  {
    title: 'Doing things',
    note: 'Walking away stops what you are doing, and nothing is lost.',
    rows: [
      { keys: ['E'], does: 'Gather, chop, mine or hunt what is in reach' },
      { keys: ['E'], does: 'Mend an old boat, step aboard, or step ashore' },
      { keys: ['E'], does: 'Open your camp beside its fire, or a storage chest' },
      { keys: ['E'], does: 'Sow, tend or harvest a wheat bed' },
      { keys: ['F'], does: 'Eat food' },
      { keys: ['H'], does: 'Heal with herbs' },
      { keys: ['R'], does: 'Drive back wolves close by' },
    ],
  },
  {
    title: 'Build menu',
    note: 'Press B first. The number keys work while the menu is open.',
    rows: [
      { keys: ['B'], does: 'Open or close the Build menu' },
      { keys: ['1'], does: 'Campfire' },
      ...TOOLS.map(menuRow),
      ...GEAR.map(menuRow),
      ...BUILDINGS.map(menuRow),
      { keys: ['E', 'Click'], does: 'Put the building down where its ghost stands' },
      { keys: ['Esc'], does: 'Close the menu, or stop placing' },
    ],
  },
  {
    title: 'Map, journal and pause',
    rows: [
      { keys: ['M'], does: 'World map; click a found signpost to travel there' },
      { keys: ['J'], does: 'This journal' },
      { keys: ['Esc'], does: 'Pause' },
    ],
  },
];
