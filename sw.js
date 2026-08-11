// sw.js (Service Worker)

const CACHE_NAME = 'bodytrack-cache-v1-20260811-12';

// 需要強制快取的核心檔案
const CORE_ASSETS = [
  './index.html',
  './src/controllers/appController.js',
  './src/controllers/syncController.js',
  './src/models/db.js',
  './src/models/recordModel.js',
  './src/models/userModel.js',
  './src/services/api.js',
  './src/views/chartView.js',
  './src/views/calendarView.js'
];

// 1. 安裝階段：將核心檔案寫入快取
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 寫入初始快取');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. 啟用階段：清除舊版本的快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 刪除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 攔截請求階段 (Fetch)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 🚩 例外排除：絕對不快取 GAS API 的請求
  if (requestUrl.hostname.includes('script.google.com')) {
    return; // 直接放行，不干涉 API 網路層
  }

  // 靜態資源策略：Stale-While-Revalidate (先給快取，背景偷偷更新)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // 若請求成功且為 GET，更新快取
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 斷網且沒有快取時的防呆處理
        console.warn('[Service Worker] 網路異常且無快取可供讀取');
      });

      // 如果有快取就立刻回傳快取，否則等待網路請求
      return cachedResponse || fetchPromise;
    })
  );
});