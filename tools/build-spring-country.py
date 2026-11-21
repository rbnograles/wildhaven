"""Author a separate, large Spring country for Tiled. Never changes the live game.

Run: python tools/build-spring-country.py
The arranged world supplies coastlines, rivers, settlements and roads; this rebuild
owns only spring-country* outputs. Save manual edits under another name before rebuilding.
"""
from collections import Counter, defaultdict, deque
from pathlib import Path
import copy
import json
import math
import random
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from spring_town_layout import NEW_ART, plan_towns, terrain_join_errors

ROOT = Path(__file__).resolve().parents[1]
TILED = ROOT / 'assets/world/tiled'                # shared Tiled kits (terrain + path connectors) still live here
DEPRECATED = TILED / '_deprecated-wildhaven'       # the old Wildhaven geography + sprite sheet this map is built from
SPRING = ROOT / 'assets/world/spring-country'       # every spring-country* output now lives in its own folder
SRC = ROOT / 'assets/world/source'
ORDER = ['deep', 'water', 'sand', 'grass', 'jungle', 'rock', 'snow', 'dirt', 'soil']
ALLOWED_GROUND = ['deep', 'water', 'sand', 'grass', 'rock', 'dirt', 'soil']
FIRST_PATH, FIRST_OBJECT = 145, 209
FORBIDDEN = {'iron-ore', 'copper-ore', 'gold-ore', 'diamond-ore', 'cliff-rock', 'ice-rock',
             'snowy-pine', 'jungle-tree', 'palm', 'cactus', 'snow-grass', 'dry-grass',
             'cave-snow', 'cave-canyon', 'snow-stairs', 'canyon-stairs'}
SETTLEMENTS = [('Hollowstead', 14336, 9348), ('Pinefall Camp', 14288, 4108),
               ('Blossom Crossroads', 4248, 7148), ('Stonebrook Hamlet', 6648, 9648),
               ('Alder Rest', 23048, 6948), ('Driftwood Landing', 22900, 10700),
               ('Greenbough Camp', 7248, 16848), ('Willowbank', 3000, 16600)]
HEIGHT = {'pine': 210, 'pines': 265, 'oak': 265, 'big-oak': 315,
          'house-a': 250, 'house-b': 270, 'house-c': 280, 'workshop': 290,
          'tent': 150, 'ship': 470, 'signpost': 75, 'rocks-a': 105, 'rocks-b': 105,
          'boulder': 155, 'beach-rock': 100, 'cave-forest': 255, 'berry-bush': 62,
          'wild-berries': 48, 'flowers': 25, 'pebbles': 28, 'sticks': 20,
          'grass-tuft': 34, 'tall-grass': 46, 'log': 65, 'driftwood': 32,
          'sandstone-ruin': 235, 'wheat-4': 45, 'chest-closed': 45,
          'rabbit': 24, 'deer': 80, 'boar': 48, 'wolf': 52}
