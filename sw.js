/**
 * Chongqing Trip PWA - Offline Cache Service Worker
 * Ensures the travel guide and all 19 attraction photos work completely offline in China!
 */

const CACHE_NAME = 'chongqing-trip-v12';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './itinerary-data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './images/hotel_basecamp.jpg',
  './images/stop_01.jpg',
  './images/stop_02.jpg',
  './images/stop_03.jpg',
  './images/stop_04.jpg',
  './images/stop_05.jpg',
  './images/stop_06.jpg',
  './images/stop_07.jpg',
  './images/stop_08.jpg',
  './images/stop_09.jpg',
  './images/stop_10.jpg',
  './images/stop_11.jpg',
  './images/stop_12.jpg',
  './images/stop_13.jpg',
  './images/stop_14.jpg',
  './images/stop_15.jpg',
  './images/stop_16.jpg',
  './images/stop_17.jpg',
  './images/stop_18.jpg',
  './images/stop_19.jpg',
  './images/stop_great_hall.jpg',
  './images/stop_three_gorges_museum.jpg',
  './images/stop_zhongshan_4th_rd.jpg',
  './images/stop_xiannvshan_train.jpg',
  './images/stop_dazu_guanyin.jpg',
  './images/stop_maoxuewang.jpg',
  './images/stop_chaotianmen.jpg',
  './images/stop_sanyangzi.jpg',
  './images/stop_shanchenggang.jpg',
  './images/stop_fanbatuo.jpg',
  './images/stop_fanjianghu.jpg',
  './images/stop_feichangji.jpg',
  './images/stop_zaoshaokao.jpg',
  './images/stop_huangjueya.jpg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[PWA] Pre-caching all travel itinerary assets and photos...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[PWA] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for code files (HTML, JS, CSS) to ensure code updates reflect immediately
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/' || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for images and tiles
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('./images/stop_01.jpg');
      });
    })
  );
});
