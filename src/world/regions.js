import { CHARACTERS } from '../data/characters.js';
import { DISCOVERY_RADIUS, REGION_LABEL_RANGE } from '../data/balance.js';

// Each character's starting area is one discoverable region.
export const LOCATIONS = CHARACTERS.map(c => ({ id: c.id, name: c.location, ...c.spawn, radius: DISCOVERY_RADIUS }));

export function regionAt(player) {
  return LOCATIONS.find(l=>Math.hypot(l.x-player.x,l.y-player.y)<l.radius+REGION_LABEL_RANGE)?.name ?? 'The Open Wilds';
}