HEIGHT.update(NEW_ART)
RESOURCE = {
    'sticks': ('wood', 2, '', 720), 'driftwood': ('wood', 2, '', 720),
    'pebbles': ('stone', 1, '', 720), 'mossy-stone': ('stone', 1, '', 720),
    'flat-stone': ('stone', 1, '', 720), 'grey-rock': ('stone', 1, '', 720),
    'wild-berries': ('food', 1, '', 720), 'berry-bush': ('food', 2, '', 720),
    'flowers': ('herbs', 2, '', 720), 'wheat-4': ('food', 2, '', 1080),
    **{n: ('wood', 7 if n != 'big-oak' else 10, 'axe', 1080) for n in ('pine', 'pines', 'oak', 'big-oak')},
    'log': ('wood', 4, 'axe', 1080),
    **{n: ('stone', 3, 'pickaxe', 1080) for n in ('rocks-a', 'rocks-b', 'beach-rock')},
    'boulder': ('stone', 8, 'pickaxe', 1080),
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def props(**values):
    return [{'name': k, 'type': 'bool' if isinstance(v, bool) else 'int' if isinstance(v, int) else 'float' if isinstance(v, float) else 'string', 'value': v} for k, v in values.items()]


def property_of(obj, name, default=None):
    return next((p['value'] for p in obj.get('properties', []) if p['name'] == name), default)


def dilate(a, steps):
    for _ in range(steps):
        padded = np.pad(a, 1)
        a = np.logical_or.reduce([padded[dy:dy+a.shape[0], dx:dx+a.shape[1]] for dy in range(3) for dx in range(3)])
    return a


def path_join_errors(gids, definitions):
    """Check exported tile ports, including ports facing empty cells or map edges."""
    lookup = {int(tile)+FIRST_PATH: int(mask) for mask, tile in definitions.items()}
    masks = np.array([[lookup.get(int(gid), 0) for gid in row] for row in gids])
    occupied = gids > 0
    padded = np.pad(occupied, 1)
    errors = 0
    for bit, neighbor in ((1, padded[:-2, 1:-1]), (2, padded[1:-1, 2:]),
                          (4, padded[2:, 1:-1]), (8, padded[1:-1, :-2])):
        errors += int(np.count_nonzero(occupied & (((masks & bit) > 0) != neighbor)))
    return errors


def create():
    source = read(DEPRECATED / 'wildhaven-world-arranged.tmj')
    original = {l['name']: l for l in source['layers']}
    kit = read(TILED / 'terrain-redrawn.json')['materials']
    paths = read(TILED / 'path-connectors.json')
    specs = {k: v for k, v in read(SRC / 'objects.json').items() if not k.startswith('_')}
    for name in NEW_ART:
        with Image.open(SPRING / 'spring-country-art' / f'{name}.png') as im:
            iw, ih = im.size
        fence = name.startswith('fence-')
        specs[name] = dict(kind='props' if fence or name == 'village-well' else 'buildings',
                           origin=[0.5, 1], footprint=[iw*0.46, ih*(0.93 if name == 'fence-vertical' else 0.16)])
    sheet = read(DEPRECATED / 'wildhaven-sheet.json')['objects']
    places = read(SRC / 'places.json')
    w, h = source['width'], source['height']
    corner = np.zeros((h + 1, w + 1), dtype=int)
    for rank, name in enumerate(ORDER):
        gids = np.array(original[f'{rank+1:02d} {name}']['data']).reshape(h, w)
        masks = np.zeros((h, w), dtype=int)
        for mask, tid in kit[name].items():
            masks[gids == tid + 1] = int(mask)
        for bit, (dy, dx) in zip((1, 2, 4, 8), ((0, 0), (0, 1), (1, 0), (1, 1))):
            part = corner[dy:dy+h, dx:dx+w]
            part[masks & bit > 0] = rank
    yy, xx = np.mgrid[:h+1, :w+1]
    # Remove the old hand-drafted zigzag spit in the east bay and soften its coast.
    coast_y = yy*64
    east_coast = np.interp(coast_y, [0, 2200, 6000, 8500, 11200, 13000, h*64],
                          [26500, 26700, 26100, 24150, 23800, 26000, 26000])
    east_coast += 100*np.sin(coast_y/520)+70*np.sin(coast_y/210)
    corner[(xx*64 > east_coast) & (corner > 1)] = 1
    old_wet = corner <= 1
    wet_corners = dilate(old_wet, 2)
    water_added = int(np.count_nonzero(wet_corners & ~old_wet))
    corner[wet_corners & ~old_wet] = 1
    near_water = dilate(wet_corners, 4)
    # Spring is one biome. Sand is restricted to beaches; exposed rock is local quarry ground.
    corner[np.isin(corner, (4, 5, 6, 7, 8))] = 3
    corner[(corner == 2) & ~near_water] = 3
    quarries = [(6648, 9648), (23548, 3048), (3248, 12648), (20700, 16700)]
    for x, y in quarries:
        patch = ((xx * 64 - x) / 350) ** 2 + ((yy * 64 - y) / 240) ** 2 < 1
        corner[patch & ~wet_corners] = 5
    dry = ~(wet_corners[:-1, :-1] | wet_corners[1:, :-1] | wet_corners[:-1, 1:] | wet_corners[1:, 1:])
    road = np.array(original['paths']['data']).reshape(h, w) > 0
    road &= dry
    trails, masks, village_bounds, village_buildings, fences, gates, zones, diagonal_count = plan_towns(road, corner, wet_corners, SETTLEMENTS)
    road = masks > 0
    clear_road = dilate(road, 1)
    rng = random.Random(211126)
    layers = []
    uid = 1
    def layer(name, kind, **data):
        result = dict(id=len(layers)+1, name=name, type=kind, opacity=1, visible=True, x=0, y=0, **data)
        layers.append(result)
        return result
    for name in ALLOWED_GROUND:
        here = (corner >= ORDER.index(name)).astype(int)
        masks = here[:-1, :-1] + 2*here[:-1, 1:] + 4*here[1:, :-1] + 8*here[1:, 1:]
        ids = np.array([kit[name][str(m)] + 1 for m in range(16)])[masks]
        layer(f'{len(layers)+1:02d} {name}', 'tilelayer', width=w, height=h, data=np.where(masks, ids, 0).ravel().tolist())
    # Shared corner terrain supports genuine diagonal corridors and wider town streets.
    masks = trails[:-1, :-1].astype(int)+2*trails[:-1, 1:]+4*trails[1:, :-1]+8*trails[1:, 1:]
    road_ids = np.where(road, np.array([kit['dirt'][str(m)]+1 for m in range(16)])[masks], 0)
    layer('Paths - diagonal trails and town streets', 'tilelayer', width=w, height=h, data=road_ids.ravel().tolist())
    flat = layer('Ground details and bridges', 'objectgroup', draworder='topdown', objects=[])
    resources = layer('Forage and starter supplies', 'objectgroup', draworder='topdown', objects=[])
    scenery = layer('Trees rocks and buildings', 'objectgroup', draworder='topdown', objects=[])
    animals = layer('Wildlife spawn art', 'objectgroup', draworder='topdown', objects=[])
    guides = layer('Gameplay markers - show to edit', 'objectgroup', draworder='index', objects=[])
    guides['visible'] = False
    definitions = {}
    boxes = defaultdict(list)
    roofs = []
    nodes = []
    kept_caves = []
    starts = {**places['spawns'], 'survivor': [22912, 11200]}
    def distance_start(x, y):
        return min(math.hypot(x-a, y-b) for a, b in starts.values())
    def dry_at(x, y):
        tx, ty = int(x//64), int(y//64)
        return 0 <= tx < w and 0 <= ty < h and bool(dry[ty, tx])
    def blocked(x, y, margin=20):
        for left, top, right, bottom in boxes[(int(x//256), int(y//256))]:
            if left-margin < x < right+margin and top-margin < y < bottom+margin:
                return True
        return False
    def define(name):
        if name not in definitions:
            if name in specs:
                path = SPRING / 'spring-country-art' / f'{name}.png' if name in NEW_ART else SRC / 'objects' / specs[name]['kind'] / f'{name}.png'
                with Image.open(path) as im:
                    width, height = im.size
                relative = 'spring-country-art/'+name+'.png' if name in NEW_ART else '../source/objects/'+specs[name]['kind']+'/'+name+'.png'
                definitions[name] = dict(id=len(definitions), width=width, height=height, image=relative)
            else:
                animal = read(ROOT / 'assets/world/creatures/creatures.json')[name]
                width, height = animal['cell']
                definitions[name] = dict(id=len(definitions), width=width, height=height, image='spring-country-art/'+name+'.png', animal=True)
        return definitions[name]
    def add(name, x, y, target=None, height=None, rotation=0, extra=None, fixed=False):
        nonlocal uid
        d = define(name)
        origin = specs.get(name, {}).get('origin', [0.5, 0.97])
        actual_height = height or HEIGHT.get(name, d['height'] * specs.get(name, {}).get('scale', 1))
        width = actual_height * d['width']/d['height']
        resource = RESOURCE.get(name)
        values = dict(country='spring', footX=round(x, 2), footY=round(y, 2))
        if 'footprint' in specs.get(name, {}) and not fixed:
            half, depth = specs[name]['footprint']
            values.update(solidHalfWidth=round(half*actual_height/d['height'], 2),
                          solidDepth=round(depth*actual_height/d['height'], 2))
        if resource:
            values.update(resource=resource[0], amount=resource[1], tool=resource[2], regrowSeconds=resource[3])
        if extra:
            values.update(extra)
        dx, dy = (0.5-origin[0])*width, (1-origin[1])*actual_height
        angle = math.radians(rotation)
        obj = dict(id=uid, name='', type=name, gid=FIRST_OBJECT+d['id'], x=round(x+dx*math.cos(angle)-dy*math.sin(angle), 2), y=round(y+dx*math.sin(angle)+dy*math.cos(angle), 2),
                   width=round(width, 2), height=round(actual_height, 2), rotation=rotation, visible=True, properties=props(**values))
        uid += 1
        target = target or (resources if resource and not resource[2] else scenery)
        target['objects'].append(obj)
        if specs.get(name, {}).get('kind') == 'buildings':
            roofs.append((x-origin[0]*width-32, y-origin[1]*actual_height-32,
                          x+(1-origin[0])*width+32, y+32))
        if resource:
            nodes.append(obj)
        if name in specs and 'footprint' in specs[name] and not fixed:
            half, depth = specs[name]['footprint']
            scale = actual_height/d['height']
            box = (x-half*scale, y-depth*scale, x+half*scale, y)
            for bx in range(int((box[0]-24)//256), int((box[2]+24)//256)+1):
                for by in range(int((box[1]-24)//256), int((box[3]+24)//256)+1):
                    boxes[bx, by].append(box)
        return obj
    def marker(name, kind, x, y, **values):
        nonlocal uid
        guides['objects'].append(dict(id=uid, name=name, type=kind, x=x, y=y, width=0, height=0, point=True, visible=True, properties=props(country='spring', **values)))
        uid += 1
    swaps = {'snowy-pine': 'pine', 'jungle-tree': 'oak', 'palm': 'oak', 'cactus': 'grass-tuft',
             'dead-bush': 'tall-grass', 'dry-grass': 'grass-tuft', 'snow-grass': 'grass-tuft',
             'cliff-rock': 'boulder', 'ice-rock': 'rocks-b', 'iron-ore': 'boulder',
             'copper-ore': 'rocks-a', 'gold-ore': 'boulder', 'diamond-ore': 'boulder',
             'cave-snow': 'cave-forest', 'cave-canyon': 'cave-forest'}
    objects = [o for n in ('flat', 'objects') for o in original[n]['objects']]
    # Buildings first, then vegetation: resized trunks must not block a village entrance.
    objects.sort(key=lambda o: specs.get(o.get('type'), {}).get('kind') != 'buildings')
    for name, x, y in village_buildings:
        add(name, x, y)
    placed_fences = 0
    for name, x, y in fences:
        if dry_at(x,y):
            add(name,x,y,extra={'boundary': True})
            placed_fences += 1
    for gate in gates:
        marker(gate['village']+' '+gate['direction']+' gate', 'village-gate', gate['x'], gate['y'], clearWidth=gate['width'])
    for _, sx, sy in SETTLEMENTS:
        for dx, dy in ((-220, 250), (240, 280), (-240, -230)):
            x, y = sx+dx, sy+dy
            if dry_at(x, y) and not blocked(x, y, 90) and not clear_road[int(y//64), int(x//64)]:
                add('oak', x, y, height=225)
    for old in objects:
        name = old.get('type')
        if name not in sheet or 'stairs' in name or name in ('campfire', 'feather', 'pine-cone', 'antler'):
            continue
        ox, oy = sheet[name]['origin']
        theta = math.radians(old.get('rotation', 0))
        dx, dy = (ox-0.5)*old['width'], (oy-1)*old['height']
        x, y = old['x']+dx*math.cos(theta)-dy*math.sin(theta), old['y']+dx*math.sin(theta)+dy*math.cos(theta)
        name = swaps.get(name, name)
        if name not in specs:
            continue
        water_art = name in ('bridge', 'ship', 'sea-wave', 'river-ripple', 'lake-ripple')
        if not water_art and any(a < x < c and b < y < d for a, b, c, d in village_bounds):
            continue
        if not water_art and not dry_at(x, y):
            continue
        tx, ty = int(x//64), int(y//64)
        is_building = specs[name]['kind'] == 'buildings'
        if not water_art and not is_building:
            if clear_road[ty, tx] or distance_start(x, y) < 190 or blocked(x, y, 26):
                continue
            if any(math.hypot(x-a, y-b) < 180 for _, a, b in SETTLEMENTS):
                continue
        if name == 'cave-forest':
            if distance_start(x, y) < 2000 or any(math.hypot(x-a, y-b) < 1100 for _, a, b in SETTLEMENTS):
                continue
            kept_caves.append((x, y))
        if name == 'sea-wave' and old['id'] % 3:
            continue
        # Spring undergrowth includes occasional flowers in formerly dry/frozen districts.
        if name == 'grass-tuft' and old['id'] % 29 == 0:
            name = 'flowers'
        height = old['height']*(old['width']+384)/old['width'] if name == 'bridge' else HEIGHT.get(name)
        if height and not is_building and name != 'bridge':
            height *= 0.94 + rng.random()*0.12
        add(name, x, y, target=flat if water_art or specs[name].get('flat') and name not in RESOURCE else None,
            height=height, rotation=old.get('rotation', 0) if water_art else 0,
            extra={'holds': 'forest shelter', 'mineral': ''} if name == 'cave-forest' else None)
    def site(cx, cy, radius, minimum=130):
        for _ in range(3000):
            angle = rng.random()*math.tau
            r = minimum + rng.random()*(radius-minimum)
            x, y = round(cx+math.cos(angle)*r), round(cy+math.sin(angle)*r)
            if (dry_at(x, y) and not blocked(x, y, 24) and not road[int(y//64), int(x//64)]
                    and not any(left < x < right and top < y < bottom for left, top, right, bottom in roofs)):
                if all(math.hypot(x-property_of(n, 'footX'), y-property_of(n, 'footY')) > 65 for n in nodes if abs(x-property_of(n, 'footX')) < 65):
                    return x, y
        raise ValueError(f'No clear resource site near {cx},{cy}')
    # Dedicated, bare-hand first-day budget; larger harvests still require crafted tools.
    for who, (x, y) in starts.items():
        for name, count in (('sticks', 6), ('pebbles', 10), ('wild-berries', 6), ('flowers', 2)):
            for _ in range(count):
                px, py = site(x, y, 880)
                add(name, px, py, extra={'starterFor': who})
        marker(who.title()+' start', 'spawn', x, y, character=who, safeRadius=1400)
    # Small resupply pockets support expeditions without scattering every resource everywhere.
    for name, x, y in SETTLEMENTS:
        marker(name, 'settlement', x, y, safeRadius=900, campBuildRadius=180)
        for sprite in ('sticks', 'sticks', 'pebbles', 'pebbles', 'wild-berries', 'wild-berries', 'flowers'):
            px, py = site(x, y, 900, 260)
            add(sprite, px, py, extra={'resupply': name})
    for x, y in quarries:
        marker('Ordinary stone quarry', 'quarry', x, y, resource='stone', requiredTool='pickaxe')
        for _ in range(8):
            px, py = site(x, y, 650, 180)
            add('boulder' if rng.random() < 0.35 else 'rocks-a', px, py)
    # Farm plots are visual + harvest metadata; their simulation belongs to game integration.
    for x, y in ((11048, 7648), (14100, 9850), (4700, 7450)):
        for _ in range(6):
            px, py = site(x, y, 400, 150)
            add('wheat-4', px, py, extra={'cultivated': True})
    herds, dens = [], []
    for i in range(24):
        kind = ('rabbit', 'deer', 'rabbit', 'boar')[i % 4]
        for _ in range(10000):
            x, y = rng.randrange(2600, w*64-2600), rng.randrange(2600, h*64-2600)
            if not dry_at(x, y) or blocked(x, y, 60) or distance_start(x, y) < 1400:
                continue
            if any(math.hypot(x-a, y-b) < 950 for _, a, b in SETTLEMENTS):
                continue
            if any(math.hypot(x-q['x'], y-q['y']) < 1400 for q in herds):
                continue
            break
        else:
            raise ValueError('Unable to place a safe hunting herd')
        group = dict(kind=kind, x=x, y=y, count=2 if kind != 'deer' else 3)
        herds.append(group)
        marker(f'{kind.title()} habitat {i+1}', 'herd', x, y, animal=kind, count=group['count'], roamRadius=260, respawnSeconds=1080)
        add(kind, x, y, target=animals, extra={'spawnMarker': True, 'herdSize': group['count']})
    for x, y in kept_caves:
        if len(dens) >= 4 or any(math.hypot(x-q['x'], y-q['y']) < 3000 for q in dens):
            continue
        px, py = site(x, y, 380, 180)
        if distance_start(px, py) < 2000:
            continue
        dens.append(dict(x=px, y=py, distanceFromSpawn=round(distance_start(px, py))))
        marker('Distant wolf den', 'wolf-den', px, py, count=2, roamRadius=340, warningFirst=True, safeFromSpawn=2000)
        add('wolf', px, py, target=animals, extra={'spawnMarker': True, 'packSize': 2})
    renames = {'d-oasis': 'Blossom Lake', 'd-colonnade': 'Old Orchard Ruins', 'd-needle': 'Foxglove Ridge',
               'd-ribs': 'Fallen Elder', 'd-dunes': 'Buttercup Downs', 'd-well': 'Wayside Well', 'd-caravan': 'Blossom Crossroads',
               's-tarn': 'Alder Tarn', 's-lookout': 'Springwatch Lookout', 's-cairn': "Traveller's Cairn", 's-hollow': 'Fern Hollow',
               's-grove': 'Alder Grove', 's-hut': 'Alder Rest', 's-drifts': 'Bluebell Slopes',
               'c-mine': 'Stonebrook Quarry', 'c-prospector': 'Willowbank Camp', 'j-temple': 'Greenbough Ruins',
               'j-pool': 'Willow Pool', 'j-kapok': 'The Elder Oak', 'j-mangrove': 'Reedwater Edge'}
    for place in places['landmarks']:
        if place['name'] == 'New place':
            continue
        title = renames.get(place['id'], place['name']).replace('Leaning Palms', 'Leaning Oaks')
        marker(title, 'landmark', place['x'], place['y'], landmarkId=place['id'])
    for i, place in enumerate(places['waypoints']):
        marker(f'Spring trail signpost {i+1}', 'waypoint', place['x'], place['y'], waypointId=place['id'])
    for wreck in places['wrecks']:
        add('old-boat', wreck['x'], wreck['y'], height=90, extra={'repairable': True, 'woodCost': 6, 'stoneCost': 2})
        marker('Future country sea route', 'country-exit', *wreck['launch'], destination='unassigned', enabled=False)
    tilesets = [dict(firstgid=1, source='../tiled/terrain-redrawn.tsx'), dict(firstgid=FIRST_PATH, source='../tiled/path-connectors.tsx'), dict(firstgid=FIRST_OBJECT, source='spring-country-objects.tsx')]
    world = dict(type='map', version='1.10', tiledversion='1.11.0', orientation='orthogonal', renderorder='right-down',
                 width=w, height=h, tilewidth=64, tileheight=64, infinite=False, nextlayerid=len(layers)+1, nextobjectid=uid,
                 tilesets=tilesets, layers=layers, properties=props(country='spring', biome='spring', difficulty='balanced',
                 excludedResources='iron,copper,gold,diamond', characterHeight=76, integration='Tiled authoring map; not active live game', elevation='flat'))
    report = dict(biome='spring', dimensions=[w, h], tileSize=64, characterHeight=76,
                  objectCount=sum(len(l.get('objects', [])) for l in layers), pathTiles=int(road.sum()),
                  resourceTotals=dict(Counter()), starts={}, settlements=zones,
                  newBuildings=sum(n in NEW_ART and not n.startswith('fence') for n,x,y in village_buildings),
                  fenceSegments=placed_fences, diagonalRoutes=diagonal_count, waterCornersAdded=water_added, gates=gates,
                  herds=herds, wolfDens=dens, spriteDefinitions=definitions, resourceNodes=len(nodes), forbiddenObjects=[],
                  invalidResourcePositions=sum(not dry_at(property_of(n, 'footX'), property_of(n, 'footY')) for n in nodes),
                  pathJoinErrors=terrain_join_errors(road_ids, kit['dirt']))
    totals = Counter()
    for n in nodes:
        totals[property_of(n, 'resource')] += property_of(n, 'amount')
    report['resourceTotals'] = dict(totals)
    report['forbiddenObjects'] = sorted(set(definitions) & FORBIDDEN)
    # Half-tile traversal with a 12px character radius; bridge decks connect water crossings.
    walk = np.repeat(np.repeat(dry, 2, axis=0), 2, axis=1)
    for obj in flat['objects']:
        if obj['type'] != 'bridge':
            continue
        x, y = property_of(obj, 'footX'), property_of(obj, 'footY')
        angle = math.radians(obj['rotation'])
        radius = math.hypot(obj['width'], obj['height'])/2+32
        for iy in range(max(0, int((y-radius)//32)), min(h*2, int((y+radius)//32)+1)):
            for ix in range(max(0, int((x-radius)//32)), min(w*2, int((x+radius)//32)+1)):
                dx, dy = ix*32+16-x, iy*32+16-y
                along = dx*math.cos(angle)+dy*math.sin(angle)
                across = -dx*math.sin(angle)+dy*math.cos(angle)
                if abs(along) <= obj['width']/2+32 and abs(across) <= obj['height']*0.32:
                    walk[iy, ix] = True
    for iy, ix in zip(*np.nonzero(walk)):
        if blocked(ix*32+16, iy*32+16, 12):
            walk[iy, ix] = False
    components = np.full(walk.shape, -1, dtype=int)
    def region(x, y):
        ix, iy = int(x//32), int(y//32)
        if not (0 <= ix < w*2 and 0 <= iy < h*2) or not walk[iy, ix]:
            return -1
        if components[iy, ix] >= 0:
            return int(components[iy, ix])
        label = int(components.max())+1
        queue = deque([(ix, iy)])
        components[iy, ix] = label
        while queue:
            ax, ay = queue.popleft()
            for bx, by in ((ax-1, ay), (ax+1, ay), (ax, ay-1), (ax, ay+1)):
                if 0 <= bx < w*2 and 0 <= by < h*2 and walk[by, bx] and components[by, bx] < 0:
                    components[by, bx] = label
                    queue.append((bx, by))
        return label
    start_regions = {who: region(x, y) for who, (x, y) in starts.items()}
    def reachable(x, y, label):
        # Harvest interaction reaches 80px; the resource itself may have a solid base.
        return any(0 <= int((y+dy)//32) < h*2 and 0 <= int((x+dx)//32) < w*2
                   and components[int((y+dy)//32), int((x+dx)//32)] == label
                   for dx, dy in ((0, 0), (64, 0), (-64, 0), (0, 64), (0, -64))) if label >= 0 else False
    for settlement in report['settlements']:
        settlement['reachableFrom'] = [who for who, label in start_regions.items() if reachable(settlement['x'], settlement['y'], label)]
    for gate in gates:
        gate['reachable'] = reachable(gate['x'],gate['y'],start_regions['builder'])
    report['unreachableGates'] = sum(not g['reachable'] for g in gates)
    for who, (x, y) in starts.items():
        budget = Counter()
        accessible = Counter()
        for n in nodes:
            if not property_of(n, 'tool') and math.hypot(x-property_of(n, 'footX'), y-property_of(n, 'footY')) < 1000:
                budget[property_of(n, 'resource')] += property_of(n, 'amount')
                if reachable(property_of(n, 'footX'), property_of(n, 'footY'), start_regions[who]):
                    accessible[property_of(n, 'resource')] += property_of(n, 'amount')
        report['starts'][who] = dict(x=x, y=y, bareHandBudget=dict(budget), reachableBudget=dict(accessible),
                                    walkable=start_regions[who] >= 0, connectedRegion=start_regions[who])
    return world, report


def write_assets(report):
    art = SPRING / 'spring-country-art'
    art.mkdir(parents=True, exist_ok=True)
    root = ET.Element('tileset', version='1.10', tiledversion='1.11.0', name='spring-country-objects', tilewidth='640', tileheight='640', tilecount=str(len(report['spriteDefinitions'])), columns='0', objectalignment='bottom')
    ET.SubElement(root, 'grid', orientation='orthogonal', width='1', height='1')
    for name, d in report['spriteDefinitions'].items():
        if d.get('animal'):
            with Image.open(ROOT / 'assets/world/creatures' / f'{name}.png') as source:
                source.crop((0, 0, d['width'], d['height'])).save(art / f'{name}.png')
        tile = ET.SubElement(root, 'tile', id=str(d['id']), type=name)
        ET.SubElement(tile, 'image', source=d['image'], width=str(d['width']), height=str(d['height']))
    ET.indent(root, space=' ')
    ET.ElementTree(root).write(SPRING / 'spring-country-objects.tsx', encoding='UTF-8', xml_declaration=True)


def detail(world, x, y, who):
    result = copy.deepcopy(world)
    tx, ty = int(x//64)-10, int(y//64)-7
    result['width'], result['height'] = 20, 14
    for l in result['layers']:
        if l['type'] == 'tilelayer':
            a = np.array(l['data']).reshape(world['height'], world['width'])
            l['data'] = a[ty:ty+14, tx:tx+20].ravel().tolist()
            l['width'], l['height'] = 20, 14
        else:
            l['objects'] = [o for o in l['objects'] if tx*64-350 < o['x'] < (tx+20)*64+350 and ty*64 < o['y'] < (ty+14)*64+350]
            for o in l['objects']:
                o['x'] -= tx*64
                o['y'] -= ty*64
    (SPRING / f'spring-country-detail-{who}.tmj').write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')


def main():
    world, report = create()
    minimum = {'wood': 12, 'stone': 10, 'food': 6, 'herbs': 4}
    bad_starts = any(not s['walkable'] or any(s['reachableBudget'].get(k, 0) < v for k, v in minimum.items())
                     for s in report['starts'].values())
    if (report['forbiddenObjects'] or report['invalidResourcePositions'] or report['pathJoinErrors'] or bad_starts
            or any(len(s['reachableFrom']) != len(report['starts']) for s in report['settlements'])):
        raise ValueError('Spring validation failed; see tests before saving')
    write_assets(report)
    (SPRING / 'spring-country.tmj').write_text(json.dumps(world, separators=(',', ':')), encoding='utf-8')
    (SPRING / 'spring-country-report.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    for who, start in report['starts'].items():
        detail(world, start['x'], start['y'], who)
    print(json.dumps({k: report[k] for k in ('dimensions', 'objectCount', 'pathTiles', 'resourceNodes', 'starts', 'forbiddenObjects')}, indent=2))


if __name__ == '__main__':
    main()
