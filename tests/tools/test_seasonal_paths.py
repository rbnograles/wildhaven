import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('seasonal', ROOT / 'tools/build-seasonal-paths.py')
seasonal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seasonal)


class SeasonalPathsTest(unittest.TestCase):
    def test_exported_tiles_match_every_compatible_neighbor(self):
        with tempfile.TemporaryDirectory() as temp:
            tiles = seasonal.build(Path(temp))
            root = ET.parse(Path(temp) / 'path-snow-sand.tsx').getroot()
            self.assertEqual(root.get('tilecount'), '64')
            self.assertEqual(len(root.findall('wangsets/wangset')), 4)
            for group in root.findall('wangsets/wangset'):
                entries = [(np.asarray(tiles[int(t.get('tileid'))]), list(map(int, t.get('wangid').split(',')))) for t in group.findall('wangtile')]
                self.assertEqual(len(entries), 16)
                self.assertEqual(len({tuple(w) for _, w in entries}), 16)
                for a, wa in entries:
                    for b, wb in entries:
                        if wa[1:4] == [wb[7], wb[6], wb[5]]:
                            np.testing.assert_array_equal(a[:, -1], b[:, 0])
                        if wa[3:6] == [wb[1], wb[0], wb[7]]:
                            np.testing.assert_array_equal(a[-1], b[0])


if __name__ == '__main__':
    unittest.main()
