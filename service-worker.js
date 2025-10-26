const CACHE = 'qa3d-v1.1.4';
const APP_SHELL = [
  './','./index.html','./styles.css','./app.js',
  './manifest.json','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL))); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k))))); });
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
  else e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
