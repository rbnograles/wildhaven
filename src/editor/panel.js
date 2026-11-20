// The world editor's toolbar and side panel: the mode buttons, the searchable list of places and
// the form for the selected place, the object form and sprite palette, the list of problems and
// the rebuild log. It shows what main.js gives it and reports clicks and typed values back; it
// never changes the places or the objects itself.

import { COLORS, GROUND_COLORS } from './view.js';
import { createPalette } from './palette.js';

/**
 * Makes one element with its properties and children set, to keep the code below short.
 *
 * @param {string} tag - The tag name, such as 'li'.
 * @param {object} [props] - Properties to copy onto the element, such as `textContent`.
 * @param {(Node|string)[]} [children] - What goes inside it.
 * @returns {HTMLElement} The new element.
 */
function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/**
 * Sets up the toolbar and the side panel.
 *
 * @param {Document} root - The page.
 * @param {object} on - What to call when the person does something. Places: `pick(ref)`,
 *   `field(name, value)`, `move(x, y)`, `remove()`, `add(kind)`. Objects: `mode(name)`,
 *   `armSprite(name)`, `objectMove(x, y)`, `objectTurn(degrees)`, `removeObjects()`,
 *   `dropStale()`, `pickObject(obj)`.
 *   Terrain: `tool(kind)`, `brush(size)`, `kit(name)`.
 *   Both: `undo()`, `redo()`, `save()`, `rebuild()`, `overlay(name, shown)`. Also `specs`, the
 *   sprites of objects.json, for the palette.
 * @returns {{render: Function, log: Function, setLog: Function, palette: object}} The controls.
 */
