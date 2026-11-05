/* Optional, silent studies animated from the existing still illustrations. */
(() => {
 const image = document.getElementById('art-open');
 const thumb = document.getElementById('art-thumb');
 const video = document.getElementById('art-motion-video');
 const toggle = document.getElementById('art-motion-toggle');
 const note = document.getElementById('art-motion-note');
 const credit = document.getElementById('art-credit');
 let source = '', originalCredit = '';

 function reset() {
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.hidden = true;
  image.hidden = false;
  note.hidden = true;
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = '▶ 觀看動態插圖';
 }
 function setArt(art) {
  reset();
  originalCredit = credit.textContent;
  source = art && art !== 'monument-photo' ? `media/motion/${art}.mp4` : '';
  toggle.hidden = !source;
 }
 toggle.addEventListener('click', async () => {
  if (!source) return;
  if (!video.hidden) {
   reset();
   credit.textContent = originalCredit;
   return;
  }
  video.src = source;
  video.poster = thumb.currentSrc || thumb.src;
  video.hidden = false;
  image.hidden = true;
  note.hidden = false;
  credit.textContent = '動態插圖 · 由原圖製作';
  toggle.textContent = '↩ 返回原圖';
  toggle.setAttribute('aria-pressed', 'true');
  try { await video.play(); } catch { video.controls = true; }
 });
 document.addEventListener('exhibit-selection', event => setArt(event.detail.item[5]));
 document.addEventListener('exhibit-phase', event => setArt(event.detail.art));
 document.addEventListener('modern-photo-open', () => { reset(); credit.textContent = originalCredit; toggle.hidden = true; });
 document.addEventListener('modern-photo-close', () => { reset(); credit.textContent = originalCredit; toggle.hidden = !source; });
})();
