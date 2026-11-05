"""Build a light, batched Macau peninsula building mesh from OSM vector tiles.

The roofs follow mapped footprints. Heights are OpenFreeMap render heights;
many untagged buildings use a nominal height, so this is a present-day
streetscape visualisation rather than a historical or surveyed height model.
"""

import json
import math
import urllib.request
from pathlib import Path

import mapbox_vector_tile
import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Point, box, shape
from shapely.ops import transform, triangulate

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'scripts' / '.cache' / 'peninsula-v14'
CACHE.mkdir(parents=True, exist_ok=True)
BASE = json.loads((ROOT / 'terrain' / 'macau.json').read_text())
LAND = shape(json.loads((ROOT / 'terrain' / 'land.geojson').read_text()))
PENINSULA = LAND.intersection(box(-3.5, -7, 3.5, -1.0)).buffer(.008)
VERTICES = np.asarray(BASE['positions']).reshape(-1, 3)
TREE = cKDTree(VERTICES[:, [0, 2]])
Z = 14
N = 2 ** Z


def project(lon, lat):
    return ((lon - 113.56) * 111.32 * math.cos(math.radians(22.16)),
            (22.16 - lat) * 111.32)


def unproject(x, z):
    return (x / (111.32 * math.cos(math.radians(22.16))) + 113.56,
            22.16 - z / 111.32)


def tile_xy(lon, lat):
    return (int((lon + 180) / 360 * N),
            int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * N))


def tile_transform(tx, ty, extent):
    def fn(px, py):
        lon = ((tx + np.asarray(px) / extent) / N) * 360 - 180
        lat = np.degrees(np.arctan(np.sinh(math.pi *
                         (1 - 2 * (ty + 1 - np.asarray(py) / extent) / N))))
        return project(lon, lat)
    return fn


def fetch(url, name):
    path = CACHE / name
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'MacauHeritageAtlas/1.0'})
        with urllib.request.urlopen(request, timeout=35) as response:
            path.write_bytes(response.read())
    return path.read_bytes()


def base_height(x, z):
    return float(VERTICES[TREE.query([x, z])[1], 1]) * 2.6 + .028


tilejson = json.loads(fetch('https://tiles.openfreemap.org/planet', 'tilejson.json'))
tile_url = tilejson['tiles'][0]
west, south = unproject(PENINSULA.bounds[0], PENINSULA.bounds[3])
east, north = unproject(PENINSULA.bounds[2], PENINSULA.bounds[1])
x0, y0 = tile_xy(west, north)
x1, y1 = tile_xy(east, south)

positions, indices = [], []
seen = set()
count = 0
height_counts = {'nominal': 0, 'other': 0}
for tx in range(x0, x1 + 1):
    for ty in range(y0, y1 + 1):
        data = mapbox_vector_tile.decode(fetch(
            tile_url.format(z=Z, x=tx, y=ty), f'{tx}-{ty}.pbf'))
        layer = data.get('building')
        if not layer:
            continue
        convert = tile_transform(tx, ty, layer['extent'])
        for feature in layer['features']:
            geometry = transform(convert, shape(feature['geometry']))
            for polygon in getattr(geometry, 'geoms', [geometry]):
                if polygon.geom_type != 'Polygon' or not polygon.is_valid:
                    continue
                if polygon.area < .000002 or not PENINSULA.covers(polygon.representative_point()):
                    continue
                polygon = polygon.simplify(.00065, preserve_topology=True)
                centroid = polygon.centroid
                key = (round(centroid.x, 4), round(centroid.y, 4))
                if key in seen:
                    continue
                seen.add(key)
                props = feature['properties']
                metres = max(3, min(85, float(props.get('render_height', 5))))
                height_counts['nominal' if metres == 5 else 'other'] += 1
                ground = base_height(centroid.x, centroid.y) + .001
                top = ground + metres * 2.6 / 1000
                rings = [list(polygon.exterior.coords)[:-1]]
                rings.extend(list(hole.coords)[:-1] for hole in polygon.interiors)
                roof_vertices = list(dict.fromkeys(point for ring in rings for point in ring))
                roof_offset = len(positions) // 3
                positions.extend(value for x, z in roof_vertices for value in (x, top, z))
                roof_index = {point: roof_offset + i for i, point in enumerate(roof_vertices)}
                before = len(indices)
                for triangle in triangulate(polygon):
                    if not polygon.covers(triangle.representative_point()):
                        continue
                    a, b, c = list(triangle.exterior.coords)[:3]
                    if a not in roof_index or b not in roof_index or c not in roof_index:
                        continue
                    if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]) > 0:
                        b, c = c, b
                    indices.extend((roof_index[a], roof_index[b], roof_index[c]))
                if len(indices) == before:
                    continue
                for ring in rings:
                    wall_offset = len(positions) // 3
                    for x, z in ring:
                        positions.extend((x, ground, z, x, top, z))
                    for i in range(len(ring)):
                        j = (i + 1) % len(ring)
                        ai, at = wall_offset + i*2, wall_offset + i*2 + 1
                        bi, bt = wall_offset + j*2, wall_offset + j*2 + 1
                        indices.extend((ai, bi, at, bi, bt, at))
                count += 1

assert count > 1000, f'Only {count} peninsula buildings found; check source tiles'
positions = [round(value, 5) for value in positions]
output = {
    'source': 'OpenStreetMap footprints via OpenFreeMap z14; render_height when available, otherwise nominal height',
    'verticalExaggeration': 2.6,
    'buildingCount': count,
    'heightCounts': height_counts,
    'positions': positions,
    'indices': indices,
}
(ROOT / 'terrain' / 'peninsula-buildings.json').write_text(
    json.dumps(output, separators=(',', ':')))
print('Peninsula buildings:', count, 'triangles:', len(indices) // 3,
      'asset bytes:', (ROOT / 'terrain' / 'peninsula-buildings.json').stat().st_size)
