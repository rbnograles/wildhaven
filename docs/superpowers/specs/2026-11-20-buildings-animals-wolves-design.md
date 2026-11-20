# Buildings, animals and wolves — design

Date: 2026-11-20. Status: slices A, B and C built (2026-11-20; walking creep-up distance is 70; wolf bites were softened after playtest feedback so a pack never kills quickly: 8 health a bite, one bite every 2 s for the whole pack; see CLAUDE.md "Wolves" for the built numbers).

This is the part of M3 in `2026-11-19-survival-settlement-design.md` that has art already: four things the
player builds, animals that roam and can be hunted, and wolves that live in caves. The user chose all four
buildables, hunting, and wolves that "guard the den in the morning, roam in packs at night, and attack a player
who is outside a village". Settlers and recruiting stay out of scope.

The work is split into three slices, built and checked in this order. Each one ends playable.

## Slice A — buildables

All four are placed from the Build menu (a new **Camp** group) like the campfire: a ghost that shows where it may
stand, the cost charged only when placed. Each must stand inside the warmth of one of the player's fires (so it
belongs to that camp), on dry, level, clear ground. They are saved with the camp.

| Thing | Cost (first pass) | Art | What it does |
| --- | --- | --- | --- |
| Tent | 8 wood + 2 stone | `settlement/shelter-construction-clean.png` (stages 1–3 while building), `buildings/tent.png` when done, `states/tent-sleeping-padded.png` | Resting at a camp with a tent lays the character down inside it (tent-sleeping art) instead of on the ground; the rest also gives +20 health. Wolves never attack within a tent's camp. |
| Storage chest | 6 wood + 2 stone + 1 iron | `settlement/stockpile-chest-states-clean.png` (closed, ajar, open, open and full) | E beside it opens a chest window: for each resource, put all in or take all out. Its contents are saved. Closed when shut, open and full while open with something inside. |
| Wheat bed | 4 wood | `farming/wheat-growth.png` (empty, seedlings, green, ripe) and the players' sow / tend / harvest sheets | Sow (costs 1 food as seed), then it grows a stage every 360 game seconds; tending it once per stage halves what is left of that stage; harvesting a ripe bed gives 6 food and leaves it empty. |
| Camp centre | tier 1: 10 wood + 4 stone; tier 2: 20 wood + 10 stone + 2 iron; tier 3: 30 wood + 20 stone + 6 iron | `settlement/settlement-centres.png` (pavilion, small hall, big hall) | One per camp, standing a little north of its fire; building it again upgrades it a tier. Each tier widens the fire's warmth by 80 units and the camp counts as a village for wolves. |

**Building takes time and shows it.** Placing starts a timed action (8 s for the tent and the centre, 4 s for the
chest and the bed) with the character's `build` clip; the site shows the construction stages as it goes (the tent
uses the shelter stages; the others fade up from a faint ghost). Moving cancels it and refunds nothing until it is
placed, the same as crafting.

**Save.** `SAVE_VERSION` goes to 9. Each camp gains `buildings`: a list of `{ id, kind, x, y }` plus `contents`
for a chest and `{ stage, readyAt, tended }` for a bed, and `tier` (0–3) for its centre. Version 8 saves upgrade
with empty lists.

## Slice B — animals and hunting

Deer, rabbits and boars live in herds round fixed home spots, worked out from the map when a game opens (one
random seed per region, so they never move between loads), on open ground away from villages, paths and places.

| Animal | Where | Herd | Food when hunted |
| --- | --- | --- | --- |
| Deer | Pinefall, meadows, the edge of Frostpeak | 3–5 | 5 food, and an antler half the time |
| Rabbit | Meadows, lagoon, Pinefall | 1–2 | 2 food |
| Boar | Jungle, Pinefall, canyons | 1–3 | 6 food |

- They wander near home (walk), stop to graze (idle), and **run away** for a few seconds when the player comes
  close: 260 units for a running player, but only 110 for one walking, so a careful player can creep up on them.
- **Hunting** needs an axe (any tier). E, or a click, on an animal in reach starts a 1.5 s hunt with the `chop`
  clip; the animal freezes, startled, so the hit lands. It then lies down (the sheet's last row), fades, and the
  food (and antler) goes into the backpack. No blood or wounds are shown.
- A hunted animal comes back a game day later. Animals are never saved; they start from home each time a game
  opens, like the villagers.
- Every sheet faces east and is mirrored for west, so animals only face sideways, like a villager carrying a load.

## Slice C — wolves and dens

- **Dens.** Each region gets up to two wolf dens: caves the Tiled map marks `holds: wolf den` first, then any other
  mainland cave in that region. The importer keeps a cave's `holds` and `mineral` properties in the game map so the
  game can read them. A region with fewer caves gets fewer dens (the map has 11 caves now; more can be drawn in
  Tiled). Islet caves are never dens.
- **By day** a pack of three stands guard near its den (within 220 units). A player who comes within 300 gets a
  growl first (the sheet's snarl row, about 1.5 s); a player who keeps coming within 200 is attacked.
- **At night** the pack roams together within 2,000 units of its den. It chases a player it sees within 450 units
  and attacks, unless the player is inside a village (the eight villages' loops, and any camp with a centre or a
  tent) or inside a lit fire's warmth: wolves will not step into those, and they retreat from fire, as the survival
  design asks. At dawn the pack goes home.
- **An attack** is a lunge (the sheet's attack row) that takes 10 health, at most once every 1.4 s per wolf; the
  player shows the existing `hurtAttack` reaction.
- **Repel** (R, and a touch button): the players' repel sheet; wolves within 160 units are pushed back and stunned
  for 2.5 s. Once every 3 s.
- **Fighting back:** the hunt action works on a wolf too (axe, 1.5 s). The wolf lies down (`wolf-dying.png`) and
  fades; its pack comes back to full the next dusk. Wolves are never saved.
- Wolves keep away from the starting areas: no den within 2,500 units of a spawn is used.

## On the map

Added by the user on 2026-11-20: animals and wolves show on the minimap and the world map, but only once
discovered. A herd's home and a wolf den are marked once the player has seen them (been within the fog's reach of
them); at night a roaming pack is shown where it is while it is within that reach of the player, so wolves on the
move can be watched. Nothing shows under fog.

## What is not in this design

Settlers and recruiting, other buildings, cooking, carrying capacity, weapons other than the axe, and any wolf
behaviour beyond the above. The construction art for buildings other than the tent does not exist yet, so those
fade up instead.

## Testing

Pure modules get Node tests as usual: placement and cost for each buildable, the bed's growth and tending, the
chest moving resources, save upgrade from version 8; herd spots on open ground, flee distances, the hunt reward;
den choice (two per region, none near a spawn), the day and night rules, the safe zones, bite timing and repel.
The browser check plays each slice with a character: build all four, sleep in the tent, farm a bed to harvest,
creep up on a deer and hunt it, meet a pack at night outside a village, repel it, and walk back into a village.
