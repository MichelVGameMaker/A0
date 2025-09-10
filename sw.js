// sw.js — scope /A0/
const VERSION = 'v1';
const CACHE = `a0-${VERSION}`;
const ASSETS = [
  '/A0/',
  '/A0/index.html',
  '/A0/style.css',
  '/A0/app.js',
  '/A0/db.js',
  '/A0/manifest.webmanifest',
  '/A0/icons/icon-192.png',
  '/A0/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Cache-first pour nos assets; network-first pour le reste
  if (ASSETS.some(a => req.url.endsWith(a.replace('/A0/','A0/')) || req.url.includes(a))) {
    e.respondWith(caches.match(req).then(res => res || fetch(req)));
  } else {
    e.respondWith(fetch(req).catch(() => caches.match('/A0/index.html')));
  }
});
