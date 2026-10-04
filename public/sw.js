// ========================================================
// StudentOS Service Worker — FCM Push & PWA Offline Engine
// ========================================================

// Optional Firebase Messaging Scripts Import for compat background handling
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

  const defaultFirebaseConfig = {
    projectId: "gen-lang-client-0785563242",
    appId: "1:940502459076:web:843c78167b4b83a1c25f91",
    apiKey: "AIzaSyCtFjAhG_Y3G28t2iDV_0GzNvFRNUj9nFA",
    authDomain: "gen-lang-client-0785563242.firebaseapp.com",
    storageBucket: "gen-lang-client-0785563242.firebasestorage.app",
    messagingSenderId: "940502459076"
  };

  firebase.initializeApp(defaultFirebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW FCM] Received background message:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || '📢 StudentOS Alert';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || payload.data?.message || 'You have a new school update.',
      icon: payload.notification?.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.data?.tag || `studentos-fcm-${Date.now()}`,
      renotify: true,
      data: {
        linkTab: payload.data?.linkTab || 'notice_viewer',
        url: payload.data?.url || '/'
      },
      vibrate: [150, 50, 150]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  // Graceful fallback: Native Web Push listener below handles all VAPID & FCM pushes directly
}

// StudentOS Service Worker Version & Cache Name
const SW_VERSION = 'studentos-v3.12.0';
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

// Native Push Event Listener (handles all FCM and VAPID pushes across browsers and background/PWA)
self.addEventListener('push', (event) => {
  let data = {
    title: '📢 StudentOS Alert',
    body: 'You have a new school announcement.',
    linkTab: 'notice_viewer',
    url: '/'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed) {
        // FCM payload format or custom StudentOS payload
        if (parsed.notification) {
          data.title = parsed.notification.title || data.title;
          data.body = parsed.notification.body || data.body;
          data.icon = parsed.notification.icon || '/icons/icon-192.png';
        }
        if (parsed.data) {
          data.title = parsed.data.title || data.title;
          data.body = parsed.data.body || parsed.data.message || data.body;
          data.linkTab = parsed.data.linkTab || data.linkTab;
          data.url = parsed.data.url || data.url;
          data.tag = parsed.data.tag;
        }
        if (!parsed.notification && !parsed.data) {
          data = { ...data, ...parsed };
        }
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

// Handle Notification Click & Focus / Open StudentOS tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetTab = event.notification.data?.linkTab || 'notice_viewer';
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (targetTab) {
            client.postMessage({ type: 'STUDENTOS_NAVIGATE_TAB', tab: targetTab });
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Pass-through fetch handler to satisfy PWA installability requirements
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});
