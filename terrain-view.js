import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const $=id=>document.getElementById(id);
const stage=document.querySelector('.stage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const project=(lon,lat)=>[(lon-113.56)*111.32*Math.cos(22.16*Math.PI/180),(22.16-lat)*111.32];
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,.1,150);
let renderer,controls,model,animation=0,lastTime=0,flat=false,active=true,auto=false,exaggeration=4;
let surface,rawPositions,sideMeshes=[],labels=[];
const target=new THREE.Vector3(0,0,-.35);
const overview=new THREE.Vector3(6.8,9.6,11.5);
const api={get active(){return active},toggle:()=>setActive(!active),setActive,
 zoom(factor){if(controls){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();render();}},
 reset(){if(!controls)return;flat=false;$('td').textContent='俯視';controls.target.copy(target);camera.position.copy(overview).multiplyScalar(fitFactor());controls.enableRotate=true;controls.update();render();},
 rotate(){if(!controls)return;auto=!auto;$('rot').textContent=auto?'暫停旋轉':'360° 旋轉';$('rot').setAttribute('aria-pressed',String(auto));render();},
 flat(){if(!controls)return;flat=!flat;auto=false;$('rot').textContent='360° 旋轉';$('rot').setAttribute('aria-pressed','false');$('td').textContent=flat?'立體視角':'俯視';camera.position.copy(flat?new THREE.Vector3(0,21,.001):overview).multiplyScalar(fitFactor());controls.target.copy(target);controls.enableRotate=!flat;controls.update();render();}
};
window.macauTerrain=api;
$('view-switch').onclick=api.toggle;
$('terrain-retry').onclick=()=>location.reload();
$('terrain-detail').onclick=()=>{setActive(false);document.dispatchEvent(new Event('macau-street-overview'));};
function fitFactor(){return Math.max(1,Math.min(1.8,1.2/Math.max(.5,$('terrain-view').clientWidth/$('terrain-view').clientHeight)));}
function setActive(value){
 active=value;stage.classList.toggle('terrain-mode',active);
 $('view-switch').textContent=active?'街道地圖':'立體澳門';$('view-switch').setAttribute('aria-pressed',String(active));
 $('terrain-view').setAttribute('aria-hidden',String(!active));$('live-map').inert=active;
 $('td').textContent=active?(flat?'立體視角':'俯視'):'平面';
 $('rot').textContent=active?(auto?'暫停旋轉':'360° 旋轉'):'旋轉';
 $('rot').setAttribute('aria-pressed',String(active&&auto));
 document.dispatchEvent(new CustomEvent('macau-view-change',{detail:{terrain:active}}));
 if(active){resize();render();}else{cancelAnimationFrame(animation);animation=0;}
}
function geometry(positions,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(indices)g.setIndex(indices);g.computeVertexNormals();return g;}
function makeSides(rings){
 const palette=[0x9c8052,0x6e5139,0x47372c];
 for(let band=0;band<3;band++){
  const pos=[],idx=[];
  for(const ring of rings){for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],offset=pos.length/3;
   const upper=p=>band===0?p[1]*exaggeration+.095:-.09-(band-1)*.20;
   const lower=-.09-band*.20;
   pos.push(a[0],upper(a),a[2],b[0],upper(b),b[2],a[0],lower,a[2],b[0],lower,b[2]);
   idx.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3);
  }}
  const mesh=new THREE.Mesh(geometry(pos,idx),new THREE.MeshStandardMaterial({color:palette[band],roughness:1,side:THREE.DoubleSide}));
  mesh.castShadow=true;model.add(mesh);sideMeshes.push(mesh);
 }
}
function nearestHeight(x,z){let closest=Infinity,h=0;for(let i=0;i<rawPositions.length;i+=3){const d=(rawPositions[i]-x)**2+(rawPositions[i+2]-z)**2;if(d<closest){closest=d;h=rawPositions[i+1];}}return h*exaggeration+.12;}
function addLabel(text,sub,lon,lat,area){
 const [x,z]=project(lon,lat),h=nearestHeight(x,z);
 const element=document.createElement(area===undefined?'span':'button');element.className='terrain-label';
 const title=document.createElement('strong');title.textContent=text;element.append(title);
 if(sub){const small=document.createElement('small');small.textContent=sub;element.append(small);}
 if(area!==undefined){element.type='button';element.title=`探索${text}歷史`;element.onclick=()=>{setActive(false);document.querySelector(`[data-area="${area}"]`).click();};}
 $('terrain-labels').append(element);
 labels.push({element,point:new THREE.Vector3(x,h+.23,z),x,z});
 const pin=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color:0xffdf9f}));pin.position.set(x,h+.05,z);model.add(pin);
 const line=new THREE.Line(geometry([x,h,z,x,h+.25,z]),new THREE.LineBasicMaterial({color:0xd8bd82,transparent:true,opacity:.7}));model.add(line);
}
function render(time=performance.now()){
 if(!active||!renderer)return;
 cancelAnimationFrame(animation);animation=0;
 const delta=Math.min((time-lastTime)/1000,.05);lastTime=time;
 if(auto&&!flat&&!document.hidden){
  const relative=camera.position.clone().sub(controls.target);relative.applyAxisAngle(new THREE.Vector3(0,1,0),delta*.16);camera.position.copy(controls.target).add(relative);
 }
 controls.update();renderer.render(scene,camera);
 const width=$('terrain-view').clientWidth,height=$('terrain-view').clientHeight;
 const placed=[];
 for(const item of labels){
  const p=item.point.clone().project(camera);const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
  const hidden=p.z>1||p.z<-1||x<30||x>width-30||y<90||y>height-35||placed.some(a=>Math.abs(a[0]-x)<85&&Math.abs(a[1]-y)<38);
  item.element.hidden=hidden;
  if(!hidden){placed.push([x,y]);item.element.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;}
 }
 const bearing=THREE.MathUtils.radToDeg(Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z));
 $('north-arrow').style.transform=`rotate(${-bearing}deg)`;
 $('bearing').textContent=`${((Math.round(bearing)%360)+360)%360}°`;
 if(auto&&!document.hidden){cancelAnimationFrame(animation);animation=requestAnimationFrame(render);}
}
function resize(){if(!renderer||!active)return;const view=$('terrain-view');camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();renderer.setSize(view.clientWidth,view.clientHeight);render();}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','澳門三維地形：拖曳旋轉，滾輪縮放，雙指平移與縮放');renderer.domElement.tabIndex=0;
  $('terrain-view').prepend(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
  controls.minDistance=5;controls.maxDistance=45;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.03;controls.screenSpacePanning=true;controls.rotateSpeed=.65;controls.zoomSpeed=.85;
  controls.addEventListener('change',()=>{if(!animation)animation=requestAnimationFrame(render);});
  controls.addEventListener('start',()=>{if(auto){auto=false;$('rot').textContent='360° 旋轉';$('rot').setAttribute('aria-pressed','false');}});
  renderer.domElement.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();e.stopPropagation();
   if(e.key==='Home')api.reset();else if(e.key==='+'||e.key==='-')api.zoom(e.key==='+'?.85:1.15);else{
    const offset=camera.position.clone().sub(controls.target);const spherical=new THREE.Spherical().setFromVector3(offset);
    if(e.key==='ArrowLeft')spherical.theta-=.15;if(e.key==='ArrowRight')spherical.theta+=.15;
    if(e.key==='ArrowUp')spherical.phi=Math.max(.04,spherical.phi-.12);if(e.key==='ArrowDown')spherical.phi=Math.min(Math.PI*.48,spherical.phi+.12);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();render();
   }
  });
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('terrain-loading').hidden=false;$('terrain-loading').textContent='顯示暫停，請重新載入，或切換街道地圖。';});
  scene.add(new THREE.HemisphereLight(0xffedce,0x34404a,2));
  const sun=new THREE.DirectionalLight(0xffe2b0,3.1);sun.position.set(-6,12,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.bias=-.0008;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xabcbd3,1);fill.position.set(7,4,-7);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.28}));ground.rotation.x=-Math.PI/2;ground.position.y=-.52;ground.receiveShadow=true;scene.add(ground);
  const response=await fetch('./terrain/macau.json');if(!response.ok)throw Error('地形資料未能載入');const data=await response.json();
  rawPositions=data.positions;
  const texture=await new THREE.TextureLoader().loadAsync('./terrain/surface.png');texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  model=new THREE.Group();scene.add(model);
  const pos=rawPositions.map((v,i)=>i%3===1?v*exaggeration+.1:v);
  const geom=geometry(pos,data.indices),uv=[],colors=[];const [minx,minz,maxx,maxz]=data.textureBounds;
  for(let i=0;i<pos.length;i+=3){uv.push((pos[i]-minx)/(maxx-minx),1-(pos[i+2]-minz)/(maxz-minz));const h=rawPositions[i+1];const c=new THREE.Color().lerpColors(new THREE.Color(0xffffff),new THREE.Color(0x77935b),Math.min(.65,h*4));colors.push(c.r,c.g,c.b);}
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  surface=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({map:texture,vertexColors:true,roughness:.93,side:THREE.DoubleSide}));surface.receiveShadow=true;surface.castShadow=true;model.add(surface);makeSides(data.rings);
  for(const points of data.bridges){const g=geometry(points.flatMap(([x,y,z])=>[x,.13,z]));model.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0xd9bd83,transparent:true,opacity:.65})));}
  addLabel('澳門半島','MACAU PENINSULA',113.544,22.194,1);
  addLabel('氹仔','TAIPA',113.558,22.158);
  addLabel('路氹','COTAI',113.566,22.145);
  addLabel('路環','COLOANE',113.566,22.122,0);
  addLabel('十月初五馬路','探索海旁歷史 ↗',113.551,22.116,0);
  addLabel('澳門國際機場','',113.593,22.147);
  $('terrain-loading').hidden=true;$('terrain-view').setAttribute('aria-busy','false');
  api.reset();resize();new ResizeObserver(resize).observe($('terrain-view'));
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(!document.hidden)render();});
  $('labels-toggle').onclick=()=>{const hidden=$('terrain-labels').classList.toggle('labels-hidden');$('labels-toggle').setAttribute('aria-pressed',String(!hidden));$('labels-toggle').textContent=hidden?'顯示地名':'隱藏地名';};
 }catch(error){console.error('Macau terrain:',error);$('terrain-loading').hidden=false;$('terrain-loading').textContent='此裝置暫時無法載入立體地形。可重新載入，或使用街道地圖及歷史時間軸。';$('terrain-retry').hidden=false;$('terrain-view').setAttribute('aria-busy','false');}
}
setActive(true);init();
