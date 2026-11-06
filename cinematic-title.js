/* Additive film-title layer: waits for the existing terrain camera to finish. */
(() => {
 'use strict';
 const stage=document.querySelector('.stage');
 const heading=document.getElementById('terrain-heading');
 if(!stage||!heading)return;
 const layer=document.createElement('div');
 layer.id='cinematic-title';layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<svg class="cine-filter" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><filter id="cine-ink" x="-3%" y="-5%" width="106%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="8" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter></svg><div class="cine-lockup"><span class="cine-overline">COLOANE · A LANDSCAPE OF MEMORY</span><strong class="cine-main"></strong><span class="cine-rule"></span><span class="cine-sub"></span></div>';
 stage.append(layer);
 const main=layer.querySelector('.cine-main');
 const sub=layer.querySelector('.cine-sub');
 const overline=layer.querySelector('.cine-overline');
 const lockup=layer.querySelector('.cine-lockup');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let previousArea=window.historyExhibit?.area ?? 0;
 let pending=null,serial=0,timers=[];
 function schedule(callback,ms){const id=setTimeout(callback,ms);timers.push(id);}
 function cancel(){serial++;timers.forEach(clearTimeout);timers=[];pending=null;layer.className='';stage.classList.remove('cine-active','cine-returning');}
 function start(area){
  if(reduced||!window.macauTerrain?.active)return;
  const token=serial;
  const coloane=area===0;
  main.textContent=coloane?'路環':'澳門半島';
  sub.textContent=coloane?'山海之间':'街巷記憶';
  overline.textContent=coloane?'COLOANE · A LANDSCAPE OF MEMORY':'MACAU PENINSULA · AN ATLAS OF MEMORY';
  layer.classList.toggle('is-long',!coloane);
  layer.classList.add('is-visible');stage.classList.add('cine-active');
  requestAnimationFrame(()=>{if(token===serial)layer.classList.add('is-entered');});
  schedule(()=>{
   if(token!==serial)return;
   const title=heading.querySelector('h1').getBoundingClientRect();
   const center=lockup.getBoundingClientRect();
   layer.style.setProperty('--cine-return-x',`${title.left+title.width/2-(center.left+center.width/2)}px`);
   layer.style.setProperty('--cine-return-y',`${title.top+title.height/2-(center.top+center.height/2)}px`);
   stage.classList.add('cine-returning');layer.classList.add('is-returning');
  },2600);
  schedule(()=>{if(token===serial)cancel();},3750);
 }
 document.addEventListener('exhibit-area',event=>{
  const next=Number(event.detail.area);
  const changed=next!==previousArea;
  previousArea=next;
  cancel();
  if(changed&&window.macauTerrain?.active&&!reduced)pending=next;
 });
 document.addEventListener('macau-terrain-camera-settled',()=>{
  if(pending===null)return;
  if(window.historyExhibit?.area!==pending||!window.macauTerrain?.active){cancel();return;}
  const next=pending;pending=null;
  const token=serial;
  const font=document.fonts?.load('120px "Cinematic Brush"')||Promise.resolve();
  Promise.resolve(font).catch(()=>{}).then(()=>{if(token===serial&&window.historyExhibit?.area===next)start(next);});
 });
 document.addEventListener('macau-view-change',event=>{if(!event.detail.terrain)cancel();});
})();
