# Inventory slots, backpack and taking things down

Date: 2026-11-20. Status: built.

## Goal

The item box used to show every resource all the time, in a fixed order. It should feel like a
bag: empty until something is picked up, arranged by the player, and limited so that a chest and a
bigger bag are worth having. Campfires and camp buildings should also be removable, so a camp put
in the wrong place is not a permanent mistake.

## Item box

- The box has ten slots (`BAG_MAX`). A slot holds one kind of thing, however many of it.
- A slot shows something only while the player carries it. A new kind takes the first empty open
  slot; when it runs out the slot is empty again.
- The starting kit sits in the first slots of a new game.
- Dragging a filled slot onto another open slot moves it there; if that slot is taken the two swap.
  Mouse and touch both work (pointer events). The order is saved.
- The food and herbs slots still eat and heal on a click, wherever they sit, and show F and H.

## Bag size

- Five slots are open at the start (`BAG_SLOTS`, the top row). The bottom row is drawn shut.
- The backpack (Build menu, Gear, key P; 8 wood + 4 feathers + 1 antler; made once) opens all ten
  (`BACKPACK_SLOTS`).
- There is no stack limit. The bag is full when a new kind has no open slot. More of a kind already
  carried always fits.
- A full bag refuses a new kind: gathering and hunting do not start ("Your bag is full"), a ripe
  wheat bed is not harvested, a chest's "Take all" is disabled, and a tree's dropped find or a
  deer's antler is left behind.
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

Version 11 adds `slots` (ten entries, a kind of thing or null), `backpack` and `packedTent`.
A version 10 save is upgraded: its slots are filled in the old fixed order. If it carries more
kinds than the five open slots, the extra ones sit in the shut row, stay visible and usable, and
leave it as they run out.

## Code

- `src/world/bag.js`: slots, open size, room checks, `addItem`, `moveSlot`, `tidyBag`.
- `src/actions/takedown.js`: `checkTakeDown`, `beginTakeDown`, `finishTakeDown`, `refundOf`.
- `src/actions/building.js`: `priceOf` (a packed tent is free), `hasTent`, the one-tent rule.
- `src/ui/itembox.js`: drawing the slots, dragging, the food and herbs clicks.
- `src/ui/camp.js`: the "Standing here" list.
- Tests: `tests/world/bag.test.js`, `tests/actions/takedown.test.js`.

## Not in this change

- No painted art for the backpack or the packed tent: the packed tent's slot borrows the tent's
  world sprite, and the backpack's menu row uses a line icon.
- No stack limits, no dropping items, no touch button for anything new.
