// The main menu (character selection), the first screen the player sees.
// It shows each character's painted panel and save status, and starts the game when "Begin" is pressed.
import { CHARACTERS, nextCharacterId } from '../data/characters.js';
import { restoreGame } from '../game/state.js';
import { storageKey } from '../game/saves.js';
import { start, cancelLoading } from '../core/session.js';
import { dayOf } from '../world/clock.js';
import { REGIONS } from '../world/regions.js';
import { CLIPS } from '../animation/clips.js';
import { loadCharacterSheets, loadCharacterPainter } from '../animation/sheets.js';
import { $ } from './layout.js';

// How far a finger must slide sideways, in CSS pixels, before it counts as a swipe.
const SWIPE_MIN_PX = 50;

/**
 * Turns a steady 0-to-1 count into one that starts gently and ends gently.
 *
 * Like a swing: slow at each end, quickest in the middle. The menu uses it to melt one idle
 * picture into the next without a sudden start or stop.
 *
 * @param {number} t - How far through the change we are, from 0 to 1.
 * @returns {number} The eased amount, also from 0 to 1.
 */
const easeInOut = (t) => t * t * (3 - 2 * t);

/**
 * Brings the characters on the menu panels to life: each one breathes and blinks in place.
 *
 * Every panel first shows a still picture (set in the stylesheet), so the menu never waits for
 * this. Once the animation sheets have loaded, each panel's canvas takes over and plays the
 * character's idle loop, drawn at exactly the size and spot of the still picture so nothing
 * jumps. If the sheets fail to load, or the player prefers reduced motion, the still stays.
 *
 * @param {object} session - The shared session; drawing pauses while the menu is not on screen.
 */
function animateFigures(session) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  Promise.all([loadCharacterSheets(), loadCharacterPainter()])
    .then(([sheets, painter]) => {
      const figures = [...document.querySelectorAll('[data-figure]')];
      // The canvases now show the characters, so the still pictures behind them are hidden.
      for (const canvas of figures) canvas.parentElement.classList.add('is-live');

      /**
       * Draws every panel's character for this moment, then asks to be called again.
       *
       * @param {number} now - The browser's timestamp for this frame, in milliseconds.
       */
      function draw(now) {
        requestAnimationFrame(draw);
        if (session.screen !== 'selection') return;

        for (const canvas of figures) {
          // Keep the canvas as sharp as its box on screen (a hidden panel measures 0: skip it).
          const width = Math.round(canvas.clientWidth * devicePixelRatio),
            height = Math.round(canvas.clientHeight * devicePixelRatio);
          if (!width || !height) continue;
          if (canvas.width !== width || canvas.height !== height)
            Object.assign(canvas, { width, height });

          // The still picture is the first pose of the idle sheet, one of four across, filling
          // the box. Stand the moving character on the same feet at the same height.
          const still = sheets.atlases[canvas.dataset.figure].idle,
            pose = still.frames[0][0],
            ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, width, height);

          // The idle loop is only a few pictures a second. In the game the character is small
          // and that reads fine, but at menu size each change is a visible jump. So here every
          // picture melts into the next one: the old one fades out as the new one fades in.
          // 'lighter' adds the two together, so where both are solid the body stays solid.
          const beat = (now / 1000) * CLIPS.idle.fps,
            step = Math.floor(beat),
            blend = easeInOut(beat - step);
          ctx.globalCompositeOperation = 'lighter';
          for (const [at, alpha] of [
            [step, 1 - blend],
            [step + 1, blend],
          ]) {
            if (alpha <= 0) continue;
            ctx.globalAlpha = alpha;
            painter.draw(
              ctx,
              canvas.dataset.figure,
              'idle',
              // The middle of the step, so rounding can never pick a neighbouring picture.
              (at + 0.5) / CLIPS.idle.fps,
              0,
              (pose.anchorX / (still.image.width / 4)) * width,
              ((pose.y + pose.height) / still.image.height) * height,
              (still.referenceHeight / still.image.height) * height,
            );
          }
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      requestAnimationFrame(draw);
    })
    // The still pictures stay; the game itself reports a loading failure when it starts.
    .catch(() => {});
}

/**
 * Wires up the character panels and buttons on the main menu.
 *
 * @param {object} session - The shared session; `selected` holds the chosen character's id.
 * @param {object} ui - The other UI parts, passed on when the game starts.
 * @returns {{readSlot: Function, select: Function}} Helpers to read a character's save and to pick a character.
 */
