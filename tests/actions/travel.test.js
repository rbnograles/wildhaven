// Checks fast travel: the player may jump to a signpost they have found, and nowhere else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { travelTo } from '../../src/actions/travel.js';
import { isWalkable, isSailable } from '../../src/world/map.js';
import { nodeBases } from '../../src/world/nodes.js';
import { WAYPOINTS, WRECKS, LANDMARKS } from '../../src/data/places.js';
import { BOARD_RANGE } from '../../src/data/balance.js';
import { facing } from '../../src/actions/move.js';
import { canBoard, board, disembark } from '../../src/actions/boat.js';

// Guards the unlock rule: without it the whole world is reachable from the first second.
test('travel is refused to a signpost that has not been found, or does not exist', () => {
  const game = createGame('scout'),
    before = { ...game.player };

  assert.equal(travelTo(game, 'j-wp-temple'), null);
  assert.equal(travelTo(game, 'nowhere'), null);
  assert.deepEqual(game.player, before);
});

// Guards the arrival: the player lands on the signpost's spot, facing south, on open ground.
test('travel moves the player to a found signpost', () => {
  const game = createGame('scout');
  game.player.direction = 3;
  game.waypoints.push('j-wp-temple');

  const post = travelTo(game, 'j-wp-temple');
  assert.equal(post.name, 'Temple Path Signpost');
  assert.deepEqual(game.player, { x: post.x, y: post.y, direction: 0 });
});

// Guards against a signpost whose arrival spot is inside its own post or other scenery.
test('every signpost can be arrived at', () => {
  for (const w of WAYPOINTS) assert.ok(isWalkable(w.x, w.y, nodeBases([])), w.id);
});

// Guards signpost travel from the boat: the player arrives on foot and the boat drifts back to its
// launch spot, pointing out to sea, instead of staying wherever it floated.
test('travelling from the boat sends the boat home and puts the player on foot', () => {
  const east = WRECKS.find((w) => w.id === 'wreck-east');
  const game = createGame('survivor');
  game.boat = { from: east.id, x: east.launch.x - 500, y: east.launch.y + 300, dir: 1 };
  game.aboard = true;
  Object.assign(game.player, { x: game.boat.x, y: game.boat.y, direction: 1 });
  game.waypoints.push('l-wp-wreck');

  const post = travelTo(game, 'l-wp-wreck');
  assert.ok(post);
  assert.equal(game.aboard, false);
  assert.deepEqual(game.player, { x: post.x, y: post.y, direction: 0 });
  assert.deepEqual(game.boat, {
    from: east.id,
    x: east.launch.x,
    y: east.launch.y,
    dir: facing(east.launch.x - east.x, east.launch.y - east.y),
  });
});

// Guards the stranding bug: a boat left by an islet must come home on travel, or nobody could ever
// sail to the islets again (a second repair is refused while a boat is owned).
test('after landing on each lagoon islet and travelling home, the boat can be boarded again', () => {
  const east = WRECKS.find((w) => w.id === 'wreck-east');

  for (const id of ['l-gull-isle', 'l-turtle-isle', 'l-lantern-islet']) {
    const islet = LANDMARKS.find((l) => l.id === id),
      game = createGame('survivor');
    game.boat = { from: east.id, x: 0, y: 0, dir: 0 };

    // Row to a sailable spot beside the islet that has dry ground within LAND_RANGE, and step ashore.
    let landed = false;
    for (let r = 60; r < 700 && !landed; r += 20)
      for (let i = 0; i < 48 && !landed; i++) {
        const x = Math.round(islet.x + Math.cos((i / 48) * Math.PI * 2) * r),
          y = Math.round(islet.y + Math.sin((i / 48) * Math.PI * 2) * r);
        if (!isSailable(x, y)) continue;
        Object.assign(game.boat, { x, y });
        Object.assign(game.player, { x, y });
        game.aboard = true;
        landed = disembark(game);
      }
    assert.ok(landed, `${id}: could not land`);
    assert.ok(Math.hypot(game.boat.x - east.launch.x, game.boat.y - east.launch.y) > 1000, id);

    game.waypoints.push('l-wp-wreck');
    assert.ok(travelTo(game, 'l-wp-wreck'));
    assert.deepEqual([game.boat.x, game.boat.y], [east.launch.x, east.launch.y], id);

    // From the mainland, some dry spot within BOARD_RANGE of the boat lets the player get in.
    let boardable = false;
    for (let r = 12; r < BOARD_RANGE && !boardable; r += 12)
      for (let i = 0; i < 24 && !boardable; i++) {
        const x = east.launch.x + Math.cos((i / 24) * Math.PI * 2) * r,
          y = east.launch.y + Math.sin((i / 24) * Math.PI * 2) * r;
        if (!isWalkable(x, y, nodeBases([]))) continue;
        Object.assign(game.player, { x, y });
        boardable = canBoard(game) && board(game);
      }
    assert.ok(boardable, `${id}: boat not boardable after travel`);
  }
});
