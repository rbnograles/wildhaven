"""Run: python -m unittest discover -s tests/tools -p test_tiled_terrain.py"""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('terrain', ROOT / 'tools/build-tiled-terrain.py')
terrain = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terrain)


class TerrainTest(unittest.TestCase):
    def test_complete_patterns_and_wang_corner_order(self):
        self.assertEqual(sorted(terrain.LAYOUT), list(range(16)))
        self.assertEqual(terrain.wang_id(1), '0,0,0,0,0,0,0,1')
        self.assertEqual(terrain.wang_id(2), '0,1,0,0,0,0,0,0')
        self.assertEqual(terrain.wang_id(4), '0,0,0,0,0,1,0,0')
        self.assertEqual(terrain.wang_id(8), '0,0,0,1,0,0,0,0')

    def test_every_compatible_join_matches_for_both_material_versions(self):
        for variant in ('current', 'redrawn'):
            for name, texture in terrain.load_materials(variant).items():
                tiles = [np.asarray(terrain.make_tile(texture, mask, name)) for mask in range(16)]
                self.assertFalse(tiles[0][:, :, 3].any())
                self.assertTrue((tiles[15][:, :, 3] == 255).all())
                for a in range(16):
                    for b in range(16):
                        if (bool(a & 2), bool(a & 8)) == (bool(b & 1), bool(b & 4)):
                            np.testing.assert_array_equal(tiles[a][:, -1], tiles[b][:, 0], err_msg=f'{variant}/{name}: {a} right {b}')
                        if (bool(a & 4), bool(a & 8)) == (bool(b & 1), bool(b & 2)):
                            np.testing.assert_array_equal(tiles[a][-1], tiles[b][0], err_msg=f'{variant}/{name}: {a} below {b}')

    def test_built_tilesets_maps_and_images_agree(self):
        with tempfile.TemporaryDirectory() as out:
            for variant in ('current', 'redrawn'):
                terrain.build(variant, Path(out))
                tsx = ET.parse(Path(out) / f'terrain-{variant}.tsx').getroot()
                self.assertEqual(int(tsx.get('tilecount')), 144)
                sets = tsx.findall('wangsets/wangset')
                self.assertEqual(len(sets), 9)
                for group in sets:
                    self.assertEqual(group.get('type'), 'corner')
                    self.assertEqual(len({t.get('wangid') for t in group.findall('wangtile')}), 16)
                picture = tsx.find('image')
                with Image.open(Path(out) / picture.get('source')) as image:
                    self.assertEqual(image.size, (792, 792))
                sample = ET.parse(Path(out) / f'terrain-{variant}-demo.tmx').getroot()
                self.assertTrue((Path(out) / sample.find('tileset').get('source')).exists())
                for layer in sample.findall('layer'):
                    ids = [int(n) for n in layer.find('data').text.replace('\n', '').split(',') if n.strip()]
                    self.assertEqual(len(ids), 32 * 24)
                    self.assertTrue(all(0 <= n <= 144 for n in ids))


if __name__ == '__main__':
    unittest.main()
