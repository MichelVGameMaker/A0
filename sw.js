const CACHE = 'muscu-app-v2';
const CORE = [
  './','./index.html?v=2','./styles.css?v=2','./app.js?v=2','./db.js','./manifest.webmanifest?v=2'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(
      caches.match(e.request).then(r=> r || fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return res;
      }))
    );
  }
});
