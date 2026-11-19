// Builds the page the player sees: the character selection screen, the loading screen, the
// in-game HUD, and the pause, map, journal and reset dialogs. Think of it as the stage set. It is
// built once when the page loads; after that, other modules only show, hide or relabel its parts.
import { CHARACTERS } from '../data/characters.js';
import { WORLD } from '../world/map.js';
import { REGIONS } from '../world/regions.js';

/**
 * Finds an element on the page by its id.
 *
 * A short name for `document.getElementById`, because the UI code looks things up by id a lot.
 *
 * @param {string} id - The element's id, without the `#`.
 * @returns {HTMLElement|null} The element, or null if there is none.
 */
export const $ = (id) => document.getElementById(id);

// The inside of each 24×24 line icon (SVG shapes), by name. `icon()` wraps one in an <svg> tag.
// Like a box of stencils: each one holds a shape, and the colour comes from where it is used.
const icons = {
  compass:
    '<circle cx="12" cy="12" r="8"/><path d="m12 1 2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5Z"/><path d="m12 5 0 7 7 0"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  wood: '<path d="m7 3 10 3 4 10-5 5-10-4-3-10Z"/><path d="m7 3 4 10 10 3M11 13l-5 4m4-11 6 2 2 5"/>',
  stone: '<path d="m8 4 10 2 4 10-6 5-12-3-2-7Z"/><path d="m8 4 2 10 12 2m-12-2 6 7M2 11l8 3"/>',
  food: '<path d="M12 7c-7-6-13 3-7 11 4 6 7 1 7 1s3 5 7-1c6-8 0-17-7-11Z"/><path d="M12 7c0-4 2-5 5-5"/>',
  herbs:
    '<path d="M12 22V11"/><path d="M12 15c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-4 3-7 8-7 0 5-3 7-8 7Z"/>',
  save: '<path d="M5 3h13l3 3v15H3V3Zm2 0v6h10V3M7 21v-8h10v8"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  journal:
    '<path d="M3 5.5C5.7 4 9 4 12 6.2 15 4 18.3 4 21 5.5V19c-2.7-1.5-6-1.5-9 .7-3-2.2-6.3-2.2-9-.7Z"/><path d="M12 6.2v13.5"/>',
};

/**
 * Makes the HTML for one small line icon.
 *
 * The icon takes the text colour of whatever it sits in (`currentColor`), so one stencil works
 * on light and dark buttons alike. Screen readers skip it (`aria-hidden`), because the words
 * next to it already say what it means.
 *
 * @param {string} name - A key of `icons`, such as 'wood' or 'arrow'. Unknown names get the compass.
 * @returns {string} An `<svg>` element as an HTML string.
 */
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.compass}</svg>`;

/**
 * Builds every screen and dialog once; other modules look elements up by id.
 *
 * Like setting up all the rooms of a dollhouse before anyone plays: the main menu, the
 * loading screen, the game screen and the dialogs are all made now. Only one screen shows
 * at a time. The others wait with `hidden` until `changeScreen` in core/session.js swaps them.
 *
 * The small HTML marker comment in front of each string tells Prettier to format the HTML inside
 * it too. Prettier is careful with spaces between inline tags, which is why some lines end in
 * `</button` and the next starts with `>`: that keeps two buttons touching instead of adding a gap.
 *
 * @param {HTMLElement} app - The empty `#app` element from index.html that receives the layout.
 */
