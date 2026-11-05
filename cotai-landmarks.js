import * as THREE from './vendor/three.module.js';

// Model anchors come from OpenStreetMap footprints. Building dimensions are
// approximate metres, kept at the same scale as the surrounding terrain.
export const cotaiLandmarks = [
 { name:'澳門銀河', english:'GALAXY MACAU', coordinates:[113.55364,22.15037], height:128,
  target:[113.55335,22.14958], offset:[.64,.36,.65], build:galaxy },
 { name:'澳門威尼斯人', english:'THE VENETIAN MACAO', coordinates:[113.56088,22.14818], height:145,
  target:[113.56184,22.14797], offset:[.60,.32,.68], build:venetian },
 { name:'澳門巴黎人', english:'THE PARISIAN MACAO', coordinates:[113.56283,22.14358], height:162,
  target:[113.56210,22.14364], offset:[.54,.29,.65], build:parisian },
 { name:'澳門倫敦人', english:'THE LONDONER MACAO', coordinates:[113.56437,22.14726], height:96,
  target:[113.56482,22.14698], offset:[-.58,.30,.63], build:londoner },
];

const palette = {
 limestone:'#e3d4b4', ivory:'#eee0c4', sandstone:'#ba9b72', gold:'#caa052',
 champagne:'#d8b271', tinted:'#6b746c', bronze:'#8a6242', cream:'#e7d6af',
 terracotta:'#a45d49', rose:'#c88c71', dark:'#4b4543', copper:'#426664',
 slate:'#576272', iron:'#624731', warmMetal:'#ac8354', clock:'#f6e9c6',
 water:'#4d8583', courtyard:'#9eaa77',
};
const materials = Object.fromEntries(Object.entries(palette).map(([name,color])=>[
 name,new THREE.MeshStandardMaterial({color,roughness:.84}),
]));
const geometry = {
 box:new THREE.BoxGeometry(1,1,1),
 round:new THREE.CylinderGeometry(1,1,1,16),
 pyramid:new THREE.ConeGeometry(1,1,4),
 spire:new THREE.ConeGeometry(1,1,10),
 clock:new THREE.CircleGeometry(1,24),
 dome:new THREE.LatheGeometry([
  [0,0],[1,0],[1,.09],[.86,.17],[.74,.33],[.59,.53],[.40,.73],
  [.25,.88],[.12,.97],[.04,1],[0,1],
 ].map(([radius,y])=>new THREE.Vector2(radius,y)),20),
};
const up = new THREE.Vector3(0,1,0);

export function makeCotaiLandmark(landmark, terrainPoint, shadows) {
 const origin = terrainPoint(landmark.coordinates,0);
 const model = new THREE.Group();
 model.name = landmark.english;
 model.position.copy(origin);
 model.scale.setScalar(.001);
 const batches = new Map();

 function at(coordinates, angle = 0) {
  const base = terrainPoint(coordinates,0).sub(origin).multiplyScalar(1000);
  const heading = new THREE.Quaternion().setFromAxisAngle(up,angle);
  function part(shape, material, center, size, rotation = new THREE.Quaternion()) {
   const key = shape + '/' + material;
   if (!batches.has(key)) batches.set(key,{shape,material,matrices:[]});
   const position = new THREE.Vector3(...center).applyQuaternion(heading).add(base);
   const orientation = heading.clone().multiply(rotation);
   batches.get(key).matrices.push(new THREE.Matrix4().compose(position,orientation,new THREE.Vector3(...size)));
  }
  function upright(shape, x, z, bottom, radius, height, material, angle = 0) {
   const rotation = new THREE.Quaternion().setFromAxisAngle(up,angle);
   const y = shape === 'dome' ? bottom : bottom+height/2;
   part(shape,material,[x,y,z],[radius,height,radius],rotation);
  }
  return {
   box(x,z,bottom,width,depth,height,material) {
    part('box',material,[x,bottom+height/2,z],[width,height,depth]);
   },
   column(x,z,bottom,radius,height,material) {
    upright('round',x,z,bottom,radius,height,material);
   },
   roof(x,z,bottom,width,height,material) {
    upright('pyramid',x,z,bottom,width/Math.SQRT2,height,material,Math.PI/4);
   },
   dome(x,z,bottom,radius,height,material) {
    upright('dome',x,z,bottom,radius,height,material);
   },
   spire(x,z,bottom,radius,height,material) {
    upright('spire',x,z,bottom,radius,height,material);
   },
   beam(start,end,width,material) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const rotation = new THREE.Quaternion().setFromUnitVectors(up,direction.clone().normalize());
    part('box',material,a.add(b).multiplyScalar(.5).toArray(),[width,direction.length(),width],rotation);
   },
   dial(center,radius,angle) {
    part('clock','clock',center,[radius,radius,1],new THREE.Quaternion().setFromAxisAngle(up,angle));
   },
  };
 }

 landmark.build(at);
 for (const {shape,material,matrices} of batches.values()) {
  const mesh = new THREE.InstancedMesh(geometry[shape],materials[material],matrices.length);
  matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
  mesh.castShadow = shadows && shape !== 'clock';
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  model.add(mesh);
 }
 return model;
}

