"""Pure geography helpers shared by the Spring Country tools.

The Spring map (assets/world/spring-country/spring-country.tmj) carries its gameplay layout as
plain point markers in one Tiled layer: where each character starts, the settlements, the
landmarks to find, the signposts, and so on. These helpers read those markers and turn them into
the two things the game needs that are not pictures: which district (region) each patch of ground
belongs to, and a flat height map (Spring has no hills). build-spring-country does not use this file;
spring-to-places.py and import-spring-country.py do.
"""
import json
import math

# The Tiled object layer that holds the gameplay markers, and how each marker `type` is grouped.
MARKER_LAYER = 'Gameplay markers - show to edit'
GROUPS = {
    'spawn': 'spawns', 'settlement': 'settlements', 'quarry': 'quarries', 'herd': 'herds',
    'wolf-den': 'dens', 'landmark': 'landmarks', 'waypoint': 'waypoints',
    'country-exit': 'exits', 'village-gate': 'gates',
}


# Turns a place name into a short id, e.g. "Pinefall Camp" -> "pinefall-camp".
def slug(name):
    out = ''.join(c.lower() if c.isalnum() else '-' for c in name)
    while '--' in out:
        out = out.replace('--', '-')
    return out.strip('-')


# Reads the gameplay markers out of a Spring Tiled map, grouped by what they are.
# Each marker becomes a small record {name, x, y, props}; props is the marker's custom fields as a
# plain dict. Returns a dict with one list per group (spawns, settlements, landmarks, ...).
def read_markers(tmj_path):
    with open(tmj_path, encoding='utf-8') as f:
        data = json.load(f)
    layer = next(l for l in data['layers'] if l.get('name') == MARKER_LAYER)
    out = {group: [] for group in GROUPS.values()}
    for obj in layer['objects']:
        group = GROUPS.get(obj.get('type'))
        if not group:
            continue
        props = {p['name']: p['value'] for p in obj.get('properties', [])}
        out[group].append({'name': obj.get('name', ''), 'x': round(obj['x']), 'y': round(obj['y']), 'props': props})
    return out


# Builds the region grid: one digit per square saying which district that square belongs to.
# A district is the land around one settlement, so every square is given to its nearest settlement
# (a simple Voronoi split). Returns the grid as a row-major string and the ordered list of region
# ids, so the digit in the grid is each region's place in that list (matching src/world/regions.js).
def region_grid(settlements, cols, rows, cell):
    ids = [slug(s['name']) for s in settlements]
    sites = [(s['x'], s['y']) for s in settlements]
    digits = []
    for cy in range(rows):
        for cx in range(cols):
            mx, my = (cx + 0.5) * cell, (cy + 0.5) * cell
            best = min(range(len(sites)), key=lambda i: math.hypot(sites[i][0] - mx, sites[i][1] - my))
            digits.append(str(best))
    return ''.join(digits), ids


# Says which district a single spot belongs to, exactly as the game's regionOf does.
# The game reads the region grid by the square a spot falls in, and each square went to the settlement
# nearest the square's centre. So a place is given the district of its own square's centre, not of the
# place's exact point: that keeps places.json's region and the game's regionOf in perfect step.
def region_at(x, y, settlements, cell):
    cx, cy = int(x // cell), int(y // cell)
    mx, my = (cx + 0.5) * cell, (cy + 0.5) * cell
    return min(range(len(settlements)), key=lambda i: (settlements[i]['x'] - mx) ** 2 + (settlements[i]['y'] - my) ** 2)


# Builds a flat height map: every tile is level 0, with no cliff walls or stairs.
# Spring has no hills, so collision never blocks on height. The string is one letter per tile,
# row-major, the same shape src/world/map.js reads from the map's `elevation` property.
def flat_elevation(cols, rows):
    return '0' * (cols * rows)
