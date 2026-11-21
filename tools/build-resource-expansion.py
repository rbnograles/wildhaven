"""Pack generated rock sizes, coconuts and explicit diagonal stamps for Tiled.

Only writes the separate resource-expansion and path-diagonal editor assets.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/world/tiled'
SOURCE = OUT / 'source/resource-expansion'
ART = OUT / 'resource-expansion-art'
TYPES = ('grey', 'flat', 'mossy', 'beach', 'ice', 'iron', 'copper', 'gold', 'diamond')
SIZES = ('small', 'medium', 'big', 'mountain')
PATHS = ('dirt', 'cobblestone', 'boardwalk', 'stepping-stone', 'snow', 'sand')


def xml(root, path):
    ET.indent(root, space=' ')
    ET.ElementTree(root).write(path, encoding='UTF-8', xml_declaration=True)


def cut(source, col, row, columns, rows):
    box = (round(col * source.width / columns), round(row * source.height / rows),
           round((col + 1) * source.width / columns), round((row + 1) * source.height / rows))
    return source.crop(box).convert('RGBA')


def fit_sprite(im, extent):
    # Trim using visible alpha, preserving the generated alpha inside the crop.
    bbox = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bbox:
        raise ValueError('Empty sprite cell')
    im = im.crop(bbox)
    scale = extent / max(im.size)
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)


def isolated_sprites(source, rows):
    """Split at actual transparent gutters so uneven generated cells aren't clipped."""
    source = source.convert('RGBA')
    solid = np.asarray(source)[:, :, 3] > 40
    def spans(values):
        edges = np.diff(np.r_[False, values, False].astype(int))
        return list(zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)))
    bands = spans(solid.any(axis=1))
    bands = [(a, b) for a, b in bands if b - a > 20]
    if rows == 1:
        bands = [(0, source.height)]
    if len(bands) != rows:
        raise ValueError(f'Expected {rows} isolated sprite rows, got {bands}')
    result = []
    for top, bottom in bands:
        columns = [(a, b) for a, b in spans(solid[top:bottom].any(axis=0)) if b - a > 20]
        if len(columns) != 2:
            raise ValueError(f'Expected two isolated sprites, got {columns}')
        result.extend(source.crop((left, top, right, bottom)) for left, right in columns)
    return result


