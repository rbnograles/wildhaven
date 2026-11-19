import { CHARACTERS } from '../data/characters.js';
import { restoreGame } from '../game/state.js';
import { storageKey } from '../game/saves.js';
import { start, cancelLoading } from '../core/session.js';
import { $, icon } from './layout.js';

export function setupSelection(session, ui) {
  function readSlot(id) {
    try { const raw=localStorage.getItem(storageKey(id));const value=raw?restoreGame(raw):null;return {raw,value:value?.character===id?value:null,invalid:!!raw&&(!value||value.character!==id)}; }
    catch { $('storage-note').textContent='Storage is unavailable. You can play, but progress will not persist.';return {raw:null,value:null,invalid:false}; }
  }
  function select(id) {
    session.selected=id;const c=CHARACTERS.find(c=>c.id===id),slot=readSlot(id);
    document.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===id)));
    $('tagline').textContent=c.tagline;$('description').textContent=c.description;$('kit').textContent=c.kit;
    $('begin').innerHTML=`${slot.value?'Continue your journey':'Begin your journey'} ${icon('arrow')}`;
    $('fresh').hidden=!slot.value;
    $('save-hint').textContent=slot.value?`${slot.value.discovered.length} of 3 regions discovered · Adventure saved`:slot.invalid?'This save could not be read. Start fresh to play.':'Your own path through a shared world.';
  }
  document.querySelectorAll('[data-character]').forEach(button=>{
    button.addEventListener('click',()=>select(button.dataset.character));
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();const next=(CHARACTERS.findIndex(c=>c.id===button.dataset.character)+(event.key==='ArrowRight'?1:2))%3;
      select(CHARACTERS[next].id);document.querySelector(`[data-character="${session.selected}"]`).focus();
    });
  });
  $('begin').addEventListener('click',()=>start(session,ui));
  $('fresh').addEventListener('click',()=>{$('reset-message').textContent='This replaces this character’s saved adventure. Your other characters will be kept.';$('reset-dialog').showModal();});
  $('loading-back').addEventListener('click',()=>cancelLoading(session));
  return {readSlot,select};
}
