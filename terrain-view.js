import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { cotaiLandmarks, makeCotaiLandmark } from './cotai-landmarks.js';

// Local tangent-plane coordinates in kilometres, referenced to Macau.
// Elevations originate in the supplied DEM; material detail never changes geometry.
const $=id=>document.getElementById(id);
const stage=document.querySelector('.stage');
const view=$('terrain-view');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width: 800px)').matches;
const exaggeration=1.65, landDatum=.028;
const project=(lon,lat)=>[(lon-113.56)*111.32*Math.cos(22.16*Math.PI/180),(22.16-lat)*111.32];
// The models and labels share the mapped roof coordinates. Distances are in kilometres.
const cityModelSites={tower:[113.5368,22.17982],lisboa:[113.54336,22.19099]};
const scene=new THREE.Scene();
scene.background=new THREE.Color('#263a40');
scene.fog=new THREE.FogExp2('#263a40',.017);
const camera=new THREE.PerspectiveCamera(38,1,.04,100);
let renderer,controls,model,rawPositions,animation=0,lastTime=0,rendering=false;
let active=true,auto=false,flat=false,initialized=false,contextLost=false;
let cameraTween=null,activeIndex=-1,area=0,landmarkData=[],onSelect=()=>{},groups=[],regions=[],featureLabels=[];
let surfaceMesh,activeGroundMarker,initialView=true,peninsulaBuildingsRequested=false;
const coloaneTarget=new THREE.Vector3(.65,.08,3.62);
const macauTarget=new THREE.Vector3(.1,.04,-.34);
let currentTarget=coloaneTarget.clone(), currentOffset=new THREE.Vector3(2.25,4.65,5.45);
let resolveReady;
const ready=new Promise(resolve=>{resolveReady=resolve;});
const api={
 get active(){return active;},get initialized(){return initialized;},ready,
 terrainPoint(lonLat,lift=.08){if(!initialized)return null;const [x,z]=project(...lonLat);return new THREE.Vector3(x,heightAt(x,z)+lift,z);},
 addFeatureLabel(element,lonLat,lift=.22){
  if(!element||!Array.isArray(lonLat)||lonLat.length<2)return;
  const add=()=>{if(!initialized||featureLabels.some(item=>item.element===element))return;
   featureLabels.push({element,point:api.terrainPoint(lonLat,lift)});$('terrain-labels').append(element);requestRender();};
  if(initialized)add();else ready.then(ok=>{if(ok)add();});
 },
 addOverlay(object){scene.add(object);requestRender();},
 removeOverlay(object){scene.remove(object);requestRender();},
 invalidate:requestRender,
 frameGeoPath(points){
  if(!initialized||!Array.isArray(points)||!points.length)return;
  stage.classList.remove('cotai-view');
  const sites=points.map(p=>api.terrainPoint(p,0));
  const center=sites.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/sites.length);
  const radius=Math.max(...sites.map(p=>Math.hypot(p.x-center.x,p.z-center.z)));
  const distance=Math.max(3.15,Math.min(18,radius*4.5));
  const offset=new THREE.Vector3(1.35,2.45,3.55).normalize().multiplyScalar(distance);
  const target=center.clone();
  if(overlappingPanel()){
   if(view.clientWidth<=800){target.z+=Math.min(1.15,.52+radius*.28);target.y-=.24;}
   else target.addScaledVector(new THREE.Vector3(offset.z,0,-offset.x).normalize(),Math.min(1.5,.65+radius*.4));
  }
  stopAuto();flat=false;initialView=false;controls.enableRotate=true;
  fly(target,target.clone().add(offset),reduced?0:1450);updateButtons();
 },
 toggle:()=>setActive(!active),setActive,
 zoom(factor){
  if(!controls)return;stopAuto();initialView=false;
  const offset=camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
  fly(controls.target.clone(),controls.target.clone().add(offset),reduced?0:450);
 },
 reset(){resetColoane();},
 overview(){ensurePeninsulaBuildings();resetView(macauTarget,new THREE.Vector3(6.8,9.6,11.5),true);},
 cotaiOverview(){
  if(!initialized){ready.then(ok=>{if(ok)api.cotaiOverview();});return;}
  resetView(api.terrainPoint([113.55895,22.14730],.05),new THREE.Vector3(.30,.93,1.55));
  stage.classList.add('cotai-view');
  updateButtons();
 },
 rotate(){if(!controls)return;cameraTween=null;flat=false;auto=!auto;controls.enableRotate=true;controls.autoRotate=auto;updateButtons();requestRender();},
 flat(){
  if(!controls)return;stopAuto();flat=!flat;initialView=false;
  const target=controls.target.clone(),distance=camera.position.distanceTo(target);
  const offset=flat?new THREE.Vector3(0,Math.max(distance,6),.01):currentOffset.clone().normalize().multiplyScalar(distance);
  controls.enableRotate=!flat;fly(target,target.clone().add(offset),reduced?0:1000);updateButtons();
 },
 focusPoint(lonLat,options={}){
  if(!Array.isArray(lonLat)||lonLat.length<2||!lonLat.every(Number.isFinite))return;
  if(!initialized){ready.then(ok=>{if(ok)api.focusPoint(lonLat,options);});return;}
  if(lonLat[1]>22.17)ensurePeninsulaBuildings();
  stage.classList.remove('cotai-view');
  stopAuto();flat=false;initialView=false;controls.enableRotate=true;
  activeIndex=Number.isInteger(options.index)?options.index:-1;
  const [x,z]=project(...lonLat),height=heightAt(x,z);
  const point=new THREE.Vector3(x,height,z);
  const target=point.clone();
  const width=view.clientWidth;
  const baseOffset=options.overview?new THREE.Vector3(2.35,4.15,6.15):new THREE.Vector3(1.45,2.55,3.6);
  let offset=baseOffset.multiplyScalar((width<650?(options.overview?1.16:1.25):1)*(options.timeline ? .72 : 1));
  // Keep the selected landmark visible beside the desktop archive or above its mobile sheet.
  const card=overlappingPanel();
  if(card){
   const screenRight=new THREE.Vector3(offset.z,0,-offset.x).normalize();
   const bounds=view.getBoundingClientRect();
   const sidePanel=card.left-bounds.left>width*.4&&card.width<width*.7;
   if(sidePanel)target.addScaledVector(screenRight,1.05);
   else {target.z+=.6;target.y-=.28;}
  }
  currentTarget.copy(point);currentOffset.copy(offset);
  fly(target,target.clone().add(offset),reduced?0:(options.timeline?1800:options.ios?1650:1500),options.timeline||options.ios?'ios':'smooth');
  stage.classList.toggle('timeline-zooming',Boolean(options.timeline&&!reduced));
  if(activeGroundMarker){activeGroundMarker.visible=true;activeGroundMarker.position.set(x,height+.012,z);activeGroundMarker.scale.setScalar(options.timeline&&!reduced?1.5:1);}
  updateMarkers();updateButtons();
  document.dispatchEvent(new CustomEvent('macau-terrain-focus',{detail:{...options,coordinates:lonLat}}));
 },
 setLandmarks(events,callback){
  if(events!==landmarkData){activeIndex=-1;if(activeGroundMarker)activeGroundMarker.visible=false;}
  landmarkData=Array.isArray(events)?events:[];onSelect=typeof callback==='function'?callback:()=>{};
  if(initialized)buildLandmarks();
 },
 clearSelection(){activeIndex=-1;if(activeGroundMarker)activeGroundMarker.visible=false;updateMarkers();requestRender();},
 resize
};
window.macauTerrain=api;

