// The "Preview animations" dialog: a small viewer that plays any character's animations on a
// canvas. It lets you look at clips the game doesn't use yet (craft, fight, swim), so it is a
// window into the art, not a sign that those actions work in play.
import { CHARACTERS } from '../data/characters.js';
import { CLIPS } from './clips.js';
import { loadCharacterPainter } from './sheets.js';

/**
 * Builds the animation preview dialog and adds a "Preview animations" button to the selection
 * screen and the pause menu.
 *
 * Like a flip-book viewer: pick a character, an animation and a facing, and it plays the frames
 * on a canvas. The artwork loads the first time the dialog opens, not when the page loads.
 *
 * @param {() => string} getCharacter - Returns the id of the character to show first (the one
 *   being played, or the one selected on the selection screen).
 */
export function setupPreview(getCharacter) {
  // Build the dialog and its controls.
  const dialog = document.createElement('dialog');
  dialog.className = 'motion-preview';
  dialog.setAttribute('aria-labelledby', 'preview-heading');
  dialog.innerHTML = /* HTML */ `<header>
      <h2 id="preview-heading">Character animations</h2>
      <button autofocus aria-label="Close preview">Close</button>
    </header>
    <label
      >Character
      <select name="character">
        ${CHARACTERS.map((c) => `<option value="${c.id}">${c.shortName}</option>`).join('')}
      </select></label
    >
    <canvas width="640" height="380" aria-label="Animated character"></canvas>
    <div class="preview-controls">
      <label
        >Animation
        <select name="clip">
          ${Object.entries(CLIPS)
            .map(([id, c]) => `<option value="${id}">${c.label}</option>`)
            .join('')}
        </select></label
      >
      <label
        >Facing
        <select name="direction"></select
      ></label>
      <label
        >Speed
        <select name="speed">
          <option value=".5">Half speed</option>
          <option value="1" selected>Normal</option>
        </select></label
      >
      <button class="play-toggle">Pause</button>
    </div>
    <output></output><button class="retry" hidden>Retry artwork</button>`;
  document.body.append(dialog);

  /**
   * Finds one of the dialog's dropdowns by its `name`.
   *
   * @param {string} name - 'character', 'clip', 'direction' or 'speed'.
   * @returns {HTMLSelectElement} The dropdown.
   */
  const field = (name) => dialog.querySelector(`[name="${name}"]`);
  const canvas = dialog.querySelector('canvas');
  const toggle = dialog.querySelector('.play-toggle');
  const status = dialog.querySelector('output');
  const retry = dialog.querySelector('.retry');

  // painter draws frames; request is the pending animation frame; previous and time are the
  // playback clock; generation counts loads, so a slow load that finishes late is ignored.
  let painter,
    request,
    previous,
    time,
    playing,
    generation = 0;

  /**
   * Fills the "Facing" dropdown with the directions the chosen animation has, and restarts it.
   *
   * Action clips (gather, build, chop, ...) are only drawn facing east, and mirrored for west, so
   * they offer just those two. Standing, walking and running offer all four.
   */
  function updateDirections() {
    const facing = field('direction');
    const current = facing.value || '2';
    const choices = CLIPS[field('clip').value].action ? [1, 2] : [0, 1, 2, 3];
    facing.innerHTML = choices
      .map((i) => `<option value="${i}">${['South', 'West', 'East', 'North'][i]}</option>`)
      .join('');
    facing.value = choices.includes(Number(current)) ? current : '2';
    time = 0;
  }

  /**
   * Draws one frame of the preview, then asks the browser to call it again next frame.
   *
   * Like turning the next page of a flip-book: it moves the clock forward (unless paused), clears
   * the canvas and paints the pose for that moment. It stops by itself once the dialog closes.
   *
   * @param {number} now - The browser's timestamp for this frame, in milliseconds.
   */
  function draw(now) {
    if (!dialog.open) return;

    // Advance the clock, but never by more than 0.1 s, so a hidden tab doesn't jump far ahead.
    if (playing) time += Math.min((now - previous) / 1000, 0.1) * Number(field('speed').value);
    previous = now;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    painter.draw(
      ctx,
      field('character').value,
      field('clip').value,
      time,
      Number(field('direction').value),
      320,
      339,
      290,
      true,
    );
    request = requestAnimationFrame(draw);
  }

  /**
   * Loads the character artwork, then starts playing.
   *
   * If loading fails, it shows the error and a "Retry artwork" button instead of spinning forever.
   * If the dialog was closed, or a newer load started while this one waited, it quietly gives up.
   */
  async function load() {
    const current = ++generation;
    retry.hidden = true;
    status.textContent = 'Loading artwork…';

    try {
      painter = await loadCharacterPainter();
      if (!dialog.open || current !== generation) return;
      status.textContent = '';
      previous = performance.now();
      request = requestAnimationFrame(draw);
    } catch (error) {
      if (current === generation) {
        status.textContent = error.message;
        retry.hidden = false;
      }
    }
  }

  // Wire up the controls.
  retry.onclick = load;
  field('clip').onchange = updateDirections;
  toggle.onclick = () => {
    playing = !playing;
    toggle.textContent = playing ? 'Pause' : 'Play';
  };
  dialog.querySelector('header button').onclick = () => dialog.close();

  // Closing stops the drawing loop and makes any load still in progress give up.
  dialog.addEventListener('close', () => {
    generation++;
    cancelAnimationFrame(request);
  });

  // Keys pressed in the dialog's dropdowns must not move the player or open the map.
  dialog.addEventListener('keydown', (e) => e.stopPropagation());

  // Add an opening button to the selection screen and to the pause menu.
  for (const [parent, before] of [
    ['.departure-actions', '#save-hint'],
    ['#pause-dialog', '#return'],
  ]) {
    const button = document.createElement('button');
    button.textContent = 'Preview animations';
    button.className = 'text-button';
    document.querySelector(parent).insertBefore(button, document.querySelector(before));

    // Open on the current character walking east, playing unless the player prefers less motion.
    button.onclick = () => {
      field('character').value = getCharacter();
      field('clip').value = 'walk';
      updateDirections();
      field('direction').value = '2';
      playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      toggle.textContent = playing ? 'Pause' : 'Play';
      dialog.showModal();
      load();
    };
  }
}
