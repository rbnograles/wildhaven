// The game state: one plain object that holds everything about a character's adventure (where
// they stand, what's in their backpack, what they've found, their camps and boat, how warm and fed
// they are, and what they've seen). This file creates a new one, turns it into text for saving,
// and carefully checks saved text before loading it back. Older saves are upgraded on the way in.

import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { LANDMARKS, WAYPOINTS, WRECKS } from '../data/places.js';
import {
  START_TIME,
  SUPPLY_REGROW,
  TEA_SECONDS,
  TORCH_SECONDS,
  GRIP_MAX,
  MAX_GROWN,
  CAMP_NAME_MAX,
  MAX_CAMPS,
  FOG_CELL,
  TOOL_USES,
} from '../data/balance.js';
import { TOOL_IDS, TIERS } from '../data/tools.js';
import { BUILT } from '../actions/boat.js';
import { isWalkable, isSailable, SEA_BORDER } from '../world/map.js';
import { NODES, isSceneryNode } from '../world/nodes.js';
import { REGIONS } from '../world/regions.js';
import { emptyFog, isFogString, revealAround, revealRegions, growFog } from '../world/fog.js';
import { startingTools } from '../world/tools.js';
import { BUILDING_IDS } from '../data/buildings.js';
import { emptySlots, isSlots, tidyBag } from '../world/bag.js';

/**
 * The save format this code writes. Version 12 is version 10 (buildings at each camp) plus the
 * item box: which pile of things sits in which slot (up to fifty pieces to a pile), whether the
 * backpack is made, and whether a packed tent is carried. Version 11, which was never released,
 * kept one slot per kind with no limit. Version 13 added the gold and diamond resources. Version 3
 * to 12 saves are upgraded when loaded (see `upgrade`).
 */
export const SAVE_VERSION = 16;

/** The three survival meters. Each is a number from 0 to 100. */
const METERS = ['health', 'hunger', 'warmth'];

/**
 * How many fog squares wide the sea border is. Version 4 fog was saved on the map before the
 * border was added, which was this many squares smaller on every side. tests/game/state.test.js
 * checks it is a whole number, so every old square lands exactly on a new one.
 */
export const BORDER_SQUARES = SEA_BORDER / FOG_CELL;

/**
 * Makes a brand-new adventure for a character, standing at their starting spot.
 *
 * @param {string} characterId - Which character to play: 'scout', 'builder' or 'survivor'.
 * @returns {object} A fresh game state. `regrowAt` maps each gathered node to the world time it
 *   grows back; `discovered` lists region ids; `landmarks`, `waypoints` and `wrecks` list the
 *   places, signposts and old boats found; `boat` is the repaired boat (`{from, x, y, dir}`) or
 *   null, and `aboard` is true while the player sits in it; `elapsed` is game seconds played and
 *   `distance` is world units travelled; `time` is the world clock (game seconds since the dawn
 *   of day 1); `meters` holds health, hunger and warmth; `tea` is the seconds of tea warmth left;
 *   `camps` lists the camps built; `fog` records the squares of the world seen so far; `tools`
 *   holds the tools owned (see world/tools.js); `slots` says which pile of things sits in each
 *   item box slot (see world/bag.js), `backpack` is true once the second item box is carried, and
 *   `packedTent` is true while a tent that was taken down is carried.
 * @throws {Error} If the character id isn't one of the known characters.
 */
export function createGame(characterId) {
  const character = CHARACTERS.find((c) => c.id === characterId);
  if (!character) throw new Error('Unknown character');
  const state = {
    version: SAVE_VERSION,
    character: character.id,
    player: { ...character.spawn, direction: 0 },
    resources: { ...Object.fromEntries(RESOURCES.map((r) => [r, 0])), ...character.resources },
    tools: startingTools(character.id),
    regrowAt: {},
    discovered: [],
    landmarks: [],
    waypoints: [],
    wrecks: [],
    boat: null,
    aboard: false,
    elapsed: 0,
    distance: 0,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    torch: 0,
    coat: false,
    rod: false,
    hoe: false,
    hat: false,
    jacket: false,
    gloves: false,
    boots: false,
    slots: emptySlots(),
    backpack: false,
    packedTent: false,
    camps: [],
    fog: emptyFog(),
  };
  // The starting kit takes the first slots of the item box.
  tidyBag(state);
  revealAround(state, state.player.x, state.player.y);
  return state;
}

