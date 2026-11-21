// Wolves: which caves are their dens, where every wolf is and what it is doing right now, and where a
// player is safe from them. The dens come from the map's caves once; what the wolves are doing is
// never saved: every time a game is opened the packs start again at home. Moving them is
// actions/wolves.js.

import { DENS_PER_REGION, PACK_SIZE, DEN_FROM_SPAWN, WOLF_HP } from '../data/balance.js';
import { SPAWNS } from '../data/places.js';
import { VILLAGES } from '../data/villages.js';
import { MAP_OBJECTS, isWalkable } from './map.js';
import { regionOf } from './regions.js';
import { fireRadius } from './camps.js';

/**
 * Reads a text property of a map object, such as a cave's `holds`.
 *
 * @param {object} o - A map object.
 * @param {string} name - The property's name.
 * @returns {string|undefined} Its value.
 */
const textOf = (o, name) =>
  Array.isArray(o.properties) ? o.properties.find((p) => p.name === name)?.value : undefined;

/**
 * Picks the wolf dens: in each region, up to DENS_PER_REGION caves, those the map marks `holds: wolf
 * den` first, then caves with no label. A cave that holds minerals is never a den, nor one on an islet
 * (one whose mouth is not on the mainland's walkable ground), nor one near a start spot.
 *
 * @returns {{id: string, region: string, x: number, y: number}[]} The dens: where their wolves gather
 *   (a little in front of the cave's mouth).
 */
function chooseDens() {
  const caves = MAP_OBJECTS.filter((o) => o.name.startsWith('cave-'))
    .map((o) => ({ cave: o, holds: textOf(o, 'holds'), x: o.x, y: o.y + 70 }))
    .filter((c) => c.holds !== 'minerals' && isWalkable(c.x, c.y))
    .filter((c) =>
      Object.values(SPAWNS).every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= DEN_FROM_SPAWN),
    )
    .sort((a, b) => (b.holds === 'wolf den') - (a.holds === 'wolf den'));
  const dens = [],
    count = {};
  for (const c of caves) {
    const region = regionOf(c.x, c.y).id;
    if ((count[region] ?? 0) >= DENS_PER_REGION) continue;
    count[region] = (count[region] ?? 0) + 1;
    dens.push({ id: `den-${dens.length}`, region, x: c.x, y: c.y });
  }
  return dens;
}

/** Every wolf den. */
export const DENS = chooseDens();

/**
 * Gives one wolf of a den its place at home, standing guard.
 *
 * @param {object} den - The den.
 * @param {number} i - Which wolf of the pack, from 0.
 * @returns {object} The wolf: id, den, position, facing (1 west, 2 east), slant ('n' or 's' while
 *   it heads up or down the screen as well as sideways, else null), what it is doing, and its
 *   plan while chasing (`path`, the turning points to run through, made again in `replanIn` s).
 */
function atDen(den, i) {
  return {
    id: `wolf-${den.id}-${i}`,
    den,
    hp: WOLF_HP,
    x: den.x + (i - 1) * 50,
    y: den.y + (i % 2) * 30,
    facing: i % 2 ? 1 : 2,
    slant: null,
    phase: 'idle',
    clock: i * 0.4,
    left: 1 + i,
    target: null,
    path: null,
    replanIn: 0,
    stunFor: 0,
    biteWait: 0,
    respawnAt: 0,
  };
}

/** Every wolf, where it is and what it is doing right now. Never saved. */
export const WOLVES = DENS.flatMap((den) =>
  Array.from({ length: PACK_SIZE }, (_, i) => atDen(den, i)),
);

/** Sends every pack back to its den, whole and standing guard. Called whenever a game is opened. */
export function resetWolves() {
  let i = 0;
  for (const den of DENS)
    for (let n = 0; n < PACK_SIZE; n++) Object.assign(WOLVES[i++], atDen(den, n));
}

/**
 * Says whether a wolf is up and about: not lying down, not gone.
 *
 * @param {object} w - The wolf.
 * @returns {boolean} True while it can hunt the player and be fought.
 */
export const wolfAlive = (w) => w.phase !== 'down' && w.phase !== 'gone';

/**
 * Says whether a spot is safe from wolves: inside a village, or inside the warmth of one of the
 * player's fires. Wolves never step into such a spot, and draw back from it.
 *
 * @param {object} state - The game being played (its camps).
 * @param {number} x - World x.
 * @param {number} y - World y.
 * @returns {boolean} True where wolves will not go.
 */
export function isSafe(state, x, y) {
  return (
    VILLAGES.some((v) => Math.hypot(v.x - x, v.y - y) <= v.radius) ||
    state.camps.some((camp) => Math.hypot(camp.x - x, camp.y - y) <= fireRadius(camp))
  );
}
