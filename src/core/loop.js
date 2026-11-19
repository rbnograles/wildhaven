import { movePlayer } from '../actions/move.js';
import { finishGather } from '../actions/gather.js';
import { discover } from '../actions/discover.js';
import { advanceAnimation, cancelAction } from '../animation/clips.js';
import { save } from './session.js';

// Engine timings, not game balance (that lives in data/balance.js).
const MAX_FRAME_DT=0.05, AUTOSAVE_EVERY=10, HUD_EVERY=0.12;

export function startLoop(session, ui) {
  const {clock}=session;
  function frame(now){
    const dt=Math.min((now-clock.last)/1000,MAX_FRAME_DT);clock.last=now;
    const {state,renderer,animator}=session;
    if(session.screen==='game'&&state&&renderer){
      let moving=false;
      if(!ui.dialogs.isPaused()&&!document.hidden){
        const {dx,dy,running}=ui.input.moveIntent();
        // Moving cancels an action in progress; nothing is awarded.
        if(animator.pending&&(dx||dy)){cancelAction(animator);ui.hud.update();}
        moving=!animator.pending&&movePlayer(state,dx,dy,dt,running);state.elapsed+=dt;
        const done=advanceAnimation(animator,dt,{moving,running});
        if(done?.target){const node=finishGather(state,done.target);if(node){ui.hud.notify(`+${node.amount} ${node.type} · ${node.label}`);ui.hud.update();save(session,ui,true);}}
        const found=discover(state);if(found.length){ui.hud.notify(`Discovered ${found[0].name}`);save(session,ui,true);}
        clock.sinceSave+=dt;if(clock.sinceSave>AUTOSAVE_EVERY){save(session,ui,true);clock.sinceSave=0;}
      }
      renderer.draw(state,dt,animator);clock.sinceHud+=dt;if(clock.sinceHud>HUD_EVERY){ui.hud.update();clock.sinceHud=0;}
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
