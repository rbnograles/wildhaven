import { save, start, leave } from '../core/session.js';
import { $ } from './layout.js';

export function setupDialogs(session, ui) {
  const dialogs=[$('pause-dialog'),$('map-dialog'),$('reset-dialog')];
  // Any open dialog pauses the game.
  const isPaused=()=>dialogs.some(dialog=>dialog.open);
  function openPause(){if(session.screen!=='game'||isPaused())return;session.keys.clear();save(session,ui,true);$('pause-dialog').showModal();}
  function closePause(){$('pause-dialog').close();session.keys.clear();$('world').focus();}
  function toggleMap(){
    if(session.screen!=='game')return;
    if($('map-dialog').open){$('map-dialog').close();$('world').focus();return;}
    if(isPaused())return;
    session.keys.clear();session.renderer.drawMap($('large-map'),session.state);$('map-discovered').textContent=`${session.state.discovered.length} of 3 regions discovered`;$('map-dialog').showModal();
  }
  $('pause').addEventListener('click',openPause);$('resume').addEventListener('click',closePause);
  $('save-game').addEventListener('click',()=>{if(save(session,ui))$('pause-save-note').textContent='Your adventure has been saved.';});
  $('return').addEventListener('click',()=>leave(session,ui));
  $('open-map').addEventListener('click',toggleMap);$('close-map').addEventListener('click',toggleMap);
  $('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
  $('confirm-reset').addEventListener('click',()=>{$('reset-dialog').close();start(session,ui,true);});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{ui.hud.notify('Fullscreen is unavailable in this browser window.');}});
  for(const dialog of dialogs){dialog.addEventListener('close',()=>{session.keys.clear();if(session.screen==='game')$('world').focus();});}
  return {isPaused,openPause,closePause,toggleMap};
}
