"""Build a local Macau relief mesh from OSM/OpenFreeMap and AWS Terrarium DEM.
Python dependencies: numpy pillow scipy shapely mapbox-vector-tile.
"""
import json, math, io, subprocess, concurrent.futures
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape, box, Point, LineString, mapping
from shapely.ops import transform, unary_union, split, triangulate
import mapbox_vector_tile
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'scripts'/'.cache';CACHE.mkdir(exist_ok=True)
def fetch(url,name):
 p=CACHE/name
 if not p.exists():
  subprocess.run(['curl','-fLsS','--max-time','35',url,'-o',str(p)],check=True)
 return p.read_bytes()
Z=12; N=2**Z
TILE=json.loads(fetch('https://tiles.openfreemap.org/planet','tilejson.json'))['tiles'][0]
keys=[(x,y) for x in range(3339,3341) for y in range(1788,1791)]
def tile(k):
 x,y=k
 v=mapbox_vector_tile.decode(fetch(TILE.format(z=Z,x=x,y=y),f'{x}-{y}.pbf'))
 dem=np.asarray(Image.open(io.BytesIO(fetch(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png',f'{x}-{y}.png')))).astype(float)
 return k,v,dem[:,:,0]*256+dem[:,:,1]+dem[:,:,2]/256-32768
results=list(concurrent.futures.ThreadPoolExecutor(6).map(tile,keys))
# Local projected coordinates in km; north is negative Z in the viewer.
def project(lon,lat):return ((lon-113.56)*111.32*math.cos(math.radians(22.16)),(22.16-lat)*111.32)
def tileproject(x,y,extent):
 def fn(px,py):
  lon=((x+np.asarray(px)/extent)/N)*360-180
  lat=np.degrees(np.arctan(np.sinh(math.pi*(1-2*(y+1-np.asarray(py)/extent)/N))))
  return project(lon,lat)
 return fn
layers={};dems={}
for (x,y),v,dem in results:
 dems[x,y]=dem
 for name,layer in v.items():
  for f in layer['features']:
   g=transform(tileproject(x,y,layer['extent']),shape(f['geometry']))
   layers.setdefault(name,[]).append((g,f['properties']))
print('boundaries',[(p,round(g.length,2)) for g,p in layers.get('boundary',[]) if p.get('admin_level',10)<=4])
bounds=box(*(-5,-7,6,7))
water=unary_union([g for g,p in layers['water']]).buffer(0)
land=bounds.difference(water)
# Use the OSM land border to cut the peninsula away from Zhuhai, then
# select the disconnected Macau islands. No hand-drawn coast is used.
from shapely.geometry import Polygon
north=next(g for g,p in layers['boundary'] if p.get('admin_level')==3 and not p.get('maritime') and g.geom_type=='LineString' and g.bounds[1]<-6)
coords=list(north.coords)
if coords[0][0]>coords[-1][0]:coords.reverse()
# The small eastern port island is divided by the OSM administrative border.
mask=Polygon([(-5,coords[0][1]),*coords,(.2354,-5.813),(.9256,-5.4636),(1.1402,-4.9019),(6,-4.9019),(6,7),(-5,7)])
land=land.intersection(mask)
seeds=[(113.543,22.195),(113.56,22.15),(113.593,22.145),(113.566,22.20),(113.58,22.20),(113.561,22.169),(113.545,22.169)]
selected=[p for p in land.geoms if any(p.covers(Point(project(*s))) for s in seeds)]
land=unary_union(selected).buffer(0).simplify(.008,preserve_topology=True)
print('Selected area km²',land.area, 'bounds',land.bounds)
(ROOT/'terrain'/'land.geojson').write_text(json.dumps(mapping(land)))
# Save an inspectable plan view of the processed shoreline.
preview=Image.new('RGB',(700,1000),'#22313b');pd=ImageDraw.Draw(preview)
def pix(p):return ((p[0]+5)*60,(p[1]+7)*65)
for part in getattr(land,'geoms',[land]):
 pd.polygon([pix(p) for p in part.exterior.coords],fill='#beaa78')
for g,p in layers.get('boundary',[]):
 if p.get('admin_level',10)<=4:
  for line in getattr(g,'geoms',[g]):
   if line.geom_type=='LineString':pd.line([pix(p) for p in line.coords],fill='red',width=2)
preview.save(CACHE/'shoreline-check.png')
# Bilinear Terrarium DEM sampling (metres -> km). Historical DEM can predate
# reclamation; negative heights are clamped at sea level on today's land.
def elevation(x,z):
 lon=x/(111.32*math.cos(math.radians(22.16)))+113.56;lat=22.16-z/111.32
 gx=(lon+180)/360*N;gy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N
 tx,ty=int(gx),int(gy);px=(gx-tx)*256;py=(gy-ty)*256
 a=dems[tx,ty];ix,iy=min(254,int(px)),min(254,int(py));fx,fy=px-ix,py-iy
 h=a[iy,ix]*(1-fx)*(1-fy)+a[iy,ix+1]*fx*(1-fy)+a[iy+1,ix]*(1-fx)*fy+a[iy+1,ix+1]*fx*fy
 return round(max(0,min(200,h))/1000,5)
from scipy.spatial import Delaunay
positions=[];indices=[];rings=[]
for polygon in getattr(land,'geoms',[land]):
 if polygon.area<.008:continue
 boundary=[]
 for ring in [polygon.exterior,*polygon.interiors]:
  coords=list(ring.coords);dense=[]
  for a,b in zip(coords,coords[1:]):
   n=max(1,math.ceil(math.dist(a,b)/.045))
   dense.extend([(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n) for i in range(n)])
  boundary.extend(dense);rings.append([[round(x,5),elevation(x,z),round(z,5)] for x,z in dense])
 minx,minz,maxx,maxz=polygon.bounds
 grid=[(x,z) for x in np.arange(minx,maxx,.052) for z in np.arange(minz,maxz,.052) if polygon.contains(Point(x,z))]
 pts=np.unique(np.round(np.array(boundary+grid),6),axis=0)
 offset=len(positions)//3
 positions.extend(v for x,z in pts for v in (round(x,5),elevation(x,z),round(z,5)))
 for a,b,c in Delaunay(pts).simplices:
  tri=Polygon([pts[a],pts[b],pts[c]])
  if polygon.buffer(.00002).covers(tri):indices.extend([offset+int(a),offset+int(c),offset+int(b)])
# Styled texture: actual OSM land cover, parks and road geometry.
size=1536;ext=(-3.6,-6.7,4.3,6.0)
rng=np.random.default_rng(8);noise=rng.normal(0,3,(size,size,1))
img=Image.fromarray(np.uint8(np.clip(np.array([181,158,111])+noise,0,255)));draw=ImageDraw.Draw(img)
def uv(p):return ((p[0]-ext[0])/(ext[2]-ext[0])*(size-1),(p[1]-ext[1])/(ext[3]-ext[1])*(size-1))
for name in ['landcover','landuse','park','water']:
 for g,p in layers.get(name,[]):
  cls=p.get('class','')
  color=('#63734b' if cls in ['wood','forest','grass','grassland','scrub','park','recreation_ground'] or name=='park' else '#a99b73' if cls in ['residential','commercial','industrial'] else '#304c52' if name=='water' else None)
  if color:
   for poly in getattr(g,'geoms',[g]):
    if poly.geom_type=='Polygon':draw.polygon([uv(q) for q in poly.exterior.coords],fill=color)
bridges=[]
for g,p in layers.get('transportation',[]):
 if p.get('class') not in ['motorway','trunk','primary','secondary','tertiary','minor','service']:continue
 for line in getattr(g,'geoms',[g]):
  if line.geom_type!='LineString':continue
  draw.line([uv(q) for q in line.coords],fill='#d5bc87',width=3 if p.get('class') in ['motorway','trunk','primary'] else 1)
  if p.get('brunnel')=='bridge' and line.intersects(region if 'region' in globals() else mask) and line.length>.03:
   clipped=line.intersection(mask)
   for part in getattr(clipped,'geoms',[clipped]):
    if part.geom_type=='LineString':bridges.append([[round(x,5),.028,round(z,5)] for x,z in part.coords])
# All pixels remain local; there are no live DEM or image-service dependencies.
img.save(ROOT/'terrain'/'surface.png',optimize=True)
data={'positions':positions,'indices':indices,'rings':rings,'bridges':bridges,'textureBounds':ext,'source':'OSM via OpenFreeMap; AWS Terrain Tiles (Terrarium)','elevationUnits':'km','verticalExaggeration':4}
(ROOT/'terrain'/'macau.json').write_text(json.dumps(data,separators=(',',':')))
print('Mesh vertices',len(positions)//3,'triangles',len(indices)//3,'height range',min(positions[1::3]),max(positions[1::3]))
assert 25<land.area<40 and max(positions[1::3])>.13
assert all(0<=i<len(positions)//3 for i in indices)
assert land.covers(Point(project(113.566,22.123)))
assert not land.covers(Point(project(113.54,22.222)))
