"""Pack image-generated path art into 64px edge-matching Tiled connectors.

Run python tools/tiled_path_connectors.py. No runtime map is rebuilt.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/world/tiled'
NAMES = ('dirt', 'cobblestone', 'boardwalk', 'stepping-stone')
COLORS = ('#c79a58', '#938273', '#9e6b38', '#ae9c80')
# N=1, E=2, S=4, W=8. Each material occupies one readable 4x4 block.
LAYOUT = (2, 10, 8, 0, 6, 14, 12, 1, 7, 15, 13, 5, 3, 11, 9, 4)


def profile(line):
    """Use the painted straight's cross-section as the shared 32px opening."""
    filled = np.flatnonzero(line[:, 3] > 128)
    result = np.zeros((64, 4), dtype=float)
    for channel in range(4):
        result[16:48, channel] = np.interp(np.linspace(filled[0], filled[-1], 32), np.arange(64), line[:, channel])
    result[17:47, 3] = 255
    return result


def align_port(a, edge_profile):
    """Align an east opening without trimming or scaling the whole module."""
    filled = np.flatnonzero(a[:, -3, 3] > 128)
    if not len(filled):
        raise ValueError('Generated module is missing an expected open exit')
    center = (filled[0] + filled[-1]) / 2
    scale = (filled[-1] - filled[0]) / 31
    y, x = np.mgrid[:64, :64]
    weight = np.clip((x - 30) / 30, 0, 1)
    source_y = np.clip(y + weight * ((y - 31.5) * scale + center - y), 0, 63)
    lo = source_y.astype(int)
    hi = np.minimum(lo + 1, 63)
    mix = (source_y - lo)[..., None]
    # Work in premultiplied alpha so hidden background RGB cannot create a halo.
    a = a.copy()
    a[:, :, :3] *= a[:, :, 3:4] / 255
    a = a[lo, x] * (1 - mix) + a[hi, x] * mix
    target = edge_profile.copy()
    target[:, :3] *= target[:, 3:4] / 255
    blend = np.clip((np.arange(64) - 55) / 7, 0, 1)[None, :, None]
    a = a * (1 - blend) + target[:, None, :] * blend
    a[:, :, :3] = np.divide(a[:, :, :3] * 255, a[:, :, 3:4], out=np.zeros_like(a[:, :, :3]), where=a[:, :, 3:4] > 0)
    return a


def normalize(a, mask, horizontal, vertical):
    for bit, turns, cross_section in ((1, 3, vertical), (2, 0, horizontal), (4, 1, vertical[::-1]), (8, 2, horizontal[::-1])):
        turned = np.rot90(a, turns).copy()
        if mask & bit:
            turned = align_port(turned, cross_section)
        else:
            turned[:, -4:, 3] *= np.array([1, 2 / 3, 1 / 3, 0])[None, :]
        a = np.rot90(turned, -turns)
    # Lock edge samples after all four resampling passes, including closed exits.
    a[0] = vertical if mask & 1 else 0
    a[:, -1] = horizontal if mask & 2 else 0
    a[-1] = vertical if mask & 4 else 0
    a[:, 0] = horizontal if mask & 8 else 0
    a = np.rint(np.clip(a, 0, 255)).astype('uint8')
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a)


def load_tiles(source_path=None, names=NAMES):
    with Image.open(source_path or OUT / 'source/path-connectors-clean.png') as source:
        if source.size != (1536, 256 * len(names)):
            raise ValueError('Expected six 256px columns and one row per material')
        result = {}
        for row, name in enumerate(names):
            bases = []
            for col in range(6):
                a = np.array(source.crop((col * 256, row * 256, (col + 1) * 256, (row + 1) * 256)).convert('RGBA').resize((64, 64), Image.Resampling.LANCZOS), dtype=float)
                # Generated cutouts can contain nearly invisible alpha outside the artwork.
                a[:, :, 3] = np.clip((a[:, :, 3] - 48) * 255 / (200 - 48), 0, 255)
                bases.append(a)
            horizontal, vertical = profile(bases[0][:, 32]), profile(bases[1][32])
            tiles = {0: Image.new('RGBA', (64, 64))}
            for base, mask in zip(bases, (10, 5, 6, 7, 15, 2)):
                for turns in range(4):
                    if mask not in tiles:
                        tiles[mask] = normalize(np.rot90(base, -turns).copy(), mask, horizontal, vertical)
                    mask = ((mask << 1) & 15) | (mask >> 3)
            result[name] = tiles
    return result


