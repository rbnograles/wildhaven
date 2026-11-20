import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('connectors', ROOT / 'tools/tiled_path_connectors.py')
connectors = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connectors)


class ConnectorTest(unittest.TestCase):
    def test_all_ports_join_without_padding_or_edge_mismatch(self):
        for name, tiles in connectors.load_tiles().items():
            self.assertEqual(set(tiles), set(range(16)))
            for mask, im in tiles.items():
                a = np.asarray(im)
                self.assertEqual(im.size, (64, 64))
                for bit, edge in zip((1, 2, 4, 8), (a[0], a[:, -1], a[-1], a[:, 0])):
                    if mask & bit:
                        self.assertTrue((edge[23:41, 3] == 255).all(), (name, mask, bit))
                    else:
                        self.assertFalse(edge[:, 3].any(), (name, mask, bit))
            for a in range(16):
                for b in range(16):
                    if bool(a & 2) == bool(b & 8):
                        np.testing.assert_array_equal(np.asarray(tiles[a])[:, -1], np.asarray(tiles[b])[:, 0])
                    if bool(a & 4) == bool(b & 1):
                        np.testing.assert_array_equal(np.asarray(tiles[a])[-1], np.asarray(tiles[b])[0])

    def test_outputs_have_complete_edge_terrain_sets_and_matching_grid(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp)
            connectors.build(out)
            tsx = ET.parse(out / 'path-connectors.tsx').getroot()
            self.assertEqual(tsx.get('tilecount'), '64')
            self.assertEqual(len(tsx.findall('wangsets/wangset')), 4)
            for group in tsx.findall('wangsets/wangset'):
                self.assertEqual(group.get('type'), 'edge')
                patterns = [t.get('wangid') for t in group.findall('wangtile')]
                self.assertEqual(len(set(patterns)), 16)
                self.assertIn('1,0,1,0,1,0,1,0', patterns)
            with Image.open(out / 'path-connectors.png') as im:
                self.assertEqual(im.size, (528, 528))

    def test_append_preserves_existing_pixels_and_ids_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp)
            old = Image.new('RGBA', (36 * 64, 128), (12, 34, 56, 255))
            old.save(out / 'wildhaven-sheet.png')
            (out / 'wildhaven-sheet.json').write_text(json.dumps({'objects': {'tree': {'x': 10, 'y': 20}}}))
            (out / 'wildhaven-sheet.tsx').write_text('<tileset columns="36" tilecount="72"><image source="wildhaven-sheet.png" width="2304" height="128"/><tile id="42" type="tree"/></tileset>')
            tiles = connectors.load_tiles()
            connectors.append_to_sheet(out, tiles)
            first = (out / 'wildhaven-sheet.png').read_bytes()
            connectors.append_to_sheet(out, tiles)
            self.assertEqual(first, (out / 'wildhaven-sheet.png').read_bytes())
            with Image.open(out / 'wildhaven-sheet.png') as expanded:
                np.testing.assert_array_equal(np.asarray(old), np.asarray(expanded)[:128])
            grid = ET.parse(out / 'wildhaven-sheet.tsx').getroot()
            self.assertEqual(grid.find("tile[@id='42']").get('type'), 'tree')
            self.assertEqual(len(grid.findall('wangsets')), 1)
            self.assertEqual(len(grid.findall('tile')), 65)
            index = json.loads((out / 'wildhaven-sheet.json').read_text())
            self.assertEqual(index['objects'], {'tree': {'x': 10, 'y': 20}})


if __name__ == '__main__':
    unittest.main()
