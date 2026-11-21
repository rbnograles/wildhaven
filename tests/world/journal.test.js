// Checks the field journal: its pages match real places, the trail clue moves on as places are
// found, and each clue's compass directions point the right way on the real map. A clue that
// points the wrong way would send a playtester off in the wrong direction and spoil the test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../src/game/state.js';
import { JOURNALS } from '../../src/data/journal.js';
import { LANDMARKS, WAYPOINTS } from '../../src/data/places.js';
import { readJournal, hasJournalPage } from '../../src/world/journal.js';

// Guards against a page for a place that doesn't exist, or a place in the region left without a page.
test('each journal has one page per place in its region, all on the trail once', () => {
  for (const [regionId, journal] of Object.entries(JOURNALS)) {
    const places = LANDMARKS.filter((l) => l.region === regionId).map((l) => l.id);
    assert.deepEqual([...journal.trail].sort(), [...places].sort(), regionId);
    assert.deepEqual(Object.keys(journal.pages).sort(), [...places].sort(), regionId);

    for (const [id, page] of Object.entries(journal.pages)) {
      assert.ok(page.text && page.keepsake && page.sprite && page.hint, id);
      // Pages stay short: two or three sentences, readable in a few seconds.
      assert.ok(page.text.length <= 160, `${id} text is ${page.text.length} characters`);
    }
  }
});

// Guards the parked state in Spring: no region has journal pages yet, so the notebook is empty and
// nothing announces a page. When Spring journal content is authored, bring back the found/trail tests.
test('the field journal is parked for Spring: no pages, no trail, nothing announced', () => {
  assert.deepEqual(Object.keys(JOURNALS), []);
  assert.equal(readJournal(createGame('scout'), 'pinefall-camp'), null);
  assert.equal(readJournal(createGame('scout'), 'jungle'), null);
  assert.equal(hasJournalPage('p-hollow'), false);
});

// The things clues measure from, by the words a hint uses for them.
const REFERENCES = {
  'Scout’s camp': LANDMARKS.find((l) => l.id === 'p-camp'),
  camp: LANDMARKS.find((l) => l.id === 'p-camp'),
  'West Trail signpost': WAYPOINTS.find((w) => w.name === 'West Trail Signpost'),
  'Pinefall signpost': WAYPOINTS.find((w) => w.name === 'Pinefall Signpost'),
  'deer clearing': LANDMARKS.find((l) => l.id === 'p-clearing'),
  'cliff on the woods’ edge': LANDMARKS.find((l) => l.id === 'p-ledge'),
};

// Compass words as directions on the map, where y grows southward.
const COMPASS = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
  'north-east': [Math.SQRT1_2, -Math.SQRT1_2],
  'north-west': [-Math.SQRT1_2, -Math.SQRT1_2],
  'south-east': [Math.SQRT1_2, Math.SQRT1_2],
  'south-west': [-Math.SQRT1_2, Math.SQRT1_2],
};

// Guards every "<direction> of the <thing>" in a clue: the place must lie within 60° of that way.
test('every clue’s compass directions match the real map', () => {
  const phrase =
    /\b(north-east|north-west|south-east|south-west|north|south|east|west) of the ([^,.]+?)(?=[,.]|$)/g;

  for (const journal of Object.values(JOURNALS)) {
    for (const [id, page] of Object.entries(journal.pages)) {
      const place = LANDMARKS.find((l) => l.id === id);
      const matches = [...page.hint.matchAll(phrase)];
      if (id !== journal.trail[0]) assert.ok(matches.length, `${id} hint has no direction`);

      for (const [, word, refName] of matches) {
        const ref = REFERENCES[refName];
        assert.ok(ref, `${id} hint names "${refName}", which the test doesn't know`);
        const dx = place.x - ref.x,
          dy = place.y - ref.y,
          [cx, cy] = COMPASS[word];
        const cosine = (dx * cx + dy * cy) / Math.hypot(dx, dy);
        assert.ok(cosine > 0.5, `${id} is not ${word} of the ${refName}`);
      }
    }
  }
});
