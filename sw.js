const CACHE_NAME = 'henngaku-v2.0.0';
const BASE_PATH = '/hoken.hengak';
const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/icon.png'
];

// Install: キャッシュ作成
self.addEventListener('install', event => {
  console.log('[SW] Install イベント');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] キャッシュ作成:', CACHE_NAME);
      // index.html のみキャッシュ（動的にキャッシュ）
      return cache.add(BASE_PATH + '/index.html').catch(() => {
        console.log('[SW] index.html がオフラインの場合はスキップ');
      });
    })
  );
  self.skipWaiting(); // 即座にアクティベーション
});

// Activate: 古いキャッシュ削除
self.addEventListener('activate', event => {
  console.log('[SW] Activate イベント');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 古いキャッシュ削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // 即座にページ制御開始
});

// Fetch: Network First（常に最新優先 → フォールバック: キャッシュ）
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 外部ドメイン・WebSocket・Chrome拡張などはスキップ
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        // ネットワーク成功 → キャッシュ更新 + レスポンス返却
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワーク失敗 → キャッシュから取得
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] キャッシュから取得:', request.url);
            return cachedResponse;
          }
          // キャッシュもない場合 → エラーページ（オプション）
          console.log('[SW] キャッシュなし:', request.url);
          return new Response('Offline - コンテンツが利用できません', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
      })
  );
});

// Message: クライアントからのメッセージに対応
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
