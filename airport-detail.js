import * as THREE from './vendor/three.module.js';

// AACM AIP AD 2 - VMMC - 6, 52 and 53; OpenFreeMap / OSM airport footprints.
// All coordinates are WGS84. The factory returns a kilometre-scale scene group.
const terminalOutline=[
 [113.573667,22.157479],[113.573876,22.157609],[113.574096,22.157792],
 [113.574262,22.157976],[113.574429,22.158220],[113.574573,22.158513],
 [113.574648,22.158726],[113.574783,22.158692],[113.574863,22.158930],
 [113.575652,22.158702],[113.575512,22.158329],[113.575410,22.158095],
 [113.575249,22.157773],[113.574976,22.157410],[113.574740,22.157156],
 [113.574504,22.156978],[113.574278,22.156848],[113.574037,22.156719],
 [113.572524,22.155984],[113.572395,22.156207],[113.573720,22.156858],
 [113.573704,22.156898],[113.573935,22.157012],[113.573779,22.157266]
];

export const airportDetail={
 name:'澳門國際機場',english:'MACAU AIRPORT',
 coordinates:[113.574416,22.157604],
 height:24,
 aircraftStand:[113.575833333,22.158122222], // AACM stand A4
 target:[113.57545,22.15785],offset:[.34,.32,.43],
 runwayNorth:[113.586134071,22.163702507],
 runwaySouth:[113.596653113,22.135134667],
};

const northTaxiway=[
 [113.5788965,22.1613092],[113.5828612,22.1625968],
 [113.5852387,22.1633476],[113.586158,22.163638]
];
const northBranch=[
 [113.5828612,22.1625968],[113.5838025,22.1625628],
 [113.5858306,22.1621979],[113.586749,22.162033]
];
const southTaxiway=[
 [113.5767760,22.1556349],[113.5898248,22.1476115],
 [113.592713,22.145836]
];

