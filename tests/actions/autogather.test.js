// Checks that automatic gathering chooses only supplies the player can collect.
// Excluded targets let the caller skip paths that cannot be walked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { NODES } from '../../src/world/nodes.js';
import { nextAutoNode } from '../../src/actions/gather.js';

// A nearer locked tree must not hide a patch that can be picked by hand.
test('auto picker chooses nearest available node with an owned tool', () => {
  const state = createGame('survivor');
  const patch = NODES.find((n) => !n.tool);
  state.player.x = patch.x;
  state.player.y = patch.y;
  assert.equal(nextAutoNode(state).id, patch.id);
  state.regrowAt[patch.id] = state.time + 100;
  const next = nextAutoNode(state);
  assert.notEqual(next?.id, patch.id);
  assert.ok(!next || !next.tool);
});

// Range limits and path exclusions must let the search terminate.
test('auto picker respects range and excluded nodes and returns null when empty', () => {
  const state = createGame('survivor');
  const patch = NODES.find((n) => !n.tool);
  state.player.x = patch.x;
  state.player.y = patch.y;
  assert.equal(nextAutoNode(state, 1).id, patch.id);
  const excluded = new Set(NODES.map((n) => n.id));
  assert.equal(nextAutoNode(state, 2000, excluded), null);
  excluded.delete(patch.id);
  state.player.x = patch.x + 2001;
  assert.equal(nextAutoNode(state, undefined, excluded), null);
  state.player.x = patch.x + 1999;
  assert.equal(nextAutoNode(state, undefined, excluded)?.id, patch.id);
  state.player.x = -10000;
  state.player.y = -10000;
  assert.equal(nextAutoNode(state), null);
});

// Owned axes unlock trees, but a broken or missing tool does not.
test('auto picker skips locked nodes and admits them with the right tool', () => {
  const state = createGame('survivor');
  const tree = NODES.find((n) => n.tool === 'axe');
  state.player.x = tree.x;
  state.player.y = tree.y;
  assert.notEqual(nextAutoNode(state, 1)?.id, tree.id);
  state.tools.axe = { tier: 'stone', uses: 5 };
  assert.equal(nextAutoNode(state, 1).id, tree.id);
});
