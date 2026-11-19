import { CHARACTERS } from '../data/characters.js';
import { createGame } from '../game/state.js';
import { createSaveSession, setActive } from '../game/saves.js';
import { createAnimator } from '../animation/clips.js';
import { discover } from '../actions/discover.js';
import { createRenderer } from '../render/renderer.js';
import { $ } from '../ui/layout.js';

// The character this tab is playing lives in sessionStorage; null when the browser blocks it.
export const tabStorage=(()=>{try{return sessionStorage;}catch{return null;}})();

// Everything that used to be a top-level `let` in main.js. keys and clock are never reassigned.
export function createSession() {
  return {selected:'scout',state:null,animator:createAnimator(),renderer:null,saveSession:null,saveFailure:'',screen:'selection',loadId:0,keys:new Set(),clock:{last:0,sinceSave:0,sinceHud:0}};
}

export function changeScreen(session, next) {
  session.screen=next;session.keys.clear();
  for(const name of ['selection','loading','game']) $(name).hidden=name!==next;
  document.body.classList.toggle('playing',next==='game');
}

export function save(session, ui, silent=false) {
  if(!session.state)return false;
  const result=session.saveSession?.write(session.state)??{ok:false,reason:'unavailable'};
  if(result.ok){session.saveFailure='';$('pause-save-note').textContent='Progress is saved when you leave.';if(!silent)ui.hud.notify('Adventure saved. Your path will be here.');return true;}
  const conflict=result.reason==='conflict';
  const message=conflict?'Another tab saved this character. Return to characters to load the newer adventure.':'Saving is unavailable. Leaving now will lose this session’s progress.';
  $('pause-save-note').textContent=message;
  if(!silent||session.saveFailure!==result.reason)ui.hud.notify(message);
  session.saveFailure=result.reason;return false;
}

export async function start(session, ui, fresh=false) {
  const slot=ui.selection.readSlot(session.selected);
  if(slot.invalid&&!fresh){$('reset-message').textContent='This character’s save could not be read. Start a fresh adventure? Other characters will be kept.';$('reset-dialog').showModal();return;}
  const token=++session.loadId;
  changeScreen(session,'loading');$('loading-title').textContent=slot.value&&!fresh?'Welcome back.':'A new path awaits.';$('loading-text').textContent=`Travelling to ${CHARACTERS.find(c=>c.id===session.selected).location}…`;$('loading-bar').hidden=false;$('retry').hidden=true;
  try {
    if(!session.renderer)session.renderer=await createRenderer($('world'),$('minimap'));
    if(token!==session.loadId)return;
    const state=session.state=!fresh&&slot.value?slot.value:createGame(session.selected);
    try {session.saveSession=createSaveSession(localStorage,state.character,slot.raw);} catch {session.saveSession=null;}
    session.saveFailure='';session.animator=createAnimator();
    const c=CHARACTERS.find(c=>c.id===state.character);
    $('hud-name').textContent=c.shortName;$('hud-portrait').style.setProperty('--row',c.row);
    discover(state);session.renderer.resetCamera();changeScreen(session,'game');setActive(tabStorage,state.character);
    Object.assign(session.clock,{last:performance.now(),sinceSave:0,sinceHud:0});ui.hud.update();save(session,ui,true);
    $('world').focus();ui.hud.notify(slot.value&&!fresh?'Welcome back. Your journey continues.':`Welcome to ${c.location}. Your story begins here.`);
  } catch(error) {
    if(token!==session.loadId)return;
    $('loading-title').textContent='The trail hit a snag.';$('loading-text').textContent=error.message;$('loading-bar').hidden=true;$('retry').hidden=false;
    $('retry').onclick=()=>start(session,ui,fresh);
  }
}

// "Return to characters" in the pause menu.
export function leave(session, ui) {
  if(!save(session,ui,true)&&!window.confirm('This adventure could not be saved. Return to characters and lose this session’s progress?'))return;
  $('pause-dialog').close();session.state=null;session.saveSession=null;setActive(tabStorage,null);changeScreen(session,'selection');ui.selection.select(session.selected);$('begin').focus();
}

// "Back to characters" on the loading screen; bumping loadId makes the pending start() give up.
export function cancelLoading(session) {
  session.loadId++;setActive(tabStorage,null);changeScreen(session,'selection');$('begin').focus();
}
