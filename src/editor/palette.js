// The world editor's sprite palette: every sprite that can be placed by hand, grouped by kind
// (trees, plants, rocks, buildings, props), each with a small picture. Clicking one "arms" it,
// and the map then places one of it per click.

import { spriteUrl } from './sprites.js';
import { lockReason } from './edits.js';

/** The order the groups are shown in. Kinds not listed here follow in name order. */
const KIND_ORDER = ['trees', 'plants', 'rocks', 'buildings', 'props'];

/**
 * Builds the palette.
 *
 * @param {HTMLElement} root - The element to fill.
 * @param {{specs: object, pick: (name: string) => void}} options - The sprites of objects.json,
 *   and what to call when a sprite is clicked.
 * @returns {{arm: Function}} `arm(name)` highlights the armed sprite; `arm(null)` clears it.
 */
export function createPalette(root, { specs, pick }) {
  const buttons = new Map();
  const names = Object.keys(specs)
    .filter((name) => !lockReason(name, specs))
    .sort();
  const kinds = [...new Set([...KIND_ORDER, ...names.map((name) => specs[name].kind).sort()])];

  for (const kind of kinds) {
    const group = names.filter((name) => specs[name].kind === kind);
    if (!group.length) continue;

    const heading = document.createElement('h3');
    heading.textContent = kind;
    const grid = document.createElement('div');
    grid.className = 'sprites';

    for (const name of group) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = name;

      const img = document.createElement('img');
      img.src = spriteUrl(name);
      img.alt = '';
      img.loading = 'lazy';

      const label = document.createElement('span');
      label.textContent = name;

      button.append(img, label);
      button.onclick = () => pick(name);
      buttons.set(name, button);
      grid.append(button);
    }

    root.append(heading, grid);
  }

  return {
    // Highlights the armed sprite's button, or none.
    arm(name) {
      for (const [key, button] of buttons) button.classList.toggle('on', key === name);
    },
  };
}
