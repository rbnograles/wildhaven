"""Gets the full-size sprite-expansion art ready for the game (see docs/design/sprite-expansion.md).

The generated sheets are far bigger than the game draws them, and each frame sits loosely in its cell. This
script cuts every frame out, lines the frames up on one ground point, shrinks them to game size and saves
tidy sheets the renderer can play like a flip-book.
Inputs : source/animations/<name>.png              tree, rock, fire and water-ripple animation sheets (4 columns)
         source/originals/props/bridge-painted.png the painted bridge
         assets/ui/normal/status-inventory-components.png   the player card and item box pieces
         assets/ui/character-portraits-normal-winter.png    the three characters' round portraits
         assets/ui/item-box-10-slots.png           the item box with ten painted slots
         assets/items/tools-stone-iron.png, axes-stone-iron.png   the painted hammer, pickaxe and axe, stone and iron
         source/effects/footprints.png             six boot prints: left and right, in soil, sand and snow
         source/originals/props/sticks.png         the painted pile of sticks
         source/paths/path-dirt.png, path-cobblestone.png   the painted path modules (only the straight piece is used)
         assets/items/keepsakes/pinefall-keepsakes.png      seven small finds: notebook, feather, pine cone, stones, antler
Outputs: assets/world/animations/<sprite>.png      one sheet per animated sprite, every cell the same size
         assets/world/animations/animations.json   each sheet's cell size, origin and rows
         source/objects/<kind>/<sprite>.png        the first frame, as the still picture the map builder uses
         source/objects/props/bridge.png           the bridge at game size
         assets/ui/game/status-*.png, item-*.png, portrait-<id>.png   the player card and item box pieces
         assets/ui/game/item-box.png               the ten-slot item box, trimmed and shrunk
         assets/ui/game/tool-<id>-<tier>.png       the tool pictures for the tools row above the item box
         assets/ui/game/hud-<name>.png             the HUD panels, cut from assets/ui/normal/normal-hud-components.png
         assets/world/effects/footprints.png, footprints.json   the boot prints the player leaves, and their cell size
         source/objects/props/path-<kind>-<a|b>.png  short pieces of path the map builder lays end to end
         source/objects/<kind>/<find>.png          the finds lying in the world (feather, pine-cone, antler, three stones)
         assets/ui/game/item-<find>.png, icon-journal.png   the finds' item-box pictures and the journal button's notebook
The inputs are never changed, so it is safe to re-run. It prints the origin of each still picture; copy those
into source/objects.json if they change.
Run: python tools/prepare-sprite-art.py, then python tools/build-map.py
"""
import json, os, shutil
import numpy as np
from PIL import Image, ImageFilter

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

# ---- water ripples: three little looping flip-books, one per row of the sheet --------------------
# Row 1 is a river current, row 2 a quiet lake's rings, row 3 low sea waves. Each row is the same patch of water
# changing over time, so a frame must keep its place in its equal cell: the four cells of a row are only cleaned,
# cropped to the one box that holds all four frames, and shrunk. `loop` in the manifest is how many frames a
# second the renderer plays, round and round.
# name -> (row of the sheet, how wide the patch is drawn in world units, frames a second)
WATER = {'river-ripple': (0, 76, 1.5), 'lake-ripple': (1, 96, 1), 'sea-wave': (2, 110, 1.25)}
source = os.path.join(SRC, 'animations', 'water-ripples-flat-v2.png')
sheet = load(source).copy()
# Drop only faint background noise; amplifying the remaining alpha turns reflections into opaque foam.
sheet[sheet[:, :, 3] < 24, 3] = 0
cell_h, cell_w = sheet.shape[0] // 3, sheet.shape[1] // COLS
for name, (row, width, fps) in WATER.items():
    cells = [sheet[row * cell_h:(row + 1) * cell_h, c * cell_w:(c + 1) * cell_w] for c in range(COLS)]
    ys, xs = np.nonzero(np.max([c[:, :, 3] for c in cells], axis=0) > 40)
    frames = [shrink(c[ys.min():ys.max() + 1, xs.min():xs.max() + 1], width / (xs.max() - xs.min() + 1)) for c in cells]
    w, h = frames[0].width + 2 * PAD, frames[0].height + 2 * PAD
    out = Image.new('RGBA', (w * COLS, h))
    for i, im in enumerate(frames): out.alpha_composite(im, (i * w + PAD, PAD))
    save(out, os.path.join(OUT, name + '.png'), source)
    manifest[name] = {'cell': [w, h], 'origin': [0.5, 0.5], 'rows': 1, 'loop': fps}
    save(frames[1], os.path.join(SRC, 'objects', 'props', name + '.png'), source)   # frame two is the still: frame one of the lake is tiny
    print(f'{name}: sheet cell {w}x{h}, objects.json origin [0.5, 0.5]')

