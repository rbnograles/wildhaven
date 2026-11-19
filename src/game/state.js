import { CHARACTERS } from '../data/characters.js';
import { SUPPLIES, RESOURCES } from '../data/supplies.js';
import { isWalkable } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { LOCATIONS } from '../world/regions.js';

export function createGame(characterId) {
  const character=CHARACTERS.find(c=>c.id===characterId);
  if(!character) throw new Error('Unknown character');
  return {version:2, character:character.id, player:{...character.spawn,direction:0}, resources:{...Object.fromEntries(RESOURCES.map(r=>[r,0])),...character.resources}, collected:[], regrowAt:{}, discovered:[], elapsed:0, distance:0};
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
