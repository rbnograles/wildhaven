// Builds the page the player sees: the character selection screen, the loading screen, the
// in-game HUD, and the pause, map, journal, reset and camp dialogs. Think of it as the stage set. It
// is built once when the page loads; after that, other modules only show, hide or relabel its parts.
import { CHARACTERS } from '../data/characters.js';
import woodIconUrl from '../../assets/ui/game/item-wood.png';
import stoneIconUrl from '../../assets/ui/game/item-stone.png';
import foodIconUrl from '../../assets/ui/game/item-food.png';
import herbsIconUrl from '../../assets/ui/game/item-herbs.png';
import healthIconUrl from '../../assets/ui/game/status-icon-health.png';
import hungerIconUrl from '../../assets/ui/game/status-icon-hunger.png';
import warmthIconUrl from '../../assets/ui/game/status-icon-warmth.png';
import { CAMP_NAME_MAX, CAMPFIRE_COST } from '../data/balance.js';
import { TOOLS } from '../data/tools.js';
import { WORLD } from '../world/map.js';
import { REGIONS } from '../world/regions.js';
import { RESOURCES } from '../data/supplies.js';

// How many of the item box's ten painted slots are still empty: all but one per resource.
const SPARE_SLOTS = 10 - RESOURCES.length;

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
  iron: '<path d="M3 18 6 10h12l3 8Z"/><path d="M6 10 8 6h8l2 4M9 14h6"/>',
  save: '<path d="M5 3h13l3 3v15H3V3Zm2 0v6h10V3M7 21v-8h10v8"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  journal:
    '<path d="M3 5.5C5.7 4 9 4 12 6.2 15 4 18.3 4 21 5.5V19c-2.7-1.5-6-1.5-9 .7-3-2.2-6.3-2.2-9-.7Z"/><path d="M12 6.2v13.5"/>',
  flame:
    '<path d="M12 21c-3.9 0-6-2.6-6-5.6C6 11 11 9 10 3c3 1.8 5 4.4 5 7.2 1-.6 1.6-1.7 1.8-2.9C18 9 18 11 18 15.4 18 18.4 15.9 21 12 21Z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z"/>',
  hammer: '<path d="m14 3 7 7-3 3-7-7Z"/><path d="M12.5 8.5 3 18l3 3 9.5-9.5"/>',
  axe: '<path d="m4 20 10-10"/><path d="M12 5c2.5-2.5 6-2.5 8 0l-5 5c-2-.5-3.5-2.5-3-5Z"/>',
  pickaxe: '<path d="M4 9c5-5 11-5 16 0"/><path d="M12 5.5V21"/>',
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
 * Makes the HTML for one survival meter: its painted icon, a bar that ui/hud.js fills through
 * the `--fill` style, and a small word for why it is changing.
 *
 * @param {string} id - 'health', 'hunger' or 'warmth'.
 * @param {string} label - The meter's name, read out by screen readers.
 * @param {string} iconUrl - The picture shown before the bar.
 * @returns {string} The meter as an HTML string.
 */
