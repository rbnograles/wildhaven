// Gameplay tuning: the numbers that decide how the game feels to play.
// Speeds are world units per second; ranges and radii are world units (one map tile is 64 units).
// Change numbers here instead of writing them straight into the actions.

/** How fast the player walks, in world units per second. */
export const WALK_SPEED = 155;

/** How fast the player runs while Shift is held, in world units per second. */
export const RUN_SPEED = 245;

// Longest step one movement update may take, so a slow frame can't carry the player through an obstacle.
export const MAX_MOVE_DT = 0.1;

/** How close the player must stand to a supply to gather it. */
export const GATHER_RANGE = 95;

// ---- Click to walk ----
// A click on a tree or rock out of reach walks the player to it (see actions/approach.js).

// The path is planned on a grid of squares this many units wide. Smaller squares find tighter
// gaps between trees but take longer to search; 24 is under half a tile.
export const APPROACH_CELL = 24;

// How far from the player (in units, each way) the path may wander. A clicked tree is on screen,
// so this only needs to cover the screen plus room to walk round a pond or a hill.
export const APPROACH_SPAN = 1800;

// The path ends this many units inside GATHER_RANGE, so the player is surely in reach on arrival.
export const APPROACH_MARGIN = 16;

// Before working on something (picking by hand, chopping, mining, mending an old boat) the player
// steps to a spot beside it, so the working picture (which faces east or west) reaches toward it
// instead of away. STAND_SIDE is how far to the side of a walk-through patch they stand, STAND_GAP
// how far clear of a solid thing's base, STAND_INSIDE how far inside GATHER_RANGE the spot must
// stay, and STAND_STUCK the seconds they may push at something on the way before working from
// where they are.
export const STAND_SIDE = 44;
export const STAND_GAP = 26;
export const STAND_INSIDE = 10;

// The spot is this many units south of the thing's foot, so the player is drawn in front of a
// tree's branches instead of hidden behind them (things lower on the screen are drawn in front).
export const STAND_FRONT = 10;
export const STAND_STUCK = 0.2;

// Seconds the player may push at something without moving before the walk plans a new path
// (once), and then gives up.
export const APPROACH_STUCK = 0.4;

// How many seconds a bare-hand gather takes (picking berries, flowers and the big berry bushes).
// Tools shorten the gathers that need them (see TOOL_SECONDS), and loose things on the ground are
// quick to pick up (see PICKUP_SECONDS). This is a design decision, so don't shorten it as a "fix".
export const GATHER_SECONDS = 6;

/** How close the player must come before a villager turns to look at them. */
export const NPC_NOTICE = 280;

/** How fast a villager walks, in world units a second (the player walks at 155). */
export const NPC_SPEED = 55;

/**
 * How long a villager spends on each kind of work before carrying the result away, in seconds:
 * chopping, mining, or picking a bundle up off the ground.
 */
export const NPC_WORK_SECONDS = { chop: 6, mine: 6, pickup: 1.6 };

/** How long a villager takes to set their load down, in seconds. */
export const NPC_DEPOSIT_SECONDS = 1.6;

/** How close to a work or drop spot a villager's planned path must bring them, in world units. */
export const NPC_ARRIVE = 20;

/** How long a villager whose way is blocked waits before looking for another way, in seconds. */
export const NPC_RETRY = 1.5;

/** How close the player must come for a walking villager to stop and wait for them. */
export const NPC_STOP = 110;

/** The shortest and longest time, in seconds, a villager rests between two errands. */
export const NPC_REST_MIN = 3;
export const NPC_REST_MAX = 9;

/** The solid ground under a villager's feet, as [half width, depth] in world units. */
export const NPC_BASE = [16, 12];

/** The chance that a chopped map tree also drops a find (a pine cone or a feather): 2 in 10. */
export const DROP_CHANCE = 0.2;

/** How close the player must come to a landmark to find it. */
export const LANDMARK_RADIUS = 200;

/** How close the player must walk to a signpost to find it. */
export const WAYPOINT_RADIUS = 110;

// ---- The sea and boats ----

/**
 * How close the player must stand to their boat to get in. The boat floats a little off the
 * beach, so this is wider than the reach for gathering.
 */
export const BOARD_RANGE = 160;

/** How far from the boat the player may step ashore when landing. */
export const LAND_RANGE = 160;

/** What repairing an old boat costs. It is taken from the backpack when the repair finishes. */
export const REPAIR_COST = { wood: 6, stone: 2 };

