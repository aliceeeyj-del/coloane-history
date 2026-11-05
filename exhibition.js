/* Exhibition navigation and original-history presentation. No historical text is shortened. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), history=window.historyExhibit;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let view='terrain',closeTimer=0,selectedTrigger=null,loaderFinished=false;
 const panel=$('info'),stage=document.querySelector('.stage');
 const sourceNames=new Map([['www.macaumemory.mo','澳門記憶'],['macaumemory.mo','澳門記憶'],['www.macaotourism.gov.mo','澳門旅遊局'],['www.library.gov.mo','澳門公共圖書館'],['www.gov.mo','澳門特區政府'],['www.iam.gov.mo','澳門市政署'],['whc.unesco.org','UNESCO 世界遺產中心'],['www.gcs.gov.mo','澳門新聞局']]);
 const sourceName=url=>{try{return sourceNames.get(new URL(url).hostname)||new URL(url).hostname;}catch{return '原始資料連結';}};
 function setView(next,{locate=true}={}){
  if(!['terrain','street','timeline'].includes(next))return;
  const previous=view;view=next;
  document.body.classList.toggle('timeline-overview',view==='timeline');
  $('timeline-gallery').hidden=view!=='timeline';
  document.querySelectorAll('#view-nav button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  if(view==='timeline'){
   history.stopWar();if(window.macauTerrain)window.macauTerrain.setActive(false);
   requestAnimationFrame(()=>{$('timeline-gallery').scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});});
  }else if(view==='terrain'){
   window.macauTerrain?.setActive(true);
   if(locate&&previous!==view&&history.current>=0){const e=history.groups[history.area].events[history.current];window.macauTerrain?.focusPoint(e[2],{label:e[1],date:e[0],index:history.current,area:history.area});}
  }else{
   window.macauTerrain?.setActive(false);history.initStreet();history.setFlat(true);
   if(locate&&previous!==view)history.locateCurrent();
  }
  if(previous==='timeline'&&view!=='timeline')stage.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
 }
 function showPanel(detail){
  clearTimeout(closeTimer);panel.hidden=false;panel.classList.remove('closing','panel-closing');
  panel.classList.remove('panel-open');void panel.offsetWidth;panel.classList.add('panel-open');
  const {area,item}=detail;
  $('panel-location').textContent=area===0?'路環 · 歷史檔案':'澳門半島 · 歷史檔案';
  $('panel-era').textContent=item[0];$('panel-coordinate').textContent=`${item[2][1].toFixed(5)}° N · ${item[2][0].toFixed(5)}° E`;
  $('event-source').textContent=`${sourceName(item[4])} · 閱讀原文 ↗`;
  panel.scrollTop=0;selectedTrigger=document.activeElement;
  clampPanel();
  document.querySelectorAll('.archive-card').forEach(card=>card.classList.toggle('is-selected',Number(card.dataset.areaIndex)===area&&Number(card.dataset.eventIndex)===detail.index));
 }
 function closePanel(){
  clearTimeout(closeTimer);if(panel.hidden)return;
  panel.classList.remove('panel-open');panel.classList.add('panel-closing');
  closeTimer=setTimeout(()=>{panel.hidden=true;panel.classList.remove('panel-closing');if(panel.contains(document.activeElement)&&selectedTrigger?.isConnected)selectedTrigger.focus({preventScroll:true});},reduced?0:280);
 }
 function finishLoading(message='地景已就緒'){
  if(loaderFinished)return;loaderFinished=true;
  $('load-progress').value=100;$('load-status').textContent=message;
  document.body.classList.add('exhibit-ready');$('exhibit-loader').classList.add('is-complete');
  setTimeout(()=>{$('exhibit-loader').hidden=true;},reduced?0:650);
 }
 window.exhibitionUI={setView,closePanel,finishLoading};
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
 document.querySelector('.exhibition-brand').onclick=e=>{e.preventDefault();setView('terrain',{locate:false});closePanel();window.macauTerrain?.reset();};
 $('macau-overview').onclick=()=>{setView('terrain',{locate:false});closePanel();window.macauTerrain?.overview();};
 $('skip-loading').onclick=()=>{finishLoading('可先閱讀完整歷史檔案');setView('timeline');};
 document.addEventListener('macau-terrain-progress',e=>{if(!loaderFinished){$('load-progress').value=e.detail.progress<=1?e.detail.progress*100:e.detail.progress;$('load-status').textContent=e.detail.label;}});
 function terrainReady(){
  window.macauTerrain.setLandmarks(history.groups[history.area].events,index=>history.select(index));
  if(view==='street'||view==='timeline')window.macauTerrain.setActive(false);
  finishLoading();
 }
 document.addEventListener('macau-terrain-ready',terrainReady);
 document.addEventListener('macau-terrain-error',()=>finishLoading('立體顯示暫不可用，歷史資料仍可閱讀'));
 // A failed WebGL or module download never traps visitors behind a loading screen.
 setTimeout(()=>finishLoading('可開始閱讀歷史，地形仍在載入時請稍候'),14000);
 document.addEventListener('exhibit-selection',e=>showPanel(e.detail));
 document.addEventListener('exhibit-area',e=>{
  panel.style.removeProperty('left');panel.style.removeProperty('top');panel.style.removeProperty('bottom');panel.style.removeProperty('right');
  const inColoane=e.detail.area===0;
  $('terrain-heading').querySelector('h1').textContent=inColoane?'路環 · 山海之間':'半島 · 街巷記憶';
  $('terrain-heading').querySelector('p').textContent=inColoane?'COLOANE · MACAU':'MACAU PENINSULA';
  if(window.macauTerrain?.active){if(inColoane)window.macauTerrain.reset();else window.macauTerrain.focusPoint([113.544,22.195],{label:'澳門半島',overview:true});}
 });
 document.addEventListener('macau-area-request',e=>{history.switchArea(Number(e.detail.area));});
 document.addEventListener('macau-view-change',e=>{
  if(view==='timeline')return;
  const next=e.detail.terrain?'terrain':'street';
  if(next!==view)setView(next);
 });
 $('timeline-prev').onclick=()=>$('tl').scrollBy({left:-Math.min(480,$('tl').clientWidth*.75),behavior:reduced?'instant':'smooth'});
 $('timeline-next').onclick=()=>$('tl').scrollBy({left:Math.min(480,$('tl').clientWidth*.75),behavior:reduced?'instant':'smooth'});
 $('tl').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&$('tl').scrollWidth>$('tl').clientWidth){e.preventDefault();$('tl').scrollLeft+=e.deltaY;}},{passive:false});
 $('tl').addEventListener('keydown',e=>{if(e.key==='Home'||e.key==='End'){e.preventDefault();$('tl').children[e.key==='Home'?0:$('tl').children.length-1].focus();}});
 // Full original records, not summaries: the archive gives an alternate reading path.
 const fragment=document.createDocumentFragment();
 history.groups.forEach((group,area)=>group.events.forEach((item,index)=>{
  const [date,title,coords,body,source,art]=item,article=document.createElement('article');article.className='archive-card';article.dataset.areaIndex=area;article.dataset.eventIndex=index;
  const heading=document.createElement('div');heading.className='archive-card-heading';
  const meta=document.createElement('small');meta.textContent=`${area===0?'路環':'澳門半島'} / ${date}`;
  const h2=document.createElement('h2');h2.textContent=title;heading.append(meta,h2);article.append(heading);
  if(art){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.loading='lazy';img.decoding='async';img.alt=title;img.src=art==='monument-photo'?'https://upload.wikimedia.org/wikipedia/commons/0/07/Coloane_Village.JPG':`media/${art}${art.startsWith('new-')?'.png':'.webp'}`;if(art!=='monument-photo'){img.srcset=`media/thumbs/${art}.webp 720w`;img.sizes='(max-width: 800px) 90vw, 420px';}caption.textContent=art==='monument-photo'?'2013年實景 · Elizabeth B. Thomsen / Wikimedia Commons · CC BY-SA 3.0':'景觀插圖／情景重構；並非歷史實拍';figure.append(img,caption);article.append(figure);}
  const text=document.createElement('p');text.textContent=body;article.append(text);
  const foot=document.createElement('div');foot.className='archive-card-footer';const link=document.createElement('a');link.href=source;link.target='_blank';link.rel='noopener';link.textContent=`${sourceName(source)} ↗`;const button=document.createElement('button');button.textContent='在地圖中探索 →';button.onclick=()=>{history.switchArea(area);setView('terrain',{locate:false});history.select(index,'timeline');};foot.append(link,button);article.append(foot);fragment.append(article);
 }));
 $('archive-grid').append(fragment);
 document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll('.archive-card').forEach(card=>{card.hidden=button.dataset.filter!=='all'&&card.dataset.areaIndex!==button.dataset.filter;});
 });
 // Movable panel is bounded to the stage. On narrow displays it becomes a fixed bottom sheet.
 let drag=null;
 const handle=$('panel-handle');
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0||matchMedia('(max-width: 800px)').matches)return;
  const bounds=panel.getBoundingClientRect(),parent=stage.getBoundingClientRect();
  drag={x:e.clientX,y:e.clientY,left:bounds.left-parent.left,top:bounds.top-parent.top};handle.setPointerCapture(e.pointerId);panel.classList.add('is-dragging');e.preventDefault();
 });
 handle.addEventListener('pointermove',e=>{
  if(!drag)return;
  panel.style.right='auto';panel.style.bottom='auto';
  panel.style.left=`${Math.min(stage.clientWidth-panel.offsetWidth-12,Math.max(12,drag.left+e.clientX-drag.x))}px`;
  panel.style.top=`${Math.min(stage.clientHeight-panel.offsetHeight-12,Math.max(72,drag.top+e.clientY-drag.y))}px`;
 });
 function endDrag(){drag=null;panel.classList.remove('is-dragging');}
 handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);handle.addEventListener('lostpointercapture',endDrag);
 function clampPanel(){
  if(matchMedia('(max-width: 800px)').matches){['left','top','bottom','right'].forEach(p=>panel.style.removeProperty(p));return;}
  if(!panel.style.left)return;
  panel.style.left=`${Math.max(12,Math.min(parseFloat(panel.style.left),stage.clientWidth-panel.offsetWidth-12))}px`;
  panel.style.top=`${Math.max(72,Math.min(parseFloat(panel.style.top),stage.clientHeight-panel.offsetHeight-12))}px`;
 }
 new ResizeObserver(clampPanel).observe(stage);
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))closePanel();});
 // Source note remains available without interrupting exploration.
 const sources=document.createElement('dialog');sources.id='sources-dialog';sources.setAttribute('aria-labelledby','sources-title');
 sources.innerHTML='<form method="dialog"><button aria-label="關閉資料說明">關閉 ×</button></form><small>ABOUT THE ATLAS</small><h2 id="sources-title">資料與地形說明</h2><p>本展示完整保留原網站的歷史文字、年代、坐標、原始資料連結、插圖及路環戰役敘述。對未確認的地點、行動方向或歷史細節，沿用原記錄的說明，不作補寫推斷。</p><h3>真實地形，展示比例</h3><p>陸地輪廓、道路與土地覆蓋來自 OpenStreetMap / OpenFreeMap；高程來自 AWS Terrain Tiles。地形為當代地理背景，並非各歷史時期的海岸線。高程放大 2.6 倍，海色、近岸過渡與岩層厚度為展示材質，不代表水深或地質測量。</p><h3>照片與情景重構</h3><p>原有實景照片保留來源及授權連結；其餘景觀插圖與戰役場景均保留「情景重構」提示。部隊位置、行軍方向與聲光亦為示意，不作已確認戰場坐標解讀。</p><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap · ODbL ↗</a> · <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles ↗</a></p>';
 document.body.append(sources);$('sources-open').onclick=()=>sources.showModal();
 document.querySelectorAll('img').forEach(img=>{img.decoding='async';if(!img.closest('#info'))img.loading='lazy';});
})();
