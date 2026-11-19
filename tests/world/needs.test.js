// Checks the camp needs list: what a camp asks for, how needs are met, and the dawn swap.
// The needs are what point the player outward, so a wrong rule here quietly breaks the loop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEED_AMOUNTS, MAX_GROWN, DAY_SECONDS } from '../../src/data/balance.js';
import { RESOURCES } from '../../src/data/supplies.js';
import { LANDMARKS, WAYPOINTS } from '../../src/data/places.js';
import { REGIONS, regionOf } from '../../src/world/regions.js';
import { createGame } from '../../src/game/state.js';
import {
  outwardRegion,
  makeNeed,
  makeNeeds,
  meetNeed,
  markFinds,
  refreshNeeds,
  describeNeed,
  needProgress,
} from '../../src/world/needs.js';

/**
 * Makes a scout's game with one camp at the spawn (in Pinefall Woods), for the needs tests.
 *
 * @returns {{game: object, camp: object}} The game, and its camp (already in `game.camps`).
 */
function campGame() {
  const game = createGame('scout');
  const camp = {
    id: 'camp-1',
    name: 'Pinefall Camp',
    x: game.player.x,
    y: game.player.y,
    grown: 0,
    needs: [],
  };
  camp.needs = makeNeeds(game, camp);
  game.camps.push(camp);
  return { game, camp };
}

/** Measures the distance from a camp to a region's centre. */
const far = (camp, region) => Math.hypot(region.x - camp.x, region.y - camp.y);

// Guards the three-slot shape: resources first, a place second, and a signpost on odd days.
test('a new camp asks for resources, a place further out, and (on day 1) a new signpost', () => {
  const { camp } = campGame();
  assert.deepEqual(
    camp.needs.map((n) => n.kind),
    ['bring', 'place', 'signpost'],
  );
  assert.ok(camp.needs.every((n) => n.done === false));
});

// Guards the "point outward" rule: never the camp's own region, always the nearest region that
// still has something to find, and a different region once that one is fully explored.
test('a place need names the nearest other region with an unfound place', () => {
  const { game, camp } = campGame();
  const home = regionOf(camp.x, camp.y).id,
    region = outwardRegion(game, camp);
  assert.notEqual(region.id, home);
  for (const other of REGIONS)
    if (other.id !== home) assert.ok(far(camp, region) <= far(camp, other), other.id);

  game.landmarks.push(...LANDMARKS.filter((l) => l.region === region.id).map((l) => l.id));
  const next = outwardRegion(game, camp);
  assert.notEqual(next.id, region.id);
  assert.notEqual(next.id, home);
});

// Guards the fallbacks: with nothing left to find, every need asks for resources instead.
test('with every place and signpost found, every need asks for resources', () => {
  const { game, camp } = campGame();
  game.landmarks = LANDMARKS.map((l) => l.id);
  game.waypoints = WAYPOINTS.map((w) => w.id);
  assert.equal(outwardRegion(game, camp), null);
  for (const slot of [0, 1, 2]) assert.equal(makeNeed(game, camp, slot, 1).kind, 'bring');
});

// Guards reloads and growth: the same camp, slot and day always ask for the same thing, the amount
// rises as the camp grows, and slot 2 asks for resources on even days.
test('resource needs are steady for the same camp, slot and day, and grow with the camp', () => {
  const { game, camp } = campGame();
  const need = makeNeed(game, camp, 0, 4);
  assert.deepEqual(makeNeed(game, camp, 0, 4), need);
  assert.ok(RESOURCES.includes(need.resource));
  assert.equal(need.amount, NEED_AMOUNTS[need.resource]);

  camp.grown = 5;
  assert.equal(makeNeed(game, camp, 0, 4).amount, NEED_AMOUNTS[need.resource] + 2);
  assert.equal(makeNeed(game, camp, 2, 2).kind, 'bring');
});

// Guards the reward: each met need grows the fire one step, and growth stops at the limit.
test('meeting a need marks it done and grows the camp up to the limit', () => {
  const { camp } = campGame();
  meetNeed(camp, camp.needs[0]);
  assert.equal(camp.needs[0].done, true);
  assert.equal(camp.grown, 1);

  camp.grown = MAX_GROWN;
  meetNeed(camp, camp.needs[1]);
  assert.equal(camp.grown, MAX_GROWN);
});

// Guards exploration needs: the right find completes them, the wrong one doesn't.
test('finding a place in the named region, or any signpost, meets those needs', () => {
  const { game, camp } = campGame();
  const place = camp.needs[1];
  const elsewhere = LANDMARKS.find((l) => l.region !== place.region);
  assert.deepEqual(markFinds(game, [{ kind: 'landmark', id: elsewhere.id }]), []);

  const there = LANDMARKS.find((l) => l.region === place.region);
  const met = markFinds(game, [
    { kind: 'landmark', id: there.id },
    { kind: 'waypoint', id: WAYPOINTS[0].id },
  ]);
  assert.equal(met.length, 2);
  assert.ok(place.done && camp.needs[2].done);
  assert.equal(camp.needs[0].done, false);
  assert.equal(camp.grown, 2);
});

// Guards the dawn update: only met needs are replaced; open ones stay exactly as they were.
test('at dawn, met needs are swapped for new ones and open needs stay', () => {
  const { game, camp } = campGame();
  const [, place, signpost] = camp.needs;
  meetNeed(camp, camp.needs[0]);
  game.time = DAY_SECONDS + 1; // day 2

  assert.deepEqual(refreshNeeds(game), [camp]);
  assert.equal(camp.needs[0].done, false);
  assert.equal(camp.needs[1], place);
  assert.equal(camp.needs[2], signpost);
  assert.deepEqual(refreshNeeds(game), []); // nothing met, nothing changes
});

// Guards the words shown to the player and the progress counts beside them.
test('needs are described in plain words with a progress count', () => {
  const { game } = campGame();
  const bring = { kind: 'bring', resource: 'stone', amount: 3, done: false };
  assert.equal(describeNeed(bring), 'Bring 3 stone');
  assert.equal(
    describeNeed({ kind: 'place', region: 'frostpeak', done: false }),
    'Find a place in Frostpeak',
  );
  assert.equal(describeNeed({ kind: 'signpost', done: false }), 'Find a new signpost');

  game.resources.stone = 1;
  assert.deepEqual(needProgress(game, bring), { have: 1, want: 3 });
  game.resources.stone = 9;
  assert.deepEqual(needProgress(game, bring), { have: 3, want: 3 });
  assert.deepEqual(needProgress(game, { kind: 'signpost', done: false }), { have: 0, want: 1 });
  assert.deepEqual(needProgress(game, { kind: 'signpost', done: true }), { have: 1, want: 1 });
});
