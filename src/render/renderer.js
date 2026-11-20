// The renderer: everything that draws the world on screen.
// Phaser draws the world (tile layers, object sprites, character); game rules live in src/actions/
// and src/world/, input in src/core/input.js. This file also paints the minimap through render/maps.js.

import * as Phaser from 'phaser';
import { WORLD, objectScale } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { LANDMARKS, WRECKS } from '../data/places.js';
import { VILLAGERS, villagerPose } from '../world/npcs.js';
import { WILD } from '../data/supplies.js';
import { FIRE_RADIUS, NPC_NOTICE } from '../data/balance.js';
import { drawMap, MINI_VIEWS, miniZoom } from './maps.js';
import { createLighting } from './lighting.js';
import { createSnow } from './snow.js';
import { preloadFootprints, createFootprints } from './footprints.js';
import { isAvailable } from '../actions/gather.js';
import { toolTier } from '../world/tools.js';
import { chooseInteraction } from '../actions/interact.js';
import { loadCharacterSheets, loadImage, resolvePose } from '../animation/sheets.js';
import { actionProgress, CLIPS } from '../animation/clips.js';
import { waterBlend } from '../animation/water.js';
import mapData from '../../assets/world/map/wildhaven.json';
import objectSpecs from '../../assets/world/source/objects.json';
import animSpecs from '../../assets/world/animations/animations.json';
import overviewUrl from '../../assets/world/map/overview.webp';
import tentSleepUrl from '../../assets/world/buildings/tent-sleep.png';
import tentSleepSpec from '../../assets/world/buildings/tent-sleep.json';
import creatureSpecs from '../../assets/world/creatures/creatures.json';
import { WILD_ANIMALS } from '../world/animals.js';
import { WOLVES } from '../world/wolves.js';
import { BUILDINGS, buildingInfo, buildingSprite } from '../data/buildings.js';
import { readBuildTarget, BUILDING_PREFIX, FARM_PREFIX } from '../actions/building.js';
import slotUrl from '../../assets/ui/game/item-slot.png';

// Tileset picture name (`tileset.png`, and the ground and path kits tools/import-tiled-world.py copies
// next to it) → the URL Vite serves it from. The map file lists which of them it uses.
const tilesetUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/map/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+\.png)$/)[1], url]),
);

// Object sprite name (the PNG file name without `.png`) → the URL Vite serves it from.
// Sprites sit in kind folders (objects/trees/, objects/rocks/, ...), but only the file name is kept,
// because objects.json and the map name sprites without their folder. tests/world/objects.test.js
// checks no two folders hold the same name.
// The field journal (ui/journal.js) borrows these for its stand-in keepsake pictures.
export const objectUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/source/objects/*/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.png$/)[1], url]),
);

// Animal name → the URL of its flip-book sheet (assets/world/creatures/, made by
// tools/prepare-creature-art.py): a row per state, every picture facing east.
const creatureUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/creatures/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.png$/)[1], url]),
);

// Character id → the URL of their rowing sheet (assets/characters/<id>/<id>-rowboat.png, packed by
// tools/prepare-rowing-art.py): the whole boat with the character rowing it. Rows are bow east,
// bow north, bow south; four oar-stroke pictures each.
const rowingUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/characters/*/*-rowboat.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w]+)-rowboat\.png$/)[1], url]),
);

// Animated sprite name → the URL of its flip-book sheet (assets/world/animations/, made by
// tools/prepare-sprite-art.py). animations.json says how big one frame is and where its ground point is.
const animUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/animations/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.png$/)[1], url]),
);

// Tool picture name ("axe-stone", "pickaxe-iron", ...) → its URL, for the badge over a tree or rock
// under the mouse. They are the HUD's own painted tools (assets/ui/game/, cut by
// tools/prepare-sprite-art.py).
const toolUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/ui/game/tool-*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/tool-([\w-]+)\.png$/)[1], url]),
);

// Resource name ("wood", "stone", "food", "herbs", "feather", "pinecone", "antler") → the URL of its painted item picture, for the
// badge over something picked by hand (berries, small stones, flowers, driftwood) under the mouse.
const itemUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob(
      '../../assets/ui/game/item-{wood,stone,food,herbs,feather,pinecone,antler}.png',
      {
        eager: true,
        query: '?url',
        import: 'default',
      },
    ),
  ).map(([path, url]) => [path.match(/item-([\w-]+)\.png$/)[1], url]),
);

// Moving water (see WATER_LAYERS): WATER_DRIFT is how far the drifting copy strays, in world
// units: small enough that the painted bank (56 units wide) always hides its edge on the shore.
// WATER_SWELL_SECONDS is the time for one trip round the circle.
const WATER_DRIFT = 9;
const WATER_SWELL_SECONDS = 7;

// The badge over the thing under the mouse (the tool a tree or rock needs, or what a hand-picked
// patch gives): how many screen-sized units wide its dark slot is drawn, and how see-through the
// badge is in each aim state (see aimState in actions/gather.js). One too far to work on is faint;
// one whose tool is missing stays clear, because its crossed-out tool is the message. A tent under
// the mouse shows "Zz" in the same slot, faint while it is too far or too early in the day ('day').
const BADGE_SIZE = 46;
const BADGE_ALPHA = { ready: 1, far: 0.7, locked: 1, day: 0.7 };

// Berries, small stones and flowers are tiny pictures, so the mouse counts as over one anywhere in
// a box at least this many world units wide and tall around it. Otherwise they are fiddly to hit.
const HOVER_MIN = 56;

// How far above the player's feet (world units) the progress bar sits while they pick something
// by hand: just clear of the head of the bending picture (about PLAYER_HEIGHT plus a little).
const BAR_OVER_HEAD = 82;

// What a gathered supply plays before it fades, by how many rows its sheet has: a tree (3 rows)
// falls and breaks into firewood (frames 4-11), a rock (1 row) cracks into rubble (frames 0-3).
// `hold` is how many seconds the last picture stays before the fade starts.
const BREAK = {
  3: { frames: [4, 5, 6, 7, 8, 9, 10, 11], fps: 8, hold: 0.7 },
  1: { frames: [0, 1, 2, 3], fps: 6, hold: 0.7 },
};

// A tent shows the player asleep inside it while they nap within this many world units of it, and
// the sleeping sheet's rows are the characters in this order.
const SLEEP_IN_TENT = 400;
const SLEEP_ROWS = ['scout', 'builder', 'survivor'];

// How much wider and taller the sleeping picture is drawn than the tent's own draw size, so the
// tent keeps its size when the player lies down in it. The sleeping frames were painted smaller and
// narrower: the tent in them is 150×153 px, and the standing tent's picture is 203×177 px.
const SLEEP_FIT = [203 / 150, 177 / 153];

// Animals farther than this from the middle of the screen (world units, either way) are not drawn.
const ANIMAL_VIEW = 1400;

// How many flame pictures the campfire shows per second.
const FIRE_FPS = 8;

/**
 * Says how far into its loop a water ripple at (x, y) starts.
 *
 * Without this every ripple would show the same picture at the same moment, like a row of clocks
 * ticking together. The position is scrambled into a number, so neighbours are out of step.
 *
 * @param {number} x - The ripple's world x.
 * @param {number} y - The ripple's world y.
 * @returns {number} A head start in frames, from 0 up to (not including) 4.
 */