function hotel(frame,x,z,base,width,depth,height,floors,wall,window,cap) {
 frame.box(x,z,base,width,depth,height,wall);
 for (let floor=1; floor<=floors; floor++) {
  const spacing = height/(floors+1);
  frame.box(x,z,base+floor*spacing,width+.8,depth+.8,spacing*.48,window);
 }
 for (const edge of [-1,1]) {
  frame.box(x+edge*(width/2-1.6),z,base,3.4,depth+1.3,height,wall);
  frame.box(x,z+edge*(depth/2-1.6),base,width+1.3,3.4,height,wall);
 }
 frame.box(x,z,base+height,width+3,depth+3,3,cap);
}

function galaxy(at) {
 const base = at([113.55389,22.14867],-.07);
 base.box(0,0,0,365,405,23,'limestone');
 base.box(3,5,22,350,395,3,'ivory');
 base.box(35,0,25,240,262,1,'courtyard');
 base.box(12,14,26,103,44,.55,'water');
 base.column(-38,14,26,22,.55,'water');
 base.column(64,14,26,22,.55,'water');
 base.column(38,-57,26,27,.55,'water');
 for (const z of [-105,97]) {
  base.box(30,z,26,45,29,8,'cream');
  base.box(30,z,34,48,32,2,'terracotta');
  base.roof(30,z,36,27,6,'terracotta');
 }
 const entrance=at([113.55536,22.14883],Math.PI/2-.07);
 entrance.box(0,0,0,171,28,31,'cream');
 entrance.box(0,10,13,66,27,14,'limestone');
 entrance.box(0,10,27,71,30,2,'gold');
 for (const x of [-72,-36,36,72]) {
  entrance.box(x,8,1,10,14,33,'ivory');
  entrance.column(x,8,34,5,3,'sandstone');
  entrance.dome(x,8,37,5,8,'gold');
 }
 for (const [point,angle] of [[[113.55364,22.15037],-.50],[[113.55256,22.14882],-1.02]]) {
  const tower = at(point,angle);
  for (const [x,z,width,depth] of [[-43,-5,47,31],[0,0,46,36],[43,6,47,31]]) {
   tower.box(x,z,20,width,depth,76,'limestone');
   for (const side of [-1,1]) {
    tower.box(x,z+side*(depth/2+.25),27,width-3,.6,63,'bronze');
    for (const rib of [-17,-8.5,0,8.5,17]) {
     tower.box(x+rib,z+side*(depth/2+.8),22,2.6,1.5,74,'ivory');
    }
   }
   tower.box(x,z,94,width+2,depth+2,3,'ivory');
   tower.box(x,z,97,width+3,depth+3,3,'champagne');
  }
  for (const x of [-48,0,48]) {
   const z=x/8;
   const top = x===0 ? 108 : 104;
   tower.box(x,z,89,27,30,top-89,'ivory');
   tower.box(x,z,top-2,30,32,2.5,'champagne');
   tower.column(x,z,top,10,4,'sandstone');
   tower.dome(x,z,top+4,11,x===0?13:10,'gold');
   tower.spire(x,z,top+(x===0?17:14),1.5,3,'cream');
  }
 }
}

function venetian(at) {
 const podium = at([113.56110,22.14808],-.04);
 podium.box(0,0,0,339,314,26,'limestone');
 podium.box(-18,-18,25,292,275,6,'terracotta');
 const hotelTower = at([113.56088,22.14818],-.05);
 hotel(hotelTower,0,0,28,49,161,108,25,'ivory','tinted','terracotta');
 hotel(hotelTower,18,-60,28,77,30,109,25,'limestone','tinted','terracotta');
 hotel(hotelTower,18,60,28,74,30,109,25,'limestone','tinted','terracotta');
 hotelTower.box(1,0,138,37,85,7,'cream');

 const arcade = at([113.56255,22.14826],Math.PI/2-.04);
 arcade.box(0,0,0,182,24,25,'rose');
 arcade.box(0,0,25,188,26,2.4,'limestone');
 for (const y of [4,14]) {
  arcade.box(0,12.1,y,180,1.1,7,'dark');
  for (let bay=-8; bay<=8; bay++) {
   arcade.column(bay*10.5,13.4,y,1.1,8,'ivory');
   arcade.box(bay*10.5,13.4,y+7.2,4.4,2.2,1.4,'ivory');
  }
 }
 const lagoon = at([113.56310,22.14834]);
 lagoon.box(0,0,.1,46,91,.8,'water');
 const bell = at([113.56320,22.14772],-.05);
 bell.box(0,0,0,19,19,5,'limestone');
 bell.box(0,0,5,13,13,59,'terracotta');
 bell.box(0,0,63,16,16,3,'ivory');
 bell.box(0,0,66,14.5,14.5,13,'ivory');
 for (const x of [-4,0,4]) {
  bell.box(x,7.3,68,1.8,.5,7.5,'dark');
  bell.box(x,-7.3,68,1.8,.5,7.5,'dark');
 }
 bell.box(0,0,79,17,17,2,'cream');
 bell.roof(0,0,81,15,13,'copper');
 bell.spire(0,0,94,1,2.5,'gold');
}

