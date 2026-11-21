// Checks the villagers of Hollowstead village: that all three live in the village on ground the
// player can reach, that they are solid and look at a player who comes close, and that each one's
// job (walk to work, work, carry, set down, rest) runs round on paths that avoid what is solid,
// and that they change jobs when the supply they work on has been gathered.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NPC_NOTICE, NPC_STOP } from '../../src/data/balance.js';
import { CHARACTERS } from '../../src/data/characters.js';
import { NPCS } from '../../src/data/npcs.js';
import { LANDMARKS, SPAWNS } from '../../src/data/places.js';
import { isWalkable } from '../../src/world/map.js';
import { NODES, nodeBases, solidBases } from '../../src/world/nodes.js';
import { regionAt } from '../../src/world/regions.js';
import {
  VILLAGERS,
  npcBases,
  npcFacing,
  resetVillagers,
  villagerPose,
} from '../../src/world/npcs.js';
import {
  tickVillagers,
  planErrand,
  pickJob,
  villagerFooting,
} from '../../src/actions/villagers.js';
import { createGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

/**
 * Lists every spot a villager's jobs name: home, and each job's work spot and drop spot.
 *
 * @param {object} npc - The villager's entry in `NPCS`.
 * @returns {{x: number, y: number}[]} The spots.
 */
const spotsOf = (npc) => [npc, ...npc.jobs.flatMap((job) => [job.work, job.drop])];

/**
 * Runs the villagers for a while, in frames of a twentieth of a second.
 *
 * @param {object} game - The game being played.
 * @param {number} seconds - How long to run for.
 * @param {Function} [until] - Stop early once this returns true.
 */
function run(game, seconds, until = () => false) {
  for (let i = 0; i < seconds * 20 && !until(); i++) tickVillagers(game, 0.05, () => 0);
}

// Guards against a villager being moved out of the village, or the list growing or shrinking by accident.
test('all three villagers live and work in Hollowstead village', () => {
  const square = LANDMARKS.find((place) => place.id === 'h-square');

  assert.equal(NPCS.length, 3);
  assert.equal(new Set(NPCS.map((npc) => npc.id)).size, 3);
  assert.deepEqual(NPCS.map((npc) => npc.row).sort(), [0, 1, 2]);
  for (const npc of NPCS)
    for (const spot of spotsOf(npc)) {
      assert.equal(regionAt(spot), 'Hollowstead Meadows', npc.id);
      assert.ok(Math.hypot(spot.x - square.x, spot.y - square.y) < 600, `${npc.id} in the village`);
    }
});

// Guards against a villager standing in a house, in water, on a supply, or on top of a start spot.
test('each home, work and drop spot is clear ground, away from start spots', () => {
  const supplies = nodeBases([]);

  for (const npc of NPCS) {
    for (const spot of spotsOf(npc))
      for (let dx = -20; dx <= 20; dx += 10)
        for (let dy = -20; dy <= 20; dy += 10)
          assert.ok(isWalkable(spot.x + dx, spot.y + dy, supplies), `${npc.id} at ${dx}, ${dy}`);

    for (const node of NODES)
      assert.ok(Math.hypot(node.x - npc.x, node.y - npc.y) > 60, `${npc.id} near ${node.id}`);
    for (const spawn of Object.values(SPAWNS))
      assert.ok(Math.hypot(spawn.x - npc.x, spawn.y - npc.y) > 120, `${npc.id} near a start spot`);
  }
});

// Guards against a job whose work only faces a way the pictures don't have, or an unknown kind of work.
test('each job is a kind of work the pictures have, facing sideways', () => {
  for (const { id, jobs } of NPCS) {
    for (const job of jobs) {
      assert.ok(['chop', 'mine', 'pickup'].includes(job.work.clip), id);
      assert.ok([1, 2].includes(job.work.facing) && [1, 2].includes(job.drop.facing), id);
      if (job.needs)
        assert.ok(
          NODES.some((node) => node.id === job.needs),
          `${id}: ${job.needs}`,
        );
    }
    // The last job is the one to fall back on, so it must not wait on anything.
    assert.equal(jobs.at(-1).needs, undefined, `${id} always has something to do`);
  }
  assert.equal(
    new Set(NPCS.map((npc) => npc.jobs[0].work.clip)).size,
    3,
    'each has their own work',
  );
});

// Guards the switch: a villager who keeps swinging at a boulder that is no longer there, or who
// never goes back to it once it has grown back.
test('a villager takes up another job while the thing they work on is gone', () => {
  const game = createGame('scout');
  resetVillagers();
  const bram = VILLAGERS[1],
    [mining, hauling] = bram.npc.jobs;
  assert.equal(pickJob(game, bram.npc), mining);

  // He is at the boulder, swinging, when the player gathers it.
  run(game, 240, () => bram.phase === 'work');
  assert.equal(villagerPose(bram, game.player).sheet, 'mine');
  game.regrowAt[mining.needs] = game.time + 720;
  run(game, 0.1);
  assert.equal(bram.phase, 'rest', 'stopped swinging');
  assert.equal(bram.carrying, false, 'got nothing from it');
  assert.equal(villagerPose(bram, game.player).sheet, 'idle');

  // He takes up the other job, and does it while the boulder is gone.
  assert.equal(pickJob(game, bram.npc), hauling);
  run(game, 240, () => bram.phase === 'work');
  assert.equal(bram.job, hauling);
  assert.deepEqual([bram.x, bram.y], [hauling.work.x, hauling.work.y]);
  run(game, 240, () => bram.phase === 'deposit');
  assert.deepEqual([bram.x, bram.y], [hauling.drop.x, hauling.drop.y]);

  // The boulder grows back: after his next rest he goes back to mining.
  game.time += 721;
  run(game, 240, () => bram.phase === 'work');
  assert.equal(bram.job, mining);
  assert.equal(villagerPose(bram, game.player).sheet, 'mine');
  resetVillagers();
});

// Guards against a villager dropping a load on the spot when their supply is taken mid-delivery.
test('a villager already carrying a load still delivers it when the supply is taken', () => {
  const game = createGame('scout');
  resetVillagers();
  const maren = VILLAGERS[0],
    [chopping] = maren.npc.jobs;

  run(game, 240, () => maren.carrying && maren.phase === 'walk');
  game.regrowAt[chopping.needs] = game.time + 720;
  run(game, 240, () => maren.phase === 'deposit');
  assert.deepEqual([maren.x, maren.y], [chopping.drop.x, chopping.drop.y]);
  resetVillagers();
});

// Guards against the villagers depending on who is played: every character must meet the same three.
test('the villagers are the same whichever character is played', () => {
  resetVillagers();
  const bases = JSON.stringify(npcBases()).slice(1, -1);

  for (const character of CHARACTERS)
    assert.ok(JSON.stringify(solidBases(createGame(character.id))).includes(bases), character.id);
});

// Guards against a villager staring the wrong way, or turning for a player who is far away.
test('a resting villager looks at a player who is close, and their usual way otherwise', () => {
  const npc = { x: 1000, y: 1000, facing: 2, phase: 'rest' };

  assert.equal(npcFacing(npc, { x: 1000, y: 1100 }), 0);
  assert.equal(npcFacing(npc, { x: 900, y: 1010 }), 1);
  assert.equal(npcFacing(npc, { x: 1100, y: 990 }), 2);
  assert.equal(npcFacing(npc, { x: 1000, y: 900 }), 3);
  assert.equal(npcFacing({ ...npc, facing: 3 }, { x: 1000, y: 1000 + NPC_NOTICE + 1 }), 3);
  assert.equal(npcFacing({ ...npc, facing: 1 }, { x: 1000, y: 1000 }), 1);

  // Busy villagers keep facing their work.
  assert.equal(npcFacing({ ...npc, phase: 'work' }, { x: 1000, y: 1100 }), 2);
  assert.equal(npcFacing({ ...npc, carrying: true }, { x: 1000, y: 1100 }), 2);
});

// Guards against the player walking straight through a villager.
test('the player cannot walk through a villager', () => {
  resetVillagers();
  const game = createGame('builder');
  const npc = NPCS[0];
  game.player.x = npc.x;
  game.player.y = npc.y + 60;

  for (let i = 0; i < 200; i++) movePlayer(game, 0, -1, 0.05);

  assert.ok(game.player.y > npc.y, 'stopped south of the villager');
});

// Guards against a job no path leads to, or a path that ends somewhere other than the job's spot.
test('every leg of every job has a path that ends on its spot', () => {
  const game = createGame('scout');

  // A villager may start any of their jobs from home or from any of their drop spots.
  for (const npc of NPCS)
    for (const job of npc.jobs) {
      const legs = [
        [npc, 'work'],
        [job.work, 'drop'],
        ...npc.jobs.map((other) => [other.drop, 'work']),
      ];
      for (const [from, heading] of legs) {
        const path = planErrand(game, { npc, job, x: from.x, y: from.y, heading });
        assert.ok(path, `${npc.id} can walk to ${heading}`);
        assert.deepEqual(path.at(-1), { x: job[heading].x, y: job[heading].y });
      }
    }
});

// Guards the whole round: a villager who never sets off, never works, or never puts the load
// down, or who steps onto something solid on the way. Each villager does two rounds, because the
// second one starts from the drop spot instead of from home.
test('a villager walks to work, works, carries the load to the drop spot and rests', () => {
  const game = createGame('scout'); // far away, so nobody stops for the player
  const free = villagerFooting(game);
  resetVillagers();

  /** Runs the villagers until `done`, checking nobody ever stands on something solid. */
  const walk = (seconds, done) => {
    for (let i = 0; i < seconds * 20 && !done(); i++) {
      tickVillagers(game, 0.05, () => 0);
      for (const v of VILLAGERS) assert.ok(free(v.x, v.y), `${v.npc.id} on free ground`);
    }
  };

  for (const villager of [...VILLAGERS, ...VILLAGERS]) {
    const { work, drop } = villager.job;

    walk(240, () => villager.phase === 'work');
    assert.equal(villager.phase, 'work', `${villager.npc.id} reached work`);
    assert.deepEqual([villager.x, villager.y, villager.facing], [work.x, work.y, work.facing]);
    assert.equal(villager.carrying, false);
    const sheet = work.clip === 'pickup' ? 'deposit' : work.clip;
    assert.equal(villagerPose(villager, game.player).sheet, sheet);

    run(game, 30, () => villager.phase === 'walk');
    assert.ok(villager.carrying, `${villager.npc.id} carries the load`);
    run(game, 1);
    assert.equal(villagerPose(villager, game.player).sheet, 'carry');
    assert.ok([1, 2].includes(villager.facing), 'a loaded villager faces sideways');

    walk(240, () => villager.phase === 'deposit');
    assert.deepEqual([villager.x, villager.y, villager.facing], [drop.x, drop.y, drop.facing]);
    assert.equal(villagerPose(villager, game.player).sheet, 'deposit');

    run(game, 10, () => villager.phase === 'rest');
    assert.equal(villager.phase, 'rest');
    assert.equal(villager.carrying, false);
    assert.equal(villagerPose(villager, game.player).sheet, 'idle');
  }

  resetVillagers();
  assert.deepEqual(
    VILLAGERS.map((v) => [v.x, v.y, v.phase]),
    NPCS.map((npc) => [npc.x, npc.y, 'rest']),
  );
});

// Guards against a villager walking into the player, or away from a player trying to meet them.
test('a walking villager stands still while the player is close', () => {
  const game = createGame('scout');
  resetVillagers();
  const villager = VILLAGERS[1];
  run(game, 30, () => villager.moving);
  assert.ok(villager.moving, 'set off');

  // The player steps up to them: they stop where they are and wait.
  game.player.x = villager.x + NPC_STOP / 2;
  game.player.y = villager.y;
  const spot = [villager.x, villager.y];
  run(game, 30);
  assert.equal(villager.moving, false);
  assert.deepEqual([villager.x, villager.y], spot);
  assert.equal(villagerPose(villager, game.player).sheet, 'idle');

  // The player leaves: they walk on.
  game.player.x += 2000;
  run(game, 2);
  assert.ok(villager.moving, 'walked on');
  resetVillagers();
});

// Guards against a villager walking through a campfire built across their way.
test('a villager finds a way round a campfire built on their path', () => {
  const game = createGame('scout');
  resetVillagers();
  const villager = VILLAGERS[0];
  run(game, 30, () => villager.moving);

  // Light a fire a few steps ahead of them, right on the path.
  const next = villager.path[villager.i],
    length = Math.hypot(next.x - villager.x, next.y - villager.y),
    fire = {
      x: Math.round(villager.x + ((next.x - villager.x) * 100) / length),
      y: Math.round(villager.y + ((next.y - villager.y) * 100) / length) + 20,
    };
  game.camps.push({ id: 'camp-1', name: 'Test Camp', ...fire, grown: 0, needs: [] });

  const free = villagerFooting(game);
  for (let i = 0; i < 120 * 20 && villager.phase !== 'work'; i++) {
    tickVillagers(game, 0.05, () => 0);
    assert.ok(free(villager.x, villager.y), 'never inside the fire');
  }
  assert.equal(villager.phase, 'work', 'still got to work');
  resetVillagers();
});

// Guards against a villager's solid base staying behind at home while they walk.
test('a villager is solid where they stand now, not where they started', () => {
  const game = createGame('scout');
  resetVillagers();
  const villager = VILLAGERS[2];
  run(game, 10);

  const [left, , right, bottom] = npcBases()[2];
  assert.equal(bottom, villager.y);
  assert.ok(left < villager.x && right > villager.x);
  assert.notDeepEqual([villager.x, villager.y], [villager.npc.x, villager.npc.y]);
  resetVillagers();
});

// Guards the villagers' diagonal pictures: an empty-handed villager heading diagonally shows the
// north-east or south-east sheet (mirrored for west) with a picture that sheet really has, and a
// loaded one keeps the carrying pictures, which only face sideways.
test('a villager walking diagonally shows the diagonal pictures unless carrying', () => {
  resetVillagers();
  const villager = VILLAGERS[0],
    player = { x: villager.x + 5000, y: villager.y };

  for (const [slant, sheet, flip] of [
    ['ne', 'runNE', false],
    ['nw', 'runNE', true],
    ['se', 'runSE', false],
    ['sw', 'runSE', true],
  ])
    for (let clock = 0; clock < 2; clock += 0.1) {
      Object.assign(villager, { phase: 'walk', moving: true, carrying: false, slant, clock });
      const pose = villagerPose(villager, player);
      assert.equal(pose.sheet, sheet);
      assert.equal(pose.flip, flip);
      assert.ok(pose.column >= 0 && pose.column < 6);
    }

  Object.assign(villager, { carrying: true, slant: 'ne' });
  assert.equal(villagerPose(villager, player).sheet, 'carry');
  Object.assign(villager, { carrying: false, slant: null, facing: 3 });
  assert.equal(villagerPose(villager, player).sheet, 'walkNorth');
  resetVillagers();
});