export function makeAirportDetail(terrainPoint,mobile=false){
 const origin=terrainPoint(airportDetail.coordinates,0);
 const model=new THREE.Group();
 model.name='Macau International Airport - terminal, aircraft and airfield';
 model.position.copy(origin);
 model.scale.setScalar(.001); // geometry is authored in metres
 const material={
  runway:new THREE.MeshStandardMaterial({color:'#535b5d',roughness:1,side:THREE.DoubleSide}),
  taxiway:new THREE.MeshStandardMaterial({color:'#777d79',roughness:1,side:THREE.DoubleSide}),
  apron:new THREE.MeshStandardMaterial({color:'#909491',roughness:1}),
  white:new THREE.MeshBasicMaterial({color:'#f6f1dc',side:THREE.DoubleSide}),
  yellow:new THREE.MeshBasicMaterial({color:'#e4c46f',side:THREE.DoubleSide}),
  terminalBase:new THREE.MeshStandardMaterial({color:'#c8c3b2',roughness:.95}),
  terminalGlass:new THREE.MeshStandardMaterial({color:'#56747c',roughness:.52,metalness:.15}),
  terminalRoof:new THREE.MeshStandardMaterial({color:'#e4e3d8',roughness:.88}),
  canopy:new THREE.MeshStandardMaterial({color:'#d7c7a3',roughness:.85}),
  fuselage:new THREE.MeshStandardMaterial({color:'#eeeae0',roughness:.65}),
  wing:new THREE.MeshStandardMaterial({color:'#d7dce0',roughness:.66,side:THREE.DoubleSide}),
  airline:new THREE.MeshStandardMaterial({color:'#35646b',roughness:.65,side:THREE.DoubleSide}),
  engine:new THREE.MeshStandardMaterial({color:'#4f6268',roughness:.62}),
  tyre:new THREE.MeshStandardMaterial({color:'#303637',roughness:1}),
 };
 const boxGeometry=new THREE.BoxGeometry(1,1,1);
 function point(coordinates,lift=0){
  return terrainPoint(coordinates,0).clone().sub(origin).multiplyScalar(1000).add(new THREE.Vector3(0,lift,0));
 }
 function mesh(geometry,finish,shadows=false){
  const object=new THREE.Mesh(geometry,finish);
  object.castShadow=shadows&&!mobile;object.receiveShadow=true;model.add(object);return object;
 }
 function boxBetween(a,b,width,height,finish,lift=0){
  const span=b.clone().sub(a),object=mesh(boxGeometry,finish);
  object.position.copy(a).add(b).multiplyScalar(.5);object.position.y+=lift;
  object.rotation.y=Math.atan2(span.x,span.z);
  object.scale.set(width,height,Math.hypot(span.x,span.z));
  return object;
 }
 const whiteMarkings=[];
 function markBetween(a,b,width,height){
  const span=b.clone().sub(a),position=a.clone().add(b).multiplyScalar(.5);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(span.x,span.z));
  whiteMarkings.push(new THREE.Matrix4().compose(position,rotation,new THREE.Vector3(width,height,Math.hypot(span.x,span.z))));
 }
 function ribbon(coordinates,width,finish,lift=0,lateralOffset=0,bridge=false,levels=null){
  const points=coordinates.map(c=>point(c));
  const vertices=[],indices=[];
  for(let i=0;i<points.length;i++){
   const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
   const tangent=after.clone().sub(before).setY(0).normalize();
   const side=new THREE.Vector3(-tangent.z,0,tangent.x);
   const y=Array.isArray(levels)?levels[i]:levels!==null?levels:
    bridge?THREE.MathUtils.lerp(points[0].y,points.at(-1).y,i/(points.length-1)):p.y;
   for(const sign of [-1,1]){
    const q=p.clone().addScaledVector(side,lateralOffset+sign*width/2);
    vertices.push(q.x,y+lift,q.z);
   }
   if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return mesh(geometry,finish);
 }
 function along(start,end,t){return [THREE.MathUtils.lerp(start[0],end[0],t),THREE.MathUtils.lerp(start[1],end[1],t)];}

 // The reclaimed runway island is levelled to its published 6.2 m elevation
 // by the terrain loader. Keep the pavement and all paint on one plane.
 const north=airportDetail.runwayNorth,south=airportDetail.runwaySouth;
 const runwayPath=Array.from({length:mobile?25:49},(_,i)=>along(north,south,i/(mobile?24:48)));
 const runwayLevel=point(along(north,south,.5)).y+1.2;
 ribbon(runwayPath,45,material.runway,0,0,false,runwayLevel);
 ribbon(runwayPath,1.1,material.white,.28,-21.7,false,runwayLevel);
 ribbon(runwayPath,1.1,material.white,.28,21.7,false,runwayLevel);
 for(let i=48;i<3310;i+=60){
  const a=point(along(north,south,i/3360));a.y=runwayLevel+.33;
  const b=point(along(north,south,(i+27)/3360));b.y=runwayLevel+.33;
  markBetween(a,b,1.4,.32);
 }
 // Short bars mark the two displaced thresholds shown in the AACM AIP.
 for(const [threshold,toward] of [
  [[113.587261111,22.160641667],south],
  [[113.595530556,22.138183333],north]
 ]){
  const at=point(threshold),other=point(toward);
  at.y=other.y=runwayLevel+.35;
  const direction=other.sub(at).setY(0).normalize();
  const side=new THREE.Vector3(-direction.z,0,direction.x);
  for(const sign of [-1,1])for(let n=0;n<4;n++){
   const center=at.clone().addScaledVector(side,sign*(5+n*4.4)).addScaledVector(direction,11);
   markBetween(center.clone().addScaledVector(direction,-9),center.clone().addScaledVector(direction,9),2.2,.35);
  }
 }
 const stripes=new THREE.InstancedMesh(boxGeometry,material.white,whiteMarkings.length);
 whiteMarkings.forEach((matrix,index)=>stripes.setMatrixAt(index,matrix));
 stripes.computeBoundingSphere();model.add(stripes);

 // Extend the mapped taxiway tangents to the runway centreline. Their deck
 // heights ramp to the same pavement level for a clean visual connection.
 const northStart=point(northTaxiway[0]).y;
 const northJunction=THREE.MathUtils.lerp(northStart,runwayLevel-1.8,1/3);
 for(const route of [northTaxiway,northBranch,southTaxiway]){
  const y0=route===northBranch?northJunction:point(route[0]).y;
  const levels=route.map((_,i)=>THREE.MathUtils.lerp(y0,runwayLevel-1.8,i/(route.length-1)));
  ribbon(route,29,material.taxiway,1.8,0,true,levels);
  ribbon(route,.85,material.yellow,2.05,0,true,levels);
  for(let i=1;i<route.length;i++){
   const a=point(route[i-1]),b=point(route[i]);
   a.y=levels[i-1];b.y=levels[i];
   boxBetween(a,b,30,2.6,material.terminalBase,.5);
  }
 }

 // Passenger terminal: its curved OSM roof outline is extruded at the
 // mapped 24 m height, with a glazed concourse and pale roof overhang.
 function terminalShape(scale=1){
  const shape=new THREE.Shape();
  terminalOutline.forEach((coordinates,i)=>{
   const p=point(coordinates);
   if(i)shape.lineTo(p.x*scale,-p.z*scale);
   else shape.moveTo(p.x*scale,-p.z*scale);
  });
  shape.closePath();return shape;
 }
 function terminalLevel(height,base,finish,scale=1){
  const geometry=new THREE.ExtrudeGeometry(terminalShape(scale),{depth:height,steps:1,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);
  const object=mesh(geometry,finish,true);object.position.y=base;return object;
 }
 terminalLevel(5,0,material.terminalBase);
 terminalLevel(15,5,material.terminalGlass);
 terminalLevel(4,20,material.terminalRoof,1.025);
 // Fine mullions and a projecting eave make the apron-facing arc legible.
 const mullionMatrices=[];
 for(let edge=9;edge<18;edge++){
  const a=point(terminalOutline[edge]),b=point(terminalOutline[edge+1]);
  const length=a.distanceTo(b),count=Math.max(1,Math.round(length/(mobile?25:14)));
  for(let i=0;i<=count;i++){
   const p=a.clone().lerp(b,i/count);
   mullionMatrices.push(new THREE.Matrix4().compose(
    new THREE.Vector3(p.x,12.5,p.z),new THREE.Quaternion(),new THREE.Vector3(.8,15,.8)));
  }
  a.y=b.y=20.8;boxBetween(a,b,5,1.4,material.canopy);
 }
 const mullions=new THREE.InstancedMesh(boxGeometry,material.terminalRoof,mullionMatrices.length);
 mullionMatrices.forEach((matrix,index)=>mullions.setMatrixAt(index,matrix));
 mullions.computeBoundingSphere();model.add(mullions);
 // One attached passenger boarding bridge, aligned with stand A4.
 const gate=point([113.575410,22.158095]);
 const stand=point(airportDetail.aircraftStand);
 const standPad=mesh(boxGeometry,material.apron);
 standPad.position.copy(stand);standPad.position.y+=.6;
 standPad.scale.set(68,.8,62);
 const jetEnd=stand.clone().lerp(gate,.31);
 gate.y=jetEnd.y=7;
 boxBetween(gate,jetEnd,3.4,3,material.terminalRoof);
 gate.y=jetEnd.y=5.5;
 boxBetween(gate,jetEnd,2.7,2.1,material.terminalGlass);

 // A single generic narrow-body aircraft is parked at the published A4 stand.
 const aircraft=new THREE.Group();aircraft.name='Parked passenger aircraft at stand A4';
 aircraft.position.copy(stand);aircraft.position.y+=.7;
 aircraft.rotation.y=-Math.PI/2; // nose toward the terminal, west of the apron
 model.add(aircraft);
 function planePart(geometry,finish,x,y,z,cast=true){
  const part=new THREE.Mesh(geometry,finish);part.position.set(x,y,z);
  part.castShadow=cast&&!mobile;part.receiveShadow=true;aircraft.add(part);return part;
 }
 const fuselage=planePart(new THREE.CylinderGeometry(1.8,1.8,25,14),material.fuselage,0,4.3,0);
 fuselage.rotation.x=Math.PI/2;
 const nose=planePart(new THREE.ConeGeometry(1.8,7,14),material.fuselage,0,4.3,16);
 nose.rotation.x=Math.PI/2;
 const tailBody=planePart(new THREE.CylinderGeometry(1.8,.8,7,14),material.fuselage,0,4.3,-16);
 tailBody.rotation.x=Math.PI/2;
 function flatPolygon(vertices,finish){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
  geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const part=planePart(geometry,finish,0,0,0);return part;
 }
 for(const side of [-1,1]){
  flatPolygon([
   [side*1.5,4.3,3.2],[side*17.8,4.3,-5.3],
   [side*18.8,4.3,-8.3],[side*1.6,4.3,-4.7]
  ],material.wing);
  flatPolygon([
   [side*1.1,5.1,-12.5],[side*7.3,5.1,-16.4],
   [side*7.6,5.1,-18.5],[side*1.2,5.1,-17.1]
  ],material.wing);
  const engine=planePart(new THREE.CylinderGeometry(1.05,.94,4.4,10),material.engine,side*6.4,2.9,-3.1);
  engine.rotation.x=Math.PI/2;
  const wheel=planePart(new THREE.CylinderGeometry(.85,.85,.45,10),material.tyre,side*3.5,1.1,-3.1,false);
  wheel.rotation.z=Math.PI/2;
 }
 flatPolygon([[0,4.8,-13],[0,12.5,-18],[0,12.5,-19.2],[0,4.8,-20]],material.airline);
 const frontWheel=planePart(new THREE.CylinderGeometry(.65,.65,.42,10),material.tyre,0,1.1,10,false);
 frontWheel.rotation.z=Math.PI/2;
 for(const side of [-1,1])for(let i=0;i<6;i++){
  const window=planePart(new THREE.BoxGeometry(.10,.42,.64),material.airline,side*1.79,5.1,8-i*3.2,false);
  window.rotation.y=side*-.05;
 }
 return model;
}