function overlappingPanel(){
 const panel=$('info');
 if(panel.hidden)return null;
 const card=panel.getBoundingClientRect(),map=view.getBoundingClientRect();
 return card.left<map.right&&card.right>map.left&&card.top<map.bottom&&card.bottom>map.top?card:null;
}

function progress(value,label){
 if($('terrain-loading'))$('terrain-loading').textContent=label;
 document.dispatchEvent(new CustomEvent('macau-terrain-progress',{detail:{progress:value,label}}));
}
function updateButtons(){
 if($('td'))$('td').textContent=active?(flat?'立體視角':'俯視'):'平面';
 if($('rot')){$('rot').textContent=active?(auto?'暫停旋轉':'360° 旋轉'):'旋轉';$('rot').setAttribute('aria-pressed',String(active&&auto));}
 $('cotai-overview')?.setAttribute('aria-pressed',String(active&&stage.classList.contains('cotai-view')));
}
function setActive(value){
 const changed=active!==Boolean(value);active=Boolean(value);stage.classList.toggle('terrain-mode',active);
 view.setAttribute('aria-hidden',String(!active));
 if($('live-map'))$('live-map').inert=active;
 if($('view-switch')){$('view-switch').textContent=active?'2D 歷史地圖':'3D 地形視圖';$('view-switch').setAttribute('aria-pressed',String(active));}
 updateButtons();
 if(active){resize();requestRender();}else{cancelAnimationFrame(animation);animation=0;lastTime=0;stage.classList.remove('timeline-zooming');if(activeGroundMarker)activeGroundMarker.scale.setScalar(1);}
 if(changed)document.dispatchEvent(new CustomEvent('macau-view-change',{detail:{terrain:active}}));
}
function stopAuto(){auto=false;if(controls)controls.autoRotate=false;updateButtons();}
function fitFactor(){return Math.max(1,Math.min(2.6,1.3/Math.max(.5,view.clientWidth/view.clientHeight)));}
function presentationZoom(){const aspect=view.clientWidth/view.clientHeight;return aspect>2.4?Math.max(.8,1-(aspect-2.4)*.22):1;}
function resetColoane(){resetView(coloaneTarget,new THREE.Vector3(2.25,4.65,5.45));}
function resetView(target,offset,overview=false){
 if(!controls)return;stopAuto();flat=false;initialView=true;api.clearSelection();
 stage.classList.remove('timeline-zooming','cotai-view');
 currentTarget.copy(target);currentOffset.copy(offset);
 controls.enableRotate=true;
 // A wide presentation screen has room to show Coloane closer without
 // cropping the full-Macau overview used by the other navigation button.
 fly(target.clone(),target.clone().add(offset.clone().multiplyScalar(fitFactor()*(overview?1:presentationZoom()))),reduced?0:1250);
 stage.classList.toggle('macau-overview',overview);updateButtons();
}
function fly(target,position,duration=1200,easing='smooth'){
 if(!controls)return;
 // Let residual input damping settle before beginning a deterministic camera move.
 const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
 if(!duration){controls.target.copy(target);camera.position.copy(position);controls.update();cameraTween=null;requestRender();return;}
 cameraTween={start:performance.now(),duration,easing,from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),toTarget:target};requestRender();
}
function makeGeometry(positions,indices){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 if(indices)g.setIndex(indices);g.computeVertexNormals();return g;
}
function heightAt(x,z){
 let distance=Infinity,elevation=0;
 for(let i=0;i<rawPositions.length;i+=3){const d=(rawPositions[i]-x)**2+(rawPositions[i+2]-z)**2;if(d<distance){distance=d;elevation=rawPositions[i+1];}}
 return elevation*exaggeration+landDatum;
}
function makeRockCoast(rings){
 const positions=[],indices=[],uv=[];
 for(const ring of rings){
  let along=0;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],offset=positions.length/3;
   const length=Math.hypot(a[0]-b[0],a[2]-b[2]);
   const topA=a[1]*exaggeration+landDatum-.001,topB=b[1]*exaggeration+landDatum-.001;
   positions.push(a[0],topA,a[2],b[0],topB,b[2],a[0],-.055,a[2],b[0],-.055,b[2]);
   uv.push(along*15,1,(along+length)*15,1,along*15,0,(along+length)*15,0);along+=length;
   indices.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3);
  }
 }
 const geo=makeGeometry(positions,indices);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 const stone=makeGrainTexture('#8a8c76','#4c5751',128);
 stone.wrapS=THREE.RepeatWrapping;stone.wrapT=THREE.RepeatWrapping;
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:stone,color:'#8c907c',roughness:1,metalness:0,side:THREE.DoubleSide}));
 mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);
}
function makeGrainTexture(a,b,size=256){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),one=new THREE.Color(a),two=new THREE.Color(b);
 let seed=8191;
 for(let i=0;i<image.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const f=(seed/4294967296)*.42;const c=one.clone().lerp(two,f);image.data[i]=c.r*255;image.data[i+1]=c.g*255;image.data[i+2]=c.b*255;image.data[i+3]=255;}
 ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function makeLocator(){
 const group=new THREE.Group();
 const circle=new THREE.Mesh(new THREE.RingGeometry(.095,.108,48),new THREE.MeshBasicMaterial({color:'#f0d09a',transparent:true,opacity:.95,depthTest:false,side:THREE.DoubleSide}));
 circle.rotation.x=-Math.PI/2;group.add(circle);
 const inner=new THREE.Mesh(new THREE.RingGeometry(.03,.038,24),new THREE.MeshBasicMaterial({color:'#f7e4b7',depthTest:false,side:THREE.DoubleSide}));inner.rotation.x=-Math.PI/2;group.add(inner);
 const stem=new THREE.Line(makeGeometry([0,0,0,0,.25,0]),new THREE.LineBasicMaterial({color:'#f0d4a5',transparent:true,opacity:.94,depthTest:false}));group.add(stem);
 const glow=new THREE.Mesh(new THREE.CylinderGeometry(.018,.055,.24,18,1,true),new THREE.MeshBasicMaterial({color:'#ead2a5',transparent:true,opacity:.22,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));glow.position.y=.12;glow.renderOrder=9;group.add(glow);
 group.renderOrder=8;group.visible=false;model.add(group);return group;
}
function buildLandmarks(){
 for(const g of groups)g.element.remove();groups=[];
 const locations=new Map();
 landmarkData.forEach((event,index)=>{
  if(!Array.isArray(event[2])||!event[2].every(Number.isFinite))return;
  const key=event[2].map(v=>v.toFixed(5)).join(',');
  if(!locations.has(key))locations.set(key,{coords:event[2],records:[]});
  locations.get(key).records.push({event,index});
 });
 for(const location of locations.values()){
  const [x,z]=project(...location.coords),height=heightAt(x,z);
  const element=document.createElement('button');element.type='button';element.className='terrain-label terrain-marker';element.setAttribute('aria-pressed','false');
  const number=document.createElement('span');number.className='marker-index';
  const body=document.createElement('span'),title=document.createElement('strong'),date=document.createElement('small');body.append(title,date);element.append(number,body);
  const g={...location,element,title,date,number,point:new THREE.Vector3(x,height+.20,z),displayed:0};
  element.addEventListener('click',()=>{
   const previous=g.records.findIndex(r=>r.index===activeIndex);
   const next=previous<0?0:(previous+1)%g.records.length;
   g.displayed=next;onSelect(g.records[next].index);
  });
  $('terrain-labels').append(element);groups.push(g);
 }
 updateMarkers();requestRender();
}
function updateMarkers(){
 for(const g of groups){
  const selected=g.records.findIndex(r=>r.index===activeIndex);
  if(selected>=0)g.displayed=selected;
  const record=g.records[g.displayed];
  g.title.textContent=record.event[1];
  g.date.textContent=record.event[0]+(g.records.length>1?` · 同址 ${g.displayed+1}/${g.records.length}`:'');
  g.number.textContent=String(record.index+1).padStart(2,'0');
  g.element.setAttribute('aria-label',`${record.event[1]}，${record.event[0]}${g.records.length>1?`，同址有 ${g.records.length} 則史料，再點可切換`:''}`);
  g.element.setAttribute('aria-pressed',String(selected>=0));g.element.classList.toggle('is-active',selected>=0);
 }
}
function addRegion(name,sub,lon,lat,areaIndex){
 const [x,z]=project(lon,lat),element=document.createElement(areaIndex===undefined?'span':'button');
 element.className='terrain-label terrain-region-label';
 const strong=document.createElement('strong');strong.textContent=name;
 const small=document.createElement('small');small.textContent=sub;element.append(strong,small);
 if(areaIndex!==undefined){element.type='button';element.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('macau-area-request',{detail:{area:areaIndex}})));}
 $('terrain-labels').append(element);regions.push({element,point:new THREE.Vector3(x,heightAt(x,z)+.23,z),region:true});
}
function addCityLandmark(name,sub,coordinates,{height,target=coordinates,offset=[.63,.37,.88],cotai=false}={}){
 const element=document.createElement(height?'button':'span');element.className='terrain-label terrain-city-landmark';
 const strong=document.createElement('strong');strong.textContent=name;
 const small=document.createElement('small');small.textContent=sub;element.append(strong,small);
 if(height){
  element.type='button';
  element.setAttribute('aria-label',`近看${name}`);
  element.title=`近看${name}`;
  element.addEventListener('click',()=>focusCityLandmark(target,height,offset,cotai));
 }
 const lift=height ? height+(cotai ? .026 : .07) : .22;
 api.addFeatureLabel(element,coordinates,lift);
}
function focusCityLandmark(coordinates,height,offset,cotai){
 window.historyExhibit?.stopWar();
 window.exhibitionUI?.closePanel();
 api.clearSelection();
 stopAuto();flat=false;initialView=false;controls.enableRotate=true;
 stage.classList.remove('macau-overview','timeline-zooming');
 stage.classList.toggle('cotai-view',cotai);
 const target=api.terrainPoint(coordinates,height*.48);
 const distance=new THREE.Vector3(...offset).multiplyScalar(view.clientWidth<650?1.35:1);
 fly(target,target.clone().add(distance),reduced?0:1250,'ios');
 updateButtons();
}
function addCotaiLandmarks(){
 const navigation=$('cotai-landmarks');
 if(!navigation)return;
 for(const landmark of cotaiLandmarks){
  const {name,english,coordinates,target,offset}=landmark;
  const height=landmark.height/1000;
  scene.add(makeCotaiLandmark(landmark,api.terrainPoint,!mobile));
  addCityLandmark(name,english,coordinates,{height,target,offset,cotai:true});
  const button=document.createElement('button');
  button.type='button';
  button.textContent=name;
  button.addEventListener('click',()=>focusCityLandmark(target,height,offset,true));
  navigation.append(button);
 }
}
function addCitySilhouettes(){
 const stone=new THREE.MeshStandardMaterial({color:'#d7cbb2',roughness:.87,metalness:.04});
 const towerGlass=new THREE.MeshStandardMaterial({color:'#547a7b',roughness:.38,metalness:.35});
 const brass=new THREE.MeshStandardMaterial({color:'#dec287',roughness:.54,metalness:.28,side:THREE.DoubleSide});
 const gold=new THREE.MeshStandardMaterial({color:'#b99963',roughness:.46,metalness:.3,side:THREE.DoubleSide});
 const goldGlass=new THREE.MeshStandardMaterial({color:'#927c5d',roughness:.35,metalness:.4});
 function add(group,geometry,material,y=0){
  const object=new THREE.Mesh(geometry,material);object.position.y=y;object.castShadow=!mobile;object.receiveShadow=true;group.add(object);return object;
 }
 function collar(group,radius,y,material,tube=.002){
  const ring=add(group,new THREE.TorusGeometry(radius,tube,6,28),material,y);ring.rotation.x=Math.PI/2;return ring;
 }
 function atSite(lonLat){
  const [x,z]=project(...lonLat),group=new THREE.Group();
  group.position.set(x,heightAt(x,z)+.002,z);scene.add(group);return group;
 }
 // Macau Tower: tapered concrete stem, three-level glazed observation pod and
 // the long aerial above it. The top is 338 m above the mapped ground.
 const tower=atSite(cityModelSites.tower);
 add(tower,new THREE.CylinderGeometry(.027,.031,.012,24),stone,.006);
 add(tower,new THREE.LatheGeometry([
  [0,.01],[.016,.01],[.013,.035],[.009,.105],[.007,.185],[.007,.215]
 ].map(([r,y])=>new THREE.Vector2(r,y)),24),stone);
 add(tower,new THREE.LatheGeometry([
  [.007,.210],[.014,.214],[.024,.219],[.028,.224],
  [.028,.230],[.024,.236],[.013,.241],[.006,.244]
 ].map(([r,y])=>new THREE.Vector2(r,y)),32),towerGlass);
 for(const [r,y] of [[.024,.219],[.028,.230],[.021,.238]])collar(tower,r,y,brass,.0015);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,points=[[.022,.218],[.028,.225],[.027,.231],[.021,.238]].map(([r,y])=>new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));
  tower.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#e6d6af'})));
 }
 add(tower,new THREE.CylinderGeometry(.0022,.005,.081,12),stone,.2845);
 add(tower,new THREE.CylinderGeometry(.0007,.0022,.013,10),brass,.3315);
 collar(tower,.0037,.294,brass,.0008);
 tower.name='Macau Tower, interpretive 338 m silhouette';

 // Grand Lisboa: the oval casino podium supports a narrow stem that opens
 // into overlapping, gold lotus plumes. Its crown is 260 m above ground.
 const lisboa=atSite(cityModelSites.lisboa);
 add(lisboa,new THREE.CylinderGeometry(.062,.066,.012,32),stone,.006);
 const podium=add(lisboa,new THREE.SphereGeometry(.057,28,14),goldGlass,.044);
 podium.scale.set(1.18,.61,.86);
 for(const [r,y] of [[.058,.029],[.066,.044],[.059,.059]]){
  const ring=collar(lisboa,r,y,brass,.0015);ring.scale.y=.86;
 }
 const core=add(lisboa,new THREE.LatheGeometry([
  [0,.063],[.019,.063],[.021,.095],[.026,.125],[.035,.16],
  [.044,.194],[.05,.221],[.041,.239],[.016,.254],[0,.260]
 ].map(([r,y])=>new THREE.Vector2(r,y)),32),goldGlass);
 core.scale.z=.74;
 const levels=[
  [.066,.023,.006],[.105,.029,.009],[.145,.044,.011],
  [.185,.064,.013],[.215,.077,.012],[.238,.069,.007],[.254,.016,.001]
 ];
 for(let petal=0;petal<10;petal++){
  const angle=petal*Math.PI/5,vertices=[],indices=[],rib=[];
  for(let i=0;i<levels.length;i++){
   const [y,r,width]=levels[i],twist=angle+(y-.066)*.6;
   const cx=Math.cos(twist)*r,cz=Math.sin(twist)*r*.76;
   const tx=-Math.sin(twist)*width,tz=Math.cos(twist)*width*.76;
   vertices.push(cx-tx,y,cz-tz,cx+tx,y,cz+tz);
   rib.push(new THREE.Vector3(cx,y,cz));
   if(i<levels.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  add(lisboa,geometry,petal%2?gold:brass);
  add(lisboa,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rib),14,.0015,4,false),brass);
 }
 add(lisboa,new THREE.CylinderGeometry(.001,.004,.012,10),brass,.254);
 lisboa.name='Grand Lisboa, interpretive 260 m lotus silhouette';
}
function positionLabels(){
 const width=view.clientWidth,height=view.clientHeight,viewRect=view.getBoundingClientRect();
 const card=$('info'),cardRect=card&&!card.hidden?card.getBoundingClientRect():null;
 const toolbar=stage.querySelector('.tools')?.getBoundingClientRect();
 const minY=toolbar?Math.max(95,toolbar.bottom-viewRect.top+28):(width<800&&height>width*.8?180:110);
 const placed=[];
 const entries=[...groups.filter(g=>g.element.classList.contains('is-active')),...featureLabels,...groups.filter(g=>!g.element.classList.contains('is-active')),...regions];
 for(const item of entries){
  const p=item.point.clone().project(camera);let x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
  const selected=item.element.classList.contains('is-active');
  const inFocusRegion=item.region&&camera.position.distanceTo(controls.target)<10;
  const panelOverlap=cardRect&&x>cardRect.left-viewRect.left-75&&x<cardRect.right-viewRect.left+75&&y>cardRect.top-viewRect.top-20&&y<cardRect.bottom-viewRect.top+45;
  const overlap=placed.some(([px,py])=>Math.abs(px-x)<(mobile?116:140)&&Math.abs(py-y)<59);
  const hidden=p.z>1||p.z<-1||x<38||x>width-38||y<minY||y>height-40||panelOverlap||(!selected&&overlap)||inFocusRegion;
  item.element.hidden=hidden;
  if(!hidden){placed.push([x,y]);item.element.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;}
 }
}
function requestRender(){if(active&&renderer&&!contextLost&&!document.hidden&&!animation&&!rendering)animation=requestAnimationFrame(render);}
function render(now){
 animation=0;if(!active||!renderer||contextLost||document.hidden)return;rendering=true;
 const delta=lastTime?Math.min((now-lastTime)/1000,.05):1/60;lastTime=now;
 let tweening=false;
 if(cameraTween){
  const t=THREE.MathUtils.clamp((now-cameraTween.start)/cameraTween.duration,0,1),smooth=cameraTween.easing==='ios'?(1-(1+8*t)*Math.exp(-8*t))/(1-9*Math.exp(-8)):t*t*t*(t*(t*6-15)+10);
  camera.position.lerpVectors(cameraTween.from,cameraTween.to,smooth);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,smooth);
  if(cameraTween.easing==='ios'&&activeGroundMarker?.visible)activeGroundMarker.scale.setScalar(1+.5*(1-smooth));
  if(t>=1){cameraTween=null;stage.classList.remove('timeline-zooming');document.dispatchEvent(new CustomEvent('macau-terrain-camera-settled',{detail:{target:[controls.target.x,controls.target.y,controls.target.z]}}));}else tweening=true;
 }
 const moved=controls.update(delta);
 if(controls.target.z< -1.2)ensurePeninsulaBuildings();
 renderer.render(scene,camera);positionLabels();
 const bearing=THREE.MathUtils.radToDeg(Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z));
 if($('north-arrow'))$('north-arrow').style.transform=`rotate(${-bearing}deg)`;
 if($('bearing'))$('bearing').textContent=`${((Math.round(bearing)%360)+360)%360}°`;
 rendering=false;if(moved||tweening||auto)requestRender();
}
function resize(){
 if(!renderer||!active||!view.clientWidth||!view.clientHeight)return;
 const previousAspect=camera.aspect;camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();renderer.setSize(view.clientWidth,view.clientHeight);
 if(initialized&&initialView&&Math.abs(previousAspect-camera.aspect)>.1){
  const zoom=stage.classList.contains('macau-overview') ? 1 : presentationZoom();
  const destination=currentTarget.clone().addScaledVector(currentOffset,fitFactor()*zoom);
  if(cameraTween)cameraTween.to.copy(destination);
  else {controls.target.copy(currentTarget);camera.position.copy(destination);controls.update();}
 }
 requestRender();
}
async function loadModel(){
 progress(.16,'讀取澳門海岸與高程資料');
 const response=await fetch('./terrain/macau.json');if(!response.ok)throw Error('地形資料未能載入');const data=await response.json();rawPositions=data.positions;
 progress(.45,'載入山林、道路與近岸材質');
 const loader=new THREE.TextureLoader();
 const [texture,waterTexture]=await Promise.all([loader.loadAsync('./terrain/surface.png'),data.waterTexture?loader.loadAsync('./terrain/'+data.waterTexture).catch(()=>null):Promise.resolve(null)]);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const positions=rawPositions.map((v,i)=>i%3===1?v*exaggeration+landDatum:v),uv=[],colors=[];
 const [minx,minz,maxx,maxz]=data.textureBounds;
 const low=new THREE.Color('#f5efdd'),high=new THREE.Color('#aab99a');
 for(let i=0;i<positions.length;i+=3){
  uv.push((positions[i]-minx)/(maxx-minx),1-(positions[i+2]-minz)/(maxz-minz));
  const h=rawPositions[i+1],grain=Math.sin(positions[i]*57+positions[i+2]*19)*.018;
  const color=low.clone().lerp(high,Math.min(.35,h*1.8+Math.max(0,grain)));colors.push(color.r,color.g,color.b);
 }
 const geometry=makeGeometry(positions,data.indices);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 model=new THREE.Group();scene.add(model);
 surfaceMesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,vertexColors:true,roughness:1,metalness:0}));
 surfaceMesh.castShadow=true;surfaceMesh.receiveShadow=true;model.add(surfaceMesh);makeRockCoast(data.rings);
 if(waterTexture){
  waterTexture.colorSpace=THREE.SRGBColorSpace;
  const shore=new THREE.Mesh(new THREE.PlaneGeometry(maxx-minx,maxz-minz),new THREE.MeshStandardMaterial({map:waterTexture,transparent:true,roughness:1,metalness:0,depthWrite:false}));
  shore.rotation.x=-Math.PI/2;shore.position.set((maxx+minx)/2,.008,(maxz+minz)/2);shore.renderOrder=1;scene.add(shore);
 }
 for(const points of data.bridges||[]){
  const geometry=makeGeometry(points.flatMap(([x,y,z])=>[x,.055,z]));
  model.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#bdbba3',transparent:true,opacity:.6})));
 }
 activeGroundMarker=makeLocator();
 addRegion('澳門半島','MACAU PENINSULA',113.544,22.194,1);addRegion('氹仔','TAIPA',113.558,22.158);addRegion('路氹','COTAI',113.566,22.145);addRegion('路環','COLOANE',113.577,22.123,0);
 progress(.82,'整理歷史地標與閱讀視角');
 buildLandmarks();
}
async function loadVillageBuildings(){
 try{
  const response=await fetch('./terrain/street-details.json');if(!response.ok)return;
  const data=await response.json();if(!Array.isArray(data.positions)||data.positions.length%9)return;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#d1c9ad',roughness:1,metalness:0,side:THREE.DoubleSide}));
  mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);requestRender();
 }catch(error){console.warn('Village building detail unavailable:',error);}
}
async function loadPeninsulaBuildings(){
 try{
  const response=await fetch('./terrain/peninsula-buildings.json');if(!response.ok)return;
  const data=await response.json();if(!Array.isArray(data.positions)||data.positions.length%3||!Array.isArray(data.indices)||data.indices.length%3)return;
  // Remove the generic tall prisms at these two footprints so they do not
  // obscure the recognisable landmark forms drawn above.
  const replacements=[
   {point:project(...cityModelSites.tower),radius:.038,minTop:.18},
   {point:project(...cityModelSites.lisboa),radius:.082,minTop:.09}
  ];
  const kept=[];
  for(let i=0;i<data.indices.length;i+=3){
   const a=data.indices[i]*3,b=data.indices[i+1]*3,c=data.indices[i+2]*3;
   const x=(data.positions[a]+data.positions[b]+data.positions[c])/3;
   const z=(data.positions[a+2]+data.positions[b+2]+data.positions[c+2])/3;
   const top=Math.max(data.positions[a+1],data.positions[b+1],data.positions[c+1]);
   if(replacements.some(({point,radius,minTop})=>top>minTop&&(x-point[0])**2+(z-point[1])**2<radius**2))continue;
   kept.push(data.indices[i],data.indices[i+1],data.indices[i+2]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setIndex(kept);
  const hasColours=Array.isArray(data.colors)&&data.colors.length===data.positions.length;
  if(hasColours)geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:hasColours?'#ffffff':'#cfc6ae',vertexColors:hasColours,roughness:.96,metalness:0,side:THREE.DoubleSide}));
  mesh.castShadow=!mobile;mesh.receiveShadow=true;scene.add(mesh);requestRender();
 }catch(error){console.warn('Peninsula building detail unavailable:',error);}
}
function ensurePeninsulaBuildings(){
 if(peninsulaBuildingsRequested||!initialized)return;
 peninsulaBuildingsRequested=true;loadPeninsulaBuildings();
}
async function init(){
 try{
  progress(.05,'準備路環歷史地景');
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:mobile?'low-power':'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','澳門三維地形。拖曳或單指旋轉、滾輪或雙指縮放、雙指平移；聚焦後可用方向鍵調整視角。');renderer.domElement.tabIndex=0;
  view.prepend(renderer.domElement);
  camera.position.copy(coloaneTarget).add(currentOffset.clone().multiplyScalar(fitFactor()*1.12));
  controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(coloaneTarget);controls.enableDamping=!reduced;controls.dampingFactor=.075;
  controls.minDistance=mobile?.58:.44;controls.maxDistance=40;controls.minPolarAngle=.025;controls.maxPolarAngle=Math.PI*.485;
  controls.rotateSpeed=.56;controls.zoomSpeed=.85;controls.panSpeed=.6;controls.screenSpacePanning=false;controls.autoRotateSpeed=.36;
  controls.addEventListener('change',requestRender);
  controls.addEventListener('start',()=>{cameraTween=null;initialView=false;stage.classList.remove('timeline-zooming');if(activeGroundMarker)activeGroundMarker.scale.setScalar(1);stopAuto();requestRender();});
  controls.addEventListener('end',requestRender);
  renderer.domElement.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();
   if(event.key==='Home'){api.reset();return;}if(event.key==='+'||event.key==='-'){api.zoom(event.key==='+'?.85:1.15);return;}
   stopAuto();cameraTween=null;initialView=false;
   const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
   if(event.key==='ArrowLeft')spherical.theta-=.12;if(event.key==='ArrowRight')spherical.theta+=.12;
   if(event.key==='ArrowUp')spherical.phi=Math.max(.03,spherical.phi-.1);if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI*.46,spherical.phi+.1);
   fly(controls.target.clone(),controls.target.clone().add(new THREE.Vector3().setFromSpherical(spherical)),reduced?0:350);
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{
   event.preventDefault();contextLost=true;cancelAnimationFrame(animation);animation=0;
   $('terrain-loading').hidden=false;$('terrain-loading').textContent='顯示暫停。請重新載入，或切換 2D 歷史地圖繼續閱讀。';$('terrain-retry').hidden=false;
  });
  scene.add(new THREE.HemisphereLight('#e1e7d9','#33443e',2.0));
  const sun=new THREE.DirectionalLight('#f0dfc4',2.15);sun.position.set(-5,9,6);sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-8;sun.shadow.camera.near=.5;sun.shadow.camera.far=28;sun.shadow.bias=-.00015;sun.shadow.normalBias=.015;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight('#9db5bb',.55);fill.position.set(6,4,-6);scene.add(fill);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:'#2b414a',roughness:1,metalness:0}));
  sea.rotation.x=-Math.PI/2;sea.receiveShadow=true;scene.add(sea);
  await loadModel();initialized=true;
  addCitySilhouettes();
  addCityLandmark('澳門旅遊塔','MACAU TOWER',cityModelSites.tower,{height:.338});
  addCityLandmark('新葡京','GRAND LISBOA',cityModelSites.lisboa,{height:.260});
  addCityLandmark('東望洋山','GUIA HILL',[113.54977,22.19651]);
  addCotaiLandmarks();
  resize();
  currentTarget.copy(coloaneTarget);currentOffset.set(2.25,4.65,5.45);
  fly(coloaneTarget.clone(),coloaneTarget.clone().add(currentOffset.clone().multiplyScalar(fitFactor()*presentationZoom())),reduced?0:1800);
  $('terrain-loading').hidden=true;view.setAttribute('aria-busy','false');stage.classList.add('terrain-ready');
  loadVillageBuildings();
  progress(1,'地景已就緒');resolveReady(true);document.dispatchEvent(new CustomEvent('macau-terrain-ready',{detail:{dataSource:'OSM / AWS Terrain Tiles',exaggeration}}));
  new ResizeObserver(resize).observe(view);
  const card=$('info');if(card)new MutationObserver(requestRender).observe(card,{attributes:true,attributeFilter:['hidden','class','style']});
  document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){cancelAnimationFrame(animation);animation=0;}else requestRender();});
 }catch(error){
  console.error('Macau terrain:',error);view.setAttribute('aria-busy','false');stage.classList.add('terrain-error');
  $('terrain-loading').hidden=false;$('terrain-loading').textContent='此裝置暫時無法載入 3D 地形。歷史全文、圖片與時間軸仍可於 2D 地圖閱讀。';$('terrain-retry').hidden=false;
  resolveReady(false);document.dispatchEvent(new CustomEvent('macau-terrain-error',{detail:{message:error.message}}));
 }
}
if($('view-switch'))$('view-switch').onclick=api.toggle;
if($('terrain-retry'))$('terrain-retry').onclick=()=>location.reload();
if($('terrain-detail'))$('terrain-detail').onclick=()=>window.exhibitionUI?.setView('timeline');
if($('labels-toggle'))$('labels-toggle').onclick=()=>{
 const hidden=$('terrain-labels').classList.toggle('labels-hidden');$('labels-toggle').setAttribute('aria-pressed',String(!hidden));$('labels-toggle').textContent=hidden?'顯示地名':'隱藏地名';
};
setActive(true);init();