os.makedirs(OUT, exist_ok=True)
json.dump({'_comment': 'Made by tools/prepare-sprite-art.py. One entry per animated sprite sheet in this folder: cell = the '
                       'size of one frame in pixels, origin = the ground point as a fraction of a cell, rows = how many '
                       'rows of four frames it has (trees: sway, fall, break; rocks and fire: one row), loop = for water '
                       'ripples only, how many frames a second the sheet plays round and round.', **manifest},
          open(os.path.join(OUT, 'animations.json'), 'w', encoding='utf-8', newline='\n'), indent=2)

# Trims a picture to what is drawn in it.
def trimmed(pixels):
    ys, xs = np.nonzero(pixels[:, :, 3] > 40)
    return pixels[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

# ---- the bridge: trimmed and shrunk to span a ford (dry ground 380 units wide) -------------------
source = os.path.join(SRC, 'originals', 'props', 'bridge-painted.png')
bridge = trimmed(load(source))
save(shrink(bridge, 460 / bridge.shape[1]), os.path.join(SRC, 'objects', 'props', 'bridge.png'), source)

# ---- the HUD panels: eight pieces painted on flat magenta (assets/ui/normal/) -------------------
# Where each panel sits on the 1536 x 1024 sheet: name -> (left, top, right, bottom). The sheet's player card and
# item box are not cut: the game uses the pieces of the status and inventory sheet (further down) for those.
HUD = {
    'goals': (101, 122, 450, 337),      # cream card: the goals list
    'banner': (561, 163, 966, 265),     # green strip between two pines: the region's name
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

# ---- the player card and item box: eighteen loose pieces on one see-through sheet ----------------
# Where each piece sits on assets/ui/normal/status-inventory-components.png: file name -> (left, top, right,
# bottom, longest side in the saved file). The sheet's own portrait is not cut: the three characters' portraits
# come from the portraits sheet below.
STATUS = {
    'status-card': (47, 32, 746, 253, 700),        # the player card's frame: wood around dark leather
    'item-card': (783, 39, 1489, 251, 707),        # the item box's frame: wood around green felt
    'status-dial': (366, 288, 641, 565, 160),      # the day and night dial
    'status-trough': (720, 293, 1449, 355, 365),   # the empty groove a meter's bar sits in
    'status-health': (722, 373, 1447, 418, 365),   # the three bars: red, ochre, and blue running to orange
    'status-hunger': (720, 441, 1448, 486, 365),
    'status-warmth': (720, 508, 1448, 553, 365),
    'status-icon-health': (97, 620, 231, 733, 64),
    'status-icon-hunger': (300, 608, 393, 734, 64),
    'status-icon-warmth': (479, 596, 586, 736, 64),
    'item-wood': (649, 598, 823, 740, 96),
    'item-stone': (867, 601, 1035, 729, 96),
    'item-food': (1088, 593, 1250, 736, 96),
    'item-herbs': (1305, 590, 1452, 745, 96),
    'item-slot': (304, 791, 504, 992, 120),        # one empty dark slot
    'item-badge': (685, 852, 826, 930, 72),        # the little plate a count is written on
    'item-build': (993, 769, 1245, 1005, 150),     # the green Build button, hammer above, room for its name below
}
# The top row of the portraits sheet (the bottom row is the same three with snow, for winter later).
PORTRAITS = {'scout': (90, 31, 501, 454), 'builder': (558, 31, 970, 454), 'survivor': (1028, 32, 1440, 454)}

# Cuts one piece out of a sheet, with a little clear room around it, and shrinks it so its longest side is `size`.
def piece_of(sheet, box, size):
    x0, y0, x1, y1 = box
    cut = sheet[y0 - 2:y1 + 3, x0 - 2:x1 + 3]
    return shrink(cut, size / max(cut.shape[:2]))

# The small pictures (wood, stone, berries, herbs, heart, fork and spoon, flame) were painted with a soft glow
# behind them, which showed in the game as a murky square around each one. These are lifted off that glow.
LIFTED = ('item-wood', 'item-stone', 'item-food', 'item-herbs',
          'status-icon-health', 'status-icon-hunger', 'status-icon-warmth')
LIFT_EDGE = 16   # how sharp a change in colour must be to count as a picture's outline (the glow is far softer)

# Lifts a small picture off the soft glow painted behind it. The glow changes colour slowly and the picture's
# outline changes sharply, so we start at the crop's rim and spread inward over every slowly-changing pixel,
# like water filling a tray until it meets a wall. Whatever the water reached is glow and turns see-through.
def lifted(cut):
    c = cut.astype(float)
    solid = (c[:, :, :3] * c[:, :, 3:] / 255).astype('uint8')
    soft = np.asarray(Image.fromarray(solid).filter(ImageFilter.GaussianBlur(1))).astype(float)
    gy, gx = np.gradient(soft, axis=(0, 1))
    calm = np.pad(np.sqrt(gx ** 2 + gy ** 2).sum(axis=2) <= LIFT_EDGE, 1, constant_values=True)
    glow = np.zeros_like(calm); glow[0] = glow[-1] = True; glow[:, 0] = glow[:, -1] = True
    while True:
        grown = glow.copy()
        grown[1:] |= glow[:-1]; grown[:-1] |= glow[1:]; grown[:, 1:] |= glow[:, :-1]; grown[:, :-1] |= glow[:, 1:]
        grown &= calm
        if (grown == glow).all(): break
        glow = grown
    # Thin specks left outside the outline are rubbed off, and the cut edge is softened a little.
    keep = Image.fromarray((~glow[1:-1, 1:-1] * 255).astype('uint8'))
    keep = keep.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.7))
    out = cut.copy(); out[:, :, 3] = np.minimum(cut[:, :, 3], np.asarray(keep))
    return trimmed(out)

