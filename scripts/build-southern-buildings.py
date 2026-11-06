"""Build a compact present-day building mesh for Taipa, Cotai, and Coloane.

Requires numpy, scipy, shapely, and mapbox-vector-tile. The input footprints
come from OpenStreetMap through the same OpenFreeMap z14 tiles as the peninsula
mesh. The output is intentionally a static binary asset so the browser does
not fetch thousands of live building features during a presentation.

Binary layout (little endian): uint32 vertex count, uint32 index count,
float32 XYZ positions in local kilometres, uint8 RGB vertex colours, padding
to the next four-byte boundary, then uint32 triangle indices.
"""

import json
import math
import struct
import urllib.request
from pathlib import Path

import mapbox_vector_tile
import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import transform, triangulate
from shapely.prepared import prep


ROOT = Path(__file__).resolve().parents[1]
TERRAIN = ROOT / 'terrain'
BASE = json.loads((TERRAIN / 'macau.json').read_text(encoding='utf-8'))
LAND = shape(json.loads((TERRAIN / 'land.geojson').read_text(encoding='utf-8')))
# The peninsula mesh ends at z=-1 km. Preserve a small shoreline tolerance,
# then clip every footprint to Macau land rather than its rectangular tile.
SOUTH = LAND.buffer(.008).intersection(box(-3.5, -.99, 6, 7))
SOUTH_PREPARED = prep(SOUTH)
VERTICES = np.asarray(BASE['positions'], dtype=np.float32).reshape(-1, 3)
TERRAIN_TREE = cKDTree(VERTICES[:, [0, 2]])
Z = 14
N = 2 ** Z
TERRAIN_EXAGGERATION = 1.65
LAND_DATUM = .028


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
    def convert(px, py):
        lon = ((tx + np.asarray(px) / extent) / N) * 360 - 180
        lat = np.degrees(np.arctan(np.sinh(
            math.pi * (1 - 2 * (ty + 1 - np.asarray(py) / extent) / N))))
        return project(lon, lat)
    return convert