export function mountLayout(app) {
  app.innerHTML = /* HTML */ ` <!-- Screen 1: the main menu. The painting starting-regions.png is split into three panels, one
     per character. ui/selection.js picks a panel and moves the #departure details into it. -->
    <main id="selection" class="selection">
      <a class="wordmark menu-wordmark" href="./" aria-label="Wildhaven home"
        >${icon('compass')}<span>WILDHAVEN</span></a
      >
      <div class="realms" role="group" aria-label="Choose your character">
        ${CHARACTERS.map(
          (c, index) =>
            /* HTML */ `<div
              class="realm${c.id === 'scout' ? ' is-selected' : ''}"
              data-realm="${c.id}"
              style="--index:${index}"
            >
              <span class="realm-scene" aria-hidden="true"></span>
              <span class="realm-sprite" aria-hidden="true"></span>
              <button
                class="realm-pick"
                data-character="${c.id}"
                aria-pressed="${c.id === 'scout'}"
                aria-label="Choose ${c.shortName}"
              ></button>
              <span class="realm-label" aria-hidden="true"
                ><span class="realm-title">${c.name}</span
                ><span class="realm-place">${c.location}</span></span
              >
            </div>`,
        ).join('')}
      </div>
      <!-- The chosen character's details and buttons. ui/selection.js fills these and moves the
           whole panel into the chosen realm. preview.js adds its button inside .departure-actions. -->
      <section id="departure" class="departure" aria-label="Your chosen character">
        <p id="departure-place" class="departure-place"></p>
        <h2 id="departure-name"></h2>
        <p id="tagline" class="tagline"></p>
        <div class="departure-actions">
          <button id="begin" class="primary">Begin your journey ${icon('arrow')}</button
          ><button id="fresh" class="text-button" hidden>Start a fresh adventure</button>
          <p id="save-hint" class="save-hint">Your own path through a shared world.</p>
        </div>
        <p id="storage-note" class="storage-note" hidden></p>
      </section>
      <!-- Phones show one panel at a time: these step to the previous or next character. -->
      <button id="realm-prev" class="realm-step prev" aria-label="Previous character">‹</button
      ><button id="realm-next" class="realm-step next" aria-label="Next character">›</button>
      <div class="realm-dots" role="group" aria-label="Characters">
        ${CHARACTERS.map(
          (c) =>
            /* HTML */ `<button
              class="realm-dot"
              data-dot="${c.id}"
              aria-label="Show ${c.shortName}"
            ></button>`,
        ).join('')}
      </div>
    </main>

    <!-- Screen 2: loading. Shown while the world art loads; it offers a retry if loading fails. -->
    <section id="loading" class="loading" hidden aria-live="polite">
      <div class="loading-compass">${icon('compass')}</div>
      <span class="wordmark">WILDHAVEN</span>
      <h1 id="loading-title">A new path awaits.</h1>
      <p id="loading-text">Finding your place in the wild…</p>
      <div id="loading-bar" class="loading-bar"></div>
      <button id="retry" class="primary" hidden>Try again ${icon('arrow')}</button
      ><button id="loading-back" class="text-button">Back to characters</button>
    </section>

    <!-- Screen 3: the game. Phaser draws the world into #world; the HUD floats on top of it. -->
    <section id="game" class="game" hidden aria-label="Wildhaven game">
      <div
        id="world"
        tabindex="0"
        role="application"
        aria-label="Playable world. Use WASD or arrow keys to move, Shift to run, E to gather, M for map, J for journal, Escape to pause."
      ></div>

      <!-- Top bar: who you are, your resources, and the fullscreen and pause buttons. -->
      <div class="game-top">
        <div class="identity hud-panel">
          <span id="hud-portrait" class="hud-portrait"></span>
          <div>
            <span id="hud-name" class="hud-name"></span
            ><span class="identity-status"><span></span> Exploring the wilds</span>
          </div>
        </div>
        <div class="resources hud-panel" aria-label="Resources">
          <span>${icon('wood')}<b id="wood">0</b><span class="resource-label">Wood</span></span
          ><span>${icon('stone')}<b id="stone">0</b><span class="resource-label">Stone</span></span
          ><span>${icon('food')}<b id="food">0</b><span class="resource-label">Food</span></span
          ><span>${icon('herbs')}<b id="herbs">0</b><span class="resource-label">Herbs</span></span>
        </div>
        <div class="game-actions">
          <!-- The journal button. Its dot shows while a new page hasn't been read yet (ui/journal.js). -->
          <button
            id="open-journal"
            class="journal-button hud-panel"
            aria-label="Open field journal"
          >
            ${icon('journal')}<span class="journal-label">Journal</span><kbd>J</kbd
            ><span id="journal-dot" class="journal-dot" hidden></span></button
          ><button id="fullscreen" class="icon-button hud-panel" aria-label="Toggle fullscreen">
            ${icon('expand')}</button
          ><button id="pause" class="icon-button hud-panel" aria-label="Pause game">
            ${icon('pause')}
          </button>
        </div>
      </div>

      <!-- The name of the area you are standing in. -->
      <div class="region">
        <span>THE WILDS OF WILDHAVEN</span>
        <h1 id="region-name"></h1>
        <span class="region-rule"></span>
      </div>

      <!-- The goals card. ui/hud.js fills it: the starting goals first, then the current region's progress. -->
      <aside class="quest hud-panel">
        <span class="quest-label" id="quest-label"></span>
        <h2 id="quest-title"></h2>
        <p id="quest-text"></p>
        <ul>
          <li id="quest-first"></li>
          <li id="quest-second"></li>
        </ul>
      </aside>

      <!-- The small map in the corner. Clicking it opens the big map. -->
      <button id="open-map" class="minimap hud-panel" aria-label="Open world map">
        <canvas id="minimap" width="240" height="160" aria-hidden="true"></canvas
        ><span>${icon('map')} World map <kbd>M</kbd></span>
      </button>

      <!-- The "E" button. It appears when a supply is in reach and shows progress while gathering. -->
      <button id="interact" class="interact" hidden><kbd>E</kbd><span></span></button>

      <!-- The controls, shown for a few seconds each time the game opens. ui/hud.js shows and hides it. -->
      <div id="key-strip" class="key-strip key-guide" hidden aria-hidden="true">
        <span><kbd>W A S D</kbd> Move</span><span><kbd>Shift</kbd> Run</span
        ><span><kbd>E</kbd> Gather</span><span><kbd>M</kbd> Map</span
        ><span><kbd>J</kbd> Journal</span><span><kbd>Esc</kbd> Pause</span>
      </div>

      <!-- Arrow buttons for touch screens. CSS only shows them on narrow screens. -->
      <div class="touch-controls" aria-label="Movement controls">
        <button data-move="up" aria-label="Move north">↑</button>
        <div>
          <button data-move="left" aria-label="Move west">←</button
          ><button data-move="down" aria-label="Move south">↓</button
          ><button data-move="right" aria-label="Move east">→</button>
        </div>
      </div>

      <!-- Short pop-up messages such as "+3 wood". Screen readers announce them too. -->
      <div id="toast" class="toast" role="status"></div>
    </section>

    <!-- Pause menu. Any open dialog pauses the game. -->
    <dialog id="pause-dialog" class="pause-dialog">
      <span class="modal-mark">${icon('compass')}</span>
      <p class="dialog-kicker">TAKE A BREATH</p>
      <h2>The wilds can wait.</h2>
      <p>Your adventure is paused.</p>
      <button id="resume" class="primary">Keep exploring ${icon('arrow')}</button
      ><button id="save-game" class="secondary">${icon('save')} Save adventure</button
      ><button id="return" class="text-button">Return to characters</button>
      <p id="pause-save-note" class="fine-print">Progress is saved when you leave.</p>
    </dialog>

    <!-- The big world map, with a label over each region. -->
    <dialog id="map-dialog" class="map-dialog">
      <div class="map-heading">
        <div>
          <p class="dialog-kicker">YOUR FIELD MAP</p>
          <h2>The Wilds of Wildhaven</h2>
        </div>
        <button id="close-map" class="icon-button" aria-label="Close world map">
          ${icon('close')}
        </button>
      </div>
      <div class="map-surface">
        <canvas
          id="large-map"
          width="1120"
          height="800"
          aria-label="World map with your current position"
        ></canvas
        >${REGIONS.map(
          (l) =>
            /* HTML */ `<span
              class="map-label"
              style="left:${(l.x / WORLD.width) * 100}%;top:${(l.y / WORLD.height) * 100}%"
              >${l.name}</span
            >`,
        ).join('')}
        <!-- One button per found signpost; ui/dialogs.js fills this each time the map opens. -->
        <div id="map-waypoints"></div>
      </div>
      <div class="map-footer">
        <span>● You · ◆ Signpost: click to travel</span><span id="map-discovered"></span
        ><span><kbd>M</kbd> Close map</span>
      </div>
    </dialog>

    <!-- The field journal: a page per place found, and a clue to the next one. ui/journal.js fills it. -->
    <dialog id="journal-dialog" class="journal-dialog" aria-labelledby="journal-title">
      <div class="map-heading">
        <div>
          <p class="dialog-kicker">FIELD JOURNAL</p>
          <h2 id="journal-title"></h2>
        </div>
        <button id="close-journal" class="icon-button" aria-label="Close journal">
          ${icon('close')}
        </button>
      </div>
      <p id="journal-intro" class="journal-intro"></p>
      <div id="journal-trail" class="journal-trail">
        <span class="dialog-kicker">ON THE TRAIL</span>
        <p id="journal-trail-text"></p>
      </div>
      <ol id="journal-pages" class="journal-pages"></ol>
      <div class="map-footer">
        <span id="journal-count"></span><span><kbd>J</kbd> Close journal</span>
      </div>
    </dialog>

    <!-- "Start fresh?" check. ui/selection.js and core/session.js set its message. -->
    <dialog id="reset-dialog" class="pause-dialog">
      <h2>A fresh beginning?</h2>
      <p id="reset-message">
        This replaces this character’s saved adventure. Your other characters will be kept.
      </p>
      <button id="confirm-reset" class="primary">Start fresh ${icon('arrow')}</button
      ><button id="cancel-reset" class="text-button">Keep my adventure</button>
    </dialog>`;
}