/**
 * Turns the game state into text so it can be saved.
 *
 * @param {object} state - The game being played.
 * @returns {string} The state as JSON text.
 */
export function serializeGame(state) {
  return JSON.stringify(state);
}

/**
 * Checks one camp need from a save: a kind the game knows, with sensible fields and a done flag.
 *
 * @param {*} n - The need read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isNeed = (n) =>
  !!n &&
  typeof n.done === 'boolean' &&
  ((n.kind === 'bring' &&
    RESOURCES.includes(n.resource) &&
    Number.isSafeInteger(n.amount) &&
    n.amount >= 1 &&
    n.amount <= 99) ||
    (n.kind === 'place' && REGIONS.some((r) => r.id === n.region)) ||
    n.kind === 'signpost');

/**
 * Checks one building at a camp from a save: an id like "b-4", a known kind, a spot on dry land,
 * and the fields its kind keeps: a chest's contents (whole, non-negative numbers of known
 * resources), a wheat bed's crop (a stage from 0 to 3, the time its next stage comes or null, and
 * whether it was tended), a camp centre's tier (1 to 3).
 *
 * @param {*} b - The building read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isBuilding = (b) =>
  !!b &&
  typeof b.id === 'string' &&
  /^b-\d+$/.test(b.id) &&
  BUILDING_IDS.includes(b.kind) &&
  isWalkable(b.x, b.y, [], false) &&
  (b.kind !== 'chest' ||
    (isPlainObject(b.contents) &&
      Object.entries(b.contents).every(
        ([type, n]) => RESOURCES.includes(type) && Number.isInteger(n) && n >= 0,
      ))) &&
  (b.kind !== 'farm' ||
    (isPlainObject(b.crop) &&
      Number.isInteger(b.crop.stage) &&
      b.crop.stage >= 0 &&
      b.crop.stage <= 3 &&
      (b.crop.readyAt === null || Number.isFinite(b.crop.readyAt)) &&
      typeof b.crop.tended === 'boolean')) &&
  (b.kind !== 'centre' || (Number.isInteger(b.tier) && b.tier >= 1 && b.tier <= 3));

/**
 * Copies a checked building, keeping only the fields its kind uses.
 *
 * @param {object} b - A building that passed `isBuilding`.
 * @returns {object} A fresh building object.
 */
function copyBuilding(b) {
  const out = { id: b.id, kind: b.kind, x: b.x, y: b.y };
  if (b.kind === 'chest') out.contents = { ...b.contents };
  if (b.kind === 'farm')
    out.crop = { stage: b.crop.stage, readyAt: b.crop.readyAt, tended: b.crop.tended };
  if (b.kind === 'centre') out.tier = b.tier;
  return out;
}

/**
 * Checks one camp from a save: an id like "camp-3", a tidy name, a spot on dry land, a growth
 * count in range and exactly three needs. Like the player's spot, cliffs are left out of the
 * land check, so a camp built before a hill was added on that spot still loads.
 *
 * @param {*} c - The camp read from a save.
 * @returns {boolean} True if the game can use it.
 */
const isCamp = (c) =>
  !!c &&
  typeof c.id === 'string' &&
  /^camp-\d+$/.test(c.id) &&
  typeof c.name === 'string' &&
  c.name.length >= 1 &&
  c.name.length <= CAMP_NAME_MAX &&
  c.name.trim() === c.name &&
  isWalkable(c.x, c.y, [], false) &&
  Number.isInteger(c.grown) &&
  c.grown >= 0 &&
  c.grown <= MAX_GROWN &&
  Array.isArray(c.needs) &&
  c.needs.length === 3 &&
  c.needs.every(isNeed) &&
  Array.isArray(c.buildings) &&
  c.buildings.every(isBuilding);

/**
 * Copies a checked need, keeping only the fields its kind uses.
 *
 * @param {object} n - A need that passed `isNeed`.
 * @returns {object} A fresh need object.
 */
function copyNeed(n) {
  if (n.kind === 'bring')
    return { kind: n.kind, resource: n.resource, amount: n.amount, done: n.done };
  if (n.kind === 'place') return { kind: n.kind, region: n.region, done: n.done };
  return { kind: n.kind, done: n.done };
}

