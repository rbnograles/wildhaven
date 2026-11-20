// Tests for the item box (world/bag.js): slots that are empty until something is picked up, the
// open slots filling up, dragging a thing to another slot, the backpack opening the second row,
// and older saves gaining their slots.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import { BAG_SLOTS, BACKPACK_SLOTS, GEAR_RECIPES } from '../../src/data/balance.js';
import {
  BAG_MAX,
  addItem,
  bagSize,
  freeSlots,
  hasRoomFor,
  moveSlot,
  slotItem,
  tidyBag,
} from '../../src/world/bag.js';
import { NODES } from '../../src/world/nodes.js';
import { beginGather, finishGather } from '../../src/actions/gather.js';
import { beginMake, finishMake } from '../../src/actions/gear.js';

/** Lists what each slot of a game's item box really holds. */
const shown = (game) => Array.from({ length: BAG_MAX }, (_, i) => slotItem(game, i));

// Guards the "empty by default" rule: only what the starting kit holds takes a slot, and a
// character with nothing of a kind shows no slot for it.
test('a new game shows only the starting kit, in the first slots', () => {
  const scout = createGame('scout');
  assert.deepEqual(shown(scout), ['food', ...Array(BAG_MAX - 1).fill(null)]);

  const survivor = createGame('survivor');
  assert.deepEqual(shown(survivor).slice(0, 4), ['wood', 'stone', 'food', null]);
});

// Guards a slot coming and going with its thing: picked up, it takes the first empty slot; used
// up, the slot is empty again and the next new thing can have it.
test('a thing takes the first empty slot when picked up and frees it when it runs out', () => {
  const game = createGame('scout');
  assert.equal(addItem(game, 'herbs', 2), true);
  assert.deepEqual(shown(game).slice(0, 3), ['food', 'herbs', null]);

  game.resources.food = 0;
  assert.equal(slotItem(game, 0), null);
  tidyBag(game);
  addItem(game, 'wood');
  assert.deepEqual(shown(game).slice(0, 3), ['wood', 'herbs', null]);
});

// Guards the bag filling up: with every open slot taken a new kind is refused, but more of a
// kind already carried still goes in.
test('a full bag refuses a new kind of thing and still takes more of what it holds', () => {
  const game = createGame('scout');
  for (const item of ['wood', 'stone', 'herbs', 'iron']) assert.equal(addItem(game, item), true);
  assert.equal(freeSlots(game), 0);

  assert.equal(addItem(game, 'feather'), false);
  assert.equal(game.resources.feather, 0);
  assert.equal(addItem(game, 'wood', 5), true);
  assert.equal(game.resources.wood, 6);
  assert.equal(hasRoomFor(game, ['wood', 'stone']), true);
  assert.equal(hasRoomFor(game, ['wood', 'copper']), false);
});

// Guards gathering against a full bag: the work does not start, and nothing is taken from the
// node, so the player loses nothing by trying.
test('gathering a new kind with a full bag does not start', () => {
  const game = createGame('scout');
  for (const item of ['wood', 'stone', 'iron', 'copper']) addItem(game, item);
  const flowers = NODES.find((n) => n.sprite === 'flowers');
  Object.assign(game.player, { x: flowers.x, y: flowers.y + 40 });

  const animator = createAnimator();
  assert.equal(beginGather(game, animator, flowers.id).reason, 'full');
  assert.equal(animator.pending, null);
  assert.equal(finishGather(game, flowers.id), null);
  assert.equal(game.regrowAt[flowers.id], undefined);
});

// Guards dragging: a thing moves to an empty slot, two things swap, and a shut slot can't be
// dropped on.
test('dragging moves a thing to another open slot, or swaps two', () => {
  const game = createGame('survivor'); // wood, stone, food
  assert.equal(moveSlot(game, 0, 4), true);
  assert.deepEqual(shown(game).slice(0, 5), [null, 'stone', 'food', null, 'wood']);

  assert.equal(moveSlot(game, 1, 2), true);
  assert.deepEqual(shown(game).slice(0, 5), [null, 'food', 'stone', null, 'wood']);

  assert.equal(moveSlot(game, 1, BAG_SLOTS), false); // the second row is shut
  assert.equal(moveSlot(game, 0, 3), false); // nothing to drag
  assert.equal(moveSlot(game, 1, 1), false);
});

// Guards the backpack: it is paid for once, opens the second row for good, and can't be made twice.
test('the backpack opens the second row of slots', () => {
  const game = createGame('scout');
  assert.equal(bagSize(game), BAG_SLOTS);
  Object.assign(game.resources, GEAR_RECIPES.backpack);
  tidyBag(game);

  const animator = createAnimator();
  assert.equal(beginMake(game, animator, 'backpack').ok, true);
  assert.equal(finishMake(game, 'backpack').ok, true);
  assert.equal(game.backpack, true);
  assert.equal(bagSize(game), BACKPACK_SLOTS);
  assert.equal(game.resources.feather, 0);
  assert.equal(moveSlot(game, 0, BAG_SLOTS + 2), true);

  Object.assign(game.resources, GEAR_RECIPES.backpack);
  assert.equal(finishMake(game, 'backpack').reason, 'owned');
});

// Guards the save: the order the player dragged things into, the backpack and a packed tent all
// come back, and a broken slot list is refused.
test('the slots, the backpack and a packed tent are saved and checked', () => {
  const game = createGame('survivor');
  moveSlot(game, 0, 4);
  game.backpack = true;
  game.packedTent = true;
  tidyBag(game);

  const loaded = restoreGame(serializeGame(game));
  assert.deepEqual(loaded.slots, game.slots);
  assert.equal(loaded.backpack, true);
  assert.equal(slotItem(loaded, loaded.slots.indexOf('tent')), 'tent');

  for (const slots of [undefined, [], [...game.slots, null], game.slots.map(() => 'wood')])
    assert.equal(restoreGame(JSON.stringify({ ...game, slots })), null);
  assert.equal(restoreGame(JSON.stringify({ ...game, slots: game.slots.map(() => 'gold') })), null);
  assert.equal(restoreGame(JSON.stringify({ ...game, backpack: 'yes' })), null);
});

// Guards older saves: a version 10 save had no slots. It is upgraded, and when it carries more
// kinds than the top row holds the extra ones are still shown, in the shut row, never lost.
test('a version 10 save gains its slots, and nothing it carries goes out of sight', () => {
  const game = createGame('scout');
  Object.assign(game.resources, { wood: 3, stone: 2, food: 1, herbs: 4, iron: 1, feather: 2 });
  const { slots, backpack, packedTent, ...old } = game;
  const loaded = restoreGame(JSON.stringify({ ...old, version: 10 }));

  assert.ok(slots && backpack === false && packedTent === false);
  assert.equal(loaded.backpack, false);
  assert.deepEqual(
    shown(loaded).filter(Boolean).sort(),
    ['feather', 'food', 'herbs', 'iron', 'stone', 'wood'].sort(),
  );
  assert.equal(loaded.resources.feather, 2);
  assert.equal(hasRoomFor(loaded, ['copper']), false);
});
