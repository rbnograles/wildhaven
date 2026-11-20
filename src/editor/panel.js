// The world editor's toolbar and side panel: the buttons, the searchable list of places, the
// form for the selected place, the list of problems and the rebuild log. It shows what main.js
// gives it and reports clicks and typed values back; it never changes the places itself.

import { COLORS } from './view.js';

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
 * @param {object} on - What to call when the person does something: `pick(ref)`,
 *   `field(name, value)`, `move(x, y)`, `remove()`, `undo()`, `redo()`, `add(kind)`, `save()`,
 *   `rebuild()` and `overlay(name, shown)`.
 * @returns {{render: Function, log: Function, setLog: Function}} The panel's controls.
 */
export function createPanel(root, on) {
  /** Finds one of the page's fixed elements by its id. */
  const $ = (id) => root.getElementById(id);

  const list = $('list'),
    form = $('form'),
    problems = $('problems'),
    log = $('log'),
    filter = $('filter');
  const addButtons = [...root.querySelectorAll('[data-add]')];

  /** The last state drawn, kept so typing in the search box can redraw the list. */
  let last = null;

  $('undo').onclick = () => on.undo();
  $('redo').onclick = () => on.redo();
  $('save').onclick = () => on.save();
  $('rebuild').onclick = () => on.rebuild();
  for (const button of addButtons) button.onclick = () => on.add(button.dataset.add);
  for (const box of root.querySelectorAll('[data-overlay]'))
    box.onchange = () => on.overlay(box.dataset.overlay, box.checked);
  filter.oninput = () => last && drawList(last);
  form.onsubmit = (event) => event.preventDefault();

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
   * Makes one labelled row of the form.
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
   * Fills the list of problems. Clicking one selects the place it is about.
   *
   * @param {object} state - The state given to `render`.
   */
  function drawProblems(state) {
    $('stale').hidden = !state.stale;
    if (!state.problems.length)
      return problems.replaceChildren(el('li', { textContent: 'No problems found.' }));

    problems.replaceChildren(
      ...state.problems.map((p) => {
        const item = el('li', { className: p.level, textContent: p.message });
        if (p.kind) item.onclick = () => on.pick({ kind: p.kind, i: p.i });
        return item;
      }),
    );
  }

  return {
    // Redraws the toolbar and the panel from the editor's state.
    render(state) {
      last = state;
      const errors = state.problems.some((p) => p.level === 'error');

      $('undo').disabled = !state.canUndo || state.busy;
      $('redo').disabled = !state.canRedo || state.busy;
      $('save').disabled = !state.dirty || errors || state.busy;
      $('rebuild').disabled = state.dirty || state.busy;
      $('status').textContent = state.status;
      for (const button of addButtons) {
        button.classList.toggle('on', state.adding === button.dataset.add);
        button.disabled = state.busy;
      }

      drawList(state);
      drawForm(state);
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
