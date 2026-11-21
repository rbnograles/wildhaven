// The villagers: the three people who live in Hollowstead village. They start on the same spots
// in every game, whichever character is being played, so the village is where you go to meet them.
// Each one has their own jobs, which they do over and over.

/**
 * The villagers, in the order their rows are painted on the settlers sheets.
 *
 * Fields: `id` (a name for code), `name` and `role` (words for the player), `row` (which row of
 * the pictures in assets/characters/settlers/ is theirs), `x`/`y` (their home spot, where their
 * feet stand when a game starts, in world units; all three are in the village around Hollowstead
 * Square), `facing` (which way they look at first: 0 south, 1 west, 2 east, 3 north) and `jobs`.
 *
 * `jobs` lists what the villager can do, best first. A job is an errand done round and round:
 * walk to `work`, do the work there, carry what it gave to `drop`, set it down and rest. `work`
 * and `drop` each hold `x`/`y` (where the villager stands) and `facing` (1 west or 2 east: the
 * work pictures only face sideways). `work.clip` says what the work looks like: `chop` (swing an
 * axe), `mine` (swing a pickaxe) or `pickup` (bend down and lift a bundle).
 *
 * `needs` names the supply a job works on (an id from `SUPPLIES`). While the player has gathered
 * that supply and it has not grown back, the job can't be done, and the villager does the next
 * one on the list instead. The last job needs nothing, so there is always something to do.
 *
 * Maren chops in the village and carries logs home; Bram breaks stone and carries a crate to the
 * workshop. Their work spots no longer hold a supply node (the rock and log were taken out of
 * Hollowstead Square), so these two just do the work for show, round and round.
 * Tilly lifts wheat sheaves at the south edge of the village and carries them to the square.
 * tests/world/npcs.test.js checks every spot is clear and can be walked to.
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
    jobs: [
      {
        work: { clip: 'chop', x: 14540, y: 9366, facing: 1 },
        drop: { x: 14180, y: 9250, facing: 1 },
      },
      {
        work: { clip: 'pickup', x: 14180, y: 9250, facing: 1 },
        drop: { x: 14560, y: 9470, facing: 2 },
      },
    ],
  },
  {
    id: 'stoneworker',
    name: 'Bram',
    role: 'Stoneworker',
    row: 1,
    x: 14660,
    y: 9560,
    facing: 1,
    jobs: [
      {
        work: { clip: 'mine', x: 14330, y: 9362, facing: 1 },
        drop: { x: 14620, y: 9580, facing: 2 },
      },
      {
        work: { clip: 'pickup', x: 14620, y: 9580, facing: 2 },
        drop: { x: 14380, y: 9520, facing: 1 },
      },
    ],
  },
  {
    id: 'grower',
    name: 'Tilly',
    role: 'Grower',
    row: 2,
    x: 14090,
    y: 9660,
    facing: 2,
    jobs: [
      {
        work: { clip: 'pickup', x: 14120, y: 9800, facing: 2 },
        drop: { x: 14200, y: 9540, facing: 2 },
      },
    ],
  },
];
