"""Align the existing Coloane building mesh to revised terrain/building scales."""

import json
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'terrain' / 'street-details.json'
TERRAIN = ROOT / 'terrain' / 'macau.json'
TARGET_TERRAIN_SCALE = 1.65
TARGET_BUILDING_SCALE = 1.0
LAND_DATUM = .028

data = json.loads(ASSET.read_text())
source_terrain_scale = float(data.get('terrainVerticalExaggeration', data.get('verticalExaggeration', 2.6)))
source_building_scale = float(data.get('buildingHeightScale', data.get('verticalExaggeration', 2.6)))

if source_terrain_scale != TARGET_TERRAIN_SCALE or source_building_scale != TARGET_BUILDING_SCALE:
    terrain = np.asarray(json.loads(TERRAIN.read_text())['positions'], dtype=float).reshape(-1, 3)
    tree = cKDTree(terrain[:, [0, 2]])
    mesh = np.asarray(data['positions'], dtype=float).reshape(-1, 3)
    nearest = tree.query(mesh[:, [0, 2]])[1]
    raw_elevation = terrain[nearest, 1]
    old_ground = raw_elevation * source_terrain_scale + LAND_DATUM
    relative_height = np.maximum(0, mesh[:, 1] - old_ground)
    mesh[:, 1] = (raw_elevation * TARGET_TERRAIN_SCALE + LAND_DATUM +
                  relative_height * TARGET_BUILDING_SCALE / source_building_scale)
    data['positions'] = [round(float(value), 5) for value in mesh.reshape(-1)]

data.pop('verticalExaggeration', None)
data['terrainVerticalExaggeration'] = TARGET_TERRAIN_SCALE
data['buildingHeightScale'] = TARGET_BUILDING_SCALE
ASSET.write_text(json.dumps(data, separators=(',', ':')))
print('Coloane buildings:', data.get('buildingCount'),
      'terrain scale:', TARGET_TERRAIN_SCALE,
      'building scale:', TARGET_BUILDING_SCALE)
