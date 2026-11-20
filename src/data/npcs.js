// The villagers: the three people who live in Hollowstead village. They start on the same spots
// in every game, whichever character is being played, so the village is where you go to meet them.
// Each one has their own job, which they do over and over.

/**
 * The villagers, in the order their rows are painted on the settlers sheets.
 *
 * Fields: `id` (a name for code), `name` and `role` (words for the player), `row` (which row of
 * the pictures in assets/characters/settlers/ is theirs), `x`/`y` (their home spot, where their
 * feet stand when a game starts, in world units; all three are in the village around Hollowstead
 * Square), `facing` (which way they look at first: 0 south, 1 west, 2 east, 3 north) and `job`.
 *
 * `job` is the villager's errand, done round and round: walk to `work`, do the work there, carry
 * what it gave to `drop`, set it down, rest, and start again. `work` and `drop` each hold `x`/`y`
 * (where the villager stands) and `facing` (1 west or 2 east: the work pictures only face
 * sideways). `work.clip` says what the work looks like: `chop` (swing an axe), `mine` (swing a
 * pickaxe) or `pickup` (bend down and lift a bundle).
 *
 * Maren chops at the village's scrap timber and carries logs home. Bram breaks stone at the
 * boulder and carries a crate to the workshop. Tilly lifts wheat sheaves at the south edge of the
 * village and carries them to the square. tests/world/npcs.test.js checks every spot is clear and
 * can be walked to.
 */
export const NPCS = [
  {
    id: 'woodsworker',
    name: 'Maren',
    role: 'Woodsworker',
    row: 0,
    x: 14130,
    y: 9250,
    facing: 0,
    job: {
      work: { clip: 'chop', x: 14540, y: 9366, facing: 1 },
      drop: { x: 14180, y: 9250, facing: 1 },
    },
  },
  {
    id: 'stoneworker',
    name: 'Bram',
    role: 'Stoneworker',
    row: 1,
    x: 14660,
    y: 9560,
    facing: 1,
    job: {
      work: { clip: 'mine', x: 14140, y: 9372, facing: 2 },
      drop: { x: 14620, y: 9580, facing: 2 },
    },
  },
  {
    id: 'grower',
    name: 'Tilly',
    role: 'Grower',
    row: 2,
    x: 14090,
    y: 9660,
    facing: 2,
    job: {
      work: { clip: 'pickup', x: 14120, y: 9800, facing: 2 },
      drop: { x: 14200, y: 9540, facing: 2 },
    },
  },
];
