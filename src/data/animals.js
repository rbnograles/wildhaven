// The animals of the wild: deer, rabbits and boars. Where each kind lives, how big a herd is, how fast
// it walks and runs, and what hunting one gives. How animals behave is game balance in balance.js;
// where the herds are is world/animals.js, and moving them is actions/animals.js.

/**
 * Every kind of animal.
 *
 * Fields: `name` is the word used in messages; `regions` are the region ids it lives in; `herd` is
 * the smallest and largest number in one herd; `walk` and `run` are its speeds in world units per
 * second; `food` is what hunting one gives; `antler` is the chance it also gives an antler (deer only).
 */
export const ANIMALS = {
  deer: {
    name: 'deer',
    regions: ['pinefall', 'meadows', 'frostpeak'],
    herd: [3, 5],
    walk: 45,
    run: 230,
    food: 5,
    antler: 0.5,
  },
  rabbit: {
    name: 'rabbit',
    regions: ['meadows', 'lagoon', 'pinefall'],
    herd: [1, 2],
    walk: 30,
    run: 200,
    food: 2,
    antler: 0,
  },
  boar: {
    name: 'boar',
    regions: ['jungle', 'pinefall', 'canyons'],
    herd: [1, 3],
    walk: 35,
    run: 170,
    food: 6,
    antler: 0,
  },
};

/** The animal kinds alone, such as 'deer'. */
export const ANIMAL_KINDS = Object.keys(ANIMALS);
