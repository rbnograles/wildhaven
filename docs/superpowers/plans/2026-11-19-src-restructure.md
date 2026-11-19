# src/ Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Wildhaven's flat `src/` into role-based folders (`data/`, `world/`, `actions/`, `game/`, `animation/`, `render/`, `ui/`, `core/`), with one file per gameplay action. Behavior does not change.

**Architecture:** Pure game logic (data, collision, actions, save state, animation clips) stays runnable in Node and is covered by `node:test`. The browser layer (UI, input, frame loop, Phaser renderer, sprite loading) wraps it. `main.js` shrinks to a bootstrap that wires one shared `session` object and one `ui` object together. Spec: `docs/superpowers/specs/2026-11-19-src-restructure-design.md`.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 7, Phaser 4 (renderer only), Node 24 `node:test`.

## Global Constraints

- No behavior change. Same DOM ids, classes and text, so `src/style.css` is untouched.
- `index.html` keeps loading `/src/main.js`.
- Save keys stay `wildhaven.adventure.v1.<id>` and `wildhaven.active`, and the save object stays `version: 2`. A save made before this work must still load.
- Gathering locks movement for the full 0.8 s `gather` clip (4 frames at 5 fps) and awards exactly once, when the clip ends.
- Timings stay the same: walk 155 and run 245 units/s, movement dt cap 0.1, frame dt clamp 0.05, autosave every 10 s, HUD refresh every 0.12 s, toast 3.2 s.
- Phaser input stays disabled. All input goes through `src/core/input.js`.
- `src/data/`, `src/world/`, `src/actions/`, `src/game/` and `src/animation/clips.js` are pure. They never import `ui/`, `core/`, `render/`, `animation/sheets.js`, `animation/preview.js`, PNG/WEBP/CSS files, and never use `import.meta`, `document` or `window`. JSON is imported with `with { type: 'json' }`.
- Match the existing compact JS style (dense one-line statements, short helpers). Comments explain *why*.
- Work on branch `restructure-src` (it already exists and holds the spec commit). Use `git mv` when a file moves whole. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After every task, `npm test` and `npm run build` must both pass.

**Order note:** the spec lists the `state.js` split first. This plan moves whole files first (Task 1) so that Task 2's import edits land on files that are already in their final place. The end state is the same.

---

### Task 1: Move whole files into their folders

Five source files and two test files move without logic changes. `src/state.js` stays where it is until Task 2.

**Files:**
- Move: `src/storage.js` → `src/game/saves.js`
- Move: `src/animation.js` → `src/animation/clips.js`
- Move: `src/animation-art.js` → `src/animation/sheets.js`
- Move: `src/animation-preview.js` → `src/animation/preview.js`
- Move: `src/render.js` → `src/render/renderer.js`
- Move: `tests/storage.test.js` → `tests/game/saves.test.js`
- Move: `tests/animation.test.js` → `tests/animation/clips.test.js`
- Modify: `src/main.js:3-6` (import paths)

**Interfaces:**
- Consumes: nothing new.
- Produces: the same exports as before at new paths. `src/game/saves.js` exports `storageKey, readActive, setActive, createSaveSession`. `src/animation/clips.js` exports `CLIPS, sampleAnimation, steadyAnchors, createAnimator, startAction, advanceAnimation`. `src/animation/sheets.js` exports `loadImage, loadCharacterSheets, resolvePose, loadCharacterPainter`. `src/animation/preview.js` exports `setupPreview`. `src/render/renderer.js` exports `createRenderer`.

- [ ] **Step 1: Record a baseline save for the final check**

Run `npm run dev` and open the `127.0.0.1` URL it prints. Write down the full origin including the port (for example `http://127.0.0.1:5173`): saves are stored per origin, so Task 4 must use the same one. Choose the Wandering Builder and press **Begin your journey**. Press E on the marked supply next to the spawn, wait for the toast, then press Esc and choose **Save adventure**. Write down the Wood/Stone/Food numbers shown in the HUD. Stop the dev server. Task 4 checks that this save still loads.

- [ ] **Step 2: Move the tests first and point them at the new paths**