source = os.path.join(ROOT, 'ui', 'normal', 'status-inventory-components.png')
status_sheet = load(source)
for name, (x0, y0, x1, y1, size) in STATUS.items():
    if name in LIFTED:
        art = lifted(status_sheet[y0 - 12:y1 + 13, x0 - 12:x1 + 13])
        save(shrink(art, size / max(art.shape[:2])), os.path.join(UI, name + '.png'), source)
        continue
    save(piece_of(status_sheet, (x0, y0, x1, y1), size), os.path.join(UI, name + '.png'), source)

source = os.path.join(ROOT, 'ui', 'character-portraits-normal-winter.png')
portrait_sheet = load(source)
for name, box in PORTRAITS.items():
    save(piece_of(portrait_sheet, box, 160), os.path.join(UI, f'portrait-{name}.png'), source)

# ---- the ten-slot item box: one whole picture, two rows of five painted slots --------------------
# The slots are part of the picture, so the game lays its item pictures over them. To line them up, this
# prints where the slots are (as percentages of the saved picture); copy those into the `.hotbar` rules
# in src/style.css if the picture changes. A slot is found by its dark inside: darker than the green felt.
source = os.path.join(ROOT, 'ui', 'item-box-10-slots.png')
box = trimmed(load(source))
save(shrink(box, 720 / box.shape[1]), os.path.join(UI, 'item-box.png'), source)
dark = (box[:, :, :3].astype(int).sum(axis=2) < 230) & (box[:, :, 3] > 200)
cols = [r for r in runs(dark.sum(axis=0) > box.shape[0] * 0.4) if r[1] - r[0] > 60]
rows = [r for r in runs(dark.sum(axis=1) > box.shape[1] * 0.4) if r[1] - r[0] > 60]
pct = lambda v, whole: round(100 * v / whole, 2)
print('item box', box.shape[1], 'x', box.shape[0],
      'slot columns %', [(pct(a, box.shape[1]), pct(b, box.shape[1])) for a, b in cols],
      'slot rows %', [(pct(a, box.shape[0]), pct(b, box.shape[0])) for a, b in rows])

