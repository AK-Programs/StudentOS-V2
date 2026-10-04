// Pusher Beams Web Push Service Worker Integration
try {
  importScripts("https://js.pusher.com/beams/service-worker.js");
} catch (e) {
  // Graceful fallback when offline; native StudentOS push listener below handles VAPID & local dispatches
}

// StudentOS Service Worker Version & Cache Name
const SW_VERSION = 'studentos-v3.0.0';
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
      const parsed = event.data.json();
      if (parsed && parsed.notification) {
        // Pusher Beams web notification format
        data = {
          title: parsed.notification.title || '📢 StudentOS Alert',
          body: parsed.notification.body || '',
          icon: parsed.notification.icon || '/icons/icon-192.png',
          linkTab: (parsed.data && parsed.data.linkTab) || 'notice_viewer',
          url: (parsed.data && parsed.data.url) || parsed.notification.deep_link || '/',
          tag: (parsed.data && parsed.data.tag) || undefined
        };
      } else if (parsed) {
        data = { ...data, ...parsed };
      }
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
