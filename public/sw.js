// ========================================================
// StudentOS Service Worker — FCM Web Push & PWA Engine
// ========================================================

const SW_VERSION = 'studentos-v3.15.0';
const CACHE_NAME = `studentos-cache-${SW_VERSION}`;

// Service Worker Installation — Activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker Activation — Claim all clients immediately
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

// Message Listener from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ========================================================
// FCM / Web Push Background & Foreground Notification Handler
// ========================================================
self.addEventListener('push', (event) => {
  console.log('[SW FCM] Push event received by Service Worker');

  let payloadData = {
    title: '📢 StudentOS Notice',
    body: 'You have a new school broadcast.',
    linkTab: 'notice_viewer',
    notifId: '',
    type: 'announcement',
    schoolId: 'default_school',
    url: '/?tab=notice_viewer',
    tag: '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed) {
        if (parsed.notification) {
          payloadData.title = parsed.notification.title || payloadData.title;
          payloadData.body = parsed.notification.body || payloadData.body;
          payloadData.icon = parsed.notification.icon || payloadData.icon;
          payloadData.badge = parsed.notification.badge || payloadData.badge;
        }
        if (parsed.data) {
          payloadData.title = parsed.data.title || payloadData.title;
          payloadData.body = parsed.data.body || parsed.data.message || payloadData.body;
          payloadData.linkTab = parsed.data.linkTab || parsed.data.route || payloadData.linkTab;
          payloadData.notifId = parsed.data.notificationId || parsed.data.notifId || parsed.data.id || '';
          payloadData.type = parsed.data.type || payloadData.type;
          payloadData.schoolId = parsed.data.schoolId || payloadData.schoolId;
          payloadData.tag = parsed.data.tag || '';
          payloadData.url = parsed.data.url || `/?tab=${encodeURIComponent(payloadData.linkTab)}`;
        }
        if (!parsed.notification && !parsed.data) {
          payloadData.title = parsed.title || payloadData.title;
          payloadData.body = parsed.body || parsed.message || payloadData.body;
          payloadData.linkTab = parsed.linkTab || parsed.route || payloadData.linkTab;
          payloadData.notifId = parsed.notificationId || parsed.notifId || parsed.id || '';
          payloadData.type = parsed.type || payloadData.type;
          payloadData.tag = parsed.tag || '';
          payloadData.url = parsed.url || `/?tab=${encodeURIComponent(payloadData.linkTab)}`;
        }
      }
    }
  } catch (e) {
    if (event.data) {
      payloadData.body = event.data.text();
    }
  }

  // Deterministic tag so foreground & background pushes for the same notice coalesce into ONE notification
  const deterministicTag =
    payloadData.tag ||
    (payloadData.notifId ? `studentos-notif-${payloadData.notifId}` : `studentos-notif-${Date.now()}`);

  const targetUrl = payloadData.url && payloadData.url !== '/'
    ? payloadData.url
    : `/?tab=${encodeURIComponent(payloadData.linkTab || 'notice_viewer')}${payloadData.notifId ? `&notifId=${encodeURIComponent(payloadData.notifId)}` : ''}`;

  const notificationOptions = {
    body: payloadData.body || 'Tap to view in StudentOS.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: deterministicTag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: {
      linkTab: payloadData.linkTab || 'notice_viewer',
      notifId: payloadData.notifId || '',
      type: payloadData.type || 'announcement',
      schoolId: payloadData.schoolId || 'default_school',
      url: targetUrl
    },
    actions: [
      { action: 'open', title: 'View Notice' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payloadData.title, notificationOptions).then(() => {
      console.log('[SW FCM] Chrome/Android notification displayed successfully:', {
        title: payloadData.title,
        tag: deterministicTag,
        linkTab: payloadData.linkTab
      });
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'FCM_SW_NOTIFICATION_DISPLAYED',
            title: payloadData.title,
            body: payloadData.body,
            linkTab: payloadData.linkTab,
            notifId: payloadData.notifId,
            tag: deterministicTag
          });
        });
      });
    })
  );
});

// ========================================================
// Notification Click — Focus or Open Correct StudentOS Route
// ========================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const targetTab = data.linkTab || 'notice_viewer';
  const notifId = data.notifId || '';
  const targetUrl = data.url && data.url !== '/'
    ? data.url
    : `/?tab=${encodeURIComponent(targetTab)}${notifId ? `&notifId=${encodeURIComponent(notifId)}` : ''}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            const activeClient = focusedClient || client;
            activeClient.postMessage({
              type: 'STUDENTOS_NAVIGATE_TAB',
              tab: targetTab,
              linkTab: targetTab,
              notifId: notifId,
              url: targetUrl
            });
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Safe navigation-only fetch handler for PWA compliance (never intercept API, Supabase, or JS module requests with plain text)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/index.html').then((r) => r || fetch(event.request)))
  );
});
