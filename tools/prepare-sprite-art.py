"""Gets the full-size sprite-expansion art ready for the game (see docs/design/sprite-expansion.md).

The generated sheets are far bigger than the game draws them, and each frame sits loosely in its cell. This
script cuts every frame out, lines the frames up on one ground point, shrinks them to game size and saves
tidy sheets the renderer can play like a flip-book.
Inputs : source/animations/<name>.png              tree, rock and fire animation sheets (4 columns)
         source/originals/props/bridge-painted.png the painted bridge
         assets/ui/item-box-10-slots.png           the ten-slot item box panel
         assets/items/tools-stone-iron.png         the hammers and pickaxes
Outputs: assets/world/animations/<sprite>.png      one sheet per animated sprite, every cell the same size
         assets/world/animations/animations.json   each sheet's cell size, origin and rows
         source/objects/<kind>/<sprite>.png        the first frame, as the still picture the map builder uses
         source/objects/props/bridge.png           the bridge at game size
         assets/ui/game/item-box.png, build-hammer.png   the item box (one row of five slots) and Build icon
         assets/ui/game/icon-<resource>.png        the item box's pictures, made from sprites already in the world
         assets/ui/game/hud-<name>.png             the HUD panels, cut from assets/ui/normal/normal-hud-components.png
The inputs are never changed, so it is safe to re-run. It prints the origin of each still picture; copy those
into source/objects.json if they change.
Run: python tools/prepare-sprite-art.py, then python tools/build-map.py
"""
import json, os, shutil
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
SRC = os.path.join(ROOT, 'world', 'source')
OUT = os.path.join(ROOT, 'world', 'animations')
UI = os.path.join(ROOT, 'ui', 'game')
PAD = 2   # clear pixels left around every frame, so its soft edge is never cut off

# Animated sprites: sprite name -> (source sheet, kind folder, rows, how big, how each frame finds its ground point).
# `size` is ('height', n) or ('width', n): the first frame is shrunk to that many world units.
# `anchors` has one letter per frame, row by row, saying where the ground point is across the frame:
#   b = the middle of the frame's bottom edge (a standing trunk, a rock pile)
#   l = near the left end (the root end of a tree lying on its side)
#   c = the same spot as in its cell, measured from frame one (things that never move, like the fire ring)
#   p = pushed right of the root, where the cut firewood ends up
ANIMATED = {
    'oak': ('oak-wind-fall-break', 'trees', 3, ('height', 300), 'bbbb' 'bbll' 'lllp'),
    'pine': ('pine-wind-fall-break', 'trees', 3, ('height', 210), 'bbbb' 'bbll' 'lllp'),
    'rocks-a': ('rock-break', 'rocks', 1, ('width', 220), 'cccc'),
    'campfire': ('fire-loop', 'props', 1, ('width', 96), 'cccc'),
}
COLS = 4

# Loads a picture as numbers: height x width x 4 (red, green, blue, see-through).
def load(path): return np.asarray(Image.open(path).convert('RGBA'))

# Finds the stretches of a row of yes/no values that are "yes", joining ones less than `gap` apart.
def runs(mask, gap=6):
    out = []
    for i in np.flatnonzero(mask):
        if out and i - out[-1][1] <= gap: out[-1][1] = i
        else: out.append([i, i])
    return out

