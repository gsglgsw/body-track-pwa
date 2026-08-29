// sw.js (Service Worker)

// 🚩 每次更新 SW 邏輯，務必推進版號，強制瀏覽器安裝新版
const CACHE_NAME = 'bodytrack-cache-v1-20260829-23';

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
      .then(() => self.skipWaiting()) // 強制立即接管控制權
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

  // 例外排除：絕對不快取 GAS API 的請求
  if (requestUrl.hostname.includes('script.google.com')) {
    return;
  }

  // 靜態資源策略：Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        console.warn('[Service Worker] 網路異常且無快取可供讀取');
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. 背景同步階段 (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-records') {
    console.log('[Service Worker] 攔截到原生 background sync 事件');
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients && clients.length > 0) {
          clients[0].postMessage({ type: 'FORCE_SYNC' });
        }
      })
    );
  }
});

// ==========================================
// 🚀 Phase 4: Web Push Notification 引擎
// ==========================================

// 5. 攔截推播事件 (背景接收)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] 收到推播訊息');
  
  // 預設推播內容防呆
  let payload = {
    title: '我的輕盈日記',
    body: '該記錄今天的體重囉！',
    url: '/'
  };

  // 解析伺服器傳來的 JSON Payload
  if (event.data) {
    try {
      const parsedData = event.data.json();
      payload = { ...payload, ...parsedData };
    } catch (e) {
      payload.body = event.data.text(); // 退回純文字模式
    }
  }

  // 設定系統通知的視覺與震動參數
  const options = {
    body: payload.body,
    icon: './assets/192.png',
    badge: './assets/192.png', // Android 狀態列的單色小圖示
    vibrate: [200, 100, 200, 100, 200], // 震動節奏
    requireInteraction: true, // 強制停留直到使用者滑掉或點擊
    data: { url: payload.url } // 將導向網址藏在 data 裡供點擊時讀取
  };

  // 喚起作業系統級別的通知
  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// 6. 推播點擊事件 (喚醒 App)
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] 推播被點擊');
  
  // 關閉系統通知橫幅
  event.notification.close();

  // 取得當初藏在 data 裡的網址
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 邏輯：如果 App 已經打開，就切換回該分頁並聚焦；如果沒打開，就開啟新分頁
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url.includes(urlToOpen)) {
          matchingClient = windowClient;
          break;
        }
      }
      
      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});