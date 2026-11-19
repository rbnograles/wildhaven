import { LOCATIONS } from '../world/regions.js';

export function discover(state) {
  const found=LOCATIONS.filter(l=>!state.discovered.includes(l.id) && Math.hypot(l.x-state.player.x,l.y-state.player.y)<l.radius);
  state.discovered.push(...found.map(l=>l.id));
  return found;
}
