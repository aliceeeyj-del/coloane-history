/* First-visit overture. Independent of the existing area-switch camera titles. */
(() => {
 'use strict';
 const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
 if (reduced) return;
 const opening = document.createElement('div');
 opening.id = 'opening-title';
 opening.hidden = true;
 opening.setAttribute('aria-hidden', 'true');
 opening.innerHTML = '<div class="opening-grain"></div><div class="opening-orbit"></div><div class="opening-lockup"><span class="opening-kicker">AN ATLAS OF MEMORY · MACAU</span><h2 class="opening-main"><span>澳</span><span>門</span></h2><i class="opening-rule"></i><p class="opening-sub">山海之間 · 街巷記憶</p></div><span class="opening-footer">十月初五　·　澳門歷史地景</span>';
 document.body.append(opening);
 let started = false, finished = false, timer = 0;
 function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  observer.disconnect();
  if (opening.hidden) { opening.remove(); return; }
  opening.classList.add('is-leaving');
  setTimeout(() => { opening.hidden = true; opening.remove(); }, 950);
 }
 function begin() {
  if (finished || started || document.body.classList.contains('timeline-overview') || window.macauTerrain?.active === false || window.historyExhibit?.area !== 0) return;
  started = true;
  opening.hidden = false;
  opening.classList.add('is-visible');
  document.fonts?.load('180px "Cinematic Brush"').catch(() => {});
  timer = setTimeout(() => opening.classList.add('is-entered'), 320);
  setTimeout(() => { if (!finished) finish(); }, 3750);
 }
 function ready() {
  if (!document.body.classList.contains('exhibit-ready') || finished) return;
  observer.disconnect();
  begin();
 }
 const observer = new MutationObserver(ready);
 observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
 ready();
 document.addEventListener('exhibit-area', finish);
 document.addEventListener('macau-view-change', event => { if (!event.detail.terrain) finish(); });
 document.addEventListener('pointerdown', () => { if (started) finish(); });
 document.addEventListener('keydown', event => { if (event.key === 'Escape' && started) finish(); });
 window.addEventListener('pagehide', finish);
})();
