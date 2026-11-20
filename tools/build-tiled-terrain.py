"""Build editor-only 64px terrain palettes from existing and image-generated materials.

Run: python tools/build-tiled-terrain.py
Writes only assets/world/tiled/terrain-*; never rebuilds the live map or object sheet.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/world/tiled'
GROUND = ROOT / 'assets/world/source/ground'
NAMES = ['grass', 'dirt', 'soil', 'jungle', 'rock', 'snow', 'sand', 'water', 'deep']
COLORS = ['#83963f', '#b88643', '#65442e', '#376c33', '#858079', '#dfe9f0', '#dfbb76', '#44a8a4', '#246784']
TILE, STRIDE, COLS = 64, 66, 12
# First 3x3 is a complete rounded patch. Last column/bottom row hold special cases.
# Bits are TL=1, TR=2, BL=4, BR=8; layout is deliberately readable without Terrain Brush.
LAYOUT = [8, 12, 4, 0, 10, 15, 5, 6, 2, 3, 1, 9, 7, 11, 13, 14]
Y, X = np.mgrid[0:TILE, 0:TILE].astype(float) + 0.5


def load_materials(variant):
    if variant not in ('current', 'redrawn'):
        raise ValueError('variant must be current or redrawn')
    atlas = Image.open(OUT / 'source/terrain-materials-redrawn.png').convert('RGB') if variant == 'redrawn' else None
    textures = {}
    for i, name in enumerate(NAMES):
        if atlas is None:
            with Image.open(GROUND / f'{name}.png') as source:
                im = source.convert('RGB')
        else:
            c, r = i % 3, i // 3
            im = atlas.crop((round(c * atlas.width / 3), round(r * atlas.height / 3),
                             round((c + 1) * atlas.width / 3), round((r + 1) * atlas.height / 3)))
        tex = np.asarray(im.resize((TILE, TILE), Image.Resampling.LANCZOS)).astype(float)
        # Resolve material sampling at opposite borders so arbitrary matching tiles can join.
        for axis in (0, 1):
            for p in range(8):
                near, far = [slice(None)] * 3, [slice(None)] * 3
                near[axis], far[axis] = p, TILE - p - 1
                near, far = tuple(near), tuple(far)
                mean = (tex[near] + tex[far]) / 2
                weight = (1 - p / 8) ** 2
                tex[near] = tex[near] * (1 - weight) + mean * weight
                tex[far] = tex[far] * (1 - weight) + mean * weight
        textures[name] = tex
    return textures


def boundary(first, second):
    t = np.arange(TILE) + 0.5
    if first == second:
        return np.full(TILE, 64.0 if first else -64.0)
    return 32 - t if first else t - 32


def distance(mask):
    discs = [32 - np.hypot(X - cx, Y - cy) for cx, cy in ((0, 0), (64, 0), (0, 64), (64, 64))]
    count = mask.bit_count()
    if count in (0, 4):
        d = np.full((TILE, TILE), 64.0 if count else -64.0)
    elif count == 1:
        d = discs[(mask.bit_length() - 1)].copy()
    elif count == 3:
        d = -discs[((15 ^ mask).bit_length() - 1)]
    elif mask in (3, 12, 5, 10):
        d = {3: 32 - Y, 12: Y - 32, 5: 32 - X, 10: X - 32}[mask].copy()
    else:
        d = np.maximum.reduce([discs[i] for i in range(4) if mask & (1 << i)])
    # Small organic contour variation vanishes at joins; no phase-dependent tile variants.
    d += 1.1 * np.sin(X * np.pi / 8) * np.sin(Y * np.pi / 8)
    tl, tr, bl, br = [bool(mask & bit) for bit in (1, 2, 4, 8)]
    d[0], d[-1] = boundary(tl, tr), boundary(bl, br)
    d[:, 0], d[:, -1] = boundary(tl, bl), boundary(tr, br)
    return d


def make_tile(texture, mask, name):
    d = distance(mask)
    # Finishes are applied only at an exposed contour, never around a solid center tile.
    finishes = {
        'grass': ((76, 74, 30), (178, 177, 74), 3.2),
        'jungle': ((31, 61, 27), (95, 128, 49), 3.6),
        'dirt': ((108, 72, 35), (213, 166, 92), 2.6),
        'soil': ((49, 32, 22), (129, 91, 53), 2.8),
        'rock': ((78, 75, 71), (177, 171, 154), 2.4),
        'snow': ((143, 174, 193), (247, 247, 239), 4.0),
        'sand': ((171, 137, 80), (248, 218, 153), 3.2),
        'water': ((214, 240, 221), (100, 192, 181), 3.6),
        'deep': ((30, 86, 111), (61, 131, 149), 4.5),
    }
    dark, light, width = finishes[name]
    rim = np.exp(-((d - 0.9) / 1.4) ** 2)[..., None] * 0.65
    lip = np.exp(-((d - width) / 1.5) ** 2)[..., None] * 0.32
    rgb = texture * (1 - rim) + np.array(dark) * rim
    rgb = rgb * (1 - lip) + np.array(light) * lip
    alpha = np.clip(d + 0.5, 0, 1) * 255
    pixels = np.rint(np.dstack((np.clip(rgb, 0, 255), alpha))).astype('uint8')
    pixels[alpha == 0] = 0
    return Image.fromarray(pixels)


def tile_id(material, mask):
    position = LAYOUT.index(mask)
    return (material // 3 * 4 + position // 4) * COLS + material % 3 * 4 + position % 4


def wang_id(mask):
    return ','.join(str(v) for v in (0, bool(mask & 2) * 1, 0, bool(mask & 8) * 1,
                                      0, bool(mask & 4) * 1, 0, bool(mask & 1) * 1))


def write_xml(root, path):
    ET.indent(root, space=' ')
    ET.ElementTree(root).write(path, encoding='UTF-8', xml_declaration=True)


def demo(variant, output, tiles):
    width, height = 32, 24
    yy, xx = np.mgrid[:height + 1, :width + 1]
    ellipse = lambda x, y, rx, ry: ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2 < 1
    land = ellipse(16, 12, 13.4, 9.3)
    fields = [
        ('deep', np.ones_like(xx, dtype=bool)),
        ('water', ellipse(16, 12, 16, 11.7)),
        ('sand', ellipse(16, 12, 14.8, 10.5)),
        ('grass', land),
        ('jungle', ellipse(10, 16, 4.8, 3.8) & land),
        ('rock', ellipse(23, 8, 4.4, 4.0) & land),
        ('snow', ellipse(24, 7, 3.4, 3.0) & land),
        ('dirt', (np.abs(yy - 12 - 1.1 * np.sin(xx / 3)) < 1.05) & (xx > 5) & (xx < 26) & land),
        ('soil', (xx >= 13) & (xx <= 18) & (yy >= 15) & (yy <= 19) & ~((xx == 15) & (yy == 17))),
        ('water', ellipse(9, 7, 2.5, 1.8)),
    ]
    root = ET.Element('map', version='1.10', tiledversion='1.11.0', orientation='orthogonal',
                      renderorder='right-down', width=str(width), height=str(height),
                      tilewidth='64', tileheight='64', infinite='0', nextlayerid=str(len(fields) + 1), nextobjectid='1')
    ET.SubElement(root, 'tileset', firstgid='1', source=f'terrain-{variant}.tsx')
    picture = Image.new('RGBA', (width * TILE, height * TILE))
    for i, (name, field) in enumerate(fields, 1):
        material = NAMES.index(name)
        masks = (field[:-1, :-1].astype(int) + field[:-1, 1:] * 2 + field[1:, :-1] * 4 + field[1:, 1:] * 8)
        data = np.zeros((height, width), dtype=int)
        for y in range(height):
            for x in range(width):
                mask = int(masks[y, x])
                if mask:
                    data[y, x] = tile_id(material, mask) + 1
                    picture.alpha_composite(tiles[(name, mask)], (x * TILE, y * TILE))
        layer = ET.SubElement(root, 'layer', id=str(i), name=f'{i:02d} {name}', width=str(width), height=str(height))
        ET.SubElement(layer, 'data', encoding='csv').text = '\n' + ',\n'.join(','.join(map(str, row)) for row in data) + '\n'
    write_xml(root, output / f'terrain-{variant}-demo.tmx')
    picture.save(output / f'terrain-{variant}-demo.png')


def build(variant, output=OUT):
    output.mkdir(parents=True, exist_ok=True)
    materials = load_materials(variant)
    tiles = {(name, mask): make_tile(texture, mask, name) for name, texture in materials.items() for mask in range(16)}
    sheet = Image.new('RGBA', (COLS * STRIDE, COLS * STRIDE))
    root = ET.Element('tileset', version='1.10', tiledversion='1.11.0', name=f'terrain-{variant}',
                      tilewidth='64', tileheight='64', tilecount='144', columns='12', margin='1', spacing='2')
    ET.SubElement(root, 'image', source=f'terrain-{variant}.png', width=str(sheet.width), height=str(sheet.height))
    index = {'tileSize': TILE, 'margin': 1, 'spacing': 2, 'columns': COLS, 'materials': {}}
    for material, name in enumerate(NAMES):
        index['materials'][name] = {}
        for mask in range(16):
            tid = tile_id(material, mask)
            x, y = tid % COLS * STRIDE + 1, tid // COLS * STRIDE + 1
            sheet.paste(tiles[(name, mask)], (x, y))
            entry = ET.SubElement(root, 'tile', id=str(tid), type=f'{name}-{mask:02d}')
            props = ET.SubElement(entry, 'properties')
            ET.SubElement(props, 'property', name='material', value=name)
            ET.SubElement(props, 'property', name='cornerMask', type='int', value=str(mask))
            index['materials'][name][str(mask)] = tid
    sets = ET.SubElement(root, 'wangsets')
    for material, name in enumerate(NAMES):
        full = str(tile_id(material, 15))
        group = ET.SubElement(sets, 'wangset', name=name.capitalize(), type='corner', tile=full)
        ET.SubElement(group, 'wangcolor', name=name.capitalize(), color=COLORS[material], tile=full, probability='1')
        for mask in range(16):
            ET.SubElement(group, 'wangtile', tileid=str(tile_id(material, mask)), wangid=wang_id(mask))
    sheet.save(output / f'terrain-{variant}.png')
    write_xml(root, output / f'terrain-{variant}.tsx')
    (output / f'terrain-{variant}.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
    demo(variant, output, tiles)


if __name__ == '__main__':
    for variant in ('current', 'redrawn'):
        build(variant)
        print(f'{variant}: 144 tiles, 9 Terrain Sets, 792x792 palette, 32x24 editable sample map')