const rippleStart = (x, y) => (Math.abs(Math.sin(x * 12.9898 + y * 78.233)) * 4000) % 4;

// The map's tile layers, bottom to top: the ground terrains, then the painted banks along the
// water's edge and the cliffs (lips, walls and their shadows) over them. Each one is painted over the one before. tools/build-map.py decides the order.
// A hidden layer is left out: a map brought in from Tiled keeps the game's own ground layers hidden, for
// collision only, and draws Tiled's ground layers instead.
const TILE_LAYERS = mapData.layers
  .filter((l) => l.type === 'tilelayer' && l.visible !== false)
  .map((l) => l.name);

// Moving water: a see-through copy of each of these tile layers drifts in a small circle over the
// real one, so the painted waves seem to swell (see WATER_DRIFT). The game's own map calls them
// 'water' and 'deep'; a map from Tiled calls them '02 water' and '01 deep'.
const WATER_LAYERS = TILE_LAYERS.filter((name) => /(^| )(water|deep)$/.test(name));

// How tall the player (and every villager) is drawn on screen, in world units. It was 112, which made
// people about one and a half times as tall as a house door; at 76 they fit through the doors.
const PLAYER_HEIGHT = 76;

// The soft shadow under a person's feet: width and height in world units, sized to PLAYER_HEIGHT.
const SHADOW = [26, 10];

// Footpaths are drawn just above the ground tiles and under every other flat thing (those are at -1).
const PATH_DEPTH = -1.5;

// How far above a villager's head their name floats, in world units.
const NAME_GAP = 10;

// The size of one picture on a rowing sheet, in pixels (CELL in tools/prepare-rowing-art.py).
const ROWING_CELL = [320, 300];

// How big a rowing picture is drawn: the sheets are painted at twice the game's size, which makes
// the hull 150 world units long and the sitting character a little shorter than a standing one.
const ROWING_SCALE = 0.5;

// Which row of the rowing sheet shows the boat heading each way (0 south, 1 west, 2 east, 3 north).
// West is the east row mirrored.
const ROWING_ROW = [2, 0, 0, 1];

// How many oar-stroke pictures show each second while the boat moves.
const ROWING_FPS = 6;

// The empty boat's picture is drawn this much smaller, so its hull is as long as the rowed one.
const MOORED_SCALE = 0.75;

// Scenery is grouped into squares this many world units wide; only squares near the camera are shown.
const CHUNK = 1024;

// How far past the screen edge scenery is still shown, so a tall tree just off screen doesn't pop in.
const CULL_MARGIN = 640;

/**
 * Loads the small pictures the maps show on their markers.
 *
 * The maps are plain 2D canvases, not part of the Phaser scene, so they need their own copies of
 * a few sprites: the signpost, campfire and boats, and whatever stands at each named place. A
 * picture that fails to load is simply left out (its marker shows a flag or an empty badge),
 * because a missing map icon must never stop the game from starting.
 *
 * @returns {Promise<Object<string, HTMLImageElement>>} Sprite name to its loaded picture.
 */
async function loadMapIcons() {
  const names = new Set(['signpost', 'campfire', 'old-boat', 'rowboat']);
  for (const place of LANDMARKS) if (place.object) names.add(place.object);

  const icons = {};
  await Promise.all(
    [...names].map(async (name) => {
      if (!objectUrls[name]) return;
      try {
        icons[name] = await loadImage(objectUrls[name], 'map icons');
      } catch {
        // Left out on purpose: see above.
      }
    }),
  );
  return icons;
}

/**
 * Loads all the artwork and builds the Phaser scene that draws the world.
 *
 * Think of it as setting up a stage: lay down the ground, place every tree and rock, put the
 * supplies out, and stand the actor (the player) in the middle. Loading has a 20-second time
 * limit, and any failure rejects with a friendly message so the loading screen can offer a retry.
 *
 * @param {HTMLElement} container - The page element the game canvas goes into.
 * @param {HTMLCanvasElement} miniCanvas - The small canvas for the minimap in the corner.
 * @returns {Promise<object>} The renderer: `draw(state, dt, animator, build)` for each frame,
 *   `drawMap(canvas, state)` for the big map, `screenToWorld(clientX, clientY)` for the build
 *   ghost, `nodesAt(clientX, clientY, state)` for the trees and rocks under the mouse,
 *   `tentAt(clientX, clientY, state)` for the player's tent under it, and
 *   `resetCamera()` after switching characters.
 */
