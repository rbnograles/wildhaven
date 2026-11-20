// Checks the controls list the journal shows: every row can be drawn, and the Build menu's
// number keys match the tables the game really reads its keys from.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLS } from '../../src/data/controls.js';
import { TOOLS } from '../../src/data/tools.js';
import { GEAR } from '../../src/data/gear.js';
import { BUILDINGS } from '../../src/data/buildings.js';

// Guards against a group or row with a missing piece, which would draw an empty line.
test('every group has a title and every row has keys and words', () => {
  for (const group of CONTROLS) {
    assert.ok(group.title);
    assert.ok(group.rows.length > 0, group.title);

    for (const row of group.rows) {
      assert.ok(row.keys.length > 0 && row.keys.every(Boolean), group.title);
      assert.ok(row.does, group.title);
    }
  }
});

// Guards against a new tool, gear or building being left off the list, or two sharing one key.
test('the Build menu group lists every craftable thing once, under its own key', () => {
  const menu = CONTROLS.find((group) => group.title === 'Build menu');
  const made = [...TOOLS, ...GEAR, ...BUILDINGS];

  for (const thing of made) {
    const rows = menu.rows.filter((row) => row.keys.includes(thing.key.toUpperCase()));
    assert.equal(rows.length, 1, thing.id);
  }
});