export function createPanel(root, on) {
  /** Finds one of the page's fixed elements by its id. */
  const $ = (id) => root.getElementById(id);

  const list = $('list'),
    form = $('form'),
    objectForm = $('object'),
    problems = $('problems'),
    log = $('log'),
    filter = $('filter');
  const addButtons = [...root.querySelectorAll('[data-add]')];
  const modeButtons = [...root.querySelectorAll('[data-mode]')];
  const groundButtons = [...root.querySelectorAll('[data-ground]')];
  const palette = createPalette($('palette'), {
    specs: on.specs,
    // A palette sprite was clicked.
    pick: (name) => on.armSprite(name),
  });

  /** The last state drawn, kept so typing in the search box can redraw the list. */
  let last = null;

  $('undo').onclick = () => on.undo();
  $('redo').onclick = () => on.redo();
  $('save').onclick = () => on.save();
  $('rebuild').onclick = () => on.rebuild();
  $('drop-stale').onclick = () => on.dropStale();
  for (const button of addButtons) button.onclick = () => on.add(button.dataset.add);
  for (const button of modeButtons) button.onclick = () => on.mode(button.dataset.mode);
  for (const button of groundButtons) {
    // A swatch of the colour this ground is previewed in on the map.
    // The hill tools (raise, lower, stairs) share these buttons but have no ground colour.
    if (GROUND_COLORS[button.dataset.ground]) {
      const swatch = el('span', { className: 'swatch' });
      swatch.style.background = GROUND_COLORS[button.dataset.ground];
      button.prepend(swatch);
    }
    button.onclick = () => on.tool(button.dataset.ground);
  }
  $('brush').onchange = () => on.brush(Number($('brush').value));
  $('kit').onchange = () => on.kit($('kit').value);
  for (const box of root.querySelectorAll('[data-overlay]'))
    box.onchange = () => on.overlay(box.dataset.overlay, box.checked);
  filter.oninput = () => last && drawList(last);
  form.onsubmit = (event) => event.preventDefault();
  objectForm.onsubmit = (event) => event.preventDefault();

  /**
   * Fills the list of places, keeping only the rows that match the search box.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawList(state) {
    const query = filter.value.trim().toLowerCase();
    const flagged = new Set(state.problems.map((p) => `${p.kind}:${p.i}`));
    const rows = state.rows.filter(
      (row) => !query || `${row.id} ${row.name}`.toLowerCase().includes(query),
    );

    list.replaceChildren(
      ...rows.map((row) => {
        const chosen = state.selected?.kind === row.kind && state.selected.i === row.i;
        const dot = el('span', { className: 'dot' });
        dot.style.background = COLORS[row.kind];

        const item = el('li', { className: chosen ? 'selected' : '' }, [dot, row.name]);
        if (flagged.has(`${row.kind}:${row.i}`))
          item.append(el('span', { className: 'flag', textContent: '!' }));
        item.onclick = () => on.pick({ kind: row.kind, i: row.i });
        return item;
      }),
    );
  }

  /**
   * Makes one labelled row of a form.
   *
   * @param {string} label - The words shown beside the input.
   * @param {HTMLElement} input - The input or select.
   * @returns {HTMLElement[]} The label and the input, for the form's two columns.
   */
  function row(label, input) {
    return [el('label', { textContent: label }), input];
  }

  /**
   * Makes a text or number box that reports its value when the person finishes typing.
   *
   * @param {string} value - What it shows.
   * @param {(value: string) => void} [change] - Called with the new value; without it the box is read-only.
   * @param {string} [type] - 'text' or 'number'.
   * @returns {HTMLInputElement} The box.
   */
  function box(value, change, type = 'text') {
    const input = el('input', { type, value: value ?? '', readOnly: !change });
    if (change) input.onchange = () => change(input.value);
    return input;
  }

  /**
   * Makes a drop-down list.
   *
   * @param {string} value - The option picked now.
   * @param {{value: string, label: string}[]} options - The choices.
   * @param {(value: string) => void} change - Called with the new choice.
   * @returns {HTMLSelectElement} The list.
   */
  function pickList(value, options, change) {
    const select = el(
      'select',
      {},
      options.map((o) => el('option', { value: o.value, textContent: o.label })),
    );
    select.value = value ?? '';
    select.onchange = () => change(select.value);
    return select;
  }

  /**
   * Fills the form for the selected place, or empties it when nothing is selected.
   *
   * Spawns, supplies and launch points show only a position: code names their ids, so they
   * can be moved but not renamed or deleted here.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawForm(state) {
    const p = state.place;
    if (!p)
      return form.replaceChildren(el('p', { className: 'wide', textContent: 'Nothing selected.' }));

    const fixed = ['spawn', 'supply', 'launch'].includes(p.kind);
    const fields = [];

    if (fixed) {
      fields.push(...row(p.kind, box(p.name)));
    } else {
      const regions = state.regions.map((r) => ({ value: r.id, label: r.name }));
      fields.push(
        ...row(
          'id',
          box(p.id, (v) => on.field('id', v)),
        ),
        ...row(
          'name',
          box(p.name, (v) => on.field('name', v)),
        ),
        ...row(
          'region',
          pickList(p.region, regions, (v) => on.field('region', v)),
        ),
      );
    }

    fields.push(
      ...row(
        'x',
        box(p.x, (v) => on.move(Number(v), p.y), 'number'),
      ),
      ...row(
        'y',
        box(p.y, (v) => on.move(p.x, Number(v)), 'number'),
      ),
    );

    if (p.kind === 'landmark') {
      const sprites = [
        { value: '', label: '(none)' },
        ...state.sprites.map((s) => ({ value: s, label: s })),
      ];
      fields.push(
        ...row(
          'pool',
          box(p.pool, (v) => on.field('pool', v), 'number'),
        ),
        ...row(
          'object',
          pickList(p.object, sprites, (v) => on.field('object', v)),
        ),
      );
    }

    if (!fixed) {
      const remove = el('button', {
        type: 'button',
        className: 'wide',
        textContent: 'Delete this place',
      });
      remove.onclick = () => on.remove();
      fields.push(remove);
    }

    form.replaceChildren(...fields);
  }

  /**
   * Fills the object form: one object's sprite, position and what the game does with it, or a
   * count when several are selected.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawObject(state) {
    const chosen = state.objects;
    if (!chosen.length) {
      const turn = state.turns(state.armed) ? `R turns it (now ${state.turn}°). ` : '';
      const hint = state.armed
        ? `Click the map to place ${state.armed}. ${turn}Escape stops.`
        : 'Click a sprite to select it, Shift+drag to select several, or pick one below to place.';
      return objectForm.replaceChildren(el('p', { className: 'wide', textContent: hint }));
    }

    const fields = [];
    if (chosen.length === 1) {
      const [o] = chosen;
      const tags = [o.own ? 'placed by hand' : 'generated', ...state.tags(o.name)].join(', ');
      fields.push(
        ...row('sprite', box(o.name)),
        ...row(
          'x',
          box(o.x, (v) => on.objectMove(Number(v), o.y), 'number'),
        ),
        ...row(
          'y',
          box(o.y, (v) => on.objectMove(o.x, Number(v)), 'number'),
        ),
        // Only path pieces are drawn turned, so only they get a turn box.
        ...(state.turns(o.name)
          ? row(
              'turn',
              box(o.rotation, (v) => on.objectTurn(Number(v)), 'number'),
            )
          : []),
        el('p', { className: 'wide', textContent: tags }),
      );
    } else {
      fields.push(
        el('p', { className: 'wide', textContent: `${chosen.length} objects selected.` }),
      );
    }

    const remove = el('button', {
      type: 'button',
      className: 'wide',
      textContent: chosen.length === 1 ? 'Delete this object' : 'Delete these objects',
    });
    remove.onclick = () => on.removeObjects();
    fields.push(remove);
    objectForm.replaceChildren(...fields);
  }

  /**
   * Fills the list of problems. Clicking one selects the place or object it is about.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawProblems(state) {
    $('stale').hidden = !state.stale;
    $('drop-stale').hidden = !state.staleEdits;
    if (!state.problems.length)
      return problems.replaceChildren(el('li', { textContent: 'No problems found.' }));

    problems.replaceChildren(
      ...state.problems.map((p) => {
        const item = el('li', { className: p.level, textContent: p.message });
        if (p.kind) item.onclick = () => on.pick({ kind: p.kind, i: p.i });
        else if (p.object) item.onclick = () => on.pickObject(p.object);
        return item;
      }),
    );
  }

  return {
    palette,

    // Redraws the toolbar and the panel from the editor's state.
    render(state) {
      last = state;
      const errors = state.problems.some((p) => p.level === 'error');
      const places = state.mode === 'places';

      $('undo').disabled = !state.canUndo || state.busy;
      $('redo').disabled = !state.canRedo || state.busy;
      $('save').disabled = !state.dirty || errors || state.busy;
      $('rebuild').disabled = state.dirty || state.busy;
      $('status').textContent = state.status;
      $('places-pane').hidden = !places;
      $('objects-pane').hidden = state.mode !== 'objects';
      $('terrain-pane').hidden = state.mode !== 'terrain';
      for (const button of groundButtons)
        button.classList.toggle('on', state.tool === button.dataset.ground);
      $('brush').value = String(state.brush);
      $('kit').value = state.kit;
      $('painted').textContent = state.painted
        ? `${state.painted} boxes of ground painted by hand.`
        : 'No ground painted yet.';
      root.querySelector('.places-only').hidden = !places;

      for (const button of modeButtons)
        button.classList.toggle('on', state.mode === button.dataset.mode);
      for (const button of addButtons) {
        button.classList.toggle('on', state.adding === button.dataset.add);
        button.disabled = state.busy;
      }
      palette.arm(state.armed);

      drawList(state);
      drawForm(state);
      drawObject(state);
      drawProblems(state);
    },

    // Adds text to the end of the rebuild log and keeps the newest lines in view.
    log(text) {
      log.textContent += text;
      log.scrollTop = log.scrollHeight;
    },

    // Replaces the whole rebuild log.
    setLog(text) {
      log.textContent = text;
      log.scrollTop = log.scrollHeight;
    },
  };
}