// How many seconds repairing an old boat takes: a little longer than a 6 s gather, because it is a bigger job.
export const REPAIR_SECONDS = 8;

/** How close the player must come to an old boat to find it (and mark it on the map). */
export const WRECK_RADIUS = 200;

/** How fast the small boat moves, in world units per second. Faster than walking: the sea is wide. */
export const BOAT_SPEED = 210;

/** How fast the small boat moves while Shift is held, in world units per second. */
export const BOAT_FAST_SPEED = 300;

/** How far ahead of the boat to look for deep sea when warning that it is too rough. */
export const DEEP_LOOKOUT = 60;

// ---- Day and night (M2) ----

/** One in-game day in game seconds: dawn, day and dusk give 240 s of light, then 120 s of night. */
export const DAY_SECONDS = 360;

/** When each part of the day starts, in seconds after dawn. Night lasts until the next dawn. */
export const PHASES = { dawn: 0, day: 20, dusk: 210, night: 240 };

/** Seconds after dawn that count as midday. A player who passes out wakes then. */
export const MIDDAY = 120;

/** The clock reading a brand-new game starts at: the morning of day 1, just after dawn. */
export const START_TIME = 20;

// ---- Survival meters (each runs from 0 to 100) ----

/** Seconds of night away from a fire it takes full warmth to drain to nothing. */
export const WARMTH_SECONDS = 60;

/** How many times faster the cold drains warmth when hunger is empty. */
export const STARVING_COLD = 1.5;

/** Warmth gained per second beside a fire, at any hour. */
export const WARM_BY_FIRE = 20;

/** Warmth gained per second away from a fire during dawn and day. */
export const WARM_BY_DAY = 4;

/** The regions where it snows: warmth drains there at every hour, away from a fire. */
export const SNOW_REGIONS = ['frostpeak'];

// How many times faster than an ordinary night the snow drains warmth: by day and dusk (full warmth
// lasts 40 s), and at night (24 s). Planned winter gear will lower these; until then only a fire
// stops the cold, and tea holds it off for a while.
export const SNOW_COLD = 1.5;
export const SNOW_NIGHT_COLD = 2.5;

/**
 * Seconds of freezing (no warmth left, away from a fire, at night or in the snow) it takes to
 * drain full health.
 */
export const FREEZE_SECONDS = 30;

/**
 * Seconds of starving (an empty stomach) it would take to drain full health. Much slower than
 * freezing: hunger is a nag to go and eat, not an emergency.
 */
export const STARVE_SECONDS = 240;

/**
 * Starving never takes health below this. Hunger alone can't make the player pass out, because
 * they would wake still starving and pass out again; it only leaves them weak against the cold.
 */
export const STARVE_FLOOR = 25;

/** Health healed per second beside a fire while not starving. */
export const HEAL_BY_FIRE = 2;

/** Seconds it takes a full stomach to empty: two in-game days. */
export const HUNGER_SECONDS = 720;

// ---- Eating, healing and tea ----

/** Hunger one food restores. */
export const FOOD_HUNGER = 25;

// Herbs one heal uses, and the health it restores.
export const HEAL_HERBS = 3;
export const HEAL_HEALTH = 30;

// Herbs one cup of tea uses, and the seconds of cold it holds off. One cup at a time.
export const TEA_HERBS = 5;
export const TEA_SECONDS = 20;

/** Health the player has on waking up after passing out. */
export const WAKE_HEALTH = 50;

/** How far from a fire the player wakes after passing out, in world units. */
export const WAKE_OFFSET = 90;

// ---- Campfires and camps ----

/** What one campfire costs. Paid only when the fire is really placed. */
export const CAMPFIRE_COST = { wood: 3, stone: 2 };

// How far a new fire's warmth reaches, and how much each met need adds, in world units.
export const FIRE_RADIUS = 260;
export const FIRE_GROWTH = 40;

/** The most needs that can grow one fire (so its warmth reaches at most 260 + 10 × 40 = 660). */
export const MAX_GROWN = 10;

/** How far from the player a campfire may be placed. */
export const PLACE_RANGE = 300;

/** How far apart two camps must be: "a meaningful walk". */
export const CAMP_SPACING = 3000;

/** How close to one of their fires the player must stand to open its camp. */
export const CAMP_REACH = 140;

/** How close to a new fire any supply or flower patch may be. */
export const NODE_CLEARANCE = 80;

