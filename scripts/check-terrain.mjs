import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const data=JSON.parse(read('terrain/macau.json'));
assert(data.positions.length%3===0 && data.indices.length%3===0);
assert(data.positions.every(Number.isFinite));
assert(data.indices.every(i=>Number.isInteger(i)&&i>=0&&i<data.positions.length/3));
assert(Math.max(...data.positions.filter((_,i)=>i%3===1))>.14,'DEM must contain the Coloane hills');
const geom=new THREE.BufferGeometry();
geom.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geom.setIndex(data.indices);geom.computeVertexNormals();
const normals=geom.attributes.normal.array;
assert(Array.from(normals).every(Number.isFinite));
assert(Array.from(normals).filter((_,i)=>i%3===1).every(n=>n>=0),'Terrain triangles must face upward');
for(const ring of data.rings)assert(ring.length>=3&&ring.flat().every(Number.isFinite));
for(const [w,h] of [[1280,650],[390,600],[844,390]]){
 const camera=new THREE.PerspectiveCamera(38,w/h,.1,150);
 const fit=Math.max(1,Math.min(1.8,1.2/Math.max(.5,w/h)));
 camera.position.set(6.8,9.6,11.5).multiplyScalar(fit);camera.lookAt(0,0,-.35);camera.updateMatrixWorld();
 let maximum=0;
 for(let i=0;i<data.positions.length;i+=3){const p=new THREE.Vector3(data.positions[i],data.positions[i+1]*4+.1,data.positions[i+2]).project(camera);maximum=Math.max(maximum,Math.abs(p.x),Math.abs(p.y));}
 assert(maximum<1,`Overview clips the terrain at ${w}×${h}: ${maximum}`);
 console.log(`Overview ${w}×${h}: fits (${maximum.toFixed(2)})`);
}
const html=read('index.html'),js=read('terrain-view.js'),ui=read('exhibition.js');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML ids');
for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(match[1]),`Missing DOM id ${match[1]}`);
assert(ui.includes("if(view==='street'||view==='timeline')window.macauTerrain.setActive(false);"),'Timeline must deactivate the terrain view');
for(const match of html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').matchAll(/(?:src|href)="([^"#]+)"/g)){
 const path=match[1];if(/^(https?:|data:)/.test(path))continue;
 assert(fs.existsSync(new URL(path,root)),`Missing local file ${path}`);
}
console.log(`${data.positions.length/3} vertices, ${data.indices.length/3} triangles: geometry and page integration OK`);
