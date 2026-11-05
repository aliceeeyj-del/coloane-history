/* Contemporary context photos; original illustrations and their media controls remain intact. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const switcher = $('photo-switch'), original = $('event-art'), modern = $('modern-photo');
 const originalButton = $('photo-original'), modernButton = $('photo-modern');
 const image = $('modern-thumb'), dialog = $('modern-dialog');
 let record = null, serial = 0;
 const manifest = fetch('./media/modern/manifest.json').then(response => {
  if (!response.ok) throw Error('Modern photo manifest unavailable');
  return response.json();
 }).catch(() => null);

 function showOriginal() {
  if (!record?.art) return;
  modern.hidden = true;
  original.hidden = false;
  document.dispatchEvent(new CustomEvent('modern-photo-close'));
  originalButton.setAttribute('aria-pressed', 'true');
  modernButton.setAttribute('aria-pressed', 'false');
 }
 function showModern() {
  if (!record?.photo) return;
  document.dispatchEvent(new CustomEvent('modern-photo-open'));
  original.hidden = true;
  modern.hidden = false;
  image.src = record.photo.file;
  originalButton.setAttribute('aria-pressed', 'false');
  modernButton.setAttribute('aria-pressed', 'true');
 }
 function select(area, index, art) {
  const token = ++serial;
  record = { area, index, art: Boolean(art), photo: null, context: '' };
  switcher.hidden = true;
  modern.hidden = true;
  manifest.then(data => {
   if (token !== serial || !data) return;
   const [key, context] = data.records?.[area]?.[index] || [];
   const photo = data.photos?.[key];
   if (!photo) return;
   record.photo = photo;
   record.context = context;
   record.title = $('tt').textContent;
   image.alt = `${context}，${photo.year} 年攝影`; 
   $('modern-caption').textContent = `${context} · ${photo.year} 年照片`;
   $('modern-author').textContent = photo.author;
   $('modern-license').textContent = photo.license;
   $('modern-license').href = photo.licenseUrl || photo.source;
   $('modern-source').href = photo.source;
   originalButton.hidden = !record.art;
   switcher.hidden = false;
   if (record.art) showOriginal(); else showModern();
  });
 }
 originalButton.addEventListener('click', showOriginal);
 modernButton.addEventListener('click', showModern);
 $('modern-open').addEventListener('click', () => {
  if (!record?.photo) return;
  $('modern-large').src = record.photo.file;
  $('modern-large').alt = image.alt;
  $('modern-dialog-title').textContent = `現代照片 · ${record.title}`;
  $('modern-dialog-caption').textContent = `${record.context} · 攝影：${record.photo.author} · ${record.photo.year} · ${record.photo.license}；${record.photo.changes}`;
  $('modern-dialog-source').href = record.photo.source;
  dialog.showModal();
 });
 document.addEventListener('exhibit-selection', event => select(event.detail.area, event.detail.index, event.detail.item[5]));
 document.addEventListener('exhibit-phase', event => {
  if (record) select(record.area, record.index, event.detail.art);
 });
})();