/**
 * Copies a checked camp field by field, with fresh copies of its needs.
 *
 * @param {object} c - A camp that passed `isCamp`.
 * @returns {object} A fresh camp object.
 */
const copyCamp = (c) => ({
  id: c.id,
  name: c.name,
  x: c.x,
  y: c.y,
  grown: c.grown,
  needs: c.needs.map(copyNeed),
  buildings: c.buildings.map(copyBuilding),
});

/** Says whether a value is a plain object (not null, not a list), like a saved `regrowAt`. */
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

// Tiers stored without a use count: they never wear out. Stone is the only one that does.
const PERMANENT_TIERS = TIERS.filter((t) => t !== 'stone');

/**
 * Checks the saved tools: only known tools, each either a forged (permanent) tier or stone with a
 * sensible number of uses left.
 *
 * @param {*} tools - The `tools` read from a save.
 * @returns {boolean} True if the game can use them.
 */
const isTools = (tools) =>
  isPlainObject(tools) &&
  Object.entries(tools).every(
    ([id, t]) =>
      TOOL_IDS.includes(id) &&
      isPlainObject(t) &&
      (PERMANENT_TIERS.includes(t.tier) ||
        (t.tier === 'stone' &&
          Number.isSafeInteger(t.uses) &&
          t.uses >= 1 &&
          t.uses <= TOOL_USES[id] * GRIP_MAX)),
  );

/**
 * Copies checked tools field by field: forged ones as `{tier}`, stone ones with their uses left.
 *
 * @param {object} tools - Tools that passed `isTools`.
 * @returns {object} A fresh tools object.
 */
const copyTools = (tools) =>
  Object.fromEntries(
    Object.entries(tools).map(([id, t]) => [
      id,
      PERMANENT_TIERS.includes(t.tier) ? { tier: t.tier } : { tier: 'stone', uses: t.uses },
    ]),
  );

/**
 * Moves the x-y position at the end of a node id out by the sea border.
 * For example `flowers-10-20` becomes `flowers-2058-2068`. Other ids (like `pine-wood`) are left as they are.
 */
const shiftId = (id) =>
  id.replace(/-(\d+)-(\d+)$/, (_, x, y) => `-${Number(x) + SEA_BORDER}-${Number(y) + SEA_BORDER}`);

/**
 * Moves a saved player out by the sea border, onto the same spot of the bigger map.
 *
 * A player who stood where the new coast now cuts in goes back to their character's start instead
 * (a hill there doesn't count: cliffs are ignored, as in restoreGame, so the player can walk off
 * it). A broken position is left broken, for the checks in restoreGame to refuse.
 *
 * @param {object} s - The parsed old save.
 * @returns {object} A fresh player object.
 */
function shiftPlayer(s) {
  // A missing or non-number position (JSON turns NaN into null, and null + 2048 would look fine) is
  // kept as NaN, so restoreGame refuses it.
  const { x, y } = s.player ?? {},
    shifted = (n) => (Number.isFinite(n) ? n + SEA_BORDER : NaN),
    player = { ...s.player, x: shifted(x), y: shifted(y) };
  const spawn = CHARACTERS.find((c) => c.id === s.character)?.spawn;
  if (
    Number.isFinite(player.x) &&
    Number.isFinite(player.y) &&
    spawn &&
    !isWalkable(player.x, player.y, [], false)
  )
    Object.assign(player, spawn);
  return player;
}

/**
 * Says whether a camp moved onto the bigger map now stands in the sea, where no fire can burn.
 *
 * It uses the same land check as isCamp (cliffs don't count), so a spot that new scenery now
 * covers counts too; both happen only near the old map's edge. A camp with a broken position is
 * not "in the sea": it is kept, so the checks in restoreGame refuse the save instead of quietly
 * loading it.
 *
 * @param {*} c - The moved camp.
 * @returns {boolean} True if the camp has a real position that is no longer open dry land.
 */
const inSea = (c) =>
  isPlainObject(c) &&
  Number.isFinite(c.x) &&
  Number.isFinite(c.y) &&
  !isWalkable(c.x, c.y, [], false);

/** The boat fields a save from before the sea border gets: no old boats found, no boat, on foot. */
const NO_BOAT = () => ({ wrecks: [], boat: null, aboard: false });

