# Inventory slots, backpack and taking things down

Date: 2026-11-20. Status: built.

## Goal

The item box used to show every resource all the time, in a fixed order. It should feel like a
bag: empty until something is picked up, arranged by the player, and limited so that a chest and a
bigger bag are worth having. Campfires and camp buildings should also be removable, so a camp put
in the wrong place is not a permanent mistake.

## Item box

- A slot holds one pile of one kind of thing, up to 50 pieces (`STACK_SIZE`). The excess takes
  another slot: 120 wood is three slots (50, 50, 20).
- A slot shows something only while the player carries it. A new pile takes the first empty open
  slot; when it runs out the slot is empty again. Spending takes from a kind's last pile first.
- The starting kit sits in the first slots of a new game.
- Dragging a pile onto another open slot moves it there; onto a pile of the same kind it joins it
  up to 50; onto another kind the two swap. Mouse and touch both work (pointer events). Where the
  piles lie is saved.
- The food and herbs slots still eat and heal on a click, wherever they sit, and show F and H.

## Bag size

- Ten slots are open at the start (`BAG_SLOTS`): one painted box.
- The backpack (Build menu, Gear, key P; 6 leather + 2 antlers, no wood or feathers; made once).
  Leather is a resource that comes from hunting (deer 2, rabbit 1, boar 2). The backpack adds ten more
  (`BACKPACK_SLOTS` = 20), shown as a second box above the first.
- The bag is full when a thing has neither a pile with space nor an empty slot. What a gather or a
  hunt gives must fit whole, or it does not start ("Your bag is full"). A ripe wheat bed is not
  harvested, a chest's "Take all" takes only what fits, and a tree's dropped find or a deer's
  antler is left behind.
- There is no dropping things on the ground. A chest holds what does not fit.

## Taking things down

All of it is done from the camp window (E beside the fire), in a "Standing here" list with a
button per building and one for the fire. Each is a timed action of `TAKEDOWN_SECONDS` (3 s) with
the `build` clip; moving cancels it and nothing changes. The player must stand within the camp's
warmth.

| Thing | Gives back | Condition |
| --- | --- | --- |
| Tent | The whole tent, as a "packed tent" in one slot | An open slot for it |
| Storage chest | Half its cost (3 wood, 1 stone) | It must be empty |
| Wheat bed | Half its cost (2 wood) | The crop is lost |
| Camp centre | Half the cost of its current tier | None |
| Campfire | Half its cost (1 wood, 1 stone) | No buildings left at the camp |

Halves round down. Putting out the fire removes the camp, its name and its needs.

## Tent

- A player may have one tent standing in the whole world (it was one per camp).
- A packed tent is pitched again from the Build menu for nothing, inside any of the player's
  fires' warmth. It can't be pitched while another tent stands.
- An older save with tents at several camps keeps them all; no new one can be made until none
  stands.

## Save

Version 12 holds `slots` (twenty entries, a pile `{item, n}` or null), `backpack` and
`packedTent`. The totals stay in `resources`; the slots only say how the piles lie. A version 10
save is upgraded: its piles are laid out in the old fixed order, fifty to a slot. Version 11 (one
slot per kind, never released) keeps each kind's slot for its first pile. A save that carries more
than its open slots hold keeps the extra piles in the backpack's slots, visible and usable, until
they run out.

## Code

- `src/world/bag.js`: piles, open size, room checks, `addItem`, `moveSlot`, `tidyBag`, `viewSlots`.
- `src/actions/takedown.js`: `checkTakeDown`, `beginTakeDown`, `finishTakeDown`, `refundOf`.
- `src/actions/building.js`: `priceOf` (a packed tent is free), `hasTent`, the one-tent rule.
- `src/ui/itembox.js`: drawing the slots, dragging, the food and herbs clicks.
- `src/ui/camp.js`: the "Standing here" list.
- Tests: `tests/world/bag.test.js`, `tests/actions/takedown.test.js`.

## Not in this change

- No new painted art: the packed tent's slot borrows the tent's world sprite, and the backpack's
  menu row shows the pack cut from `assets/items/dropped-haul.png`
  (`assets/ui/game/item-backpack.png`).
- No dropping items, no splitting a pile by hand, no touch button for anything new.