function parisian(at) {
 const podium = at([113.56148,22.14365],-.035);
 podium.box(0,0,0,300,167,24,'limestone');
 podium.box(52,0,24,169,155,5,'slate');
 const hotelTower = at([113.56074,22.14369],-.035);
 hotel(hotelTower,0,0,26,29,154,112,26,'ivory','slate','slate');
 for (const z of [-72,72]) {
  hotel(hotelTower,0,z,26,74,25,112,26,'cream','slate','slate');
  hotelTower.box(0,z,141,60,18,8,'slate');
 }

 const tower = at([113.56283,22.14358],-.035);
 tower.box(0,0,0,66,66,3,'sandstone');
 const levels = [[3,25],[18,21],[34,15],[59,9.5],[83,6.3],[113,4],[146,2.4],[154,2]];
 const corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
 const point = ([y,radius],[x,z])=>[x*radius,y,z*radius];
 for (let level=0; level<levels.length-1; level++) {
  const bottom = levels[level], top = levels[level+1];
  corners.forEach((corner,index)=>{
   const next = corners[(index+1)%corners.length];
   tower.beam(point(bottom,corner),point(top,corner),level<3?2.5:1.4,'iron');
   tower.beam(point(top,corner),point(top,next),1.05,'warmMetal');
   if (level>0) {
    tower.beam(point(bottom,corner),point(top,next),.85,'warmMetal');
    tower.beam(point(bottom,next),point(top,corner),.85,'warmMetal');
   }
  });
 }
 for (const side of [-1,1]) {
  const arch = Array.from({length:9},(_,i)=>{
   const rise=Math.sin(Math.PI*i/8);
   return [-24+6*i,3+27*rise,side*(24-7*rise)];
  });
  for (let i=1;i<arch.length;i++) {
   const a=arch[i-1], b=arch[i];
   tower.beam(a,b,1.55,'iron');
   tower.beam([a[2],a[1],a[0]],[b[2],b[1],b[0]],1.55,'iron');
  }
 }
 for (const [y,width] of [[34,34],[59,22],[146,6.7]]) {
  tower.box(0,0,y-.9,width,width,2.6,'iron');
  tower.box(0,0,y+1.7,width-.8,width-.8,.6,'warmMetal');
 }
 tower.spire(0,0,154,1.9,8,'iron');
}

function londoner(at) {
 const base = at([113.56549,22.14591],-.035);
 base.box(0,0,0,196,368,28,'limestone');
 base.box(0,0,28,190,356,4,'slate');
 const facade = at([113.56454,22.14603],-Math.PI/2-.035);
 facade.box(0,0,0,271,36,28,'sandstone');
 facade.box(0,1,28,271,38,3,'slate');
 for (let bay=-13; bay<=13; bay++) {
  facade.box(bay*10,18.5,4,3,1.4,22,'dark');
  facade.box(bay*10+4.5,19.4,0,2.6,2.5,32,'limestone');
  facade.spire(bay*10+4.5,19.4,32,1.5,4,'limestone');
 }
 for (const coordinates of [[113.56564,22.14754],[113.56549,22.14634],[113.56545,22.14536],[113.56559,22.14419]]) {
  hotel(at(coordinates,-.035),0,0,29,161,24,123,29,'champagne','tinted','sandstone');
 }

 const clock = at([113.56437,22.14726],-.06);
 clock.box(0,0,0,14,14,4,'limestone');
 clock.box(0,0,4,10.5,10.5,61,'sandstone');
 for (const x of [-4.3,4.3]) for (const z of [-4.3,4.3]) {
  clock.box(x,z,3,2.4,2.4,77,'ivory');
  clock.spire(x,z,80,.95,4,'warmMetal');
 }
 clock.box(0,0,64,12.8,12.8,15,'dark');
 clock.box(0,0,78,14,14,2.5,'gold');
 clock.roof(0,0,80.5,11.3,12.5,'slate');
 clock.spire(0,0,92.8,.95,3.2,'gold');
 for (let face=0; face<4; face++) {
  const angle=face*Math.PI/2, x=Math.sin(angle)*6.52, z=Math.cos(angle)*6.52;
  clock.dial([x,72,z],3.15,angle);
  clock.beam([x*1.01,72,z*1.01],[x*1.01,74.45,z*1.01],.3,'dark');
  clock.beam([x*1.01,72,z*1.01],[x*1.01+1.5*Math.cos(angle),71.2,z*1.01-1.5*Math.sin(angle)],.3,'dark');
 }
}
