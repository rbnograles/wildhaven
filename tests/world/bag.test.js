// Tests for the item box (world/bag.js): slots that are empty until something is picked up, piles
// of up to fifty with the excess taking another slot, the bag filling up, dragging a pile to
// another slot, the backpack's ten more slots, and older saves gaining their piles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { createAnimator } from '../../src/animation/clips.js';
import { BAG_SLOTS, BACKPACK_SLOTS, STACK_SIZE, GEAR_RECIPES } from '../../src/data/balance.js';
import {
  BAG_MAX,
  addItem,
  bagSize,
  hasRoomFor,
  roomFor,
  moveSlot,
  viewSlots,
  tidyBag,
} from '../../src/world/bag.js';
import { NODES } from '../../src/world/nodes.js';
import { beginGather, finishGather } from '../../src/actions/gather.js';
import { beginMake, finishMake } from '../../src/actions/gear.js';

/** Writes each slot of a game's item box as "wood×50", or null for an empty one. */
const shown = (game) => viewSlots(game).map((pile) => (pile ? `${pile.item}×${pile.n}` : null));

/** Fills every open slot of a game with full piles of wood. */
function fillWithWood(game) {
  game.resources = { ...game.resources, food: 0, stone: 0, wood: bagSize(game) * STACK_SIZE };
  tidyBag(game);
}

// Guards the sizes the design asks for: ten slots, ten more with the backpack, fifty to a slot.
test('the bag has ten slots, twenty with the backpack, and fifty pieces to a slot', () => {
  assert.deepEqual([BAG_SLOTS, BACKPACK_SLOTS, STACK_SIZE, BAG_MAX], [10, 20, 50, 20]);
});

// Guards the "empty by default" rule: only what the starting kit holds takes a slot.
test('a new game shows only the starting kit, in the first slots', () => {
  const scout = createGame('scout');
  assert.deepEqual(shown(scout), ['food×3', ...Array(BAG_MAX - 1).fill(null)]);

  const survivor = createGame('survivor');
  assert.deepEqual(shown(survivor).slice(0, 4), ['wood×4', 'stone×2', 'food×6', null]);
});

// Guards the pile limit: the fifty-first piece starts a new pile in the next empty slot, and
// spending takes from the last pile first, freeing its slot when it runs out.
test('a pile holds fifty, and the excess takes another slot', () => {
  const game = createGame('scout');
  assert.equal(addItem(game, 'wood', 120), true);
  assert.deepEqual(shown(game).slice(0, 5), ['food×3', 'wood×50', 'wood×50', 'wood×20', null]);

  assert.equal(addItem(game, 'wood', 30), true);
  assert.deepEqual(shown(game).slice(0, 5), ['food×3', 'wood×50', 'wood×50', 'wood×50', null]);

  game.resources.wood -= 60;
  assert.deepEqual(shown(game).slice(0, 5), ['food×3', 'wood×50', 'wood×40', null, null]);
});

// Guards a slot coming and going with its thing: used up, the slot is empty again and the next
// new thing can have it.
test('a slot empties when its pile runs out', () => {
  const game = createGame('scout');
  addItem(game, 'herbs', 2);
  game.resources.food = 0;
  tidyBag(game);
  addItem(game, 'stone');
  assert.deepEqual(shown(game).slice(0, 3), ['stone×1', 'herbs×2', null]);
});

// Guards the bag filling up: with every slot a full pile nothing more goes in, a part-full pile
// takes only what it has space for, and the whole amount must fit.
test('a full bag refuses more, and a thing goes in only if all of it fits', () => {
  const game = createGame('scout');
  fillWithWood(game);
  assert.equal(roomFor(game, 'wood'), 0);
  assert.equal(addItem(game, 'wood'), false);
  assert.equal(addItem(game, 'feather'), false);

  game.resources.wood -= 5;
  assert.equal(roomFor(game, 'wood'), 5);
  assert.equal(roomFor(game, 'feather'), 0);
  assert.equal(addItem(game, 'wood', 6), false);
  assert.equal(addItem(game, 'wood', 5), true);

  // Two kinds at once each need their own space.
  game.resources.wood -= STACK_SIZE;
  assert.equal(hasRoomFor(game, { feather: 1 }), true);
  assert.equal(hasRoomFor(game, { feather: 1, antler: 1 }), false);
  assert.equal(hasRoomFor(game, { wood: STACK_SIZE }), true);
});

// Guards gathering against a full bag: the work does not start, and nothing is taken from the
// node, so the player loses nothing by trying.
test('gathering with a full bag does not start', () => {
  const game = createGame('scout');
  fillWithWood(game);
  const flowers = NODES.find((n) => n.sprite === 'flowers');
  Object.assign(game.player, { x: flowers.x, y: flowers.y + 40 });

  const animator = createAnimator();
  assert.equal(beginGather(game, animator, flowers.id).reason, 'full');
  assert.equal(animator.pending, null);
  assert.equal(finishGather(game, flowers.id), null);
  assert.equal(game.regrowAt[flowers.id], undefined);
});