/**
 * Brings a version 3 save (from before the survival update and the sea) up to version 5.
 *
 * Version 3 had no world clock, meters, camps, fog or boat, and its map had no sea border.
 * - The clock starts again on the morning of day 1, and each regrow timer keeps the time it had
 *   left. A supply version 3 called "collected" (gone for good) now grows back two days from
 *   that morning.
 * - Every position moves out by the sea border, like re-pinning a poster on a bigger board (see
 *   shiftPlayer); wild patch ids hold their position, so their timers move too.
 * - The fog lifts over every region the player had already entered (but not over the new sea
 *   border, which they have never seen) and around where they now stand. This happens after the
 *   move, because the regions are read from today's bigger map.
 * A broken version 3 save is refused here, exactly as the old loader would have refused it.
 *
 * @param {object} s - The parsed version 3 save.
 * @returns {object|null} The save in the version 5 shape (still to be checked), or null.
 */
function upgradeV3(s) {
  const { regrowAt: timers, collected, elapsed, discovered } = s;
  if (
    !isPlainObject(timers) ||
    !Object.values(timers).every((t) => Number.isFinite(t) && t >= 0) ||
    !Array.isArray(collected) ||
    !collected.every((id) => SUPPLIES.some((n) => n.id === id)) ||
    !Number.isFinite(elapsed)
  )
    return null;

  // Each timer keeps the seconds it had left; collected supplies get a fresh two-day timer.
  const regrowAt = Object.fromEntries(
    Object.entries(timers).map(([id, at]) => [shiftId(id), START_TIME + Math.max(0, at - elapsed)]),
  );
  for (const id of collected) regrowAt[id] = START_TIME + SUPPLY_REGROW;

  // Lift the fog over the regions already entered and around where the player now stands.
  const player = shiftPlayer(s);
  const seen = { fog: emptyFog() };
  revealRegions(seen, Array.isArray(discovered) ? discovered : [], SEA_BORDER);
  revealAround(seen, player.x, player.y);

  return {
    ...s,
    version: 5,
    player,
    regrowAt,
    time: START_TIME,
    meters: { health: 100, hunger: 100, warmth: 100 },
    tea: 0,
    camps: [],
    fog: seen.fog,
    ...NO_BOAT(),
  };
}

/**
 * Brings a version 4 save (the survival update, before the sea border) up to version 5.
 *
 * The map grew by SEA_BORDER units of sea on every side, so everything with a position moves out
 * by that much: the player (see shiftPlayer), every camp's fire, and the regrow timers of wild
 * patches, whose ids hold their position. The fog is redrawn on the bigger grid with each seen
 * square in its old place on the land and the new sea squares still unseen. A camp whose fire
 * would now stand in the sea is left behind, so the rest of the adventure still loads. Version 4
 * had no boat yet. Anything odd is left alone, for the checks in restoreGame to refuse.
 *
 * @param {object} s - The parsed version 4 save.
 * @returns {object} The same adventure in the version 5 shape.
 */
function addSeaBorder(s) {
  const timers = s.regrowAt;
  const regrowAt = isPlainObject(timers)
    ? Object.fromEntries(Object.entries(timers).map(([id, t]) => [shiftId(id), t]))
    : timers;

  // Each camp moves with the land; one now in the sea is dropped.
  const camps = Array.isArray(s.camps)
    ? s.camps
        .map((c) => (isPlainObject(c) ? { ...c, x: c.x + SEA_BORDER, y: c.y + SEA_BORDER } : c))
        .filter((c) => !inSea(c))
    : s.camps;

  return {
    ...s,
    version: 5,
    player: shiftPlayer(s),
    regrowAt,
    camps,
    fog: growFog(s.fog, BORDER_SQUARES),
    ...NO_BOAT(),
  };
}

/**
 * Brings a version 5 save (the archipelago, before tools) up to version 6.
 *
 * Version 5 had no iron and no tools. The backpack gets an empty iron slot, and the character
 * gets the kit their selection card always promised (the Scout's hatchet, the Builder's hammer),
 * as if they had carried it all along. Anything odd is left alone, for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 5 save.
 * @returns {object} The same adventure in the version 6 shape.
 */
function addTools(s) {
  return {
    ...s,
    version: 6,
    resources: isPlainObject(s.resources) ? { ...s.resources, iron: 0 } : s.resources,
    tools: startingTools(s.character),
  };
}

