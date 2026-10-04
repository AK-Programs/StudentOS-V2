// OneSignal SDK Web Push Integration
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
  console.warn('[SW] OneSignalSDK.sw.js import notice:', e);
}

// StudentOS Service Worker Version & Cache Name
const SW_VERSION = 'studentos-v2.9.0';
const CACHE_NAME = `studentos-cache-${SW_VERSION}`;

// Service Worker Installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker Activation & Safe Cache Purging
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('studentos-cache-') && name !== CACHE_NAME)
          .map((oldName) => caches.delete(oldName))
      );
    }).then(() => self.clients.claim())
  );
});

// Update Listener from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let data = { title: '📢 StudentOS Alert', body: 'You have a new school announcement.', linkTab: 'notice_viewer' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const tag = data.tag || `studentos-notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: tag,
    renotify: true,
    requireInteraction: false,
    timestamp: data.timestamp || Date.now(),
    vibrate: [150, 50, 150],
    data: {
      linkTab: data.linkTab || 'notice_viewer',
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open StudentOS' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '📢 StudentOS Notice', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (event.notification.data && event.notification.data.linkTab) {
            client.postMessage({ type: 'STUDENTOS_NAVIGATE_TAB', tab: event.notification.data.linkTab });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});

// Pass-through fetch handler to satisfy PWA installability requirements
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});