// Guards dragging: a pile moves to an empty slot, two kinds swap, two piles of one kind join up
// to fifty, and a slot that is not open can't be dropped on.
test('dragging moves a pile, swaps two kinds, or joins two piles of one kind', () => {
  const game = createGame('survivor'); // wood×4, stone×2, food×6
  assert.equal(moveSlot(game, 0, 4), true);
  assert.deepEqual(shown(game).slice(0, 5), [null, 'stone×2', 'food×6', null, 'wood×4']);

  assert.equal(moveSlot(game, 1, 2), true);
  assert.deepEqual(shown(game).slice(0, 5), [null, 'food×6', 'stone×2', null, 'wood×4']);

  addItem(game, 'wood', 76); // 80 wood: the pile of 4 fills to 50, and 30 start a new pile
  assert.deepEqual(shown(game).slice(0, 5), ['wood×30', 'food×6', 'stone×2', null, 'wood×50']);
  game.resources.wood -= 20; // spent from the last pile
  assert.deepEqual(shown(game).slice(0, 5), ['wood×30', 'food×6', 'stone×2', null, 'wood×30']);
  assert.equal(moveSlot(game, 0, 4), true);
  assert.deepEqual(shown(game).slice(0, 5), ['wood×10', 'food×6', 'stone×2', null, 'wood×50']);
  assert.equal(game.resources.wood, 60);

  assert.equal(moveSlot(game, 1, BAG_SLOTS), false); // the backpack's slots are not open
  assert.equal(moveSlot(game, 3, 5), false); // nothing to drag
  assert.equal(moveSlot(game, 1, 1), false);
});

// Guards the backpack: it is made of leather and antler only (no wood, no feathers), is paid for once, adds ten slots for good, and can't be made twice.
test('the backpack adds ten more slots', () => {
  const game = createGame('scout');
  assert.equal(bagSize(game), BAG_SLOTS);
  Object.assign(game.resources, GEAR_RECIPES.backpack);
  tidyBag(game);

  const animator = createAnimator();
  assert.equal(beginMake(game, animator, 'backpack').ok, true);
  assert.equal(finishMake(game, 'backpack').ok, true);
  assert.equal(game.backpack, true);
  assert.equal(bagSize(game), BACKPACK_SLOTS);
  assert.deepEqual(Object.keys(GEAR_RECIPES.backpack).sort(), ['antler', 'leather']);
  assert.equal(game.resources.leather, 0);
  assert.equal(moveSlot(game, 0, BAG_SLOTS + 2), true);

  fillWithWood(game);
  assert.equal(game.resources.wood, 1000);
  assert.equal(viewSlots(game).filter(Boolean).length, 20);

  Object.assign(game.resources, GEAR_RECIPES.backpack);
  assert.equal(finishMake(game, 'backpack').reason, 'owned');
});

// Guards the save: where the player dragged the piles, the backpack and a packed tent all come
// back, and a broken slot list is refused.
test('the piles, the backpack and a packed tent are saved and checked', () => {
  const game = createGame('survivor');
  moveSlot(game, 0, 4);
  game.backpack = true;
  game.packedTent = true;
  tidyBag(game);

  const loaded = restoreGame(serializeGame(game));
  assert.deepEqual(loaded.slots, game.slots);
  assert.equal(loaded.backpack, true);
  assert.ok(shown(loaded).includes('tent×1'));
  loaded.slots[4].n = 99;
  assert.equal(game.slots[4].n, 4); // the loaded game shares no pile with the original

  for (const slots of [undefined, [], [...game.slots, null], game.slots.map(() => 'wood')])
    assert.equal(restoreGame(JSON.stringify({ ...game, slots })), null);
  for (const pile of [
    { item: 'nonsense', n: 1 },
    { item: 'wood', n: 0 },
    { item: 'wood', n: 1.5 },
  ])
    assert.equal(restoreGame(JSON.stringify({ ...game, slots: game.slots.map(() => pile) })), null);
  assert.equal(restoreGame(JSON.stringify({ ...game, backpack: 'yes' })), null);
});

// Guards older saves: a version 10 save had no slots and no limit on what it carried. It is laid
// out in piles of fifty, and what does not fit in the ten open slots is still there, in the
// backpack's slots, never lost.
test('older saves gain their piles, and nothing they carry is lost', () => {
  const game = createGame('scout');
  Object.assign(game.resources, { wood: 430, stone: 120, food: 1, herbs: 4, iron: 1 });
  const { slots, backpack, packedTent, ...old } = game;
  assert.ok(slots && backpack === false && packedTent === false);

  const loaded = restoreGame(JSON.stringify({ ...old, version: 10 }));
  assert.equal(loaded.backpack, false);
  assert.equal(loaded.resources.wood, 430);
  // 9 piles of wood, 3 of stone, and one each of food, herbs and iron: 15 slots, 5 past the open ten.
  assert.equal(shown(loaded).filter(Boolean).length, 15);
  assert.equal(hasRoomFor(loaded, { copper: 1 }), false);

  // A version 11 save kept one slot per kind: each kind's first pile stays in that slot.
  const eleven = { ...old, version: 11, backpack: false, packedTent: false };
  eleven.slots = [null, null, 'stone', 'wood', null, null, null, null, null, null];
  const upgraded = restoreGame(JSON.stringify(eleven));
  assert.deepEqual(shown(upgraded).slice(2, 4), ['stone×50', 'wood×50']);
  assert.equal(upgraded.resources.stone, 120);
});