/**
 * Brings a version 6 save (tools, before the finds) up to version 7.
 *
 * Version 6 had no feathers, pine cones or antlers. The backpack gets an empty slot for each, like
 * sewing three new pockets onto it. Anything odd is left alone, for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 6 save.
 * @returns {object} The same adventure in the version 7 shape.
 */
function addFinds(s) {
  return {
    ...s,
    version: 7,
    resources: isPlainObject(s.resources)
      ? { ...s.resources, feather: 0, pinecone: 0, antler: 0 }
      : s.resources,
  };
}

/**
 * Brings a version 7 save (the finds, before anything was made from them) up to version 8.
 *
 * Version 7 had no torch and no coat: the torch starts unlit and the coat not worn.
 *
 * @param {object} s - The parsed version 7 save.
 * @returns {object} The same adventure in the version 8 shape.
 */
function addGear(s) {
  return { ...s, version: 8, torch: 0, coat: false };
}

/**
 * Brings a version 8 save (gear, before copper) up to version 9.
 *
 * Version 8 had no copper: the backpack gets an empty copper pocket. Anything odd is left alone,
 * for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 8 save.
 * @returns {object} The same adventure in the version 9 shape.
 */
function addCopper(s) {
  return {
    ...s,
    version: 9,
    resources: isPlainObject(s.resources) ? { ...s.resources, copper: 0 } : s.resources,
  };
}

/**
 * Brings a version 9 save (copper, before camp buildings) up to version 10.
 *
 * Version 9 camps had no buildings: each gets an empty list. Anything odd is left alone, for
 * restoreGame to refuse.
 *
 * @param {object} s - The parsed version 9 save.
 * @returns {object} The same adventure in the version 10 shape.
 */
function addBuildings(s) {
  return {
    ...s,
    version: 10,
    camps: Array.isArray(s.camps)
      ? s.camps.map((c) => (isPlainObject(c) ? { ...c, buildings: [] } : c))
      : s.camps,
  };
}

/**
 * Brings a version 10 save (camp buildings, before the item box had slots) up to version 11.
 *
 * Version 10 had no slots, no backpack and no packed tent. The slots start empty here and
 * restoreGame fills them with what is carried, in the old fixed order, like unpacking a bag onto
 * a shelf.
 *
 * @param {object} s - The parsed version 10 save.
 * @returns {object} The same adventure in the version 11 shape.
 */
function addBag(s) {
  return { ...s, version: 11, slots: [], backpack: false, packedTent: false };
}

/**
 * Brings a version 11 save (one slot per kind of thing, no limit) up to version 12.
 *
 * Version 12 slots hold piles of up to fifty pieces. Each kind keeps the slot the player gave it,
 * as the place of its first pile; restoreGame then lays out the rest of what is carried, fifty to
 * a slot. A save that carries more than its open slots hold keeps the extra piles in the shut
 * slots, still in sight and usable, until they run out.
 *
 * @param {object} s - The parsed version 11 save.
 * @returns {object} The same adventure in the version 12 shape.
 */
function addPiles(s) {
  const slots = emptySlots();
  if (Array.isArray(s.slots))
    s.slots.slice(0, slots.length).forEach((item, i) => {
      if (typeof item === 'string') slots[i] = { item, n: 1 };
    });
  return { ...s, version: 12, slots };
}

/**
 * Brings a version 12 save (piles in the item box, before gold and diamond) up to version 13.
 *
 * Version 12 had no gold and no diamond: the backpack gets an empty pocket for each. Anything odd
 * is left alone, for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 12 save.
 * @returns {object} The same adventure in the version 13 shape.
 */
function addPrecious(s) {
  return {
    ...s,
    version: 13,
    resources: isPlainObject(s.resources) ? { ...s.resources, gold: 0, diamond: 0 } : s.resources,
  };
}

/**
 * Brings a version 13 save (gold and diamond, before leather) up to version 14.
 *
 * Version 13 had no leather: the backpack gets an empty pocket for it. Anything odd is left alone,
 * for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 13 save.
 * @returns {object} The same adventure in the version 14 shape.
 */
function addAmmo(s) {
  // Version 15 had no wolf pelt and no arrows: the backpack gets an empty pocket for each.
  return {
    ...s,
    version: SAVE_VERSION,
    resources: isPlainObject(s.resources) ? { ...s.resources, wolfpelt: 0, arrow: 0 } : s.resources,
  };
}

