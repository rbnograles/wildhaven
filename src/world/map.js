import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };
import OBJECT_SPECS from '../../assets/world/source/objects.json' with { type: 'json' };

export { OBJECT_SPECS };
export const WORLD = { width: MAP.width*MAP.tilewidth, height: MAP.height*MAP.tileheight, margin: 42 };

// Collision comes from the sprite map (tools/build-map.py): water tiles and the solid base of each placed object.
const layer = name => MAP.layers.find(l => l.name === name);
export const MAP_OBJECTS = layer('objects').objects;
export const OBSTACLES = MAP_OBJECTS.flatMap(o => {
  const spec = OBJECT_SPECS[o.name], base = spec?.footprint, s = spec?.scale ?? 1;
  return base ? [[o.x-base[0]*s, o.y-base[1]*s, o.x+base[0]*s, o.y]] : [];
});

// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth shoreline.
const TILE = MAP.tilewidth, water = layer('water').data, firstWater = MAP.properties.find(p => p.name === 'firstWaterGid').value;
function waterAt(x, y) {
  const tx = Math.floor(x/TILE), ty = Math.floor(y/TILE), gid = water[ty*MAP.width+tx];
  if (!gid) return 0;
  const mask = Math.floor((gid-firstWater)/16)+1, u = x/TILE-tx, v = y/TILE-ty;
  return (mask&1)*(1-u)*(1-v) + (mask>>1&1)*u*(1-v) + (mask>>2&1)*(1-u)*v + (mask>>3&1)*u*v;
}
export const blocks=(rects,x,y)=>rects.some(([left,top,right,bottom]) => x>left-10 && x<right+10 && y>top-10 && y<bottom+10);
export function isWalkable(x, y, extra=[]) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < WORLD.margin || y < WORLD.margin || x > WORLD.width-WORLD.margin || y > WORLD.height-WORLD.margin) return false;
  return waterAt(x, y) < 0.35 && !blocks(OBSTACLES,x,y) && !blocks(extra,x,y);
}
