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
  const isCallNotification = payloadData.type === 'call' || payloadData.type === 'incoming_call';
  const callId = payloadData.data?.callId || payloadData.notifId || '';
  const deterministicTag =
    payloadData.tag ||
    (isCallNotification ? `studentos-call-${callId || Date.now()}` : (payloadData.notifId ? `studentos-notif-${payloadData.notifId}` : `studentos-notif-${Date.now()}`));

  const targetUrl = payloadData.url && payloadData.url !== '/'
    ? payloadData.url
    : (isCallNotification
        ? `/?tab=peer_chat&callId=${encodeURIComponent(callId)}`
        : `/?tab=${encodeURIComponent(payloadData.linkTab || 'notice_viewer')}${payloadData.notifId ? `&notifId=${encodeURIComponent(payloadData.notifId)}` : ''}`);

  const notificationOptions = {
    body: payloadData.body || (isCallNotification ? '📞 Incoming StudentOS Call... Tap to answer.' : 'Tap to view in StudentOS.'),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: deterministicTag,
    renotify: true,
    requireInteraction: isCallNotification,
    vibrate: isCallNotification ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200],
    timestamp: Date.now(),
    data: {
      linkTab: payloadData.linkTab || (isCallNotification ? 'peer_chat' : 'notice_viewer'),
      notifId: payloadData.notifId || '',
      type: payloadData.type || 'announcement',
      callId: callId,
      schoolId: payloadData.schoolId || 'default_school',
      url: targetUrl
    },
    actions: isCallNotification
      ? [
          { action: 'accept', title: '📞 Accept' },
          { action: 'decline', title: '❌ Decline' }
        ]
      : [
          { action: 'open', title: 'View Notice' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
  };

  event.waitUntil(
    self.registration.showNotification(payloadData.title, notificationOptions).then(() => {
      console.log('[SW FCM] Chrome/Android notification displayed successfully:', {
        title: payloadData.title,
        tag: deterministicTag,
        isCall: isCallNotification,
        linkTab: payloadData.linkTab
      });
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: isCallNotification ? 'FCM_SW_INCOMING_CALL' : 'FCM_SW_NOTIFICATION_DISPLAYED',
            title: payloadData.title,
            body: payloadData.body,
            linkTab: payloadData.linkTab,
            notifId: payloadData.notifId,
            callId: callId,
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
  const isCall = data.type === 'call' || data.type === 'incoming_call' || Boolean(data.callId);
  const targetTab = data.linkTab || (isCall ? 'peer_chat' : 'notice_viewer');
  const notifId = data.notifId || '';
  const callId = data.callId || notifId || '';
  const action = event.action || 'open';

  if (isCall && action === 'decline') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'STUDENTOS_CALL_ACTION',
            action: 'decline',
            callId: callId
          });
          client.postMessage({
            type: 'INCOMING_CALL_ACTION',
            action: 'decline',
            callId: callId
          });
        });
      })
    );
    return;
  }

  const targetUrl = data.url && data.url !== '/'
    ? (isCall && action === 'accept' ? `${data.url}&autoAccept=1` : data.url)
    : (isCall
        ? `/?tab=peer_chat&callId=${encodeURIComponent(callId)}${action === 'accept' ? '&autoAccept=1' : ''}`
        : `/?tab=${encodeURIComponent(targetTab)}${notifId ? `&notifId=${encodeURIComponent(notifId)}` : ''}`);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            const activeClient = focusedClient || client;
            activeClient.postMessage({
              type: isCall ? 'STUDENTOS_INCOMING_CALL' : 'STUDENTOS_NAVIGATE_TAB',
              tab: targetTab,
              linkTab: targetTab,
              notifId: notifId,
              callId: callId,
              action: action,
              url: targetUrl
            });
            if (isCall) {
              activeClient.postMessage({
                type: 'INCOMING_CALL_ACTION',
                action: action,
                callId: callId
              });
            }
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