const meter = (id, label, iconUrl) =>
  /* HTML */ `<div
    id="meter-${id}"
    class="meter"
    role="meter"
    aria-label="${label}"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="100"
  >
    <img src="${iconUrl}" alt="" /><span class="meter-bar"></span><span class="meter-tag"></span>
  </div>`;

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
        aria-label="Playable world. Use WASD or arrow keys to move, Shift to run, E to gather or open a camp, B to open the build menu, 2 to 4 in the build menu to craft tools, F to eat, H to heal with herbs, M for map, J for journal, Escape to pause."
      ></div>

      <!-- Top right: the journal, fullscreen and pause buttons. -->
      <div class="game-top">
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
        <p id="region-progress" class="region-progress"></p>
      </div>

      <!-- The goals card. ui/hud.js fills it: the first campfire, then the nearest camp's needs. -->
      <aside class="quest hud-panel">
        <span class="quest-label" id="quest-label"></span>
        <h2 id="quest-title"></h2>
        <p id="quest-text"></p>
        <ul id="quest-lines"></ul>
      </aside>

      <!-- The bottom bar: the player card on the left, the item box and Build button in the middle,
           and the round map on the right. It is a grid, so the three never overlap. -->
      <div class="game-bottom">
        <!-- Who you are, the day clock and your survival meters. -->
        <div class="identity hud-panel">
          <span id="hud-portrait" class="hud-portrait"></span>
          <span id="day-dial" class="day-dial" role="img"
            ><i class="day-dial-face"></i><i class="day-dial-rim"></i><i class="day-dial-pin"></i
          ></span>
          <div class="identity-text">
            <span id="hud-name" class="hud-name"></span
            ><span id="identity-status" class="identity-status" data-phase="day"
              ><span class="sun">${icon('sun')}</span><span class="moon">${icon('moon')}</span
              ><span id="clock"></span
            ></span>
            <div class="meters">
              ${meter('health', 'Health', healthIconUrl)}${meter('hunger', 'Hunger', hungerIconUrl)}${meter('warmth', 'Warmth', warmthIconUrl)}
            </div>
          </div>
        </div>

        <!-- The item box (ten slots: one per resource, the rest spare for items to come) and the
             Build button beside it, with the build menu (the campfire and the Tools group) that
             opens above it, and the row of tools owned. Clicking the food slot eats and the herbs
             slot heals. -->
        <div class="hotbar-area">
          <div id="build-menu" class="build-menu hud-panel" hidden>
            <p class="build-menu-title">BUILD</p>
            <button id="build-campfire" class="build-option">
              ${icon('flame')}<span class="build-option-text"
                ><b>Campfire</b><small>Warms the night and founds a camp</small></span
              ><span class="build-cost"
                >${CAMPFIRE_COST.wood} wood · ${CAMPFIRE_COST.stone} stone</span
              ><kbd>1</kbd>
            </button>
            <p class="build-menu-title">TOOLS</p>
            ${TOOLS.map(
              (t) =>
                /* HTML */ `<button
                  id="craft-${t.id}"
                  class="build-option craft-option"
                  data-tool="${t.id}"
                >
                  ${icon(t.icon)}<span class="build-option-text"
                    ><b class="craft-name"></b><small>${t.use}</small></span
                  ><span class="build-cost craft-cost"></span><kbd>${t.key}</kbd>
                </button>`,
            ).join('')}
          </div>
          <!-- The tools owned: a chip per tool with its tier, and the uses left on a stone one. -->
          <div class="tool-row" aria-label="Tools">
            ${TOOLS.map(
              (t) =>
                /* HTML */ `<span id="tool-${t.id}" class="tool-chip empty"
                  >${icon(t.icon)}<span class="tool-state">—</span></span
                >`,
            ).join('')}
          </div>
          <div class="hotbar">
            <div class="item-box" aria-label="Items">
              <span class="slot" title="Wood"
                ><img src="${woodIconUrl}" alt="" /><b id="wood">0</b
                ><span class="slot-label">Wood</span></span
              ><span class="slot" title="Stone"
                ><img src="${stoneIconUrl}" alt="" /><b id="stone">0</b
                ><span class="slot-label">Stone</span></span
              ><span class="slot" title="Iron"
                >${icon('iron')}<b id="iron">0</b><span class="slot-label">Iron</span></span
              ><button id="slot-food" class="slot" title="Eat one food (F)">
                <img src="${foodIconUrl}" alt="" /><b id="food">0</b
                ><span class="slot-label">Food</span><kbd>F</kbd></button
              ><button id="slot-herbs" class="slot" title="Heal with 3 herbs (H)">
                <img src="${herbsIconUrl}" alt="" /><b id="herbs">0</b
                ><span class="slot-label">Herbs</span><kbd>H</kbd></button
              >${'<span class="slot spare" aria-hidden="true"></span>'.repeat(SPARE_SLOTS)}
            </div>
            <button
              id="build-button"
              class="slot build-slot"
              title="Build (B)"
              aria-controls="build-menu"
              aria-expanded="false"
            >
              <span class="slot-label">Build</span><kbd>B</kbd>
            </button>
          </div>
        </div>

        <!-- The round map. Clicking it opens the big map. -->
        <button id="open-map" class="minimap" aria-label="Open world map (M)">
          <canvas id="minimap" width="220" height="220" aria-hidden="true"></canvas
          ><kbd class="minimap-key">M</kbd>
        </button>
      </div>

      <!-- The "E" button. It appears when E would do something (gather, repair, board, step ashore, open a camp) and shows progress while gathering or repairing. -->
      <button id="interact" class="interact" hidden><kbd>E</kbd><span></span></button>

      <!-- Build mode's bar: what a campfire costs, or why the ghost's spot is refused. ui/hud.js fills it. -->
      <div id="build-bar" class="build-bar" role="status" hidden></div>

      <!-- The controls, shown for a few seconds each time the game opens. ui/hud.js shows and hides it. -->
      <div id="key-strip" class="key-strip key-guide" hidden aria-hidden="true">
        <span><kbd>W A S D</kbd> Move</span><span><kbd>Shift</kbd> Run</span
        ><span><kbd>E</kbd> Gather · Boat</span><span><kbd>B</kbd> Build</span
        ><span><kbd>F</kbd> Eat</span><span><kbd>H</kbd> Heal</span><span><kbd>M</kbd> Map</span
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
              data-region="${l.id}"
              style="left:${(l.x / WORLD.width) * 100}%;top:${(l.y / WORLD.height) * 100}%"
              >${l.name}</span
            >`,
        ).join('')}
        <!-- One button per found signpost; ui/dialogs.js fills this each time the map opens. -->
        <div id="map-waypoints"></div>
      </div>
      <div class="map-footer">
        <span>● You · <b class="legend-camp">●</b> Camp · ◆ Signpost: click to travel</span
        ><span id="map-discovered"></span><span><kbd>M</kbd> Close map</span>
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
    </dialog>

    <!-- Naming a camp just founded. ui/camp.js fills in the suggested name. -->
    <dialog
      id="camp-name-dialog"
      class="pause-dialog camp-name-dialog"
      aria-labelledby="camp-name-title"
    >
      <form method="dialog">
        <span class="modal-mark">${icon('flame')}</span>
        <p class="dialog-kicker">A NEW CAMP</p>
        <h2 id="camp-name-title">Name your camp</h2>
        <label for="camp-name-input">Camp name</label>
        <input id="camp-name-input" maxlength="${CAMP_NAME_MAX}" autocomplete="off" required />
        <button class="primary" value="found">Found camp ${icon('arrow')}</button>
      </form>
    </dialog>

    <!-- A camp: its needs and what to do at the fire. ui/camp.js fills it. -->
    <dialog id="camp-dialog" class="camp-dialog" aria-labelledby="camp-title">
      <div class="map-heading">
        <div>
          <p id="camp-kicker" class="dialog-kicker"></p>
          <h2 id="camp-title"></h2>
        </div>
        <button id="close-camp" class="icon-button" aria-label="Close camp">
          ${icon('close')}
        </button>
      </div>
      <p id="camp-fire" class="camp-fire"></p>
      <h3 class="camp-heading">What the camp needs</h3>
      <ol id="camp-needs" class="camp-needs"></ol>
      <h3 class="camp-heading">At the fire</h3>
      <div class="camp-tasks">
        <button id="camp-tea" class="secondary">Brew tea<small></small></button
        ><button id="camp-eat" class="secondary">Eat<small></small></button
        ><button id="camp-heal" class="secondary">Heal<small></small></button
        ><button id="camp-rest" class="secondary">Rest until dawn<small></small></button>
      </div>
    </dialog>

    <!-- Shown after passing out from the cold. ui/camp.js says where the player will wake. -->
    <dialog id="passout-dialog" class="pause-dialog" aria-labelledby="passout-title">
      <span class="modal-mark">${icon('moon')}</span>
      <p class="dialog-kicker">YOU PASSED OUT</p>
      <h2 id="passout-title">The cold caught you.</h2>
      <p id="passout-text"></p>
      <button id="passout-close" class="primary">Get up ${icon('arrow')}</button>
    </dialog>`;
}
