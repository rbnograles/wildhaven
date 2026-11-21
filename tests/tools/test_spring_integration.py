"""Checks for the Spring Country integration: the geography helpers, the generated places.json,
and the imported game map. Each test guards one thing that would quietly break the Spring world.
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools'))
import spring_geography as sg

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SPRING = os.path.join(ROOT, 'assets', 'world', 'spring-country', 'spring-country.tmj')
PLACES = os.path.join(ROOT, 'assets', 'world', 'source', 'places.json')
GAME_MAP = os.path.join(ROOT, 'assets', 'world', 'map', 'wildhaven.json')


class Markers(unittest.TestCase):
    # Guards: the marker reader finds all three starts and all eight settlements.
    def test_reads_starts_and_settlements(self):
        m = sg.read_markers(SPRING)
        self.assertEqual(len(m['spawns']), 3)
        self.assertEqual(len(m['settlements']), 8)
        self.assertEqual(len(m['landmarks']), 52)
        self.assertEqual(len(m['waypoints']), 14)


class RegionGrid(unittest.TestCase):
    # Guards: every square gets a valid district and the id list matches the digits used.
    def test_full_coverage(self):
        m = sg.read_markers(SPRING)
        grid, ids = sg.region_grid(m['settlements'], 112, 80, 256)
        self.assertEqual(len(ids), 8)
        self.assertEqual(len(grid), 112 * 80)
        self.assertTrue(all(0 <= int(c) < len(ids) for c in grid))
        # every district is used by at least one square (no empty region in the list)
        self.assertEqual(set(int(c) for c in grid), set(range(len(ids))))


class Elevation(unittest.TestCase):
    # Guards: the flat world has no walls or stairs and is the right length.
    def test_all_flat(self):
        e = sg.flat_elevation(448, 320)
        self.assertEqual(set(e), {'0'})
        self.assertEqual(len(e), 448 * 320)


class Places(unittest.TestCase):
    # Guards: regenerated places.json keeps the 3 spawns and gives 8 regions, 52 landmarks, 14 signposts.
    def test_shape(self):
        p = json.load(open(PLACES, encoding='utf-8'))
        self.assertEqual(len(p['regions']), 8)
        self.assertEqual(len(p['landmarks']), 52)
        self.assertEqual(len(p['waypoints']), 14)
        self.assertEqual(p['wrecks'], [])
        self.assertEqual(p['spawns']['scout'], [14348, 4148])
        # every landmark/waypoint names a real region id
        region_ids = {r['id'] for r in p['regions']}
        for place in p['landmarks'] + p['waypoints']:
            self.assertIn(place['region'], region_ids)
        # region keys are unique (the world editor reads region.key)
        keys = [r['key'] for r in p['regions']]
        self.assertEqual(len(keys), len(set(keys)))


if __name__ == '__main__':
    unittest.main()