/**
 * Brings a version 14 save (leather, before the clothes, rod and hoe) up to version 15.
 *
 * @param {object} s - The parsed version 14 save.
 * @returns {object} The same adventure in the version 15 shape.
 */
function addHides(s) {
  // Version 14 had no clothes, rod or hoe. Each of the new kept flags starts off.
  return {
    ...s,
    version: 15,
    rod: false,
    hoe: false,
    hat: false,
    jacket: false,
    gloves: false,
    boots: false,
  };
}

/**
 * Brings a version 13 save (gold and diamond, before leather) up to version 14.
 *
 * Version 13 had no leather: the backpack gets an empty pocket for it. Anything odd is left alone,
 * for restoreGame to refuse.
 *
 * @param {object} s - The parsed version 13 save.
 * @returns {object} The same adventure in the version 14 shape.
 */
function addLeather(s) {
  return {
    ...s,
    version: 14,
    resources: isPlainObject(s.resources) ? { ...s.resources, leather: 0 } : s.resources,
  };
}

/**
 * Says whether a saved boat's origin is real: an old boat's id, or 'built' with the water it was
 * launched on (`home`: a position and a direction).
 *
 * @param {object} boat - The saved boat.
 * @returns {boolean} True when the origin can be trusted.
 */
const isBoatOrigin = (boat) =>
  WRECKS.some((w) => w.id === boat.from) ||
  (boat.from === BUILT &&
    isPlainObject(boat.home) &&
    Number.isFinite(boat.home.x) &&
    Number.isFinite(boat.home.y) &&
    [0, 1, 2, 3].includes(boat.home.dir));

/**
 * Works out where a loaded player and boat should be, mending spots a rebuilt map took away.
 *
 * Aboard, the boat sits right under the player. A boat (or a player in it) left on a spot that is
 * no longer sea goes back to the water by the old boat it was repaired from, and the player is set
 * ashore on that beach. A boat the player built goes back to the water it was launched on, and a
 * player who was in it to their character's start; if even that water is gone, so is the boat.
 * Positions that are still fine are kept as they are.
 *
 * @param {object} s - The checked save.
 * @returns {{player: object, boat: object|null, aboard: boolean}} Fresh objects for the restored game.
 */
function placeBoat(s) {
  const player = { x: s.player.x, y: s.player.y, direction: s.player.direction };
  if (!s.boat) return { player, boat: null, aboard: false };

  // A mended boat's home is its old boat's launch spot; a built boat carries its own.
  const wreck = WRECKS.find((w) => w.id === s.boat.from);
  const origin = wreck
    ? { from: wreck.id }
    : { from: BUILT, home: { x: s.boat.home.x, y: s.boat.home.y, dir: s.boat.home.dir } };
  const boat = s.aboard
    ? { ...origin, x: player.x, y: player.y, dir: player.direction }
    : { ...origin, x: s.boat.x, y: s.boat.y, dir: s.boat.dir };
  if (isSailable(boat.x, boat.y)) return { player, boat, aboard: s.aboard };

  // The sea moved: float the boat at its home again, and bring a player who was in it ashore.
  const home = wreck ? wreck.launch : origin.home;
  const ashore = wreck ?? CHARACTERS.find((c) => c.id === s.character).spawn;
  if (s.aboard) Object.assign(player, { x: ashore.x, y: ashore.y });
  if (!isSailable(home.x, home.y)) return { player, boat: null, aboard: false };
  boat.x = home.x;
  boat.y = home.y;
  return { player, boat, aboard: false };
}

/**
 * Keeps only the found ids the game still has.
 *
 * A place can be deleted or renamed in the world editor. A save that found it earlier is still a
 * good save, so the stale id is quietly left out, like crossing a closed shop off an old list.
 *
 * @param {string[]} ids - The found ids read from a save.
 * @param {{id: string}[]} places - The places the game has now.
 * @returns {string[]} A fresh list with the unknown ids removed.
 */
const stillThere = (ids, places) => ids.filter((id) => places.some((p) => p.id === id));

