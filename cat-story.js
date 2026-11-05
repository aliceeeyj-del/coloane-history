/* A present-day street-memory point, kept separate from the historical archive. */
(() => {
 'use strict';
 const location=[113.53830,22.19742]; // Approximate cluster marked in the supplied map screenshots.
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const stage=document.querySelector('.stage');
 const labels=document.getElementById('terrain-labels');
 if(!stage||!labels)return;
 const captions=[
  '橘貓在店內熟睡','橘貓在街旁散步','虎斑貓在地磚上休息','白底花貓在街邊翻身',
  '白橘貓在店內玩耍','戴頸圈的虎斑貓','店內的長毛貓','橘貓的近距離特寫'
 ];
 const button=document.createElement('button');button.type='button';button.hidden=true;
 button.className='terrain-label cat-map-marker';
 button.setAttribute('aria-label','十月初五日街附近的貓店長，打開八張街區照片');
 button.innerHTML='<span class="cat-marker-symbol" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M10 17 9 7l9 5a19 19 0 0 1 12 0l9-5-1 10a17 17 0 0 1 4 11c0 9-8 15-18 15S6 37 6 28a17 17 0 0 1 4-11Z" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M17 26h.1m14 0h.1M22 32l2 2 2-2m-8 3-7 2m26-2 7 2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></span><span class="cat-marker-copy"><strong>街巷貓店長</strong><small>十月初五日街附近 · 8 張相片</small></span>';
 labels.append(button);

 const panel=document.createElement('aside');panel.id='cat-story';panel.hidden=true;
 panel.setAttribute('aria-labelledby','cat-story-title');
 panel.innerHTML=`<div class="cat-story-head"><span class="cat-story-eyebrow">PRESENT-DAY STREET MEMORY</span><button id="cat-story-close" type="button" aria-label="關閉貓店長相簿">×</button><h2 id="cat-story-title">十月初五街<br>貓店長</h2><p>沿著老街，遇見店舖與街坊貓的日常。</p></div><figure class="cat-story-figure"><img id="cat-story-photo" alt="" decoding="async"><figcaption id="cat-story-caption"></figcaption></figure><div class="cat-story-controls"><button id="cat-story-prev" type="button" aria-label="上一張相片">‹</button><span id="cat-story-count" aria-live="polite"></span><button id="cat-story-next" type="button" aria-label="下一張相片">›</button></div><div id="cat-story-thumbs" class="cat-story-thumbs" aria-label="貓店長相片"></div><p class="cat-story-note">相片由使用者提供。地圖標記依照所提供截圖放在十月初五日街一帶，位置約略；這組當代街景並非歷史史料。</p>`;
 stage.append(panel);
 const photo=panel.querySelector('#cat-story-photo');
 const caption=panel.querySelector('#cat-story-caption');
 const count=panel.querySelector('#cat-story-count');
 const thumbs=panel.querySelector('#cat-story-thumbs');
 const thumbButtons=[];
 let active=0,serial=0,closeTimer=0,lastFocus=null;
 for(let i=0;i<captions.length;i++){
  const thumb=document.createElement('button');thumb.type='button';thumb.setAttribute('aria-label',`查看第 ${i+1} 張：${captions[i]}`);
  const img=document.createElement('img');img.src=`media/cats/${i+1}.jpg`;img.alt='';img.loading='lazy';img.decoding='async';
  thumb.append(img);thumb.addEventListener('click',()=>showPhoto(i));thumbs.append(thumb);thumbButtons.push(thumb);
 }
 async function showPhoto(index){
  const token=++serial;active=(index+captions.length)%captions.length;
  const src=`media/cats/${active+1}.jpg`;
  const preload=new Image();preload.src=src;
  try{await preload.decode();}catch{}
  if(token!==serial)return;
  photo.src=src;photo.alt=captions[active];
  caption.textContent=captions[active];count.textContent=`${String(active+1).padStart(2,'0')} / ${String(captions.length).padStart(2,'0')}`;
  thumbButtons.forEach((item,i)=>item.setAttribute('aria-pressed',String(i===active)));
  thumbButtons[active].scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?'instant':'smooth'});
  if(!reduced)photo.animate([{opacity:.3,transform:'scale(1.025)'},{opacity:1,transform:'scale(1)'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
 }
 function close(){
  if(panel.hidden)return;
  ++serial;clearTimeout(closeTimer);panel.classList.remove('is-open');button.setAttribute('aria-pressed','false');
  closeTimer=setTimeout(()=>{panel.hidden=true;if(panel.contains(document.activeElement))lastFocus?.focus({preventScroll:true});},reduced?0:330);
 }
 function open(){
  const terrain=window.macauTerrain;if(!terrain?.active)return;
  clearTimeout(closeTimer);lastFocus=document.activeElement;
  window.exhibitionUI?.closePanel();terrain.focusPoint(location,{label:'十月初五街貓店長',ios:true});
  panel.hidden=false;button.setAttribute('aria-pressed','true');
  requestAnimationFrame(()=>panel.classList.add('is-open'));
  showPhoto(active);
 }
 button.addEventListener('click',()=>panel.hidden?open():close());
 panel.querySelector('#cat-story-close').addEventListener('click',close);
 panel.querySelector('#cat-story-prev').addEventListener('click',()=>showPhoto(active-1));
 panel.querySelector('#cat-story-next').addEventListener('click',()=>showPhoto(active+1));
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(active-1);}
  if(event.key==='ArrowRight'){event.preventDefault();showPhoto(active+1);}
 });
 document.addEventListener('macau-view-change',event=>{if(!event.detail.terrain)close();});
 document.addEventListener('exhibit-area',event=>{if(event.detail.area===0)close();});
 document.addEventListener('exhibit-selection',close);
 const register=()=>window.macauTerrain?.addFeatureLabel(button,location);
 if(window.macauTerrain)register();else document.addEventListener('macau-terrain-ready',register,{once:true});
})();
