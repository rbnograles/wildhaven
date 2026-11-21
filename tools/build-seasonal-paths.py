"""Build separate snow/sand paths without changing any existing map tile IDs."""
import importlib.util
import json
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from tiled_path_connectors import OUT, load_tiles, tile_id, write_xml

spec = importlib.util.spec_from_file_location('terrain', __file__.replace('build-seasonal-paths.py', 'build-tiled-terrain.py'))
terrain = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terrain)
NAMES = ('snow', 'sand')
STEM = 'path-snow-sand'


def build(out=OUT):
    narrow = load_tiles(OUT / 'source/path-snow-sand.png', NAMES)
    textures = terrain.load_materials('redrawn')
    tiles = {}
    sheet = Image.new('RGBA', (528, 528))
    root = ET.Element('tileset', version='1.10', tiledversion='1.12.2', name=STEM,
                      tilewidth='64', tileheight='64', columns='8', tilecount='64', margin='1', spacing='2')
    ET.SubElement(root, 'image', source=f'{STEM}.png', width='528', height='528')
    sets = ET.SubElement(root, 'wangsets')
    index = {}
    for wide in (False, True):
        for material, name in enumerate(NAMES):
            label = f'{name}-' + ('wide' if wide else 'narrow')
            ids = index[label] = {}
            tid_for = lambda mask: tile_id(material, mask) + (32 if wide else 0)
            group = ET.SubElement(sets, 'wangset', name=f'{name.capitalize()} path - ' + ('wide / diagonal' if wide else 'narrow'),
                                  type='corner' if wide else 'edge', tile=str(tid_for(15)))
            ET.SubElement(group, 'wangcolor', name=name, color='#e1edf3' if name == 'snow' else '#e1b764', tile=str(tid_for(15)), probability='1')
            for mask in range(16):
                tid = ids[str(mask)] = tid_for(mask)
                im = terrain.make_tile(textures[name], mask, name) if wide else narrow[name][mask]
                tiles[tid] = im
                sheet.paste(im, (tid % 8 * 66 + 1, tid // 8 * 66 + 1))
                entry = ET.SubElement(root, 'tile', id=str(tid), type=f'{label}-{mask:02d}')
                props = ET.SubElement(entry, 'properties')
                ET.SubElement(props, 'property', name='material', value=name)
                ET.SubElement(props, 'property', name='cornerMask' if wide else 'edgeMask', type='int', value=str(mask))
                wang = terrain.wang_id(mask) if wide else ','.join(str(int(bool(mask & bit))) if bit else '0' for bit in (1, 0, 2, 0, 4, 0, 8, 0))
                ET.SubElement(group, 'wangtile', tileid=str(tid), wangid=wang)
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / f'{STEM}.png')
    write_xml(root, out / f'{STEM}.tsx')
    (out / f'{STEM}.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
    demo(out, index)
    return tiles


def demo(out, index):
    width, height = 28, 20
    root = ET.Element('map', version='1.10', tiledversion='1.12.2', orientation='orthogonal', renderorder='right-down',
                      width=str(width), height=str(height), tilewidth='64', tileheight='64', infinite='0')
    ET.SubElement(root, 'tileset', firstgid='1', source='terrain-redrawn.tsx')
    ET.SubElement(root, 'tileset', firstgid='145', source=f'{STEM}.tsx')
    def layer(name, values):
        node = ET.SubElement(root, 'layer', id=str(len(root.findall('layer')) + 1), name=name, width=str(width), height=str(height))
        ET.SubElement(node, 'data', encoding='csv').text = '\n' + ',\n'.join(','.join(map(str, row)) for row in values) + '\n'
    ground = np.full((height, width), terrain.tile_id(0, 15) + 1)
    ground[:, :14] = terrain.tile_id(4, 15) + 1
    layer('Ground - rock and grass', ground)
    for material, name in enumerate(NAMES):
        ox = material * 14
        points = {(x, y) for x in range(2, 12) for y in (3, 7)} | {(x, y) for x in (3, 7, 10) for y in range(2, 9)}
        values = np.zeros((height, width), dtype=int)
        for x, y in points:
            mask = sum(bit for dx, dy, bit in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)) if (x + dx, y + dy) in points)
            values[y, x + ox] = 145 + index[f'{name}-narrow'][str(mask)]
        layer(f'{name} narrow - loops and junctions', values)
        yy, xx = np.mgrid[:height + 1, :width + 1]
        xx = xx - ox
        field = (xx >= 2) & (xx <= 12) & (np.abs(yy - (12 + (xx - 2) * .5)) <= 1)
        field |= (xx >= 8) & (xx <= 11) & (yy >= 12) & (yy <= 17)
        masks = field[:-1, :-1].astype(int) + field[:-1, 1:] * 2 + field[1:, :-1] * 4 + field[1:, 1:] * 8
        layer(f'{name} wide - diagonal and plaza', [[145 + index[f'{name}-wide'][str(mask)] if mask else 0 for mask in row] for row in masks])
    write_xml(root, out / f'{STEM}-demo.tmx')


if __name__ == '__main__':
    build()
    print('Built snow and sand: 64 tiles, four Terrain Sets, editable demo.')
