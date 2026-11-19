// The renderer: everything that draws the world on screen.
// Phaser draws the world (tile layers, object sprites, character); game rules live in src/actions/
// and src/world/, input in src/core/input.js. This file also paints the minimap through render/maps.js.

import * as Phaser from 'phaser';
import { WORLD } from '../world/map.js';
import { NODES } from '../world/nodes.js';
import { WRECKS } from '../data/places.js';
import { WILD } from '../data/supplies.js';
import { FIRE_RADIUS } from '../data/balance.js';
import { drawMap } from './maps.js';
import { createLighting } from './lighting.js';
import { createSnow } from './snow.js';
import { isAvailable } from '../actions/gather.js';
import { chooseInteraction } from '../actions/interact.js';
import { loadCharacterSheets, loadImage, resolvePose } from '../animation/sheets.js';
import { actionProgress } from '../animation/clips.js';
import mapData from '../../assets/world/map/wildhaven.json';
import objectSpecs from '../../assets/world/source/objects.json';
import animSpecs from '../../assets/world/animations/animations.json';
import tilesetUrl from '../../assets/world/map/tileset.png';
import overviewUrl from '../../assets/world/map/overview.webp';

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

// Wind: a tree stands still most of the time, then leans left, back, and right. These are the
// sheet columns for each step of that, played at SWAY_FPS steps a second.
const SWAY = [1, 2, 3, 0, 0, 0, 0, 0, 0, 0];
const SWAY_FPS = 3;

// What a gathered supply plays before it fades, by how many rows its sheet has: a tree (3 rows)
// falls and breaks into firewood (frames 4-11), a rock (1 row) cracks into rubble (frames 0-3).
// `hold` is how many seconds the last picture stays before the fade starts.
const BREAK = {
  3: { frames: [4, 5, 6, 7, 8, 9, 10, 11], fps: 8, hold: 0.7 },
  1: { frames: [0, 1, 2, 3], fps: 6, hold: 0.7 },
};

// How many flame pictures the campfire shows per second.
const FIRE_FPS = 8;

/**
 * Says which sway picture a tree at (x, y) shows right now.
 *
 * Trees further east and south start a little later, so a gust seems to roll across the forest
 * instead of every tree nodding at once.
 *
 * @param {number} time - Seconds the world has been drawn for.
 * @param {number} x - The tree's world x.
 * @param {number} y - The tree's world y.
 * @returns {number} A column of the tree sheet's first row: 0 or 2 upright, 1 left, 3 right.
 */
const swayFrame = (time, x, y) =>
  SWAY[Math.floor(time * SWAY_FPS + x / 260 + y / 410) % SWAY.length];

// The map's tile layers, bottom to top: the ground terrains, then the cliffs (lips, walls and their
// shadows) over them. Each one is painted over the one before. tools/build-map.py decides the order.
const TILE_LAYERS = mapData.layers.filter((l) => l.type === 'tilelayer').map((l) => l.name);

// How tall the player is drawn on screen, in world units.
const PLAYER_HEIGHT = 112;

// How much of the character shows above the hull while sitting in the boat, from the top down.
const SEATED = 0.6;

// Scenery is grouped into squares this many world units wide; only squares near the camera are shown.
const CHUNK = 1024;

// How far past the screen edge scenery is still shown, so a tall tree just off screen doesn't pop in.
const CULL_MARGIN = 640;

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
 *   ghost, and `resetCamera()` after switching characters.
 */