/** What a "bring" need asks for at first; every two needs met add one more. */
export const NEED_AMOUNTS = { wood: 4, stone: 3, food: 2, herbs: 4 };

// Limits that keep saves small and tidy: the longest camp name, and the most camps one save may hold.
export const CAMP_NAME_MAX = 24;
export const MAX_CAMPS = 50;

// ---- Regrowth and fog ----

/** Game seconds before a gathered supply (tree, stones, berries) grows back: two in-game days. */
export const SUPPLY_REGROW = 720;

// The fog of war's square size, and how far around the player the fog lifts, in world units.
export const FOG_CELL = 256;
export const FOG_RADIUS = 1000;

// ---- Tools and crafting ----

/**
 * What each tool costs to craft, per tier. Stone tools are made anywhere; iron tools also need a
 * hammer and one of the player's campfires (the fire is the forge).
 */
export const TOOL_RECIPES = {
  axe: { stone: { wood: 3, stone: 2 }, iron: { wood: 2, stone: 1, iron: 3 } },
  pickaxe: { stone: { wood: 3, stone: 3 }, iron: { wood: 2, stone: 1, iron: 4 } },
  hammer: { stone: { wood: 2, stone: 3 }, iron: { wood: 2, stone: 1, iron: 3 } },
  // The weapons. A bow is strung with plant fibre, so it asks for herbs (wild flowers). Gold and
  // diamond are forged like iron, giving the mined gold and diamond their first use.
  sword: {
    stone: { wood: 1, stone: 4 },
    iron: { wood: 1, stone: 1, iron: 4 },
    gold: { wood: 1, gold: 4 },
    diamond: { wood: 1, diamond: 4 },
  },
  bow: {
    stone: { wood: 4, stone: 1, herbs: 2 },
    iron: { wood: 3, iron: 2, herbs: 2 },
    gold: { wood: 3, gold: 2, herbs: 2 },
    diamond: { wood: 3, diamond: 2, herbs: 2 },
  },
};

/** How many uses a new stone tool has. Iron tools never wear out. */
export const TOOL_USES = { axe: 25, pickaxe: 25, hammer: 10, sword: 20, bow: 20 };

// Seconds a gather that needs a tool takes with a stone or an iron one. Bare-hand gathers keep
// GATHER_SECONDS; this is how tools shorten gathering, as GATHER_SECONDS always promised.
export const TOOL_SECONDS = { stone: 5, iron: 3 };

// ---- Rock sizes ----

// A rock is small (size 1), medium (2) or large (3). A bigger rock gives more, takes longer to mine
// and is harder on a stone pickaxe. Each list below has one number per size, smallest first.

// How much one mining gives, by what the rock holds and its size.
export const ROCK_YIELD = {
  stone: [2, 4, 10],
  iron: [1, 2, 3],
  copper: [1, 2, 3],
  gold: [1, 2, 3],
  diamond: [1, 2, 3],
};

// How many times TOOL_SECONDS mining takes, by size: a large rock takes twice as long as a small one.
export const SIZE_SECONDS = [1, 1.5, 2];

// How many uses of a stone pickaxe one mining costs, by size. Iron tools still never wear out.
export const SIZE_WEAR = [1, 2, 3];

// A rock the map draws smaller than SIZE_SHRINK times its usual size counts as one size smaller,
// and one drawn bigger than SIZE_GROW times counts as one size bigger.
export const SIZE_SHRINK = 0.85;
export const SIZE_GROW = 1.2;

// Seconds it takes to pick up something loose from the ground (small stones, sticks, driftwood,
// an antler). Bending down for a stone is much quicker than chopping a tree, so it is far below
// GATHER_SECONDS and TOOL_SECONDS on purpose.
export const PICKUP_SECONDS = 2;

// ---- Gear made from the finds ----

// What each piece of gear costs (data/gear.js lists them). The boat's recipe is a first pass: it
// will also need nails once those exist.
// How far from the bank a fishing line reaches, how long a catch takes, and the food it gives.
export const FISH_REACH = 150;
export const FISH_SECONDS = 7;
export const FISH_FOOD = 3;

// Extra food a hoe adds to a wheat harvest (on top of HARVEST_FOOD).
export const HOE_BONUS = 3;

// How much each piece of deer-hide clothing multiplies the cold drain (less than 1 means warmer).
// Four pieces together is about 0.6; with a feather coat (COAT_COLD) the winter bites far less.
export const HIDE_COLD = 0.88;

