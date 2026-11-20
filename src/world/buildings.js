// The buildings standing at the player's camps (a tent, chests, wheat beds, a camp centre): which camp
// a spot belongs to, how big each building's solid base is, which one is within reach, and how the
// wheat in a bed grows. Nothing here changes a building except growCrops, which moves crops on.

import { BUILDING_REACH, GROW_SECONDS } from '../data/balance.js';
import { buildingInfo, buildingSprite } from '../data/buildings.js';
import { OBJECT_SPECS } from './map.js';
import { fireRadius } from './camps.js';

/**
 * Finds the camp whose fire's warmth covers a spot: buildings belong to the camp they stand in.
 *
 * @param {object} state - The game being played.
 * @param {number} x - World x of the spot.
 * @param {number} y - World y of the spot.
 * @returns {object|null} The nearest camp whose warmth reaches the spot, or null.
 */
export function campAt(state, x, y) {
  let best = null;
  for (const camp of state.camps) {
    const d = Math.hypot(camp.x - x, camp.y - y);
    if (d <= fireRadius(camp) && (!best || d < Math.hypot(best.x - x, best.y - y))) best = camp;
  }
  return best;
}

/**
 * Finds a camp's centre, if it has one.
 *
 * @param {object} camp - The camp.
 * @returns {object|undefined} Its centre building.
 */
export const centreOf = (camp) => camp.buildings?.find((b) => b.kind === 'centre');

/**
 * Gives the solid base of a building of some kind and look at a spot, as a box.
 *
 * The box comes from the sprite's footprint in objects.json, grown by the building's draw size, like a
 * map object's. A sprite with no footprint (the wheat bed) is walked through, so it has no box.
 *
 * @param {string} kind - The building's kind, such as 'tent'.
 * @param {string} sprite - The picture it shows (a chest and a centre change picture).
 * @param {number} x - World x of its ground point.
 * @param {number} y - World y of its ground point.
 * @returns {number[]|null} The box as [left, top, right, bottom], or null.
 */
export function baseOf(kind, sprite, x, y) {
  const spec = OBJECT_SPECS[sprite],
    s = buildingInfo(kind).scale * (spec?.scale ?? 1);
  if (!spec?.footprint) return null;
  const [halfWidth, depth] = spec.footprint;
  return [x - halfWidth * s, y - depth * s, x + halfWidth * s, y];
}

/**
 * Gives the space a building takes up on the ground while it is placed: its solid base, or for one
 * that is walked through (the wheat bed) the lower part of its picture, so two beds never overlap.
 *
 * @param {string} kind - The building's kind.
 * @param {string} sprite - The picture it shows.
 * @param {number} x - World x of its ground point.
 * @param {number} y - World y of its ground point.
 * @returns {number[]} The box as [left, top, right, bottom].
 */
export function plotOf(kind, sprite, x, y) {
  return baseOf(kind, sprite, x, y) ?? [x - 55, y - 45, x + 55, y];
}

/**
 * Lists the solid base of every building at every camp, so walking and building go round them.
 *
 * @param {object} state - The game being played.
 * @returns {number[][]} One box per solid building.
 */
export const buildingBases = (state) =>
  state.camps.flatMap((camp) =>
    (camp.buildings ?? []).flatMap((b) => {
      const box = baseOf(b.kind, buildingSprite(b), b.x, b.y);
      return box ? [box] : [];
    }),
  );

/**
 * Finds the closest building of the given kinds within reach of the player.
 *
 * @param {object} state - The game being played.
 * @param {string[]} kinds - The kinds to look for, such as ['chest', 'farm'].
 * @returns {{camp: object, building: object}|null} The building and its camp, or null.
 */
export function nearbyBuilding(state, kinds) {
  const { x, y } = state.player;
  let best = null;
  for (const camp of state.camps)
    for (const building of camp.buildings ?? []) {
      if (!kinds.includes(building.kind)) continue;
      const d = Math.hypot(building.x - x, building.y - y);
      if (d <= BUILDING_REACH && (!best || d < best.d)) best = { camp, building, d };
    }
  return best && { camp: best.camp, building: best.building };
}

/**
 * Moves the wheat on in every bed whose next stage is due, by the world clock.
 *
 * A bed's `crop.readyAt` is the time its next stage comes; a ripe bed has none. A long jump of the
 * clock (a rest, passing out) can bring several stages at once, so it keeps going while one is due.
 * Like a kitchen timer per bed: when it rings, the wheat grows a stage and the timer is set again.
 *
 * @param {object} state - The game being played. Its beds' crops change.
 * @returns {number} How many beds grew a stage.
 */
export function growCrops(state) {
  let grew = 0;
  for (const camp of state.camps)
    for (const b of camp.buildings ?? []) {
      const crop = b.crop;
      if (b.kind !== 'farm' || !crop) continue;
      while (crop.readyAt !== null && state.time >= crop.readyAt) {
        crop.stage += 1;
        crop.tended = false;
        crop.readyAt = crop.stage < 3 ? crop.readyAt + GROW_SECONDS : null;
        grew++;
      }
    }
  return grew;
}
