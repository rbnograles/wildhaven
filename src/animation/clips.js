export const CLIPS = {
  idle: { label:'Idle', frames:1, fps:1, loop:true, sheet:'idle' },
  walk: { label:'Walking', frames:4, fps:7, loop:true, sheet:'locomotion', row:0 },
  run: { label:'Running', frames:6, fps:15, loop:true, sheet:'run' },
  gather: { label:'Gathering', frames:4, fps:5, loop:false, sheet:'actions', row:0 },
  build: { label:'Building', frames:4, fps:4, loop:true, sheet:'actions', row:1 },
  craft: { label:'Crafting', frames:4, fps:5, loop:true, sheet:'actions', row:2 },
  fight: { label:'Fighting', frames:4, fps:7, loop:false, sheet:'actions', row:3 },
  swim: { label:'Swimming', frames:4, fps:6, loop:true, sheet:'actions', row:4 },
};

export function sampleAnimation(name,time,direction=0,loop=CLIPS[name]?.loop) {
  const clip=CLIPS[name]??CLIPS.idle;
  const facing=[0,1,2,3].includes(direction)?direction:0;
  const tick=Math.floor(Math.max(0,Number.isFinite(time)?time:0)*clip.fps+1e-8);
  const frame = loop ? tick % clip.frames : Math.min(tick, clip.frames - 1);
  if (clip === CLIPS.run) {
    // South, east (also mirrored west), north. Both flight poses clear the ground.
    return {sheet:'run', row:[0,1,1,2][facing], frame, direction:facing, flip:facing===1,
      lift:frame % 3 === 2 ? 0.125 : 0};
  }
  return {sheet:clip.sheet,row:clip.sheet==='locomotion'?clip.row+facing:clip.row??0,
    frame, direction:facing,flip:clip.sheet==='actions'&&facing===1,lift:0};
}

// Generated cells do not hold the body at a fixed spot, so anchoring on the cell centre makes the
// character slide back and forth while walking. Anchor each frame on its head instead, shifted by
// the strip's average head offset so the sprite keeps its overall placement.
export function steadyAnchors(cellCenters,headCenters){
  const drift=headCenters.reduce((sum,head,i)=>sum+head-cellCenters[i],0)/headCenters.length;
  return headCenters.map(head=>head-drift);
}

export function createAnimator(){return {clip:'idle',time:0,pending:null};}

// An action runs for `duration` seconds (default: one pass of its clip); longer actions loop the clip.
export function startAction(animator,clip,target=null,duration=null){
  if(animator.pending || CLIPS[clip]?.sheet!=='actions')return false;
  const length=CLIPS[clip].frames/CLIPS[clip].fps;
  animator.clip=clip;animator.time=0;animator.pending={clip,target,duration:Number.isFinite(duration)&&duration>0?duration:length};return true;
}

export function cancelAction(animator){
  if(!animator.pending)return false;
  animator.pending=null;animator.clip='idle';animator.time=0;return true;
}

export const actionProgress=animator=>animator.pending?Math.min(1,animator.time/animator.pending.duration):0;

export function advanceAnimation(animator,dt,{moving=false,running=false,paused=false}={}){
  if(paused || !Number.isFinite(dt) || dt<=0)return null;
  if(animator.pending){
    animator.time+=dt;
    if(animator.time+1e-8>=animator.pending.duration){
      const {clip,target}=animator.pending;animator.pending=null;animator.clip='idle';animator.time=0;return {clip,target};
    }
    return null;
  }
  const next=moving?(running?'run':'walk'):'idle';
  if(next!==animator.clip){animator.clip=next;animator.time=0;}
  else animator.time+=dt;
  return null;
}
