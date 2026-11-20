// Checks the walk to a clicked tree or rock: the planned path must stay on ground the player may
// really step on, end within reach of the target, and be walkable with the game's own movement.
// A mistake here would leave the character pushing at a tree forever or walking into the sea.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER_RANGE } from '../../src/data/balance.js';
import { NODES } from '../../src/world/nodes.js';
import { createGame } from '../../src/game/state.js';
import { movePlayer, footing, stepLength } from '../../src/actions/move.js';
import { aimState } from '../../src/actions/gather.js';
import {
  planApproach,
  beginApproach,
  approachStep,
  eightWay,
  standSpot,
  beginPlacing,
} from '../../src/actions/approach.js';

/** Straight-line distance between two spots. */
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Lists the trees and rocks a little way from the scout's start, nearest first.
 *
 * @param {object} game - The game being played.
 * @returns {object[]} Map trees and rocks between 200 and 900 units from the player.
 */
function farTargets(game) {
  return NODES.filter((n) => n.inScenery)
    .map((n) => ({ n, d: apart(n, game.player) }))
    .filter(({ d }) => d > 200 && d < 900)
    .sort((a, b) => a.d - b.d)
    .map(({ n }) => n);
}

// Guards the whole feature: following the planned path with real movement steps must bring the
// player within reach of the clicked tree or rock, never getting stuck on the way.
test('a planned walk brings the player within reach of the clicked tree or rock', () => {
  const dt = 1 / 60;
  let walked = 0;

  for (const node of farTargets(createGame('scout')).slice(0, 12)) {
    const game = createGame('scout');
    game.tools = { axe: { tier: 'iron' }, pickaxe: { tier: 'iron' } };
    const walk = beginApproach(game, node);
    if (!walk) continue;

    let still = 0;
    for (let frame = 0; frame < 3000 && aimState(game, node) === 'far'; frame += 1) {
      const push = approachStep(game, walk, stepLength(game, dt));
      assert.ok(push, `${node.id}: the path ran out before the target was in reach`);
      still = movePlayer(game, push.dx, push.dy, dt) ? 0 : still + 1;
      assert.ok(still < 10, `${node.id}: stuck at ${game.player.x}, ${game.player.y}`);
    }
    assert.equal(aimState(game, node), 'ready', node.id);
    walked += 1;
  }

  assert.ok(walked >= 6, 'most nearby trees and rocks can be walked to');
});

// Guards the path itself: every spot on it must be ground the player may stand on, and the last
// one must be close enough to gather from, or the walk would end one step short.
test('every spot on a planned path is free ground and the last one is in reach', () => {
  const game = createGame('scout'),
    free = footing(game),
    node = farTargets(game).find((n) => planApproach(game, n)),
    path = planApproach(game, node);

  assert.ok(path.length > 0);
  for (const p of path) assert.ok(free(p.x, p.y), `blocked spot ${p.x}, ${p.y}`);
  assert.ok(apart(path.at(-1), node) < GATHER_RANGE);
});

// Guards the edges: nothing to plan when already beside the target, and no walking from the boat.
test('a node in reach needs no path, and there is no walk from the boat', () => {
  const game = createGame('scout'),
    node = farTargets(game)[0];

  game.aboard = true;
  assert.equal(planApproach(game, node), null);
  game.aboard = false;

  game.player.x = node.x;
  game.player.y = node.y + 40;
  assert.deepEqual(planApproach(game, node), []);
});

// Guards the working pose: every working picture faces east or west, so before picking, chopping
// or mining the player must end up beside the thing (not above or below), in reach, on free ground.
test('patches, trees and rocks are all worked on from a spot beside them', () => {
  const game = createGame('scout'),
    free = footing(game);
  let checked = 0;

  for (const node of NODES.filter((n) => !n.tool && !n.inScenery)) {
    // Stand straight below the patch, the worst place to bend sideways from.
    game.player.x = node.x;
    game.player.y = node.y + 60;
    if (!free(game.player.x, game.player.y)) continue;
    const spot = standSpot(game, node);
    if (!spot) continue;

    assert.ok(free(spot.x, spot.y), `${node.id}: blocked spot`);
    assert.ok(apart(spot, node) < GATHER_RANGE, `${node.id}: spot out of reach`);
    assert.ok(Math.abs(spot.x - node.x) > Math.abs(spot.y - node.y), `${node.id}: not beside`);

    // Once there, no further step is asked for, or the player would shuffle for ever.
    Object.assign(game.player, spot);
    assert.equal(standSpot(game, node), null, node.id);
    assert.equal(beginPlacing(game, node), null, node.id);
    checked += 1;
    if (checked >= 40) break;
  }
  assert.ok(checked >= 20, 'most patches have a spot beside them');

  // Trees and rocks get a spot too: clear of the solid base, level with its foot, and in reach.
  let solid = 0;
  for (const node of NODES.filter((n) => n.inScenery).slice(0, 300)) {
    game.player.x = node.x;
    game.player.y = node.y + 60;
    if (!free(game.player.x, game.player.y)) continue;
    const spot = standSpot(game, node);
    if (!spot) continue;

    assert.ok(free(spot.x, spot.y), `${node.id}: blocked spot`);
    assert.ok(apart(spot, node) < GATHER_RANGE, `${node.id}: spot out of reach`);
    assert.ok(Math.abs(spot.x - node.x) > Math.abs(spot.y - node.y), `${node.id}: not beside`);
    solid += 1;
  }
  assert.ok(solid >= 50, 'most trees and rocks have a spot beside them');
});

// Guards against the player overshooting a path spot and turning back and forth for ever: a spot
// within one step counts as reached.
test('a path spot within one step counts as reached', () => {
  const game = createGame('scout'),
    { x, y } = game.player,
    walk = {
      path: [
        { x: x + 5, y },
        { x: x + 100, y },
      ],
      i: 0,
    };

  assert.deepEqual(approachStep(game, walk, 8), { dx: 100, dy: 0 });
  assert.equal(walk.i, 1);

  game.player.x = x + 99;
  assert.equal(approachStep(game, walk, 8), null);
});

// Guards the walking pictures: only a movement close to a true diagonal may show the diagonal walk.
test('a movement is rounded to the nearest of eight directions', () => {
  assert.deepEqual(eightWay(10, 1), { dx: 1, dy: 0 });
  assert.deepEqual(eightWay(-1, -10), { dx: 0, dy: -1 });
  assert.deepEqual(eightWay(-7, 6), { dx: -1, dy: 1 });
  assert.deepEqual(eightWay(0, 0), { dx: 0, dy: 0 });
});