```bash
mkdir -p tests/game tests/animation
git mv tests/storage.test.js tests/game/saves.test.js
git mv tests/animation.test.js tests/animation/clips.test.js
sed -i "s#'../src/storage.js'#'../../src/game/saves.js'#; s#'../src/state.js'#'../../src/state.js'#" tests/game/saves.test.js
sed -i "s#'../src/animation.js'#'../../src/animation/clips.js'#; s#'../src/state.js'#'../../src/state.js'#" tests/animation/clips.test.js
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. Two files report `ERR_MODULE_NOT_FOUND` for `src/game/saves.js` and `src/animation/clips.js`. `tests/state.test.js` still passes.

- [ ] **Step 4: Move the source files**

```bash
mkdir -p src/game src/animation src/render
git mv src/storage.js src/game/saves.js
git mv src/animation.js src/animation/clips.js
git mv src/animation-art.js src/animation/sheets.js
git mv src/animation-preview.js src/animation/preview.js
git mv src/render.js src/render/renderer.js
```

- [ ] **Step 5: Fix relative imports in the moved files and in main.js**

```bash
sed -i "s#from './state.js'#from '../state.js'#" src/game/saves.js
sed -i "s#'../assets/#'../../assets/#g; s#from './state.js'#from '../state.js'#; s#from './animation.js'#from './clips.js'#" src/animation/sheets.js
sed -i "s#from './state.js'#from '../state.js'#; s#from './animation.js'#from './clips.js'#; s#from './animation-art.js'#from './sheets.js'#" src/animation/preview.js
sed -i "s#'../assets/#'../../assets/#g; s#from './state.js'#from '../state.js'#; s#from './animation-art.js'#from '../animation/sheets.js'#" src/render/renderer.js
sed -i "s#from './render.js'#from './render/renderer.js'#; s#from './storage.js'#from './game/saves.js'#; s#from './animation.js'#from './animation/clips.js'#; s#from './animation-preview.js'#from './animation/preview.js'#" src/main.js
```

The `'../assets/` rewrite in `renderer.js` also fixes the `import.meta.glob('../assets/world/source/objects/*.png', …)` path. That's intended.

- [ ] **Step 6: Check that no old path is left**

Run: `grep -rnE "from '\./(storage|animation|animation-art|animation-preview|render)\.js'|'\.\./assets/" src/game src/animation src/render src/main.js`
Expected: no output.

- [ ] **Step 7: Run tests and build**

Run: `npm test`
Expected: `ℹ tests 20`, `ℹ pass 20`, `ℹ fail 0`.

Run: `npm run build`
Expected: `✓ built in …`, with no "Could not resolve" errors.

- [ ] **Step 8: Commit**

```bash
git add -A src tests
git commit -m "Move saves, animation and renderer modules into folders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Split state.js into data/, world/, game/ and one file per action

**Files:**
- Create: `src/data/balance.js`, `src/data/characters.js`, `src/data/supplies.js`
- Create: `src/world/map.js`, `src/world/regions.js`
- Create: `src/game/state.js`
- Create: `src/actions/move.js`, `src/actions/gather.js`, `src/actions/discover.js`
- Delete: `src/state.js`, `tests/state.test.js`
- Modify: `src/main.js` (imports, `collect()`, one line in `frame()`), `src/game/saves.js:1`, `src/animation/sheets.js` (`CHARACTERS` import), `src/animation/preview.js:1`, `src/render/renderer.js:2`
- Test: `tests/world/map.test.js`, `tests/game/state.test.js`, `tests/actions/move.test.js`, `tests/actions/gather.test.js`, `tests/actions/discover.test.js`, `tests/boundaries.test.js`
- Modify test imports: `tests/game/saves.test.js`, `tests/animation/clips.test.js`

**Interfaces:**
- Consumes (from Task 1): `startAction(animator, clip, target)` and `createAnimator()` from `src/animation/clips.js`.
- Produces:
  - `src/data/balance.js`: `WALK_SPEED, RUN_SPEED, MAX_MOVE_DT, GATHER_RANGE, DISCOVERY_RADIUS, REGION_LABEL_RANGE` (numbers).
  - `src/data/characters.js`: `REGION_OFFSETS`, `at(region, x, y) -> {x, y}`, `CHARACTERS` (array of `{id, row, name, shortName, location, tagline, description, kit, spawn:{x,y}, resources:{wood,stone,food}}`).
  - `src/data/supplies.js`: `NODES` (array of `{id, x, y, type, amount, label}`).
  - `src/world/map.js`: `WORLD {width, height, margin}`, `OBSTACLES` (array of `[left, top, right, bottom]`), `isWalkable(x, y) -> boolean`.
  - `src/world/regions.js`: `LOCATIONS` (array of `{id, name, x, y, radius}`), `regionAt(player) -> string`.
  - `src/game/state.js`: `createGame(characterId) -> state`, `serializeGame(state) -> string`, `restoreGame(json) -> state | null`.
  - `src/actions/move.js`: `movePlayer(state, dx, dy, dt, running=false) -> boolean`.
  - `src/actions/gather.js`: `nearbyNode(state) -> node | null`, `beginGather(state, animator) -> {ok:true, node} | {ok:false, reason:'busy'|'none'}`, `finishGather(state) -> node | null`.
  - `src/actions/discover.js`: `discover(state) -> location[]`.

- [ ] **Step 1: Write the new test files**

`tests/world/map.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, isWalkable } from '../../src/world/map.js';
import { CHARACTERS } from '../../src/data/characters.js';

test('every character spawn is walkable ground',()=>{
  for(const c of CHARACTERS)assert.ok(isWalkable(c.spawn.x,c.spawn.y),c.id);
});
test('points past the world margin or not finite are never walkable',()=>{
  for(const [x,y] of [[WORLD.margin-1,500],[500,WORLD.margin-1],[WORLD.width-WORLD.margin+1,500],[500,WORLD.height-WORLD.margin+1],[NaN,500],[500,Infinity]])
    assert.equal(isWalkable(x,y),false,`${x},${y}`);
});
```

`tests/game/state.test.js` (three tests moved from `tests/state.test.js`; only imports change):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../../src/data/characters.js';
import { isWalkable } from '../../src/world/map.js';
import { createGame, serializeGame, restoreGame } from '../../src/game/state.js';
import { movePlayer } from '../../src/actions/move.js';

test('all characters begin at distinct, walkable locations with their own identity', () => {
  const games = CHARACTERS.map(c => createGame(c.id));
  assert.equal(new Set(games.map(g => `${g.player.x},${g.player.y}`)).size, 3);
  for (const [i, game] of games.entries()) {
    assert.equal(game.character, CHARACTERS[i].id);
    assert.ok(isWalkable(game.player.x, game.player.y));
  }
  assert.throws(() => createGame('unknown'));
});

test('save restores character, coordinates and progress without sharing mutable objects', () => {
  const original = createGame('builder');
  movePlayer(original, 1,0,0.1);
  original.resources.wood = 9;
  const restored = restoreGame(serializeGame(original));
  assert.deepEqual(restored,original);
  restored.resources.wood++;
  assert.equal(original.resources.wood, 9);
});

test('invalid, outdated, mismatched and impossible save data is rejected', () => {
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame('{}'), null);
  for(const edit of [g=>g.version=100, g=>g.character='ghost', g=>g.player.x=-100, g=>g.resources.wood=-5, g=>g.player.y=null, g=>g.collected=['unknown']]) {
    const game = createGame('survivor'); edit(game);
    assert.equal(restoreGame(JSON.stringify(game)), null);
  }
});
```

`tests/actions/move.test.js` (moved; only imports change):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movePlayer } from '../../src/actions/move.js';
import { WORLD, isWalkable } from '../../src/world/map.js';
import { createGame } from '../../src/game/state.js';

test('diagonal movement is normalized and world edges cannot be crossed', () => {
  const a = createGame('scout'), b = createGame('scout');
  const origin = {...a.player};
  movePlayer(a, 1, 0, 0.1); movePlayer(b, 1, 1, 0.1);
  assert.ok(Math.abs(Math.hypot(a.player.x-origin.x,a.player.y-origin.y) - Math.hypot(b.player.x-origin.x,b.player.y-origin.y)) < 0.001);
  for(let i=0; i<500; i++) movePlayer(a, -1,-1,0.1);
  assert.ok(a.player.x >= WORLD.margin && a.player.y >= WORLD.margin);
  assert.ok(isWalkable(a.player.x, a.player.y));
});
```

`tests/actions/gather.test.js` (first test moved with `gather` renamed to `finishGather`; the other four are new):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearbyNode, beginGather, finishGather } from '../../src/actions/gather.js';
import { NODES } from '../../src/data/supplies.js';
import { createGame } from '../../src/game/state.js';
import { createAnimator, advanceAnimation } from '../../src/animation/clips.js';

test('gathering is proximity based and a node can be collected only once', () => {
  const game = createGame('scout');
  const result = finishGather(game);
  assert.ok(result);
  assert.ok(game.resources.wood > 0);
  assert.equal(finishGather(game), null);
});

test('beginGather starts the gather clip on the nearest supply without awarding it',()=>{
  const game=createGame('scout'),animator=createAnimator(),before={...game.resources};
  const result=beginGather(game,animator);
  assert.equal(result.ok,true);assert.equal(result.node.id,nearbyNode(game).id);
  assert.equal(animator.clip,'gather');assert.deepEqual(animator.pending,{clip:'gather',target:result.node.id});
  assert.deepEqual(game.resources,before);assert.deepEqual(game.collected,[]);
});

test('beginGather refuses while a clip is already playing, and when nothing is in range',()=>{
  const game=createGame('scout'),animator=createAnimator();
  beginGather(game,animator);
  assert.deepEqual(beginGather(game,animator),{ok:false,reason:'busy'});
  const far=createGame('scout'),idle=createAnimator();
  far.player.x=2000;far.player.y=2000;
  assert.deepEqual(beginGather(far,idle),{ok:false,reason:'none'});
  assert.equal(idle.pending,null);
});

test('beginGather turns the player toward a supply that is off to the side',()=>{
  const node=NODES.find(n=>n.id==='pine-wood');
  const east=createGame('scout');east.player.x=node.x+40;east.player.y=node.y;east.player.direction=0;
  beginGather(east,createAnimator());assert.equal(east.player.direction,1);
  const close=createGame('scout');close.player.x=node.x+5;close.player.y=node.y+30;close.player.direction=3;
  beginGather(close,createAnimator());assert.equal(close.player.direction,3);
});

test('the supply is awarded only after the 0.8 s gather clip completes',()=>{
  const game=createGame('scout'),animator=createAnimator();
  beginGather(game,animator);
  assert.equal(advanceAnimation(animator,0.79,{}),null);
  assert.deepEqual(advanceAnimation(animator,0.02,{}),{clip:'gather',target:'pine-wood'});
  assert.equal(finishGather(game).id,'pine-wood');assert.equal(game.resources.wood,3);
});
```

`tests/actions/discover.test.js` (moved; only imports change):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discover } from '../../src/actions/discover.js';
import { createGame } from '../../src/game/state.js';

test('locations are discovered once when entered', () => {
  const game=createGame('survivor');
  assert.equal(discover(game).length,1);
  assert.equal(discover(game).length,0);
  const builder=createGame('builder');
  game.player.x=builder.player.x; game.player.y=builder.player.y;
  assert.equal(discover(game).length,1);
  assert.equal(game.discovered.length,2);
});
```

`tests/boundaries.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// These modules must keep running under plain Node: the unit tests import them directly.
const SRC=new URL('../src/',import.meta.url);
const PURE=[...['data','world','actions','game'].flatMap(dir=>readdirSync(new URL(`${dir}/`,SRC)).filter(f=>f.endsWith('.js')).map(f=>`${dir}/${f}`)),'animation/clips.js'];
const FORBIDDEN=[
  [/from\s+['"][^'"]+\.(png|webp|jpe?g|css)['"]/,'an image or CSS import'],
  [/import\.meta/,'import.meta'],
  [/\bdocument\b/,'document'],
  [/\bwindow\b/,'window'],
  [/from\s+['"][^'"]*\/(ui|core|render)\//,'a browser-layer import'],
  [/from\s+['"][^'"]*(sheets|preview)\.js['"]/,'a browser animation import'],
];

test('pure modules avoid browser-only imports and globals',()=>{
  assert.ok(PURE.length>=11,`expected at least 11 pure modules, found ${PURE.length}`);
  for(const file of PURE){
    const source=readFileSync(new URL(file,SRC),'utf8');
    for(const [pattern,label] of FORBIDDEN)assert.doesNotMatch(source,pattern,`${file} uses ${label}`);
  }
});
test('pure modules import cleanly in Node',async()=>{
  for(const file of PURE)await import(new URL(file,SRC));
});
```

Then delete the old state test and repoint the two moved test files:

```bash
git rm -q tests/state.test.js
sed -i "s#'../../src/state.js'#'../../src/game/state.js'#" tests/game/saves.test.js tests/animation/clips.test.js
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/world/map.js`, `src/game/state.js`, `src/actions/*.js`. `tests/boundaries.test.js` fails with `ENOENT` for `src/data/`.

- [ ] **Step 3: Create the data modules**

`src/data/balance.js`:

```js
// Gameplay tuning. Speeds are world units per second; ranges and radii are world units.
export const WALK_SPEED = 155;
export const RUN_SPEED = 245;
// Longest step one movement update may take, so a slow frame can't carry the player through an obstacle.
export const MAX_MOVE_DT = 0.1;
export const GATHER_RANGE = 95;
export const DISCOVERY_RADIUS = 230;
// The HUD keeps naming a region this far beyond its discovery radius.
export const REGION_LABEL_RANGE = 130;
```

`src/data/characters.js`:

```js
// Region coordinates were first measured on a smaller map; these offsets place each region in the full world.
// tools/build-map.py uses the same offsets for the village and coast.
export const REGION_OFFSETS = { forest: [0, 0], village: [1622, 1158], coast: [3072, 2048] };
export const at = (region, x, y) => ({ x: x + REGION_OFFSETS[region][0], y: y + REGION_OFFSETS[region][1] });

export const CHARACTERS = [
  { id: 'scout', row: 0, name: 'The Frontier Scout', shortName: 'Frontier Scout', location: 'Pinefall Woods', tagline: 'Follow the trail. Find your home.', description: 'A curious wanderer with a steady step and a love of the wild. Begin among the pines, where every trail leads somewhere new.', kit: 'Hatchet · Field pack · 3 food', spawn: at('forest', 620, 550), resources: { wood: 0, stone: 0, food: 3 } },
  { id: 'builder', row: 1, name: 'The Wandering Builder', shortName: 'Wandering Builder', location: 'Hollowstead Village', tagline: 'Where others see ruins, you see a beginning.', description: 'A resourceful craftsperson looking for a place to belong. Start in an abandoned village, with old foundations and new possibilities.', kit: 'Hammer · Work gloves · 5 wood', spawn: at('village', 1450, 890), resources: { wood: 5, stone: 2, food: 2 } },
  { id: 'survivor', row: 2, name: 'The Shipwreck Survivor', shortName: 'Shipwreck Survivor', location: 'Driftwood Coast', tagline: 'The sea took your ship. Not your spirit.', description: 'Washed ashore with a handful of supplies and a will to carry on. Search the coast, follow the inland trail, and make a fresh start.', kit: 'Salvaged satchel · Rope · 4 food', spawn: at('coast', 2400, 1580), resources: { wood: 2, stone: 0, food: 4 } },
];
```

`src/data/supplies.js`:

```js
import { at } from './characters.js';

// tools/build-map.py KEEP_CLEAR repeats these absolute positions so scattered foliage never covers them.
export const NODES = [
  { id:'pine-wood', ...at('forest', 657, 567), type:'wood', amount:3, label:'Fallen branches' },
  { id:'camp-stone', ...at('forest', 490, 540), type:'stone', amount:2, label:'Loose stones' },
  { id:'forest-food', ...at('forest', 480, 705), type:'food', amount:2, label:'Wild berries' },
  { id:'village-wood', ...at('village', 1486, 914), type:'wood', amount:3, label:'Scrap timber' },
  { id:'village-stone', ...at('village', 1370, 1000), type:'stone', amount:3, label:'Loose stones' },
  { id:'village-food', ...at('village', 1580, 1190), type:'food', amount:2, label:'Wild berries' },
  { id:'coast-wood', ...at('coast', 2435, 1600), type:'wood', amount:4, label:'Driftwood' },
  { id:'coast-stone', ...at('coast', 2250, 1730), type:'stone', amount:2, label:'Beach stones' },
  { id:'meadow-food', ...at('village', 1920, 1420), type:'food', amount:3, label:'Wild berries' },
];
```

- [ ] **Step 4: Create the world modules**

`src/world/map.js` (collision code copied unchanged from `src/state.js` lines 1–2, 4 and 19–37):

```js
import MAP from '../../assets/world/map/wildhaven.json' with { type: 'json' };
import OBJECT_SPECS from '../../assets/world/source/objects.json' with { type: 'json' };

export const WORLD = { width: MAP.width*MAP.tilewidth, height: MAP.height*MAP.tileheight, margin: 42 };

// Collision comes from the sprite map (tools/build-map.py): water tiles and the solid base of each placed object.
const layer = name => MAP.layers.find(l => l.name === name);
export const OBSTACLES = layer('objects').objects.flatMap(o => {
  const base = OBJECT_SPECS[o.name]?.footprint;
  return base ? [[o.x-base[0], o.y-base[1], o.x+base[0], o.y]] : [];
});

// A water tile records which of its corners (TL, TR, BL, BR) are sea; blending them gives a smooth shoreline.
const TILE = MAP.tilewidth, water = layer('water').data, firstWater = MAP.properties.find(p => p.name === 'firstWaterGid').value;
function waterAt(x, y) {
  const tx = Math.floor(x/TILE), ty = Math.floor(y/TILE), gid = water[ty*MAP.width+tx];
  if (!gid) return 0;
  const mask = Math.floor((gid-firstWater)/16)+1, u = x/TILE-tx, v = y/TILE-ty;
  return (mask&1)*(1-u)*(1-v) + (mask>>1&1)*u*(1-v) + (mask>>2&1)*(1-u)*v + (mask>>3&1)*u*v;
}
export function isWalkable(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < WORLD.margin || y < WORLD.margin || x > WORLD.width-WORLD.margin || y > WORLD.height-WORLD.margin) return false;
  return waterAt(x, y) < 0.35 && !OBSTACLES.some(([left,top,right,bottom]) => x>left-10 && x<right+10 && y>top-10 && y<bottom+10);
}
```

`src/world/regions.js`:

```js
import { CHARACTERS } from '../data/characters.js';
import { DISCOVERY_RADIUS, REGION_LABEL_RANGE } from '../data/balance.js';

// Each character's starting area is one discoverable region.
export const LOCATIONS = CHARACTERS.map(c => ({ id: c.id, name: c.location, ...c.spawn, radius: DISCOVERY_RADIUS }));

export function regionAt(player) {
  return LOCATIONS.find(l=>Math.hypot(l.x-player.x,l.y-player.y)<l.radius+REGION_LABEL_RANGE)?.name ?? 'The Open Wilds';
}
```

- [ ] **Step 5: Create game/state.js**

`src/game/state.js` (logic copied unchanged from `src/state.js` lines 51–55 and 93–106):

```js
import { CHARACTERS } from '../data/characters.js';
import { NODES } from '../data/supplies.js';
import { isWalkable } from '../world/map.js';
import { LOCATIONS } from '../world/regions.js';

export function createGame(characterId) {
  const character=CHARACTERS.find(c=>c.id===characterId);
  if(!character) throw new Error('Unknown character');
  return {version:2, character:character.id, player:{...character.spawn,direction:0}, resources:{...character.resources}, collected:[], discovered:[], elapsed:0, distance:0};
}

export function serializeGame(state) { return JSON.stringify(state); }

// Rebuilds the save field by field: anything not copied here is dropped on load.
export function restoreGame(json) {
  try {
    const s=JSON.parse(json);
    if (!s || s.version!==2 || !CHARACTERS.some(c=>c.id===s.character) || !s.player || !isWalkable(s.player.x,s.player.y) || ![0,1,2,3].includes(s.player.direction)) return null;
    if(!s.resources || !['wood','stone','food'].every(key=>Number.isSafeInteger(s.resources[key]) && s.resources[key]>=0 && s.resources[key]<100000)) return null;
    for(const [list,allowed] of [[s.collected,NODES],[s.discovered,LOCATIONS]]) {
      if(!Array.isArray(list) || list.length>allowed.length || new Set(list).size!==list.length || !list.every(id=>allowed.some(a=>a.id===id))) return null;
    }
    if(!Number.isFinite(s.elapsed) || s.elapsed<0 || !Number.isFinite(s.distance) || s.distance<0) return null;
    return {version:2,character:s.character,player:{x:s.player.x,y:s.player.y,direction:s.player.direction},resources:{wood:s.resources.wood,stone:s.resources.stone,food:s.resources.food},collected:[...s.collected],discovered:[...s.discovered],elapsed:s.elapsed,distance:s.distance};
  } catch { return null; }
}
```

- [ ] **Step 6: Create the action files**

`src/actions/move.js`:

```js
import { isWalkable } from '../world/map.js';
import { WALK_SPEED, RUN_SPEED, MAX_MOVE_DT } from '../data/balance.js';

// One walk or run step. Returns whether the player actually moved, so a blocked step reads as idle.
export function movePlayer(state, dx, dy, dt, running=false) {
  if (![dx,dy,dt].every(Number.isFinite) || dt<=0 || (!dx&&!dy)) return false;
  const length=Math.hypot(dx,dy), speed=running?RUN_SPEED:WALK_SPEED;
  const step=speed*Math.min(dt,MAX_MOVE_DT);
  dx=dx/length*step; dy=dy/length*step;
  const {x,y}=state.player;
  state.player.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
  if(isWalkable(x+dx,y)) state.player.x+=dx;
  if(isWalkable(state.player.x,y+dy)) state.player.y+=dy;
  const distance=Math.hypot(state.player.x-x,state.player.y-y);
  state.distance+=distance;
  return distance>0;
}
```

`src/actions/gather.js`:

```js
import { NODES } from '../data/supplies.js';
import { GATHER_RANGE } from '../data/balance.js';
import { startAction } from '../animation/clips.js';

export function nearbyNode(state) {
  return NODES.filter(n=>!state.collected.includes(n.id) && Math.hypot(n.x-state.player.x,n.y-state.player.y)<GATHER_RANGE)
    .sort((a,b)=>Math.hypot(a.x-state.player.x,a.y-state.player.y)-Math.hypot(b.x-state.player.x,b.y-state.player.y))[0] ?? null;
}

// E starts the 0.8 s gather clip; the supply is awarded once, by finishGather, when the clip completes.
export function beginGather(state, animator) {
  if(animator.pending) return {ok:false,reason:'busy'};
  const node=nearbyNode(state);
  if(!node) return {ok:false,reason:'none'};
  if(Math.abs(node.x-state.player.x)>8) state.player.direction=node.x<state.player.x?1:2;
  startAction(animator,'gather',node.id);
  return {ok:true,node};
}

export function finishGather(state) {
  const node=nearbyNode(state);
  if(!node) return null;
  state.collected.push(node.id); state.resources[node.type]+=node.amount;
  return node;
}
```

`src/actions/discover.js`:

```js
import { LOCATIONS } from '../world/regions.js';

export function discover(state) {
  const found=LOCATIONS.filter(l=>!state.discovered.includes(l.id) && Math.hypot(l.x-state.player.x,l.y-state.player.y)<l.radius);
  state.discovered.push(...found.map(l=>l.id));
  return found;
}
```

- [ ] **Step 7: Check that the copied data matches the old state.js exactly**

```bash
node --input-type=module -e "
import assert from 'node:assert/strict';
const old=await import('./src/state.js');
const {CHARACTERS}=await import('./src/data/characters.js');
const {NODES}=await import('./src/data/supplies.js');
const {WORLD,OBSTACLES}=await import('./src/world/map.js');
const {LOCATIONS}=await import('./src/world/regions.js');
assert.deepEqual(CHARACTERS,old.CHARACTERS);assert.deepEqual(NODES,old.NODES);assert.deepEqual(LOCATIONS,old.LOCATIONS);
assert.deepEqual(WORLD,old.WORLD);assert.deepEqual(OBSTACLES,old.OBSTACLES);
console.log('data identical');"
```
Expected: `data identical`.

- [ ] **Step 8: Repoint the browser modules and main.js, then delete state.js**

In `src/game/saves.js`, replace line 1 `import { serializeGame, CHARACTERS } from '../state.js';` with:

```js
import { serializeGame } from './state.js';
import { CHARACTERS } from '../data/characters.js';
```

In `src/animation/sheets.js`, replace `import {CHARACTERS} from '../state.js';` with:

```js
import {CHARACTERS} from '../data/characters.js';
```

In `src/animation/preview.js`, replace `import { CHARACTERS } from '../state.js';` with:

```js
import { CHARACTERS } from '../data/characters.js';
```

In `src/render/renderer.js`, replace `import { WORLD, CHARACTERS, LOCATIONS, NODES, nearbyNode } from '../state.js';` with the following (`CHARACTERS` was imported but never used):

```js
import { WORLD } from '../world/map.js';
import { LOCATIONS } from '../world/regions.js';
import { NODES } from '../data/supplies.js';
import { nearbyNode } from '../actions/gather.js';
```

In `src/main.js`, replace line 2 `import { WORLD, CHARACTERS, LOCATIONS, createGame, movePlayer, restoreGame, gather, discover, nearbyNode, regionAt } from './state.js';` with:

```js
import { CHARACTERS } from './data/characters.js';
import { WORLD } from './world/map.js';
import { LOCATIONS, regionAt } from './world/regions.js';
import { createGame, restoreGame } from './game/state.js';
import { movePlayer } from './actions/move.js';
import { nearbyNode, beginGather, finishGather } from './actions/gather.js';
import { discover } from './actions/discover.js';
```

In `src/main.js`, replace `import { createAnimator, startAction, advanceAnimation } from './animation/clips.js';` with:

```js
import { createAnimator, advanceAnimation } from './animation/clips.js';
```

In `src/main.js`, replace the whole `collect()` function:

```js
function collect(){
  if(screen!=='game'||isPaused()||animator.pending)return;
  const node=nearbyNode(state);
  if(!node){notify('Move closer to a marked supply to gather it.');return;}
  if(Math.abs(node.x-state.player.x)>8)state.player.direction=node.x<state.player.x?1:2;
  startAction(animator,'gather',node.id);keys.clear();
}
```

with:

```js
function collect(){
  if(screen!=='game'||isPaused())return;
  const result=beginGather(state,animator);
  if(result.ok)keys.clear();
  else if(result.reason==='none')notify('Move closer to a marked supply to gather it.');
}
```

In `src/main.js` `frame()`, replace `const node=gather(state);` with `const node=finishGather(state);`.

Then:

```bash
git rm -q src/state.js
```

- [ ] **Step 9: Check that nothing still imports state.js from src/ root**

Run: `grep -rnE "from '(\./|\.\./)state\.js'" src tests | grep -v "src/game/saves.js:1"`
Expected: no output. (The only `./state.js` import left is `src/game/saves.js` importing its sibling `src/game/state.js`.)

- [ ] **Step 10: Run tests and build**

Run: `npm test`
Expected: `ℹ tests 28`, `ℹ pass 28`, `ℹ fail 0`.

Run: `npm run build`
Expected: `✓ built in …`.

- [ ] **Step 11: Commit**

```bash
git add -A src tests
git commit -m "Split state.js into data, world, game state and one file per action

Adds beginGather/finishGather (gather renamed), balance constants in
data/balance.js, and a test that keeps the pure modules Node-safe.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Split main.js into ui/ and core/

There is no DOM test harness, so this task is checked by the unchanged unit tests, the build, and a browser smoke test (Step 11).

**Files:**
- Create: `src/ui/layout.js`, `src/ui/hud.js`, `src/ui/selection.js`, `src/ui/dialogs.js`
- Create: `src/core/session.js`, `src/core/input.js`, `src/core/loop.js`
- Rewrite: `src/main.js`

**Interfaces:**
- Consumes (from Tasks 1–2): `CHARACTERS` (`src/data/characters.js`), `WORLD` (`src/world/map.js`), `LOCATIONS, regionAt` (`src/world/regions.js`), `createGame, restoreGame` (`src/game/state.js`), `storageKey, readActive, setActive, createSaveSession` (`src/game/saves.js`), `movePlayer` (`src/actions/move.js`), `nearbyNode, beginGather, finishGather` (`src/actions/gather.js`), `discover` (`src/actions/discover.js`), `createAnimator, advanceAnimation` (`src/animation/clips.js`), `setupPreview(getCharacter)` (`src/animation/preview.js`), `createRenderer(container, miniCanvas) -> Promise<{draw(state,dt,animator), drawMap(canvas,state), resetCamera()}>` (`src/render/renderer.js`).
- Produces:
  - `src/ui/layout.js`: `icon(name) -> string`, `$(id) -> HTMLElement`, `mountLayout(app)`.
  - `src/ui/hud.js`: `createHud(session) -> {notify(message), update()}`.
  - `src/ui/selection.js`: `setupSelection(session, ui) -> {readSlot(id) -> {raw, value, invalid}, select(id)}`.
  - `src/ui/dialogs.js`: `setupDialogs(session, ui) -> {isPaused(), openPause(), closePause(), toggleMap()}`.
  - `src/core/session.js`: `tabStorage`, `createSession() -> session`, `changeScreen(session, next)`, `save(session, ui, silent=false) -> boolean`, `start(session, ui, fresh=false) -> Promise`, `leave(session, ui)`, `cancelLoading(session)`.
  - `session` shape: `{selected, state, animator, renderer, saveSession, saveFailure, screen, loadId, keys:Set, clock:{last, sinceSave, sinceHud}}`. `keys` and `clock` are never reassigned.
  - `src/core/input.js`: `setupInput(session, ui) -> {moveIntent() -> {dx, dy, running}}`.
  - `src/core/loop.js`: `startLoop(session, ui)`.
  - The `ui` object built in `main.js`: `{hud, dialogs, selection, input}`.

- [ ] **Step 1: Create ui/layout.js from the template in main.js**

Create `src/ui/layout.js` that starts with these lines:

```js
import { CHARACTERS } from '../data/characters.js';
import { WORLD } from '../world/map.js';
import { LOCATIONS } from '../world/regions.js';

export const $=id=>document.getElementById(id);
```

Below them, paste **unchanged** everything from the current `src/main.js` from the line `const icons={` down to and including the line ending in `</dialog>\`;` (the end of the `reset-dialog` template). Then make exactly these three edits in the pasted text:

1. `const icon=(name)=>` → `export const icon=(name)=>`
2. Replace the two lines `const app=document.querySelector('#app');` and `app.innerHTML=\`` with:
   ```js
   // Builds every screen and dialog once; other modules look elements up by id.
   export function mountLayout(app) {
     app.innerHTML=`
   ```
   The template's first line (`<main id="selection" class="selection">`) stays on its own line after this.
3. After the final `</dialog>\`;` line, add a closing `}` on a new line.

- [ ] **Step 2: Check that the template text is byte-identical**

```bash
node --input-type=module -e "
import fs from 'node:fs';
const main=fs.readFileSync('src/main.js','utf8'),layout=fs.readFileSync('src/ui/layout.js','utf8');
const cut=s=>s.slice(s.indexOf('<main id=\"selection\"'),s.indexOf('</dialog>\`;')+10);
if(cut(main)!==cut(layout)||!layout.includes(main.slice(main.indexOf('const icons={'),main.indexOf('const icon=('))))throw new Error('template or icons differ');
console.log('layout identical');"
```
Expected: `layout identical`.

- [ ] **Step 3: Create ui/hud.js**

```js
import { nearbyNode } from '../actions/gather.js';
import { regionAt } from '../world/regions.js';
import { $ } from './layout.js';

export function createHud(session) {
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');
    toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);
  }
  function update() {
    const {state,animator}=session;
    for(const resource of ['wood','stone','food'])$(resource).textContent=state.resources[resource];
    $('region-name').textContent=regionAt(state.player);
    $('discovery-count').textContent=`${state.discovered.length} / 3`;
    $('quest-gather').classList.toggle('complete',state.collected.length>0);
    $('quest-explore').classList.toggle('complete',state.discovered.length===3);
    if(state.collected.length&&state.discovered.length===3)$('quest-text').textContent='You have found your feet. Keep exploring — this is just the beginning.';
    else $('quest-text').textContent='Gather supplies and follow the paths to discover the world.';
    const node=nearbyNode(state);$('interact').hidden=!node||!!animator.pending;
    if(node)$('interact').querySelector('span').textContent=`Gather ${node.label.toLowerCase()}`;
  }
  return {notify,update};
}
```

- [ ] **Step 4: Create core/session.js**

```js
import { CHARACTERS } from '../data/characters.js';
import { createGame } from '../game/state.js';
import { createSaveSession, setActive } from '../game/saves.js';
import { createAnimator } from '../animation/clips.js';
import { discover } from '../actions/discover.js';
import { createRenderer } from '../render/renderer.js';
import { $ } from '../ui/layout.js';

// The character this tab is playing lives in sessionStorage; null when the browser blocks it.
export const tabStorage=(()=>{try{return sessionStorage;}catch{return null;}})();

// Everything that used to be a top-level `let` in main.js. keys and clock are never reassigned.
export function createSession() {
  return {selected:'scout',state:null,animator:createAnimator(),renderer:null,saveSession:null,saveFailure:'',screen:'selection',loadId:0,keys:new Set(),clock:{last:0,sinceSave:0,sinceHud:0}};
}

export function changeScreen(session, next) {
  session.screen=next;session.keys.clear();
  for(const name of ['selection','loading','game']) $(name).hidden=name!==next;
  document.body.classList.toggle('playing',next==='game');
}

export function save(session, ui, silent=false) {
  if(!session.state)return false;
  const result=session.saveSession?.write(session.state)??{ok:false,reason:'unavailable'};
  if(result.ok){session.saveFailure='';$('pause-save-note').textContent='Progress is saved when you leave.';if(!silent)ui.hud.notify('Adventure saved. Your path will be here.');return true;}
  const conflict=result.reason==='conflict';
  const message=conflict?'Another tab saved this character. Return to characters to load the newer adventure.':'Saving is unavailable. Leaving now will lose this session’s progress.';
  $('pause-save-note').textContent=message;
  if(!silent||session.saveFailure!==result.reason)ui.hud.notify(message);
  session.saveFailure=result.reason;return false;
}

export async function start(session, ui, fresh=false) {
  const slot=ui.selection.readSlot(session.selected);
  if(slot.invalid&&!fresh){$('reset-message').textContent='This character’s save could not be read. Start a fresh adventure? Other characters will be kept.';$('reset-dialog').showModal();return;}
  const token=++session.loadId;
  changeScreen(session,'loading');$('loading-title').textContent=slot.value&&!fresh?'Welcome back.':'A new path awaits.';$('loading-text').textContent=`Travelling to ${CHARACTERS.find(c=>c.id===session.selected).location}…`;$('loading-bar').hidden=false;$('retry').hidden=true;
  try {
    if(!session.renderer)session.renderer=await createRenderer($('world'),$('minimap'));
    if(token!==session.loadId)return;
    const state=session.state=!fresh&&slot.value?slot.value:createGame(session.selected);
    try {session.saveSession=createSaveSession(localStorage,state.character,slot.raw);} catch {session.saveSession=null;}
    session.saveFailure='';session.animator=createAnimator();
    const c=CHARACTERS.find(c=>c.id===state.character);
    $('hud-name').textContent=c.shortName;$('hud-portrait').style.setProperty('--row',c.row);
    discover(state);session.renderer.resetCamera();changeScreen(session,'game');setActive(tabStorage,state.character);
    Object.assign(session.clock,{last:performance.now(),sinceSave:0,sinceHud:0});ui.hud.update();save(session,ui,true);
    $('world').focus();ui.hud.notify(slot.value&&!fresh?'Welcome back. Your journey continues.':`Welcome to ${c.location}. Your story begins here.`);
  } catch(error) {
    if(token!==session.loadId)return;
    $('loading-title').textContent='The trail hit a snag.';$('loading-text').textContent=error.message;$('loading-bar').hidden=true;$('retry').hidden=false;
    $('retry').onclick=()=>start(session,ui,fresh);
  }
}

// "Return to characters" in the pause menu.
export function leave(session, ui) {
  if(!save(session,ui,true)&&!window.confirm('This adventure could not be saved. Return to characters and lose this session’s progress?'))return;
  $('pause-dialog').close();session.state=null;session.saveSession=null;setActive(tabStorage,null);changeScreen(session,'selection');ui.selection.select(session.selected);$('begin').focus();
}

// "Back to characters" on the loading screen; bumping loadId makes the pending start() give up.
export function cancelLoading(session) {
  session.loadId++;setActive(tabStorage,null);changeScreen(session,'selection');$('begin').focus();
}
```

- [ ] **Step 5: Create ui/selection.js**

```js
import { CHARACTERS } from '../data/characters.js';
import { restoreGame } from '../game/state.js';
import { storageKey } from '../game/saves.js';
import { start, cancelLoading } from '../core/session.js';
import { $, icon } from './layout.js';

export function setupSelection(session, ui) {
  function readSlot(id) {
    try { const raw=localStorage.getItem(storageKey(id));const value=raw?restoreGame(raw):null;return {raw,value:value?.character===id?value:null,invalid:!!raw&&(!value||value.character!==id)}; }
    catch { $('storage-note').textContent='Storage is unavailable. You can play, but progress will not persist.';return {raw:null,value:null,invalid:false}; }
  }
  function select(id) {
    session.selected=id;const c=CHARACTERS.find(c=>c.id===id),slot=readSlot(id);
    document.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===id)));
    $('tagline').textContent=c.tagline;$('description').textContent=c.description;$('kit').textContent=c.kit;
    $('begin').innerHTML=`${slot.value?'Continue your journey':'Begin your journey'} ${icon('arrow')}`;
    $('fresh').hidden=!slot.value;
    $('save-hint').textContent=slot.value?`${slot.value.discovered.length} of 3 regions discovered · Adventure saved`:slot.invalid?'This save could not be read. Start fresh to play.':'Your own path through a shared world.';
  }
  document.querySelectorAll('[data-character]').forEach(button=>{
    button.addEventListener('click',()=>select(button.dataset.character));
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();const next=(CHARACTERS.findIndex(c=>c.id===button.dataset.character)+(event.key==='ArrowRight'?1:2))%3;
      select(CHARACTERS[next].id);document.querySelector(`[data-character="${session.selected}"]`).focus();
    });
  });
  $('begin').addEventListener('click',()=>start(session,ui));
  $('fresh').addEventListener('click',()=>{$('reset-message').textContent='This replaces this character’s saved adventure. Your other characters will be kept.';$('reset-dialog').showModal();});
  $('loading-back').addEventListener('click',()=>cancelLoading(session));
  return {readSlot,select};
}
```

- [ ] **Step 6: Create ui/dialogs.js**

```js
import { save, start, leave } from '../core/session.js';
import { $ } from './layout.js';

export function setupDialogs(session, ui) {
  const dialogs=[$('pause-dialog'),$('map-dialog'),$('reset-dialog')];
  // Any open dialog pauses the game.
  const isPaused=()=>dialogs.some(dialog=>dialog.open);
  function openPause(){if(session.screen!=='game'||isPaused())return;session.keys.clear();save(session,ui,true);$('pause-dialog').showModal();}
  function closePause(){$('pause-dialog').close();session.keys.clear();$('world').focus();}
  function toggleMap(){
    if(session.screen!=='game')return;
    if($('map-dialog').open){$('map-dialog').close();$('world').focus();return;}
    if(isPaused())return;
    session.keys.clear();session.renderer.drawMap($('large-map'),session.state);$('map-discovered').textContent=`${session.state.discovered.length} of 3 regions discovered`;$('map-dialog').showModal();
  }
  $('pause').addEventListener('click',openPause);$('resume').addEventListener('click',closePause);
  $('save-game').addEventListener('click',()=>{if(save(session,ui))$('pause-save-note').textContent='Your adventure has been saved.';});
  $('return').addEventListener('click',()=>leave(session,ui));
  $('open-map').addEventListener('click',toggleMap);$('close-map').addEventListener('click',toggleMap);
  $('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
  $('confirm-reset').addEventListener('click',()=>{$('reset-dialog').close();start(session,ui,true);});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{ui.hud.notify('Fullscreen is unavailable in this browser window.');}});
  for(const dialog of dialogs){dialog.addEventListener('close',()=>{session.keys.clear();if(session.screen==='game')$('world').focus();});}
  return {isPaused,openPause,closePause,toggleMap};
}
```

- [ ] **Step 7: Create core/input.js**

```js
import { beginGather } from '../actions/gather.js';
import { save } from './session.js';
import { $ } from '../ui/layout.js';

// Phaser's own input is disabled; every key and touch goes through here.
const MOVE_KEYS=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift'];
const TOUCH_KEYS={up:'w',down:'s',left:'a',right:'d'};

export function setupInput(session, ui) {
  const {keys}=session;
  // E starts the gather clip; the supply is awarded when the clip finishes (see core/loop.js).
  function gather(){
    if(session.screen!=='game'||ui.dialogs.isPaused())return;
    const result=beginGather(session.state,session.animator);
    if(result.ok)keys.clear();
    else if(result.reason==='none')ui.hud.notify('Move closer to a marked supply to gather it.');
  }
  $('interact').addEventListener('click',gather);
  window.addEventListener('keydown',event=>{
    if(session.screen!=='game')return;
    const key=event.key.toLowerCase();
    if(key==='escape'){if(!ui.dialogs.isPaused()){event.preventDefault();ui.dialogs.openPause();}return;}
    if(key==='m'&&!event.repeat){event.preventDefault();ui.dialogs.toggleMap();return;}
    if(ui.dialogs.isPaused())return;
    if(MOVE_KEYS.includes(key)){event.preventDefault();keys.add(key);}
    if(key==='e'&&!event.repeat){event.preventDefault();gather();}
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(session.screen==='game')save(session,ui,true);}session.clock.last=performance.now();});
  window.addEventListener('pagehide',()=>save(session,ui,true));
  document.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{event.preventDefault();if(!ui.dialogs.isPaused()){button.setPointerCapture(event.pointerId);keys.add(TOUCH_KEYS[button.dataset.move]);}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(TOUCH_KEYS[button.dataset.move]));
  });
  function moveIntent(){
    const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    return {dx,dy,running:keys.has('shift')};
  }
  return {moveIntent};
}
```

- [ ] **Step 8: Create core/loop.js**

```js
import { movePlayer } from '../actions/move.js';
import { finishGather } from '../actions/gather.js';
import { discover } from '../actions/discover.js';
import { advanceAnimation } from '../animation/clips.js';
import { save } from './session.js';

// Engine timings, not game balance (that lives in data/balance.js).
const MAX_FRAME_DT=0.05, AUTOSAVE_EVERY=10, HUD_EVERY=0.12;

export function startLoop(session, ui) {
  const {clock}=session;
  function frame(now){
    const dt=Math.min((now-clock.last)/1000,MAX_FRAME_DT);clock.last=now;
    const {state,renderer,animator}=session;
    if(session.screen==='game'&&state&&renderer){
      let moving=false;
      if(!ui.dialogs.isPaused()&&!document.hidden){
        const {dx,dy,running}=ui.input.moveIntent();
        // No movement while the gather clip plays: the 0.8 s lock is intended.
        moving=!animator.pending&&movePlayer(state,dx,dy,dt,running);state.elapsed+=dt;
        const done=advanceAnimation(animator,dt,{moving,running});
        if(done?.clip==='gather'){const node=finishGather(state);if(node){ui.hud.notify(`+${node.amount} ${node.type} · ${node.label}`);ui.hud.update();save(session,ui,true);}}
        const found=discover(state);if(found.length){ui.hud.notify(`Discovered ${found[0].name}`);save(session,ui,true);}
        clock.sinceSave+=dt;if(clock.sinceSave>AUTOSAVE_EVERY){save(session,ui,true);clock.sinceSave=0;}
      }
      renderer.draw(state,dt,animator);clock.sinceHud+=dt;if(clock.sinceHud>HUD_EVERY){ui.hud.update();clock.sinceHud=0;}
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

- [ ] **Step 9: Rewrite main.js**

Replace the entire contents of `src/main.js` with:

```js
import './style.css';
import { mountLayout } from './ui/layout.js';
import { createHud } from './ui/hud.js';
import { setupDialogs } from './ui/dialogs.js';
import { setupSelection } from './ui/selection.js';
import { createSession, start, tabStorage } from './core/session.js';
import { setupInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { readActive, setActive } from './game/saves.js';
import { setupPreview } from './animation/preview.js';

mountLayout(document.querySelector('#app'));
const session=createSession();
// Modules reach each other through this object instead of importing one another.
const ui={};
ui.hud=createHud(session);
ui.dialogs=setupDialogs(session,ui);
ui.selection=setupSelection(session,ui);
ui.input=setupInput(session,ui);
setupPreview(()=>session.state?.character??session.selected);
// A refresh mid-game resumes that character; only leaving via the menu buttons clears it.
const resumeId=readActive(tabStorage);ui.selection.select(resumeId??session.selected);
if(resumeId&&ui.selection.readSlot(resumeId).value)start(session,ui);else setActive(tabStorage,null);
startLoop(session,ui);
```

- [ ] **Step 10: Run tests and build**

Run: `npm test`
Expected: `ℹ tests 28`, `ℹ pass 28`, `ℹ fail 0`.

Run: `npm run build`
Expected: `✓ built in …`.

Run: `wc -l src/main.js`
Expected: about 25 lines.

- [ ] **Step 11: Browser smoke test**

Start the `wildhaven` launch config (or `npm run dev`) and open the printed `127.0.0.1` URL. Check each item:
- The selection screen looks the same as on the baseline. Left/right arrow keys move between cards, and the save hint updates.
- **Begin** (Scout) shows the loading screen, then the game. Its toast reads "Welcome to Pinefall Woods. Your story begins here.", or "Welcome back. Your journey continues." if the Scout already has a save at this origin.
- WASD moves the character, Shift runs, and diagonals move.
- E next to the marked supply plays the crouch, holding D during the crouch does not move the character, and after about 0.8 s the toast reads "+3 wood · Fallen branches". The HUD Wood count goes up.
- E away from any supply shows "Move closer to a marked supply to gather it."
- M opens and closes the map. Esc pauses, and keys are ignored while paused. **Keep exploring** resumes.
- Pause → **Save adventure** shows "Your adventure has been saved."
- Pause → **Return to characters** returns to selection, and the card shows **Continue your journey**.
- Continue, then refresh the page mid-game: the game resumes straight into play.
- **Preview animations** opens from both the selection screen and the pause menu.
- The browser console shows no errors.

- [ ] **Step 12: Commit**

```bash
git add -A src
git commit -m "Split main.js into ui/ and core/ modules around a shared session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Update the docs and run the final verification

**Files:**
- Modify: `CLAUDE.md`, `README.md:51`, `tools/build-map.py:89`, `docs/verification.md`

**Interfaces:**
- Consumes: the final file layout from Tasks 1–3.
- Produces: docs that match the code.

- [ ] **Step 1: Final verification, including the baseline save**

On the dev server, at the same origin (host and port) recorded in Task 1, Step 1:
- Choose the Wandering Builder. The card must show **Continue your journey** and a save hint with "Adventure saved". Continue: the HUD Wood/Stone/Food must match the numbers written down in Task 1, Step 1.
- Repeat the Task 3, Step 11 checklist with the Frontier Scout and the Shipwreck Survivor.
- Walk the Survivor into the Driftwood Coast discovery radius from outside it. The toast reads "Discovered Driftwood Coast" and the quest counter increases.

- [ ] **Step 2: Update CLAUDE.md**

In the **Commands** block, replace:

```
node --test tests/state.test.js                                   # one file
node --test --test-name-pattern="stale tab" tests/storage.test.js # one test by name
```

with:

```
node --test tests/actions/gather.test.js                              # one file
node --test --test-name-pattern="stale tab" tests/game/saves.test.js  # one test by name
```

Replace the whole `## Architecture` section, from its heading up to (not including) the `**Save model.**` paragraph, with:

```markdown
## Architecture

Game rules are pure modules. Rendering and the DOM are thin layers around them. `main.js` only wires things together.

| Folder | Role | Runs in Node tests? |
| --- | --- | --- |
| `src/data/` | `characters.js` (characters, spawns, region offsets), `supplies.js` (supply nodes), `balance.js` (speeds, ranges, radii) | yes |
| `src/world/` | `map.js` (world size, collision via `isWalkable`), `regions.js` (`LOCATIONS`, `regionAt`) | yes |
| `src/actions/` | One file per player action: `move.js`, `gather.js` (`beginGather` starts the clip, `finishGather` awards), `discover.js` | yes |
| `src/game/` | `state.js` (create, serialize, validate saves), `saves.js` (per-character localStorage session, active character) | yes |
| `src/animation/` | `clips.js` (clip table, animator; pure), `sheets.js` (sprite loading and frame measuring), `preview.js` (preview dialog) | `clips.js` only |
| `src/render/` | `renderer.js`: Phaser scene, camera, node markers, minimap and world map | no |
| `src/ui/` | `layout.js` (HTML template, icons), `selection.js`, `hud.js` (HUD + toast), `dialogs.js` (pause, map, reset, fullscreen) | no |
| `src/core/` | `session.js` (shared session; start, leave, save), `input.js` (keys, touch), `loop.js` (frame loop) | no |

**Keep the pure modules runnable in Node.** `data/`, `world/`, `actions/`, `game/` and `animation/clips.js` must not import `ui/`, `core/`, `render/`, `sheets.js`, `preview.js`, PNG or CSS files, and must not use `import.meta`, `document` or `window`. `tests/boundaries.test.js` enforces this. JSON is imported with `import ... with { type: 'json' }` so Node can read it.

**Adding an action:** add a file in `src/actions/`, bind its key in `src/core/input.js`, add a clip in `src/animation/clips.js` if it's animated, and add a test in `tests/actions/`.

**Shared session.** `core/session.js` `createSession()` holds what the browser layer shares: selected character, game state, animator, renderer, save session, current screen, held keys, and frame clock. `main.js` builds one `ui` object (`hud`, `dialogs`, `selection`, `input`) and passes `(session, ui)` to each module, so modules don't import each other in cycles.

**Input belongs to `core/input.js`, not Phaser.** Phaser's keyboard, mouse, and touch input are switched off. `core/input.js` tracks held keys in `session.keys` and exposes `moveIntent()`. The game counts as paused whenever the pause, map, or reset `<dialog>` is open (`ui.dialogs.isPaused()`). The simulation also stops while the tab is hidden.

**Frame loop (`core/loop.js`).** Each frame: clamp `dt` to 0.05, call `movePlayer`, then `advanceAnimation`. When a `gather` clip *finishes*, call `finishGather(state)` to award the resources. Pressing E only calls `beginGather`, which starts the clip, so supplies are granted exactly once. Then run `discover`, autosave every 10 s, call `renderer.draw`, and refresh the HUD about every 0.12 s.
```

Then make these replacements elsewhere in CLAUDE.md:
- `Collision in \`state.js\` combines two sources.` → `Collision in \`src/world/map.js\` combines two sources.`
- `**\`build-map.py\` hard-codes coordinates that also live in \`state.js\`.**` → `**\`build-map.py\` hard-codes coordinates that also live in \`src/data/characters.js\` and \`src/data/supplies.js\`.**`
- ``measured **`edges`** arrays in `SOURCES` in `src/animation-art.js` `` → ``measured **`edges`** arrays in `SOURCES` in `src/animation/sheets.js` ``
- `- Balance numbers are constants inside \`src/state.js\`. There is no separate data file.` → `- Balance numbers live in \`src/data/balance.js\`; the gather length lives in the \`gather\` clip in \`src/animation/clips.js\`. Don't hardcode tuning numbers in actions.`
- In the **Stale Docs** list, replace ``- `README.md` calls `render.js` "Canvas rendering" and lists walking animation as future work.`` with ``- `README.md` lists walking animation as future work.`` (Step 3 fixes the "Canvas rendering" part).

Run: `grep -nE "src/(state|storage|render|animation|animation-art|animation-preview)\.js|tests/(state|storage|animation)\.test\.js" CLAUDE.md`
Expected: no output.

- [ ] **Step 3: Update README.md, build-map.py and verification.md**

In `README.md`, replace the paragraph that starts `State, collision, movement, gathering, and serialization are in \`src/state.js\`.` with:

```markdown
Game data and tuning live in `src/data/`, collision and regions in `src/world/`, and each player action (move, gather, discover) in its own file in `src/actions/`. Save state and storage are in `src/game/`. Phaser rendering is in `src/render/renderer.js`, animation clips and sprite sheets are in `src/animation/`, and the DOM screens and dialogs are in `src/ui/`. Input, the frame loop and the shared session are in `src/core/`, and `src/main.js` wires them together. Styling is in `src/style.css`.
```

In `tools/build-map.py`, replace the comment line:

```python
# Spawns and supply nodes from src/state.js: nothing is scattered on top of them.
```

with:

```python
# Spawns (src/data/characters.js) and supply nodes (src/data/supplies.js): nothing is scattered on top of them.
```

Append to `docs/verification.md`:

```markdown

## src/ restructure — 2026-11-19

Behavior-preserving move to role-based folders (`data/`, `world/`, `actions/`, `game/`, `animation/`, `render/`, `ui/`, `core/`). See `docs/superpowers/specs/2026-11-19-src-restructure-design.md`.

- `npm test`: 28 passing, including new `beginGather` tests and `tests/boundaries.test.js`, which keeps the pure modules free of browser-only code. `npm run build` succeeds.
- Copied data was checked equal to the old `state.js` exports (characters, supply nodes, locations, world size, obstacles) before `state.js` was deleted.
- Browser at 127.0.0.1: selection, loading, walk, run, gather (0.8 s lock intact, awards once), discovery, map, pause, save, return, continue, refresh-resume and the animation preview all behave as before for all three characters. The console shows no errors.
- A Builder save made before the restructure loaded with the same resources.
```

- [ ] **Step 4: Run tests and build one last time**

Run: `npm test`
Expected: `ℹ tests 28`, `ℹ pass 28`, `ℹ fail 0`.

Run: `npm run build`
Expected: `✓ built in …`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md tools/build-map.py docs/verification.md
git commit -m "Update docs for the role-based src/ layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
