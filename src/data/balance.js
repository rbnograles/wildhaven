// Gameplay tuning. Speeds are world units per second; ranges and radii are world units.
export const WALK_SPEED = 155;
export const RUN_SPEED = 245;
// Longest step one movement update may take, so a slow frame can't carry the player through an obstacle.
export const MAX_MOVE_DT = 0.1;
export const GATHER_RANGE = 95;
// Gathering tools will shorten this (towards 0.5 s); until then every supply takes the full time.
export const GATHER_SECONDS = 6;
export const DISCOVERY_RADIUS = 230;
// The HUD keeps naming a region this far beyond its discovery radius.
export const REGION_LABEL_RANGE = 130;
