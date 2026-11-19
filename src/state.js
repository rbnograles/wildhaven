import MAP from '../assets/world/map/wildhaven.json' with { type: 'json' };
import OBJECT_SPECS from '../assets/world/source/objects.json' with { type: 'json' };

export const WORLD = { width: MAP.width*MAP.tilewidth, height: MAP.height*MAP.tileheight, margin: 42 };

// Region coordinates were first measured on a smaller map; these offsets place each region in the full world.
// tools/build-map.py uses the same offsets for the village and coast.
const REGION_OFFSETS = { forest: [0, 0], village: [1622, 1158], coast: [3072, 2048] };
const at = (region, x, y) => ({ x: x + REGION_OFFSETS[region][0], y: y + REGION_OFFSETS[region][1] });

export const CHARACTERS = [
  { id: 'scout', row: 0, name: 'The Frontier Scout', shortName: 'Frontier Scout', location: 'Pinefall Woods', tagline: 'Follow the trail. Find your home.', description: 'A curious wanderer with a steady step and a love of the wild. Begin among the pines, where every trail leads somewhere new.', kit: 'Hatchet · Field pack · 3 food', spawn: at('forest', 620, 550), resources: { wood: 0, stone: 0, food: 3 } },
  { id: 'builder', row: 1, name: 'The Wandering Builder', shortName: 'Wandering Builder', location: 'Hollowstead Village', tagline: 'Where others see ruins, you see a beginning.', description: 'A resourceful craftsperson looking for a place to belong. Start in an abandoned village, with old foundations and new possibilities.', kit: 'Hammer · Work gloves · 5 wood', spawn: at('village', 1450, 890), resources: { wood: 5, stone: 2, food: 2 } },
  { id: 'survivor', row: 2, name: 'The Shipwreck Survivor', shortName: 'Shipwreck Survivor', location: 'Driftwood Coast', tagline: 'The sea took your ship. Not your spirit.', description: 'Washed ashore with a handful of supplies and a will to carry on. Search the coast, follow the inland trail, and make a fresh start.', kit: 'Salvaged satchel · Rope · 4 food', spawn: at('coast', 2400, 1580), resources: { wood: 2, stone: 0, food: 4 } },
];

export const LOCATIONS = CHARACTERS.map(c => ({ id: c.id, name: c.location, ...c.spawn, radius: 230 }));

// Collision comes from the sprite map (tools/build-map.py): water tiles and the solid base of each placed object.
const layer = name => MAP.layers.find(l => l.name === name);
export const OBSTACLES = layer('objects').objects.flatMap(o => {
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
const blocks=(rects,x,y)=>rects.some(([left,top,right,bottom]) => x>left-10 && x<right+10 && y>top-10 && y<bottom+10);
export function isWalkable(x, y, extra=[]) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < WORLD.margin || y < WORLD.margin || x > WORLD.width-WORLD.margin || y > WORLD.height-WORLD.margin) return false;
  return waterAt(x, y) < 0.35 && !blocks(OBSTACLES,x,y) && !blocks(extra,x,y);
}

// Each supply is drawn as its own sprite (an objects.json key at `scale`) and stands solid until gathered.
// tools/build-map.py keeps scenery off these spots (KEEP_CLEAR), so move them there too.
const SUPPLIES = [
  { id:'pine-wood', ...at('forest', 870, 650), type:'wood', amount:3, label:'Pine tree', verb:'Chop', clip:'build', sprite:'pine', scale:1 },
  { id:'camp-stone', ...at('forest', 480, 570), type:'stone', amount:2, label:'Loose stones', verb:'Gather', clip:'gather', sprite:'rocks-b', scale:0.5 },
  { id:'forest-food', ...at('forest', 480, 705), type:'food', amount:2, label:'Wild berries', verb:'Pick', clip:'gather', sprite:'berry-bush', scale:1 },
  { id:'village-wood', ...at('village', 1558, 1012), type:'wood', amount:3, label:'Scrap timber', verb:'Gather', clip:'gather', sprite:'log', scale:0.8 },
  { id:'village-stone', ...at('village', 1368, 1022), type:'stone', amount:3, label:'Loose stones', verb:'Gather', clip:'gather', sprite:'rocks-b', scale:0.5 },
  { id:'village-food', ...at('village', 1580, 1190), type:'food', amount:2, label:'Wild berries', verb:'Pick', clip:'gather', sprite:'berry-bush', scale:1 },
  { id:'coast-wood', ...at('coast', 2558, 1692), type:'wood', amount:4, label:'Driftwood', verb:'Gather', clip:'gather', sprite:'log', scale:0.8 },
  { id:'coast-stone', ...at('coast', 2250, 1730), type:'stone', amount:2, label:'Beach stones', verb:'Gather', clip:'gather', sprite:'beach-rock', scale:0.6 },
  { id:'meadow-food', ...at('village', 1678, 1422), type:'food', amount:3, label:'Wild berries', verb:'Pick', clip:'gather', sprite:'berry-bush', scale:1 },
];
// Wild scenery the map scatters (tools/build-map.py) that can be harvested where it stands and grows back `regrow`
// game-seconds later. A patch's map position is its id; render.js draws it from NODES instead of from the map.
export const WILD = { flowers: { type:'herbs', amount:2, label:'Wildflowers', verb:'Pick', clip:'gather', regrow:180 } };
export const NODES = [...SUPPLIES, ...layer('objects').objects.filter(o=>WILD[o.name])
  .map(o=>({ id:`${o.name}-${o.x}-${o.y}`, x:o.x, y:o.y, ...WILD[o.name], sprite:o.name, scale:OBJECT_SPECS[o.name].scale ?? 1 }))];
