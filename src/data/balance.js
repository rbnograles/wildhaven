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

// How many seconds every gather takes. Gathering tools will shorten this (towards 0.5 s); until then
// every supply takes the full time. This is a design decision, so don't shorten it as a "fix".
export const GATHER_SECONDS = 6;

/** How close the player must come to a landmark to find it. */
export const LANDMARK_RADIUS = 200;

/** How close the player must walk to a signpost to find it. */
export const WAYPOINT_RADIUS = 110;

/**
 * How close the player must stand to their boat to get in. The boat floats a little off the
 * beach, so this is wider than the reach for gathering.
 */
export const BOARD_RANGE = 160;

/** How far from the boat the player may step ashore when landing. */
export const LAND_RANGE = 160;