def fetch(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(
            url, headers={'User-Agent': 'MacauHeritageAtlas/1.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            path.write_bytes(response.read())
    return path.read_bytes()


def base_height(x, z):
    nearest = TERRAIN_TREE.query([x, z])[1]
    return float(VERTICES[nearest, 1]) * TERRAIN_EXAGGERATION + LAND_DATUM


def building_colour(metres, x, z):
    """Reuse the peninsula's muted contemporary height-band palette."""
    if metres >= 120:
        palette = ((.47, .56, .57), (.55, .57, .54), (.57, .53, .46), (.42, .52, .55))
    elif metres >= 45:
        palette = ((.59, .62, .59), (.63, .59, .52), (.55, .62, .61), (.67, .63, .55))
    elif metres >= 18:
        palette = ((.69, .67, .60), (.72, .64, .53), (.62, .68, .63), (.72, .69, .61))
    else:
        palette = ((.76, .70, .59), (.72, .63, .52), (.68, .69, .61), (.78, .73, .64))
    seed = abs(int(round(x * 10000)) * 31 + int(round(z * 10000)) * 17)
    return palette[seed % len(palette)]


def tint(colour, factor):
    return tuple(min(1, max(0, channel * factor)) for channel in colour)


def local_box(west, south, east, north):
    x0, z0 = project(west, north)
    x1, z1 = project(east, south)
    return box(x0, z0, x1, z1)


# These rectangles match the detailed exhibit models' mapped footprint extents.
# Suppress a generic OSM mass only when most of its footprint is covered.
MODEL_MASKS = {
    'Galaxy': local_box(113.551987, 22.146741, 113.555793, 22.150836),
    'Venetian': local_box(113.559396, 22.146610, 113.563345, 22.149550),
    'Parisian': local_box(113.559998, 22.142853, 113.563161, 22.144474),
    'Londoner': local_box(113.564261, 22.144043, 113.566502, 22.147687),
}
AIRPORT_LAND = next(component for component in LAND.geoms
                    if component.covers(Point(*project(113.592, 22.149))))

# Exact OSM passenger-terminal outline (a separate cargo building is retained).
AIRPORT_TERMINAL = Polygon([
    project(*point) for point in [
        (113.573667, 22.157479), (113.573876, 22.157609),
        (113.574096, 22.157792), (113.574262, 22.157976),
        (113.574429, 22.158220), (113.574573, 22.158513),
        (113.574648, 22.158726), (113.574783, 22.158692),
        (113.574863, 22.158930), (113.575652, 22.158702),
        (113.575512, 22.158329), (113.575410, 22.158095),
        (113.575249, 22.157773), (113.574976, 22.157410),
        (113.574740, 22.157156), (113.574504, 22.156978),
        (113.574278, 22.156848), (113.574037, 22.156719),
        (113.572524, 22.155984), (113.572395, 22.156207),
        (113.573720, 22.156858), (113.573704, 22.156898),
        (113.573935, 22.157012), (113.573779, 22.157266),
    ]
])


def suppress_name(polygon):
    if AIRPORT_TERMINAL.intersection(polygon).area / polygon.area > .75:
        return 'Airport terminal'
    for name, mask in MODEL_MASKS.items():
        if mask.intersection(polygon).area / polygon.area > .60:
            return name
    return None


def number(value, default):
    try:
        result = float(value)
        return result if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


tilejson = json.loads(fetch(
    'https://tiles.openfreemap.org/planet/tilejson.json',
    ROOT / 'scripts' / '.cache' / 'southern-v14' / 'tilejson.json'))
tile_url = tilejson['tiles'][0]
dataset = tile_url.split('/')[-4]
cache = ROOT / 'scripts' / '.cache' / 'southern-v14' / dataset
west, south = unproject(SOUTH.bounds[0], SOUTH.bounds[3])
east, north = unproject(SOUTH.bounds[2], SOUTH.bounds[1])
x0, y0 = tile_xy(west, north)
x1, y1 = tile_xy(east, south)

positions, colours, indices = [], [], []
seen = set()
height_counts = {'nominal': 0, 'mapped': 0, 'raisedParts': 0}
coverage_counts = {'Taipa': 0, 'Cotai': 0, 'Coloane': 0, 'Airport': 0}
suppressed = {name: 0 for name in [*MODEL_MASKS, 'Airport terminal']}
suppressed_footprints = []
skipped = {'outside': 0, 'tiny': 0, 'hide_3d': 0, 'duplicate': 0}
count = 0
for tx in range(x0, x1 + 1):
    for ty in range(y0, y1 + 1):
        payload = fetch(tile_url.format(z=Z, x=tx, y=ty),
                        cache / f'{tx}-{ty}.pbf')
        layer = mapbox_vector_tile.decode(payload).get('building')
        if not layer:
            continue
        convert = tile_transform(tx, ty, layer['extent'])
        for feature in layer['features']:
            props = feature['properties']
            if str(props.get('hide_3d', '')).lower() in ('yes', 'true', '1'):
                skipped['hide_3d'] += 1
                continue
            geometry = transform(convert, shape(feature['geometry']))
            for original in getattr(geometry, 'geoms', [geometry]):
                if original.geom_type != 'Polygon' or not original.is_valid:
                    continue
                if not SOUTH_PREPARED.intersects(original):
                    skipped['outside'] += 1
                    continue
                clipped = original.intersection(SOUTH)
                for polygon in getattr(clipped, 'geoms', [clipped]):
                    if polygon.geom_type != 'Polygon':
                        continue
                    polygon = polygon.simplify(.00065, preserve_topology=True)
                    if polygon.area < .000002:
                        skipped['tiny'] += 1
                        continue
                    centroid = polygon.centroid
                    key = (round(centroid.x, 4), round(centroid.y, 4),
                           round(polygon.area, 6))
                    if key in seen:
                        skipped['duplicate'] += 1
                        continue
                    seen.add(key)
                    name = suppress_name(polygon)
                    if name:
                        suppressed[name] += 1
                        lon, lat = unproject(centroid.x, centroid.y)
                        suppressed_footprints.append({
                            'model': name,
                            'center': [round(lon, 6), round(lat, 6)],
                            'areaSquareMetres': round(polygon.area * 1_000_000),
                        })
                        continue
                    raw_height = props.get('render_height')
                    metres = max(2, min(330, number(raw_height, 5)))
                    min_metres = max(0, min(metres - 1,
                                             number(props.get('render_min_height'), 0)))
                    height_counts['nominal' if raw_height is None or metres == 5 else 'mapped'] += 1
                    if min_metres:
                        height_counts['raisedParts'] += 1
                    ground = base_height(centroid.x, centroid.y) + .001
                    bottom = ground + min_metres / 1000
                    top = ground + metres / 1000
                    rings = [list(polygon.exterior.coords)[:-1]]
                    rings.extend(list(hole.coords)[:-1] for hole in polygon.interiors)
                    roof_vertices = list(dict.fromkeys(
                        point for ring in rings for point in ring))
                    roof_offset = len(positions) // 3
                    wall_colour = building_colour(metres, centroid.x, centroid.y)
                    roof_colour = tint(wall_colour, 1.12)
                    base_colour = tint(wall_colour, .72)
                    for x, z in roof_vertices:
                        positions.extend((x, top, z))
                        colours.extend(roof_colour)
                    roof_index = {point: roof_offset + i
                                  for i, point in enumerate(roof_vertices)}
                    roof_before = len(indices)
                    for triangle in triangulate(polygon):
                        if not polygon.covers(triangle.representative_point()):
                            continue
                        a, b, c = list(triangle.exterior.coords)[:3]
                        if a not in roof_index or b not in roof_index or c not in roof_index:
                            continue
                        if (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) > 0:
                            b, c = c, b
                        indices.extend((roof_index[a], roof_index[b], roof_index[c]))
                    if len(indices) == roof_before:
                        del positions[roof_offset * 3:]
                        del colours[roof_offset * 3:]
                        continue
                    for ring in rings:
                        offset = len(positions) // 3
                        for x, z in ring:
                            positions.extend((x, bottom, z, x, top, z))
                            colours.extend(base_colour)
                            colours.extend(wall_colour)
                        for i in range(len(ring)):
                            j = (i + 1) % len(ring)
                            ai, at = offset + i*2, offset + i*2 + 1
                            bi, bt = offset + j*2, offset + j*2 + 1
                            indices.extend((ai, bi, at, bi, bt, at))
                    count += 1
                    if AIRPORT_LAND.covers(centroid):
                        coverage_counts['Airport'] += 1
                    elif centroid.y < 1.2:
                        coverage_counts['Taipa'] += 1
                    elif centroid.y < 2.8:
                        coverage_counts['Cotai'] += 1
                    else:
                        coverage_counts['Coloane'] += 1

assert count > 1000, f'Only {count} southern buildings found; check tiles'
assert len(positions) % 3 == len(colours) % 3 == 0
assert max(indices) < len(positions) // 3
position_bytes = np.asarray(positions, dtype='<f4').tobytes()
colour_bytes = np.rint(np.asarray(colours) * 255).astype('u1').tobytes()
index_bytes = np.asarray(indices, dtype='<u4').tobytes()
header = struct.pack('<II', len(positions) // 3, len(indices))
padding = bytes((-len(colour_bytes)) % 4)
asset = TERRAIN / 'southern-buildings.bin'
asset.write_bytes(header + position_bytes + colour_bytes + padding + index_bytes)
metadata = {
    'source': 'OpenStreetMap building footprints via OpenFreeMap z14',
    'tileSet': dataset,
    'region': 'Taipa, Cotai, Coloane, and Macau airport; clipped to Macau land',
    'coordinates': 'local km: x=(lon-113.56)*111.32*cos(22.16deg); z=(22.16-lat)*111.32',
    'terrainVerticalExaggeration': TERRAIN_EXAGGERATION,
    'buildingHeightScale': 1,
    'defaultHeightMetres': 5,
    'buildingCount': count,
    'heightCounts': height_counts,
    'approximateAreaCounts': coverage_counts,
    'suppressedForDetailedModels': suppressed,
    'suppressedFootprints': suppressed_footprints,
    'skipped': skipped,
    'vertexCount': len(positions) // 3,
    'triangleCount': len(indices) // 3,
    'binaryBytes': asset.stat().st_size,
    'binaryLayout': 'u32 vertexCount, u32 indexCount, f32 XYZ, u8 RGB, align4, u32 indices',
}
(TERRAIN / 'southern-buildings.meta.json').write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=False, indent=2))