/**
 * Picks the upgrades an older save needs, if any, and runs them in order.
 *
 * Like climbing stairs one step at a time: a version 3 or 4 save is first brought to version 5,
 * every version 5 save then gains its tools, every version 6 save its pockets for the finds, and
 * every version 7 save its (unlit) torch and (unworn) coat, every version 8 save its copper,
 * every version 9 save an empty list of buildings at each camp, every version 10 save its item
 * box slots, every version 11 save its piles, and every version 12 save its gold and diamond pockets.
 *
 * @param {*} parsed - The parsed save.
 * @returns {*} The save in the version 13 shape (still to be checked), or the save unchanged.
 */
function upgrade(parsed) {
  let s = parsed;
  if (s?.version === 3) s = upgradeV3(s);
  else if (s?.version === 4) s = addSeaBorder(s);
  if (s?.version === 5) s = addTools(s);
  if (s?.version === 6) s = addFinds(s);
  if (s?.version === 7) s = addGear(s);
  if (s?.version === 8) s = addCopper(s);
  if (s?.version === 9) s = addBuildings(s);
  if (s?.version === 10) s = addBag(s);
  if (s?.version === 11) s = addPiles(s);
  if (s?.version === 12) s = addPrecious(s);
  if (s?.version === 13) s = addLeather(s);
  if (s?.version === 14) s = addHides(s);
  return s?.version === 15 ? addAmmo(s) : s;
}

/**
 * Reads saved text back into a game state, or gives up if anything looks wrong.
 *
 * Saved text could be old, broken, or edited by hand, so we check every field before trusting
 * it, like a librarian checking a returned book page by page. Then we build a brand-new object
 * field by field instead of using the loaded one, so stray extra fields never sneak into the game.
 * A new field added to the game state must be checked and copied here too, or it is lost on load.
 * Version 3, 4 and 5 saves are first upgraded (see `upgrade`).
 *
 * @param {string} json - The saved text.
 * @returns {object|null} A safe game state, or null if the save can't be used.
 */
