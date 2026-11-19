import { CHARACTERS } from '../data/characters.js';
import { WORLD } from '../world/map.js';
import { LOCATIONS } from '../world/regions.js';

export const $=id=>document.getElementById(id);

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
  herbs:'<path d="M12 22V11"/><path d="M12 15c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-4 3-7 8-7 0 5-3 7-8 7Z"/>',
  save:'<path d="M5 3h13l3 3v15H3V3Zm2 0v6h10V3M7 21v-8h10v8"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
};
export const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.compass}</svg>`;
// Builds every screen and dialog once; other modules look elements up by id.
export function mountLayout(app) {
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
  <div class="resources hud-panel" aria-label="Resources"><span>${icon('wood')}<b id="wood">0</b><span class="resource-label">Wood</span></span><span>${icon('stone')}<b id="stone">0</b><span class="resource-label">Stone</span></span><span>${icon('food')}<b id="food">0</b><span class="resource-label">Food</span></span><span>${icon('herbs')}<b id="herbs">0</b><span class="resource-label">Herbs</span></span></div>
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
}
