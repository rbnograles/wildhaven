import { isWalkable, blocks } from '../world/map.js';
import { nodeBases } from '../world/nodes.js';
import { WALK_SPEED, RUN_SPEED, MAX_MOVE_DT } from '../data/balance.js';

// One walk or run step. Returns whether the player actually moved, so a blocked step reads as idle.
export function movePlayer(state, dx, dy, dt, running=false) {
  if (![dx,dy,dt].every(Number.isFinite) || dt<=0 || (!dx&&!dy)) return false;
  const length=Math.hypot(dx,dy), speed=running?RUN_SPEED:WALK_SPEED;
  const step=speed*Math.min(dt,MAX_MOVE_DT);
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
