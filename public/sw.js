// ========================================================
// StudentOS Service Worker — FCM Web Push & PWA Engine
// ========================================================

const SW_VERSION = 'studentos-v3.16.0';
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

function buildCanonicalNotificationUrl(targetTab, notifId, isCall, callId, action) {
  const safeTab = targetTab || (isCall ? 'peer_chat' : 'notice_viewer');
  const params = new URLSearchParams();
  params.set('tab', safeTab);
  if (notifId) params.set('notifId', notifId);
  if (isCall && callId) params.set('callId', callId);
  if (isCall && action === 'accept') params.set('autoAccept', '1');
  return `/?${params.toString()}`;
}

function mergeTargetUrl(rawUrl, targetTab, notifId, isCall, callId, action) {
  if (!rawUrl || rawUrl === '/') {
    return buildCanonicalNotificationUrl(targetTab, notifId, isCall, callId, action);
  }
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (!parsed.searchParams.get('tab') && targetTab) {
      parsed.searchParams.set('tab', targetTab);
    }
    if (notifId && !parsed.searchParams.get('notifId')) {
      parsed.searchParams.set('notifId', notifId);
    }
    if (isCall && callId && !parsed.searchParams.get('callId')) {
      parsed.searchParams.set('callId', callId);
    }
    if (isCall && action === 'accept') {
      parsed.searchParams.set('autoAccept', '1');
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch (_) {
    return buildCanonicalNotificationUrl(targetTab, notifId, isCall, callId, action);
  }
}

// ========================================================
// FCM / Web Push Background & Foreground Notification Handler
// ========================================================
self.addEventListener('push', (event) => {
  console.log('[SW FCM] Push event received by Service Worker');

  let payloadData = {
    title: '📢 Veylentra Notice',
    body: 'You have a new school broadcast.',
    linkTab: 'notice_viewer',
    notifId: '',
    callId: '',
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
          payloadData.linkTab = parsed.data.linkTab || parsed.data.tab || parsed.data.route || payloadData.linkTab;
          payloadData.notifId = parsed.data.notificationId || parsed.data.notifId || parsed.data.id || '';
          payloadData.callId = parsed.data.callId || parsed.callId || '';
          payloadData.type = parsed.data.type || parsed.type || payloadData.type;
          payloadData.schoolId = parsed.data.schoolId || payloadData.schoolId;
          payloadData.tag = parsed.data.tag || parsed.tag || '';
          payloadData.url = parsed.data.url || parsed.url || '';
        }
        if (!parsed.notification && !parsed.data) {
          payloadData.title = parsed.title || payloadData.title;
          payloadData.body = parsed.body || parsed.message || payloadData.body;
          payloadData.linkTab = parsed.linkTab || parsed.tab || parsed.route || payloadData.linkTab;
          payloadData.notifId = parsed.notificationId || parsed.notifId || parsed.id || '';
          payloadData.callId = parsed.callId || '';
          payloadData.type = parsed.type || payloadData.type;
          payloadData.tag = parsed.tag || '';
          payloadData.url = parsed.url || '';
        }
      }
    }
  } catch (e) {
    if (event.data) {
      payloadData.body = event.data.text();
    }
  }

  // Deterministic tag so foreground & background pushes for the same notice coalesce into ONE notification
  const isCallNotification = payloadData.type === 'call' || payloadData.type === 'incoming_call' || Boolean(payloadData.callId);
  const callId = payloadData.callId || (isCallNotification ? payloadData.notifId : '') || '';
  const deterministicTag =
    payloadData.tag ||
    (isCallNotification ? `studentos-call-${callId || Date.now()}` : (payloadData.notifId ? `studentos-notif-${payloadData.notifId}` : `studentos-notif-${Date.now()}`));

  const resolvedTab = payloadData.linkTab || (isCallNotification ? 'peer_chat' : 'notice_viewer');
  const targetUrl = mergeTargetUrl(payloadData.url, resolvedTab, payloadData.notifId, isCallNotification, callId, 'open');

  const notificationOptions = {
    body: payloadData.body || (isCallNotification ? '📞 Incoming Veylentra Call... Tap to answer.' : 'Tap to view in Veylentra.'),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: deterministicTag,
    renotify: true,
    requireInteraction: isCallNotification,
    vibrate: isCallNotification ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200],
    timestamp: Date.now(),
    data: {
      linkTab: resolvedTab,
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
        linkTab: resolvedTab
      });
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: isCallNotification ? 'FCM_SW_INCOMING_CALL' : 'FCM_SW_NOTIFICATION_DISPLAYED',
            title: payloadData.title,
            body: payloadData.body,
            linkTab: resolvedTab,
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
  const targetTab = data.linkTab || data.tab || data.route || (isCall ? 'peer_chat' : 'notice_viewer');
  const notifId = data.notifId || data.notificationId || '';
  const callId = data.callId || (isCall ? notifId : '') || '';
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

  const targetUrl = mergeTargetUrl(data.url, targetTab, notifId, isCall, callId, action);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const sameOriginClients = clientList.filter((client) => {
        try {
          const parsed = new URL(client.url);
          return parsed.origin === self.location.origin && !parsed.pathname.includes('auth-debug');
        } catch (_) {
          return false;
        }
      });

      const prioritizedClient =
        sameOriginClients.find((c) => c.focused) ||
        sameOriginClients.find((c) => c.visibilityState === 'visible') ||
        sameOriginClients[0];

      if (prioritizedClient) {
        try {
          const focusedClient = 'focus' in prioritizedClient
            ? await prioritizedClient.focus()
            : prioritizedClient;
          const activeClient = focusedClient || prioritizedClient;
          activeClient.postMessage({
            type: isCall ? 'STUDENTOS_INCOMING_CALL' : 'STUDENTOS_NAVIGATE_TAB',
            tab: targetTab,
            linkTab: targetTab,
            notifId: notifId,
            notifType: data.type || 'announcement',
            callId: callId,
            action: action,
            url: targetUrl,
            ts: Date.now()
          });
          if (isCall) {
            activeClient.postMessage({
              type: 'INCOMING_CALL_ACTION',
              action: action,
              callId: callId
            });
          }
          return activeClient;
        } catch (focusErr) {
          console.warn('[SW FCM] Focus existing client failed, falling back to openWindow:', focusErr);
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
