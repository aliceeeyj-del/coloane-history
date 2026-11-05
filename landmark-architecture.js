import * as THREE from './vendor/three.module.js';

/* Small interpretive silhouettes, positioned on the existing terrain coordinates.
   Only documented structures receive building forms; other records use an archive plinth. */
const stage=document.querySelector('.stage');
const note=document.createElement('div');note.id='terrain-model-note';note.hidden=true;note.setAttribute('role','status');stage.append(note);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const terrain=()=>window.macauTerrain;
const material={
 stone:new THREE.MeshStandardMaterial({color:'#c9bea3',roughness:1,metalness:0}),
 wall:new THREE.MeshStandardMaterial({color:'#ded6bd',roughness:1,metalness:0}),
 pale:new THREE.MeshStandardMaterial({color:'#eee3c9',roughness:1,metalness:0}),
 roof:new THREE.MeshStandardMaterial({color:'#79665a',roughness:1,metalness:0}),
 tile:new THREE.MeshStandardMaterial({color:'#826b58',roughness:1,metalness:0}),
 wood:new THREE.MeshStandardMaterial({color:'#675848',roughness:1,metalness:0}),
 brass:new THREE.MeshStandardMaterial({color:'#c8ae7a',roughness:.88,metalness:.08}),
};
let active=null,outgoing=null,frame=0,serial=0;
function box(group,w,h,d,x,y,z,finish){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),finish);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function roof(group,w,d,y,rise,finish){
 const length=Math.hypot(w/2,rise),angle=Math.atan2(rise,w/2);
 const left=box(group,length,.009,d,-w/4,y+rise/2,0,finish);left.rotation.z=angle;
 const right=box(group,length,.009,d,w/4,y+rise/2,0,finish);right.rotation.z=-angle;
}
function makeBuilding(type){
 const group=new THREE.Group();group.name='Interpretive landmark silhouette, not historical reconstruction';
 if(type==='temple'){
  box(group,.22,.018,.16,0,.009,0,material.stone);
  box(group,.172,.095,.112,0,.066,0,material.wall);
  roof(group,.216,.15,.115,.051,material.tile);
  box(group,.045,.064,.004,0,.052,.058,material.wood);
  box(group,.11,.007,.006,0,.103,.059,material.brass);
 }else if(type==='chapel'){
  box(group,.2,.017,.14,0,.0085,0,material.stone);
  box(group,.15,.116,.1,0,.076,0,material.pale);
  roof(group,.17,.122,.134,.04,material.roof);
  box(group,.035,.074,.004,-.018,.057,.052,material.wood);
  box(group,.042,.16,.043,.06,.097,0,material.pale);
  box(group,.055,.016,.055,.06,.184,0,material.roof);
  box(group,.007,.037,.007,.06,.211,0,material.brass);
  box(group,.027,.006,.007,.06,.215,0,material.brass);
 }else if(type==='library'){
  box(group,.25,.016,.145,0,.008,0,material.stone);
  box(group,.214,.104,.108,0,.068,0,material.wall);
  roof(group,.246,.132,.126,.03,material.roof);
  for(const x of [-.07,0,.07])box(group,.037,.066,.004,x,.056,.056,material.wood);
  box(group,.22,.009,.009,0,.112,.057,material.pale);
 }else if(type==='monument'){
  box(group,.13,.018,.13,0,.009,0,material.stone);
  box(group,.085,.035,.085,0,.035,0,material.wall);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.009,.031,.145,4),material.pale);
  shaft.position.y=.121;shaft.rotation.y=Math.PI/4;shaft.castShadow=true;group.add(shaft);
  box(group,.047,.009,.047,0,.054,0,material.brass);
 }else{
  box(group,.11,.014,.11,0,.007,0,material.stone);
  box(group,.065,.075,.019,0,.052,0,material.wall);
  box(group,.046,.003,.003,0,.057,.011,material.brass);
  box(group,.035,.003,.003,0,.046,.011,material.brass);
 }
 return group;
}
function classify(title){
 if(title==='譚公廟'||title==='康真君廟')return 'temple';
 if(title==='聖方濟各聖堂')return 'chapel';
 if(title==='由學校到圖書館')return 'library';
 if(title==='打海盜紀念碑')return 'monument';
 return 'archive';
}
function dispose(entry){if(!entry)return;terrain()?.removeOverlay(entry.anchor);entry.anchor.traverse(object=>object.geometry?.dispose());}
function ease(t){return (1-(1+8*t)*Math.exp(-8*t))/(1-9*Math.exp(-8));}
function tick(now){
 frame=0;let moving=false;
 if(active&&!active.done){
  const t=Math.min(1,(now-active.start)/1050),value=ease(t);
  active.figure.scale.setScalar(.03+.97*value);active.figure.position.y=-.045*(1-value);
  active.done=t>=1;moving=!active.done;
 }
 if(outgoing){
  const t=Math.min(1,(now-outgoing.exit)/320),value=t*t*(3-2*t);
  outgoing.figure.scale.setScalar(Math.max(.001,outgoing.from*(1-value)));
  if(t>=1){dispose(outgoing);outgoing=null;}else moving=true;
 }
 terrain()?.invalidate();if(moving)frame=requestAnimationFrame(tick);
}
function retire(immediate=false){
 serial++;cancelAnimationFrame(frame);frame=0;note.hidden=true;
 if(outgoing){dispose(outgoing);outgoing=null;}
 if(active){
  if(immediate||reduced)dispose(active);
  else{outgoing={...active,exit:performance.now(),from:active.figure.scale.x};frame=requestAnimationFrame(tick);}
  active=null;
 }
}
async function select(detail){
 if(!detail.timeline||!Array.isArray(detail.coordinates)){retire();return;}
 const token=++serial,ready=await terrain()?.ready;
 if(!ready||token!==serial||!terrain()?.active)return;
 const point=terrain().terrainPoint(detail.coordinates,.018);if(!point)return;
 cancelAnimationFrame(frame);frame=0;if(outgoing){dispose(outgoing);outgoing=null;}
 if(active)outgoing={...active,exit:performance.now(),from:active.figure.scale.x};
 const type=classify(detail.label),anchor=new THREE.Group(),figure=makeBuilding(type);
 anchor.position.copy(point);anchor.add(figure);terrain().addOverlay(anchor);
 active={anchor,figure,start:performance.now(),done:reduced};
 if(reduced)figure.scale.setScalar(1);else{figure.scale.setScalar(.03);figure.position.y=-.045;frame=requestAnimationFrame(tick);}
 note.textContent=type==='archive'?`${detail.label} · 史料定位基座，非已確認的歷史建築`:`${detail.label} · 建築意象，非實際比例或歷史復原`;
 note.hidden=false;
 terrain().invalidate();
}
document.addEventListener('macau-terrain-focus',event=>select(event.detail));
document.addEventListener('exhibit-area',()=>retire(true));
document.addEventListener('macau-view-change',event=>{if(!event.detail.terrain)retire(true);});
document.addEventListener('click',event=>{if(event.target.closest('#zr,#macau-overview,.exhibition-brand,button.terrain-city-landmark'))retire();});
