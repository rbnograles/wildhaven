import { beginGather } from '../actions/gather.js';
import { save } from './session.js';
import { $ } from '../ui/layout.js';

// Phaser's own input is disabled; every key and touch goes through here.
const MOVE_KEYS=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift'];
const TOUCH_KEYS={up:'w',down:'s',left:'a',right:'d'};

export function setupInput(session, ui) {
  const {keys}=session;
  // E starts the node's timed action; the supply is awarded when the action runs out (see core/loop.js).
  function gather(){
    if(session.screen!=='game'||ui.dialogs.isPaused())return;
    const result=beginGather(session.state,session.animator);
    if(result.ok){keys.clear();ui.hud.update();}
    else if(result.reason==='none')ui.hud.notify('Move closer to something you can gather.');
  }
  $('interact').addEventListener('click',gather);
  window.addEventListener('keydown',event=>{
    if(session.screen!=='game')return;
    const key=event.key.toLowerCase();
    if(key==='escape'){if(!ui.dialogs.isPaused()){event.preventDefault();ui.dialogs.openPause();}return;}
    if(key==='m'&&!event.repeat){event.preventDefault();ui.dialogs.toggleMap();return;}
    if(ui.dialogs.isPaused())return;
    // Mid-action, key-repeat from a key held since before E is ignored; only a fresh press moves (and so cancels).
    if(MOVE_KEYS.includes(key)){event.preventDefault();if(!(session.animator.pending&&event.repeat))keys.add(key);}
    if(key==='e'&&!event.repeat){event.preventDefault();gather();}
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(session.screen==='game')save(session,ui,true);}session.clock.last=performance.now();});
  window.addEventListener('pagehide',()=>save(session,ui,true));
  document.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{event.preventDefault();if(!ui.dialogs.isPaused()){button.setPointerCapture(event.pointerId);keys.add(TOUCH_KEYS[button.dataset.move]);}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(TOUCH_KEYS[button.dataset.move]));
  });
  function moveIntent(){
    const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    return {dx,dy,running:keys.has('shift')};
  }
  return {moveIntent};
}
