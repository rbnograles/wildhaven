// The animals of the wild: where each herd lives, and where every animal is and what it is doing right
// now. The herds' homes are worked out from the map once, the same way every time (a fixed seed per
// region), so they never move between games. What the animals are doing is never saved: every time a
// game is opened they start again from home, like the villagers. Moving them is actions/animals.js.

import { ANIMALS, ANIMAL_KINDS } from '../data/animals.js';
import { HERDS_PER_REGION, HERD_ROAM } from '../data/balance.js';
import { SPAWNS, LANDMARKS, WAYPOINTS } from '../data/places.js';
import { isWalkable, WORLD } from './map.js';
import { REGIONS, regionOf } from './regions.js';

// Herds keep this far from the start spots, from every place, and from each other, in world units.
const FROM_SPAWN = 1200;
const FROM_PLACE = 350;
const HERD_APART = 1400;

// How many random spots are tried per region before giving up on more herds there.
const TRIES = 6000;

/**
 * Makes a dice that always rolls the same numbers for the same seed (a tiny random number maker,
 * known as mulberry32), so the herds are in the same places in every game.
 *
 * @param {number} seed - The starting number.
 * @returns {() => number} A function that gives the next number from 0 to 1.
 */
function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Says whether a spot is good for a herd's home: open ground in the right region, away from the
 * start spots, every place and the other herds.
 *
 * @param {number} x - World x.
 * @param {number} y - World y.
 * @param {string} region - The region it must be in.
 * @param {object[]} homes - The herd homes chosen so far.
 * @returns {boolean} True when a herd may live there.
 */
function goodHome(x, y, region, homes) {
  if (regionOf(x, y).id !== region || !isWalkable(x, y)) return false;
  if (Object.values(SPAWNS).some((s) => Math.hypot(s.x - x, s.y - y) < FROM_SPAWN)) return false;
  if ([...LANDMARKS, ...WAYPOINTS].some((p) => Math.hypot(p.x - x, p.y - y) < FROM_PLACE))
    return false;
  return homes.every((h) => Math.hypot(h.x - x, h.y - y) >= HERD_APART);
}

/**
 * Picks every herd's home: HERDS_PER_REGION in each region with animals, the kinds that live there
 * taking turns.
 *
 * @returns {{id: string, kind: string, region: string, x: number, y: number, size: number}[]} The herds.
 */
function chooseHerds() {
  const herds = [];
  REGIONS.forEach((region, index) => {
    const kinds = ANIMAL_KINDS.filter((k) => ANIMALS[k].regions.includes(region.id));
    if (!kinds.length) return;
    const roll = dice(1000 + index);
    for (let t = 0, made = 0; t < TRIES && made < HERDS_PER_REGION; t++) {
      const x = Math.round(roll() * WORLD.width),
        y = Math.round(roll() * WORLD.height);
      if (!goodHome(x, y, region.id, herds)) continue;
      const kind = kinds[made % kinds.length],
        [least, most] = ANIMALS[kind].herd;
      herds.push({
        id: `herd-${region.id}-${made}`,
        kind,
        region: region.id,
        x,
        y,
        size: least + Math.floor(roll() * (most - least + 1)),
      });
      made++;
    }
  });
  return herds;
}

/** Every herd in the world: its id, kind, region, home spot and how many animals it has. */
export const HERDS = chooseHerds();

/**
 * Gives one animal of a herd its place at home: a little way from the herd's middle, on open
 * ground, grazing.
 *
 * @param {object} herd - The herd.
 * @param {number} i - Which member of the herd, from 0.
 * @returns {object} The animal: id, kind, herd, position, facing (1 west, 2 east), slant ('n' or
 *   's' while it heads up or down the screen as well as sideways, else null) and what it is doing.
 */
function atHome(herd, i) {
  const angle = (i / herd.size) * Math.PI * 2,
    spread = i ? 60 : 0;
  let x = Math.round(herd.x + Math.cos(angle) * spread),
    y = Math.round(herd.y + Math.sin(angle) * spread * 0.6);
  if (!isWalkable(x, y)) ({ x, y } = herd);
  return {
    id: `${herd.id}-${i}`,
    kind: herd.kind,
    hp: ANIMALS[herd.kind].hp,
    herd,
    x,
    y,
    facing: i % 2 ? 1 : 2,
    slant: null,
    phase: 'idle',
    left: 1 + i * 0.7,
    clock: i * 0.37,
    target: null,
    fleeFor: 0,
    respawnAt: 0,
  };
}

/** Every animal, where it is and what it is doing right now. Never saved. */
export const WILD_ANIMALS = HERDS.flatMap((herd) =>
  Array.from({ length: herd.size }, (_, i) => atHome(herd, i)),
);

/** Sends every animal back to its herd's home, alive and grazing. Called whenever a game is opened. */
export function resetAnimals() {
  let i = 0;
  for (const herd of HERDS)
    for (let n = 0; n < herd.size; n++) Object.assign(WILD_ANIMALS[i++], atHome(herd, n));
}

/**
 * Finds an animal by its id.
 *
 * @param {string} id - Such as 'herd-meadows-2-1'.
 * @returns {object|undefined} The animal.
 */
export const animalById = (id) => WILD_ANIMALS.find((a) => a.id === id);

/**
 * Says whether an animal is out and about: not hunted, not lying down.
 *
 * @param {object} a - The animal.
 * @returns {boolean} True while it can be seen, scared and hunted.
 */
export const isAlive = (a) => a.phase !== 'down' && a.phase !== 'gone';

/**
 * Picks a new spot for an animal to wander to: somewhere within HERD_ROAM of its herd's home.
 *
 * @param {object} a - The animal.
 * @param {() => number} random - Gives a number from 0 to 1.
 * @returns {{x: number, y: number}} The spot (it may turn out to be blocked; walking checks).
 */
export function wanderSpot(a, random) {
  const angle = random() * Math.PI * 2,
    r = random() * HERD_ROAM;
  return { x: a.herd.x + Math.cos(angle) * r, y: a.herd.y + Math.sin(angle) * r * 0.7 };
}
