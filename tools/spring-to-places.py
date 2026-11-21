"""Write assets/world/source/places.json from the Spring map's gameplay markers.

places.json is the game's list of regions, start spots, supply spots, landmarks, signposts and old
boats. The Spring Tiled map already carries all of this as point markers, so this tool reads those
markers and rebuilds places.json to match the Spring world: eight districts (one per settlement),
every landmark and signpost the map marks, and no old boats (sailing is deferred). Run it after the
map's markers change:

Run: python tools/spring-to-places.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spring_geography as sg

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPRING = os.path.join(ROOT, 'assets', 'world', 'spring-country', 'spring-country.tmj')
PLACES = os.path.join(ROOT, 'assets', 'world', 'source', 'places.json')
OBJECTS = os.path.join(ROOT, 'assets', 'world', 'source', 'objects.json')
REGION_CELL = 256   # the region grid's square size (the game map's regionCell); regions assigned to match it
# Sprites that do not belong in Spring (metals, gems, snow/jungle/desert plants and cliffs). Copied
# from tools/build-spring-country.py's FORBIDDEN so a landmark never asks for an icon Spring lacks.
FORBIDDEN = {'iron-ore', 'copper-ore', 'gold-ore', 'diamond-ore', 'cliff-rock', 'ice-rock',
             'snowy-pine', 'jungle-tree', 'palm', 'cactus', 'snow-grass', 'dry-grass',
             'cave-snow', 'cave-canyon', 'snow-stairs', 'canyon-stairs'}
# The four old boats (A1 sailing). The Spring map was built around these same beach/launch points, so
# they stay fixed here; only the region (district) and the player-facing name are set for Spring.
WRECKS = [
    {'id': 'wreck-north', 'x': 14948, 'y': 2338, 'launch': [14828, 2288]},
    {'id': 'wreck-west', 'x': 2024, 'y': 8848, 'launch': [1974, 8728]},
    {'id': 'wreck-south', 'x': 11048, 'y': 18619, 'launch': [10918, 18619]},
    {'id': 'wreck-east', 'x': 23682, 'y': 10748, 'launch': [23632, 10628]},
]


# Picks a short, unique letter key for each region, used by the world editor.
# Tries the name's first letter, then any other letter in the name, then falls back to a digit.
def region_keys(names):
    used, keys = set(), []
    for name in names:
        choice = next((c.upper() for c in name if c.isalpha() and c.upper() not in used), None)
        choice = choice or next((str(d) for d in range(10) if str(d) not in used), '?')
        used.add(choice)
        keys.append(choice)
    return keys


# Says which district a spot belongs to, matching the game's regionOf exactly (by the spot's grid square).
def nearest_region(x, y, settlements, ids):
    return ids[sg.region_at(x, y, settlements, REGION_CELL)]


# Formats one place as a single line like the hand-written places.json, keeping only the keys it has.
def inline(record, order):
    parts = [f'{json.dumps(k)}: {json.dumps(record[k])}' for k in order if k in record]
    return '{ ' + ', '.join(parts) + ' }'


# Builds the whole places.json text in the game's existing one-item-per-line layout.
def render(data):
    lines = ['{']
    lines.append('  "regions": [')
    for i, r in enumerate(data['regions']):
        lines.append('    ' + inline(r, ('id', 'key', 'name')) + (',' if i < len(data['regions']) - 1 else ''))
    lines.append('  ],')
    spawns = ', '.join(f'{json.dumps(k)}: {json.dumps(v)}' for k, v in data['spawns'].items())
    lines.append('  "spawns": { ' + spawns + ' },')
    lines.append('  "supplies": {')
    items = list(data['supplies'].items())
    for i, (k, v) in enumerate(items):
        lines.append(f'    {json.dumps(k)}: {json.dumps(v)}' + (',' if i < len(items) - 1 else ''))
    lines.append('  },')
    for field, order in (('landmarks', ('id', 'region', 'name', 'x', 'y', 'object')),
                         ('waypoints', ('id', 'region', 'name', 'x', 'y')),
                         ('wrecks', ('id', 'region', 'name', 'x', 'y', 'launch'))):
        lines.append(f'  "{field}": [')
        rows = data[field]
        for i, row in enumerate(rows):
            lines.append('    ' + inline(row, order) + (',' if i < len(rows) - 1 else ''))
        lines.append('  ]' + (',' if field != 'wrecks' else ''))
    lines.append('}')
    return '\n'.join(lines) + '\n'


# Reads the markers and the old places.json, then rebuilds places.json for the Spring world.
def main():
    markers = sg.read_markers(SPRING)
    old = json.load(open(PLACES, encoding='utf-8'))
    specs = {k for k in json.load(open(OBJECTS, encoding='utf-8')) if not k.startswith('_')}
    old_object = {lm['id']: lm.get('object') for lm in old['landmarks']}

    settlements = markers['settlements']
    ids = [sg.slug(s['name']) for s in settlements]
    keys = region_keys([s['name'] for s in settlements])
    regions = [{'id': ids[i], 'key': keys[i], 'name': settlements[i]['name']} for i in range(len(settlements))]

    landmarks = []
    for mk in markers['landmarks']:
        lm_id = mk['props'].get('landmarkId') or sg.slug(mk['name'])
        row = {'id': lm_id, 'region': nearest_region(mk['x'], mk['y'], settlements, ids),
               'name': mk['name'], 'x': mk['x'], 'y': mk['y']}
        icon = old_object.get(lm_id)
        if icon and icon not in FORBIDDEN and icon in specs:
            row['object'] = icon
        landmarks.append(row)

    waypoints = []
    for mk in markers['waypoints']:
        wp_id = mk['props'].get('waypointId') or sg.slug(mk['name'])
        waypoints.append({'id': wp_id, 'region': nearest_region(mk['x'], mk['y'], settlements, ids),
                          'name': mk['name'], 'x': mk['x'], 'y': mk['y']})

    # Old boats stay (sailing is included): keep each wreck's beach and launch points, name it for its district.
    name_of = {r['id']: r['name'] for r in regions}
    wrecks = []
    for w in WRECKS:
        region = nearest_region(w['x'], w['y'], settlements, ids)
        wrecks.append({'id': w['id'], 'region': region, 'name': f'{name_of[region]} Rowboat',
                       'x': w['x'], 'y': w['y'], 'launch': w['launch']})

    data = {'regions': regions, 'spawns': old['spawns'], 'supplies': old['supplies'],
            'landmarks': landmarks, 'waypoints': waypoints, 'wrecks': wrecks}
    open(PLACES, 'w', encoding='utf-8', newline='\n').write(render(data))
    print(f'regions {len(regions)}, landmarks {len(landmarks)}, waypoints {len(waypoints)}, wrecks {len(wrecks)}')
    icons = sum('object' in lm for lm in landmarks)
    print(f'landmark icons kept: {icons}/{len(landmarks)}')


if __name__ == '__main__':
    main()
