// Guards the visible tool: mining and chopping must match the tool and material owned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { NODES } from '../../src/world/nodes.js';
import { beginGather } from '../../src/actions/gather.js';
import {
  createAnimator,
  sampleAnimation,
  advanceAnimation,
  cancelAction,
} from '../../src/animation/clips.js';

// Both tools and tiers need distinct art, while keeping normal timing, mirroring and cancellation.
test('gathering plays the owned tool tier and keeps normal action behavior', () => {
  for (const [tool, tier, clip] of [
    ['axe', 'stone', 'chop'],
    ['axe', 'iron', 'chopIron'],
    ['pickaxe', 'stone', 'mine'],
    ['pickaxe', 'iron', 'mineIron'],
  ]) {
    const game = createGame('survivor');
    const node = NODES.find((n) => n.tool === tool && n.inScenery);
    game.tools[tool] = tier === 'stone' ? { tier, uses: 5 } : { tier };
    Object.assign(game.player, { x: node.x - 40, y: node.y });
    const animator = createAnimator();
    assert.equal(beginGather(game, animator, node.id).ok, true);
    assert.equal(animator.clip, clip);
    assert.equal(sampleAnimation(clip, 0, 1).flip, true);
    assert.equal(sampleAnimation(clip, 0, 2).flip, false);
    assert.deepEqual(advanceAnimation(animator, animator.pending.duration), {
      clip,
      target: node.id,
    });
    assert.equal(advanceAnimation(animator, 1), null);
    assert.equal(beginGather(game, animator, node.id).ok, true);
    assert.equal(cancelAction(animator), true);
    assert.equal(advanceAnimation(animator, 10), null);
  }
});
