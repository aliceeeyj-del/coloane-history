import * as THREE from './vendor/three.module.js';

/* Historical movement directions on the real 3D terrain. Geometry is illustrative,
   sourced from the original war/laichi points; it is not a reconstructed march. */
const stage=document.querySelector('.stage');
const terrain=()=>window.macauTerrain;
const cue=document.createElement('div');cue.id='campaign-cue';cue.hidden=true;cue.setAttribute('role','status');stage.append(cue);
let layer=null,frame=0,generation=0,colored=true,settledListener=null;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function dispose(group){group.traverse(object=>{object.geometry?.dispose();const material=object.material;if(Array.isArray(material))material.forEach(m=>m.dispose());else material?.dispose();});}
function clear(){stage.classList.remove('campaign-playing');generation++;cancelAnimationFrame(frame);frame=0;if(settledListener){document.removeEventListener('macau-terrain-camera-settled',settledListener);settledListener=null;}if(layer){terrain()?.removeOverlay(layer);dispose(layer);layer=null;}cue.hidden=true;}
function anchor(coords,lift=.075){return terrain()?.terrainPoint(coords,lift);}
function routePoints(points){
 const samples=[];
 for(let i=0;i<points.length-1;i++){
  const a=anchor(points[i]),b=anchor(points[i+1]);if(!a||!b)return [];
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.028));
  for(let n=0;n<count;n++){const t=n/count,p=new THREE.Vector3().lerpVectors(a,b,t);p.y=anchor([points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t])?.y??p.y;samples.push(p);}
 }
 const last=anchor(points.at(-1));if(last)samples.push(last);
 return samples;
}
function ribbon(samples,color){
 const coords=[],left=[],right=[];
 for(let i=0;i<samples.length;i++){
  const before=samples[Math.max(0,i-1)],after=samples[Math.min(samples.length-1,i+1)];
  const tangent=new THREE.Vector3().subVectors(after,before);tangent.y=0;tangent.normalize();
  const normal=new THREE.Vector3(-tangent.z,0,tangent.x),width=.075;
  left.push(samples[i].clone().addScaledVector(normal,width));right.push(samples[i].clone().addScaledVector(normal,-width));
 }
 for(let i=0;i<samples.length-1;i++){
  const a=left[i],b=right[i],c=left[i+1],d=right[i+1];
  for(const v of [a,b,c,b,d,c])coords.push(v.x,v.y,v.z);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));geometry.computeVertexNormals();geometry.setDrawRange(0,0);
 const mat=new THREE.MeshStandardMaterial({color:colored?color:'#c2c6be',roughness:1,metalness:0,transparent:true,opacity:.96,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
 const body=new THREE.Mesh(geometry,mat);body.renderOrder=5;body.castShadow=false;
 const direction=new THREE.Vector3().subVectors(samples.at(-1),samples.at(-2)).setY(0).normalize();
 const perp=new THREE.Vector3(-direction.z,0,direction.x),tip=samples.at(-1).clone().add(new THREE.Vector3(0,.015,0));
 const base=samples.at(-1).clone().addScaledVector(direction,-.23).add(new THREE.Vector3(0,.015,0));
 const wingA=base.clone().addScaledVector(perp,.19),wingB=base.clone().addScaledVector(perp,-.19);
 const headGeometry=new THREE.BufferGeometry();headGeometry.setAttribute('position',new THREE.Float32BufferAttribute([wingA.x,wingA.y,wingA.z,wingB.x,wingB.y,wingB.z,tip.x,tip.y,tip.z],3));headGeometry.computeVertexNormals();
 const head=new THREE.Mesh(headGeometry,new THREE.MeshBasicMaterial({color:colored?color:'#c2c6be',side:THREE.DoubleSide,depthWrite:false}));head.renderOrder=6;head.visible=false;
 const edgeGeometry=new THREE.BufferGeometry().setFromPoints(samples.map(p=>p.clone().add(new THREE.Vector3(0,.017,0))));
 const spine=new THREE.Line(edgeGeometry,new THREE.LineBasicMaterial({color:'#e4e5dc',transparent:true,opacity:.65,depthWrite:false}));spine.renderOrder=7;spine.visible=false;
 return {body,head,spine,count:samples.length-1,samples};
}
function advanceHead(graphic,progress){
 const index=Math.min(graphic.count,Math.max(1,Math.floor(graphic.count*progress)));
 const tip=graphic.samples[index].clone().add(new THREE.Vector3(0,.025,0));
 const direction=new THREE.Vector3().subVectors(graphic.samples[index],graphic.samples[index-1]).setY(0).normalize();
 const perpendicular=new THREE.Vector3(-direction.z,0,direction.x);
 const base=tip.clone().addScaledVector(direction,-.23);
 const a=base.clone().addScaledVector(perpendicular,.19),b=base.clone().addScaledVector(perpendicular,-.19);
 const vertices=graphic.head.geometry.attributes.position;
 vertices.setXYZ(0,a.x,a.y,a.z);vertices.setXYZ(1,b.x,b.y,b.z);vertices.setXYZ(2,tip.x,tip.y,tip.z);
 vertices.needsUpdate=true;graphic.head.geometry.computeBoundingSphere();
}
function ring(point,color,radius=.09){
 const geometry=new THREE.RingGeometry(radius*.83,radius,48);
 const circle=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:colored?color:'#d7d8d0',transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false}));
 circle.rotation.x=-Math.PI/2;circle.position.copy(point);circle.position.y+=.04;circle.renderOrder=6;return circle;
}
function blast(point,serial){
 if(serial!==generation||!layer)return;
 const origin=point.clone().add(new THREE.Vector3(-.42,.67,-.26));
 const shell=new THREE.Mesh(new THREE.SphereGeometry(.052,12,8),new THREE.MeshBasicMaterial({color:'#ffe1a5',transparent:true,opacity:.96,depthWrite:false}));
 shell.position.copy(origin);shell.renderOrder=10;layer.add(shell);
 const trailGeometry=new THREE.BufferGeometry().setFromPoints([origin,origin]);
 const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#f4c388',transparent:true,opacity:.82,depthWrite:false}));trail.renderOrder=9;layer.add(trail);
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.08,14,10),new THREE.MeshBasicMaterial({color:'#ffe6ac',transparent:true,opacity:.9,depthWrite:false}));
 flash.position.copy(point);flash.position.y+=.09;flash.renderOrder=9;flash.visible=false;layer.add(flash);
 const shock=ring(point,'#e4b376',.12);shock.material.opacity=.95;shock.position.y+=.035;shock.renderOrder=9;layer.add(shock);
 const smoke=[];
 for(let i=0;i<4;i++){
  const cloud=new THREE.Mesh(new THREE.SphereGeometry(.07+i*.016,10,7),new THREE.MeshBasicMaterial({color:i%2?'#b5ac9b':'#d4c1a5',transparent:true,opacity:.26,depthWrite:false}));
  const angle=i*Math.PI*.5+.3;cloud.position.copy(point).add(new THREE.Vector3(Math.cos(angle)*.045,.075,Math.sin(angle)*.045));cloud.renderOrder=8;cloud.visible=false;layer.add(cloud);smoke.push(cloud);
 }
 const start=performance.now();
 const animate=now=>{
  if(serial!==generation||!layer||!terrain()?.active)return;
  const elapsed=now-start;
  if(elapsed<650){
   const advance=elapsed/650;
   shell.position.lerpVectors(origin,point,advance);shell.position.y+=Math.sin(advance*Math.PI)*.22;
   const tail=origin.clone().lerp(shell.position,Math.max(0,advance-.18));
   const vertices=trail.geometry.attributes.position;vertices.setXYZ(0,tail.x,tail.y,tail.z);vertices.setXYZ(1,shell.position.x,shell.position.y,shell.position.z);vertices.needsUpdate=true;
   terrain().invalidate();frame=requestAnimationFrame(animate);return;
  }
  shell.visible=false;trail.visible=false;flash.visible=true;smoke.forEach(cloud=>cloud.visible=true);
  const age=Math.min(1,(elapsed-650)/1700);
  flash.scale.setScalar(1+Math.min(age*5,1.7));flash.material.opacity=Math.max(0,1-age*4);
  shock.scale.setScalar(1+age*5);shock.material.opacity=Math.max(0,.94-age);
  smoke.forEach((cloud,i)=>{const swell=1+age*(2.4+i*.25);cloud.scale.setScalar(swell);cloud.position.y=point.y+.075+age*(.14+i*.025);cloud.material.opacity=Math.max(0,.32-age*.34);});
  terrain().invalidate();if(age<1)frame=requestAnimationFrame(animate);else frame=0;
 };
 frame=requestAnimationFrame(animate);
}
async function draw(label,points,color,spot,radius){
 clear();const serial=generation;
 const ready=await terrain()?.ready;if(!ready||serial!==generation||!terrain()?.active)return false;
 layer=new THREE.Group();layer.name='Historic campaign directions (illustrative)';
 if(points?.length>1){
  const samples=routePoints(points);if(samples.length<2)return false;
  const graphic=ribbon(samples,color),arrival=ring(samples.at(-1),color,.10);arrival.visible=false;layer.add(graphic.body,graphic.head,graphic.spine,ring(samples[0],color,.08),arrival);
  layer.traverse(object=>{if(object.material?.color)object.userData.originalColor=object instanceof THREE.Line?'#e4e5dc':color;});
  terrain().addOverlay(layer);terrain().frameGeoPath(points);
  const start=performance.now(),duration=reduce?0:1550;
  const animate=now=>{
   if(serial!==generation||!layer||!terrain()?.active)return;
   const progress=duration?Math.min(1,(now-start)/duration):1;
   graphic.body.geometry.setDrawRange(0,Math.max(6,Math.floor(graphic.count*progress)*6));
   if(progress>.04)advanceHead(graphic,progress);
   graphic.head.visible=progress>.04;graphic.spine.visible=progress>=1;terrain().invalidate();
   if(progress>.72){arrival.visible=true;arrival.scale.setScalar(1+(progress-.72)*2.1);arrival.material.opacity=.94-(progress-.72)*1.7;}
   if(progress<1)frame=requestAnimationFrame(animate);else frame=0;
  };
  frame=requestAnimationFrame(animate);
 }else if(spot){
  const point=anchor(spot);if(point){layer.add(ring(point,color,radius||.16));layer.traverse(object=>{if(object.material?.color)object.userData.originalColor=color;});terrain().addOverlay(layer);
   if(label==='路環村落受波及'){
    settledListener=()=>{document.removeEventListener('macau-terrain-camera-settled',settledListener);settledListener=null;blast(point,serial);};
    document.addEventListener('macau-terrain-camera-settled',settledListener,{once:true});
   }
   terrain().focusPoint(spot,{label,index:window.historyExhibit?.current,area:window.historyExhibit?.area});
   if(label==='路環村落受波及'&&reduce){document.removeEventListener('macau-terrain-camera-settled',settledListener);settledListener=null;}
  }
 }
 stage.classList.add('campaign-playing');cue.textContent=label+(label==='路環村落受波及'?' · 炮彈動畫及爆閃為示意，非確切彈道或落點':' · 方向及範圍僅作史料示意');cue.hidden=false;
 return true;
}
function setPhase(index,path){
 const labels=['海上登岸','路環村落受波及','向九澳搜捕','打海盜紀念碑'];
 const spots=[[113.55126,22.11696],[113.55126,22.11696],[113.587,22.129],[113.55126,22.11696]];
 const colors=['#789eaa','#c4a784','#b77568','#c8b990'];
 return draw(labels[index],path,colors[index],spots[index],index===1?.19:.095);
}
function setLaichi(path){return draw('荔枝碗進駐方向',path,'#789eaa',path?.at(-1));}
function setColored(value){colored=value;if(layer)for(const object of layer.children)if(object.material?.color)object.material.color.set(value?object.userData.originalColor||'#8faeae':'#c2c6be');terrain()?.invalidate();}
window.macauCampaign={clear,setPhase,setLaichi,setColored};
document.addEventListener('macau-view-change',e=>{if(!e.detail.terrain)clear();});
document.addEventListener('exhibit-area',()=>clear());
