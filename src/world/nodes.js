import { SUPPLIES, WILD } from '../data/supplies.js';
import { MAP_OBJECTS, OBJECT_SPECS } from './map.js';

// The fixed supplies plus every wild patch the map scattered; a patch's map position is its id.
export const NODES = [...SUPPLIES, ...MAP_OBJECTS.filter(o=>WILD[o.name])
  .map(o=>({ id:`${o.name}-${o.x}-${o.y}`, x:o.x, y:o.y, ...WILD[o.name], sprite:o.name, scale:OBJECT_SPECS[o.name].scale ?? 1 }))];

// Only one-time supplies are solid; wild patches are walk-through.
export function nodeBases(collected) {
  return SUPPLIES.filter(n=>!collected.includes(n.id)).map(n=>{
    const [halfWidth,depth]=OBJECT_SPECS[n.sprite].footprint;
    return [n.x-halfWidth*n.scale, n.y-depth*n.scale, n.x+halfWidth*n.scale, n.y];
  });
}
