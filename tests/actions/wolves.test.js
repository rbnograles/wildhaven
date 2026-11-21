// Tests for the wolves (world/wolves.js, actions/wolves.js): which caves are dens, the day growl and
// attack, the night chase, that villages and fires are safe, the repel shove, and fighting one off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import { SPAWNS } from '../../src/data/places.js';
import { VILLAGES } from '../../src/data/villages.js';
import {
  DEN_FROM_SPAWN,
  DENS_PER_REGION,
  PACK_SIZE,
  WOLF_WARN,
  WOLF_ATTACK,
  WOLF_BITE,
  REPEL_REACH,
  PHASES,
  HUNT_REACH,
} from '../../src/data/balance.js';
import { DENS, WOLVES, resetWolves, wolfAlive, isSafe } from '../../src/world/wolves.js';
import { OBSTACLES, isWalkable } from '../../src/world/map.js';
import { tickWolves, repel, resetRepel, nextDusk } from '../../src/actions/wolves.js';
import { beginHunt, finishHunt, huntable } from '../../src/actions/animals.js';

/** A game at a set time of day with the player a set distance east of the first den's first wolf. */
function nearWolf(distance, time) {
  resetWolves();
  resetRepel();
  const game = createGame('scout');
  const wolf = WOLVES[0];
  // Every other wolf is sent far away, so only this one is near the player.
  for (const w of WOLVES.slice(1)) Object.assign(w, { phase: 'gone', respawnAt: Infinity });
  game.time = time;
  game.player.x = wolf.x + distance;
  game.player.y = wolf.y;
  return { game, wolf };
}

const DAY = 100,
  NIGHT = PHASES.night + 30;

// Guards the dens: a few per region at most, never near a start spot, each with a full pack.
test('dens are caves away from the starts, at most two a region, with a pack each', () => {
  assert.ok(DENS.length > 0);
  const perRegion = {};
  for (const den of DENS) {
    perRegion[den.region] = (perRegion[den.region] ?? 0) + 1;
    for (const s of Object.values(SPAWNS))
      assert.ok(Math.hypot(s.x - den.x, s.y - den.y) >= DEN_FROM_SPAWN, den.id);
  }
  assert.ok(Object.values(perRegion).every((n) => n <= DENS_PER_REGION));
  assert.equal(WOLVES.length, DENS.length * PACK_SIZE);
});

// Guards the day rule: a growl first when the player comes close, a bite only when they keep coming.
test('by day a wolf growls first, then attacks a player who keeps coming', () => {
  const { game, wolf } = nearWolf((WOLF_WARN + WOLF_ATTACK) / 2, DAY);
  if (isSafe(game, game.player.x, game.player.y)) return; // a den beside a village: nothing to test
  const events = tickWolves(game, 0.05, { random: () => 0.5 });
  assert.deepEqual(
    events.map((e) => e.kind),
    ['snarl'],
  );
  assert.equal(game.meters.health, 100);
  game.player.x = wolf.x + 40;
  const bite = tickWolves(game, 0.05, { random: () => 0.5 });
  assert.ok(bite.some((e) => e.kind === 'bite'));
  assert.equal(game.meters.health, 100 - WOLF_BITE);
});

// Guards against a sudden kill: a whole pack round a player who stands still bites one at a time,
// so ten seconds cost at most five bites and the player is still well on their feet.
test('a whole pack never kills quickly: one bite at a time, shared by the pack', () => {
  const { game, wolf } = nearWolf(30, NIGHT);
  if (isSafe(game, game.player.x, game.player.y)) return;
  for (const w of WOLVES.slice(1, PACK_SIZE))
    Object.assign(w, { phase: 'idle', x: game.player.x - 30, y: wolf.y, respawnAt: 0 });
  for (let i = 0; i < 200; i++) tickWolves(game, 0.05, { random: () => 0.5 });
  assert.ok(game.meters.health >= 100 - 5 * WOLF_BITE, `health ${game.meters.health}`);
  assert.ok(game.meters.health < 100);
});