def tile_id(material, mask):
    p = LAYOUT.index(mask)
    return (material // 2 * 4 + p // 4) * 8 + material % 2 * 4 + p % 4


def wangsets(parent, id_for):
    sets = ET.SubElement(parent, 'wangsets')
    for material, name in enumerate(NAMES):
        full = str(id_for(material, 15))
        group = ET.SubElement(sets, 'wangset', name=f'Path - {name}', type='edge', tile=full)
        ET.SubElement(group, 'wangcolor', name=name, color=COLORS[material], tile=full, probability='1')
        for mask in range(16):
            pattern = ','.join(str(int(bool(mask & bit))) if bit else '0' for bit in (1, 0, 2, 0, 4, 0, 8, 0))
            ET.SubElement(group, 'wangtile', tileid=str(id_for(material, mask)), wangid=pattern)


def write_xml(root, path):
    ET.indent(root, space=' ')
    ET.ElementTree(root).write(path, encoding='UTF-8', xml_declaration=True)


def build(out=OUT):
    out.mkdir(parents=True, exist_ok=True)
    tiles = load_tiles()
    sheet = Image.new('RGBA', (528, 528))
    root = ET.Element('tileset', version='1.10', tiledversion='1.11.0', name='path-connectors', tilewidth='64', tileheight='64', columns='8', tilecount='64', margin='1', spacing='2')
    ET.SubElement(root, 'image', source='path-connectors.png', width='528', height='528')
    index = {}
    for material, name in enumerate(NAMES):
        index[name] = {}
        for mask, im in tiles[name].items():
            tid = tile_id(material, mask)
            sheet.paste(im, (tid % 8 * 66 + 1, tid // 8 * 66 + 1))
            entry = ET.SubElement(root, 'tile', id=str(tid), type=f'path-{name}-{mask:02d}')
            props = ET.SubElement(entry, 'properties')
            ET.SubElement(props, 'property', name='connections', value=''.join(letter for bit, letter in ((1, 'N'), (2, 'E'), (4, 'S'), (8, 'W')) if mask & bit))
            index[name][str(mask)] = tid
    wangsets(root, tile_id)
    write_xml(root, out / 'path-connectors.tsx')
    sheet.save(out / 'path-connectors.png')
    (out / 'path-connectors.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')
    demo(out, tiles)
    return tiles


def demo(out, tiles):
    width, height = 24, 18
    root = ET.Element('map', version='1.10', tiledversion='1.11.0', orientation='orthogonal', renderorder='right-down', width=str(width), height=str(height), tilewidth='64', tileheight='64', infinite='0', nextlayerid='6', nextobjectid='1')
    # Original grass tiles are already available in the editor's existing sheet.
    ET.SubElement(root, 'tileset', firstgid='1', source='wildhaven-sheet.tsx')
    legacy = ET.parse(OUT / 'wildhaven-sheet.tsx').getroot()
    first = int(legacy.get('tilecount')) + 1
    ET.SubElement(root, 'tileset', firstgid=str(first), source='path-connectors.tsx')
    with Image.open(ROOT / 'assets/world/source/ground/grass.png') as grass:
        ground = grass.convert('RGBA').resize((256, 256))
    picture = Image.new('RGBA', (width * 64, height * 64))
    for y in range(0, height * 64, 256):
        for x in range(0, width * 64, 256):
            picture.paste(ground, (x, y))
    def layer(number, name, values):
        node = ET.SubElement(root, 'layer', id=str(number), name=name, width=str(width), height=str(height))
        ET.SubElement(node, 'data', encoding='csv').text = '\n' + ',\n'.join(','.join(map(str, row)) for row in values) + '\n'
    layer(1, 'Ground', [[1 + y % 4 * int(legacy.get('columns')) + x % 4 for x in range(width)] for y in range(height)])
    for material, name in enumerate(NAMES):
        ox, oy = material % 2 * 12, material // 2 * 9
        points = {(x, y) for x in range(2, 10) for y in (2, 6)} | {(x, y) for x in (2, 6, 9) for y in range(2, 7)}
        points |= {(6, 1), (6, 7), (1, 4), (2, 4), (3, 4), (4, 4), (6, 4), (7, 4), (8, 4), (9, 4), (10, 4)}
        values = np.zeros((height, width), dtype=int)
        for x, y in points:
            mask = sum(bit for dx, dy, bit in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)) if (x + dx, y + dy) in points)
            values[y + oy, x + ox] = first + tile_id(material, mask)
            picture.alpha_composite(tiles[name][mask], ((x + ox) * 64, (y + oy) * 64))
        layer(material + 2, name, values)
    write_xml(root, out / 'path-connectors-demo.tmx')
    picture.save(out / 'path-connectors-demo.png')


def append_to_sheet(out, tiles):
    """Expose fixed connectors in the existing palette without moving old tile IDs."""
    index_path = out / 'wildhaven-sheet.json'
    index = json.loads(index_path.read_text(encoding='utf-8'))
    grid_path = out / 'wildhaven-sheet.tsx'
    grid = ET.parse(grid_path).getroot()
    columns = int(grid.get('columns'))
    first_row = index.get('pathConnectors', {}).get('firstRow', int(grid.get('tilecount')) // columns)
    rows = (64 + columns - 1) // columns
    with Image.open(out / 'wildhaven-sheet.png') as original:
        sheet = Image.new('RGBA', (original.width, (first_row + rows) * 64))
        sheet.paste(original.crop((0, 0, original.width, first_row * 64)), (0, 0))
    first_id = first_row * columns
    # Only our appended entries are replaced on rebuild; legacy props remain at their IDs.
    for entry in list(grid.findall('tile')):
        if int(entry.get('id')) >= first_id:
            grid.remove(entry)
    for entry in list(grid.findall('wangsets')):
        if all(group.get('name', '').startswith('Path - ') for group in entry):
            grid.remove(entry)
    ids = {}
    for material, name in enumerate(NAMES):
        ids[name] = {}
        for offset, mask in enumerate(LAYOUT):
            tid = first_id + material * 16 + offset
            ids[name][str(mask)] = tid
            sheet.paste(tiles[name][mask], (tid % columns * 64, tid // columns * 64))
            ET.SubElement(grid, 'tile', id=str(tid), type=f'connector-{name}-{mask:02d}')
    wangsets(grid, lambda material, mask: ids[NAMES[material]][str(mask)])
    grid.set('tilecount', str((first_row + rows) * columns))
    grid.find('image').set('height', str(sheet.height))
    sheet.save(out / 'wildhaven-sheet.png', optimize=True)
    write_xml(grid, grid_path)
    index['pathConnectors'] = {'firstRow': first_row, 'rows': rows, 'tileIds': ids}
    index_path.write_text(json.dumps(index, indent=1) + '\n', encoding='utf-8')
    objects_path = out / 'wildhaven-objects.tsx'
    if objects_path.exists():
        objects = ET.parse(objects_path).getroot()
        for image in objects.findall('tile/image'):
            image.set('height', str(sheet.height))
        write_xml(objects, objects_path)


def rebuild():
    tiles = build()
    append_to_sheet(OUT, tiles)
    # The external legacy tileset gained rows, so the next firstgid must follow them.
    demo(OUT, tiles)


if __name__ == '__main__':
    rebuild()
    print('Built 64 path tiles, 4 edge Terrain Sets, and connected sample map.')
