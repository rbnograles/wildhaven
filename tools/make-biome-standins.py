"""Makes stand-in art for the big-world biomes out of art that already exists.

It tints or redraws existing textures and sprites so the map can be built before real art is
generated. It NEVER overwrites: if a file is already there (a stand-in or real art) it is kept.
Textures go in source/ground/; each sprite goes in the objects/<kind>/ folder its objects.json entry names.
To replace a stand-in, generate the image from its .prompt.txt, save it over the PNG, and re-run
tools/build-map.py. Run: python tools/make-biome-standins.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'world', 'source')
GROUND = os.path.join(SRC, 'ground')
# Each sprite's kind folder under objects/ (trees, plants, rocks, buildings or props), from objects.json.
KIND = {k: v['kind'] for k, v in json.load(open(os.path.join(SRC, 'objects.json'), encoding='utf-8')).items()
        if not k.startswith('_')}
STYLE = ('Warm hand-painted 2D indie RPG style with clean soft outlines, matching the supplied character sprite '
         'reference: earthy greens, moss, warm ochre, soft warm light from the upper left. Elevated near-top-down '
         'orthographic game camera. No text, labels, UI, borders, grid lines or characters.')
REFERENCE = ('Input image: the supplied character sprite sheet is a STYLE REFERENCE ONLY; do not depict the '
             'characters or the sheet.')


# Writes one image and its prompt file, unless the image already exists.
def save(image, path, prompt):
    if os.path.exists(path):
        print('kept', os.path.relpath(path, SRC)); return
    image.save(path)
    open(path[:-4] + '.prompt.txt', 'w', encoding='utf-8').write(prompt + '\n')
    print('made', os.path.relpath(path, SRC))


# Builds the generation prompt for a seamless ground texture.
def texture_prompt(subject):
    return ('Use case: stylized-concept. Asset type: seamless ground texture for Wildhaven.\n' + REFERENCE + '\n'
            'Seamless tileable square ground texture for a top-down game, viewed straight down, filling the whole '
            f'image edge to edge: {subject}. Even lighting and even tone across the image, small-scale detail only, '
            'no large objects, no shadows from off-screen things, no vignette, no focal point. Left edge matches '
            'right edge and top edge matches bottom edge so it repeats without visible seams. Opaque square '
            '1024 x 1024 texture. The straight-down ground-plane view and even illumination take priority over '
            'directional shading.\n' + STYLE)


# Builds the generation prompt for one object sprite of about w x h pixels.
def object_prompt(subject, w, h):
    return ('Use case: stylized-concept. Asset type: isolated environment object sprite for Wildhaven.\n'
            + REFERENCE + '\n'
            f'Single isolated game object sprite on GENUINE TRANSPARENT ALPHA: {subject}. The whole object is visible '
            'with transparent padding on every side; nothing touches the image edge. No ground patch, no grass, no '
            'background, no cast shadow on the ground, no checkerboard. One object only. Compose to fit an '
            f'approximately {w} x {h} game sprite; it will be scaled to that size. Use ample clear alpha padding and '
            'retain an easily readable silhouette at small game size.\n' + STYLE)


# Recolours an image: first fades it towards grey by `gray` (0 to 1), then multiplies and adds per channel.
def recolor(image, mul, add=(0, 0, 0), gray=0.0):
    a = np.asarray(image.convert('RGBA')).astype(float)
    rgb = a[..., :3]
    lum = rgb.mean(axis=2, keepdims=True)
    a[..., :3] = np.clip((rgb * (1 - gray) + lum * gray) * np.array(mul) + np.array(add), 0, 255)
    return Image.fromarray(a.astype('uint8'))


# Where one sprite's PNG lives: objects/<kind>/<name>.png.
def obj(name): return os.path.join(SRC, 'objects', KIND[name], f'{name}.png')
def texture(name): return Image.open(os.path.join(GROUND, f'{name}.png'))
def sprite(name): return Image.open(obj(name)).convert('RGBA')
def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


# ---- ground textures ---------------------------------------------------------------------
save(recolor(texture('grass'), (0.35, 0.36, 0.38), (185, 192, 202), gray=1).convert('RGB'), os.path.join(GROUND, 'snow.png'),
     texture_prompt('soft packed snow in cool white with faint pale-blue drifts and a few tiny wind ripples; no '
                    'footprints, rocks or plants'))
save(recolor(texture('dirt'), (0.8, 0.8, 0.82), (10, 10, 14), gray=0.85).convert('RGB'), os.path.join(GROUND, 'rock.png'),
     texture_prompt('weathered grey-brown canyon bedrock with fine cracks and small pebbles; no large boulders, '
                    'plants or water'))
save(recolor(texture('grass'), (0.45, 0.72, 0.5), (0, 6, 8)).convert('RGB'), os.path.join(GROUND, 'jungle.png'),
     texture_prompt('dense dark-green jungle floor of moss, tiny ferns and fallen leaves; no flowers, roots or bare '
                    'earth'))

# ---- sprites derived from existing ones ----------------------------------------------------
save(recolor(sprite('pine'), (0.75, 0.85, 0.95), (55, 60, 70), gray=0.35), obj('snowy-pine'),
     object_prompt('one tall pine tree with heavy snow resting on its dark-green branches', 150, 210))
save(recolor(sprite('rocks-b'), (0.75, 0.9, 1.05), (40, 55, 70), gray=0.7), obj('ice-rock'),
     object_prompt('a low cluster of pale-blue ice-crusted rocks with frosted tops', 265, 135))
save(recolor(sprite('rocks-a'), (0.85, 0.83, 0.8), gray=0.9), obj('boulder'),
     object_prompt('a cluster of large rounded grey canyon boulders', 290, 170))
save(recolor(sprite('rocks-a').resize((290, 255), Image.LANCZOS), (0.7, 0.66, 0.62), gray=0.9), obj('cliff-rock'),
     object_prompt('a tall jagged outcrop of layered grey-brown canyon rock, taller than a person', 290, 255))
save(recolor(sprite('big-oak'), (0.45, 0.8, 0.5), (0, 5, 5)), obj('jungle-tree'),
     object_prompt('one broad tropical jungle tree with a dense deep-green canopy, buttress roots and hanging vines',
                   270, 320))
save(recolor(sprite('berry-bush'), (0.5, 0.95, 0.45), gray=0.2), obj('fern'),
     object_prompt('a low spray of broad bright-green jungle fern fronds', 150, 104))
save(recolor(sprite('oak').resize((200, 300), Image.LANCZOS), (0.8, 1.0, 0.55), (15, 10, 0)), obj('palm'),
     object_prompt('one leaning coconut palm tree with a slim curved trunk and a crown of long green fronds', 200, 300))
save(recolor(sprite('berry-bush'), (0.75, 0.6, 0.42), (40, 25, 10), gray=0.9), obj('dead-bush'),
     object_prompt('a dry leafless desert bush of tangled pale-brown twigs', 150, 104))

# ---- sprites drawn from simple shapes ------------------------------------------------------
OUT = 3  # outline width

cactus = blank(110, 170); d = ImageDraw.Draw(cactus)
for box in ((40, 12, 70, 164), (12, 60, 34, 112), (76, 44, 98, 100), (24, 96, 52, 114), (58, 84, 88, 102)):
    d.rounded_rectangle(box, 12, fill=(86, 140, 84), outline=(50, 84, 58), width=OUT)
save(cactus, obj('cactus'),
     object_prompt('one tall green saguaro cactus with two upturned arms', 110, 170))

ruin = blank(280, 220); d = ImageDraw.Draw(ruin)
for box in ((24, 60, 72, 212), (116, 20, 164, 212), (208, 96, 256, 212)):
    d.rectangle(box, fill=(214, 178, 120), outline=(150, 112, 70), width=OUT)
d.rectangle((14, 44, 176, 68), fill=(226, 192, 136), outline=(150, 112, 70), width=OUT)
d.rectangle((10, 200, 270, 216), fill=(196, 160, 104), outline=(150, 112, 70), width=OUT)
save(ruin, obj('sandstone-ruin'),
     object_prompt('a small ruin of three weathered sandstone columns on a cracked stone base, one still carrying a '
                   'broken lintel', 280, 220))

bridge = blank(420, 300); d = ImageDraw.Draw(bridge)
d.rounded_rectangle((6, 6, 414, 294), 14, fill=(140, 98, 60), outline=(88, 58, 34), width=OUT)
for x in range(40, 414, 34): d.line((x, 8, x, 292), fill=(104, 70, 42), width=2)
save(bridge, obj('bridge'),
     object_prompt('a flat wooden plank bridge deck seen from directly above, weathered boards side by side with '
                   'rope-bound edges, no railings, no water', 420, 300))

sign = blank(90, 130); d = ImageDraw.Draw(sign)
d.rectangle((40, 30, 50, 126), fill=(120, 84, 52), outline=(72, 48, 28), width=2)
d.polygon(((8, 14), (70, 14), (84, 30), (70, 46), (8, 46)), fill=(190, 150, 96), outline=(72, 48, 28))
save(sign, obj('signpost'),
     object_prompt('a wooden trail signpost: one upright post carrying a single arrow-shaped plank pointing right',
                   90, 130))

# ---- sea and boats (archipelago slice A1) --------------------------------------------------
save(recolor(texture('water'), (0.5, 0.62, 0.78), (0, 4, 18)).convert('RGB'), os.path.join(GROUND, 'deep.png'),
     texture_prompt('deep open sea water in dark teal-blue with slow broad swells and faint lighter wave crests; '
                    'no foam, rocks, fish or shore'))

# Draws a small rowboat seen from above at a slight angle, bow pointing right. `broken` knocks out three planks,
# so the beach shows through the holes.
def rowboat(inside, rim, broken):
    im = blank(200, 90); d = ImageDraw.Draw(im)
    d.polygon([(6, 46), (40, 12), (150, 10), (194, 46), (150, 80), (40, 78)], fill=rim, outline=(60, 40, 24))
    d.polygon([(22, 46), (48, 24), (146, 22), (176, 46), (146, 68), (48, 66)], fill=inside)
    for x in (78, 122): d.rectangle((x, 24, x + 10, 68), fill=rim)   # two seats across the hull
    if broken:
        for x in (58, 100, 140): d.rectangle((x, 30, x + 12, 60), fill=(0, 0, 0, 0))
    return im

save(rowboat((150, 140, 120), (112, 100, 84), True), obj('old-boat'),
     object_prompt('an old wooden rowboat lying on a beach, weathered grey planks with several missing, seen from '
                   'above at a slight angle with the bow pointing right', 200, 90))
save(rowboat((150, 102, 60), (110, 72, 40), False), obj('rowboat'),
     object_prompt('a small sturdy wooden rowboat with warm brown planks and two seats, seen from above at a slight '
                   'angle with the bow pointing right; no water around it', 200, 90))
drift = blank(150, 70); d = ImageDraw.Draw(drift)
d.rounded_rectangle((8, 30, 142, 48), 9, fill=(196, 182, 160), outline=(118, 104, 86), width=OUT)
d.rounded_rectangle((30, 14, 120, 30), 8, fill=(206, 194, 172), outline=(118, 104, 86), width=OUT)
d.line((96, 48, 118, 62), fill=(150, 136, 116), width=5)
save(drift, obj('driftwood'),
     object_prompt('two or three bleached grey driftwood branches lying flat on sand', 150, 70))
