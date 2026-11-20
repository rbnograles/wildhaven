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

// Seconds the player may push at something without moving before the walk plans a new path
// (once), and then gives up.
export const APPROACH_STUCK = 0.4;

// How many seconds a bare-hand gather takes. Tools shorten the gathers that need them (see
// TOOL_SECONDS); bare-hand gathers always take the full time. This is a design decision, so don't
// shorten it as a "fix".
export const GATHER_SECONDS = 6;

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
};

/** How many uses a new stone tool has. Iron tools never wear out. */
export const TOOL_USES = { axe: 25, pickaxe: 25, hammer: 10 };

// Seconds a gather that needs a tool takes with a stone or an iron one. Bare-hand gathers keep
// GATHER_SECONDS; this is how tools shorten gathering, as GATHER_SECONDS always promised.
export const TOOL_SECONDS = { stone: 5, iron: 3 };

/** Uses left when the game warns that a stone tool is wearing out. */
export const TOOL_WEAR_WARNING = 3;

/** Seconds one craft takes. Moving cancels it, and nothing is spent. */
export const CRAFT_SECONDS = 3;

/** Game seconds before a chopped tree or mined rock grows back: three in-game days. */
export const HARVEST_REGROW = 1080;

// ---- How the character looks ----

/** Below this much hunger (out of 100) the character stands with a hand on their belly. */
export const HUNGRY_BELOW = 25;