# ---- the tool pictures: two sheets of equal cells, one tool in each cell ---------------------------
# Sheet name -> its rows of tools, top to bottom. Every sheet has two columns: the stone tool, then the iron
# one. Each tool is trimmed and shrunk so its longest side is 64 px, twice the size the tools row draws it,
# so it stays sharp on dense screens.
TOOL_SHEETS = {'tools-stone-iron': ['hammer', 'pickaxe'], 'axes-stone-iron': ['axe']}
TOOL_COLS = ['stone', 'iron']

for sheet_name, tool_rows in TOOL_SHEETS.items():
    source = os.path.join(ROOT, 'items', sheet_name + '.png')
    tool_sheet = load(source)
    cell_h, cell_w = tool_sheet.shape[0] // len(tool_rows), tool_sheet.shape[1] // len(TOOL_COLS)
    for r, tool in enumerate(tool_rows):
        for c, tier in enumerate(TOOL_COLS):
            art = trimmed(tool_sheet[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w])
            save(shrink(art, 64 / max(art.shape[:2])), os.path.join(UI, f'tool-{tool}-{tier}.png'), source)

# ---- footprints: six boot prints the player leaves behind when walking --------------------------------
# The sheet has two columns (left boot, right boot) and three rows (soil, sand, snow), toes pointing up. Each
# print is painted with a faint glow around it, which would show as a smudge on the grass, so anything fainter
# than FOOT_GLOW is dropped. Every print is then trimmed, shrunk to FOOT_HEIGHT pixels tall (twice the size the
# game draws it, so it stays sharp) and centred in a cell; all six cells are the same size.
FOOT_COLS, FOOT_ROWS, FOOT_HEIGHT, FOOT_GLOW = 2, 3, 40, 70
source = os.path.join(SRC, 'effects', 'footprints.png')
foot_sheet = load(source).copy()
foot_sheet[foot_sheet[:, :, 3] < FOOT_GLOW, 3] = 0
cell_h, cell_w = foot_sheet.shape[0] // FOOT_ROWS, foot_sheet.shape[1] // FOOT_COLS
prints = []
for row in range(FOOT_ROWS):
    for col in range(FOOT_COLS):
        art = trimmed(foot_sheet[row * cell_h:(row + 1) * cell_h, col * cell_w:(col + 1) * cell_w])
        prints.append(shrink(art, FOOT_HEIGHT / art.shape[0]))
