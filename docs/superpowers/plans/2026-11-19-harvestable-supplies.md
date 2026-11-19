# Harvestable Supplies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating "+" supply markers with real, solid sprites that glow and show an E key cap when in reach, and make every gather a 6-second action that moving cancels.

**Architecture:** `src/state.js` owns node data (sprite, scale, verb, clip), solid bases, reach and `gatherTime`. `src/animation.js` gives actions an explicit duration plus cancel/progress helpers. `src/render.js` draws node sprites, the glow, the E cap and the progress bar. `src/main.js` starts and cancels actions and awards supplies by node id. `tools/build-map.py` freezes its scatter list so moving nodes never reshuffles scenery. Spec: `docs/superpowers/specs/2026-11-19-harvestable-supplies-design.md`.

**Tech Stack:** Vanilla ES modules, Phaser 4.2 (renderer only, Glow filter), `node:test`, Python 3 with numpy and Pillow.

## Global Constraints

- `state.js`, `storage.js` and `animation.js` must stay runnable in Node: no PNG/CSS imports, no `import.meta.glob`, no DOM.
- Node ids stay `pine-wood, camp-stone, forest-food, village-wood, village-stone, village-food, coast-wood, coast-stone, meadow-food`; save `version` stays 2.
- `GATHER_SECONDS = 6`. Reach stays 95 units.
- Keep the `prefers-reduced-motion` behaviour: no bob or fade animation when it is set.
- Match the compact one-line JS style; comments say why.
- This folder is not a git repository, so there are no commit steps.

---

### Task 1: Node sprites, positions and solid bases in state

**Files:**
- Create: `assets/world/source/objects/berry-bush.png`, `assets/world/source/objects/berry-bush.prompt.txt`
- Modify: `assets/world/source/objects.json`, `src/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Produces: `NODES[i] = {id, x, y, type, amount, label, verb, clip, sprite, scale}`; `GATHER_SECONDS`; `gatherTime(state, node) → number`; `nodeBases(collected) → [left, top, right, bottom][]`; `isWalkable(x, y, extra = [])`; `gather(state, id?) → node | null` (in reach and not yet collected).

- [ ] **Step 1: Make the berry-bush stand-in art.** Run this with `python make-berry.py assets/world/source/objects/oak.png assets/world/source/objects/berry-bush.png` from a scratch folder (not committed to `tools/`; the real art will replace it):

```python
import sys, random
import numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
oak = Image.open(src).convert('RGBA').crop((14, 4, 281, 196))
a = np.asarray(oak).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
bark = (r > g * 1.2) & ((r + g + b) / 3 < 125) & (a[..., 3] > 0)
a[bark, 0], a[bark, 1], a[bark, 2] = 58, 74, 34
a[..., 0] *= 0.82; a[..., 1] *= 0.92; a[..., 2] *= 0.80
h, w = a.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
inside = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h * 0.42) / (h * 0.58)) ** 2
a[..., 3] *= np.clip((1.0 - inside) / 0.06, 0, 1)
bush = Image.fromarray(a.clip(0, 255).astype('uint8')).resize((142, 96), Image.LANCZOS)
W, H = 150, 104
im = Image.new('RGBA', (W, H)); im.alpha_composite(bush, (4, 4))
rng = random.Random(5); d = ImageDraw.Draw(im); alpha = im.getchannel('A'); spots = []
while len(spots) < 11:
    x, y = rng.randint(20, W - 20), rng.randint(18, H - 24)
    if alpha.getpixel((x, y)) > 250 and all((x - sx) ** 2 + (y - sy) ** 2 > 420 for sx, sy in spots): spots.append((x, y))
for cx, cy in spots:
    for dx, dy in [(0, 0), (-4, 2), (4, 2), (0, 5)][: rng.randint(2, 4)]:
        x, y, rr = cx + dx, cy + dy, 2.7
        d.ellipse([x - rr - 1, y - rr - 1, x + rr + 1, y + rr + 1], fill=(62, 16, 30, 255))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(178, 34, 58, 255))
        d.ellipse([x - 1.6, y - 1.8, x, y - 0.2], fill=(255, 200, 200, 230))
im.save(out)
```

Write `berry-bush.prompt.txt` using the same template as `flowers.prompt.txt`, with the object line "low round wild berry bush with dense dark-green leaves and clusters of ripe red berries" and the size "approximately 150 x 104".

- [ ] **Step 2: Register the sprite.** Add this to `objects.json` after `"flowers"`: `"berry-bush": { "origin": [0.5, 0.9], "footprint": [30, 16] }`

- [ ] **Step 3: Write the failing tests** in `tests/state.test.js`. Import `NODES, nodeBases, gatherTime, GATHER_SECONDS` and `OBJECT_SPECS` (`import OBJECT_SPECS from '../assets/world/source/objects.json' with { type: 'json' };`) and `CLIPS` from `../src/animation.js`. Then:

```js
test('every supply is a known, solid, action-backed sprite that takes the full gather time', () => {
  for (const node of NODES) {
    assert.ok(OBJECT_SPECS[node.sprite]?.footprint, node.id);
    assert.equal(CLIPS[node.clip]?.sheet, 'actions', node.id);
    assert.ok(node.scale > 0 && typeof node.verb === 'string', node.id);
    assert.equal(gatherTime(createGame('scout'), node), GATHER_SECONDS);
  }
  assert.equal(GATHER_SECONDS, 6);
});

