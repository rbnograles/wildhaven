// The field journal's pages: what the player learns at each named place, the keepsake they take
// away, and a trail clue that points to the place. Only Pinefall Woods has pages for now; this is
// a prototype to test whether a find that "pays" makes players chase the next one (build 2).

/**
 * Journals by region id. Each one has:
 * - `intro`: one line shown at the top of the journal for that region.
 * - `trail`: landmark ids in the order the clues lead the player round the region.
 * - `pages`: by landmark id. `text` is what the page says (two or three short sentences),
 *   `keepsake` names the small thing the player takes away, `sprite` is the objects.json key
 *   drawn as its stand-in icon, and `hint` is the clue shown while this place is the next one on
 *   the trail. Hints point from fixed things (the camp, signposts, a compass direction), never
 *   from the place the player happens to be standing in, because places can be found in any order.
 */
// Parked for Spring Country: the Pinefall Woods prototype below was written for the old seven-region
// world, so no region's pages are active yet. Spring's own journal content is authored later (build 2).
// The prototype data is kept (unused) so it can be re-themed to a Spring district when that happens.
export const JOURNALS = {};

const PINEFALL_PROTOTYPE = {
  pinefall: {
    intro: 'A scout mapped these woods before you and left the notebook half full.',
    trail: ['p-camp', 'p-hollow', 'p-grandfather', 'p-stones', 'p-clearing', 'p-ledge', 'p-pond'],
    pages: {
      'p-camp': {
        text: 'A canvas tent, a fallen log to sit on and a pack of trail notes. Whoever camped here wrote down every place worth finding nearby.',
        keepsake: 'Trail notebook',
        sprite: 'tent',
        hint: 'The trail begins at the Scout’s camp, a canvas tent in the north of Pinefall Woods.',
      },
      'p-hollow': {
        text: 'A pine so old it fell and kept going, hollowed out by a hundred years of rain. Owls nest in the dry end.',
        keepsake: 'Owl feather',
        sprite: 'log',
        hint: 'A fallen giant lies hollow a short walk north-west of the Scout’s camp.',
      },
      'p-grandfather': {
        text: 'The tallest tree in Pinefall. Initials are carved into its bark at shoulder height, the newest by hands you will never meet.',
        keepsake: 'Giant pinecone',
        sprite: 'pines',
        hint: 'The oldest pine in the woods towers to the west, north of the West Trail signpost.',
      },
      'p-stones': {
        text: 'Seven stones in a ring, green to the knee with moss. Nobody remembers who set them, but every traveller leaves a pebble on the tallest.',
        keepsake: 'Moss-green pebble',
        sprite: 'rocks-a',
        hint: 'Mossy standing stones ring a glade south-west of the camp, below the West Trail signpost.',
      },
      'p-clearing': {
        text: 'A bright gap in the pines where deer come to graze at dawn. Step softly and they let you watch.',
        keepsake: 'Shed antler',
        sprite: 'dead-bush',
        hint: 'Deer graze in an open clearing south-east of the camp, east of the Pinefall signpost.',
      },
      'p-ledge': {
        text: 'A wall of grey rock where the woods end and the wind begins. From the top you can see snow on the peaks to the east.',
        keepsake: 'Wind-polished stone',
        sprite: 'cliff-rock',
        hint: 'A cliff stands on the eastern edge of the woods, north-east of the deer clearing.',
      },
      'p-pond': {
        text: 'A round pond so calm it holds the sky. Skipping stones here is a local custom; the record is nine bounces.',
        keepsake: 'Flat skipping stone',
        sprite: 'beach-rock',
        hint: 'Still water sits in a hollow north-east of the camp, north of the cliff on the woods’ edge.',
      },
    },
  },
};