// How many arrows one "fletch arrows" craft makes, and how many a single bow shot spends.
export const ARROWS_PER_CRAFT = 5;
export const ARROW_PER_SHOT = 1;

export const GEAR_RECIPES = {
  torch: { wood: 1, pinecone: 2 },
  coat: { feather: 10, antler: 2 },
  grip: { antler: 1 },
  boat: { wood: 30, iron: 6 },
  backpack: { leather: 6, antler: 2 },
  rod: { wood: 3, stone: 1 },
  hoe: { wood: 2, iron: 1 },
  hat: { leather: 2 },
  jacket: { leather: 3, wolfpelt: 1 },
  gloves: { leather: 2 },
  boots: { leather: 2 },
  arrows: { wood: 1, stone: 1 },
};

/**
 * How many item box slots are open: BAG_SLOTS at the start (one box of ten), BACKPACK_SLOTS once
 * the backpack is made (a second box of ten above it). A slot holds one pile of one kind of thing,
 * up to STACK_SIZE pieces; more of that kind starts another pile in another slot. The bag is
 * "full" when a thing has neither a pile with space nor an empty slot; a chest holds the rest.
 */
export const BAG_SLOTS = 10;
export const BACKPACK_SLOTS = 20;
export const STACK_SIZE = 50;

/** Seconds it takes to take a building or a campfire down. Moving stops it, and nothing changes. */
export const TAKEDOWN_SECONDS = 3;

/** Seconds a torch burns. It burns down by day too, like a real one. One torch at a time. */
export const TORCH_SECONDS = 90;

/** How many times wider the glow around the player is at night while a torch burns. */
export const TORCH_LIGHT = 2.2;

/** How much of the usual cold gets through a feather coat: half. */
export const COAT_COLD = 0.5;

// An antler grip gives a stone tool a new tool's worth of uses back, but never more than this many
// times a new tool's uses in all.
export const GRIP_MAX = 2;

/** Uses left when the game warns that a stone tool is wearing out. */
export const TOOL_WEAR_WARNING = 3;

/** Seconds one craft takes. Moving cancels it, and nothing is spent. */
export const CRAFT_SECONDS = 3;

/** Game seconds before a chopped tree or mined rock grows back: three in-game days. */
export const HARVEST_REGROW = 1080;

// ---- How the character looks ----

/** Below this much hunger (out of 100) the character stands with a hand on their belly. */
export const HUNGRY_BELOW = 25;

// ---- Buildings at a camp (data/buildings.js says what each one is) ----

/**
 * What each building costs: a tent, a storage chest and a wheat bed once each, and the camp centre
 * once per tier (pavilion, small hall, big hall). Paid only when the building is finished.
 */
export const BUILDING_COSTS = {
  tent: { wood: 8, stone: 2 },
  chest: { wood: 6, stone: 2, iron: 1 },
  farm: { wood: 4 },
  centre: [
    { wood: 10, stone: 4 },
    { wood: 20, stone: 10, iron: 2 },
    { wood: 30, stone: 20, iron: 6 },
  ],
};

/** Seconds of hammering each building takes. Moving stops it, and nothing is paid. */
export const BUILD_SECONDS = { tent: 8, chest: 4, farm: 4, centre: 8 };

/** The most of each building one camp may have. */
export const BUILDING_LIMITS = { tent: 1, chest: 2, farm: 4, centre: 1 };

/** How much farther a fire's warmth reaches for each tier of its camp centre, in world units. */
export const CENTRE_WARMTH = 80;

/** How close the player must stand to use a chest or a wheat bed, in world units. */
export const BUILDING_REACH = 110;

/** The share of the night's hunger a rest in a tent still costs: sheltered sleep, half the hunger. */
export const TENT_REST_HUNGER = 0.5;

// A wheat bed: sowing costs this much food as seed; each growth stage takes GROW_SECONDS game
// seconds (tending once in a stage halves what is left of it); a ripe bed gives HARVEST_FOOD food.
// Sowing, tending and harvesting each take FARM_SECONDS.
export const SOW_COST = { food: 1 };
export const GROW_SECONDS = 360;
export const HARVEST_FOOD = 6;
export const FARM_SECONDS = 3;

// ---- Animals (data/animals.js says where each kind lives and what it gives) ----

/** How many herds each region holds, shared among the kinds that live there. */
export const HERDS_PER_REGION = 6;