w, h = max(im.width for im in prints) + 2 * PAD, FOOT_HEIGHT + 2 * PAD
out = Image.new('RGBA', (w * FOOT_COLS, h * FOOT_ROWS))
for i, im in enumerate(prints):
    out.alpha_composite(im, ((i % FOOT_COLS) * w + (w - im.width) // 2, (i // FOOT_COLS) * h + PAD))
EFFECTS = os.path.join(ROOT, 'world', 'effects')
save(out, os.path.join(EFFECTS, 'footprints.png'), source)
json.dump({'_comment': 'Made by tools/prepare-sprite-art.py. cell = the size of one boot print in pixels. The sheet has two '
                       'columns (left boot, right boot) and three rows (soil, sand, snow); toes point up.',
           'cell': [w, h]},
          open(os.path.join(EFFECTS, 'footprints.json'), 'w', encoding='utf-8', newline='\n'), indent=2)
print(f'footprints: sheet cell {w}x{h}')

# ---- the sticks: the painted pile of fallen branches, trimmed and shrunk ---------------------------
# Saved 170 px wide, twice the size the game draws it (objects.json scales it by 0.5), like the small stones.
source = os.path.join(SRC, 'originals', 'props', 'sticks.png')
pile = trimmed(load(source))
save(shrink(pile, 170 / pile.shape[1]), os.path.join(SRC, 'objects', 'props', 'sticks.png'), source)

# ---- paths: short straight pieces the map builder lays end to end along a route ----------------------
# Each path sheet has four modules (straight, bend, T, crossroads). A route across the map winds at every angle,
# which the square modules can't follow, so only the straight one (top left) is used: two overlapping windows are
# cut from it, and tools/build-map.py lays them one after another, each turned to face along the route, like
# laying short planks round a curve. Both ends of a piece fade out, so two pieces overlap without a seam.
# Sheet name -> the sprite name its pieces are saved under.
PATH_SHEETS = {'path-dirt': 'path-dirt', 'path-cobblestone': 'path-stone'}
PATH_WIDTH = 110     # how wide a piece is drawn across the path, leafy edges included, in world units
PATH_WINDOWS = {'a': 0.06, 'b': 0.44}   # where each window starts along the straight module, as a share of its length
PATH_WINDOW = 0.5    # how long a window is, as a share of the module's length
PATH_FADE = 0.2      # the share of a piece's length, at each end, over which it fades out

for sheet_name, sprite_name in PATH_SHEETS.items():
    source = os.path.join(SRC, 'paths', sheet_name + '.png')
    path_sheet = load(source)
    strip = trimmed(path_sheet[:path_sheet.shape[0] // 2, :path_sheet.shape[1] // 2])
    length = int(strip.shape[1] * PATH_WINDOW)
    # 0 at both ends of a piece, 1 along its middle.
    ramp = np.clip(np.minimum(np.arange(length), length - 1 - np.arange(length)) / (length * PATH_FADE), 0, 1)
    for letter, start in PATH_WINDOWS.items():
        x0 = int(strip.shape[1] * start)
        piece = strip[:, x0:x0 + length].copy()
        piece[:, :, 3] = (piece[:, :, 3] * ramp[None, :]).astype('uint8')
        # Saved at twice its game size (objects.json scales it by 0.5), so it stays sharp when turned.
        save(shrink(piece, 2 * PATH_WIDTH / piece.shape[0]), os.path.join(SRC, 'objects', 'props', f'{sprite_name}-{letter}.png'), source)
    print(f'{sprite_name}: pieces {round(length * PATH_WIDTH / strip.shape[0])} units long, {PATH_WIDTH} wide')

# ---- the finds: small things lying about the world, and the journal's notebook ------------------------
# The sheet has four columns and two rows of equal cells, one painted thing in each (the last cell is empty).
# Each entry says where the thing is (column, row) and what is made from it:
#   world = (kind folder, sprite name, longest side in pixels): the picture lying on the ground, saved at twice
#           its game size (objects.json scales it by 0.5) so it stays sharp;
#   ui    = the file name in assets/ui/game/ of its 96-pixel picture for the item box or a HUD button.
FINDS = [
    (0, 0, None, 'icon-journal'),                           # the leather notebook: the journal button's picture
    (1, 0, ('props', 'feather', 84), 'item-feather'),
    (2, 0, ('props', 'pine-cone', 64), 'item-pinecone'),
    (3, 0, ('rocks', 'mossy-stone', 84), None),             # the three stones all give plain stone, so they
    (0, 1, ('props', 'antler', 88), 'item-antler'),         # need no item-box picture of their own
    (1, 1, ('rocks', 'grey-rock', 80), None),
    (2, 1, ('rocks', 'flat-stone', 88), None),
]
source = os.path.join(ROOT, 'items', 'keepsakes', 'pinefall-keepsakes.png')
finds_sheet = load(source)
cell_h, cell_w = finds_sheet.shape[0] // 2, finds_sheet.shape[1] // 4
for col, row, world, ui in FINDS:
    art = trimmed(finds_sheet[row * cell_h:(row + 1) * cell_h, col * cell_w:(col + 1) * cell_w])
    if world:
        kind, name, size = world
        save(shrink(art, size / max(art.shape[:2])), os.path.join(SRC, 'objects', kind, name + '.png'), source)
    if ui: save(shrink(art, 96 / max(art.shape[:2])), os.path.join(UI, ui + '.png'), source)