# Cuts one row of a sheet into its frames. Tall fallen trees spill over the equal cell lines, so the frames
# are found by the clear gaps between them; only if that does not give four pieces are equal cells used.
def frames_of(sheet, row, rows):
    h, w = sheet.shape[:2]
    top, bottom = row * h // rows, (row + 1) * h // rows
    band = sheet[top:bottom]
    pieces = runs((band[:, :, 3] > 40).any(axis=0))
    if len(pieces) != COLS: pieces = [[c * w // COLS, (c + 1) * w // COLS - 1] for c in range(COLS)]
    out = []
    for c, (x0, x1) in enumerate(pieces):
        cell = band[:, x0:x1 + 1]
        ys, xs = np.nonzero(cell[:, :, 3] > 40)
        frame = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        low = xs[ys >= ys.max() - 6]   # the pixels touching the ground
        # Keep the frame, where its ground pixels are across it, and where it sat in its equal cell.
        out.append({'pixels': frame, 'foot': (low.min() + low.max()) / 2 - xs.min(), 'cell_x': x0 + xs.min() - c * w // COLS})
    return out

# Saves a picture and copies the prompt of the art it was made from next to it.
def save(image, path, source):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path)
    prompt = open(source[:-4] + '.prompt.txt', encoding='utf-8').read()
    note = f'Made from {os.path.relpath(source, ROOT)} by tools/prepare-sprite-art.py.'
    open(path[:-4] + '.prompt.txt', 'w', encoding='utf-8', newline='\n').write(note.replace('\\', '/') + '\n' + prompt)

# Shrinks a cut-out frame by `scale`.
def shrink(pixels, scale):
    im = Image.fromarray(pixels)
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)

manifest = {}
for name, (sheet_name, kind, rows, (side, size), anchors) in ANIMATED.items():
    source = os.path.join(SRC, 'animations', sheet_name + '.png')
    sheet = load(source)
    frames = [f for r in range(rows) for f in frames_of(sheet, r, rows)]
    first = frames[0]
    scale = size / (first['pixels'].shape[0] if side == 'height' else first['pixels'].shape[1])
    trunk = first['pixels'].shape[1] * 0.09   # about half a trunk's width, in source pixels

    # Work out where each frame's ground point is across it, then place every frame around one shared point.
    placed = []
    for f, how in zip(frames, anchors):
        width = f['pixels'].shape[1]
        if how == 'b': ax = f['foot']
        elif how == 'l': ax = trunk
        elif how == 'p': ax = width / 2 - first['pixels'].shape[1] * 0.45
        else: ax = first['foot'] + first['cell_x'] - f['cell_x']
        im = shrink(f['pixels'], scale)
        placed.append((im, round(ax * scale)))
    left = max(ax for _, ax in placed) + PAD
    right = max(im.width - ax for im, ax in placed) + PAD
    cell_w, cell_h = left + right, max(im.height for im, _ in placed) + 2 * PAD

    out = Image.new('RGBA', (cell_w * COLS, cell_h * rows))
    for i, (im, ax) in enumerate(placed):
        out.alpha_composite(im, ((i % COLS) * cell_w + left - ax, (i // COLS) * cell_h + cell_h - PAD - im.height))
    save(out, os.path.join(OUT, name + '.png'), source)
    manifest[name] = {'cell': [cell_w, cell_h], 'origin': [round(left / cell_w, 3), round(1 - (PAD + 4 * scale) / cell_h, 3)], 'rows': rows}

    # The first frame is also the still picture: the map builder and the field journal use it.
    still, ax = placed[0]
    save(still, os.path.join(SRC, 'objects', kind, name + '.png'), source)
    print(f'{name}: sheet cell {cell_w}x{cell_h}, still {still.size}, objects.json origin [{round(ax / still.width, 3)}, {round(1 - 4 * scale / still.height, 3)}]')

os.makedirs(OUT, exist_ok=True)
json.dump({'_comment': 'Made by tools/prepare-sprite-art.py. One entry per animated sprite sheet in this folder: cell = the '
                       'size of one frame in pixels, origin = the ground point as a fraction of a cell, rows = how many '
                       'rows of four frames it has (trees: sway, fall, break; rocks and fire: one row).', **manifest},
          open(os.path.join(OUT, 'animations.json'), 'w', encoding='utf-8', newline='\n'), indent=2)

# Trims a picture to what is drawn in it.
def trimmed(pixels):
    ys, xs = np.nonzero(pixels[:, :, 3] > 40)
    return pixels[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

# ---- the bridge: trimmed and shrunk to span a ford (dry ground 380 units wide) -------------------
source = os.path.join(SRC, 'originals', 'props', 'bridge-painted.png')
bridge = trimmed(load(source))
save(shrink(bridge, 460 / bridge.shape[1]), os.path.join(SRC, 'objects', 'props', 'bridge.png'), source)

# ---- the item box: the top row of five slots, closed off with the panel's own bottom edge --------
source = os.path.join(ROOT, 'ui', 'item-box-10-slots.png')
panel = trimmed(load(source))
dark = (panel[:, :, :3].astype(int).sum(axis=2) < 200) & (panel[:, :, 3] > 200)   # the dark insides of the slots
slot_rows = [r for r in runs(dark.sum(axis=1) > 400, 1) if r[1] - r[0] > 40]
slot_cols = [c for c in runs(dark.sum(axis=0) > 200, 1) if c[1] - c[0] > 40]
cut = (slot_rows[0][1] + slot_rows[1][0]) // 2          # halfway between the two rows of slots
resume = slot_rows[1][1] + (cut - slot_rows[0][1])      # the same distance below the second row
strip = np.concatenate([panel[:cut], panel[resume:]])
save(shrink(strip, 880 / strip.shape[1]), os.path.join(UI, 'item-box.png'), source)
h, w = strip.shape[:2]
print('item box', (w, h), 'slots as % of the box: left', [round(100 * c[0] / w, 2) for c in slot_cols],
      'width', round(100 * (slot_cols[0][1] - slot_cols[0][0]) / w, 2),
      'top', round(100 * slot_rows[0][0] / h, 2), 'height', round(100 * (slot_rows[0][1] - slot_rows[0][0]) / h, 2))

# ---- the Build icon: the iron hammer, top right of the tools sheet -------------------------------
source = os.path.join(ROOT, 'items', 'tools-stone-iron.png')
tools = load(source)
hammer = trimmed(tools[:tools.shape[0] // 2, tools.shape[1] // 2:])
save(shrink(hammer, 96 / hammer.shape[0]), os.path.join(UI, 'build-hammer.png'), source)

# ---- the HUD panels: eight pieces painted on flat magenta (assets/ui/normal/) -------------------
# Where each panel sits on the 1536 x 1024 sheet: name -> (left, top, right, bottom). The item box on the
# sheet is not cut: the game uses the wooden five-slot box above instead.
HUD = {
    'goals': (101, 122, 450, 337),      # cream card: the goals list
    'banner': (561, 163, 966, 265),     # green strip between two pines: the region's name
    'player': (1066, 157, 1439, 284),   # green card: the player's name, clock and meters
    'minimap': (630, 394, 905, 679),    # the round wooden ring around the minimap
    'popup': (1041, 459, 1427, 659),    # cream card with a pointer: the build menu
    'toast': (121, 799, 499, 903),      # cream strip: short messages
    'prompt': (645, 808, 894, 891),     # dark wood with a cream key cap: the "E Gather" button
}

# Takes the magenta background out of a painted piece. A pixel is "magenta" by how far its red and blue
# stand above its green; half-magenta pixels on the outline become half see-through, and the pink that
# leaked into them is pulled back out so no pink rim is left.
def keyed(rgb):
    c = rgb.astype(float)
    spill = np.clip((np.minimum(c[:, :, 0], c[:, :, 2]) - c[:, :, 1] - 40) / 150, 0, 1)
    alpha = 1 - spill
    out = np.zeros(rgb.shape[:2] + (4,))
    for ch, m in enumerate((252, 10, 252)):
        out[:, :, ch] = np.clip((c[:, :, ch] - spill * m) / np.maximum(alpha, 0.05), 0, 255)
    out[:, :, 3] = alpha * 255
    return out.astype('uint8')

source = os.path.join(ROOT, 'ui', 'normal', 'normal-hud-components.png')
hud_sheet = np.asarray(Image.open(source).convert('RGB'))
for name, (x0, y0, x1, y1) in HUD.items():
    piece = keyed(hud_sheet[y0 - 3:y1 + 4, x0 - 3:x1 + 4])
    solid = piece[:, :, 3] > 40
    if name == 'popup':   # the pointer under the card is cut off: the menu does not sit over what it would point at
        piece = piece[:np.flatnonzero(solid.sum(axis=1) > 200).max() + 1]
    if name == 'minimap':   # say where the hole is, so the CSS can lay the ring exactly over the round map
        mid = solid[solid.shape[0] // 2 + 20]; col = solid[:, solid.shape[1] // 2]
        hole_x = np.flatnonzero(~mid); hole_x = hole_x[(hole_x > 20) & (hole_x < len(mid) - 20)]
        hole_y = np.flatnonzero(~col); hole_y = hole_y[(hole_y > 40) & (hole_y < len(col) - 20)]
        print('minimap ring', piece.shape[1], 'x', piece.shape[0], 'hole x', hole_x.min(), hole_x.max(), 'y', hole_y.min(), hole_y.max())
    save(Image.fromarray(piece), os.path.join(UI, f'hud-{name}.png'), source)

# ---- the item box's pictures: one per resource, from art the world already shows ----------------
# Wood is the firewood a felled oak ends as, stone is the loose-stones rock, food is the berry bush and herbs are
# the wildflowers they are picked from. Each is trimmed and fitted inside a 96-pixel square.
ICONS = {
    'wood': os.path.join(SRC, 'animations', 'oak-wind-fall-break.png'),
    'stone': os.path.join(SRC, 'objects', 'rocks', 'rocks-b.png'),
    'food': os.path.join(SRC, 'objects', 'plants', 'berry-bush.png'),
    'herbs': os.path.join(SRC, 'objects', 'plants', 'flowers.png'),
}
for name, source in ICONS.items():
    art = frames_of(load(source), 2, 3)[3]['pixels'] if name == 'wood' else trimmed(load(source))
    save(shrink(art, 96 / max(art.shape[:2])), os.path.join(UI, f'icon-{name}.png'), source)
