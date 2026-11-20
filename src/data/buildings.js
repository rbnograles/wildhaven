// The things the player builds at a camp, besides the campfire: a tent, a storage chest, a wheat bed
// and the camp centre. What each one costs and how long it takes is game balance, so those numbers
// live in balance.js (BUILDING_COSTS and the constants beside it); the rules are in actions/building.js.

/**
 * Every building, in Build menu order.
 *
 * Fields: `id` is its kind, as saved in a camp's `buildings`; `name` is the word used in messages;
 * `use` is the Build menu's short line about what it does; `key` is the key that picks it while the
 * Build menu is open; `sprite` is its finished picture (an objects.json sprite, or one per tier or
 * crop stage, see buildingSprite); `scale` is its draw size; `stages` are the pictures shown while it
 * goes up (none: it fades up instead); `made` is the message shown when it is finished.
 */
export const BUILDINGS = [
  {
    id: 'tent',
    name: 'tent',
    use: 'Sleep sheltered: a night costs half the hunger',
    key: '9',
    sprite: 'tent',
    scale: 0.6,
    stages: ['shelter-1', 'shelter-2', 'shelter-3'],
    made: 'Tent pitched · Rest here at dusk to sleep inside',
  },
  {
    id: 'chest',
    name: 'storage chest',
    use: 'Keeps what you gather safe at the camp',
    key: '0',
    sprite: 'chest-closed',
    scale: 1,
    stages: [],
    made: 'Chest built · Press E beside it to open it',
  },
  {
    id: 'farm',
    name: 'wheat bed',
    use: 'Sow a little food, tend it, harvest much more',
    key: '-',
    sprite: 'wheat-1',
    scale: 1,
    stages: [],
    made: 'Wheat bed dug · Press E beside it to sow',
  },
  {
    id: 'centre',
    name: 'camp centre',
    use: 'Grows the camp: a pavilion, then a hall. Its warmth reaches farther',
    key: '=',
    sprite: 'centre-1',
    scale: 1,
    stages: [],
    made: 'Camp centre built · The fire’s warmth reaches farther',
  },
];

/** The building ids alone, such as 'tent'. */
export const BUILDING_IDS = BUILDINGS.map((b) => b.id);

/**
 * Finds a building's entry in BUILDINGS.
 *
 * @param {string} id - The building's kind, such as 'chest'.
 * @returns {object|undefined} Its entry, or undefined for an unknown kind.
 */
export const buildingInfo = (id) => BUILDINGS.find((b) => b.id === id);

/**
 * Says which picture a built building shows now.
 *
 * A chest shows itself full when anything is inside; a wheat bed shows its crop's stage (empty,
 * seedlings, green, ripe); a camp centre shows its tier (pavilion, small hall, big hall).
 *
 * @param {object} b - A building from a camp's `buildings`.
 * @returns {string} The objects.json sprite to draw.
 */
export function buildingSprite(b) {
  if (b.kind === 'chest')
    return Object.values(b.contents ?? {}).some((n) => n > 0) ? 'chest-full' : 'chest-closed';
  if (b.kind === 'farm') return `wheat-${(b.crop?.stage ?? 0) + 1}`;
  if (b.kind === 'centre') return `centre-${b.tier ?? 1}`;
  return buildingInfo(b.kind).sprite;
}