export async function createRenderer(container, miniCanvas) {
  const mini = miniCanvas.getContext('2d');
  if (!mini)
    throw new Error(
      'This browser does not support the game canvas. Please try a current desktop browser.',
    );

  const [overview, sheets, mapIcons] = await Promise.all([
    loadImage(overviewUrl, 'world map'),
    loadCharacterSheets(),
    loadMapIcons(),
  ]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The camera's own position, which glides after the player instead of jumping.
  const camera = { x: 0, y: 0, initialized: false };

  // Where the boat was last frame, and how long it has been rowed, to move the oars only while it moves.
  const rowed = { x: 0, y: 0, time: 0 };

  // Scene objects filled in by create() below. `snap` makes the next draw skip fade animations.
  // `chunks` maps a chunk key to the scenery images in it; `shown` holds the keys now visible.
  // `fires` maps "<character>:<camp id>" to that camp's campfire sprite.
  // `villagers` holds one {villager, sprite, shade, label} per villager of Hollowstead village.
  // `reach` is how tall a standing villager is drawn, for placing the name over their head.
  let player,
    shadow,
    villagers,
    reach,
    supplies,
    boat,
    rower,
    cue,
    bar,
    badge,
    ghost,
    ring,
    lighting,
    snow,
    footprints,
    webgl = false,
    snap = true,
    shown = new Set();
  // `loopers` holds, per chunk key, the water ripples that play round and round. `clock` counts the
  // seconds drawn. Standing trees show one still picture: their sheets have sway frames, but the
  // sway looked odd in play, so it was taken out (the fall and break frames are still used).
  // `built` maps "<character>:<building id>" to that camp building's picture; `site` is the picture
  // of a building going up while the player works on it.
  const chunks = new Map(),
    loopers = new Map(),
    fires = new Map(),
    built = new Map(),
    // `beasts` maps an animal's id to its picture, made the first time it comes near the camera.
    beasts = new Map();
  let site = null;
  let clock = 0;
  // The drifting copies of the water layers (see WATER_LAYERS); empty with reduced motion.
  const swells = [];

  // Trees and rocks a tool can harvest: `sceneryNodes` maps a node id to its node; `harvest` maps
  // it to its drawn entry ({node, sprite, glow, top}), and `harvestChunks` lists the entries in
  // each scenery chunk, so draw() only fades the ones on screen. `litTree` is the one glowing now.
  const sceneryNodes = new Map(NODES.filter((n) => n.inScenery).map((n) => [n.id, n])),
    harvest = new Map(),
    harvestChunks = new Map();
  let litTree = null;

  const scene = await new Promise((resolve, reject) => {
    // On timeout, run fail() so the half-built game is destroyed too; a leftover canvas would cover
    // the new one on "Try again". The game always exists by then: 20 s is long after it was made.
    const timer = setTimeout(
      () => fail('The world took too long to load. Please try again.'),
      20000,
    );

    /**
     * Stops loading, throws away the half-built game, and reports the error.
     *
     * @param {string} message - The friendly message to show on the loading screen.
     */
    const fail = (message) => {
      clearTimeout(timer);
      game.destroy(true);
      reject(new Error(message));
    };

    /** The one Phaser scene: it loads the artwork, then places everything in the world. */
    class WorldScene extends Phaser.Scene {
      /**
       * Asks Phaser to download the tileset and every object sprite.
       *
       * Phaser calls this first and waits until every file has arrived before calling create().
       */
      preload() {
        this.load.on('loaderror', () =>
          fail('We could not load the world artwork. Check the connection and try again.'),
        );
        for (const set of mapData.tilesets)
          this.load.image(`tiles-${set.name}`, tilesetUrls[set.image]);
        this.load.image('ui-slot', slotUrl);
        preloadFootprints(this);
        for (const [name, url] of Object.entries(toolUrls)) this.load.image(`tool-${name}`, url);
        for (const [name, url] of Object.entries(itemUrls)) this.load.image(`item-${name}`, url);
        for (const [name, url] of Object.entries(objectUrls))
          this.load.image(`object-${name}`, url);
        // The animals: one sheet each, cut into even cells (creatures.json says how big).
        for (const [name, url] of Object.entries(creatureUrls))
          this.load.spritesheet(`creature-${name}`, url, {
            frameWidth: creatureSpecs[name].cell[0],
            frameHeight: creatureSpecs[name].cell[1],
          });
        // Each character rowing their boat (prepare-rowing-art.py).
        for (const [name, url] of Object.entries(rowingUrls))
          this.load.spritesheet(`rowing-${name}`, url, {
            frameWidth: ROWING_CELL[0],
            frameHeight: ROWING_CELL[1],
          });
        // Each character asleep inside a tent, a row each (prepare-building-art.py).
        this.load.spritesheet('tent-sleep', tentSleepUrl, {
          frameWidth: tentSleepSpec.cell[0],
          frameHeight: tentSleepSpec.cell[1],
        });
        for (const [name, url] of Object.entries(animUrls))
          this.load.spritesheet(`anim-${name}`, url, {
            frameWidth: animSpecs[name].cell[0],
            frameHeight: animSpecs[name].cell[1],
          });
      }

      /**
       * Builds the world once the artwork has loaded: ground, scenery, supplies, cue, and player.
       *
       * "Depth" decides what is drawn on top, like stacking paper cut-outs. Ground is at the
       * bottom, and standing things use their y position, so whatever is lower on screen
       * (closer to you) covers what is behind it.
       */
      create() {
        // Ground tiles, from the Tiled map file.
        this.cache.tilemap.add('world', {
          format: Phaser.Tilemaps.Formats.TILED_JSON,
          data: mapData,
        });
        const map = this.make.tilemap({ key: 'world' });
        const tiles = mapData.tilesets.map((set) =>
          map.addTilesetImage(set.name, `tiles-${set.name}`),
        );
        TILE_LAYERS.forEach((name, i) => map.createLayer(name, tiles, 0, 0).setDepth(i - 20));

        // Moving water: each water layer gets a see-through twin just above it, which draw() slides
        // round in a small circle. Two copies of the same painted waves, one always a little out of
        // step, read as a slow swell. With reduced motion the water stays still.
        if (!reducedMotion)
          for (const name of WATER_LAYERS) {
            const at = TILE_LAYERS.indexOf(name);
            if (at < 0) continue;
            const rows = map.getLayer(name).data.map((row) => row.map((tile) => tile.index));
            const twin = map.createBlankLayer(`${name}-swell`, tiles, 0, 0);
            twin.putTilesAt(rows, 0, 0, false);
            swells.push(twin.setDepth(at - 20 + 0.5).setAlpha(0));
          }

        // Standing objects sort by their ground line, so the character can walk behind a tree or in front of it.
        // Harvestable wild patches (flowers, driftwood) are skipped here; they are drawn with the supplies below.
        // Trees and rocks stay here, chunk by chunk, but each also gets an entry in `harvest`, so
        // draw() can fade it out when it is chopped or mined and light it up when E would gather it.
        for (const object of map.getObjectLayer('objects').objects) {
          const spec = objectSpecs[object.name];
          if (!spec || WILD[object.name] || !this.textures.exists(`object-${object.name}`))
            continue;
          // A sprite with a flip-book sheet is drawn from it (its first frame is the still picture).
          const anim = animSpecs[object.name];
          const image = this.add
            .image(object.x, object.y, anim ? `anim-${object.name}` : `object-${object.name}`, 0)
            .setOrigin(...(anim ?? spec).origin)
            .setScale((spec.scale ?? 1) * objectScale(object))
            // A piece of footpath lies under the other flat things (small stones, stairs, bridges)
            // and is the only kind of object the map turns, to follow its route.
            .setDepth(spec.flat ? (spec.path ? PATH_DEPTH : -1) : object.y)
            .setAngle(object.rotation ?? 0)
            .setVisible(false);
          const key = `${Math.floor(object.x / CHUNK)},${Math.floor(object.y / CHUNK)}`;
          if (!chunks.has(key)) chunks.set(key, []);
          chunks.get(key).push(image);

          // Water ripples (sheets with a `loop` speed) play round and round while they are on screen.
          // With reduced motion they are left out: a frozen ripple is just a smudge on the water.
          if (anim?.loop) {
            image.setAlpha(0);
            if (!reducedMotion) {
              // Two faint frames overlap so the surface glints change without a hard cut.
              const nextImage = this.add
                .image(object.x, object.y, `anim-${object.name}`, 1)
                .setOrigin(...anim.origin)
                .setScale((spec.scale ?? 1) * objectScale(object))
                .setDepth(image.depth)
                .setAlpha(0)
                .setVisible(false);
              chunks.get(key).push(nextImage);
              if (!loopers.has(key)) loopers.set(key, []);
              loopers
                .get(key)
                .push({ image, nextImage, fps: anim.loop, start: rippleStart(object.x, object.y) });
            }
          }

          // A tree or rock a tool can harvest: the same fields as a supply entry (see below).
          const node = sceneryNodes.get(`${object.name}-${object.x}-${object.y}`);
          if (!node) continue;
          const entry = {
            node,
            sprite: image,
            anim,
            fx: null,
            wasGone: false,
            glow: null,
            top: Math.max(node.y - image.displayHeight * image.originY, node.y - 150),
          };
          harvest.set(node.id, entry);
          if (!harvestChunks.has(key)) harvestChunks.set(key, []);
          harvestChunks.get(key).push(entry);
        }
        // Every tree and rock node should have found its picture; if not, the ids drifted apart.
        console.assert(harvest.size === sceneryNodes.size, 'tree and rock nodes without a picture');

        // Supplies are sprites like the scenery around them; draw() glows the one in reach (WebGL only) and caps it with E.
        // The glow filter is added the first time a supply comes into reach (see glowOf), because the world has
        // hundreds of flower patches and a filter on every one would be slow.
        webgl = this.renderer.type === Phaser.WEBGL;
        // Old boats on the beach are drawn the same way; the one the player repaired fades out.
        supplies = [
          ...NODES.filter((node) => !node.inScenery).map((node) => ({
            node,
            /** True while the supply or patch has nothing to give. */
            gone: (state) => !isAvailable(state, node),
          })),
          ...WRECKS.map((w) => ({
            node: { ...w, sprite: 'old-boat', scale: 1 },
            /** True once this old boat has been repaired and is at sea. */
            gone: (state) => state.boat?.from === w.id,
          })),
        ].map(({ node, gone }) => {
          const spec = objectSpecs[node.sprite],
            anim = animSpecs[node.sprite];
          const sprite = this.add
            .image(node.x, node.y, anim ? `anim-${node.sprite}` : `object-${node.sprite}`, 0)
            .setOrigin(...(anim ?? spec).origin)
            .setScale(node.scale)
            .setDepth(spec.flat ? -1 : node.y);
          // Cue height: the sprite's top, but on a tall tree's canopy rather than its tip, where it would crowd the HUD.
          // `anim` is its flip-book sheet, if it has one; `fx` counts the seconds of its break
          // animation (null when none is playing); `wasGone` remembers last frame's state.
          return {
            node,
            gone,
            sprite,
            anim,
            fx: null,
            wasGone: false,
            glow: null,
            top: Math.max(node.y - sprite.displayHeight * sprite.originY, node.y - 150),
          };
        });

        // The player's own boat, hidden until they have one.
        boat = this.add
          .image(0, 0, 'object-rowboat')
          .setOrigin(...objectSpecs.rowboat.origin)
          .setScale(MOORED_SCALE)
          .setVisible(false);
        // The boat with the player rowing it, shown instead while they are aboard.
        rower = this.add
          .image(0, 0, `rowing-${Object.keys(rowingUrls)[0]}`, 0)
          .setScale(ROWING_SCALE)
          .setVisible(false);

        // The floating "E" key cap over the supply in reach, and the progress bar that replaces it.
        const cap = this.add
          .graphics()
          .fillStyle(0x172e24, 0.3)
          .fillRoundedRect(-12, -10, 24, 24, 6)
          .fillStyle(0xf7f1de, 1)
          .fillRoundedRect(-12, -12, 24, 24, 6)
          .lineStyle(1.5, 0x254432, 1)
          .strokeRoundedRect(-12, -12, 24, 24, 6);
        const key = this.add
          .text(0, 0, 'E', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#254432',
          })
          .setOrigin(0.5)
          .setResolution(2);
        cue = this.add
          .container(0, 0, [cap, key])
          .setDepth(WORLD.height + 1)
          .setVisible(false);
        bar = this.add.graphics().setDepth(WORLD.height + 1);

        // The badge over the thing under the mouse: the item box's dark slot with a painted axe or
        // pickaxe on it (or the wood, stone, food or herbs a hand-picked patch gives), and a red
        // bar across it when the player has no such tool.
        const slot = this.add.image(0, 0, 'ui-slot');
        slot.setScale(BADGE_SIZE / slot.width);
        const tool = this.add.image(0, 0, 'tool-axe-stone');
        tool.setScale((BADGE_SIZE * 0.8) / Math.max(tool.width, tool.height));
        const strike = this.add
          .graphics()
          .lineStyle(5, 0x3a1410, 0.9)
          .lineBetween(-13, -13, 13, 13)
          .lineStyle(3, 0xd9503f, 1)
          .lineBetween(-13, -13, 13, 13);
        // A tent under the mouse has no painted picture of its own, so the slot says "Zz" instead.
        const words = this.add
          .text(0, 0, 'Zz', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '17px',
            fontStyle: 'bold',
            color: '#f7f1de',
          })
          .setOrigin(0.5)
          .setResolution(2)
          .setVisible(false);
        badge = this.add
          .container(0, 0, [slot, tool, strike, words])
          .setDepth(WORLD.height + 1)
          .setVisible(false);
        badge.tool = tool;
        badge.strike = strike;
        badge.words = words;

        /**
         * Registers a character sheet with Phaser and names each frame "row-column".
         *
         * Each character frame is the full sheet column, trimmed vertically, so feet sit on the frame's bottom centre.
         *
         * @param {string} key - The texture name, e.g. 'scout-idle' or 'scout-actions'.
         * @param {object} sheet - A measured sheet: its `image` and `frames[row][col]` boxes.
         */
        const addFrames = (key, sheet) => {
          const texture = this.textures.addImage(key, sheet.image);
          sheet.frames.forEach((row, r) =>
            row.forEach((f, c) => texture.add(`${r}-${c}`, 0, f.x, f.y, f.width, f.height)),
          );
        };
        for (const [id, atlas] of Object.entries(sheets.atlases))
          for (const [name, sheet] of Object.entries(atlas)) addFrames(`${id}-${name}`, sheet);

        // The villagers of Hollowstead: each has a soft shadow and is sorted by their feet like
        // the player, so you can walk in front of or behind them. Their name floats over their
        // head while the player is close. Drawing moves them to where they are each frame.
        for (const [name, sheet] of Object.entries(sheets.settlers))
          addFrames(`settlers-${name}`, sheet);
        reach =
          (PLAYER_HEIGHT * sheets.settlers.idle.frames[1][0].height) /
          sheets.settlers.idle.referenceHeight;
        villagers = VILLAGERS.map((villager) => {
          const { npc } = villager;
          const shade = this.add.ellipse(0, 0, SHADOW[0], SHADOW[1], 0x172e34, 0.22);
          const sprite = this.add.image(0, 0, 'settlers-idle', `${npc.row}-0`).setOrigin(0.5, 1);
          const label = this.add
            .text(0, 0, `${npc.name} · ${npc.role}`, {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#f7f1de',
              stroke: '#172e24',
              strokeThickness: 4,
            })
            .setOrigin(0.5, 1)
            .setResolution(2)
            .setDepth(WORLD.height + 1)
            .setVisible(false);
          return { villager, sprite, shade, label };
        });

        // The player and the soft shadow under their feet. Drawing switches the player to the
        // chosen character's pose; the scout facing south is only the starting picture.
        shadow = this.add.ellipse(0, 0, SHADOW[0], SHADOW[1], 0x172e34, 0.22);
        player = this.add.image(0, 0, 'scout-idle', '0-0').setOrigin(0.5, 1);

        // The ghost campfire shown while placing one, and the ring of warmth it would give.
        // Both sit above the night layer so they stay visible in the dark.
        ghost = this.add
          .image(0, 0, 'anim-campfire', 0)
          .setOrigin(...animSpecs.campfire.origin)
          .setScale(objectSpecs.campfire.scale ?? 1)
          .setAlpha(0.75)
          .setDepth(WORLD.height + 0.75)
          .setVisible(false);
        ring = this.add.graphics().setDepth(WORLD.height + 0.74);
        // A camp building going up: its construction stage (or its finished picture fading up).
        site = this.add.image(0, 0, `object-${BUILDINGS[0].sprite}`).setVisible(false);

        // The night layer and the light around fires (render/lighting.js).
        lighting = createLighting(this, reducedMotion);
        // Falling snow over the snowy regions (render/snow.js).
        snow = createSnow(this, reducedMotion);
        // The boot prints the player leaves while walking (render/footprints.js).
        footprints = createFootprints(this);
        this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height).setRoundPixels(true);

        clearTimeout(timer);
        resolve(this);
      }
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      backgroundColor: '#507345',
      banner: false,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      input: { keyboard: false, mouse: false, touch: false }, // src/core/input.js handles input through the DOM, not Phaser
      render: { antialias: true },
      scene: WorldScene,
    });
  });

  /**
   * Gives a supply its glow outline, creating it the first time it is needed.
   *
   * @param {object} s - One entry of `supplies` or `harvest`.
   * @returns {object|null} The glow filter, or null on the Canvas renderer, which has no filters.
   */
  function glowOf(s) {
    if (!webgl) return null;
    if (!s.glow) {
      s.sprite.enableFilters();
      s.glow = s.sprite.filters.internal
        .addGlow(0xfff5ce, 3, 0, 1, false, 10, 8)
        .setPaddingOverride(null);
    }
    return s.glow;
  }

  /**
   * Finds the drawn entry of a node that needs a tool: a map tree or rock, or a supply.
   *
   * @param {object} node - The node to look up.
   * @returns {object|null} Its `harvest` or `supplies` entry, or null if it has none.
   */
  const entryOf = (node) =>
    harvest.get(node.id) ?? supplies.find((s) => s.node.id === node.id) ?? null;

  /**
   * Lists the things to gather whose pictures are under a spot on the screen.
   *
   * Everything that can be gathered counts (trees, rocks, supplies, berries, small stones, flowers,
   * driftwood), but only while it stands; old boats do not. A tree or rock picture has empty room
   * round its edges, so a strip at each side is ignored. A hand-picked patch is small, so its box
   * is grown to at least HOVER_MIN instead. Pictures can overlap, like a far palm's leaves over a
   * near one's trunk, so every one under the spot is listed, the one drawn in front (lowest on
   * screen) first; the caller picks among them.
   *
   * @param {number} clientX - Pixels from the left edge of the page.
   * @param {number} clientY - Pixels from the top edge of the page.
   * @param {object} state - The game being played.
   * @returns {object[]} The nodes under that spot, front first (an empty list if none).
   */
  function nodesAt(clientX, clientY, state) {
    const box = scene.game.canvas.getBoundingClientRect();
    const { x, y } = scene.cameras.main.getWorldPoint(clientX - box.left, clientY - box.top);

    /** True when the spot is on this entry's picture and the entry still stands. */
    const under = ({ sprite, node }) => {
      // Old boats sit in the supplies list too, but give no resource: they are not gathered.
      if (!node.type || !isAvailable(state, node)) return false;
      const width = sprite.displayWidth,
        height = sprite.displayHeight,
        left = sprite.x - width * sprite.originX,
        top = sprite.y - height * sprite.originY;

      // How far the box is grown (or, when negative, trimmed) at the sides, the top and the bottom.
      const side = node.tool ? -width * 0.14 : Math.max(0, (HOVER_MIN - width) / 2),
        above = node.tool ? -height * 0.08 : Math.max(0, (HOVER_MIN - height) / 2),
        below = node.tool ? 0 : above;
      return (
        x >= left - side &&
        x <= left + width + side &&
        y >= top - above &&
        y <= top + height + below
      );
    };

    const found = supplies.filter(under);
    for (const key of shown) found.push(...(harvestChunks.get(key) ?? []).filter(under));
    return found.map((entry) => entry.node).sort((a, b) => b.y - a.y);
  }

  /**
   * Finds the player's own tent whose picture is under a spot on the screen.
   *
   * Only tents the player built count (they are the only ones that can be slept in), and the whole
   * picture counts: a tent is big, so there is no need to grow or trim its box.
   *
   * @param {number} clientX - Pixels from the left edge of the page.
   * @param {number} clientY - Pixels from the top edge of the page.
   * @param {object} state - The game being played.
   * @returns {{tent: object, camp: object}|null} The tent and the camp it stands in, or null.
   */
  function tentAt(clientX, clientY, state) {
    const box = scene.game.canvas.getBoundingClientRect();
    const { x, y } = scene.cameras.main.getWorldPoint(clientX - box.left, clientY - box.top);

    for (const camp of state.camps)
      for (const tent of camp.buildings ?? []) {
        const image = tent.kind === 'tent' && built.get(`${state.character}:${tent.id}`);
        if (!image) continue;
        const left = image.x - image.displayWidth * image.originX,
          top = image.y - image.displayHeight * image.originY;
        if (
          x >= left &&
          x <= left + image.displayWidth &&
          y >= top &&
          y <= top + image.displayHeight
        )
          return { tent, camp };
      }
    return null;
  }

  /**
   * Shows a supply, tree or rock as standing or gone this frame.
   *
   * A standing one shows its still picture. One just gathered that has a flip-book sheet falls and
   * breaks apart (a rock cracks to rubble) and only then fades; anything else simply fades out, and
   * fades back in when it grows back.
   *
   * @param {object} s - A `supplies` or `harvest` entry: its `sprite`, `node`, flip-book `anim`, the
   *   seconds `fx` of a break playing (or null), and `wasGone` from the last frame.
   * @param {boolean} gone - True while it has nothing to give.
   * @param {number} dt - Seconds since the last frame.
   * @param {number} step - How far its see-through-ness may change this frame (1 jumps straight there).
   * @param {boolean} quiet - True to skip the break animation (reduced motion, a fresh load, or it
   *   just came on screen).
   */
  function showGone(s, gone, dt, step, quiet) {
    let breaking = false;
    if (s.anim) {
      const act = BREAK[s.anim.rows];
      if (!gone) {
        s.fx = null;
        s.sprite.setFrame(0);
      } else if (!s.wasGone && !quiet) s.fx = 0;
      if (gone && s.fx !== null) {
        s.fx += dt;
        const at = Math.floor(s.fx * act.fps);
        s.sprite.setFrame(act.frames[Math.min(at, act.frames.length - 1)]);
        breaking = s.fx < act.frames.length / act.fps + act.hold;
      }
    }
    s.wasGone = gone;

    if (!breaking)
      s.sprite.setAlpha(
        gone ? Math.max(0, s.sprite.alpha - step) : Math.min(1, s.sprite.alpha + step),
      );
    s.sprite.setVisible(s.sprite.alpha > 0);
  }

  /**
   * Draws one frame: moves the camera, updates supply sprites, and poses the player.
   *
   * The camera follows the player smoothly, like someone filming who walks a step behind.
   * Campfires flicker, and a chopped tree falls and breaks apart before it fades.
   * Supplies fade out when gathered, the one in reach glows with an E above it, and while an
   * action runs a progress bar fills up instead. Camp fires are drawn, the player sprite gets this
   * frame's pose, the build ghost follows the pointer, the tree or rock under the mouse gets its
   * tool badge, the water swells, snow falls in the snowy regions, and the night layer goes over
   * everything.
   *
   * @param {object} state - The game being played.
   * @param {number} dt - Seconds since the last frame.
   * @param {object} animator - The player's animation state (current clip, time, pending action).
   * @param {object|null} [build=null] - Build mode from the session: when `active`, the ghost is
   *   drawn at `x`/`y`, coloured by `check.ok`.
   * @param {{node: object, state: string}|null} [hover=null] - The tree or rock under the mouse
   *   and its aim state ('ready', 'far' or 'locked'), from core/input.js.
   */
  function draw(state, dt, animator, build = null, hover = null) {
    // The game boots while its container is still hidden, so the canvas is sized here once it is on screen.
    const w = container.clientWidth,
      h = container.clientHeight;
    if (w && h && (scene.scale.width !== w || scene.scale.height !== h)) scene.scale.resize(w, h);

    // Camera: zoom out a little on narrow screens, then glide toward the player.
    const view = scene.cameras.main;
    const zoom = view.width < 700 ? 0.9 : 1.08;
    view.setZoom(zoom);
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
    if (!camera.initialized) {
      camera.x = state.player.x;
      camera.y = state.player.y;
      camera.initialized = true;
    }
    camera.x += (state.player.x - camera.x) * smoothing;
    camera.y += (state.player.y - camera.y) * smoothing;
    view.centerOn(camera.x, camera.y);

    // Show only the scenery chunks the camera can see, plus a margin for tall sprites.
    const halfW = view.width / zoom / 2 + CULL_MARGIN,
      halfH = view.height / zoom / 2 + CULL_MARGIN,
      next = new Set();
    for (
      let cy = Math.floor((camera.y - halfH) / CHUNK);
      cy <= Math.floor((camera.y + halfH) / CHUNK);
      cy++
    )
      for (
        let cx = Math.floor((camera.x - halfW) / CHUNK);
        cx <= Math.floor((camera.x + halfW) / CHUNK);
        cx++
      )
        if (chunks.has(`${cx},${cy}`)) next.add(`${cx},${cy}`);
    // Chunks that just came into view; their trees and rocks jump to how they are now (see below).
    const appeared = new Set([...next].filter((key) => !shown.has(key)));
    for (const key of shown)
      if (!next.has(key)) for (const image of chunks.get(key)) image.setVisible(false);
    for (const key of appeared) for (const image of chunks.get(key)) image.setVisible(true);
    shown = next;

    // The clock that the water glints and the camp fires play by.
    clock += dt;

    // The water swells: each twin layer circles its real layer and fades in and out as it goes.
    // The deep sea's twin runs a little behind the shallows', so the two never move as one sheet.
    swells.forEach((twin, n) => {
      const turn = (clock / WATER_SWELL_SECONDS) * Math.PI * 2 + n * 1.3;
      twin
        .setPosition(Math.cos(turn) * WATER_DRIFT, Math.sin(turn) * WATER_DRIFT * 0.6)
        .setAlpha(0.42 + 0.14 * Math.sin(turn * 2));
    });

    // Water glints fade between neighboring pictures, each patch starting at a different phase.
    for (const key of shown)
      for (const ripple of loopers.get(key) ?? []) {
        const blend = waterBlend(clock, ripple.fps, ripple.start);
        ripple.image.setFrame(blend.frame).setAlpha(blend.alpha);
        ripple.nextImage.setFrame(blend.next).setAlpha(blend.nextAlpha);
      }

    // Campfires: one sprite per camp, made when the camp is founded. Keys include the character,
    // so switching characters never reuses another character's fire.
    const fireKeys = new Set(state.camps.map((camp) => `${state.character}:${camp.id}`));
    for (const [key, sprite] of fires)
      if (!fireKeys.has(key)) {
        sprite.destroy();
        fires.delete(key);
      }
    for (const camp of state.camps) {
      const key = `${state.character}:${camp.id}`;
      if (!fires.has(key))
        fires.set(
          key,
          scene.add
            .image(camp.x, camp.y, 'anim-campfire', 0)
            .setOrigin(...animSpecs.campfire.origin)
            .setScale(objectSpecs.campfire.scale ?? 1) // one tile wide, like the map's fires
            .setDepth(camp.y),
        );
    }

    // The flames flicker through their four pictures (one still picture with reduced motion).
    const flame = reducedMotion ? 1 : Math.floor(clock * FIRE_FPS) % 4;
    for (const sprite of fires.values()) sprite.setFrame(flame);

    // Camp buildings: one picture each, showing how it looks now (a full chest, the wheat's stage,
    // the centre's tier). Keys include the character, like the fires'. While the player naps after
    // resting at a camp with a tent, the tent shows them asleep inside it and the player is hidden.
    const builtKeys = new Set();
    let sleepingIn = null;
    for (const camp of state.camps)
      for (const b of camp.buildings ?? []) {
        const key = `${state.character}:${b.id}`;
        builtKeys.add(key);
        if (!built.has(key)) built.set(key, scene.add.image(b.x, b.y, 'object-tent'));
        const image = built.get(key).setPosition(b.x, b.y).setDepth(b.y);
        const asleep =
          b.kind === 'tent' &&
          animator.clip === 'sleep' &&
          Math.hypot(state.player.x - b.x, state.player.y - b.y) < SLEEP_IN_TENT;
        if (asleep) {
          sleepingIn = b;
          const row = SLEEP_ROWS.indexOf(state.character),
            frame = reducedMotion ? 0 : Math.floor(clock * 2) % tentSleepSpec.columns,
            size = buildingInfo('tent').scale * (objectSpecs.tent.scale ?? 1);
          image
            .setTexture('tent-sleep', row * tentSleepSpec.columns + frame)
            .setOrigin(...tentSleepSpec.origin)
            .setScale(size * SLEEP_FIT[0], size * SLEEP_FIT[1]);
        } else {
          const sprite = buildingSprite(b),
            spec = objectSpecs[sprite];
          image
            .setTexture(`object-${sprite}`)
            .setOrigin(...spec.origin)
            .setScale(buildingInfo(b.kind).scale * (spec.scale ?? 1));
        }
      }
    for (const [key, image] of built)
      if (!builtKeys.has(key)) {
        image.destroy();
        built.delete(key);
      }

    // Animals near the camera: the row for what each is doing (grazing, walking, running, lying
    // down), turned to face its way (the art faces east). A hunted one fades out as it lies there.
    // One running up or down the screen as well as sideways shows its north-east or south-east
    // run instead (mirrored for the west side); only running has those pictures.
    // Wolves are drawn the same way, with two rows of their own: the growl (snarl) and the lunge.
    for (const a of [...WILD_ANIMALS, ...WOLVES]) {
      const kind = a.den ? 'wolf' : a.kind;
      const near =
        a.phase !== 'gone' &&
        Math.abs(a.x - camera.x) < ANIMAL_VIEW &&
        Math.abs(a.y - camera.y) < ANIMAL_VIEW;
      let image = beasts.get(a.id);
      if (!near) {
        image?.setVisible(false);
        continue;
      }
      if (!image) {
        image = scene.add.image(a.x, a.y, `creature-${kind}`, 0);
        beasts.set(a.id, image);
      }
      const spec = creatureSpecs[kind],
        slanted =
          a.phase === 'run' && a.slant ? spec.rows[a.slant === 'n' ? 'runNE' : 'runSE'] : null,
        row = slanted ?? spec.rows[spec.rows[a.phase] ? a.phase : 'idle'],
        fps = { run: 10, down: 3, walk: 6, snarl: 5, lunge: 8 }[a.phase] ?? 2,
        step = Math.floor(a.clock * fps),
        frame =
          a.phase === 'down'
            ? Math.min(step, row.frames - 1)
            : reducedMotion && a.phase === 'idle'
              ? 0
              : step % row.frames;
      image
        .setVisible(true)
        .setFrame(row.row * spec.columns + frame)
        .setOrigin(...spec.origin)
        .setFlipX(a.facing === 1)
        .setPosition(a.x, a.y)
        .setDepth(a.y)
        .setAlpha(a.phase === 'down' ? Math.max(0, 1 - Math.max(0, a.clock - 1)) : 1);
    }

    // A building going up shows its stage while the hammering lasts: the tent climbs through its
    // construction pictures; the others, and a centre being raised a tier, fade up from faint.
    const job = readBuildTarget(animator.pending?.target);
    site.setVisible(!!job);
    if (job) {
      const progress = actionProgress(animator);
      let kind = job.kind,
        at = job,
        sprite;
      if (kind === 'raise') {
        const camp = state.camps.find((c) => c.id === job.campId),
          centre = camp?.buildings.find((b) => b.kind === 'centre');
        kind = 'centre';
        at = centre ?? { x: 0, y: 0 };
        sprite = `centre-${Math.min(3, (centre?.tier ?? 0) + 1)}`;
      }
      const info = buildingInfo(kind),
        stages = info.stages;
      sprite ??= stages.length
        ? stages[Math.min(stages.length - 1, Math.floor(progress * stages.length))]
        : info.sprite;
      const spec = objectSpecs[sprite];
      site
        .setTexture(`object-${sprite}`)
        .setOrigin(...spec.origin)
        .setScale(stages.length && sprite !== info.sprite ? 1 : info.scale * (spec.scale ?? 1))
        .setAlpha(stages.length && sprite !== info.sprite ? 1 : 0.3 + 0.7 * progress)
        .setPosition(at.x, at.y)
        .setDepth(at.y + 0.5);
    }

    // Gathered supplies fade out and regrown patches fade back in; switching characters (resetCamera) snaps them to that save instead.
    // What E would do now: a supply or old boat it targets glows with an E cap over it.
    const choice = chooseInteraction(state),
      aimed = choice?.kind === 'gather' || choice?.kind === 'repair' ? choice.target.id : null,
      busy = animator.pending?.target,
      step = reducedMotion || snap ? 1 : dt * 4,
      quiet = reducedMotion || snap;
    let capped = null,
      working = null;
    snap = false;
    for (const s of supplies) {
      const gone = s.gone(state);
      showGone(s, gone, dt, step, quiet);
      // Highlight the supply being worked on, or else the nearest one in reach.
      const target = !gone && (busy ? s.node.id === busy : s.node.id === aimed);
      if (target) {
        const glow = glowOf(s);
        if (glow) glow.active = true;
      } else if (s.glow) s.glow.active = false;
      if (target) {
        if (busy) working = s;
        else capped = s;
      }
    }

    // Trees and rocks on screen fall, break and fade like supplies when chopped or mined, and fade
    // back in when they regrow. One in a chunk that just came into view jumps straight to how it is
    // now instead of animating.
    for (const key of shown) {
      const fresh = appeared.has(key);
      for (const entry of harvestChunks.get(key) ?? [])
        showGone(entry, !isAvailable(state, entry.node), dt, fresh ? 1 : step, quiet || fresh);
    }

    // The tree or rock E would chop or mine (or the one being worked on) glows like a supply, with
    // the E cap over it or the progress bar while the work runs.
    const tree = harvest.get(busy ?? aimed) ?? null;
    if (litTree && litTree !== tree && litTree.glow) litTree.glow.active = false;
    litTree = tree && isAvailable(state, tree.node) ? tree : null;
    if (litTree) {
      const glow = glowOf(litTree);
      if (glow) glow.active = true;
      if (busy) working = litTree;
      else capped = litTree;
    }

    // The player's boat, rocking gently on the water. With the player aboard it is one painted
    // picture of the boat and the rower, with its own art for heading east, north and south (west
    // mirrors east); the oars only move while the boat does. The empty boat has side-on art only,
    // so it always lies sideways, mirrored if it last headed west.
    const bob = reducedMotion ? 0 : Math.sin(performance.now() / 500) * 2;
    boat.setVisible(!!state.boat && !state.aboard);
    rower.setVisible(!!state.boat && state.aboard);
    if (state.boat) {
      const { x, y, dir } = state.boat;
      boat
        .setPosition(x, y + bob)
        .setFlipX(dir === 1)
        .setDepth(y - 1);
      if (state.aboard) {
        if (x !== rowed.x || y !== rowed.y) rowed.time += dt;
        rower
          .setTexture(
            `rowing-${state.character}`,
            ROWING_ROW[dir] * 4 + (Math.floor(rowed.time * ROWING_FPS) % 4),
          )
          .setPosition(x, y + bob)
          .setFlipX(dir === 1)
          .setDepth(y - 1);
      }
      rowed.x = x;
      rowed.y = y;
      if (choice?.kind === 'board') capped = { node: { x, y }, top: y - 40 };
    }

    // The E key cap bobs gently over the supply in reach.
    cue.setVisible(!!capped);
    if (capped)
      cue.setPosition(
        capped.node.x,
        capped.top - 18 + (reducedMotion ? 0 : Math.sin(performance.now() / 260) * 2.5),
      );

    // The badge over the thing under the mouse. A tree or rock shows the tool it needs, in the tier
    // the player owns (stone when they own none), crossed out while they lack it. Something picked
    // by hand shows what it gives (berries show food, flowers herbs). It sits above the E cap, and
    // gives way to the progress bar on the one being worked on. One of the player's tents under the
    // mouse shows "Zz" in the same slot: it can be slept in.
    const pointed = hover?.node && hover.node.id !== busy ? entryOf(hover.node) : null,
      tentImage = hover?.tent ? built.get(`${state.character}:${hover.tent.id}`) : null,
      over = pointed
        ? { x: pointed.node.x, top: pointed.top }
        : tentImage
          ? { x: tentImage.x, top: tentImage.y - tentImage.displayHeight * tentImage.originY }
          : null;
    badge.setVisible(!!over);
    if (over) {
      const locked = hover.state === 'locked';
      badge.tool.setVisible(!!pointed);
      badge.words.setVisible(!pointed);
      if (pointed) {
        const { tool, type } = hover.node,
          picture = tool ? `tool-${tool}-${toolTier(state, tool) ?? 'stone'}` : `item-${type}`;
        // The pictures are different sizes, so each is fitted to the slot when it is put on.
        if (badge.tool.texture.key !== picture) {
          badge.tool.setTexture(picture);
          badge.tool.setScale((BADGE_SIZE * 0.8) / Math.max(badge.tool.width, badge.tool.height));
        }
        badge.tool.setAlpha(locked ? 0.75 : 1);
      }
      badge.strike.setVisible(locked);
      badge
        .setAlpha(BADGE_ALPHA[hover.state])
        .setScale(1 / zoom)
        .setPosition(
          over.x,
          over.top -
            (pointed && capped === pointed ? 62 : 30) / zoom +
            (reducedMotion || hover.state !== 'ready'
              ? 0
              : Math.sin(performance.now() / 260) * 2.5),
        );
    }

    // The progress bar fills up while a timed action runs.
    bar.clear();
    const target = animator.pending?.target ?? '';
    if (!working && (target.startsWith(BUILDING_PREFIX) || target.startsWith(FARM_PREFIX))) {
      // Building and farming have no node to float over, so the bar sits above the player's head.
      const w = 64,
        x = state.player.x - w / 2,
        y = state.player.y - BAR_OVER_HEAD,
        progress = actionProgress(animator);
      bar.fillStyle(0x254432, 0.88).fillRoundedRect(x - 2, y - 2, w + 4, 13, 6.5);
      if (progress > 0)
        bar.fillStyle(0xf7f1de, 1).fillRoundedRect(x, y, Math.max(9, w * progress), 9, 4.5);
    }
    if (working) {
      // Over a tree or rock the bar floats above it. Something picked by hand is low and the
      // player kneels right beside it, so there the bar goes above the player's head instead of
      // across their face.
      const byHand = !working.node.tool && working.node.type && !state.aboard,
        w = 64,
        x = (byHand ? state.player.x : working.node.x) - w / 2,
        y = byHand ? state.player.y - BAR_OVER_HEAD : working.top - 24,
        progress = actionProgress(animator);
      bar.fillStyle(0x254432, 0.88).fillRoundedRect(x - 2, y - 2, w + 4, 13, 6.5);
      if (progress > 0)
        bar.fillStyle(0xf7f1de, 1).fillRoundedRect(x, y, Math.max(9, w * progress), 9, 4.5);
    }

    // A timed action is longer than one pass of its clip, so it loops until the action ends.
    // A `once` action (the collapse) holds its last picture instead: nobody falls down twice.
    const pose = resolvePose(
      sheets,
      state.character,
      animator.clip,
      animator.time,
      state.player.direction,
      animator.pending && !CLIPS[animator.clip]?.once ? true : undefined,
      animator.diagonal,
    );
    // Pin the sprite at its anchor (mirrored when the pose is flipped), with feet on the ground.
    const pivot = (pose.frame.anchorX - pose.frame.x) / pose.frame.width;
    player
      .setTexture(pose.key, pose.name)
      .setOrigin(pose.flip ? 1 - pivot : pivot, 1)
      .setFlipX(pose.flip)
      .setScale(PLAYER_HEIGHT / pose.sheet.referenceHeight)
      .setDepth(state.player.y)
      // Aboard, the rowing picture already shows the character sitting in the boat.
      .setVisible(!sleepingIn && !state.aboard)
      .setPosition(state.player.x, state.player.y + 4 - PLAYER_HEIGHT * pose.lift);
    shadow
      .setVisible(!state.aboard && !sleepingIn)
      .setPosition(state.player.x, state.player.y - 1)
      .setDepth(state.player.y - 0.5);

    // Villagers turn to look at the player when they come close, and show their name then.
    // A busy one shows the pictures for what they are doing (see villagerPose).
    for (const { villager, sprite, shade, label } of villagers) {
      const { npc, x, y } = villager,
        { sheet: name, column, flip } = villagerPose(villager, state.player),
        sheet = sheets.settlers[name],
        frame = sheet.frames[npc.row][column],
        pivot = (frame.anchorX - frame.x) / frame.width;

      sprite
        .setTexture(`settlers-${name}`, `${npc.row}-${column}`)
        .setOrigin(flip ? 1 - pivot : pivot, 1)
        .setFlipX(flip)
        .setScale(PLAYER_HEIGHT / sheet.referenceHeight)
        .setPosition(x, y + 4)
        .setDepth(y);
      shade.setPosition(x, y - 1).setDepth(y - 0.5);
      label
        .setPosition(x, y - reach - NAME_GAP)
        .setVisible(
          Math.hypot(state.player.x - x, state.player.y - y) <= NPC_NOTICE && !state.aboard,
        );
    }

    // The ghost campfire while placing one: tinted green where it may stand and red where it may
    // not, with a ring showing how far a new fire's warmth reaches.
    ring.clear();
    ghost.setVisible(!!build?.active);
    if (build?.active) {
      const ok = !!build.check?.ok,
        fire = !build.kind || build.kind === 'campfire';
      if (fire)
        ghost
          .setTexture('anim-campfire', 0)
          .setOrigin(...animSpecs.campfire.origin)
          .setScale(objectSpecs.campfire.scale ?? 1);
      else {
        // A building's ghost is its finished picture (a tent, a closed chest, an empty bed...).
        const info = buildingInfo(build.kind),
          spec = objectSpecs[info.sprite];
        ghost
          .setTexture(`object-${info.sprite}`)
          .setOrigin(...spec.origin)
          .setScale(info.scale * (spec.scale ?? 1));
      }
      ghost.setPosition(build.x, build.y).setTint(ok ? 0xb6f0a0 : 0xff8a7a);
      if (fire)
        ring
          .lineStyle(2, ok ? 0xf7f1de : 0xff8a7a, 0.85)
          .strokeCircle(build.x, build.y, FIRE_RADIUS);
    }

    // Walking leaves boot prints on the ground, which fade after a few seconds.
    footprints.draw(state, dt);

    // Snow falls over the screen while the player is in a snowy region.
    snow.draw(state, dt, camera, zoom);

    // Night: the dark layer covers what the camera sees. The camera stops at the world's edge,
    // so the covered area is kept inside the world the same way.
    const seenW = view.width / zoom / 2,
      seenH = view.height / zoom / 2;
    lighting.draw(state, {
      x: Math.min(Math.max(camera.x, seenW), WORLD.width - seenW) - seenW,
      y: Math.min(Math.max(camera.y, seenH), WORLD.height - seenH) - seenH,
      width: seenW * 2,
      height: seenH * 2,
    });

    // The minimap's arrow tilts while the player walks diagonally, like the character does.
    drawMap(mini, overview, state, miniCanvas.width, miniCanvas.height, {
      view: MINI_VIEWS[miniZoom()],
      diagonal: animator.diagonal,
      icons: mapIcons,
    });
  }

  return {
    draw,

    /**
     * Paints the world map onto any canvas, at that canvas's own size.
     *
     * @param {HTMLCanvasElement} canvas - The canvas to paint, e.g. the big map dialog's.
     * @param {object} state - The game being played.
     */
    drawMap: (canvas, state) =>
      drawMap(canvas.getContext('2d'), overview, state, canvas.width, canvas.height, {
        icons: mapIcons,
      }),

    /**
     * Turns a spot on the screen (such as the mouse) into a spot in the world.
     *
     * @param {number} clientX - Pixels from the left edge of the page.
     * @param {number} clientY - Pixels from the top edge of the page.
     * @returns {{x: number, y: number}} The world position under that spot.
     */
    screenToWorld: (clientX, clientY) => {
      const box = scene.game.canvas.getBoundingClientRect();
      const point = scene.cameras.main.getWorldPoint(clientX - box.left, clientY - box.top);
      return { x: point.x, y: point.y };
    },

    nodesAt,
    tentAt,

    /**
     * Makes the next frame jump straight to the player instead of gliding there.
     *
     * Used after switching characters, so the camera doesn't fly across the map and supplies
     * show their saved state at once instead of fading.
     */
    resetCamera: () => {
      camera.initialized = false;
      snap = true;
    },
  };
}