export const RESOURCES = ['wood','stone','food','herbs'];

// Only one-time supplies are solid; wild patches are walk-through.
export function nodeBases(collected) {
  return SUPPLIES.filter(n=>!collected.includes(n.id)).map(n=>{
    const [halfWidth,depth]=OBJECT_SPECS[n.sprite].footprint;
    return [n.x-halfWidth*n.scale, n.y-depth*n.scale, n.x+halfWidth*n.scale, n.y];
  });
}

export const GATHER_SECONDS=6;
// Gathering tools will shorten this (towards 0.5 s); until then every supply takes the full time.
export function gatherTime(state, node) { return GATHER_SECONDS; }
const REACH=95, inReach=(state,n)=>Math.hypot(n.x-state.player.x,n.y-state.player.y)<REACH;
// A picked wild patch is gone until the game clock (paused with the game) reaches its regrowAt time.
export const isAvailable=(state,n)=>n.regrow ? !(state.regrowAt[n.id]>state.elapsed) : !state.collected.includes(n.id);
export const hasGathered=state=>state.collected.length>0 || Object.keys(state.regrowAt).length>0;

export function createGame(characterId) {
  const character=CHARACTERS.find(c=>c.id===characterId);
  if(!character) throw new Error('Unknown character');
  return {version:2, character:character.id, player:{...character.spawn,direction:0}, resources:{...Object.fromEntries(RESOURCES.map(r=>[r,0])),...character.resources}, collected:[], regrowAt:{}, discovered:[], elapsed:0, distance:0};
}

export function movePlayer(state, dx, dy, dt, running=false) {
  if (![dx,dy,dt].every(Number.isFinite) || dt<=0 || (!dx&&!dy)) return false;
  const length=Math.hypot(dx,dy), speed=running?245:155;
  const step=speed*Math.min(dt,0.1);
  dx=dx/length*step; dy=dy/length*step;
  const {x,y}=state.player;
  state.player.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
  // A save made before a supply moved may stand inside its base; let the player walk out instead of trapping them.
  const bases=nodeBases(state.collected).filter(base=>!blocks([base],x,y));
  if(isWalkable(x+dx,y,bases)) state.player.x+=dx;
  if(isWalkable(state.player.x,y+dy,bases)) state.player.y+=dy;
  const distance=Math.hypot(state.player.x-x,state.player.y-y);
  state.distance+=distance;
  return distance>0;
}

export function nearbyNode(state) {
  return NODES.filter(n=>isAvailable(state,n) && inReach(state,n))
    .sort((a,b)=>Math.hypot(a.x-state.player.x,a.y-state.player.y)-Math.hypot(b.x-state.player.x,b.y-state.player.y))[0] ?? null;
}

// main.js passes the id the action targeted; tests and older callers fall back to the nearest supply.
export function gather(state, id=nearbyNode(state)?.id) {
  const node=NODES.find(n=>n.id===id);
  if(!node || !isAvailable(state,node) || !inReach(state,node)) return null;
  if(node.regrow) state.regrowAt[node.id]=state.elapsed+node.regrow; else state.collected.push(node.id);
  state.resources[node.type]+=node.amount;
  return node;
}

export function discover(state) {
  const found=LOCATIONS.filter(l=>!state.discovered.includes(l.id) && Math.hypot(l.x-state.player.x,l.y-state.player.y)<l.radius);
  state.discovered.push(...found.map(l=>l.id));
  return found;
}

export function regionAt(player) {
  return LOCATIONS.find(l=>Math.hypot(l.x-player.x,l.y-player.y)<l.radius+130)?.name ?? 'The Open Wilds';
}

export function serializeGame(state) { return JSON.stringify(state); }

export function restoreGame(json) {
  try {
    const s=JSON.parse(json);
    if (!s || s.version!==2 || !CHARACTERS.some(c=>c.id===s.character) || !s.player || !isWalkable(s.player.x,s.player.y) || ![0,1,2,3].includes(s.player.direction)) return null;
    // Saves from before herbs and regrowth have neither field; they load with none of either.
    const resources=s.resources && {herbs:0,...s.resources}, regrowAt=s.regrowAt ?? {};
    if(!resources || !RESOURCES.every(key=>Number.isSafeInteger(resources[key]) && resources[key]>=0 && resources[key]<100000)) return null;
    for(const [list,allowed] of [[s.collected,SUPPLIES],[s.discovered,LOCATIONS]]) {
      if(!Array.isArray(list) || list.length>allowed.length || new Set(list).size!==list.length || !list.every(id=>allowed.some(a=>a.id===id))) return null;
    }
    if(!Number.isFinite(s.elapsed) || s.elapsed<0 || !Number.isFinite(s.distance) || s.distance<0) return null;
    if(!regrowAt || typeof regrowAt!=='object' || Array.isArray(regrowAt) || !Object.values(regrowAt).every(t=>Number.isFinite(t) && t>=0)) return null;
    // Patch ids are map positions, so a rebuilt map can retire one; dropping its timer only lets that patch regrow early.
    const timers=NODES.filter(n=>n.regrow && Object.hasOwn(regrowAt,n.id)).map(n=>[n.id,Math.min(regrowAt[n.id],s.elapsed+n.regrow)]);
    return {version:2,character:s.character,player:{x:s.player.x,y:s.player.y,direction:s.player.direction},resources:Object.fromEntries(RESOURCES.map(r=>[r,resources[r]])),collected:[...s.collected],regrowAt:Object.fromEntries(timers),discovered:[...s.discovered],elapsed:s.elapsed,distance:s.distance};
  } catch { return null; }
}