// Guards the night chase: a wolf runs at a player it sees, and nobody is bitten inside a village.
test('at night a wolf chases the player, but never into a village', () => {
  const { game, wolf } = nearWolf(400, NIGHT);
  if (isSafe(game, game.player.x, game.player.y)) return;
  const before = Math.hypot(game.player.x - wolf.x, game.player.y - wolf.y);
  for (let i = 0; i < 10; i++) tickWolves(game, 0.05, { random: () => 0.5 });
  assert.equal(wolf.phase, 'run');
  assert.ok(Math.hypot(game.player.x - wolf.x, game.player.y - wolf.y) < before);

  const village = VILLAGES[0];
  game.player.x = village.x;
  game.player.y = village.y;
  wolf.x = village.x + village.radius + 40;
  wolf.y = village.y;
  for (let i = 0; i < 40; i++) tickWolves(game, 0.05, { random: () => 0.5 });
  assert.ok(Math.hypot(wolf.x - village.x, wolf.y - village.y) > village.radius - 1);
  assert.equal(game.meters.health, 100);
});

// Guards the chase round trees: a wolf with a wide tree between it and the player runs round it
// instead of standing stuck behind it.
test('a chasing wolf runs round a tree in its way', () => {
  const { game, wolf } = nearWolf(400, NIGHT);
  const box = OBSTACLES.find(([l, t, r, b]) => {
    const x = (l + r) / 2;
    return (
      r - l >= 40 &&
      [t - 60, b + 60].every((y) => isWalkable(x, y) && !isSafe(game, x, y)) &&
      isWalkable(l - 40, (t + b) / 2) &&
      isWalkable(r + 40, (t + b) / 2)
    );
  });
  const [l, t, r, b] = box,
    x = (l + r) / 2;
  Object.assign(wolf, { x, y: t - 30, phase: 'idle' });
  game.player.x = x;
  game.player.y = b + 60;
  for (let i = 0; i < 120; i++) tickWolves(game, 0.05, { random: () => 0.5 });
  assert.ok(Math.hypot(game.player.x - wolf.x, game.player.y - wolf.y) <= 70);
});

// Guards the repel shove: close wolves are pushed back and stunned, and it can't be spammed.
test('repel pushes close wolves back and stuns them, once every few seconds', () => {
  const { game, wolf } = nearWolf(REPEL_REACH - 60, NIGHT);
  const before = Math.hypot(game.player.x - wolf.x, game.player.y - wolf.y);
  const result = repel(game, createAnimator());
  assert.equal(result.ok, true);
  assert.equal(result.pushed, 1);
  assert.ok(wolf.stunFor > 0);
  assert.ok(Math.hypot(game.player.x - wolf.x, game.player.y - wolf.y) >= before);
  assert.equal(repel(game, createAnimator()).reason, 'wait');
});

// Guards fighting back: a wolf in reach can be fought with an axe; it lies down and its pack is
// whole again at the next dusk.
test('a wolf fought with an axe lies down and is back at dusk', () => {
  const { game, wolf } = nearWolf(HUNT_REACH - 30, DAY);
  game.tools = { axe: { tier: 'iron' } };
  assert.equal(huntable(game), wolf);
  const animator = createAnimator();
  assert.equal(beginHunt(game, animator, wolf).ok, true);
  // Hunting is damage-based: leave the wolf one hit from falling.
  wolf.hp = 1;
  const done = finishHunt(game, animator.pending.target);
  assert.equal(done.animal, 'wolf');
  assert.equal(done.food, 0);
  // A wolf hunt yields a wolf pelt.
  assert.equal(done.pelt, 1);
  assert.equal(game.resources.wolfpelt, 1);
  assert.equal(wolfAlive(wolf), false);
  assert.equal(wolf.respawnAt, nextDusk(game.time));
});
