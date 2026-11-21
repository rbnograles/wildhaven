// The animals of the wild: deer, rabbits and boars. Where each kind lives, how big a herd is, how fast
// it walks and runs, and what hunting one gives. How animals behave is game balance in balance.js;
// where the herds are is world/animals.js, and moving them is actions/animals.js.

/**
 * Every kind of animal.
 *
 * Fields: `name` is the word used in messages; `regions` are the region ids it lives in; `herd` is
 * the smallest and largest number in one herd; `walk` and `run` are its speeds in world units per
 * second; `food` is what hunting one gives; `leather` is how many pieces of leather its hide gives
 * (the backpack is made of it); `antler` is the chance it also gives an antler (deer only); `hp` is
 * how many points of damage it takes to fell (higher-tier weapons deal more per hit).
 */
export const ANIMALS = {
  deer: {
    name: 'deer',
    regions: ['driftwood-landing', 'greenbough-camp', 'hollowstead'],
    herd: [3, 5],
    walk: 45,
    run: 230,
    food: 5,
    leather: 2,
    antler: 0.5,
    hp: 4,
  },
  rabbit: {
    name: 'rabbit',
    regions: [
      'alder-rest',
      'blossom-crossroads',
      'driftwood-landing',
      'hollowstead',
      'pinefall-camp',
      'stonebrook-hamlet',
    ],
    herd: [1, 2],
    walk: 30,
    run: 200,
    food: 2,
    leather: 1,
    antler: 0,
    hp: 2,
  },
  boar: {
    name: 'boar',
    regions: ['blossom-crossroads', 'driftwood-landing', 'hollowstead', 'stonebrook-hamlet'],
    herd: [1, 3],
    walk: 35,
    run: 170,
    food: 6,
    leather: 2,
    antler: 0,
    hp: 6,
  },
};

/** The animal kinds alone, such as 'deer'. */
export const ANIMAL_KINDS = Object.keys(ANIMALS);
