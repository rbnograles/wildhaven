// Checks what the E key does. Several things share it (landing, boarding, repairing, gathering),
// so the order matters: the wrong pick could hammer a boat when the player wanted to land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WRECKS } from '../../src/data/places.js';
import { REPAIR_COST, REPAIR_SECONDS } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';
import {
  chooseInteraction,
  beginInteraction,
  finishInteraction,
} from '../../src/actions/interact.js';

/** The old boat on the lagoon shore, near the survivor's start. */
const east = WRECKS.find((w) => w.id === 'wreck-east');

// Guards the order E tries things in: land when afloat, board beside the boat, repair beside an
// old boat, gather beside a supply, and nothing when nothing is in reach.
test('E picks landing, then boarding, then repairing, then gathering', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const gatherer = createGame('scout');
  Object.assign(gatherer.player, { x: pine.x - 60, y: pine.y });
  assert.deepEqual(chooseInteraction(gatherer), { kind: 'gather', target: pine });

  const repairer = createGame('survivor');
  Object.assign(repairer.player, { x: east.x, y: east.y + 30 });
  assert.deepEqual(chooseInteraction(repairer), { kind: 'repair', target: east });

  // Once the boat is mended the old boat can't be repaired again; next to the boat, E boards it.
  repairer.boat = { from: east.id, x: east.launch.x, y: east.launch.y, dir: 2 };
  Object.assign(repairer.player, { x: east.launch.x - 120, y: east.launch.y });
  assert.equal(chooseInteraction(repairer).kind, 'board');

  Object.assign(repairer.player, { x: east.launch.x, y: east.launch.y });
  repairer.aboard = true;
  assert.equal(chooseInteraction(repairer).kind, 'land');

  assert.equal(chooseInteraction(createGame('scout')), null); // nothing within reach of the camp spawn
});

// Guards the whole boat flow through E: the repair is a timed action finished by the loop, while
// boarding and landing happen at once.
test('E repairs over time, then boards and lands at once', () => {
  const game = createGame('survivor'),
    animator = createAnimator();
  Object.assign(game.player, { x: east.x, y: east.y + 30 });
  Object.assign(game.resources, { wood: REPAIR_COST.wood, stone: REPAIR_COST.stone });

  assert.deepEqual(beginInteraction(game, animator), { ok: true, wreck: east, kind: 'repair' });
  assert.deepEqual(beginInteraction(game, animator), { ok: false, reason: 'busy' });
  const done = advanceAnimation(animator, REPAIR_SECONDS + 0.01, {});
  assert.deepEqual(finishInteraction(game, done.target), { kind: 'repair', wreck: east });

  Object.assign(game.player, { x: east.launch.x - 120, y: east.launch.y });
  assert.deepEqual(beginInteraction(game, animator), { ok: true, kind: 'board' });
  assert.equal(game.aboard, true);
  assert.deepEqual(beginInteraction(game, animator), { ok: true, kind: 'land' });
  assert.equal(game.aboard, false);
});

// Guards the messages E leads to: a short backpack says what is missing, and an empty spot says so.
test('E reports a short backpack and an empty spot', () => {
  const game = createGame('survivor');
  Object.assign(game.player, { x: east.x, y: east.y + 30 });
  game.resources.wood = 0;
  const result = beginInteraction(game, createAnimator());
  assert.equal(result.reason, 'missing');
  assert.equal(result.missing.wood, REPAIR_COST.wood);

  assert.deepEqual(beginInteraction(createGame('scout'), createAnimator()), {
    ok: false,
    reason: 'none',
  });
});

// Guards the loop's hand-out: an id is routed to the repair or the gather it belongs to, and an
// unknown id hands out nothing.
test('finishInteraction hands out a gathered supply, and nothing for an unknown id', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const game = createGame('scout');
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  assert.deepEqual(finishInteraction(game, 'pine-wood'), {
    kind: 'gather',
    node: pine,
    wear: null,
  });
  assert.equal(finishInteraction(game, 'nowhere'), null);
});

// Guards wear through E: a finished chop costs a stone axe one use, the last use still pays out,
// then the axe breaks; a bare-hand gather wears nothing.
test('chopping wears a stone axe, and the last use still pays before it breaks', () => {
  const pine = NODES.find((n) => n.id === 'pine-wood');
  const game = createGame('survivor');
  game.resources.wood = 2;
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  game.tools.axe = { tier: 'stone', uses: 1 };
  assert.deepEqual(finishInteraction(game, 'pine-wood'), {
    kind: 'gather',
    node: pine,
    wear: 'broke',
  });
  assert.equal(game.resources.wood, 2 + pine.amount);
  assert.equal(game.tools.axe, undefined);
});

// Guards the find a chopped tree may drop: only a map tree drops one, only when the dice say so
// (2 in 10), a pine gives a cone and a leafy tree a feather, and the supply pine drops nothing.
test('a chopped map tree sometimes drops a pine cone or a feather', () => {
  const game = createGame('scout'); // the scout carries an axe
  const pine = NODES.find((n) => n.inScenery && n.sprite === 'pine'),
    oak = NODES.find((n) => n.inScenery && n.sprite === 'oak');

  // A low roll drops the find; a high one doesn't.
  Object.assign(game.player, { x: pine.x - 60, y: pine.y });
  assert.equal(finishInteraction(game, pine.id, () => 0.1).drop, 'pinecone');
  assert.equal(game.resources.pinecone, 1);

  Object.assign(game.player, { x: oak.x - 60, y: oak.y });
  assert.equal('drop' in finishInteraction(game, oak.id, () => 0.9), false);
  assert.equal(game.resources.feather, 0);

  // The hand-placed pine supply is not a map tree, so it never drops one.
  const supply = NODES.find((n) => n.id === 'pine-wood');
  Object.assign(game.player, { x: supply.x - 60, y: supply.y });
  assert.equal('drop' in finishInteraction(game, 'pine-wood', () => 0), false);
});
