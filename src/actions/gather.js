import { NODES } from '../world/nodes.js';
import { GATHER_RANGE, GATHER_SECONDS } from '../data/balance.js';
import { startAction } from '../animation/clips.js';

// The one place gathering tools will shorten the action.
export function gatherTime(state, node) { return GATHER_SECONDS; }
const inReach=(state,n)=>Math.hypot(n.x-state.player.x,n.y-state.player.y)<GATHER_RANGE;
// A picked wild patch is gone until the game clock (paused with the game) reaches its regrowAt time.
export const isAvailable=(state,n)=>n.regrow ? !(state.regrowAt[n.id]>state.elapsed) : !state.collected.includes(n.id);
export const hasGathered=state=>state.collected.length>0 || Object.keys(state.regrowAt).length>0;

export function nearbyNode(state) {
  return NODES.filter(n=>isAvailable(state,n) && inReach(state,n))
    .sort((a,b)=>Math.hypot(a.x-state.player.x,a.y-state.player.y)-Math.hypot(b.x-state.player.x,b.y-state.player.y))[0] ?? null;
}

// E starts the node's timed action (its clip, for gatherTime seconds); finishGather awards it once the action runs out.
export function beginGather(state, animator) {
  if(animator.pending) return {ok:false,reason:'busy'};
  const node=nearbyNode(state);
  if(!node) return {ok:false,reason:'none'};
  if(Math.abs(node.x-state.player.x)>8) state.player.direction=node.x<state.player.x?1:2;
  startAction(animator,node.clip,node.id,gatherTime(state,node));
  return {ok:true,node};
}

// The loop passes the id the action targeted; without one, the nearest available node is used.
export function finishGather(state, id=nearbyNode(state)?.id) {
  const node=NODES.find(n=>n.id===id);
  if(!node || !isAvailable(state,node) || !inReach(state,node)) return null;
  if(node.regrow) state.regrowAt[node.id]=state.elapsed+node.regrow; else state.collected.push(node.id);
  state.resources[node.type]+=node.amount;
  return node;
}
