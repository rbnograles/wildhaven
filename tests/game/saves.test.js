// Checks saving: each character's progress goes in its own slot, an old browser tab can't wipe
// out newer progress, and a blocked or full storage never crashes the game.
// Losing a player's saved adventure is about the worst thing the game could do, so this matters.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveSession, storageKey, readActive, setActive } from '../../src/game/saves.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';

/**
 * Makes a pretend browser storage that keeps everything in memory, so tests can save and load
 * without a real browser.
 *
 * @returns {{getItem: Function, setItem: Function, removeItem: Function}} An object with the
 *   same three methods as `localStorage`.
 */
function memoryStorage() {
  const entries = new Map();
  return {
    /** Reads a saved value, or null when nothing is saved under that key (like the real one). */
    getItem: (key) => entries.get(key) ?? null,
    /** Saves a value under a key, replacing any old one. */
    setItem: (key, value) => entries.set(key, value),
    /** Forgets a key and its value. */
    removeItem: (key) => entries.delete(key),
  };
}

// Guards against an old tab (still showing old progress) saving over a newer save that another
// tab made. The old tab must notice the conflict and back off.
test('a stale tab cannot overwrite another tab’s newer character progress', () => {
  const storage = memoryStorage(),
    initial = createGame('scout');
  const raw = serializeGame(initial);
  storage.setItem(storageKey('scout'), raw);

  // Two tabs open the same save.
  const older = createSaveSession(storage, 'scout', raw),
    newer = createSaveSession(storage, 'scout', raw);

  const changed = createGame('scout');
  changed.resources.wood = 12;
  assert.deepEqual(newer.write(changed), { ok: true });
  assert.deepEqual(older.write(initial), { ok: false, reason: 'conflict' });
  assert.equal(restoreGame(storage.getItem(storageKey('scout'))).resources.wood, 12);
});

// Guards against a tab blocking its own later saves, against characters overwriting each
// other's slots, and against saving one character's game into another character's slot.
test('one session can save repeatedly and other characters remain independent', () => {
  const storage = memoryStorage(),
    scout = createGame('scout'),
    builder = createGame('builder');
  const a = createSaveSession(storage, 'scout', null),
    b = createSaveSession(storage, 'builder', null);

  assert.equal(a.write(scout).ok, true);
  scout.resources.wood = 4;
  assert.equal(a.write(scout).ok, true);
  assert.equal(b.write(builder).ok, true);

  assert.equal(restoreGame(storage.getItem(storageKey('scout'))).resources.wood, 4);
  assert.deepEqual(a.write(builder), { ok: false, reason: 'character' });
});

// Guards against the game crashing when the browser blocks storage or it is full.
// Saving should just report that it failed.
test('unavailable storage reports failure without throwing', () => {
  const storage = {
    /** Acts like a browser that refuses to let the page read storage. */
    getItem() {
      throw new Error('blocked');
    },

    /** Acts like storage that is already full. */
    setItem() {
      throw new Error('full');
    },
  };
  assert.deepEqual(createSaveSession(storage, 'scout', null).write(createGame('scout')), {
    ok: false,
    reason: 'unavailable',
  });
});

// Guards the "refresh brings you back into your game" note: it can be set and cleared, and a
// made-up character id stored there is ignored.
test('the active character survives a refresh until the player exits', () => {
  const storage = memoryStorage();
  assert.equal(readActive(storage), null);

  setActive(storage, 'builder');
  assert.equal(readActive(storage), 'builder');
  setActive(storage, null);
  assert.equal(readActive(storage), null);

  storage.setItem('wildhaven.active', 'wolf');
  assert.equal(readActive(storage), null);
});

// Guards against a crash when the tab's storage is blocked or missing entirely.
test('active character tracking tolerates missing or blocked storage', () => {
  const blocked = {
    /** Acts like a browser that refuses to let the page read storage. */
    getItem() {
      throw new Error('blocked');
    },

    /** Acts like storage that is already full. */
    setItem() {
      throw new Error('full');
    },

    /** Acts like a browser that refuses to let the page delete from storage. */
    removeItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readActive(blocked), null);
  assert.equal(readActive(null), null);
  assert.doesNotThrow(() => {
    setActive(blocked, 'scout');
    setActive(blocked, null);
    setActive(null, 'scout');
  });
});
