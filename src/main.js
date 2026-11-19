import './style.css';
import { WORLD, CHARACTERS, LOCATIONS, createGame, movePlayer, restoreGame, gather, discover, nearbyNode, regionAt } from './state.js';
import { createRenderer } from './render.js';
import { createSaveSession, storageKey, readActive, setActive } from './storage.js';
import { createAnimator, startAction, advanceAnimation } from './animation.js';
import { setupPreview } from './animation-preview.js';

const icons={
  compass:'<circle cx="12" cy="12" r="8"/><path d="m12 1 2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5Z"/><path d="m12 5 0 7 7 0"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  wood:'<path d="m7 3 10 3 4 10-5 5-10-4-3-10Z"/><path d="m7 3 4 10 10 3M11 13l-5 4m4-11 6 2 2 5"/>',
  stone:'<path d="m8 4 10 2 4 10-6 5-12-3-2-7Z"/><path d="m8 4 2 10 12 2m-12-2 6 7M2 11l8 3"/>',
  food:'<path d="M12 7c-7-6-13 3-7 11 4 6 7 1 7 1s3 5 7-1c6-8 0-17-7-11Z"/><path d="M12 7c0-4 2-5 5-5"/>',
  save:'<path d="M5 3h13l3 3v15H3V3Zm2 0v6h10V3M7 21v-8h10v8"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.compass}</svg>`;
const app=document.querySelector('#app');
app.innerHTML=`
<main id="selection" class="selection">
  <header class="masthead"><a class="wordmark" href="./" aria-label="Wildhaven home">${icon('compass')}<span>WILDHAVEN</span></a><span class="header-line"></span><span class="motto">A world worth wandering</span></header>
  <section class="intro"><h1>Every journey starts with you.</h1><p>Three paths. One untamed world. Choose where your story begins.</p></section>
  <div class="characters" role="group" aria-label="Choose your character">
    ${CHARACTERS.map(c=>`<button class="character-card" data-character="${c.id}" aria-pressed="${c.id==='scout'}" aria-label="Choose ${c.shortName}" style="--row:${c.row};--scene:${c.row*50}%">
      <span class="portrait"><span class="portrait-sprite" aria-hidden="true"></span><span class="selected-mark">${icon('check')}</span></span>
      <span class="character-caption"><span class="character-name">${c.name}</span><span class="character-location">${c.location}</span></span>
    </button>`).join('')}
  </div>
  <section class="departure" aria-label="Your chosen character">
    <div class="character-story"><h2 id="tagline"></h2><p id="description"></p><span id="kit" class="kit"></span></div>
    <div class="departure-actions"><button id="begin" class="primary">Begin your journey ${icon('arrow')}</button><button id="fresh" class="text-button" hidden>Start a fresh adventure</button><p id="save-hint" class="save-hint">Your own path through a shared world.</p></div>
  </section>
  <footer class="selection-footer"><div class="key-guide"><span><kbd>W A S D</kbd> Move</span><span><kbd>Shift</kbd> Run</span><span><kbd>E</kbd> Interact</span><span><kbd>M</kbd> Map</span><span><kbd>Esc</kbd> Pause</span></div><span id="storage-note">Your adventure saves on this device.</span></footer>
</main>
<section id="loading" class="loading" hidden aria-live="polite"><div class="loading-compass">${icon('compass')}</div><span class="wordmark">WILDHAVEN</span><h1 id="loading-title">A new path awaits.</h1><p id="loading-text">Finding your place in the wild…</p><div id="loading-bar" class="loading-bar"></div><button id="retry" class="primary" hidden>Try again ${icon('arrow')}</button><button id="loading-back" class="text-button">Back to characters</button></section>
<section id="game" class="game" hidden aria-label="Wildhaven game">
  <div id="world" tabindex="0" role="application" aria-label="Playable world. Use WASD or arrow keys to move, Shift to run, E to gather, M for map, Escape to pause."></div>
  <div class="game-top"><div class="identity hud-panel"><span id="hud-portrait" class="hud-portrait"></span><div><span id="hud-name" class="hud-name"></span><span class="identity-status"><span></span> Exploring the wilds</span></div></div>
  <div class="resources hud-panel" aria-label="Resources"><span>${icon('wood')}<b id="wood">0</b><span class="resource-label">Wood</span></span><span>${icon('stone')}<b id="stone">0</b><span class="resource-label">Stone</span></span><span>${icon('food')}<b id="food">0</b><span class="resource-label">Food</span></span></div>
  <div class="game-actions"><button id="fullscreen" class="icon-button hud-panel" aria-label="Toggle fullscreen">${icon('expand')}</button><button id="pause" class="icon-button hud-panel" aria-label="Pause game">${icon('pause')}</button></div></div>
  <div class="region"><span>THE WILDS OF WILDHAVEN</span><h1 id="region-name"></h1><span class="region-rule"></span></div>
  <aside class="quest hud-panel"><span class="quest-label">YOUR FIRST FOOTSTEPS</span><h2>A place to begin</h2><p id="quest-text">Gather supplies and follow the paths to discover the world.</p><ul><li id="quest-gather">Gather your first supplies</li><li id="quest-explore">Discover the three starting regions <b id="discovery-count">1 / 3</b></li></ul></aside>
  <button id="open-map" class="minimap hud-panel" aria-label="Open world map"><canvas id="minimap" width="240" height="160" aria-hidden="true"></canvas><span>${icon('map')} World map <kbd>M</kbd></span></button>
  <button id="interact" class="interact" hidden><kbd>E</kbd><span></span></button>
  <div class="touch-controls" aria-label="Movement controls"><button data-move="up" aria-label="Move north">↑</button><div><button data-move="left" aria-label="Move west">←</button><button data-move="down" aria-label="Move south">↓</button><button data-move="right" aria-label="Move east">→</button></div></div>
  <div id="toast" class="toast" role="status"></div>
</section>
<dialog id="pause-dialog" class="pause-dialog"><span class="modal-mark">${icon('compass')}</span><p class="dialog-kicker">TAKE A BREATH</p><h2>The wilds can wait.</h2><p>Your adventure is paused.</p><button id="resume" class="primary">Keep exploring ${icon('arrow')}</button><button id="save-game" class="secondary">${icon('save')} Save adventure</button><button id="return" class="text-button">Return to characters</button><p id="pause-save-note" class="fine-print">Progress is saved when you leave.</p></dialog>
<dialog id="map-dialog" class="map-dialog"><div class="map-heading"><div><p class="dialog-kicker">YOUR FIELD MAP</p><h2>The Wilds of Wildhaven</h2></div><button id="close-map" class="icon-button" aria-label="Close world map">${icon('close')}</button></div><div class="map-surface"><canvas id="large-map" width="1200" height="800" aria-label="World map with your current position"></canvas>${LOCATIONS.map(l=>`<span class="map-label" style="left:${l.x/WORLD.width*100}%;top:${l.y/WORLD.height*100}%">${l.name}</span>`).join('')}</div><div class="map-footer"><span>● Your position</span><span id="map-discovered"></span><span><kbd>M</kbd> Close map</span></div></dialog>
<dialog id="reset-dialog" class="pause-dialog"><h2>A fresh beginning?</h2><p id="reset-message">This replaces this character’s saved adventure. Your other characters will be kept.</p><button id="confirm-reset" class="primary">Start fresh ${icon('arrow')}</button><button id="cancel-reset" class="text-button">Keep my adventure</button></dialog>`;

const $=id=>document.getElementById(id);
const dialogs=[$('pause-dialog'),$('map-dialog'),$('reset-dialog')];
let selected='scout',state=null,renderer=null,screen='selection',keys=new Set(),lastTime=0,lastSave=0,lastHud=0,toastTimer,loadId=0;
let saveSession=null,saveFailure='',animator=createAnimator();
const tabStorage=(()=>{try{return sessionStorage;}catch{return null;}})();
function readSlot(id) {
  try { const raw=localStorage.getItem(storageKey(id));const value=raw?restoreGame(raw):null;return {raw,value:value?.character===id?value:null,invalid:!!raw&&(!value||value.character!==id)}; }
  catch { $('storage-note').textContent='Storage is unavailable. You can play, but progress will not persist.';return {raw:null,value:null,invalid:false}; }
}
function select(id) {
  selected=id;const c=CHARACTERS.find(c=>c.id===id),slot=readSlot(id);
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
    select(CHARACTERS[next].id);document.querySelector(`[data-character="${selected}"]`).focus();
  });
});
function changeScreen(next) {
  screen=next;keys.clear();
  for(const name of ['selection','loading','game']) $(name).hidden=name!==next;
  document.body.classList.toggle('playing',next==='game');
}
function notify(message) {
  clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');
  toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);
}
function save(silent=false) {
  if(!state)return false;
  const result=saveSession?.write(state)??{ok:false,reason:'unavailable'};
  if(result.ok){saveFailure='';$('pause-save-note').textContent='Progress is saved when you leave.';if(!silent)notify('Adventure saved. Your path will be here.');return true;}
  const conflict=result.reason==='conflict';
  const message=conflict?'Another tab saved this character. Return to characters to load the newer adventure.':'Saving is unavailable. Leaving now will lose this session’s progress.';
  $('pause-save-note').textContent=message;
  if(!silent||saveFailure!==result.reason)notify(message);
  saveFailure=result.reason;return false;
}
async function start(fresh=false) {
  const slot=readSlot(selected);
  if(slot.invalid&&!fresh){$('reset-message').textContent='This character’s save could not be read. Start a fresh adventure? Other characters will be kept.';$('reset-dialog').showModal();return;}
  const token=++loadId;
  changeScreen('loading');$('loading-title').textContent=slot.value&&!fresh?'Welcome back.':'A new path awaits.';$('loading-text').textContent=`Travelling to ${CHARACTERS.find(c=>c.id===selected).location}…`;$('loading-bar').hidden=false;$('retry').hidden=true;
  try {
    if(!renderer)renderer=await createRenderer($('world'),$('minimap'));
    if(token!==loadId)return;
    state=!fresh&&slot.value?slot.value:createGame(selected);
    try {saveSession=createSaveSession(localStorage,state.character,slot.raw);} catch {saveSession=null;}
    saveFailure='';animator=createAnimator();
    const c=CHARACTERS.find(c=>c.id===state.character);
    $('hud-name').textContent=c.shortName;$('hud-portrait').style.setProperty('--row',c.row);
    discover(state);renderer.resetCamera();changeScreen('game');setActive(tabStorage,state.character);lastTime=performance.now();lastSave=0;lastHud=0;updateHud();save(true);
    $('world').focus();notify(slot.value&&!fresh?'Welcome back. Your journey continues.':`Welcome to ${c.location}. Your story begins here.`);
  } catch(error) {
    if(token!==loadId)return;
    $('loading-title').textContent='The trail hit a snag.';$('loading-text').textContent=error.message;$('loading-bar').hidden=true;$('retry').hidden=false;
    $('retry').onclick=()=>start(fresh);
  }
}
$('begin').addEventListener('click',()=>start());
$('fresh').addEventListener('click',()=>{$('reset-message').textContent='This replaces this character’s saved adventure. Your other characters will be kept.';$('reset-dialog').showModal();});
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('confirm-reset').addEventListener('click',()=>{$('reset-dialog').close();start(true);});
$('loading-back').addEventListener('click',()=>{loadId++;setActive(tabStorage,null);changeScreen('selection');$('begin').focus();});
function isPaused(){return dialogs.some(dialog=>dialog.open);}
function openPause(){if(screen!=='game'||isPaused())return;keys.clear();save(true);$('pause-dialog').showModal();}
function closePause(){$('pause-dialog').close();keys.clear();$('world').focus();}
function toggleMap(){
  if(screen!=='game')return;
  if($('map-dialog').open){$('map-dialog').close();$('world').focus();return;}
  if(isPaused())return;
  keys.clear();renderer.drawMap($('large-map'),state);$('map-discovered').textContent=`${state.discovered.length} of 3 regions discovered`;$('map-dialog').showModal();
}
$('pause').addEventListener('click',openPause);$('resume').addEventListener('click',closePause);
$('save-game').addEventListener('click',()=>{if(save())$('pause-save-note').textContent='Your adventure has been saved.';});
$('return').addEventListener('click',()=>{
  if(!save(true)&&!window.confirm('This adventure could not be saved. Return to characters and lose this session’s progress?'))return;
  $('pause-dialog').close();state=null;saveSession=null;setActive(tabStorage,null);changeScreen('selection');select(selected);$('begin').focus();
});
$('open-map').addEventListener('click',toggleMap);$('close-map').addEventListener('click',toggleMap);
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Fullscreen is unavailable in this browser window.');}});
// E starts the gather clip; the supplies are awarded once, when the clip finishes (see frame()).
function collect(){
  if(screen!=='game'||isPaused()||animator.pending)return;
  const node=nearbyNode(state);
  if(!node){notify('Move closer to a marked supply to gather it.');return;}
  if(Math.abs(node.x-state.player.x)>8)state.player.direction=node.x<state.player.x?1:2;
  startAction(animator,'gather',node.id);keys.clear();
}
$('interact').addEventListener('click',collect);
for(const dialog of dialogs){dialog.addEventListener('close',()=>{keys.clear();if(screen==='game')$('world').focus();});}
window.addEventListener('keydown',event=>{
  if(screen!=='game')return;
  const key=event.key.toLowerCase();
  if(key==='escape'){if(!isPaused()){event.preventDefault();openPause();}return;}
  if(key==='m'&&!event.repeat){event.preventDefault();toggleMap();return;}
  if(isPaused())return;
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift'].includes(key)){event.preventDefault();keys.add(key);}
  if(key==='e'&&!event.repeat){event.preventDefault();collect();}
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(screen==='game')save(true);}lastTime=performance.now();});
window.addEventListener('pagehide',()=>save(true));
const touchKeys={up:'w',down:'s',left:'a',right:'d'};
document.querySelectorAll('[data-move]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{event.preventDefault();if(!isPaused()){button.setPointerCapture(event.pointerId);keys.add(touchKeys[button.dataset.move]);}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(touchKeys[button.dataset.move]));
});
function updateHud(){
  for(const resource of ['wood','stone','food'])$(resource).textContent=state.resources[resource];
  $('region-name').textContent=regionAt(state.player);
  $('discovery-count').textContent=`${state.discovered.length} / 3`;
  $('quest-gather').classList.toggle('complete',state.collected.length>0);
  $('quest-explore').classList.toggle('complete',state.discovered.length===3);
  if(state.collected.length&&state.discovered.length===3)$('quest-text').textContent='You have found your feet. Keep exploring — this is just the beginning.';
  else $('quest-text').textContent='Gather supplies and follow the paths to discover the world.';
  const node=nearbyNode(state);$('interact').hidden=!node||!!animator.pending;
  if(node)$('interact').querySelector('span').textContent=`Gather ${node.label.toLowerCase()}`;
}
function frame(now){
  const dt=Math.min((now-lastTime)/1000,0.05);lastTime=now;
  if(screen==='game'&&state&&renderer){
    let moving=false;
    if(!isPaused()&&!document.hidden){
      const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      const running=keys.has('shift');
      moving=!animator.pending&&movePlayer(state,dx,dy,dt,running);state.elapsed+=dt;
      const done=advanceAnimation(animator,dt,{moving,running});
      if(done?.clip==='gather'){const node=gather(state);if(node){notify(`+${node.amount} ${node.type} · ${node.label}`);updateHud();save(true);}}
      const found=discover(state);if(found.length){notify(`Discovered ${found[0].name}`);save(true);}
      lastSave+=dt;if(lastSave>10){save(true);lastSave=0;}
    }
    renderer.draw(state,dt,animator);lastHud+=dt;if(lastHud>0.12){updateHud();lastHud=0;}
  }
  requestAnimationFrame(frame);
}
setupPreview(() => state?.character ?? selected);
// A refresh mid-game resumes that character; only leaving via the menu buttons clears it.
const resumeId=readActive(tabStorage);select(resumeId??selected);
if(resumeId&&readSlot(resumeId).value)start();else setActive(tabStorage,null);
requestAnimationFrame(frame);