export async function createRenderer(container, miniCanvas) {
  const mini = miniCanvas.getContext('2d');
  if (!mini)
    throw new Error(
      'This browser does not support the game canvas. Please try a current desktop browser.',
    );

  const [overview, sheets] = await Promise.all([
    loadImage(overviewUrl, 'world map'),
    loadCharacterSheets(),
  ]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The camera's own position, which glides after the player instead of jumping.
  const camera = { x: 0, y: 0, initialized: false };

  // Scene objects filled in by create() below. `snap` makes the next draw skip fade animations.
  // `chunks` maps a chunk key to the scenery images in it; `shown` holds the keys now visible.
  // `fires` maps "<character>:<camp id>" to that camp's campfire sprite.
  let player,
    shadow,
    supplies,
    boat,
    cue,
    bar,
    ghost,
    ring,
    lighting,
    snow,
    webgl = false,
    snap = true,
    shown = new Set();
  // `swayers` holds, per chunk key, the trees that sway in the wind. `clock` counts the seconds drawn.
  const chunks = new Map(),
    swayers = new Map(),
    fires = new Map();
  let clock = 0;

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
        this.load.image('terrain', tilesetUrl);
        for (const [name, url] of Object.entries(objectUrls))
          this.load.image(`object-${name}`, url);
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
        const tiles = map.addTilesetImage('terrain', 'terrain');
        TILE_LAYERS.forEach((name, i) => map.createLayer(name, tiles, 0, 0).setDepth(i - 20));

        // Standing objects sort by their ground line, so the character can walk behind a tree or in front of it.
        // Harvestable wild scenery is skipped here; it is drawn with the supplies below.
        for (const object of map.getObjectLayer('objects').objects) {
          const spec = objectSpecs[object.name];
          if (!spec || WILD[object.name] || !this.textures.exists(`object-${object.name}`))
            continue;
          // A sprite with a flip-book sheet is drawn from it (its first frame is the still picture).
          const anim = animSpecs[object.name];
          const image = this.add
            .image(object.x, object.y, anim ? `anim-${object.name}` : `object-${object.name}`, 0)
            .setOrigin(...(anim ?? spec).origin)
            .setScale(spec.scale ?? 1)
            .setDepth(spec.flat ? -1 : object.y)
            .setVisible(false);
          const key = `${Math.floor(object.x / CHUNK)},${Math.floor(object.y / CHUNK)}`;
          if (!chunks.has(key)) chunks.set(key, []);
          chunks.get(key).push(image);

          // Trees (three-row sheets) sway in the wind while they are on screen.
          if (anim?.rows === 3 && !reducedMotion) {
            if (!swayers.has(key)) swayers.set(key, []);
            swayers.get(key).push(image);
          }
        }

        // Supplies are sprites like the scenery around them; draw() glows the one in reach (WebGL only) and caps it with E.
        // The glow filter is added the first time a supply comes into reach (see glowOf), because the world has
        // hundreds of flower patches and a filter on every one would be slow.
        webgl = this.renderer.type === Phaser.WEBGL;
        // Old boats on the beach are drawn the same way; the one the player repaired fades out.
        supplies = [
          ...NODES.map((node) => ({
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
          const cell = sheet.image.width / 4; // sheets are four columns wide
          sheet.frames.forEach((row, r) =>
            row.forEach((f, c) => texture.add(`${r}-${c}`, 0, f.x, f.y, f.width, f.height)),
          );
        };
        for (const [id, atlas] of Object.entries(sheets.atlases))
          for (const [name, sheet] of Object.entries(atlas)) addFrames(`${id}-${name}`, sheet);

        // The player and the soft shadow under their feet. Drawing switches the player to the
        // chosen character's pose; the scout facing south is only the starting picture.
        shadow = this.add.ellipse(0, 0, 38, 14, 0x172e34, 0.22);
        player = this.add.image(0, 0, 'scout-idle', '0-0').setOrigin(0.5, 1);

        // The ghost campfire shown while placing one, and the ring of warmth it would give.
        // Both sit above the night layer so they stay visible in the dark.
        ghost = this.add
          .image(0, 0, 'anim-campfire', 0)
          .setOrigin(...animSpecs.campfire.origin)
          .setAlpha(0.75)
          .setDepth(WORLD.height + 0.75)
          .setVisible(false);
        ring = this.add.graphics().setDepth(WORLD.height + 0.74);

        // The night layer and the light around fires (render/lighting.js).
        lighting = createLighting(this, reducedMotion);
        // Falling snow over the snowy regions (render/snow.js).
        snow = createSnow(this, reducedMotion);
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
   * @param {object} s - One entry of `supplies`.
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
   * Draws one frame: moves the camera, updates supply sprites, and poses the player.
   *
   * The camera follows the player smoothly, like someone filming who walks a step behind.
   * Trees sway, campfires flicker, and a chopped tree falls and breaks apart before it fades.
   * Supplies fade out when gathered, the one in reach glows with an E above it, and while an
   * action runs a progress bar fills up instead. Camp fires are drawn, the player sprite gets this
   * frame's pose, the build ghost follows the pointer, snow falls in the snowy regions, and the
   * night layer goes over everything.
   *
   * @param {object} state - The game being played.
   * @param {number} dt - Seconds since the last frame.
   * @param {object} animator - The player's animation state (current clip, time, pending action).
   * @param {object|null} [build=null] - Build mode from the session: when `active`, the ghost is
   *   drawn at `x`/`y`, coloured by `check.ok`.
   */
  function draw(state, dt, animator, build = null) {
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
    for (const key of shown)
      if (!next.has(key)) for (const image of chunks.get(key)) image.setVisible(false);
    for (const key of next)
      if (!shown.has(key)) for (const image of chunks.get(key)) image.setVisible(true);
    shown = next;

    // Wind in the trees on screen.
    clock += dt;
    for (const key of shown)
      for (const tree of swayers.get(key) ?? []) tree.setFrame(swayFrame(clock, tree.x, tree.y));

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
            .setDepth(camp.y),
        );
    }

    // The flames flicker through their four pictures (one still picture with reduced motion).
    const flame = reducedMotion ? 1 : Math.floor(clock * FIRE_FPS) % 4;
    for (const sprite of fires.values()) sprite.setFrame(flame);

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

      // A supply with a flip-book sheet: a standing tree sways; one just gathered falls and
      // breaks apart (a rock cracks to rubble) and only then fades.
      let breaking = false;
      if (s.anim) {
        const act = BREAK[s.anim.rows];
        if (!gone) {
          s.fx = null;
          s.sprite.setFrame(
            s.anim.rows === 3 && !reducedMotion ? swayFrame(clock, s.node.x, s.node.y) : 0,
          );
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

    // The player's boat, pointing the way it last went and rocking gently on the water.
    // The art's bow points east: it is mirrored for west and turned a quarter for north and south.
    const bob = reducedMotion ? 0 : Math.sin(performance.now() / 500) * 2;
    boat.setVisible(!!state.boat);
    if (state.boat) {
      const { x, y, dir } = state.boat;
      boat
        .setPosition(x, y + bob)
        .setFlipX(dir === 1)
        .setAngle(dir === 0 ? 90 : dir === 3 ? -90 : 0)
        .setDepth(y - 1);
      if (choice?.kind === 'board') capped = { node: { x, y }, top: y - 40 };
    }

    // The E key cap bobs gently over the supply in reach.
    cue.setVisible(!!capped);
    if (capped)
      cue.setPosition(
        capped.node.x,
        capped.top - 18 + (reducedMotion ? 0 : Math.sin(performance.now() / 260) * 2.5),
      );

    // The progress bar fills up while a timed action runs.
    bar.clear();
    if (working) {
      const w = 64,
        x = working.node.x - w / 2,
        y = working.top - 24,
        progress = actionProgress(animator);
      bar.fillStyle(0x254432, 0.88).fillRoundedRect(x - 2, y - 2, w + 4, 13, 6.5);
      if (progress > 0)
        bar.fillStyle(0xf7f1de, 1).fillRoundedRect(x, y, Math.max(9, w * progress), 9, 4.5);
    }

    // A timed action is longer than one pass of its clip, so it loops until the action ends.
    // In the boat the player sits still, so the idle pose is used.
    const pose = resolvePose(
      sheets,
      state.character,
      state.aboard ? 'idle' : animator.clip,
      state.aboard ? 0 : animator.time,
      state.player.direction,
      animator.pending ? true : undefined,
    );
    // Pin the sprite at its anchor (mirrored when the pose is flipped), with feet on the ground.
    const pivot = (pose.frame.anchorX - pose.frame.x) / pose.frame.width;
    player
      .setTexture(pose.key, pose.name)
      .setOrigin(pose.flip ? 1 - pivot : pivot, 1)
      .setFlipX(pose.flip)
      .setScale(PLAYER_HEIGHT / pose.sheet.referenceHeight)
      .setDepth(state.player.y);
    if (state.aboard) {
      // Show only the top of the character and sink the cut line into the hull, so they sit in the boat.
      player
        .setCrop(0, 0, pose.frame.width, pose.frame.height * SEATED)
        .setPosition(
          state.player.x,
          state.player.y + bob + 10 + player.displayHeight * (1 - SEATED),
        );
    } else
      player.setCrop().setPosition(state.player.x, state.player.y + 4 - PLAYER_HEIGHT * pose.lift);
    shadow
      .setVisible(!state.aboard)
      .setPosition(state.player.x, state.player.y - 1)
      .setDepth(state.player.y - 0.5);

    // The ghost campfire while placing one: tinted green where it may stand and red where it may
    // not, with a ring showing how far a new fire's warmth reaches.
    ring.clear();
    ghost.setVisible(!!build?.active);
    if (build?.active) {
      const ok = !!build.check?.ok;
      ghost.setPosition(build.x, build.y).setTint(ok ? 0xb6f0a0 : 0xff8a7a);
      ring.lineStyle(2, ok ? 0xf7f1de : 0xff8a7a, 0.85).strokeCircle(build.x, build.y, FIRE_RADIUS);
    }

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

    drawMap(mini, overview, state, miniCanvas.width, miniCanvas.height, true);
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
      drawMap(canvas.getContext('2d'), overview, state, canvas.width, canvas.height),

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