export function setupSelection(session, ui) {
  /**
   * Reads one character's saved game from the browser's storage.
   *
   * Each character has its own save slot, like a separate notebook. This opens the notebook
   * and checks that the save inside is readable and really belongs to that character.
   *
   * @param {string} id - The character id, such as `scout`.
   * @returns {{raw: string|null, value: object|null, invalid: boolean}} The stored text, the
   *   restored game (null if there is none or it is unreadable), and whether a save exists but can't be read.
   */
  function readSlot(id) {
    try {
      const raw = localStorage.getItem(storageKey(id));
      const value = raw ? restoreGame(raw) : null;
      return {
        raw,
        value: value?.character === id ? value : null,
        invalid: !!raw && (!value || value.character !== id),
      };
    } catch {
      // The browser blocked storage (for example in some private modes). Play still works, unsaved.
      $('storage-note').textContent =
        'Storage is unavailable. You can play, but progress will not persist.';
      $('storage-note').hidden = false;
      return { raw: null, value: null, invalid: false };
    }
  }

  /**
   * Picks a character: brightens their panel, moves the details panel into it, and shows their save status.
   *
   * The journey card says "Continue" (with the day and finds of the save) when the character has
   * a save, and "Begin" when they don't.
   *
   * @param {string} id - The character id, such as `scout`.
   */
  function select(id) {
    session.selected = id;
    const c = CHARACTERS.find((c) => c.id === id),
      slot = readSlot(id);

    // Only the chosen panel is selected (it widens and brightens); its pick button is pressed.
    document
      .querySelectorAll('[data-realm]')
      .forEach((realm) => realm.classList.toggle('is-selected', realm.dataset.realm === id));
    document
      .querySelectorAll('[data-character]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.character === id)));
    document
      .querySelectorAll('[data-dot]')
      .forEach((dot) => dot.setAttribute('aria-current', String(dot.dataset.dot === id)));

    // One details panel is shared; it moves into whichever panel is chosen.
    document.querySelector(`[data-realm="${id}"]`).append($('departure'));
    $('departure-place').textContent = c.location;
    $('departure-name').textContent = c.name;
    $('tagline').textContent = c.tagline;

    // The journey card: a saved game shows how far it got (and gets the gold "saved" look, with
    // the New journey button beside it); otherwise the card simply begins.
    const game = slot.value;
    $('begin').classList.toggle('is-saved', !!game);
    $('begin-title').textContent = game ? 'Continue your journey' : 'Begin your journey';
    $('fresh').hidden = !game;
    $('save-hint').textContent = game
      ? `Day ${dayOf(game.time)} · ${game.discovered.length} of ${REGIONS.length} regions · ${game.landmarks.length} ${game.landmarks.length === 1 ? 'place' : 'places'}`
      : slot.invalid
        ? 'This save could not be read. Start fresh to play.'
        : 'Your own path through a shared world.';

    // Measured last, once the new text is in, so the character stands just above the details.
    measureDeparture();
  }

  /**
   * Tells the panel holding the details how tall they are, as the CSS variable `--departure-h`.
   *
   * The stylesheet uses it to stand the chosen character just above the details. A long name
   * or tagline then lifts the character instead of hiding its feet behind the text.
   * While the menu is hidden the details measure 0, so it does nothing then; that way the
   * character does not slide up from behind the details when the menu comes back.
   */
  function measureDeparture() {
    const departure = $('departure');
    if (!departure.offsetHeight) return;
    departure.parentElement.style.setProperty('--departure-h', `${departure.offsetHeight}px`);
  }

  // The details change height when the window resizes, when text wraps differently, and while
  // the chosen panel widens, so measure again whenever their size changes.
  new ResizeObserver(measureDeparture).observe($('departure'));

  // Character panels: click to pick, or use the left and right arrow keys to move between them.
  document.querySelectorAll('[data-character]').forEach((button) => {
    button.addEventListener('click', () => select(button.dataset.character));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      // Step one panel right or left (wrapping round), then focus that panel's button.
      select(nextCharacterId(button.dataset.character, event.key === 'ArrowRight' ? 1 : -1));
      document.querySelector(`[data-character="${session.selected}"]`).focus();
    });
  });

  // Phones show one panel at a time: the arrow buttons step to the previous or next character.
  $('realm-prev').addEventListener('click', () => select(nextCharacterId(session.selected, -1)));
  $('realm-next').addEventListener('click', () => select(nextCharacterId(session.selected, 1)));

  // The dots under the panel jump straight to a character.
  document
    .querySelectorAll('[data-dot]')
    .forEach((dot) => dot.addEventListener('click', () => select(dot.dataset.dot)));

  // A sideways swipe on a touch screen steps to the next or previous character.
  // Mouse drags are ignored so desktop clicks never turn into swipes.
  let swipeStart = null;
  const realms = document.querySelector('.realms');
  realms.addEventListener('pointerdown', (event) => {
    swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
  });
  realms.addEventListener('pointerup', (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x,
      dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2)
      select(nextCharacterId(session.selected, dx < 0 ? 1 : -1));
  });
  realms.addEventListener('pointercancel', () => (swipeStart = null));

  $('begin').addEventListener('click', () => start(session, ui));

  // "New journey" asks first, because it replaces the saved game.
  $('fresh').addEventListener('click', () => {
    $('reset-message').textContent =
      'This replaces this character’s saved adventure. Your other characters will be kept.';
    $('reset-dialog').showModal();
  });

  $('loading-back').addEventListener('click', () => cancelLoading(session));

  animateFigures(session);

  return { readSlot, select };
}