test('supply bases block movement until gathered, and never trap a player already inside', () => {
  const node = NODES.find(n => n.id === 'pine-wood');
  assert.ok(isWalkable(node.x, node.y - 5));
  assert.equal(isWalkable(node.x, node.y - 5, nodeBases([])), false);
  assert.ok(isWalkable(node.x, node.y - 5, nodeBases(['pine-wood'])));
  const game = createGame('scout'); game.player.x = node.x; game.player.y = node.y - 5;
  assert.ok(movePlayer(game, -1, 0, 0.1));
});
```

Also extend the spawn test with `assert.ok(isWalkable(game.player.x, game.player.y, nodeBases([])));`. Replace the gather test with:

```js
test('gathering is proximity based and a node can be collected only once', () => {
  const game = createGame('scout'), node = NODES.find(n => n.id === 'pine-wood');
  assert.equal(gather(game), null);
  game.player.x = node.x; game.player.y = node.y + 40;
  assert.equal(gather(game)?.id, 'pine-wood');
  assert.equal(game.resources.wood, node.amount);
  assert.equal(gather(game), null);
  assert.equal(gather(game, 'pine-wood'), null);
  assert.equal(gather(game, 'camp-stone'), null);
});
```

- [ ] **Step 4: Run `node --test tests/state.test.js`**. Expect FAIL (`nodeBases` / `GATHER_SECONDS` are not exported).

- [ ] **Step 5: Implement in `src/state.js`.** Replace `NODES` with the spec's table (relative `at()` coordinates: forest `(870,650)`, `(480,570)`, `(480,705)`; village `(1558,1012)`, `(1368,1022)`, `(1580,1190)`, meadow `(1678,1422)`; coast `(2558,1692)`, `(2250,1730)`). Each node gets `verb`, `clip`, `sprite`, `scale`. Then:

```js
const blocks=(rects,x,y)=>rects.some(([left,top,right,bottom])=>x>left-10 && x<right+10 && y>top-10 && y<bottom+10);
export function isWalkable(x, y, extra=[]) {
  if (...unchanged bounds check...) return false;
  return waterAt(x, y) < 0.35 && !blocks(OBSTACLES,x,y) && !blocks(extra,x,y);
}
export const GATHER_SECONDS=6;
// Gathering tools will shorten this (towards 0.5 s); until then every supply takes the full time.
export function gatherTime(state,node){return GATHER_SECONDS;}
export function nodeBases(collected){
  return NODES.filter(n=>!collected.includes(n.id)).map(n=>{const [w,d]=OBJECT_SPECS[n.sprite].footprint;return [n.x-w*n.scale,n.y-d*n.scale,n.x+w*n.scale,n.y];});
}
```

In `movePlayer`, compute `const bases=nodeBases(state.collected).filter(b=>!blocks([b],x,y));` (with a comment that a save made before a node moved may stand inside its base) and pass `bases` to both `isWalkable` calls. Change `nearbyNode` to use `const REACH=95` and an `inReach(state,n)` helper. Change `gather`:

```js
export function gather(state, id=nearbyNode(state)?.id) {
  const node=NODES.find(n=>n.id===id);
  if(!node || state.collected.includes(node.id) || !inReach(state,node)) return null;
  state.collected.push(node.id); state.resources[node.type]+=node.amount;
  return node;
}
```

- [ ] **Step 6: Run `npm test`**. Expect all PASS.

### Task 2: Timed, loopable, cancelable actions in the animator

**Files:** Modify `src/animation.js`; Test `tests/animation.test.js`

**Interfaces:**
- Produces: `startAction(animator, clip, target = null, duration = clip length) → boolean`; `advanceAnimation` returns `{clip, target}` once the duration has passed; `cancelAction(animator) → boolean`; `actionProgress(animator) → 0..1`.

- [ ] **Step 1: Write the failing tests**

```js
test('a timed action loops its clip until its duration, then finishes once',()=>{
  const a=createAnimator();assert.equal(startAction(a,'gather','forest-food',6),true);
  assert.equal(advanceAnimation(a,5.9,{}),null);assert.equal(a.clip,'gather');
  assert.ok(Math.abs(actionProgress(a)-5.9/6)<1e-9);
  assert.deepEqual(advanceAnimation(a,.1,{}),{clip:'gather',target:'forest-food'});
  assert.equal(a.clip,'idle');assert.equal(actionProgress(a),0);
});
test('cancelling an action awards nothing and returns to idle',()=>{
  const a=createAnimator();startAction(a,'build','pine-wood',6);advanceAnimation(a,3,{});
  assert.equal(cancelAction(a),true);assert.equal(a.pending,null);assert.equal(a.clip,'idle');
  assert.equal(advanceAnimation(a,10,{}),null);assert.equal(cancelAction(a),false);
});
```

- [ ] **Step 2: Run `node --test tests/animation.test.js`**. Expect FAIL (`cancelAction` is not exported).

- [ ] **Step 3: Implement.** `startAction` stores `pending={clip,target,duration}`, where `duration` falls back to `frames/fps` when it is missing or not positive. `advanceAnimation` finishes when `time+1e-8>=pending.duration` and returns `{clip,target}`. Add:

```js
export function cancelAction(animator){
  if(!animator.pending)return false;
  animator.pending=null;animator.clip='idle';animator.time=0;return true;
}
export const actionProgress=animator=>animator.pending?Math.min(1,animator.time/animator.pending.duration):0;
```

- [ ] **Step 4: Run `npm test`**. Expect all PASS, including the existing "finishes once" and "pause freezes" tests.

### Task 3: Sprite glow, E cap, progress bar and input wiring

**Files:** Modify `src/render.js`, `src/main.js`, `src/style.css`

- [ ] **Step 1: In `render.js`,** remove `markers`. In `create()`, add one image per node:

```js
supplies=NODES.map(node=>{
  const sprite=this.add.image(node.x,node.y,`object-${node.sprite}`).setOrigin(...objectSpecs[node.sprite].origin).setScale(node.scale).setDepth(node.y);
  let glow=null;
  if(this.renderer.type===Phaser.WEBGL){sprite.enableFilters();glow=sprite.filters.internal.addGlow(0xfff5ce,3,0,1,false,10,8).setPaddingOverride(null);glow.active=false;}
  return {node,sprite,glow,top:node.y-sprite.displayHeight*sprite.originY};
});
```

Add a key-cap container (a Graphics rounded rect 24×24 r6, fill `0xf7f1de`, stroke `0x254432`, plus a bold "E" Text) and a Graphics `bar`, both at depth `WORLD.height+1`. In `draw`:
- Each node's alpha eases toward 0 when collected and 1 otherwise. It snaps instead under reduced motion or right after `resetCamera`.
- The glow is active for the nearest or busy node.
- The cap shows over the nearest node when no action is running, bobbing ±2.5 px with `performance.now()`.
- The bar draws over the busy node: a dark rounded track 68×13 and a cream fill 64×9 scaled by `actionProgress(animator)`.
- Pass `animator.pending?true:undefined` as `resolvePose`'s `loop`.

- [ ] **Step 2: In `main.js`:**
  - `collect()` calls `startAction(animator,node.clip,node.id,gatherTime(state,node))`, and its miss message becomes "Move closer to something you can gather."
  - The keydown handler ignores `event.repeat` movement keys while an action runs.
  - `frame()` calls `cancelAction(animator)` when `dx||dy` during an action, and awards with `gather(state,done.target)` for any finished action.
  - `updateHud()` labels the button `${node.verb} ${label}` and adds class `busy` with `${ING[verb]} ${label}… move to stop`, where `ING={Chop:'Chopping',Pick:'Picking',Gather:'Gathering'}`.

- [ ] **Step 3: Add to `style.css`:** `.interact.busy{cursor:default}.interact.busy kbd{display:none}`

- [ ] **Step 4: Run `npm test` and `npm run build`**. Expect both to pass.

### Task 4: Stable map build

**Files:** Modify `tools/build-map.py`

- [ ] **Step 1:** Record hashes: `sha256sum assets/world/map/*`
- [ ] **Step 2:** Rename the scatter loop's list to `SCATTER_CLEAR`, keeping its current values, with a comment explaining that it is frozen. Make `KEEP_CLEAR` the current spawns and nodes: `(620, 550), (3072, 2048), (5472, 3628), (870, 650), (480, 570), (480, 705), (3180, 2170), (2990, 2180), (3202, 2348), (5630, 3740), (5322, 3778), (3300, 2580)`. After the loop: `objects = objects[:len(fixed)] + [o for o in objects[len(fixed):] if all(math.hypot(o[1] - cx, o[2] - cy) > 150 for cx, cy in KEEP_CLEAR)]`
- [ ] **Step 3:** Run `python tools/build-map.py`, then `sha256sum assets/world/map/*`. Expect `wildhaven.json` and `tileset.png` to be identical. `overview.webp` may only differ if Pillow's encoder isn't deterministic, so compare its decoded pixels.

### Task 5: Docs and browser verification

- [ ] Update `CLAUDE.md`: the 6 s cancelable action replaces the 0.8 s rule; the `build` clip is now used for chopping; node sprites, solid bases and the glow; `SCATTER_CLEAR` vs `KEEP_CLEAR`. Update `docs/art-direction.md` (berry-bush stand-in, seventeen sprites, no UI markers). Update `README.md` (controls row and "supply markers"). Add a section to `docs/verification.md`.
- [ ] Run `npm run dev` from the `wildhaven` launch config at `127.0.0.1` and play each character. Check, near each node: the glow and E cap appear in reach; the sprite is solid; E starts a 6 s looping clip with the bar; moving cancels with no supplies; letting it finish awards once and fades the sprite; pause freezes the bar. Check the console for errors and the layout at 390 px.
