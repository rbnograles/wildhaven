import { CHARACTERS } from './state.js';
import { CLIPS } from './animation.js';
import { loadCharacterPainter } from './animation-art.js';

export function setupPreview(getCharacter) {
  const dialog = document.createElement('dialog');
  dialog.className = 'motion-preview';
  dialog.setAttribute('aria-labelledby', 'preview-heading');
  dialog.innerHTML = `<header><h2 id="preview-heading">Character animations</h2><button autofocus aria-label="Close preview">Close</button></header>
    <label>Character <select name="character">${CHARACTERS.map(c => `<option value="${c.id}">${c.shortName}</option>`).join('')}</select></label>
    <canvas width="640" height="380" aria-label="Animated character"></canvas>
    <div class="preview-controls"><label>Animation <select name="clip">${Object.entries(CLIPS).map(([id,c]) => `<option value="${id}">${c.label}</option>`).join('')}</select></label>
    <label>Facing <select name="direction"></select></label>
    <label>Speed <select name="speed"><option value=".5">Half speed</option><option value="1" selected>Normal</option></select></label>
    <button class="play-toggle">Pause</button></div><output></output><button class="retry" hidden>Retry artwork</button>`;
  document.body.append(dialog);
  const field = name => dialog.querySelector(`[name="${name}"]`);
  const canvas = dialog.querySelector('canvas');
  const toggle = dialog.querySelector('.play-toggle');
  const status = dialog.querySelector('output');
  const retry = dialog.querySelector('.retry');
  let painter, request, previous, time, playing, generation = 0;

  function updateDirections() {
    const facing = field('direction');
    const current = facing.value || '2';
    const choices = CLIPS[field('clip').value].sheet === 'actions' ? [1,2] : [0,1,2,3];
    facing.innerHTML = choices.map(i => `<option value="${i}">${['South','West','East','North'][i]}</option>`).join('');
    facing.value = choices.includes(Number(current)) ? current : '2';
    time = 0;
  }
  function draw(now) {
    if (!dialog.open) return;
    if (playing) time += Math.min((now - previous) / 1000, .1) * Number(field('speed').value);
    previous = now;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    painter.draw(ctx, field('character').value, field('clip').value, time, Number(field('direction').value), 320, 339, 290, true);
    request = requestAnimationFrame(draw);
  }
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
      if (current === generation) {status.textContent = error.message; retry.hidden = false;}
    }
  }
  retry.onclick = load;
  field('clip').onchange = updateDirections;
  toggle.onclick = () => {playing = !playing; toggle.textContent = playing ? 'Pause' : 'Play';};
  dialog.querySelector('header button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {generation++; cancelAnimationFrame(request);});
  dialog.addEventListener('keydown', e => e.stopPropagation());
  for (const [parent, before] of [['.departure-actions','#save-hint'],['#pause-dialog','#return']]) {
    const button = document.createElement('button');
    button.textContent = 'Preview animations';
    button.className = 'text-button';
    document.querySelector(parent).insertBefore(button, document.querySelector(before));
    button.onclick = () => {
      field('character').value = getCharacter();
      field('clip').value = 'walk';
      updateDirections(); field('direction').value = '2';
      playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      toggle.textContent = playing ? 'Pause' : 'Play';
      dialog.showModal(); load();
    };
  }
}
