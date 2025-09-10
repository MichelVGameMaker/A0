// sw.js — cache app-shell pour GitHub Pages
const VERSION = 'v2';                 // ← incrémente à chaque modif
const CACHE   = `a0-${VERSION}`;
const ASSETS  = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // scripts
  './db.js',
  './state.js',
  './ui-week.js',
  './ui-calendar.js',
  './ui-session.js',
  './init.js'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request).catch(()=>caches.match('./index.html')))
  );
});