def resources():
    ART.mkdir(parents=True, exist_ok=True)
    root = ET.Element('tileset', version='1.10', tiledversion='1.12.2', name='resource-expansion',
                      tilewidth='640', tileheight='640', tilecount='38', columns='0', objectalignment='bottom')
    records = []
    def add(name, im, material, size):
        tid = len(records)
        im.save(ART / f'{name}.png')
        node = ET.SubElement(root, 'tile', id=str(tid), type=name)
        props = ET.SubElement(node, 'properties')
        for key, value in {'material': material, 'size': size, 'placement': 'object layer; bottom-center anchor',
                           'springAllowed': str(material not in ('iron', 'copper', 'gold', 'diamond')).lower()}.items():
            ET.SubElement(props, 'property', name=key, value=value)
        ET.SubElement(node, 'image', source=f'resource-expansion-art/{name}.png', width=str(im.width), height=str(im.height))
        records.append(dict(id=tid, name=name, width=im.width, height=im.height, material=material, size=size))
    for material in TYPES:
        with Image.open(SOURCE / f'{material}.png') as source:
            sprites = isolated_sprites(source, 2)
            for i, (size, extent) in enumerate(zip(SIZES, (48, 112, 240, 640))):
                add(f'{material}-rock-{size}', fit_sprite(sprites[i], extent), material, size)
    with Image.open(SOURCE / 'coconut.png') as source:
        sprites = isolated_sprites(source, 1)
        add('coconut-palm', fit_sprite(sprites[0], 320), 'wood', 'tree')
        add('coconut', fit_sprite(sprites[1], 24), 'food', 'pickup')
    xml(root, OUT / 'resource-expansion.tsx')
    (OUT / 'resource-expansion.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
    demo = ET.Element('map', version='1.10', tiledversion='1.12.2', orientation='orthogonal', renderorder='right-down',
                      width='48', height='116', tilewidth='64', tileheight='64', infinite='0', backgroundcolor='#687447')
    ET.SubElement(demo, 'tileset', firstgid='1', source='resource-expansion.tsx')
    layer = ET.SubElement(demo, 'objectgroup', id='1', name='Rock sizes by material; coconuts on last row')
    for r in records:
        col, row = (r['id'] % 4, r['id'] // 4) if r['id'] < 36 else (r['id'] - 36, 9)
        ET.SubElement(layer, 'object', id=str(r['id'] + 1), name=r['name'], gid=str(r['id'] + 1),
                      x=str(col * 768 + 384), y=str(row * 720 + 680), width=str(r['width']), height=str(r['height']))
    xml(demo, OUT / 'resource-expansion-demo.tmx')


def diagonals():
    sheet = Image.new('RGBA', (576, 256))
    root = ET.Element('tileset', version='1.10', tiledversion='1.12.2', name='path-diagonal',
                      tilewidth='64', tileheight='64', tilecount='36', columns='9')
    ET.SubElement(root, 'image', source='path-diagonal.png', width='576', height='256')
    with Image.open(SOURCE / 'diagonals.png') as source:
        for material, name in enumerate(PATHS):
            for slope in range(2):
                im = cut(source, slope, material, 2, 6)
                bbox = im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
                if not bbox:
                    raise ValueError('Empty diagonal source')
                texture = np.asarray(im.crop(bbox).resize((64, 64), Image.Resampling.LANCZOS))
                if slope:
                    texture = texture[:, ::-1]
                # Sample one periodic diagonal band into its core and two neighboring shoulders.
                # Inclusive endpoints give identical samples along shared tile boundaries.
                y, x = np.meshgrid(np.linspace(0, 64, 64), np.linspace(0, 64, 64), indexing='ij')
                for offset in (-1, 0, 1):
                    gy = y + offset * 64
                    along = ((x + gy) / 2) % 32 + 16
                    across = (gy - x) / 2
                    sx = np.clip(np.rint(along - across), 0, 63).astype(int)
                    sy = np.clip(np.rint(along + across), 0, 63).astype(int)
                    a = texture[sy, sx].copy()
                    a[:, :, 3] = np.rint(np.clip(16.5 - np.abs(gy - x) / np.sqrt(2), 0, 1) * 255)
                    a[a[:, :, 3] == 0] = 0
                    if slope:
                        a = a[:, ::-1]
                    tid = slope * 18 + material * 3 + offset + 1
                    sheet.paste(Image.fromarray(a), (tid % 9 * 64, tid // 9 * 64))
                    node = ET.SubElement(root, 'tile', id=str(tid), type=f'{name}-diagonal-' + ('NW-SE' if slope == 0 else 'SW-NE') + f'-{offset:+d}')
                    props = ET.SubElement(node, 'properties')
                    ET.SubElement(props, 'property', name='material', value=name)
                    ET.SubElement(props, 'property', name='bandOffset', type='int', value=str(offset))
    sheet.save(OUT / 'path-diagonal.png')
    xml(root, OUT / 'path-diagonal.tsx')
    demo = ET.Element('map', version='1.10', tiledversion='1.12.2', orientation='orthogonal', renderorder='right-down',
                      width='48', height='17', tilewidth='64', tileheight='64', infinite='0', backgroundcolor='#687447')
    ET.SubElement(demo, 'tileset', firstgid='1', source='path-diagonal.tsx')
    values = np.zeros((17, 48), dtype=int)
    for material in range(6):
        for step in range(6):
            x, y = 1 + material * 8 + step, 1 + step
            values[y, x] = material * 3 + 2
            values[y, x + 1] = material * 3 + 1
            values[y + 1, x] = material * 3 + 3
            x, y = 6 + material * 8 - step, 9 + step
            values[y, x] = 18 + material * 3 + 2
            values[y, x - 1] = 18 + material * 3 + 1
            values[y + 1, x] = 18 + material * 3 + 3
    layer = ET.SubElement(demo, 'layer', id='1', name='Six materials; both diagonal directions', width='48', height='17')
    ET.SubElement(layer, 'data', encoding='csv').text = '\n' + ',\n'.join(','.join(map(str, row)) for row in values) + '\n'
    xml(demo, OUT / 'path-diagonal-demo.tmx')


if __name__ == '__main__':
    resources()
    diagonals()
    print('Built 36 rock sprites, coconut palm and pickup, 36 diagonal pieces, and two Tiled demos.')
