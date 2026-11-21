import importlib.util
from pathlib import Path
import unittest
import numpy as np
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('spring', ROOT / 'tools/build-spring-country.py')
spring = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spring)


class SpringCountryTest(unittest.TestCase):
    def test_large_single_biome_country_has_no_metal_or_gem_resources(self):
        world, report = spring.create()
        self.assertEqual((world['width'], world['height'], world['tilewidth']), (448, 320, 64))
        self.assertEqual(report['biome'], 'spring')
        self.assertFalse(report['forbiddenObjects'])
        self.assertTrue(set(report['resourceTotals']) <= {'wood', 'stone', 'food', 'herbs'})
        self.assertGreater(report['objectCount'], 5000)
        self.assertGreater(report['pathTiles'], 500)
        self.assertEqual(report['invalidResourcePositions'], 0)
        self.assertEqual(report['pathJoinErrors'], 0)
        for start in report['starts'].values():
            for resource, amount in {'wood': 12, 'stone': 10, 'food': 6, 'herbs': 4}.items():
                self.assertGreaterEqual(start['reachableBudget'][resource], amount)
            self.assertTrue(start['walkable'])
        self.assertTrue(all(d['distanceFromSpawn'] >= 2000 for d in report['wolfDens']))
        self.assertGreaterEqual(len(report['settlements']), 6)
        self.assertGreaterEqual(len(report['herds']), 15)
        self.assertEqual(len({s['connectedRegion'] for s in report['starts'].values()}), 1)
        self.assertTrue(all(len(s['reachableFrom']) == 3 for s in report['settlements']))
        self.assertEqual(sum(s['tier'] == 'major' for s in report['settlements']), 1)
        self.assertGreaterEqual(report['newBuildings'], 12)
        self.assertGreater(report['fenceSegments'], 150)
        self.assertGreaterEqual(report['diagonalRoutes'], 5)
        self.assertGreater(report['waterCornersAdded'], 1500)
        self.assertEqual(report['unreachableGates'], 0)
        for layer in world['layers']:
            for obj in layer.get('objects', []):
                if 'gid' in obj:
                    d = report['spriteDefinitions'][obj['type']]
                    self.assertAlmostEqual(obj['width']/obj['height'], d['width']/d['height'], places=2)

    def test_port_checker_rejects_a_broken_neighbor(self):
        paths = spring.read(spring.OUT / 'path-connectors.json')['dirt']
        gids = np.array([[paths['2']+spring.FIRST_PATH, paths['8']+spring.FIRST_PATH]])
        self.assertEqual(spring.path_join_errors(gids, paths), 0)
        gids[0, 1] = paths['2']+spring.FIRST_PATH
        self.assertGreater(spring.path_join_errors(gids, paths), 0)


if __name__ == '__main__':
    unittest.main()