export function restoreGame(json) {
  try {
    const s = upgrade(JSON.parse(json));

    // The right save version, a known character, and a player facing a real direction.
    if (
      !s ||
      s.version !== SAVE_VERSION ||
      !CHARACTERS.some((c) => c.id === s.character) ||
      !s.player ||
      ![0, 1, 2, 3].includes(s.player.direction)
    )
      return null;

    // A boat came from a real old boat (or was built), sits at a real position and faces a real direction.
    // Being aboard needs a boat.
    const { boat } = s;
    if (
      typeof s.aboard !== 'boolean' ||
      (s.aboard && !boat) ||
      (boat !== null &&
        (typeof boat !== 'object' ||
          typeof boat.from !== 'string' ||
          (boat.from === BUILT && !isBoatOrigin(boat)) ||
          !Number.isFinite(boat.x) ||
          !Number.isFinite(boat.y) ||
          ![0, 1, 2, 3].includes(boat.dir)))
    )
      return null;

    // An old boat can be deleted in the world editor. A rowboat mended from it then has no launch
    // spot to go back to, so the boat is removed, and a player who was in it starts from their
    // spawn. A built boat carries its own home, so it is not touched.
    if (boat !== null && boat.from !== BUILT && !WRECKS.some((w) => w.id === boat.from)) {
      const { spawn } = CHARACTERS.find((c) => c.id === s.character);
      if (s.aboard) Object.assign(s.player, { x: spawn.x, y: spawn.y });
      s.boat = null;
      s.aboard = false;
    }

    // On foot the player must stand somewhere walkable. Aboard, any real position will do here:
    // placeBoat brings them ashore if the map no longer has sea there. Cliffs are left out of the
    // on-foot check: a save made before a hill was built on the spot still loads, and movePlayer
    // lets the player walk off the cliff. Trees and rocks are left out too: the player may have
    // saved where one was chopped, and movePlayer lets them walk out of one that grew back.
    if (
      s.aboard
        ? !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y)
        : !isWalkable(s.player.x, s.player.y, [], false, isSceneryNode)
    )
      return null;

    const { resources, regrowAt, meters, tea, camps } = s;

    // Every resource must be a sensible whole number: not negative, not huge.
    if (
      !resources ||
      !RESOURCES.every(
        (key) =>
          Number.isSafeInteger(resources[key]) && resources[key] >= 0 && resources[key] < 100000,
      )
    )
      return null;

    // Tools: only known tools, each iron or a stone one with uses left.
    if (!isTools(s.tools)) return null;

    // The torch has at most one torch's time left, and the coat is either worn or not.
    if (
      !Number.isFinite(s.torch) ||
      s.torch < 0 ||
      s.torch > TORCH_SECONDS ||
      typeof s.coat !== 'boolean' ||
      ['rod', 'hoe', 'hat', 'jacket', 'gloves', 'boots'].some((f) => typeof s[f] !== 'boolean')
    )
      return null;

    // The item box: its slots, each empty or a pile of a known thing, and two yes-or-no facts.
    if (!isSlots(s.slots) || typeof s.backpack !== 'boolean' || typeof s.packedTent !== 'boolean')
      return null;

    // The discovered and found lists are short lists of ids, each listed once. A region must be
    // real. A found place the map no longer has is allowed here and dropped below (`stillThere`).
    for (const list of [s.discovered, s.landmarks, s.waypoints, s.wrecks]) {
      if (
        !Array.isArray(list) ||
        list.length > 1000 ||
        new Set(list).size !== list.length ||
        !list.every((id) => typeof id === 'string')
      )
        return null;
    }
    if (!s.discovered.every((id) => REGIONS.some((r) => r.id === id))) return null;

    // Time played, distance travelled and the world clock must be real, non-negative numbers.
    if (![s.elapsed, s.distance, s.time].every((n) => Number.isFinite(n) && n >= 0)) return null;

    // Regrowth timers must be a plain object of non-negative times.
    if (
      !isPlainObject(regrowAt) ||
      !Object.values(regrowAt).every((t) => Number.isFinite(t) && t >= 0)
    )
      return null;

    // Each meter runs from 0 to 100, and tea from none to one full cup.
    if (
      !meters ||
      !METERS.every((k) => Number.isFinite(meters[k]) && meters[k] >= 0 && meters[k] <= 100) ||
      !Number.isFinite(tea) ||
      tea < 0 ||
      tea > TEA_SECONDS
    )
      return null;

    // Camps: a short list of well-formed camps, each id used once, and each building id used once.
    if (
      !Array.isArray(camps) ||
      camps.length > MAX_CAMPS ||
      !camps.every(isCamp) ||
      new Set(camps.map((c) => c.id)).size !== camps.length ||
      new Set(camps.flatMap((c) => c.buildings.map((b) => b.id))).size !==
        camps.reduce((n, c) => n + c.buildings.length, 0)
    )
      return null;

    // The fog must be the right length for this map.
    if (!isFogString(s.fog)) return null;

    // Node ids are map positions, so a rebuilt map can retire one; dropping its timer only lets it regrow early.
    // A timer that has already run out is dropped too (that node is back), so a save that chopped
    // hundreds of trees stays small. Each kept timer is capped at one regrow ahead, so a node can't stay gone forever.
    const timers = NODES.filter(
      (n) => n.regrow && Object.hasOwn(regrowAt, n.id) && regrowAt[n.id] > s.time,
    ).map((n) => [n.id, Math.min(regrowAt[n.id], s.time + n.regrow)]);

    // Build the result fresh, copying only the fields we checked.
    const placed = placeBoat(s);
    const restored = {
      version: SAVE_VERSION,
      character: s.character,
      player: placed.player,
      resources: Object.fromEntries(RESOURCES.map((r) => [r, resources[r]])),
      tools: copyTools(s.tools),
      regrowAt: Object.fromEntries(timers),
      discovered: [...s.discovered],
      landmarks: stillThere(s.landmarks, LANDMARKS),
      waypoints: stillThere(s.waypoints, WAYPOINTS),
      wrecks: stillThere(s.wrecks, WRECKS),
      boat: placed.boat,
      aboard: placed.aboard,
      elapsed: s.elapsed,
      distance: s.distance,
      time: s.time,
      meters: Object.fromEntries(METERS.map((k) => [k, meters[k]])),
      tea,
      torch: s.torch,
      coat: s.coat,
      rod: s.rod,
      hoe: s.hoe,
      hat: s.hat,
      jacket: s.jacket,
      gloves: s.gloves,
      boots: s.boots,
      slots: s.slots.map((pile) => (pile ? { item: pile.item, n: pile.n } : null)),
      backpack: s.backpack,
      packedTent: s.packedTent,
      camps: camps.map(copyCamp),
      fog: s.fog,
    };
    // Lay the piles out to match what is carried: fifty to a slot, nothing left out.
    tidyBag(restored);
    return restored;
  } catch {
    return null;
  }
}