/** How far an animal wanders from its herd's home, in world units. */
export const HERD_ROAM = 260;

// An animal runs from a player this close: a running player is heard from FLEE_RUNNING away, but a
// walking one gets as near as FLEE_WALKING, so a careful player can creep up close enough to hunt.
// Once scared, it runs for FLEE_SECONDS.
export const FLEE_RUNNING = 260;
export const FLEE_WALKING = 70;
export const FLEE_SECONDS = 3;

// Hunting: how close the player must stand (world units), and how long the swing takes (seconds).
export const HUNT_REACH = 95;
export const HUNT_SECONDS = 1.5;

// Seconds a melee hit with a sword takes, by tier: quicker than the axe's HUNT_SECONDS, and quicker
// at higher tiers.
export const SWORD_SECONDS = { stone: 1, iron: 0.6, gold: 0.6, diamond: 0.5 };

// Seconds a bow shot takes from nocking the arrow to the hit: the archer draws and aims for most of
// it, and the arrow flies for the last quarter second (the `bow` clip in animation/clips.js is laid
// out to fill exactly this long).
export const BOW_SECONDS = 1.5;

// How far away a bow can hunt from, by tier. A walking player startles an animal only within
// FLEE_WALKING, so a bow lets a careful hunter shoot before the animal runs.
export const BOW_REACH = { stone: 260, iron: 340, gold: 400, diamond: 460 };

// How much damage one full-strength hit deals, by weapon and tier. A hit subtracts this from a
// creature's hit points; when they reach 0 it falls. The sword and the bow share the same curve;
// the axe is the weak fallback and is only ever stone or iron.
export const WEAPON_DAMAGE = {
  sword: { stone: 2, iron: 3, gold: 4, diamond: 6 },
  bow: { stone: 2, iron: 3, gold: 4, diamond: 6 },
  axe: { stone: 1, iron: 2 },
};

// How many hit points a wolf has. Animals carry their own hp in data/animals.js.
export const WOLF_HP = 6;

// Seconds of holding the right mouse button to charge a bow shot to full. A quick tap ("quick
// release") is about half damage; a full hold is full damage.
export const CHARGE_SECONDS = 0.9;

/** Game seconds before a hunted animal is back with its herd: one game day. */
export const ANIMAL_RETURN = 360;

/** Seconds a hunted animal lies on the ground before it fades away. */
export const ANIMAL_DOWN_SECONDS = 2;

// ---- Wolves (world/wolves.js picks the dens; actions/wolves.js moves the packs) ----

/** The most caves per region that are wolf dens, and how many wolves live in each. */
export const DENS_PER_REGION = 2;
export const PACK_SIZE = 3;

/** No cave this close to a start spot is a den, in world units: wolves keep away from new players. */
export const DEN_FROM_SPAWN = 2000;

// By day a pack stays within WOLF_GUARD of its den. A player who comes within WOLF_WARN gets a growl;
// one who keeps coming within WOLF_ATTACK is attacked.
export const WOLF_GUARD = 220;
export const WOLF_WARN = 300;
export const WOLF_ATTACK = 200;

// At night a pack roams within WOLF_ROAM of its den and chases a player it sees within WOLF_SIGHT.
export const WOLF_ROAM = 2000;
export const WOLF_SIGHT = 450;

// Speeds, in world units per second: walking about, and running (a player walks at 155, runs at 245).
export const WOLF_WALK = 60;
export const WOLF_RUN = 210;

// A bite: a wolf this close bites for WOLF_BITE health, at most once every WOLF_BITE_EVERY seconds.
// The whole pack shares one more wait, PACK_BITE_EVERY: however many wolves are round the player,
// only one bites in that time. So a full pack takes about 25 s to bring a player from full health
// to 0, never a sudden kill, and there is time to repel, run for a fire or fight back.
export const WOLF_BITE_REACH = 60;
export const WOLF_BITE = 8;
export const WOLF_BITE_EVERY = 2.5;
export const PACK_BITE_EVERY = 2;

// Repel (R): wolves within REPEL_REACH are pushed REPEL_PUSH away and stand stunned for REPEL_STUN
// seconds. It can be used once every REPEL_EVERY seconds, and the shove takes REPEL_SECONDS.
export const REPEL_REACH = 160;
export const REPEL_PUSH = 140;
export const REPEL_STUN = 2.5;
export const REPEL_EVERY = 3;
export const REPEL_SECONDS = 0.5;
